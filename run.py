import os
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
import socket
import sys
import subprocess

REQUIRED_ARTIFACTS = [
    os.path.join("artifacts", "feature_meta.json"),
    os.path.join("artifacts", "model_metrics.json"),
    os.path.join("artifacts", "shap_global.json"),
    os.path.join("artifacts", "lime_cases.json"),
    os.path.join("artifacts", "lime_agreement.json"),
    os.path.join("artifacts", "patient_map.json"),
    os.path.join("artifacts", "pdp_ice.json"),
    os.path.join("artifacts", "risk_tables.json"),
    os.path.join("artifacts", "fairness_audit.json"),
    os.path.join("artifacts", "correlations.json"),
    os.path.join("artifacts", "models", "lightgbm_cal.joblib")
]

def check_and_run_pipeline():
    missing = [p for p in REQUIRED_ARTIFACTS if not os.path.exists(p)]
    if missing:
        print(f"Detected {len(missing)} missing pipeline artifacts. Running end-to-end pipeline...")
        scripts = [
            "pipeline/01_subsample.py",
            "pipeline/02_split.py",
            "pipeline/03_train_models.py",
            "pipeline/04_shap_global.py",
            "pipeline/05_lime_cases.py",
            "pipeline/06_advanced_analysis.py",
            "pipeline/07_export.py"
        ]
        for script in scripts:
            print(f"--> Executing {script}...")
            ret = subprocess.run([sys.executable, script])
            if ret.returncode != 0:
                print(f"Error executing {script}. Aborting.")
                sys.exit(1)
        print("Pipeline execution completed successfully.")
    else:
        print("All pipeline artifacts verified and ready.")

def find_free_port(start_port=8000, end_port=8100):
    for port in range(start_port, end_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port available between {start_port} and {end_port}.")


def start_server():
    import uvicorn
    host = "127.0.0.1"
    port = int(os.getenv("CARDIOLENS_PORT", "8000"))
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind((host, port))
    except OSError:
        port = find_free_port()
        print(f"Port {os.getenv('CARDIOLENS_PORT', '8000')} is busy; using {port} instead.")
    print("=" * 65)
    print("  CardioLens: Explainable-AI Studio for Heart Disease Risk")
    print(f"  Web Studio running at: http://{host}:{port}")
    print("=" * 65)
    uvicorn.run("backend.main:app", host=host, port=port, log_level="info")

if __name__ == "__main__":
    check_and_run_pipeline()
    start_server()
