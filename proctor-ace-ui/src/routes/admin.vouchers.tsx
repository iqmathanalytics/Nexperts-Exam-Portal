import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { ApiError } from "@/lib/api-client";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type VoucherRow = {
  id: string;
  code: string;
  discountType: string;
  discountAmount: number;
  exams: string[];
  examIds?: string[];
  expiry: string;
  usageLimit: number;
  used: number;
  active: boolean;
};

type VoucherForm = {
  code: string;
  discountType: string;
  discountAmount: number;
  usageLimit: number;
  expiry: string;
  active: boolean;
};

const emptyForm = (): VoucherForm => ({
  code: "",
  discountType: "Percentage",
  discountAmount: 25,
  usageLimit: 100,
  expiry: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  active: true,
});

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchers,
});

function AdminVouchers() {
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm());
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);

  const load = useCallback(async () => {
    const d = await apiAuth<{ vouchers: VoucherRow[] }>("/api/admin/vouchers");
    setVouchers(d.vouchers);
  }, []);

  usePageDataLoad("admin-vouchers", load, []);

  const filtered = vouchers.filter((v) => v.code.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (v: VoucherRow) => {
    setEditId(v.id);
    setForm({
      code: v.code,
      discountType: v.discountType,
      discountAmount: v.discountAmount,
      usageLimit: v.usageLimit,
      expiry: v.expiry,
      active: v.active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (editId) {
        await apiAuth(`/api/admin/vouchers/${editId}`, { method: "PUT", body: JSON.stringify(form) });
        toast.success("Voucher updated");
      } else {
        await apiAuth("/api/admin/vouchers", { method: "POST", body: JSON.stringify(form) });
        toast.success("Voucher created");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const toggle = async (v: VoucherRow) => {
    try {
      await apiAuth(`/api/admin/vouchers/${v.id}/toggle`, { method: "PATCH" });
      toast.success(v.active ? "Voucher disabled" : "Voucher enabled");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Toggle failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    try {
      await apiAuth(`/api/admin/vouchers/${id}`, { method: "DELETE" });
      toast.success("Voucher deleted");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voucher management"
        sub="Create discount codes with usage limits and exam applicability."
        action={<Button className="bg-gradient-emerald text-white" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create voucher</Button>}
      />
      <DataToolbar search={search} onSearch={setSearch} placeholder="Search voucher codes..." hideInput />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((v) => (
          <div key={v.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="font-mono text-lg font-bold">{v.code}</div>
              <Switch checked={v.active} onCheckedChange={() => toggle(v)} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {v.discountType === "Percentage" ? `${v.discountAmount}% off` : `MYR ${v.discountAmount} off`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Exams: {v.exams.join(", ")}</p>
            <p className="mt-1 text-xs">Expires {v.expiry}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>Used {v.used}/{v.usageLimit}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(v)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(v.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit voucher" : "Create voucher"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="NEXPERTS25" /></div>
            <div className="space-y-2">
              <Label>Discount type</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Percentage">Percentage</SelectItem>
                  <SelectItem value="Fixed">Fixed (MYR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Discount amount</Label><Input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Usage limit</Label><Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Expiry</Label><Input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
