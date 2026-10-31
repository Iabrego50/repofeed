import type PptxGenJS from "pptxgenjs";
import { COLORS, KICKERS, deckFileName, headlineStats, kickerFor, pct, reactionData, topByCompletion, topByViews, truncate, type Deck, type DeckSlide } from "./deck.ts";

const hex = (c: string) => c.replace("#", "");
const DISPLAY = "Bricolage Grotesque";
const SANS = "Instrument Sans";
const MONO = "JetBrains Mono";

type Pptx = InstanceType<typeof PptxGenJS>;
type PSlide = ReturnType<Pptx["addSlide"]>;

/** Builds an editable PowerPoint (16:9, native charts) and downloads it. */
export async function exportPptx(deck: Deck): Promise<void> {
  // Loaded on demand so the presenter doesn't pay for it.
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = deck.slides[0]?.headline ?? "Research readout";
  pptx.company = "repofeed.ai";

  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: hex(COLORS.bg) };
    if (s.type === "title" || s.type === "closing") cover(slide, deck, s);
    else content(pptx, slide, deck, s, i, deck.slides.length);
  });
  await pptx.writeFile({ fileName: `${deckFileName(deck)}.pptx` });
}

function cover(slide: PSlide, deck: Deck, s: DeckSlide) {
  slide.addShape("ellipse", { x: 8.6, y: 3.4, w: 6.5, h: 6.5, fill: { color: hex(COLORS.coral), transparency: 82 }, line: { type: "none" } });
  slide.addText("repofeed.ai", { x: 0.9, y: 0.7, w: 5, h: 0.5, fontFace: DISPLAY, fontSize: 18, bold: true, color: hex(COLORS.fg) });
  slide.addText(KICKERS[s.type].toUpperCase(), { x: 0.9, y: 2.5, w: 8, h: 0.4, fontFace: MONO, fontSize: 12, bold: true, color: hex(COLORS.coral), charSpacing: 4 });
  slide.addText(s.headline, { x: 0.9, y: 2.95, w: 8.2, h: 2.0, fontFace: DISPLAY, fontSize: 48, bold: true, color: hex(COLORS.fg), valign: "top" });
  if (s.body) slide.addText(s.body, { x: 0.9, y: 5.0, w: 8, h: 0.9, fontFace: SANS, fontSize: 18, color: hex(COLORS.muted), valign: "top" });
  const date = new Date(deck._creationTime).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  slide.addText(s.type === "title" ? `${deck.scopeLabel} · ${date}` : "Made with repofeed.ai", { x: 0.9, y: 6.6, w: 8, h: 0.35, fontFace: MONO, fontSize: 11, color: "5B6782" });
}

