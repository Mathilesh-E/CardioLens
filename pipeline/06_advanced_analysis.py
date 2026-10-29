import lightgbm as lgb
import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, roc_auc_score, brier_score_loss, confusion_matrix
from sklearn.feature_selection import mutual_info_classif
from scipy.stats import spearmanr, chi2_contingency

def wilson_score_interval(successes, total, confidence=0.95):
    if total == 0:
        return 0.0, 0.0, 0.0
    z = 1.959964 # 95% confidence
    p = successes / total
    denom = 1 + z**2 / total
    centre = (p + z**2 / (2 * total)) / denom
    margin = (z * np.sqrt(p * (1 - p) / total + z**2 / (4 * total**2))) / denom
    lower = max(0.0, centre - margin)
    upper = min(1.0, centre + margin)
    return round(float(p), 4), round(float(lower), 4), round(float(upper), 4)

def cramers_v(x, y):
    confusion_mat = pd.crosstab(x, y)
    chi2 = chi2_contingency(confusion_mat)[0]
    n = confusion_mat.sum().sum()
    phi2 = chi2 / n
    r, k = confusion_mat.shape
    phi2corr = max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    rcorr = r - ((r - 1)**2) / (n - 1)
    kcorr = k - ((k - 1)**2) / (n - 1)
    denom = min((kcorr - 1), (rcorr - 1))
    return float(np.sqrt(phi2corr / denom)) if denom > 0 else 0.0

