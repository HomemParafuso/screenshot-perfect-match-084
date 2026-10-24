import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { requireAdmin } from "../auth.js";
import { hashPassword } from "../crypto.js";
import { query, tx } from "../db.js";
import { FEATURES } from "../entitlements.js";
import { HttpError } from "../errors.js";

const idParams = z.object({ id: z.string().uuid() });
const paging = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const featureSchema = z.enum(FEATURES);
const entitlementSchema = z.object({
  feature: featureSchema,
  enabled: z.boolean(),
  limitValue: z.number().int().min(0).nullable().optional(),
});
const statusSchema = z.enum(["trial", "active", "past_due", "canceled", "suspended"]);
const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/admin/stats", async () => {
    const [users, subs, mrr, devices, remote, tokens] = await Promise.all([
      query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'active')::int AS active,
                count(*) FILTER (WHERE status = 'suspended')::int AS suspended,
                count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last_30_days
           FROM users`,
      ),
      query(`SELECT status, count(*)::int AS count FROM subscriptions GROUP BY status`),
      query(
        `SELECT COALESCE(sum(p.monthly_price_cents),0)::int AS mrr_cents
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.status IN ('trial','active')`,
      ),
      query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE revoked_at IS NULL)::int AS active FROM user_devices`,
      ),
      query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'running')::int AS running FROM remote_sessions`,
      ),
      query(
        `SELECT COALESCE(sum(input_tokens+output_tokens),0)::bigint AS total
           FROM token_usage WHERE created_at > now() - interval '30 days'`,
      ),
    ]);
    return {
      users: users.rows[0],
      subscriptions: Object.fromEntries(subs.rows.map((r) => [r.status, r.count])),
      mrrCents: mrr.rows[0].mrr_cents,
      devices: devices.rows[0],
      remoteSessions: remote.rows[0],
      tokensLast30Days: tokens.rows[0].total,
    };
  });

  app.get("/admin/users", async (req) => {
    const q = z
      .object({
        q: z.string().trim().max(200).optional(),
        status: z.enum(["active", "suspended"]).optional(),
      })
      .merge(paging)
      .parse(req.query);
    const r = await query(
      `SELECT u.id, u.email, u.status, u.created_at,
              p.display_name,
              s.status AS subscription_status, pl.code AS plan_code, pl.name AS plan_name,
              (SELECT count(*)::int FROM user_devices d WHERE d.user_id = u.id AND d.revoked_at IS NULL) AS devices,
              EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role = 'admin') AS is_admin
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status <> 'canceled'
         LEFT JOIN plans pl ON pl.id = s.plan_id
        WHERE ($1::text IS NULL OR u.email::text ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR u.status = $2::user_status)
        ORDER BY u.created_at DESC
        LIMIT $3 OFFSET $4`,
      [q.q ?? null, q.status ?? null, q.limit, q.offset],
    );
    const total = await query(
      `SELECT count(*)::int AS total FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE ($1::text IS NULL OR u.email::text ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR u.status = $2::user_status)`,
      [q.q ?? null, q.status ?? null],
    );
    return { users: r.rows, total: total.rows[0].total };
  });

  app.post("/admin/users", async (req, reply) => {
    const body = z
      .object({
        email: emailSchema,
        password: z.string().min(12).max(200),
        displayName: z.string().trim().max(120).optional(),
        isAdmin: z.boolean().default(false),
      })
      .parse(req.body);
    const hash = await hashPassword(body.password);
    const userId = await tx(async (c) => {
      const u = await c.query(
        `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`,
        [body.email, hash],
      );
      const id = u.rows[0].id as string;
      await c.query(`INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2)`, [
        id,
        body.displayName ?? null,
      ]);
      if (body.isAdmin)
        await c.query(`INSERT INTO admin_roles (user_id, role) VALUES ($1,'admin')`, [id]);
      return id;
    });
    await audit(req, "admin.user.create", {
      target: userId,
      details: { email: body.email, isAdmin: body.isAdmin },
    });
    reply.status(201);
    return { id: userId };
  });

  app.get("/admin/users/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    const u = await query(
      `SELECT u.id, u.email, u.status, u.created_at, u.updated_at,
              p.display_name, p.locale, p.preferences,
              COALESCE((SELECT json_agg(a.role) FROM admin_roles a WHERE a.user_id = u.id), '[]') AS roles
         FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [id],
    );
    if (!u.rowCount) throw new HttpError(404, "not_found");

    const [sub, devices, keys, skills, agents, usage, remote, auditLogs] = await Promise.all([
      query(
        `SELECT s.id, s.status, s.current_period_start, s.current_period_end, s.created_at,
                p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.monthly_price_cents
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
          WHERE s.user_id = $1 AND s.status <> 'canceled' LIMIT 1`,
        [id],
      ),
      query(
        `SELECT id, name, platform, app_version, last_seen_at, revoked_at, created_at FROM user_devices WHERE user_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
      query(
        `SELECT id, provider, label, last4, key_version, created_at FROM user_provider_keys WHERE user_id = $1 ORDER BY created_at DESC`,
        [id],
      ),
      query(
        `SELECT id, name, description, enabled, created_at FROM user_skills WHERE user_id = $1 ORDER BY name`,
        [id],
      ),
      query(
        `SELECT id, name, description, enabled, created_at FROM user_agents WHERE user_id = $1 ORDER BY name`,
        [id],
      ),
      query(
        `SELECT event_type, count(*)::int AS count, max(created_at) AS last_at FROM usage_events WHERE user_id = $1 GROUP BY event_type`,
        [id],
      ),
      query(
        `SELECT id, provider, status, started_at, ended_at, created_at FROM remote_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [id],
      ),
      query(
        `SELECT id, action, details, ip, created_at FROM audit_logs WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
    ]);

    return {
      user: u.rows[0],
      subscription: sub.rows[0] ?? null,
      devices: devices.rows,
      providerKeys: keys.rows,
      skills: skills.rows,
      agents: agents.rows,
      usage: usage.rows,
      remoteSessions: remote.rows,
      auditLogs: auditLogs.rows,
    };
  });

  app.post("/admin/users/:id/suspend", async (req) => {
    const { id } = idParams.parse(req.params);
    const r = await query(
      `UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING email`,
      [id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await query(
      `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [id],
    );
    await audit(req, "admin.user.suspend", { target: id });
    return { ok: true };
  });

  app.post("/admin/users/:id/reactivate", async (req) => {
    const { id } = idParams.parse(req.params);
    const r = await query(
      `UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 RETURNING email`,
      [id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await audit(req, "admin.user.reactivate", { target: id });
    return { ok: true };
  });

  app.post("/admin/users/:id/devices/:deviceId/revoke", async (req) => {
    const { id, deviceId } = z
      .object({ id: z.string().uuid(), deviceId: z.string().uuid() })
      .parse(req.params);
    const r = await query(
      `UPDATE user_devices SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [deviceId, id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await query(
      `UPDATE user_sessions SET revoked_at = now() WHERE device_id = $1 AND revoked_at IS NULL`,
      [deviceId],
    );
    await audit(req, "admin.device.revoke", { target: id, details: { deviceId } });
    return { ok: true };
  });

  app.put("/admin/users/:id/subscription", async (req) => {
    const { id } = idParams.parse(req.params);
    const body = z
      .object({
        planId: z.string().uuid(),
        status: statusSchema,
        currentPeriodEnd: z.string().datetime().optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(req.body);

    const plan = await query(`SELECT id FROM plans WHERE id = $1`, [body.planId]);
    if (!plan.rowCount) throw new HttpError(404, "plan_not_found");
    const user = await query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (!user.rowCount) throw new HttpError(404, "user_not_found");

    await tx(async (c) => {
      const current = await c.query(
        `SELECT id, status FROM subscriptions WHERE user_id = $1 AND status <> 'canceled' FOR UPDATE`,
        [id],
      );
      const previous = current.rows[0]?.status ?? null;
      if (current.rowCount) {
        await c.query(
          `UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE id = $1`,
          [current.rows[0].id],
        );
      }
      const created = await c.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, current_period_end)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [
          id,
          body.planId,
          body.status,
          body.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ],
      );
      await c.query(
        `INSERT INTO subscription_events (subscription_id, from_status, to_status, actor_user_id, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [created.rows[0].id, previous, body.status, req.user!.id, body.note ?? null],
      );
    });

    await audit(req, "admin.subscription.set", {
      target: id,
      details: { planId: body.planId, status: body.status },
    });
    return { ok: true };
  });

  app.put("/admin/users/:id/admin", async (req) => {
    const { id } = idParams.parse(req.params);
    const body = z.object({ isAdmin: z.boolean() }).parse(req.body);
    if (body.isAdmin) {
      await query(
        `INSERT INTO admin_roles (user_id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING`,
        [id],
      );
    } else {
      await query(`DELETE FROM admin_roles WHERE user_id = $1 AND role = 'admin'`, [id]);
    }
    await audit(req, "admin.user.role", { target: id, details: { isAdmin: body.isAdmin } });
    return { ok: true };
  });

  app.get("/admin/plans", async () => {
    const r = await query(
      `SELECT p.id, p.code, p.name, p.monthly_price_cents, p.currency, p.is_active, p.created_at,
              COALESCE(json_agg(json_build_object('feature', e.feature, 'enabled', e.enabled, 'limitValue', e.limit_value))
                FILTER (WHERE e.feature IS NOT NULL), '[]') AS entitlements,
              (SELECT count(*)::int FROM subscriptions s WHERE s.plan_id = p.id AND s.status <> 'canceled') AS subscribers
         FROM plans p LEFT JOIN plan_entitlements e ON e.plan_id = p.id
        GROUP BY p.id ORDER BY p.monthly_price_cents`,
    );
    return { plans: r.rows };
  });

  app.post("/admin/plans", async (req, reply) => {
    const body = z
      .object({
        code: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9_-]+$/),
        name: z.string().trim().min(1).max(120),
        monthlyPriceCents: z.number().int().min(0).max(100_000_000),
        currency: z.string().length(3).default("BRL"),
        isActive: z.boolean().default(true),
      })
      .parse(req.body);
    const r = await query(
      `INSERT INTO plans (code, name, monthly_price_cents, currency, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [body.code, body.name, body.monthlyPriceCents, body.currency.toUpperCase(), body.isActive],
    );
    await audit(req, "admin.plan.create", { details: { planId: r.rows[0].id, code: body.code } });
    reply.status(201);
    return { id: r.rows[0].id };
  });

  app.patch("/admin/plans/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        monthlyPriceCents: z.number().int().min(0).max(100_000_000).optional(),
        currency: z.string().length(3).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const r = await query(
      `UPDATE plans SET
         name = COALESCE($2, name),
         monthly_price_cents = COALESCE($3, monthly_price_cents),
         currency = COALESCE($4, currency),
         is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING id`,
      [
        id,
        body.name ?? null,
        body.monthlyPriceCents ?? null,
        body.currency?.toUpperCase() ?? null,
        body.isActive ?? null,
      ],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await audit(req, "admin.plan.update", { details: { planId: id } });
    return { ok: true };
  });

  app.put("/admin/plans/:id/entitlements", async (req) => {
    const { id } = idParams.parse(req.params);
    const body = z
      .object({ entitlements: z.array(entitlementSchema).max(FEATURES.length) })
      .parse(req.body);
    const plan = await query(`SELECT id FROM plans WHERE id = $1`, [id]);
    if (!plan.rowCount) throw new HttpError(404, "not_found");

    await tx(async (c) => {
      await c.query(`DELETE FROM plan_entitlements WHERE plan_id = $1`, [id]);
      for (const e of body.entitlements) {
        await c.query(
          `INSERT INTO plan_entitlements (plan_id, feature, enabled, limit_value) VALUES ($1,$2,$3,$4)`,
          [id, e.feature, e.enabled, e.limitValue ?? null],
        );
      }
    });
    await audit(req, "admin.plan.entitlements", {
      details: { planId: id, count: body.entitlements.length },
    });
    return { ok: true };
  });

  app.get("/admin/subscriptions", async (req) => {
    const q = z.object({ status: statusSchema.optional() }).merge(paging).parse(req.query);
    const r = await query(
      `SELECT s.id, s.status, s.current_period_start, s.current_period_end, s.created_at,
              u.id AS user_id, u.email,
              p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.monthly_price_cents
         FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id
        WHERE ($1::text IS NULL OR s.status = $1::subscription_status)
        ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
      [q.status ?? null, q.limit, q.offset],
    );
    return { subscriptions: r.rows };
  });

  app.get("/admin/subscription-events", async (req) => {
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(req.query);
    const r = await query(
      `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at,
              e.subscription_id, u.email AS user_email, a.email AS actor_email
         FROM subscription_events e
         JOIN subscriptions s ON s.id = e.subscription_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN users a ON a.id = e.actor_user_id
        ORDER BY e.created_at DESC LIMIT $1`,
      [q.limit],
    );
    return { events: r.rows };
  });

  app.get("/admin/devices", async (req) => {
    const q = paging.parse(req.query);
    const r = await query(
      `SELECT d.id, d.name, d.platform, d.app_version, d.last_seen_at, d.revoked_at, d.created_at,
              u.id AS user_id, u.email
         FROM user_devices d JOIN users u ON u.id = d.user_id
        ORDER BY d.created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    return { devices: r.rows };
  });

  app.get("/admin/provider-keys", async (req) => {
    const q = paging.parse(req.query);
    const r = await query(
      `SELECT k.id, k.provider, k.label, k.last4, k.key_version, k.created_at,
              u.id AS user_id, u.email
         FROM user_provider_keys k JOIN users u ON u.id = k.user_id
        ORDER BY k.created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    return { keys: r.rows };
  });

  app.get("/admin/skills", async (req) => {
    const q = paging.parse(req.query);
    const r = await query(
      `SELECT s.id, s.name, s.description, s.enabled, s.created_at, u.id AS user_id, u.email
         FROM user_skills s JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    return { skills: r.rows };
  });

  app.get("/admin/agents", async (req) => {
    const q = paging.parse(req.query);
    const r = await query(
      `SELECT a.id, a.name, a.description, a.enabled, a.created_at, u.id AS user_id, u.email
         FROM user_agents a JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    return { agents: r.rows };
  });

  app.get("/admin/remote-usage", async (req) => {
    const q = paging.parse(req.query);
    const [sessions, tokens, calls] = await Promise.all([
      query(
        `SELECT rs.id, rs.provider, rs.status, rs.started_at, rs.ended_at, rs.created_at,
                u.id AS user_id, u.email, d.name AS device_name,
                (SELECT count(*)::int FROM remote_calls rc WHERE rc.remote_session_id = rs.id) AS calls
           FROM remote_sessions rs JOIN users u ON u.id = rs.user_id
           LEFT JOIN user_devices d ON d.id = rs.device_id
          ORDER BY rs.created_at DESC LIMIT $1 OFFSET $2`,
        [q.limit, q.offset],
      ),
      query(
        `SELECT u.id AS user_id, u.email,
                COALESCE(sum(t.input_tokens),0)::bigint AS input_tokens,
                COALESCE(sum(t.output_tokens),0)::bigint AS output_tokens,
                count(*)::int AS records
           FROM token_usage t JOIN users u ON u.id = t.user_id
          GROUP BY u.id, u.email ORDER BY sum(t.input_tokens+t.output_tokens) DESC LIMIT 50`,
      ),
      query(
        `SELECT count(*)::int AS total, COALESCE(avg(latency_ms),0)::int AS avg_latency_ms FROM remote_calls`,
      ),
    ]);
    return { sessions: sessions.rows, tokens: tokens.rows, calls: calls.rows[0] };
  });

  app.get("/admin/audit-logs", async (req) => {
    const q = z
      .object({
        action: z.string().trim().max(120).optional(),
        userId: z.string().uuid().optional(),
      })
      .merge(paging)
      .parse(req.query);
    const r = await query(
      `SELECT l.id, l.action, l.details, l.ip, l.created_at,
              a.email AS actor_email, t.email AS target_email, l.actor_user_id, l.target_user_id
         FROM audit_logs l
         LEFT JOIN users a ON a.id = l.actor_user_id
         LEFT JOIN users t ON t.id = l.target_user_id
        WHERE ($1::text IS NULL OR l.action = $1)
          AND ($2::uuid IS NULL OR l.actor_user_id = $2 OR l.target_user_id = $2)
        ORDER BY l.created_at DESC LIMIT $3 OFFSET $4`,
      [q.action ?? null, q.userId ?? null, q.limit, q.offset],
    );
    return { logs: r.rows };
  });
}
