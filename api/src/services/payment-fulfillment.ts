import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { attendByFromPurchase } from "./exam-scheduling.js";
import { generateInvoicePdf } from "./pdf-invoice.js";
import { sendInvoiceEmail } from "./brevo.js";
import { getInvoiceDetails } from "./invoice-details.js";

async function buildInvoicePdfForPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true, voucher: true, user: true },
  });
  if (!payment) return null;

  const details = await getInvoiceDetails(paymentId);
  if (!details) return null;

  const pdf = await generateInvoicePdf({
    invoiceId: details.invoiceId,
    issuedAt: new Date(details.issuedAt),
    status: details.status,
    method: details.method,
    examTitle: details.examTitle,
    examDescription: details.examDescription,
    amount: details.amount,
    discountAmount: details.discountAmount > 0 ? details.discountAmount : undefined,
    voucherCode: details.voucherCode,
    billTo: details.billTo,
  });

  return { payment, pdf };
}

export async function sendPaymentInvoiceEmail(paymentId: string) {
  const built = await buildInvoicePdfForPayment(paymentId);
  if (!built || built.payment.status !== PaymentStatus.PAID) return;

  await sendInvoiceEmail({
    to: built.payment.user.email,
    recipientName: built.payment.user.fullName,
    examTitle: built.payment.exam.title,
    invoiceId: built.payment.invoiceId,
    amount: Number(built.payment.amount),
    pdf: built.pdf,
  });
}

export async function getInvoicePdfBuffer(paymentId: string, userId?: string) {
  const details = await getInvoiceDetails(paymentId, userId);
  if (!details || details.status !== PaymentStatus.PAID) return null;

  const pdf = await generateInvoicePdf({
    invoiceId: details.invoiceId,
    issuedAt: new Date(details.issuedAt),
    status: details.status,
    method: details.method,
    examTitle: details.examTitle,
    examDescription: details.examDescription,
    amount: details.amount,
    discountAmount: details.discountAmount > 0 ? details.discountAmount : undefined,
    voucherCode: details.voucherCode,
    billTo: details.billTo,
  });

  return { pdf, invoiceId: details.invoiceId };
}

export async function fulfillPayment(paymentId: string) {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true, voucher: true },
  });

  if (!existing) return null;
  if (existing.status === PaymentStatus.PAID) return existing;

  const paidAt = new Date();
  const attendByAt = attendByFromPurchase(paidAt);

  const result = await prisma.payment.updateMany({
    where: { id: paymentId, status: PaymentStatus.PENDING },
    data: {
      status: PaymentStatus.PAID,
      attendByAt: existing.attendByAt ?? attendByAt,
    },
  });

  if (result.count === 0) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: { exam: true, voucher: true },
    });
  }

  const updated = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true, voucher: true },
  });
  if (!updated) return null;

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

  sendPaymentInvoiceEmail(paymentId).catch((err) => {
    console.error("Invoice email failed:", err);
  });

  return updated;
}
