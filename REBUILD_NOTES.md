# UI rebuild, November 2026

What changed in this pass, what you need to do before it goes live, and what was left alone.

## Before you deploy

1. **Run the new migration**: `supabase/migrations/20261110090000_ads_attribution_and_spend.sql`.
   It adds `users.click_id` / `click_id_type` and the `ad_spend` table. The growth dashboard
   still loads without it, but spend logging and the conversion export need it.
   Also run `supabase/migrations/20261112090000_reel_topics.sql` (adds `reels.topics` plus an index).
   Existing insights get topics automatically the first time someone opens Explore.
2. **Video model**: set `VIDEO_MODEL=grok-imagine-video-1.5`. The old default (`-lite`) isn't in xAI's
   docs; the code now retries once with `grok-imagine-video-1.5` if xAI rejects the model.
3. **Fonts**: `pnpm install` picks up `@fontsource-variable/schibsted-grotesk` and
   `@fontsource-variable/newsreader`.
4. **Read the privacy policy change** (`src/pages/legal/privacy.tsx`, analytics paragraph). It now says
   that campaign tags and ad click references are recorded, and that signups may be reported back to the
   ad platform by click reference. That is what the code does. Have whoever reviews your legal text confirm
   the wording.
5. **Missing asset**: the landing page and demo reference `/footage/*.mp4`, which was not in the zip.
   The player falls back to stock clips, so nothing breaks, but check the folder exists in production.

## Design

- Light workspace, dark theater. Studies, Insights, settings and the marketing pages are light.
  Anything that plays video (feed, demo, share links, deck) sits inside a `.dark` scope that swaps the
  same tokens. Tokens live in `src/index.css`.
- One typeface for the product (Schibsted Grotesk). A serif italic (`.quote-voice`) is used only for
  participant quotes. The reel canvas and the PowerPoint export keep their own fonts.
- A yellow highlighter (`--mark`, `.hl`) marks quotes and "new" items.
- All-caps tracked labels, glow gradients and per-section entrance animations are gone.

## Marketing and ads

- `src/pages/landing/` rebuilt: email capture in the hero (sends the sign-in link directly), a
  three-step explainer, the privacy and accuracy section, an Insights preview, a comparison table,
  pricing, an FAQ and a closing call to action.
- **Ad landing pages**: `/for/<slug>` renders the same page with a headline that matches the ad.
  Add or edit entries in `src/pages/landing/variants.ts`. They are `noindex` so they don't compete
  with the home page in search.
- There are **no customer quotes or logos** on the page, because there were none to use. Add real
  ones when you have permission; that is the biggest remaining lever on conversion.

## Growth dashboard (`/admin/analytics`)

- Access is decided on the server. `/api/admin/analytics` and `/api/admin/ad-spend` return 404 unless
  `users.is_admin` is true, and only the service role can set that flag. The sidebar shows a "Growth"
  link only to an admin.
- **Ads and acquisition**: spend, visits, signups, cost per signup, paying customers, CAC and payback;
  a sortable campaign table with a plain-language read on each row; channels; landing pages; ad
  creatives (`utm_content`); keywords (`utm_term`).
- **Tools**: a tagged-link builder, an ad spend ledger, and CSV exports of conversions keyed by the ad
  platform's click ID (for offline conversion uploads). No ad pixels are loaded.
- **Product**: the previous dashboard's numbers, reorganised.
- New events: `landing_view`, `cta_click`, `demo_open`. `session_start` now carries campaign tags.
  Visits recorded before this deploy have no tags and show up as Direct.
- The "read" on each campaign uses fixed thresholds in `src/pages/admin/_lib/verdict.ts`
  (CAC target $90, roughly three months of Pro). Change them there.
- The MRR figure is an estimate at monthly list price, not a Stripe number.

## Product

- New sidebar grouped as Watch / Make / Manage, with a mobile tab bar.
- **Search everywhere** (`⌘K` or `/`): scenes by any word in them, including quote text, plus studies
  and pages. The old feed search only matched titles and was not wired to its button.
- **Feed player**: scenes now play as soon as they are in view (they used to sit paused), with a
  progress bar, title overlay, "New" badge, a copy-link button, and keys: space, L, S, C, E, J/K.
