export type Token = { word: string; em: boolean; glue?: boolean };
export type Line = { tokens: Token[]; width: number };
export type Measure = (text: string, size: number) => number;

/** Splits text into words, marking words wrapped in *asterisks* as emphasized. */
export function parseEmphasis(text: string, allowEmphasis = true): Token[] {
  const tokens: Token[] = [];
  const parts = allowEmphasis ? text.split("*") : [text.replace(/\*/g, "")];
  parts.forEach((part, i) => {
    const em = allowEmphasis && i % 2 === 1;
    const words = part.split(/\s+/).filter(Boolean);
    words.forEach((word, wi) => {
      const prev = tokens[tokens.length - 1];
      // Punctuation right after an emphasized span ("*word*?") stays glued to it.
      if (wi === 0 && prev && !/^\s/.test(part) && /^[^\p{L}\p{N}]+$/u.test(word)) {
        tokens.push({ word, em, glue: true });
        return;
      }
      tokens.push({ word, em });
    });
  });
  return tokens;
}

/** Greedy word wrap. Each line's width includes inter-word spaces. */
export function wrapTokens(
  tokens: Token[],
  maxWidth: number,
  size: number,
  measure: Measure,
): Line[] {
  const space = measure(" ", size);
  const lines: Line[] = [];
  let current: Token[] = [];
  let width = 0;
  for (const token of tokens) {
    const w = measure(token.word, size);
    if (token.glue && current.length) {
      // Glued punctuation never starts a new line and adds no space.
      current.push(token);
      width += w;
      continue;
    }
    const next = current.length ? width + space + w : w;
    if (current.length && next > maxWidth) {
      lines.push({ tokens: current, width });
      current = [token];
      width = w;
    } else {
      current.push(token);
      width = next;
    }
  }
  if (current.length) lines.push({ tokens: current, width });
  return lines;
}

export type FitOptions = {
  maxWidth: number;
  maxLines: number;
  startSize: number;
  minSize: number;
  step?: number;
};

/** Shrinks the font until the text wraps into maxLines and no word overflows. */
export function fitText(
  tokens: Token[],
  opts: FitOptions,
  measure: Measure,
): { size: number; lines: Line[] } {
  const step = opts.step ?? 4;
  let size = opts.startSize;
  for (; size >= opts.minSize; size -= step) {
    const lines = wrapTokens(tokens, opts.maxWidth, size, measure);
    const wordsFit = tokens.every((t) => measure(t.word, size) <= opts.maxWidth);
    if (lines.length <= opts.maxLines && wordsFit) return { size, lines };
  }
  size = Math.max(opts.minSize, size + step);
  return { size, lines: wrapTokens(tokens, opts.maxWidth, size, measure) };
}
