# Migration Guide: Hercules → Supabase + Vercel

This guide walks you through migrating repofeed.ai from Hercules to a fully independent stack with Supabase backend, Vercel hosting, and native iOS support via Capacitor.

## Overview

**Before (Hercules stack):**
- Backend: Convex
- Auth: Hercules OIDC
- AI: Hercules AI Gateway
- Deployment: Hercules platform

**After (Independent stack):**
- Backend: Supabase (Postgres + Row Level Security + Storage)
- Auth: Supabase Auth (Google, Microsoft, Apple, Email OTP)
- AI: OpenAI SDK only (text + images)
- Deployment: Vercel (web) + iOS via Capacitor
- Data: Your own Supabase instance

## Prerequisites

1. **Supabase Account**: Create a project at https://supabase.com
2. **Vercel Account**: Sign up at https://vercel.com
3. **OpenAI API Key**: Get from https://platform.openai.com
4. **Resend Account** (for emails): Sign up at https://resend.com
5. **Apple Developer Account** (for iOS): https://developer.apple.com

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Create a new project
3. Save your project URL and keys:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon (public) key
   - Service role (secret) key

### 1.2 Run Migrations

Install Supabase CLI:
```bash
npm install -g supabase
```

Link your project:
```bash
cd /path/to/repofeed
supabase link --project-ref your-project-ref
```

Push migrations:
```bash
supabase db push
```

Hosted Supabase is **not** updated by deploying this app. Apply new SQL files yourself with `supabase db push` (or the dashboard). `20261102075456_allow_generation_job_verify_phase.sql` allows generation jobs to enter the `verify` phase after compose.

This creates:
- All database tables with proper indexes
- Row Level Security policies scoped to workspace membership
- Storage buckets for file uploads
- Helper functions for permission checks

### 1.3 Configure Auth Providers

In Supabase Dashboard → Authentication → Providers:

**Google OAuth:**
1. Go to https://console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Set authorized redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

**Microsoft (Azure) OAuth:**
1. Go to https://portal.azure.com
2. Register an application
3. Add redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
4. Copy Application (client) ID and create a client secret
5. Add to Supabase

**Apple OAuth:**
1. Go to https://developer.apple.com
2. Create a Services ID
3. Configure Sign in with Apple
4. Add redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
5. Copy Service ID and generate a key
6. Add to Supabase

**Email OTP:**
- Enabled by default in Supabase

### 1.4 Configure Storage

Storage buckets are created automatically by the migration. They are:
- `uploads`: User-uploaded research files
- `footage`: Video clips for reel backgrounds
- `generated`: AI-generated images

No additional configuration needed.

## Step 2: Import Existing Data

You have a Convex database export (`db-snapshot.zip`). Import it:

```bash
# Requires Node 22+ (supabase-js uses the WebSocket global).
# Set environment variables
export SUPABASE_URL=https://xxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Preview mapping (no writes). Accepts a zip or an already-extracted snapshot directory.
node scripts/import-convex-data.mjs /path/to/db-snapshot.zip --dry-run
node scripts/import-convex-data.mjs /path/to/extracted-snapshot --dry-run

# Import (creates auth users, then upserts public tables)
node scripts/import-convex-data.mjs /path/to/db-snapshot.zip
```

This script:
- Creates or reuses `auth.users` via `supabase.auth.admin.createUser` (find-by-email on reruns) and upserts `public.users` with that id
- Dedupes Convex users that share an email (case-insensitive): one auth + `public.users` row, latest profile fields, every Convex user id mapped to that Supabase id
- Drops rows that then collide on unique keys (`workspace_members`, `saved_reels`, `reactions`, …) and logs each collapse
- Maps Convex camelCase folders (`workspaceMembers`, `shareLinks`, …) to snake_case tables
- Derives deterministic UUIDs (v5) from Convex `_id` for non-user rows and upserts on `id`
- Skips transient `rateLimits` and Convex system folders (`_tables`, `_storage`, any `_…`)
- Reads zips that JSZip rejects (empty/lying central directory) and extracted directories
- Exits non-zero if an unmapped folder has records
- Preserves timestamps and remaps foreign keys, including JSON ids such as `reels.footage.storageId`

**⚠️ Important:** File uploads stored in Convex's storage are NOT migrated. Users will need to re-upload files or you'll need to download and re-upload them manually to Supabase Storage.

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
# From Supabase Dashboard → Settings → API
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...

# From OpenAI dashboard (text + images)
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-5.1
OPENAI_IMAGE_MODEL=gpt-image-1

