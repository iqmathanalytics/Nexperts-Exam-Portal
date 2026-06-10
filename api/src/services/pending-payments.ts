import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getStripe } from "./stripe.js";

const STALE_MS = 24 * 60 * 60 * 1000;

/** Drop abandoned checkout records so exams stay visible and purchasable again. */
export async function releaseStalePendingPayments(userId: string) {
  const cutoff = new Date(Date.now() - STALE_MS);
  const pending = await prisma.payment.findMany({
    where: { userId, status: PaymentStatus.PENDING },
  });
  if (!pending.length) return;

  const stripe = getStripe();
  for (const payment of pending) {
    let shouldRelease = payment.createdAt < cutoff;

    if (!shouldRelease && stripe && payment.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
        shouldRelease = session.status === "expired";
      } catch {
        shouldRelease = payment.createdAt < cutoff;
      }
    }

    if (!shouldRelease) continue;
    await cancelPendingPayment(payment.id, payment.stripeSessionId);
  }
}

export async function cancelPendingPayment(paymentId: string, stripeSessionId?: string | null) {
  const stripe = getStripe();
  if (stripe && stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(stripeSessionId);
      }
    } catch {
      /* session may already be gone */
    }
  }
  await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {});
}
