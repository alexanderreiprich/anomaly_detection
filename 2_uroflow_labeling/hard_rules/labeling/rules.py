from dataclasses import dataclass
from typing import Optional
from .labels import Label

import pandas as pd

@dataclass
class LabelingRule:
    """
    Base class.
    New rules inherit from this class and override apply()
    """
    name: str
    priority: int = 0   # A higher number gets priority if conflicts happen

    def apply(self, row: pd.Series) -> Optional[Label]:
        raise NotImplementedError


@dataclass
class VolumeRule(LabelingRule):
    """
    Volumen outside of [low, high] result in Warning.
    Standard: < 150 ml or > 500 ml.
    """
    low:  float = 150.0
    high: float = 500.0
    name: str   = "volume_range"
    priority: int = 10

    def apply(self, row: pd.Series) -> Optional[Label]:
        v = row.get("urine_volume")
        if v is None or pd.isna(v):
            return None
        if v < self.low or v > self.high:
            return Label.WARNING
        return None


@dataclass
class MaxFlowRateRule(LabelingRule):
    """
    Maximum flow rate (Q_max) below threshold → Critical.
    Standard: Q_max < 10 ml/s.
    """
    min_qmax: float = 10.0
    name: str       = "max_flow_rate"
    priority: int   = 20

    def apply(self, row: pd.Series) -> Optional[Label]:
        q = row.get("max_flow")
        if q is None or pd.isna(q):
            return None
        if q < self.min_qmax:
            return Label.CRITICAL
        return None


@dataclass
class AvgFlowRateRule(LabelingRule):
    """
    Average flow rate (Q_avg):
      < critical_threshold  → Critical
      < warning_threshold   → Warning
    Standard: < 10 ml/s Critical, < 15 ml/s Warning.
    """
    critical_threshold: float = 10.0
    warning_threshold:  float = 15.0
    name: str                 = "avg_flow_rate"
    priority: int             = 20   # same priority as MaxFlowRateRule

    def apply(self, row: pd.Series) -> Optional[Label]:
        q = row.get("avg_flow")
        if q is None or pd.isna(q):
            return None
        if q < self.critical_threshold:
            return Label.CRITICAL
        if q < self.warning_threshold:
            return Label.WARNING
        return None


DEFAULT_RULES: list[LabelingRule] = [
    VolumeRule(),
    MaxFlowRateRule(),
    AvgFlowRateRule(),
]
