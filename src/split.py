"""
Chronological train / validation / test split.

This is a forecasting project, so a random train_test_split would leak
future information into training (the model would "see" 2022 while
training on data meant to predict 2010, which never happens in real
deployment). Instead, every governorate is split using the SAME year
cutoffs, defined once in config.py.
"""

import pandas as pd

from src import config


def chronological_split(df: pd.DataFrame):
    """
    Split into train / val / test using year cutoffs from config.py.
    The same cutoffs are applied across all governorates at once, since
    'year' is shared across the concatenated tables.
    """
    df = df.sort_values("year").reset_index(drop=True)

    train_mask = df["year"] <= config.TRAIN_END_YEAR
    val_mask = (df["year"] > config.TRAIN_END_YEAR) & (df["year"] <= config.VAL_END_YEAR)
    test_mask = df["year"] > config.VAL_END_YEAR

    train_df = df.loc[train_mask].reset_index(drop=True)
    val_df = df.loc[val_mask].reset_index(drop=True)
    test_df = df.loc[test_mask].reset_index(drop=True)

    print(f"Train: {len(train_df):>9,} rows ({train_df['year'].min()}-{train_df['year'].max()})")
    print(f"Val:   {len(val_df):>9,} rows ({val_df['year'].min()}-{val_df['year'].max()})")
    print(f"Test:  {len(test_df):>9,} rows ({test_df['year'].min()}-{test_df['year'].max()})")

    return train_df, val_df, test_df


def make_xy(df: pd.DataFrame, feature_cols: list):
    X = df[feature_cols]
    y = df[config.TARGET]
    return X, y
