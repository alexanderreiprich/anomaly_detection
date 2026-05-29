import numpy as np
import pandas as pd
import pytest

from core import biomarker_data as bd
from core.config import (
    BIOMARKER_CATS,
    BIOMARKER_FEATURES,
    UROFLOW_FEATURES,
    apply_clinical_rule,
)
from core.model import PatientModel
from core.registry import get_spec


class TestEncoding:
    def test_encode_biomarker(self):
        assert bd.encode_biomarker("POSITIVE") == 1.0
        assert bd.encode_biomarker("NEGATIVE") == 0.0
        assert np.isnan(bd.encode_biomarker("NO_DATA"))
        assert np.isnan(bd.encode_biomarker(None))

    def test_range_midpoint(self):
        assert bd.range_midpoint("20-29") == 24.5
        assert bd.range_midpoint("0-10") == 5.0
        assert np.isnan(bd.range_midpoint("unparseable"))
        assert np.isnan(bd.range_midpoint(None))
        assert np.isnan(bd.range_midpoint(np.nan))

    def test_ph_abnormality(self):
        assert bd.ph_abnormality(6.5) == 0.0   # inside the normal band
        assert bd.ph_abnormality(4.0) == 0.0   # lower boundary
        assert bd.ph_abnormality(8.5) == 0.0   # upper boundary
        assert bd.ph_abnormality(3.0) == 1.0   # acidic: 4.0 - 3.0
        assert bd.ph_abnormality(9.5) == 1.0   # alkaline: 9.5 - 8.5
        assert np.isnan(bd.ph_abnormality(None))
        assert np.isnan(bd.ph_abnormality(np.nan))


class TestStreaks:
    def test_streak_for_series(self):
        seq = [1, 1, 0, 1, 1, 1, 0]
        np.testing.assert_array_equal(
            bd._streak_for_series(seq), [1, 2, 0, 1, 2, 3, 0]
        )

    def _frame(self, rows):
        # rows: list of (patient_id, created_date, leukocytes_value)
        recs = []
        for pid, date, leuk in rows:
            rec = {b: "NEGATIVE" for b in BIOMARKER_CATS}
            rec.update(patient_id=pid, created_date=date, leukocytes=leuk)
            recs.append(rec)
        return pd.DataFrame(recs)

    def test_sequential_chronological_per_patient(self):
        df = self._frame(
            [
                ("P1", "2024-01-03", "POSITIVE"),  # out of order on purpose
                ("P1", "2024-01-01", "POSITIVE"),
                ("P1", "2024-01-02", "POSITIVE"),
            ]
        )
        out = bd._add_sequential_features(df)
        # chronological order is rows[1], rows[2], rows[0] -> streaks 1,2,3
        assert out.loc[1, "leukocytes_streak"] == 1
        assert out.loc[2, "leukocytes_streak"] == 2
        assert out.loc[0, "leukocytes_streak"] == 3
        assert out.loc[0, "n_prior_measurements"] == 2

    def test_cross_patient_no_leak(self):
        df = self._frame(
            [
                ("P1", "2024-01-01", "POSITIVE"),
                ("P2", "2024-01-02", "POSITIVE"),
            ]
        )
        out = bd._add_sequential_features(df)
        assert out.loc[0, "leukocytes_streak"] == 1
        assert out.loc[1, "leukocytes_streak"] == 1  # P2's first, not 2
        assert out.loc[1, "n_prior_measurements"] == 0


