-- Migration: Seed Data
-- Default pricing configuration for AI content generation.

insert into public.pricing_config (content_type, credits_cost, is_active) values
  ('text',  5,  true),
  ('image', 10, true),
  ('video', 20, true),
  ('audio', 8,  true)
on conflict (content_type) do update
  set credits_cost = excluded.credits_cost,
      is_active    = excluded.is_active,
      updated_at   = now();
