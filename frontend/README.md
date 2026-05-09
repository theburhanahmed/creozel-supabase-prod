# Creozel Frontend

React 18 + TypeScript + Vite frontend for the Creozel platform.
Wired to the self-hosted Supabase stack in the repo root.

## Quick Start

### 1. Start the backend (from repo root)
```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker-compose up -d
```

### 2. Configure the frontend
```bash
cd frontend
cp .env.example .env
# Set VITE_SUPABASE_ANON_KEY to the ANON_KEY value from your root .env
```

### 3. Install and run
```bash
npm install
npm run dev
# → http://localhost:5173
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Kong gateway URL | `http://localhost:8000` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key from root `.env` | `eyJ...` |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (optional) | `pk_test_...` |

## Architecture

```
src/
├── App.tsx                  # Router + AppProvider shell
├── index.tsx                # React 18 createRoot entry
├── index.css                # Tailwind + custom utilities
├── lib/
│   ├── supabase.ts          # Single Supabase client instance
│   └── utils.ts             # cn(), debounce(), formatDate()...
├── types/index.ts           # All shared TypeScript types
├── context/
│   └── AppContext.tsx       # Auth state + UI state (dark mode, menus)
├── services/
│   └── authService.ts       # Login, register, logout via GoTrue
├── components/
│   └── auth/                # AuthGuard, LoginForm, RegisterForm
└── pages/
    ├── Dashboard.tsx        # Main dashboard (real auth, stub data)
    ├── auth/                # Login + Register pages
    └── ...                  # All other pages (stubs → port from MagicPatterns)
```

## Porting MagicPatterns Components

The design at https://www.magicpatterns.com/c/vgyrdcyrepazwgiptpjypg has 150+ files.
Port them page by page, replacing the stubs in `src/pages/_stubs.tsx`.

**Key wiring changes needed for each component:**
1. Remove `mockData` imports → replace with `supabase` queries
2. Remove `setTimeout` simulations → use real `useEffect` + Supabase
3. `AuthGuard` already uses real session — no changes needed
4. `AppContext` user comes from live GoTrue session

## Database

Schema is in `volumes/db/init/data.sql` — applied automatically on first
`docker-compose up`. Includes all 15+ tables with RLS policies.
