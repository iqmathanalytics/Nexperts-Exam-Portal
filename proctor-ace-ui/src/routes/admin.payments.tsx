import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { ApiError } from "@/lib/api-client";
import { DollarSign, TrendingUp, Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PaymentRow = { id: string; user: string; exam: string; amount: number; voucher?: string; status: string; invoiceId: string; date: string };

export const Route = createFileRoute("/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoice, setInvoice] = useState<PaymentRow | null>(null);

  usePageDataLoad(
    "admin-payments",
    async () => {
      const d = await apiAuth<{ payments: PaymentRow[] }>("/api/admin/payments");
      setPayments(d.payments);
    },
    [],
  );

  const stats = useMemo(() => {
    const paid = payments.filter((p) => p.status === "PAID" || p.status === "Paid");
    const total = paid.reduce((s, p) => s + p.amount, 0);
    const thisMonth = paid.filter((p) => p.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter((p) => p.status === "PENDING" || p.status === "Pending").length;
    return { total, thisMonth, pending };
  }, [payments]);

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.user.toLowerCase().includes(q) ||
      p.examTitle.toLowerCase().includes(q) ||
      p.invoice.toLowerCase().includes(q) ||
      (p.voucher?.toLowerCase().includes(q) ?? false)
    );
  });

  const refund = async (id: string) => {
    if (!confirm("Mark this payment as refunded?")) return;
    try {
      await apiAuth(`/api/admin/payments/${id}/refund`, { method: "PATCH" });
      toast.success("Payment refunded");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Refund failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment management" sub="Stripe transactions, invoices, and refund status." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total revenue" value={`MYR ${stats.total.toLocaleString()}`} icon={DollarSign} accent="gold" />
        <StatCard label="Paid this month" value={`MYR ${stats.thisMonth.toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <StatCard label="Pending" value={String(stats.pending)} icon={Receipt} accent="blue" />
      </div>
      <DataToolbar search={search} onSearch={setSearch} placeholder="Search transactions..." hideInput />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">User</th><th>Exam</th><th>Amount</th><th>Voucher</th><th>Status</th><th>Invoice</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/20">
                <td className="p-4 font-medium">{p.user}</td>
                <td className="p-4">{p.exam}</td>
                <td className="p-4">MYR {p.amount}</td>
                <td className="p-4">{p.voucher ?? "—"}</td>
                <td className="p-4"><StatusBadge status={p.status} /></td>
                <td className="p-4 font-mono text-xs">{p.invoiceId}</td>
                <td className="p-4">{p.date}</td>
                <td className="p-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInvoice(p)}>Invoice</Button>
                  {(p.status === "PAID" || p.status === "Paid") && (
                    <Button variant="ghost" size="sm" onClick={() => refund(p.id)}>Refund</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!invoice} onOpenChange={() => setInvoice(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invoice preview</DialogTitle></DialogHeader>
          {invoice && (
            <div className="space-y-2 rounded-lg bg-gradient-hero p-6 text-white text-sm">
              <div className="font-display text-lg font-bold">NExperts Academy</div>
              <div className="opacity-80">{invoice.invoiceId}</div>
              <hr className="border-white/20" />
              <p>{invoice.user} — {invoice.exam}</p>
              <p className="text-2xl font-bold">MYR {invoice.amount}</p>
              <StatusBadge status={invoice.status} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
