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

// ─── Phase 3: Google Search Console Models ────────────────────

export interface GSCPerformanceSummary {
  total_clicks: number
  total_impressions: number
  average_ctr: number
  average_position: number
}

export interface GSCTimeseriesPoint {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCQueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCPageRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchPerformanceReport {
  site_url: string
  days: number
  summary: GSCPerformanceSummary
  timeseries: GSCTimeseriesPoint[]
  top_queries: GSCQueryRow[]
  top_pages: GSCPageRow[]
}

export interface GSCSite {
  siteUrl: string
  permissionLevel: string
}

export interface GSCConnection {
  id: string
  project_id: string
  site_url: string
  permission_level?: string
  status: 'active' | 'revoked' | 'expired'
  last_synced_at?: string | null
  created_at: string
}

// ─── Phase 3: GEO (AI Search) Intelligence Models ─────────────

export type ProviderStatusType = 'connected' | 'not_configured' | 'unavailable' | 'error'

export interface ProviderCapability {
  provider: 'openai' | 'gemini' | 'claude' | 'grok' | 'tavily' | string
  configured: boolean
  web_search_supported: boolean
  model: string
  status: ProviderStatusType
  message?: string
}

export interface ProviderStatusResponse {
  providers: ProviderCapability[]
}

export interface SourceReference {
  url: string
  domain: string
  title?: string | null
  order: number
  is_own_domain: boolean
  is_competitor: boolean
}

export interface NormalizedAIResponse {
  provider: string
  model: string
  query: string
  timestamp: string
  status: 'completed' | 'failed' | 'unavailable' | 'running' | 'pending'
  brand_mentioned: boolean
  website_cited: boolean
  cited_urls: string[]
  cited_domains: string[]
  competitor_domains: string[]
  sources: SourceReference[]
  answer?: string | null
  error?: string | null
  raw_response?: Record<string, any>
}

export interface QueryVisibilitySummary {
  query_id: string
  query: string
  category: string
  target_entity?: string | null
  checked_at: string
  providers_configured: number
  providers_tested: number
  providers_cited: number
  providers_mentioned: number
  citation_coverage_pct: number
  responses: NormalizedAIResponse[]
  competitors_cited: string[]
}

export interface TrackedQuery {
  id: string
  project_id: string
  query: string
  category: string
  target_entity?: string | null
  enabled: boolean
  created_at: string
  updated_at: string
  latest_visibility?: {
    providers_cited: number
    providers_tested: number
    providers_mentioned: number
    citation_coverage_pct: number
    checked_at: string
    responses?: NormalizedAIResponse[]
  } | null
}

export interface TrackedQueryCreate {
  query: string
  category?: string
  target_entity?: string
}

export interface CompetitorResearchResult {
  query: string
  direct_results: Array<{
    title: string
    url: string
    content: string
    score: number
  }>
  identified_domains: string[]
  competitor_pages_found: number
  summary: string
}
