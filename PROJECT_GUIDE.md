# PulseIQ — Cardiovascular Intelligence & Explainable AI Suite
## Comprehensive Project Architecture, Methodology & Operating Manual (A to Z)

---

### Executive Overview

**PulseIQ** is an enterprise-grade, clinical explainable artificial intelligence (XAI) suite designed to evaluate, explain, and simulate 10-year cardiovascular disease risk using real-world public health surveillance data.

Cardiovascular disease (CVD) remains the leading cause of mortality globally. Traditional risk calculators (such as the Framingham Risk Score or ASCVD Pooled Cohort Equations) frequently operate on rigid linear point systems that struggle to capture non-linear relationships, multi-morbidity interactions, and demographic disparities. Conversely, modern machine learning models (such as Gradient Boosted Decision Trees) deliver high diagnostic accuracy but have historically functioned as opaque "black boxes," hindering clinical trust, patient comprehension, and regulatory compliance.

PulseIQ bridges this divide. Trained on **253,680 real CDC health survey records**, PulseIQ unites **state-of-the-art calibrated machine learning** with a full suite of **local and global explainable AI (TreeSHAP, LIME, PDP/ICE, Counterfactual Recourse)** into an interactive, visually stunning, high-grade analytical studio.

---

## 1. System Architecture & Directory Structure

PulseIQ is engineered as a decoupled, high-performance client-server application:

```
c:/IV Project/
├── backend/                         # FastAPI High-Performance Asynchronous Backend
│   ├── main.py                      # REST API routing, rate limiting, static file serving
│   ├── explain.py                   # ModelManager, LightGBM inference, SHAP, LIME explainer
│   ├── counterfactual.py            # Minimal-change recourse optimization algorithms
│   ├── cohort.py                    # Stratified population slicing and subgroup queries
│   ├── simulate.py                  # Public health intervention simulation engine
│   └── schemas.py                   # Pydantic data schemas and request validation models
│
├── frontend/                        # Responsive High-Grade Web Studio
│   ├── index.html                   # Bento-grid workspace layout and HTML5 structure
│   ├── styles/
│   │   └── main.css                 # Midnight Sapphire (Dark) & Crisp Titanium (Light) Design System
│   └── js/
│       ├── app.js                   # Application Core Orchestrator and lifecycle management
│       ├── api.js                   # REST client wrappers for all backend endpoints
│       ├── state.js                 # Reactive centralized state store and patient profiles
│       ├── charts/                  # Modular D3.js and HTML5 Canvas visualization components
│       │   ├── gauge.js             # Calibrated radial risk gauge with uncertainty band
│       │   ├── waterfall.js         # SHAP waterfall attribution bar chart
│       │   ├── force_bar.js         # Horizontal force attribution balance bar
│       │   ├── radar.js             # 6-axis biometric risk fingerprint radar
│       │   ├── sensitivity.js       # ICE single-factor sensitivity curve with drag handle
│       │   ├── whatif2d.js          # 2-factor risk interaction matrix
│       │   ├── patient_map.js       # Canvas 2D SHAP manifold scatter plot (2,250 patients)
│       │   ├── beeswarm.js          # Population-wide SHAP beeswarm plot
│       │   ├── dendrogram.js        # Feature correlation hierarchical dendrogram
│       │   ├── dashboard_charts.js  # Risk distribution histogram, age curve, donut, tornado
│       │   ├── correlation_heatmap.js # 21x21 Spearman correlation matrix
│       │   └── roc_pr.js            # ROC and Precision-Recall diagnostic performance curves
│       └── ui/
│           ├── controls.js          # 21-feature clinical instrument panel with sliders and dual switches
│           ├── command_palette.js   # Keyboard-driven command palette (Ctrl+K)
│           └── guided_story.js      # 4-stage interactive patient journey walkthrough
│
├── pipeline/                        # End-to-End Machine Learning ETL & Training Pipeline
│   ├── 01_subsample.py              # Stratified representative subsampling (15,000 records)
│   ├── 02_split.py                  # Train (70%) / Validation (15%) / Test (15%) partition
│   ├── 03_train_models.py           # Model training, isotonic calibration, and metric evaluation
│   ├── 04_shap_global.py            # Global TreeSHAP extraction, beeswarm, and dendrogram
│   ├── 05_lime_cases.py             # LIME tabular explainer precomputation and test cases
│   ├── 06_advanced_analysis.py      # PDP/ICE curves, 2D grids, patient manifold, fairness audit
│   └── 07_export.py                 # JSON artifact validation and export verification
│
├── artifacts/                       # Precomputed pipeline artifacts and serialized model binaries
│   ├── feature_meta.json            # 21 feature metadata, bounds, types, and descriptions
│   ├── model_metrics.json           # ROC, PR, calibration curves, confusion matrices
│   ├── shap_global.json             # Global SHAP values, beeswarm coordinates, dendrogram
│   ├── patient_map.json             # 2,250 test patient coordinates, clusters, and phenotypes
│   ├── pdp_ice.json                 # Precomputed ICE curves across features
│   ├── risk_tables.json             # 1D and 2D prevalence tables with 95% Wilson intervals
│   ├── fairness_audit.json          # Demographic parity and equalized odds evaluations
│   ├── correlations.json            # 21x21 pairwise Spearman correlation matrix
│   └── models/                      # Serialized scikit-learn & LightGBM joblib bundles
│
├── data/                            # Raw and processed datasets
│   ├── raw/                         # Raw CDC BRFSS 2015 CSV (253,680 rows)
│   └── processed/                   # train.csv, val.csv, test.csv
│
├── run.py                           # Single-command pipeline verification and server launcher
└── requirements.txt                 # Python package dependencies
```

