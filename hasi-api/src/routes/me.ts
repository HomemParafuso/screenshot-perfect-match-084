import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { requireAuth } from "../auth.js";
import { encryptSecret } from "../crypto.js";
import { query } from "../db.js";
import { getEntitlements } from "../entitlements.js";
import { HttpError } from "../errors.js";

const idParam = z.object({ id: z.string().uuid() });
const page = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/** Columns safe to return for BYOK keys. Ciphertext is never selected. */
export const KEY_COLUMNS = `id, provider, label, last4, created_at`;

export async function meRoutes(app: FastifyInstance) {
  app.register(async (r) => {
    r.addHook("preHandler", requireAuth);

    r.get("/me", async (req) => {
      const q = await query(
        `SELECT u.id, u.email, u.status, u.created_at, p.display_name, p.locale, p.preferences
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
        [req.user!.id],
      );
      return { ...q.rows[0], is_admin: req.user!.isAdmin };
    });

    r.patch("/me/preferences", async (req) => {
      const b = z.object({
        display_name: z.string().trim().max(100).optional(),
        locale: z.string().max(20).optional(),
        preferences: z.record(z.unknown()).optional(),
      }).parse(req.body);
      await query(
        `UPDATE user_profiles SET display_name = COALESCE($2, display_name), locale = COALESCE($3, locale),
                preferences = COALESCE($4, preferences), updated_at = now() WHERE user_id = $1`,
        [req.user!.id, b.display_name ?? null, b.locale ?? null, b.preferences ?? null],
      );
      return { ok: true };
    });

    r.get("/me/entitlements", async (req) => getEntitlements(req.user!.id));

    r.get("/me/devices", async (req) =>
      (await query(`SELECT id, name, platform, app_version, last_seen_at, revoked_at, created_at FROM user_devices WHERE user_id = $1 ORDER BY created_at DESC`, [req.user!.id])).rows);

    r.post("/me/devices", async (req, reply) => {
      const b = z.object({
        name: z.string().trim().min(1).max(100),
        platform: z.enum(["android", "ios", "web", "desktop"]),
        app_version: z.string().max(40).optional(),
      }).parse(req.body);
      const q = await query(
        `INSERT INTO user_devices (user_id, name, platform, app_version, last_seen_at) VALUES ($1,$2,$3,$4, now())
         RETURNING id, name, platform, app_version, last_seen_at, created_at`,
        [req.user!.id, b.name, b.platform, b.app_version ?? null],
      );
      await audit(req, "device.register", { target: req.user!.id, details: { device_id: q.rows[0].id } });
      return reply.status(201).send(q.rows[0]);
    });

    r.delete("/me/devices/:id", async (req, reply) => {
      const { id } = idParam.parse(req.params);
      const q = await query(`UPDATE user_devices SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`, [id, req.user!.id]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await query(`UPDATE user_sessions SET revoked_at = now() WHERE device_id = $1 AND revoked_at IS NULL`, [id]);
      await audit(req, "device.revoke", { target: req.user!.id, details: { device_id: id } });
      return reply.status(204).send();
    });

    r.get("/me/skills", async (req) =>
      (await query(`SELECT id, name, description, definition, enabled, created_at, updated_at FROM user_skills WHERE user_id = $1 ORDER BY name`, [req.user!.id])).rows);

    r.get("/me/agents", async (req) =>
      (await query(`SELECT id, name, description, config, enabled, created_at, updated_at FROM user_agents WHERE user_id = $1 ORDER BY name`, [req.user!.id])).rows);

    r.get("/me/provider-keys", async (req) =>
      (await query(`SELECT ${KEY_COLUMNS} FROM user_provider_keys WHERE user_id = $1 ORDER BY created_at DESC`, [req.user!.id])).rows);

    r.post("/me/provider-keys", async (req, reply) => {
      const b = z.object({
        provider: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/),
        label: z.string().trim().max(60).optional(),
        api_key: z.string().trim().min(8).max(500),
      }).parse(req.body);
      const enc = encryptSecret(b.api_key);
      const q = await query(
        `INSERT INTO user_provider_keys (user_id, provider, label, ciphertext, iv, auth_tag, last4)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${KEY_COLUMNS}`,
        [req.user!.id, b.provider, b.label ?? null, enc.ciphertext, enc.iv, enc.authTag, b.api_key.slice(-4)],
      );
      await audit(req, "provider_key.create", { target: req.user!.id, details: { key_id: q.rows[0].id, provider: b.provider } });
      return reply.status(201).send(q.rows[0]);
    });

    r.delete("/me/provider-keys/:id", async (req, reply) => {
      const { id } = idParam.parse(req.params);
      const q = await query(`DELETE FROM user_provider_keys WHERE id = $1 AND user_id = $2 RETURNING id`, [id, req.user!.id]);
      if (!q.rowCount) throw new HttpError(404, "not_found");
      await audit(req, "provider_key.delete", { target: req.user!.id, details: { key_id: id } });
      return reply.status(204).send();
    });

    r.get("/me/usage", async (req) => {
      const { limit } = page.parse(req.query);
      const uid = req.user!.id;
      const [events, totals] = await Promise.all([
        query(`SELECT id, event_type, metadata, created_at FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [uid, limit]),
        query(
          `SELECT (SELECT count(*) FROM remote_calls WHERE user_id = $1 AND created_at >= date_trunc('month', now()))::int AS remote_calls_month,
                  (SELECT coalesce(sum(input_tokens + output_tokens),0) FROM token_usage WHERE user_id = $1 AND created_at >= date_trunc('month', now()))::bigint AS tokens_month`,
          [uid],
        ),
      ]);
      return { totals: { remote_calls_month: totals.rows[0].remote_calls_month, tokens_month: Number(totals.rows[0].tokens_month) }, events: events.rows };
    });

    r.get("/me/remote-sessions", async (req) => {
      const { limit } = page.parse(req.query);
      return (await query(`SELECT id, device_id, provider, status, started_at, ended_at, created_at FROM remote_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [req.user!.id, limit])).rows;
    });
  });
}
