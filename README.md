# repofeed.ai

Vite + React app on Vercel, with a Supabase backend (`odvpqotwaokflegpmmej`) and OpenAI for generation. Billing runs in Vercel functions against Stripe.

## Environment variables

Names only — never commit secret values.

### Browser (`VITE_*`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (optional public origin)
- `VITE_ENABLE_GOOGLE_AUTH` (set to `true` to show Google sign-in)

### Server

- `SUPABASE_URL` (falls back to `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `GENERATION_INTERNAL_SECRET`
- `VERCEL_AUTOMATION_BYPASS_SECRET` (optional, preview protection bypass)
- `OPENAI_API_KEY` (text + image generation)
- `OPENAI_TEXT_MODEL` (optional)
- `OPENAI_IMAGE_MODEL` (optional)
- `OPENAI_IMAGE_QUALITY` (optional)
- `XAI_API_KEY` (AI reel videos; Grok Imagine Video)
- `VIDEO_PROVIDER` (optional; default `xai`. `openai` is a disabled adapter — OpenAI Videos/Sora shut down on 2026-09-24)
- `VIDEO_ENABLED` / `OPENAI_VIDEO_ENABLED` (optional; default on. Set `false` / `0` / `off` to kill AI video generation)
- `VIDEO_MODEL` / `OPENAI_VIDEO_MODEL` (optional; default `grok-imagine-video-1.5-lite`)
- `VIDEO_SECONDS` / `OPENAI_VIDEO_SECONDS` (optional; 1–15, default `5`)
- `VIDEO_RESOLUTION` (optional; `480p`, `720p`, or `1080p`; default `720p`)
- `VIDEO_ASPECT_RATIO` (optional; default `9:16`)
- `VIDEO_CONCURRENCY` / `OPENAI_VIDEO_CONCURRENCY` (optional; default `2`, max `4`)
- `VIDEO_STUDY_CAP` / `OPENAI_VIDEO_STUDY_CAP` (optional; overrides the per-study cap. Defaults: free 6, pro 12, team 24)
- `XAI_VIDEO_BASE_URL` / `XAI_BASE_URL` (optional; default `https://api.x.ai/v1`)
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TEAM_YEARLY`
- `STRIPE_PRICE_PRO` (legacy fallback if monthly/yearly ids are unset)
- `STRIPE_PRICE_TEAM` (legacy fallback if monthly/yearly ids are unset)
- `STRIPE_PORTAL_CONFIGURATION` (optional; Customer Portal configuration id when the Stripe account is shared)

If Stripe env vars are missing, checkout, portal and plan endpoints return HTTP 503 and the billing UI shows **Billing is coming soon**.

### AI reel videos

After a study is generated, each reel gets a short vertical AI background via **xAI Grok Imagine Video 1.5 Lite** (`POST https://api.x.ai/v1/videos/generations`, then poll `GET /v1/videos/{request_id}`). Set `XAI_API_KEY`. Rendering takes longer than a Vercel function, so `/api/videos/process` (and the daily `/api/generation/recover` cron) poll the job, download the MP4, and store it in the public `videos` Supabase bucket. Painted stills are passed as `image.url` so the clip can animate the backdrop.

**Why this provider:** live first-party REST in Nov 2026, native 9:16, 1–15s clips, async create/poll, and image-to-video. Cheapest quality-appropriate option among the candidates checked. Veo 3.1 preview on the Gemini API shut down 2026-10-22. Runway Gen-4 Turbo is $0.05/sec. Luma Ray 3.2 720p is about $0.06/sec. Kling v2.5 Turbo on fal.ai is $0.07/sec. fal.ai is a reseller, not a first-party API.

**Cost per reel:** **$0.15** for a 5s 720p clip ($0.03/sec × 5). Image-to-video adds **$0.01** for the painted still, so **$0.16** when animating a backdrop. Sources: [xAI pricing](https://docs.x.ai/developers/pricing) (updated 2026-10-10) and [grok-imagine-video-1.5-lite](https://docs.x.ai/developers/models/grok-imagine-video-1.5-lite).

The provider is behind a small adapter (`create` / `retrieve` / `download`) selected by `VIDEO_PROVIDER` (default `xai`). `openai` stays in the registry but is disabled and never calls `/v1/videos`.

While a job is queued/in progress, or if it fails, the reel plays a rotating stock clip so it is never blank. Existing AI videos are never regenerated. Apply `supabase/migrations/20261103043000_reel_ai_videos.sql` before enabling this in production.

**Backfill existing reels** (also runs when an editor opens Review, and from the daily recover cron):

```bash
# One study (editor bearer token)
curl -X POST "$SITE_URL/api/videos/backfill" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studyId":"<study-id>"}'

# Internal: all eligible reels, or the broken "Why people really leave" reel
curl -X POST "$SITE_URL/api/videos/backfill" \
  -H "x-generation-internal-secret: $GENERATION_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"titleContains":"Why people really leave","limit":20}'
```

Use `OPENAI_VIDEO_ENABLED=false` or `VIDEO_ENABLED=false` to skip create calls. Leftover OpenAI jobs fail on poll and retry on xAI.

## Stripe setup

1. Create two products: **Pro** and **Team**.
2. On each product, create a monthly price and a yearly price. Team is per-seat with a 2-seat minimum (the app sends `quantity`).
3. Copy the four price ids into `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_TEAM_MONTHLY`, and `STRIPE_PRICE_TEAM_YEARLY`.
4. Add a webhook endpoint at `https://repofeed.ai/api/stripe/webhook` for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Put the webhook signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Create a Customer Portal configuration for this app (the Stripe account may be shared). Put its id in `STRIPE_PORTAL_CONFIGURATION`. If unset, Stripe uses the account default.

## Supabase email templates (magic links across devices)

The default Supabase confirmation URL uses PKCE and only works in the same browser that requested the email. Paste these templates so links use `token_hash` and work on any device.

1. Open [Authentication → Email Templates](https://supabase.com/dashboard/project/odvpqotwaokflegpmmej/auth/templates).
2. For each template, replace the HTML with the matching file in `supabase/templates/`:
   - Confirm signup → `confirm-signup.html` (`type=signup`)
   - Magic link → `magic-link.html` (`type=magiclink`)
   - Invite → `invite.html` (`type=invite`)
   - Reset password / recovery → `recovery.html` (`type=recovery`)
   - Change email address → `email-change.html` (`type=email_change`)
3. Set **Site URL** to `https://repofeed.ai`.
4. Add redirect allow-list URLs: `https://repofeed.ai/auth/callback` and `https://repofeed.ai/auth/confirm`.
5. Same-browser PKCE (`?code=`) still works on `/auth/callback`. Cross-device links use `/auth/confirm?token_hash=…&type=…`. The templates also include `{{ .Token }}` so people can type the 6-digit code on `/signin` without opening the link.
6. In Authentication → Providers → Email, keep the mailer OTP length at 6. Custom SMTP is optional and unchanged by this repo.

## Security / performance migration

Apply `supabase/migrations/20261103030000_security_perf.sql` on project `odvpqotwaokflegpmmej` (SQL editor or `supabase db push`) after review. It does not drop tables or data. See the pull request description for the exact SQL.

## Scripts

```bash
pnpm test
pnpm build
pnpm lint
```