---

## 2. Dataset & Preprocessing Pipeline

PulseIQ is built on the **CDC Behavioral Risk Factor Surveillance System (BRFSS 2015)** dataset, one of the most comprehensive ongoing national health surveys in the United States.

### Feature Dictionary (21 Indicators)

| Feature Name | Clinical Label | Data Type | Bounds / Levels | Modifiable? | Category |
|---|---|---|---|---|---|
| `HighBP` | High Blood Pressure | Binary | 0 (No), 1 (Yes) | Modifiable | Cardiovascular |
| `HighChol` | High Cholesterol | Binary | 0 (No), 1 (Yes) | Modifiable | Cardiovascular |
| `CholCheck` | Cholesterol Check in 5y | Binary | 0 (No), 1 (Yes) | Modifiable | Cardiovascular |
| `BMI` | Body Mass Index | Continuous | 12.0 – 98.0 kg/m² | Modifiable | Cardiovascular |
| `Smoker` | Smoked $\ge$ 100 Cigarettes | Binary | 0 (No), 1 (Yes) | Modifiable | Lifestyle |
| `Stroke` | Prior Stroke Diagnosis | Binary | 0 (No), 1 (Yes) | Fixed History | Cardiovascular |
| `Diabetes` | Diabetes Status | Ordinal | 0 (No), 1 (Pre), 2 (Yes) | Modifiable | Cardiovascular |
| `PhysActivity` | Physical Activity in 30d | Binary | 0 (No), 1 (Yes) | Modifiable | Lifestyle |
| `Fruits` | Daily Fruit Consumption | Binary | 0 (No), 1 (Yes) | Modifiable | Lifestyle |
| `Veggies` | Daily Vegetable Consumption | Binary | 0 (No), 1 (Yes) | Modifiable | Lifestyle |
| `HvyAlcoholConsump` | Heavy Alcohol Drinking | Binary | 0 (No), 1 (Yes) | Modifiable | Lifestyle |
| `AnyHealthcare` | Health Insurance Coverage | Binary | 0 (No), 1 (Yes) | Socioeconomic | Wellbeing |
| `NoDocbcCost` | Couldn't See Doctor (Cost) | Binary | 0 (No), 1 (Yes) | Socioeconomic | Wellbeing |
| `GenHlth` | General Health Perception | Ordinal | 1 (Excellent) – 5 (Poor) | Modifiable | Wellbeing |
| `MentHlth` | Poor Mental Health Days | Discrete | 0 – 30 days/month | Modifiable | Wellbeing |
| `PhysHlth` | Poor Physical Health Days | Discrete | 0 – 30 days/month | Modifiable | Wellbeing |
| `DiffWalk` | Serious Difficulty Walking | Binary | 0 (No), 1 (Yes) | Modifiable | Wellbeing |
| `Sex` | Biological Sex | Binary | 0 (Female), 1 (Male) | Fixed | Demographic |
| `Age` | Age Category | Ordinal | 1 (18-24) – 13 (80+) | Fixed | Demographic |
| `Education` | Education Level Completed | Ordinal | 1 (None) – 6 (College 4y+) | Fixed | Demographic |
| `Income` | Household Income Tier | Ordinal | 1 (<$10k) – 8 ($\ge$\$75k) | Fixed | Demographic |

