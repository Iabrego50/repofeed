import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { callTool, CHUNK_CHARS, MAX_COMPOSE_FINDINGS } from '../../src/lib/ai/client';
import {
  EXTRACT_SYSTEM,
  EXTRACT_TOOL,
  extractSchema,
  extractUserPrompt,
  COMPOSE_SYSTEM,
  COMPOSE_TOOL,
  composeSchema,
  composeUserPrompt,
} from '../../src/lib/ai/prompts';
import { toScene, finalizeScenes } from '../../src/lib/ai/scenes';
import type { Scene } from '../../src/schema/validators';
import { toStepError } from '../../src/lib/errors/step-error';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SOURCES_CHARS = 2_000_000;
const MAX_LOG = 200;

type LogEntry = {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

function logEntry(level: LogEntry['level'], message: string): LogEntry {
  return { at: new Date().toISOString(), level, message };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  try {
    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Fetch study
    const { data: study } = await supabase
      .from('studies')
      .select('id, title, audience, goal')
      .eq('id', job.study_id)
      .single();

    if (!study) {
      await updateJob(jobId, {
        status: 'failed',
        error: 'Study was deleted',
      });
      return res.status(404).json({ error: 'Study not found' });
    }

    // Process based on phase
    if (job.phase === 'extract') {
      await processExtraction(jobId, job, study);
      return res.json({ success: true, phase: 'extract' });
    }

    if (job.phase === 'compose') {
      await processComposition(jobId, job, study);
      return res.json({ success: true, phase: 'compose' });
    }

    if (job.phase === 'verify') {
      await processVerification(jobId, job.study_id);
      return res.json({ success: true, phase: 'done' });
    }

    return res.status(400).json({ error: 'Invalid phase' });
  } catch (error) {
    console.error('Generation error:', error);
    const e = toStepError(error);
    
    await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        error: e.message,
        error_detail: e.detail.detail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return res.status(500).json({
      error: e.message,
      detail: e.detail.detail,
      retryable: e.retryable,
    });
  }
}

async function processExtraction(
  jobId: string,
  job: any,
  study: any
) {
  const chunks = job.chunks || [];
  const cursor = job.cursor || 0;

  if (cursor >= chunks.length) {
    // Move to compose phase
    await updateJob(jobId, {
      phase: 'compose',
      cursor: 0,
      log: appendLog(job.log, 'info', 'Extraction complete, starting composition'),
    });
    // Trigger next phase
    await fetch(`${process.env.VITE_SITE_URL}/api/generation/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    return;
  }

  const chunk = chunks[cursor];
  
  // Fetch source text
  const { data: source } = await supabase
    .from('sources')
    .select('text, name')
    .eq('id', chunk.source_id)
    .single();

  if (!source) {
    // Skip missing source
    await updateJob(jobId, {
      cursor: cursor + 1,
      log: appendLog(job.log, 'warn', 'Skipped a source that no longer exists'),
    });
    // Trigger next chunk
    await fetch(`${process.env.VITE_SITE_URL}/api/generation/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    return;
  }

  // Extract findings from chunk
  const text = source.text.slice(chunk.start, chunk.end);
  const result = await callTool({
    system: EXTRACT_SYSTEM,
    user: extractUserPrompt({
      studyTitle: study.title,
      audience: study.audience,
      goal: study.goal,
      fileName: source.name,
      chunkLabel: `part ${cursor + 1} of ${chunks.length}`,
      text,
    }),
    tool: EXTRACT_TOOL,
    schema: extractSchema,
    maxTokens: 16000,
  });

  // Save findings
  const findingsToSave = result.findings.slice(0, 80).map((f) => ({
    study_id: study.id,
    workspace_id: job.workspace_id,
    source_id: chunk.source_id,
    type: f.type,
    text: f.text.trim(),
    speaker: f.speaker?.trim() || null,
    number: f.number?.trim() || null,
    label: f.label?.trim() || null,
    strength: f.strength,
    created_at: new Date().toISOString(),
  }));

  if (findingsToSave.length > 0) {
    await supabase.from('findings').insert(findingsToSave);
  }

  // Update progress
  await updateJob(jobId, {
    cursor: cursor + 1,
    log: appendLog(
      job.log,
      'info',
      `Extracted ${findingsToSave.length} findings from ${source.name} (${cursor + 1}/${chunks.length})`
    ),
  });

  // Trigger next chunk
  await fetch(`${process.env.VITE_SITE_URL}/api/generation/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
}

async function processComposition(
  jobId: string,
  job: any,
  study: any
) {
  // Fetch all findings for study
  const { data: findings } = await supabase
    .from('findings')
    .select('*, sources!inner(name)')
    .eq('study_id', study.id)
    .order('strength', { ascending: false })
    .limit(MAX_COMPOSE_FINDINGS);

  if (!findings || findings.length === 0) {
    await updateJob(jobId, {
      status: 'failed',
      error: "We couldn't find any findings in your files.",
      error_detail: 'No findings were extracted from the sources',
    });
    return;
  }

  // Compose reels
  const result = await callTool({
    system: COMPOSE_SYSTEM,
    user: composeUserPrompt({
      studyTitle: study.title,
      audience: study.audience,
      goal: study.goal,
      findings: findings.map((f: any) => ({
        id: f.id,
        type: f.type,
        text: f.text,
        speaker: f.speaker,
        number: f.number,
        label: f.label,
        strength: f.strength,
        file: f.sources?.name || 'unknown',
      })),
    }),
    tool: COMPOSE_TOOL,
    schema: composeSchema,
    maxTokens: 24000,
  });

  const findingIdMap = new Map(findings.map((f: any) => [f.id, f.id]));
  const fileByFinding = new Map(
    findings.map((f: any) => [f.id, f.sources?.name || 'unknown'])
  );

  // Save reels
  const reelsToSave = result.reels.slice(0, 24).flatMap((r, idx) => {
    const findingIds = r.findingIds
      .flatMap((id) => {
        const real = findingIdMap.get(id);
        return real ? [real] : [];
      })
      .slice(0, 10);

    if (findingIds.length === 0) return [];

    const sourceNames = [
      ...new Set(findingIds.map((id) => fileByFinding.get(id) ?? '')),
    ].filter(Boolean);

    const scenes = r.scenes
      .map(toScene)
      .filter((s): s is Scene => s !== null);
    const title = r.title.trim().split(/\s+/).slice(0, 6).join(' ');
    const finalScenes = finalizeScenes(scenes, title, sourceNames);

    return [
      {
        study_id: study.id,
        workspace_id: job.workspace_id,
        track: r.track.trim(),
        title,
        scenes: finalScenes,
        finding_ids: findingIds,
        source_names: sourceNames,
        position: idx,
        status: 'draft',
        created_at: new Date().toISOString(),
      },
    ];
  });

  if (reelsToSave.length === 0) {
    await updateJob(jobId, {
      status: 'failed',
      error: "The AI didn't write any usable reels.",
      error_detail: 'No reels referenced known findings',
    });
    return;
  }

  await supabase.from('reels').insert(reelsToSave);

  // Move to verify phase
  await updateJob(jobId, {
    phase: 'verify',
    log: appendLog(
      job.log,
      'info',
      `Composed ${reelsToSave.length} reels, verifying...`
    ),
  });

  // Trigger verification
  await fetch(`${process.env.VITE_SITE_URL}/api/generation/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
}

async function processVerification(jobId: string, studyId: string) {
  // Mark study as ready for review
  await supabase
    .from('studies')
    .update({ status: 'review', updated_at: new Date().toISOString() })
    .eq('id', studyId);

  // Complete job
  await supabase
    .from('generation_jobs')
    .update({
      status: 'done',
      phase: 'done',
      locked_until: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function updateJob(jobId: string, updates: any) {
  await supabase
    .from('generation_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

function appendLog(
  log: LogEntry[],
  level: LogEntry['level'],
  message: string
): LogEntry[] {
  return [...log, logEntry(level, message)].slice(-MAX_LOG);
}
