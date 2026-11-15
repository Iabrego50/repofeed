import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthError, requireUser, requireWorkspaceEditor } from '../_lib/auth.js';
import { configJsonResponse, requiredEnv, requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase, supabaseUrl } from '../_lib/supabase.js';
import { callTool, generateImage } from '../../src/lib/ai/client.js';
import {
  ART_SYSTEM,
  artCaption,
  artUserPrompt,
  imagePrompt,
} from '../../src/lib/ai/art-prompt.js';
import { ART_BUCKET, artStoragePath, paintedArtFields } from '../../src/lib/api/storage-urls.js';
import { throwIfWriteError } from '../../src/lib/api/supabase-write.js';
import { StepError } from '../../src/lib/errors/step-error.js';
import { z } from 'zod';

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
        scenes: reel.scenes,
      }),
      tool: ART_TOOL,
      schema: artSchema,
      maxTokens: 800,
    });

    const imageBlob = await generateImage(imagePrompt(scene.prompt));
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

    const storageId = artStoragePath(reelId);
    const { error: uploadError } = await supabase.storage
      .from(ART_BUCKET)
      .upload(storageId, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw uploadError;
    }

    const caption = artCaption(scene.caption);
    const painted = paintedArtFields({
      origin: supabaseUrl(),
      storageId,
      caption,
    });

    const { error: saveError } = await supabase
      .from('reels')
      .update({
        footage: painted.footage,
        art: painted.art,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reelId);
    throwIfWriteError(saveError, 'painted art');

    return new Response(JSON.stringify({
      status: 'completed',
      url: painted.footage.url,
      storageId,
      bucket: ART_BUCKET,
      caption,
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
