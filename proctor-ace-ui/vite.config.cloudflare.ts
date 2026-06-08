// Cloudflare Workers build — use: npm run build:cloudflare
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      server: { entry: "./src/server.ts" },
    }),
    viteReact(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    include: ["react-day-picker"],
  },
});
