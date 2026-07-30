import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  getStoredUser,
  setStoredUser,
  setToken,
  setRefreshToken,
  logout as authLogout,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  login: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  const login = useCallback((token: string, authUser: AuthUser, refreshToken?: string) => {
    setToken(token);
    // Use the typed setRefreshToken helper from auth.ts instead of direct localStorage.setItem.
    // This ensures key name consistency — only auth.ts owns the storage key name.
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    setStoredUser(authUser);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
