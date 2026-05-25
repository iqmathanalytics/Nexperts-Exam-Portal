import { api, apiBase } from "@/lib/api-client";
import { getToken } from "@/lib/auth";

export function apiAuth<T>(path: string, options: RequestInit = {}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  return api<T>(path, { ...options, token });
}

export async function downloadAuthCsv(path: string, filename: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