# From Resend dashboard
RESEND_API_KEY=re_...

# Public origin used by the browser and by server-side generation step chaining.
# The process route derives its base URL from SITE_URL, then VITE_SITE_URL,
# then https://${VERCEL_URL} (VERCEL_URL is provided automatically on Vercel).
SITE_URL=https://repofeed.ai
VITE_SITE_URL=https://repofeed.ai
VITE_APP_URL=https://repofeed.ai

# Server-only secret. /api/generation/process accepts either a workspace editor
# bearer token or this value in x-generation-internal-secret.
# Required for HTTP step chaining (in-process waitUntil is preferred on Vercel).
GENERATION_INTERNAL_SECRET=

# Optional. Lets preview deployments call themselves through Deployment Protection.
# Project Settings → Deployment Protection → Protection Bypass for Automation.
VERCEL_AUTOMATION_BYPASS_SECRET=
```

## Step 4: Deploy to Vercel

### 4.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 4.2 Link Project

```bash
vercel link
```

### 4.3 Set Environment Variables

Set these in Vercel project settings (Dashboard → Settings → Environment Variables, or `vercel env add`). Do not put them in `vercel.json`: Vercel Secrets (`@name` references) are deprecated, and `env` / `build.env` blocks there fail the deploy and override project env vars.

In Vercel Dashboard → Settings → Environment Variables, add:

**Production & Preview:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `SITE_URL` (canonical public origin; used for generation step chaining)
- `VITE_SITE_URL` (same origin for the browser / fallback for chaining)

**Production & Preview (secrets):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `GENERATION_INTERNAL_SECRET` (protects `/api/generation/process` self-calls)
- `VERCEL_AUTOMATION_BYPASS_SECRET` (optional; required on protected preview deployments so process can chain)

Vercel also sets `VERCEL_URL` automatically. Chaining sends `x-generation-internal-secret` and, when configured, `x-vercel-protection-bypass`. The preferred path runs the next step in-process with `waitUntil` from `@vercel/functions`.

### 4.4 Deploy

```bash
vercel --prod
```

Your site will be live at `https://your-project.vercel.app`.

### 4.5 Configure Custom Domain

In Vercel Dashboard → Settings → Domains:
1. Add `repofeed.ai`
2. Follow DNS instructions
3. Wait for SSL provisioning (~1 hour)

**⚠️ DO NOT change DNS until you're ready for cutover!**

## Step 5: Set Up iOS App (Capacitor)

### 5.1 Prerequisites

- macOS with Xcode 15+
- Apple Developer account ($99/year)

### 5.2 Build Web App

```bash
pnpm install
pnpm build
```

### 5.3 Sync Capacitor

```bash
npx cap sync ios
```

This creates/updates the iOS project in `ios/` directory.

### 5.4 Open in Xcode

```bash
npx cap open ios
```

### 5.5 Configure iOS Project

In Xcode:

1. **Signing & Capabilities:**
   - Select your team
   - Bundle Identifier: `ai.repofeed.app`
   - Enable automatic signing

2. **Info.plist:**
   - Add URL scheme for deep linking:
     ```xml
     <key>CFBundleURLTypes</key>
     <array>
       <dict>
         <key>CFBundleURLSchemes</key>
         <array>
           <string>repofeed</string>
         </array>
       </dict>
     </array>
     ```

3. **Associated Domains:**
   - Add `applinks:repofeed.ai`
   - Add `applinks:xxxxx.supabase.co` for auth callbacks

### 5.6 Configure Supabase Auth for iOS

In Supabase Dashboard → Authentication → URL Configuration:

Add redirect URLs:
- `repofeed://auth/callback`
- `https://repofeed.ai/auth/callback`

### 5.7 Build for Testing

1. Select a simulator or connected device
2. Press ⌘R to build and run
3. Test authentication flows

### 5.8 Prepare for App Store

1. **App Store Connect:**
   - Create new app
   - Bundle ID: `ai.repofeed.app`
   - Name: `repofeed`

2. **Screenshots:**
   - Take on 6.7" and 6.5" devices
   - Minimum 3 screenshots

