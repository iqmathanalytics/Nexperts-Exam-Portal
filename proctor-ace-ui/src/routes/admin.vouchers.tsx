import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiAuth, downloadAuthCsv } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";

type BatchRow = {
  id: string;
  label: string;
  discountType: string;
  discountAmount: number;
  expiry: string;
  active: boolean;
  quantity: number;
  usedCount: number;
  availableCount: number;
  createdAt: string;
};

type BatchDetail = {
  id: string;
  label: string | null;
  discountType: string;
  discountAmount: number;
  expiry: string;
  active: boolean;
  quantity: number;
  vouchers: { id: string; code: string; used: boolean; active: boolean; redeemedAt: string | null }[];
};

type BatchForm = {
  label: string;
  quantity: number;
  discountType: string;
  discountAmount: number;
  expiry: string;
  active: boolean;
};

const emptyForm = (): BatchForm => ({
  label: "",
  quantity: 10,
  discountType: "Percentage",
  discountAmount: 25,
  expiry: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  active: true,
});

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchers,
});

function AdminVouchers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BatchForm>(emptyForm());
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, BatchDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await apiAuth<{ batches: BatchRow[] }>("/api/admin/voucher-batches");
    setBatches(d.batches);
  }, []);

  usePageDataLoad("admin-vouchers", load, []);

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (details[id]) return;
    setLoadingDetail(id);
    try {
      const d = await apiAuth<{ batch: BatchDetail }>(`/api/admin/voucher-batches/${id}`);
      setDetails((prev) => ({ ...prev, [id]: d.batch }));
    } catch {
      toast.error("Could not load batch");
    } finally {
      setLoadingDetail(null);
    }
  };

  const save = async () => {
    try {
      await apiAuth("/api/admin/voucher-batches", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success(`Created batch of ${form.quantity} vouchers`);
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Create failed");
    }
  };

  const toggleBatch = async (b: BatchRow) => {
    try {
      await apiAuth(`/api/admin/voucher-batches/${b.id}/toggle`, { method: "PATCH" });
      load();
    } catch {
      toast.error("Toggle failed");
    }
  };

  const downloadCsv = async (batchId: string) => {
    try {
      await downloadAuthCsv(`/api/admin/voucher-batches/${batchId}/csv`, `voucher-batch-${batchId}.csv`);
    } catch {
      toast.error("CSV download failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Voucher batches"
        sub="Generate bulk 32-character codes. Each code is one-time use per user."
        action={
          <Button onClick={() => { setForm(emptyForm()); setDialogOpen(true); }} className="bg-gradient-emerald text-white">
            <Plus className="mr-2 h-4 w-4" /> Generate batch
          </Button>
        }
      />

      <div className="space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No voucher batches yet.</p>
        ) : (
          batches.map((b) => {
            const isOpen = expanded === b.id;
            const detail = details[b.id];
            return (
              <div key={b.id} className="rounded-xl border border-border bg-card shadow-soft">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => toggleExpand(b.id)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="flex-1">
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.quantity} codes · {b.discountType} {b.discountAmount}
                      {b.discountType === "Percentage" ? "%" : " MYR"} · expires {b.expiry}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-success">{b.availableCount} available</div>
                    <div className="text-muted-foreground">{b.usedCount} used</div>
                  </div>
                  <Switch checked={b.active} onCheckedChange={() => toggleBatch(b)} onClick={(e) => e.stopPropagation()} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadCsv(b.id);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-4 pb-4">
                    {loadingDetail === b.id ? (
                      <p className="py-4 text-sm text-muted-foreground">Loading codes…</p>
                    ) : detail ? (
                      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-2 text-left">Code</th>
                              <th className="p-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.vouchers.map((v) => (
                              <tr key={v.id} className="border-t border-border">
                                <td className="p-2 font-mono">{v.code}</td>
                                <td className="p-2">
                                  {v.used ? (
                                    <span className="text-muted-foreground">Used</span>
                                  ) : v.active ? (
                                    <span className="text-success">Available</span>
                                  ) : (
                                    <span>Inactive</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate voucher batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Batch label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="March 2026 promo" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity (max 500)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount type</Label>
                <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Percentage">Percentage</SelectItem>
                    <SelectItem value="Fixed">Fixed (MYR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expiry</Label>
              <Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Each voucher is 32 alphanumeric characters, single use per user.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-emerald text-white" onClick={save}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
