import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageDataLoad, useInvalidateSession } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
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
import { apiAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-client";

type Cert = {
  id: string;
  userId: string;
  examId: string;
  candidate: string;
  exam: string;
  credentialId: string;
  issuedOn: string;
  score: number;
};

type UserOption = { id: string; name: string; email: string };
type ExamOption = { id: string; title: string; status: string };

export const Route = createFileRoute("/admin/certificates")({
  component: AdminCertificates,
});

function AdminCertificates() {
  const [filterExam, setFilterExam] = useState("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignExamId, setAssignExamId] = useState("");
  const [assignScore, setAssignScore] = useState("100");
  const [assigning, setAssigning] = useState(false);
  const { query: searchStudent } = useAdminSearch();
  const invalidateSession = useInvalidateSession();
  const { data: certs = [] } = usePageDataLoad(
    "admin-certificates",
    async () => {
      const d = await apiAuth<{ certificates: Cert[] }>("/api/admin/certificates");
      return d.certificates;
    },
    [],
  );
  const { data: users = [] } = usePageDataLoad(
    "admin-cert-assign-users",
    async () => {
      const d = await apiAuth<{ users: UserOption[] }>("/api/admin/users");
      return d.users.map((u) => ({ id: u.id, name: u.name, email: u.email }));
    },
    [],
    { enabled: assignOpen },
  );
  const { data: exams = [] } = usePageDataLoad(
    "admin-cert-assign-exams",
    async () => {
      const d = await apiAuth<{ exams: ExamOption[] }>("/api/admin/exams");
      return d.exams.map((e) => ({ id: e.id, title: e.title, status: e.status }));
    },
    [],
    { enabled: assignOpen },
  );

  const examOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of certs) map.set(c.examId, c.exam);
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [certs]);

  const filtered = certs.filter((c) => {
    if (filterExam !== "all" && c.examId !== filterExam) return false;
    if (searchStudent.trim()) {
      const q = searchStudent.toLowerCase();
      const match =
        c.candidate.toLowerCase().includes(q) ||
        c.exam.toLowerCase().includes(q) ||
        c.credentialId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const regenerate = async (id: string) => {
    try {
      const res = await apiAuth<{ credentialId: string }>(`/api/admin/certificates/${id}/regenerate`, { method: "POST" });
      toast.success(`Regenerated: ${res.credentialId}`);
      invalidateSession("admin-certificates");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Regenerate failed");
    }
  };

  const assignCertificate = async () => {
    if (!assignUserId || !assignExamId) {
      toast.error("Select a user and exam");
      return;
    }
    const score = Number(assignScore);
    if (Number.isNaN(score) || score < 0 || score > 100) {
      toast.error("Score must be between 0 and 100");
      return;
    }
    setAssigning(true);
    try {
      const res = await apiAuth<{
        certificate: Cert;
        replaced: boolean;
      }>("/api/admin/certificates/assign", {
        method: "POST",
        body: JSON.stringify({ userId: assignUserId, examId: assignExamId, score }),
      });
      toast.success(
        res.replaced
          ? `Certificate updated for ${res.certificate.candidate}`
          : `Certificate assigned to ${res.certificate.candidate}`,
      );
      setAssignOpen(false);
      setAssignUserId("");
      setAssignExamId("");
      setAssignScore("100");
      invalidateSession("admin-certificates");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const download = (c: Cert) => {
    const text = `NExperts Certified\n${c.candidate}\n${c.exam}\n${c.credentialId}\nScore: ${c.score}%\nIssued: ${c.issuedOn}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.credentialId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        sub="Issue tracking, regeneration, and credential IDs."
        action={
          <Button
            className="bg-gradient-emerald text-white"
            onClick={() => setAssignOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Assign for testing
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Filter by exam</Label>
          <Select value={filterExam} onValueChange={setFilterExam}>
            <SelectTrigger className="w-64"><SelectValue placeholder="All exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {examOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-4">Candidate</th><th>Exam</th><th>Credential ID</th><th>Score</th><th>Issued</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No certificates yet. Use Assign for testing to issue one to a candidate.
                </td>
              </tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/20">
                <td className="p-4 font-medium">{c.candidate}</td>
                <td className="p-4">{c.exam}</td>
                <td className="p-4 font-mono text-xs">
                  <Link
                    to="/certificate/$credentialId"
                    params={{ credentialId: c.credentialId }}
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                    target="_blank"
                  >
                    {c.credentialId}
                  </Link>
                </td>
                <td className="p-4">{c.score}%</td>
                <td className="p-4">{c.issuedOn}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => download(c)}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => regenerate(c.id)}><RefreshCw className="h-4 w-4" /></Button>
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
            <DialogTitle>Assign certificate (testing)</DialogTitle>
            <DialogDescription>
              Issue a certificate to any candidate without requiring a passed exam attempt. Re-assigning the same user and exam replaces the existing credential.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Candidate</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label className="text-xs">Score (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={assignScore}
                onChange={(e) => setAssignScore(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-emerald text-white"
              disabled={assigning || !assignUserId || !assignExamId}
              onClick={assignCertificate}
            >
              {assigning ? "Assigning…" : "Assign certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
