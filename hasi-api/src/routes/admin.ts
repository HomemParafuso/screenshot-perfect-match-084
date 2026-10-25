import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { requireAdmin } from "../auth.js";
import { hashPassword } from "../crypto.js";
import { query, tx } from "../db.js";
import { FEATURES, getEntitlements } from "../entitlements.js";
import { HttpError } from "../errors.js";
import { KEY_COLUMNS } from "./me.js";

const idParam = z.object({ id: z.string().uuid() });
const list = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["trial", "active", "past_due", "canceled", "suspended"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const subStatus = z.enum(["trial", "active", "past_due", "canceled", "suspended"]);

export async function adminRoutes(app: FastifyInstance) {
  app.register(async (r) => {
    r.addHook("preHandler", requireAdmin);

    r.get("/admin/stats", async () => {
      const q = await query(`SELECT
        (SELECT count(*) FROM users)::int AS users,
        (SELECT count(*) FROM users WHERE status = 'suspended')::int AS suspended_users,
        (SELECT count(*) FROM subscriptions WHERE status = 'active')::int AS active_subs,
        (SELECT count(*) FROM subscriptions WHERE status = 'trial')::int AS trial_subs,
        (SELECT count(*) FROM subscriptions WHERE status = 'past_due')::int AS past_due_subs,
        (SELECT count(*) FROM user_devices WHERE revoked_at IS NULL)::int AS active_devices,
        (SELECT count(*) FROM remote_sessions WHERE created_at >= date_trunc('month', now()))::int AS remote_sessions_month,
        (SELECT coalesce(sum(input_tokens+output_tokens),0) FROM token_usage WHERE created_at >= date_trunc('month', now()))::bigint AS tokens_month`);
      return { ...q.rows[0], tokens_month: Number(q.rows[0].tokens_month) };
    });

    // ---- users
    r.get("/admin/users", async (req) => {
      const { q, limit, offset } = list.parse(req.query);
      const res = await query(
        `SELECT u.id, u.email, u.status, u.created_at, p.display_name, s.status AS subscription_status, pl.name AS plan_name,
                EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role='admin') AS is_admin,
                count(*) OVER()::int AS total
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status <> 'canceled'
           LEFT JOIN plans pl ON pl.id = s.plan_id
          WHERE ($1::text IS NULL OR u.email::text ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
          ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`,
        [q || null, limit, offset],
      );
      return { total: res.rows[0]?.total ?? 0, items: res.rows.map(({ total, ...x }) => x) };
    });

    r.post("/admin/users", async (req, reply) => {
      const b = z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(10).max(256),
        display_name: z.string().trim().max(100).optional(),
      }).parse(req.body);
      const hash = await hashPassword(b.password);
      const id = await tx(async (c) => {
        const u = await c.query(`INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`, [b.email, hash]);
        await c.query(`INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2)`, [u.rows[0].id, b.display_name ?? null]);
        return u.rows[0].id;
      });
      await audit(req, "admin.user.create", { target: id });
      return reply.status(201).send({ id });
    });

    r.get("/admin/users/:id", async (req) => {
      const { id } = idParam.parse(req.params);
      const u = await query(
        `SELECT u.id, u.email, u.status, u.created_at, p.display_name, p.locale, p.preferences,
                EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role='admin') AS is_admin
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`, [id]);
      if (!u.rowCount) throw new HttpError(404, "not_found");
      const [ent, devices, keys, skills, agents, sessions, subs] = await Promise.all([
        getEntitlements(id),
        query(`SELECT id, name, platform, app_version, last_seen_at, revoked_at, created_at FROM user_devices WHERE user_id=$1 ORDER BY created_at DESC`, [id]),
        query(`SELECT ${KEY_COLUMNS} FROM user_provider_keys WHERE user_id=$1 ORDER BY created_at DESC`, [id]),
        query(`SELECT id, name, description, enabled, updated_at FROM user_skills WHERE user_id=$1 ORDER BY name`, [id]),
        query(`SELECT id, name, description, enabled, updated_at FROM user_agents WHERE user_id=$1 ORDER BY name`, [id]),
        query(`SELECT id, provider, status, started_at, ended_at, created_at FROM remote_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [id]),
        query(`SELECT s.id, s.status, s.current_period_start, s.current_period_end, s.created_at, p.name AS plan_name, p.id AS plan_id FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=$1 ORDER BY s.created_at DESC`, [id]),
      ]);
      return { user: u.rows[0], entitlements: ent, subscriptions: subs.rows, devices: devices.rows, provider_keys: keys.rows, skills: skills.rows, agents: agents.rows, remote_sessions: sessions.rows };
    });

    r.post("/admin/users/:id/suspend", async (req) => {
      const { id } = idParam.parse(req.params);
      if (id === req.user!.id) throw new HttpError(400, "cannot_suspend_self");
      const q = await query(`UPDATE users SET status='suspended', updated_at=now() WHERE id=$1 RETURNING id`, [id]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await query(`UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [id]);
      await audit(req, "admin.user.suspend", { target: id });
      return { ok: true };
    });

    r.post("/admin/users/:id/reactivate", async (req) => {
      const { id } = idParam.parse(req.params);
      const q = await query(`UPDATE users SET status='active', updated_at=now() WHERE id=$1 RETURNING id`, [id]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await audit(req, "admin.user.reactivate", { target: id });
      return { ok: true };
    });

    r.post("/admin/users/:id/devices/:deviceId/revoke", async (req) => {
      const p = z.object({ id: z.string().uuid(), deviceId: z.string().uuid() }).parse(req.params);
      const q = await query(`UPDATE user_devices SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`, [p.deviceId, p.id]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await query(`UPDATE user_sessions SET revoked_at=now() WHERE device_id=$1 AND revoked_at IS NULL`, [p.deviceId]);
      await audit(req, "admin.device.revoke", { target: p.id, details: { device_id: p.deviceId } });
      return { ok: true };
    });

    // Set or change plan / subscription status
    r.put("/admin/users/:id/subscription", async (req) => {
      const { id } = idParam.parse(req.params);
      const b = z.object({ plan_id: z.string().uuid(), status: subStatus, period_days: z.number().int().min(1).max(366).default(30), note: z.string().max(300).optional() }).parse(req.body);
      const result = await tx(async (c) => {
        const cur = await c.query(`SELECT id, status FROM subscriptions WHERE user_id=$1 AND status <> 'canceled' FOR UPDATE`, [id]);
        let subId: string, from: string | null = null;
        if (cur.rowCount) {
          subId = cur.rows[0].id; from = cur.rows[0].status;
          await c.query(
            `UPDATE subscriptions SET plan_id=$2, status=$3, updated_at=now(),
                    current_period_end = CASE WHEN $3::subscription_status IN ('active','trial') AND current_period_end < now()
                                              THEN now() + ($4||' days')::interval ELSE current_period_end END
              WHERE id=$1`, [subId, b.plan_id, b.status, String(b.period_days)]);
        } else {
          const n = await c.query(`INSERT INTO subscriptions (user_id, plan_id, status, current_period_end) VALUES ($1,$2,$3, now() + ($4||' days')::interval) RETURNING id`, [id, b.plan_id, b.status, String(b.period_days)]);
          subId = n.rows[0].id;
        }
        await c.query(`INSERT INTO subscription_events (subscription_id, from_status, to_status, actor_user_id, note) VALUES ($1,$2,$3,$4,$5)`, [subId, from, b.status, req.user!.id, b.note ?? null]);
        return { id: subId, from };
      });
      await audit(req, "admin.subscription.set", { target: id, details: { subscription_id: result.id, from: result.from, to: b.status, plan_id: b.plan_id } });
      return { id: result.id };
    });

    r.put("/admin/users/:id/admin", async (req) => {
      const { id } = idParam.parse(req.params);
      const { is_admin } = z.object({ is_admin: z.boolean() }).parse(req.body);
      if (!is_admin && id === req.user!.id) throw new HttpError(400, "cannot_demote_self");
      if (is_admin) await query(`INSERT INTO admin_roles (user_id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING`, [id]);
      else await query(`DELETE FROM admin_roles WHERE user_id=$1 AND role='admin'`, [id]);
      await audit(req, is_admin ? "admin.role.grant" : "admin.role.revoke", { target: id });
      return { ok: true };
    });

    // ---- plans & entitlements
    r.get("/admin/plans", async () => {
      const p = await query(`SELECT id, code, name, monthly_price_cents, currency, is_active, created_at FROM plans ORDER BY monthly_price_cents`);
      const e = await query(`SELECT plan_id, feature, enabled, limit_value FROM plan_entitlements`);
      return p.rows.map((pl) => ({
        ...pl,
        entitlements: FEATURES.map((f) => {
          const x = e.rows.find((row) => row.plan_id === pl.id && row.feature === f);
          return { feature: f, enabled: x?.enabled ?? false, limit: x?.limit_value == null ? null : Number(x.limit_value) };
        }),
      }));
    });

    const planBody = z.object({
      code: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/),
      name: z.string().trim().min(1).max(80),
      monthly_price_cents: z.number().int().min(0),
      currency: z.string().length(3).toUpperCase().default("BRL"),
      is_active: z.boolean().default(true),
    });

    r.post("/admin/plans", async (req, reply) => {
      const b = planBody.parse(req.body);
      const q = await query(`INSERT INTO plans (code, name, monthly_price_cents, currency, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [b.code, b.name, b.monthly_price_cents, b.currency, b.is_active]);
      await audit(req, "admin.plan.create", { details: { plan_id: q.rows[0].id, ...b } });
      return reply.status(201).send(q.rows[0]);
    });

    r.patch("/admin/plans/:id", async (req) => {
      const { id } = idParam.parse(req.params);
      const b = planBody.partial().parse(req.body);
      const q = await query(
        `UPDATE plans SET code=COALESCE($2,code), name=COALESCE($3,name), monthly_price_cents=COALESCE($4,monthly_price_cents),
                currency=COALESCE($5,currency), is_active=COALESCE($6,is_active) WHERE id=$1 RETURNING id`,
        [id, b.code ?? null, b.name ?? null, b.monthly_price_cents ?? null, b.currency ?? null, b.is_active ?? null]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await audit(req, "admin.plan.update", { details: { plan_id: id, ...b } });
      return { ok: true };
    });

    r.put("/admin/plans/:id/entitlements", async (req) => {
      const { id } = idParam.parse(req.params);
      const items = z.array(z.object({ feature: z.enum(FEATURES), enabled: z.boolean(), limit: z.number().int().min(0).nullable() })).max(20).parse(req.body);
      await tx(async (c) => {
        for (const i of items) {
          await c.query(
            `INSERT INTO plan_entitlements (plan_id, feature, enabled, limit_value) VALUES ($1,$2,$3,$4)
             ON CONFLICT (plan_id, feature) DO UPDATE SET enabled=EXCLUDED.enabled, limit_value=EXCLUDED.limit_value`,
            [id, i.feature, i.enabled, i.limit]);
        }
      });
      await audit(req, "admin.entitlements.update", { details: { plan_id: id, items } });
      return { ok: true };
    });

    // ---- global lists
    r.get("/admin/subscriptions", async (req) => {
      const { status, limit, offset } = list.parse(req.query);
      return (await query(
        `SELECT s.id, s.status, s.current_period_start, s.current_period_end, s.updated_at, u.id AS user_id, u.email, p.name AS plan_name
           FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id
          WHERE ($1::subscription_status IS NULL OR s.status=$1) ORDER BY s.updated_at DESC LIMIT $2 OFFSET $3`,
        [status ?? null, limit, offset])).rows;
    });

    r.get("/admin/subscription-events", async (req) => {
      const { limit } = list.parse(req.query);
      return (await query(
        `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.email, a.email AS actor_email
           FROM subscription_events e JOIN subscriptions s ON s.id=e.subscription_id JOIN users u ON u.id=s.user_id
           LEFT JOIN users a ON a.id=e.actor_user_id ORDER BY e.created_at DESC LIMIT $1`, [limit])).rows;
    });

    const joined = (table: string, cols: string, order: string) =>
      r.get(`/admin/${table === "user_devices" ? "devices" : table === "user_provider_keys" ? "provider-keys" : table === "user_skills" ? "skills" : "agents"}`, async (req) => {
        const { limit, offset } = list.parse(req.query);
        return (await query(`SELECT ${cols}, u.id AS user_id, u.email FROM ${table} t JOIN users u ON u.id=t.user_id ORDER BY t.${order} DESC LIMIT $1 OFFSET $2`, [limit, offset])).rows;
      });
    joined("user_devices", "t.id, t.name, t.platform, t.app_version, t.last_seen_at, t.revoked_at, t.created_at", "created_at");
    joined("user_provider_keys", "t.id, t.provider, t.label, t.last4, t.created_at", "created_at"); // never ciphertext
    joined("user_skills", "t.id, t.name, t.description, t.enabled, t.updated_at", "updated_at");
    joined("user_agents", "t.id, t.name, t.description, t.enabled, t.updated_at", "updated_at");

    r.get("/admin/remote-usage", async (req) => {
      const { limit } = list.parse(req.query);
      const [sessions, top] = await Promise.all([
        query(`SELECT rs.id, rs.provider, rs.status, rs.started_at, rs.ended_at, rs.created_at, u.id AS user_id, u.email
                 FROM remote_sessions rs JOIN users u ON u.id=rs.user_id ORDER BY rs.created_at DESC LIMIT $1`, [limit]),
        query(`SELECT * FROM (
                 SELECT u.id AS user_id, u.email,
                        (SELECT count(*) FROM remote_calls c WHERE c.user_id=u.id AND c.created_at >= date_trunc('month', now()))::int AS calls_month,
                        (SELECT coalesce(sum(input_tokens+output_tokens),0) FROM token_usage t WHERE t.user_id=u.id AND t.created_at >= date_trunc('month', now()))::bigint AS tokens_month
                   FROM users u) x
                WHERE calls_month > 0 OR tokens_month > 0 ORDER BY tokens_month DESC, calls_month DESC LIMIT 20`),
      ]);
      return { sessions: sessions.rows, top_users: top.rows.map((x) => ({ ...x, tokens_month: Number(x.tokens_month) })) };
    });

    r.get("/admin/audit-logs", async (req) => {
      const { q, limit, offset } = list.parse(req.query);
      return (await query(
        `SELECT l.id, l.action, l.details, host(l.ip) AS ip, l.created_at, a.email AS actor_email, t.email AS target_email, l.target_user_id
           FROM audit_logs l LEFT JOIN users a ON a.id=l.actor_user_id LEFT JOIN users t ON t.id=l.target_user_id
          WHERE ($1::text IS NULL OR l.action ILIKE '%' || $1 || '%') ORDER BY l.created_at DESC LIMIT $2 OFFSET $3`,
        [q || null, limit, offset])).rows;
    });
  });
}
