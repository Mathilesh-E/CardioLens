import os
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple
from functools import lru_cache

# Features in canonical order
FEATURES = [
    'HighBP', 'HighChol', 'CholCheck', 'BMI', 'Smoker', 'Stroke', 'Diabetes',
    'PhysActivity', 'Fruits', 'Veggies', 'HvyAlcoholConsump', 'AnyHealthcare',
    'NoDocbcCost', 'GenHlth', 'MentHlth', 'PhysHlth', 'DiffWalk', 'Sex',
    'Age', 'Education', 'Income'
]

class ModelManager:
    _instance = None

    def __init__(self):
        print("Initializing ModelManager and loading models...")
        models_dir = os.path.join("artifacts", "models")
        
        # Load models
        self.models = {
            "LightGBM": {
                "raw": joblib.load(os.path.join(models_dir, "lightgbm_raw.joblib")),
                "cal": joblib.load(os.path.join(models_dir, "lightgbm_cal.joblib"))
            },
            "XGBoost": {
                "raw": joblib.load(os.path.join(models_dir, "xgboost_raw.joblib")),
                "cal": joblib.load(os.path.join(models_dir, "xgboost_cal.joblib"))
            },
            "Random Forest": {
                "raw": joblib.load(os.path.join(models_dir, "random_forest_raw.joblib")),
                "cal": joblib.load(os.path.join(models_dir, "random_forest_cal.joblib"))
            },
            "Logistic Regression": {
                "raw": joblib.load(os.path.join(models_dir, "logistic_regression_raw.joblib")),
                "cal": joblib.load(os.path.join(models_dir, "logistic_regression_cal.joblib"))
            }
        }
        
        self.bootstrap_ensemble = joblib.load(os.path.join(models_dir, "bootstrap_ensemble.joblib"))
        
        # Load metrics for thresholds
        with open(os.path.join("artifacts", "model_metrics.json"), "r") as f:
            self.metrics = json.load(f)
            
        with open(os.path.join("artifacts", "feature_meta.json"), "r") as f:
            self.feature_meta = json.load(f)
            
        # Precompute test set probabilities for percentile lookup
        test_df = pd.read_csv(os.path.join("data", "processed", "test.csv"))
        self.X_test = np.ascontiguousarray(test_df[FEATURES].values, dtype=np.float64)
        self.test_probs = {
            m: self.models[m]["cal"].predict_proba(self.X_test)[:, 1]
            for m in self.models
        }
        
        # LIME explainer cached on train data
        train_df = pd.read_csv(os.path.join("data", "processed", "train.csv"))
        self.X_train = np.ascontiguousarray(train_df[FEATURES].values, dtype=np.float64)
        
        from lime.lime_tabular import LimeTabularExplainer
        self.lime_explainer = LimeTabularExplainer(
            training_data=self.X_train,
            feature_names=FEATURES,
            class_names=["No Heart Disease", "Heart Disease"],
            mode="classification",
            random_state=42
        )
        print("ModelManager ready.")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelManager()
        return cls._instance

