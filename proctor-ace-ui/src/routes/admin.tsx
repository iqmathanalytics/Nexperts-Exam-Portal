import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { ClientOnly } from "@/components/client-only";
import { PageLoader } from "@/components/page-loader";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireAuth("admin"),
  component: () => (
    <ClientOnly fallback={<PageLoader />}>
      <AdminLayout />
    </ClientOnly>
  ),
  pendingComponent: PageLoader,
  pendingMs: 120,
});
