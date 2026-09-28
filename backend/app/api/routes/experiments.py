"""API routes for closed-loop SEO & GEO experiment lifecycle."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.schemas.experiments import (
    CompleteExperimentRequest,
    ExperimentCreate,
    ExperimentOut,
    ExperimentResult,
    ImplementationConfirmRequest,
)
from app.services.experiments.service import ExperimentService

project_experiments_router = APIRouter(prefix="/projects/{project_id}/experiments", tags=["Experiments"])
experiment_action_router = APIRouter(prefix="/experiments", tags=["Experiments"])


@project_experiments_router.post("", response_model=ExperimentOut)
async def create_experiment(
    project_id: str,
    payload: ExperimentCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Creates an experiment from an approved recommendation or as a standalone test.
    Automatically captures the initial baseline metrics.
    """
    return await ExperimentService.create_experiment(
        project_id=project_id,
        payload=payload,
        user_id=current_user["id"],
    )


@project_experiments_router.get("", response_model=List[ExperimentOut])
async def list_experiments(
    project_id: str,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: draft, approved, baseline_captured, running, measuring, completed, cancelled"),
    outcome_filter: Optional[str] = Query(None, alias="outcome", description="Filter by outcome: positive, neutral, negative, inconclusive, insufficient_data"),
    current_user: dict = Depends(get_current_user),
):
    """Lists all experiments belonging to a project with optional status/outcome filtering."""
    return await ExperimentService.list_experiments(
        project_id=project_id,
        user_id=current_user["id"],
        status_filter=status_filter,
        outcome_filter=outcome_filter,
    )


@experiment_action_router.get("/{experiment_id}", response_model=ExperimentOut)
async def get_experiment_detail(
    experiment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full details for a specific experiment."""
    return await ExperimentService.get_experiment(
        experiment_id=experiment_id,
        user_id=current_user["id"],
    )


@experiment_action_router.post("/{experiment_id}/baseline", response_model=ExperimentOut)
async def refresh_baseline(
    experiment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Captures or refreshes baseline metrics from Search Console and GEO AI visibility checks."""
    return await ExperimentService.capture_baseline(
        experiment_id=experiment_id,
        user_id=current_user["id"],
    )


@experiment_action_router.post("/{experiment_id}/confirm-implementation", response_model=ExperimentOut)
async def confirm_implementation(
    experiment_id: str,
    payload: ImplementationConfirmRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Confirms human implementation of changes on the website and starts the measurement window.
    Transitions experiment status to 'measuring'.
    """
    return await ExperimentService.confirm_implementation(
        experiment_id=experiment_id,
        payload=payload,
        user_id=current_user["id"],
    )


@experiment_action_router.post("/{experiment_id}/measure", response_model=ExperimentOut)
async def measure_experiment(
    experiment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Collects post-implementation metrics, calculates deltas against baseline,
    evaluates against success criteria, and updates the experiment result.
    """
    return await ExperimentService.measure_experiment(
        experiment_id=experiment_id,
        user_id=current_user["id"],
    )


@experiment_action_router.post("/{experiment_id}/complete", response_model=ExperimentOut)
async def complete_experiment(
    experiment_id: str,
    payload: CompleteExperimentRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Finalizes an experiment, classifies the final outcome,
    and stores structured learning into Hindsight long-term memory.
    """
    return await ExperimentService.complete_experiment(
        experiment_id=experiment_id,
        payload=payload,
        user_id=current_user["id"],
    )


@experiment_action_router.get("/{experiment_id}/results", response_model=ExperimentResult)
async def get_experiment_results(
    experiment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns before-vs-after delta analysis, success criteria evaluations,
    evidence, and causality limitation statements.
    """
    exp = await ExperimentService.get_experiment(
        experiment_id=experiment_id,
        user_id=current_user["id"],
    )
    result_data = exp.get("result") or {}
    if not result_data:
        # Run a live analysis if not yet measured
        exp = await ExperimentService.measure_experiment(
            experiment_id=experiment_id,
            user_id=current_user["id"],
        )
        result_data = exp.get("result") or {}

    return ExperimentResult(**result_data)
