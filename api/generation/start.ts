import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensurePublicUser, isAuthError, requireUser, requireWorkspaceEditor } from '../_lib/auth.js';
import { dispatchGenerationProcess } from '../_lib/generation-chain.js';
import { requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { CHUNK_CHARS } from '../../src/lib/ai/client.js';
import { trackServer } from '../../src/lib/analytics-server.js';

const MAX_SOURCES_CHARS = 2_000_000;

export type GenerationChunk = {
  source_id: string;
  name: string;
  start: number;
  end: number;
};

export function generationJobInsert(args: {
  studyId: string;
  workspaceId: string;
  startedBy: string;
  chunks: GenerationChunk[];
  sourceCount: number;
}) {
  return {
    study_id: args.studyId,
    workspace_id: args.workspaceId,
    started_by: args.startedBy,
    status: 'queued' as const,
    phase: 'extract' as const,
    cursor: 0,
    chunks: args.chunks,
    attempts: 0,
    log: [
      {
        at: new Date().toISOString(),
        level: 'info',
        message: `Queued: ${args.sourceCount} source${args.sourceCount === 1 ? '' : 's'}, ${args.chunks.length} chunk${args.chunks.length === 1 ? '' : 's'} to read`,
      },
    ],
    locked_until: new Date(0).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  try {
    const user = await requireUser(req);
    await ensurePublicUser(user);

    const { studyId } = req.body ?? {};

    if (!studyId) {
      return res.status(400).json({ error: 'Missing studyId' });
    }

    const { data: study, error: studyError } = await supabase
      .from('studies')
      .select('id, workspace_id')
      .eq('id', studyId)
      .single();

    if (studyError || !study) {
      return res.status(404).json({ error: 'Study not found' });
    }

    await requireWorkspaceEditor(user.id, study.workspace_id);

    const { data: sources } = await supabase
      .from('sources')
      .select('id, name, text, chars')
      .eq('study_id', studyId)
      .limit(100);

    if (!sources || sources.length === 0) {
      return res.status(400).json({
        error: 'Add at least one source file before generating',
      });
    }

    const totalChars = sources.reduce((sum, s) => sum + (s.chars || s.text.length), 0);
    if (totalChars > MAX_SOURCES_CHARS) {
      return res.status(400).json({
        error:
          'Sources are too large (2 million characters max). Remove a file and try again.',
      });
    }

    const chunks: GenerationChunk[] = [];
    for (const source of sources) {
      const text = source.text || '';
      for (let start = 0; start < text.length; start += CHUNK_CHARS) {
        chunks.push({
          source_id: source.id,
          name: source.name,
          start,
          end: Math.min(text.length, start + CHUNK_CHARS),
        });
      }
    }

    const payload = generationJobInsert({
      studyId,
      workspaceId: study.workspace_id,
      startedBy: user.id,
      chunks,
      sourceCount: sources.length,
    });

    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert(payload)
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create generation job:', jobError);
      return res.status(500).json({ error: 'Failed to create generation job' });
    }

    const studyUpdate = await supabase
      .from('studies')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', studyId);
    if (studyUpdate.error) {
      console.error('Failed to mark study generating:', studyUpdate.error);
      return res.status(500).json({ error: 'Failed to start generation' });
    }

    try {
      await dispatchGenerationProcess(job.id);
    } catch (error) {
      console.error('Failed to dispatch first generation step; status polling will recover:', error);
    }

    await trackServer(supabase, {
      event: 'generate_started',
      userId: user.id,
      workspaceId: study.workspace_id,
      properties: { studyId, sourceCount: sources.length, chunkCount: chunks.length },
    });

    return res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    if (isAuthError(error)) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Start generation error:', error);
    return sendRouteError(res, error);
  }
}
