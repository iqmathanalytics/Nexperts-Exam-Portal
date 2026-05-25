import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ExamFormState } from "@/lib/types";

const defaultForm: ExamFormState = {
  title: "",
  category: "Artificial Intelligence",
  description: "",
  duration: 90,
  questions: 60,
  passScore: 70,
  maxAttempts: 3,
  price: 149,
  startDate: "",
  endDate: "",
  status: "Draft",
  proctoring: true,
  fullscreen: true,
  tabDetection: true,
  webcam: true,
};

export function getDefaultExamForm(): ExamFormState {
  return { ...defaultForm };
}

export function examToForm(exam: ExamFormState & { id: string }): ExamFormState {
  return { ...exam };
}

export function ExamForm({
  form,
  onChange,
  onSubmit,
  submitLabel = "Save exam",
}: {
  form: ExamFormState;
  onChange: (next: ExamFormState) => void;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  const set = <K extends keyof ExamFormState>(key: K, value: ExamFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <Label>Exam title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as ExamFormState["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input type="number" value={form.duration} onChange={(e) => set("duration", +e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Total questions</Label>
          <Input type="number" value={form.questions} onChange={(e) => set("questions", +e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Passing %</Label>
          <Input type="number" value={form.passScore} onChange={(e) => set("passScore", +e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Max attempts</Label>
          <Input type="number" value={form.maxAttempts} onChange={(e) => set("maxAttempts", +e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Price (MYR)</Label>
          <Input type="number" value={form.price} onChange={(e) => set("price", +e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Start date</Label>
          <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End date</Label>
          <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold">Proctoring settings</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([
            ["proctoring", "AI proctoring"],
            ["fullscreen", "Fullscreen enforcement"],
            ["tabDetection", "Tab switch detection"],
            ["webcam", "Webcam monitoring"],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="bg-gradient-emerald text-white">{submitLabel}</Button>
    </form>
  );
}
