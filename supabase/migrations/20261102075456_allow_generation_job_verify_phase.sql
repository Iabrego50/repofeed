-- The generation pipeline uses an intermediate "verify" phase after compose.
-- The previous check only allowed extract|compose|done, so setting phase='verify'
-- failed silently and compose re-queued itself forever.
alter table public.generation_jobs drop constraint if exists generation_jobs_phase_check;
alter table public.generation_jobs add constraint generation_jobs_phase_check
  check (phase in ('extract', 'compose', 'verify', 'done'));
