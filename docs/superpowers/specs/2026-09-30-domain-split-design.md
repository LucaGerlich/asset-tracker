# Domain Split (Marketing vs App) — Design Spec

- **Date:** 2026-09-30
- **Status:** Draft, awaiting review
- **Depends on:** `2026-09-30-marketing-redesign-design.md`. It is implemented afterwards, but the two are technically independent.
- **Domain:** not bought yet. Everything is driven by env vars, and the feature is **off by default**.

## 1. Goal

Serve the marketing site at `https://<domain>` and the application at `https://app.<domain>` from the **same Next.js codebase and deployment**, with host-based routing in `src/proxy.ts`.

### Success criteria

- When `NEXT_PUBLIC_MARKETING_URL` is unset, behavior is byte-for-byte what it is today (self-hosted installs and the current Vercel deploy are unaffected).
- When it is set:
  - the marketing host serves only marketing routes;
  - every other path gets a 308 redirect to the same path and query on the app host;
  - marketing paths on the app host redirect to the marketing host;
  - `app.<domain>/` goes to `/dashboard` or `/login`;
  - the app host is not indexed (`robots.txt` → `Disallow: /`); canonicals, sitemap and OG point to the marketing host.
- Session cookies are never sent to or readable by the marketing host.

## 2. Configuration

| Env var                                     | Example                   | Meaning                                                       |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `BETTER_AUTH_URL` (existing)                | `https://app.example.com` | App origin: auth callbacks, emails, QR codes (unchanged role) |
| `NEXT_PUBLIC_MARKETING_URL` (new, optional) | `https://example.com`     | Marketing origin. **Unset = split disabled**                  |

- Add to `.env.example` with a comment.
- New helper in `src/lib/url.ts`: `getMarketingUrl(): string` returns `NEXT_PUBLIC_MARKETING_URL`, falling back to `getBaseUrl()`.
- Validate at startup: if set, both values must be valid absolute `https:` URLs in production (`http:` allowed in dev), and the two origins must differ. An invalid config throws. It fails fast and is never silently ignored.

## 3. Routing

### Pure function (unit-tested first, TDD)

`src/lib/host-routing.ts`:

```ts
type HostRoute =
  { kind: "pass" } | { kind: "redirect"; url: string; status: 308 };

export function resolveHostRoute(input: {
  host: string; // request Host header (lowercased, port kept)
  pathname: string;
  search: string;
  marketingOrigin: string | null; // null = split disabled
  appOrigin: string;
}): HostRoute;
```

Rules (evaluated in order):

1. `marketingOrigin === null` → `pass`.
2. **Always pass on both hosts:** `/_next/*`, `/favicon*`, `/icons/*`, static file extensions (the same set as the current matcher), `/api/health`.
3. **Request on the marketing host:**
   - pathname ∈ `MARKETING_PATHS` (`/`, `/pricing`, `/terms`, `/privacy`, `/opengraph-image`, `/sitemap.xml`, `/robots.txt`) → `pass`;
   - anything else (including `/api/*`, `/login`, `/dashboard`) → redirect to `appOrigin + pathname + search`.
4. **Request on the app host:**
   - pathname ∈ `{ /pricing, /terms, /privacy }` → redirect to `marketingOrigin + pathname + search`;
   - `/sitemap.xml` → redirect to the marketing sitemap;
   - everything else → `pass` (including `/`, which the existing page logic sends to `/dashboard` or `/login`, see §4).
5. **Unknown host** (e.g. a preview URL `*.vercel.app`) → `pass`. Preview deploys keep working as a single host.

### Integration in `proxy.ts`

- Called first in `proxy()`, before rate limiting and auth checks. A redirect result is returned via the existing `withHeaders()` so it keeps CSP and correlation headers.
- `POST` to a non-marketing path on the marketing host also gets a 308, which preserves the method and body. In practice nothing posts there because the forms live on the app host.

## 4. Page behavior changes

- `src/app/(marketing)/page.tsx` (`/`):
  - on the **app host** (split enabled), `redirect('/dashboard')` if a session exists, else `redirect('/login')`; the landing page never renders on the app host;
  - on the **marketing host**, render the landing page without a session lookup. There is no cookie there anyway, which saves an auth call per visit;
  - with the split disabled, unchanged.
- **Marketing CTAs:** "Sign in" → `${appOrigin}/login`, "Start free" → `${appOrigin}/register`. A `appHref(path)` helper returns a relative path when the split is disabled.
- `robots.ts`: on the app host with the split enabled, `Disallow: /`; otherwise unchanged. It reads the host via `headers()`.
- `seo.ts`, `sitemap.ts` and `opengraph-image` use `getMarketingUrl()` for canonical URLs.

## 5. Auth & security

- **No `crossSubDomainCookies`:** the BetterAuth session cookie stays host-only on `app.<domain>`, so the marketing host never receives it. An XSS or compromised dependency on the marketing site cannot touch sessions.
- BetterAuth `trustedOrigins` stays app-only; the marketing site never calls the auth API.
- CSP is unchanged. It already applies per response on both hosts.
- The open-redirect check: redirect targets are built only from the configured origins, never from the request `Host` or query params.

## 6. Local development

- `http://localhost:3000` is marketing and `http://app.localhost:3000` is the app. Browsers resolve `*.localhost` to loopback natively, so no `/etc/hosts` edits are needed.
- `.env.local` example:
  ```
  NEXT_PUBLIC_MARKETING_URL=http://localhost:3000
  BETTER_AUTH_URL=http://app.localhost:3000
  ```
- Document this in `docs/DEVELOPER_GUIDE.md`.

## 7. Testing

1. **Unit (Vitest, written first):** `host-routing.test.ts` is a table-driven test over every rule in §3: split disabled, static assets on both hosts, each marketing path on each host, `/login` on the marketing host with query string preserved, unknown host, host with port, and uppercase host.
2. **Unit:** env validation (same origins, non-https in prod, malformed URL).
3. **E2E (Playwright):** a project run with split env vars against `localhost` / `app.localhost`:
   - `localhost:3000/login` → 308 → `app.localhost:3000/login`;
   - `app.localhost:3000/pricing` → marketing host;
   - `app.localhost:3000/robots.txt` contains `Disallow: /`;
   - landing "Sign in" href points to the app host.
4. Confirm the existing E2E suite passes with the split **disabled** (regression).

## 8. Rollout (parked until the domain is bought)

1. Buy the domain; add apex + `app.` to the Vercel project (same project).
2. Set `BETTER_AUTH_URL=https://app.<domain>` and `NEXT_PUBLIC_MARKETING_URL=https://<domain>` in Vercel production.
3. Update OAuth/SSO redirect URIs at the identity providers (Microsoft, Google, OIDC/SAML customers) and the Stripe webhook URL to the app host.
4. Redirect any old domain to the new one (Vercel domain redirect).
5. Search Console: add the new property and submit the sitemap.

## 9. Out of scope

- Separate deployments or a monorepo (explicitly rejected: one app with host routing was chosen).
- Cross-subdomain SSO/session sharing.
- Localized domains.
