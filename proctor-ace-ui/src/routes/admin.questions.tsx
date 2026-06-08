import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Upload, Eye, Pencil, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QuestionFormFields, parseQuestionCsv } from "@/components/question-form-fields";
import { QuestionCsvBulkInput } from "@/components/question-csv-bulk-input";
import { downloadCsvTemplate } from "@/lib/parse-question-csv";
import { QuestionCodeBlock } from "@/components/question-code-block";
import { usePageDataLoad, usePageLoading } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { apiAuth } from "@/lib/api-auth";
import {
  buildAdminQuestionsQuery,
  QB_INITIAL_LIMIT,
  QB_LOAD_MORE_LIMIT,
} from "@/lib/admin-questions-api";
import { ApiError } from "@/lib/api-client";
import type { ExamFormState, QuestionFormState } from "@/lib/types";

type QuestionRow = QuestionFormState & { id: string; examTitle?: string | null };

const searchSchema = z.object({
  examId: z.string().optional(),
});

export const Route = createFileRoute("/admin/questions")({
  validateSearch: searchSchema,
  component: QuestionBank,
});

const FILTER_ALL = "all";
const FILTER_UNASSIGNED = "unassigned";

const emptyQuestion = (examId?: string): QuestionFormState => ({
  examId: examId || undefined,
  title: "",
  code: null,
  type: "Multiple Choice",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correctAnswer: "Option A",
  explanation: "",
  difficulty: "Intermediate",
  topic: "",
  tags: [],
});

