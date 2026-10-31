import { supabase } from '../supabase';

export async function getLatestJob(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single();

  if (!study) return null;

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    return null;
  }

  const { data: job } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('study_id', args.studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!job) return null;

  return {
    _id: job.id,
    status: job.status,
    phase: job.phase,
    cursor: job.cursor,
    totalChunks: job.chunks?.length || 0,
    log: job.log || [],
    error: job.error,
    _creationTime: new Date(job.created_at).getTime(),
  };
}

export async function startGeneration(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
  // For now, just start a new generation
  return startGeneration(args);
}

export async function cancelGeneration(args: { studyId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: study } = await supabase
    .from('studies')
    .select('workspace_id')
    .eq('id', args.studyId)
    .single();

  if (!study) throw new Error('Study not found');

  // Check editor permission
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', study.workspace_id)
    .eq('user_id', user.id)
    .single();

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
