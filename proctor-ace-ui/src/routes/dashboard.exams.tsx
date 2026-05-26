import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarClock, Clock, Tag, Filter, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ApiError } from "@/lib/api-client";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import type { ScheduleSlot } from "@/lib/exam-schedule";
import { cn } from "@/lib/utils";

type Exam = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  questions: number;
  difficulty: string;
  attempts: number;
  passScore: number;
};

export const Route = createFileRoute("/dashboard/exams")({
  component: AvailableExams,
  validateSearch: (s: Record<string, unknown>) => ({ canceled: s.canceled === "1" || s.canceled === 1 }),
});

function AvailableExams() {
  const { canceled } = Route.useSearch();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [exams, setExams] = useState<Exam[]>([]);
  const [active, setActive] = useState<Exam | null>(null);
  const [voucher, setVoucher] = useState("");
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scheduleDateStr, setScheduleDateStr] = useState("");
  const [minDate, setMinDate] = useState<string>("");
  const [maxDate, setMaxDate] = useState<string>("");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (canceled) toast.info("Checkout canceled");
  }, [canceled]);

  usePageDataLoad(
    "available-exams",
    async () => {
      const d = await apiAuth<{ exams: Exam[] }>("/api/candidate/available-exams");
      setExams(d.exams ?? []);
    },
    [],
  );

  const categories = useMemo(() => {
    return [...new Set(exams.map((e) => e.category).filter(Boolean))].sort();
  }, [exams]);

  const levels = useMemo(() => {
    return [...new Set(exams.map((e) => e.difficulty).filter(Boolean))].sort();
  }, [exams]);

  const filtered = exams.filter((e) => {
    const matchSearch =
      !q ||
      e.title.toLowerCase().includes(q.toLowerCase()) ||
      e.category.toLowerCase().includes(q.toLowerCase());
    const matchCategory = categoryFilter === "all" || e.category === categoryFilter;
    const matchLevel = levelFilter === "all" || e.difficulty === levelFilter;
    return matchSearch && matchCategory && matchLevel;
  });

  const subtotal = active?.price ?? 0;
  const total = Math.max(0, subtotal - discount);

  const dateStr = scheduleDateStr;

  useEffect(() => {
    if (!active || !dateStr) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    setLoadingSlots(true);
    apiAuth<{ slots: ScheduleSlot[]; minDate: string; maxDate: string }>(
      `/api/payments/schedule-slots?examId=${active.id}&date=${dateStr}`,
    )
      .then((d) => {
        setMinDate(d.minDate);
        setMaxDate(d.maxDate);
        setSlots(d.slots);
        setSelectedSlot(d.slots[0] ?? null);
      })
      .catch(() => {
        setSlots([]);
        toast.error("Could not load time slots");
      })
      .finally(() => setLoadingSlots(false));
  }, [active?.id, dateStr]);

  const openSchedule = (e: Exam) => {
    setActive(e);
    setDiscount(0);
    setVoucher("");
    setSlots([]);
    setSelectedSlot(null);
    const today = new Date().toISOString().slice(0, 10);
    setScheduleDateStr(today);
    void apiAuth<{ minDate: string; maxDate: string; slots: ScheduleSlot[] }>(
      `/api/payments/schedule-slots?examId=${e.id}&date=${today}`,
    )
      .then((d) => {
        setMinDate(d.minDate);
        setMaxDate(d.maxDate);
        setScheduleDateStr(d.minDate);
        setSlots(d.slots);
        setSelectedSlot(d.slots[0] ?? null);
      })
      .catch(() => {
        setMinDate("");
        setMaxDate("");
      });
  };

  const applyVoucher = async () => {
    if (!active || !voucher) return;
    try {
      const res = await apiAuth<{ valid: boolean; discount: number }>("/api/payments/validate-voucher", {
        method: "POST",
        body: JSON.stringify({ code: voucher, examId: active.id }),
      });
      if (res.valid) {
        setDiscount(res.discount);
        toast.success(`Voucher applied — MYR ${res.discount} off`);
      } else {
        setDiscount(0);
        toast.error("Invalid voucher");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Voucher check failed");
    }
  };

  const checkout = async () => {
    if (!active || !selectedSlot || !dateStr) {
      toast.error("Select a date and time slot");
      return;
    }
    setLoading(true);
    try {
      const res = await apiAuth<{
        mode: string;
        url?: string;
        redirectUrl?: string;
      }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          examId: active.id,
          voucherCode: voucher || undefined,
          scheduledDate: dateStr,
          scheduledStartTime: selectedSlot.startTime,
        }),
      });
      if ((res.mode === "stripe" || res.mode === "mock" || res.mode === "free") && res.url) {
        window.location.href = res.url;
      } else if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.success("Payment complete");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const filtersActive = categoryFilter !== "all" || levelFilter !== "all";

  return (
    <>
      <PageHeader
        title="Available Exams"
        sub="Schedule an exam slot (10:00 AM–6:00 PM, Malaysia time). Paid exams appear under My Exams."
        action={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exams..." className="w-64 pl-9" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter{filtersActive ? " · active" : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Level</Label>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      {levels.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filtersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => { setCategoryFilter("all"); setLevelFilter("all"); }}
                  >
                    Clear filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {exams.length === 0
            ? "You have scheduled or have pending payment for all available exams. Check My Exams or complete pending payments from notifications."
            : "No exams match your search or filters."}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <div key={e.id} className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-elevated">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary">{e.category}</Badge>
                <Badge variant="outline" className="text-[10px]">{e.difficulty}</Badge>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{e.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <Box icon={Clock} v={`${e.duration}m`} l="Duration" />
                <Box icon={BookOpen} v={e.questions} l="Questions" />
                <Box icon={Sparkles} v={e.difficulty} l="Level" />
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                <div>
                  <div className="font-display text-2xl font-bold">MYR {e.price}</div>
                  <div className="text-[10px] text-muted-foreground">{e.attempts} attempts · Pass {e.passScore}%</div>
                </div>
                <Button onClick={() => openSchedule(e)} className="bg-gradient-emerald text-white shadow-glow hover:opacity-95">
                  Schedule Exam
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule & pay</DialogTitle>
            <DialogDescription>
              Pick your exam date (today through one year ahead) and the next available start time between 10:00 AM and 6:00 PM (MYT).
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">{active.category} · {active.difficulty}</div>
                <div className="mt-1 font-medium">{active.title}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{active.duration} min · {active.questions} questions</span>
                  <span className="font-medium">MYR {active.price}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Exam date
                  </Label>
                  <Input
                    type="date"
                    min={minDate || undefined}
                    max={maxDate || undefined}
                    value={scheduleDateStr}
                    onChange={(e) => setScheduleDateStr(e.target.value)}
                    className="rounded-xl"
                  />
                  {minDate && maxDate && (
                    <p className="text-[10px] text-muted-foreground">
                      Book between {minDate} and {maxDate} (MYT). Attend within one year of purchase.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Start time (30-min slots)</Label>
                  {!dateStr ? (
                    <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Select a date first
                    </p>
                  ) : loadingSlots ? (
                    <p className="text-sm text-muted-foreground">Loading slots…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No slots available for this date.</p>
                  ) : (
                    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-left text-xs transition",
                            selectedSlot?.startAt === slot.startAt
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-border hover:bg-muted/60",
                          )}
                        >
                          <div className="font-medium">{slot.startTime}</div>
                          <div className="text-[10px] text-muted-foreground">ends {slot.label.split("–")[1]?.trim()}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSlot && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedSlot.label} ({active.duration} min exam)
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Voucher code</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="VOUCHER-CODE" className="pl-9 uppercase" />
                  </div>
                  <Button variant="outline" onClick={applyVoucher}>Apply</Button>
                </div>
                {discount > 0 && <p className="text-xs text-success">Saved MYR {discount}</p>}
              </div>

              <div className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
                <Row k="Subtotal" v={`MYR ${subtotal}`} />
                {discount > 0 && <Row k="Voucher discount" v={`-MYR ${discount}`} c="text-success" />}
                <div className="my-1 h-px bg-border" />
                <Row k="Total" v={`MYR ${total}`} bold />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
                <Button
                  onClick={checkout}
                  disabled={loading || !selectedSlot || !dateStr}
                  className="bg-gradient-emerald text-white"
                >
                  {loading ? "Processing…" : `Pay MYR ${total}`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Box({ icon: Icon, v, l }: { icon: React.ComponentType<{ className?: string }>; v: string | number; l: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
      <div className="text-xs font-semibold">{v}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{l}</div>
    </div>
  );
}

function Row({ k, v, c, bold }: { k: string; v: string; c?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-display text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{k}</span>
      <span className={c}>{v}</span>
    </div>
  );
}
