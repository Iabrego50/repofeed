import { supabase } from '../supabase';
import { unwrapSingleOrNull } from '../supabase-helpers';
import { previousStudyStatus } from './generation-guards';
import { jsonAuthHeaders } from './bearer';
import { mapJob, type Job } from './mappers';

export async function getLatestJob(args: { studyId: string }): Promise<Job | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const study = unwrapSingleOrNull(await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single());

  if (!study) return null;

  // Check editor permission
  const membership = unwrapSingleOrNull(await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single());

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    return null;
  }

  const job = unwrapSingleOrNull(await supabase
    .from('generation_jobs')
    .select('*')
    .eq('study_id', args.studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single());

  if (!job) return null;

  if (job.status === 'running' || job.status === 'queued') {
    await kickGenerationProcess(job.id);
    const latest = unwrapSingleOrNull(await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', job.id)
      .single());
    return mapJob(latest ?? job);
  }

  return mapJob(job);
}

async function kickGenerationProcess(jobId: string) {
  try {
    const response = await fetch('/api/generation/process', {
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify({ jobId }),
    });
    console.info(`[generation] poll process job=${jobId} status=${response.status}`);
  } catch (error) {
    console.error('Failed to re-trigger generation process:', error);
  }
}

export async function restoreStudyAfterGeneration(studyId: string) {
  const study = unwrapSingleOrNull(await supabase
    .from('studies')
    .select('published_at')
    .eq('id', studyId)
    .single());
  const { count } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId);
  const status = previousStudyStatus({
    publishedAt: study?.published_at,
    reelCount: count,
  });
  await supabase
    .from('studies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', studyId);
}

export async function startGeneration(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const study = unwrapSingleOrNull(await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single());

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const membership = unwrapSingleOrNull(await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single());

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  const response = await fetch('/api/generation/start', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ studyId: args.studyId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start generation');
  }

  const { jobId } = await response.json();
  return jobId;
}

export async function resumeGeneration(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('study_id', args.studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (jobError || !job) {
    return startGeneration(args);
  }

  if (job.status === 'running' || job.status === 'queued') {
    await kickGenerationProcess(job.id);
    return { jobId: job.id, status: 'running' as const };
  }
  
  if (job.status === 'failed') {
    await supabase
      .from('generation_jobs')
      .update({
        status: 'queued',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    await fetch('/api/generation/process', {
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify({ jobId: job.id }),
    });
    
    return { jobId: job.id, status: 'running' as const };
  }
  
  return startGeneration(args);
}

export async function cancelGeneration(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const study = unwrapSingleOrNull(await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single());

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const membership = unwrapSingleOrNull(await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single());

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Must be an editor');
  }

  // Find and cancel active jobs
  const { data: jobs } = await supabase
    .from('generation_jobs')
    .select('id')
    .eq('study_id', args.studyId)
    .in('status', ['queued', 'running']);

  if (jobs && jobs.length > 0) {
    await supabase
      .from('generation_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', jobs.map(j => j.id));
  }

  await restoreStudyAfterGeneration(args.studyId);
}
