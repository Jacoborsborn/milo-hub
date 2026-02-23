# iOS Safari / in-app browser redirect audit

## Summary

Auto-redirects on page load were removed from landing and auth entry routes so the app is safe for iOS Safari, Instagram/Facebook in-app browsers, and ad traffic.

## Redirects found and classification

### ❌ Auto-redirect on load (REMOVED)

| Location | Before | After |
|----------|--------|--------|
| **src/app/pt/auth/login/page.tsx** | Server component: `getUser()` then `redirect(...)` to /signup, /pt/login, /pt/app/tutorial, or /pt/app/billing. No UI. | Renders login form only. No auth check on server. Navigation only after user submits form (API returns redirect). |
| **src/app/auth/signup/page.tsx** | Server component: immediate `redirect(query ? \`/signup?${query}\` : "/signup")`. No UI. | Renders same signup content as /signup. Query params stay in URL; SignupWizard reads them. No redirect. |
| **src/middleware.ts** (for /pt/auth/login) | Matcher included `/pt/auth/login`. Middleware ran `updateSession` + `getUser()` (cookies/session) on every request to that route. | Removed `/pt/auth/login` from matcher. Middleware now only runs for `/pt/app/*`. /pt/auth/login is never touched by middleware. |

### ⚠️ Conditional redirect (unchanged — not on landing)

- **src/app/pt/app/page.tsx** – redirect when unauthed. Route is `/pt/app` (protected); middleware already sends unauthed users to /pt/auth/login. Kept.
- **src/app/pt/app/tutorial/page.tsx**, **profile**, **templates**, etc. – auth redirects on app routes. Not landing. Kept.
- **src/app/pt/auth/login** (middleware) – previously redirected /pt/app → /pt/auth/login. Still does; only the matcher was changed so /pt/auth/login itself is not run through middleware.

### ✅ User-initiated navigation (KEEP)

- **src/app/pt/login/page.tsx** – `router.push` only after form submit. Kept.
- **SignupWizard** – `window.location.href` only after Stripe checkout success. Kept.
- All other `router.push` / `redirect` in app are after user action or on protected routes. Kept.

## Files changed

| File | Change |
|------|--------|
| **src/middleware.ts** | Removed `/pt/auth/login` from matcher. Only `/pt/app/:path*` is matched now. |
| **src/app/pt/auth/login/page.tsx** | Replaced redirect-only server component with static render of login form (`PtLoginForm`). No `getUser()`, no `redirect()`. |
| **src/app/auth/signup/page.tsx** | Replaced redirect to /signup with rendering `SignupPageContent` (same as /signup). No `redirect()`. |
| **src/app/pt/login/page.tsx** | Now uses shared `PtLoginForm` from `@/components/pt/PtLoginForm`. |
| **src/components/pt/PtLoginForm.tsx** | **New.** Extracted login form + fallback for use at /pt/login and /pt/auth/login. |
| **src/components/signup/SignupPageContent.tsx** | **New.** Extracted signup layout + wizard for use at /signup and /auth/signup. |
| **src/app/signup/page.tsx** | Now uses `SignupPageContent`. |

## Landing routes — final state

| Route | Auth/session on load? | Auto-redirect? | Safe for iOS/ads? |
|-------|------------------------|----------------|-------------------|
| **/** (marketing) | No | No | ✅ |
| **/pt-hub** | No | No | ✅ |
| **/signup** | No | No | ✅ |
| **/auth/signup** | No | No | ✅ (now renders content) |
| **/pt/login** | No | No | ✅ |
| **/pt/auth/login** | No (middleware no longer runs) | No | ✅ (now renders form) |
| **/pt-hub/success** | No | No | ✅ |

## Confirmation

- **No automatic redirects remain on landing routes.** Navigation from /, /pt-hub, /signup, /auth/signup, /pt/login, and /pt/auth/login happens only on user click (e.g. submit login, start trial, open link).
- **Landing and auth entry pages do not read Supabase auth/session on first render.** /pt/auth/login is no longer in middleware and does not call `getUser()`. /signup and /auth/signup do not call auth.
- **No device-based redirects** were present or added.
- **Rendering is not blocked** by auth checks on these routes.
