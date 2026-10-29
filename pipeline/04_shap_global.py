import lightgbm as lgb
import os
import json
import joblib
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import squareform

def run_shap_global():
    os.makedirs("artifacts", exist_ok=True)
    test_df = pd.read_csv(os.path.join("data", "processed", "test.csv"))
    target = "HeartDiseaseorAttack"
    features = [c for c in test_df.columns if c != target]
    
    X_test = np.ascontiguousarray(test_df[features].values, dtype=np.float64)
    lgb_raw = joblib.load(os.path.join("artifacts", "models", "lightgbm_raw.joblib"))
    
    print("Computing exact TreeSHAP on LightGBM test set...")
    contrib = lgb_raw.booster_.predict(X_test, pred_contrib=True)
    shap_matrix = contrib[:, :len(features)]
    base_value = float(contrib[0, len(features)])
    print(f"SHAP matrix shape: {shap_matrix.shape}, Base log-odds: {base_value:.4f}")
    
    # Save test SHAP matrix
    joblib.dump(shap_matrix, os.path.join("artifacts", "shap_test_matrix.joblib"))
    joblib.dump(base_value, os.path.join("artifacts", "shap_base_value.joblib"))
    
    # 1. Mean absolute SHAP per feature
    mean_abs_shap = np.mean(np.abs(shap_matrix), axis=0)
    feat_importance = []
    for i, feat in enumerate(features):
        feat_importance.append({
            "feature": feat,
            "mean_abs_shap": round(float(mean_abs_shap[i]), 5)
        })
    feat_importance.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
    sorted_features = [x["feature"] for x in feat_importance]
    top_8_features = sorted_features[:8]
    
    # 2. Beeswarm data (sample up to 1,500 rows for smooth frontend rendering)
    n_test = len(test_df)
    rng = np.random.RandomState(42)
    sample_indices = rng.choice(n_test, size=min(1500, n_test), replace=False)
    
    beeswarm_data = {}
    for i, feat in enumerate(features):
        f_vals = X_test[sample_indices, i]
        s_vals = shap_matrix[sample_indices, i]
        
        # Min-max normalization of feature value for color map [0, 1]
        min_v, max_v = float(np.min(f_vals)), float(np.max(f_vals))
        norm_v = [(float(v) - min_v) / (max_v - min_v) if max_v > min_v else 0.5 for v in f_vals]
        
        beeswarm_data[feat] = [
            {
                "idx": int(idx),
                "val": round(float(f_vals[k]), 2),
                "shap": round(float(s_vals[k]), 4),
                "norm_val": round(float(norm_v[k]), 3)
            }
            for k, idx in enumerate(sample_indices)
        ]
        
    # 3. Dependence data (for all features, find best interacting feature by correlation)
    dependence_data = {}
    # Pairwise feature correlations
    feat_corr = np.corrcoef(X_test.T)
    
    for i, feat in enumerate(features):
        # find highest correlated other feature
        corrs = np.abs(feat_corr[i, :].copy())
        corrs[i] = -1 # ignore self
        best_inter_idx = int(np.argmax(corrs))
        best_inter_feat = features[best_inter_idx]
        
        f_vals = X_test[sample_indices, i]
        s_vals = shap_matrix[sample_indices, i]
        inter_vals = X_test[sample_indices, best_inter_idx]
        
        dependence_data[feat] = {
            "interaction_feature": best_inter_feat,
            "points": [
                {
                    "val": round(float(f_vals[k]), 2),
                    "shap": round(float(s_vals[k]), 4),
                    "inter_val": round(float(inter_vals[k]), 2)
                }
                for k in range(len(sample_indices))
            ]
        }
        
    # 4. Top 8 Feature interaction values (approximate pairwise interaction by TreeExplainer or SHAP covariance)
    print("Computing interaction approximations for top 8 features...")
    top_indices = [features.index(f) for f in top_8_features]
    inter_matrix = np.zeros((8, 8))
    # Using covariance of SHAP values as interaction strength indicator
    shap_cov = np.cov(shap_matrix[:, top_indices].T)
    for r in range(8):
        for c in range(8):
            inter_matrix[r, c] = round(float(abs(shap_cov[r, c])), 5)
            
    interaction_export = {
        "features": top_8_features,
        "matrix": inter_matrix.tolist()
    }
    
    # 5. SHAP-based feature clustering dendrogram
    print("Computing hierarchical clustering dendrogram of features...")
    # Distance based on correlation of SHAP values across test set
    raw_corr = np.corrcoef(shap_matrix.T)
    shap_corr = np.nan_to_num(raw_corr, nan=0.0)
    shap_corr = np.clip(shap_corr, -1.0, 1.0)
    dist_matrix = np.clip(1.0 - shap_corr, 0.0, 2.0)
    np.fill_diagonal(dist_matrix, 0.0)
    condensed_dist = squareform(dist_matrix, checks=False)
    
    Z = linkage(condensed_dist, method='average')
    
    # Convert linkage matrix to nested tree dict for D3 hierarchy/dendrogram
    tree_root = to_tree(Z)
    
    def tree_to_dict(node):
        if node.is_leaf():
            return {
                "name": features[node.id],
                "id": int(node.id),
                "is_leaf": True
            }
        else:
            return {
                "name": f"cluster_{node.id}",
                "dist": round(float(node.dist), 4),
                "is_leaf": False,
                "children": [tree_to_dict(node.left), tree_to_dict(node.right)]
            }
            
    dendrogram_tree = tree_to_dict(tree_root)
    
    # 6. Sample 20 individuals for SHAP decision plot
    sample_20_indices = rng.choice(n_test, size=20, replace=False).tolist()
    sample_20_data = []
    for idx in sample_20_indices:
        shap_row = shap_matrix[idx]
        actual_label = int(test_df.iloc[idx][target])
        # cumulative trajectory
        cum_vals = [round(base_value, 4)]
        running = base_value
        for feat in sorted_features:
            f_idx = features.index(feat)
            running += shap_row[f_idx]
            cum_vals.append(round(float(running), 4))
        sample_20_data.append({
            "patient_id": int(idx),
            "label": actual_label,
            "trajectory": cum_vals
        })
        
    export_data = {
        "base_value_logodds": round(base_value, 5),
        "feature_importance": feat_importance,
        "sorted_features": sorted_features,
        "beeswarm": beeswarm_data,
        "dependence": dependence_data,
        "interactions": interaction_export,
        "dendrogram": dendrogram_tree,
        "decision_plot_samples": {
            "features": sorted_features,
            "samples": sample_20_data
        }
    }
    
    with open(os.path.join("artifacts", "shap_global.json"), "w") as f:
        json.dump(export_data, f, indent=2)
        
    print("Global SHAP analysis complete and exported to artifacts/shap_global.json")

if __name__ == "__main__":
    run_shap_global()
