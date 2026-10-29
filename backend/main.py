import os
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
import io
import time
import json
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from .schemas import (
    PredictRequest, WhatIfRequest, WhatIf2DRequest,
    CounterfactualRequest, CohortRequest, SimulateRequest
)
from .explain import ModelManager, predict_single, explain_lime_single, FEATURES
from .counterfactual import generate_counterfactuals
from .cohort import analyze_cohort
from .simulate import run_simulation

app = FastAPI(
    title="CardioLens API",
    description="Explainable-AI Studio for Heart Disease Risk",
    version="1.0.0"
)

# CORS restricted to localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple rate limiter for heavy endpoints (LIME, Batch)
_rate_limit_state = {}
def check_rate_limit(client_ip: str, limit_seconds: float = 0.5):
    now = time.time()
    last = _rate_limit_state.get(client_ip, 0)
    if now - last < limit_seconds:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending another request."
        )
    _rate_limit_state[client_ip] = now

# Startup event to warm up models and memory caches
@app.on_event("startup")
def startup_event():
    print("Pre-warming ModelManager...")
    ModelManager.get_instance()
    print("CardioLens API initialized successfully.")

# Helper to sanitize inf/nan float values for JSON compliance
def sanitize_floats(obj):
    if isinstance(obj, float):
        if math.isinf(obj) or math.isnan(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_floats(v) for v in obj]
    return obj

# Helper to read artifacts with caching
_artifact_cache: Dict[str, Any] = {}
def load_artifact(filename: str) -> Any:
    if filename not in _artifact_cache:
        path = os.path.join("artifacts", filename)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Artifact {filename} not found.")
        with open(path, "r") as f:
            raw = json.load(f)
        _artifact_cache[filename] = sanitize_floats(raw)
    return _artifact_cache[filename]

# -----------------------------------------------------------------------------
# GET Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/meta")
def get_meta():
    return load_artifact("feature_meta.json")

@app.get("/api/metrics")
def get_metrics():
    return load_artifact("model_metrics.json")

@app.get("/api/global")
def get_global():
    return load_artifact("shap_global.json")

@app.get("/api/cases")
def get_cases():
    return load_artifact("lime_cases.json")

@app.get("/api/agreement")
def get_agreement():
    return load_artifact("lime_agreement.json")

@app.get("/api/calibration")
def get_calibration():
    metrics = load_artifact("model_metrics.json")
    cal_data = {
        m: {
            "calibration_curve": metrics[m]["curves"]["calibration_curve"],
            "brier_score": metrics[m]["metrics"]["brier_score"]
        }
        for m in metrics
    }
    return cal_data

@app.get("/api/fairness")
def get_fairness():
    return load_artifact("fairness_audit.json")

@app.get("/api/patientmap")
def get_patientmap():
    return load_artifact("patient_map.json")

@app.get("/api/pdp")
def get_pdp():
    return load_artifact("pdp_ice.json")

@app.get("/api/risk-tables")
def get_risk_tables():
    return load_artifact("risk_tables.json")

@app.get("/api/correlations")
def get_correlations():
    return load_artifact("correlations.json")

@app.get("/api/models")
def get_models():
    metrics = load_artifact("model_metrics.json")
    res = []
    for name, data in metrics.items():
        res.append({
            "name": name,
            "threshold": data["chosen_threshold"],
            "roc_auc": data["metrics"]["roc_auc"],
            "pr_auc": data["metrics"]["pr_auc"],
            "f1": data["metrics"]["f1"]
        })
    return res

# -----------------------------------------------------------------------------
# POST Interactive Analysis Endpoints
# -----------------------------------------------------------------------------
@app.post("/api/predict")
def predict_endpoint(req: PredictRequest):
    t0 = time.time()
    prof = req.profile.model_dump()
    res = predict_single(prof, model_name=req.model_name or "LightGBM")
    elapsed_ms = (time.time() - t0) * 1000.0
    res["latency_ms"] = round(elapsed_ms, 2)
    return res

