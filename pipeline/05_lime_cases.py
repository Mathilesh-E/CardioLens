import lightgbm as lgb
import os
import json
import joblib
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from lime.lime_tabular import LimeTabularExplainer

def run_lime_cases():
    os.makedirs("artifacts", exist_ok=True)
    
    train_df = pd.read_csv(os.path.join("data", "processed", "train.csv"))
    test_df = pd.read_csv(os.path.join("data", "processed", "test.csv"))
    
    target = "HeartDiseaseorAttack"
    features = [c for c in test_df.columns if c != target]
    
    X_train = np.ascontiguousarray(train_df[features].values, dtype=np.float64)
    X_test = np.ascontiguousarray(test_df[features].values, dtype=np.float64)
    y_test = np.ascontiguousarray(test_df[target].values, dtype=np.int32)
    
    lgb_raw = joblib.load(os.path.join("artifacts", "models", "lightgbm_raw.joblib"))
    lgb_cal = joblib.load(os.path.join("artifacts", "models", "lightgbm_cal.joblib"))
    shap_matrix = joblib.load(os.path.join("artifacts", "shap_test_matrix.joblib"))
    
    with open(os.path.join("artifacts", "model_metrics.json"), "r") as f:
        metrics = json.load(f)
    threshold = metrics["LightGBM"]["chosen_threshold"]
    
    test_probs = lgb_cal.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= threshold).astype(int)
    
    # 1. Identify 8 curated cases
    # 1: True Positive (y=1, pred=1, high confidence)
    tp_indices = np.where((y_test == 1) & (test_preds == 1))[0]
    tp_idx = tp_indices[np.argmax(test_probs[tp_indices])]
    
    # 2: True Negative (y=0, pred=0, low confidence)
    tn_indices = np.where((y_test == 0) & (test_preds == 0))[0]
    tn_idx = tn_indices[np.argmin(test_probs[tn_indices])]
    
    # 3: False Negative (y=1, pred=0, lowest prob among y=1)
    fn_indices = np.where((y_test == 1) & (test_preds == 0))[0]
    fn_idx = fn_indices[np.argmin(test_probs[fn_indices])]
    
    # 4: False Positive (y=0, pred=1, highest prob among y=0)
    fp_indices = np.where((y_test == 0) & (test_preds == 1))[0]
    fp_idx = fp_indices[np.argmax(test_probs[fp_indices])]
    
    # 5: Borderline near threshold
    border_idx = int(np.argmin(np.abs(test_probs - threshold)))
    
    # 6: Most extreme high-risk (highest predicted probability)
    extreme_idx = int(np.argmax(test_probs))
    
    # 7: Young-but-high-risk (Age <= 4, e.g., 18-39, but pred=1 or high prob)
    age_col_idx = features.index("Age")
    young_indices = np.where(X_test[:, age_col_idx] <= 4)[0]
    young_high_idx = young_indices[np.argmax(test_probs[young_indices])]
    
    # 8: Old-but-low-risk (Age >= 10, e.g. 65+, but pred=0, lowest prob)
    old_indices = np.where(X_test[:, age_col_idx] >= 10)[0]
    old_low_idx = old_indices[np.argmin(test_probs[old_indices])]
    
    curated_map = {
        "true_positive": {"idx": int(tp_idx), "title": "True Positive (Confirmed Risk)"},
        "true_negative": {"idx": int(tn_idx), "title": "True Negative (Healthy Baseline)"},
        "false_negative": {"idx": int(fn_idx), "title": "False Negative (Missed Detection)"},
        "false_positive": {"idx": int(fp_idx), "title": "False Positive (High Risk Alarm)"},
        "borderline": {"idx": int(border_idx), "title": "Borderline (Critical Decision Boundary)"},
        "extreme_high_risk": {"idx": int(extreme_idx), "title": "Extreme High Risk (Multi-morbidity)"},
        "young_high_risk": {"idx": int(young_high_idx), "title": "Young but High Risk (Early Warning)"},
        "old_low_risk": {"idx": int(old_low_idx), "title": "Older but Low Risk (Resilient Health)"}
    }
    
    print("Setting up LimeTabularExplainer...")
    lime_explainer = LimeTabularExplainer(
        training_data=X_train,
        feature_names=features,
        class_names=["No Heart Disease", "Heart Disease"],
        mode="classification",
        random_state=42
    )
    
    curated_results = {}
    for case_key, info in curated_map.items():
        idx = info["idx"]
        row = X_test[idx]
        actual = int(y_test[idx])
        pred_p = float(test_probs[idx])
        pred_label = int(test_preds[idx])
        
        # SHAP explanation
        shap_row = shap_matrix[idx]
        shap_items = [
            {"feature": feat, "value": float(row[i]), "contribution": round(float(shap_row[i]), 4)}
            for i, feat in enumerate(features)
        ]
        shap_items.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        
        # LIME explanation
        exp = lime_explainer.explain_instance(
            row,
            lgb_cal.predict_proba,
            num_features=len(features),
            num_samples=1500
        )
        lime_map = dict(exp.as_list())
        # Parse feature matching
        lime_items = []
        for feat in features:
            matched_val = 0.0
            for k, v in lime_map.items():
                if feat in k:
                    matched_val = v
                    break
            lime_items.append({
                "feature": feat,
                "value": float(row[features.index(feat)]),
                "contribution": round(float(matched_val), 4)
            })
        lime_items.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        
        curated_results[case_key] = {
            "index": idx,
            "title": info["title"],
            "profile": {feat: float(row[i]) for i, feat in enumerate(features)},
            "actual": actual,
            "probability": round(pred_p, 4),
            "prediction": pred_label,
            "threshold": round(threshold, 4),
            "shap_explanation": shap_items,
            "lime_explanation": lime_items
        }
        
    with open(os.path.join("artifacts", "lime_cases.json"), "w") as f:
        json.dump(curated_results, f, indent=2)
    print("Saved 8 curated cases to artifacts/lime_cases.json")
    
    # 2. Agreement over 150 sampled test cases
    print("Computing SHAP vs LIME agreement on 150 sampled test cases...")
    rng = np.random.RandomState(42)
    sample_150 = rng.choice(len(X_test), size=150, replace=False)
    
    jaccards = []
    spearmans = []
    sign_agreements = []
    
    for c_idx in sample_150:
        row = X_test[c_idx]
        shap_row = shap_matrix[c_idx]
        
        # LIME
        exp = lime_explainer.explain_instance(
            row,
            lgb_cal.predict_proba,
            num_features=len(features),
            num_samples=800
        )
        lime_map = dict(exp.as_list())
        lime_vals = []
        for feat in features:
            matched = 0.0
            for k, v in lime_map.items():
                if feat in k:
                    matched = v
                    break
            lime_vals.append(matched)
            
        # Top-5 Jaccard
        top5_shap = set(np.argsort(np.abs(shap_row))[-5:])
        top5_lime = set(np.argsort(np.abs(lime_vals))[-5:])
        jaccard = len(top5_shap.intersection(top5_lime)) / len(top5_shap.union(top5_lime))
        jaccards.append(jaccard)
        
        # Spearman rank correlation
        rho, _ = spearmanr(shap_row, lime_vals)
        if not np.isnan(rho):
            spearmans.append(rho)
            
        # Sign agreement on top 5 SHAP features
        top_shap_indices = np.argsort(np.abs(shap_row))[-5:]
        signs_match = [
            (np.sign(shap_row[i]) == np.sign(lime_vals[i]))
            for i in top_shap_indices
            if shap_row[i] != 0 and lime_vals[i] != 0
        ]
        if signs_match:
            sign_agreements.append(np.mean(signs_match))
            
    # 3. LIME Stability on 30 test cases across 5 random seeds
    print("Measuring LIME instability across 5 runs on 30 cases...")
    sample_30 = sample_150[:30]
    stability_variances = []
    
    for s_idx in sample_30:
        row = X_test[s_idx]
        run_weights = []
        for seed in [10, 20, 30, 40, 50]:
            explainer_seed = LimeTabularExplainer(
                training_data=X_train,
                feature_names=features,
                class_names=["No", "Yes"],
                mode="classification",
                random_state=seed
            )
            exp = explainer_seed.explain_instance(
                row,
                lgb_cal.predict_proba,
                num_features=len(features),
                num_samples=800
            )
            lime_map = dict(exp.as_list())
            weights = []
            for feat in features:
                w = 0.0
                for k, v in lime_map.items():
                    if feat in k:
                        w = v
                        break
                weights.append(w)
            run_weights.append(weights)
            
        var_per_feat = np.var(run_weights, axis=0) # variance per feature
        stability_variances.append(float(np.mean(var_per_feat)))
        
    agreement_summary = {
        "jaccard_top5": {
            "mean": round(float(np.mean(jaccards)), 4),
            "median": round(float(np.median(jaccards)), 4),
            "distribution": [round(float(v), 3) for v in jaccards]
        },
        "spearman_rank": {
            "mean": round(float(np.mean(spearmans)), 4),
            "median": round(float(np.median(spearmans)), 4),
            "distribution": [round(float(v), 3) for v in spearmans]
        },
        "sign_agreement": {
            "mean": round(float(np.mean(sign_agreements)), 4),
            "median": round(float(np.median(sign_agreements)), 4),
            "distribution": [round(float(v), 3) for v in sign_agreements]
        },
        "lime_stability": {
            "mean_variance": round(float(np.mean(stability_variances)), 6),
            "max_variance": round(float(np.max(stability_variances)), 6),
            "min_variance": round(float(np.min(stability_variances)), 6),
            "note": "Demonstrates LIME perturbations introduce sampling variance across seeds, whereas TreeSHAP is deterministic and exact."
        }
    }
    
    with open(os.path.join("artifacts", "lime_agreement.json"), "w") as f:
        json.dump(agreement_summary, f, indent=2)
        
    print("Saved LIME agreement and stability analysis to artifacts/lime_agreement.json")

if __name__ == "__main__":
    run_lime_cases()
