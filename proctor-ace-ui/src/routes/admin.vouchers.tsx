import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  totalUses: number;
  totalUsageLimit: number;
  usageLimitPerVoucher: number;
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
  usageLimitPerVoucher: number;
  vouchers: {
    id: string;
    code: string;
    used: boolean;
    usedCount: number;
    usageLimit: number;
    active: boolean;
    redeemedAt: string | null;
    redemptions: {
      id: string;
      usedAt: string;
      userId: string;
      userName: string;
      userEmail: string;
    }[];
  }[];
};

type BatchForm = {
  label: string;
  quantity: number;
  discountType: string;
  discountAmount: number;
  usageLimitPerVoucher: number;
  expiry: string;
  active: boolean;
};

const emptyForm = (): BatchForm => ({
  label: "",
  quantity: 10,
  discountType: "Percentage",
  discountAmount: 25,
  usageLimitPerVoucher: 1,
  expiry: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  active: true,
});

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchers,
});

function AdminVouchers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BatchForm>(emptyForm());
  const { data: batches = [], refetch } = usePageDataLoad(
    "admin-vouchers",
    async () => {
      const d = await apiAuth<{ batches: BatchRow[] }>("/api/admin/voucher-batches");
      return d.batches;
    },
    [],
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, BatchDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const refresh = () => void refetch();

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
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Create failed");
    }
  };

  const toggleBatch = async (b: BatchRow) => {
    try {
      await apiAuth(`/api/admin/voucher-batches/${b.id}/toggle`, { method: "PATCH" });
      refresh();
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
        sub="Generate bulk 32-character codes with configurable usage limits and redemption tracking."
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
                <div className="flex w-full items-center gap-3 p-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => toggleExpand(b.id)}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{b.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.quantity} codes · {b.discountType} {b.discountAmount}
                        {b.discountType === "Percentage" ? "%" : " MYR"} · up to {b.usageLimitPerVoucher} use(s) per code · expires {b.expiry}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div className="text-success">{b.totalUsageLimit - b.totalUses} uses left</div>
                      <div className="text-muted-foreground">{b.totalUses}/{b.totalUsageLimit} uses consumed</div>
                    </div>
                  </button>
                  <Switch checked={b.active} onCheckedChange={() => toggleBatch(b)} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCsv(b.id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
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
                              <th className="p-2 text-left">Usage</th>
                              <th className="p-2 text-left">Status</th>
                              <th className="p-2 text-left">Used by</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.vouchers.map((v) => (
                              <tr key={v.id} className="border-t border-border">
                                <td className="p-2 font-mono">{v.code}</td>
                                <td className="p-2">{v.usedCount}/{v.usageLimit}</td>
                                <td className="p-2">
                                  {v.usedCount >= v.usageLimit ? (
                                    <span className="text-muted-foreground">Used up</span>
                                  ) : v.active ? (
                                    <span className="text-success">Available</span>
                                  ) : (
                                    <span>Inactive</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  {v.redemptions.length === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {v.redemptions.map((r) => (
                                        <div key={r.id} className="text-[11px] leading-tight">
                                          <span className="font-medium">{r.userName}</span>
                                          <span className="text-muted-foreground"> ({r.userEmail})</span>
                                        </div>
                                      ))}
                                    </div>
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
              <Label>Max uses per voucher</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.usageLimitPerVoucher}
                onChange={(e) => setForm({ ...form, usageLimitPerVoucher: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry</Label>
              <Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Each voucher is 32 alphanumeric characters and can be used up to the configured limit.
              Each user may redeem only one voucher code per batch.
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
