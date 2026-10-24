import type { FastifyRequest } from "fastify";
import { query } from "./db.js";

export async function audit(
  req: FastifyRequest | null,
  action: string,
  opts: { actor?: string | null; target?: string | null; details?: Record<string, unknown> } = {},
) {
  const actor = opts.actor !== undefined ? opts.actor : (req?.user?.id ?? null);
  await query(
    `INSERT INTO audit_logs (actor_user_id, target_user_id, action, details, ip) VALUES ($1,$2,$3,$4,$5)`,
    [actor, opts.target ?? null, action, opts.details ?? {}, req?.ip ?? null],
  );
}
