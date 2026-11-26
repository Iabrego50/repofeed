import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const addSource = vi.fn(async (_args: { studyId: string; name: string; kind: string; text: string }) => "src-1");
const removeSource = vi.fn(async (_args: { sourceId: string }) => undefined);
const extractText = vi.fn(async (file: File) => `TEXT:${file.name}`);

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
      "aria-label": "Choose research files",
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
      addSource: (args: { studyId: string; name: string; kind: string; text: string }) => addSource(args),
      removeSource: (args: { sourceId: string }) => removeSource(args),
    },
  },
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import SourcesStep from "./sources-step.tsx";

function renderStep(sources: Array<{ _id: string; name: string; size: number; uploadedAt: number }> = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SourcesStep studyId="study-9" study={{ title: "Cancel study" }} sources={sources} onNext={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SourcesStep upload regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addSource.mockResolvedValue("src-1");
    extractText.mockImplementation(async (file: File) => `TEXT:${file.name}`);
  });

  afterEach(() => cleanup());

  it("never posts binaries to /api/upload", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderStep();

    const input = screen.getByLabelText(/Choose research files/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["body"], "notes.txt", { type: "text/plain" })] },
    });

    await waitFor(() => expect(addSource).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("surfaces extract errors instead of a false success toast", async () => {
    extractText.mockRejectedValueOnce(new Error("No readable text found in this file"));
    renderStep();

    fireEvent.change(screen.getByLabelText(/Choose research files/i), {
      target: { files: [new File([""], "empty.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText(/No readable text found/i)).toBeInTheDocument();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("saves pasted text via addSource kind=paste", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: /^Paste text$/i }));
    fireEvent.change(screen.getByPlaceholderText("interview-notes.txt"), { target: { value: "notes.txt" } });
    fireEvent.change(screen.getByPlaceholderText(/Paste transcripts/i), { target: { value: "Stakeholder quote here" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add text$/i }));

    await waitFor(() =>
      expect(addSource).toHaveBeenCalledWith({
        studyId: "study-9",
        name: "notes.txt",
        kind: "paste",
        text: "Stakeholder quote here",
      }),
    );
  });
});
