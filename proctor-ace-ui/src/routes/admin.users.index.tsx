import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Download, Eye, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiAuth, downloadAuthCsv } from "@/lib/api-auth";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { usePageDataLoad, useInvalidateSession } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";

type UserRow = { id: string; name: string; email: string; phone: string; icPassport: string; status: string; examsTaken: number; violations: number };
type ExamOption = { id: string; title: string; status: string };

export const Route = createFileRoute("/admin/users/")({
  component: AdminUsers,
});

function AdminUsers() {
  const navigate = useNavigate();
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const invalidateSession = useInvalidateSession();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<UserRow | null>(null);
  const [assignExamId, setAssignExamId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const { data: users = [] } = usePageDataLoad(
    "admin-users",
    async () => {
      const d = await apiAuth<{ users: UserRow[] }>("/api/admin/users");
      return d.users;
    },
    [],
  );
  const { data: exams = [] } = usePageDataLoad(
    "admin-assign-exam-list",
    async () => {
      const d = await apiAuth<{ exams: ExamOption[] }>("/api/admin/exams");
      return d.exams.map((e) => ({ id: e.id, title: e.title, status: e.status }));
    },
    [],
    { enabled: assignOpen },
  );

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const openAssign = (u: UserRow) => {
    setAssignUser(u);
    setAssignExamId("");
    setAssignOpen(true);
  };

  const assignExam = async () => {
    if (!assignUser || !assignExamId) {
      toast.error("Select an exam");
      return;
    }
    setAssigning(true);
    try {
      const res = await apiAuth<{
        payment: { candidate: string; exam: string };
      }>("/api/admin/exams/assign", {
        method: "POST",
        body: JSON.stringify({
          userId: assignUser.id,
          examId: assignExamId,
          startImmediately: true,
        }),
      });
      toast.success(`Assigned ${res.payment.exam} to ${res.payment.candidate}`);
      setAssignOpen(false);
      setAssignUser(null);
      setAssignExamId("");
      invalidateSession("admin-users");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const toggleStatus = async (u: UserRow) => {
    const next = u.status === "ACTIVE" || u.status === "Active" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiAuth(`/api/admin/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(next === "SUSPENDED" ? "User suspended" : "User reactivated");
      invalidateSession("admin-users");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    }
  };

  const downloadReport = async (u: UserRow) => {
    try {
      await downloadAuthCsv(`/api/admin/users/${u.id}/report`, `user-${u.name.replace(/\s+/g, "-")}-report.csv`);
      toast.success(`Report downloaded for ${u.name}`);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        sub="View opens the candidate profile. Download exports a CSV report (profile, attempts, payments, violations)."
      />
      <DataToolbar search={search} onSearch={setSearch} placeholder="Search users..." hideInput />
      <div className="table-panel overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">Name</th><th>Email</th><th>IC / Passport</th><th>Exams</th><th>Violations</th><th>Status</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b hover:bg-muted/20">
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4">{u.email}</td>
                <td className="p-4 font-mono text-xs">{u.icPassport}</td>
                <td className="p-4">{u.examsTaken}</td>
                <td className="p-4">{u.violations}</td>
                <td className="p-4"><StatusBadge status={u.status} /></td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: "/admin/users/$userId", params: { userId: u.id } })}
                    >
                      <Eye className="mr-1 h-3 w-3" />View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Assign exam for testing"
                      onClick={() => openAssign(u)}
                    >
                      <BookOpen className="mr-1 h-3 w-3" />Assign exam
                    </Button>
                    <Button variant="ghost" size="icon" title="Download CSV report" onClick={() => downloadReport(u)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Suspend / reactivate" onClick={() => toggleStatus(u)}>
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign exam (testing)</DialogTitle>
            <DialogDescription>
              Grant a candidate access to an exam without payment. The exam opens immediately under My Exams so they can start testing.
            </DialogDescription>
          </DialogHeader>
          {assignUser && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="text-xs text-muted-foreground">Candidate</div>
                <div className="font-medium">{assignUser.name}</div>
                <div className="text-xs text-muted-foreground">{assignUser.email}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Exam</Label>
                <Select value={assignExamId} onValueChange={setAssignExamId}>
                  <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>
                    {exams.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} ({e.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={assigning || !assignExamId}
              onClick={assignExam}
            >
              {assigning ? "Assigning…" : "Assign exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
