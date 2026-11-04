// Browser-only simulation. It never grants access to the real HASi API.
const SESSION_KEY = "hasi.demo.session";
const DATA_KEY = "hasi.demo.data.v1";
const PASSWORD_DIGEST = "ed17e5d0b1ac952d161e9fa3755455379beda35b69dc1cd9052e0a16925599d6";
export const DEMO_EMAIL = "admin@hasi.test";
const FEATURES = ["mobile_assistant", "local_opencode", "custom_skills", "custom_agents", "remote_coding", "remote_session_limit", "monthly_remote_calls", "monthly_remote_tokens"];

type Row = Record<string, any>;
type DemoData = { users: Row[]; plans: Row[]; subscriptions: Row[]; devices: Row[]; keys: Row[]; skills: Row[]; agents: Row[]; events: Row[]; audit: Row[] };

export class DemoError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export const hasDemoSession = () => typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_KEY) === "active";
export const endDemoSession = () => window.sessionStorage.removeItem(SESSION_KEY);

export async function loginDemo(email: string, password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  if (email.trim().toLowerCase() !== DEMO_EMAIL || hex !== PASSWORD_DIGEST) throw new DemoError(401, "invalid_credentials");
  window.sessionStorage.setItem(SESSION_KEY, "active");
}

function seed(): DemoData {
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 30 * 86400000).toISOString();
  const users = [
    { id: "demo-admin", email: DEMO_EMAIL, display_name: "Administrador de teste", is_admin: true, status: "active", created_at: now },
    { id: "demo-ana", email: "ana@example.test", display_name: "Ana — exemplo", is_admin: false, status: "active", created_at: now },
    { id: "demo-bruno", email: "bruno@example.test", display_name: "Bruno — exemplo", is_admin: false, status: "active", created_at: now },
    { id: "demo-carla", email: "carla@example.test", display_name: "Carla — exemplo", is_admin: false, status: "suspended", created_at: now },
  ];
  const plans = [{ id: "demo-plan", code: "demonstracao", name: "Plano exemplo", monthly_price_cents: 2900, currency: "BRL", is_active: true, created_at: now, entitlements: FEATURES.map((feature, i) => ({ feature, enabled: i < 4, limit: null })) }];
  const subscriptions = [
    { id: "demo-sub-ana", user_id: "demo-ana", email: users[1]?.email, plan_id: "demo-plan", status: "active", current_period_start: now, current_period_end: end, created_at: now, updated_at: now },
    { id: "demo-sub-bruno", user_id: "demo-bruno", email: users[2]?.email, plan_id: "demo-plan", status: "past_due", current_period_start: now, current_period_end: end, created_at: now, updated_at: now },
  ];
  const owned = { user_id: "demo-ana", email: users[1]?.email, created_at: now, updated_at: now };
  return {
    users, plans, subscriptions,
    devices: [{ ...owned, id: "demo-device", name: "Pixel de exemplo", platform: "android", app_version: "1.0.0", last_seen_at: now, revoked_at: null }],
    keys: [{ ...owned, id: "demo-key", provider: "openai", label: "Chave fictícia", last4: "0000" }],
    skills: [{ ...owned, id: "demo-skill", name: "Revisão de código", description: "Exemplo", enabled: true }],
    agents: [{ ...owned, id: "demo-agent", name: "Assistente de exemplo", description: "Exemplo", enabled: true }],
    events: [{ id: "demo-event", email: users[1]?.email, actor_email: DEMO_EMAIL, from_status: null, to_status: "active", note: "Registro fictício", created_at: now }],
    audit: [{ id: "demo-audit", action: "demo.started", details: { simulated: true }, ip: null, created_at: now, actor_email: DEMO_EMAIL, target_email: null, target_user_id: null }],
  };
}

function readData(): DemoData {
  const saved = window.sessionStorage.getItem(DATA_KEY);
  if (saved) { try { return JSON.parse(saved) as DemoData; } catch { /* reset invalid demo state */ } }
  const data = seed();
  window.sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
  return data;
}

