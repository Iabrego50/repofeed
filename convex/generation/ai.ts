import { z } from "zod";
import { StepError, aiHttpError } from "../lib/stepError";

// AI Gateway (Anthropic models via the OpenAI-compatible Chat Completions API).
const GATEWAY_URL = "https://ai-gateway.hercules.app/v1/chat/completions";
export const MODEL = "anthropic/claude-sonnet-5-5";
export const CHUNK_CHARS = 70_000;
export const MAX_COMPOSE_FINDINGS = 180;
const AI_TIMEOUT_MS = 6 * 60_000;

export const EXTRACT_SYSTEM = `You are a senior research analyst. You read raw research material (interview transcripts, survey exports, diary notes, reports) and extract discrete findings.

Rules:
- Use ONLY what the source says. Never invent numbers, quotes, people or causes.
- Finding types: insight, quote, stat, recommendation, context.
- quote: the participant's EXACT words copied character-for-character, at most 45 words. speaker = their role/descriptor only (e.g. "Parent of two, 7 months"), never a person's name.
- stat: "number" is the number exactly as written in the source (e.g. "46%", "7 of 10", "17 minutes"). "label" says what it measures, plus the sample size if stated (e.g. "forgot to skip a week, n=1,140").
- recommendation: only if the source itself proposes it.
- insight: a pattern or conclusion the source states. context: method, sample, setting.
- strength 1–3: 3 = central, well-supported and surprising; 1 = minor.
- Return at most 60 findings per chunk. Prefer quotes and stats that would make a strong one-point short video.
Call the save_findings tool with your result.`;

export function extractUserPrompt(args: {
  studyTitle: string;
  audience: string;
  goal?: string;
  fileName: string;
  chunkLabel: string;
  text: string;
}): string {
  return `Study: ${args.studyTitle}
Audience: ${args.audience}${args.goal ? `\nGoal: ${args.goal}` : ""}
File: ${args.fileName} (${args.chunkLabel})

<source>
${args.text}
</source>`;
}

export const COMPOSE_SYSTEM = `You write short vertical "insight reels": 10–20 second animated-text videos that each make ONE point from research findings.

Write 8–24 reels grouped into 3–4 tracks (e.g. "What customers say", "By the numbers", "At home", "What to fix"). Each reel has a title of at most 6 words, the ids of the findings it uses, and 3–6 scenes.
The first scene is ALWAYS type "hook" and the last is ALWAYS type "cta".

Scene types and fields:
- hook: text (≤12 words)
- line: kicker (optional, ≤3 words), text (≤16 words)
- list: title (≤3 words), items (2–5 items, each ≤5 words)
- stat: num (EXACTLY as written in the finding), label (≤7 words)
- quote: text (VERBATIM from a quote finding, ≤40 words), by (speaker role)
- cta: text (≤7 words)

Wrap 1–2 key words per scene in *asterisks* for accent emphasis. NEVER use asterisks inside quote text, stat num, or list items that contain numbers.

Hard rules:
- Only facts from the findings. Quotes copied exactly. Numbers exactly as given.
- No private names. No causes or recommendations the findings don't state.
- Every reel must cite at least one finding id.
Call the save_reels tool with your result.`;

