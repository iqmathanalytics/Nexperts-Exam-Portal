import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Plus, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { apiAuth } from "@/lib/api-auth";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";
import type { ExamFormState } from "@/lib/types";

type ExamRow = ExamFormState & { id: string };

export const Route = createFileRoute("/admin/exams/")({
  component: AdminExams,
});

function AdminExams() {
  const navigate = useNavigate();
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [exams, setExams] = useState<ExamRow[]>([]);

  const load = useCallback(async () => {
    const d = await apiAuth<{ exams: ExamRow[] }>("/api/admin/exams");
    setExams(d.exams);
  }, []);

  usePageDataLoad(
    "admin-exams",
    async () => {
      try {
        await load();
      } catch {
        toast.error("Failed to load exams");
      }
    },
    [],
  );

  const filtered = exams.filter(
    (e) => e.title.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()),
  );

  const togglePublish = async (e: ExamRow) => {
    const next = e.status === "Published" ? "Draft" : "Published";
    try {
      await apiAuth(`/api/admin/exams/${e.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "Published" ? "Exam published" : "Exam unpublished");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  };

  const duplicate = async (id: string) => {
    try {
      await apiAuth(`/api/admin/exams/${id}/duplicate`, { method: "POST" });
      toast.success("Exam duplicated");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Duplicate failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this exam?")) return;
    try {
      await apiAuth(`/api/admin/exams/${id}`, { method: "DELETE" });
      toast.success("Exam deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam management"
        sub="Create, publish, and configure proctored certification exams."
        action={
          <Button className="bg-gradient-emerald text-white" onClick={() => navigate({ to: "/admin/exams/new" })}>
            <Plus className="mr-2 h-4 w-4" />Create exam
          </Button>
        }
      />
      <DataToolbar search={search} onSearch={setSearch} placeholder="Search exams..." hideInput />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">Title</th><th>Category</th><th>Duration</th><th>Price</th><th>Status</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border/60 hover:bg-muted/20">
                <td className="p-4 font-medium">{e.title}</td>
                <td className="p-4">{e.category}</td>
                <td className="p-4">{e.duration} min</td>
                <td className="p-4">MYR {e.price}</td>
                <td className="p-4"><StatusBadge status={e.status} /></td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate({ to: "/admin/exams/$examId", params: { examId: e.id } })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(e.id)}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => togglePublish(e)}>
                      {e.status === "Published" ? "Unpub" : "Pub"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
