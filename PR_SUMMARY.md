# Supabase Migration - What's Been Done

This PR represents the infrastructure migration from Hercules to an independent stack with Supabase, Vercel, and Capacitor.

## ✅ Completed

### 1. Database Schema Migration
- Created complete Supabase/Postgres schema in `supabase/migrations/`
- Converted all Convex tables to Postgres with proper indexes
- Implemented comprehensive Row Level Security (RLS) policies
- Created storage buckets for uploads, footage, and generated content
- All tables secured with workspace-based access control

### 2. Authentication Migration
- Replaced Hercules Auth with Supabase Auth
- Created new `src/lib/auth.tsx` provider
- Supports Google, Microsoft (Azure), Apple OAuth
- Email OTP support included
- PKCE flow with deep link support for mobile

### 3. AI Provider Integration
- Created `src/lib/ai.ts` with direct Anthropic & OpenAI SDK calls
- Replaced Hercules AI Gateway with:
  - Anthropic Claude Sonnet for text generation
  - OpenAI DALL-E 3 for image generation
- Maintained existing system prompts and tool schemas
- Centralized AI configuration for future self-hosted options

### 4. Data Import Script
- Complete migration script in `scripts/import-convex-data.mjs`
- Converts Convex IDs to UUIDs while maintaining relationships
- Handles all 24 tables with proper foreign key dependencies
- Preserves timestamps and data integrity

### 5. Mobile Support (iOS)
- Initialized Capacitor with app ID `ai.repofeed.app`
- Created iOS project structure in `ios/`
- Configured deep link schemes for auth callbacks
- Ready for Xcode build (requires macOS)

### 6. Deployment Configuration
- `vercel.json` with SPA rewrites and cache headers
- `.env.example` with all required environment variables
- Serverless API route structure in `api/`
- Proper environment variable mapping for Vercel

### 7. Documentation
- **MIGRATION.md**: Comprehensive 400+ line migration guide
  - Step-by-step Supabase setup
  - OAuth provider configuration (Google, Microsoft, Apple)
  - Data import instructions
  - Vercel deployment guide
  - iOS App Store submission checklist
  - Troubleshooting section
  - Cost estimates

