// ─── Project ────────────────────────────────────────────────

export interface Project {
  id: string
  user_id: string
  name: string
  website_url: string
  industry: string | null
  target_location: string
  language: string
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  name: string
  website_url: string
  industry?: string
  target_location?: string
  language?: string
}

export interface ProjectUpdate {
  name?: string
  website_url?: string
  industry?: string
  target_location?: string
  language?: string
}

export interface ProjectListResponse {
  projects: Project[]
  count: number
}

// ─── SEO Score (architecture stub — Phase 2+) ───────────────
// These are diagnostic heuristics, NOT official platform metrics.

export interface SEOScoreBreakdown {
  crawlability?: number    // 0-30
  technical?: number       // 0-25
  on_page?: number         // 0-20
  content?: number         // 0-15
  authority?: number       // 0-10
  total?: number           // 0-100
}

// ─── GEO Score (architecture stub — Phase 2+) ───────────────
// These are diagnostic heuristics, NOT official AI citation metrics.

export interface GEOScoreBreakdown {
  platform_readiness?: number    // 0-25
  content_citability?: number    // 0-25
  technical_foundation?: number  // 0-20
  schema_structured?: number     // 0-15
  entity_presence?: number       // 0-15
  total?: number                 // 0-100
}

// ─── API ────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface ApiError {
  error: string
}

// ─── Phase 2: Crawl & Audit Models ──────────────────────────

export interface AICrawlerDirective {
  crawler_name: string
  status: 'allowed' | 'blocked' | 'unrestricted'
  matched_rule?: string | null
}

export interface SiteSignals {
  robots_txt?: {
    exists: boolean
    url?: string | null
    sitemaps?: string[]
    disallow_rules?: string[]
    allow_rules?: string[]
    ai_crawlers?: AICrawlerDirective[]
  }
  sitemap?: {
    exists: boolean
    url?: string | null
    url_count?: number
    urls_sample?: string[]
    has_lastmod?: boolean
    errors?: string[]
  }
  llms_txt_exists?: boolean
  llms_txt_url?: string | null
  llms_full_txt_exists?: boolean
}

export interface CrawlRun {
  id: string
  project_id: string
  status: 'queued' | 'crawling' | 'analyzing' | 'completed' | 'failed'
  started_at?: string | null
  completed_at?: string | null
  pages_crawled: number
  pages_failed: number
  error?: string | null
  seo_health_score?: number | null
  category_scores?: {
    technical?: number
    on_page?: number
    indexability?: number
    content?: number
    links?: number
    structured_data?: number
  }
  site_signals?: SiteSignals
  created_at: string
  updated_at?: string | null
}

export interface CrawlPage {
  id: string
  crawl_run_id: string
  project_id: string
  url: string
  final_url?: string | null
  status_code?: number | null
  response_time_ms?: number | null
  content_type?: string | null
  title?: string | null
  title_length?: number | null
  meta_description?: string | null
  meta_description_length?: number | null
  canonical?: string | null
  robots_meta?: string | null
  h1?: string | null
  h2_data?: string[]
  h3_data?: string[]
  word_count: number
  internal_links?: Array<{ url: string; text: string; is_internal: boolean }>
  external_links?: Array<{ url: string; text: string; is_internal: boolean }>
  image_count: number
  missing_alt_count: number
  images_data?: Array<{ src: string; alt: string; missing_alt: boolean }>
  schema_data?: Array<{ raw_json?: any; schema_types: string[]; is_valid: boolean; error_message?: string }>
  security_data?: { is_https?: boolean; mixed_content?: string[] }
  crawled_at: string
}

export interface SEOIssue {
  id: string
  crawl_run_id: string
  project_id: string
  page_id?: string | null
  category: 'technical' | 'on_page' | 'indexability' | 'content' | 'links' | 'structured_data' | 'security'
  severity: 'critical' | 'high' | 'medium' | 'low'
  issue: string
  affected_url?: string | null
  evidence?: string | null
  recommendation: string
  created_at: string
}

export interface AuditOverview {
  latest_run?: CrawlRun | null
  total_pages_crawled: number
  total_issues: number
  critical_issues: number
  high_issues: number
  medium_issues: number
  low_issues: number
  seo_health_score?: number | null
  category_scores?: {
    technical?: number
    on_page?: number
    indexability?: number
    content?: number
    links?: number
    structured_data?: number
  }
  site_signals?: SiteSignals
}
