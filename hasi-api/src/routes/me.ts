import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { requireAuth } from "../auth.js";
import { encryptSecret } from "../crypto.js";
import { query } from "../db.js";
import { getEntitlements } from "../entitlements.js";
import { HttpError } from "../errors.js";

const featureNames = [
  "mobile_assistant",
  "local_opencode",
  "custom_skills",
  "custom_agents",
  "remote_coding",
  "remote_session_limit",
  "monthly_remote_calls",
  "monthly_remote_tokens",
] as const;

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/me", async (req) => {
    const r = await query(
      `SELECT u.id, u.email, u.status, u.created_at, u.updated_at,
              p.display_name, p.locale, p.preferences,
              COALESCE(json_agg(a.role) FILTER (WHERE a.role IS NOT NULL), '[]') AS roles
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN admin_roles a ON a.user_id = u.id
        WHERE u.id = $1 GROUP BY u.id, p.user_id`,
      [req.user!.id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    const u = r.rows[0];
    return {
      id: u.id,
      email: u.email,
      status: u.status,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      displayName: u.display_name,
      locale: u.locale,
      preferences: u.preferences ?? {},
      roles: u.roles,
    };
  });

  app.patch("/me/preferences", async (req) => {
    const body = z
      .object({
        displayName: z.string().trim().max(120).nullable().optional(),
        locale: z.string().trim().max(20).nullable().optional(),
        preferences: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const r = await query(
      `INSERT INTO user_profiles (user_id, display_name, locale, preferences)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
         locale = COALESCE(EXCLUDED.locale, user_profiles.locale),
         preferences = user_profiles.preferences || EXCLUDED.preferences,
         updated_at = now()
       RETURNING display_name, locale, preferences`,
      [req.user!.id, body.displayName ?? null, body.locale ?? null, body.preferences ?? {}],
    );
    await audit(req, "me.preferences.update");
    return {
      displayName: r.rows[0].display_name,
      locale: r.rows[0].locale,
      preferences: r.rows[0].preferences,
    };
  });

  app.get("/me/entitlements", async (req) => getEntitlements(req.user!.id));

  app.get("/me/devices", async (req) => {
    const r = await query(
      `SELECT id, name, platform, app_version, last_seen_at, revoked_at, created_at
         FROM user_devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.id],
    );
    return { devices: r.rows };
  });

  app.post("/me/devices", async (req, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        platform: z.string().trim().min(1).max(40),
        appVersion: z.string().trim().max(40).optional(),
      })
      .parse(req.body);
    const r = await query(
      `INSERT INTO user_devices (user_id, name, platform, app_version, last_seen_at) VALUES ($1,$2,$3,$4, now())
       RETURNING id, name, platform, app_version, last_seen_at, revoked_at, created_at`,
      [req.user!.id, body.name, body.platform, body.appVersion ?? null],
    );
    await audit(req, "me.device.create", { details: { deviceId: r.rows[0].id } });
    reply.status(201);
    return r.rows[0];
  });

  app.delete("/me/devices/:id", async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await query(
      `UPDATE user_devices SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, req.user!.id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await query(
      `UPDATE user_sessions SET revoked_at = now() WHERE device_id = $1 AND revoked_at IS NULL`,
      [id],
    );
    await audit(req, "me.device.revoke", { details: { deviceId: id } });
    return { ok: true };
  });

  app.get("/me/skills", async (req) => {
    const r = await query(
      `SELECT id, name, description, definition, enabled, created_at, updated_at
         FROM user_skills WHERE user_id = $1 ORDER BY name`,
      [req.user!.id],
    );
    return { skills: r.rows };
  });

  app.get("/me/agents", async (req) => {
    const r = await query(
      `SELECT id, name, description, config, enabled, created_at, updated_at
         FROM user_agents WHERE user_id = $1 ORDER BY name`,
      [req.user!.id],
    );
    return { agents: r.rows };
  });

  app.get("/me/provider-keys", async (req) => {
    const r = await query(
      `SELECT id, provider, label, last4, key_version, created_at
         FROM user_provider_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.id],
    );
    return { keys: r.rows };
  });

  app.post("/me/provider-keys", async (req, reply) => {
    const body = z
      .object({
        provider: z.string().trim().min(1).max(40),
        label: z.string().trim().max(80).optional(),
        apiKey: z.string().trim().min(8).max(500),
      })
      .parse(req.body);
    const count = await query(
      `SELECT count(*)::int AS n FROM user_provider_keys WHERE user_id = $1`,
      [req.user!.id],
    );
    if (count.rows[0].n >= 20) throw new HttpError(400, "key_limit_reached");
    const { ciphertext, iv, authTag } = encryptSecret(body.apiKey);
    const r = await query(
      `INSERT INTO user_provider_keys (user_id, provider, label, ciphertext, iv, auth_tag, last4)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, provider, label, last4, key_version, created_at`,
      [
        req.user!.id,
        body.provider,
        body.label ?? null,
        ciphertext,
        iv,
        authTag,
        body.apiKey.slice(-4),
      ],
    );
    await audit(req, "me.provider_key.create", {
      details: { provider: body.provider, last4: body.apiKey.slice(-4) },
    });
    reply.status(201);
    return r.rows[0];
  });

  app.delete("/me/provider-keys/:id", async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await query(
      `DELETE FROM user_provider_keys WHERE id = $1 AND user_id = $2 RETURNING provider`,
      [id, req.user!.id],
    );
    if (!r.rowCount) throw new HttpError(404, "not_found");
    await audit(req, "me.provider_key.delete", { details: { provider: r.rows[0].provider } });
    return { ok: true };
  });

  app.get("/me/usage", async (req) => {
    const userId = req.user!.id;
    const [events, tokens, calls, sessions] = await Promise.all([
      query(
        `SELECT event_type, count(*)::int AS count, max(created_at) AS last_at
           FROM usage_events WHERE user_id = $1 GROUP BY event_type ORDER BY event_type`,
        [userId],
      ),
      query(
        `SELECT COALESCE(sum(input_tokens),0)::bigint AS input_tokens,
                COALESCE(sum(output_tokens),0)::bigint AS output_tokens,
                COALESCE(sum(CASE WHEN billed THEN 1 ELSE 0 END),0)::int AS billed_calls,
                count(*)::int AS calls
           FROM token_usage WHERE user_id = $1`,
        [userId],
      ),
      query(
        `SELECT count(*)::int AS calls, COALESCE(avg(latency_ms),0)::int AS avg_latency_ms
           FROM remote_calls WHERE user_id = $1`,
        [userId],
      ),
      query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'running')::int AS running
           FROM remote_sessions WHERE user_id = $1`,
        [userId],
      ),
    ]);
    return {
      events: events.rows,
      tokens: tokens.rows[0],
      remoteCalls: calls.rows[0],
      remoteSessions: sessions.rows[0],
      features: featureNames,
    };
  });

  app.get("/me/remote-sessions", async (req) => {
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(req.query);
    const r = await query(
      `SELECT rs.id, rs.provider, rs.status, rs.started_at, rs.ended_at, rs.created_at,
              d.name AS device_name,
              (SELECT count(*)::int FROM remote_calls rc WHERE rc.remote_session_id = rs.id) AS calls
         FROM remote_sessions rs LEFT JOIN user_devices d ON d.id = rs.device_id
        WHERE rs.user_id = $1 ORDER BY rs.created_at DESC LIMIT $2`,
      [req.user!.id, q.limit],
    );
    return { sessions: r.rows };
  });
}
