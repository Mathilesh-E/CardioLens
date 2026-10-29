import os
import copy
import numpy as np
import pandas as pd
from typing import Dict, Any
from .schemas import SimulateRequest
from .explain import ModelManager, FEATURES

def run_simulation(req: SimulateRequest) -> Dict[str, Any]:
    mgr = ModelManager.get_instance()
    df = pd.read_csv(os.path.join("data", "processed", "subsample_15k.csv"))
    cal_lgb = mgr.models["LightGBM"]["cal"]
    
    n = len(df)
    X_orig = np.ascontiguousarray(df[FEATURES].values, dtype=np.float64)
    base_probs = cal_lgb.predict_proba(X_orig)[:, 1]
    base_cases_per_1000 = float(np.mean(base_probs) * 1000.0)
    
    # Apply stochastic / proportional interventions
    rng = np.random.RandomState(42)
    sim_df = df.copy()
    
    factor_impacts = {}
    
    # 1. Smoking reduction
    if req.smoking_reduction_pct > 0:
        smokers_idx = sim_df.index[sim_df["Smoker"] == 1.0].tolist()
        n_quit = int(len(smokers_idx) * (req.smoking_reduction_pct / 100.0))
        if n_quit > 0:
            quit_chosen = rng.choice(smokers_idx, size=n_quit, replace=False)
            temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            sim_df.loc[quit_chosen, "Smoker"] = 0.0
            new_temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            diff = (np.mean(cal_lgb.predict_proba(temp_X)[:, 1]) - np.mean(cal_lgb.predict_proba(new_temp_X)[:, 1])) * 1000.0
            factor_impacts["Smoking Cessation"] = round(float(diff), 2)
            
    # 2. Physical activity increase
    if req.phys_activity_increase_pct > 0:
        inact_idx = sim_df.index[sim_df["PhysActivity"] == 0.0].tolist()
        n_act = int(len(inact_idx) * (req.phys_activity_increase_pct / 100.0))
        if n_act > 0:
            act_chosen = rng.choice(inact_idx, size=n_act, replace=False)
            temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            sim_df.loc[act_chosen, "PhysActivity"] = 1.0
            new_temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            diff = (np.mean(cal_lgb.predict_proba(temp_X)[:, 1]) - np.mean(cal_lgb.predict_proba(new_temp_X)[:, 1])) * 1000.0
            factor_impacts["Physical Activity Adoption"] = round(float(diff), 2)
            
    # 3. BMI reduction
    if req.bmi_reduction_points > 0:
        temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
        sim_df["BMI"] = np.maximum(21.0, sim_df["BMI"] - req.bmi_reduction_points)
        new_temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
        diff = (np.mean(cal_lgb.predict_proba(temp_X)[:, 1]) - np.mean(cal_lgb.predict_proba(new_temp_X)[:, 1])) * 1000.0
        factor_impacts["Population BMI Reduction"] = round(float(diff), 2)
        
    # 4. High Blood Pressure control
    if req.high_bp_control_pct > 0:
        hbp_idx = sim_df.index[sim_df["HighBP"] == 1.0].tolist()
        n_hbp = int(len(hbp_idx) * (req.high_bp_control_pct / 100.0))
        if n_hbp > 0:
            hbp_chosen = rng.choice(hbp_idx, size=n_hbp, replace=False)
            temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            sim_df.loc[hbp_chosen, "HighBP"] = 0.0
            new_temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            diff = (np.mean(cal_lgb.predict_proba(temp_X)[:, 1]) - np.mean(cal_lgb.predict_proba(new_temp_X)[:, 1])) * 1000.0
            factor_impacts["Blood Pressure Management"] = round(float(diff), 2)
            
    # 5. High Cholesterol control
    if req.high_chol_control_pct > 0:
        hchol_idx = sim_df.index[sim_df["HighChol"] == 1.0].tolist()
        n_hchol = int(len(hchol_idx) * (req.high_chol_control_pct / 100.0))
        if n_hchol > 0:
            hchol_chosen = rng.choice(hchol_idx, size=n_hchol, replace=False)
            temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            sim_df.loc[hchol_chosen, "HighChol"] = 0.0
            new_temp_X = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
            diff = (np.mean(cal_lgb.predict_proba(temp_X)[:, 1]) - np.mean(cal_lgb.predict_proba(new_temp_X)[:, 1])) * 1000.0
            factor_impacts["Lipid / Statin Control"] = round(float(diff), 2)
            
    # Overall post-simulation risk
    X_sim = np.ascontiguousarray(sim_df[FEATURES].values, dtype=np.float64)
    sim_probs = cal_lgb.predict_proba(X_sim)[:, 1]
    sim_cases_per_1000 = float(np.mean(sim_probs) * 1000.0)
    cases_prevented = max(0.0, base_cases_per_1000 - sim_cases_per_1000)
    
    # 100-sample bootstrap interval for cases prevented
    boot_drops = []
    for _ in range(100):
        b_idx = rng.randint(0, n, size=n)
        b_base = np.mean(base_probs[b_idx]) * 1000.0
        b_sim = np.mean(sim_probs[b_idx]) * 1000.0
        boot_drops.append(max(0.0, b_base - b_sim))
        
    ci_low = float(np.percentile(boot_drops, 2.5))
    ci_high = float(np.percentile(boot_drops, 97.5))
    
    factor_breakdown = [
        {"factor": k, "cases_saved_per_1000": v}
        for k, v in factor_impacts.items()
    ]
    factor_breakdown.sort(key=lambda x: x["cases_saved_per_1000"], reverse=True)
    
    return {
        "base_cases_per_1000": round(base_cases_per_1000, 1),
        "projected_cases_per_1000": round(sim_cases_per_1000, 1),
        "cases_saved_per_1000": round(cases_prevented, 1),
        "saved_interval_95": [round(ci_low, 1), round(ci_high, 1)],
        "relative_reduction_pct": round(cases_prevented / base_cases_per_1000 * 100.0, 1) if base_cases_per_1000 > 0 else 0.0,
        "factor_breakdown": factor_breakdown,
        "disclaimer": "Associational epidemiological projection from 2015 CDC survey data assuming independent counterfactual shifts; not clinical trial evidence."
    }
