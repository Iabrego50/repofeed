import { NO_ONSCREEN_TEXT, withNoOnscreenText } from "./onscreen-text.js";

export const ART_SYSTEM = `You art-direct the background image for a short vertical research video ("insight reel"). Animated text sits on top of the image, so the image sets the mood; it never carries the message.

Write ONE prompt for a photorealistic, documentary-style still that shows the everyday moment, place or object the reel's point is about, the kind of thing a field researcher would film. Examples: a half-used onion on a cutting board under a kitchen light, a phone face-down next to an unopened delivery box, a calendar on a fridge with a pen beside it.

Rules:
- Make it specific to THIS reel's point. Never generic stock imagery (no handshakes, lightbulbs, charts, office teams).
- ${NO_ONSCREEN_TEXT}
- Describe only the physical scene. Do not quote the reel script, title, statistics or captions in the image prompt as words to appear in the picture.
- No identifiable faces. People only from behind, as hands, silhouettes, or out of focus.
- Vertical framing. Keep the upper half calm and fairly dark; put the subject in the lower half.
- Natural or practical light, shallow depth of field, muted colors, subtle film grain.
- Only show what the reel implies. Nothing gory, political or brand-specific.
- caption: 2–4 words naming the fieldwork label, e.g. "Kitchen, weeknight".
Call the save_scene tool.`;

interface SceneLike {
  type?: string;
  [key: string]: unknown;
}

export function scenesText(scenes: SceneLike[]): string {
  return scenes
    .map((s) =>
      Object.values(s)
        .flat()
        .filter((v) => typeof v === "string" && v !== s.type)
        .join(" "),
    )
    .join(" / ")
    .replace(/\*/g, "");
}

export function artUserPrompt(args: {
  studyTitle: string;
  track: string;
  title: string;
  scenes: unknown;
}): string {
  const scenes = Array.isArray(args.scenes)
    ? args.scenes.filter((s): s is SceneLike => !!s && typeof s === "object")
    : [];
  return `Study: ${args.studyTitle}
Track: ${args.track}
Reel title: ${args.title}
Reel script (for subject matter only — never paint these words): ${scenesText(scenes)}`;
}

/** Final image-model prompt: visual scene plus a hard no-text wrapper. */
export function imagePrompt(scene: string): string {
  return withNoOnscreenText(`${scene.trim()}

Style: candid documentary photograph, vertical 2:3 portrait, natural light, shallow depth of field, muted colors, subtle film grain, calm darker upper half. Clean plate: the app overlays all captions later. No identifiable faces.`);
}

export function artCaption(caption: string): string {
  return caption.replace(/["*]/g, "").trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 40);
}
