import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/exams")({
  component: AdminExamsLayout,
});

function AdminExamsLayout() {
  return <Outlet />;
}
