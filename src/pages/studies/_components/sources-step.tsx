import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from '@/lib/convex-compat';
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ClipboardPaste, FileText, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SAMPLE_FILES } from "@/convex/lib/sample.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ACCEPTED_EXTENSIONS, extractText } from "@/lib/extract.ts";
import { errorMessage } from "@/lib/errors.ts";
import { cn } from "@/lib/utils.ts";

type Pending = { key: string; name: string; status: "reading" | "error"; error?: string };

const fmt = new Intl.NumberFormat();

export default function SourcesStep({ studyId }: { studyId: Id<"studies"> }) {
  const sources = useQuery(api.studies.listSources, { studyId });
  const addSource = useMutation(api.studies.addSource);
  const removeSource = useMutation(api.studies.removeSource);
  const [pending, setPending] = useState<Pending[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loadingSample, setLoadingSample] = useState(false);

  const setPendingState = (key: string, patch: Partial<Pending> | null) =>
    setPending((list) =>
      patch === null ? list.filter((p) => p.key !== key) : list.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );

  const processFile = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setPending((l) => [...l, { key, name: file.name, status: "reading" }]);
      try {
        const text = await extractText(file);
        // Only the extracted text is sent; the original file never leaves this device.
        await addSource({ studyId, name: file.name, text, fromFile: true });
        setPendingState(key, null);
      } catch (err) {
        const msg = err instanceof Error && !("data" in err) ? err.message : errorMessage(err, "Couldn't add this file");
        setPendingState(key, { status: "error", error: msg });
      }
    },
    [addSource, studyId],
  );

  const onDrop = useCallback(
    (files: File[]) => {
      for (const f of files) void processFile(f);
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
  });

  const loadSamples = async () => {
    setLoadingSample(true);
    try {
      const existing = new Set(sources?.map((s) => s.name));
      for (const f of SAMPLE_FILES) {
        if (!existing.has(f.name)) await addSource({ studyId, name: f.name, text: f.text });
      }
      toast.success("Sample files added");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't add the sample files"));
    } finally {
      setLoadingSample(false);
    }
  };

  const savePaste = async () => {
    try {
      await addSource({ studyId, name: pasteName || "Pasted text", text: pasteText });
      setPasteText("");
      setPasteName("");
      setPasteOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the text"));
    }
  };

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-2xl border-2 border-dashed border-border bg-card/60 px-6 py-10 text-center transition-colors duration-200",
          isDragActive && "border-primary bg-primary/10",
        )}
      >
        <input {...getInputProps()} aria-label="Choose files" />
        <UploadCloud className="mx-auto size-10 text-primary" />
        <p className="mt-4 font-display text-xl font-bold">Drop research files here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}, up to 25 MB each. Files are read in your browser and never uploaded. Only the text is used.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={open} className="h-11">
            <FileText className="size-4" /> Choose files
          </Button>
          <Button type="button" variant="secondary" className="h-11" onClick={() => setPasteOpen((v) => !v)}>
            <ClipboardPaste className="size-4" /> Paste text
          </Button>
          <Button type="button" variant="secondary" className="h-11" onClick={() => void loadSamples()} disabled={loadingSample}>
            {loadingSample ? <Spinner /> : <Sparkles className="size-4 text-primary" />} Try sample files
          </Button>
        </div>
      </div>

      {pasteOpen && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="interview-notes.txt"
            aria-label="Name for pasted text"
            className="h-11"
          />
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste transcripts, notes or survey results…"
            rows={8}
            aria-label="Pasted text"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-11" onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button className="h-11" onClick={() => void savePaste()} disabled={!pasteText.trim()}>Add text</Button>
          </div>
        </div>
      )}

      <ul className="space-y-2" aria-live="polite">
        {sources === undefined &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        {sources?.map((s) => (
          <li key={s._id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0 text-[#3FE0A0]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.name}</p>
              <p className="font-mono text-xs text-muted-foreground">Ready · {fmt.format(s.chars)} characters</p>
            </div>
            <button
              type="button"
              onClick={() => void removeSource({ sourceId: s._id })}
              className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Remove ${s.name}`}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.key} className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3", p.status === "error" ? "border-destructive/50" : "border-border")}>
            {p.status === "reading" ? <Spinner className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className={cn("text-xs", p.status === "error" ? "text-destructive" : "font-mono text-muted-foreground")}>
                {p.status === "reading" ? "Reading…" : `Error: ${p.error}`}
              </p>
            </div>
            {p.status === "error" && (
              <button
                type="button"
                onClick={() => setPendingState(p.key, null)}
                className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`Dismiss ${p.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
