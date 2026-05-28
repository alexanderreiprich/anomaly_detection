from __future__ import annotations

from typing import Literal

import numpy as np

Strategy = Literal["entropy", "margin", "least_confident"]
_VALID: tuple[Strategy, ...] = ("entropy", "margin", "least_confident")


class UncertaintySampler:
    """Score and query the most uncertain samples from a model's probabilities.

    Strategies:
      - entropy: normalised Shannon entropy over class probabilities (0–1).
      - margin: 1 - (top1 - top2). Higher = more ambiguous between two classes.
      - least_confident: 1 - max(p). Higher = lower top-class confidence.

    All three return values in [0, 1] where higher means more uncertain.
    """

    def __init__(self, strategy: Strategy = "entropy"):
        if strategy not in _VALID:
            raise ValueError(f"Unknown strategy '{strategy}'. Use one of {_VALID}.")
        self.strategy: Strategy = strategy

    def score(self, model, X) -> np.ndarray:
        """Return uncertainty score per sample given a trained model."""
        proba = model.predict_proba(X)
        return self.score_from_proba(proba)

    def score_from_proba(self, proba: np.ndarray) -> np.ndarray:
        proba = np.asarray(proba, dtype=float)
        if proba.ndim != 2:
            raise ValueError(f"proba must be 2D (n_samples, n_classes), got shape {proba.shape}")
        n_classes = proba.shape[1]

        if self.strategy == "entropy":
            ent = -np.sum(proba * np.log2(proba + 1e-12), axis=1)
            return ent / np.log2(max(n_classes, 2))

        if self.strategy == "least_confident":
            return 1.0 - proba.max(axis=1)

        # margin
        sorted_p = np.sort(proba, axis=1)
        top1 = sorted_p[:, -1]
        top2 = sorted_p[:, -2] if n_classes >= 2 else np.zeros_like(top1)
        return 1.0 - (top1 - top2)

    def query(self, model, X, n: int = 10) -> list[int]:
        """Indices of the n most uncertain samples, highest score first."""
        scores = self.score(model, X)
        n = min(n, len(scores))
        if n <= 0:
            return []
        order = np.argsort(-scores, kind="stable")
        return order[:n].tolist()
