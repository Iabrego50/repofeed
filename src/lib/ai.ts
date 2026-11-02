import OpenAI from 'openai';
import { getOpenAI, TEXT_MODEL, IMAGE_MODEL } from './ai/client.js';

// This file will be used in Edge Functions / server-side code
// Client-side code should call Edge Functions instead

export interface AIConfig {
  openaiApiKey: string;
}

export function initializeAI(config: AIConfig) {
  if (config.openaiApiKey) process.env.OPENAI_API_KEY ||= config.openaiApiKey;
}

export function getOpenAIClient(): OpenAI {
  return getOpenAI();
}

export const OPENAI_TEXT_MODEL = TEXT_MODEL;
export const OPENAI_IMAGE_MODEL = IMAGE_MODEL;

export const CHUNK_CHARS = 70_000;
export const MAX_COMPOSE_FINDINGS = 180;
const AI_TIMEOUT_MS = 6 * 60_000;

// System prompts (keep from original)
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

export function extractUserPrompt(args: {
  studyTitle: string;
  audience: string;
  goal?: string;
  fileName: string;
  chunkLabel: string;
  text: string;
}): string {
  return `Study: ${args.studyTitle}
Audience: ${args.audience}${args.goal ? `\nGoal: ${args.goal}` : ''}
File: ${args.fileName} (${args.chunkLabel})

<source>
${args.text}
</source>`;
}

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
      f.speaker ? `speaker: ${f.speaker}` : '',
      f.number ? `number: ${f.number}` : '',
      f.label ? `label: ${f.label}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    return `[${f.id}] (${f.type}, strength ${f.strength}, file ${f.file}) ${f.text}${extra ? ` — ${extra}` : ''}`;
  });
  return `Study: ${args.studyTitle}
The feed is for: ${args.audience}${args.goal ? `\nThey should walk away knowing: ${args.goal}` : ''}

Findings:
${lines.join('\n')}`;
}

// Tool schemas remain the same
export const EXTRACT_TOOL = {
  name: 'save_findings',
  description: 'Save the findings extracted from the source chunk',
  input_schema: {
    type: 'object' as const,
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['insight', 'quote', 'stat', 'recommendation', 'context'],
            },
            text: { type: 'string' },
            speaker: { type: 'string' },
            number: { type: 'string' },
            label: { type: 'string' },
            strength: { type: 'integer', minimum: 1, maximum: 3 },
          },
          required: ['type', 'text', 'strength'],
        },
      },
    },
    required: ['findings'],
  },
};

export const COMPOSE_TOOL = {
  name: 'save_reels',
  description: 'Save the composed reels',
  input_schema: {
    type: 'object' as const,
    properties: {
      tracks: { type: 'array', items: { type: 'string' } },
      reels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            track: { type: 'string' },
            title: { type: 'string' },
            findingIds: { type: 'array', items: { type: 'string' } },
            scenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['hook', 'line', 'list', 'stat', 'quote', 'cta'],
                  },
                  text: { type: 'string' },
                  kicker: { type: 'string' },
                  title: { type: 'string' },
                  items: { type: 'array', items: { type: 'string' } },
                  num: { type: 'string' },
                  label: { type: 'string' },
                  by: { type: 'string' },
                },
                required: ['type'],
              },
            },
          },
          required: ['track', 'title', 'findingIds', 'scenes'],
        },
      },
    },
    required: ['tracks', 'reels'],
  },
};

export { generateImage } from './ai/client.js';

/** Call OpenAI with a forced tool (JSON schema) once. */
export async function callOpenAITool<T>(args: {
  system: string;
  user: string;
  tool: typeof EXTRACT_TOOL | typeof COMPOSE_TOOL;
  maxTokens: number;
}): Promise<T> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_completion_tokens: args.maxTokens,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: args.tool.name,
          description: args.tool.description,
          parameters: args.tool.input_schema,
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: args.tool.name } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.find(
    (call) => call.type === 'function' && call.function.name === args.tool.name,
  ) ?? response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function' || !toolCall.function.arguments) {
    throw new Error('No tool use in response');
  }

  return JSON.parse(toolCall.function.arguments) as T;
}
