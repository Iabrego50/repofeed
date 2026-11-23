-- Reviewed scrub for client-specific industrial example content (coil paint / PCG / coating).
-- Preview in production before relying on these UPDATEs:
--
--   select id, name from public.workspaces
--   where name ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)';
--
--   select id, title, audience, goal from public.studies
--   where title ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)'
--      or coalesce(audience,'') ~* '(coil|pcg|paint\s*coat|coating)'
--      or coalesce(goal,'') ~* '(coil|pcg|paint\s*coat|coating)';
--
--   select id, title from public.reels
--   where title ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)';
--
--   select id, name from public.sources
--   where name ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)'
--      or coalesce(text,'') ~* '(coil paint|pcg|paint coating|coil coating)';
--
-- Repo seed/demo copy is already neutral (Supperly). This targets live DB rows
-- that still name coil paint / PCG from early customer examples.

-- Workspace names (e.g. "PCG") → neutral label.
update public.workspaces
set
  name = 'Research team',
  updated_at = now()
where name ~* '(^|[[:space:]])pcg([[:space:]]|$)'
   or name ~* 'coil\s*paint'
   or name ~* 'paint\s*coat'
   or name ~* 'coil\s*coating';

-- Study titles / briefs that still mention coil paint or PCG.
update public.studies
set
  title = case
    when title ~* '(coil|paint\s*coat|coating|pcg)' then 'Consumer app usability study'
    else title
  end,
  audience = case
    when coalesce(audience, '') ~* '(coil|paint\s*coat|coating|pcg|manufacturer)' then 'Product and design teammates'
    else audience
  end,
  goal = case
    when coalesce(goal, '') ~* '(coil|paint\s*coat|coating|pcg)' then 'Understand why people struggle with the core workflow'
    else goal
  end,
  updated_at = now()
where title ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)'
   or coalesce(audience, '') ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)'
   or coalesce(goal, '') ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)';

-- Scene titles.
update public.reels
set
  title = regexp_replace(
    regexp_replace(title, 'coil\s*paint', 'the product', 'gi'),
    'pcg',
    'the team',
    'gi'
  ),
  updated_at = now()
where title ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)';

-- Source filenames / pasted text (best-effort redaction).
update public.sources
set
  name = regexp_replace(
    regexp_replace(name, 'coil[_ -]?paint', 'ux-interviews', 'gi'),
    'pcg',
    'sample',
    'gi'
  ),
  text = regexp_replace(
    regexp_replace(coalesce(text, ''), 'coil\s*paint', 'the product', 'gi'),
    'paint\s*coating|coil\s*coating',
    'the product',
    'gi'
  )
where name ~* '(coil|pcg|paint\s*coat|coating|pre-?paint|precoat)'
   or coalesce(text, '') ~* '(coil paint|pcg|paint coating|coil coating)';
