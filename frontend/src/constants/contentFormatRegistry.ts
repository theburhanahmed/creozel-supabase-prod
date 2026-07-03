import {
  ContentCategory,
  ContentFormat,
  ContentFormatRegistry,
  StudioPlatform,
  StudioTone,
} from '../types'

// ─── Text Format Entries ──────────────────────────────────────────────────────
// 26 text formats: 12 short-form, 11 long-form, 3 conversational
// Constraints are intentionally empty here — they are populated in task 3.5.

export const CONTENT_FORMAT_REGISTRY: ContentFormatRegistry = {

  // ── Short-form (12) ──────────────────────────────────────────────────────

  tweet: {
    label: 'Tweet',
    description: 'Short Twitter/X post, up to 280 characters',
    category: 'text',
    compatiblePlatforms: ['Twitter / X', 'General'] as StudioPlatform[],
    constraints: {
      'Twitter / X': {
        characterLimit: 280,
        aspectRatio: null,
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['text'],
      },
    },
  },

  thread: {
    label: 'Thread',
    description: 'Multi-tweet Twitter/X thread for longer narratives',
    category: 'text',
    compatiblePlatforms: ['Twitter / X', 'General'] as StudioPlatform[],
    constraints: {
      'Twitter / X': {
        characterLimit: 280,
        aspectRatio: null,
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['text'],
      },
    },
  },

  caption: {
    label: 'Caption',
    description: 'Social media caption to accompany an image or video post',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {
      'Instagram': {
        characterLimit: 2200,
        aspectRatio: '1:1 or 4:5',
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['text'],
      },
      'LinkedIn': {
        characterLimit: 3000,
        aspectRatio: null,
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['text'],
      },
    },
  },

  hook: {
    label: 'Hook',
    description: 'Attention-grabbing opening line or short copy to stop the scroll',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  cta: {
    label: 'Call to Action',
    description: 'Persuasive call-to-action copy that drives a specific user action',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Twitter / X', 'Facebook', 'Blog', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  poll_text: {
    label: 'Poll Text',
    description: 'Question and answer options for a social media poll',
    category: 'text',
    compatiblePlatforms: ['Twitter / X', 'LinkedIn', 'Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  quote_post: {
    label: 'Quote Post',
    description: 'Shareable quote formatted for social media',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  status_update: {
    label: 'Status Update',
    description: 'Brief personal or brand status update for social feeds',
    category: 'text',
    compatiblePlatforms: ['Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  community_post: {
    label: 'Community Post',
    description: 'Post designed for community groups, forums, or subreddits',
    category: 'text',
    compatiblePlatforms: ['Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  meme_text: {
    label: 'Meme Text',
    description: 'Humorous top/bottom text copy for meme images',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  story_text_overlay: {
    label: 'Story Text Overlay',
    description: 'Short text overlay copy for Instagram or Facebook Stories',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  product_announcement: {
    label: 'Product Announcement',
    description: 'Short-form copy announcing a new product, feature, or launch',
    category: 'text',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Twitter / X', 'Facebook', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Long-form (11) ───────────────────────────────────────────────────────

  blog_post: {
    label: 'Blog Post',
    description: 'Long-form blog article with structured sections and SEO-friendly formatting',
    category: 'text',
    compatiblePlatforms: ['Blog', 'General'] as StudioPlatform[],
    constraints: {},
  },

  article: {
    label: 'Article',
    description: 'In-depth editorial or journalistic article on a specific topic',
    category: 'text',
    compatiblePlatforms: ['Blog', 'LinkedIn', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  newsletter: {
    label: 'Newsletter',
    description: 'Email newsletter with curated content, updates, and insights',
    category: 'text',
    compatiblePlatforms: ['Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  seo_page: {
    label: 'SEO Page',
    description: 'Search-engine-optimised landing or content page targeting specific keywords',
    category: 'text',
    compatiblePlatforms: ['Blog', 'General'] as StudioPlatform[],
    constraints: {},
  },

  landing_page_copy: {
    label: 'Landing Page Copy',
    description: 'Conversion-focused copy for a marketing or product landing page',
    category: 'text',
    compatiblePlatforms: ['Blog', 'General'] as StudioPlatform[],
    constraints: {},
  },

  product_description: {
    label: 'Product Description',
    description: 'Compelling product description for e-commerce or marketing pages',
    category: 'text',
    compatiblePlatforms: ['Blog', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  whitepaper: {
    label: 'Whitepaper',
    description: 'Authoritative long-form document presenting research, analysis, or a solution',
    category: 'text',
    compatiblePlatforms: ['LinkedIn', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  case_study: {
    label: 'Case Study',
    description: 'Detailed narrative of a customer success story or project outcome',
    category: 'text',
    compatiblePlatforms: ['Blog', 'LinkedIn', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  tutorial: {
    label: 'Tutorial',
    description: 'Step-by-step instructional content teaching a skill or process',
    category: 'text',
    compatiblePlatforms: ['Blog', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  guide: {
    label: 'Guide',
    description: 'Comprehensive reference guide covering a topic in depth',
    category: 'text',
    compatiblePlatforms: ['Blog', 'Newsletter', 'General'] as StudioPlatform[],
    constraints: {},
  },

  press_release: {
    label: 'Press Release',
    description: 'Official press release announcing news, events, or milestones',
    category: 'text',
    compatiblePlatforms: ['Newsletter', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Conversational (3) ───────────────────────────────────────────────────

  qa_post: {
    label: 'Q&A Post',
    description: 'Question-and-answer format post for social media or community platforms',
    category: 'text',
    compatiblePlatforms: ['LinkedIn', 'Facebook', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  ama_content: {
    label: 'AMA Content',
    description: '"Ask Me Anything" session content with questions and detailed answers',
    category: 'text',
    compatiblePlatforms: ['LinkedIn', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  community_response: {
    label: 'Community Response',
    description: 'Thoughtful reply or response to a community question or discussion thread',
    category: 'text',
    compatiblePlatforms: ['LinkedIn', 'Facebook', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Placeholder entries for non-text formats (tasks 3.2–3.4) ─────────────
  // These are required to satisfy the Record<ContentFormat, ...> type.
  // They will be replaced with full entries in subsequent tasks.

  // ── Image — Static (9) ──────────────────────────────────────────────────────

  single_image_post: {
    label: 'Single Image Post',
    description: 'Standalone image post optimised for social media feeds',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {
      'Instagram': {
        characterLimit: null,
        aspectRatio: '1:1 or 4:5',
        durationLimitSeconds: null,
        fileSizeLimitMb: 8,
        acceptedFileFormats: ['JPEG', 'PNG'],
      },
    },
  },

  poster: {
    label: 'Poster',
    description: 'High-impact visual poster for promotions, campaigns, or announcements',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  ai_art: {
    label: 'AI Art',
    description: 'AI-generated artistic image for creative or decorative use',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  infographic: {
    label: 'Infographic',
    description: 'Data-driven visual that presents information, statistics, or processes clearly',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Facebook', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  motivational_graphic: {
    label: 'Motivational Graphic',
    description: 'Inspirational quote or message overlaid on a visually engaging background',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  product_image: {
    label: 'Product Image',
    description: 'Clean, professional image showcasing a product for marketing or e-commerce',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  branded_creative: {
    label: 'Branded Creative',
    description: 'On-brand visual asset incorporating brand colours, fonts, and identity elements',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  event_poster: {
    label: 'Event Poster',
    description: 'Promotional poster for an upcoming event with key details and visual appeal',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  announcement_banner: {
    label: 'Announcement Banner',
    description: 'Wide-format banner image for announcing news, launches, or milestones',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Image — Multi (5) ────────────────────────────────────────────────────────

  carousel: {
    label: 'Carousel',
    description: 'Multi-slide swipeable post for storytelling or step-by-step content',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {
      'Instagram': {
        characterLimit: 2200,
        aspectRatio: '1:1 or 4:5',
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['JPEG', 'PNG'],
      },
      'LinkedIn': {
        characterLimit: 3000,
        aspectRatio: null,
        durationLimitSeconds: null,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['JPEG', 'PNG', 'PDF'],
      },
    },
  },

  swipe_post: {
    label: 'Swipe Post',
    description: 'Horizontally swipeable image series designed to drive engagement',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  before_after_set: {
    label: 'Before & After Set',
    description: 'Side-by-side or sequential images showing a transformation or comparison',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'Twitter / X', 'General'] as StudioPlatform[],
    constraints: {},
  },

  educational_slides: {
    label: 'Educational Slides',
    description: 'Series of instructional image slides that teach a concept or skill',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'LinkedIn', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  lookbook: {
    label: 'Lookbook',
    description: 'Curated collection of styled images showcasing products, fashion, or aesthetics',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Image — Advanced (3) ─────────────────────────────────────────────────────

  ai_generated_image: {
    label: 'AI Generated Image',
    description: 'Custom image created entirely by AI from a text prompt using generative models',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Twitter / X', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  meme: {
    label: 'Meme',
    description: 'Humorous image with text overlay designed for viral sharing and engagement',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  gif: {
    label: 'GIF',
    description: 'Short looping animated image for expressive, attention-grabbing social posts',
    category: 'image',
    compatiblePlatforms: ['Instagram', 'Twitter / X', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },
  // ── Video — Short-form (7) ───────────────────────────────────────────────────

  reel: {
    label: 'Reel',
    description: 'Short-form vertical video up to 90 seconds, optimised for Instagram and Facebook Reels',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {
      'Instagram': {
        characterLimit: null,
        aspectRatio: '9:16',
        durationLimitSeconds: 90,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['MP4'],
      },
    },
  },

  short: {
    label: 'Short',
    description: 'Vertical short-form video up to 60 seconds designed for YouTube Shorts discovery',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'General'] as StudioPlatform[],
    constraints: {
      'YouTube': {
        characterLimit: null,
        aspectRatio: '9:16',
        durationLimitSeconds: 60,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['MP4'],
      },
    },
  },

  tiktok_video: {
    label: 'TikTok Video',
    description: "Vertical short-form video optimised for TikTok's algorithm and audience engagement",
    category: 'video',
    compatiblePlatforms: ['TikTok', 'General'] as StudioPlatform[],
    constraints: {
      'TikTok': {
        characterLimit: null,
        aspectRatio: '9:16',
        durationLimitSeconds: 600,
        fileSizeLimitMb: null,
        acceptedFileFormats: ['MP4'],
      },
    },
  },

  vertical_video: {
    label: 'Vertical Video',
    description: 'Portrait-orientation video (9:16) suitable for any short-form or Stories placement',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  promo_video: {
    label: 'Promo Video',
    description: 'Short promotional video highlighting a product, service, or campaign with a clear CTA',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'General'] as StudioPlatform[],
    constraints: {},
  },

  talking_head_video: {
    label: 'Talking Head Video',
    description: 'On-camera presenter video ideal for thought leadership, tutorials, or direct-to-audience messaging',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'YouTube', 'LinkedIn', 'TikTok', 'General'] as StudioPlatform[],
    constraints: {},
  },

  loop_video: {
    label: 'Loop Video',
    description: 'Seamlessly looping short video designed to play continuously in social feeds',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'Facebook', 'TikTok', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Video — Long-form (3) ────────────────────────────────────────────────────

  youtube_video: {
    label: 'YouTube Video',
    description: 'Long-form horizontal video optimised for YouTube search, watch time, and subscriber growth',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'General'] as StudioPlatform[],
    constraints: {
      'YouTube': {
        characterLimit: null,
        aspectRatio: '16:9',
        durationLimitSeconds: null,
        fileSizeLimitMb: 256000,
        acceptedFileFormats: ['MP4', 'MOV', 'AVI'],
      },
    },
  },

  tutorial_video: {
    label: 'Tutorial Video',
    description: 'Step-by-step instructional video walking viewers through a process, skill, or tool',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'LinkedIn', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  product_demo: {
    label: 'Product Demo',
    description: 'Walkthrough video showcasing product features, use cases, and key benefits',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'LinkedIn', 'Facebook', 'Instagram', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Video — AI (5) ───────────────────────────────────────────────────────────

  faceless_video: {
    label: 'Faceless Video',
    description: 'AI-generated video with voiceover and visuals but no on-camera presenter, ideal for anonymous creators',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'TikTok', 'Instagram', 'General'] as StudioPlatform[],
    constraints: {},
  },

  voiceover_video: {
    label: 'Voiceover Video',
    description: 'Video with AI-generated voiceover narration layered over images, footage, or screen recordings',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'Instagram', 'LinkedIn', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  subtitle_video: {
    label: 'Subtitle Video',
    description: 'Existing video enhanced with AI-generated captions or subtitles for accessibility and silent viewing',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  ai_explainer_video: {
    label: 'AI Explainer Video',
    description: 'AI-produced explainer video combining narration, motion graphics, and text to simplify complex topics',
    category: 'video',
    compatiblePlatforms: ['YouTube', 'LinkedIn', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  repurposed_clip: {
    label: 'Repurposed Clip',
    description: 'Short highlight clip extracted or reformatted from a longer video asset for cross-platform distribution',
    category: 'video',
    compatiblePlatforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'General'] as StudioPlatform[],
    constraints: {},
  },

  // ── Audio (7) ────────────────────────────────────────────────────────────────

  podcast_episode: {
    label: 'Podcast Episode',
    description: 'Full-length audio episode with structured segments, ideal for podcast platforms and YouTube audio',
    category: 'audio',
    compatiblePlatforms: ['Podcast', 'YouTube', 'General'] as StudioPlatform[],
    constraints: {
      'Podcast': {
        characterLimit: null,
        aspectRatio: null,
        durationLimitSeconds: null,
        fileSizeLimitMb: 500,
        acceptedFileFormats: ['MP3', 'WAV', 'M4A'],
      },
    },
  },

  voiceover: {
    label: 'Voiceover',
    description: 'Professional AI voiceover recording for use in videos, presentations, or advertisements',
    category: 'audio',
    compatiblePlatforms: ['YouTube', 'General'] as StudioPlatform[],
    constraints: {},
  },

  tts_narration: {
    label: 'TTS Narration',
    description: 'Text-to-speech narration converting written content into natural-sounding spoken audio',
    category: 'audio',
    compatiblePlatforms: ['Podcast', 'YouTube', 'General'] as StudioPlatform[],
    constraints: {},
  },

  audio_blog: {
    label: 'Audio Blog',
    description: 'Audio version of a blog post or article, enabling audiences to listen instead of read',
    category: 'audio',
    compatiblePlatforms: ['Podcast', 'YouTube', 'General'] as StudioPlatform[],
    constraints: {},
  },

  voice_note: {
    label: 'Voice Note',
    description: 'Short informal audio message or update, suitable for community platforms and messaging channels',
    category: 'audio',
    compatiblePlatforms: ['General'] as StudioPlatform[],
    constraints: {},
  },

  audio_ad: {
    label: 'Audio Ad',
    description: 'Short-form audio advertisement designed for podcast mid-rolls, streaming platforms, or radio spots',
    category: 'audio',
    compatiblePlatforms: ['Podcast', 'General'] as StudioPlatform[],
    constraints: {},
  },

  multilingual_dub: {
    label: 'Multilingual Dub',
    description: 'AI-dubbed version of existing audio or video content translated and voiced in a target language',
    category: 'audio',
    compatiblePlatforms: ['YouTube', 'Podcast', 'General'] as StudioPlatform[],
    constraints: {},
  },
  // ── Story (7) ────────────────────────────────────────────────────────────────

  story_single: {
    label: 'Story (Single)',
    description: 'Single full-screen vertical story frame for Instagram or Facebook Stories',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {
      'Instagram': {
        characterLimit: null,
        aspectRatio: '9:16',
        durationLimitSeconds: 15,
        fileSizeLimitMb: 30,
        acceptedFileFormats: ['JPEG', 'PNG', 'MP4'],
      },
    },
  },

  story_sequence: {
    label: 'Story Sequence',
    description: 'Series of connected story frames that guide viewers through a narrative or campaign',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  poll_story: {
    label: 'Poll Story',
    description: 'Interactive story frame featuring a two-option poll sticker to drive audience engagement',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  quiz_story: {
    label: 'Quiz Story',
    description: 'Story frame with a multiple-choice quiz sticker to test audience knowledge and boost interaction',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  countdown_story: {
    label: 'Countdown Story',
    description: 'Story frame with a countdown timer sticker building anticipation for a launch, event, or deadline',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  link_story: {
    label: 'Link Story',
    description: 'Story frame with a swipe-up or link sticker driving traffic to an external URL or landing page',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },

  product_story: {
    label: 'Product Story',
    description: 'Story frame showcasing a product with shoppable tags or a direct link to purchase',
    category: 'story',
    compatiblePlatforms: ['Instagram', 'Facebook', 'General'] as StudioPlatform[],
    constraints: {},
  },
} satisfies ContentFormatRegistry

// ─── Typed const arrays for PBT arbitraries ───────────────────────────────────

export const CONTENT_CATEGORIES = [
  'text',
  'image',
  'video',
  'audio',
  'story',
] as const satisfies ContentCategory[]

export const CONTENT_FORMATS_PHASE1 = Object.keys(CONTENT_FORMAT_REGISTRY) as ContentFormat[]

export const STUDIO_PLATFORMS = [
  'Instagram',
  'LinkedIn',
  'Twitter / X',
  'Facebook',
  'YouTube',
  'TikTok',
  'Blog',
  'Newsletter',
  'Podcast',
  'General',
] as const satisfies StudioPlatform[]

export const STUDIO_TONES = [
  'Professional',
  'Casual',
  'Humorous',
  'Inspirational',
  'Persuasive',
  'Informative',
] as const satisfies StudioTone[]
