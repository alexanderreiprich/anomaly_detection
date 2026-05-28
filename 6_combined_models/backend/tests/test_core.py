import numpy as np
import pandas as pd
import pytest

from core.config import FEATURES, IPSS_WINDOW_DAYS, TIMESERIES_FEATURES
from core.data import (
    enrich_ipss_features,
    enrich_timeseries_features,
    extract_curve_features,
)
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


class TestCurveFeatures:
    def _smooth_curve(self):
        # Asymmetric single-peaked curve at dt=0.25 s, rises to 20 ml/s, decays
        t = np.arange(0, 30, 0.25)
        rise_n = 20
        q = np.zeros_like(t)
        q[:rise_n] = np.linspace(0, 20, rise_n, endpoint=False)
        decay_len = 60
        q[rise_n:rise_n + decay_len] = 20 * (1 - np.linspace(0, 1, decay_len)) ** 1.5
        return t, q

    def test_extract_returns_all_keys(self):
        t, q = self._smooth_curve()
        feats = extract_curve_features(t, q)
        assert set(feats.keys()) == set(TIMESERIES_FEATURES)
        for v in feats.values():
            assert not np.isnan(v)

    def test_extract_plateau_ratio_in_unit_interval(self):
        t, q = self._smooth_curve()
        feats = extract_curve_features(t, q)
        assert 0.0 <= feats["plateau_ratio"] <= 1.0

    def test_extract_short_input_returns_nan(self):
        feats = extract_curve_features([0.0, 0.25], [0.0, 0.0])
        assert all(np.isnan(v) for v in feats.values())

    def test_extract_n_peaks_at_least_one(self):
        t, q = self._smooth_curve()
        feats = extract_curve_features(t, q)
        assert feats["n_peaks"] >= 1

    def test_enrich_attaches_columns(self):
        t, q = self._smooth_curve()
        meas = pd.DataFrame([{"measurement_id": "m1", "patient_id": "P1"}])
        ts = pd.DataFrame(
            {"measurement_id": ["m1"] * len(t), "time": t, "uro_flow": q}
        )
        out = enrich_timeseries_features(meas, ts)
        for f in TIMESERIES_FEATURES:
            assert f in out.columns
            assert not np.isnan(out.loc[0, f])

    def test_enrich_no_match_stays_nan(self):
        meas = pd.DataFrame([{"measurement_id": "m1"}])
        ts = pd.DataFrame(columns=["measurement_id", "time", "uro_flow"])
        out = enrich_timeseries_features(meas, ts)
        for f in TIMESERIES_FEATURES:
            assert np.isnan(out.loc[0, f])

    def test_enrich_unknown_measurement_stays_nan(self):
        t, q = self._smooth_curve()
        meas = pd.DataFrame([{"measurement_id": "m_other"}])
        ts = pd.DataFrame(
            {"measurement_id": ["m1"] * len(t), "time": t, "uro_flow": q}
        )
        out = enrich_timeseries_features(meas, ts)
        for f in TIMESERIES_FEATURES:
            assert np.isnan(out.loc[0, f])
