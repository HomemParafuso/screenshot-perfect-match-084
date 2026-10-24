export const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3000";

export type Tokens = { accessToken: string; refreshToken: string; expiresIn?: number };

const ACCESS_KEY = "hasi.accessToken";
const REFRESH_KEY = "hasi.refreshToken";

const isBrowser = () => typeof window !== "undefined";

export function getTokens(): Tokens | null {
  if (!isBrowser()) return null;
  const accessToken = window.localStorage.getItem(ACCESS_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function setTokens(tokens: Tokens) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function notifyLogout() {
  clearTokens();
  if (isBrowser()) window.dispatchEvent(new Event("hasi:logout"));
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path: string, init: RequestInit, accessToken?: string) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function refreshTokens(): Promise<Tokens | null> {
  const current = getTokens();
  if (!current) return null;
  const res = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!res.ok) return null;
  const next = (await res.json()) as Tokens;
  setTokens(next);
  return next;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = getTokens();
  let res = await request(path, init, tokens?.accessToken);

  if (res.status === 401 && tokens?.refreshToken) {
    const next = await refreshTokens();
    if (next) {
      res = await request(path, init, next.accessToken);
    } else {
      notifyLogout();
    }
  }

  if (!res.ok) {
    const body = (await parse(res)) as { error?: string; message?: string } | undefined;
    if (res.status === 401) notifyLogout();
    throw new ApiError(res.status, body?.error ?? "request_failed", body?.message);
  }

  return (await parse(res)) as T;
}

function withBody(method: string, body?: unknown): RequestInit {
  return body === undefined ? { method } : { method, body: JSON.stringify(body) };
}

export function post<T = unknown>(path: string, body?: unknown) {
  return api<T>(path, withBody("POST", body));
}

export function put<T = unknown>(path: string, body?: unknown) {
  return api<T>(path, withBody("PUT", body));
}

export function patch<T = unknown>(path: string, body?: unknown) {
  return api<T>(path, withBody("PATCH", body));
}

export function del<T = unknown>(path: string) {
  return api<T>(path, { method: "DELETE" });
}
