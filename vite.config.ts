import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/pdfjs-dist")) return "pdfjs";
          if (id.includes("node_modules/pptxgenjs") || id.includes("node_modules/jszip")) return "pptx";
          if (id.includes("node_modules/xlsx") || id.includes("node_modules/mammoth")) return "office";
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/motion")) return "motion";
          if (id.includes("node_modules/@supabase")) return "supabase";
        },
      },
    },
  },
});
