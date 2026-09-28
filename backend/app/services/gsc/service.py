"""Google Search Console OAuth management, data synchronization, and performance reporting."""

from datetime import datetime, timedelta
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode
import httpx

from app.core.config import get_settings
from app.core.database import get_supabase_admin
from app.services.gsc.models import (
    GSCSyncOut,
    PagePerformanceRow,
    PerformanceSummary,
    QueryPerformanceRow,
    SearchPerformanceReport,
    TimeseriesPoint,
)

logger = logging.getLogger(__name__)

GSC_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GSC_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GSC_API_BASE = "https://www.googleapis.com/webmasters/v3"
GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"


class GoogleSearchConsoleService:
    """Service managing GSC OAuth, background data synchronization, and performance metrics."""

    @classmethod
    def is_configured(cls) -> bool:
        settings = get_settings()
        return bool(settings.gsc_client_id and settings.gsc_client_secret)

    @classmethod
    def generate_auth_url(cls, project_id: str) -> str:
        """Generates Google OAuth 2.0 consent URL for webmasters readonly access."""
        settings = get_settings()
        if not cls.is_configured():
            raise ValueError("GSC_CLIENT_ID and GSC_CLIENT_SECRET are not configured on the server.")

        params = {
            "client_id": settings.gsc_client_id,
            "redirect_uri": settings.gsc_redirect_uri,
            "response_type": "code",
            "scope": GSC_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": project_id,
        }
        return f"{GSC_OAUTH_AUTH_URL}?{urlencode(params)}"

    @classmethod
    async def exchange_code_for_tokens(cls, code: str) -> Dict[str, Any]:
        """Exchanges authorization code for access and refresh tokens."""
        settings = get_settings()
        payload = {
            "code": code,
            "client_id": settings.gsc_client_id,
            "client_secret": settings.gsc_client_secret,
            "redirect_uri": settings.gsc_redirect_uri,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(GSC_OAUTH_TOKEN_URL, data=payload)
            if res.status_code != 200:
                raise ValueError(f"Failed to exchange OAuth code: {res.text[:200]}")
            return res.json()

    @classmethod
    async def refresh_access_token(cls, refresh_token: str) -> Dict[str, Any]:
        """Refreshes expired access token using refresh_token."""
        settings = get_settings()
        payload = {
            "refresh_token": refresh_token,
            "client_id": settings.gsc_client_id,
            "client_secret": settings.gsc_client_secret,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(GSC_OAUTH_TOKEN_URL, data=payload)
            if res.status_code != 200:
                raise ValueError(f"Failed to refresh GSC access token: {res.text[:200]}")
            return res.json()

    @classmethod
    async def list_verified_sites(cls, access_token: str) -> List[Dict[str, Any]]:
        """Lists user's verified sites in Search Console."""
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(f"{GSC_API_BASE}/sites", headers=headers)
            if res.status_code != 200:
                raise ValueError(f"Failed to fetch GSC sites: {res.text[:200]}")
            data = res.json()
            return data.get("siteEntry", [])

    @classmethod
    async def sync_project_performance(
        cls,
        project_id: str,
        days: int = 30,
        access_token: Optional[str] = None,
    ) -> GSCSyncOut:
        """
        Synchronizes historical search analytics from GSC for the connected site URL.
        Inserts query, page, clicks, impressions, CTR, position rows into Supabase.
        """
        from app.core.config import get_settings
        from supabase import create_client

        s = get_settings()
        if s.supabase_service_role_key:
            supabase = get_supabase_admin()
        elif access_token:
            supabase = create_client(s.supabase_url, s.supabase_anon_key)
            supabase.postgrest.auth(access_token)
        else:
            supabase = get_supabase_admin()

        # 1. Fetch connection
        conn_res = (
            supabase.table("search_console_connections")
            .select("*")
            .eq("project_id", project_id)
            .single()
            .execute()
        )
        if not conn_res.data:
            raise ValueError("No Search Console connection found for this project.")

        conn = conn_res.data
        conn_id = conn["id"]
        site_url = conn["site_url"]
        gsc_token = conn["access_token"]
        refresh_token = conn.get("refresh_token")

        # 2. Create sync record
        sync_insert = (
            supabase.table("search_console_syncs")
            .insert(
                {
                    "connection_id": conn_id,
                    "project_id": project_id,
                    "status": "syncing",
                    "started_at": datetime.utcnow().isoformat(),
                }
            )
            .execute()
        )
        sync_id = sync_insert.data[0]["id"]

        try:
            # Calculate date range
            end_date = (datetime.utcnow() - timedelta(days=2)).strftime("%Y-%m-%d")
            start_date = (datetime.utcnow() - timedelta(days=days + 2)).strftime("%Y-%m-%d")

            encoded_site = quote(site_url, safe="")
            url = f"{GSC_API_BASE}/sites/{encoded_site}/searchAnalytics/query"
            headers = {"Authorization": f"Bearer {gsc_token}", "Content-Type": "application/json"}
            payload = {
                "startDate": start_date,
                "endDate": end_date,
                "dimensions": ["date", "query", "page"],
                "rowLimit": 5000,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, headers=headers, json=payload)

                # Token expired: try refresh
                if res.status_code == 401 and refresh_token:
                    refreshed = await cls.refresh_access_token(refresh_token)
                    new_token = refreshed["access_token"]
                    # Update connection token
                    supabase.table("search_console_connections").update(
                        {"access_token": new_token, "updated_at": datetime.utcnow().isoformat()}
                    ).eq("id", conn_id).execute()
                    headers["Authorization"] = f"Bearer {new_token}"
                    res = await client.post(url, headers=headers, json=payload)

                if res.status_code != 200:
                    raise ValueError(f"GSC searchAnalytics query failed: {res.text[:200]}")

                data = res.json()
                rows = data.get("rows", [])

            # Insert search performance records
            perf_records = []
            for r in rows:
                keys = r.get("keys", [])
                perf_records.append(
                    {
                        "project_id": project_id,
                        "sync_id": sync_id,
                        "date": keys[0] if len(keys) > 0 else start_date,
                        "query": keys[1] if len(keys) > 1 else "",
                        "page": keys[2] if len(keys) > 2 else "",
                        "clicks": int(r.get("clicks", 0)),
                        "impressions": int(r.get("impressions", 0)),
                        "ctr": round(float(r.get("ctr", 0.0)), 4),
                        "position": round(float(r.get("position", 0.0)), 2),
                    }
                )

            # Batch insert in chunks of 100
            for i in range(0, len(perf_records), 100):
                supabase.table("search_performance").insert(perf_records[i : i + 100]).execute()

            # Mark sync completed
            supabase.table("search_console_syncs").update(
                {
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "rows_synced": len(perf_records),
                }
            ).eq("id", sync_id).execute()

            return GSCSyncOut(
                id=sync_id,
                project_id=project_id,
                status="completed",
                started_at=datetime.utcnow().isoformat(),
                completed_at=datetime.utcnow().isoformat(),
                rows_synced=len(perf_records),
                created_at=datetime.utcnow().isoformat(),
            )

        except Exception as e:
            logger.exception(f"GSC sync error for project {project_id}: {e}")
            supabase.table("search_console_syncs").update(
                {
                    "status": "failed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "error": str(e)[:300],
                }
            ).eq("id", sync_id).execute()

            return GSCSyncOut(
                id=sync_id,
                project_id=project_id,
                status="failed",
                error=str(e)[:300],
                created_at=datetime.utcnow().isoformat(),
            )

    @classmethod
    async def get_performance_report(
        cls,
        project_id: str,
        days: int = 30,
        access_token: Optional[str] = None,
    ) -> SearchPerformanceReport:
        """Compiles search performance overview, timeseries, top queries, and top pages."""
        from app.core.config import get_settings
        from supabase import create_client

        s = get_settings()
        if s.supabase_service_role_key:
            supabase = get_supabase_admin()
        elif access_token:
            supabase = create_client(s.supabase_url, s.supabase_anon_key)
            supabase.postgrest.auth(access_token)
        else:
            supabase = get_supabase_admin()

        # Check connection
        conn_res = (
            supabase.table("search_console_connections")
            .select("site_url")
            .eq("project_id", project_id)
            .execute()
        )
        if not conn_res.data:
            return SearchPerformanceReport(
                is_connected=False,
                summary=PerformanceSummary(),
            )

        site_url = conn_res.data[0]["site_url"]

        # Latest sync
        sync_res = (
            supabase.table("search_console_syncs")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        latest_sync = None
        if sync_res.data:
            row = sync_res.data[0]
            latest_sync = GSCSyncOut(
                id=row["id"],
                project_id=row["project_id"],
                status=row["status"],
                started_at=row.get("started_at"),
                completed_at=row.get("completed_at"),
                rows_synced=row.get("rows_synced", 0),
                error=row.get("error"),
                created_at=row["created_at"],
            )

        # Performance rows
        since_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        perf_res = (
            supabase.table("search_performance")
            .select("date, query, page, clicks, impressions, ctr, position")
            .eq("project_id", project_id)
            .gte("date", since_date)
            .order("date", desc=False)
            .execute()
        )
        rows = perf_res.data or []

        if not rows:
            return SearchPerformanceReport(
                is_connected=True,
                site_url=site_url,
                latest_sync=latest_sync,
                summary=PerformanceSummary(),
            )

        total_clicks = sum(r["clicks"] for r in rows)
        total_impressions = sum(r["impressions"] for r in rows)
        avg_ctr = round((total_clicks / max(1, total_impressions)) * 100.0, 2)
        avg_pos = round(sum(r["position"] for r in rows) / len(rows), 1)

        # Timeseries aggregation by date
        by_date: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            d = r["date"]
            if d not in by_date:
                by_date[d] = {"clicks": 0, "impressions": 0, "pos_sum": 0.0, "count": 0}
            by_date[d]["clicks"] += r["clicks"]
            by_date[d]["impressions"] += r["impressions"]
            by_date[d]["pos_sum"] += r["position"]
            by_date[d]["count"] += 1

        timeseries: List[TimeseriesPoint] = []
        for d in sorted(by_date.keys()):
            item = by_date[d]
            clk = item["clicks"]
            imp = item["impressions"]
            ctr = round((clk / max(1, imp)) * 100.0, 2)
            pos = round(item["pos_sum"] / item["count"], 1)
            timeseries.append(TimeseriesPoint(date=d, clicks=clk, impressions=imp, ctr=ctr, position=pos))

        # Top queries aggregation
        by_query: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            q = r["query"].strip()
            if not q:
                continue
            if q not in by_query:
                by_query[q] = {"clicks": 0, "impressions": 0, "pos_sum": 0.0, "count": 0}
            by_query[q]["clicks"] += r["clicks"]
            by_query[q]["impressions"] += r["impressions"]
            by_query[q]["pos_sum"] += r["position"]
            by_query[q]["count"] += 1

        top_queries: List[QueryPerformanceRow] = []
        for q, v in sorted(by_query.items(), key=lambda x: x[1]["clicks"], reverse=True)[:50]:
            clk = v["clicks"]
            imp = v["impressions"]
            ctr = round((clk / max(1, imp)) * 100.0, 2)
            pos = round(v["pos_sum"] / v["count"], 1)
            top_queries.append(QueryPerformanceRow(query=q, clicks=clk, impressions=imp, ctr=ctr, position=pos))

        # Top pages aggregation
        by_page: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            p = r["page"].strip()
            if not p:
                continue
            if p not in by_page:
                by_page[p] = {"clicks": 0, "impressions": 0, "pos_sum": 0.0, "count": 0}
            by_page[p]["clicks"] += r["clicks"]
            by_page[p]["impressions"] += r["impressions"]
            by_page[p]["pos_sum"] += r["position"]
            by_page[p]["count"] += 1

        top_pages: List[PagePerformanceRow] = []
        for p, v in sorted(by_page.items(), key=lambda x: x[1]["clicks"], reverse=True)[:50]:
            clk = v["clicks"]
            imp = v["impressions"]
            ctr = round((clk / max(1, imp)) * 100.0, 2)
            pos = round(v["pos_sum"] / v["count"], 1)
            top_pages.append(PagePerformanceRow(page=p, clicks=clk, impressions=imp, ctr=ctr, position=pos))

        return SearchPerformanceReport(
            is_connected=True,
            site_url=site_url,
            latest_sync=latest_sync,
            summary=PerformanceSummary(
                total_clicks=total_clicks,
                total_impressions=total_impressions,
                average_ctr=avg_ctr,
                average_position=avg_pos,
                start_date=rows[0]["date"] if rows else None,
                end_date=rows[-1]["date"] if rows else None,
            ),
            timeseries=timeseries,
            top_queries=top_queries,
            top_pages=top_pages,
        )
