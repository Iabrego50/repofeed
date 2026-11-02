import { z } from 'zod';

// Prompts and schemas for extraction and composition

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
Audience: ${args.audience}${args.goal ? `\nGoal: ${args.goal}` : ''}
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

// Tool definitions

export const EXTRACT_TOOL = {
  name: 'save_findings',
  description: 'Save the findings extracted from the source chunk',
  parameters: {
    type: 'object',
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

export const extractSchema = z.object({
  findings: z.array(
    z.object({
      type: z.enum(['insight', 'quote', 'stat', 'recommendation', 'context']),
      text: z.string().min(1),
      speaker: z.string().nullish(),
      number: z.string().nullish(),
      label: z.string().nullish(),
      strength: z.coerce.number().catch(2),
    })
  ),
});

export const SCENE_TYPES = ['hook', 'line', 'list', 'stat', 'quote', 'cta'] as const;
export type SceneTypeName = (typeof SCENE_TYPES)[number];

export function coerceSceneType(type: unknown): SceneTypeName {
  if (typeof type === 'string' && (SCENE_TYPES as readonly string[]).includes(type)) {
    return type as SceneTypeName;
  }
  return 'line';
}

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const nullableStringList = {
  anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }],
};

const composeSceneJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: [...SCENE_TYPES] },
    text: nullableString,
    kicker: nullableString,
    title: nullableString,
    items: nullableStringList,
    num: nullableString,
    label: nullableString,
    by: nullableString,
  },
  required: ['type', 'text', 'kicker', 'title', 'items', 'num', 'label', 'by'],
};

export const COMPOSE_TOOL = {
  name: 'save_reels',
  description: 'Save the composed reels',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tracks: { type: 'array', items: { type: 'string' } },
      reels: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: nullableString,
            track: { type: 'string' },
            title: { type: 'string' },
            findingIds: { type: 'array', items: { type: 'string' } },
            scenes: {
              type: 'array',
              items: composeSceneJsonSchema,
            },
          },
          required: ['id', 'track', 'title', 'findingIds', 'scenes'],
        },
      },
    },
    required: ['tracks', 'reels'],
  },
};

export const rawSceneSchema = z.object({
  type: z.preprocess(coerceSceneType, z.enum(SCENE_TYPES)),
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
    })
  ),
});

export type ComposeOutput = z.infer<typeof composeSchema>;
