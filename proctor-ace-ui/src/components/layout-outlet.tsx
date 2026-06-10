import { Outlet, useRouterState } from "@tanstack/react-router";
import { PageLoader } from "@/components/page-loader";

export function LayoutOutlet() {
  const routerPending = useRouterState({
    select: (s) => s.isLoading || s.status === "pending",
  });

  return (
    <div className="relative min-h-[320px]">
      <Outlet />
      {routerPending && <PageLoader overlay label="Loading…" />}
    </div>
  );
}
