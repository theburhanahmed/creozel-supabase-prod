-- Migration: Enums
-- All PostgreSQL enum types used across the Creozel schema

-- Team roles
create type public.team_role as enum ('owner', 'admin', 'editor', 'viewer');

-- Content generation types
create type public.content_type as enum ('text', 'image', 'video', 'audio');

-- Job / pipeline execution status
create type public.job_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Scheduled post status
create type public.post_status as enum ('draft', 'scheduled', 'published', 'failed');

-- Social platforms
create type public.social_platform as enum (
  'instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'tiktok'
);

-- Pipeline execution status (mirrors job_status but kept separate for clarity)
create type public.pipeline_status as enum ('pending', 'running', 'completed', 'failed');

-- Media item types
create type public.media_type as enum ('image', 'video', 'audio', 'document');

-- Credit transaction types
create type public.transaction_type as enum ('purchase', 'deduction', 'refund', 'bonus');

-- Subscription plans
create type public.subscription_plan as enum ('free', 'starter', 'pro', 'agency');

-- Affiliate payout status
create type public.affiliate_status as enum ('pending', 'paid');
