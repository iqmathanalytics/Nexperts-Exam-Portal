import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

import appCss from "../styles.css?url";
import { BRAND } from "@/lib/branding";
import { clearPersistedCache } from "@/lib/query-client";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: "Ventrix Global delivers secure, AI-proctored certification exams with enterprise-grade compliance and verifiable credentials." },
      { property: "og:title", content: BRAND.name },
      { property: "og:description", content: BRAND.tagline },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/ventrix_logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nx-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    clearPersistedCache();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="mobile-shell">
          <Outlet />
        </div>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">Go home</a>
      </div>
    </div>
  );
}

function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}
