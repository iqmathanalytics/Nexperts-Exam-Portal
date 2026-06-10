import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateVoucher } from "../services/voucher.js";
import { getStripe } from "../services/stripe.js";
import { fulfillPayment, getInvoicePdfBuffer } from "../services/payment-fulfillment.js";
import { cancelPendingPayment } from "../services/pending-payments.js";
import { getInvoiceDetails } from "../services/invoice-details.js";
import { sendPdfDownload, sendPdfJson } from "../services/pdf-buffer.js";
import { env } from "../lib/env.js";
import {
  buildPaymentCancelUrl,
  buildPaymentSuccessUrl,
  buildStripeSuccessUrl,
  resolveClientOrigin,
} from "../lib/client-origin.js";
import { isRealStripeSessionId, resolveStripeSessionId } from "../lib/stripe-session.js";
import {
  addKlDays,
  generateSlotsForDate,
  firstDateWithSlots,
  minBookableDateString,
  maxBookableDateString,
  validateScheduledSlot,
  formatScheduleForApi,
  attendByFromPurchase,
  getSchedulePhase,
} from "../services/exam-scheduling.js";

const router = Router();

function invoiceId() {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

router.get("/schedule-slots", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { examId, date: dateParam } = z
      .object({
        examId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(req.query);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Exam not found" });
    }

    const today = minBookableDateString();
    const requestedDate = dateParam ?? today;

    let date = requestedDate;
    let slots = generateSlotsForDate(date, exam.duration);
    let autoAdvanced = false;

    if (!dateParam) {
      const first = firstDateWithSlots(exam.duration, today);
      date = first.date;
      slots = first.slots;
      autoAdvanced = date !== today;
    }

    const nextDateWithSlots =
      slots.length === 0 && dateParam
        ? firstDateWithSlots(exam.duration, addKlDays(requestedDate, 1)).date
        : undefined;

    res.json({
      date,
      requestedDate,
      autoAdvanced,
      nextDateWithSlots,
      minDate: today,
      maxDate: maxBookableDateString(),
      duration: exam.duration,
      timezone: "Asia/Kuala_Lumpur",
      slots,
    });
  } catch {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/validate-voucher", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { code, examId } = z.object({ code: z.string(), examId: z.string() }).parse(req.body);
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    const subtotal = Number(exam.price);
    const result = await validateVoucher(code, examId, subtotal, req.user!.sub);
    if (!result.valid) {
      return res.json({ valid: false, discount: 0, message: result.reason ?? "Invalid voucher" });
    }
    res.json({ valid: true, discount: result.discount, total: subtotal - result.discount });
  } catch {
    res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/checkout", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Invalid checkout request",
        detail: "Request body must be JSON with examId, scheduledDate, and scheduledStartTime",
      });
    }

    const { examId, voucherCode, scheduledDate, scheduledStartTime, returnOrigin } = z
      .object({
        examId: z.string().min(1, "Exam is required"),
        voucherCode: z.string().optional(),
        returnOrigin: z.string().url().optional(),
        scheduledDate: z
          .string({ required_error: "Exam date is required" })
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use date format YYYY-MM-DD"),
        scheduledStartTime: z
          .string({ required_error: "Start time is required" })
          .regex(/^\d{1,2}:\d{2}$/, "Use time format HH:mm"),
      })
      .parse(req.body);

    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Exam not available" });
    }

    const alreadyOwned = await prisma.payment.findFirst({
      where: { userId, examId, status: PaymentStatus.PAID },
    });
    if (alreadyOwned) {
      return res.status(409).json({ error: "You already purchased this exam" });
    }

    let subtotal = Number(exam.price);
    let voucherId: string | undefined;
    if (voucherCode) {
      const v = await validateVoucher(voucherCode, examId, subtotal, userId);
      if (!v.valid) return res.status(400).json({ error: v.reason ?? "Invalid voucher" });
      subtotal -= v.discount;
      voucherId = v.voucherId;
    }

    let schedule: { startAt: Date; endAt: Date };
    const [hh, mm] = scheduledStartTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      return res.status(400).json({ error: "Invalid time slot" });
    }
    const scheduledStartTimeNorm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    try {
      schedule = validateScheduledSlot(scheduledDate, scheduledStartTimeNorm, exam.duration);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid schedule" });
    }

    const amount = Math.max(0, subtotal);
    const inv = invoiceId();
    const clientOrigin = resolveClientOrigin(req, returnOrigin);

    const existingPending = await prisma.payment.findFirst({
      where: { userId, examId, status: PaymentStatus.PENDING },
    });
    if (existingPending) {
      await cancelPendingPayment(existingPending.id, existingPending.stripeSessionId);
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        examId,
        amount,
        voucherId,
        status: PaymentStatus.PENDING,
        invoiceId: inv,
        scheduledStartAt: schedule.startAt,
        scheduledEndAt: schedule.endAt,
      },
    });

    const successParams = new URLSearchParams({
      exam: exam.title,
      amount: String(amount),
      invoice: inv,
      payment_id: payment.id,
    });

    if (amount === 0) {
      await fulfillPayment(payment.id);
      return res.json({
        mode: "free",
        paymentId: payment.id,
        redirectUrl: buildPaymentSuccessUrl(clientOrigin, {
          ...Object.fromEntries(successParams),
          payment_id: payment.id,
        }),
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      await fulfillPayment(payment.id);
      return res.json({
        mode: "mock",
        paymentId: payment.id,
        redirectUrl: buildPaymentSuccessUrl(clientOrigin, {
          ...Object.fromEntries(successParams),
          payment_id: payment.id,
        }),
      });
    }

    const unitAmount = Math.round(amount * 100);
    if (unitAmount < 200) {
      return res.status(400).json({
        error: "Payment amount is below the minimum charge (MYR 2.00)",
      });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "myr",
              product_data: {
                name: exam.title.slice(0, 120),
                description: (exam.description ?? "").slice(0, 200) || undefined,
                metadata: { examId },
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        success_url: buildStripeSuccessUrl(clientOrigin, Object.fromEntries(successParams)),
        cancel_url: buildPaymentCancelUrl(clientOrigin),
        metadata: {
          paymentId: payment.id,
          userId,
          examId,
          invoiceId: inv,
        },
      });
    } catch (stripeErr) {
      console.error("Stripe checkout session error:", stripeErr);
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      const detail =
        stripeErr instanceof Error ? stripeErr.message : "Stripe session could not be created";
      return res.status(502).json({
        error: "Payment provider error",
        ...(env.nodeEnv !== "production" ? { detail } : {}),
      });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    if (!session.url) {
      return res.status(500).json({ error: "Stripe session URL missing" });
    }

    res.json({ mode: "stripe", url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Checkout error:", e);
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid checkout request", details: e.flatten() });
    }
    const detail = e instanceof Error ? e.message : "Checkout failed";
    res.status(500).json({
      error: "Checkout failed",
      ...(env.nodeEnv !== "production" ? { detail } : {}),
    });
  }
});

