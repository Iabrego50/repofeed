import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthError, isInternalGenerationCall, requireUser, requireWorkspaceEditor } from '../_lib/auth.js';
import { enqueueGenerationProcess } from '../_lib/generation-chain.js';
import { isServerNotConfigured, requiredEnv, requireSupabaseEnv, sendNotConfigured, sendRouteError } from '../_lib/respond.js';
import { supabase } from '../_lib/supabase.js';
import { callTool, CHUNK_CHARS, MAX_COMPOSE_FINDINGS } from '../../src/lib/ai/client.js';
import {
  AI_CALL_TIMEOUT_MS,
  COMPOSE_BATCH_SIZE,
  MAX_COMPOSE_REELS,
  MAX_GENERATION_STEPS,
  STALE_JOB_FAIL_MESSAGE,
  nextAttemptCount,
  previousStudyStatus,
  shouldFinishCompose,
  shouldSkipComposeInsert,
  staleJobDecision,
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

export const maxDuration = 300;

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

    if (job.status === 'done' || job.status === 'cancelled' || job.status === 'failed') {
      return res.json({ success: true, skipped: true, phase: job.phase, status: job.status });
    }

    const stale = staleJobDecision(job);
    if (stale === 'fail') {
      throw new Error(STALE_JOB_FAIL_MESSAGE);
    }
    if (stale === 'retrigger') {
      console.warn(`[generation] recovering stale job=${jobId} phase=${phase} updated_at=${job.updated_at}`);
    }

    await runProcessStep(jobId);
    return res.json({ success: true, phase: phase === 'verify' ? 'done' : phase });
  } catch (error) {
    if (isServerNotConfigured(error)) return sendNotConfigured(res, error);
    if (isAuthError(error)) return res.status(error.status).json({ error: error.message });
    console.error('Generation error:', error);
    const e = toStepError(error);
    const message = error instanceof Error ? error.message : e.message;
    await failJob(jobId, message, e.detail.detail);
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

  if (job.status === 'cancelled' || job.status === 'failed' || job.status === 'done') {
    console.info(`[generation] skip job=${jobId} status=${job.status}`);
    return;
  }

  if (wouldExceedGenerationSteps(job.attempts) || staleJobDecision(job) === 'fail') {
    throw new Error(
      wouldExceedGenerationSteps(job.attempts)
        ? `Generation stopped after too many steps (max ${MAX_GENERATION_STEPS}).`
        : STALE_JOB_FAIL_MESSAGE,
    );
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
    throw new Error('Study was deleted');
  }

  const phase = String(job.phase);
  const started = Date.now();
  console.info(
    `[generation] start job=${jobId} phase=${phase} cursor=${job.cursor ?? 0} attempts=${job.attempts ?? 0}`,
  );
  try {
    if (phase === 'extract') {
      await processExtraction(jobId, job, study);
    } else if (phase === 'compose') {
      await processComposition(jobId, job, study);
    } else if (phase === 'verify') {
      await processVerification(jobId, job.study_id);
    } else {
      throw new Error('Invalid phase');
    }
    console.info(`[generation] end job=${jobId} phase=${phase} ms=${Date.now() - started}`);
  } catch (error) {
    console.error(`[generation] fail job=${jobId} phase=${phase} ms=${Date.now() - started}`, error);
    throw error;
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
    enqueueGenerationProcess(jobId);
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
    enqueueGenerationProcess(jobId);
    return;
  }

  // Extract findings from chunk
  const text = source.text.slice(chunk.start, chunk.end);
  console.info(
    `[generation] extract OpenAI start job=${jobId} cursor=${cursor} timeoutMs=${AI_CALL_TIMEOUT_MS}`,
  );
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
    timeoutMs: AI_CALL_TIMEOUT_MS,
  });
  console.info(`[generation] extract OpenAI end job=${jobId} findings=${result.findings.length}`);

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

  enqueueGenerationProcess(jobId);
}

