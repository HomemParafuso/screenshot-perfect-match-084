import { query } from "./db.js";

export const FEATURES = [
  "mobile_assistant",
  "local_opencode",
  "custom_skills",
  "custom_agents",
  "remote_coding",
  "remote_session_limit",
  "monthly_remote_calls",
  "monthly_remote_tokens",
] as const;

/** Subscription states that unlock plan features. */
export const ENTITLED_STATUSES: readonly string[] = ["trial", "active"];

/**
 * Plan features only. The free/local OpenCode flow of the Android APK does not depend
 * on this endpoint and must keep working without the server.
 */
export async function getEntitlements(userId: string) {
  const sub = await query(
    `SELECT s.id, s.status, s.current_period_end, p.code AS plan_code, p.name AS plan_name, p.id AS plan_id
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1 AND s.status <> 'canceled' LIMIT 1`,
    [userId],
  );
  const s = sub.rows[0] ?? null;
  const entitled = !!s && ENTITLED_STATUSES.includes(s.status);
  const features: Record<string, { enabled: boolean; limit: number | null }> = {};
  for (const f of FEATURES) features[f] = { enabled: false, limit: null };
  if (entitled) {
    const e = await query(
      `SELECT feature, enabled, limit_value FROM plan_entitlements WHERE plan_id = $1`,
      [s.plan_id],
    );
    for (const r of e.rows)
      features[r.feature] = {
        enabled: r.enabled,
        limit: r.limit_value === null ? null : Number(r.limit_value),
      };
  }
  return {
    subscription: s && {
      id: s.id,
      status: s.status,
      plan_code: s.plan_code,
      plan_name: s.plan_name,
      current_period_end: s.current_period_end,
    },
    entitled,
    features,
  };
}
