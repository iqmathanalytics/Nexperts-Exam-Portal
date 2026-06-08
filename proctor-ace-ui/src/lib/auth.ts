import { redirect } from "@tanstack/react-router";

export type AuthRole = "candidate" | "admin";

const STORAGE_KEY = "nx-auth";

export type AuthSession = {
  role: AuthRole;
  email: string;
  token: string;
  userId?: string;
  fullName?: string;
};

function parseSession(raw: string): AuthSession | null {
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

/** Share session across apex + www (e.g. ventrix.global and www.ventrix.global). */
function cookieDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  const parts = host.split(".");
  if (parts.length < 2) return null;
  return `.${parts.slice(-2).join(".")}`;
}

function readCookieSession(): AuthSession | null {
  if (typeof document === "undefined") return null;
  const prefix = `${STORAGE_KEY}=`;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  if (!entry) return null;
  return parseSession(decodeURIComponent(entry.slice(prefix.length)));
}

function writeCookieSession(session: AuthSession | null) {
  if (typeof document === "undefined") return;
  const domain = cookieDomain();
  const base = `path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  if (!session) {
    document.cookie = `${STORAGE_KEY}=; max-age=0; ${base}`;
    if (domain) document.cookie = `${STORAGE_KEY}=; max-age=0; domain=${domain}; ${base}`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(session));
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${STORAGE_KEY}=${value}; max-age=${maxAge}; ${base}`;
  if (domain) document.cookie = `${STORAGE_KEY}=${value}; max-age=${maxAge}; domain=${domain}; ${base}`;
}

export function getAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage) {
    const session = parseSession(fromStorage);
    if (session?.token) return session;
  }
  const fromCookie = readCookieSession();
  if (fromCookie?.token) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fromCookie));
    return fromCookie;
  }
  return null;
}

export function setAuth(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  writeCookieSession(session);
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  writeCookieSession(null);
}

export function mapApiRole(role: string): AuthRole {
  return role === "CANDIDATE" ? "candidate" : "admin";
}

export function isClientAuthenticated(): boolean {
  return typeof window !== "undefined" && !!getAuth()?.token;
}

export function requireAuth(role: AuthRole) {
  // Auth is client-only; skip redirect during SSR
  if (typeof window === "undefined") return null;
  const auth = getAuth();
  if (!auth?.token || auth.role !== role) {
    throw redirect({ to: role === "admin" ? "/admin-login" : "/login" });
  }
  return auth;
}

export function getToken(): string | undefined {
  return getAuth()?.token;
}
