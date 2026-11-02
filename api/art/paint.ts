import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthError, requireUser, requireWorkspaceEditor } from '../_lib/auth.js';
import { configJsonResponse, requiredEnv, requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { callTool, generateImage } from '../../src/lib/ai/client.js';
import { StepError } from '../../src/lib/errors/step-error.js';
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  try {
    requirePaintEnv();
  } catch (error) {
    return configJsonResponse(error) ?? jsonResponse({ error: 'Server not configured' }, 503);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    if (isAuthError(error)) return jsonResponse({ error: error.message }, error.status);
    throw error;
  }

  const { reelId } = await req.json();
  
  if (!reelId) {
    return jsonResponse({ error: 'reelId is required' }, 400);
  }

  try {
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, workspace_id, study_id, title, track, scenes, studies(title)')
      .eq('id', reelId)
      .single();

    if (reelError || !reel) {
      return jsonResponse({ error: 'Reel not found' }, 404);
    }

    await requireWorkspaceEditor(user.id, reel.workspace_id);

    // Mark as pending
    await supabase
      .from('reels')
      .update({
        art: { status: 'pending' },
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

    const imageBlob = await generateImage(imagePrompt(scene.prompt));
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

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
        art: {
          status: 'completed',
          url: publicUrl,
          caption: artCaption(scene.caption),
        },
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
    if (isAuthError(error)) return jsonResponse({ error: error.message }, error.status);
    const configured = configJsonResponse(error);
    if (configured) return configured;
    console.error('Art painting failed:', error);
    
    await supabase
      .from('reels')
      .update({
        art: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId);

    const status = error instanceof StepError ? error.httpStatus : 500;
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Art painting failed',
    }, status);
  }
}

function incomingAuthorization(req: VercelRequest): string | undefined {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  return Array.isArray(raw) ? raw[0] : raw;
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
  const headers = new Headers({ 'content-type': 'application/json' });
  const authorization = incomingAuthorization(req);
  if (authorization) headers.set('authorization', authorization);
  const request = new Request('http://localhost/api/art/paint', {
    method: 'POST',
    headers,
    body: JSON.stringify(req.body ?? {}),
  });
  const response = await POST(request);
  const text = await response.text();
  const contentType = response.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  return res.status(response.status).send(text);
}
