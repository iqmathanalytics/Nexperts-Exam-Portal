import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** How many vouchers from the same bulk batch a single user may redeem. */
const MAX_VOUCHERS_PER_USER_PER_BATCH = 1;

/**
 * Count how many vouchers from a batch this user has already claimed or reserved.
 * `currentVoucherId` excludes a pending checkout for the same code (resume payment).
 */
export async function countUserBatchVoucherUses(
  userId: string,
  batchId: string,
  currentVoucherId?: string,
): Promise<number> {
  const redemptions = await prisma.voucherRedemption.count({
    where: { userId, voucher: { batchId } },
  });

  const pendingOtherCodes = await prisma.payment.count({
    where: {
      userId,
      status: PaymentStatus.PENDING,
      voucher: { batchId },
      ...(currentVoucherId ? { NOT: { voucherId: currentVoucherId } } : {}),
    },
  });

  return redemptions + pendingOtherCodes;
}

export async function userHasBatchVoucherAllowance(
  userId: string,
  batchId: string,
  currentVoucherId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const used = await countUserBatchVoucherUses(userId, batchId, currentVoucherId);
  if (used >= MAX_VOUCHERS_PER_USER_PER_BATCH) {
    return {
      allowed: false,
      reason: "You have already used a voucher from this batch.",
    };
  }
  return { allowed: true };
}

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

  if (!voucher || !voucher.active) {
    return { valid: false as const, discount: 0, reason: "Voucher is invalid or inactive." };
  }
  if (voucher.expiry < new Date()) {
    return { valid: false as const, discount: 0, reason: "Voucher has expired." };
  }
  if (voucher.usedCount >= voucher.usageLimit) {
    return { valid: false as const, discount: 0, reason: "This voucher is already used." };
  }
  if (voucher.redemptions.length > 0) {
    return { valid: false as const, discount: 0, reason: "You already used this voucher." };
  }

  if (voucher.batchId) {
    const batchCheck = await userHasBatchVoucherAllowance(userId, voucher.batchId, voucher.id);
    if (!batchCheck.allowed) {
      return { valid: false as const, discount: 0, reason: batchCheck.reason ?? "Batch limit reached." };
    }
  }

  const applies =
    voucher.exams.length === 0 || voucher.exams.some((ve) => ve.examId === examId);

  if (!applies) {
    return { valid: false as const, discount: 0, reason: "Voucher is not valid for this exam." };
  }

  const amount = Number(voucher.discountAmount);
  const discount =
    voucher.discountType === "Percentage"
      ? Math.round((subtotal * amount) / 100)
      : Math.min(subtotal, amount);

  return { valid: true as const, discount, voucherId: voucher.id };
}
