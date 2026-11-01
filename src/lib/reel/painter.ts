import type { Scene } from "@/schema/validators.ts";
import {
  FONT_DISPLAY,
  FONT_MONO,
  FONT_UI,
  INK,
  INK_MUTED,
  NEAR_BLACK,
  REEL_H,
  REEL_W,
  SAFE,
  SAFE_W,
  hexAlpha,
  mixHex,
  trackColor,
} from "./constants.ts";
import { fitText, parseEmphasis, type Line } from "./text.ts";
import { buildTimeline, clamp, easeOutCubic, sceneIndexAt, type Timeline } from "./timing.ts";

export type ReelData = {
  title: string;
  track: string;
  trackIndex: number;
  studyTitle?: string;
  scenes: Scene[];
  /** Optional backdrop drawn behind the text: a fieldwork clip, or an AI-painted still ("image"). */
  footage?: { url: string; caption: string; media?: "image" } | null;
};

type Backdrop = HTMLVideoElement | HTMLImageElement;

type Block = {
  lines: Line[];
  font: string; // without size
  size: number;
  lineHeight: number;
  color: string;
  emColor: string;
  y: number; // top of first line
  /** Delay (s) before this block's lines start entering, relative to scene start. */
  delay: number;
  kind?: "stat" | "underline" | "quoteMark" | "bullet";
};

type SceneLayout = { blocks: Block[] };

const ENTER = 0.38;
const FIRST_ENTER = 0.22;
const STAGGER = 0.07;
const FADE_OUT = 0.28;
const SLIDE = 56;

const DIGITS_ONLY = /^(\D{0,2})(\d{1,6})(\D{0,4})$/;

export class ReelPainter {
  readonly reel: ReelData;
  readonly timeline: Timeline;
  readonly accent: string;
  private layouts = new Map<number, SceneLayout>();
  private ctx: CanvasRenderingContext2D;
  private video: Backdrop | null = null;

  constructor(ctx: CanvasRenderingContext2D, reel: ReelData) {
    this.ctx = ctx;
    this.reel = reel;
    this.timeline = buildTimeline(reel.scenes);
    this.accent = trackColor(reel.trackIndex);
  }

  /** Attaches the clip or still whose current frame is drawn as the backdrop. */
  setVideo(video: Backdrop | null) {
    this.video = video;
  }

  private videoReady(): { el: Backdrop; w: number; h: number } | null {
    const v = this.video;
    if (!v) return null;
    if (v instanceof HTMLImageElement) return v.complete && v.naturalWidth > 0 ? { el: v, w: v.naturalWidth, h: v.naturalHeight } : null;
    return v.readyState >= 2 && v.videoWidth > 0 ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  }

  /** Clears cached layouts (e.g. after web fonts finish loading). */
  invalidate() {
    this.layouts.clear();
  }

  private fontString(font: string, size: number): string {
    // font is "<weight> <family>"
    const i = font.indexOf(" ");
    return `${font.slice(0, i)} ${size}px ${font.slice(i + 1)}`;
  }

  private measurer(font: string) {
    return (text: string, size: number) => {
      this.ctx.font = this.fontString(font, size);
      return this.ctx.measureText(text).width;
    };
  }

