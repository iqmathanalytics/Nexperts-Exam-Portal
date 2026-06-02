import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseQuestionCsv } from "@/components/question-form-fields";
import { QuestionCsvBulkInput } from "@/components/question-csv-bulk-input";
import { apiAuth } from "@/lib/api-auth";
import { buildAdminQuestionsQuery } from "@/lib/admin-questions-api";
import { usePageDataLoad, useInvalidateSession } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";

type Pool = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  questionCount: number;
};

type QuestionRow = {
  id: string;
  title: string;
  type: string;
  topic: string;
  difficulty: string;
};

type PoolDetail = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  questionCount: number;
  questions: QuestionRow[];
};

type PoolForm = {
  name: string;
  description: string;
  active: boolean;
  questionIds: string[];
};

const emptyForm = (): PoolForm => ({
  name: "",
  description: "",
  active: true,
  questionIds: [],
});

export const Route = createFileRoute("/admin/question-pools")({
  component: AdminQuestionPools,
});

function AdminQuestionPools() {
  const invalidateSession = useInvalidateSession();
  const { data, refetch } = usePageDataLoad(
    "question-pools-page",
    async () => {
      const [poolRes, questionRes] = await Promise.all([
        apiAuth<{ pools: Pool[] }>("/api/admin/question-pools"),
        apiAuth<{ questions: QuestionRow[] }>(`/api/admin/questions${buildAdminQuestionsQuery({ filterExamId: "all", all: true })}`),
      ]);
      return { pools: poolRes.pools, allQuestions: questionRes.questions };
    },
    [],
  );
  const pools = data?.pools ?? [];
  const allQuestions = data?.allQuestions ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PoolForm>(emptyForm());
  const [search, setSearch] = useState("");
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    void refetch();
    invalidateSession("question-pools-list");
  };

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allQuestions;
    return allQuestions.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.topic.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q),
    );
  }, [allQuestions, search]);

  const pendingCsvQuestions = useMemo(
    () => parseQuestionCsv(bulkCsvText),
    [bulkCsvText],
  );

  const mapCsvToNewQuestions = (rows: ReturnType<typeof parseQuestionCsv>) =>
    rows.map((q) => ({
      title: q.title,
      code: q.code ?? null,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic: q.topic,
      tags: q.tags,
      examId: null,
    }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSearch("");
    setBulkCsvText("");
    setDialogOpen(true);
  };

  const openEdit = async (poolId: string) => {
    try {
      const d = await apiAuth<{ pool: PoolDetail }>(`/api/admin/question-pools/${poolId}`);
      setEditingId(poolId);
      setForm({
        name: d.pool.name,
        description: d.pool.description ?? "",
        active: d.pool.active,
        questionIds: d.pool.questions.map((q) => q.id),
      });
      setSearch("");
      setBulkCsvText("");
      setDialogOpen(true);
    } catch {
      toast.error("Could not open pool");
    }
  };

  const toggleQuestion = (id: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      questionIds: checked
        ? [...new Set([...prev.questionIds, id])]
        : prev.questionIds.filter((x) => x !== id),
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Pool name is required");
      return;
    }
    const csvRows = editingId ? [] : pendingCsvQuestions;
    if (form.questionIds.length === 0 && csvRows.length === 0) {
      toast.error("Select questions from the bank or upload a CSV");
      return;
    }

    const newQuestions = mapCsvToNewQuestions(csvRows);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      active: form.active,
      questionIds: form.questionIds,
      newQuestions,
    };

    setSaving(true);
    try {
      if (editingId) {
        const res = await apiAuth<{ importedCount?: number }>(`/api/admin/question-pools/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        const extra = res.importedCount ? ` (${res.importedCount} imported to question bank)` : "";
        toast.success(`Question pool updated${extra}`);
      } else {
        const res = await apiAuth<{ importedCount?: number }>("/api/admin/question-pools", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const extra = res.importedCount ? ` (${res.importedCount} added to question bank)` : "";
        toast.success(`Question pool created${extra}`);
      }
      setDialogOpen(false);
      setBulkCsvText("");
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save question pool");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (poolId: string) => {
    if (!confirm("Delete this question pool?")) return;
    try {
      await apiAuth(`/api/admin/question-pools/${poolId}`, { method: "DELETE" });
      toast.success("Question pool deleted");
      refresh();
    } catch {
      toast.error("Could not delete pool");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question pools"
        sub="Create reusable pools from any category/type. Exams can randomly draw N questions from a selected pool."
        action={
          <Button className="bg-gradient-emerald text-white" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New pool
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">Pool</th>
              <th>Questions</th>
              <th>Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pools.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No pools yet. Create one to randomize exams from large question sets.
                </td>
              </tr>
            )}
            {pools.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-4">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.description || "—"}</div>
                </td>
                <td>{p.questionCount}</td>
                <td>{p.active ? "Active" : "Inactive"}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit question pool" : "Create question pool"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update pool details and change which questions are included."
                : "Select questions from the bank and/or bulk-upload CSV. Imported rows are saved to the question bank and linked to this pool."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pool name</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, active: v === true }))}
                />
                Active
              </label>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          {!editingId && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Bulk upload (CSV)
              </Label>
              <QuestionCsvBulkInput
                value={bulkCsvText}
                onChange={setBulkCsvText}
                parsedCount={pendingCsvQuestions.length}
                parsedCountLabel="question(s) ready to import on save"
                textareaRows={6}
                id="pool-form-csv-file"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Search questions</Label>
            <Input
              placeholder="Search by title, topic, or type"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Selected: {form.questionIds.length}
              {!editingId && pendingCsvQuestions.length > 0 ? ` + ${pendingCsvQuestions.length} from CSV` : ""}
              {" "}/ Available: {allQuestions.length}
            </p>
          </div>

          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="w-10 p-3" />
                  <th className="p-3">Question</th>
                  <th className="p-3">Topic</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((q) => {
                  const checked = form.questionIds.includes(q.id);
                  return (
                    <tr key={q.id} className="border-b">
                      <td className="p-3">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggleQuestion(q.id, v === true)} />
                      </td>
                      <td className="p-3">{q.title}</td>
                      <td className="p-3">{q.topic}</td>
                      <td className="p-3">{q.type}</td>
                      <td className="p-3">{q.difficulty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
