"""SEOAuditService coordinating issue detection, severity tallying, and health scoring."""

from typing import List
from app.services.analyzer.models import (
    AuditSummary,
    IssueSeverity,
    SEOIssue,
)
from app.services.analyzer.rules import AuditRulesEvaluator
from app.services.analyzer.scorer import SEOScorer
from app.services.crawler.models import PageCrawlResult, SiteSignalsResult


class SEOAuditService:
    """Performs comprehensive technical, on-page, content, and schema audit on crawl results."""

    @classmethod
    def audit(
        cls,
        pages: List[PageCrawlResult],
        site_signals: SiteSignalsResult,
    ) -> AuditSummary:
        # Step 1: Evaluate all rules
        issues: List[SEOIssue] = AuditRulesEvaluator.evaluate_all(pages, site_signals)

        # Step 2: Tally counts by severity
        crit_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        high_count = sum(1 for i in issues if i.severity == IssueSeverity.HIGH)
        med_count = sum(1 for i in issues if i.severity == IssueSeverity.MEDIUM)
        low_count = sum(1 for i in issues if i.severity == IssueSeverity.LOW)

        # Step 3: Compute explainable scores
        health_score, category_scores = SEOScorer.calculate_scores(issues, len(pages))

        return AuditSummary(
            seo_health_score=health_score,
            category_scores=category_scores,
            total_issues=len(issues),
            critical_issues=crit_count,
            high_issues=high_count,
            medium_issues=med_count,
            low_issues=low_count,
            issues=issues,
        )
