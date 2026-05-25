import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { PageLoader } from "@/components/page-loader";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireAuth("admin"),
  component: AdminLayout,
  pendingComponent: PageLoader,
  pendingMs: 120,
});
