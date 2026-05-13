-- Migration: Dodo Payments Integration
-- Creates dodo_products table, seeds default packs, adds RLS policies,
-- and extends credit_transactions and webhook_events with Dodo-specific columns.
-- Satisfies: REQ-2.1, REQ-2.2, REQ-2.6, REQ-2.7, REQ-8.1, REQ-8.2, REQ-8.3,
--            REQ-8.4, REQ-8.5, REQ-8.6, REQ-8.7

-- ─── dodo_products ───────────────────────────────────────────────────────────
create table public.dodo_products (
  id            uuid        default gen_random_uuid() primary key,
  product_id    text        unique not null,
  label         text        not null,
  credits       integer     not null check (credits > 0),
  price_display text        not null,
  is_active     boolean     not null default true,
  is_popular    boolean     not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.dodo_products is
  'Credit pack definitions linked to Dodo Payments product IDs. Managed by service role; readable by authenticated users.';

-- ─── seed default credit packs ───────────────────────────────────────────────
insert into public.dodo_products (product_id, label, credits, price_display, is_active, is_popular)
values
  ('prod_starter_100',  'Starter Pack',  100,  '$4.99',  true, false),
  ('prod_creator_500',  'Creator Pack',  500,  '$19.99', true, true),
  ('prod_pro_1500',     'Pro Pack',      1500, '$49.99', true, false);

-- ─── RLS: dodo_products ──────────────────────────────────────────────────────
-- REQ-2.6: authenticated users can SELECT active rows
-- REQ-2.7: INSERT/UPDATE/DELETE restricted to service-role only (no permissive policies for those ops)
alter table public.dodo_products enable row level security;

create policy "Authenticated users can view active products"
  on public.dodo_products for select
  to authenticated
  using (is_active = true);

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- Service role bypasses RLS by default in Supabase, so service-role callers
-- can still perform writes without an explicit policy.

-- ─── credit_transactions: add Dodo-specific columns ──────────────────────────
-- REQ-8.1: nullable dodo_payment_id; existing rows default to NULL
-- REQ-8.2: nullable dodo_product_id; existing rows default to NULL
alter table public.credit_transactions
  add column dodo_payment_id text,
  add column dodo_product_id text;

comment on column public.credit_transactions.dodo_payment_id is
  'Dodo Payments payment identifier for purchase/refund transactions. NULL for non-Dodo transactions.';

comment on column public.credit_transactions.dodo_product_id is
  'Dodo Payments product_id that was purchased. NULL for non-Dodo transactions.';

-- ─── webhook_events: add source and reference_id columns ─────────────────────
-- REQ-8.3: source column allows ''dodo_payments'' alongside existing social platform values
-- REQ-8.4: reference_id varchar(255) with UNIQUE constraint for idempotency
alter table public.webhook_events
  add column source       text,
  add column reference_id varchar(255);

comment on column public.webhook_events.source is
  'Origin of the webhook event, e.g. ''dodo_payments'' or a social platform name.';

comment on column public.webhook_events.reference_id is
  'Idempotency key for the webhook event (e.g. Dodo Payments webhook-id header). Max 255 chars.';

-- REQ-8.5, REQ-8.6: partial UNIQUE index — enforces uniqueness only for non-NULL reference_id,
-- and enables sub-10ms lookups at scale via index-only scan.
create unique index webhook_events_reference_id_idx
  on public.webhook_events (reference_id)
  where reference_id is not null;
