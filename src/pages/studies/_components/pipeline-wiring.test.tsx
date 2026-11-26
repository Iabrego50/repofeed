/**
 * Guards: redesign UI must keep the real upload + AI generation + video pipeline
 * (no mocks/placeholders on production paths; no dead `/api/upload` calls).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const startGeneration = vi.fn(async (_args: { studyId: string }) => "job-1");
const latestForStudy = vi.fn(async (_args: { studyId: string }) => null);
const cancelGeneration = vi.fn(async (_args: { studyId: string }) => undefined);
const removeSource = vi.fn(async (_args: { sourceId: string }) => undefined);
const addSource = vi.fn(async (_args: { studyId: string; name: string; kind: string; text: string }) => "src-1");
const feedList = vi.fn(async (_args: { workspaceId: string; division?: string }) => []);
const extractText = vi.fn(async (_file: File) => "Interview transcript about meal kits.");

vi.mock("@/lib/extract.ts", () => ({
  ACCEPTED_EXTENSIONS: ["txt", "md", "pdf", "docx", "pptx", "xlsx"],
  extractText: (file: File) => extractText(file),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => ({
    getRootProps: () => ({}),
    getInputProps: () => ({
      type: "file",
      multiple: true,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length) onDrop(files);
      },
    }),
    isDragActive: false,
    open: () => undefined,
  }),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    studies: {
      removeSource: (args: { sourceId: string }) => removeSource(args),
      addSource: (args: { studyId: string; name: string; kind: string; text: string }) => addSource(args),
    },
    generation: {
      jobs: {
        startGeneration: (args: { studyId: string }) => startGeneration(args),
        latestForStudy: (args: { studyId: string }) => latestForStudy(args),
        cancelGeneration: (args: { studyId: string }) => cancelGeneration(args),
      },
    },
    feed: {
      list: (args: { workspaceId: string; division?: string }) => feedList(args),
    },
    videos: {
      backfill: vi.fn(async () => undefined),
      process: vi.fn(async () => undefined),
    },
  },
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({
    current: { _id: "ws-1", id: "ws-1", name: "Acme Research" },
    isEditor: true,
    loading: false,
  }),
}));

vi.mock("@/hooks/use-is-desktop.ts", () => ({
  useIsDesktop: () => false,
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@/pages/feed/_components/reel-feed.tsx", () => ({
  default: (props: { reels?: unknown; resetKey?: string }) => (
    <div data-testid="reel-feed" data-reset-key={props.resetKey}>
      real-reel-feed
    </div>
  ),
}));

vi.mock("@/pages/share/_components/generate-ppt-button.tsx", () => ({
  default: () => <button type="button">Add to PPT</button>,
}));

vi.mock("@/pages/share/_lib/deck-selection.ts", () => ({
  DeckSelectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SourcesStep from "./sources-step.tsx";
import GenerateStep from "./generate-step.tsx";
import DivisionFeedPage from "@/pages/home/division-feed.tsx";

function wrap(ui: React.ReactElement, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="*" element={ui} />
          <Route path="/d/:division" element={ui} />
          <Route path="/home" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("production pipeline wiring (design redesign)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestForStudy.mockResolvedValue(null);
    feedList.mockResolvedValue([]);
    extractText.mockResolvedValue("Interview transcript about meal kits.");
    addSource.mockResolvedValue("src-1");
  });

  afterEach(() => {
    cleanup();
  });

  it("SourcesStep extracts text locally and calls api.studies.addSource (not /api/upload)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    render(
      wrap(
        <SourcesStep
          studyId="study-1"
          study={{ title: "Q3 interviews" }}
          sources={[]}
          onNext={() => undefined}
        />,
      ),
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["hello"], "interviews.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(extractText).toHaveBeenCalled());
    expect(extractText.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect((extractText.mock.calls[0]?.[0] as File).name).toBe("interviews.docx");

    await waitFor(() =>
      expect(addSource).toHaveBeenCalledWith({
        studyId: "study-1",
        name: "interviews.docx",
        kind: "file",
        text: "Interview transcript about meal kits.",
      }),
    );

    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/upload/),
      expect.anything(),
    );
    fetchSpy.mockRestore();
  });

  it("GenerateStep still starts the real AI generation job", async () => {
    render(wrap(<GenerateStep studyId="study-1" study={{ title: "Sample study" }} onNext={() => undefined} />));

    fireEvent.click(screen.getByRole("button", { name: /Start generation/i }));
    await waitFor(() => expect(startGeneration).toHaveBeenCalledWith({ studyId: "study-1" }));
    expect(latestForStudy).toHaveBeenCalledWith({ studyId: "study-1" });
  });

  it("DivisionFeedPage loads reels via api.feed.list(division) and mounts ReelFeed", async () => {
    render(wrap(<DivisionFeedPage />, "/d/auto"));

    await waitFor(() =>
      expect(feedList).toHaveBeenCalledWith({ workspaceId: "ws-1", division: "auto" }),
    );
    expect(screen.getByTestId("reel-feed")).toBeInTheDocument();
    expect(screen.getByTestId("reel-feed")).toHaveAttribute("data-reset-key", "division-auto");
    expect(screen.getByTestId("reel-feed").textContent).toContain("real-reel-feed");
  });
});
