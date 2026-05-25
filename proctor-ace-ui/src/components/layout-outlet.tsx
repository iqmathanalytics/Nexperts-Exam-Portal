import { useEffect, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { PageLoader } from "@/components/page-loader";
import { usePageReady } from "@/contexts/page-load-context";
import { cn } from "@/lib/utils";

export function LayoutOutlet() {
  const [mounted, setMounted] = useState(false);
  const routerPending = useRouterState({
    select: (s) => s.isLoading || s.status === "pending",
  });
  const pageReady = usePageReady();

  useEffect(() => {
    setMounted(true);
  }, []);

  const showLoader = mounted && (routerPending || !pageReady);

  return (
    <div className="relative min-h-[320px]">
      <div className={cn("transition-opacity duration-150", showLoader && "opacity-0")}>
        <Outlet />
      </div>
      {showLoader && <PageLoader overlay label="Loading…" />}
    </div>
  );
}
