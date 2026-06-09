/** Stripe substitutes this literal token in success_url — must not be URL-encoded. */
export const STRIPE_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

export function isRealStripeSessionId(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const id = sessionId.trim();
  if (!id || id.includes("CHECKOUT_SESSION")) return false;
  return id.startsWith("cs_");
}

/** Prefer a real client session id; otherwise fall back to the id stored on the payment. */
export function resolveStripeSessionId(
  clientSessionId: string | undefined,
  storedSessionId: string | null | undefined,
): string | undefined {
  if (isRealStripeSessionId(clientSessionId)) return clientSessionId!.trim();
  if (isRealStripeSessionId(storedSessionId)) return storedSessionId!.trim();
  return undefined;
}