function QuestionBank() {
  const { examId: preselectedExamId } = Route.useSearch();
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [filterExamId, setFilterExamId] = useState<string>(preselectedExamId ?? "all");
  const [filterType, setFilterType] = useState(FILTER_ALL);
  const [filterTopic, setFilterTopic] = useState(FILTER_ALL);
  const [filterDifficulty, setFilterDifficulty] = useState(FILTER_ALL);
  const { data: exams = [] } = usePageDataLoad(
    "admin-questions-exams",
    async () => {
      const d = await apiAuth<{ exams: (ExamFormState & { id: string })[] }>("/api/admin/exams");
      return d.exams.map((e) => ({ id: e.id, title: e.title }));
    },
    [],
  );
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [bankFilterOptions, setBankFilterOptions] = useState<{
    topics: string[];
    types: string[];
    difficulties: string[];
  }>({ topics: [], types: [], difficulties: [] });

  usePageLoading("admin-questions", listLoading && questions.length === 0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchQuestionsPage = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      const q = buildAdminQuestionsQuery({
        filterExamId,
        search: debouncedSearch,
        filterType,
        filterTopic,
        filterDifficulty,
        limit,
        offset,
      });
      const res = await apiAuth<{ questions: QuestionRow[]; total: number; hasMore: boolean }>(
        `/api/admin/questions${q}`,
      );
      setTotalCount(res.total);
      setQuestions((prev) => (append ? [...prev, ...res.questions] : res.questions));
      return res;
    },
    [filterExamId, debouncedSearch, filterType, filterTopic, filterDifficulty],
  );

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setQuestions([]);
    void fetchQuestionsPage(0, QB_INITIAL_LIMIT, false)
      .catch(() => {
        if (!cancelled) toast.error("Could not load questions");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchQuestionsPage]);

  useEffect(() => {
    let cancelled = false;
    const examQ =
      filterExamId !== FILTER_ALL ? `?examId=${encodeURIComponent(filterExamId)}` : "";
    void apiAuth<{ topics: string[]; types: string[]; difficulties: string[] }>(
      `/api/admin/questions/filter-options${examQ}`,
    )
      .then((opts) => {
        if (!cancelled) setBankFilterOptions(opts);
      })
      .catch(() => {
        if (!cancelled) setBankFilterOptions({ topics: [], types: [], difficulties: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [filterExamId]);

  const loadMoreQuestions = async () => {
    setLoadingMore(true);
    try {
      await fetchQuestionsPage(questions.length, QB_LOAD_MORE_LIMIT, true);
    } catch {
      toast.error("Could not load more questions");
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = questions.length < totalCount;
  const [preview, setPreview] = useState<QuestionRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionFormState>(emptyQuestion());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkExamId, setBulkExamId] = useState<string>("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignExamId, setAssignExamId] = useState("");
  const [assignPool, setAssignPool] = useState<QuestionRow[]>([]);
  const [assignPoolLoading, setAssignPoolLoading] = useState(false);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignFilterSourceExam, setAssignFilterSourceExam] = useState(FILTER_ALL);
  const [assignFilterTopic, setAssignFilterTopic] = useState(FILTER_ALL);
  const [assignFilterType, setAssignFilterType] = useState(FILTER_ALL);
  const [assignFilterDifficulty, setAssignFilterDifficulty] = useState(FILTER_ALL);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const resetAssignFilters = () => {
    setAssignFilterSourceExam(FILTER_ALL);
    setAssignFilterTopic(FILTER_ALL);
    setAssignFilterType(FILTER_ALL);
    setAssignFilterDifficulty(FILTER_ALL);
  };

  useEffect(() => {
    if (preselectedExamId) setFilterExamId(preselectedExamId);
  }, [preselectedExamId]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterExamId, filterType, filterTopic, filterDifficulty, debouncedSearch]);

  const allFilteredSelected =
    questions.length > 0 && questions.every((row) => selectedIds.has(row.id));
  const selectedCount = selectedIds.size;

  const examName = (id?: string | null) => exams.find((e) => e.id === id)?.title ?? "Unassigned";

  const reloadQuestions = useCallback(async () => {
    setListLoading(true);
    try {
      await fetchQuestionsPage(0, QB_INITIAL_LIMIT, false);
    } catch {
      toast.error("Could not reload questions");
    } finally {
      setListLoading(false);
    }
  }, [fetchQuestionsPage]);

  const loadAssignPool = useCallback(async () => {
    setAssignPoolLoading(true);
    try {
      const q = buildAdminQuestionsQuery({ filterExamId: FILTER_ALL, all: true });
      const d = await apiAuth<{ questions: QuestionRow[] }>(`/api/admin/questions${q}`);
      setAssignPool(d.questions);
    } catch {
      toast.error("Could not load question bank");
      setAssignPool([]);
    } finally {
      setAssignPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    void loadAssignPool();
  }, [assignOpen, loadAssignPool]);

  /** Questions that can be linked to the target (excludes ones already on that exam) */
  const assignableForTarget = useMemo(() => {
    if (!assignExamId) return assignPool;
    return assignPool.filter((q) => q.examId !== assignExamId);
  }, [assignPool, assignExamId]);

  const alreadyOnTargetCount = useMemo(() => {
    if (!assignExamId) return 0;
    return assignPool.filter((q) => q.examId === assignExamId).length;
  }, [assignPool, assignExamId]);

  useEffect(() => {
    if (!assignExamId) return;
    setAssignSelected((prev) => {
      const next = new Set(
        [...prev].filter((id) => {
          const q = assignPool.find((x) => x.id === id);
          return q && q.examId !== assignExamId;
        }),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [assignExamId, assignPool]);

  const openCreate = () => {
    setEditId(null);
    const examId =
      filterExamId !== FILTER_ALL && filterExamId !== FILTER_UNASSIGNED ? filterExamId : preselectedExamId;
    setForm(emptyQuestion(examId));
    setFormOpen(true);
  };

  const assignFilterOptions = useMemo(() => {
    const sourceExams = new Map<string, string>([["unassigned", "Unassigned"]]);
    for (const e of exams) sourceExams.set(e.id, e.title);
    const topics = new Set<string>();
    const types = new Set<string>();
    const difficulties = new Set<string>();
    for (const q of assignableForTarget) {
      if (q.topic?.trim()) topics.add(q.topic);
      if (q.type) types.add(q.type);
      if (q.difficulty) difficulties.add(q.difficulty);
    }
    return {
      sourceExams: [...sourceExams.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      topics: [...topics].sort((a, b) => a.localeCompare(b)),
      types: [...types].sort((a, b) => a.localeCompare(b)),
      difficulties: [...difficulties].sort((a, b) => a.localeCompare(b)),
    };
  }, [assignableForTarget, exams]);

  const filteredAssignable = useMemo(() => {
    return assignableForTarget.filter((q) => {
      if (assignFilterSourceExam !== FILTER_ALL) {
        if (assignFilterSourceExam === "unassigned") {
          if (q.examId) return false;
        } else if (q.examId !== assignFilterSourceExam) return false;
      }
      if (assignFilterTopic !== FILTER_ALL && q.topic !== assignFilterTopic) return false;
      if (assignFilterType !== FILTER_ALL && q.type !== assignFilterType) return false;
      if (assignFilterDifficulty !== FILTER_ALL && q.difficulty !== assignFilterDifficulty) return false;
      return true;
    });
  }, [assignableForTarget, assignFilterSourceExam, assignFilterTopic, assignFilterType, assignFilterDifficulty]);

  const openAssign = () => {
    const examId =
      filterExamId !== FILTER_ALL && filterExamId !== FILTER_UNASSIGNED
        ? filterExamId
        : preselectedExamId ?? "";
    setAssignExamId(examId);
    setAssignSelected(new Set());
    resetAssignFilters();
    setAssignOpen(true);
  };

  const onAssignDialogOpenChange = (open: boolean) => {
    setAssignOpen(open);
    if (!open) {
      setAssignPool([]);
      setAssignSelected(new Set());
      resetAssignFilters();
    }
  };

  const openEdit = (q: QuestionRow) => {
    setEditId(q.id);
    setForm({ ...q, examId: q.examId ?? undefined });
    setFormOpen(true);
  };

  const toggleAssign = (id: string, checked: boolean) => {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const assignExisting = async () => {
    if (!assignExamId) {
      toast.error("Select the exam to assign questions to");
      return;
    }
    if (!assignSelected.size) {
      toast.error("Select at least one question");
      return;
    }
    setAssignSaving(true);
    try {
      const res = await apiAuth<{ count: number }>("/api/admin/questions/assign", {
        method: "POST",
        body: JSON.stringify({
          examId: assignExamId,
          questionIds: [...assignSelected],
        }),
      });
      toast.success(`${res.count} question(s) linked to ${examName(assignExamId)}`);
      setAssignOpen(false);
      setAssignPool([]);
      if (filterExamId === "all" || filterExamId === assignExamId) await reloadQuestions();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Assign failed");
    } finally {
      setAssignSaving(false);
    }
  };

  const save = async () => {
    if (!form.examId) {
      toast.error("Select an exam — questions must be linked to an exam to appear in attempts");
      return;
    }
    if (!form.topic.trim()) {
      toast.error("Enter or select a topic");
      return;
    }
    try {
      const body = { ...form, examId: form.examId, topic: form.topic.trim() };
      if (editId) {
        await apiAuth(`/api/admin/questions/${editId}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("Question updated");
      } else {
        await apiAuth("/api/admin/questions", { method: "POST", body: JSON.stringify(body) });
        toast.success("Question created and linked to exam");
      }
      setFormOpen(false);
      await reloadQuestions();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await apiAuth(`/api/admin/questions/${id}`, { method: "DELETE" });
      toast.success("Question deleted");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await reloadQuestions();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of questions) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const bulkDeleteSelected = async () => {
    if (!selectedCount) return;
    if (!confirm(`Delete ${selectedCount} selected question(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const chunkSize = 500;
      let total = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const res = await apiAuth<{ count: number }>("/api/admin/questions/bulk-delete", {
          method: "POST",
          body: JSON.stringify({ questionIds: chunk }),
        });
        total += res.count;
      }
      toast.success(`${total} question(s) deleted`);
      setSelectedIds(new Set());
      await reloadQuestions();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkParsedCount = useMemo(() => parseQuestionCsv(bulkText, bulkExamId || undefined).length, [bulkText, bulkExamId]);

  const importBulk = async () => {
    const targetExamId =
      bulkExamId ||
      (filterExamId !== FILTER_ALL && filterExamId !== FILTER_UNASSIGNED ? filterExamId : "");
    if (!targetExamId) {
      toast.error("Select an exam for bulk import");
      return;
    }
    const items = parseQuestionCsv(bulkText, targetExamId);
    if (!items.length) return toast.error("Upload or paste CSV using the template");
    try {
      const res = await apiAuth<{ count: number }>("/api/admin/questions/bulk", {
        method: "POST",
        body: JSON.stringify({ questions: items }),
      });
      toast.success(`${res.count} questions imported for ${examName(targetExamId)}`);
      setBulkOpen(false);
      setBulkText("");
      await reloadQuestions();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Import failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        sub="Create questions or link existing ones from the bank to an exam."
        action={
          <div className="flex flex-wrap gap-2">
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                disabled={bulkDeleting}
                onClick={() => void bulkDeleteSelected()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {bulkDeleting ? "Deleting…" : `Delete selected (${selectedCount})`}
              </Button>
            )}
            <Button variant="outline" onClick={downloadCsvTemplate}>Download template</Button>
            <Button variant="outline" onClick={openAssign}>
              <Link2 className="mr-2 h-4 w-4" />Assign existing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBulkExamId(
                  filterExamId !== FILTER_ALL && filterExamId !== FILTER_UNASSIGNED ? filterExamId : "",
                );
                setBulkOpen(true);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />Bulk upload
            </Button>
            <Button className="bg-gradient-emerald text-white" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />Add question
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Exam</Label>
          <Select value={filterExamId} onValueChange={setFilterExamId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All exams</SelectItem>
              <SelectItem value={FILTER_UNASSIGNED}>Unassigned</SelectItem>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All types</SelectItem>
              {bankFilterOptions.types.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Difficulty</Label>
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All difficulties</SelectItem>
              {bankFilterOptions.difficulties.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Topic</Label>
          <Select value={filterTopic} onValueChange={setFilterTopic}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All topics" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All topics</SelectItem>
              {bankFilterOptions.topics.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterType !== FILTER_ALL || filterTopic !== FILTER_ALL || filterDifficulty !== FILTER_ALL) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterType(FILTER_ALL);
              setFilterTopic(FILTER_ALL);
              setFilterDifficulty(FILTER_ALL);
            }}
          >
            Clear filters
          </Button>
        )}
        {preselectedExamId && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/questions" search={{}}>Clear exam filter</Link>
          </Button>
        )}
      </div>

      <DataToolbar search={search} onSearch={setSearch} placeholder="Search questions..." hideInput />

      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {questions.length} of {totalCount} question{totalCount === 1 ? "" : "s"}
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
        </p>
      )}

      <div className="table-panel overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="w-10 p-4">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(v) => toggleSelectAllFiltered(v === true)}
                  aria-label="Select all loaded questions"
                />
              </th>
              <th className="p-4">Question</th>
              <th>Exam</th>
              <th>Type</th>
              <th>Difficulty</th>
              <th>Topic</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listLoading && questions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading questions…
                </td>
              </tr>
            )}
            {!listLoading && questions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No questions match your filters. Click <strong>Add question</strong> or <strong>Assign existing</strong>.
                </td>
              </tr>
            )}
            {questions.map((q) => (
              <tr key={q.id} className={`border-b hover:bg-muted/20 ${selectedIds.has(q.id) ? "bg-muted/30" : ""}`}>
                <td className="p-4">
                  <Checkbox
                    checked={selectedIds.has(q.id)}
                    onCheckedChange={(v) => toggleRowSelected(q.id, v === true)}
                    aria-label={`Select question ${q.title.slice(0, 40)}`}
                  />
                </td>
                <td className="max-w-md p-4"><div className="line-clamp-2 font-medium">{q.title}</div></td>
                <td className="p-4 text-xs">{q.examTitle ?? examName(q.examId) ?? "—"}</td>
                <td className="p-4">{q.type}</td>
                <td className="p-4"><Badge variant="secondary">{q.difficulty}</Badge></td>
                <td className="p-4">{q.topic}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setPreview(q)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="flex justify-center border-t border-border bg-muted/20 p-4">
            <Button variant="outline" onClick={() => void loadMoreQuestions()} disabled={loadingMore}>
              {loadingMore
                ? "Loading…"
                : `Show more (${Math.min(QB_LOAD_MORE_LIMIT, totalCount - questions.length)} more)`}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit question" : "Add question"}</DialogTitle>
            <DialogDescription>
              {editId
                ? "Update question text, answers, topic, or the linked exam."
                : "Create a new question and link it to an exam for candidate attempts."}
            </DialogDescription>
          </DialogHeader>
          {formOpen && (
            <QuestionFormFields form={form} onChange={setForm} exams={exams} />
          )}
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={onAssignDialogOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl flex-col gap-4 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Assign existing questions</DialogTitle>
            <DialogDescription>
              Choose the destination exam, then select questions from the full bank. Questions already on that exam are hidden automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <Label>Link selected questions to exam *</Label>
            <Select
              value={assignExamId || undefined}
              onValueChange={(examId) => {
                setAssignExamId(examId);
                if (assignFilterSourceExam === examId) setAssignFilterSourceExam(FILTER_ALL);
              }}
            >
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select destination exam" /></SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignExamId && alreadyOnTargetCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {alreadyOnTargetCount} question{alreadyOnTargetCount === 1 ? " is" : "s are"} already on this exam and hidden from the list.
              </p>
            )}
          </div>

          {assignPool.length > 0 && !assignPoolLoading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Current exam</Label>
                <Select value={assignFilterSourceExam} onValueChange={setAssignFilterSourceExam}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All exams</SelectItem>
                    {assignFilterOptions.sourceExams.map(([id, title]) => (
                      <SelectItem key={id} value={id}>{title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Topic</Label>
                <Select value={assignFilterTopic} onValueChange={setAssignFilterTopic}>
                  <SelectTrigger><SelectValue placeholder="All topics" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All topics</SelectItem>
                    {assignFilterOptions.topics.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={assignFilterType} onValueChange={setAssignFilterType}>
                  <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All types</SelectItem>
                    {assignFilterOptions.types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Difficulty</Label>
                <Select value={assignFilterDifficulty} onValueChange={setAssignFilterDifficulty}>
                  <SelectTrigger><SelectValue placeholder="All levels" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All difficulties</SelectItem>
                    {assignFilterOptions.difficulties.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {assignPool.length > 0 && !assignPoolLoading && (
            <p className="text-xs text-muted-foreground">
              {!assignExamId
                ? `Loaded ${assignPool.length} questions — select a destination exam to assign.`
                : `Showing ${filteredAssignable.length} of ${assignableForTarget.length} available (${assignPool.length} in bank)`}
              {assignSelected.size > 0 && ` · ${assignSelected.size} selected`}
            </p>
          )}

          <div className="min-h-[240px] flex-1 overflow-auto rounded-lg border border-border">
            {assignPoolLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading question bank…</p>
            ) : assignPool.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No questions in the bank yet. Create questions first.</p>
            ) : !assignExamId ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Select a destination exam above to choose which questions to link.
              </p>
            ) : assignableForTarget.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Every question in the bank is already on {examName(assignExamId)}. Create more questions or pick another exam.
              </p>
            ) : filteredAssignable.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No questions match the current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Question</TableHead>
                    <TableHead>Current exam</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignable.map((q) => (
                    <TableRow key={q.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          id={`assign-${q.id}`}
                          checked={assignSelected.has(q.id)}
                          onCheckedChange={(c) => toggleAssign(q.id, c === true)}
                        />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <label htmlFor={`assign-${q.id}`} className="line-clamp-2 cursor-pointer text-sm font-medium">
                          {q.title}
                        </label>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {q.examTitle ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs">{q.topic}</TableCell>
                      <TableCell className="text-xs">{q.type}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{q.difficulty}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onAssignDialogOpenChange(false)}>Cancel</Button>
            <Button onClick={assignExisting} disabled={assignSaving || !assignExamId || !assignSelected.size}>
              {assignSaving
                ? "Assigning…"
                : assignSelected.size
                  ? `Assign ${assignSelected.size} question${assignSelected.size === 1 ? "" : "s"}`
                  : "Assign selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Question preview</DialogTitle>
            <DialogDescription>Read-only view of question and answers.</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">Exam: {preview.examTitle ?? examName(preview.examId)}</p>
              <p className="font-medium">{preview.title}</p>
              <QuestionCodeBlock code={preview.code} />
              <p className="text-xs text-muted-foreground">Topic: {preview.topic}</p>
              <ul className="list-inside list-disc text-muted-foreground">{preview.options.map((o) => <li key={o}>{o}</li>)}</ul>
              <p><span className="text-muted-foreground">Answer:</span> {preview.correctAnswer}</p>
              <p className="text-muted-foreground">{preview.explanation}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk upload (CSV)</DialogTitle>
            <DialogDescription>
              Columns: title, code, type, topic, difficulty, option1–4, correctAnswer, explanation. Leave code empty when not needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Assign to exam *</Label>
            <Select value={bulkExamId || undefined} onValueChange={setBulkExamId}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <QuestionCsvBulkInput
            value={bulkText}
            onChange={setBulkText}
            parsedCount={bulkParsedCount}
            parsedCountLabel="question(s) ready to import"
            id="qb-csv-file"
          />
          <DialogFooter><Button onClick={importBulk}>Import</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
