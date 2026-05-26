import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Check, X, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError, apiBase } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import type { QuestionFormState } from "@/lib/types";

type GeneratedQ = QuestionFormState & { id: string; examTitle?: string | null };

type GenerateResponse = {
  questions: GeneratedQ[];
  source: "groq" | "template";
  fallbackReason?: string;
  groqConfigured?: boolean;
  saved?: boolean;
  savedCount?: number;
  examId?: string | null;
};

export const Route = createFileRoute("/admin/ai-generator")({
  component: AiGenerator,
});

function AiGenerator() {
  const [topic, setTopic] = useState("Cloud security fundamentals");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [qType, setQType] = useState("Mixed");
  const [examId, setExamId] = useState("");
  const [saveToBank, setSaveToBank] = useState(true);
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQ[]>([]);
  const [lastSource, setLastSource] = useState<"groq" | "template" | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [groqConfigured, setGroqConfigured] = useState<boolean | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  usePageDataLoad(
    "ai-generator",
    async () => {
      const d = await apiAuth<{ exams: { id: string; title: string }[] }>("/api/admin/exams");
      setExams(d.exams.map((e) => ({ id: e.id, title: e.title })));
    },
    [],
  );

  const generateFromPdf = async () => {
    if (!pdfFile) {
      toast.error("Choose a PDF file first");
      return;
    }
    if (saveToBank && !examId) {
      toast.error("Select a target exam to save questions");
      return;
    }
    setPdfLoading(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("pdf", pdfFile);
      fd.append("topic", topic);
      fd.append("count", String(Math.min(50, Math.max(1, parseInt(count, 10) || 5))));
      fd.append("difficulty", difficulty);
      fd.append("questionType", qType);
      fd.append("saveToBank", saveToBank && examId ? "true" : "false");
      if (examId) fd.append("examId", examId);
      const res = await fetch(`${apiBase}/api/admin/ai/generate-from-pdf`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(data.error ?? "PDF generation failed", res.status, data);
      if (data.savedCount) {
        toast.success(`${data.savedCount} questions saved from PDF`);
        setGenerated([]);
      } else {
        setGenerated(data.questions.map((q: GeneratedQ, i: number) => ({ ...q, id: `pdf-${i}` })));
        toast.success(`Generated ${data.questions.length} questions from PDF`);
      }
      setLastSource(data.source);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const generate = async () => {
    if (saveToBank && !examId) {
      toast.error("Select a target exam to save questions to the question bank");
      return;
    }
    setLoading(true);
    setFallbackReason(null);
    try {
      const n = Math.min(50, Math.max(1, parseInt(count, 10) || 5));
      const res = await apiAuth<GenerateResponse>("/api/admin/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          count: n,
          difficulty,
          questionType: qType,
          examId: examId || undefined,
          saveToBank: saveToBank && Boolean(examId),
        }),
      });
      setGroqConfigured(res.groqConfigured ?? null);
      setLastSource(res.source);

      if (res.saved && res.savedCount) {
        setGenerated([]);
        toast.success(
          `${res.savedCount} question${res.savedCount === 1 ? "" : "s"} saved to question bank (${res.source === "groq" ? "Groq AI" : "template fallback"})`,
        );
      } else {
        setGenerated(res.questions);
        if (res.source === "groq") {
          toast.success(`${res.questions.length} questions generated with Groq — review and accept below`);
        } else {
          setFallbackReason(res.fallbackReason ?? "Groq unavailable; template questions were used.");
          toast.warning(`Using template fallback (${res.questions.length} questions). See notice below.`);
        }
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const accept = async (q: GeneratedQ) => {
    if (!examId) {
      toast.error("Select a target exam first");
      return;
    }
    const { id: _id, examTitle: _t, ...body } = q;
    try {
      await apiAuth("/api/admin/questions", { method: "POST", body: JSON.stringify({ ...body, examId }) });
      setGenerated((prev) => prev.filter((x) => x.id !== q.id));
      toast.success("Question added to question bank");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const acceptAll = async () => {
    if (!generated.length) return;
    if (!examId) {
      toast.error("Select a target exam first");
      return;
    }
    try {
      const items = generated.map(({ id: _id, examTitle: _t, ...rest }) => ({ ...rest, examId }));
      const res = await apiAuth<{ count: number }>("/api/admin/questions/bulk", {
        method: "POST",
        body: JSON.stringify({ questions: items }),
      });
      toast.success(`${res.count} questions saved to question bank`);
      setGenerated([]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Bulk save failed");
    }
  };

  const examTitle = exams.find((e) => e.id === examId)?.title;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI question generator"
        sub="Generate certification questions with Groq, then save them directly to the question bank."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/questions" search={examId ? { examId } : {}}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open question bank
            </Link>
          </Button>
        }
      />

      {groqConfigured === false && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Groq API key not configured</p>
            <p className="mt-1 text-muted-foreground">
              Add <code className="text-xs">GROQ_API_KEY</code> to <code className="text-xs">api/.env</code> and restart the API server. Until then, only template fallback questions are generated.
            </p>
          </div>
        </div>
      )}

      {fallbackReason && lastSource === "template" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Template fallback was used</p>
            <p className="mt-1 text-muted-foreground">{fallbackReason}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 className="font-display font-semibold">Generate from PDF</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF syllabus or study guide. AI will generate questions from the extracted text.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>PDF file</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pdfLoading || !pdfFile}
            onClick={generateFromPdf}
          >
            {pdfLoading ? "Processing PDF…" : "Generate from PDF"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-5 w-5" />
            <span className="font-display font-semibold">Generation settings</span>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Topic / syllabus</Label>
              <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Number of questions</Label>
                <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} min={1} max={50} />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Beginner", "Intermediate", "Advanced", "Expert"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Save to exam *</Label>
              <Select value={examId || undefined} onValueChange={setExamId}>
                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor="save-to-bank" className="text-sm font-medium">Add to question bank immediately</Label>
                <p className="text-xs text-muted-foreground">Skip preview — questions appear in Question Bank right away</p>
              </div>
              <Switch id="save-to-bank" checked={saveToBank} onCheckedChange={setSaveToBank} />
            </div>
            <div className="space-y-2">
              <Label>Question type</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                  <SelectItem value="Multiple Choice">Multiple Choice</SelectItem>
                  <SelectItem value="True/False">True/False</SelectItem>
                  <SelectItem value="Scenario">Scenario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-gradient-emerald text-white" onClick={generate} disabled={loading}>
              {loading ? "Generating with Groq…" : saveToBank ? "Generate & save to question bank" : "Generate with Groq"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {lastSource === "groq"
                ? "Last run: real Groq LLM questions."
                : lastSource === "template"
                  ? "Last run: template fallback (not Groq)."
                  : `Model: ${groqConfigured === false ? "not configured" : "Groq LLM (llama-3.3-70b-versatile)"}.`}
              {saveToBank && examTitle && ` · Will save to ${examTitle}.`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Generated preview</h3>
            {generated.length > 0 && !saveToBank && (
              <Button size="sm" variant="outline" onClick={acceptAll}>Accept all to bank</Button>
            )}
          </div>
          {generated.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {saveToBank
                ? "Generated questions are saved directly to the question bank. Open Question Bank to review them."
                : "Generate questions to preview them here, then accept into the bank."}
            </p>
          ) : (
            <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">
              {generated.map((q) => (
                <div key={q.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">{q.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{q.type}</Badge>
                    <Badge variant="secondary">{q.difficulty}</Badge>
                    {q.tags?.includes("groq") && <Badge className="bg-accent/15 text-accent">Groq</Badge>}
                    {q.tags?.includes("template") && <Badge variant="destructive">Template</Badge>}
                  </div>
                  {q.options.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                      {q.options.map((o) => (
                        <li key={o} className={o === q.correctAnswer ? "font-medium text-foreground" : ""}>{o}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="text-success" onClick={() => accept(q)}><Check className="mr-1 h-3 w-3" />Accept</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setGenerated((p) => p.filter((x) => x.id !== q.id))}><X className="mr-1 h-3 w-3" />Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
