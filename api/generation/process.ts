import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthError, isInternalGenerationCall, requireUser, requireWorkspaceEditor } from '../_lib/auth.js';
import { enqueueGenerationProcess } from '../_lib/generation-chain.js';
import { isServerNotConfigured, requiredEnv, requireSupabaseEnv, sendNotConfigured, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { callTool, CHUNK_CHARS, MAX_COMPOSE_FINDINGS } from '../../src/lib/ai/client.js';
import {
  MAX_GENERATION_STEPS,
  nextAttemptCount,
  shouldSkipComposeInsert,
  wouldExceedGenerationSteps,
} from '../../src/lib/api/generation-guards.js';
import { throwIfWriteError } from '../../src/lib/api/supabase-write.js';
import {
  EXTRACT_SYSTEM,
  EXTRACT_TOOL,
  extractSchema,
  extractUserPrompt,
  COMPOSE_SYSTEM,
  COMPOSE_TOOL,
  composeSchema,
  composeUserPrompt,
} from '../../src/lib/ai/prompts.js';
import { toScene, finalizeScenes } from '../../src/lib/ai/scenes.js';
import type { Scene } from '../../src/schema/validators';
import { toStepError } from '../../src/lib/errors/step-error.js';

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

function requireProcessEnv() {
  requireSupabaseEnv();
  requiredEnv('OPENAI_API_KEY');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireProcessEnv();
  } catch (error) {
    return sendRouteError(res, error);
  }

  const { jobId } = req.body ?? {};

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  try {
    const internal = isInternalGenerationCall(req);
    const user = internal ? null : await requireUser(req);

    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!internal && user) {
      await requireWorkspaceEditor(user.id, job.workspace_id);
    }

    const phase = String(job.phase);
    if (phase !== 'extract' && phase !== 'compose' && phase !== 'verify') {
      return res.status(400).json({ error: 'Invalid phase' });
    }

    await runProcessStep(jobId);
    return res.json({ success: true, phase: phase === 'verify' ? 'done' : phase });
  } catch (error) {
    if (isServerNotConfigured(error)) return sendNotConfigured(res, error);
    if (isAuthError(error)) return res.status(error.status).json({ error: error.message });
    console.error('Generation error:', error);
    const e = toStepError(error);
    
    const fail = await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        error: e.message,
        error_detail: e.detail.detail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (fail.error) console.error('Failed to mark generation job failed:', fail.error);

    return res.status(e.httpStatus).json({
      error: e.message,
      detail: e.detail.detail,
      retryable: e.retryable,
    });
  }
}

export async function runProcessStep(jobId: string): Promise<void> {
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error('Job not found');
  }

  if (wouldExceedGenerationSteps(job.attempts)) {
    await updateJob(jobId, {
      status: 'failed',
      error: 'Generation stopped after too many steps.',
      error_detail: `attempts=${job.attempts} max=${MAX_GENERATION_STEPS}`,
    });
    throw new Error('Generation exceeded max steps');
  }

  await updateJob(jobId, {
    status: job.status === 'queued' ? 'running' : job.status,
    attempts: nextAttemptCount(job.attempts),
  });

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, title, audience, goal')
    .eq('id', job.study_id)
    .single();

  if (studyError || !study) {
    await updateJob(jobId, {
      status: 'failed',
      error: 'Study was deleted',
    });
    throw new Error('Study not found');
  }

  const phase = String(job.phase);
  if (phase === 'extract') {
    await processExtraction(jobId, job, study);
    return;
  }

  if (phase === 'compose') {
    await processComposition(jobId, job, study);
    return;
  }

  if (phase === 'verify') {
    await processVerification(jobId, job.study_id);
    return;
  }

  throw new Error('Invalid phase');
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
    await enqueueGenerationProcess(jobId);
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
    await enqueueGenerationProcess(jobId);
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
    source_id: chunk.source_id,
    chunk_index: cursor,
    type: f.type,
    text: f.text.trim(),
    speaker: f.speaker?.trim() || null,
    number: f.number?.trim() || null,
    label: f.label?.trim() || null,
    strength: f.strength,
    created_at: new Date().toISOString(),
  }));

  if (findingsToSave.length > 0) {
    const inserted = await supabase.from('findings').insert(findingsToSave);
    throwIfWriteError(inserted.error, 'findings');
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

  await enqueueGenerationProcess(jobId);
}

async function processComposition(
  jobId: string,
  job: any,
  study: any
) {
  const existing = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', study.id)
    .gte('created_at', job.created_at || new Date(0).toISOString());
  throwIfWriteError(existing.error, 'existing reels');

  if (shouldSkipComposeInsert(existing.count)) {
    await updateJob(jobId, {
      phase: 'verify',
      log: appendLog(job.log, 'info', 'Reels already composed for this job, verifying...'),
    });
    await enqueueGenerationProcess(jobId);
    return;
  }

  const { data: findings, error: findingsError } = await supabase
    .from('findings')
    .select('*, sources!inner(name)')
    .eq('study_id', study.id)
    .order('strength', { ascending: false })
    .limit(MAX_COMPOSE_FINDINGS);

  throwIfWriteError(findingsError, 'findings lookup');

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
        track_index: idx,
        title,
        scenes: JSON.parse(JSON.stringify(finalScenes)),
        finding_ids: findingIds,
        source_names: sourceNames,
        position: idx,
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

  const inserted = await supabase.from('reels').insert(reelsToSave);
  throwIfWriteError(inserted.error, 'reels');

  // Move to verify phase
  await updateJob(jobId, {
    phase: 'verify',
    log: appendLog(
      job.log,
      'info',
      `Composed ${reelsToSave.length} reels, verifying...`
    ),
  });

  await enqueueGenerationProcess(jobId);
}

async function processVerification(jobId: string, studyId: string) {
  const studyUpdate = await supabase
    .from('studies')
    .update({ status: 'review', updated_at: new Date().toISOString() })
    .eq('id', studyId);
  throwIfWriteError(studyUpdate.error, 'study status');

  await updateJob(jobId, {
    status: 'done',
    phase: 'done',
    locked_until: new Date(0).toISOString(),
  });
}

async function updateJob(jobId: string, updates: Record<string, unknown>) {
  const result = await supabase
    .from('generation_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  throwIfWriteError(result.error, 'generation job');
}

function appendLog(
  log: LogEntry[],
  level: LogEntry['level'],
  message: string
): LogEntry[] {
  return [...log, logEntry(level, message)].slice(-MAX_LOG);
}
