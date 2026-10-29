# PulseIQ: Comprehensive Clinical AI & Visualization Suite Guide

## 1. Executive Summary & Purpose
**PulseIQ** is an explainable artificial intelligence (XAI) clinical intelligence platform designed for cardiovascular risk stratification, epidemiologic research, and interactive patient counseling. Trained on **253,680 records** and 21 clinical biomarkers from the **CDC Behavioral Risk Factor Surveillance System (BRFSS 2015)**, PulseIQ bridges the gap between opaque machine-learning predictions and transparent, actionable healthcare interventions.

---

## 2. Core Architecture & Models

PulseIQ provides real-time access to four supervised learning algorithms calibrated with isotonic regression:

| Model Architecture | ROC-AUC | PR-AUC | Optimal Threshold | Clinical Role |
| :--- | :---: | :---: | :---: | :--- |
| **LightGBM (Primary Calibrated)** | **0.832** | **0.330** | **0.20** | Primary fast-inference model with exact TreeSHAP attributions |
| **XGBoost (Calibrated)** | **0.849** | **0.362** | **0.21** | High-precision gradient booster for comparative analysis |
| **Random Forest (Balanced)** | **0.838** | **0.332** | **0.21** | Non-parametric bagging baseline with stable out-of-bag variance |
| **Logistic Regression (Standardized)** | **0.851** | **0.403** | **0.22** | Linear odds-ratio benchmark for clinical interpretability |

---

## 3. Comprehensive Feature Dictionary (21 Biomarkers)

PulseIQ models 21 distinct physiological, behavioral, and demographic features:

### A. Modifiable Clinical Biomarkers
1. **`HighBP` (High Blood Pressure)**: Categorical (0 = Normal, 1 = Hypertension). One of the top risk drivers elevating odds of myocardial infarction.
2. **`HighChol` (High Cholesterol)**: Categorical (0 = Normal, 1 = Elevated). Indicates dyslipidemia.
3. **`CholCheck` (Cholesterol Checked)**: Categorical (0 = No check in 5 years, 1 = Checked).
4. **`BMI` (Body Mass Index)**: Continuous (Range: 12 – 98 kg/m²). Metric representing obesity stratification.
5. **`Diabetes` (Diabetes Diagnosis)**: Categorical (0 = Non-diabetic, 1 = Prediabetes, 2 = Diabetic). Major vascular risk multiplier.

### B. Modifiable Lifestyle Factors
6. **`Smoker` (Smoking History)**: Categorical (0 = Non-smoker, 1 = Smoked ≥ 100 cigarettes in lifetime).
7. **`PhysActivity` (Physical Activity)**: Categorical (0 = Sedentary, 1 = Active in past 30 days). Protective lifestyle factor.
8. **`Fruits` (Daily Fruit Intake)**: Categorical (0 = Less than daily, 1 = Daily).
9. **`Veggies` (Daily Vegetable Intake)**: Categorical (0 = Less than daily, 1 = Daily).
10. **`HvyAlcoholConsump` (Heavy Drinking)**: Categorical (0 = Moderate/None, 1 = Heavy: Men > 14 drinks/week, Women > 7 drinks/week).

### C. Wellbeing & Functional Status
11. **`GenHlth` (General Health Status)**: Ordinal (1 = Excellent, 2 = Very Good, 3 = Good, 4 = Fair, 5 = Poor). Consistently the top overall risk driver across all models.
12. **`MentHlth` (Poor Mental Health Days)**: Discrete (0 – 30 days in past month).
13. **`PhysHlth` (Poor Physical Health Days)**: Discrete (0 – 30 days in past month).
14. **`DiffWalk` (Difficulty Walking / Stairs)**: Categorical (0 = No difficulty, 1 = Severe ambulatory difficulty).
15. **`Stroke` (Prior Stroke)**: Categorical (0 = No prior stroke, 1 = Prior stroke diagnosed).

### D. Fixed Demographics & Access
16. **`Sex` (Biological Sex)**: Categorical (0 = Female, 1 = Male). Men exhibit earlier cardiovascular incidence.
17. **`Age` (Age Bracket)**: Ordinal 13-bracket categorization (1 = 18–24 up to 13 = 80+).
18. **`Education` (Highest Level Completed)**: Ordinal (1 = None/Kindergarten up to 6 = College graduate).
19. **`Income` (Household Income Bracket)**: Ordinal (1 = <$10k up to 8 = ≥$75k).
20. **`AnyHealthcare` (Health Insurance Coverage)**: Categorical (0 = Uninsured, 1 = Insured).
21. **`NoDocbcCost` (Doctor Cost Barrier)**: Categorical (0 = Affordable, 1 = Could not afford doctor visit in past 12 months).

---

## 4. Visualizations & Scientific Charts Guide

