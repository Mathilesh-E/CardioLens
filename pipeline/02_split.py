import os
import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit

def run_split():
    sub_path = os.path.join("data", "processed", "subsample_15k.csv")
    if not os.path.exists(sub_path):
        raise FileNotFoundError(f"{sub_path} not found. Please run 01_subsample.py first.")
    sub_df = pd.read_csv(sub_path)
        
    y = sub_df["HeartDiseaseorAttack"]
    # 70% train, 30% temp
    sss1 = StratifiedShuffleSplit(n_splits=1, train_size=0.70, random_state=42)
    train_idx, temp_idx = next(sss1.split(sub_df, y))
    
    train_df = sub_df.iloc[train_idx].copy().reset_index(drop=True)
    temp_df = sub_df.iloc[temp_idx].copy().reset_index(drop=True)
    
    # split temp 50/50 -> 15% val, 15% test
    temp_y = temp_df["HeartDiseaseorAttack"]
    sss2 = StratifiedShuffleSplit(n_splits=1, train_size=0.50, random_state=42)
    val_idx, test_idx = next(sss2.split(temp_df, temp_y))
    
    val_df = temp_df.iloc[val_idx].copy().reset_index(drop=True)
    test_df = temp_df.iloc[test_idx].copy().reset_index(drop=True)
    
    print("--- Split Verification ---")
    print(f"Train: {len(train_df)} rows, Positive rate: {train_df['HeartDiseaseorAttack'].mean():.4%}")
    print(f"Val:   {len(val_df)} rows, Positive rate: {val_df['HeartDiseaseorAttack'].mean():.4%}")
    print(f"Test:  {len(test_df)} rows, Positive rate: {test_df['HeartDiseaseorAttack'].mean():.4%}")
    
    train_df.to_csv(os.path.join("data", "processed", "train.csv"), index=False)
    val_df.to_csv(os.path.join("data", "processed", "val.csv"), index=False)
    test_df.to_csv(os.path.join("data", "processed", "test.csv"), index=False)
    print("Saved train.csv, val.csv, and test.csv")

if __name__ == "__main__":
    run_split()
