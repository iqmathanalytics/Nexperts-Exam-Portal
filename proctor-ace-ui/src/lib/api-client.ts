const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: initHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(initHeaders as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const payload = data as { error?: string; detail?: string };
    const message = payload.detail
      ? `${payload.error ?? "Request failed"}: ${payload.detail}`
      : payload.error ?? res.statusText;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const apiBase = API_URL;
