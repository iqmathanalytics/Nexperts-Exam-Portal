import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageDataLoad, useInvalidateSession } from "@/contexts/page-load-context";
import { useAdminSearch } from "@/contexts/admin-search-context";
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

export const Route = createFileRoute("/admin/certificates")({
  component: AdminCertificates,
});

function AdminCertificates() {
  const [filterExam, setFilterExam] = useState("all");
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
      <PageHeader title="Certificates" sub="Issue tracking, regeneration, and credential IDs." />

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
            {filtered.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/20">
                <td className="p-4 font-medium">{c.candidate}</td>
                <td className="p-4">{c.exam}</td>
                <td className="p-4 font-mono text-xs">{c.credentialId}</td>
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
    </div>
  );
}
