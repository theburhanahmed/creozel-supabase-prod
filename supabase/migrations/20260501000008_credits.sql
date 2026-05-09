-- Migration: Credits, Wallets, Billing

-- ─── wallets ─────────────────────────────────────────────────────────────────
create table public.wallets (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  team_id    uuid references public.teams(id) on delete cascade,
  balance    int not null default 0 check (balance >= 0),
  reserved   int not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  unique(user_id, team_id)
);

comment on table public.wallets is
  'Credit balances per user (and optionally per team). Balance cannot go below 0.';

create trigger wallets_updated_at
  before update on public.wallets
  for each row execute procedure public.set_updated_at();

-- ─── auto-create wallet on new profile ───────────────────────────────────────
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id, team_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- ─── credit_transactions ─────────────────────────────────────────────────────
create table public.credit_transactions (
  id           uuid default gen_random_uuid() primary key,
  wallet_id    uuid references public.wallets(id) on delete cascade not null,
  type         public.transaction_type not null,
  amount       int not null check (amount != 0),
  description  text,
  reference_id text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

comment on table public.credit_transactions is
  'Immutable ledger of all credit movements. Amount is positive for credits, negative for debits.';

create index credit_transactions_wallet_idx
  on public.credit_transactions (wallet_id, created_at desc);

-- ─── pricing_config ──────────────────────────────────────────────────────────
create table public.pricing_config (
  id           uuid default gen_random_uuid() primary key,
  content_type text unique not null,
  credits_cost int not null check (credits_cost > 0),
  is_active    bool not null default true,
  updated_at   timestamptz not null default now()
);

comment on table public.pricing_config is
  'Credit cost per AI generation type. Publicly readable; admin-managed.';

create trigger pricing_config_updated_at
  before update on public.pricing_config
  for each row execute procedure public.set_updated_at();

-- ─── subscriptions ───────────────────────────────────────────────────────────
create table public.subscriptions (
  id                       uuid default gen_random_uuid() primary key,
  user_id                  uuid references auth.users(id) on delete cascade not null,
  team_id                  uuid references public.teams(id) on delete cascade,
  plan                     public.subscription_plan not null default 'free',
  status                   text not null default 'active',
  stripe_subscription_id   text,
  razorpay_subscription_id text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.subscriptions is
  'Stripe/Razorpay subscription state. Updated by billing webhook Edge Functions.';

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
