/**
 * Shared negative for generated reel footage and stills.
 *
 * The app burns scene copy in `ReelPainter`. If a model writes titles,
 * captions or quotes into the plate, that baked-in type stacks under the
 * overlay and becomes unreadable. Lead and trail prompts with this.
 */
export const NO_ONSCREEN_TEXT =
  "Absolutely no on-screen text of any kind: no letters, numbers, captions, titles, subtitles, logos, watermarks, signage, labels, lower-thirds, credits, typography, posters, or readable screens.";

/** Wraps a visual prompt so the no-text rule is first and last. */
export function withNoOnscreenText(body: string): string {
  const core = body.trim();
  return `${NO_ONSCREEN_TEXT} ${core} ${NO_ONSCREEN_TEXT}`.replace(/\s+/g, " ").trim();
}

const FORBIDDEN_ONSCREEN = [
  "letters",
  "captions",
  "titles",
  "subtitles",
  "logos",
  "signage",
] as const;

/** True when a media prompt explicitly forbids the on-screen text kinds we overlay ourselves. */
export function forbidsOnscreenText(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return FORBIDDEN_ONSCREEN.every((word) => lower.includes(word));
}
