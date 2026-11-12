-- Topics on each insight (reel), so people can browse and search research by subject.
-- New reels get topics when they are generated. Existing reels are tagged in the
-- background the first time someone opens Explore (/api/insights/topics).

alter table public.reels
  add column if not exists topics text[] not null default '{}';

comment on column public.reels.topics is
  'Lowercase subject tags, 1-3 words each, at most 4. Written by the AI at generation time; editors can change them.';

create index if not exists reels_topics_gin_idx on public.reels using gin (topics);
