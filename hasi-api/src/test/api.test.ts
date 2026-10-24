import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword, newToken, sha256 } from "../crypto.js";
import { pool, query } from "../db.js";
import { migrate } from "../migrate.js";

let app: FastifyInstance;

async function resetDb() {
  await query(`TRUNCATE TABLE audit_logs, token_usage, remote_calls, remote_sessions, usage_events,
    user_agents, user_skills, user_provider_keys, password_resets, user_sessions, user_devices,
    subscription_events, subscriptions, plan_entitlements, plans, admin_roles, user_profiles, users
    RESTART IDENTITY CASCADE`);
}

async function register(email: string, password = "senha-forte-123") {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password, displayName: email.split("@")[0] },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  await migrate();
  app = await buildApp();
  await app.ready();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("auth", () => {
  it("registers, logs in, refreshes and logs out", async () => {
    const reg = await register("ana@example.com");
    expect(reg.user.email).toBe("ana@example.com");

    const me = await app.inject({ method: "GET", url: "/me", headers: auth(reg.accessToken) });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("ana@example.com");

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ANA@example.com", password: "senha-forte-123" },
    });
    expect(login.statusCode).toBe(200);

    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: reg.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    const fresh = refreshed.json();

    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: reg.refreshToken },
    });
    expect(reused.statusCode).toBe(401);

    const out = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: fresh.refreshToken },
    });
    expect(out.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/me",
      headers: auth(fresh.accessToken),
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it("rejects bad credentials and short passwords", async () => {
    await register("bia@example.com");
    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "bia@example.com", password: "wrong-password" },
    });
    expect(bad.statusCode).toBe(401);

    const short = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "curta@example.com", password: "123" },
    });
    expect(short.statusCode).toBe(400);
  });

  it("resets the password and revokes old sessions", async () => {
    const reg = await register("carla@example.com");
    const token = newToken();
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`,
      [reg.user.id, sha256(token)],
    );
    const reset = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "outra-senha-forte-456" },
    });
    expect(reset.statusCode).toBe(200);

    const old = await app.inject({ method: "GET", url: "/me", headers: auth(reg.accessToken) });
    expect(old.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "carla@example.com", password: "outra-senha-forte-456" },
    });
    expect(login.statusCode).toBe(200);
  });
});

describe("user isolation", () => {
  it("never exposes another user's devices, keys or usage", async () => {
    const a = await register("a@example.com");
    const b = await register("b@example.com");

    const device = await app.inject({
      method: "POST",
      url: "/me/devices",
      headers: auth(a.accessToken),
      payload: { name: "Pixel", platform: "android" },
    });
    expect(device.statusCode).toBe(201);
    const deviceId = device.json().id;

    const key = await app.inject({
      method: "POST",
      url: "/me/provider-keys",
      headers: auth(a.accessToken),
      payload: { provider: "openai", apiKey: "sk-super-secret-key-1234" },
    });
    expect(key.statusCode).toBe(201);
    expect(key.json().last4).toBe("1234");
    expect(JSON.stringify(key.json())).not.toContain("super-secret");
    const keyId = key.json().id;

    const bDevices = await app.inject({
      method: "GET",
      url: "/me/devices",
      headers: auth(b.accessToken),
    });
    expect(bDevices.json().devices).toHaveLength(0);

    const bKeys = await app.inject({
      method: "GET",
      url: "/me/provider-keys",
      headers: auth(b.accessToken),
    });
    expect(bKeys.json().keys).toHaveLength(0);

    const delDevice = await app.inject({
      method: "DELETE",
      url: `/me/devices/${deviceId}`,
      headers: auth(b.accessToken),
    });
    expect(delDevice.statusCode).toBe(404);

    const delKey = await app.inject({
      method: "DELETE",
      url: `/me/provider-keys/${keyId}`,
      headers: auth(b.accessToken),
    });
    expect(delKey.statusCode).toBe(404);

    const aDevices = await app.inject({
      method: "GET",
      url: "/me/devices",
      headers: auth(a.accessToken),
    });
    expect(aDevices.json().devices).toHaveLength(1);
  });

  it("blocks admin endpoints for regular users", async () => {
    const user = await register("comum@example.com");
    const res = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: auth(user.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("admin", () => {
  async function makeAdmin() {
    const admin = await register("admin@example.com");
    await query(`INSERT INTO admin_roles (user_id, role) VALUES ($1,'admin')`, [admin.user.id]);
    return admin;
  }

  it("creates plans, sets entitlements and assigns subscriptions", async () => {
    const admin = await makeAdmin();
    const user = await register("cliente@example.com");

    const plan = await app.inject({
      method: "POST",
      url: "/admin/plans",
      headers: auth(admin.accessToken),
      payload: { code: "pro", name: "Pro", monthlyPriceCents: 2990 },
    });
    expect(plan.statusCode).toBe(201);
    const planId = plan.json().id;

    const ent = await app.inject({
      method: "PUT",
      url: `/admin/plans/${planId}/entitlements`,
      headers: auth(admin.accessToken),
      payload: {
        entitlements: [
          { feature: "mobile_assistant", enabled: true },
          { feature: "remote_session_limit", enabled: true, limitValue: 3 },
        ],
      },
    });
    expect(ent.statusCode).toBe(200);

    const sub = await app.inject({
      method: "PUT",
      url: `/admin/users/${user.user.id}/subscription`,
      headers: auth(admin.accessToken),
      payload: { planId, status: "active" },
    });
    expect(sub.statusCode).toBe(200);

    const mine = await app.inject({
      method: "GET",
      url: "/me/entitlements",
      headers: auth(user.accessToken),
    });
    expect(mine.statusCode).toBe(200);
    const body = mine.json();
    expect(body.entitled).toBe(true);
    expect(body.features.mobile_assistant.enabled).toBe(true);
    expect(body.features.remote_session_limit.limit).toBe(3);
    expect(body.features.remote_coding.enabled).toBe(false);

    const stats = await app.inject({
      method: "GET",
      url: "/admin/stats",
      headers: auth(admin.accessToken),
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().subscriptions.active).toBe(1);
  });

  it("suspends users and revokes their sessions and devices", async () => {
    const admin = await makeAdmin();
    const user = await register("suspenso@example.com");

    const device = await app.inject({
      method: "POST",
      url: "/me/devices",
      headers: auth(user.accessToken),
      payload: { name: "Moto", platform: "android" },
    });

    const suspended = await app.inject({
      method: "POST",
      url: `/admin/users/${user.user.id}/suspend`,
      headers: auth(admin.accessToken),
    });
    expect(suspended.statusCode).toBe(200);

    const blocked = await app.inject({
      method: "GET",
      url: "/me",
      headers: auth(user.accessToken),
    });
    expect(blocked.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "suspenso@example.com", password: "senha-forte-123" },
    });
    expect(login.statusCode).toBe(403);

    const reactivated = await app.inject({
      method: "POST",
      url: `/admin/users/${user.user.id}/reactivate`,
      headers: auth(admin.accessToken),
    });
    expect(reactivated.statusCode).toBe(200);

    const revoke = await app.inject({
      method: "POST",
      url: `/admin/users/${user.user.id}/devices/${device.json().id}/revoke`,
      headers: auth(admin.accessToken),
    });
    expect(revoke.statusCode).toBe(200);
  });

  it("never returns full provider keys to admins", async () => {
    const admin = await makeAdmin();
    const user = await register("chave@example.com");
    await app.inject({
      method: "POST",
      url: "/me/provider-keys",
      headers: auth(user.accessToken),
      payload: { provider: "anthropic", apiKey: "sk-ant-ultra-secret-9999" },
    });

    const keys = await app.inject({
      method: "GET",
      url: "/admin/provider-keys",
      headers: auth(admin.accessToken),
    });
    expect(keys.statusCode).toBe(200);
    const text = JSON.stringify(keys.json());
    expect(text).toContain("9999");
    expect(text).not.toContain("ultra-secret");
  });
});