class TestClinicalRules:
    def test_many_positives_critical(self):
        label, conf, name = apply_clinical_rule({"n_positive": 4, "max_pos_streak": 0, "ph": 6.0})
        assert label == "critical" and name == "many_positives" and conf == 1.0

    def test_positive_streak_warning(self):
        label, conf, name = apply_clinical_rule({"n_positive": 1, "max_pos_streak": 2, "ph": 6.0})
        assert label == "warning" and name == "positive_streak"

    def test_extreme_ph_warning(self):
        assert apply_clinical_rule({"n_positive": 0, "max_pos_streak": 0, "ph": 3.5})[0] == "warning"
        assert apply_clinical_rule({"n_positive": 0, "max_pos_streak": 0, "ph": 9.0})[2] == "extreme_ph"

    def test_no_rule_fires(self):
        assert apply_clinical_rule({"n_positive": 1, "max_pos_streak": 1, "ph": 6.5}) == (None, None, None)

    def test_escalation_only(self):
        from service.api import _rule_escalates

        # rule raises severity -> override
        assert _rule_escalates("normal", "warning") is True
        assert _rule_escalates("warning", "critical") is True
        # rule would downgrade a more severe model prediction -> keep model
        assert _rule_escalates("critical", "warning") is False
        assert _rule_escalates("warning", "warning") is False
        # 'invalid' is not a severity -> never overridden by a rule
        assert _rule_escalates("invalid", "critical") is False

    def test_nan_values_skip_rule(self):
        assert apply_clinical_rule({"n_positive": np.nan, "max_pos_streak": np.nan, "ph": np.nan}) == (
            None, None, None,
        )


class TestRegistry:
    def test_feature_counts(self):
        assert len(get_spec("uroflow").features) == 14
        assert len(get_spec("biomarker").features) == 18
        assert get_spec("biomarker").clinical_rules is True
        assert get_spec("uroflow").clinical_rules is False

    def test_unknown_model_raises(self):
        with pytest.raises(ValueError):
            get_spec("does_not_exist")

    def test_feature_sets_disjoint_paths(self):
        assert get_spec("uroflow").model_path != get_spec("biomarker").model_path

    def test_write_labels_present(self):
        assert callable(get_spec("uroflow").write_labels)
        assert callable(get_spec("biomarker").write_labels)


class TestPermutationImportance:
    def _data(self, n=60):
        # leukocytes fully determines the label; every other feature is noise.
        rng = np.random.default_rng(0)
        rows = []
        for _ in range(n):
            row = {f: float(rng.normal(0, 0.1)) for f in BIOMARKER_FEATURES}
            if rng.random() < 0.5:
                row["leukocytes"], label = 1.0, "critical"
            else:
                row["leukocytes"], label = 0.0, "normal"
            rows.append({**row, "label": label})
        df = pd.DataFrame(rows)
        return df[BIOMARKER_FEATURES].astype(float), df["label"]

    def test_informative_feature_dominates(self):
        from service.api import _permutation_importances

        X, y = self._data()
        perm, score, n, k = _permutation_importances(get_spec("biomarker"), X, y)
        assert n > 0 and score is not None and k >= 2
        # shuffling the determining feature collapses accuracy -> top importance
        assert perm[0].feature == "leukocytes"
        assert perm[0].importance > 0.1
        # a pure-noise feature the model never splits on contributes ~nothing
        noise = next(p for p in perm if p.feature == "glucose")
        assert noise.importance < 0.05

    def test_too_little_data(self):
        from service.api import _permutation_importances

        X, y = self._data(n=6)
        assert _permutation_importances(get_spec("biomarker"), X, y) == ([], None, 0, 0)


class TestModelWithBiomarkerFeatures:
    def _synthetic(self):
        rng = np.random.default_rng(0)
        rows = []
        for label, base in [("normal", 0.0), ("warning", 0.5), ("critical", 1.0)]:
            for _ in range(30):
                row = {f: float(base + rng.normal(0, 0.3)) for f in BIOMARKER_FEATURES}
                row["label"] = label
                rows.append(row)
        df = pd.DataFrame(rows)
        return df[BIOMARKER_FEATURES].astype(float), df["label"]

    def test_fit_predict_save_load_roundtrip(self, tmp_path):
        X, y = self._synthetic()
        model = PatientModel(features=BIOMARKER_FEATURES, max_depth=4).fit(X, y)
        assert model.features == BIOMARKER_FEATURES
        path = tmp_path / "bio.joblib"
        model.save(path)
        reloaded = PatientModel().load(path)
        assert reloaded.features == BIOMARKER_FEATURES
        np.testing.assert_array_equal(model.predict(X), reloaded.predict(X))

    def test_default_features_unchanged(self):
        assert PatientModel().features == UROFLOW_FEATURES


