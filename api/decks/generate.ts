import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { summary } from '../../src/lib/api/insights.js';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DECK_SYSTEM = `You write executive research summary decks. Given study insights, engagement data, and team comments, create 8-15 slides that tell the story of what was learned.

Slide types:
- title: Opens the deck
- summary: Key insights at a glance (3-5 bullets)
- finding: One major insight with supporting evidence
- figures: Quantitative highlights (2-4 stats)
- voices: What participants said (2-3 quotes)
- reactions: What the team thought (engagement overview)
- next_steps: Recommended actions (3-5 items)
- closing: Wrap-up message

Keep text concise. Each finding should be one clear point. Use stats and quotes as evidence.
Call the save_deck tool.`;

const DECK_TOOL = {
  name: "save_deck",
  description: "Save the presentation deck",
  parameters: {
    type: "object",
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            content: { type: "object" },
          },
        },
      },
    },
    required: ["slides"],
  },
};

const deckSchema = z.object({
  slides: z.array(z.any()),
});

async function callTool<T>(args: {
  system: string;
  user: string;
  tool: { name: string; description: string; parameters: object };
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const response = await anthropic.messages.create({
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

export async function POST(req: Request) {
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

    // Get studies in scope
    let studiesQuery = supabase
      .from('studies')
      .select('title, audience, goal')
      .eq('workspace_id', workspaceId)
      .eq('status', 'published');

    if (studyId) {
      studiesQuery = studiesQuery.eq('id', studyId);
    }

    const { data: studies } = await studiesQuery.limit(10);

    // Build prompt
    const studyContext = (studies || []).map(s => 
      `${s.title} (audience: ${s.audience}${s.goal ? `; goal: ${s.goal}` : ""})`
    ).join('\n');

    const userPrompt = `Workspace: ${workspaceId}
Scope: ${studyId ? studies?.[0]?.title || 'Study' : 'All published studies'}
Target audience: ${studies?.[0]?.audience || 'the team'}

Studies:
${studyContext}

Key metrics:
- ${insightsSummary.reached} people reached (${insightsSummary.guestsReached} guests)
- ${insightsSummary.totalViews} total views
- ${Math.round(insightsSummary.completionRate * 100)}% completion rate
- ${insightsSummary.reactions.true} reactions

Top scenes:
${insightsSummary.rows.slice(0, 10).map(r => 
  `- ${r.title} (${r.track}): ${r.viewers} viewers, ${Math.round(r.completionRate * 100)}% completion`
).join('\n')}

Create a compelling executive summary deck.`;

    // Generate deck with AI
    const deck = await callTool({
      system: DECK_SYSTEM,
      user: userPrompt,
      tool: DECK_TOOL,
      schema: deckSchema,
      maxTokens: 4000,
    });

    // Save deck to database
    const { data: savedDeck, error: saveError } = await supabase
      .from('decks')
      .insert({
        workspace_id: workspaceId,
        scope: studyId || 'all',
        created_by: user.id,
        scope_label: studyId ? studies?.[0]?.title || 'Study' : 'All studies',
        slides: deck.slides,
        stats: {
          reached: insightsSummary.reached,
          totalViews: insightsSummary.totalViews,
          completionRate: insightsSummary.completionRate,
        },
        reels: [],
      })
      .select('id')
      .single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ 
      deckId: savedDeck.id,
      slides: deck.slides,
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
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
