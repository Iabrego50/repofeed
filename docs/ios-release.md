# iOS App Store & TestFlight release

This guide gets **repofeed** (`ai.repofeed.app`) onto TestFlight and through App Store review **without needing Xcode on your laptop**. Builds run in GitHub Actions on a macOS runner.

## Prerequisites

- Apple Developer Program membership
- Access to the GitHub repo settings (secrets)
- Supabase project admin (Auth URL config)
- Optional: Google OAuth already enabled → you **must** also enable Sign in with Apple for App Store guideline 4.8

## 1. Create the app in App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+**.
2. Bundle ID: register `ai.repofeed.app` under Certificates, Identifiers & Profiles if it does not exist yet (explicit App ID).
3. Create the app:
   - **Name**: repofeed (or “repofeed.ai” if the short name is taken)
   - **Primary language**: English (U.S.)
   - **Bundle ID**: `ai.repofeed.app`
   - **SKU**: e.g. `repofeed-ios`
4. Under the app → **App Information**, note the Apple ID (numeric) if you need it later.

## 2. Create an App Store Connect API key

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. **Generate** a key with **Admin** access (used for TestFlight upload + build-number lookup).
3. Download the `.p8` once. Note:
   - **Key ID**
   - **Issuer ID** (top of the page)
4. Store the `.p8` securely. You will add it to GitHub as a secret (raw PEM or base64).

## 2b. Distribution certificate + App Store profile (manual signing)

CI uses **manual signing** (not cloud automatic signing). Create once in the Apple Developer portal:

1. **Certificates** → create an **Apple Distribution** certificate → export as `.p12` with a password.
2. **Profiles** → create an **App Store** provisioning profile for `ai.repofeed.app` (name e.g. `repofeed AppStore`) → download the `.mobileprovision`.
3. Base64-encode both for GitHub secrets:
   ```bash
   base64 -i Certificates.p12 | pbcopy          # → IOS_DIST_CERT_P12_BASE64
   base64 -i repofeed_AppStore.mobileprovision | pbcopy  # → IOS_APPSTORE_PROFILE_BASE64
   ```

If you rotate the profile, update `PROFILE_UUID` / `PROFILE_NAME` in `fastlane/Fastfile` to match.

## 3. GitHub repository secrets

Settings → Secrets and variables → Actions. Add:

| Secret | Purpose |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | API key ID (Admin) |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8` | Full `.p8` PEM **or** base64 of the file |
| `APPLE_TEAM_ID` | 10-character Team ID (Membership details) |
| `IOS_DIST_CERT_P12_BASE64` | Base64 of Apple Distribution `.p12` |
| `IOS_DIST_CERT_PASSWORD` | Password for that `.p12` |
| `IOS_APPSTORE_PROFILE_BASE64` | Base64 of App Store `.mobileprovision` |
| `VITE_SUPABASE_URL` | Same as production web |
| `VITE_SUPABASE_ANON_KEY` | Same as production web |
| `VITE_SITE_URL` | `https://repofeed.ai` |
| `VITE_ENABLE_GOOGLE_AUTH` | `true` only if Google is live in Supabase |
| `VITE_ENABLE_APPLE_AUTH` | `true` only after Apple provider is configured |

The workflow is `.github/workflows/ios-testflight.yml` on **`macos-26`** (Xcode 26+ / iOS 26 SDK — required by App Store Connect). It builds with Vite, runs `npx cap sync ios`, imports the Distribution cert into a temporary keychain, installs the App Store profile, archives with **manual** signing (`Apple Distribution` + `repofeed AppStore`), and uploads to TestFlight via the ASC API key. Build number = `max(latest TestFlight + 1, github.run_number)`.

## 4. Run a TestFlight build

1. Actions → **iOS TestFlight** → **Run workflow** (or push a tag `ios-v1.0.0`).
2. When the job succeeds, open App Store Connect → TestFlight. Wait for processing, then add internal/external testers.
3. IPA is also uploaded as a workflow artifact (`repofeed-ipa`) for debugging.

