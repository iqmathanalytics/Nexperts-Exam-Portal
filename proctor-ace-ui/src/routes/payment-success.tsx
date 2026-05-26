import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight, Receipt, Loader2, XCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { apiBase } from "@/lib/api-client";

export const Route = createFileRoute("/payment-success")({
  beforeLoad: () => requireAuth("candidate"),
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

function PaymentSuccess() {
  const search = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "ok" | "fail">(
    search.session_id ? "loading" : "ok",
  );
  const [details, setDetails] = useState({
    exam: search.exam,
    amount: search.amount,
    invoice: search.invoice,
  });

  useEffect(() => {
    if (search.session_id) {
      fetch(`${apiBase}/api/payments/session/${search.session_id}`)
        .then((r) => r.json())
        .then((d: { paid?: boolean; examTitle?: string; amount?: number; invoiceId?: string }) => {
          if (d.paid) {
            setStatus("ok");
            setDetails({
              exam: d.examTitle ?? search.exam,
              amount: d.amount ?? search.amount,
              invoice: d.invoiceId ?? search.invoice,
            });
          } else {
            setStatus("fail");
          }
        })
        .catch(() => setStatus("fail"));
    }
  }, [search.session_id, search.exam, search.amount, search.invoice]);

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
        <p className="mt-2 text-sm text-muted-foreground">Contact support if you were charged.</p>
        <Button asChild className="mt-6"><Link to="/dashboard/payments">View payments</Link></Button>
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
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="bg-gradient-emerald text-white">
            <Link to="/dashboard/my-exams">View my exams <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/payments"><Receipt className="mr-2 h-4 w-4" />Payment history</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