class TestBuildFeatureFrame:
    @pytest.fixture
    def patched(self, monkeypatch):
        biomarkers = pd.DataFrame(
            [
                # P1: prior POSITIVE (labeled), then POSITIVE (unlabeled) -> streak 2
                dict(measurement_id="m1", patient_id="P1", leukocytes="POSITIVE",
                     nitrite="NEGATIVE", protein="NEGATIVE", blood="NEGATIVE",
                     glucose="NEGATIVE", ph=6.0, label="warning"),
                dict(measurement_id="m2", patient_id="P1", leukocytes="POSITIVE",
                     nitrite="NEGATIVE", protein="NEGATIVE", blood="NEGATIVE",
                     glucose="NEGATIVE", ph=6.0, label=None),
                # P2: all NO_DATA, unlabeled
                dict(measurement_id="m3", patient_id="P2", leukocytes="NO_DATA",
                     nitrite="NO_DATA", protein="NO_DATA", blood="NO_DATA",
                     glucose="NO_DATA", ph=7.0, label=None),
            ]
        )
        measurements = pd.DataFrame(
            [
                dict(measurement_id="m1", created_date="2024-01-01"),
                dict(measurement_id="m2", created_date="2024-01-05"),
                dict(measurement_id="m3", created_date="2024-01-02"),
            ]
        )
        patients = pd.DataFrame(
            [
                dict(patient_id="P1", age_range="20-29", height_range="170-179", weight_range="60-69"),
                dict(patient_id="P2", age_range="40-49", height_range="180-189", weight_range="80-89"),
            ]
        )
        frames = {"biomarkers": biomarkers, "measurements": measurements, "patients": patients}
        monkeypatch.setattr(bd, "_fetch_all", lambda client, table, columns: frames[table])
        monkeypatch.setattr(bd, "get_supabase_client", lambda: object())
        return frames

    def test_labeled_split_and_features(self, patched):
        X, y = bd.get_labeled_biomarkers()
        assert list(X.columns) == BIOMARKER_FEATURES
        assert len(y) == 1 and y.iloc[0] == "warning"

    def test_unlabeled_streak_uses_full_history(self, patched):
        df = bd.get_unlabeled_biomarkers()
        m2 = df[df["measurement_id"] == "m2"].iloc[0]
        # m2 is P1's 2nd POSITIVE in a row -> streak 2, prior count 1
        assert m2["leukocytes_streak"] == 2
        assert m2["n_prior_measurements"] == 1
        assert m2["max_pos_streak"] == 2

    def test_no_data_encodes_to_nan(self, patched):
        df = bd.get_unlabeled_biomarkers()
        m3 = df[df["measurement_id"] == "m3"].iloc[0]
        assert np.isnan(m3["leukocytes"])  # NO_DATA -> NaN
        assert m3["n_no_data"] == 5

    def test_demographics_midpoints(self, patched):
        df = bd.get_unlabeled_biomarkers()
        m3 = df[df["measurement_id"] == "m3"].iloc[0]
        assert m3["age_mid"] == 44.5
        assert m3["height_mid"] == 184.5

    def test_detail_payload(self, patched):
        detail = bd.get_biomarker_detail("m2")
        assert detail["measurement_id"] == "m2"
        leuk = next(m for m in detail["markers"] if m["name"] == "leukocytes")
        assert leuk["value"] == "POSITIVE" and leuk["streak"] == 2
        assert detail["age_mid"] == 24.5

    def test_mark_no_data_invalid(self, patched, monkeypatch):
        captured = {}

        def fake_write(rows, client=None, label_source="model"):
            captured["rows"] = rows
            captured["source"] = label_source
            return len(rows)

        monkeypatch.setattr(bd, "write_biomarker_labels", fake_write)
        n = bd.mark_no_data_invalid()
        # only m3 (all five markers NO_DATA, unlabeled) is marked; m2 has a
        # POSITIVE reading and the labeled m1 is excluded from the pool.
        assert n == 1
        assert captured["rows"] == [
            {"measurement_id": "m3", "label": "invalid", "confidence": 1.0}
        ]
        assert captured["source"] == bd.NO_DATA_LABEL_SOURCE
