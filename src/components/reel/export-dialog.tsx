import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { downloadBlob, exportReel, slugify } from "@/lib/reel/export.ts";
import type { ReelData } from "@/lib/reel/painter.ts";

type State =
  | { status: "rendering"; progress: number }
  | { status: "done"; ext: string; duration: number }
  | { status: "error"; message: string };

function ExportRunner({ reel, onClose }: { reel: ReelData; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "rendering", progress: 0 });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    exportReel(reel, (p) => setState({ status: "rendering", progress: p }), ctrl.signal)
      .then((res) => {
        downloadBlob(res.blob, `${slugify(reel.title)}.${res.ext}`);
        setState({ status: "done", ext: res.ext, duration: res.duration });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
      });
    return () => ctrl.abort();
  }, [reel]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Export “{reel.title}”</DialogTitle>
        <DialogDescription>1080×1920 at 30 fps, rendered on your device.</DialogDescription>
      </DialogHeader>
      {state.status === "rendering" && (
        <div className="space-y-2">
          <Progress value={state.progress * 100} aria-label="Export progress" />
          <p className="font-mono text-xs text-muted-foreground">{Math.round(state.progress * 100)}%</p>
        </div>
      )}
      {state.status === "done" && (
        <p className="flex items-center gap-2 text-sm">
          <Download className="size-4 text-[#3FE0A0]" /> Downloaded {state.ext.toUpperCase()} · {state.duration.toFixed(1)}s
          {state.ext === "webm" && <span className="text-muted-foreground">(your browser can't encode MP4)</span>}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Export failed: {state.message}. Try Chrome, Edge or Safari 17+.
        </p>
      )}
      <DialogFooter>
        <Button variant={state.status === "rendering" ? "ghost" : "default"} className="h-11" onClick={onClose}>
          {state.status === "rendering" ? "Cancel" : "Close"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function ExportDialog({ reel, onClose }: { reel: ReelData | null; onClose: () => void }) {
  return (
    <Dialog open={reel !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{reel && <ExportRunner reel={reel} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
