import numpy as np
import pandas as pd
import pytest

from core.config import FEATURES


@pytest.fixture
def synthetic_labeled():
    rng = np.random.default_rng(0)
    n_per_class = 40
    rows = []
    for label, means in [
        ("normal", [250, 24, 15, 22, 20, 5, 4, 0, 2]),
        ("warning", [210, 13, 9, 38, 35, 12, 13, 3, 5]),
        ("critical", [190, 7, 5, 55, 50, 20, 25, 6, 10]),
    ]:
        for _ in range(n_per_class):
            row = {f: float(m + rng.normal(0, abs(m) * 0.1 + 0.5)) for f, m in zip(FEATURES, means)}
            row["label"] = label
            rows.append(row)
    df = pd.DataFrame(rows)
    return df[FEATURES].astype(float), df["label"]


@pytest.fixture
def synthetic_unlabeled():
    rng = np.random.default_rng(1)
    X = rng.normal(loc=[220, 15, 10, 30, 28, 10, 10, 2, 5], scale=[40, 8, 5, 15, 15, 8, 8, 5, 10], size=(30, len(FEATURES)))
    return pd.DataFrame(X, columns=FEATURES)