router.post("/abandon-checkout", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const pending = await prisma.payment.findFirst({
      where: { userId, status: PaymentStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) return res.json({ ok: true });

    const stripe = getStripe();
    if (stripe && pending.stripeSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(pending.stripeSessionId);
        if (existing.status === "open") {
          await stripe.checkout.sessions.expire(pending.stripeSessionId);
        }
      } catch (e) {
        console.warn("Stripe session expire failed:", e);
      }
    }

    await prisma.payment.delete({ where: { id: pending.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("Abandon checkout error:", e);
    res.status(500).json({ error: "Could not abandon checkout" });
  }
});

router.post("/:id/resume", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const paymentId = String(req.params.id);
    const userId = req.user!.sub;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PENDING },
      include: { exam: true, user: { select: { email: true } } },
    });
    if (!payment) return res.status(404).json({ error: "Pending payment not found" });

    const clientOrigin = resolveClientOrigin(req);
    const stripe = getStripe();
    if (stripe && payment.stripeSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      const cancelOk = existing.cancel_url === buildPaymentCancelUrl(clientOrigin);
      if (existing.status === "open" && existing.url && cancelOk) {
        return res.json({ mode: "stripe", url: existing.url });
      }
      if (existing.status === "open") {
        await stripe.checkout.sessions.expire(payment.stripeSessionId).catch(() => {});
      }
    }

    const amount = Number(payment.amount);
    if (amount === 0) {
      await fulfillPayment(payment.id);
      return res.json({
        mode: "free",
        url: buildPaymentSuccessUrl(clientOrigin, {
          exam: payment.exam.title,
          amount: "0",
          invoice: payment.invoiceId,
          payment_id: payment.id,
        }),
      });
    }

    if (!stripe) {
      await fulfillPayment(payment.id);
      const successParams = {
        exam: payment.exam.title,
        amount: String(amount),
        invoice: payment.invoiceId,
        payment_id: payment.id,
      };
      return res.json({
        mode: "mock",
        url: buildPaymentSuccessUrl(clientOrigin, successParams),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: payment.user.email,
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: {
              name: payment.exam.title,
              description: payment.exam.description.slice(0, 200),
              metadata: { examId: payment.examId },
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: buildStripeSuccessUrl(clientOrigin, {
        exam: payment.exam.title,
        amount: String(amount),
        invoice: payment.invoiceId,
        payment_id: payment.id,
      }),
      cancel_url: buildPaymentCancelUrl(clientOrigin),
      metadata: {
        paymentId: payment.id,
        userId,
        examId: payment.examId,
        invoiceId: payment.invoiceId,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    if (!session.url) return res.status(500).json({ error: "Stripe session URL missing" });
    res.json({ mode: "stripe", url: session.url });
  } catch (e) {
    console.error("Resume payment error:", e);
    res.status(500).json({ error: "Could not resume payment" });
  }
});

router.post("/:id/cancel", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const paymentId = String(req.params.id);
    const userId = req.user!.sub;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PENDING },
    });
    if (!payment) return res.status(404).json({ error: "Pending payment not found" });

    const stripe = getStripe();
    if (stripe && payment.stripeSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
        if (existing.status === "open") {
          await stripe.checkout.sessions.expire(payment.stripeSessionId);
        }
      } catch (e) {
        console.warn("Stripe session expire failed:", e);
      }
    }

    await prisma.payment.delete({ where: { id: payment.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("Cancel payment error:", e);
    res.status(500).json({ error: "Could not cancel payment" });
  }
});

