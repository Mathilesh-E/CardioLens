import pytest
import numpy as np
import pandas as pd
from backend.explain import ModelManager, predict_single, FEATURES
from backend.counterfactual import generate_counterfactuals
from backend.cohort import analyze_cohort
from backend.schemas import FilterCriterion

def test_model_manager_loading():
    mgr = ModelManager.get_instance()
    assert "LightGBM" in mgr.models
    assert "XGBoost" in mgr.models
    assert "Random Forest" in mgr.models
    assert "Logistic Regression" in mgr.models
    assert len(mgr.bootstrap_ensemble) == 30
    assert len(mgr.X_test) == 2250

def test_shap_additivity():
    # Verify that base_value + sum(shap_values) == raw margin for LightGBM
    mgr = ModelManager.get_instance()
    lgb_raw = mgr.models["LightGBM"]["raw"]
    
    test_profile = {f: float(mgr.X_test[0, i]) for i, f in enumerate(FEATURES)}
    x = np.array([[test_profile[f] for f in FEATURES]], dtype=np.float64)
    
    contrib = lgb_raw.booster_.predict(x, pred_contrib=True)[0]
    raw_margin = lgb_raw.booster_.predict(x, raw_score=True)[0]
    
    shap_sum = np.sum(contrib)
    np.testing.assert_allclose(shap_sum, raw_margin, atol=1e-5)

def test_monotonic_sanity():
    # A 75-year-old with HighBP, HighChol, Smoker, GenHlth=5 (Poor) must score higher
    # than a 22-year-old healthy nonsmoker with GenHlth=1 (Excellent)
    healthy_young = {f: 0.0 for f in FEATURES}
    healthy_young["Age"] = 1.0       # 18-24
    healthy_young["GenHlth"] = 1.0    # Excellent
    healthy_young["BMI"] = 21.0
    healthy_young["PhysActivity"] = 1.0
    
    unhealthy_older = {f: 0.0 for f in FEATURES}
    unhealthy_older["Age"] = 12.0     # 75-79
    unhealthy_older["GenHlth"] = 5.0  # Poor
    unhealthy_older["HighBP"] = 1.0
    unhealthy_older["HighChol"] = 1.0
    unhealthy_older["Smoker"] = 1.0
    unhealthy_older["BMI"] = 34.0
    
    p_healthy = predict_single(healthy_young, model_name="LightGBM")["calibrated_risk"]
    p_unhealthy = predict_single(unhealthy_older, model_name="LightGBM")["calibrated_risk"]
    
    assert p_unhealthy > p_healthy, f"Unhealthy risk ({p_unhealthy}) should exceed healthy risk ({p_healthy})"
    assert p_unhealthy >= 0.25, f"High-risk profile should be elevated, got {p_unhealthy}"

def test_prediction_latency():
    import time
    profile = {f: 1.0 for f in FEATURES}
    t0 = time.time()
    res = predict_single(profile, model_name="LightGBM")
    elapsed_ms = (time.time() - t0) * 1000.0
    assert elapsed_ms < 150.0, f"Latency ({elapsed_ms} ms) exceeded 150ms requirement"
    assert "calibrated_risk" in res
    assert "uncertainty_band" in res
    assert "contributions" in res

def test_counterfactual_plans_lower_risk():
    high_risk_profile = {f: 0.0 for f in FEATURES}
    high_risk_profile["Age"] = 10.0
    high_risk_profile["HighBP"] = 1.0
    high_risk_profile["HighChol"] = 1.0
    high_risk_profile["Smoker"] = 1.0
    high_risk_profile["BMI"] = 32.0
    high_risk_profile["Diabetes"] = 2.0
    high_risk_profile["PhysActivity"] = 0.0
    high_risk_profile["GenHlth"] = 3.0
    
    res = generate_counterfactuals(high_risk_profile, model_name="LightGBM")
    current_risk = res["current_risk"]
    plans = res["plans"]
    
    assert len(plans) > 0, "Counterfactual engine should return candidate plans"
    for p in plans:
        assert p["resulting_risk"] < current_risk, f"Plan failed to lower risk: {p['resulting_risk']} vs {current_risk}"
        assert p["risk_reduction_pct"] > 0

def test_cohort_filters_match_pandas():
    df = pd.read_csv("data/processed/subsample_15k.csv")
    expected_count = len(df[(df["Sex"] == 1.0) & (df["Smoker"] == 1.0)])
    
    filters = [
        FilterCriterion(feature="Sex", exact_val=1.0),
        FilterCriterion(feature="Smoker", exact_val=1.0)
    ]
    res = analyze_cohort(filters)
    assert res["cohort_size"] == expected_count, f"Cohort size {res['cohort_size']} != pandas {expected_count}"
