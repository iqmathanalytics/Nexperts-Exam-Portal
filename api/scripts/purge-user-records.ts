import "dotenv/config";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npx tsx scripts/purge-user-records.ts <email>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const summary = await prisma.$transaction(async (tx) => {
    const attempts = await tx.examAttempt.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const attemptIds = attempts.map((a) => a.id);

    const payments = await tx.payment.findMany({
      where: { userId: user.id },
      select: { id: true, voucherId: true, status: true },
    });

    const redemptions = await tx.voucherRedemption.findMany({
      where: { userId: user.id },
      select: { voucherId: true },
    });

    const violations = await tx.proctoringViolation.deleteMany({ where: { userId: user.id } });
    const attemptQuestions =
      attemptIds.length > 0
        ? await tx.attemptQuestion.deleteMany({ where: { attemptId: { in: attemptIds } } })
        : { count: 0 };
    const deletedAttempts = await tx.examAttempt.deleteMany({ where: { userId: user.id } });
    const certificates = await tx.certificate.deleteMany({ where: { userId: user.id } });
    const deletedRedemptions = await tx.voucherRedemption.deleteMany({ where: { userId: user.id } });
    const deletedPayments = await tx.payment.deleteMany({ where: { userId: user.id } });
    const otps = await tx.otpCode.deleteMany({ where: { email: user.email } });

    const voucherIds = new Set<string>();
    for (const r of redemptions) voucherIds.add(r.voucherId);
    for (const p of payments) {
      if (p.voucherId && p.status === PaymentStatus.PAID) voucherIds.add(p.voucherId);
    }

    for (const voucherId of voucherIds) {
      await tx.voucher.update({
        where: { id: voucherId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    return {
      userId: user.id,
      email: user.email,
      violations: violations.count,
      attemptQuestions: attemptQuestions.count,
      attempts: deletedAttempts.count,
      certificates: certificates.count,
      redemptions: deletedRedemptions.count,
      payments: deletedPayments.count,
      otps: otps.count,
      vouchersAdjusted: voucherIds.size,
    };
  });

  console.log(JSON.stringify(summary, null, 2));
  console.log("User account preserved.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
