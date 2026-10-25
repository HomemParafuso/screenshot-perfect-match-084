import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { signAccessToken } from "../auth.js";
import { config } from "../config.js";
import { hashPassword, newToken, sha256, verifyPassword } from "../crypto.js";
import { query, tx } from "../db.js";
import { HttpError } from "../errors.js";
import { sendMail } from "../mailer.js";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10).max(256);
const refreshBody = z.object({ refresh_token: z.string().min(20).max(200) });

async function issueSession(req: FastifyRequest, userId: string, deviceId: string | null = null) {
  const refresh = newToken();
  const s = await query(
    `INSERT INTO user_sessions (user_id, device_id, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) RETURNING id`,
    [userId, deviceId, sha256(refresh), req.headers["user-agent"]?.slice(0, 300) ?? null, req.ip, String(config.REFRESH_TOKEN_TTL_DAYS)],
  );
  const access = await signAccessToken(userId, s.rows[0].id);
  return { access_token: access, refresh_token: refresh, expires_in: config.ACCESS_TOKEN_TTL_SECONDS };
}

export async function authRoutes(app: FastifyInstance) {
  const strict = { config: { rateLimit: { max: config.NODE_ENV === "test" ? 100000 : 10, timeWindow: "1 minute" } } };

  app.post("/auth/register", strict, async (req, reply) => {
    const b = z.object({ email, password, display_name: z.string().trim().max(100).optional() }).parse(req.body);
    const hash = await hashPassword(b.password);
    const userId = await tx(async (c) => {
      const u = await c.query(`INSERT INTO users (email, password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id`, [b.email, hash]);
      if (!u.rowCount) throw new HttpError(409, "email_in_use");
      await c.query(`INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2)`, [u.rows[0].id, b.display_name ?? null]);
      return u.rows[0].id as string;
    });
    await audit(req, "auth.register", { actor: userId, target: userId });
    return reply.status(201).send(await issueSession(req, userId));
  });

  app.post("/auth/login", strict, async (req) => {
    const b = z.object({ email, password: z.string().min(1).max(256) }).parse(req.body);
    const r = await query(`SELECT id, password_hash, status FROM users WHERE email = $1`, [b.email]);
    const u = r.rows[0];
    const ok = u ? await verifyPassword(u.password_hash, b.password) : (await hashPassword(b.password), false);
    if (!u || !ok) {
      await audit(req, "auth.login_failed", { actor: null, target: u?.id ?? null, details: { email: b.email } });
      throw new HttpError(401, "invalid_credentials");
    }
    if (u.status !== "active") throw new HttpError(403, "account_suspended");
    await audit(req, "auth.login", { actor: u.id, target: u.id });
    return issueSession(req, u.id);
  });

  app.post("/auth/refresh", strict, async (req) => {
    const b = refreshBody.parse(req.body);
    // Rotation: the used refresh token is revoked and a new one issued.
    const r = await query(
      `UPDATE user_sessions SET revoked_at = now()
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
        RETURNING user_id, device_id`,
      [sha256(b.refresh_token)],
    );
    if (!r.rowCount) throw new HttpError(401, "invalid_refresh_token");
    const st = await query(`SELECT status FROM users WHERE id = $1`, [r.rows[0].user_id]);
    if (st.rows[0]?.status !== "active") throw new HttpError(403, "account_suspended");
    return issueSession(req, r.rows[0].user_id, r.rows[0].device_id);
  });

  app.post("/auth/logout", async (req, reply) => {
    const b = refreshBody.parse(req.body);
    const r = await query(
      `UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL RETURNING user_id`,
      [sha256(b.refresh_token)],
    );
    if (r.rowCount) await audit(req, "auth.logout", { actor: r.rows[0].user_id, target: r.rows[0].user_id });
    return reply.status(204).send();
  });

  app.post("/auth/forgot-password", strict, async (req, reply) => {
    const b = z.object({ email }).parse(req.body);
    const r = await query(`SELECT id FROM users WHERE email = $1 AND status = 'active'`, [b.email]);
    if (r.rowCount) {
      const token = newToken();
      await query(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 minutes')`, [r.rows[0].id, sha256(token)]);
      const url = `${config.APP_RESET_URL}?token=${encodeURIComponent(token)}`;
      await sendMail(b.email, "HASi - redefinir senha", `Para redefinir sua senha acesse (válido por 30 minutos):\n${url}`, req.log);
      await audit(req, "auth.forgot_password", { actor: null, target: r.rows[0].id });
    }
    return reply.status(202).send({ ok: true }); // same answer whether or not the account exists
  });

  app.post("/auth/reset-password", strict, async (req, reply) => {
    const b = z.object({ token: z.string().min(20).max(200), password }).parse(req.body);
    const hash = await hashPassword(b.password);
    const userId = await tx(async (c) => {
      const r = await c.query(
        `UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
        [sha256(b.token)],
      );
      if (!r.rowCount) throw new HttpError(400, "invalid_or_expired_token");
      const uid = r.rows[0].user_id;
      await c.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, uid]);
      await c.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [uid]);
      return uid as string;
    });
    await audit(req, "auth.reset_password", { actor: userId, target: userId });
    return reply.status(204).send();
  });
}
