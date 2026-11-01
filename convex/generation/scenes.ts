import type { Scene } from "../schema/validators";
import type { RawScene } from "./ai";

const stripStars = (s: string) => s.replace(/\*/g, "");
const clean = (s: string | null | undefined) => (s ?? "").trim();

function wordsCap(s: string, max: number): string {
  const words = s.split(/\s+/).filter(Boolean);
  return words.length <= max ? s : words.slice(0, max).join(" ");
}

/** Converts a loosely-typed AI scene into a strict Scene, or null if unusable. */
export function toScene(raw: RawScene): Scene | null {
  switch (raw.type) {
    case "hook": {
      const text = clean(raw.text);
      return text ? { type: "hook", text } : null;
    }
    case "line": {
      const text = clean(raw.text);
      if (!text) return null;
      const kicker = clean(raw.kicker);
      return kicker
        ? { type: "line", kicker: wordsCap(stripStars(kicker), 3), text }
        : { type: "line", text };
    }
    case "list": {
      const items = (raw.items ?? []).map(clean).filter(Boolean).slice(0, 5);
      if (items.length < 2) return null;
      return {
        type: "list",
        title: clean(raw.title) || "Key points",
        items,
      };
    }
    case "stat": {
      const num = stripStars(clean(raw.num));
      if (!num) return null;
      return { type: "stat", num, label: clean(raw.label) || clean(raw.text) };
    }
    case "quote": {
      const text = stripStars(clean(raw.text)).replace(/^["“]|["”]$/g, "");
      if (!text) return null;
      return { type: "quote", text, by: stripStars(clean(raw.by)) || "Participant" };
    }
    case "cta": {
      const text = clean(raw.text);
      return { type: "cta", text: text || "That's the signal.", sub: "" };
    }
  }
}

/** Enforces hook-first / cta-last, 3–6 scenes, and the "Source:" sub line. */
export function finalizeScenes(
  scenes: Scene[],
  title: string,
  sourceNames: string[],
): Scene[] {
  let list = scenes.filter((s) => s.type !== "cta" || s === scenes[scenes.length - 1]);
  if (list[0]?.type !== "hook") list = [{ type: "hook", text: title }, ...list];
  const last = list[list.length - 1];
  if (last?.type !== "cta") list = [...list, { type: "cta", text: "That's the signal.", sub: "" }];
  // Trim middle scenes to keep at most 6.
  while (list.length > 6) list.splice(list.length - 2, 1);
  // Pad to 3 with a line restating the title if needed.
  if (list.length < 3) list.splice(1, 0, { type: "line", text: title });
  const sub = `Source: ${sourceNames.join(", ") || "study files"}`;
  return list.map((s) => (s.type === "cta" ? { ...s, sub } : s));
}

export function sceneScript(scene: Scene): string {
  switch (scene.type) {
    case "hook":
      return stripStars(scene.text);
    case "line":
      return stripStars(`${scene.kicker ? `${scene.kicker}: ` : ""}${scene.text}`);
    case "list":
      return stripStars(`${scene.title}: ${scene.items.join("; ")}`);
    case "stat":
      return stripStars(`${scene.num} ${scene.label}`);
    case "quote":
      return `"${scene.text}" (${scene.by})`;
    case "cta":
      return `${stripStars(scene.text)} ${scene.sub}`;
  }
}
