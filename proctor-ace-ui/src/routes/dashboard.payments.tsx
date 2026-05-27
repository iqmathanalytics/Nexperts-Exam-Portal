import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoicePreview, type InvoicePreviewData } from "@/components/invoice-preview";
import { apiAuth, downloadAuthPdf } from "@/lib/api-auth";
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
  const [viewId, setViewId] = useState<string | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreviewData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);

  const viewPayment = payments.find((p) => p.id === viewId) ?? null;

  const openInvoice = async (paymentId: string) => {
    setViewId(paymentId);
    setInvoicePreview(null);
    setInvoiceLoading(true);
    try {
      const d = await apiAuth<{ invoice: InvoicePreviewData }>(`/api/payments/${paymentId}/invoice`);
      setInvoicePreview(d.invoice);
    } catch {
      toast.error("Could not load invoice");
      setViewId(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const closeInvoice = () => {
    setViewId(null);
    setInvoicePreview(null);
  };

  const downloadInvoice = async (paymentId: string, filename: string) => {
    setDownloading(paymentId);
    try {
      await downloadAuthPdf(`/api/payments/${paymentId}/invoice.pdf`, `${filename}.pdf`);
      toast.success("Invoice downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download invoice");
    } finally {
      setDownloading(null);
    }
  };

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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openInvoice(p.id)}>
                          <Receipt className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                        {p.status === "PAID" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloading === p.id}
                            onClick={() => downloadInvoice(p.id, p.invoice)}
                          >
                            {downloading === p.id ? "…" : "PDF"}
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewId} onOpenChange={(o) => !o && closeInvoice()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Invoice {invoicePreview?.invoiceId ?? viewPayment?.invoice ?? ""}
            </DialogTitle>
          </DialogHeader>
          {invoiceLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading invoice…</p>
          ) : invoicePreview ? (
            <div className="space-y-4">
              <InvoicePreview data={invoicePreview} />
              {invoicePreview.status === "PAID" && viewId && (
                <Button
                  className="w-full bg-gradient-emerald text-white"
                  disabled={downloading === viewId}
                  onClick={() => downloadInvoice(viewId, invoicePreview.invoiceId)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading === viewId ? "Downloading…" : "Download PDF invoice"}
                </Button>
              )}
            </div>
          ) : null}
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
