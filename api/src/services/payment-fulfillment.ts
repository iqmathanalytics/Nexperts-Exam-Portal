import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { attendByFromPurchase } from "./exam-scheduling.js";

export async function fulfillPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true, voucher: true },
  });

  if (!payment) return null;
  if (payment.status === PaymentStatus.PAID) return payment;

  const paidAt = new Date();
  const attendByAt = attendByFromPurchase(paidAt);

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      attendByAt: payment.attendByAt ?? attendByAt,
    },
    include: { exam: true, voucher: true },
  });

  if (updated.voucherId) {
    await prisma.$transaction([
      prisma.voucher.update({
        where: { id: updated.voucherId },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.voucherRedemption.upsert({
        where: {
          voucherId_userId: { voucherId: updated.voucherId, userId: updated.userId },
        },
        create: {
          voucherId: updated.voucherId,
          userId: updated.userId,
          paymentId: updated.id,
        },
        update: { paymentId: updated.id },
      }),
    ]);
  }

  return updated;
}
