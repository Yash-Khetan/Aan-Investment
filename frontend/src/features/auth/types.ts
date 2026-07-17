export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  roles: string[];
  isActive: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Result of login: sanitized user + the raw opaque session token (Bearer credential). */
export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  roles: string[];
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}
