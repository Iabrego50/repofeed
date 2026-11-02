-- Fix comment kinds to match main's convex schema
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_kind_check;
ALTER TABLE public.comments ADD CONSTRAINT comments_kind_check 
  CHECK (kind IN ('note', 'question', 'action'));

-- Fix job status to match main's convex schema  
ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_status_check;
ALTER TABLE public.generation_jobs ADD CONSTRAINT generation_jobs_status_check
  CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled'));

-- Fix job phase to match main's convex schema
ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_phase_check;
ALTER TABLE public.generation_jobs ADD CONSTRAINT generation_jobs_phase_check
  CHECK (phase IN ('extract', 'compose', 'done'));

-- Update existing data
UPDATE public.comments SET kind = 'note' WHERE kind = 'comment';
UPDATE public.comments SET kind = 'note' WHERE kind = 'reply';
UPDATE public.generation_jobs SET status = 'queued' WHERE status = 'pending';
UPDATE public.generation_jobs SET status = 'cancelled' WHERE status = 'failed' AND error LIKE '%cancel%';
UPDATE public.generation_jobs SET phase = 'extract' WHERE phase = 'extracting';
UPDATE public.generation_jobs SET phase = 'compose' WHERE phase = 'composing';
