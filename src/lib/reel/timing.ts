import type { Scene } from "@/schema/validators.ts";

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function wordCount(text: string): number {
  return text.replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
}

/** Seconds a scene stays on screen. */
export function sceneDuration(scene: Scene): number {
  switch (scene.type) {
    case "hook":
      return clamp(1.3 + 0.3 * wordCount(scene.text || ''), 2.2, 4.4);
    case "line":
      return clamp(
        1.3 + 0.3 * wordCount(`${scene.kicker ?? ""} ${scene.text || ''}`),
        2.2,
        4.4,
      );
    case "list":
      return 1.3 + 0.6 * scene.items.length + 0.9;
    case "stat":
      return 3.2;
    case "quote":
      return clamp(1.6 + 0.3 * wordCount(scene.text), 4, 10);
    case "cta":
      return 2.9;
  }
}

export type Timeline = { starts: number[]; durations: number[]; total: number };

export function buildTimeline(scenes: Scene[]): Timeline {
  const durations = scenes.map(sceneDuration);
  const starts: number[] = [];
  let acc = 0;
  for (const d of durations) {
    starts.push(acc);
    acc += d;
  }
  return { starts, durations, total: acc };
}

/** Index of the scene showing at time t (clamped to the last scene). */
export function sceneIndexAt(timeline: Timeline, t: number): number {
  for (let i = timeline.starts.length - 1; i >= 0; i--) {
    if (t >= timeline.starts[i]) return i;
  }
  return 0;
}

export const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