async function processComposition(
  jobId: string,
  job: any,
  study: any
) {
  const existing = await supabase
    .from('reels')
    .select('id, title', { count: 'exact' })
    .eq('study_id', study.id)
    .gte('created_at', job.created_at || new Date(0).toISOString());
  throwIfWriteError(existing.error, 'existing reels');

  const existingRows = existing.data ?? [];
  const existingCount = existing.count ?? existingRows.length;

  if (shouldSkipComposeInsert(existingCount)) {
    await updateJob(jobId, {
      phase: 'verify',
      log: appendLog(job.log, 'info', 'Reels already composed for this job, verifying...'),
    });
    enqueueGenerationProcess(jobId);
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
    throw new Error("We couldn't find any findings in your files.");
  }

  const batchIndex = Math.floor(existingCount / COMPOSE_BATCH_SIZE);
  console.info(
    `[generation] compose OpenAI start job=${jobId} batch=${batchIndex} timeoutMs=${AI_CALL_TIMEOUT_MS}`,
  );
  const result = await callTool({
    system: COMPOSE_SYSTEM,
    user: composeUserPrompt({
      studyTitle: study.title,
      audience: study.audience,
      goal: study.goal,
      findings: findings.map((f) => ({
        id: f.id,
        type: f.type,
        text: f.text,
        speaker: f.speaker ?? undefined,
        number: f.number ?? undefined,
        label: f.label ?? undefined,
        strength: f.strength,
        file: f.sources?.name || 'unknown',
      })),
      batch: {
        index: batchIndex,
        size: COMPOSE_BATCH_SIZE,
        existingTitles: existingRows.map((row: { title?: string }) => row.title).filter(Boolean) as string[],
      },
    }),
    tool: COMPOSE_TOOL,
    schema: composeSchema,
    maxTokens: 8000,
    timeoutMs: AI_CALL_TIMEOUT_MS,
  });
  console.info(`[generation] compose OpenAI end job=${jobId} reels=${result.reels.length}`);

  const findingIdMap = new Map(findings.map((f: any) => [f.id, f.id]));
  const fileByFinding = new Map(
    findings.map((f: any) => [f.id, f.sources?.name || 'unknown'])
  );

  // Save reels
  const reelsToSave = result.reels.slice(0, COMPOSE_BATCH_SIZE).flatMap((r, idx) => {
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
        track_index: existingCount + idx,
        title,
        scenes: JSON.parse(JSON.stringify(finalScenes)),
        finding_ids: findingIds,
        source_names: sourceNames,
        position: existingCount + idx,
        created_at: new Date().toISOString(),
      },
    ];
  });

  if (reelsToSave.length === 0 && existingCount === 0) {
    throw new Error("The AI didn't write any usable reels.");
  }

  if (reelsToSave.length > 0) {
    const inserted = await supabase.from('reels').insert(reelsToSave);
    throwIfWriteError(inserted.error, 'reels');
  }

  if (
    shouldFinishCompose({
      existingCount,
      savedThisBatch: reelsToSave.length,
      batchSize: COMPOSE_BATCH_SIZE,
      maxReels: MAX_COMPOSE_REELS,
    })
  ) {
    await updateJob(jobId, {
      phase: 'verify',
      log: appendLog(
        job.log,
        'info',
        `Composed ${existingCount + reelsToSave.length} reels, verifying...`,
      ),
    });
  } else {
    await updateJob(jobId, {
      log: appendLog(
        job.log,
        'info',
        `Compose batch ${batchIndex + 1}: ${reelsToSave.length} reels (${existingCount + reelsToSave.length} total)`,
      ),
    });
  }

  enqueueGenerationProcess(jobId);
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

async function failJob(jobId: string, error: string, errorDetail?: string) {
  const fail = await supabase
    .from('generation_jobs')
    .update({
      status: 'failed',
      error,
      error_detail: errorDetail ?? error,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .in('status', ['queued', 'running']);
  if (fail.error) console.error('Failed to mark generation job failed:', fail.error);
  await restoreStudyAfterGeneration(jobId);
}

async function restoreStudyAfterGeneration(jobId: string) {
  const { data: job } = await supabase
    .from('generation_jobs')
    .select('study_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job?.study_id) return;
  await restoreStudyStatus(job.study_id);
}

export async function restoreStudyStatus(studyId: string) {
  const { data: study } = await supabase
    .from('studies')
    .select('published_at')
    .eq('id', studyId)
    .maybeSingle();
  const { count } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId);
  const status = previousStudyStatus({
    publishedAt: study?.published_at,
    reelCount: count,
  });
  const updated = await supabase
    .from('studies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', studyId);
  if (updated.error) console.error('Failed to restore study status:', updated.error);
  else console.info(`[generation] restored study=${studyId} status=${status}`);
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
