import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def create_feature_metadata():
    sub_df = pd.read_csv(os.path.join("data", "processed", "subsample_15k.csv"))
    
    meta = {
        "HighBP": {
            "name": "HighBP",
            "label": "High Blood Pressure",
            "group": "Clinical",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["HighBP"].median()),
            "modifiable": True,
            "description": "Ever diagnosed with high blood pressure by a doctor or health professional.",
            "value_labels": {"0": "Normal Blood Pressure", "1": "High Blood Pressure"},
            "glossary": "Hypertension places chronic strain on arterial walls, accelerating coronary plaque formation."
        },
        "HighChol": {
            "name": "HighChol",
            "label": "High Blood Cholesterol",
            "group": "Clinical",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["HighChol"].median()),
            "modifiable": True,
            "description": "Ever told by a doctor or health provider that blood cholesterol is high.",
            "value_labels": {"0": "Normal Cholesterol", "1": "High Cholesterol"},
            "glossary": "Elevated low-density lipoproteins (LDL) directly contribute to coronary atherogenesis."
        },
        "CholCheck": {
            "name": "CholCheck",
            "label": "Cholesterol Check in Past 5 Years",
            "group": "Clinical",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["CholCheck"].median()),
            "modifiable": True,
            "description": "Had a cholesterol check performed within the past five years.",
            "value_labels": {"0": "No Check in 5 Years", "1": "Checked within 5 Years"},
            "glossary": "Regular cholesterol screening is a marker of preventive cardiovascular maintenance."
        },
        "BMI": {
            "name": "BMI",
            "label": "Body Mass Index (BMI)",
            "group": "Clinical",
            "type": "continuous",
            "min": 12.0, "max": 60.0, "step": 0.5,
            "default": round(float(sub_df["BMI"].median()), 1),
            "modifiable": True,
            "description": "Body mass index in kg/m², calculated from height and weight.",
            "value_labels": {},
            "glossary": "BMI > 25 indicates overweight; > 30 indicates obesity, which strains myocardial workload."
        },
        "Smoker": {
            "name": "Smoker",
            "label": "Smoking History",
            "group": "Lifestyle",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["Smoker"].median()),
            "modifiable": True,
            "description": "Smoked at least 100 cigarettes in entire life.",
            "value_labels": {"0": "Non-Smoker (<100 cigs)", "1": "Smoker (≥100 cigs)"},
            "glossary": "Tobacco combustion releases toxins that promote endothelial dysfunction and vasospasm."
        },
        "Stroke": {
            "name": "Stroke",
            "label": "History of Stroke",
            "group": "Clinical",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["Stroke"].median()),
            "modifiable": False,
            "description": "Ever told by a medical doctor that you had a stroke.",
            "value_labels": {"0": "No Prior Stroke", "1": "Prior Stroke History"},
            "glossary": "Stroke indicates advanced systemic cerebrovascular atherosclerosis, highly correlated with coronary disease."
        },
        "Diabetes": {
            "name": "Diabetes",
            "label": "Diabetes Diagnosis",
            "group": "Clinical",
            "type": "ordinal",
            "min": 0, "max": 2, "step": 1,
            "default": int(sub_df["Diabetes"].median()),
            "modifiable": True,
            "description": "Self-reported diagnosis of diabetes or prediabetes.",
            "value_labels": {"0": "No Diabetes", "1": "Prediabetes", "2": "Diabetes"},
            "glossary": "Hyperglycemia damages micro- and macro-vasculature, doubling coronary heart disease risk."
        },
        "PhysActivity": {
            "name": "PhysActivity",
            "label": "Physical Activity (Past 30 Days)",
            "group": "Lifestyle",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["PhysActivity"].median()),
            "modifiable": True,
            "description": "Any physical activity or exercise during the past 30 days other than regular job.",
            "value_labels": {"0": "No Exercise / Inactive", "1": "Active in Past 30 Days"},
            "glossary": "Cardiorespiratory exercise enhances myocardial perfusion and improves vascular compliance."
        },
        "Fruits": {
            "name": "Fruits",
            "label": "Daily Fruit Consumption",
            "group": "Lifestyle",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["Fruits"].median()),
            "modifiable": True,
            "description": "Consumes fruit 1 or more times per day.",
            "value_labels": {"0": "Less than 1/day", "1": "1 or more times/day"},
            "glossary": "Dietary antioxidants and polyphenols support healthy vascular endothelium."
        },
        "Veggies": {
            "name": "Veggies",
            "label": "Daily Vegetable Consumption",
            "group": "Lifestyle",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["Veggies"].median()),
            "modifiable": True,
            "description": "Consumes vegetables 1 or more times per day.",
            "value_labels": {"0": "Less than 1/day", "1": "1 or more times/day"},
            "glossary": "Dietary fiber and nitrates in vegetables contribute to arterial blood pressure reduction."
        },
        "HvyAlcoholConsump": {
            "name": "HvyAlcoholConsump",
            "label": "Heavy Alcohol Consumption",
            "group": "Lifestyle",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["HvyAlcoholConsump"].median()),
            "modifiable": True,
            "description": "Adult men >14 drinks/week; adult women >7 drinks/week.",
            "value_labels": {"0": "Moderate / None", "1": "Heavy Drinker"},
            "glossary": "Chronic heavy ethanol consumption induces toxic alcoholic cardiomyopathy and hypertension."
        },
        "AnyHealthcare": {
            "name": "AnyHealthcare",
            "label": "Health Care Coverage",
            "group": "Access",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["AnyHealthcare"].median()),
            "modifiable": False,
            "description": "Has any kind of health care coverage (insurance, prepaid plans, Medicare).",
            "value_labels": {"0": "No Insurance", "1": "Insured / Covered"},
            "glossary": "Insurance coverage dictates access to routine preventive cardiological management."
        },
        "NoDocbcCost": {
            "name": "NoDocbcCost",
            "label": "Could Not Afford Doctor",
            "group": "Access",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["NoDocbcCost"].median()),
            "modifiable": False,
            "description": "Was there a time in the past 12 months when you needed to see a doctor but could not because of cost?",
            "value_labels": {"0": "No Financial Barrier", "1": "Delayed Care Due to Cost"},
            "glossary": "Cost barriers frequently cause unmonitored hypertension and missed therapeutic interventions."
        },
        "GenHlth": {
            "name": "GenHlth",
            "label": "General Health Rating",
            "group": "Wellbeing",
            "type": "ordinal",
            "min": 1, "max": 5, "step": 1,
            "default": int(sub_df["GenHlth"].median()),
            "modifiable": False,
            "description": "Would you say that in general your health is: 1=Excellent, 2=Very good, 3=Good, 4=Fair, 5=Poor.",
            "value_labels": {"1": "Excellent", "2": "Very Good", "3": "Good", "4": "Fair", "5": "Poor"},
            "glossary": "Self-rated general health is one of the strongest epidemiological predictors of mortality."
        },
        "MentHlth": {
            "name": "MentHlth",
            "label": "Poor Mental Health Days",
            "group": "Wellbeing",
            "type": "continuous",
            "min": 0, "max": 30, "step": 1,
            "default": int(sub_df["MentHlth"].median()),
            "modifiable": False,
            "description": "Now thinking about your mental health, how many days during the past 30 days was your mental health not good?",
            "value_labels": {},
            "glossary": "Chronic emotional stress elevates autonomic sympathetic tone and circulating cortisol."
        },
        "PhysHlth": {
            "name": "PhysHlth",
            "label": "Poor Physical Health Days",
            "group": "Wellbeing",
            "type": "continuous",
            "min": 0, "max": 30, "step": 1,
            "default": int(sub_df["PhysHlth"].median()),
            "modifiable": False,
            "description": "Now thinking about your physical health, how many days during the past 30 days was your physical health not good?",
            "value_labels": {},
            "glossary": "Frequent poor physical health reflects underlying multisystem morbidity and functional decline."
        },
        "DiffWalk": {
            "name": "DiffWalk",
            "label": "Difficulty Walking / Climbing Stairs",
            "group": "Wellbeing",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["DiffWalk"].median()),
            "modifiable": False,
            "description": "Do you have serious difficulty walking or climbing stairs?",
            "value_labels": {"0": "No Mobility Limitation", "1": "Severe Difficulty Walking"},
            "glossary": "Severe mobility impairment correlates with advanced cardiovascular deconditioning and frailty."
        },
        "Sex": {
            "name": "Sex",
            "label": "Biological Sex",
            "group": "Demographics",
            "type": "binary",
            "min": 0, "max": 1, "step": 1,
            "default": int(sub_df["Sex"].median()),
            "modifiable": False,
            "description": "Biological sex recorded in survey.",
            "value_labels": {"0": "Female", "1": "Male"},
            "glossary": "Males exhibit earlier onset of coronary artery disease, whereas females catch up post-menopause."
        },
        "Age": {
            "name": "Age",
            "label": "Age Category",
            "group": "Demographics",
            "type": "ordinal",
            "min": 1, "max": 13, "step": 1,
            "default": int(sub_df["Age"].median()),
            "modifiable": False,
            "description": "Thirteen-level age category (1 = 18-24 ... 13 = 80+).",
            "value_labels": {
                "1": "18-24", "2": "25-29", "3": "30-34", "4": "35-39",
                "5": "40-44", "6": "45-49", "7": "50-54", "8": "55-59",
                "9": "60-64", "10": "65-69", "11": "70-74", "12": "75-79",
                "13": "80 or older"
            },
            "glossary": "Chronological age is the non-modifiable driver of cumulative vascular exposure and arterial stiffness."
        },
        "Education": {
            "name": "Education",
            "label": "Highest Education Level",
            "group": "Demographics",
            "type": "ordinal",
            "min": 1, "max": 6, "step": 1,
            "default": int(sub_df["Education"].median()),
            "modifiable": False,
            "description": "Education level completed (1 = Never/Kindergarten ... 6 = College 4+ years).",
            "value_labels": {
                "1": "Never attended / Kindergarten",
                "2": "Elementary (Grades 1-8)",
                "3": "Some High School (Grades 9-11)",
                "4": "High School Graduate (Grade 12)",
                "5": "Some College / Technical School",
                "6": "College Graduate (4+ years)"
            },
            "glossary": "Educational attainment is a fundamental social determinant of health literacy and lifestyle options."
        },
        "Income": {
            "name": "Income",
            "label": "Household Income Bracket",
            "group": "Demographics",
            "type": "ordinal",
            "min": 1, "max": 8, "step": 1,
            "default": int(sub_df["Income"].median()),
            "modifiable": False,
            "description": "Annual household income bracket from all sources.",
            "value_labels": {
                "1": "< $10,000",
                "2": "$10,000 - $14,999",
                "3": "$15,000 - $19,999",
                "4": "$20,000 - $24,999",
                "5": "$25,000 - $34,999",
                "6": "$35,000 - $49,999",
                "7": "$50,000 - $74,999",
                "8": "≥ $75,000"
            },
            "glossary": "Socioeconomic standing determines nutrition quality, neighborhood safety, and chronic stress exposure."
        }
    }
    
    with open(os.path.join("artifacts", "feature_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("Exported feature metadata to artifacts/feature_meta.json")

def generate_paper_figures():
    print("Generating 300-DPI publication figures in reports/figures/...")
    os.makedirs(os.path.join("reports", "figures"), exist_ok=True)
    
    # Style config
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    plt.rcParams['font.sans-serif'] = 'Arial'
    plt.rcParams['axes.edgecolor'] = '#E4E0D6'
    plt.rcParams['axes.linewidth'] = 0.8
    
    with open(os.path.join("artifacts", "model_metrics.json"), "r") as f:
        metrics = json.load(f)
        
    with open(os.path.join("artifacts", "shap_global.json"), "r") as f:
        shap_global = json.load(f)
        
    # Fig 1: Feature Importance Bar Chart
    plt.figure(figsize=(9, 6), dpi=300)
    feats = [item["feature"] for item in shap_global["feature_importance"][:12]]
    vals = [item["mean_abs_shap"] for item in shap_global["feature_importance"][:12]]
    feats.reverse()
    vals.reverse()
    
    colors = ['#0B3D3A' if f in ["HighBP", "GenHlth", "Age", "BMI", "Smoker"] else '#1F8A84' for f in feats]
    bars = plt.barh(feats, vals, color=colors, height=0.65)
    plt.title("CardioLens: Top 12 Global Drivers of Heart Disease Risk (Mean |SHAP|)", fontsize=13, weight='bold', pad=15)
    plt.xlabel("Mean |SHAP Value| (Impact on Model Log-Odds)", fontsize=11)
    for bar in bars:
        w = bar.get_width()
        plt.text(w + 0.005, bar.get_y() + bar.get_height()/2, f"{w:.3f}", va='center', fontsize=9, color='#1B2A4A')
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig1_feature_importance.png"), dpi=300)
    plt.close()
    
    # Fig 2: ROC and PR Curves for All 4 Models
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), dpi=300)
    model_colors = {
        "LightGBM": "#0B3D3A",
        "XGBoost": "#1F8A84",
        "Random Forest": "#D9A441",
        "Logistic Regression": "#5B6785"
    }
    
    for m_name, m_data in metrics.items():
        roc_pts = m_data["curves"]["roc_curve"]
        fprs = [p["fpr"] for p in roc_pts]
        tprs = [p["tpr"] for p in roc_pts]
        auc_val = m_data["metrics"]["roc_auc"]
        ax1.plot(fprs, tprs, label=f"{m_name} (AUC = {auc_val:.3f})", color=model_colors.get(m_name, "#333"), linewidth=2)
        
        pr_pts = m_data["curves"]["pr_curve"]
        recs = [p["recall"] for p in pr_pts]
        precs = [p["precision"] for p in pr_pts]
        prauc_val = m_data["metrics"]["pr_auc"]
        ax2.plot(recs, precs, label=f"{m_name} (PR-AUC = {prauc_val:.3f})", color=model_colors.get(m_name, "#333"), linewidth=2)
        
    ax1.plot([0, 1], [0, 1], 'k--', alpha=0.3, label="Random Guess")
    ax1.set_title("ROC Curves Comparison", fontsize=12, weight='bold')
    ax1.set_xlabel("False Positive Rate", fontsize=10)
    ax1.set_ylabel("True Positive Rate", fontsize=10)
    ax1.legend(loc="lower right", frameon=True)
    
    ax2.axhline(y=0.094, color='k', linestyle='--', alpha=0.3, label="Baseline Prevalence (9.4%)")
    ax2.set_title("Precision-Recall Curves Comparison", fontsize=12, weight='bold')
    ax2.set_xlabel("Recall", fontsize=10)
    ax2.set_ylabel("Precision", fontsize=10)
    ax2.legend(loc="upper right", frameon=True)
    
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig2_roc_pr_comparison.png"), dpi=300)
    plt.close()
    
    # Fig 3: Calibration Curves
    plt.figure(figsize=(8, 6), dpi=300)
    for m_name, m_data in metrics.items():
        cal_pts = m_data["curves"]["calibration_curve"]
        pp = [p["prob_pred"] for p in cal_pts]
        pt = [p["prob_true"] for p in cal_pts]
        brier = m_data["metrics"]["brier_score"]
        plt.plot(pp, pt, marker='o', label=f"{m_name} (Brier = {brier:.4f})", color=model_colors.get(m_name, "#333"), linewidth=1.8)
        
    plt.plot([0, 1], [0, 1], 'k--', alpha=0.5, label="Perfect Calibration")
    plt.title("Isotonic Probability Calibration on Validation Set", fontsize=13, weight='bold', pad=12)
    plt.xlabel("Mean Predicted Probability", fontsize=11)
    plt.ylabel("Observed Positive Fraction", fontsize=11)
    plt.legend(frameon=True)
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig3_calibration_curves.png"), dpi=300)
    plt.close()
    
    # Fig 4: Confusion Matrix for LightGBM
    lgb_cm = metrics["LightGBM"]["metrics"]["confusion_matrix"]
    cm_matrix = np.array([[lgb_cm["tn"], lgb_cm["fp"]], [lgb_cm["fn"], lgb_cm["tp"]]])
    
    fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
    im = ax.imshow(cm_matrix, cmap="BuGn", interpolation="nearest")
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(["Predicted No", "Predicted Yes"], fontsize=11)
    ax.set_yticklabels(["Actual No", "Actual Yes"], fontsize=11)
    plt.title("LightGBM Confusion Matrix (Optimal Threshold)", fontsize=13, weight='bold', pad=12)
    for i in range(2):
        for j in range(2):
            val = cm_matrix[i, j]
            color = "white" if val > cm_matrix.max()/2 else "#1B2A4A"
            ax.text(j, i, f"{val:,}", ha="center", va="center", color=color, fontsize=14, weight='bold')
    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig4_confusion_matrix.png"), dpi=300)
    plt.close()
    
    # Fig 5: Patient Map 2D Phenotypes
    with open(os.path.join("artifacts", "patient_map.json"), "r") as f:
        pmap = json.load(f)
    pts = pmap["points"]
    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    risks = [p["risk"] for p in pts]
    
    plt.figure(figsize=(9, 7), dpi=300)
    sc = plt.scatter(xs, ys, c=risks, cmap="viridis", alpha=0.6, s=18, edgecolors='none')
    plt.title("CardioLens Patient Map: 2D SHAP Space Manifold", fontsize=13, weight='bold', pad=12)
    plt.xlabel("SHAP Dimension 1", fontsize=11)
    plt.ylabel("SHAP Dimension 2", fontsize=11)
    cb = plt.colorbar(sc)
    cb.set_label("Predicted Heart Disease Risk", fontsize=10)
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig5_patient_map.png"), dpi=300)
    plt.close()
    
    # Fig 6: Fairness Audit Comparison by Age Band and Sex
    with open(os.path.join("artifacts", "fairness_audit.json"), "r") as f:
        fairness = json.load(f)
        
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), dpi=300)
    
    # Sex audit
    sex_groups = fairness["Sex"]["subgroups"]
    labels_sex = [g["group"] for g in sex_groups]
    recalls_sex = [g["recall_tpr"] for g in sex_groups]
    fprs_sex = [g["fpr"] for g in sex_groups]
    
    x = np.arange(len(labels_sex))
    w = 0.35
    ax1.bar(x - w/2, recalls_sex, w, label='Recall (TPR)', color='#0B3D3A')
    ax1.bar(x + w/2, fprs_sex, w, label='False Positive Rate', color='#C0392B')
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels_sex, fontsize=11)
    ax1.set_ylabel("Rate", fontsize=10)
    ax1.set_title("Fairness Metrics by Biological Sex", fontsize=12, weight='bold')
    ax1.legend()
    ax1.set_ylim(0, 1.0)
    
    # Age band audit
    age_groups = fairness["Age_Band"]["subgroups"]
    labels_age = [g["group"] for g in age_groups]
    recalls_age = [g["recall_tpr"] for g in age_groups]
    fprs_age = [g["fpr"] for g in age_groups]
    
    x2 = np.arange(len(labels_age))
    ax2.bar(x2 - w/2, recalls_age, w, label='Recall (TPR)', color='#0B3D3A')
    ax2.bar(x2 + w/2, fprs_age, w, label='False Positive Rate', color='#C0392B')
    ax2.set_xticks(x2)
    ax2.set_xticklabels(labels_age, fontsize=10)
    ax2.set_ylabel("Rate", fontsize=10)
    ax2.set_title("Fairness Metrics by Age Category", fontsize=12, weight='bold')
    ax2.legend()
    ax2.set_ylim(0, 1.0)
    
    plt.tight_layout()
    plt.savefig(os.path.join("reports", "figures", "fig6_fairness_audit.png"), dpi=300)
    plt.close()
    
    print("All static 300-DPI paper figures generated successfully.")

def run_export():
    create_feature_metadata()
    generate_paper_figures()

if __name__ == "__main__":
    run_export()
