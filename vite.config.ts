import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the GitHub Pages subpath. Override at build time with
// VITE_BASE=/your-repo-name/ so the same source deploys to a user site or a
// project site without edits.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/economic-voting-engine/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1200 },
  test: { environment: "node", globals: true, include: ["tests/**/*.test.ts"] },
});
