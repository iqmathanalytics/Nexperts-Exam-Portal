import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { ExamForm, examToForm } from "@/components/exam-form";
import { apiAuth } from "@/lib/api-auth";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";
import type { ExamFormState } from "@/lib/types";

export const Route = createFileRoute("/admin/exams/$examId")({
  beforeLoad: ({ params }) => {
    if (params.examId === "new") {
      throw redirect({ to: "/admin/exams/new" });
    }
  },
  component: EditExam,
});

function EditExam() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ExamFormState | null>(null);
  const [saving, setSaving] = useState(false);

  usePageDataLoad(
    "edit-exam",
    async () => {
      try {
        const d = await apiAuth<{ exam: ExamFormState & { id: string } }>(`/api/admin/exams/${examId}`);
        setForm(examToForm(d.exam));
      } catch {
        toast.error("Exam not found");
      }
    },
    [examId],
  );

  if (!form) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await apiAuth(`/api/admin/exams/${examId}`, { method: "PUT", body: JSON.stringify(form) });
      toast.success("Exam updated");
      navigate({ to: "/admin/exams" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/exams"><ArrowLeft className="mr-2 h-4 w-4" />Back to exams</Link>
      </Button>
      <PageHeader
        title="Edit exam"
        sub={form.title}
        action={
          <Button asChild variant="outline">
            <Link to="/admin/questions" search={{ examId }}>Manage questions</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        Questions are linked to this exam in the Question Bank. Set &quot;Total questions&quot; on the exam to how many are served per attempt (up to the number you add).
      </p>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <ExamForm form={form} onChange={setForm} onSubmit={submit} submitLabel={saving ? "Saving…" : "Save exam"} />
      </div>
    </div>
  );
}
