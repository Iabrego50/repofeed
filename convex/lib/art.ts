import { z } from "zod";
import type { Scene } from "../schema/validators";

export const ART_SYSTEM = `You art-direct the background image for a short vertical research video ("insight reel"). Animated text sits on top of the image, so the image sets the mood; it never carries the message.

Write ONE prompt for a photorealistic, documentary-style still that shows the everyday moment, place or object the reel's point is about, the kind of thing a field researcher would film. Examples: a half-used onion on a cutting board under a kitchen light, a phone face-down next to an unopened delivery box, a calendar on a fridge with a pen beside it.

Rules:
- Make it specific to THIS reel's point. Never generic stock imagery (no handshakes, lightbulbs, charts, office teams).
- No text, letters, numbers, logos, signs, labels or readable screens anywhere.
- No identifiable faces. People only from behind, as hands, silhouettes, or out of focus.
- Vertical framing. Keep the upper half calm and fairly dark; put the subject in the lower half.
- Natural or practical light, shallow depth of field, muted colors, subtle film grain.
- Only show what the reel implies. Nothing gory, political or brand-specific.
- caption: 2–4 words naming the scene like a fieldwork label, e.g. "Kitchen, weeknight".
Call the save_scene tool.`;

export const ART_TOOL = {
  name: "save_scene",
  description: "Save the background scene for the reel",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The image prompt, 40–90 words" },
      caption: { type: "string", description: "2–4 word scene label" },
    },
    required: ["prompt", "caption"],
  },
};

export const artSchema = z.object({
  prompt: z.string().min(10),
  caption: z.string().default(""),
});

/** Plain-text version of a reel's scenes for the prompt. */
export function scenesText(scenes: Scene[]): string {
  return scenes
    .map((s) => Object.values(s).flat().filter((v) => typeof v === "string" && v !== s.type).join(" "))
    .join(" / ")
    .replace(/\*/g, "");
}

export function artUserPrompt(args: { studyTitle: string; track: string; title: string; scenes: Scene[] }): string {
  return `Study: ${args.studyTitle}
Track: ${args.track}
Reel title: ${args.title}
Reel script: ${scenesText(args.scenes)}`;
}

/** Wraps Claude's scene with the fixed style guards so every image fits behind text. */
export function imagePrompt(scene: string): string {
  return `${scene.trim()}

Style: candid documentary photograph, vertical 2:3 portrait, natural light, shallow depth of field, muted colors, subtle film grain, calm darker upper half. Absolutely no text, letters, numbers, logos or readable screens. No identifiable faces.`;
}

export function artCaption(caption: string): string {
  return caption.replace(/["*]/g, "").trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 40);
}
