-- Fix studies table schema

-- Update status check constraint to include correct values
alter table public.studies drop constraint if exists studies_status_check;
alter table public.studies add constraint studies_status_check 
  check (status in ('draft', 'generating', 'review', 'published', 'archived'));

-- Add missing share columns
alter table public.studies add column if not exists share_enabled boolean default false not null;
alter table public.studies add column if not exists share_token text;

-- Create index on share_token for lookups
create index if not exists studies_share_token_idx on public.studies(share_token) where share_token is not null;
