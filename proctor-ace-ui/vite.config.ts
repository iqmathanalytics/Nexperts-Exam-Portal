// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// For Cloudflare local dev, wrangler.jsonc still points at src/server.ts.
// For Netlify production, @netlify/vite-plugin-tanstack-start configures the build output.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [netlify()],
    optimizeDeps: {
      include: ["react-day-picker"],
    },
  },
});
