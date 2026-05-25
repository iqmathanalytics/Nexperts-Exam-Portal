import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { LoadingTabs } from "@/components/loading-tabs";
import { usePageDataLoad } from "@/contexts/page-load-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";

type UserDetail = {
  user: { id: string; name: string; email: string; icPassport: string; status: string };
  attempts: { id: string; exam: string; examId?: string; date: string; score: number; result: string }[];
  payments: { id: string; exam: string; amount: number; status: string; date: string }[];
  violations: { type: string; detail: string; date: string }[];
  certificates: { exam: string; credentialId: string; score: number }[];
};

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserProfile,
});

function UserProfile() {
  const { userId } = Route.useParams();
  const [data, setData] = useState<UserDetail | null>(null);
  const [resetExamId, setResetExamId] = useState<string>("all");
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    const d = await apiAuth<UserDetail>(`/api/admin/users/${userId}`);
    setData(d);
  };

  usePageDataLoad(
    "admin-user-detail",
    async () => {
      try {
        await load();
      } catch {
        toast.error("User not found");
      }
    },
    [userId],
  );

  const examOptions = data
    ? [...new Map(
        data.attempts
          .filter((a) => a.examId)
          .map((a) => [a.examId!, { examId: a.examId!, title: a.exam }]),
      ).values()]
    : [];

  const resetAttempts = async () => {
    setResetting(true);
    try {
      const body = resetExamId === "all" ? {} : { examId: resetExamId };
      const res = await apiAuth<{ deleted: number; message: string }>(
        `/api/admin/users/${userId}/reset-attempts`,
        { method: "POST", body: JSON.stringify(body) },
      );
      toast.success(res.message || `Removed ${res.deleted} attempt(s)`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  if (!data) return null;
  const { user, attempts, payments, violations, certificates } = data;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" />Back to users</Link>
      </Button>
      <PageHeader title={user.name} sub={user.email} />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Testing: reset exam attempts</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Removes attempts so the candidate can start fresh. Does not remove payments or certificates.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <Select value={resetExamId} onValueChange={setResetExamId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All exams</SelectItem>
                  {examOptions.map((e) => (
                    <SelectItem key={e.examId} value={e.examId}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-300">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset attempts
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset exam attempts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes {resetExamId === "all" ? "all" : "matching"} exam attempts for{" "}
                    <strong>{user.name}</strong>. Use only for testing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={resetting}
                    onClick={() => void resetAttempts()}
                  >
                    {resetting ? "Resetting…" : "Reset"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Status", user.status],
          ["IC / Passport", user.icPassport],
          ["Exams taken", String(attempts.length)],
          ["Violations", String(violations.length)],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l as string}</div>
            <div className="mt-1 font-medium">{l === "Status" ? <StatusBadge status={v as string} /> : v}</div>
          </div>
        ))}
      </div>

      <LoadingTabs
        tabs={[
          {
            value: "history",
            label: "Exam history",
            content: attempts.length ? (
              attempts.map((r) => (
                <div key={r.id} className="flex justify-between border-b py-3 last:border-0">
                  <span>{r.exam} · {r.date}</span>
                  <span>{r.score}% · <StatusBadge status={r.result} /></span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No exam attempts</p>
            ),
          },
          {
            value: "payments",
            label: "Payments",
            content: payments.length ? (
              payments.map((p) => (
                <div key={p.id} className="flex justify-between border-b py-3">
                  <span>{p.exam}</span>
                  <span>MYR {p.amount} · <StatusBadge status={p.status} /></span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payments</p>
            ),
          },
          {
            value: "violations",
            label: "Violations",
            content: violations.length ? (
              <ul className="space-y-2 text-sm">
                {violations.map((v, i) => (
                  <li key={i}>{v.type} — {v.detail} · {v.date}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No violations recorded</p>
            ),
          },
          {
            value: "certificates",
            label: "Certificates",
            content: certificates.length ? (
              certificates.map((c, i) => (
                <div key={i} className="flex justify-between border-b py-3">
                  <span>{c.exam}</span>
                  <span className="font-mono text-xs">{c.credentialId} · {c.score}%</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No certificates</p>
            ),
          },
        ]}
      />
    </div>
  );
}
