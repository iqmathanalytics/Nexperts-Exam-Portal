import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageDataLoad } from "@/contexts/page-load-context";
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
  const [certs, setCerts] = useState<Cert[]>([]);
  const [filterExam, setFilterExam] = useState("all");
  const { query: searchStudent } = useAdminSearch();

  const load = useCallback(async () => {
    const d = await apiAuth<{ certificates: Cert[] }>("/api/admin/certificates");
    setCerts(d.certificates);
  }, []);

  usePageDataLoad(
    "admin-certificates",
    async () => {
      try {
        await load();
      } catch {
        toast.error("Failed to load certificates");
      }
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
      load();
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
      <PageHeader title="Certificate management" sub="Download, regenerate, and manage issued credentials." />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label className="text-xs">Filter by exam</Label>
          <Select value={filterExam} onValueChange={setFilterExam}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {examOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {searchStudent.trim() && (
          <p className="text-sm text-muted-foreground self-center">
            Header search: <span className="font-medium text-foreground">&quot;{searchStudent}&quot;</span>
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {certs.length === 0 ? "No certificates issued yet." : "No certificates match your filters."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="rounded-xl bg-gradient-hero p-6 text-white">
                <div className="text-xs uppercase tracking-wider opacity-80">NExperts Certified</div>
                <div className="mt-2 font-display text-xl font-bold">{c.candidate}</div>
                <div className="mt-1 text-sm opacity-90">{c.exam}</div>
                <div className="mt-4 font-mono text-xs opacity-75">{c.credentialId}</div>
                <div className="mt-2 text-sm">Score: {c.score}% · {c.issuedOn}</div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => download(c)}>
                  <Download className="mr-1 h-3 w-3" />Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => regenerate(c.id)}>
                  <RefreshCw className="mr-1 h-3 w-3" />Regenerate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
