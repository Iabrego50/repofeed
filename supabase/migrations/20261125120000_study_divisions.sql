-- Mobile division feeds: each published study can be assigned to one of five
-- fixed divisions (Auto, GI, Wood, Marine, Website). Native phones open that
-- division as its own feed; web researchers set the assignment when publishing.
--
-- DO NOT apply to the live project (odvpqotwaokflegpmmej) until Isaac reviews.
-- Join codes already exist (20261123130000_workspace_join_codes.sql) and are reused.

alter table public.studies
  add column if not exists division text;

alter table public.studies
  drop constraint if exists studies_division_check;

alter table public.studies
  add constraint studies_division_check
  check (
    division is null
    or division in ('auto', 'gi', 'wood', 'marine', 'website')
  );

comment on column public.studies.division is
  'Optional mobile division feed slug. Null means the study is not placed on a phone division feed.';

create index if not exists studies_workspace_division_idx
  on public.studies (workspace_id, division)
  where division is not null and deleting = false;
