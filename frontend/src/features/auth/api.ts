import { apiRequest } from "../../lib/api";
import type {
  AuthResult,
  ForgotPasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  RegisteredUser,
  ResetPasswordInput,
} from "./types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function register(input: RegisterInput): Promise<RegisteredUser> {
  const res = await apiRequest<Envelope<RegisteredUser>>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const res = await apiRequest<Envelope<AuthResult>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

/** Silent session restore: exchanges the httpOnly refresh cookie for a fresh access token. */
export async function refresh(): Promise<AuthResult> {
  const res = await apiRequest<Envelope<AuthResult>>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function logout(): Promise<void> {
  await apiRequest<Envelope<{ message: string }>>("/auth/logout", { method: "POST" });
}

export async function getCurrentUser(): Promise<PublicUser> {
  const res = await apiRequest<Envelope<{ user: PublicUser }>>("/users/me");
  return res.data.user;
}

/** Enumeration-safe: backend always returns the same generic message. */
export async function forgotPassword(input: ForgotPasswordInput): Promise<string> {
  const res = await apiRequest<Envelope<{ message: string }>>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.message;
}

export async function resetPassword(input: ResetPasswordInput): Promise<string> {
  const res = await apiRequest<Envelope<{ message: string }>>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.message;
}
