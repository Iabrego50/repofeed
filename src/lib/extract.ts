// Client-side text extraction for research source files.

export const ACCEPTED_EXTENSIONS = [
  "txt", "md", "csv", "tsv", "json", "vtt", "srt", "pdf", "docx", "pptx", "xlsx",
] as const;

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Strips cue numbers and timestamps from subtitle files, keeping spoken text. */
export function cleanSubtitles(text: string): string {
  return text
    .replace(/^WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\d+$/.test(line.trim()) &&
        !/-->/.test(line) &&
        !/^(NOTE|STYLE|REGION)\b/.test(line.trim()),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join(""),
    );
  }
  return pages.join("\n\n");
}

async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

async function extractPptx(buf: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  const slideNum = (p: string) => Number(p.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/.test(p))
    .sort((a, b) => slideNum(a) - slideNum(b) || a.localeCompare(b));
  const out: string[] = [];
  for (const path of slides) {
    const xml = await zip.files[path].async("string");
    const paras = xml.split(/<\/a:p>/).map((p) =>
      Array.from(p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), (m) => decodeXml(m[1])).join(""),
    );
    const text = paras.filter(Boolean).join("\n");
    if (text) out.push(`${path.includes("notes") ? "Notes" : "Slide"} ${slideNum(path)}:\n${text}`);
  }
  return out.join("\n\n");
}

async function extractXlsx(buf: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    return `Sheet: ${name}\n${csv}`;
  }).join("\n\n");
}

/** Reads a file and returns its text, or throws an Error with a readable reason. */
export async function extractText(file: File): Promise<string> {
  const ext = extensionOf(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(`.${ext || "?"} files aren't supported`);
  }
  if (file.size > MAX_FILE_BYTES) throw new Error("File is larger than 25 MB");
  if (file.size === 0) throw new Error("File is empty");
  let text: string;
  try {
    switch (ext) {
      case "pdf":
        text = await extractPdf(await file.arrayBuffer());
        break;
      case "docx":
        text = await extractDocx(await file.arrayBuffer());
        break;
      case "pptx":
        text = await extractPptx(await file.arrayBuffer());
        break;
      case "xlsx":
        text = await extractXlsx(await file.arrayBuffer());
        break;
      case "vtt":
      case "srt":
        text = cleanSubtitles(await file.text());
        break;
      case "json": {
        const raw = await file.text();
        try {
          text = JSON.stringify(JSON.parse(raw), null, 1);
        } catch {
          text = raw;
        }
        break;
      }
      default:
        text = await file.text();
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    throw new Error(`Couldn't read this file (${reason}). It may be damaged or password-protected.`, { cause: err });
  }
  // Strip NUL characters that some extractors leave behind.
  text = text.split(String.fromCharCode(0)).join("").trim();
  if (!text) {
    throw new Error(
      ext === "pdf"
        ? "No text found. This PDF may be scanned images; export it with text and try again."
        : "No readable text found in this file",
    );
  }
  return text;
}