export async function demoRequest(path: string, init: RequestInit = {}): Promise<any> {
  if (!hasDemoSession()) throw new DemoError(401, "invalid_credentials");
  const url = new URL(path, "https://demo.invalid");
  const p = url.pathname;
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const data = readData();
  const now = new Date().toISOString();
  const uid = () => crypto.randomUUID();
  const planName = (id: string) => data.plans.find((x) => x['id'] === id)?.['name'] ?? "—";
  const filter = (rows: Row[]) => {
    const q = url.searchParams.get("q")?.toLowerCase();
    const status = url.searchParams.get("status");
    const user = url.searchParams.get("user_id");
    return rows.filter((r) => (!q || [r['email'], r['display_name'], r['name'], r['action']].some((v) => String(v ?? "").toLowerCase().includes(q))) && (!status || r['status'] === status) && (!user || r['user_id'] === user));
  };
  const save = (action: string, target?: Row) => {
    data.audit.unshift({ id: uid(), action, details: { simulated: true }, ip: null, created_at: now, actor_email: DEMO_EMAIL, target_email: target?.['email'] ?? null, target_user_id: target?.['id'] ?? null });
    window.sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
  };
  const subs = (): Row[] => data.subscriptions.map((s) => ({ ...s, plan_name: planName(s['plan_id']) }));
  if (method === "GET") {
    if (p === "/me") return data.users[0];
    if (p === "/admin/stats") return {
      users: data.users.length, suspended_users: data.users.filter((x) => x['status'] === "suspended").length,
      active_subs: data.subscriptions.filter((x) => x['status'] === "active").length, trial_subs: data.subscriptions.filter((x) => x['status'] === "trial").length,
      past_due_subs: data.subscriptions.filter((x) => x['status'] === "past_due").length, active_devices: data.devices.filter((x) => !x['revoked_at']).length,
      remote_sessions_month: 0, tokens_month: 0,
    };
    if (p === "/admin/users") {
      const items = filter(data.users).map((u) => { const s = data.subscriptions.find((x) => x['user_id'] === u['id']); return { ...u, subscription_status: s?.['status'] ?? null, plan_name: s ? planName(s['plan_id']) : null }; });
      return { total: items.length, items: items.slice(Number(url.searchParams.get("offset") ?? 0), Number(url.searchParams.get("offset") ?? 0) + Number(url.searchParams.get("limit") ?? 100)) };
    }
    const userMatch = p.match(/^\/admin\/users\/([^/]+)$/);
    if (userMatch) {
      const user = data.users.find((x) => x['id'] === userMatch[1]);
      if (!user) throw new DemoError(404, "not_found");
      const subscriptions = subs().filter((x) => x['user_id'] === user['id']);
      const subscription = subscriptions.find((x) => x['status'] !== "canceled") ?? null;
      const plan = data.plans.find((x) => x['id'] === subscription?.['plan_id']);
      const entitled = user['status'] === "active" && ["active", "trial"].includes(subscription?.['status'] ?? "") && !!plan?.['is_active'];
      const features = Object.fromEntries(FEATURES.map((feature) => { const e = plan?.['entitlements'].find((x: Row) => x['feature'] === feature); return [feature, { enabled: entitled && !!e?.['enabled'], limit: entitled ? e?.['limit'] ?? null : null }]; }));
      const own = (rows: Row[]) => rows.filter((x) => x['user_id'] === user['id']);
      return { user, entitlements: { entitled, features, subscription }, subscriptions, devices: own(data.devices), provider_keys: own(data.keys), skills: own(data.skills), agents: own(data.agents), remote_sessions: [] };
    }
    if (p === "/admin/plans") return data.plans;
    if (p === "/admin/subscriptions") return filter(subs());
    if (p === "/admin/subscription-events") return filter(data.events);
    if (p === "/admin/devices") return filter(data.devices);
    if (p === "/admin/provider-keys") return filter(data.keys);
    if (p === "/admin/skills") return filter(data.skills);
    if (p === "/admin/agents") return filter(data.agents);
    if (p === "/admin/remote-usage") return { sessions: [], top_users: [] };
    if (p === "/admin/audit-logs") return filter(data.audit);
  }
  if (method === "POST" && p === "/admin/users") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (data.users.some((x) => x['email'] === email)) throw new DemoError(409, "email_in_use");
    if (!email.includes("@") || String(body.password ?? "").length < 10) throw new DemoError(400, "validation_error");
    const user = { id: uid(), email, display_name: body.display_name ?? null, status: "active", is_admin: false, created_at: now };
    data.users.push(user); save("admin.user.create", user); return { id: user['id'] };
  }
  if (method === "POST" && p === "/admin/plans") {
    if (!body.name || !body.code || !Number.isFinite(body.monthly_price_cents) || body.monthly_price_cents < 0) throw new DemoError(400, "validation_error");
    if (data.plans.some((x) => x['code'] === body.code)) throw new DemoError(409, "conflict");
    const plan = { ...body, id: uid(), is_active: true, created_at: now, entitlements: FEATURES.map((feature) => ({ feature, enabled: false, limit: null })) };
    data.plans.push(plan); save("admin.plan.create"); return plan;
  }
  const pm = p.match(/^\/admin\/plans\/([^/]+)(\/entitlements)?$/);
  if (pm) {
    const plan = data.plans.find((x) => x['id'] === pm[1]);
    if (!plan) throw new DemoError(404, "not_found");
    if (method === "PUT" && pm[2]) plan['entitlements'] = body;
    else if (method === "PATCH" && !pm[2]) Object.assign(plan, body);
    else throw new DemoError(400, "validation_error");
    save("admin.plan.update"); return { ok: true };
  }
  const um = p.match(/^\/admin\/users\/([^/]+)\/(suspend|reactivate|admin|subscription|devices\/([^/]+)\/revoke)$/);
  if (um) {
    const user = data.users.find((x) => x['id'] === um[1]);
    if (!user) throw new DemoError(404, "not_found");
    const action = um[2];
    if (action === "suspend" && method === "POST") {
      if (user['id'] === "demo-admin") throw new DemoError(400, "cannot_suspend_self");
      user['status'] = "suspended";
    } else if (action === "reactivate" && method === "POST") user['status'] = "active";
    else if (action === "admin" && method === "PUT") {
      if (user['id'] === "demo-admin" && !body.is_admin) throw new DemoError(400, "cannot_demote_self");
      user['is_admin'] = !!body.is_admin;
    } else if (action === "subscription" && method === "PUT") {
      if (!data.plans.some((x) => x['id'] === body.plan_id) || !["trial", "active", "past_due", "canceled", "suspended"].includes(body.status)) throw new DemoError(400, "validation_error");
      let s = data.subscriptions.find((x) => x['user_id'] === user['id']);
      const from = s?.['status'] ?? null;
      if (!s) { s = { id: uid(), user_id: user['id'], email: user['email'], created_at: now }; data.subscriptions.push(s); }
      Object.assign(s, { plan_id: body.plan_id, status: body.status, current_period_start: now, current_period_end: new Date(Date.now() + (body.period_days ?? 30) * 86400000).toISOString(), updated_at: now });
      data.events.unshift({ id: uid(), email: user['email'], actor_email: DEMO_EMAIL, from_status: from, to_status: body.status, note: body.note ?? null, created_at: now });
    } else if (um[3] && method === "POST") {
      const device = data.devices.find((x) => x['id'] === um[3] && x['user_id'] === user['id']);
      if (!device) throw new DemoError(404, "not_found");
      device['revoked_at'] = now;
    } else throw new DemoError(400, "validation_error");
    save(`admin.user.${action}`, user); return { ok: true };
  }
  throw new DemoError(404, "not_found");
}