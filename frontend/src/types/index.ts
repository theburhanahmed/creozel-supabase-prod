// Core type definitions for the Creozel application
// Field names match the PostgreSQL schema (snake_case)

// ─── Auth / User ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string
  bio?: string
  phone?: string
  timezone: string
  notification_preferences: NotificationPreferences
  onboarding_completed: boolean
  referral_code?: string
  credits: number
  isAuthenticated: boolean
  // Derived from team_members role for the active team
  role?: TeamRole
}

export interface NotificationPreferences {
  email_on_post_failure?: boolean
  email_on_low_credits?: boolean
  email_on_job_complete?: boolean
  in_app_all?: boolean
}

export interface BrandProfile {
  id: string
  user_id: string
  brand_name?: string
  logo_url?: string
  voice_guidelines?: string
  tone_settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Auth credentials (frontend forms) ───────────────────────────────────────

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  confirmPassword?: string
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Team {
  id: string
  name: string
  logo_url?: string
  owner_id: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  joined_at: string
  // Joined from profiles
  user?: Pick<User, 'id' | 'display_name' | 'email' | 'avatar_url'>
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: TeamRole
  token: string
  invited_by?: string
  expires_at: string
  accepted_at?: string
  created_at: string
}

// ─── Content Generation ──────────────────────────────────────────────────────

export type ContentType = 'text' | 'image' | 'video' | 'audio'
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ContentJob {
  id: string
  user_id: string
  team_id?: string
  type: ContentType
  status: JobStatus
  prompt: string
  result_url?: string
  credits_reserved: number
  credits_used: number
  error_message?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Social / Publishing ─────────────────────────────────────────────────────

export type SocialPlatform =
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface SocialConnection {
  id: string
  user_id: string
  team_id?: string
  platform: SocialPlatform
  account_name: string
  account_id: string
  token_expires_at?: string
  is_active: boolean
  created_at: string
}

export interface ScheduledPost {
  id: string
  user_id: string
  team_id?: string
  content: string
  platform: SocialPlatform
  scheduled_at: string
  status: PostStatus
  media_urls: string[]
  error_message?: string
  social_connection_id?: string
  created_at: string
  updated_at: string
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface PipelineExecution {
  id: string
  team_id?: string
  pipeline_name: string
  status: PipelineStatus
  started_at?: string
  completed_at?: string
  error_message?: string
  step_failed?: string
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Media Library ───────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video' | 'audio' | 'document'

export interface MediaItem {
  id: string
  user_id: string
  team_id?: string
  name: string
  type: MediaType
  size_bytes: number
  storage_path: string
  public_url?: string
  thumbnail_url?: string
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Credits & Billing ───────────────────────────────────────────────────────

export type TransactionType = 'purchase' | 'deduction' | 'refund' | 'bonus'
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'agency'

export interface Wallet {
  id: string
  user_id: string
  team_id?: string
  balance: number
  reserved: number
  updated_at: string
}

export interface CreditTransaction {
  id: string
  wallet_id: string
  type: TransactionType
  amount: number
  description?: string
  reference_id?: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface PricingConfig {
  id: string
  content_type: ContentType
  credits_cost: number
  is_active: boolean
}

export interface Subscription {
  id: string
  user_id: string
  team_id?: string
  plan: SubscriptionPlan
  status: string
  stripe_subscription_id?: string
  razorpay_subscription_id?: string
  current_period_start?: string
  current_period_end?: string
  created_at: string
  updated_at: string
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body?: string
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string
  user_id: string
  team_id?: string
  event_type: string
  properties: Record<string, unknown>
  created_at: string
}

export interface AnalyticsOverview {
  team_id: string
  team_name: string
  total_posts: number
  published_posts: number
  scheduled_posts: number
  draft_posts: number
  failed_posts: number
  total_credits_used: number
  total_jobs: number
  completed_jobs: number
  active_pipelines: number
  total_pipeline_runs: number
  pipeline_success_rate: number
  connected_accounts: number
}

// ─── Affiliate ───────────────────────────────────────────────────────────────

export type AffiliateStatus = 'pending' | 'paid'

export interface ReferralEvent {
  id: string
  referrer_user_id: string
  referred_email: string
  clicked_at: string
  converted_at?: string
  conversion_value: number
}

export interface AffiliateEarning {
  id: string
  user_id: string
  amount: number
  status: AffiliateStatus
  period_start?: string
  period_end?: string
  created_at: string
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
}
