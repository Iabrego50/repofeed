import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSupabaseEnv, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { CHUNK_CHARS } from '../../src/lib/ai/client.js';

const MAX_SOURCES_CHARS = 2_000_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireSupabaseEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  const { studyId } = req.body;

  if (!studyId) {
    return res.status(400).json({ error: 'Missing studyId' });
  }

  try {
    // Fetch study
    const { data: study, error: studyError } = await supabase
      .from('studies')
      .select('id, workspace_id')
      .eq('id', studyId)
      .single();

    if (studyError || !study) {
      return res.status(404).json({ error: 'Study not found' });
    }

    // Fetch sources
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

    // Check total size
    const totalChars = sources.reduce((sum, s) => sum + (s.chars || s.text.length), 0);
    if (totalChars > MAX_SOURCES_CHARS) {
      return res.status(400).json({
        error:
          'Sources are too large (2 million characters max). Remove a file and try again.',
      });
    }

    // Create chunks
    const chunks = [];
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

    // Create generation job
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        study_id: studyId,
        workspace_id: study.workspace_id,
        status: 'queued',
        phase: 'extract',
        cursor: 0,
        chunks,
        attempts: 0,
        log: [
          {
            at: new Date().toISOString(),
            level: 'info',
            message: `Queued: ${sources.length} source${sources.length === 1 ? '' : 's'}, ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} to read`,
          },
        ],
        locked_until: new Date(0).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      return res.status(500).json({ error: 'Failed to create generation job' });
    }

    // Update study status
    await supabase
      .from('studies')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', studyId);

    // Trigger first processing step
    await fetch(`${process.env.VITE_SITE_URL}/api/generation/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    });

    return res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('Start generation error:', error);
    return sendRouteError(res, error);
  }
}