router.post("/start-immediately", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { paymentId } = z.object({ paymentId: z.string() }).parse(req.body);
    const userId = req.user!.sub;

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PAID },
      include: { exam: true },
    });
    if (!payment) return res.status(404).json({ error: "Paid exam booking not found" });

    const inProgress = await prisma.examAttempt.findFirst({
      where: { userId, examId: payment.examId, result: "IN_PROGRESS" },
    });
    if (inProgress) {
      return res.status(409).json({ error: "Finish or cancel your in-progress attempt first" });
    }

    const used = await prisma.examAttempt.count({
      where: { userId, examId: payment.examId, result: { not: "IN_PROGRESS" } },
    });
    if (used >= payment.exam.maxAttempts) {
      return res.status(403).json({ error: "No attempts remaining" });
    }

    const attendBy = payment.attendByAt ?? attendByFromPurchase(payment.createdAt);
    if (new Date() > attendBy) {
      return res.status(403).json({ error: "Your one-year booking window has expired" });
    }

    const phase = getSchedulePhase(payment.scheduledStartAt, payment.scheduledEndAt, {
      hasInProgress: false,
      attemptsExhausted: used >= payment.exam.maxAttempts,
      attendByAt: attendBy,
    });

    if (phase === "ready" && used === 0) {
      return res.status(409).json({ error: "Your exam is already open — use Start Exam" });
    }
    if (phase === "booking_expired") {
      return res.status(403).json({ error: "Your one-year booking window has expired" });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + payment.exam.duration * 60 * 1000);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { scheduledStartAt: startAt, scheduledEndAt: endAt },
    });

    res.json({
      ok: true,
      schedulePhase: "ready",
      ...formatScheduleForApi(updated.scheduledStartAt!, updated.scheduledEndAt!),
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    return res.status(400).json({ error: e instanceof Error ? e.message : "Could not start immediately" });
  }
});