@app.post("/api/whatif")
def whatif_endpoint(req: WhatIfRequest):
    mgr = ModelManager.get_instance()
    prof = req.profile.model_dump()
    feat = req.feature
    if feat not in FEATURES:
        raise HTTPException(status_code=400, detail=f"Invalid feature '{feat}'.")
        
    meta = mgr.feature_meta.get(feat, {})
    min_v = float(meta.get("min", 0.0))
    max_v = float(meta.get("max", 1.0))
    step_v = float(meta.get("step", 1.0))
    
    if meta.get("type") in ["binary", "ordinal"]:
        grid_vals = np.arange(min_v, max_v + 0.1, step_v)
    else:
        grid_vals = np.linspace(min_v, max_v, 20)
        
    curve_points = []
    cal_m = mgr.models[req.model_name or "LightGBM"]["cal"]
    
    temp_prof = copy_dict = prof.copy()
    for g in grid_vals:
        temp_prof[feat] = float(g)
        x = np.array([[float(temp_prof[f]) for f in FEATURES]], dtype=np.float64)
        p = float(cal_m.predict_proba(x)[0, 1])
        curve_points.append({"val": round(float(g), 2), "risk_pct": round(p * 100, 2)})
        
    # Get 10 faint ICE background curves from real test patients
    ice_curves = []
    sample_indices = [5, 42, 100, 250, 500, 750, 1000, 1250, 1500, 1800]
    for s_idx in sample_indices:
        pts = []
        base_patient = {f: float(mgr.X_test[s_idx, i]) for i, f in enumerate(FEATURES)}
        for g in grid_vals:
            base_patient[feat] = float(g)
            x = np.array([[float(base_patient[f]) for f in FEATURES]], dtype=np.float64)
            p = float(cal_m.predict_proba(x)[0, 1])
            pts.append({"val": round(float(g), 2), "risk_pct": round(p * 100, 2)})
        ice_curves.append(pts)
        
    return {
        "feature": feat,
        "label": meta.get("label", feat),
        "current_val": prof[feat],
        "curve": curve_points,
        "ice_background": ice_curves
    }

@app.post("/api/whatif2d")
def whatif2d_endpoint(req: WhatIf2DRequest):
    mgr = ModelManager.get_instance()
    prof = req.profile.model_dump()
    f1, f2 = req.feature1, req.feature2
    if f1 not in FEATURES or f2 not in FEATURES:
        raise HTTPException(status_code=400, detail="Invalid feature pair.")
        
    meta1, meta2 = mgr.feature_meta.get(f1, {}), mgr.feature_meta.get(f2, {})
    grid1 = np.linspace(float(meta1.get("min", 0)), float(meta1.get("max", 1)), 8)
    grid2 = np.linspace(float(meta2.get("min", 0)), float(meta2.get("max", 1)), 8)
    
    cal_m = mgr.models[req.model_name or "LightGBM"]["cal"]
    
    matrix = []
    for v1 in grid1:
        row_pts = []
        for v2 in grid2:
            tp = prof.copy()
            tp[f1] = float(v1)
            tp[f2] = float(v2)
            x = np.array([[float(tp[f]) for f in FEATURES]], dtype=np.float64)
            p = float(cal_m.predict_proba(x)[0, 1])
            row_pts.append(round(p * 100, 2))
        matrix.append(row_pts)
        
    return {
        "feature1": f1,
        "feature2": f2,
        "current_val1": prof[f1],
        "current_val2": prof[f2],
        "grid1": [round(float(v), 2) for v in grid1],
        "grid2": [round(float(v), 2) for v in grid2],
        "matrix": matrix
    }

