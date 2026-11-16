-- OPTIONAL: apply only after reviewing. Collapses duplicate live share_links
-- (keeps the newest per study) then enforces at most one live row per study.
-- Existing tokens that are revoked here stop working; the kept token continues.

-- Revoke older live duplicates, keep the most recently created row per study.
with ranked as (
  select
    id,
    row_number() over (
      partition by study_id
      order by created_at desc, id desc
    ) as rn
  from public.share_links
  where revoked = false
)
update public.share_links sl
set revoked = true
from ranked r
where sl.id = r.id
  and r.rn > 1;

-- Prevent future duplicate live links for the same study.
create unique index if not exists share_links_one_live_per_study
  on public.share_links (study_id)
  where revoked = false;
