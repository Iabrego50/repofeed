import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./app-error-boundary";

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("shows a fallback for ordinary render errors", () => {
    render(
      <AppErrorBoundary>
        <Boom message="boom" />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("This page hit a problem")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("reloads instead of showing the fallback for chunk-load errors", () => {
    render(
      <AppErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/page-krTvTZnh.js" />
      </AppErrorBoundary>,
    );
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("clears the error UI when resetKey changes", () => {
    function MaybeBoom({ fail }: { fail: boolean }) {
      if (fail) throw new Error("page crashed");
      return <div>ok page</div>;
    }

    const { rerender } = render(
      <AppErrorBoundary resetKey="/studies">
        <MaybeBoom fail />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("This page hit a problem")).toBeInTheDocument();

    rerender(
      <AppErrorBoundary resetKey="/feed">
        <MaybeBoom fail={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("ok page")).toBeInTheDocument();
    expect(screen.queryByText("This page hit a problem")).not.toBeInTheDocument();
  });
});
