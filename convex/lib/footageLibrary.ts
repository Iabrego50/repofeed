import type { Scene } from "../schema/validators";
import type { Footage } from "./demoReels";

type Clip = { url: string; label: string; keywords: string[] };

/** Stock clips (in /public/footage) that stand in for observational fieldwork recordings. */
const CLIPS: Clip[] = [
  { url: "/footage/receipts.mp4", label: "Budget review", keywords: ["price", "cost", "money", "budget", "expensive", "afford", "pay", "discount", "rate", "cheap", "spend"] },
  { url: "/footage/mother-cooking.mp4", label: "Home visit", keywords: ["homework", "help", "parent", "kid", "child", "family", "effort", "chore", "tired", "mental load"] },
  { url: "/footage/box-at-door.mp4", label: "Doorstep cam", keywords: ["skip", "delivery", "box", "deliver", "forgot", "unwanted", "door", "arrive", "shipping"] },
  { url: "/footage/calendar.mp4", label: "Planning session", keywords: ["pause", "week off", "plan", "schedule", "deadline", "calendar", "day", "wednesday", "address", "reschedule"] },
  { url: "/footage/family-dinner.mp4", label: "Dinner obs", keywords: ["nights", "fewer", "portion", "dinner", "household", "size", "too big", "serving", "eat together"] },
  { url: "/footage/wall-clock.mp4", label: "Cook-along", keywords: ["minute", "time", "long", "slow", "takes", "hour", "quick", "cook time", "late"] },
  { url: "/footage/half-onion.mp4", label: "Prep cam", keywords: ["waste", "thrown", "leftover", "guilt", "ingredient", "spoil", "fridge", "throw"] },
  { url: "/footage/frustrated-phone.mp4", label: "Cancel flow", keywords: ["cancel", "screen", "app", "button", "tap", "flow", "click", "settings", "account", "website", "hidden"] },
  { url: "/footage/takeout-tv.mp4", label: "Evening obs", keywords: ["takeout", "never cooked", "plans versus", "real nights", "order in", "evening", "instead", "uncooked"] },
  { url: "/footage/mushrooms.mp4", label: "Cook-along", keywords: ["same", "learned", "repeat", "variety", "rating", "recipe", "menu", "sauce", "chicken", "bored", "personal"] },
];

/** Built-in clips editors can pick by hand on the review step. */
export const STOCK_CLIPS = CLIPS.map(({ url, label }) => ({ url, label }));

export function isStockClip(url: string): boolean {
  return CLIPS.some((c) => c.url === url);
}

function sceneText(scene: Scene): string {
  return Object.values(scene)
    .filter((v): v is string => typeof v === "string")
    .join(" ");
}

/**
 * Picks the stock clip that best matches each reel's words, preferring clips not used yet.
 * Reels with no keyword match get the least-used clip, so every reel has a background.
 */
export function assignFootage(reels: Array<{ title: string; scenes: Scene[] }>): Footage[] {
  const uses = new Map<string, number>();
  return reels.map((reel, i) => {
    // The title counts double since it's the clearest signal of what the reel is about.
    const title = reel.title.toLowerCase();
    const body = reel.scenes.map(sceneText).join(" ").toLowerCase();
    let best: Clip | null = null;
    let bestScore = 0;
    for (const clip of CLIPS) {
      const hits = clip.keywords.reduce((n, k) => n + (title.includes(k) ? 2 : 0) + (body.includes(k) ? 1 : 0), 0);
      if (hits === 0) continue;
      const score = hits - (uses.get(clip.url) ?? 0) * 1.5;
      if (score > bestScore) {
        best = clip;
        bestScore = score;
      }
    }
    const clip = best ?? CLIPS.reduce((a, c) => ((uses.get(c.url) ?? 0) < (uses.get(a.url) ?? 0) ? c : a));
    uses.set(clip.url, (uses.get(clip.url) ?? 0) + 1);
    return { url: clip.url, caption: `${clip.label} · P${String((i % 12) + 1).padStart(2, "0")}` };
  });
}
