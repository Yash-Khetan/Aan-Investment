/**
 * Thin fetch wrapper shared by every feature's api.ts.
 *
 * The backend is not consistent about response shape across modules —
 * accounting-export/reports/dashboard-summary wrap in `{ success, data }`,
 * while collateral/collections/document-vault return the resource directly.
 * `apiRequest` only handles transport + error normalization; each feature's
 * own api.ts unwraps the shape it actually gets back.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * In-memory access token, set by AuthContext after login/refresh. Kept out of
 * localStorage so an XSS payload can't read it directly; lost on hard reload,
 * which is why AuthContext silently calls /auth/refresh on mount.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Per-field validation issues, when the backend rejected the request with a 422. */
  details?: FieldError[];

  constructor(message: string, status: number, code?: string, details?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseErrorBody(
  res: Response,
): Promise<{ message: string; code?: string; details?: FieldError[] }> {
  try {
    const body = await res.json();
    const details: FieldError[] | undefined = Array.isArray(body?.error?.details)
      ? body.error.details.filter((d: unknown): d is FieldError => typeof (d as FieldError)?.message === "string")
      : undefined;
    if (body?.error?.message) return { message: body.error.message, code: body.error.code, details };
    if (body?.message) return { message: body.message, code: body.error, details };
    return { message: res.statusText };
  } catch {
    return { message: res.statusText };
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // send the httpOnly refresh cookie on /auth/* calls
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const { message, code, details } = await parseErrorBody(res);
    throw new ApiError(message, res.status, code, details);
  }

  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

/** Downloads a file response (CSV/XLSX export endpoints) and triggers a browser save. */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    const { message } = await parseErrorBody(res);
    throw new ApiError(message, res.status);
  }

  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Builds a query string from a filters object, skipping undefined/empty values. */
export function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
