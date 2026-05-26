import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { COMPANY } from "../lib/company.js";

export type InvoiceDetails = {
  invoiceId: string;
  issuedAt: string;
  status: string;
  method: string;
  examTitle: string;
  examDescription: string;
  amount: number;
  subtotal: number;
  discountAmount: number;
  voucherCode: string | null;
  currency: string;
  billTo: {
    fullName: string;
    email: string;
    phone: string | null;
    icPassport: string | null;
  };
  company: {
    name: string;
    legalName: string;
    addressLines: string[];
    email: string;
    phone: string;
    website: string;
    taxId: string;
  };
};

export async function getInvoiceDetails(
  paymentId: string,
  userId?: string,
): Promise<InvoiceDetails | null> {
  const payment = await prisma.payment.findFirst({
    where: userId ? { id: paymentId, userId } : { id: paymentId },
    include: { exam: true, voucher: true, user: true },
  });
  if (!payment) return null;
  if (payment.status === PaymentStatus.REFUNDED) return null;

  const amount = Number(payment.amount);
  const examPrice = Number(payment.exam.price);
  const discount = payment.voucher ? Math.max(0, examPrice - amount) : 0;

  return {
    invoiceId: payment.invoiceId,
    issuedAt: payment.updatedAt.toISOString(),
    status: payment.status,
    method: payment.stripeSessionId ? "Stripe (Card)" : "Online payment",
    examTitle: payment.exam.title,
    examDescription: payment.exam.description,
    amount,
    subtotal: discount > 0 ? examPrice : amount,
    discountAmount: discount,
    voucherCode: payment.voucher?.code ?? null,
    currency: "MYR",
    billTo: {
      fullName: payment.user.fullName,
      email: payment.user.email,
      phone: payment.user.phone,
      icPassport: payment.user.icPassport,
    },
    company: {
      name: COMPANY.name,
      legalName: COMPANY.legalName,
      addressLines: [...COMPANY.addressLines],
      email: COMPANY.email,
      phone: COMPANY.phone,
      website: COMPANY.website,
      taxId: COMPANY.taxId,
    },
  };
}
