import OpenAI from 'openai';
import { z } from 'zod';
import { requiredEnv } from '../server-env.js';
import { StepError, mapOpenAIError } from '../errors/step-error.js';
import { AI_CALL_TIMEOUT_MS } from '../api/generation-guards.js';

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
export const IMAGE_FALLBACK_MODEL = 'dall-e-3';

export function isGptImageModel(model: string): boolean {
  return model.startsWith('gpt-image');
}

export function dalleQuality(quality: ImageQuality = IMAGE_QUALITY): 'standard' | 'hd' {
  return quality === 'high' ? 'hd' : 'standard';
}

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

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as { name?: string }).name ?? '');
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    name === 'APIUserAbortError' ||
    name === 'APIConnectionTimeoutError'
  );
}

/** AbortController timeout passed as OpenAI RequestOptions, not in the JSON body. */
export function abortAfter(ms: number): {
  signal: AbortSignal;
  cancel: () => void;
  options: { signal: AbortSignal; timeout: number };
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
    options: { signal: controller.signal, timeout: ms },
  };
}

export function timeoutSignal(ms: number): AbortSignal {
  return abortAfter(ms).signal;
}

async function callToolOnce<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
  strict: boolean;
  timeoutMs: number;
}): Promise<T> {
  const abort = abortAfter(args.timeoutMs);
  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await getOpenAI().chat.completions.create(
      {
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
      },
      abort.options,
    );
  } finally {
    abort.cancel();
  }

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

function toToolError(err: unknown): never {
  if (isAbortError(err)) {
    throw new StepError('The AI timed out.', {
      detail: `Aborted after ${AI_CALL_TIMEOUT_MS}ms`,
      retryable: true,
      httpStatus: 504,
    });
  }
  if (err instanceof OpenAI.APIError) throw mapOpenAIError(err);
  if (err instanceof StepError) throw err;
  throw new StepError("Couldn't reach the AI service.", {
    detail: err instanceof Error ? err.message : String(err),
    retryable: true,
    cause: err,
  });
}

export async function callTool<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<T> {
  const timeoutMs = args.timeoutMs ?? AI_CALL_TIMEOUT_MS;
  const strictFirst = args.tool.name === 'save_reels';
  try {
    return await callToolOnce({ ...args, strict: strictFirst, timeoutMs });
  } catch (err) {
    if (isAbortError(err)) toToolError(err);
    if (shouldRetryToolCall(err)) {
      try {
        return await callToolOnce({ ...args, strict: false, timeoutMs });
      } catch (retryErr) {
        toToolError(retryErr);
      }
    }
    toToolError(err);
  }
}

export function imageGenerateParams(
  prompt: string,
  model: string = IMAGE_MODEL,
  quality: ImageQuality = IMAGE_QUALITY,
) {
  if (isGptImageModel(model)) {
    return {
      model,
      prompt,
      size: '1024x1536' as const,
      quality,
      n: 1,
    };
  }
  return {
    model,
    prompt,
    size: '1024x1792' as const,
    quality: dalleQuality(quality),
    n: 1,
    response_format: 'b64_json' as const,
  };
}

export function isImageModelUnavailable(err: {
  status?: number | null;
  message?: string;
  code?: string | null;
}): boolean {
  const status = err.status ?? 0;
  const message = err.message ?? '';
  const code = err.code ?? '';
  if (code === 'model_not_found' || /model_not_found/i.test(message)) return true;
  if (/does not exist|unknown model|invalid model/i.test(message)) return true;
  if ((status === 403 || status === 400) && /verif|organization|must be verified/i.test(message)) {
    return true;
  }
  return false;
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

export async function generateImageWithModels(
  prompt: string,
  models: string[],
  generate: (params: ReturnType<typeof imageGenerateParams>) => Promise<ImageGenerateResponse>,
): Promise<{ blob: Blob; model: string }> {
  const unique = [...new Set(models.filter(Boolean))];
  let lastError: unknown;
  for (const model of unique) {
    try {
      const response = await generate(imageGenerateParams(prompt, model));
      console.info(`[art] image model used: ${model}`);
      return { blob: await pngBlobFromImageResponse(response), model };
    } catch (err) {
      lastError = err;
      const unavailable =
        err instanceof OpenAI.APIError
          ? isImageModelUnavailable(err)
          : isImageModelUnavailable({
              message: err instanceof Error ? err.message : String(err),
            });
      if (!unavailable) break;
      console.warn(`[art] ${model} unavailable, trying next image model`, err);
    }
  }
  if (lastError instanceof StepError) throw lastError;
  if (lastError instanceof OpenAI.APIError) throw mapOpenAIError(lastError);
  throw new StepError("Couldn't reach the image service.", {
    detail: lastError instanceof Error ? lastError.message : String(lastError),
    retryable: true,
    cause: lastError,
  });
}

/** Paints a portrait image and returns it as a PNG blob. */
export async function generateImage(prompt: string): Promise<Blob> {
  const models = [IMAGE_MODEL, IMAGE_FALLBACK_MODEL];
  const { blob } = await generateImageWithModels(prompt, models, async (params) => {
    const abort = abortAfter(AI_CALL_TIMEOUT_MS);
    try {
      return await getOpenAI().images.generate(params, abort.options);
    } catch (err) {
      if (isAbortError(err)) {
        throw new StepError('The AI timed out.', {
          detail: `Aborted after ${AI_CALL_TIMEOUT_MS}ms`,
          retryable: true,
          httpStatus: 504,
        });
      }
      throw err;
    } finally {
      abort.cancel();
    }
  });
  return blob;
}
