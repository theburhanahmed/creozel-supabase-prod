-- Migration: Affiliate Program

-- ─── referral_events ─────────────────────────────────────────────────────────
create table public.referral_events (
  id                uuid default gen_random_uuid() primary key,
  referrer_user_id  uuid references auth.users(id) on delete cascade not null,
  referred_email    text not null,
  clicked_at        timestamptz not null default now(),
  converted_at      timestamptz,
  conversion_value  int not null default 0 check (conversion_value >= 0)
);

comment on table public.referral_events is
  'Tracks referral link clicks and conversions for the affiliate program.';

create index referral_events_referrer_idx
  on public.referral_events (referrer_user_id, clicked_at desc);

-- ─── affiliate_earnings ──────────────────────────────────────────────────────
create table public.affiliate_earnings (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  amount       int not null default 0 check (amount >= 0),
  status       public.affiliate_status not null default 'pending',
  period_start timestamptz,
  period_end   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.affiliate_earnings is
  'Affiliate payout ledger. Processed on a monthly schedule.';

create index affiliate_earnings_user_idx
  on public.affiliate_earnings (user_id, created_at desc);
