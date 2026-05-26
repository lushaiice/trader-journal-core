# Traders' OS — Security Audit

_Last reviewed: 2026-05-13. Pre-launch hardening pass._

Traders' OS stores private financial journaling data. Every row is owned by
exactly one authenticated user and must never be visible to another. This
document records the access model and the defenses in place at each layer.

---

## 1. Access model

- **Single-tenant per user.** All domain tables carry a non-nullable
  `user_id uuid` populated from `auth.uid()` at insert time.
- **No public read paths** for any domain data. Only the marketing routes
  (`/`, `/login`) are reachable unauthenticated.
- **No service-role key in the client bundle.** `SUPABASE_SERVICE_ROLE_KEY`
  is only used in server-side helpers and is never imported by browser code.
- **Auth required for all `_app/*` routes.** `src/routes/_app.tsx`
  `beforeLoad` redirects to `/login` when no session is present.

## 2. Tables and RLS policies

All tables below have `ROW LEVEL SECURITY ENABLED` and four owner-scoped
policies (`select / insert / update / delete`) of the form
`auth.uid() = user_id` (or `auth.uid() = id` for `profiles`).

| Table | Owner column | RLS verified |
| --- | --- | --- |
| `profiles` | `id` | yes |
| `trades` | `user_id` | yes |
| `trade_exits` | `user_id` | yes |
| `discipline_logs` | `user_id` | yes |
| `daily_journals` | `user_id` | yes |
| `daily_reviews` | `user_id` | yes |
| `weekly_reviews` | `user_id` | yes |
| `checklist_responses` | `user_id` | yes |
| `process_quality_logs` | `user_id` | yes |
| `session_notes` | `user_id` | yes |
| `portfolios` | `user_id` | yes |
| `capital_events` | `user_id` | yes |

### Defense-in-depth (application layer)

`src/lib/safe-query.ts` exposes:

- `withOwner(fn)` — resolves the current user once and refuses to issue an
  owner-scoped query when no session is present (so a missing session
  surfaces as "please sign in" rather than a silent empty result).
- `assertOwnership(row, userId)` — sanity check before mutating or
  rendering a row, in case a misconfigured query ever returned a foreign
  record.

These do not replace RLS — they make intent explicit at every call site.

## 3. Storage — `trade-screenshots`

- Bucket: `trade-screenshots`, public read.
- Upload path convention: `${userId}/${timestamp}-${nonce}.${ext}`
  enforced by `uploadScreenshot` in `src/lib/trades/api.ts`.
- Access policy: per-user folder isolation — only the owning user can
  write/delete via the storage API.
- Public-read is intentional so cached images render instantly in the
  trade timeline; URLs are unguessable (timestamp + crypto-random nonce)
  and contain no PII. Switch to signed URLs if/when screenshots ever
  contain identifiable account information.

## 4. Allowed vs denied access — examples

**Allowed** — the signed-in user reading their own trades:

```ts
// session: user_a
await supabase.from("trades").select("*"); // returns user_a's rows only
```

**Denied** — attempting to read another user's trade by id:

```ts
await supabase.from("trades").select("*").eq("id", "<user_b trade>");
// returns [] (RLS filters it out)
```

**Denied** — anonymous mutation:

```ts
// no session
await supabase.from("daily_journals").insert({ ... });
// fails with "new row violates row-level security policy"
```

## 5. Secrets inventory

| Secret | Surface | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | client + server | publishable |
| `SUPABASE_PUBLISHABLE_KEY` | client + server | publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | never imported by browser |
| `LOVABLE_API_KEY` | server only | platform-managed |

## 6. Pre-launch security checklist

- [ ] RLS enabled on every domain table (verified above).
- [ ] Linter clean: `supabase--linter` returns zero findings.
- [ ] `auth.users` is never queried from the client; profile data lives in
      `public.profiles`.
- [ ] No `localStorage`-based admin/role checks anywhere in the codebase.
- [ ] Service-role key absent from `src/`, `public/`, and built bundles.
- [ ] Screenshot uploads stay inside the user's `${userId}/` prefix.
- [ ] Error boundaries never render a raw stack trace to the user.
- [ ] Observability redaction covers `amount`, `price`, `quantity`, `pnl`,
      `email`, and tokens (see `src/lib/observability.ts`).

## 7. Launch verification checklist

- [ ] Sign up two test accounts. Confirm account A cannot see any of
      account B's trades, journals, capital events, or screenshots.
- [ ] Delete a trade as account A; confirm account B is unaffected.
- [ ] Upload a screenshot as account A; confirm the URL works for A and
      cannot be overwritten by account B (storage 403).
- [ ] Sign out and confirm every `_app/*` route redirects to `/login`.
- [ ] Trigger a deliberate render error; confirm the calm fallback shows
      and no stack trace leaks to the DOM.
- [ ] Run the Vitest suite (`bunx vitest run`) — green.
- [ ] Optional: run Playwright E2E (`bunx playwright test`) with a seeded
      account to walk the trade / capital / reflection flows.
