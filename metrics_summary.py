import json

with open('artifacts/model_metrics.json') as f:
    data = json.load(f)

print('=== MODEL PERFORMANCE SUMMARY ===')
for model_name, mdata in data.items():
    m = mdata['metrics']
    roc = m['roc_auc']
    pr = m['pr_auc']
    f1 = m['f1']
    rec = m['recall']
    prec = m['precision']
    mcc = m['mcc']
    brier = m['brier_score']
    thresh = mdata['chosen_threshold']
    print(f'\n{model_name}:')
    print(f'  ROC-AUC={roc:.4f}  PR-AUC={pr:.4f}  F1={f1:.4f}  Recall={rec:.4f}  Precision={prec:.4f}  MCC={mcc:.4f}  Brier={brier:.4f}  Threshold={thresh:.4f}')

with open('artifacts/fairness_audit.json') as f:
    fairness = json.load(f)
print('\n=== FAIRNESS AUDIT SUMMARY ===')
for group, gdata in fairness.items():
    print(f'{group}:')
    if isinstance(gdata, dict):
        for subgroup, sgdata in gdata.items():
            if isinstance(sgdata, dict) and 'roc_auc' in sgdata:
                n = sgdata.get('n', '?')
                auc = sgdata['roc_auc']
                rate = round(sgdata.get('observed_rate', 0) * 100, 1)
                print(f'  {subgroup}: AUC={auc:.3f}, N={n}, Rate={rate}%')

with open('artifacts/shap_global.json') as f:
    shap = json.load(f)
print('\n=== TOP GLOBAL SHAP FEATURES (LightGBM) ===')
if 'LightGBM' in shap:
    fi = shap['LightGBM'].get('feature_importance', [])
    for item in fi[:8]:
        feat = item.get('feature', '?')
        imp = item.get('mean_abs_shap', 0)
        lbl = item.get('label', feat)
        print(f'  {lbl}: {imp:.4f}')