### 8. Dependencies
- ✅ Added: `@supabase/supabase-js`, `@anthropic-ai/sdk`, `openai`
- ✅ Added: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`
- ✅ Removed: All `@usehercules/*` packages
- ✅ Removed: Convex and related dependencies

### 9. Core Infrastructure
- Created Supabase client with proper PKCE configuration
- Database types stub (ready for `supabase gen types`)
- Updated providers: Auth → Workspace → QueryClient
- Created workspace context with RLS-aware queries

## ⚠️ Remaining Work (Estimated: 1-2 days for a developer familiar with the codebase)

### 1. Frontend Query Migration
**Status**: Not started  
**Effort**: High (~1 day)

All React components still import from `convex/react` and need migration to Supabase:

```typescript
// Current (Convex)
import { useQuery } from 'convex/react';
const studies = useQuery(api.studies.list, { workspaceId });

// Needs migration to (Supabase)
import { supabase } from '@/lib/supabase';
const { data: studies } = await supabase
  .from('studies')
  .select('*')
  .eq('workspace_id', workspaceId);
```

Files needing updates (~40+ files):
- `src/pages/**/*.tsx` - All page components
- `src/components/plan-notices.tsx`
- `src/components/onboarding-tour.tsx`
- `src/pages/feed/_lib/use-feed-data.ts`
- `src/pages/insights/page.tsx`
- Many more...

**Recommendation**: Use React Query (`@tanstack/react-query`) for caching and state management, similar to how Convex worked.

### 2. Generation Pipeline (AI Worker)
**Status**: Stub created  
**Effort**: Medium (~4 hours)

The `api/generation/process.ts` is a skeleton. Needs full implementation:

- Port `convex/generation/worker.ts` logic
- Implement chunk processing for extraction phase
- Implement reel composition phase
- Add retry logic and error handling
- Create background job processing (consider Vercel Cron or Supabase Edge Functions)

**Key files to port**:
- `convex/generation/worker.ts` → API route or Edge Function
- `convex/generation/jobs.ts` → Job management queries
- `convex/generation/scenes.ts` → Scene validation logic

### 3. Email System
**Status**: Not started  
**Effort**: Medium (~3 hours)

Current implementation uses `@usehercules/sdk` for email:

```typescript
// Current
import { getClient } from "@usehercules/sdk/server";
await getClient().email.send({ ... });
```

**Needs**:
- Install and configure Resend (`npm install resend`)
- Port templates from `convex/lib/emailTemplates.ts`
- Update email sending in generation jobs, invites, etc.
- Configure Resend API key in environment

### 4. Billing Integration
**Status**: Not started  
**Effort**: Medium (~4 hours)

Current: Hercules Commerce  
Needs: Stripe integration

**Todo**:
- Set up Stripe account
- Install Stripe SDK
- Create checkout session API route
- Port plan limits logic from `convex/billing/limits.ts`
- Update workspace billing fields
- Add webhook handler for payment events

### 5. Rate Limiting
**Status**: Schema exists, logic needs porting  
**Effort**: Low (~2 hours)

- Port `convex/lib/rateLimit.ts` to use Supabase
- Update generation job creation
- Update file upload endpoints

### 6. File Storage Migration
**Status**: Not started  
**Effort**: Manual process

Existing files in Convex storage need manual migration:

```bash
# For each file in production:
1. Download from Convex
2. Upload to Supabase Storage bucket
3. Update upload_claims table with new storage_id
```

**Alternative**: Let users re-upload (simpler but data loss)

### 7. Tests
**Status**: Many will fail  
**Effort**: Medium (~4 hours)

Current tests use `convex-test` which no longer exists:

```typescript
import { convexTest } from "convex-test";
```

**Needs**:
- Remove Convex test utilities
- Write Supabase test utilities
- Update test cases to use Supabase client
- May need to mock Supabase or use a test database

Consider: Supabase provides a test instance you can seed

### 8. TypeScript Errors
**Status**: Build will fail  
**Effort**: High (~6 hours)

Running `pnpm build` will show many TypeScript errors:

- Missing Convex imports
- Type mismatches (Convex types → Supabase types)
- API surface changes

**Process**:
1. Run `pnpm build`
2. Fix errors one file at a time
3. Start with core files (`src/lib/*`)
4. Then pages and components

### 9. App.tsx and Route Guards
**Status**: Uses Convex auth components  
**Effort**: Low (~1 hour)

Current:
```typescript
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
```

Needs:
- Create equivalent guards using Supabase auth state
- Update route protection logic
- Port loading states

### 10. Callback Route
**Status**: Uses Convex auth  
**Effort**: Low (~30 min)

`src/pages/auth/Callback.tsx` needs update for Supabase auth:

```typescript
// Current
import { useConvexAuth } from "convex/react";

// Update to
import { useAuth } from '@/lib/auth';
```

## 🎯 Quick Start for Continuing the Migration

### Recommended Order:

1. **Get TypeScript compiling** (Day 1 morning)
   - Fix imports in `src/App.tsx`
   - Create auth guard components
   - Update `src/pages/auth/Callback.tsx`
   - Run `pnpm build` and fix basic type errors

2. **Core page functionality** (Day 1 afternoon)
   - Port `src/pages/studies/page.tsx` (study list)
   - Port `src/pages/feed/page.tsx` (feed view)
   - Port workspace switching

3. **Generation pipeline** (Day 2 morning)
   - Complete `api/generation/process.ts`
   - Add background job processor
   - Test AI generation end-to-end

4. **Billing and emails** (Day 2 afternoon)
   - Set up Stripe
   - Configure Resend
   - Port billing logic
   - Test checkout flow

5. **Polish and deploy** (Day 2 evening)
   - Fix remaining tests
   - Deploy to Vercel staging
   - Run through migration guide
   - Deploy to production

## 📦 What Isaac Needs to Provide

1. **Supabase Project**
   - Create at supabase.com
   - Run migrations: `supabase db push`
   - Configure OAuth providers in dashboard

2. **API Keys** (add to Vercel env vars)
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `RESEND_API_KEY`
   - Stripe keys (when billing is implemented)

3. **OAuth Credentials**
   - Google: Client ID + Secret
   - Microsoft: App ID + Secret
   - Apple: Service ID + Key

4. **Vercel Project**
   - Link repo in Vercel dashboard
   - Set environment variables
   - Deploy

5. **iOS Build** (requires macOS)
   - Open `ios/App/App.xcodeproj` in Xcode
   - Configure signing with Apple Developer account
   - Build and archive for App Store

## 🚨 Known Issues / Breaking Changes

1. **All existing Convex-backed pages will not work** until queries are migrated
2. **Tests will fail** until test utilities are updated
3. **TypeScript build will fail** until all imports are fixed
4. **No backward compatibility** - this is a full replacement, not a gradual migration
5. **Existing uploaded files** will not transfer automatically
6. **Sessions will be lost** - users must sign in again

## 💡 Architecture Decisions Made

### Why Supabase over self-hosted Postgres?
- Built-in auth with OAuth providers
- Row Level Security policies
- Storage buckets included
- Real-time subscriptions (future use)
- Free tier generous enough for staging

### Why Vercel Functions over Supabase Edge Functions?
- Vercel is deployment target anyway
- Easier to keep server code with frontend
- Can still add Supabase Edge Functions later if needed
- Node.js environment (easier than Deno for porting)

### Why UUIDs instead of keeping Convex IDs?
- Standard for Postgres
- Better for security (no sequential IDs)
- Easier to merge data from multiple sources
- Supabase auth uses UUIDs

### Why not use an ORM (Prisma, Drizzle)?
- Supabase client is type-safe enough
- One less dependency
- RLS policies work at DB level, not ORM level
- Queries are simple CRUD, not complex joins

## 📊 Migration Statistics

- **Files changed**: 100+
- **Lines added**: ~2,500
- **Lines removed**: ~8,000 (entire convex/ directory)
- **New dependencies**: 3 main, 3 mobile
- **Removed dependencies**: 8
- **SQL migrations**: 3 files, ~600 lines
- **Documentation**: 400+ lines

## 🔗 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [Anthropic API Reference](https://docs.anthropic.com/)
- [OpenAI API Reference](https://platform.openai.com/docs)

---

**Ready to continue?** Start with `MIGRATION.md` for setup instructions, then tackle the TypeScript errors in the order suggested above.
