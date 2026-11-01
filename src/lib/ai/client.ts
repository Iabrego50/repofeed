import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { StepError, aiHttpError } from '../errors/step-error.js';

// Use direct Anthropic and OpenAI SDKs
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configuration - use the correct current model IDs
export const CHAT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';
export const CHUNK_CHARS = 70_000;
export const MAX_COMPOSE_FINDINGS = 180;
const AI_TIMEOUT_MS = 6 * 60_000;

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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new StepError("AI isn't set up for this app yet.", {
      detail: 'ANTHROPIC_API_KEY is missing',
      retryable: false,
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: args.maxTokens,
      system: `${args.system}\n\nAlways respond by calling the \`${args.tool.name}\` tool exactly once. Do not reply with plain text.`,
      messages: [{ role: 'user', content: args.user }],
      tools: [
        {
          name: args.tool.name,
          description: args.tool.description,
          input_schema: args.tool.parameters as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: args.tool.name },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    let parsed: unknown;
    if (toolUse) {
      parsed = toolUse.input;
    } else {
      // Fallback: try to extract JSON from text blocks
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlock) {
        parsed = extractJson(textBlock.text);
      }
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
    if (err instanceof Anthropic.APIError) {
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
  if (!process.env.OPENAI_API_KEY) {
    throw new StepError("Image AI isn't set up for this app yet.", {
      detail: 'OPENAI_API_KEY is missing',
      retryable: false,
    });
  }

  try {
    const response = await openai.images.generate({
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
