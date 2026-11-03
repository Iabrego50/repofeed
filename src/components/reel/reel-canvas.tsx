import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { REEL_H, REEL_W } from "@/lib/reel/constants.ts";
import {
  ReelPainter,
  ensureReelFonts,
  reelScript,
  type ReelData,
} from "@/lib/reel/painter.ts";
import { stockClipForIndex } from "@/lib/api/reel-video.ts";
import { useReducedMotion } from "@/hooks/use-reduced-motion.ts";

/**
 * Most a "cover" fit may trim from each edge, in reel units. Text sits 96 in from the sides,
 * so sides barely crop; the top keeps room for the progress bar under the page header.
 */
const MAX_CROP_X = 48;
const MAX_CROP_Y = 40;

type Props = {
  reel: ReelData;
  playing: boolean;
  /** Static time (seconds) to show when not playing; ignored while playing. */
  stillAt?: number;
  /** Restart from 0 when this key changes. */
  restartKey?: number | string;
  onEnded?: () => void;
  onProgress?: (t: number, total: number) => void;
  /** "cover" fills the box (phones); "contain" letterboxes. */
  fit?: "cover" | "contain";
  className?: string;
};

/** Canvas reel player at a 1080×1920 logical size, scaled for device pixel ratio. */
export default function ReelCanvas({
  reel,
  playing,
  stillAt,
  restartKey,
  onEnded,
  onProgress,
  fit = "contain",
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const painterRef = useRef<ReelPainter | null>(null);
  const timeRef = useRef(0);
  const reduced = useReducedMotion();
  const endedRef = useRef(onEnded);
  const progressRef = useRef(onProgress);
  useEffect(() => {
    endedRef.current = onEnded;
    progressRef.current = onProgress;
  });

  const reelKey = JSON.stringify([
    reel.scenes,
    reel.track,
    reel.trackIndex,
    reel.studyTitle,
    reel.footage?.url,
    reel.footage?.caption,
  ]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [brokenByKey, setBrokenByKey] = useState<{
    key: string;
    url: string | null;
  }>({ key: "", url: null });
  const brokenUrl = brokenByKey.key === reelKey ? brokenByKey.url : null;
  const fallbackClip = stockClipForIndex(reel.trackIndex).url;
  const isStill =
    reel.footage?.media === "image" && brokenUrl !== reel.footage.url;
  const footageUrl = isStill
    ? undefined
    : brokenUrl
      ? fallbackClip
      : reel.footage?.url || (reel.footage == null ? fallbackClip : undefined);
  const stillUrl = isStill ? reel.footage?.url : undefined;
  // Neighbouring scenes only fetch enough for a still frame; the full clip downloads once it plays.
  const [hasPlayed, setHasPlayed] = useState(playing);
  if (playing && !hasPlayed) setHasPlayed(true);

  // Size the canvas backing store to the box × DPR, preserving the 9:16 transform.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = box.getBoundingClientRect();
      const contain = Math.min(rect.width / REEL_W, rect.height / REEL_H);
      // "cover" fills the box but crops only a little, so text near the frame edges stays visible.
      const scale =
        fit === "cover"
          ? Math.max(
              contain,
              Math.min(
                Math.max(rect.width / REEL_W, rect.height / REEL_H),
                rect.width / (REEL_W - 2 * MAX_CROP_X),
                rect.height / (REEL_H - 2 * MAX_CROP_Y),
              ),
            )
          : contain;
      const w = Math.max(1, Math.round(REEL_W * scale));
      const h = Math.max(1, Math.round(REEL_H * scale));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform((w * dpr) / REEL_W, 0, 0, (h * dpr) / REEL_H, 0, 0);
      painterRef.current?.invalidate();
      painterRef.current?.draw(timeRef.current, reduced);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    return () => ro.disconnect();
  }, [fit, reduced]);

  // Build the painter for this reel.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const painter = new ReelPainter(ctx, reel);
    painter.setVideo(videoRef.current ?? imageRef.current);
    painterRef.current = painter;
    painter.draw(timeRef.current, reduced);
    let cancelled = false;
    void ensureReelFonts().then(() => {
      if (cancelled) return;
      painter.invalidate();
      painter.draw(timeRef.current, reduced);
    });
    return () => {
      cancelled = true;
    };
    // reelKey captures the reel's visual content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelKey, reduced]);

  useEffect(() => {
    timeRef.current = 0;
    painterRef.current?.draw(0, reduced);
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }, [restartKey, reelKey, reduced]);

  // Keep the footage clip in step with playback; redraw still frames once they decode.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !footageUrl) return;
    const redraw = () => {
      if (!playing) painterRef.current?.draw(timeRef.current, reduced);
    };
    // Paused videos may not decode a paintable frame until seeked, so nudge them.
    const onLoaded = () => {
      if (!playing && video.currentTime === 0) video.currentTime = 0.5;
      redraw();
    };
    if (video.readyState >= 1) onLoaded();
    // With metadata-only preloading, "loadeddata" may never fire, so seek once the size is known.
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", redraw);
    if (playing && !reduced) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", redraw);
    };
  }, [playing, reduced, footageUrl]);

  // Redraw once an AI-painted still finishes loading (the animation loop handles playback).
  useEffect(() => {
    const img = imageRef.current;
    if (!img || !stillUrl) return;
    const redraw = () => painterRef.current?.draw(timeRef.current, reduced);
    if (img.complete) redraw();
    img.addEventListener("load", redraw);
    return () => img.removeEventListener("load", redraw);
  }, [stillUrl, reduced]);

  // Animation loop.
  useEffect(() => {
    const painter = painterRef.current;
    if (!painter) return;
    if (!playing) {
      if (stillAt !== undefined) timeRef.current = stillAt;
      painter.draw(timeRef.current, reduced);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let ended = false;
    const total = painter.timeline.total;
    const tick = (now: number) => {
      const p = painterRef.current;
      if (!p) return;
      timeRef.current = Math.min(total, timeRef.current + (now - last) / 1000);
      last = now;
      p.draw(timeRef.current, reduced);
      progressRef.current?.(timeRef.current, total);
      if (timeRef.current >= total) {
        if (!ended) {
          ended = true;
          endedRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    if (timeRef.current >= total) timeRef.current = 0;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, stillAt, reelKey, reduced, restartKey]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {footageUrl && (
        // Hidden source for the canvas; frames are painted under the text.
        <video
          ref={videoRef}
          src={footageUrl}
          muted
          loop
          playsInline
          preload={hasPlayed ? "auto" : "metadata"}
          aria-hidden
          className="pointer-events-none absolute size-px opacity-0"
          onError={() => {
            if (reel.footage?.url && brokenUrl !== reel.footage.url) {
              setBrokenByKey({ key: reelKey, url: reel.footage.url });
            }
          }}
        />
      )}
      {stillUrl && (
        <img
          ref={imageRef}
          src={stillUrl}
          alt=""
          aria-hidden
          decoding="async"
          className="pointer-events-none absolute size-px opacity-0"
          onError={() => {
            if (stillUrl) setBrokenByKey({ key: reelKey, url: stillUrl });
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${reel.title}. ${reelScript(reel.scenes)}`}
        className="block"
      />
    </div>
  );
}
