import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { ExamForm, getDefaultExamForm } from "@/components/exam-form";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/exams/new")({
  component: CreateExam,
});

function CreateExam() {
  const navigate = useNavigate();
  const [form, setForm] = useState(getDefaultExamForm());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await apiAuth("/api/admin/exams", { method: "POST", body: JSON.stringify(form) });
      toast.success("Exam created");
      navigate({ to: "/admin/exams" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/exams"><ArrowLeft className="mr-2 h-4 w-4" />Back to exams</Link>
      </Button>
      <PageHeader title="Create exam" sub="Configure exam settings and proctoring rules." />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <ExamForm form={form} onChange={setForm} onSubmit={submit} submitLabel={saving ? "Saving…" : "Create exam"} />
      </div>
    </div>
  );
}
