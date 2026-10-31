import { FPS, REEL_H, REEL_W } from "./constants.ts";
import { ReelPainter, ensureReelFonts, type ReelData } from "./painter.ts";

export type ExportResult = { blob: Blob; ext: "mp4" | "webm"; duration: number };

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = REEL_W;
  canvas.height = REEL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser");
  return { canvas, ctx };
}

/** Loads the reel's backdrop (clip or AI still) for frame-by-frame drawing; null if there is none or it fails. */
async function loadFootage(reel: ReelData): Promise<HTMLVideoElement | HTMLImageElement | null> {
  const url = reel.footage?.url;
  if (!url) return null;
  if (reel.footage?.media === "image") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    return await img.decode().then(() => img, () => null);
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = url;
  const ok = await new Promise<boolean>((resolve) => {
    video.addEventListener("loadeddata", () => resolve(true), { once: true });
    video.addEventListener("error", () => resolve(false), { once: true });
  });
  return ok ? video : null;
}

/** Seeks the clip (looping) to time t and waits for the frame. */
function seekFootage(video: HTMLVideoElement, t: number): Promise<void> {
  const target = video.duration > 0 ? t % video.duration : 0;
  if (Math.abs(video.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = target;
  });
}

async function pickCodec(): Promise<string | null> {
  if (typeof VideoEncoder === "undefined") return null;
  // 1080×1920 needs H.264 level 4.0+.
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42003e", "avc1.640033"]) {
    const res = await VideoEncoder.isConfigSupported({ codec, width: REEL_W, height: REEL_H, bitrate: 6_000_000, framerate: FPS });
    if (res.supported) return codec;
  }
  return null;
}

async function exportMp4(reel: ReelData, codec: string, onProgress: (p: number) => void, signal: AbortSignal): Promise<ExportResult> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const { canvas, ctx } = makeCanvas();
  const painter = new ReelPainter(ctx, reel);
  const footage = await loadFootage(reel);
  painter.setVideo(footage);
  const total = painter.timeline.total;
  const frames = Math.ceil(total * FPS);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: REEL_W, height: REEL_H, frameRate: FPS },
    fastStart: "in-memory",
  });
  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({ codec, width: REEL_W, height: REEL_H, bitrate: 6_000_000, framerate: FPS });
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) {
      encoder.close();
      throw new DOMException("Export cancelled", "AbortError");
    }
    if (encodeError) throw encodeError;
    if (footage instanceof HTMLVideoElement) await seekFootage(footage, i / FPS);
    painter.draw(i / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    // Keep the encoder queue bounded and the UI responsive.
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
    if (i % 10 === 0) {
      onProgress(i / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  encoder.close();
  if (encodeError) throw encodeError;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4", duration: frames / FPS };
}

async function exportWebm(reel: ReelData, onProgress: (p: number) => void, signal: AbortSignal): Promise<ExportResult> {
  if (typeof MediaRecorder === "undefined") throw new Error("Video export isn't supported in this browser");
  const { canvas, ctx } = makeCanvas();
  const painter = new ReelPainter(ctx, reel);
  const footage = await loadFootage(reel);
  painter.setVideo(footage);
  const total = painter.timeline.total;
  const stream = canvas.captureStream(FPS);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start(250);
  // Real-time capture: let the clip play alongside the wall clock.
  if (footage instanceof HTMLVideoElement) {
    footage.loop = true;
    await footage.play().catch(() => undefined);
  }
  // MediaRecorder captures in real time, so draw on the wall clock.
  const startAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal.aborted) {
        recorder.stop();
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const t = (performance.now() - startAt) / 1000;
      painter.draw(Math.min(t, total));
      onProgress(Math.min(1, t / total));
      if (t >= total) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
  recorder.stop();
  if (footage instanceof HTMLVideoElement) footage.pause();
  await done;
  return { blob: new Blob(chunks, { type: "video/webm" }), ext: "webm", duration: total };
}

/** Renders a reel to MP4 (WebCodecs) or falls back to WebM (MediaRecorder). */
export async function exportReel(reel: ReelData, onProgress: (p: number) => void, signal: AbortSignal): Promise<ExportResult> {
  await ensureReelFonts();
  const codec = await pickCodec();
  if (codec) return exportMp4(reel, codec, onProgress, signal);
  return exportWebm(reel, onProgress, signal);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "reel";
}
