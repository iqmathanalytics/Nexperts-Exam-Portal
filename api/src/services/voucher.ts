import { prisma } from "../lib/prisma.js";

export async function validateVoucher(
  code: string,
  examId: string,
  subtotal: number,
  userId: string,
) {
  const voucher = await prisma.voucher.findUnique({
    where: { code: code.toUpperCase() },
    include: { exams: true, redemptions: { where: { userId } } },
  });

  if (!voucher || !voucher.active) return { valid: false as const, discount: 0 };
  if (voucher.expiry < new Date()) return { valid: false as const, discount: 0 };
  if (voucher.usedCount >= voucher.usageLimit) return { valid: false as const, discount: 0 };
  if (voucher.redemptions.length > 0) return { valid: false as const, discount: 0 };

  const applies =
    voucher.exams.length === 0 || voucher.exams.some((ve) => ve.examId === examId);

  if (!applies) return { valid: false as const, discount: 0 };

  const amount = Number(voucher.discountAmount);
  const discount =
    voucher.discountType === "Percentage"
      ? Math.round((subtotal * amount) / 100)
      : Math.min(subtotal, amount);

  return { valid: true as const, discount, voucherId: voucher.id };
}
