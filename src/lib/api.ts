/**
 * Client for the self-hosted HASi Control Plane API.
 * Base URL: VITE_HASI_API_URL at build time, or a value saved on the login screen.
 * Access token lives only in memory; the refresh token is kept in localStorage.
 */
const API_KEY = "hasi.apiUrl";
const REFRESH_KEY = "hasi.refresh";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
export const onAuthChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((f) => f());

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(API_KEY);
    if (saved) return saved;
  }
  return (import.meta.env["VITE_HASI_API_URL"] as string | undefined) ?? "";
}
export function setApiUrl(url: string) {
  window.localStorage.setItem(API_KEY, url.replace(/\/+$/, ""));
}

const getRefresh = () => (typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_KEY));

type Tokens = { access_token: string; refresh_token: string };
function storeTokens(t: Tokens | null) {
  accessToken = t?.access_token ?? null;
  if (t) window.localStorage.setItem(REFRESH_KEY, t.refresh_token);
  else window.localStorage.removeItem(REFRESH_KEY);
  emit();
}

async function raw(path: string, init: RequestInit = {}, token?: string | null) {
  const base = getApiUrl();
  if (!base) throw new ApiError(0, "api_url_missing", "Endereço da API não configurado.");
  const headers: Record<string, string> = { ...(init.body ? { "content-type": "application/json" } : {}) };
  if (token) headers["authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(base + path, { ...init, headers });
  } catch {
    throw new ApiError(0, "network_error", "Não foi possível conectar à API.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "error", data?.message ?? data?.error);
  return data;
}

export async function refreshSession(): Promise<boolean> {
  const rt = getRefresh();
  if (!rt) return false;
  refreshing ??= raw("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: rt }) })
    .then((t: Tokens) => (storeTokens(t), true))
    .catch((e: unknown) => {
      if (e instanceof ApiError && e.status !== 0) storeTokens(null);
      return false;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken) await refreshSession();
  try {
    return await raw(path, init, accessToken);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (await refreshSession())) return raw(path, init, accessToken);
    throw e;
  }
}

export const hasSession = () => !!accessToken || !!getRefresh();

export async function login(email: string, password: string) {
  storeTokens(await raw("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
}
export async function register(email: string, password: string, display_name?: string) {
  storeTokens(await raw("/auth/register", { method: "POST", body: JSON.stringify({ email, password, display_name }) }));
}
export async function logout() {
  const rt = getRefresh();
  if (rt) await raw("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: rt }) }).catch(() => {});
  storeTokens(null);
}
export const forgotPassword = (email: string) =>
  raw("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
export const resetPassword = (token: string, password: string) =>
  raw("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });

export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

const ERRORS: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  account_suspended: "Esta conta está suspensa.",
  email_in_use: "Este e-mail já está cadastrado.",
  validation_error: "Verifique os campos informados.",
  invalid_or_expired_token: "Link inválido ou expirado.",
  forbidden: "Acesso restrito a administradores.",
  cannot_suspend_self: "Você não pode suspender a própria conta.",
  cannot_demote_self: "Você não pode remover seu próprio acesso de administrador.",
  conflict: "Já existe um registro com esses dados.",
  not_found: "Registro não encontrado.",
};
export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? (ERRORS[e.code] ?? e.message) : "Erro inesperado.";
