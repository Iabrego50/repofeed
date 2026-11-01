import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configJsonResponse, requiredEnv, requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { getAnthropic, getOpenAI } from '../../src/lib/ai/client.js';
import { z } from 'zod';

const ART_SYSTEM = `You art-direct the background image for a short vertical research video ("insight reel"). Animated text sits on top of the image, so the image sets the mood; it never carries the message.

Write ONE prompt for a photorealistic, documentary-style still that shows the everyday moment, place or object the reel's point is about, the kind of thing a field researcher would film. Examples: a half-used onion on a cutting board under a kitchen light, a phone face-down next to an unopened delivery box, a calendar on a fridge with a pen beside it.

Rules:
- Make it specific to THIS reel's point. Never generic stock imagery (no handshakes, lightbulbs, charts, office teams).
- No text, letters, numbers, logos, signs, labels or readable screens anywhere.
- No identifiable faces. People only from behind, as hands, silhouettes, or out of focus.
- Vertical framing. Keep the upper half calm and fairly dark; put the subject in the lower half.
- Natural or practical light, shallow depth of field, muted colors, subtle film grain.
- Only show what the reel implies. Nothing gory, political or brand-specific.
- caption: 2–4 words naming the fieldwork label, e.g. "Kitchen, weeknight".
Call the save_scene tool.`;

const ART_TOOL = {
  name: "save_scene",
  description: "Save the background scene for the reel",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The image prompt, 40–90 words" },
      caption: { type: "string", description: "2–4 word scene label" },
    },
    required: ["prompt", "caption"],
  },
};

const artSchema = z.object({
  prompt: z.string().min(10),
  caption: z.string().default(""),
});

function requirePaintEnv() {
  requireSupabaseEnv();
  requiredEnv('ANTHROPIC_API_KEY');
  requiredEnv('OPENAI_API_KEY');
}

interface Scene {
  type: string;
  [key: string]: unknown;
}

function scenesText(scenes: Scene[]): string {
  return scenes
    .map((s) => Object.values(s).flat().filter((v) => typeof v === "string" && v !== s.type).join(" "))
    .join(" / ")
    .replace(/\*/g, "");
}

function artUserPrompt(args: { studyTitle: string; track: string; title: string; scenes: Scene[] }): string {
  return `Study: ${args.studyTitle}
Track: ${args.track}
Reel title: ${args.title}
Reel script: ${scenesText(args.scenes)}`;
}

function imagePrompt(scene: string): string {
  return `${scene.trim()}

Style: candid documentary photograph, vertical 2:3 portrait, natural light, shallow depth of field, muted colors, subtle film grain, calm darker upper half. Absolutely no text, letters, numbers, logos or readable screens. No identifiable faces.`;
}

function artCaption(caption: string): string {
  return caption.replace(/["*]/g, "").trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 40);
}

async function callTool<T>(args: {
  system: string;
  user: string;
  tool: { name: string; description: string; parameters: object };
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: 'user', content: args.user }],
    tools: [
      {
        name: args.tool.name,
        description: args.tool.description,
        input_schema: args.tool.parameters,
      },
    ],
    tool_choice: { type: 'tool', name: args.tool.name },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No tool call in AI response');
  }

  return args.schema.parse(toolUse.input);
}

async function generateImage(prompt: string): Promise<Buffer> {
  const response = await getOpenAI().images.generate({
    model: 'gpt-image-2.5-flare',
    prompt,
    size: '1024x1536',
    quality: 'standard',
    n: 1,
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in response');
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch generated image: ${imageRes.status}`);
  }

  return Buffer.from(await imageRes.arrayBuffer());
}

export async function POST(req: Request) {
  try {
    requirePaintEnv();
  } catch (error) {
    return configJsonResponse(error) ?? new Response(JSON.stringify({ error: 'Server not configured' }), { status: 503 });
  }

  const { reelId } = await req.json();
  
  if (!reelId) {
    return new Response(JSON.stringify({ error: 'reelId is required' }), { status: 400 });
  }

  try {
    // Get reel data
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, workspace_id, study_id, title, track, scenes, studies(title)')
      .eq('id', reelId)
      .single();

    if (reelError || !reel) {
      return new Response(JSON.stringify({ error: 'Reel not found' }), { status: 404 });
    }

    // Mark as pending
    await supabase
      .from('reels')
      .update({ 
        art_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', reelId);

    // Generate scene description with AI
    const scene = await callTool({
      system: ART_SYSTEM,
      user: artUserPrompt({
        studyTitle: reel.studies?.title || '',
        track: reel.track,
        title: reel.title,
        scenes: reel.scenes as Scene[],
      }),
      tool: ART_TOOL,
      schema: artSchema,
      maxTokens: 800,
    });

    // Generate image
    const imageBuffer = await generateImage(imagePrompt(scene.prompt));

    // Upload to storage
    const fileName = `art-${reelId}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    // Update reel with art
    await supabase
      .from('reels')
      .update({
        footage: {
          url: publicUrl,
          caption: artCaption(scene.caption),
          media: 'image',
        },
        art_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId);

    return new Response(JSON.stringify({ 
      status: 'completed',
      url: publicUrl,
      caption: artCaption(scene.caption),
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const configured = configJsonResponse(error);
    if (configured) return configured;
    console.error('Art painting failed:', error);
    
    // Mark as failed
    await supabase
      .from('reels')
      .update({
        art_status: 'failed',
        art_error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId);

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Art painting failed' 
    }), { status: 500 });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    requirePaintEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }
  const request = new Request('http://localhost/api/art/paint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req.body ?? {}),
  });
  const response = await POST(request);
  const text = await response.text();
  const contentType = response.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  return res.status(response.status).send(text);
}
