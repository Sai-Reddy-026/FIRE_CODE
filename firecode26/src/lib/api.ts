/**
 * Typed API client for FireCode backend.
 * Base URL: http://localhost:80/api
 * Auth: Bearer JWT from localStorage (set by auth.ts helpers)
 */

function getBaseUrl(): string {
  const envUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:80/api";
  let url = envUrl.trim().replace(/\/+$/, "");
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  return url;
}

const BASE_URL = getBaseUrl();

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fc_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fc_refresh_token");
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshTokenFlow(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/accounts/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem("fc_token");
      localStorage.removeItem("fc_refresh_token");
      localStorage.removeItem("fc_user");
      return null;
    }

    const data = await res.json();
    if (data.token && data.refreshToken) {
      localStorage.setItem("fc_token", data.token);
      localStorage.setItem("fc_refresh_token", data.refreshToken);
      return data.token;
    }
  } catch (err) {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_refresh_token");
    localStorage.removeItem("fc_user");
  }
  return null;
}

async function request<T>(
  path: string,
  options: RequestInit & { _retry?: boolean } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle automatic silent token refresh on 401/403
  if (
    (res.status === 401 || res.status === 403) &&
    !options._retry &&
    path !== "/accounts/refresh" &&
    getRefreshToken()
  ) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((newToken: string) => {
          request<T>(path, { ...options, _retry: true })
            .then(resolve)
            .catch(reject);
        });
      });
    }

    options._retry = true;
    isRefreshing = true;

    const newToken = await refreshTokenFlow();
    isRefreshing = false;

    if (newToken) {
      onRefreshed(newToken);
      return request<T>(path, options);
    }
  }

  // Handle non-JSON responses (e.g., file downloads)
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) {
      throw new ApiError(res.status, `HTTP ${res.status}`);
    }
    return res as unknown as T;
  }

  const json = await res.json();
  if (!res.ok) {
    if (
      (res.status === 401 || res.status === 403) &&
      path !== "/accounts/login" &&
      path !== "/accounts/register"
    ) {
      localStorage.removeItem("fc_token");
      localStorage.removeItem("fc_refresh_token");
      localStorage.removeItem("fc_user");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        // Dispatch a custom event instead of hard navigation to preserve React Router state
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }
    const message = (json as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, json);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
