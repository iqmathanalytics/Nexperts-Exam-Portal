import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad, useInvalidateSession } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { ApiError } from "@/lib/api-client";
import { DollarSign, TrendingUp, Receipt, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatCard, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type PaymentRow = { id: string; user: string; exam: string; amount: number; voucher?: string; status: string; invoiceId: string; date: string; deadline?: string | null };

export const Route = createFileRoute("/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const invalidateSession = useInvalidateSession();
  const { data: payments = [] } = usePageDataLoad(
    "admin-payments",
    async () => {
      const d = await apiAuth<{ payments: PaymentRow[] }>("/api/admin/payments");
      return d.payments;
    },
    [],
  );
  const [invoice, setInvoice] = useState<PaymentRow | null>(null);
  const [deadlineTarget, setDeadlineTarget] = useState<PaymentRow | null>(null);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [settingDeadline, setSettingDeadline] = useState(false);

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
      p.exam.toLowerCase().includes(q) ||
      p.invoiceId.toLowerCase().includes(q) ||
      (p.voucher?.toLowerCase().includes(q) ?? false)
    );
  });

  const openDeadlineDialog = (p: PaymentRow) => {
    setDeadlineTarget(p);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setDeadlineDate(p.deadline ? p.deadline.slice(0, 10) : tomorrow.toISOString().slice(0, 10));
  };

  const saveDeadline = async () => {
    if (!deadlineTarget || !deadlineDate) return;
    setSettingDeadline(true);
    try {
      await apiAuth(`/api/admin/payments/${deadlineTarget.id}/deadline`, {
        method: "PATCH",
        body: JSON.stringify({ deadline: deadlineDate }),
      });
      toast.success(`Payment deadline set to ${deadlineDate} — student will be removed if unpaid.`);
      setDeadlineTarget(null);
      invalidateSession("admin-payments");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to set deadline");
    } finally {
      setSettingDeadline(false);
    }
  };

  const refund = async (id: string) => {
    if (!confirm("Mark this payment as refunded?")) return;
    try {
      await apiAuth(`/api/admin/payments/${id}/refund`, { method: "PATCH" });
      toast.success("Payment refunded");
      invalidateSession("admin-payments");
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
      <div className="table-panel overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">User</th><th>Exam</th><th>Amount</th><th>Voucher</th><th>Status</th><th>Invoice</th><th>Date</th><th>Deadline</th><th></th>
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
                <td className="p-4 text-xs">
                  {p.deadline
                    ? <span className="font-medium text-destructive">{p.deadline.slice(0, 10)}</span>
                    : (p.status === "PENDING" || p.status === "Pending")
                      ? <span className="text-muted-foreground">—</span>
                      : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInvoice(p)}>Invoice</Button>
                  {(p.status === "PENDING" || p.status === "Pending") && (
                    <Button
                      variant="outline"
                      size="sm"
                      title="Set payment deadline"
                      onClick={() => openDeadlineDialog(p)}
                    >
                      <CalendarClock className="mr-1 h-3 w-3" />Deadline
                    </Button>
                  )}
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

      <Dialog open={!!deadlineTarget} onOpenChange={(open) => { if (!open) setDeadlineTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set payment deadline</DialogTitle>
          </DialogHeader>
          {deadlineTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="text-xs text-muted-foreground">Candidate</div>
                <div className="font-medium">{deadlineTarget.user}</div>
                <div className="text-xs text-muted-foreground">{deadlineTarget.exam}</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Pay by date</Label>
                <Input
                  type="date"
                  value={deadlineDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If unpaid by this date the student will be automatically removed from the exam.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeadlineTarget(null)}>Cancel</Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={settingDeadline || !deadlineDate}
              onClick={saveDeadline}
            >
              {settingDeadline ? "Saving…" : "Set deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
