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
2. **Generate** a key with **App Manager** (or Admin) access.
3. Download the `.p8` once. Note:
   - **Key ID**
   - **Issuer ID** (top of the page)
4. Store the `.p8` securely. You will add it to GitHub as a secret (raw PEM or base64).

## 3. GitHub repository secrets

Settings → Secrets and variables → Actions. Add:

| Secret | Purpose |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8` | Full `.p8` PEM **or** base64 of the file |
| `APPLE_TEAM_ID` | 10-character Team ID (Membership details) |
| `VITE_SUPABASE_URL` | Same as production web |
| `VITE_SUPABASE_ANON_KEY` | Same as production web |
| `VITE_SITE_URL` | `https://repofeed.ai` |
| `VITE_ENABLE_GOOGLE_AUTH` | `true` only if Google is live in Supabase |
| `VITE_ENABLE_APPLE_AUTH` | `true` only after Apple provider is configured |

The workflow is `.github/workflows/ios-testflight.yml`. It builds with Vite, runs `npx cap sync ios`, archives with **automatic signing** (App Store Connect API key passed to `xcodebuild` via `-authenticationKeyPath` / `-authenticationKeyID` / `-authenticationKeyIssuerID` — no local certs/profiles required), and uploads to TestFlight. Build number = `max(latest TestFlight + 1, github.run_number)`.

## 4. Run a TestFlight build

1. Actions → **iOS TestFlight** → **Run workflow** (or push a tag `ios-v1.0.0`).
2. First run: Xcode automatic signing creates a distribution profile for `ai.repofeed.app` using the API key + team.
3. When the job succeeds, open App Store Connect → TestFlight. Wait for processing, then add internal/external testers.
4. IPA is also uploaded as a workflow artifact (`repofeed-ipa`) for debugging.

Local equivalent (on a Mac with Xcode):

```bash
pnpm build && npx cap sync ios
# then open ios/App/App.xcworkspace, or:
IOS_BUILD_NUMBER=42 \
APP_STORE_CONNECT_KEY_ID=… \
APP_STORE_CONNECT_ISSUER_ID=… \
APP_STORE_CONNECT_API_KEY_PATH=/path/to/AuthKey.p8 \
APPLE_TEAM_ID=… \
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

## 7. Payments on iOS (guideline 3.1.1)

The native iOS build **does not** show Stripe checkout, upgrade buttons, or portal CTAs. Plan screens show neutral copy: “Manage your plan on repofeed.ai” (no buy link). Existing subscribers keep access via the same Supabase/Stripe-backed plan checks. Web behavior is unchanged.

## 8. Account deletion (guideline 5.1.1(v))

Settings → **Delete account** → type `DELETE` → calls `POST /api/account/delete`, which deletes the Auth user (app rows cascade).

Apply the migration when ready (not applied by this PR):

```bash
# supabase/migrations/20261123120000_delete_own_account.sql
# adds public.delete_own_account() for optional RPC use
```

## 9. App Store metadata checklist

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

Capture Feed, Studies, Insights, and Sign-in. Prefer real product UI, not marketing mockups alone.

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

## 10. Local Capacitor commands

```bash
pnpm build
npx cap sync ios
npx cap open ios   # optional, if you have Xcode
```

App ID / name live in `capacitor.config.ts` (`ai.repofeed.app`, `repofeed`). Icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset` (1024² from `public/icon/icon-512.png`). Launch screen uses the Splash imageset.

## 11. First App Store submission tips

1. Ship a TestFlight build that reviewers can sign into (provide demo account in Review Notes).
2. Review Notes should mention: subscriptions are managed on the website; in-app purchase is not offered; account deletion is under Settings.
3. If Google sign-in is enabled in the binary, Apple sign-in must be visible and working.
4. Do not merge this work until secrets and the ASC app record exist; the workflow will fail closed without them.
