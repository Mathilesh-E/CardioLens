import lightgbm as lgb
import os
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, average_precision_score, matthews_corrcoef,
    brier_score_loss, confusion_matrix, roc_curve, precision_recall_curve
)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

RANDOM_STATE = 42

def compute_metrics(y_true, y_pred, y_prob):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "specificity": float(spec),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "mcc": float(matthews_corrcoef(y_true, y_pred)),
        "brier_score": float(brier_score_loss(y_true, y_prob)),
        "confusion_matrix": {
            "tn": int(tn), "fp": int(fp),
            "fn": int(fn), "tp": int(tp)
        }
    }

def find_thresholds(y_true, y_prob):
    thresholds = np.linspace(0.01, 0.99, 99)
    best_f1 = -1
    best_thresh_f1 = 0.5
    thresh_recall_75 = 0.5
    best_youden = -1
    best_thresh_youden = 0.5
    
    # Track for recall >= 0.75: highest threshold that gives recall >= 0.75
    cand_thresh_75 = []
    
    for t in thresholds:
        preds = (y_prob >= t).astype(int)
        f1 = f1_score(y_true, preds, zero_division=0)
        rec = recall_score(y_true, preds, zero_division=0)
        
        tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()
        sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        youden = sens + spec - 1
        
        if f1 > best_f1:
            best_f1 = f1
            best_thresh_f1 = t
            
        if rec >= 0.75:
            cand_thresh_75.append(t)
            
        if youden > best_youden:
            best_youden = youden
            best_thresh_youden = t
            
    if cand_thresh_75:
        thresh_recall_75 = max(cand_thresh_75)
    else:
        thresh_recall_75 = best_thresh_f1
        
    return {
        "max_f1": float(best_thresh_f1),
        "recall_75": float(thresh_recall_75),
        "youden": float(best_thresh_youden)
    }

def bootstrap_ci(y_true, y_prob, threshold, n_bootstraps=1000):
    rng = np.random.RandomState(RANDOM_STATE)
    n = len(y_true)
    aucs = []
    f1s = []
    recalls = []
    
    for _ in range(n_bootstraps):
        idx = rng.randint(0, n, size=n)
        yt = y_true[idx]
        if len(np.unique(yt)) < 2:
            continue
        yp = y_prob[idx]
        y_pred = (yp >= threshold).astype(int)
        
        aucs.append(roc_auc_score(yt, yp))
        f1s.append(f1_score(yt, y_pred, zero_division=0))
        recalls.append(recall_score(yt, y_pred, zero_division=0))
        
    return {
        "roc_auc_ci": [float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))],
        "f1_ci": [float(np.percentile(f1s, 2.5)), float(np.percentile(f1s, 97.5))],
        "recall_ci": [float(np.percentile(recalls, 2.5)), float(np.percentile(recalls, 97.5))]
    }

