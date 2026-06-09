export function isRealStripeSessionId(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false;
  const id = sessionId.trim();
  return id.startsWith("cs_") && !id.includes("CHECKOUT_SESSION");
}
