import OpenAI from 'openai';
import { z } from 'zod';
import { requiredEnv } from '../server-env.js';
import { StepError, mapOpenAIError } from '../errors/step-error.js';

let openai: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') });
  return openai;
}

/** Text/JSON model. Override with OPENAI_TEXT_MODEL. */
export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.1';
export const CHAT_MODEL = TEXT_MODEL;
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
export const CHUNK_CHARS = 70_000;
export const MAX_COMPOSE_FINDINGS = 180;

const IMAGE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export function imageQuality(value: string | undefined = process.env.OPENAI_IMAGE_QUALITY): ImageQuality {
  const raw = String(value || 'medium').trim().toLowerCase();
  return IMAGE_QUALITIES.find((item) => item === raw) ?? 'medium';
}

export const IMAGE_QUALITY = imageQuality();

type ToolDef = {
  name: string;
  description: string;
  parameters: object;
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Model returned no JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function isFormatError(err: unknown): boolean {
  if (!(err instanceof StepError)) return false;
  return /wrong format|couldn't read|no json|unexpected shape|invalid_value/i.test(
    `${err.message} ${err.detail.detail}`,
  );
}

export function shouldRetryToolCall(err: unknown): boolean {
  const badRequest =
    err instanceof OpenAI.APIError &&
    (err.status === 400 || /invalid_value|unrecognized|json_schema/i.test(err.message));
  return isFormatError(err) || badRequest;
}

async function callToolOnce<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
  strict: boolean;
}): Promise<T> {
  const response = await getOpenAI().chat.completions.create({
    model: TEXT_MODEL,
    max_completion_tokens: args.maxTokens,
    messages: [
      {
        role: 'system',
        content: `${args.system}\n\nAlways respond by calling the \`${args.tool.name}\` tool exactly once. Do not reply with plain text.`,
      },
      { role: 'user', content: args.user },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: args.tool.name,
          description: args.tool.description,
          parameters: args.tool.parameters as Record<string, unknown>,
          ...(args.strict ? { strict: true } : {}),
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: args.tool.name } },
  });

  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.find(
    (call) => call.type === 'function' && call.function.name === args.tool.name,
  ) ?? message?.tool_calls?.[0];

  let parsed: unknown;
  try {
    if (toolCall && toolCall.type === 'function' && toolCall.function.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      parsed = extractJson(message.content);
    }
  } catch (parseErr) {
    throw new StepError('The AI sent back an answer in the wrong format.', {
      detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
      retryable: true,
    });
  }

  if (parsed === undefined) {
    throw new StepError("The AI sent back an answer we couldn't read.", {
      detail: 'No tool use or valid JSON found',
      retryable: true,
    });
  }

  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    throw new StepError('The AI sent back an answer in the wrong format.', {
      detail: `Unexpected shape: ${result.error.message}`,
      retryable: true,
    });
  }

  return result.data;
}

export async function callTool<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const strictFirst = args.tool.name === 'save_reels';
  try {
    return await callToolOnce({ ...args, strict: strictFirst });
  } catch (err) {
    if (shouldRetryToolCall(err)) {
      try {
        return await callToolOnce({ ...args, strict: false });
      } catch (retryErr) {
        if (retryErr instanceof OpenAI.APIError) throw mapOpenAIError(retryErr);
        throw retryErr;
      }
    }
    if (err instanceof OpenAI.APIError) throw mapOpenAIError(err);
    if (err instanceof StepError) throw err;
    throw new StepError("Couldn't reach the AI service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
}

export function imageGenerateParams(prompt: string, quality: ImageQuality = IMAGE_QUALITY) {
  return {
    model: IMAGE_MODEL,
    prompt,
    size: '1024x1536' as const,
    quality,
    n: 1,
  };
}

export function pngBlobFromB64(b64: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

type ImageGenerateResponse = {
  data?: Array<{ b64_json?: string | null; url?: string | null }> | null;
};

export async function pngBlobFromImageResponse(
  response: ImageGenerateResponse,
  fetchImpl: typeof fetch = fetch,
): Promise<Blob> {
  const firstImage = response.data?.[0];
  const b64 = firstImage?.b64_json;
  if (b64) return pngBlobFromB64(b64);

  const url = firstImage?.url;
  if (url) {
    const imageRes = await fetchImpl(url);
    if (!imageRes.ok) {
      throw new StepError('The image service sent back no image.', {
        detail: `url fetch failed: ${imageRes.status}`,
        retryable: true,
      });
    }
    return new Blob([await imageRes.arrayBuffer()], { type: 'image/png' });
  }

  throw new StepError('The image service sent back no image.', {
    detail: 'missing b64_json',
    retryable: true,
  });
}

/** Paints a portrait image (1024×1536) and returns it as a PNG blob. */
export async function generateImage(prompt: string): Promise<Blob> {
  try {
    const response = await getOpenAI().images.generate(imageGenerateParams(prompt));
    return pngBlobFromImageResponse(response);
  } catch (err) {
    if (err instanceof StepError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw mapOpenAIError(err);
    }
    throw new StepError("Couldn't reach the image service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
}
