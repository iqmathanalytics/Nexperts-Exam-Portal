import { api, apiBase } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { downloadBlob } from "@/lib/download-blob";

export function apiAuth<T>(path: string, options: RequestInit = {}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  return api<T>(path, { ...options, token });
}

/** Map legacy .pdf paths to JSON download endpoints (avoids IDM/CORS on binary URLs) */
function pdfDownloadPath(path: string): string {
  if (path.includes("/invoice.pdf")) {
    return path.replace("/invoice.pdf", "/invoice-download");
  }
  if (path.endsWith("/pdf")) {
    return path.replace(/\/pdf$/, "/download");
  }
  return path;
}

export async function downloadAuthCsv(path: string, filename: string) {
  await downloadAuthPdf(path, filename);
}

export async function downloadAuthPdf(path: string, filename: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const url = `${apiBase}${pdfDownloadPath(path)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: "{}",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = (await res.json()) as { error?: string };
      detail = err.error ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || "Download failed");
  }

  const data = (await res.json()) as { pdfBase64?: string; filename?: string };
  if (!data.pdfBase64) {
    throw new Error("Invalid download response");
  }

  const binary = atob(data.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(blob, data.filename ?? filename);
}
