import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";
import { query } from "./db.js";
import { HttpError } from "./errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; isAdmin: boolean };
  }
}

const secret = () => new TextEncoder().encode(config.JWT_SECRET);

export async function signAccessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer("hasi-control-plane")
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) throw new HttpError(401, "unauthorized");
  let sub: string, sid: string;
  try {
    const { payload } = await jwtVerify(h.slice(7), secret(), { issuer: "hasi-control-plane" });
    sub = payload.sub as string;
    sid = payload.sid as string;
  } catch {
    throw new HttpError(401, "invalid_token");
  }
  // Session must be live and user active on every request.
  const r = await query(
    `SELECT u.status,
            EXISTS (SELECT 1 FROM admin_roles a WHERE a.user_id = u.id AND a.role = 'admin') AS is_admin
       FROM users u JOIN user_sessions s ON s.user_id = u.id
      WHERE u.id = $1 AND s.id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [sub, sid],
  );
  if (!r.rowCount) throw new HttpError(401, "session_revoked");
  if (r.rows[0].status !== "active") throw new HttpError(403, "account_suspended");
  req.user = { id: sub, isAdmin: r.rows[0].is_admin };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (!req.user?.isAdmin) throw new HttpError(403, "forbidden");
}
