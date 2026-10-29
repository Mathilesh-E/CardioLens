# CardioLens

**CardioLens** is an interactive research and education project for exploring machine-learning predictions about heart disease indicators. It combines a FastAPI backend, a browser-based analytics studio, pre-trained classification models, and explainability and population-analysis tools. The interface and project guide also refer to the studio as **PulseIQ**.

> **Important:** CardioLens is not a medical device and is not intended to diagnose disease, estimate an individual's clinically validated future risk, or recommend treatment. Its models use observational, self-reported survey data and are for research and educational exploration only. Do not use its outputs for clinical or other high-stakes decisions.

## What it does

- **Interactive risk lab:** Enter a 21-feature profile and compare calibrated model scores, risk bands, uncertainty intervals, and feature contributions.
- **Explainability:** Explore individual and population explanations with SHAP and LIME, plus one- and two-feature sensitivity views (PDP/ICE).
- **What-if analysis and counterfactuals:** Inspect how changing profile values affects a model score and explore candidate lower-score profiles. These are model-generated scenarios, not medical advice or guaranteed outcomes.
- **Population analysis:** Filter cohorts, simulate hypothetical interventions, inspect a patient map and feature correlations, and review subgroup fairness metrics.
- **Model comparison:** Compare LightGBM, XGBoost, Random Forest, and Logistic Regression, including ROC, precision-recall, calibration, and threshold metrics.
- **Batch scoring:** Upload a CSV of patient features for model scoring and review the resulting scores and model explanations.
- **Precomputed dashboard data:** Browse exported analysis artifacts and figures without rerunning the full training pipeline.

## Data and modeling

The project is built around the CDC Behavioral Risk Factor Surveillance System (BRFSS) 2015 heart-disease-indicator dataset included in this repository. The original data contains 253,680 survey records. The pipeline creates a reproducible, stratified 15,000-record sample and then makes stratified 70% / 15% / 15% train, validation, and test splits.

The prediction target is `HeartDiseaseorAttack`, a survey indicator of reported heart disease or heart attack. The model score therefore reflects patterns learned for that dataset target; it is **not** a prospectively validated 10-year cardiovascular-risk estimate. The 21 input features cover blood pressure and cholesterol indicators, BMI, smoking, diabetes, activity, general and physical health, demographics, and socioeconomic indicators.

Four classifier families are trained and compared. The pipeline calibrates model probabilities using validation data and creates a 30-member bootstrap ensemble for a prediction uncertainty interval. SHAP, LIME, sensitivity analyses, fairness summaries, and other dashboard data are exported as artifacts.

### Data and artifact size

The repository includes the source dataset, processed splits, precomputed JSON analyses, figures, and serialized model files so the app can be used without retraining. These files make the repository relatively large. The source CSV is present both at the repository root and under `data/raw/`; the pipeline reads the latter.

## Project layout

```text
backend/       FastAPI routes, model loading, explanations, cohort analysis,
               counterfactuals, simulation, and request schemas
frontend/      Browser application, CSS, and JavaScript charts and controls
pipeline/      Seven data preparation, training, analysis, and export scripts
data/raw/      Source BRFSS CSV used by the pipeline
data/processed/ Stratified sample and train/validation/test splits
artifacts/     Trained models and precomputed dashboard JSON/joblib files
reports/       Feature/chart documentation and generated figures
tests/         API/model behavior tests
run.py         Artifact check and local web-server launcher
PROJECT_GUIDE.md  Detailed feature, architecture, and methodology guide
```

## Requirements

- Python 3.10 or later
- Packages listed in [`requirements.txt`](requirements.txt)

The project uses scientific Python libraries and serialized scikit-learn-compatible models. For best compatibility, use the included artifacts with the dependency versions installed from the requirements file.

## Run locally

From the project directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python run.py
```

On macOS or Linux, activate the environment with:

```bash
source .venv/bin/activate
```

Open **http://127.0.0.1:8000/** in a browser. The launcher checks for required artifacts and runs the full pipeline if any are missing; training and analysis can take substantial time. If port 8000 is occupied, the launcher selects another free port in the 8000–8100 range. To request a particular port, set `CARDIOLENS_PORT` before launching (for example, in PowerShell: `$env:CARDIOLENS_PORT = "8001"`).

The backend API's interactive documentation is available at **http://127.0.0.1:8000/docs** while the server is running.

### Run the pipeline manually

Run these commands from the repository root and in order:

```powershell
python pipeline/01_subsample.py
python pipeline/02_split.py
python pipeline/03_train_models.py
python pipeline/04_shap_global.py
python pipeline/05_lime_cases.py
python pipeline/06_advanced_analysis.py
python pipeline/07_export.py
```

The pipeline reads `data/raw/heart_disease_health_indicators_BRFSS2015.csv` and writes processed data and model/analysis artifacts under `data/processed/` and `artifacts/`.

## API overview

The FastAPI application exposes precomputed analyses and interactive operations. Common read endpoints include:

| Endpoint | Purpose |
|---|---|
| `GET /api/meta` | Feature metadata |
| `GET /api/metrics` | Model metrics and diagnostic curves |
| `GET /api/global` | Global SHAP analysis |
| `GET /api/cases` | Precomputed LIME cases |
| `GET /api/fairness` | Fairness audit |
| `GET /api/patientmap` | Patient-map coordinates and data |
| `GET /api/pdp` | PDP/ICE data |
| `GET /api/risk-tables` | Prevalence tables |
| `GET /api/correlations` | Feature correlations |
| `POST /api/predict` | Score a single profile |
| `POST /api/whatif` and `POST /api/whatif2d` | Evaluate one- and two-feature changes |

See `/docs` for the complete endpoint list, request schemas, and response formats.

## Tests

Run the test suite from the repository root:

```powershell
python -m pytest
```

Tests cover model loading, SHAP additivity, prediction behavior and latency, counterfactual score changes, and cohort filtering.

## Limitations and responsible use

- BRFSS is an observational, self-reported survey dataset from 2015. It is not a clinical trial or a longitudinal validation cohort for an individual's future risk.
- Calibration, uncertainty intervals, explanations, and fairness summaries describe this project's models and data; they do not establish clinical validity, causality, or fairness in other populations.
- Counterfactuals and simulated interventions are model-based explorations, not evidence that a real-world intervention will cause the displayed outcome.
- Protect personal and health information. Do not upload identifiable or sensitive patient data to this demonstration application.
- Consult qualified healthcare professionals for medical questions or decisions.

For the full walkthrough of the interface and methodology, see [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md).