@app.post("/api/lime")
def lime_endpoint(req: PredictRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(client_ip, limit_seconds=1.0)
    prof = req.profile.model_dump()
    return explain_lime_single(prof)

@app.post("/api/counterfactual")
def counterfactual_endpoint(req: CounterfactualRequest):
    prof = req.profile.model_dump()
    return generate_counterfactuals(
        current_profile=prof,
        target_risk=req.target_risk,
        target_mode=req.target_mode or "below_threshold",
        allowed_features=req.allowed_features,
        model_name=req.model_name or "LightGBM"
    )

@app.post("/api/cohort")
def cohort_endpoint(req: CohortRequest):
    return analyze_cohort(req.filters)

@app.post("/api/simulate")
def simulate_endpoint(req: SimulateRequest):
    return run_simulation(req)

@app.post("/api/batch")
async def batch_endpoint(request: Request, file: UploadFile = File(...)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(client_ip, limit_seconds=2.0)
    
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse uploaded CSV: {str(e)}")
        
    if len(df) > 5000:
        raise HTTPException(status_code=400, detail="CSV exceeds maximum allowable limit of 5,000 rows.")
        
    # Validate columns
    missing_cols = [c for c in FEATURES if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required feature columns: {', '.join(missing_cols)}"
        )
        
    mgr = ModelManager.get_instance()
    cal_m = mgr.models["LightGBM"]["cal"]
    raw_m = mgr.models["LightGBM"]["raw"]
    threshold = float(mgr.metrics["LightGBM"]["chosen_threshold"])
    
    # Fill NAs with medians
    df_clean = df[FEATURES].fillna(df[FEATURES].median())
    X = np.ascontiguousarray(df_clean.values, dtype=np.float64)
    
    # Score all rows
    probs = cal_m.predict_proba(X)[:, 1]
    contrib = raw_m.booster_.predict(X, pred_contrib=True)
    shaps = contrib[:, :len(FEATURES)]
    
    scored_rows = []
    bands_count = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}
    top_driver_counts = {f: 0 for f in FEATURES}
    
    for i in range(len(df_clean)):
        p = float(probs[i])
        if p < 0.10:
            band = "Low"
        elif p < 0.20:
            band = "Moderate"
        elif p < 0.35:
            band = "High"
        else:
            band = "Critical"
        bands_count[band] += 1
        
        # Top 3 drivers
        row_shaps = shaps[i]
        top3_idx = np.argsort(row_shaps)[::-1][:3]
        top3_feats = [FEATURES[idx] for idx in top3_idx]
        for tf in top3_feats:
            top_driver_counts[tf] += 1
            
        scored_rows.append({
            "id": i + 1,
            "risk_pct": round(p * 100, 2),
            "risk_band": band,
            "decision": "Positive" if p >= threshold else "Negative",
            "top_drivers": top3_feats,
            "raw_features": {f: float(df_clean.iloc[i][f]) for f in FEATURES}
        })
        
    top_driver_freq = [
        {"feature": f, "label": mgr.feature_meta[f]["label"], "frequency": top_driver_counts[f]}
        for f in FEATURES
    ]
    top_driver_freq.sort(key=lambda x: x["frequency"], reverse=True)
    
    return {
        "total_rows": len(df_clean),
        "mean_risk_pct": round(float(np.mean(probs) * 100), 2),
        "positive_rate_pct": round(float(np.mean(probs >= threshold) * 100), 2),
        "band_distribution": bands_count,
        "top_drivers_frequency": top_driver_freq[:8],
        "rows": scored_rows
    }

@app.get("/api/export/profile")
def export_profile_endpoint(
    high_bp: float = 0.0, high_chol: float = 0.0, bmi: float = 28.0, smoker: float = 0.0,
    gen_hlth: float = 2.0, age: float = 8.0, sex: float = 0.0
):
    prof = {f: 0.0 for f in FEATURES}
    prof["HighBP"] = high_bp
    prof["HighChol"] = high_chol
    prof["BMI"] = bmi
    prof["Smoker"] = smoker
    prof["GenHlth"] = gen_hlth
    prof["Age"] = age
    prof["Sex"] = sex
    pred = predict_single(prof, model_name="LightGBM")
    return {
        "profile": prof,
        "prediction": pred
    }

# -----------------------------------------------------------------------------
# Static Frontend Serving
# -----------------------------------------------------------------------------
app.mount("/styles", StaticFiles(directory="frontend/styles"), name="styles")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

@app.get("/")
def serve_index():
    index_path = os.path.join("frontend", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "CardioLens API active. Frontend index.html being prepared."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
