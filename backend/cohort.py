import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from .schemas import FilterCriterion
from .explain import ModelManager, FEATURES

def wilson_interval(pos, total):
    if total == 0:
        return 0.0, 0.0, 0.0
    z = 1.959964
    p = pos / total
    denom = 1 + z**2 / total
    centre = (p + z**2 / (2 * total)) / denom
    margin = (z * np.sqrt(p * (1 - p) / total + z**2 / (4 * total**2))) / denom
    return round(float(p), 4), round(float(max(0.0, centre - margin)), 4), round(float(min(1.0, centre + margin)), 4)

def analyze_cohort(filters: List[FilterCriterion]) -> Dict[str, Any]:
    mgr = ModelManager.get_instance()
    df = pd.read_csv(os.path.join("data", "processed", "subsample_15k.csv"))
    target = "HeartDiseaseorAttack"
    
    mask = pd.Series(True, index=df.index)
    for flt in filters:
        col = flt.feature
        if col not in df.columns:
            continue
        if flt.min_val is not None:
            mask &= (df[col] >= flt.min_val)
        if flt.max_val is not None:
            mask &= (df[col] <= flt.max_val)
        if flt.exact_val is not None:
            if isinstance(flt.exact_val, list):
                mask &= (df[col].isin(flt.exact_val))
            else:
                mask &= (df[col] == flt.exact_val)
                
    cohort_df = df[mask].copy()
    cohort_size = int(len(cohort_df))
    total_pop = int(len(df))
    
    if cohort_size == 0:
        return {
            "cohort_size": 0,
            "population_size": total_pop,
            "population_fraction": 0.0,
            "observed_cases": 0,
            "observed_rate": 0.0,
            "observed_rate_pct": 0.0,
            "ci_lower_pct": 0.0,
            "ci_upper_pct": 0.0,
            "mean_model_risk_pct": 0.0,
            "population_observed_pct": float(round(df[target].mean() * 100, 2)),
            "relative_risk": 0.0,
            "histogram": [],
            "age_breakdown": [],
            "comorbidity_breakdown": [],
            "sample_patients": [],
            "shap_comparison": [],
            "empty": True
        }
        
    pos_count = int(cohort_df[target].sum())
    obs_rate, ci_low, ci_high = wilson_interval(pos_count, cohort_size)
    
    # Model predictions on cohort
    X_cohort = np.ascontiguousarray(cohort_df[FEATURES].values, dtype=np.float64)
    cal_lgb = mgr.models["LightGBM"]["cal"]
    cohort_probs = cal_lgb.predict_proba(X_cohort)[:, 1]
    mean_model_risk = float(np.mean(cohort_probs))
    
    # Population benchmark
    pop_obs = float(df[target].mean())
    pop_probs = cal_lgb.predict_proba(np.ascontiguousarray(df[FEATURES].values, dtype=np.float64))[:, 1]
    pop_model_risk = float(np.mean(pop_probs))
    
    # Risk distribution histograms (6 bins: 0-10, 10-20, 20-30, 30-40, 40-50, 50+)
    bins = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0]
    bin_labels = ["0-10%", "10-20%", "20-30%", "30-40%", "40-50%", ">50%"]
    
    cohort_counts, _ = np.histogram(cohort_probs, bins=bins)
    pop_counts, _ = np.histogram(pop_probs, bins=bins)
    
    hist_data = [
        {
            "bin": bin_labels[i],
            "cohort_pct": round(float(cohort_counts[i] / cohort_size * 100), 1),
            "pop_pct": round(float(pop_counts[i] / total_pop * 100), 1)
        }
        for i in range(len(bin_labels))
    ]
    
    # Top SHAP drivers within cohort versus overall
    raw_lgb = mgr.models["LightGBM"]["raw"]
    cohort_contrib = raw_lgb.booster_.predict(X_cohort, pred_contrib=True)
    cohort_shaps = np.mean(cohort_contrib[:, :len(FEATURES)], axis=0)
    
    # Overall SHAP from test matrix
    overall_shaps = np.mean(joblib.load(os.path.join("artifacts", "shap_test_matrix.joblib")), axis=0)
    
    shap_comparison = []
    for i, feat in enumerate(FEATURES):
        meta = mgr.feature_meta.get(feat, {})
        c_shap = float(cohort_shaps[i])
        o_shap = float(overall_shaps[i])
        shap_comparison.append({
            "feature": feat,
            "label": meta.get("label", feat),
            "cohort_shap": round(c_shap, 4),
            "overall_shap": round(o_shap, 4),
            "delta": round(c_shap - o_shap, 4)
        })
    shap_comparison.sort(key=lambda x: abs(x["cohort_shap"]), reverse=True)
    
    # Age breakdown for cohort
    age_bins = [
        {"name": "Young (18-39)", "min": 1, "max": 4},
        {"name": "Middle-Aged (40-54)", "min": 5, "max": 7},
        {"name": "Older Adult (55-64)", "min": 8, "max": 10},
        {"name": "Senior (65+)", "min": 11, "max": 13}
    ]
    age_breakdown = []
    for ab in age_bins:
        ab_mask = (cohort_df["Age"] >= ab["min"]) & (cohort_df["Age"] <= ab["max"])
        sub_cnt = int(ab_mask.sum())
        if sub_cnt > 0:
            sub_pos = int(cohort_df.loc[ab_mask, target].sum())
            sub_probs = cohort_probs[ab_mask.values]
            age_breakdown.append({
                "bracket": ab["name"],
                "total": sub_cnt,
                "cases": sub_pos,
                "observed_rate_pct": round(float(sub_pos / sub_cnt * 100), 1),
                "model_risk_pct": round(float(np.mean(sub_probs) * 100), 1)
            })

    # Comorbidity count (HighBP, HighChol, Smoker, Diabetes, Stroke)
    comorb_sum = (
        (cohort_df["HighBP"] == 1).astype(int) +
        (cohort_df["HighChol"] == 1).astype(int) +
        (cohort_df["Smoker"] == 1).astype(int) +
        (cohort_df["Diabetes"] > 0).astype(int) +
        (cohort_df["Stroke"] == 1).astype(int)
    )
    comorb_counts = comorb_sum.value_counts().to_dict()
    comorbidity_breakdown = [
        {"factors": f"{k} Factors" if k < 4 else "4+ Factors", "count": int(comorb_counts.get(k, 0)), "pct": round(float(comorb_counts.get(k, 0) / cohort_size * 100), 1)}
        for k in range(5)
    ]

    # Sample matching patients (first 25 rows with raw features and calibrated risk)
    sample_patients = []
    for idx_num, (orig_idx, row) in enumerate(cohort_df.head(25).iterrows()):
        patient_prob = float(cohort_probs[idx_num])
        sample_patients.append({
            "patient_id": int(orig_idx),
            "calibrated_risk_pct": round(patient_prob * 100, 1),
            "diagnosed": int(row[target]),
            "Age": int(row["Age"]),
            "Sex": "Male" if row["Sex"] == 1 else "Female",
            "BMI": round(float(row["BMI"]), 1),
            "HighBP": bool(row["HighBP"]),
            "HighChol": bool(row["HighChol"]),
            "Smoker": bool(row["Smoker"]),
            "Diabetes": int(row["Diabetes"]),
            "GenHlth": int(row["GenHlth"]),
            "PhysActivity": bool(row["PhysActivity"]),
            "raw_features": {f: float(row[f]) for f in FEATURES}
        })

    return {
        "cohort_size": cohort_size,
        "population_size": total_pop,
        "population_fraction": round(cohort_size / total_pop * 100, 2),
        "observed_cases": pos_count,
        "observed_rate": round(obs_rate, 4),
        "observed_rate_pct": round(obs_rate * 100, 2),
        "ci_lower_pct": round(ci_low * 100, 2),
        "ci_upper_pct": round(ci_high * 100, 2),
        "mean_model_risk_pct": round(mean_model_risk * 100, 2),
        "population_observed_pct": round(pop_obs * 100, 2),
        "relative_risk": round(obs_rate / pop_obs, 2) if pop_obs > 0 else 1.0,
        "histogram": hist_data,
        "age_breakdown": age_breakdown,
        "comorbidity_breakdown": comorbidity_breakdown,
        "sample_patients": sample_patients,
        "shap_comparison": shap_comparison[:10],
        "empty": False
    }
