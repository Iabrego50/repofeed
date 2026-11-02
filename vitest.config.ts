import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit-test config for this app. Two projects run in one command:
//   - "convex"   backend functions, run in the edge-runtime via convex-test
//   - "frontend" React components and logic, run in jsdom via Testing Library
//
// Keep tests hermetic: use convex-test and mocks instead of real deployments,
// network calls, or environment-dependent behavior.
export default defineConfig({
  resolve: {
    alias: {
      "@/convex": path.resolve(import.meta.dirname, "./convex"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    passWithNoTests: true,
    // Restore Vitest mocks before each test to reduce state leakage.
    restoreMocks: true,
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      RESEND_API_KEY: "re_test_dummy",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.{ts,js}"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/vitest.setup.ts"],
        },
      },
    ],
  },
});