3. **App Icon:**
   - 1024×1024 PNG (in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`)

4. **Privacy Policy:**
   - Required for App Store
   - Must be publicly accessible URL

5. **Archive & Upload:**
   - Product → Archive
   - Upload to App Store Connect
   - Submit for review (~24-48 hours)

## Step 6: Testing Checklist

Before going live, verify:

- [ ] User authentication (Google, Microsoft, Apple, Email OTP)
- [ ] Create workspace
- [ ] Invite team members
- [ ] Upload research files
- [ ] Generate insights (AI pipeline)
- [ ] View feed
- [ ] Add reactions and comments
- [ ] Export deck
- [ ] Share links work
- [ ] Mobile app deep links work
- [ ] All environment variables are set in Vercel
- [ ] Database RLS policies prevent unauthorized access

## Step 7: Cutover Plan

**IMPORTANT:** This is a breaking change. Plan downtime or parallel run.

### Option A: Clean Cutover (Recommended)

1. Announce maintenance window (2-4 hours)
2. Take old site into read-only mode
3. Export final Convex snapshot
4. Import to Supabase
5. Update DNS to point to Vercel
6. Test production
7. Announce launch

### Option B: Parallel Run

1. Deploy new stack to `new.repofeed.ai`
2. Import data
3. Let beta users test
4. Once stable, switch DNS from old to new
5. Redirect old domain

## Step 8: Post-Migration

### Monitor

- Vercel Dashboard: Check for errors
- Supabase Dashboard: Monitor database performance
- OpenAI Dashboard: Track text and image generation usage

### Backup

Supabase provides daily backups, but you should also:
```bash
# Backup script (run daily)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Updates

When you push to `main` branch:
1. Vercel auto-deploys
2. Run migrations if schema changed:
   ```bash
   supabase db push
   ```

## Troubleshooting

### Auth issues

**Problem:** Users can't sign in
- Check OAuth redirect URIs match Supabase URL
- Verify environment variables in Vercel
- Check Supabase logs in Dashboard → Logs

### Database access denied

**Problem:** RLS blocking queries
- Check user is member of workspace
- Verify RLS policies in Supabase SQL Editor
- Use service role key for server-side operations

### AI generation failing

**Problem:** Jobs stuck or erroring
- Check `OPENAI_API_KEY` is set
- `api/generation/start` and `api/art/paint` require a Supabase bearer token and a workspace editor (`owner` or `editor`). `started_by` is set to that user.
- `api/generation/process` allows that same editor token **or** `x-generation-internal-secret: $GENERATION_INTERNAL_SECRET`
- If preview self-calls 401 from Deployment Protection, set `VERCEL_AUTOMATION_BYPASS_SECRET` and `SITE_URL` (or rely on `VERCEL_URL`)
- OpenAI `insufficient_quota` is returned as HTTP 402 `{ error: "AI provider out of credits" }`; true rate limits are 429; other provider errors are 502
- Check Vercel function logs for errors

### iOS build fails

**Problem:** Xcode errors
- Run `pod install` in `ios/App` directory
- Clean build folder: Product → Clean Build Folder
- Update Xcode and CocoaPods

## Cost Estimates

**Supabase:**
- Free tier: 500 MB database, 1 GB file storage, 50 GB bandwidth
- Pro: $25/month for production (recommended)

**Vercel:**
- Hobby: Free (good for staging)
- Pro: $20/month (recommended for production)

**OpenAI:**
- Text (`gpt-5.1` default, override with `OPENAI_TEXT_MODEL`): token usage varies by model
- Images (`gpt-image-1` default, override with `OPENAI_IMAGE_MODEL`): per-image pricing
- Estimate: $70-300/month depending on usage

**Resend:**
- Free: 3,000 emails/month
- Paid: $20/month for 50k emails

**Total:** ~$115-350/month depending on usage

## Support Contacts

- **Supabase**: support@supabase.io or Discord
- **Vercel**: support@vercel.com
- **OpenAI**: help.openai.com

---

## Next Steps After Migration

1. **Set up monitoring**: Add Sentry or similar for error tracking
2. **Performance**: Review slow queries in Supabase Dashboard
3. **Security**: Schedule security audit for RLS policies
4. **Documentation**: Update internal docs with new architecture
5. **Team training**: Walk through new deployment process with team

## What's Stubbed / Not Fully Implemented

This migration provides the infrastructure, but some features need completion:

1. **Email sending**: Resend integration is configured but email templates need migration from `convex/lib/emailTemplates.ts`
2. **Billing**: Stripe integration needs setup (was Hercules Commerce)
3. **Generation worker**: Edge Functions for AI pipeline need full porting from `convex/generation/`
4. **Rate limiting**: Logic exists but may need tuning for Supabase
5. **File storage**: Existing Convex files need manual migration

**Estimated additional work:** 1-2 days for a developer familiar with the codebase.

---

**Need help?** Open an issue or contact the team. Good luck! 🚀