**Target Variable:** `HeartDiseaseorAttack` (Binary: 0 = Negative, 1 = Positive). Natural prevalence in the national survey population: **9.42%**.

### ETL Pipeline Sequence

1. **`01_subsample.py`**: Extracts a stratified 15,000-row representative cohort from the 253,680 survey records, locking in an exact 9.42% positive prevalence.
2. **`02_split.py`**: Partitions into **Train (70%, 10,500 rows)**, **Validation (15%, 2,250 rows)**, and **Test (15%, 2,250 rows)**.
3. **`03_train_models.py`**: Trains the machine learning model suite (LightGBM, XGBoost, Random Forest, Logistic Regression), tunes class weighting (`scale_pos_weight=9.62`), and applies **isotonic probability calibration**.
4. **`04_shap_global.py`**: Computes exact Shapley values on test records using `shap.TreeExplainer`, generating global feature rankings, beeswarm distributions, and hierarchical feature dendrograms.
5. **`05_lime_cases.py`**: Initializes a `LimeTabularExplainer` fitted on training data distributions and precomputes benchmark case explanations.
6. **`06_advanced_analysis.py`**: Precomputes PDP/ICE single-factor curves, 2D interaction grids, 2D UMAP/PCA SHAP manifold projections, and demographic fairness audits.
7. **`07_export.py`**: Verifies and serializes all JSON artifacts for instant, sub-millisecond client delivery.

---

## 3. Machine Learning & Probability Calibration

Standard machine learning models optimize loss functions (such as log-loss or cross-entropy) that often produce uncalibrated probabilities when trained with class-weighting or imbalance techniques. In medicine, raw scores can lead to over-diagnosis or under-treatment.

### Probability Calibration Strategy
PulseIQ uses **Isotonic Regression** (prefit on the hold-out validation set):
- Raw model outputs $z$ are mapped through a non-parametric isotonic function $f(z) \to P(Y=1 \mid X)$.
- Brier score loss drops to **~0.067**, ensuring that when PulseIQ estimates a 20% risk, approximately 20 out of 100 similar patients experience a heart event.

### Uncertainty Quantification
PulseIQ implements a **30-member bootstrap ensemble**:
- Generates a 5th–95th percentile confidence interval around every calibrated prediction.
- Displays this uncertainty directly on the risk gauge as a semi-transparent confidence halo.

---

## 4. Explainable AI (XAI) Suite

PulseIQ embeds four complementary XAI paradigms:

1. **SHAP (SHapley Additive exPlanations)**:
   - Rooted in cooperative game theory, guarantees efficiency, symmetry, and additivity.
   - Computes exact log-odds contributions for all 21 factors for each patient.
2. **LIME (Local Interpretable Model-agnostic Explanations)**:
   - Perturbs the patient profile 1,000 times, weights samples by proximity, and fits a local linear surrogate model.
   - Returns local weights and an empirical $R^2$ surrogate fidelity score.
3. **PDP & ICE (Partial Dependence & Individual Conditional Expectation)**:
   - 1D sensitivity curves showing how risk responds to varying a single biometric while holding all other factors constant.
   - 2D heatmaps showing non-linear interactions between factor pairs (e.g., Age $\times$ BMI or Blood Pressure $\times$ Cholesterol).
4. **Counterfactual Recourse Optimization**:
   - Computes actionable, minimal-change pathways for patients with elevated risk to lower their probability below the 20% threshold.

---

## 5. Complete Operating Guide (A to Z)

### Section 0: Top Header & Vitals Monitor
- **App Title & Live Indicator**: Shows "PulseIQ" with live AI engine badge.
- **Vitals Ticker**: Displays an animated pulsating heart with oscillating BPM (72–76 BPM).
- **Model Selector**: Switch between LightGBM (Primary Calibrated), XGBoost, Random Forest, or Logistic Regression.
- **Audience Mode Toggle**:
  - *Plain Language*: Risk percentages and percentage-point impacts.
  - *Technical Mode*: Exact raw log-odds and Shapley margins.
- **Command Palette (`Ctrl + K`)**: Instant search modal to navigate between any section or preset.
- **Theme Toggle (Sun/Moon)**: Instant switch between **Midnight Sapphire Dark Mode** and **Crisp Titanium Light Mode**.
- **Print / PDF Report**: Prepares an executive, print-optimized clinical summary sheet.

