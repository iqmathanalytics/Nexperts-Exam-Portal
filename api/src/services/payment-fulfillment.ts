import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function fulfillPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true, voucher: true },
  });

  if (!payment) return null;
  if (payment.status === PaymentStatus.PAID) return payment;

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.PAID },
    include: { exam: true, voucher: true },
  });

  if (updated.voucherId) {
    await prisma.voucher.update({
      where: { id: updated.voucherId },
      data: { usedCount: { increment: 1 } },
    });
  }

  return updated;
}
