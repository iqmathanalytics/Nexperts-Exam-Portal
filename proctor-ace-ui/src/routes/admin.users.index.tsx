import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { apiAuth, downloadAuthCsv } from "@/lib/api-auth";
import { useAdminSearch } from "@/contexts/admin-search-context";
import { usePageDataLoad } from "@/contexts/page-load-context";
import { ApiError } from "@/lib/api-client";
import { Download, Eye, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge, DataToolbar } from "@/components/admin-bits";
import { Button } from "@/components/ui/button";

type UserRow = { id: string; name: string; email: string; phone: string; icPassport: string; status: string; examsTaken: number; violations: number };

export const Route = createFileRoute("/admin/users/")({
  component: AdminUsers,
});

function AdminUsers() {
  const navigate = useNavigate();
  const { query: search, setQuery: setSearch } = useAdminSearch();
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    const d = await apiAuth<{ users: UserRow[] }>("/api/admin/users");
    setUsers(d.users);
  }, []);

  usePageDataLoad("admin-users", load, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleStatus = async (u: UserRow) => {
    const next = u.status === "ACTIVE" || u.status === "Active" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiAuth(`/api/admin/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(next === "SUSPENDED" ? "User suspended" : "User reactivated");
      load();
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
    </div>
  );
}