---

### Section 1: Executive & Population Analytics Dashboard
*The central public health cockpit for population-wide risk surveillance.*

- **KPI Metric Banners**: Displays total survey records (253,680), biomarkers (21), and model ROC-AUC (0.852).
- **Interactive Population Filters**:
  - Dropdown slicers for Age, Sex, High Blood Pressure, High Cholesterol, Smoking, Diabetes, Physical Activity, General Health, and Prior Stroke.
  - **Filter Presets**: One-click filters for Seniors with High Blood Pressure, Metabolic Conditions, Active Young Adults, Smokers, and Low-Income Groups.
  - **Reset Button**: Restores the national representative sample.
- **4 Real-Time Analytical Charts**:
  1. *Risk Distribution Histogram*: Cohort risk distribution vs. National baseline.
  2. *Age-Stratified Risk Curve*: Observed survey event rate vs. Calibrated model risk across 6 age brackets.
  3. *Comorbidity Load Donut*: Patient distribution across 0, 1, 2, or 3+ cardiovascular comorbidities.
  4. *Cohort SHAP Tornado*: Top 6 risk factors distinguishing this specific population slice from the national average.
- **Export Cohort CSV**: Downloads a clean CSV containing the currently filtered patient cohort.

---

### Section 2: Patient Risk Lab (Personal Risk Calculator)
*The core interactive clinical workbench for individual risk analysis.*

1. **21-Feature Instrument Panel**:
   - Filter by categories: **All (21)**, **Cardio (6)**, **Lifestyle (5)**, **Health (4)**, or **Demographics (6)**.
   - **Tactile Dual Switches**: Click `No / Normal` (illuminates emerald) or `Yes / Diagnosed` (illuminates crimson).
   - **Gradient Range Sliders**: Adjust BMI, Age, General Health, etc. Tracks update with live gradient fills and real-time numeric badges.
   - **Patient Presets Strip**: Load standard clinical archetypes (Healthy 30y, Typical 45y, Hypertensive 62y, Critical 72y, or Random).
2. **Calibrated Radial Risk Gauge**:
   - Needle sweeps to calculated 10-year risk percentage.
   - Shows risk category (**Low**, **Moderate**, **High**, or **Critical**).
   - Displays the 90% confidence uncertainty interval halo and the 20% decision threshold line.
3. **SHAP Waterfall Decomposition**:
   - Step-by-step breakdown starting from population baseline (9.4%).
   - Crimson bars show risk-elevating factors; emerald bars show protective factors.
4. **Risk Fingerprint Radar Chart**:
   - 6 biometric axes (Cardiometabolic, Age Exposure, Lifestyle/Diet, Tobacco/Alcohol, Functional Health, BMI).
   - Compares the individual patient polygon against the national average benchmark.
5. **Summary & Health Insights Narrative**:
   - Clear, plain-language clinical takeaway explaining primary drivers and risk ratios.
6. **"Explain with LIME" Engine**:
   - Click the **Explain with LIME** button to generate 1,000 synthetic patient permutations.
   - Renders a dedicated breakdown card with local model fit ($R^2$ fidelity score), intercept baseline, and horizontal impact bars.
7. **Single-Factor ICE Sensitivity Curve**:
   - Select any biomarker from the dropdown to see how risk varies across its entire range.
   - Drag the live point handle along the curve to update the patient profile in real time.
8. **Two-Factor Risk Matrix**:
   - 8x8 heatmap grid demonstrating risk interactions between two health factors.
   - Click any cell in the grid to instantly load both values into the patient profile.

---

### Section 3: Action Plans & Counterfactual Recourse
*Actionable medical recommendations to reduce risk.*

- **Target Mode Dropdown**: Choose between *Bring Risk Below 20% Threshold* or *Target 10% Absolute Risk*.
- **Generate Interventions**: Computes minimal-change pathways prioritized by feasibility.
- **Plan Cards**: Displays resulting risk, points reduced, and concrete lifestyle actions.
- **Apply to Lab Button**: One-click transfers the chosen action plan directly into the Risk Lab.

---

### Section 4: Community Health Simulator & Cohort Studio
*Policy simulation for community-wide health interventions.*

