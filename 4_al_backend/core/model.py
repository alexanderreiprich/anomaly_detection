from __future__ import annotations

from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from .config import FEATURES


class PatientModel:
    """XGBoost wrapper for uroflow severity classification.

    XGBoost is scale-invariant and handles NaN natively — the IPSS features
    can be missing for measurements without a nearby IPSS submission.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: int = 5,
        learning_rate: float = 0.1,
        random_state: int = 42,
    ):
        self.model = XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=random_state,
            n_jobs=-1,
            eval_metric="mlogloss",
            tree_method="hist",
        )
        self.le = LabelEncoder()
        self.trained = False
        self.features: list[str] = list(FEATURES)

    def fit(self, X, y) -> "PatientModel":
        X_arr = _to_array(X, self.features)
        y_arr = np.asarray(y).astype(str)
        if len(set(y_arr)) < 2:
            raise ValueError(
                f"Need at least 2 label classes to train, got {set(y_arr)}"
            )
        y_enc = self.le.fit_transform(y_arr)
        sample_weight = compute_sample_weight("balanced", y_enc)
        self.model.fit(X_arr, y_enc, sample_weight=sample_weight)
        self.trained = True
        return self

    def predict(self, X) -> np.ndarray:
        self._require_trained()
        X_arr = _to_array(X, self.features)
        y_enc = self.model.predict(X_arr)
        return self.le.inverse_transform(y_enc)

    def predict_proba(self, X) -> np.ndarray:
        self._require_trained()
        X_arr = _to_array(X, self.features)
        return self.model.predict_proba(X_arr)

    @property
    def classes_(self) -> np.ndarray:
        self._require_trained()
        return self.le.classes_

    def save(self, path: str | Path) -> None:
        self._require_trained()
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "model": self.model,
                "le": self.le,
                "features": self.features,
            },
            path,
        )

    def load(self, path: str | Path) -> "PatientModel":
        blob = joblib.load(Path(path))
        self.model = blob["model"]
        self.le = blob["le"]
        self.features = blob["features"]
        self.trained = True
        return self

    def _require_trained(self) -> None:
        if not self.trained:
            raise RuntimeError("Model not trained yet — call fit() or load() first.")


def _to_array(X, features: list[str]) -> np.ndarray:
    if isinstance(X, pd.DataFrame):
        return X[features].to_numpy(dtype=float)
    arr = np.asarray(X, dtype=float)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    return arr
