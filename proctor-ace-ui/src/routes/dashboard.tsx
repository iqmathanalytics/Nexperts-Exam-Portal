import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ClientOnly } from "@/components/client-only";
import { PageLoader } from "@/components/page-loader";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => requireAuth("candidate"),
  component: () => (
    <ClientOnly fallback={<PageLoader />}>
      <DashboardLayout />
    </ClientOnly>
  ),
  pendingComponent: PageLoader,
  pendingMs: 120,
});
