import os
import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit

def run_subsample():
    raw_path = os.path.join("data", "raw", "heart_disease_health_indicators_BRFSS2015.csv")
    out_path = os.path.join("data", "processed", "subsample_15k.csv")
    
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw dataset not found at {raw_path}. Please place it there.")
        
    print(f"Loading raw dataset from {raw_path}...")
    df = pd.read_csv(raw_path)
    total_len = len(df)
    orig_pos_rate = df["HeartDiseaseorAttack"].mean()
    print(f"Total rows: {total_len:,}, Original Positive Rate: {orig_pos_rate:.4%}")
    
    # Stratified subsample of 15,000 rows
    n_sample = 15000
    sss = StratifiedShuffleSplit(n_splits=1, train_size=n_sample, random_state=42)
    sample_idx, _ = next(sss.split(df, df["HeartDiseaseorAttack"]))
    sub_df = df.iloc[sample_idx].copy().reset_index(drop=True)
    
    sample_pos_rate = sub_df["HeartDiseaseorAttack"].mean()
    print(f"Subsampled rows: {len(sub_df):,}, Subsample Positive Rate: {sample_pos_rate:.4%}")
    print(f"Positive cases: {sub_df['HeartDiseaseorAttack'].sum()}, Negative cases: {(1 - sub_df['HeartDiseaseorAttack']).sum()}")
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sub_df.to_csv(out_path, index=False)
    print(f"Saved stratified subsample to {out_path}")
    return sub_df

if __name__ == "__main__":
    run_subsample()