def predict_single(profile_dict: Dict[str, float], model_name: str = "LightGBM") -> Dict[str, Any]:
    mgr = ModelManager.get_instance()
    if model_name not in mgr.models:
        model_name = "LightGBM"
        
    x = np.array([[float(profile_dict[f]) for f in FEATURES]], dtype=np.float64)
    cal_model = mgr.models[model_name]["cal"]
    raw_model = mgr.models[model_name]["raw"]
    
    # 1. Calibrated probability
    cal_prob = float(cal_model.predict_proba(x)[0, 1])
    
    # 2. Uncertainty band from 30 bootstrap ensemble models
    boot_probs = [float(m.predict_proba(x)[0, 1]) for m in mgr.bootstrap_ensemble]
    ci_lower = float(np.percentile(boot_probs, 5))
    ci_upper = float(np.percentile(boot_probs, 95))
    
    # 3. Decision vs threshold
    threshold = float(mgr.metrics[model_name]["chosen_threshold"])
    is_positive = bool(cal_prob >= threshold)
    
    # 4. Percentile vs test population
    test_p = mgr.test_probs[model_name]
    percentile = float(np.mean(test_p < cal_prob) * 100)
    
    # 5. Risk band
    if cal_prob < 0.10:
        risk_band = "Low"
        band_color = "#1F8A84" # teal
    elif cal_prob < 0.20:
        risk_band = "Moderate"
        band_color = "#D9A441" # amber
    elif cal_prob < 0.35:
        risk_band = "High"
        band_color = "#E8735A" # coral
    else:
        risk_band = "Critical"
        band_color = "#C0392B" # deep red
        
    # 6. SHAP contributions
    shap_vals = []
    base_val = 0.0
    
    if model_name == "LightGBM":
        contrib = raw_model.booster_.predict(x, pred_contrib=True)[0]
        raw_shaps = contrib[:len(FEATURES)]
        base_val = float(contrib[len(FEATURES)])
    elif model_name == "XGBoost":
        import xgboost as xgb
        dmat = xgb.DMatrix(x, feature_names=FEATURES)
        contrib = raw_model.get_booster().predict(dmat, pred_contribs=True)[0]
        raw_shaps = contrib[:len(FEATURES)]
        base_val = float(contrib[len(FEATURES)])
    elif model_name == "Logistic Regression":
        # Linear SHAP: (x - mean(X)) * coef
        scaler = raw_model.named_steps["scaler"]
        clf = raw_model.named_steps["clf"]
        x_scaled = scaler.transform(x)[0]
        coef = clf.coef_[0]
        raw_shaps = x_scaled * coef
        base_val = float(clf.intercept_[0])
    else:
        # Random Forest: TreeSHAP or feature importances weighted deviation
        contrib = raw_model.predict_proba(x)[0, 1] - np.mean(mgr.test_probs["Random Forest"])
        # Distribute based on feature importances and deviation from median
        medians = np.median(mgr.X_test, axis=0)
        stds = np.std(mgr.X_test, axis=0) + 1e-5
        z_scores = (x[0] - medians) / stds
        imp = raw_model.feature_importances_
        raw_shaps = imp * z_scores
        base_val = float(np.mean(mgr.test_probs["Random Forest"]))
        
    # Percentage point approximation scaling:
    # Scale raw SHAP log-odds proportionally to actual probability delta
    scaling_factor = cal_prob * (1.0 - cal_prob) * 100.0
    
    contributions = []
    for i, feat in enumerate(FEATURES):
        logodds_shap = float(raw_shaps[i])
        pct_points = round(logodds_shap * scaling_factor, 2)
        meta = mgr.feature_meta.get(feat, {})
        contributions.append({
            "feature": feat,
            "label": meta.get("label", feat),
            "group": meta.get("group", "General"),
            "value": float(x[0, i]),
            "modifiable": meta.get("modifiable", False),
            "shap_logodds": round(logodds_shap, 4),
            "pct_points": pct_points,
            "direction": "increase" if logodds_shap > 0 else "decrease"
        })
        
    # Sort contributions by absolute impact
    contributions.sort(key=lambda c: abs(c["shap_logodds"]), reverse=True)
    
    # 7. Narrative generation
    pop_avg = 9.42
    ratio = cal_prob * 100.0 / pop_avg
    top_drivers = [c["label"] for c in contributions if c["shap_logodds"] > 0][:3]
    top_protective = [c["label"] for c in contributions if c["shap_logodds"] < 0][:2]
    
    narrative = (
        f"Your estimated 10-year heart disease risk is {cal_prob*100:.1f}% ({risk_band} risk category), "
        f"which is approximately {ratio:.1f}x the general survey population average of {pop_avg}%. "
        f"The model places this profile in the {percentile:.0f}th percentile of surveyed adults. "
    )
    if top_drivers:
        narrative += f"The strongest risk-elevating factors for this individual are {', '.join(top_drivers)}. "
    if top_protective:
        narrative += f"Conversely, protective factors helping lower risk include {', '.join(top_protective)}. "
    narrative += "Note: This prediction reflects epidemiological associations in CDC BRFSS survey data and does not constitute clinical diagnosis."
    
    return {
        "model_name": model_name,
        "calibrated_risk": round(cal_prob, 4),
        "risk_percentage": round(cal_prob * 100, 2),
        "uncertainty_band": [round(ci_lower * 100, 2), round(ci_upper * 100, 2)],
        "threshold": round(threshold, 4),
        "is_positive": is_positive,
        "percentile": round(percentile, 1),
        "risk_band": risk_band,
        "band_color": band_color,
        "base_value_logodds": round(base_val, 4),
        "contributions": contributions,
        "narrative": narrative
    }

def explain_lime_single(profile_dict: Dict[str, float]) -> Dict[str, Any]:
    mgr = ModelManager.get_instance()
    x = np.array([float(profile_dict[f]) for f in FEATURES], dtype=np.float64)
    cal_lgb = mgr.models["LightGBM"]["cal"]
    
    exp = mgr.lime_explainer.explain_instance(
        x,
        cal_lgb.predict_proba,
        num_features=len(FEATURES),
        num_samples=1000
    )
    lime_map = dict(exp.as_list())
    
    items = []
    for feat in FEATURES:
        meta = mgr.feature_meta.get(feat, {})
        val = float(profile_dict[feat])
        weight = 0.0
        for k, v in lime_map.items():
            if feat in k:
                weight = v
                break
        items.append({
            "feature": feat,
            "label": meta.get("label", feat),
            "value": val,
            "weight": round(float(weight), 4),
            "direction": "increase" if weight > 0 else "decrease"
        })
        
    items.sort(key=lambda x: abs(x["weight"]), reverse=True)
    return {
        "lime_contributions": items,
        "intercept": float(exp.intercept[1]) if hasattr(exp, "intercept") and len(exp.intercept) > 1 else 0.0,
        "score": float(exp.score) if hasattr(exp, "score") else 0.85
    }
