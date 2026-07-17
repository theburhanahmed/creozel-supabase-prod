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

export interface PostPerformance {
  id: string
  scheduled_post_id: string
  platform: SocialPlatform
  likes: number
  shares: number
  comments: number
  views: number
  reach: number
  clicks: number
  collected_at: string
  created_at: string
}

export interface ContentSuggestion {
  id: string
  team_id: string
  pipeline_id?: string
  content_job_id?: string
  scheduled_post_id?: string
  suggestion_type: string
  title: string
  description: string
  prompt_change?: string
  applied: boolean
  created_at: string
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

export interface DodoProduct {
  id: string
  product_id: string
  label: string
  credits: number
  price_display: string
  is_active: boolean
  is_popular: boolean
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

// ─── Advanced Content Generation Options ─────────────────────────────────────

export interface TextAdvancedOptions {
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo'
  tone: 'professional' | 'casual' | 'humorous' | 'persuasive' | 'informative'
  outputFormat: 'blog_post' | 'caption' | 'ad_copy' | 'thread' | 'email'
  wordCountMin: number   // 1–10000
  wordCountMax: number   // 1–10000, must be >= wordCountMin
  language: string
  brandVoiceEnabled: boolean
}

export interface ImageAdvancedOptions {
  provider: 'dall-e-3' | 'stable-diffusion'
  resolution: '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
  style: 'photorealistic' | 'illustration' | 'digital_art' | 'oil_painting' | 'watercolor'
  negativePrompt: string  // max 500 chars
  numImages: number       // 1–4
  seed: number            // 0–2147483647
}

export interface VideoAdvancedOptions {
  /** Vercel AI Gateway model identifier */
  model:
    | 'klingai/kling-v2.6-t2v'
    | 'klingai/kling-v3.0-t2v'
    | 'alibaba/wan-v2.6-t2v'
    | 'google/veo-3.1-generate-001'
    | 'xai/grok-imagine-video'
    | 'bytedance/seedance-v1.5-pro'
  duration: 5 | 8 | 10 | 15   // seconds
  aspectRatio: '16:9' | '9:16' | '1:1'
  /** Quality mode — std or pro (KlingAI only, ignored for other providers) */
  mode: 'std' | 'pro'
  /** Generate audio alongside the video (provider-dependent) */
  generateAudio: boolean
  /** Number of scenes (legacy ContentHub field) */
  sceneCount: number
  /** Duration per scene in seconds (legacy ContentHub field) */
  durationPerScene: number
  /** Include B-roll footage */
  includeBRoll: boolean
  /** Use team brand voice guidelines */
  brandVoiceEnabled: boolean
}

export interface AudioAdvancedOptions {
  provider: 'elevenlabs' | 'whisper'
  voiceId: string
  speakingRate: number    // 0.5–2.0
  pitchAdjustment: number // -10 to +10
  outputFormat: 'mp3' | 'wav'
  stabilityClarity: number // 0–100, ElevenLabs only
}

export const DEFAULT_TEXT_OPTIONS: TextAdvancedOptions = {
  model: 'gpt-4o',
  tone: 'professional',
  outputFormat: 'blog_post',
  wordCountMin: 300,
  wordCountMax: 800,
  language: 'en',
  brandVoiceEnabled: false,
}

export const DEFAULT_IMAGE_OPTIONS: ImageAdvancedOptions = {
  provider: 'dall-e-3',
  resolution: '1024x1024',
  style: 'photorealistic',
  negativePrompt: '',
  numImages: 1,
  seed: 0,
}

export const DEFAULT_VIDEO_OPTIONS: VideoAdvancedOptions = {
  model: 'klingai/kling-v2.6-t2v',
  duration: 5,
  aspectRatio: '16:9',
  mode: 'std',
  generateAudio: false,
  sceneCount: 3,
  durationPerScene: 5,
  includeBRoll: false,
  brandVoiceEnabled: false,
}

export const DEFAULT_AUDIO_OPTIONS: AudioAdvancedOptions = {
  provider: 'elevenlabs',
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  speakingRate: 1.0,
  pitchAdjustment: 0,
  outputFormat: 'mp3',
  stabilityClarity: 50,
}

export interface VoiceOption {
  voice_id: string
  name: string
}

// ─── Content Generation Studio Types ─────────────────────────────────────────

export type ContentCategory = 'text' | 'image' | 'video' | 'audio' | 'story'

// All Phase 1 snake_case format keys (72 keys)
export type ContentFormat =
  // text — short-form
  | 'tweet' | 'thread' | 'caption' | 'hook' | 'cta' | 'poll_text'
  | 'quote_post' | 'status_update' | 'community_post' | 'meme_text'
  | 'story_text_overlay' | 'product_announcement'
  // text — long-form
  | 'blog_post' | 'article' | 'newsletter' | 'seo_page' | 'landing_page_copy'
  | 'product_description' | 'whitepaper' | 'case_study' | 'tutorial'
  | 'guide' | 'press_release'
  // text — conversational
  | 'qa_post' | 'ama_content' | 'community_response'
  // image — static
  | 'single_image_post' | 'poster' | 'ai_art' | 'infographic'
  | 'motivational_graphic' | 'product_image' | 'branded_creative'
  | 'event_poster' | 'announcement_banner'
  // image — multi
  | 'carousel' | 'swipe_post' | 'before_after_set' | 'educational_slides' | 'lookbook'
  // image — advanced
  | 'ai_generated_image' | 'meme' | 'gif'
  // video — short-form
  | 'reel' | 'short' | 'tiktok_video' | 'vertical_video' | 'promo_video'
  | 'talking_head_video' | 'loop_video'
  // video — long-form
  | 'youtube_video' | 'tutorial_video' | 'product_demo'
  // video — AI
  | 'faceless_video' | 'voiceover_video' | 'subtitle_video'
  | 'ai_explainer_video' | 'repurposed_clip'
  // audio
  | 'podcast_episode' | 'voiceover' | 'tts_narration' | 'audio_blog'
  | 'voice_note' | 'audio_ad' | 'multilingual_dub'
  // story
  | 'story_single' | 'story_sequence' | 'poll_story' | 'quiz_story'
  | 'countdown_story' | 'link_story' | 'product_story'

export type StudioPlatform =
  | 'Instagram' | 'LinkedIn' | 'Twitter / X' | 'Facebook'
  | 'YouTube' | 'TikTok' | 'Blog' | 'Newsletter' | 'Podcast' | 'General'

export type StudioTone =
  | 'Professional' | 'Casual' | 'Humorous'
  | 'Inspirational' | 'Persuasive' | 'Informative'

export type StudioMode = 'create' | 'repurpose'

// ─── Platform Constraints ─────────────────────────────────────────────────────

export interface PlatformConstraints {
  characterLimit: number | null
  aspectRatio: string | null
  durationLimitSeconds: number | null
  fileSizeLimitMb: number | null
  acceptedFileFormats: string[]
}

// ─── Content Format Registry ──────────────────────────────────────────────────

export interface ContentFormatRegistryEntry {
  label: string
  description: string
  category: ContentCategory
  compatiblePlatforms: StudioPlatform[]
  constraints: Partial<Record<StudioPlatform, PlatformConstraints>>
}

// Keyed by ContentFormat — defined in src/constants/contentFormatRegistry.ts
export type ContentFormatRegistry = Record<ContentFormat, ContentFormatRegistryEntry>

// ─── Length Config ────────────────────────────────────────────────────────────

export type LengthPreset = 'short' | 'medium' | 'long' | 'custom'

export interface LengthConfig {
  preset: LengthPreset | null
  minWords: number | null
  maxWords: number | null
  durationSeconds: number | null
  quantity: number | null
  speakingRate: number | null
}

// ─── Studio Draft Config (localStorage shape) ─────────────────────────────────

export interface StudioDraftConfig {
  prompt: string
  contentCategory: ContentCategory
  contentFormat: ContentFormat
  platform: StudioPlatform
  tone: StudioTone
  length: LengthConfig
}

// ─── Studio Validation Errors ─────────────────────────────────────────────────

export interface StudioValidationErrors {
  prompt?: string
  contentFormat?: string
  platform?: string
  length?: string
  repurposingSource?: string
  repurposingTarget?: string
}

// ─── Content Format Metadata Schema (content_jobs.metadata shape) ─────────────

export interface ContentFormatMetadataSchema {
  contentCategory: ContentCategory
  contentFormat: ContentFormat
  platform: StudioPlatform
  tone: StudioTone
  length: LengthConfig
  advancedOptions: {
    model: string | null
    resolution: string | null
    style: string | null
    negativePrompt: string | null
    seed: number | null
    voice: string | null
    pitch: number | null
    stability: number | null
    outputFormat: string | null
    aspectRatio: string | null
    includeBRoll: boolean | null
    brandVoice: boolean | null
    language: string | null
  }
  platformConstraints: PlatformConstraints
  sourceJobId: string | null
  sourceMediaId: string | null
  repurposingInstructions: string | null
  schemaVersion: '1'
}

// ─── Studio Template ──────────────────────────────────────────────────────────

export interface StudioTemplate {
  id: string
  name: string
  description: string
  content_category: ContentCategory
  content_format: ContentFormat
  platform: StudioPlatform
  tone: StudioTone
  prompt_template: string
  advanced_options: ContentFormatMetadataSchema['advancedOptions']
  is_system: boolean
  team_id: string | null
  created_at: string
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface N8nConnection {
  node: string
  type: string
  index: number
}

export interface N8nNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, unknown>
}

export interface N8nWorkflow {
  name: string
  nodes: N8nNode[]
  connections: Record<string, { main: N8nConnection[][] }>
  settings: Record<string, unknown>
  tags?: string[]
  staticData?: Record<string, unknown> | null
}

export interface PipelineBuilderStep {
  id: string
  type: 'generate' | 'publish' | 'schedule'
  config: Record<string, unknown>
}

export interface PipelineConfig extends Omit<ContentFormatMetadataSchema,
  'sourceJobId' | 'sourceMediaId' | 'repurposingInstructions' | 'schemaVersion'> {
  /** Optional n8n-compatible workflow generated by the pipeline builder. */
  n8nWorkflow?: N8nWorkflow
  /** Optional builder steps that produced the n8n workflow. */
  builderSteps?: PipelineBuilderStep[]
  /** Optional fixed prompt template used by the pipeline. */
  promptTemplate?: string
  /** Optional platforms to publish to. */
  platforms?: SocialPlatform[]
}

export interface Pipeline {
  id: string
  team_id: string
  name: string
  description: string
  schedule: string | null          // cron expression or null
  config: PipelineConfig
  created_at: string
  updated_at: string
}

// ─── Repurposing ──────────────────────────────────────────────────────────────

export type RepurposingSourceType = 'job' | 'media'

export interface RepurposingSource {
  type: RepurposingSourceType
  id: string                       // job.id or media_item.id
  label: string                    // display name
  format: ContentFormat | null     // derived from job.metadata.contentFormat or media type
  previewUrl: string | null        // result_url or public_url
  promptExcerpt: string | null     // first 80 chars of job.prompt, null for media items
}