- **Three reactions in the feed**: "Rings true", "Surprised me" and "Push back" (keys 1, 2, 3). The
  feed used to send only "rings true", so the other two Insights columns could never fill. The pressed
  state is remembered for the session only; the feed API does not return your own reaction yet.
- Plan cards are shared between the public pricing section and the billing page.

## Readout deck (PowerPoint)

The deck builder was in the code but could not produce a deck. Three things were wrong, all fixed:

- The "Create deck" request was sent without the sign-in token, so the server always answered
  "not authenticated".
- The AI was asked for slides in a shape the slide components and the PowerPoint export don't read,
  and it was given view counts, not the study's findings. It is now given the published scenes and a
  strict slide format. Any quote or figure that isn't in a scene is removed before saving
  (`src/lib/api/deck-build.ts`).
- Saved decks were read back without mapping database field names, so the date, footer and
  reaction chart had nothing to show.

It is now in the sidebar as "Readout deck" and in search. There is also a public sample at `/demo/deck`
(linked from the landing page, the demo feed and the sample Insights page) where visitors press
"Generate deck", page through a deck built from the demo study, and download the .pptx. I tested the slides and the .pptx download
with a sample deck. I could not run the AI step here (no OpenAI key), so generate one real deck after
deploying and check it.

## Onboarding wizard (`/welcome`)

New accounts now go through four short steps: name and role, workspace name, an optional teammate
invite link, then a choice of how to start (upload research, watch the sample feed, or go to the
workspace). The workspace is created at step two, so leaving early still leaves a usable account.
The role and first choice are recorded as an `onboarding_completed` event.

Two things were fixed to make this work: the workspace list is now refreshed after a workspace is
created (before, a brand-new user could be sent back to the welcome page), and invite links no longer
rely on `process.env` in the browser.

## Guided product tour

After setup, editors get a tour in three lessons, one offered per visit: the basics (feed, studies,
starting a study, search), share and discuss (share link, reactions, comments, inviting people), and
measure and present (Insights, readout deck, plans). Each lesson is three or four stops. A stop moves
you to the right page, spotlights the control, and explains it in two sentences.

- A dialog in the middle of the screen offers the next lesson and lists its stops. "Not now" hides it for the visit; "Don't show
  again" turns it off. "Product tour" in the sidebar reopens it and lets you replay any lesson.
- Lessons and wording live in `src/lib/guide.ts`. Stops point at `data-tour` attributes.
- Progress is kept in the browser, per user. On a second device the tour starts again.
- Viewers (non-editors) don't get it. They still get the existing feed walkthrough.

## Explore and ask (`/explore`)

- Every insight carries 2 to 4 topics. New studies get them at generation; older ones are tagged in the
  background on first visit (`api/insights/topics.ts`, never overwrites topics an editor set).
- Editors can change topics in the edit dialog on the Review tab.
- Search ranks as you type (topics weigh most, then titles, then scene text) and handles word forms
  (cancel / cancelled / cancellation).
- Ask writes a short answer citing the insights it used (`api/insights/ask.ts`). Citations the model
  invents are dropped. With no OpenAI key, or if the call fails, it falls back to keyword matches and says so.
- Topic chips filter results (several chips = all of them). Feed scenes show `#topic` links into Explore.
  ⌘K has "Ask your research" and a topics group.
- Limits: above 150 insights the model only reads the 150 best keyword matches (no embeddings yet).
  Guests on share links can't use Explore.

## AI check

Ran the real AI code against a local stand-in for OpenAI and xAI (no live keys): 38 of 38 checks
passed across findings, scene writing, fallbacks, decks, ask, topic tagging, images and the video
lifecycle. Output quality still needs a run with real keys.

## Bugs fixed along the way

- The Review tab crashed on load: `getReviewReels` returned raw database rows instead of mapped reels.
- AI timeouts showed as "temporarily unavailable" because openai 7.x abort errors weren't recognised.

- Hard-refreshing any signed-in page other than the feed bounced you to `/studies`
  (`src/lib/workspace.tsx` reported "no workspaces" before the first fetch finished).
- A failed magic-link request still showed "check your inbox" (`signInWithOtp` ignored the error).

## Not changed

- The reel canvas artwork, the deck slide designs, API routes other than the two admin ones,
  billing logic and database policies.
- 72 lint errors that were there before (mostly `any` in the API layer) are still there.
