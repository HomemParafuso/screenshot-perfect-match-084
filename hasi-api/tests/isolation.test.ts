/**
 * Integration tests against a REAL PostgreSQL (no mocks).
 * Run: docker compose -f docker-compose.test.yml up -d && npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let pool: any;
const rnd = () => Math.random().toString(36).slice(2, 10);
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function register() {
  const email = `t_${rnd()}@test.local`;
  const r = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password: "senha-forte-123" } });
  expect(r.statusCode).toBe(201);
  return { email, ...r.json() } as { email: string; access_token: string; refresh_token: string };
}

beforeAll(async () => {
  const { migrate } = await import("../src/migrate.js");
  await migrate();
  ({ pool } = await import("../src/db.js"));
  const { buildApp } = await import("../src/app.js");
  app = await buildApp();
});
afterAll(async () => { await app?.close(); await pool?.end(); });

describe("auth", () => {
  it("rejects requests without token", async () => {
    expect((await app.inject({ url: "/me" })).statusCode).toBe(401);
  });
  it("stores refresh tokens only as hash and rotates them", async () => {
    const a = await register();
    const raw = await pool.query(`SELECT 1 FROM user_sessions WHERE refresh_token_hash = $1`, [a.refresh_token]);
    expect(raw.rowCount).toBe(0);
    expect((await app.inject({ method: "POST", url: "/auth/refresh", payload: { refresh_token: a.refresh_token } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/refresh", payload: { refresh_token: a.refresh_token } })).statusCode).toBe(401);
  });
  it("hashes passwords with argon2id", async () => {
    const a = await register();
    const r = await pool.query(`SELECT password_hash FROM users WHERE email=$1`, [a.email]);
    expect(r.rows[0].password_hash.startsWith("$argon2id$")).toBe(true);
  });
  it("logout revokes the session", async () => {
    const a = await register();
    await app.inject({ method: "POST", url: "/auth/logout", payload: { refresh_token: a.refresh_token } });
    expect((await app.inject({ url: "/me", headers: auth(a.access_token) })).statusCode).toBe(401);
  });
});

describe("user isolation", () => {
  it("user B cannot see or revoke user A's device", async () => {
    const a = await register(); const b = await register();
    const d = await app.inject({ method: "POST", url: "/me/devices", headers: auth(a.access_token), payload: { name: "Pixel", platform: "android" } });
    expect(d.statusCode).toBe(201);
    expect((await app.inject({ method: "DELETE", url: `/me/devices/${d.json().id}`, headers: auth(b.access_token) })).statusCode).toBe(404);
    expect((await app.inject({ url: "/me/devices", headers: auth(b.access_token) })).json()).toEqual([]);
  });
  it("user B cannot see or delete user A's provider key; full key is never returned or stored in clear", async () => {
    const a = await register(); const b = await register();
    const k = await app.inject({ method: "POST", url: "/me/provider-keys", headers: auth(a.access_token), payload: { provider: "openai", api_key: "sk-test-abcdef123456" } });
    expect(k.statusCode).toBe(201);
    expect(JSON.stringify(k.json())).not.toContain("sk-test-abcdef123456");
    expect(k.json().last4).toBe("3456");
    expect((await app.inject({ url: "/me/provider-keys", headers: auth(b.access_token) })).json()).toEqual([]);
    expect((await app.inject({ method: "DELETE", url: `/me/provider-keys/${k.json().id}`, headers: auth(b.access_token) })).statusCode).toBe(404);
    const raw = await pool.query(`SELECT ciphertext FROM user_provider_keys WHERE id=$1`, [k.json().id]);
    expect(raw.rows[0].ciphertext.toString("utf8")).not.toContain("sk-test");
  });
  it("non-admin cannot access admin endpoints", async () => {
    const a = await register();
    expect((await app.inject({ url: "/admin/users", headers: auth(a.access_token) })).statusCode).toBe(403);
  });
});

describe("entitlements", () => {
  it("user without subscription has no plan features", async () => {
    const a = await register();
    const e = (await app.inject({ url: "/me/entitlements", headers: auth(a.access_token) })).json();
    expect(e.entitled).toBe(false);
    expect(e.features.remote_coding.enabled).toBe(false);
  });
  it("past_due does not unlock features; active does", async () => {
    const a = await register();
    const uid = (await app.inject({ url: "/me", headers: auth(a.access_token) })).json().id;
    const p = await pool.query(`INSERT INTO plans (code,name,monthly_price_cents) VALUES ($1,'T',100) RETURNING id`, [`t_${rnd()}`]);
    await pool.query(`INSERT INTO plan_entitlements (plan_id, feature, enabled) VALUES ($1,'custom_skills',true)`, [p.rows[0].id]);
    await pool.query(`INSERT INTO subscriptions (user_id, plan_id, status, current_period_end) VALUES ($1,$2,'past_due', now()+interval '1 day')`, [uid, p.rows[0].id]);
    expect((await app.inject({ url: "/me/entitlements", headers: auth(a.access_token) })).json().features.custom_skills.enabled).toBe(false);
    await pool.query(`UPDATE subscriptions SET status='active' WHERE user_id=$1`, [uid]);
    expect((await app.inject({ url: "/me/entitlements", headers: auth(a.access_token) })).json().features.custom_skills.enabled).toBe(true);
  });
});

describe("suspension", () => {
  it("suspended user's access token stops working immediately", async () => {
    const a = await register();
    await pool.query(`UPDATE users SET status='suspended' WHERE email=$1`, [a.email]);
    expect((await app.inject({ url: "/me", headers: auth(a.access_token) })).statusCode).toBe(403);
  });
});
