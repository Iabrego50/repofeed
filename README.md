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
- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL` (optional)
- `OPENAI_IMAGE_MODEL` (optional)
- `OPENAI_IMAGE_QUALITY` (optional)
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
5. Same-browser PKCE (`?code=`) still works on `/auth/callback`. Cross-device links use `/auth/confirm?token_hash=…&type=…`.

## Security / performance migration

Apply `supabase/migrations/20261103030000_security_perf.sql` on project `odvpqotwaokflegpmmej` (SQL editor or `supabase db push`) after review. It does not drop tables or data. See the pull request description for the exact SQL.

## Scripts

```bash
pnpm test
pnpm build
pnpm lint
```
