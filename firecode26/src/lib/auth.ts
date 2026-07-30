/**
 * Auth token & user helpers — backed by localStorage.
 *
 * The backend returns a plain JWT in `token` (not an HTTP-only cookie).
 * We store it under "fc_token" and the user payload under "fc_user".
 */

export interface AuthUser {
  id: string;
  username: string;
  role: "user" | "admin";
}

const TOKEN_KEY = "fc_token";
const REFRESH_TOKEN_KEY = "fc_refresh_token";
const USER_KEY = "fc_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && typeof payload.exp === "number") {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether the user has a valid session (access OR refresh token present).
 *
 * BUG-25 FIX: Previously called logout() — which makes a network request — as a
 * side effect of this pure "check" function. This caused a fetch() on every render
 * where a route guard evaluated isLoggedIn(). Now we only clear local storage without
 * triggering the server-side invalidation request.
 */
export function isLoggedIn(): boolean {
  const token = getToken();
  const refreshToken = getRefreshToken();
  if (!token && !refreshToken) return false;
  if (!isTokenValid(token) && !refreshToken) {
    // Clear stale local data without making a network request
    clearToken();
    clearRefreshToken();
    clearStoredUser();
    return false;
  }
  return true;
}

/**
 * Logs out the user: clears local storage AND calls the backend to invalidate
 * the refresh token server-side. Uses fire-and-forget so a network failure
 * never blocks the user from being logged out locally.
 *
 * BUG-09 FIX: Previously read base URL from window.__VITE_API_BASE_URL__ which
 * is never set anywhere in the codebase. Now correctly reads from import.meta.env
 * which is properly handled by Vite at build time.
 */
export function logout(): void {
  const refreshToken = getRefreshToken();
  const token = getToken();

  // BUG-09 FIX: Use import.meta.env.VITE_API_BASE_URL (Vite-standard) instead of
  // window.__VITE_API_BASE_URL__ (undefined at runtime, causing logout to always
  // call the hardcoded localhost URL regardless of environment).
  if (token) {
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:80/api";

    // Fire-and-forget: best-effort server-side session invalidation
    // Network errors are intentionally swallowed — local logout always succeeds
    fetch(`${BASE_URL}/accounts/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      // Swallow network errors — local session is always cleared regardless
    });
  }

  clearToken();
  clearRefreshToken();
  clearStoredUser();
}
