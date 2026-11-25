import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("design harness production guard", () => {
  it("only lazy-loads the harness when DEV or VITE_DESIGN_HARNESS is set", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toMatch(/designHarnessEnabled/);
    expect(app).toMatch(/import\.meta\.env\.DEV/);
    expect(app).toMatch(/VITE_DESIGN_HARNESS/);
    // Must not unconditionally import the harness module into the prod graph.
    expect(app).not.toMatch(
      /const DesignHarnessPage = lazy\(\(\) => import\("\.\/pages\/design-harness\/page\.tsx"\)\);/,
    );
    expect(app).toMatch(
      /DesignHarnessPage \? \(\s*<>[\s\S]*path="\/__design"/,
    );
  });

  it("harness page itself refuses to render outside DEV/harness builds", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/design-harness/page.tsx"), "utf8");
    expect(page).toMatch(/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_DESIGN_HARNESS === "true"/);
    expect(page).toMatch(/Navigate to="\/"/);
  });
});