  private layoutScene(index: number): SceneLayout {
    const cached = this.layouts.get(index);
    if (cached) return cached;
    const scene = this.reel.scenes[index];
    const blocks: Block[] = [];
    const accent = this.accent;
    const push = (
      text: string,
      font: string,
      opts: { start: number; min: number; maxLines: number; color?: string; em?: boolean; lh?: number; delay?: number; kind?: Block["kind"]; maxWidth?: number },
    ) => {
      const tokens = parseEmphasis(text, opts.em ?? true);
      const fit = fitText(
        tokens,
        { maxWidth: opts.maxWidth ?? SAFE_W, maxLines: opts.maxLines, startSize: opts.start, minSize: opts.min },
        this.measurer(font),
      );
      blocks.push({
        lines: fit.lines,
        font,
        size: fit.size,
        lineHeight: fit.size * (opts.lh ?? 1.08),
        color: opts.color ?? INK,
        emColor: accent,
        y: 0,
        delay: opts.delay ?? 0,
        kind: opts.kind,
      });
    };

    switch (scene.type) {
      case "hook":
        push(scene.text || '', `900 ${FONT_DISPLAY}`, { start: 136, min: 64, maxLines: 5, lh: 1.02 });
        break;
      case "line":
        if (scene.kicker) {
          push(scene.kicker.toUpperCase(), `700 ${FONT_MONO}`, { start: 34, min: 26, maxLines: 1, color: accent, em: false, lh: 1.6 });
        }
        push(scene.text || '', `750 ${FONT_DISPLAY}`, { start: 104, min: 54, maxLines: 6, lh: 1.08 });
        break;
      case "list":
        push((scene.title || '').toUpperCase(), `700 ${FONT_MONO}`, { start: 36, min: 26, maxLines: 2, color: accent, em: false, lh: 1.5 });
        (scene.items || []).forEach((item, i) => {
          push(item, `700 ${FONT_DISPLAY}`, {
            start: 76,
            min: 44,
            maxLines: 2,
            lh: 1.1,
            delay: 0.35 + i * 0.6,
            kind: "bullet",
            maxWidth: SAFE_W - 64,
          });
        });
        break;
      case "stat":
        push(scene.num || '', `900 ${FONT_DISPLAY}`, { start: 320, min: 120, maxLines: 2, color: accent, em: false, lh: 0.95, kind: "stat" });
        push(scene.label || '', `600 ${FONT_UI}`, { start: 64, min: 40, maxLines: 3, lh: 1.2, delay: 0.2 });
        break;
      case "quote":
        blocks.push({ lines: [], font: `900 ${FONT_DISPLAY}`, size: 220, lineHeight: 120, color: accent, emColor: accent, y: 0, delay: 0, kind: "quoteMark" });
        push(scene.text || '', `600 ${FONT_DISPLAY}`, { start: 80, min: 42, maxLines: 9, em: false, lh: 1.18 });
        push(`— ${scene.by || ''}`, `500 ${FONT_MONO}`, { start: 32, min: 24, maxLines: 2, color: INK_MUTED, em: false, lh: 1.4, delay: 0.25 });
        break;
      case "cta":
        push(scene.text || '', `800 ${FONT_DISPLAY}`, { start: 112, min: 56, maxLines: 4, lh: 1.05, kind: "underline" });
        push(scene.sub || '', `500 ${FONT_MONO}`, { start: 28, min: 20, maxLines: 3, color: INK_MUTED, em: false, lh: 1.5, delay: 0.3 });
        break;
    }

    // Vertically center the stack within the safe area.
    const gap = 40;
    const heights = blocks.map((b) => (b.kind === "quoteMark" ? b.lineHeight : b.lines.length * b.lineHeight));
    const total = heights.reduce((a, h) => a + h, 0) + gap * Math.max(0, blocks.length - 1) + (scene.type === "cta" ? 40 : 0);
    let y = SAFE.top + Math.max(0, (SAFE.bottom - SAFE.top - total) / 2);
    blocks.forEach((b, i) => {
      b.y = y;
      y += heights[i] + gap + (b.kind === "underline" ? 40 : 0);
    });
    const layout = { blocks };
    this.layouts.set(index, layout);
    return layout;
  }

  private drawBackground(t: number) {
    const ctx = this.ctx;
    const video = this.videoReady();
    if (video) {
      this.drawFootage(video, t);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, REEL_H);
    g.addColorStop(0, mixHex(this.accent, NEAR_BLACK, 0.93));
    g.addColorStop(1, mixHex(this.accent, NEAR_BLACK, 0.72));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, REEL_W, REEL_H);

