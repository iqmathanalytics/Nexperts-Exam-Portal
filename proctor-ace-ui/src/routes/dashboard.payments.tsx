import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Receipt, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";
import { usePageDataLoad } from "@/contexts/page-load-context";

export const Route = createFileRoute("/dashboard/payments")({
  component: Payments,
});

type PaymentRow = {
  id: string;
  examId: string;
  examTitle: string;
  amount: number;
  date: string;
  invoice: string;
  status: string;
  method: string;
  voucher?: string;
};

function Payments() {
  const [view, setView] = useState<PaymentRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [resuming, setResuming] = useState<string | null>(null);

  usePageDataLoad(
    "payments",
    async () => {
      const d = await apiAuth<{ payments: PaymentRow[] }>("/api/payments/my");
      setPayments(d.payments);
    },
    [],
  );

  const resumePayment = async (paymentId: string) => {
    setResuming(paymentId);
    try {
      const res = await apiAuth<{ url?: string; redirectUrl?: string }>(`/api/payments/${paymentId}/resume`, {
        method: "POST",
      });
      const url = res.url ?? res.redirectUrl;
      if (url) window.location.href = url;
      else toast.error("No checkout URL returned");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not resume payment");
    } finally {
      setResuming(null);
    }
  };

  const paid = payments.filter((p) => p.status === "PAID");
  const totalSpent = paid.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments & Invoices" sub="Stripe transactions and invoice records." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Summary k="Total spent" v={`MYR ${totalSpent}`} l={`${paid.length} paid`} />
        <Summary k="Payment method" v="Stripe" l="Secure checkout" />
        <Summary k="Transactions" v={String(payments.length)} l="All statuses" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No payments yet
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.invoice}</TableCell>
                  <TableCell className="font-medium">{p.examTitle}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="text-muted-foreground">{p.method}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.status === "PAID"
                          ? "border-0 bg-success/15 text-success"
                          : p.status === "PENDING"
                            ? "border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "border-0 bg-muted text-muted-foreground"
                      }
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">MYR {p.amount}</TableCell>
                  <TableCell className="text-right">
                    {p.status === "PENDING" ? (
                      <Button
                        size="sm"
                        className="bg-gradient-emerald text-white"
                        disabled={resuming === p.id}
                        onClick={() => resumePayment(p.id)}
                      >
                        {resuming === p.id ? "Opening…" : "Resume payment"}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setView(p)}>
                        <Receipt className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice {view?.invoice}</DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-hero p-5 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/60">NExperts Academy</span>
                  <CreditCard className="h-4 w-4 text-accent" />
                </div>
                <div className="mt-6 font-mono text-lg tracking-widest">{view.invoice}</div>
                <div className="mt-1 text-xs text-white/60">Paid on {view.date}</div>
              </div>

              <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
                <Row k="Item" v={view.examTitle} />
                <Row k="Method" v={view.method} />
                <Row k="Status" v={view.status} />
                {view.voucher && <Row k="Voucher" v={view.voucher} />}
                <div className="my-1 h-px bg-border" />
                <Row k="Total" v={`MYR ${view.amount}`} bold />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ k, v, l }: { k: string; v: string; l: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-2 font-display text-2xl font-bold">{v}</div>
      <div className="text-xs text-muted-foreground">{l}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-display text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