def run_advanced_analysis():
    os.makedirs("artifacts", exist_ok=True)
    
    sub_df = pd.read_csv(os.path.join("data", "processed", "subsample_15k.csv"))
    test_df = pd.read_csv(os.path.join("data", "processed", "test.csv"))
    
    target = "HeartDiseaseorAttack"
    features = [c for c in test_df.columns if c != target]
    
    X_test = np.ascontiguousarray(test_df[features].values, dtype=np.float64)
    y_test = np.ascontiguousarray(test_df[target].values, dtype=np.int32)
    
    lgb_cal = joblib.load(os.path.join("artifacts", "models", "lightgbm_cal.joblib"))
    shap_matrix = joblib.load(os.path.join("artifacts", "shap_test_matrix.joblib"))
    
    with open(os.path.join("artifacts", "model_metrics.json"), "r") as f:
        metrics = json.load(f)
    threshold = metrics["LightGBM"]["chosen_threshold"]
    
    test_probs = lgb_cal.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= threshold).astype(int)
    
    # -------------------------------------------------------------------------
    # a) PATIENT MAP: 2D Embedding (t-SNE) & K-Means Phenotypes on SHAP space
    # -------------------------------------------------------------------------
    print("Computing 2D Patient Map embedding of SHAP space...")
    tsne = TSNE(n_components=2, perplexity=30, random_state=42, n_iter=1000)
    embedding_2d = tsne.fit_transform(shap_matrix)
    
    # Rescale embedding to [-100, 100] for crisp visualization
    min_x, max_x = embedding_2d[:, 0].min(), embedding_2d[:, 0].max()
    min_y, max_y = embedding_2d[:, 1].min(), embedding_2d[:, 1].max()
    emb_x = ((embedding_2d[:, 0] - min_x) / (max_x - min_x) * 200 - 100)
    emb_y = ((embedding_2d[:, 1] - min_y) / (max_y - min_y) * 200 - 100)
    
    # Choose optimal k between 4 and 6
    best_k = 5
    best_sil = -1
    for k in [4, 5, 6]:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(shap_matrix)
        sil = silhouette_score(shap_matrix, labels, sample_size=1000, random_state=42)
        if sil > best_sil:
            best_sil = sil
            best_k = k
            
    print(f"Optimal cluster k={best_k} (silhouette={best_sil:.3f})")
    km = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    cluster_labels = km.fit_predict(shap_matrix)
    
    # Analyze phenotypes
    phenotypes = []
    cluster_names = [
        "Cardiometabolic & Older Complex",
        "Young & Lifestyle Preserved",
        "Hypertensive Smoker Vulnerable",
        "Mid-Age Sedentary Borderline",
        "High Physical Activity Resilient",
        "Metabolic Syndrome Heavy"
    ]
    
    for c_id in range(best_k):
        c_mask = (cluster_labels == c_id)
        c_size = int(np.sum(c_mask))
        c_rate = float(np.mean(y_test[c_mask]))
        c_pred_risk = float(np.mean(test_probs[c_mask]))
        
        # Mean SHAP in cluster to identify top drivers
        c_shap_mean = np.mean(shap_matrix[c_mask], axis=0)
        c_top_idx = np.argsort(np.abs(c_shap_mean))[::-1][:3]
        top_drivers = [features[idx] for idx in c_top_idx]
        
        # Mean feature values
        c_feat_means = {feat: round(float(np.mean(X_test[c_mask, i])), 2) for i, feat in enumerate(features)}
        
        name = cluster_names[c_id % len(cluster_names)]
        phenotypes.append({
            "cluster_id": c_id,
            "name": name,
            "size": c_size,
            "observed_rate": round(c_rate, 4),
            "predicted_risk": round(c_pred_risk, 4),
            "top_drivers": top_drivers,
            "feature_means": c_feat_means
        })
        
    patient_map_data = {
        "points": [
            {
                "idx": i,
                "x": round(float(emb_x[i]), 2),
                "y": round(float(emb_y[i]), 2),
                "cluster": int(cluster_labels[i]),
                "risk": round(float(test_probs[i]), 4),
                "actual": int(y_test[i]),
                "features": {feat: float(X_test[i, f_idx]) for f_idx, feat in enumerate(features)}
            }
            for i in range(len(X_test))
        ],
        "phenotypes": phenotypes
    }
    
    with open(os.path.join("artifacts", "patient_map.json"), "w") as f:
        json.dump(patient_map_data, f, indent=2)
    print("Saved patient map to artifacts/patient_map.json")
    
    # -------------------------------------------------------------------------
    # b) Partial Dependence + ICE (50 sampled individuals)
    # -------------------------------------------------------------------------
    print("Computing PDP and ICE curves...")
    rng = np.random.RandomState(42)
    ice_sample_indices = rng.choice(len(X_test), size=50, replace=False)
    ice_subsample = X_test[ice_sample_indices]
    
    pdp_results = {}
    for feat_idx, feat in enumerate(features):
        unique_vals = np.sort(np.unique(X_test[:, feat_idx]))
        if len(unique_vals) > 15:
            grid_vals = np.linspace(unique_vals.min(), unique_vals.max(), 15)
        else:
            grid_vals = unique_vals
            
        feat_pdp_means = []
        ice_curves = [[] for _ in range(len(ice_subsample))]
        
        for g_val in grid_vals:
            # Entire test set for PDP average
            temp_X = X_test.copy()
            temp_X[:, feat_idx] = g_val
            pdp_mean = float(np.mean(lgb_cal.predict_proba(temp_X)[:, 1]))
            feat_pdp_means.append({"val": round(float(g_val), 2), "risk": round(pdp_mean, 4)})
            
            # ICE curves for 50 people
            temp_ice = ice_subsample.copy()
            temp_ice[:, feat_idx] = g_val
            ice_preds = lgb_cal.predict_proba(temp_ice)[:, 1]
            for p_i, pred in enumerate(ice_preds):
                ice_curves[p_i].append(round(float(pred), 4))
                
        pdp_results[feat] = {
            "grid": [round(float(v), 2) for v in grid_vals],
            "pdp": feat_pdp_means,
            "ice": ice_curves
        }
        
    # 2D PDP grids for top 6 pairs
    top_pairs = [
        ("Age", "BMI"),
        ("Age", "GenHlth"),
        ("Age", "HighBP"),
        ("BMI", "PhysActivity"),
        ("GenHlth", "HighBP"),
        ("Smoker", "Age")
    ]
    pdp_2d = {}
    for f1, f2 in top_pairs:
        idx1, idx2 = features.index(f1), features.index(f2)
        u1 = np.unique(X_test[:, idx1])
        u2 = np.unique(X_test[:, idx2])
        grid1 = np.linspace(u1.min(), u1.max(), 7) if len(u1) > 7 else u1
        grid2 = np.linspace(u2.min(), u2.max(), 7) if len(u2) > 7 else u2
        
        matrix = []
        for v1 in grid1:
            row_vals = []
            for v2 in grid2:
                temp_X = X_test.copy()
                temp_X[:, idx1] = v1
                temp_X[:, idx2] = v2
                mean_p = float(np.mean(lgb_cal.predict_proba(temp_X)[:, 1]))
                row_vals.append(round(mean_p, 4))
            matrix.append(row_vals)
            
        pdp_2d[f"{f1}__{f2}"] = {
            "feature1": f1,
            "feature2": f2,
            "grid1": [round(float(v), 2) for v in grid1],
            "grid2": [round(float(v), 2) for v in grid2],
            "risk_grid": matrix
        }
        
    with open(os.path.join("artifacts", "pdp_ice.json"), "w") as f:
        json.dump({"pdp_1d": pdp_results, "pdp_2d": pdp_2d}, f, indent=2)
    print("Saved PDP & ICE to artifacts/pdp_ice.json")
    
    # -------------------------------------------------------------------------
    # c) Risk-rate tables by every feature category and 2-way grids (Wilson CIs)
    # -------------------------------------------------------------------------
    print("Computing risk rate tables with Wilson score intervals...")
    risk_tables_1d = {}
    for feat in features:
        tbl = []
        grouped = sub_df.groupby(feat)[target].agg(["count", "sum"])
        for cat_val, row in grouped.iterrows():
            total = int(row["count"])
            pos = int(row["sum"])
            rate, low, high = wilson_score_interval(pos, total)
            tbl.append({
                "category": float(cat_val),
                "total": total,
                "positive": pos,
                "rate": rate,
                "ci_lower": low,
                "ci_upper": high
            })
        risk_tables_1d[feat] = tbl
        
    # 2-way grids: Age x Income, Age x GenHlth, BMI bin x Diabetes
    sub_df_binned = sub_df.copy()
    sub_df_binned["BMI_bin"] = pd.qcut(sub_df_binned["BMI"], q=4, labels=[1, 2, 3, 4]).astype(int)
    
    two_way_pairs = [
        ("Age", "Income"),
        ("Age", "GenHlth"),
        ("BMI_bin", "Diabetes")
    ]
    risk_tables_2way = {}
    for f1, f2 in two_way_pairs:
        ct = sub_df_binned.groupby([f1, f2])[target].agg(["count", "sum"]).reset_index()
        grid_data = []
        for _, r in ct.iterrows():
            tot = int(r["count"])
            pos = int(r["sum"])
            rate, low, high = wilson_score_interval(pos, tot)
            grid_data.append({
                f1: float(r[f1]),
                f2: float(r[f2]),
                "total": tot,
                "positive": pos,
                "rate": rate,
                "ci_lower": low,
                "ci_upper": high
            })
        risk_tables_2way[f"{f1}__{f2}"] = grid_data
        
    with open(os.path.join("artifacts", "risk_tables.json"), "w") as f:
        json.dump({"tables_1d": risk_tables_1d, "tables_2way": risk_tables_2way}, f, indent=2)
    print("Saved risk tables to artifacts/risk_tables.json")
    
    # -------------------------------------------------------------------------
    # d) FAIRNESS AUDIT on the test set
    # -------------------------------------------------------------------------
    print("Auditing model fairness across demographic subgroups...")
    test_analysis_df = test_df.copy()
    test_analysis_df["prob"] = test_probs
    test_analysis_df["pred"] = test_preds
    
    # Define groups
    # Sex: 0 = Female, 1 = Male
    # Age band: 1-4 Young (18-39), 5-8 Middle (40-59), 9-13 Older (60+)
    test_analysis_df["Age_Band"] = pd.cut(
        test_analysis_df["Age"],
        bins=[0, 4, 8, 14],
        labels=["Young (18-39)", "Middle-aged (40-59)", "Older (60+)"]
    )
    # Income: 1-4 Lower, 5-6 Middle, 7-8 Upper
    test_analysis_df["Income_Tertile"] = pd.cut(
        test_analysis_df["Income"],
        bins=[0, 4, 6, 9],
        labels=["Lower Income", "Middle Income", "Upper Income"]
    )
    # Education: 1-3 <=High School, 4-5 Some College, 6 College Grad
    test_analysis_df["Education_Group"] = pd.cut(
        test_analysis_df["Education"],
        bins=[0, 3, 5, 7],
        labels=["High School or Less", "Some College", "College Graduate"]
    )
    
    audit_dimensions = {
        "Sex": {0: "Female", 1: "Male"},
        "Age_Band": ["Young (18-39)", "Middle-aged (40-59)", "Older (60+)"],
        "Income_Tertile": ["Lower Income", "Middle Income", "Upper Income"],
        "Education_Group": ["High School or Less", "Some College", "College Graduate"]
    }
    
    fairness_results = {}
    
    for dim_name, groups in audit_dimensions.items():
        subgroup_metrics = []
        all_tprs = []
        all_fprs = []
        all_selection_rates = []
        
        for g in (groups.keys() if isinstance(groups, dict) else groups):
            label_name = groups[g] if isinstance(groups, dict) else str(g)
            sub = test_analysis_df[test_analysis_df[dim_name] == g]
            
            n_sub = len(sub)
            if n_sub == 0:
                continue
            y_sub_true = sub[target].values
            y_sub_pred = sub["pred"].values
            y_sub_prob = sub["prob"].values
            
            # Subgroup metrics
            tn, fp, fn, tp = confusion_matrix(y_sub_true, y_sub_pred, labels=[0, 1]).ravel()
            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            sel_rate = np.mean(y_sub_pred)
            
            auc = roc_auc_score(y_sub_true, y_sub_prob) if len(np.unique(y_sub_true)) > 1 else 0.5
            cal_err = brier_score_loss(y_sub_true, y_sub_prob)
            
            all_tprs.append(tpr)
            all_fprs.append(fpr)
            all_selection_rates.append(sel_rate)
            
            subgroup_metrics.append({
                "group": label_name,
                "count": n_sub,
                "positive_rate": round(float(np.mean(y_sub_true)), 4),
                "selection_rate": round(float(sel_rate), 4),
                "recall_tpr": round(float(tpr), 4),
                "fpr": round(float(fpr), 4),
                "precision": round(float(prec), 4),
                "roc_auc": round(float(auc), 4),
                "brier_calibration": round(float(cal_err), 4)
            })
            
        # Calculate gaps and parity
        eq_odds_diff = max(max(all_tprs) - min(all_tprs), max(all_fprs) - min(all_fprs)) if all_tprs else 0.0
        dem_parity_diff = max(all_selection_rates) - min(all_selection_rates) if all_selection_rates else 0.0
        
        # Check for gaps > 5 percentage points
        flags = []
        if (max(all_tprs) - min(all_tprs)) > 0.05:
            flags.append("Recall (TPR) gap exceeds 5%")
        if (max(all_fprs) - min(all_fprs)) > 0.05:
            flags.append("False Positive Rate gap exceeds 5%")
        if dem_parity_diff > 0.05:
            flags.append("Demographic parity difference exceeds 5%")
            
        fairness_results[dim_name] = {
            "subgroups": subgroup_metrics,
            "equalized_odds_diff": round(float(eq_odds_diff), 4),
            "demographic_parity_diff": round(float(dem_parity_diff), 4),
            "flags": flags
        }
        
    with open(os.path.join("artifacts", "fairness_audit.json"), "w") as f:
        json.dump(fairness_results, f, indent=2)
    print("Saved fairness audit to artifacts/fairness_audit.json")
    
    # -------------------------------------------------------------------------
    # e & f) Counterfactual metadata and Population prevalence parameters
    # -------------------------------------------------------------------------
    modifiable_features = [
        "BMI", "Smoker", "PhysActivity", "Fruits", "Veggies",
        "HvyAlcoholConsump", "HighBP", "HighChol", "Diabetes", "CholCheck"
    ]
    fixed_features = ["Age", "Sex", "Education", "Income", "Stroke", "DiffWalk"]
    
    # Population prevalence of modifiable factors in the data
    prevalences = {}
    for feat in modifiable_features:
        if feat == "BMI":
            prevalences[feat] = {
                "mean": round(float(sub_df[feat].mean()), 2),
                "median": round(float(sub_df[feat].median()), 2),
                "std": round(float(sub_df[feat].std()), 2)
            }
        else:
            prevalences[feat] = {
                "prevalence": round(float((sub_df[feat] > 0).mean()), 4),
                "breakdown": {str(k): round(float(v), 4) for k, v in sub_df[feat].value_counts(normalize=True).items()}
            }
            
    sim_params = {
        "modifiable_features": modifiable_features,
        "fixed_features": fixed_features,
        "prevalences": prevalences,
        "overall_observed_risk": round(float(sub_df[target].mean()), 4),
        "overall_predicted_risk": round(float(np.mean(test_probs)), 4)
    }
    with open(os.path.join("artifacts", "population_params.json"), "w") as f:
        json.dump(sim_params, f, indent=2)
        
    # -------------------------------------------------------------------------
    # g) Correlation Matrix (Spearman + Cramer's V) and Mutual Information
    # -------------------------------------------------------------------------
    print("Computing correlation matrix and Mutual Information...")
    corr_matrix = {}
    all_cols = features + [target]
    
    # Compute Spearman correlation
    spearman_corr = sub_df[all_cols].corr(method="spearman").round(4)
    corr_json = {col: spearman_corr[col].to_dict() for col in all_cols}
    
    # Mutual information with target
    mi = mutual_info_classif(sub_df[features], sub_df[target], random_state=42)
    mi_list = [
        {"feature": feat, "mutual_info": round(float(mi[i]), 5)}
        for i, feat in enumerate(features)
    ]
    mi_list.sort(key=lambda x: x["mutual_info"], reverse=True)
    
    correlations_data = {
        "columns": all_cols,
        "spearman_matrix": corr_json,
        "mutual_information": mi_list
    }
    with open(os.path.join("artifacts", "correlations.json"), "w") as f:
        json.dump(correlations_data, f, indent=2)
    print("Saved correlations and MI to artifacts/correlations.json")

if __name__ == "__main__":
    run_advanced_analysis()
