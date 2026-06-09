import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { QuestionFormState } from "@/lib/types";
import { TopicSelectField } from "@/components/topic-select-field";

type Props = {
  form: QuestionFormState;
  onChange: (next: QuestionFormState) => void;
  exams: { id: string; title: string }[];
};

export function QuestionFormFields({ form, onChange, exams }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [includeImage, setIncludeImage] = useState(Boolean(form.imageUrl));

  const onImageFile = (file: File | null) => {
    if (!file) {
      onChange({ ...form, imageUrl: null });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ ...form, imageUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const setType = (type: QuestionFormState["type"]) => {
    if (type === "True/False") {
      onChange({ ...form, type, options: ["True", "False"], correctAnswer: form.correctAnswer === "False" ? "False" : "True" });
    } else if (type === "Multiple Choice" || type === "Scenario") {
      const opts = form.options.length >= 4 ? form.options.slice(0, 4) : [...form.options, "Option A", "Option B", "Option C", "Option D"].slice(0, 4);
      onChange({ ...form, type, options: opts, correctAnswer: opts.includes(form.correctAnswer) ? form.correctAnswer : opts[0] });
    } else {
      onChange({ ...form, type });
    }
  };

  const setOption = (index: number, value: string) => {
    const options = [...form.options];
    const prev = options[index];
    options[index] = value;
    let correctAnswer = form.correctAnswer;
    if (correctAnswer === prev) correctAnswer = value;
    onChange({ ...form, options, correctAnswer });
  };

  const optionCount = form.type === "True/False" ? 2 : 4;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Exam *</Label>
        <Select
          value={form.examId}
          onValueChange={(v) => onChange({ ...form, examId: v, topic: form.topic })}
        >
          <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
          <SelectContent>
            {exams.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Question text *</Label>
        <Textarea value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} rows={3} />
      </div>

      <div className="space-y-2">
        <Label>Code snippet (optional)</Label>
        <Textarea
          value={form.code ?? ""}
          onChange={(e) => onChange({ ...form, code: e.target.value.trim() ? e.target.value : null })}
          rows={4}
          placeholder="Python, SQL, or other code shown below the question during the exam"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Shown as a separate code block under the question. Leave empty if not needed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Question type</Label>
          <Select value={form.type} onValueChange={(v) => setType(v as QuestionFormState["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Multiple Choice">Multiple Choice</SelectItem>
              <SelectItem value="True/False">True/False</SelectItem>
              <SelectItem value="Scenario">Scenario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => onChange({ ...form, difficulty: v })}>
            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent>
              {["Beginner", "Intermediate", "Advanced", "Expert"].map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TopicSelectField
        examId={form.examId}
        value={form.topic}
        onChange={(topic) => onChange({ ...form, topic })}
      />

      <div className="rounded-lg border border-border p-4 space-y-3">
        <Label>Answer options — select the correct one</Label>
        <RadioGroup value={form.correctAnswer} onValueChange={(v) => onChange({ ...form, correctAnswer: v })}>
          {Array.from({ length: optionCount }, (_, i) => {
            const label = form.type === "True/False" ? (i === 0 ? "True" : "False") : `Option ${String.fromCharCode(65 + i)}`;
            const value = form.options[i] ?? label;
            return (
              <div key={i} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                <RadioGroupItem value={value} id={`opt-${i}`} />
                {form.type === "True/False" ? (
                  <Label htmlFor={`opt-${i}`} className="flex-1 font-medium">{label}</Label>
                ) : (
                  <Input
                    className="flex-1"
                    value={form.options[i] ?? ""}
                    placeholder={label}
                    onChange={(e) => setOption(i, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {form.type === "True/False"
            ? "Tick True or False as the correct answer."
            : "Enter each option text, then tick the radio for the correct answer."}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={includeImage}
            onCheckedChange={(c) => {
              const on = c === true;
              setIncludeImage(on);
              if (!on) onChange({ ...form, imageUrl: null });
            }}
          />
          Include image with question (optional)
        </label>
        {includeImage && (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Upload image
            </Button>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Question" className="max-h-40 rounded-md border border-border object-contain" />
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Explanation (optional)</Label>
        <Textarea value={form.explanation} onChange={(e) => onChange({ ...form, explanation: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

export {
  QUESTION_CSV_TEMPLATE,
  downloadCsvTemplate,
  parseQuestionCsv,
} from "@/lib/parse-question-csv";
