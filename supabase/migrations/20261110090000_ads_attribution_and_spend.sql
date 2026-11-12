-- Paid-acquisition reporting for /admin/analytics.
--  1. Keep the ad platform's click id on the profile so signups and upgrades can be
--     uploaded back to Google Ads / LinkedIn / Meta as offline conversions.
--  2. A small ledger of ad spend, entered by the admin, so the dashboard can show
--     cost per signup and cost per paying customer next to each campaign.

alter table public.users
  add column if not exists click_id text,
  add column if not exists click_id_type text;

comment on column public.users.click_id is
  'First-touch ad click id (gclid, msclkid, li_fat_id, fbclid…). Used for offline conversion uploads.';

create index if not exists users_utm_campaign_idx on public.users (utm_campaign)
  where utm_campaign is not null;

create table if not exists public.ad_spend (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  created_by uuid references public.users on delete set null,
  -- First day the amount covers. One row per campaign per period keeps entry quick.
  period_start date not null,
  period_end date not null,
  source text not null check (char_length(source) between 1 and 120),
  medium text check (medium is null or char_length(medium) <= 120),
  campaign text not null check (char_length(campaign) between 1 and 200),
  amount_cents integer not null check (amount_cents >= 0),
  note text check (note is null or char_length(note) <= 500),
  check (period_end >= period_start)
);

create index if not exists ad_spend_period_idx on public.ad_spend (period_start, period_end);

comment on table public.ad_spend is
  'Admin-entered ad spend per campaign. Service role only; no client policies on purpose.';

-- RLS on with no policies: the browser can never read or write this table.
-- The /api/admin/ad-spend route checks users.is_admin and uses the service role.
alter table public.ad_spend enable row level security;
revoke all on public.ad_spend from anon, authenticated, public;
grant all on public.ad_spend to postgres, service_role;
