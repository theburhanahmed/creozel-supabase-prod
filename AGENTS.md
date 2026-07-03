# Agent Notes

## Frontend Verification

The frontend uses Vite + React + TypeScript. Run these commands from `frontend/`:

- `npm run type-check` — TypeScript check (`tsc --noEmit`)
- `npm run lint` — ESLint with zero warnings allowed
- `npm test` — Vitest property-based tests
- `npm run build` — Production build (`tsc && vite build`)

## Test Environment

Tests require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. A `.env.test` file is committed with safe dummy values, and `vite.config.ts` loads env files for the current mode. This lets tests run without a real `.env` file.

## Edge Functions

New functions are auto-discovered in `supabase/functions/<name>/index.ts`. Deploy with:

```bash
supabase functions deploy <name>
```

## Database Migrations

Apply migrations with:

```bash
supabase db push
```

The production stabilization migration is `supabase/migrations/20260703000003_production_stabilization.sql`.
