import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award, LayoutDashboard, ClipboardList, History, CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/exam-complete")({
  beforeLoad: () => requireAuth("candidate"),
  validateSearch: (s: Record<string, unknown>) => ({
    score: Number(s.score) || 0,
    result: String(s.result ?? "Fail"),
    passed: s.passed === "1" || s.passed === 1 || s.passed === true,
    exam: String(s.exam ?? "Exam"),
    passScore: Number(s.passScore) || 70,
    credentialId: String(s.credentialId ?? ""),
  }),
  component: ExamCompletePage,
  head: () => ({ meta: [{ title: "Exam complete — Certification Portal" }] }),
});

function ExamCompletePage() {
  const { score, result, passed, exam, passScore, credentialId } = Route.useSearch();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <BrandLogo to="/dashboard" className="mb-8" />

      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-elevated">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            passed ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {passed ? <CheckCircle2 className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">Thank you for completing your exam</h1>
        <p className="mt-2 text-sm text-muted-foreground">{exam}</p>

        <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Your score</div>
          <div className={`mt-2 font-display text-5xl font-bold ${passed ? "text-success" : "text-destructive"}`}>
            {score}%
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge className={passed ? "border-0 bg-success/15 text-success" : "border-0 bg-destructive/15 text-destructive"}>
              {result}
            </Badge>
            <span className="text-xs text-muted-foreground">Pass mark: {passScore}%</span>
          </div>
        </div>

        {passed ? (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/5 p-4 text-left">
            <div className="flex items-center gap-2 font-medium text-success">
              <Award className="h-5 w-5" />
              Congratulations — you passed!
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your certificate is ready. View, download, or share it from the Certificates section.
            </p>
            {credentialId && (
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">ID: {credentialId}</p>
            )}
            <Button asChild className="mt-4 w-full bg-gradient-emerald text-white">
              <Link to="/dashboard/certificates">
                View my certificate <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {credentialId && (
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/certificate/$credentialId" params={{ credentialId }}>
                  Open shareable certificate page
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            You did not reach the pass mark this time. Review your history and try again from My Exams if you have attempts left.
          </p>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Continue to dashboard
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/dashboard/my-exams"><ClipboardList className="mr-2 h-4 w-4" /> My Exams</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/dashboard/history"><History className="mr-2 h-4 w-4" /> Exam History</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/dashboard/certificates"><Award className="mr-2 h-4 w-4" /> Certificates</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
