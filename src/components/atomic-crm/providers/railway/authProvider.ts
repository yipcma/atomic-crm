import type { AuthProvider } from "ra-core";
import { canAccess } from "../commons/canAccess";
import {
  apiJson,
  clearTokens,
  hasSession,
  jsonRequest,
  setTokens,
} from "./httpClient";

const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_IDENTITY_CACHE_KEY = "RaStore.auth.current_identity";

export interface Identity {
  id: number;
  fullName: string;
  avatar?: string;
  administrator: boolean;
  super_admin?: boolean;
}

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  identity: Identity;
}

function getLocalStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function cacheIdentity(identity: Identity): void {
  getLocalStorage()?.setItem(
    CURRENT_IDENTITY_CACHE_KEY,
    JSON.stringify(identity),
  );
}

function getCachedIdentity(): Identity | null {
  const cached = getLocalStorage()?.getItem(CURRENT_IDENTITY_CACHE_KEY);
  return cached ? (JSON.parse(cached) as Identity) : null;
}

function clearCache(): void {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_IDENTITY_CACHE_KEY);
}

// Persist tokens + identity after a login or set-password, so the app is ready
// on the next render without an extra round-trip.
export function establishSession(result: LoginResult): void {
  setTokens(result.access_token, result.refresh_token);
  cacheIdentity(result.identity);
  getLocalStorage()?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
}

export async function getIsInitialized(): Promise<boolean> {
  const storage = getLocalStorage();
  const cached = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cached != null) {
    return cached === "true";
  }

  const { json } = await apiJson<{ is_initialized: boolean }>(
    "/api/init-state",
  );
  if (json.is_initialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }
  return json.is_initialized;
}

async function loadIdentity(): Promise<Identity> {
  const { json } = await apiJson<Identity>("/api/auth/identity");
  cacheIdentity(json);
  return json;
}

export const getAuthProvider = (): AuthProvider => ({
  async login(params) {
    if (params.ssoDomain) {
      throw new Error("SSO login is not supported on this deployment");
    }
    const email = params.email ?? params.username;
    const { json } = await apiJson<LoginResult>(
      "/api/auth/login",
      jsonRequest("POST", { email, password: params.password }),
    );
    establishSession(json);
  },

  async logout() {
    clearCache();
    clearTokens();
  },

  async checkAuth() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    // Public onboarding/recovery routes do not require a session.
    for (const route of [
      "/set-password",
      "/register",
      "/sign-up",
      "/verify-email",
    ]) {
      // TRANSITIONAL: the `hash` branch covers invite links minted before
      // 2026-08-02, when these routes were hash-based. Delete it (and the
      // `hash` binding above) after 2026-08-10, once those tokens have expired.
      if (path === route || hash.startsWith(`#${route}`)) {
        return;
      }
    }

    if (!(await getIsInitialized())) {
      clearTokens();
      throw { redirectTo: "/sign-up", message: false };
    }

    if (!hasSession()) {
      throw new Error("Not authenticated");
    }
  },

  async checkError(error) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) {
      clearCache();
      clearTokens();
      throw new Error("Session expired");
    }
  },

  async getIdentity() {
    const identity = getCachedIdentity() ?? (await loadIdentity());
    return {
      id: identity.id,
      fullName: identity.fullName,
      avatar: identity.avatar,
      super_admin: identity.super_admin ?? false,
    };
  },

  async getPermissions() {
    const identity = getCachedIdentity();
    return identity?.administrator ? "admin" : "user";
  },

  async canAccess(params) {
    if (!(await getIsInitialized())) return false;
    const identity = getCachedIdentity() ?? (await loadIdentity());
    const role = identity.administrator ? "admin" : "user";
    return canAccess(role, params as any);
  },
});
