import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessToken } from "../../lib/api";
import { login as loginRequest, logout as logoutRequest, refresh as refreshRequest } from "./api";
import type { LoginInput, PublicUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    // The access token lives only in memory, so a hard reload has none —
    // trade it back in via the httpOnly refresh cookie before deciding the
    // user is logged out.
    refreshRequest()
      .then((result) => {
        setAccessToken(result.accessToken);
        setUser(result.user);
        setStatus("authenticated");
      })
      .catch(() => {
        setAccessToken(null);
        setStatus("unauthenticated");
      });
  }, []);

  async function login(input: LoginInput): Promise<void> {
    const result = await loginRequest(input);
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus("authenticated");
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
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
