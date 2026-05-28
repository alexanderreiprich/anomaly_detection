from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from . import config
from .biomarker_data import (
    get_labeled_biomarkers,
    get_unlabeled_biomarkers,
    reset_biomarker_labels,
    write_biomarker_labels,
    write_biomarker_predictions,
)
from .data import (
    get_labeled_measurements,
    get_unlabeled_measurements,
    reset_labels,
    write_labels,
    write_predictions,
)


@dataclass(frozen=True)
class ModelSpec:
    """Everything that differs between the uroflow and biomarker models.

    The model wrapper (PatientModel) and the uncertainty sampler are shared;
    only the feature set, labels, artifact path, data access and whether
    clinical-rule overrides apply at /query time vary per model.
    """

    name: str
    features: list[str]
    label_options: list[str]
    model_path: str
    load_labeled: Callable[[], tuple]
    load_unlabeled: Callable[[], object]
    write_predictions: Callable[[list[dict]], int]
    write_labels: Callable[..., int]
    reset_labels: Callable[[], int]
    model_kwargs: dict = field(default_factory=dict)
    clinical_rules: bool = False


REGISTRY: dict[str, ModelSpec] = {
    "uroflow": ModelSpec(
        name="uroflow",
        features=config.UROFLOW_FEATURES,
        label_options=config.UROFLOW_LABELS,
        model_path=config.UROFLOW_MODEL_PATH,
        load_labeled=get_labeled_measurements,
        load_unlabeled=get_unlabeled_measurements,
        write_predictions=write_predictions,
        write_labels=write_labels,
        reset_labels=reset_labels,
        model_kwargs={"max_depth": 5},
        clinical_rules=False,
    ),
    "biomarker": ModelSpec(
        name="biomarker",
        features=config.BIOMARKER_FEATURES,
        label_options=config.BIOMARKER_LABELS,
        model_path=config.BIOMARKER_MODEL_PATH,
        load_labeled=get_labeled_biomarkers,
        load_unlabeled=get_unlabeled_biomarkers,
        write_predictions=write_biomarker_predictions,
        write_labels=write_biomarker_labels,
        reset_labels=reset_biomarker_labels,
        model_kwargs={"max_depth": 4},
        clinical_rules=True,
    ),
}


def get_spec(model_type: str) -> ModelSpec:
    spec = REGISTRY.get(model_type)
    if spec is None:
        raise ValueError(
            f"Unknown model_type '{model_type}'. Valid: {list(REGISTRY)}"
        )
    return spec
