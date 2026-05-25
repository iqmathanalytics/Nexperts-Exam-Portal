import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
          <Input value={form.difficulty} onChange={(e) => onChange({ ...form, difficulty: e.target.value })} />
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

      <div className="space-y-2">
        <Label>Explanation (optional)</Label>
        <Textarea value={form.explanation} onChange={(e) => onChange({ ...form, explanation: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

export const QUESTION_CSV_TEMPLATE = `title,type,topic,difficulty,option1,option2,option3,option4,correctAnswer,explanation
"What is a VPC?","Multiple Choice","Cloud Networking","Intermediate","Virtual Private Cloud","Virtual Public Cluster","Version Control Protocol","Visual Process Chart","Virtual Private Cloud","A VPC isolates cloud resources in a private network."
"HTTPS always uses port 443.","True/False","Security","Beginner","True","False","","","True","HTTPS default port is 443."
"A team must design a highly available API.","Scenario","Architecture","Advanced","Use multi-AZ load balancer with auto scaling","Single large VM","Local SQLite only","Disable monitoring","Use multi-AZ load balancer with auto scaling","HA requires redundancy across zones."
`;

export function parseQuestionCsv(text: string, examId: string): QuestionFormState[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("title") && header.includes("correctanswer");
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows.map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? line.split(",");
    const [title, type, topic, difficulty, o1, o2, o3, o4, correctAnswer, explanation] = cols;
    const qType = (type?.trim() || "Multiple Choice") as QuestionFormState["type"];
    let options: string[] = [];
    if (qType === "True/False") {
      options = ["True", "False"];
    } else {
      options = [o1, o2, o3, o4].filter(Boolean) as string[];
      if (options.length < 2) options = ["Option A", "Option B", "Option C", "Option D"];
    }
    return {
      examId,
      title: title?.trim() || "Imported question",
      type: qType,
      options,
      correctAnswer: correctAnswer?.trim() || options[0],
      explanation: explanation?.trim() || "",
      difficulty: difficulty?.trim() || "Intermediate",
      topic: topic?.trim() || "General",
      tags: ["imported"],
    };
  });
}

export function downloadCsvTemplate() {
  const blob = new Blob([QUESTION_CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nexperts-questions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
