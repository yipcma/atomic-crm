// Minimal fetch client for the Railway API. Same-origin (Caddy in production,
// Vite proxy in dev), bearer-token auth, with transparent access-token refresh.

const ACCESS_TOKEN_KEY = "atomic_crm.access_token";
const REFRESH_TOKEN_KEY = "atomic_crm.refresh_token";

export class HttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${status}`;
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasSession(): boolean {
  return getAccessToken() != null;
}

function withAuth(options: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...options, headers };
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const data = (await response.json()) as { access_token: string };
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  return data.access_token;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  let response = await fetch(path, withAuth(options, getAccessToken()));

  if (response.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY)) {
    if (!refreshing) {
      refreshing = refreshAccessToken().finally(() => {
        refreshing = null;
      });
    }
    const newToken = await refreshing;
    if (newToken) {
      response = await fetch(path, withAuth(options, newToken));
    }
  }

  if (!response.ok) {
    let body: unknown = {};
    try {
      body = await response.json();
    } catch {
      // ignore non-JSON error bodies
    }
    throw new HttpError(response.status, body);
  }

  return response;
}

export async function apiJson<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<{ json: T; headers: Headers }> {
  const response = await apiFetch(path, options);
  const json = (await response.json()) as T;
  return { json, headers: response.headers };
}

export function jsonRequest(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
