import { supabase } from '@/lib/supabase';
import { z } from 'zod';

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

const AI_TIMEOUT_MS = 6 * 60_000;
const GATEWAY_URL = "https://ai-gateway.hercules.app/v1/chat/completions";

async function callTool<T>(args: {
  system: string;
  user: string;
  tool: { name: string; description: string; parameters: object };
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const apiKey = process.env.HERCULES_API_KEY;
  if (!apiKey) {
    throw new Error("AI isn't set up for this app yet. HERCULES_API_KEY is missing");
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-5-5",
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      tools: [args.tool],
      tool_choice: { type: "tool", name: args.tool.name },
      max_tokens: args.maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI call failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("No tool call in AI response");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return args.schema.parse(parsed);
}

export async function POST(req: Request) {
  const { workspaceId, studyId } = await req.json();

  try {
    const { data: { user } } = await supabase.auth.getUser();
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

    // Get insights summary
    const { summary } = await import('@/lib/api/insights');
    const insightsSummary = await summary({ workspaceId, studyId });

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