def compute_curves(y_true, y_prob):
    # ROC curve (downsampled for frontend transmission)
    fpr, tpr, thresh_roc = roc_curve(y_true, y_prob)
    idx_roc = np.linspace(0, len(fpr) - 1, min(100, len(fpr))).astype(int)
    roc_points = [{"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4), "threshold": round(float(thresh_roc[i]), 4)} for i in idx_roc]
    
    # PR curve
    precision, recall, thresh_pr = precision_recall_curve(y_true, y_prob)
    idx_pr = np.linspace(0, len(precision) - 1, min(100, len(precision))).astype(int)
    pr_points = [{"precision": round(float(precision[i]), 4), "recall": round(float(recall[i]), 4)} for i in idx_pr]
    
    # Calibration curve
    prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=10, strategy='uniform')
    cal_points = [{"prob_true": round(float(pt), 4), "prob_pred": round(float(pp), 4)} for pt, pp in zip(prob_true, prob_pred)]
    
    # Decision curve analysis (net benefit)
    thresholds_dca = np.linspace(0.01, 0.99, 99)
    n = len(y_true)
    prevalence = np.mean(y_true)
    dca_points = []
    for pt in thresholds_dca:
        tp = np.sum((y_prob >= pt) & (y_true == 1))
        fp = np.sum((y_prob >= pt) & (y_true == 0))
        net_benefit = (tp / n) - (fp / n) * (pt / (1 - pt))
        # treat-all net benefit
        treat_all = prevalence - (1 - prevalence) * (pt / (1 - pt))
        dca_points.append({
            "threshold": round(float(pt), 3),
            "net_benefit": round(float(net_benefit), 4),
            "treat_all": round(float(treat_all), 4),
            "treat_none": 0.0
        })
        
    # Lift / Cumulative Gain curve
    order = np.argsort(y_prob)[::-1]
    y_sorted = y_true[order]
    cum_pos = np.cumsum(y_sorted)
    total_pos = np.sum(y_true)
    pct_tested = np.linspace(0.01, 1.0, 100)
    lift_points = []
    for pct in pct_tested:
        k = int(pct * n)
        gain = (cum_pos[k - 1] / total_pos) if total_pos > 0 else 0.0
        lift = (gain / pct) if pct > 0 else 1.0
        lift_points.append({
            "percentile": round(float(pct * 100), 1),
            "cumulative_gain": round(float(gain), 4),
            "lift": round(float(lift), 3),
            "random": round(float(pct), 4)
        })
        
    return {
        "roc_curve": roc_points,
        "pr_curve": pr_points,
        "calibration_curve": cal_points,
        "dca": dca_points,
        "lift_curve": lift_points
    }

def run_train():
    os.makedirs(os.path.join("artifacts", "models"), exist_ok=True)
    
    train_df = pd.read_csv(os.path.join("data", "processed", "train.csv"))
    val_df = pd.read_csv(os.path.join("data", "processed", "val.csv"))
    test_df = pd.read_csv(os.path.join("data", "processed", "test.csv"))
    
    target = "HeartDiseaseorAttack"
    features = [c for c in train_df.columns if c != target]
    
    X_train = train_df[features].values.astype(np.float64)
    y_train = train_df[target].values.astype(np.float64)
    X_val = val_df[features].values.astype(np.float64)
    y_val = val_df[target].values.astype(np.float64)
    X_test = test_df[features].values.astype(np.float64)
    y_test = test_df[target].values.astype(np.float64)
    
    pos_count = np.sum(y_train == 1)
    neg_count = np.sum(y_train == 0)
    scale_pos_weight = neg_count / pos_count
    print(f"Scale pos weight: {scale_pos_weight:.2f}")
    
    # 1. Primary Model: LightGBM
    print("--- Training LightGBM ---")
    lgb_base = lgb.LGBMClassifier(
        n_estimators=300,
        learning_rate=0.03,
        num_leaves=31,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
        n_jobs=4,
        verbose=-1
    )
    lgb_base.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.early_stopping(stopping_rounds=30, verbose=False)]
    )
    # Calibrate on validation
    lgb_cal = CalibratedClassifierCV(estimator=lgb_base, cv="prefit", method="isotonic")
    lgb_cal.fit(X_val, y_val)
    
    # 2. XGBoost
    print("--- Training XGBoost ---")
    import xgboost as xgb
    xgb_base = xgb.XGBClassifier(
        n_estimators=200,
        learning_rate=0.03,
        max_depth=4,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
        n_jobs=4,
        eval_metric="logloss"
    )
    xgb_base.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    xgb_cal = CalibratedClassifierCV(estimator=xgb_base, cv="prefit", method="isotonic")
    xgb_cal.fit(X_val, y_val)
    
    # 3. Random Forest
    print("--- Training Random Forest ---")
    rf_base = RandomForestClassifier(
        n_estimators=150,
        max_depth=9,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=4
    )
    rf_base.fit(X_train, y_train)
    rf_cal = CalibratedClassifierCV(estimator=rf_base, cv="prefit", method="isotonic")
    rf_cal.fit(X_val, y_val)
    
    # 4. Logistic Regression (Standardized)
    print("--- Training Logistic Regression ---")
    lr_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE))
    ])
    lr_pipeline.fit(X_train, y_train)
    lr_cal = CalibratedClassifierCV(estimator=lr_pipeline, cv="prefit", method="sigmoid")
    lr_cal.fit(X_val, y_val)
    
    # 5. Bootstrap Ensemble for Uncertainty (30 small LightGBM models)
    print("--- Training 30 Bootstrap Ensemble LightGBM Models ---")
    ensemble_models = []
    rng = np.random.RandomState(RANDOM_STATE)
    n_train = len(X_train)
    for i in range(30):
        b_idx = rng.randint(0, n_train, size=n_train)
        m = lgb.LGBMClassifier(
            n_estimators=60,
            learning_rate=0.05,
            num_leaves=15,
            max_depth=4,
            scale_pos_weight=scale_pos_weight,
            random_state=RANDOM_STATE + i + 1,
            n_jobs=2,
            verbose=-1
        )
        m.fit(X_train[b_idx], y_train[b_idx])
        ensemble_models.append(m)
        
    joblib.dump(ensemble_models, os.path.join("artifacts", "models", "bootstrap_ensemble.joblib"))
    
    models = {
        "LightGBM": (lgb_base, lgb_cal),
        "XGBoost": (xgb_base, xgb_cal),
        "Random Forest": (rf_base, rf_cal),
        "Logistic Regression": (lr_pipeline, lr_cal)
    }
    
    all_metrics = {}
    
    for name, (raw_model, cal_model) in models.items():
        print(f"Evaluating {name}...")
        # Save models
        slug = name.lower().replace(" ", "_")
        joblib.dump(raw_model, os.path.join("artifacts", "models", f"{slug}_raw.joblib"))
        joblib.dump(cal_model, os.path.join("artifacts", "models", f"{slug}_cal.joblib"))
        
        # Validation predictions for threshold selection
        val_probs = cal_model.predict_proba(X_val)[:, 1]
        thresholds = find_thresholds(y_val, val_probs)
        chosen_thresh = thresholds["max_f1"]
        
        # Test predictions
        test_probs = cal_model.predict_proba(X_test)[:, 1]
        test_preds = (test_probs >= chosen_thresh).astype(int)
        
        # Compute metrics
        m = compute_metrics(y_test, test_preds, test_probs)
        ci = bootstrap_ci(y_test, test_probs, chosen_thresh, n_bootstraps=1000)
        curves = compute_curves(y_test, test_probs)
        
        # Threshold sensitivity table (for Model Arena interactive slider)
        thresh_table = []
        for t in np.linspace(0.05, 0.95, 19):
            p = (test_probs >= t).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_test, p).ravel()
            thresh_table.append({
                "threshold": round(float(t), 2),
                "accuracy": round(float(accuracy_score(y_test, p)), 4),
                "precision": round(float(precision_score(y_test, p, zero_division=0)), 4),
                "recall": round(float(recall_score(y_test, p, zero_division=0)), 4),
                "f1": round(float(f1_score(y_test, p, zero_division=0)), 4),
                "mcc": round(float(matthews_corrcoef(y_test, p)), 4),
                "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)
            })
            
        all_metrics[name] = {
            "thresholds": thresholds,
            "chosen_threshold": chosen_thresh,
            "metrics": m,
            "ci": ci,
            "curves": curves,
            "threshold_table": thresh_table
        }
        print(f"  {name} Test ROC-AUC: {m['roc_auc']:.4f}, PR-AUC: {m['pr_auc']:.4f}, F1: {m['f1']:.4f}, Chosen Thresh: {chosen_thresh:.2f}")

    with open(os.path.join("artifacts", "model_metrics.json"), "w") as f:
        json.dump(all_metrics, f, indent=2)
        
    print("Model training and evaluation complete. Saved to artifacts/model_metrics.json")

if __name__ == "__main__":
    run_train()
