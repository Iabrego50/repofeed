import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { initializeAI, callAnthropicTool, EXTRACT_SYSTEM, EXTRACT_TOOL, extractUserPrompt } from '../../src/lib/ai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

initializeAI({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Process job based on phase
    // This is a simplified version - full implementation would include
    // chunk processing, error handling, retries, etc.
    
    if (job.phase === 'extracting') {
      // Extract findings from sources
      const { data: sources } = await supabase
        .from('sources')
        .select('*')
        .eq('study_id', job.study_id);

      // Process each source...
      // For now, return success
      await supabase
        .from('generation_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);

      return res.status(200).json({ success: true, phase: 'extracting' });
    }

    if (job.phase === 'composing') {
      // Compose reels from findings
      const { data: findings } = await supabase
        .from('findings')
        .select('*')
        .eq('study_id', job.study_id);

      // Compose reels...
      // For now, return success
      await supabase
        .from('generation_jobs')
        .update({ status: 'done', phase: 'done' })
        .eq('id', jobId);

      return res.status(200).json({ success: true, phase: 'done' });
    }

    return res.status(400).json({ error: 'Invalid phase' });
  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
