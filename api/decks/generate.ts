import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configJsonResponse, requiredEnv, requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { callTool } from '../../src/lib/ai/client.js';
import { summary } from '../../src/lib/api/insights.js';
import { z } from 'zod';
import { DECK_SYSTEM, DECK_TOOL, collectEvidence, evidencePrompt, sanitizeDeck } from '../../src/lib/api/deck-build.js';

const deckSchema = z.object({ slides: z.array(z.any()) });


function requireDeckEnv() {
  requireSupabaseEnv();
  requiredEnv('OPENAI_API_KEY');
}

export async function POST(req: Request) {
  try {
    requireDeckEnv();
  } catch (error) {
    return configJsonResponse(error) ?? new Response(JSON.stringify({ error: 'Server not configured' }), { status: 503 });
  }

  const { workspaceId, studyId } = await req.json();

  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    // Check editor permission
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'editor'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Only editors can generate decks' }), { status: 403 });
    }

    const insightsSummary = await summary({ workspaceId, studyId }, supabase);

    // Studies in scope
    let studiesQuery = supabase
      .from('studies')
      .select('id, title, audience, goal')
      .eq('workspace_id', workspaceId)
      .eq('status', 'published');
    if (studyId) studiesQuery = studiesQuery.eq('id', studyId);
    const { data: studies } = await studiesQuery.limit(10);
    if (!studies?.length) {
      return new Response(JSON.stringify({ error: 'Publish a study first. The deck is written from published scenes.' }), { status: 400 });
    }

    // The deck is written from the scenes themselves, so it reports what the study found.
    const { data: reels } = await supabase
      .from('reels')
      .select('title, track, scenes, study_id, position')
      .in('study_id', studies.map((s) => s.id))
      .eq('enabled', true)
      .order('position', { ascending: true })
      .limit(40);
    const evidence = collectEvidence(reels ?? []);
    if (!evidence.reels.length) {
      return new Response(JSON.stringify({ error: 'There are no scenes to build a deck from yet.' }), { status: 400 });
    }

    const scopeLabel = studyId ? studies[0].title : 'All studies';
    const reactionTotal = insightsSummary.reactions.true + insightsSummary.reactions.surprised + insightsSummary.reactions.pushback;
    const userPrompt = `Readout for: ${scopeLabel}
Audience: ${studies[0].audience || 'the product team'}
${studies.map((s) => `Study: ${s.title}${s.goal ? ` (goal: ${s.goal})` : ''}`).join('\n')}

Team response so far: ${insightsSummary.reached} people watched. Reactions: ${insightsSummary.reactions.true} rings true, ${insightsSummary.reactions.surprised} surprised, ${insightsSummary.reactions.pushback} push back. ${insightsSummary.openItems} open questions or actions.
${insightsSummary.rows
  .filter((r) => r.pushbackCount > 0)
  .slice(0, 5)
  .map((r) => `Pushback on "${r.title}": ${r.pushbackCount}`)
  .join('\n')}

Published scenes:
${evidencePrompt(evidence)}`;

    const raw = await callTool({
      system: DECK_SYSTEM,
      user: userPrompt,
      tool: DECK_TOOL,
      schema: deckSchema,
      maxTokens: 4000,
    });
    const slides = sanitizeDeck(raw, evidence, { scopeLabel, hasReactions: reactionTotal > 0 });

    const { data: savedDeck, error: saveError } = await supabase
      .from('decks')
      .insert({
        workspace_id: workspaceId,
        scope: studyId || 'all',
        created_by: user.id,
        scope_label: scopeLabel,
        slides,
        stats: {
          reached: insightsSummary.reached,
          memberCount: insightsSummary.memberCount,
          guestsReached: insightsSummary.guestsReached,
          completionRate: insightsSummary.completionRate,
          openItems: insightsSummary.openItems,
          totalViews: insightsSummary.totalViews,
          reactions: insightsSummary.reactions,
        },
        // Per-scene numbers power the "team response" line under each finding.
        reels: insightsSummary.rows.map((r) => ({
          id: r.reelId,
          title: r.title,
          viewers: r.viewers,
          completionRate: r.completionRate,
          trueCount: r.trueCount,
          surprisedCount: r.surprisedCount,
          pushbackCount: r.pushbackCount,
        })),
      })
      .select('id')
      .single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ deckId: savedDeck.id, slides }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const configured = configJsonResponse(error);
    if (configured) return configured;
    console.error('Deck generation failed:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Deck generation failed' 
    }), { status: 500 });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    requireDeckEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }
  const headers = new Headers({ 'content-type': 'application/json' });
  const authorization = req.headers.authorization;
  if (authorization) headers.set('authorization', Array.isArray(authorization) ? authorization[0] : authorization);
  const request = new Request('http://localhost/api/decks/generate', {
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
