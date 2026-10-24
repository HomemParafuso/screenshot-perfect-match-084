import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit } from "../audit.js";
import { requireAuth, signAccessToken } from "../auth.js";
import { config } from "../config.js";
import { hashPassword, newToken, sha256, verifyPassword } from "../crypto.js";
import { pool, query, tx } from "../db.js";
import { HttpError } from "../errors.js";
import { sendMail } from "../mailer.js";

const passwordSchema = z.string().min(12, "password must be at least 12 chars").max(200);
const emailSchema = z.string().trim().toLowerCase().email().max(254);

const sessionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  platform: z.string().trim().min(1).max(40),
  appVersion: z.string().trim().max(40).optional(),
});

type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

async function createSession(
  userId: string,
  deviceId: string | null,
  userAgent: string | undefined,
  ip: string | undefined,
): Promise<TokenPair> {
  const refreshToken = newToken();
  const sessionId = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO user_sessions (user_id, device_id, refresh_token_hash, user_agent, ip, expires_at)
       VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) RETURNING id`,
      [
        userId,
        deviceId,
        sha256(refreshToken),
        userAgent ?? null,
        ip ?? null,
        String(config.REFRESH_TOKEN_TTL_DAYS),
      ],
    );
    return r.rows[0].id as string;
  });
  const accessToken = await signAccessToken(userId, sessionId);
  return { accessToken, refreshToken, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS };
}

async function userPayload(userId: string) {
  const r = await query(
    `SELECT u.id, u.email, u.status, u.created_at,
            p.display_name, p.locale, p.preferences,
            EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role = 'admin') AS is_admin,
            EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role = 'support') AS is_support,
            COALESCE((SELECT json_agg(a.role) FROM admin_roles a WHERE a.user_id = u.id), '[]') AS roles
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  const u = r.rows[0];
  if (!u) throw new HttpError(404, "not_found");
  return {
    id: u.id,
    email: u.email,
    status: u.status,
    createdAt: u.created_at,
    displayName: u.display_name,
    locale: u.locale,
    preferences: u.preferences ?? {},
    isAdmin: u.is_admin,
    isSupport: u.is_support,
    roles: u.roles,
  };
}

