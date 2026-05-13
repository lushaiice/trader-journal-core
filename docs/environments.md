# Environments

Trader OS uses three environments. Keep them simple and explicit.

| Env | URL | Backend | Purpose |
|-----|-----|---------|---------|
| **development** | `http://localhost:5173` | Lovable Cloud (shared dev) | Local iteration |
| **staging** | `project--<id>-dev.lovable.app` | Staging Supabase project | Pre-release verification, E2E target |
| **production** | `tradersos.lovable.app` | Production Supabase project | Live users |

## Environment variables

See `.env.example` for the full list. Categories:

- **Public client** (`VITE_*`) — bundled into the browser at build time.
- **Server-only** — read inside server functions via `process.env.*`.
  Never reference these from client code.
- **Secrets** — `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, etc.
  Managed via Lovable Cloud → Connectors → Secrets. Never commit.

## Promoting a change

```
local edit → PR (CI: lint + typecheck + vitest + build + playwright)
          → merge to main → preview deploy (staging-like)
          → publish in Lovable → production
```

## Staging Supabase project

Use a separate Supabase project for staging. RLS, schema, and storage
buckets must mirror production. Apply migrations to staging first; only
promote to production after the E2E suite passes against staging.

## E2E test user

Create one deterministic user per non-prod environment:

```
email:    e2e@traderos.test
password: (set via E2E_PASSWORD secret)
```

Seed it once, then let `e2e/fixtures/auth.ts` reuse the same session
across runs. The test cleanup helpers remove only data created during
the spec — they never touch user records.
