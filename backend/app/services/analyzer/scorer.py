"""Transparent, explainable SEO Health Index calculation algorithm."""

from typing import Dict, List
from app.services.analyzer.models import CategoryScores, IssueCategory, IssueSeverity, SEOIssue

# Point deductions per severity level within category
DEDUCTIONS = {
    IssueSeverity.CRITICAL: 20.0,
    IssueSeverity.HIGH: 12.0,
    IssueSeverity.MEDIUM: 6.0,
    IssueSeverity.LOW: 2.0,
}

# Category weights summing to 1.0 (100%)
CATEGORY_WEIGHTS = {
    "technical": 0.25,
    "on_page": 0.25,
    "indexability": 0.20,
    "content": 0.10,
    "links": 0.10,
    "structured_data": 0.10,
}


class SEOScorer:
    """Calculates diagnostic SEO Health Index based on detected issues."""

    @classmethod
    def calculate_scores(cls, issues: List[SEOIssue], pages_count: int) -> tuple[float, CategoryScores]:
        # Initialize category points at 100.0
        scores: Dict[str, float] = {
            "technical": 100.0,
            "on_page": 100.0,
            "indexability": 100.0,
            "content": 100.0,
            "links": 100.0,
            "structured_data": 100.0,
        }

        # Apply deductions based on detected issues
        for issue in issues:
            cat_key = issue.category.value
            # Map 'security' category into 'technical'
            if cat_key == "security":
                cat_key = "technical"

            if cat_key in scores:
                deduction = DEDUCTIONS.get(issue.severity, 2.0)
                # Dampen repetitive page-level deductions if multiple pages suffer from same issue
                if pages_count > 1:
                    dampened_deduction = deduction / (1.0 + (pages_count * 0.05))
                else:
                    dampened_deduction = deduction

                scores[cat_key] = max(0.0, scores[cat_key] - dampened_deduction)

        # Round category scores
        category_obj = CategoryScores(
            technical=round(scores["technical"], 1),
            on_page=round(scores["on_page"], 1),
            indexability=round(scores["indexability"], 1),
            content=round(scores["content"], 1),
            links=round(scores["links"], 1),
            structured_data=round(scores["structured_data"], 1),
        )

        # Calculate weighted overall score
        overall = sum(
            getattr(category_obj, cat) * weight
            for cat, weight in CATEGORY_WEIGHTS.items()
        )
        overall_score = round(max(0.0, min(100.0, overall)), 1)

        return overall_score, category_obj
