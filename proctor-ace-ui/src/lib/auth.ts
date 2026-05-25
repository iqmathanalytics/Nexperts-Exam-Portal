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

export function getAuth(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuth(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function mapApiRole(role: string): AuthRole {
  return role === "CANDIDATE" ? "candidate" : "admin";
}

export function requireAuth(role: AuthRole) {
  // Auth is client-only (localStorage); skip redirect during SSR
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
