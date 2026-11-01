import { supabase } from '../supabase';
import { unwrapSingleOrNull } from '../supabase-helpers';
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

  return mapJob(job);
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

  // Call the generation API
  const response = await fetch(`${process.env.VITE_SITE_URL}/api/generation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  
  if (job.status === 'running') {
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
      headers: { 'Content-Type': 'application/json' },
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

  // Update study status
  await supabase
    .from('studies')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', args.studyId);
}
