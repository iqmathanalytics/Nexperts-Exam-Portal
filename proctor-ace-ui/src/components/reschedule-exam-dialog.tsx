import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";
import type { ScheduleSlot } from "@/lib/exam-schedule";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  examId: string;
  examTitle: string;
  duration: number;
  onRescheduled: () => void;
};

export function RescheduleExamDialog({
  open,
  onOpenChange,
  paymentId,
  examId,
  examTitle,
  duration,
  onRescheduled,
}: Props) {
  const [dateStr, setDateStr] = useState("");
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selected, setSelected] = useState<ScheduleSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setDateStr(today);
    setLoading(true);
    apiAuth<{ minDate: string; maxDate: string; slots: ScheduleSlot[] }>(
      `/api/payments/schedule-slots?examId=${examId}&date=${today}`,
    )
      .then((d) => {
        setMinDate(d.minDate);
        setMaxDate(d.maxDate);
        setDateStr(d.minDate);
        setSlots(d.slots);
        setSelected(d.slots[0] ?? null);
      })
      .catch(() => toast.error("Could not load slots"))
      .finally(() => setLoading(false));
  }, [open, examId]);

  useEffect(() => {
    if (!open || !dateStr) return;
    setLoading(true);
    apiAuth<{ slots: ScheduleSlot[]; minDate: string; maxDate: string }>(
      `/api/payments/schedule-slots?examId=${examId}&date=${dateStr}`,
    )
      .then((d) => {
        setMinDate(d.minDate);
        setMaxDate(d.maxDate);
        setSlots(d.slots);
        setSelected(d.slots[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [dateStr, examId, open]);

  const submit = async () => {
    if (!selected) {
      toast.error("Select a time slot");
      return;
    }
    setSaving(true);
    try {
      await apiAuth("/api/payments/reschedule", {
        method: "POST",
        body: JSON.stringify({
          paymentId,
          scheduledDate: dateStr,
          scheduledStartTime: selected.startTime,
        }),
      });
      toast.success("Exam rescheduled");
      onOpenChange(false);
      onRescheduled();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule exam</DialogTitle>
          <DialogDescription>
            {examTitle} — choose a new slot (unlimited reschedules within your one-year window).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Date</Label>
            <Input type="date" min={minDate} max={maxDate} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Start time</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slots for this date.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => setSelected(slot)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-left text-xs",
                      selected?.startAt === slot.startAt
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border",
                    )}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Duration: {duration} min</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-gradient-emerald text-white" disabled={saving || !selected} onClick={submit}>
            {saving ? "Saving…" : "Confirm reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