function content(pptx: Pptx, slide: PSlide, deck: Deck, s: DeckSlide, index: number, total: number) {
  slide.addText(kickerFor(deck, index).toUpperCase(), { x: 0.9, y: 0.6, w: 10, h: 0.35, fontFace: MONO, fontSize: 11, bold: true, color: hex(COLORS.coral), charSpacing: 4 });
  slide.addText(s.headline, { x: 0.9, y: 0.95, w: 11.2, h: 1.0, fontFace: DISPLAY, fontSize: 32, bold: true, color: hex(COLORS.fg), valign: "top", fit: "shrink" });
  if (s.body) slide.addText(s.body, { x: 0.9, y: 1.95, w: 10.5, h: 0.7, fontFace: SANS, fontSize: 15, color: hex(COLORS.muted), valign: "top" });
  slide.addText(deck.scopeLabel, { x: 0.9, y: 6.85, w: 8, h: 0.3, fontFace: MONO, fontSize: 10, color: "5B6782" });
  slide.addText(`${index + 1} / ${total}`, { x: 11.2, y: 6.85, w: 1.2, h: 0.3, fontFace: MONO, fontSize: 10, color: "5B6782", align: "right" });

  const area = { x: 0.9, y: 2.8, w: 11.5, h: 3.8 };
  const card = (x: number, y: number, w: number, h: number) =>
    slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.15, fill: { color: hex(COLORS.card) }, line: { color: hex(COLORS.border), width: 1 } });
  const barOpts = {
    ...area,
    barDir: "bar" as const,
    catAxisLabelColor: hex(COLORS.fg),
    catAxisLabelFontFace: SANS,
    catAxisLabelFontSize: 12,
    catAxisLineShow: false,
    valAxisHidden: true,
    valGridLine: { style: "none" as const },
    showValue: true,
    dataLabelColor: hex(COLORS.fg),
    dataLabelFontFace: MONO,
    dataLabelFontSize: 11,
    barGapWidthPct: 45,
  };

  switch (s.type) {
    case "summary": {
      (s.items ?? []).forEach((item, i) => {
        const y = area.y + i * 0.92;
        slide.addShape("line", { x: area.x, y, w: area.w, h: 0, line: { color: hex(COLORS.border), width: 1 } });
        slide.addText(String(i + 1).padStart(2, "0"), { x: area.x, y: y + 0.12, w: 0.9, h: 0.65, fontFace: DISPLAY, fontSize: 26, bold: true, color: hex(COLORS.coral), valign: "middle" });
        slide.addText(item, { x: area.x + 1.0, y: y + 0.12, w: area.w - 1.0, h: 0.65, fontFace: SANS, fontSize: 19, color: hex(COLORS.fg), valign: "middle", fit: "shrink" });
      });
      break;
    }
    case "figures": {
      const stats = s.stats ?? [];
      const w = (area.w - 0.3 * (stats.length - 1)) / Math.max(stats.length, 1);
      stats.forEach((st, i) => {
        const x = area.x + i * (w + 0.3);
        card(x, area.y, w, area.h);
        slide.addText(st.num, { x: x + 0.3, y: area.y + 1.2, w: w - 0.6, h: 1.2, fontFace: DISPLAY, fontSize: 48, bold: true, color: hex(i === 0 ? COLORS.coral : COLORS.fg), fit: "shrink" });
        slide.addText(st.label, { x: x + 0.3, y: area.y + 2.45, w: w - 0.6, h: 1.1, fontFace: SANS, fontSize: 14, color: hex(COLORS.muted), valign: "top", fit: "shrink" });
      });
      break;
    }
    case "finding": {
      const stats = s.stats ?? [];
      const quote = s.quotes?.[0];
      const found = s.reelTitle ? deck.reels.find((r) => r.title === s.reelTitle) : undefined;
      const reel = found && found.trueCount + found.surprisedCount + found.pushbackCount > 0 ? found : undefined;
      const boxH = reel ? area.h - 0.55 : area.h;
      const sw = 2.9;
      stats.forEach((st, i) => {
        const x = area.x + i * (sw + 0.3);
        card(x, area.y, sw, boxH);
        slide.addText(st.num, { x: x + 0.25, y: area.y + boxH - 2.0, w: sw - 0.5, h: 1.0, fontFace: DISPLAY, fontSize: 38, bold: true, color: hex(i === 0 ? COLORS.coral : COLORS.fg), fit: "shrink" });
        slide.addText(st.label, { x: x + 0.25, y: area.y + boxH - 1.0, w: sw - 0.5, h: 0.85, fontFace: SANS, fontSize: 12, color: hex(COLORS.muted), valign: "top", fit: "shrink" });
      });
      if (quote) {
        const qx = area.x + stats.length * (sw + 0.3);
        const qw = area.x + area.w - qx;
        slide.addShape("roundRect", { x: qx, y: area.y, w: qw, h: boxH, rectRadius: 0.15, fill: { color: hex(COLORS.coral) }, line: { type: "none" } });
        slide.addText(`\u201C${quote.text}\u201D`, { x: qx + 0.4, y: area.y + 0.3, w: qw - 0.8, h: boxH - 1.0, fontFace: DISPLAY, fontSize: 22, bold: true, color: hex(COLORS.bg), valign: "middle", fit: "shrink" });
        slide.addText(quote.by.toUpperCase(), { x: qx + 0.4, y: area.y + boxH - 0.65, w: qw - 0.8, h: 0.35, fontFace: MONO, fontSize: 11, bold: true, color: hex(COLORS.bg) });
      }
      if (reel) {
        slide.addText(`Team response to \u201C${reel.title}\u201D: ${reel.trueCount} rings true · ${reel.surprisedCount} surprised · ${reel.pushbackCount} push back`, {
          x: area.x, y: area.y + area.h - 0.35, w: area.w, h: 0.35, fontFace: MONO, fontSize: 11, color: "5B6782",
        });
      }
      break;
    }
    case "numbers": {
      const w = (area.w - 0.3 * 3) / 4;
      headlineStats(deck).forEach((st, i) => {
        const x = area.x + i * (w + 0.3);
        card(x, area.y, w, area.h);
        slide.addText(st.label.toUpperCase(), { x: x + 0.3, y: area.y + 1.4, w: w - 0.6, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: hex(COLORS.muted) });
        slide.addText(st.value, { x: x + 0.3, y: area.y + 1.8, w: w - 0.6, h: 1.0, fontFace: DISPLAY, fontSize: 40, bold: true, color: hex(i === 0 ? COLORS.coral : COLORS.fg), fit: "shrink" });
        slide.addText(st.sub, { x: x + 0.3, y: area.y + 2.85, w: w - 0.6, h: 0.5, fontFace: SANS, fontSize: 13, color: hex(COLORS.muted) });
      });
      break;
    }
    case "reach": {
      // PowerPoint draws horizontal bars bottom-up, so reverse to put the top reel first.
      const reels = topByViews(deck.reels).reverse();
      slide.addChart(pptx.ChartType.bar, [{ name: "People", labels: reels.map((r) => truncate(r.title, 34)), values: reels.map((r) => r.viewers) }], { ...barOpts, chartColors: [hex(COLORS.coral)] });
      break;
    }
    case "completion": {
      const reels = topByCompletion(deck.reels).reverse();
      slide.addChart(pptx.ChartType.bar, [{ name: "Completed", labels: reels.map((r) => truncate(r.title, 34)), values: reels.map((r) => Math.round(r.completionRate * 100)) }], {
        ...barOpts,
        chartColors: [hex(COLORS.green)],
        valAxisMaxVal: 100,
        valAxisMinVal: 0,
        dataLabelFormatCode: '0"%"',
      });
      break;
    }
    case "reactions": {
      const data = reactionData(deck);
      const total = data.reduce((n, d) => n + d.value, 0);
      if (total > 0) {
        slide.addChart(pptx.ChartType.doughnut, [{ name: "Reactions", labels: data.map((d) => d.name), values: data.map((d) => d.value) }], {
          x: area.x, y: area.y - 0.1, w: 4.2, h: 4.0, holeSize: 62, chartColors: data.map((d) => hex(d.color)), showLegend: false, showValue: false, showPercent: false, dataBorder: { pt: 2, color: hex(COLORS.bg) },
        });
      }
      data.forEach((d, i) => {
        const y = area.y + 0.6 + i * 1.0;
        slide.addShape("ellipse", { x: 5.8, y: y + 0.12, w: 0.26, h: 0.26, fill: { color: hex(d.color) }, line: { type: "none" } });
        slide.addText(d.name, { x: 6.3, y, w: 3.5, h: 0.5, fontFace: SANS, fontSize: 20, color: hex(COLORS.fg) });
        slide.addText(String(d.value), { x: 9.8, y, w: 1.2, h: 0.5, fontFace: MONO, fontSize: 22, bold: true, color: hex(COLORS.fg), align: "right" });
        slide.addText(total ? pct(d.value / total) : "–", { x: 11.0, y, w: 1.2, h: 0.5, fontFace: MONO, fontSize: 15, color: hex(COLORS.muted), align: "right" });
      });
      break;
    }
    case "spotlight": {
      const reel = deck.reels.find((r) => r.title === s.reelTitle);
      if (!reel) break;
      slide.addShape("roundRect", { x: area.x, y: area.y, w: 3.4, h: area.h, rectRadius: 0.15, fill: { color: hex(COLORS.coral) }, line: { type: "none" } });
      slide.addText(reel.track.toUpperCase(), { x: area.x + 0.3, y: area.y + 0.3, w: 2.8, h: 0.3, fontFace: MONO, fontSize: 10, bold: true, color: hex(COLORS.bg) });
      slide.addText(reel.title, { x: area.x + 0.3, y: area.y + 1.6, w: 2.8, h: 2.0, fontFace: DISPLAY, fontSize: 26, bold: true, color: hex(COLORS.bg), valign: "bottom" });
      const stats = [
        ["People", reel.viewers.toLocaleString(), COLORS.fg],
        ["Finished", pct(reel.completionRate), COLORS.fg],
        ["Rings true", String(reel.trueCount), COLORS.green],
        ["Surprised me", String(reel.surprisedCount), COLORS.amber],
        ["Push back", String(reel.pushbackCount), COLORS.red],
        ["Comments", String(reel.commentCount), COLORS.fg],
      ] as const;
      const gx = area.x + 3.7;
      const cw = (area.w - 3.7 - 0.25 * 2) / 3;
      const ch = (area.h - 0.25) / 2;
      stats.forEach(([label, value, color], i) => {
        const x = gx + (i % 3) * (cw + 0.25);
        const y = area.y + Math.floor(i / 3) * (ch + 0.25);
        card(x, y, cw, ch);
        slide.addText(value, { x: x + 0.3, y: y + 0.35, w: cw - 0.6, h: 0.8, fontFace: DISPLAY, fontSize: 32, bold: true, color: hex(color) });
        slide.addText(label, { x: x + 0.3, y: y + 1.1, w: cw - 0.6, h: 0.4, fontFace: SANS, fontSize: 13, color: hex(COLORS.muted) });
      });
      break;
    }
    case "voices": {
      const quotes = s.quotes ?? [];
      const w = (area.w - 0.3 * (quotes.length - 1)) / Math.max(quotes.length, 1);
      quotes.forEach((q, i) => {
        const x = area.x + i * (w + 0.3);
        card(x, area.y, w, area.h);
        slide.addText("\u201C", { x: x + 0.3, y: area.y + 0.15, w: 1, h: 0.7, fontFace: DISPLAY, fontSize: 48, bold: true, color: hex(COLORS.coral) });
        slide.addText(q.text, { x: x + 0.3, y: area.y + 0.8, w: w - 0.6, h: 2.3, fontFace: SANS, fontSize: 16, color: hex(COLORS.fg), valign: "top", fit: "shrink" });
        slide.addText(q.by, { x: x + 0.3, y: area.y + 3.2, w: w - 0.6, h: 0.35, fontFace: MONO, fontSize: 11, color: hex(COLORS.muted) });
      });
      break;
    }
    case "next_steps": {
      const w = (area.w - 0.3) / 2;
      (s.items ?? []).forEach((item, i) => {
        const x = area.x + (i % 2) * (w + 0.3);
        const y = area.y + Math.floor(i / 2) * 1.55;
        card(x, y, w, 1.3);
        slide.addShape("ellipse", { x: x + 0.3, y: y + 0.35, w: 0.6, h: 0.6, fill: { color: hex(COLORS.coral) }, line: { type: "none" } });
        slide.addText(String(i + 1), { x: x + 0.3, y: y + 0.35, w: 0.6, h: 0.6, fontFace: DISPLAY, fontSize: 16, bold: true, color: hex(COLORS.bg), align: "center", valign: "middle" });
        slide.addText(item, { x: x + 1.1, y: y + 0.15, w: w - 1.4, h: 1.0, fontFace: SANS, fontSize: 16, color: hex(COLORS.fg), valign: "middle", fit: "shrink" });
      });
      break;
    }
    default:
      break;
  }
}
