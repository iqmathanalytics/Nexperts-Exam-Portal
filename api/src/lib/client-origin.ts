import type { Request } from "express";
import { env } from "./env.js";
import { STRIPE_SESSION_PLACEHOLDER } from "./stripe-session.js";

export function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

function isAllowedOrigin(origin: string): boolean {
  const norm = normalizeOrigin(origin);
  return env.clientUrls.map(normalizeOrigin).includes(norm);
}

/** Prefer the browser origin from checkout (must be in CLIENT_URLS). */
export function resolveClientOrigin(req: Pick<Request, "get">, bodyOrigin?: string): string {
  const referer = req.get("referer");
  let refererOrigin: string | undefined;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = undefined;
    }
  }

  for (const candidate of [bodyOrigin, req.get("origin"), refererOrigin]) {
    if (!candidate) continue;
    const norm = normalizeOrigin(candidate);
    if (isAllowedOrigin(norm)) return norm;
  }

  return normalizeOrigin(env.clientUrl);
}

export function buildPaymentCancelUrl(origin: string): string {
  const url = new URL("/dashboard/exams", `${origin}/`);
  url.searchParams.set("canceled", "1");
  return url.toString();
}

export function buildPaymentSuccessUrl(origin: string, query: Record<string, string>): string {
  const url = new URL("/payment-success", `${origin}/`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Stripe replaces the literal `{CHECKOUT_SESSION_ID}` in success_url.
 * URLSearchParams encodes `{` `}` which breaks substitution — append it unencoded.
 */
export function buildStripeSuccessUrl(origin: string, query: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "session_id") continue;
    params.set(key, value);
  }
  const base = `${normalizeOrigin(origin)}/payment-success`;
  const rest = params.toString();
  const sessionQuery = `session_id=${STRIPE_SESSION_PLACEHOLDER}`;
  return rest ? `${base}?${sessionQuery}&${rest}` : `${base}?${sessionQuery}`;
}