Local equivalent (on a Mac with Xcode):

```bash
pnpm build && npx cap sync ios
IOS_BUILD_NUMBER=42 \
APP_STORE_CONNECT_KEY_ID=… \
APP_STORE_CONNECT_ISSUER_ID=… \
APP_STORE_CONNECT_API_KEY_PATH=/path/to/AuthKey.p8 \
APPLE_TEAM_ID=… \
IOS_DIST_CERT_P12_BASE64="$(base64 -i Certificates.p12)" \
IOS_DIST_CERT_PASSWORD=… \
IOS_APPSTORE_PROFILE_BASE64="$(base64 -i repofeed_AppStore.mobileprovision)" \
fastlane ios beta
```

## 5. Supabase Auth redirect URLs

Add these under Supabase → **Authentication** → **URL configuration** → **Redirect URLs**:

| URL | Use |
| --- | --- |
| `https://repofeed.ai/auth/callback` | Web + universal links |
| `https://repofeed.ai/auth/confirm` | Email confirm |
| `ai.repofeed.app://auth/callback` | Native custom scheme (Capacitor) |
| `ai.repofeed.app://auth/confirm` | Native email confirm deep link |
| Preview origins you already use | Vercel previews |

Site URL can stay `https://repofeed.ai`.

The iOS app registers the custom scheme `ai.repofeed.app` and listens with `@capacitor/app` `appUrlOpen` to finish PKCE / magic-link sessions. OAuth on device opens `@capacitor/browser` (SFSafariViewController) and returns via that scheme.

### Optional: Universal Links

1. Host `https://repofeed.ai/.well-known/apple-app-site-association` with your Team ID and `ai.repofeed.app`.
2. Add Associated Domains entitlement: `applinks:repofeed.ai`.
3. Keep the custom scheme entries above as a fallback.

## 6. Sign in with Apple (guideline 4.8)

Required if Google (or any other third-party) sign-in is offered in the iOS app.

1. Apple Developer → **Identifiers** → App ID `ai.repofeed.app` → enable **Sign In with Apple**.
2. Create a Services ID / key for Supabase as documented in [Supabase Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).
3. Supabase → Auth → Providers → **Apple** → enable and paste credentials.
4. Set GitHub / Vercel env `VITE_ENABLE_APPLE_AUTH=true` and redeploy / rebuild the iOS app.
5. The sign-in screen shows **Continue with Apple** only when that flag is exactly `true` (harmless until configured).

## 7. Native Explore-only shell

The Capacitor iOS app is an **Explore-only** client for **everyone** (including admins). The scrollable team scene feed lives at `/explore` (native merges former `/feed` into Explore). Team settings, Insights, and decks stay on the desktop web app. Web (`repofeed.ai`) is unchanged.

When `Capacitor.isNativePlatform()`:

- `/` skips marketing → sign-in → **Explore** (scene feed)
- `/feed`, `/insights`, `/insights/deck`, Studies, Settings, Billing → redirect to `/explore`
- Public demo: Insights/deck links hidden; `/demo/insights` and `/demo/deck` redirect to `/demo/explore`
- **No Settings screen** — profile menu: **Sign out**, **Delete account** (App Store 5.1.1(v))
- Interactions: react, comment, share, save, team switcher, New/unread badges
- Non-admins with no team → **Enter team code** (`/join`) once
- Researchers manage join codes, invites, and removing viewers on the web

When `public.users.is_admin = true` (server flag; same gate as `/api/admin/*`):

- Same Explore-only chrome as everyone else
- Extra: **Analytics** link in the profile menu only (`/admin/analytics`)
- No Insights, deck, Studies, or creator tabs on native

Never trust a client-only “admin” toggle for privileged APIs — those routes already 404 unless `is_admin` is true in Postgres.

### Team join codes