router.post("/reschedule", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { paymentId, scheduledDate, scheduledStartTime } = z
      .object({
        paymentId: z.string(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scheduledStartTime: z.string().regex(/^\d{1,2}:\d{2}$/),
      })
      .parse(req.body);

    const userId = req.user!.sub;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PAID },
      include: { exam: true },
    });
    if (!payment) return res.status(404).json({ error: "Paid exam booking not found" });

    const inProgress = await prisma.examAttempt.findFirst({
      where: { userId, examId: payment.examId, result: "IN_PROGRESS" },
    });
    if (inProgress) {
      return res.status(409).json({ error: "Finish or cancel your in-progress attempt before rescheduling" });
    }

    const attendBy = payment.attendByAt ?? attendByFromPurchase(payment.createdAt);
    if (new Date() > attendBy) {
      return res.status(403).json({ error: "Your one-year booking window has expired" });
    }

    const [hh, mm] = scheduledStartTime.split(":").map(Number);
    const timeNorm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const schedule = validateScheduledSlot(scheduledDate, timeNorm, payment.exam.duration);
    if (schedule.startAt > attendBy) {
      return res.status(400).json({ error: "New slot must be within your one-year booking window" });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        scheduledStartAt: schedule.startAt,
        scheduledEndAt: schedule.endAt,
        rescheduleCount: { increment: 1 },
      },
    });

    res.json({
      ok: true,
      rescheduleCount: updated.rescheduleCount,
      ...formatScheduleForApi(updated.scheduledStartAt!, updated.scheduledEndAt!),
      attendByAt: attendBy.toISOString(),
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    return res.status(400).json({ error: e instanceof Error ? e.message : "Reschedule failed" });
  }
});

async function invoicePdfHandler(req: AuthedRequest, res: import("express").Response) {
  try {
    const result = await getInvoicePdfBuffer(String(req.params.id), req.user!.sub);
    if (!result) return res.status(404).json({ error: "Invoice not found" });
    sendPdfDownload(res, result.pdf, `${result.invoiceId}.pdf`);
  } catch (e) {
    console.error("Invoice PDF error:", e);
    res.status(500).json({ error: "Could not generate invoice" });
  }
}

async function invoiceDownloadJson(req: AuthedRequest, res: import("express").Response) {
  try {
    const result = await getInvoicePdfBuffer(String(req.params.id), req.user!.sub);
    if (!result) return res.status(404).json({ error: "Invoice not found" });
    sendPdfJson(res, result.pdf, `${result.invoiceId}.pdf`);
  } catch (e) {
    console.error("Invoice PDF error:", e);
    res.status(500).json({ error: "Could not generate invoice" });
  }
}

router.get("/:id/invoice", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const details = await getInvoiceDetails(String(req.params.id), req.user!.sub);
    if (!details) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice: details });
  } catch (e) {
    console.error("Invoice details error:", e);
    res.status(500).json({ error: "Could not load invoice" });
  }
});

router.post("/:id/invoice-download", requireAuth(Role.CANDIDATE), invoiceDownloadJson);
router.get("/:id/invoice.pdf", requireAuth(Role.CANDIDATE), invoicePdfHandler);
router.post("/:id/invoice.pdf", requireAuth(Role.CANDIDATE), invoicePdfHandler);

router.get("/my", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user!.sub },
    include: { exam: true, voucher: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    payments: payments.map((p) => ({
      id: p.id,
      examId: p.examId,
      examTitle: p.exam.title,
      amount: Number(p.amount),
      date: p.createdAt.toISOString().slice(0, 10),
      invoice: p.invoiceId,
      status: p.status,
      method: p.stripeSessionId ? "Stripe" : "Card",
      voucher: p.voucher?.code,
      ...(p.scheduledStartAt && p.scheduledEndAt
        ? formatScheduleForApi(p.scheduledStartAt, p.scheduledEndAt)
        : {}),
    })),
  });
});

type ConfirmPayload = {
  paid: boolean;
  examTitle?: string;
  amount?: number;
  invoiceId?: string;
  paymentId?: string;
};

function isStripeCheckoutPaid(session: Stripe.Checkout.Session): boolean {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    (session.status === "complete" && session.payment_status !== "unpaid")
  );
}

function toConfirmPayload(
  payment: { id: string; amount: unknown; invoiceId: string; status: PaymentStatus; exam: { title: string } },
  paid = payment.status === PaymentStatus.PAID,
): ConfirmPayload {
  return {
    paid,
    examTitle: payment.exam.title,
    amount: Number(payment.amount),
    invoiceId: payment.invoiceId,
    paymentId: payment.id,
  };
}

async function paymentConfirmPayload(paymentId: string): Promise<ConfirmPayload | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { exam: true },
  });
  if (!payment) return null;
  return toConfirmPayload(payment);
}

async function retrieveStripeCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  if (!stripe || !isRealStripeSessionId(sessionId)) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.warn("Stripe session retrieve failed:", sessionId, e instanceof Error ? e.message : e);
    return null;
  }
}

