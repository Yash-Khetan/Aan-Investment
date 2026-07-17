import { apiRequest } from "../../lib/api";
import type { PublicUser, RegisterInput } from "../auth/types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function listUsers(): Promise<PublicUser[]> {
  const res = await apiRequest<Envelope<{ users: PublicUser[] }>>("/users");
  return res.data.users;
}

export async function createUser(input: RegisterInput): Promise<PublicUser> {
  const res = await apiRequest<Envelope<{ user: PublicUser }>>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data.user;
}

export async function activateUser(id: string): Promise<PublicUser> {
  const res = await apiRequest<Envelope<{ user: PublicUser }>>(`/users/${id}/activate`, {
    method: "PATCH",
  });
  return res.data.user;
}

export async function deactivateUser(id: string): Promise<PublicUser> {
  const res = await apiRequest<Envelope<{ user: PublicUser }>>(`/users/${id}/deactivate`, {
    method: "PATCH",
  });
  return res.data.user;
}
