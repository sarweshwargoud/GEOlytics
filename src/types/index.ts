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

// ─── Phase 4: LangGraph & Hindsight Recommendation Models ─────

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low'
export type RecommendationType = 'content' | 'technical' | 'schema' | 'linking' | 'geo_visibility' | 'metadata'
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'experiment_created' | 'implemented' | 'measuring' | 'completed' | 'cancelled'

export interface Recommendation {
  id: string
  project_id: string
  title: string
  type: RecommendationType
  priority: RecommendationPriority
  action: string
  reason: string
  hypothesis: string
  confidence: number
  status: RecommendationStatus
  evidence: string[]
  affected_pages: string[]
  affected_queries: string[]
  geo_observations: Array<Record<string, any>>
  competitor_observations: Array<Record<string, any>>
  historical_memory: string[]
  suggested_experiment: string
  measurement_criteria: string[]
  requires_approval: boolean
  rejection_reason?: string | null
  created_at: string
  updated_at: string
}

export type MemoryType = 'strategy' | 'outcome' | 'preference' | 'competitor_observation' | 'lesson_learned'
export type MemoryCategory = 'seo' | 'geo' | 'technical' | 'content' | 'approval'

export interface AgentMemory {
  id: string
  project_id: string
  memory_type: MemoryType
  category: MemoryCategory
  title: string
  content: string
  source: string
  confidence: number
  tags: string[]
  metadata: Record<string, any>
  created_at: string
}

export interface AgentRunResponse {
  project_id: string
  recommendations_generated: number
  recommendations: Recommendation[]
  memories_recalled: number
  execution_time_seconds: number
  summary: string
}

// ─── Phase 5: Closed-Loop Experiment Models ───────────────────

export type ExperimentStatus =
  | 'draft'
  | 'approved'
  | 'baseline_captured'
  | 'implementation_pending'
  | 'running'
  | 'measuring'
  | 'completed'
  | 'cancelled'

export type ExperimentOutcome =
  | 'pending'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'inconclusive'
  | 'insufficient_data'

export interface SuccessCriterion {
  metric: string
  target_type: string
  target_value: number
  description: string
}

export interface MetricDeltaItem {
  metric: string
  baseline: number
  after: number
  absolute_delta: number
  percent_delta?: number
  pp_delta?: number
  position_improvement?: number
  status: 'improved' | 'neutral' | 'regressed' | 'no_data'
  formatted_display: string
}

export interface ExperimentResult {
  deltas?: Record<string, any>
  metric_items?: MetricDeltaItem[]
  criteria_evaluations?: Array<{
    criterion: string
    metric: string
    passed: boolean
    detail: string
  }>
  outcome: ExperimentOutcome
  outcome_summary: string
  evidence: string[]
  limitations: string[]
  hindsight_memory_retained?: string
}

export interface Experiment {
  id: string
  project_id: string
  recommendation_id?: string | null
  name: string
  hypothesis: string
  status: ExperimentStatus
  start_date?: string | null
  implementation_date?: string | null
  measurement_start?: string | null
  measurement_end?: string | null
  baseline_period: Record<string, any>
  target_period: Record<string, any>
  success_criteria: SuccessCriterion[]
  metrics: Array<Record<string, any>>
  result: ExperimentResult
  outcome: ExperimentOutcome
  notes?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export interface ExperimentCreate {
  recommendation_id?: string
  name: string
  hypothesis: string
  measurement_window_days?: number
  affected_pages?: string[]
  affected_queries?: string[]
  success_criteria?: SuccessCriterion[]
  notes?: string
}

// ─── Phase 6: Automation, Reports, Notifications & Health ──────

export type AutomationJobType =
  | 'seo_sync'
  | 'geo_checks'
  | 'seo_audit'
  | 'competitor_research'
  | 'agent_analysis'
  | 'experiment_measurement'
  | 'report_generation'

export type AutomationFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly'

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'skipped'

export interface AutomationJobSetting {
  id?: string
  project_id: string
  job_type: AutomationJobType
  enabled: boolean
  frequency: AutomationFrequency
  last_run_at?: string | null
  next_run_at?: string | null
  configuration: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface AutomationRunLog {
  id: string
  project_id: string
  job_type: AutomationJobType
  status: AutomationRunStatus
  is_manual: boolean
  started_at: string
  completed_at?: string | null
  duration_seconds?: number | null
  result_summary?: Record<string, any>
  error_message?: string | null
  created_at: string
}

export interface Report {
  id: string
  project_id: string
  report_type: string
  period_start: string
  period_end: string
  status: string
  summary: string
  data: {
    seo_performance?: {
      summary?: string
      total_clicks?: number
      total_impressions?: number
      average_ctr?: number
      average_position?: number
      recent_data_points?: number
      top_queries?: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
      top_pages?: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>
    }
    geo_visibility?: {
      summary?: string
      tested_queries_count?: number
      total_citations_observed?: number
      total_brand_mentions?: number
      citations?: Array<{ query: string; provider: string; cited_url?: string; brand_mentioned?: boolean }>
    }
    competitor_insights?: {
      summary?: string
      observations?: Array<Record<string, any>>
    }
    recommendations?: {
      total_count?: number
      pending_count?: number
      high_priority_count?: number
      items?: any[]
    }
    experiments?: {
      active_count?: number
      completed_count?: number
      items?: any[]
    }
    hindsight_learnings?: Array<{ title: string; content: string; confidence?: number; category?: string }>
    limitations?: string[]
    data_freshness?: {
      generated_at?: string
      period_start?: string
      period_end?: string
      gsc_latency?: string
    }
  }
  created_at: string
}

export type NotificationCategory =
  | 'recommendation'
  | 'experiment'
  | 'geo_change'
  | 'report'
  | 'system'

export interface NotificationItem {
  id: string
  project_id?: string | null
  user_id: string
  category: NotificationCategory
  title: string
  message: string
  is_read: boolean
  related_entity_id?: string | null
  related_entity_type?: string | null
  metadata?: Record<string, any>
  created_at: string
}

export interface NotificationPreferences {
  id?: string
  project_id: string
  user_id: string
  high_priority_recs: boolean
  experiment_results: boolean
  geo_visibility_changes: boolean
  weekly_reports: boolean
  automation_failures: boolean
  email_notifications_enabled: boolean
  email_recipient?: string | null
}

export interface FreshnessIndicator {
  last_updated?: string | null
  freshness_label: string
  is_fresh: boolean
  details?: string | null
}

export interface ProjectHealthReport {
  project_id: string
  project_name: string
  seo: FreshnessIndicator
  geo: FreshnessIndicator
  gsc: FreshnessIndicator
  experiments: FreshnessIndicator
  automation: FreshnessIndicator
  summary_status: 'healthy' | 'attention_needed' | 'degraded'
  active_experiments_count: number
  pending_recommendations_count: number
  unread_notifications_count: number
}

