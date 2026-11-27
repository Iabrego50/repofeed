import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { ClipboardPaste, Loader2, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea.tsx";
import { SlopPill } from "@/components/slop/slop-shell.tsx";
import { ACCEPTED_EXTENSIONS, extractText } from "@/lib/extract.ts";
import { errorMessage } from "@/lib/errors.ts";
import { SAMPLE_FILES } from "@/pages/demo/_lib/sample.ts";
import { cn } from "@/lib/utils.ts";

interface Source {
  _id: string;
  name: string;
  size: number;
  uploadedAt: number;
}

interface SourcesStepProps {
  studyId: string;
  study: any;
  sources: Source[];
  onNext: () => void;
}

type Pending = { key: string; name: string; status: "reading" | "error"; error?: string };

/**
 * Upload step: files are read in the browser via `extractText`, then only the
 * extracted text is saved with `api.studies.addSource`. There is no `/api/upload`
 * route — originals never leave the device.
 */
export default function SourcesStep({ studyId, study, sources, onNext }: SourcesStepProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [sampleBusy, setSampleBusy] = useState(false);
  const uploading = pending.some((p) => p.status === "reading") || sampleBusy;

  const removeMutation = useMutation({
    mutationFn: (sourceId: string) => api.studies.removeSource({ sourceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      toast.success("Source removed");
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "That file couldn’t be removed. Try again."));
    },
  });

  const setPendingState = (key: string, patch: Partial<Pending> | null) =>
    setPending((list) =>
      patch === null ? list.filter((p) => p.key !== key) : list.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );

  const processFile = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setPending((list) => [...list, { key, name: file.name, status: "reading" }]);
      try {
        const text = await extractText(file);
        await api.studies.addSource({
          studyId,
          name: file.name,
          kind: "file",
          text,
        });
        setPendingState(key, null);
        void queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      } catch (err) {
        setPendingState(key, {
          status: "error",
          error: errorMessage(err, "Couldn't add this file"),
        });
      }
    },
    [queryClient, studyId],
  );

  const onDrop = useCallback(
    (files: File[]) => {
      for (const file of files) void processFile(file);
    },
    [processFile],
  );

  const accept = Object.fromEntries(
    ACCEPTED_EXTENSIONS.map((ext) => [`.${ext}`, []]),
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
    disabled: uploading,
    accept,
  });

  const savePaste = async () => {
    try {
      await api.studies.addSource({
        studyId,
        name: pasteName.trim() || "Pasted text",
        kind: "paste",
        text: pasteText,
      });
      setPasteText("");
      setPasteName("");
      setPasteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      toast.success("Text added");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the text"));
    }
  };

  const loadSample = async () => {
    if (uploading || sources.length > 0) return;
    setSampleBusy(true);
    try {
      for (const file of SAMPLE_FILES) {
        await api.studies.addSource({
          studyId,
          name: file.name,
          kind: "paste",
          text: file.text,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["studies", "sources", studyId] });
      toast.success("Sample study loaded");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't load the sample study"));
    } finally {
      setSampleBusy(false);
    }
  };

  const pillLabel = study?.title
    ? `${study.title} · First study`
    : "Team research · First study";

  const countLine =
    sources.length === 0
      ? "Nothing here yet."
      : sources.length === 1
        ? "1 file ready to cut."
        : `${sources.length} files ready to cut.`;

  return (
    <div className="slop-scope space-y-6 rounded-2xl p-1">
      <div className="rf-rise grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <SlopPill dot="purple">{pillLabel}</SlopPill>
          <h3
            className="slop-h1 m-0 text-balance"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
          >
            Empty <span className="slop-underline slop-underline-squiggle slop-underline-pink">the</span>{" "}
            <span className="slop-serif-emphasis slop-text-gradient-hot">drawer</span>.
          </h3>
          <p className="slop-lead m-0 max-w-[44ch]">
            Drop in the interviews, surveys and decks from one study. Messy is fine — we’ll cut them into short
            insight scenes. Files are read in your browser — only the text is saved.
          </p>
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="study-name-display" className="text-[15px] font-semibold">
              Study name
            </label>
            <div className="slop-ai-bar" style={{ minHeight: 56 }}>
              <span aria-hidden>✨</span>
              <input
                id="study-name-display"
                readOnly
                value={study?.title ?? ""}
                placeholder="e.g. Q3 onboarding interviews"
                style={{ height: 44, fontSize: 18 }}
              />
            </div>
          </div>
          <div className="slop-row mt-1 flex-wrap">
            {sources.length > 0 ? (
              <button type="button" className="slop-btn slop-btn-primary slop-btn-lg" onClick={onNext}>
                Cut into scenes ⚡
              </button>
            ) : (
              <button
                type="button"
                className="slop-btn slop-btn-ghost slop-btn-lg"
                disabled={uploading}
                onClick={() => void loadSample()}
              >
                {sampleBusy ? "Loading sample…" : "No files handy? Use the sample study"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            {...getRootProps()}
            className={cn(
              "slop-card flex min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center",
              isDragActive && "border-cyan-400",
            )}
            style={{
              border: isDragActive ? "2px dashed #22d3ee" : "2px dashed rgba(192,132,252,.5)",
              boxShadow: isDragActive ? "0 0 48px rgba(34,211,238,.35)" : undefined,
            }}
          >
            <input {...getInputProps()} aria-label="Choose research files" />
            {uploading ? (
              <>
                <Loader2 className="size-8 animate-spin" style={{ color: "#22d3ee" }} />
                <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                  Reading files…
                </span>
              </>
            ) : (
              <>
                <span className="slop-icon-box slop-icon-cyan mb-0" aria-hidden>
                  📂
                </span>
                <div className="slop-text-gradient text-[1.75rem] font-extrabold tracking-tight">
                  Drop research files here
                </div>
                <div className="slop-row flex-wrap justify-center">
                  <button type="button" className="slop-btn slop-btn-primary" onClick={open}>
                    Choose files
                  </button>
                  <button
                    type="button"
                    className="slop-btn slop-btn-ghost"
                    onClick={() => setPasteOpen((v) => !v)}
                  >
                    <ClipboardPaste className="size-4" /> Paste text
                  </button>
                </div>
                <span className="font-mono text-[13px]" style={{ color: "#94a3b8" }}>
                  {ACCEPTED_EXTENSIONS.join(" · ")}
                </span>
              </>
            )}
          </div>
          <p className="m-0 text-[15px]" style={{ color: "#94a3b8" }} aria-live="polite">
            {countLine}
          </p>
        </div>
      </div>

      {pasteOpen && (
        <div className="slop-card flex flex-col gap-3 p-5">
          <p className="m-0 font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: "#94a3b8" }}>
            Paste
          </p>
          <div className="slop-ai-bar" style={{ minHeight: 48 }}>
            <input
              value={pasteName}
              onChange={(e) => setPasteName(e.target.value)}
              placeholder="interview-notes.txt"
              aria-label="Name for pasted text"
              style={{ height: 40 }}
            />
          </div>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste transcripts, notes or survey results…"
            rows={8}
            aria-label="Pasted text"
            className="border-white/10 bg-black/40 text-inherit"
          />
          <div className="slop-row justify-end">
            <button type="button" className="slop-btn slop-btn-ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="slop-btn slop-btn-primary"
              onClick={() => void savePaste()}
              disabled={!pasteText.trim()}
            >
              Add text
            </button>
          </div>
        </div>
      )}

      {(sources.length > 0 || pending.length > 0) && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite" aria-label="Files in this study">
          {sources.map((source) => (
            <li
              key={source._id}
              className="slop-card-nested mt-0 flex items-center justify-between gap-3 px-4 py-1.5"
            >
              <span className="min-w-0 break-all font-mono text-[15px]">{source.name}</span>
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center rounded-[10px] border-0 bg-transparent"
                style={{ color: "#94a3b8" }}
                onClick={() => removeMutation.mutate(source._id)}
                disabled={removeMutation.isPending}
                aria-label={`Remove ${source.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li
              key={p.key}
              className={cn(
                "slop-card-nested mt-0 flex items-center justify-between gap-3 px-4 py-1.5",
                p.status === "error" && "text-red-400",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate font-mono text-[15px]">{p.name}</p>
                <p className="m-0 text-xs" style={{ color: p.status === "error" ? undefined : "#94a3b8" }}>
                  {p.status === "reading" ? "Reading…" : p.error}
                </p>
              </div>
              {p.status === "reading" ? (
                <Loader2 className="size-4 animate-spin" style={{ color: "#94a3b8" }} />
              ) : (
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-[10px] border-0 bg-transparent"
                  style={{ color: "#94a3b8" }}
                  onClick={() => setPendingState(p.key, null)}
                  aria-label={`Dismiss ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