async function tryFulfillFromStripeSession(
  payment: { id: string; stripeSessionId: string | null },
  clientSessionId?: string,
): Promise<boolean> {
  const sessionId = resolveStripeSessionId(clientSessionId, payment.stripeSessionId);
  if (!sessionId) return false;

  const session = await retrieveStripeCheckoutSession(sessionId);
  if (!session || !isStripeCheckoutPaid(session)) return false;

  await fulfillPayment(payment.id);
  return true;
}

async function confirmPaymentForUser(
  userId: string,
  opts: { paymentId?: string; sessionId?: string },
): Promise<ConfirmPayload | { error: string; status: number }> {
  const { paymentId, sessionId } = opts;

  if (paymentId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: { exam: true },
    });
    if (!payment) return { error: "Payment not found", status: 404 };
    if (payment.status === PaymentStatus.PAID) return toConfirmPayload(payment, true);

    if (await tryFulfillFromStripeSession(payment, sessionId)) {
      const refreshed = await paymentConfirmPayload(payment.id);
      return refreshed ?? toConfirmPayload(payment, true);
    }

    return toConfirmPayload(payment, false);
  }

  const resolvedSessionId = resolveStripeSessionId(sessionId, undefined);
  if (!resolvedSessionId) {
    return { error: "sessionId or paymentId required", status: 400 };
  }

  const result = await confirmStripeSession(resolvedSessionId);
  if (!result.paid || !result.paymentId) return result;

  const payment = await prisma.payment.findFirst({
    where: { id: result.paymentId, userId },
    include: { exam: true },
  });
  if (!payment) return { error: "Payment does not belong to this account", status: 403 };

  return toConfirmPayload(payment, true);
}

router.post("/confirm-return", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { sessionId, paymentId } = z
      .object({
        sessionId: z.string().optional(),
        paymentId: z.string().optional(),
      })
      .parse(req.body);

    if (!paymentId && !isRealStripeSessionId(sessionId)) {
      return res.status(400).json({ error: "sessionId or paymentId required" });
    }

    const result = await confirmPaymentForUser(req.user!.sub, { paymentId, sessionId });
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error("Confirm return error:", e);
    return res.status(500).json({ error: "Could not confirm payment" });
  }
});

async function confirmStripeSession(sessionId: string): Promise<ConfirmPayload> {
  if (!isRealStripeSessionId(sessionId)) {
    return { paid: false };
  }

  const existing = await prisma.payment.findFirst({
    where: { stripeSessionId: sessionId },
    include: { exam: true },
  });
  if (existing?.status === PaymentStatus.PAID) {
    return toConfirmPayload(existing, true);
  }

  const stripe = getStripe();
  if (!stripe) {
    if (existing) {
      await fulfillPayment(existing.id);
      const payload = await paymentConfirmPayload(existing.id);
      return payload ?? { paid: true, paymentId: existing.id };
    }
    return { paid: true };
  }

  const session = await retrieveStripeCheckoutSession(sessionId);
  if (!session) {
    return existing ? toConfirmPayload(existing, false) : { paid: false };
  }

  const paid = isStripeCheckoutPaid(session);
  const paymentId = session.metadata?.paymentId ?? existing?.id;

  if (paid && paymentId) {
    await fulfillPayment(paymentId);
  }

  const refreshed = paymentId ? await paymentConfirmPayload(paymentId) : null;
  if (refreshed?.paid) {
    return refreshed;
  }

  return {
    paid,
    examTitle: refreshed?.examTitle ?? existing?.exam.title,
    amount: refreshed?.amount ?? (session.amount_total ? session.amount_total / 100 : Number(existing?.amount ?? 0)),
    invoiceId: refreshed?.invoiceId ?? session.metadata?.invoiceId ?? existing?.invoiceId,
    paymentId,
  };
}

router.get("/session/:sessionId", async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const result = await confirmStripeSession(sessionId);
    if (!result.paid && !("examTitle" in result && result.examTitle)) {
      return res.json({ paid: false });
    }
    res.json(result);
  } catch (e) {
    console.error("Session confirm error:", e);
    res.status(400).json({ error: "Could not verify payment session" });
  }
});

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    throw new Error("Stripe webhook not configured");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.paymentId) {
      await fulfillPayment(session.metadata.paymentId);
    }
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.paymentId) {
      await fulfillPayment(session.metadata.paymentId);
    }
  }
}

export default router;
