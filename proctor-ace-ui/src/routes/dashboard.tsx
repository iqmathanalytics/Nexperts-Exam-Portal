import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageLoader } from "@/components/page-loader";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireAuth("candidate"),
  component: DashboardLayout,
  pendingComponent: PageLoader,
  pendingMs: 120,
});
