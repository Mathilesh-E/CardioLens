import copy
from typing import Dict, List, Any, Optional
from .explain import predict_single, FEATURES, ModelManager

MODIFIABLE_STEPS = {
    "HighBP": {
        "step_fn": lambda v: 0.0 if v == 1.0 else None,
        "description": "Achieve blood pressure control (e.g. antihypertensive medication & sodium reduction)",
        "unit_change": "1 -> 0"
    },
    "HighChol": {
        "step_fn": lambda v: 0.0 if v == 1.0 else None,
        "description": "Lower blood cholesterol (e.g. statin therapy & dietary modification)",
        "unit_change": "1 -> 0"
    },
    "Smoker": {
        "step_fn": lambda v: 0.0 if v == 1.0 else None,
        "description": "Smoking cessation / tobacco abstinence",
        "unit_change": "1 -> 0"
    },
    "PhysActivity": {
        "step_fn": lambda v: 1.0 if v == 0.0 else None,
        "description": "Adopt regular aerobic physical activity (≥150 min/week moderate exercise)",
        "unit_change": "0 -> 1"
    },
    "BMI": {
        "step_fn": lambda v: max(22.0, v - 2.5) if v > 24.0 else None,
        "description": "Weight reduction (-2.5 BMI points via caloric adjustment)",
        "unit_change": "-2.5 kg/m²"
    },
    "Diabetes": {
        "step_fn": lambda v: (v - 1.0) if v > 0.0 else None,
        "description": "Intensive glycemic management (reduce diabetes/prediabetes severity)",
        "unit_change": "-1 stage"
    },
    "Veggies": {
        "step_fn": lambda v: 1.0 if v == 0.0 else None,
        "description": "Increase dietary vegetable intake to 1+ servings daily",
        "unit_change": "0 -> 1"
    },
    "Fruits": {
        "step_fn": lambda v: 1.0 if v == 0.0 else None,
        "description": "Increase dietary fruit intake to 1+ servings daily",
        "unit_change": "0 -> 1"
    },
    "HvyAlcoholConsump": {
        "step_fn": lambda v: 0.0 if v == 1.0 else None,
        "description": "Curtail heavy alcohol intake to moderate/abstinent levels",
        "unit_change": "1 -> 0"
    },
    "CholCheck": {
        "step_fn": lambda v: 1.0 if v == 0.0 else None,
        "description": "Undergo lipid panel screening every 5 years",
        "unit_change": "0 -> 1"
    }
}

def generate_counterfactuals(
    current_profile: Dict[str, float],
    target_risk: Optional[float] = None,
    target_mode: str = "below_threshold",
    allowed_features: Optional[List[str]] = None,
    model_name: str = "LightGBM"
) -> Dict[str, Any]:
    # Baseline prediction
    mgr = ModelManager.get_instance()
    baseline_pred = predict_single(current_profile, model_name=model_name)
    current_risk = baseline_pred["calibrated_risk"]
    threshold = baseline_pred["threshold"]
    
    if target_risk is None or target_mode == "below_threshold":
        target = max(0.04, threshold - 0.02)
    else:
        target = target_risk
        
    if allowed_features is None:
        allowed_features = list(MODIFIABLE_STEPS.keys())
    else:
        allowed_features = [f for f in allowed_features if f in MODIFIABLE_STEPS]
        
    # If already below target, return trivial status
    if current_risk <= target:
        return {
            "current_risk": current_risk,
            "target_risk": target,
            "threshold": threshold,
            "target_met_already": True,
            "plans": [],
            "disclaimer": "Current estimated risk is already at or below target."
        }
        
    # Search for candidate actions
    valid_actions = []
    for feat in allowed_features:
        curr_val = float(current_profile.get(feat, 0.0))
        spec = MODIFIABLE_STEPS[feat]
        new_val = spec["step_fn"](curr_val)
        if new_val is not None and new_val != curr_val:
            valid_actions.append({
                "feature": feat,
                "current_val": curr_val,
                "new_val": new_val,
                "description": spec["description"],
                "unit_change": spec["unit_change"]
            })
            
    plans = []
    
    # 1. Single action plans
    for act in valid_actions:
        temp_prof = copy.deepcopy(current_profile)
        temp_prof[act["feature"]] = act["new_val"]
        pred = predict_single(temp_prof, model_name=model_name)
        new_risk = pred["calibrated_risk"]
        drop = current_risk - new_risk
        if drop >= 0.001:
            meta_label = mgr.feature_meta.get(act["feature"], {}).get("label", act["feature"])
            plans.append({
                "name": f"Action Step: Improve {meta_label}",
                "actions": [act],
                "step_count": 1,
                "resulting_risk": round(new_risk, 4),
                "resulting_risk_pct": round(new_risk * 100, 2),
                "risk_reduction_pct": round(drop * 100, 2),
                "achieves_target": bool(new_risk <= target),
                "modified_profile": temp_prof
            })
        
    # 2. Greedy search for multi-action combos (up to 4 steps)
    accum_profile = copy.deepcopy(current_profile)
    accum_actions = []
    rem_actions = list(valid_actions)
    
    running_risk = current_risk
    
    while rem_actions and len(accum_actions) < 4:
        best_act = None
        best_risk = running_risk
        best_prof = None
        
        for act in rem_actions:
            test_prof = copy.deepcopy(accum_profile)
            test_prof[act["feature"]] = act["new_val"]
            p = predict_single(test_prof, model_name=model_name)
            if p["calibrated_risk"] < best_risk:
                best_risk = p["calibrated_risk"]
                best_act = act
                best_prof = test_prof
                
        if best_act is None or (running_risk - best_risk) < 0.001:
            break
            
        rem_actions.remove(best_act)
        accum_actions.append(best_act)
        accum_profile = best_prof
        running_risk = best_risk
        
        # Add cumulative plan
        if len(accum_actions) > 1:
            plans.append({
                "name": f"Comprehensive Intervention ({len(accum_actions)} changes)",
                "actions": copy.deepcopy(accum_actions),
                "step_count": len(accum_actions),
                "resulting_risk": round(running_risk, 4),
                "resulting_risk_pct": round(running_risk * 100, 2),
                "risk_reduction_pct": round((current_risk - running_risk) * 100, 2),
                "achieves_target": bool(running_risk <= target),
                "modified_profile": copy.deepcopy(accum_profile)
            })
            
    # Sort plans: prioritize achieving target, then maximum risk reduction with fewer steps
    plans.sort(key=lambda p: (-int(p["achieves_target"]), p["resulting_risk"], p["step_count"]))
    
    # Return top 5 distinct plans
    unique_plans = []
    seen_feats = set()
    for p in plans:
        f_key = tuple(sorted([a["feature"] for a in p["actions"]]))
        if f_key not in seen_feats:
            seen_feats.add(f_key)
            unique_plans.append(p)
            if len(unique_plans) >= 5:
                break
                
    return {
        "current_risk": round(current_risk, 4),
        "target_risk": round(target, 4),
        "threshold": round(threshold, 4),
        "target_met_already": False,
        "plans": unique_plans,
        "disclaimer": "Educational research simulation: these counterfactual changes represent statistical associations observed in cross-sectional 2015 CDC survey data, NOT causal clinical guarantees or medical advice."
    }