    const glow = (cx: number, cy: number, r: number, a: number) => {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, hexAlpha(this.accent, a));
      rg.addColorStop(1, hexAlpha(this.accent, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, REEL_W, REEL_H);
    };
    glow(820 + Math.sin(t * 0.35) * 120, 420 + Math.cos(t * 0.27) * 90, 760, 0.28);
    glow(200 + Math.cos(t * 0.22) * 140, 1560 + Math.sin(t * 0.31) * 110, 900, 0.2);
  }

  /**
   * Cover-crops the backdrop to 9:16, then darkens it so text stays readable.
   * Clips get a slow push-in; stills get a fuller "camera move" (zoom + drift) so they play like video.
   */
  private drawFootage(src: { el: Backdrop; w: number; h: number }, t: number) {
    const ctx = this.ctx;
    const still = src.el instanceof HTMLImageElement;
    const total = Math.max(this.timeline.total, 1);
    const p = clamp(t / total, 0, 1);
    const zoom = still ? 1.08 + p * 0.16 : 1.04 + Math.min(t, 30) * 0.004;
    const scale = Math.max(REEL_W / src.w, REEL_H / src.h) * zoom;
    const w = src.w * scale;
    const h = src.h * scale;
    // Stills drift gently, direction varying by track so neighbouring reels don't move alike.
    const dir = this.reel.trackIndex % 2 === 0 ? 1 : -1;
    const dx = still ? dir * (p - 0.5) * (w - REEL_W) * 0.6 : 0;
    const dy = still ? (0.5 - p) * (h - REEL_H) * 0.4 : 0;
    ctx.drawImage(src.el, (REEL_W - w) / 2 + dx, (REEL_H - h) / 2 + dy, w, h);

    // Scrim: dark at the top (chrome) and bottom (captions/UI), lighter mid-frame.
    const scrim = ctx.createLinearGradient(0, 0, 0, REEL_H);
    scrim.addColorStop(0, "rgba(8, 8, 10, 0.82)");
    scrim.addColorStop(0.22, "rgba(8, 8, 10, 0.5)");
    scrim.addColorStop(0.6, "rgba(8, 8, 10, 0.55)");
    scrim.addColorStop(1, "rgba(8, 8, 10, 0.9)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, REEL_W, REEL_H);
    // A faint wash of the track color ties footage to the reel's palette.
    ctx.fillStyle = hexAlpha(this.accent, 0.1);
    ctx.fillRect(0, 0, REEL_W, REEL_H);
  }

  /** Camera-style chip: "REC" + timecode for real clips, an honest "AI SCENE" label for painted stills. */
  private drawRecChip(t: number) {
    const footage = this.reel.footage;
    if (!footage || !this.videoReady()) return;
    const ctx = this.ctx;
    const isArt = footage.media === "image";
    const secs = Math.floor(t);
    const code = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    ctx.font = `700 28px ${FONT_MONO}`;
    const label = truncate(ctx, footage.caption.trim().toUpperCase(), 560);
    const lead = isArt ? "AI BACKDROP" : "REC";
    const tail = isArt ? "" : `  ${code}`;
    const text = label ? `${lead}  ${label}${tail}` : `${lead}${tail}`;
    const w = ctx.measureText(text).width + 92;
    const x = SAFE.left;
    const y = 1500;
    ctx.fillStyle = "rgba(8, 8, 10, 0.6)";
    roundRect(ctx, x, y, w, 60, 30);
    // Blinking red dot for recordings; a steady accent dot for AI scenes.
    ctx.globalAlpha = isArt || Math.floor(t * 1.6) % 2 === 0 ? 1 : 0.35;
    ctx.fillStyle = isArt ? this.accent : "#FF3B30";
    ctx.beginPath();
    ctx.arc(x + 34, y + 30, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 60, y + 31);
    ctx.textBaseline = "alphabetic";
  }

  private drawChrome(t: number) {
    const ctx = this.ctx;
    const { starts, durations } = this.timeline;
    const n = starts.length;
    const x0 = 96;
    const w = REEL_W - 192;
    const gap = 10;
    const seg = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const p = clamp((t - starts[i]) / durations[i], 0, 1);
      const x = x0 + i * (seg + gap);
      ctx.fillStyle = "rgba(238, 243, 251, 0.22)";
      roundRect(ctx, x, 146, seg, 8, 4);
      if (p > 0) {
        ctx.fillStyle = INK;
        roundRect(ctx, x, 146, seg * p, 8, 4);
      }
    }
    ctx.fillStyle = this.accent;
    ctx.fillRect(96, 214, 44, 8);
    ctx.font = `700 30px ${FONT_MONO}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(truncate(ctx, this.reel.track.toUpperCase(), 760), 156, 219);
    ctx.font = `500 30px ${FONT_UI}`;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(truncate(ctx, `${this.reel.studyTitle || ''} · repofeed.ai`, 860), 96, 272);
    ctx.textBaseline = "alphabetic";
  }

  private drawLine(line: Line, b: Block, x: number, baseline: number) {
    const ctx = this.ctx;
    ctx.font = this.fontString(b.font, b.size);
    const space = ctx.measureText(" ").width;
    let cx = x;
    for (const tok of line.tokens) {
      if (tok.glue) cx -= space;
      ctx.fillStyle = tok.em ? b.emColor : b.color;
      ctx.fillText(tok.word, cx, baseline);
      cx += ctx.measureText(tok.word).width + space;
    }
  }

  private drawScene(index: number, local: number, reduced: boolean, isLast: boolean) {
    const ctx = this.ctx;
    const scene = this.reel.scenes[index];
    const layout = this.layoutScene(index);
    const dur = this.timeline.durations[index];
    const enter = index === 0 ? FIRST_ENTER : ENTER;
    const fadeOut = isLast ? 1 : clamp((dur - local) / FADE_OUT, 0, 1);

    let lineIdx = 0;
    for (const b of layout.blocks) {
      if (b.kind === "quoteMark") {
        const p = reduced ? clamp(local / enter, 0, 1) : easeOutCubic(local / enter);
        ctx.globalAlpha = p * fadeOut;
        ctx.font = this.fontString(b.font, b.size);
        ctx.fillStyle = b.color;
        ctx.fillText("\u201C", SAFE.left - 8, b.y + 170 + (reduced ? 0 : (1 - p) * SLIDE));
        lineIdx++;
        continue;
      }
      b.lines.forEach((line, li) => {
        const start = b.delay + lineIdx * STAGGER;
        const raw = (local - start) / enter;
        const p = reduced ? clamp(raw, 0, 1) : easeOutCubic(raw);
        lineIdx++;
        if (p <= 0) return;
        const dy = reduced ? 0 : (1 - p) * SLIDE;
        const baseline = b.y + li * b.lineHeight + b.size * 0.82 + dy;
        ctx.globalAlpha = p * fadeOut;
        const x = SAFE.left + (b.kind === "bullet" ? 64 : 0);
        if (b.kind === "bullet" && li === 0) {
          ctx.fillStyle = b.emColor;
          ctx.fillRect(SAFE.left, baseline - b.size * 0.42, 32, 10);
        }
        if (b.kind === "stat" && scene.type === "stat" && !reduced && scene.num) {
          const m = scene.num.match(DIGITS_ONLY);
          if (m) {
            const target = parseInt(m[2], 10);
            const cp = easeOutCubic((local - start) / 1.1);
            const shown = `${m[1]}${Math.round(target * cp)}${m[3]}`;
            this.drawLine({ tokens: [{ word: shown, em: false }], width: 0 }, b, x, baseline);
            return;
          }
        }
        this.drawLine(line, b, x, baseline);
      });
      if (b.kind === "underline" && b.lines.length) {
        const last = b.lines[b.lines.length - 1];
        const p = reduced ? 1 : easeOutCubic((local - 0.35) / 0.6);
        if (p > 0) {
          ctx.globalAlpha = fadeOut;
          ctx.fillStyle = b.emColor;
          const y = b.y + b.lines.length * b.lineHeight + 14;
          ctx.fillRect(SAFE.left, y, last.width * p, 12);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draws the full frame at time t (seconds) in 1080×1920 logical units. */
  draw(t: number, reduced = false) {
    const time = clamp(t, 0, this.timeline.total);
    const index = sceneIndexAt(this.timeline, Math.min(time, this.timeline.total - 0.0001));
    const local = time - this.timeline.starts[index];
    this.ctx.save();
    this.drawBackground(reduced ? 0 : time);
    this.drawChrome(time);
    this.drawRecChip(time);
    this.drawScene(index, local, reduced, index === this.reel.scenes.length - 1);
    this.ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
  ctx.fill();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

let fontsReady: Promise<void> | null = null;
/** Resolves once the reel fonts are usable by canvas. */
export function ensureReelFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  fontsReady ??= Promise.all([
    document.fonts.load(`900 100px ${FONT_DISPLAY}`),
    document.fonts.load(`600 100px ${FONT_DISPLAY}`),
    document.fonts.load(`600 60px ${FONT_UI}`),
    document.fonts.load(`700 30px ${FONT_MONO}`),
    document.fonts.load(`500 30px ${FONT_MONO}`),
  ]).then(
    () => undefined,
    () => undefined,
  );
  return fontsReady;
}

/** Full plain-text script of a reel, for screen readers and the text view. */
export function reelScript(scenes: Scene[]): string {
  const strip = (s: string) => s.replace(/\*/g, "");
  return scenes
    .map((s) => {
      switch (s.type) {
        case "hook":
          return strip(s.text || "");
        case "line":
          return strip(s.kicker ? `${s.kicker}: ${s.text || ""}` : (s.text || ""));
        case "list":
          return `${strip(s.title || "")}: ${(s.items || []).map(strip).join("; ")}.`;
        case "stat":
          return `${s.num || ""} ${strip(s.label || "")}.`;
        case "quote":
          return `“${s.text || ""}” — ${s.by || "Unknown"}.`;
        case "cta":
          return `${strip(s.text || "")} ${s.sub || ""}`;
      }
    })
    .join(" ");
}