async function activeUserByEmail(email: string) {
  const r = await query(`SELECT id, password_hash, status FROM users WHERE email = $1`, [email]);
  return r.rows[0] as { id: string; password_hash: string; status: string } | undefined;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = z
      .object({
        email: emailSchema,
        password: passwordSchema,
        displayName: z.string().trim().max(120).optional(),
        device: sessionSchema.optional(),
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
      return id;
    });

    let deviceId: string | null = null;
    if (body.device) {
      const d = await query(
        `INSERT INTO user_devices (user_id, name, platform, app_version, last_seen_at) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
        [userId, body.device.name, body.device.platform, body.device.appVersion ?? null],
      );
      deviceId = d.rows[0].id;
    }

    const tokens = await createSession(userId, deviceId, req.headers["user-agent"], req.ip);
    await audit(req, "auth.register", { actor: userId, target: userId });
    reply.status(201);
    return { user: await userPayload(userId), ...tokens };
  });

  app.post("/auth/login", async (req) => {
    const body = z
      .object({
        email: emailSchema,
        password: z.string().min(1).max(200),
        device: sessionSchema.optional(),
      })
      .parse(req.body);

    const user = await activeUserByEmail(body.email);
    const ok = user ? await verifyPassword(user.password_hash, body.password) : false;
    if (!user || !ok) throw new HttpError(401, "invalid_credentials");
    if (user.status !== "active") throw new HttpError(403, "account_suspended");

    let deviceId: string | null = null;
    if (body.device) {
      const existing = await query(
        `SELECT id FROM user_devices WHERE user_id = $1 AND name = $2 AND platform = $3 AND revoked_at IS NULL LIMIT 1`,
        [user.id, body.device.name, body.device.platform],
      );
      if (existing.rowCount) {
        deviceId = existing.rows[0].id;
        await query(
          `UPDATE user_devices SET last_seen_at = now(), app_version = $2 WHERE id = $1`,
          [deviceId, body.device.appVersion ?? null],
        );
      } else {
        const d = await query(
          `INSERT INTO user_devices (user_id, name, platform, app_version, last_seen_at) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
          [user.id, body.device.name, body.device.platform, body.device.appVersion ?? null],
        );
        deviceId = d.rows[0].id;
      }
    }

    const tokens = await createSession(user.id, deviceId, req.headers["user-agent"], req.ip);
    await audit(req, "auth.login", { actor: user.id, target: user.id });
    return { user: await userPayload(user.id), ...tokens };
  });

  app.post("/auth/refresh", async (req) => {
    const body = z.object({ refreshToken: z.string().min(20).max(200) }).parse(req.body);
    const hash = sha256(body.refreshToken);

    const result = await tx(async (c) => {
      const s = await c.query(
        `SELECT s.id, s.user_id, s.device_id, s.user_agent, s.ip, u.status
           FROM user_sessions s JOIN users u ON u.id = s.user_id
          WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
          FOR UPDATE`,
        [hash],
      );
      const session = s.rows[0];
      if (!session) throw new HttpError(401, "invalid_refresh_token");
      if (session.status !== "active") throw new HttpError(403, "account_suspended");

      await c.query(`UPDATE user_sessions SET revoked_at = now() WHERE id = $1`, [session.id]);

      const refreshToken = newToken();
      const created = await c.query(
        `INSERT INTO user_sessions (user_id, device_id, refresh_token_hash, user_agent, ip, expires_at)
         VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) RETURNING id`,
        [
          session.user_id,
          session.device_id,
          sha256(refreshToken),
          session.user_agent,
          session.ip,
          String(config.REFRESH_TOKEN_TTL_DAYS),
        ],
      );
      return {
        userId: session.user_id as string,
        sessionId: created.rows[0].id as string,
        refreshToken,
      };
    });

    const accessToken = await signAccessToken(result.userId, result.sessionId);
    return {
      accessToken,
      refreshToken: result.refreshToken,
      expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
    };
  });

  app.post("/auth/logout", async (req, reply) => {
    const body = z
      .object({
        refreshToken: z.string().min(20).max(200).optional(),
        allSessions: z.boolean().optional(),
      })
      .parse(req.body ?? {});
    if (body.allSessions) {
      await requireAuth(req, reply);
      await query(
        `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [req.user!.id],
      );
      await audit(req, "auth.logout_all");
    } else if (body.refreshToken) {
      await query(
        `UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
        [sha256(body.refreshToken)],
      );
      await audit(req, "auth.logout");
    } else {
      throw new HttpError(400, "refresh_token_required");
    }
    return { ok: true };
  });

  app.post("/auth/forgot-password", async (req) => {
    const body = z.object({ email: emailSchema }).parse(req.body);
    const user = await activeUserByEmail(body.email);
    if (user) {
      const token = newToken();
      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`,
        [user.id, sha256(token)],
      );
      const url = `${config.APP_RESET_URL}${config.APP_RESET_URL.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
      await sendMail(
        body.email,
        "Redefinição de senha — HASi",
        `Use este link para redefinir sua senha (válido por 1 hora):\n\n${url}`,
        req.log,
      );
      await audit(req, "auth.forgot_password", { actor: user.id, target: user.id });
    }
    return { ok: true };
  });

  app.post("/auth/reset-password", async (req) => {
    const body = z
      .object({ token: z.string().min(20).max(200), password: passwordSchema })
      .parse(req.body);
    const hash = await hashPassword(body.password);

    await tx(async (c) => {
      const r = await c.query(
        `SELECT id, user_id FROM password_resets
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
        [sha256(body.token)],
      );
      const reset = r.rows[0];
      if (!reset) throw new HttpError(400, "invalid_or_expired_token");
      await c.query(`UPDATE password_resets SET used_at = now() WHERE id = $1`, [reset.id]);
      await c.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
        reset.user_id,
        hash,
      ]);
      await c.query(
        `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [reset.user_id],
      );
      await c.query(
        `UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
        [reset.user_id],
      );
    });

    await audit(req, "auth.reset_password");
    return { ok: true };
  });
}

/** Used by the health check / graceful shutdown helper in tests. */
export async function disconnect() {
  await pool.end();
}
