import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight, Receipt, Loader2, XCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { api, apiBase } from "@/lib/api-client";
import { getToken, isClientAuthenticated } from "@/lib/auth";
import { isRealStripeSessionId } from "@/lib/stripe-session";
import { useInvalidateSession } from "@/contexts/page-load-context";

type ConfirmResult = {
  paid?: boolean;
  examTitle?: string;
  amount?: number;
  invoiceId?: string;
};

export const Route = createFileRoute("/payment-success")({
  validateSearch: (s: Record<string, unknown>) => ({
    exam: (s.exam as string) ?? "Certification exam",
    amount: Number(s.amount) || 0,
    session_id: (s.session_id as string) ?? "",
    payment_id: (s.payment_id as string) ?? "",
    invoice: (s.invoice as string) ?? "",
  }),
  component: PaymentSuccess,
  head: () => ({ meta: [{ title: "Payment successful — Certification Portal" }] }),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function PaymentSuccess() {
  const navigate = useNavigate();
  const invalidateSession = useInvalidateSession();
  const search = Route.useSearch();
  const stripeSessionId = isRealStripeSessionId(search.session_id) ? search.session_id : "";
  const needsConfirm = Boolean(stripeSessionId || search.payment_id);
  const [status, setStatus] = useState<"loading" | "ok" | "fail">(needsConfirm ? "loading" : "ok");
  const [details, setDetails] = useState({
    exam: search.exam,
    amount: search.amount,
    invoice: search.invoice,
  });

  useEffect(() => {
    if (!needsConfirm) return;

    let cancelled = false;

    async function confirmOnce(): Promise<ConfirmResult | null> {
      const token = getToken();
      if (token && (stripeSessionId || search.payment_id)) {
        try {
          return await api<ConfirmResult>("/api/payments/confirm-return", {
            method: "POST",
            token,
            body: JSON.stringify({
              sessionId: stripeSessionId || undefined,
              paymentId: search.payment_id || undefined,
            }),
          });
        } catch {
          /* fall through to public session check */
        }
      }

      if (stripeSessionId) {
        try {
          const res = await fetch(
            `${apiBase}/api/payments/session/${encodeURIComponent(stripeSessionId)}`,
          );
          if (res.ok) return (await res.json()) as ConfirmResult;
        } catch {
          return null;
        }
      }

      return null;
    }

    async function run() {
      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) return;
        const d = await confirmOnce();
        if (d?.paid) {
          setStatus("ok");
          setDetails({
            exam: d.examTitle ?? search.exam,
            amount: d.amount ?? search.amount,
            invoice: d.invoiceId ?? search.invoice,
          });
          invalidateSession("my-exams");
          invalidateSession("payments");
          invalidateSession("available-exams");
          invalidateSession("dashboard-home");
          return;
        }
        if (attempt < 9) await sleep(2000);
      }
      if (!cancelled) setStatus("fail");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    needsConfirm,
    stripeSessionId,
    search.payment_id,
    search.exam,
    search.amount,
    search.invoice,
    invalidateSession,
  ]);

  const goToMyExams = () => {
    if (!isClientAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/dashboard/my-exams" });
  };

  const goToPayments = () => {
    if (!isClientAuthenticated()) {
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/dashboard/payments" });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="text-muted-foreground">Confirming your Stripe payment…</p>
      </div>
    );
  }

  if (status === "fail") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-display text-xl font-bold">Payment not confirmed</h1>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          If you completed checkout, wait a moment and refresh. Your payment may still be processing.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="outline" onClick={goToPayments}>View payments</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <BrandLogo to="/" className="mb-10" imgClassName="h-11" />
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-elevated">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">Payment successful</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your purchase of <strong>{details.exam}</strong> is confirmed.
        </p>
        <p className="mt-4 font-display text-3xl font-bold text-accent">MYR {details.amount}</p>
        {details.invoice && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Invoice {details.invoice}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Paid via Stripe</p>
        <p className="mt-3 text-xs text-muted-foreground">
          A PDF invoice has been sent to your email. You can also download it from Payments &amp; Invoices.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="bg-gradient-emerald text-white" onClick={goToMyExams}>
            View my exams <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToPayments}>
            <Receipt className="mr-2 h-4 w-4" />
            Payment history
          </Button>
        </div>
      </div>
    </div>
  );
}
