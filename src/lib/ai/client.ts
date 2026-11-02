import OpenAI from 'openai';
import { z } from 'zod';
import { requiredEnv } from '../server-env.js';
import { StepError, aiHttpError } from '../errors/step-error.js';

let openai: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') });
  return openai;
}

/** Text/JSON model. Override with OPENAI_TEXT_MODEL. */
export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.1';
export const CHAT_MODEL = TEXT_MODEL;
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';
export const CHUNK_CHARS = 70_000;
export const MAX_COMPOSE_FINDINGS = 180;

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

export async function callTool<T>(args: {
  system: string;
  user: string;
  tool: ToolDef;
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  try {
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
    if (toolCall && toolCall.type === 'function' && toolCall.function.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      parsed = extractJson(message.content);
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
  } catch (err) {
    if (err instanceof StepError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw aiHttpError(err.status || 500, err.message);
    }
    throw new StepError("Couldn't reach the AI service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
}

/** Paints a portrait image (1024×1536) and returns it as a PNG blob. */
export async function generateImage(prompt: string): Promise<Blob> {
  try {
    const response = await getOpenAI().images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: '1024x1536',
      quality: 'standard',
      n: 1,
      response_format: 'b64_json',
    });

    const firstImage = response.data?.[0];
    const b64 = firstImage?.b64_json;
    if (!b64) {
      throw new StepError('The image service sent back no image.', {
        detail: 'missing b64_json',
        retryable: true,
      });
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  } catch (err) {
    if (err instanceof StepError) throw err;
    if (err instanceof OpenAI.APIError) {
      throw aiHttpError(err.status || 500, err.message);
    }
    throw new StepError("Couldn't reach the image service.", {
      detail: err instanceof Error ? err.message : String(err),
      retryable: true,
      cause: err,
    });
  }
}
