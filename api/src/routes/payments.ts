import { Router } from "express";
import type Stripe from "stripe";
import { z } from "zod";
import { PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateVoucher } from "../services/voucher.js";
import { getStripe } from "../services/stripe.js";
import { fulfillPayment } from "../services/payment-fulfillment.js";
import { env } from "../lib/env.js";
import {
  generateSlotsForDate,
  minBookableDateString,
  validateScheduledSlot,
  formatScheduleForApi,
} from "../services/exam-scheduling.js";

const router = Router();

function invoiceId() {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

router.get("/schedule-slots", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const { examId, date } = z
      .object({ examId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(req.query);

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Exam not found" });
    }

    const slots = generateSlotsForDate(date, exam.duration);
    res.json({
      date,
      minDate: minBookableDateString(),
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
    const result = await validateVoucher(code, examId, subtotal);
    if (!result.valid) return res.json({ valid: false, discount: 0 });
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

    const { examId, voucherCode, scheduledDate, scheduledStartTime } = z
      .object({
        examId: z.string().min(1, "Exam is required"),
        voucherCode: z.string().optional(),
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
      const v = await validateVoucher(voucherCode, examId, subtotal);
      if (!v.valid) return res.status(400).json({ error: "Invalid voucher" });
      subtotal -= v.discount;
      voucherId = v.voucherId;
    }

    const [hh, mm] = scheduledStartTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      return res.status(400).json({ error: "Invalid time slot" });
    }
    const scheduledStartTimeNorm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    let schedule: { startAt: Date; endAt: Date };
    try {
      schedule = validateScheduledSlot(scheduledDate, scheduledStartTimeNorm, exam.duration);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid schedule" });
    }

    const amount = Math.max(0, subtotal);
    const inv = invoiceId();

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
    });

    if (amount === 0) {
      await fulfillPayment(payment.id);
      return res.json({
        mode: "free",
        paymentId: payment.id,
        redirectUrl: `${env.stripeSuccessUrl}?${successParams.toString()}&payment_id=${payment.id}`,
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      await fulfillPayment(payment.id);
      return res.json({
        mode: "mock",
        paymentId: payment.id,
        redirectUrl: `${env.stripeSuccessUrl}?${successParams.toString()}&payment_id=${payment.id}`,
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
        success_url: `${env.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}&${successParams.toString()}`,
        cancel_url: `${env.stripeCancelUrl}?canceled=1`,
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

router.post("/:id/resume", requireAuth(Role.CANDIDATE), async (req: AuthedRequest, res) => {
  try {
    const paymentId = String(req.params.id);
    const userId = req.user!.sub;
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId, status: PaymentStatus.PENDING },
      include: { exam: true, user: { select: { email: true } } },
    });
    if (!payment) return res.status(404).json({ error: "Pending payment not found" });

    const stripe = getStripe();
    if (stripe && payment.stripeSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      if (existing.status === "open" && existing.url) {
        return res.json({ mode: "stripe", url: existing.url });
      }
    }

    const amount = Number(payment.amount);
    if (amount === 0) {
      await fulfillPayment(payment.id);
      const successParams = new URLSearchParams({
        exam: payment.exam.title,
        amount: "0",
        invoice: payment.invoiceId,
      });
      return res.json({
        mode: "free",
        url: `${env.stripeSuccessUrl}?${successParams.toString()}&payment_id=${payment.id}`,
      });
    }

    if (!stripe) {
      await fulfillPayment(payment.id);
      const successParams = new URLSearchParams({
        exam: payment.exam.title,
        amount: String(amount),
        invoice: payment.invoiceId,
      });
      return res.json({
        mode: "mock",
        url: `${env.stripeSuccessUrl}?${successParams.toString()}&payment_id=${payment.id}`,
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
      success_url: `${env.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}&exam=${encodeURIComponent(payment.exam.title)}&amount=${amount}&invoice=${payment.invoiceId}`,
      cancel_url: `${env.stripeCancelUrl}?canceled=1`,
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

router.get("/session/:sessionId", async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const stripe = getStripe();

    if (!stripe) {
      return res.json({ paid: true });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid" && session.metadata?.paymentId) {
      await fulfillPayment(session.metadata.paymentId);
    }

    res.json({
      paid: session.payment_status === "paid",
      examTitle: session.metadata?.examId
        ? (
            await prisma.exam.findUnique({
              where: { id: session.metadata.examId },
              select: { title: true },
            })
          )?.title
        : undefined,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      invoiceId: session.metadata?.invoiceId,
    });
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
