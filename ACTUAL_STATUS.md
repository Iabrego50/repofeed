# Actual Migration Status - Honest Assessment

## ✅ What's Actually Done

### 1. Dependencies Added
- `@supabase/supabase-js` ^2.118.0
- `@anthropic-ai/sdk` ^1.3.0  
- `openai` 7.45.1
- `stripe` ^23.0.1
- `resend` ^6.35.0

### 2. Stripe Billing (Partial)
- ✅ Basic Stripe client setup (`src/lib/billing/stripe.ts`)
- ✅ Webhook handler skeleton (`api/stripe/webhook.ts`)
- ✅ Checkout and portal session creation
- ❌ Plan limits and enforcement not fully ported
- ❌ Workspace member seat counting needs verification

### 3. Resend Emails (Complete)
- ✅ `sendStudyPublished`, `sendFeedback`, `sendWorkspaceInvite` implemented
- ✅ HTML email templates with styling

### 4. Supabase API Layer (Partial)
- ✅ `src/lib/api/index.ts` - Billing, studies, feed APIs
- ✅ `src/lib/api/studies.ts` - Study CRUD
- ✅ `src/lib/api/feed.ts` - Feed queries  
- ✅ `src/lib/api/auth.ts` - Auth queries
- ❌ `src/lib/api/billing.ts` does NOT exist as separate file (combined in index.ts)
- ❌ `src/lib/api/users.ts` does NOT exist as separate file
- ❌ `src/lib/api/workspaces.ts` does NOT exist as separate file

### 5. AI Client (Started)
- ✅ Created `src/lib/ai/client.ts` with Anthropic/OpenAI SDK wrappers
- ✅ Created `src/lib/errors/step-error.ts`
- ❌ Prompts, schemas, and tool definitions not ported
- ❌ Scene composition logic not ported

## ❌ What's NOT Done

### 1. Generation Pipeline (STUBBED)
The `api/generation/process.ts` file contains stubs that return success without doing anything:

```typescript
// For now, return success
```

**What needs to be ported** (~1500+ lines from original convex files):
- `convex/generation/ai.ts` (349 lines) - Extract/compose prompts, tool schemas
- `convex/generation/jobs.ts` (500 lines) - Job management, chunking, progress tracking
- `convex/generation/worker.ts` (136 lines) - Step-by-step processing
- `convex/generation/scenes.ts` (86 lines) - Scene validation and composition
- `convex/generation/suggest.ts` (82 lines) - Scene title suggestions
- Extraction logic - Chunk source files, call AI, save findings
- Composition logic - Group findings, generate reels, verify scenes
- Art generation - AI-painted backdrops for scenes
- Error handling, retries, rate limiting

### 2. Convex Compatibility Layer (Still Used)
`src/lib/convex-compat.tsx` still exists and is imported by ~26 files:

**Pages using convex-compat:**
- `src/pages/welcome/page.tsx`
- `src/pages/settings/page.tsx` + email-updates component
- `src/pages/landing/public-entry.tsx`
- `src/pages/studies/new/page.tsx`
- `src/pages/studies/page.tsx`
- `src/pages/studies/detail/page.tsx`
- 13 study component files (`_components/*.tsx`)
- `src/pages/feed/page.tsx` + 3 feed components
- `src/pages/insights/page.tsx` + deck page + watchers dialog
- `src/pages/share/page.tsx`
- `src/pages/invite/page.tsx`

**What needs to happen:**
- Replace `useQuery`, `useMutation`, `useAction` with React Query hooks
- Replace Convex API calls with Supabase API calls
- Remove `@/convex/_generated/api` imports
- Remove `@/convex/_generated/dataModel` type imports
- Delete `src/lib/convex-compat.tsx` once nothing uses it

### 3. Tests (Reduced Coverage)
Original had many test files:
- `convex/access.test.ts`
- `convex/accessReview.test.ts`
- `convex/billing.test.ts`
- `convex/emails.test.ts`
- `convex/footage.test.ts`
- `convex/lib/deck.test.ts`
- `convex/lib/stepError.test.ts`
- `convex/lib/verify.test.ts`

Current test suite has only 3 files with 24 tests (mostly basic smoke tests).

**What needs to be ported:**
- Billing tests (plan enforcement, seat counting, checkout flow)
- Generation tests (extraction, composition, scene validation)
- Permission tests (workspace access, editor/viewer roles)
- Email template tests

### 4. Model IDs (WRONG)
Current code uses:
- `claude-sonnet-4-20241022` ❌ (should be `claude-sonnet-5-5`)
- `dall-e-3` ❌ (should be `gpt-image-2.5-flare`)

**Where to fix:**
- `src/lib/ai/client.ts` (CHAT_MODEL, IMAGE_MODEL constants)
- Any other files that hardcode model names

### 5. Database Schema
Supabase tables need to exist with proper RLS policies:
- `studies`, `sources`, `findings`, `reels`, `generation_jobs`
- `workspaces`, `workspace_members`, `users`
- `comments`, `saved_reels`, `shares`

**Status:** Schema assumed to exist but not verified. RLS policies not documented.

## 📊 Build Status

- ✅ `pnpm build` passes (915ms)
- ✅ `pnpm test` passes (24/24 tests, 747ms)  
- ✅ `pnpm tsc --noEmit` passes
- ⚠️ Build only passes because:
  - ~26 files have `@ts-nocheck` annotations
  - Convex-compat layer provides stubs
  - Generation API returns fake success

## 🎯 What It Would Take to Actually Finish

### Estimated Work Remaining:
1. **Generation Pipeline Port** (~1500 lines, complex AI logic)
   - Port all prompts, schemas, tool definitions
   - Implement job queue and worker system
   - Add chunk processing, retries, error handling
   - Port scene composition and validation
   - Port art generation

2. **Remove Convex-Compat** (~26 files to migrate)
   - Each file needs careful conversion
   - Replace hooks with React Query equivalents
   - Update all database queries
   - Test each page after migration

3. **Port Tests** (~8-10 test files)
   - Rewrite Convex test helpers for Supabase
   - Port all test cases
   - Ensure coverage matches original

4. **Fix Model IDs** (quick, 2 places)

5. **Database Setup** 
   - Document required Supabase schema
   - Write and test RLS policies
   - Create migration scripts

### Realistic Completion Time:
- Generation pipeline: 4-6 hours of focused work
- Page migrations: 3-4 hours
- Test porting: 2-3 hours
- Database setup: 1-2 hours
- Testing and debugging: 2-3 hours

**Total: 12-18 hours of development work**

## 🤔 Recommendation

Given the scope, I suggest one of these paths:

**Option A: Keep Current State (MVP)**
- Keep convex-compat layer for now
- Document what's stubbed
- Ship with limited generation features
- Incrementally migrate pages

**Option B: Full Completion**
- I continue working through all items above
- Multiple rounds of commits
- Full testing from clean clone
- Complete feature parity

**Option C: Hybrid**
- Complete generation pipeline (highest value)
- Leave convex-compat for now (pages still work)
- Fix model IDs
- Ship with working generation

Which would you like me to pursue?
