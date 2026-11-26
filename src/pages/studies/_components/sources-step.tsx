import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/complete";
import { toast } from "sonner";
import { ClipboardPaste, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { ACCEPTED_EXTENSIONS, extractText } from "@/lib/extract.ts";
import { errorMessage } from "@/lib/errors.ts";
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
  const uploading = pending.some((p) => p.status === "reading");

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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">
            {study?.title ? `${study.title} · first study` : "First study"}
          </p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight">Empty the drawer.</h3>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Drop in the interviews, surveys and decks from one study. Messy is fine. We’ll cut them into short insight scenes.
            Files are read in your browser — only the text is saved.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="study-name-display" className="font-semibold">
              Study name
            </Label>
            <Input
              id="study-name-display"
              readOnly
              value={study?.title ?? ""}
              className="h-11"
              placeholder="e.g. Q3 onboarding interviews"
            />
          </div>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "rounded-[1.5rem] border border-dashed border-border bg-card p-6 shadow-lift transition-colors",
            isDragActive && "border-primary bg-primary/5",
          )}
        >
          <input {...getInputProps()} aria-label="Choose research files" />
          <div className="flex flex-col items-center justify-center rounded-xl px-4 py-10 text-center">
            {uploading ? (
              <>
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="mt-3 text-sm font-medium text-muted-foreground">Reading files…</span>
              </>
            ) : (
              <>
                <Upload className="size-8 text-primary" />
                <span className="mt-3 text-base font-bold">Drop research files here</span>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" onClick={open} className="h-10 rounded-full bg-studio px-5 font-semibold text-white hover:bg-studio/90">
                    Choose files
                  </Button>
                  <Button type="button" variant="secondary" className="h-10 rounded-full font-semibold" onClick={() => setPasteOpen((v) => !v)}>
                    <ClipboardPaste className="size-4" /> Paste text
                  </Button>
                </div>
                <span className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
                  {ACCEPTED_EXTENSIONS.join(" · ")}
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {sources.length === 0 ? "Nothing here yet." : `${sources.length} file${sources.length === 1 ? "" : "s"} ready.`}
          </p>
        </div>
      </div>

      {pasteOpen && (
        <div className="space-y-3 rounded-[1.5rem] border border-border bg-card p-5 shadow-lift">
          <p className="font-mono text-[11px] tracking-[0.14em] text-eyebrow uppercase">Paste</p>
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
            <Button type="button" variant="ghost" className="h-11" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-11 font-semibold" onClick={() => void savePaste()} disabled={!pasteText.trim()}>
              Add text
            </Button>
          </div>
        </div>
      )}

      {(sources.length > 0 || pending.length > 0) && (
        <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-lift">
          <h3 className="text-lg font-bold tracking-tight">Uploaded sources</h3>
          <ul className="mt-4 divide-y divide-border" aria-live="polite">
            {sources.map((source) => (
              <li key={source._id} className="flex items-center gap-3 py-3">
                <FileText className="size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(source.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(source._id)}
                  disabled={removeMutation.isPending}
                  aria-label={`Remove ${source.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {pending.map((p) => (
              <li key={p.key} className={cn("flex items-center gap-3 py-3", p.status === "error" && "text-destructive")}>
                {p.status === "reading" ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <FileText className="size-5 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs">
                    {p.status === "reading" ? "Reading…" : p.error}
                  </p>
                </div>
                {p.status === "error" && (
                  <Button variant="ghost" size="icon" onClick={() => setPendingState(p.key, null)} aria-label={`Dismiss ${p.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onNext} size="lg" className="font-semibold">
            Continue to Details
          </Button>
        </div>
      )}
    </div>
  );
}