- **Cohort Query Builder**: Query custom sub-populations and view observed disease rates.
- **Community Health Simulator**:
  - Adjust sliders for: Smoking Prevalence Reduction (%), Physical Activity Increase (%), Average BMI Reduction (points), and High BP Control (%).
  - Click **Run Simulation** to calculate projected cases prevented per 1,000 adults with 95% confidence intervals and factor attribution breakdowns.

---

### Section 5: Interactive Patient Map (2D SHAP Manifold)
*Visualizing population health patterns across 2,250 real test patients.*

- **Canvas Manifold**: 2,250 patients mapped using dimensionally-reduced SHAP coordinates.
- **Color Modes**: Switch between **Calibrated Risk**, **True Diagnosis**, and **Phenotype Cluster**.
- **Interactive Controls**: Drag to pan, scroll wheel to zoom.
- **"Place My Profile" Button**: Places an animated glowing beacon showing where the current patient sits in the population, highlighting their 10 nearest clinical neighbors.
- **Phenotypes Sidebar**: Inspect common demographic clusters identified by the model.

---

### Section 6: Global Feature Insights
*Population-level model transparency.*

- **Population SHAP Beeswarm Plot**: Inspects test patients across the top 10 biomarkers, showing feature impact and value distribution.
- **Hierarchical Feature Dendrogram**: Tree diagram grouping biomarkers that frequently co-occur in the population.

---

### Section 7: Model Arena & Decision Tuning
*Model comparison and diagnostic threshold optimization.*

- **Interactive Threshold Slider (0.05 to 0.60)**:
  - Drag to balance Sensitivity vs. Specificity.
  - Displays live updates for Alert Accuracy (Precision), True Cases Caught (Recall), and F1 Score.
  - Plain-language clinical sentence: *"At threshold X, catches Y of 100 cases with Z false alarms per 1,000 individuals."*
- **ROC and Precision-Recall Curves**: Compares LightGBM, XGBoost, Random Forest, and Logistic Regression with live threshold markers.

---

### Section 8: AI Fairness & Demographic Equality Audit
*Ensuring equitable AI performance across demographic groups.*

- **4 Evaluated Dimensions**:
  1. *Biological Sex* (Female vs. Male)
  2. *Age Groups* (Young Adults, Middle-Aged, Seniors)
  3. *Household Income* (8 Income Tiers)
  4. *Education Level* (Completed Schooling Tiers)
- **Metrics Tracked**: Equalized Odds Disparity, Demographic Parity Difference, Subgroup True Positive Rate (Recall), False Positive Rate, and ROC-AUC.
- **Disparity Flags**: Highlights any demographic dimension with potential bias.

---

### Section 9: Data Explorer & Correlation Matrix
*Raw epidemiological survey validation.*

- **1D Prevalence Tables**: Select any of the 21 features to view observed heart disease rates and 95% Wilson Score confidence intervals.
- **21x21 Spearman Correlation Matrix**: Full pairwise correlation heatmap. Hover over any cell to see correlation coefficients, or click to load that feature pair into the 2D Risk Matrix.

---

### Section 10: Batch Registry Scoring
*High-throughput clinical screening.*

- **File Drag & Drop**: Upload CSV files containing up to 5,000 patient rows.
- **Pre-Loaded Clinical Registry**: Automatically loads 10 representative demonstration patient profiles.
- **Batch Summary**: Displays total rows scored, average batch risk, and positive detection rates.
- **"Open in Lab" Action**: Click any row in the table to load that patient profile into the Risk Lab.

---

### Section 11: Guided Patient Journey
*Educational case study walking through a real patient scenario.*

- 4 sequential interactive steps:
  1. Baseline Clinical Assessment (62yo hypertensive patient).
  2. Machine Learning Risk Stratification (Gauge & Waterfall breakdown).
  3. Counterfactual Lifestyle Recourse (Applying exercise, BP control, and smoking cessation).
  4. Re-Assessment & Long-Term Risk Reduction (Risk drop from 28% to 14%).

---

### Section 12: Methodology & Safety Guidelines
*Formal documentation and governance.*

- Dataset provenance (CDC BRFSS 2015).
- Model hyperparameters and calibration specifications.
- **Safety Disclaimers**: Clarifies that PulseIQ is an educational research system based on observational survey data and does not constitute a diagnostic medical device.

---

## 6. How to Run & Verify

1. **Prerequisites**: Python 3.10+ installed.
2. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Launch Studio**:
   ```bash
   python run.py
   ```
4. **Open Browser**: Navigate to `http://127.0.0.1:8000/`.
