import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessToken } from "../../lib/api";
import { clearAllDrafts } from "../../hooks/useAutosaveDraft";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "./api";
import type { LoginInput, PublicUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth is session-based: the opaque token issued at login is the credential
 * sent as a Bearer token on every request. There is no refresh endpoint, so
 * the token itself must survive reloads — it is persisted to localStorage and
 * validated against /users/me on mount.
 */
const TOKEN_STORAGE_KEY = "sessionToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    setAccessToken(token);
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        setStatus("authenticated");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setAccessToken(null);
        setStatus("unauthenticated");
      });
  }, []);

  async function login(input: LoginInput): Promise<void> {
    const result = await loginRequest(input);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
    setAccessToken(result.token);
    setUser(result.user);
    setStatus("authenticated");
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      clearAllDrafts();
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }

  return <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