export function composeUserPrompt(args: {
  studyTitle: string;
  audience: string;
  goal?: string;
  findings: Array<{
    id: string;
    type: string;
    text: string;
    speaker?: string;
    number?: string;
    label?: string;
    strength: number;
    file: string;
  }>;
}): string {
  const lines = args.findings.map((f) => {
    const extra = [
      f.speaker ? `speaker: ${f.speaker}` : "",
      f.number ? `number: ${f.number}` : "",
      f.label ? `label: ${f.label}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    return `[${f.id}] (${f.type}, strength ${f.strength}, file ${f.file}) ${f.text}${extra ? ` — ${extra}` : ""}`;
  });
  return `Study: ${args.studyTitle}
The feed is for: ${args.audience}${args.goal ? `\nThey should walk away knowing: ${args.goal}` : ""}

Findings:
${lines.join("\n")}`;
}

// ---------- Tool schemas ----------

export const EXTRACT_TOOL = {
  name: "save_findings",
  description: "Save the findings extracted from the source chunk",
  parameters: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["insight", "quote", "stat", "recommendation", "context"],
            },
            text: { type: "string" },
            speaker: { type: "string" },
            number: { type: "string" },
            label: { type: "string" },
            strength: { type: "integer", minimum: 1, maximum: 3 },
          },
          required: ["type", "text", "strength"],
        },
      },
    },
    required: ["findings"],
  },
};

export const extractSchema = z.object({
  findings: z.array(
    z.object({
      type: z.enum(["insight", "quote", "stat", "recommendation", "context"]),
      text: z.string().min(1),
      speaker: z.string().nullish(),
      number: z.string().nullish(),
      label: z.string().nullish(),
      strength: z.coerce.number().catch(2),
    }),
  ),
});

export const COMPOSE_TOOL = {
  name: "save_reels",
  description: "Save the composed reels",
  parameters: {
    type: "object",
    properties: {
      tracks: { type: "array", items: { type: "string" } },
      reels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            track: { type: "string" },
            title: { type: "string" },
            findingIds: { type: "array", items: { type: "string" } },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["hook", "line", "list", "stat", "quote", "cta"],
                  },
                  text: { type: "string" },
                  kicker: { type: "string" },
                  title: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                  num: { type: "string" },
                  label: { type: "string" },
                  by: { type: "string" },
                },
                required: ["type"],
              },
            },
          },
          required: ["track", "title", "findingIds", "scenes"],
        },
      },
    },
    required: ["tracks", "reels"],
  },
};

export const rawSceneSchema = z.object({
  type: z.enum(["hook", "line", "list", "stat", "quote", "cta"]),
  text: z.string().nullish(),
  kicker: z.string().nullish(),
  title: z.string().nullish(),
  items: z.array(z.string()).nullish(),
  num: z.string().nullish(),
  label: z.string().nullish(),
  by: z.string().nullish(),
});
export type RawScene = z.infer<typeof rawSceneSchema>;

export const composeSchema = z.object({
  tracks: z.array(z.string()).default([]),
  reels: z.array(
    z.object({
      id: z.string().nullish(),
      track: z.string(),
      title: z.string(),
      findingIds: z.array(z.string()).default([]),
      scenes: z.array(rawSceneSchema),
    }),
  ),
});
export type ComposeOutput = z.infer<typeof composeSchema>;

// ---------- Image generation ----------

const IMAGE_URL = "https://ai-gateway.hercules.app/v1/images/generations";
const IMAGE_MODEL = "openai/gpt-image-2.5-flare";
const IMAGE_TIMEOUT_MS = 3 * 60_000;

/** Paints a portrait image (1024×1536) and returns it as a PNG blob. */
export async function generateImage(prompt: string): Promise<Blob> {
  const apiKey = process.env.HERCULES_API_KEY;
  if (!apiKey) {
    throw new StepError("AI isn't set up for this app yet.", { detail: "HERCULES_API_KEY is missing", retryable: false });
  }
  let res: Response;
  try {
    res = await fetch(IMAGE_URL, {
      method: "POST",
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1536", quality: "medium", n: 1 }),
    });
  } catch (err) {
    throw new StepError("Couldn't reach the image service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
  const data = (await res.json().catch(() => ({}))) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) throw aiHttpError(res.status, data.error?.message ?? "unknown");
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new StepError("The image service sent back no image.", { detail: "missing b64_json", retryable: true });
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

// ---------- Gateway call ----------

type ToolDef = { name: string; description: string; parameters: object };

type ChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      tool_calls?: Array<{ function?: { arguments?: string } }>;
    };
  }>;
  error?: { message?: string };
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model returned no JSON");
  return JSON.parse(body.slice(start, end + 1));
}

export async function callTool<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const apiKey = process.env.HERCULES_API_KEY;
  if (!apiKey) {
    throw new StepError("AI isn't set up for this app yet.", { detail: "HERCULES_API_KEY is missing", retryable: false });
  }
  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      // Abort hung requests well inside the worker's lease so the step can retry.
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: args.maxTokens,
        messages: [
          {
            role: "system",
            content: `${args.system}\n\nAlways respond by calling the \`${args.tool.name}\` tool exactly once. Do not reply with plain text.`,
          },
          { role: "user", content: args.user },
        ],
        tools: [{ type: "function", function: args.tool }],
        // This model rejects forced tool choice ("tool"/"any"), so let it pick;
        // the system prompt requires the tool and plain-JSON replies are still parsed below.
        tool_choice: "auto",
      }),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new StepError(timedOut ? "The AI took too long to answer." : "Couldn't reach the AI service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) throw aiHttpError(res.status, data.error?.message ?? "unknown");

  const choice = data.choices?.[0];
  const message = choice?.message;
  const rawArgs = message?.tool_calls?.[0]?.function?.arguments;
  let parsed: unknown;
  try {
    parsed = rawArgs ? JSON.parse(rawArgs) : extractJson(message?.content ?? "");
  } catch (err) {
    parsed = undefined;
    if (choice?.finish_reason !== "length") {
      throw new StepError("The AI sent back an answer we couldn't read.", {
        detail: err instanceof Error ? err.message : String(err),
        retryable: true,
        cause: err,
      });
    }
  }
  if (choice?.finish_reason === "length" && parsed === undefined) {
    throw new StepError("The AI's answer was cut off because it was too long.", {
      detail: "finish_reason=length",
      retryable: true,
    });
  }
  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    throw new StepError("The AI sent back an answer in the wrong format.", {
      detail: `Unexpected shape: ${result.error.message}`,
      retryable: true,
    });
  }
  return result.data;
}
