import numpy as np
import pandas as pd
import pytest

from core.config import FEATURES, IPSS_WINDOW_DAYS
from core.data import enrich_ipss_features
from core.model import PatientModel
from core.query_strategy import UncertaintySampler


class TestPatientModel:
    def test_fit_and_predict(self, synthetic_labeled):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        assert model.trained
        preds = model.predict(X)
        assert len(preds) == len(y)
        assert set(preds).issubset(set(y))

    def test_predict_proba_shape(self, synthetic_labeled):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        proba = model.predict_proba(X)
        assert proba.shape == (len(X), len(model.classes_))
        assert np.allclose(proba.sum(axis=1), 1.0, atol=1e-5)

    def test_fit_rejects_single_class(self):
        X = pd.DataFrame(np.ones((10, len(FEATURES))), columns=FEATURES)
        y = ["normal"] * 10
        with pytest.raises(ValueError):
            PatientModel().fit(X, y)

    def test_save_and_load_roundtrip(self, synthetic_labeled, tmp_path):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        path = tmp_path / "m.joblib"
        model.save(path)
        reloaded = PatientModel().load(path)
        np.testing.assert_array_equal(model.predict(X), reloaded.predict(X))

    def test_predict_without_fit_raises(self):
        with pytest.raises(RuntimeError):
            PatientModel().predict(np.zeros((1, len(FEATURES))))


class TestUncertaintySampler:
    def _proba_fixture(self):
        return np.array(
            [
                [0.98, 0.01, 0.01],  # very certain
                [0.34, 0.33, 0.33],  # maximum entropy
                [0.55, 0.44, 0.01],  # small margin
                [0.80, 0.15, 0.05],
            ]
        )

    @pytest.mark.parametrize("strategy", ["entropy", "margin", "least_confident"])
    def test_scores_in_unit_interval(self, strategy):
        s = UncertaintySampler(strategy)
        scores = s.score_from_proba(self._proba_fixture())
        assert scores.shape == (4,)
        assert (scores >= 0).all() and (scores <= 1 + 1e-9).all()

    def test_entropy_max_at_uniform(self):
        s = UncertaintySampler("entropy")
        scores = s.score_from_proba(self._proba_fixture())
        # Row 1 is uniform → should dominate entropy
        assert scores.argmax() == 1

    def test_margin_picks_small_gap(self):
        # A distribution with two top classes tied (0.5/0.5) has zero margin
        # but only log2(2)/log2(3) ≈ 0.63 entropy — so margin ranks it highest
        # while entropy prefers a fully-uniform row. That's the point.
        proba = np.array(
            [
                [0.34, 0.33, 0.33],  # max entropy, margin = 0.99
                [0.50, 0.50, 0.00],  # margin = 1.0 (tied top), entropy lower
                [0.90, 0.05, 0.05],
            ]
        )
        assert UncertaintySampler("margin").score_from_proba(proba).argmax() == 1
        assert UncertaintySampler("entropy").score_from_proba(proba).argmax() == 0

    def test_query_returns_n_indices(self, synthetic_labeled, synthetic_unlabeled):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        s = UncertaintySampler("entropy")
        idx = s.query(model, synthetic_unlabeled, n=5)
        assert len(idx) == 5
        assert all(0 <= i < len(synthetic_unlabeled) for i in idx)
        assert len(set(idx)) == 5  # no duplicates

    def test_query_respects_available_samples(self, synthetic_labeled, synthetic_unlabeled):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        s = UncertaintySampler("entropy")
        idx = s.query(model, synthetic_unlabeled.head(3), n=10)
        assert len(idx) == 3

    def test_all_strategies_return_consistent_length(self, synthetic_labeled, synthetic_unlabeled):
        X, y = synthetic_labeled
        model = PatientModel().fit(X, y)
        for strat in ("entropy", "margin", "least_confident"):
            scores = UncertaintySampler(strat).score(model, synthetic_unlabeled)
            assert scores.shape == (len(synthetic_unlabeled),)

    def test_unknown_strategy_raises(self):
        with pytest.raises(ValueError):
            UncertaintySampler("unknown")  # type: ignore[arg-type]


class TestIpssEnrichment:
    def test_basic_match_within_window(self):
        meas = pd.DataFrame(
            [
                {"measurement_id": "m1", "patient_id": "P1", "created_date": "2024-01-15"},
            ]
        )
        ipss = pd.DataFrame(
            [
                {"patient_id": "P1", "submitted_at": "2024-01-01", "score": 10},
                {"patient_id": "P1", "submitted_at": "2024-01-14", "score": 20},
            ]
        )
        out = enrich_ipss_features(meas, ipss, window_days=IPSS_WINDOW_DAYS)
        assert out.loc[0, "ipss_score"] == 20
        assert out.loc[0, "ipss_delta_prev"] == 10  # 20 - 10
        assert out.loc[0, "ipss_days_since"] == pytest.approx(-1.0)

    def test_outside_window_stays_nan(self):
        meas = pd.DataFrame(
            [{"measurement_id": "m1", "patient_id": "P1", "created_date": "2024-06-01"}]
        )
        ipss = pd.DataFrame(
            [{"patient_id": "P1", "submitted_at": "2024-01-01", "score": 10}]
        )
        out = enrich_ipss_features(meas, ipss, window_days=30)
        assert np.isnan(out.loc[0, "ipss_score"])

    def test_no_prior_submission_delta_is_nan(self):
        meas = pd.DataFrame(
            [{"measurement_id": "m1", "patient_id": "P1", "created_date": "2024-01-15"}]
        )
        ipss = pd.DataFrame(
            [{"patient_id": "P1", "submitted_at": "2024-01-14", "score": 20}]
        )
        out = enrich_ipss_features(meas, ipss, window_days=30)
        assert out.loc[0, "ipss_score"] == 20
        assert np.isnan(out.loc[0, "ipss_delta_prev"])

    def test_empty_ipss_returns_nan_columns(self):
        meas = pd.DataFrame(
            [{"measurement_id": "m1", "patient_id": "P1", "created_date": "2024-01-15"}]
        )
        out = enrich_ipss_features(meas, pd.DataFrame(columns=["patient_id", "submitted_at", "score"]))
        assert "ipss_score" in out.columns
        assert np.isnan(out.loc[0, "ipss_score"])

    def test_cross_patient_no_leak(self):
        meas = pd.DataFrame(
            [{"measurement_id": "m1", "patient_id": "P1", "created_date": "2024-01-15"}]
        )
        ipss = pd.DataFrame(
            [{"patient_id": "P2", "submitted_at": "2024-01-15", "score": 30}]
        )
        out = enrich_ipss_features(meas, ipss, window_days=30)
        assert np.isnan(out.loc[0, "ipss_score"])