Migration files (apply via MCP after review — not applied by the TestFlight workflow):

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261123130000_workspace_join_codes.sql` | `workspaces.join_code`, generate/redeem/regenerate RPCs, rate limit |
| `supabase/migrations/20261123130100_member_study_views.sql` | `member_study_views`, mark seen + unread study ids |

Creators copy/regenerate the code (and optionally email it) under **Workspace settings → Team join code** on web. Viewers redeem in the app at `/join`. Redeem adds them as role `member`. Long UUID invite links still work for web.

### New study indicators

Unread published studies (after the member joined) show a **New** chip on the feed filter and a count badge in the native viewer header. Viewing a study (filter or deep-linked reel) clears that study via `mark_study_seen`. Push/APNs is out of scope.

## 8. Payments on iOS (guideline 3.1.1)

The native iOS build **does not** show Stripe checkout, upgrade buttons, or portal CTAs. Plan screens show neutral copy: “Manage your plan on repofeed.ai” (no buy link). Existing subscribers keep access via the same Supabase/Stripe-backed plan checks. Web behavior is unchanged.

## 9. Account deletion (guideline 5.1.1(v))

Settings → **Delete account** → type `DELETE` → calls `POST /api/account/delete`, which deletes the Auth user (app rows cascade).

Apply the migration when ready (not applied by this PR):

```bash
# supabase/migrations/20261123120000_delete_own_account.sql
# adds public.delete_own_account() for optional RPC use
```

## 10. App Store metadata checklist

| Field | Suggested value |
| --- | --- |
| Privacy Policy URL | `https://repofeed.ai/privacy` |
| Support URL | `https://repofeed.ai/help` or `mailto:support@repofeed.ai` |
| Marketing URL | `https://repofeed.ai` |
| Category | Productivity / Business |
| Age rating | Complete questionnaire (research content; no user-generated public social by default) |

### Screenshots (required sizes)

Provide at least:

- **iPhone 6.7"** (e.g. 1290×2796) — 3–10 screens
- **iPhone 6.5"** if still prompted by ASC
- **iPad 13"** if you keep tablet support (this app targets iPhone + iPad)

Capture Feed (viewer), Join team code, Settings / delete account, and Sign-in. For admin TestFlight builds, also capture Studies and Analytics. Prefer real product UI, not marketing mockups alone.

### Privacy nutrition labels (based on current product)

Declare data the app / backend collect. Typical for repofeed:

| Data type | Linked to user? | Used for tracking? | Notes |
| --- | --- | --- | --- |
| Email address | Yes | No | Account / magic link |
| Name | Yes | No | Profile |
| Photos / Videos | Yes | No | Optional study footage uploads |
| User content | Yes | No | Studies, sources, comments |
| Product interaction | Yes | No | Analytics events in-product |
| Payment info | Yes | No | Collected by Stripe on **web** only; iOS does not collect card data |

Do **not** claim “Data Not Collected” if accounts and uploads exist. Adjust if you add advertising SDKs (today: none in the Capacitor shell).

### Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in Info.plist (HTTPS only). Answer the export compliance questions accordingly in App Store Connect.

## 11. Local Capacitor commands

```bash
pnpm build
npx cap sync ios
npx cap open ios   # optional, if you have Xcode
```

App ID / name live in `capacitor.config.ts` (`ai.repofeed.app`, `repofeed`). Icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset` (1024² from `public/icon/icon-512.png`). Launch screen uses the Splash imageset.

## 12. First App Store submission tips

1. Ship a TestFlight build that reviewers can sign into (provide demo account in Review Notes). Prefer a **viewer** demo account with a join code, plus note that admins see creator tools.
2. Review Notes should mention: subscriptions are managed on the website; in-app purchase is not offered; account deletion is under Settings; the app is primarily a research feed viewer.
3. If Google sign-in is enabled in the binary, Apple sign-in must be visible and working.
4. Do not merge this work until secrets and the ASC app record exist; the workflow will fail closed without them.
5. Do **not** push `ios-v*` tags from agents — trigger TestFlight builds yourself when ready.