| Chart Name | Type & Technology | Coordinates / Axes | What It Does & Clinical Value |
| :--- | :--- | :--- | :--- |
| **Interactive Patient Map** | 2D Manifold Canvas Scatter Plot | **X-Axis**: t-SNE / UMAP Dim 1 (Latent Manifold)<br>**Y-Axis**: t-SNE / UMAP Dim 2 (Risk Drivers) | Plots **2,250 test patients** in SHAP embedding space. Clusters visually reveal natural clinical phenotypes (e.g. Metabolic Syndrome vs. Healthy Young). Users can toggle Risk, Actual Diagnosis, or Cluster color modes, pan/zoom, hover for patient cards, and **click any point to load that patient profile into the Risk Lab**. |
| **Cardiac Oscilloscope ECG** | High-precision HTML5 Canvas | **Horizontal**: Real-time Sweep CRT Beam<br>**Vertical**: P-Q-R-S-T cardiac voltage | Real-time clinical telemetry showing atrial and ventricular depolarization/repolarization waves with glowing phosphor trail and live oscillating BPM ticker. |
| **Risk Gauge** | Circular SVG Meter | **Arc Range**: 0% to 100% Risk | Displays current patient predicted 10-year probability with color-coded risk bands (Optimal: <10%, Moderate: 10–20%, Elevated: 20–35%, Critical: >35%) and comparison against the 9.42% national BRFSS baseline. |
| **SHAP Waterfall Plot** | Staggered Horizontal Bar Cascade | **X-Axis**: Log-Odds / Prob % Shifts<br>**Y-Axis**: Ranked Biomarkers | Deconstructs exactly how each factor pushes the patient's risk up (Crimson) or down (Emerald) starting from the base population rate to reach the final score. Supports **Audience Toggle** (Plain English vs. Clinical Technical log-odds). |
| **Force Evidence Bar** | Dual-Sided Stacked Proportion Bar | **Left**: Protective Evidence % (Emerald)<br>**Right**: Risk-Elevating Evidence % (Crimson) | Visualizes balance of evidence pushing probability up vs. down. |
| **Risk Fingerprint Radar** | 6-Axis Polar Polygon Chart | **Axes**: Cardiometabolic, Age Factor, Lifestyle/Diet, Tobacco/Alcohol, Functional Health, BMI | Compares patient fingerprint against general population and high-risk phenotype cluster. |
| **Single Factor Sensitivity Curve (ICE)** | Line & Shaded Area Curve | **X-Axis**: Feature Value<br>**Y-Axis**: Predicted Risk (0–100%) | Displays individual conditional expectation (ICE) showing how altering one continuous or discrete factor changes patient risk, with draggable operating marker and 20% high-risk benchmark line. |
| **Two-Factor Risk Matrix (What-If 2D)** | 2D Binned Heatmap Matrix | **X-Axis**: Feature 2 Value<br>**Y-Axis**: Feature 1 Value | Computes non-linear feature interactions between two risk factors (e.g. Age × BMI), highlighting synergistic risks. Clicking any cell immediately updates the active profile. |
| **Risk Distribution Histogram** | Grouped Bar Chart | **X-Axis**: Risk Probability Bins (0–5%, 5–10%, ...)<br>**Y-Axis**: Group Fraction (%) | Compares filtered cohort distribution against national baseline. |
| **Age Stratification Breakdown** | Comparative Bar Chart | **X-Axis**: Age Brackets (18–39, 40–54, 55–64, 65+)<br>**Y-Axis**: Heart Disease Prevalence (%) | Highlights epidemiological escalation across life stages. |
| **Lifestyle Divergence Chart** | Dual Horizontal Diverging Bars | **X-Axis**: Prevalence Difference (Cohort vs National %)<br>**Y-Axis**: Lifestyle Factors | Shows behavioral lifestyle divergence in physical activity, diet, and smoking. |
| **Spearman Correlation Matrix** | 21×21 Interactive Heatmap Matrix | **X & Y Axes**: 21 Biomarkers | Displays pairwise non-parametric correlation coefficient ($r \in [-1, +1]$) with colorbar legend. Clicking any cell directly loads that feature pair into the Two-Factor What-If Matrix. |
| **SHAP Beeswarm Plot** | Staggered Swarm Scatter | **X-Axis**: SHAP Impact (Log-Odds)<br>**Y-Axis**: Top 10 Ranked Features | Displays distribution of SHAP values across 3,000 sampled patients. Dots color-coded by feature value (Red = High, Blue = Low) with entrance spring animation and hover cards. |
| **Feature Clustering Dendrogram** | Horizontal Tree Cluster Hierarchy | **Horizontal**: Ward Linkage Distance<br>**Vertical**: Feature Leaves | Displays hierarchical grouping of correlated features into biological clusters (e.g. general health and mobility cluster together). |
| **ROC & Precision-Recall Curves** | Dual Coordinate Curves | **ROC**: FPR vs TPR (AUC = 0.832)<br>**PR**: Recall vs Precision (AUC = 0.330) | Plots discrimination curves with glowing gradient area under curves and a draggable operating point threshold marker synced to sensitivity/specificity readouts. |

---

## 5. Interactive Studio Tools

1. **Patient Risk Lab**: Complete 21-feature slider & toggle instrument panel with instant reactive inference (<35ms latency).
2. **What-If Action Plans (Counterfactual Engine)**: Integer-programming & tree-search optimization that finds the minimal realistic lifestyle modifications to bring high-risk patients below the 20% threshold.
3. **Population Simulator**: Interactively tests municipal and community health initiatives (e.g., 25% smoking reduction + 30% blood pressure control) and outputs **cases prevented per 1,000 adults** with 95% confidence intervals.
4. **Subgroup Fairness Audit**: Audits Equalized Odds disparity and Demographic Parity differences across biological sex, age tiers, and income categories to prevent algorithmic bias in clinical deployment.
5. **Batch Patient Scoring**: Drag-and-drop CSV batch evaluation engine with client-side CSV downloads and high-risk triage alerts.
6. **Command Palette (`Ctrl + K`)**: Instant keyboard navigation to jump across all studio modules.
7. **Report Printing / PDF Export**: Clean, print-styled export for patient take-home summaries.
