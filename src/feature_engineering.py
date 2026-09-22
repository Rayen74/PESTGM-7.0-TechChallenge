"""
Feature engineering.

Everything here follows directly from the EDA (see notebooks/eda.ipynb):
- wind_direction_10m and hour/month/day are circular variables, so they
  are re-encoded as sin/cos pairs instead of being fed in as raw numbers
  (0 and 359 degrees, or 23h and 0h, are neighbours in reality but look
  maximally far apart to a model that treats them as plain integers).
- cloud_cover is dropped: a VIF analysis showed it is ~93% explainable
  from cloud_cover_low/mid/high combined (VIF = 14.98), so it adds
  redundancy without new information once those three are kept.
"""

import numpy as np
import pandas as pd

from src import config


def encode_wind_direction(df: pd.DataFrame) -> pd.DataFrame:
    df["wind_dir_sin"] = np.sin(np.radians(df["wind_direction_10m"]))
    df["wind_dir_cos"] = np.cos(np.radians(df["wind_direction_10m"]))
    return df


def encode_cyclical_time(df: pd.DataFrame) -> pd.DataFrame:
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    df["month_sin"] = np.sin(2 * np.pi * (df["month"] - 1) / 12)
    df["month_cos"] = np.cos(2 * np.pi * (df["month"] - 1) / 12)

    # 'day' here is day-of-month; 31 is used as the cycle length approximation.
    df["day_sin"] = np.sin(2 * np.pi * df["day"] / 31)
    df["day_cos"] = np.cos(2 * np.pi * df["day"] / 31)
    return df


def drop_redundant_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop(columns=config.COLS_TO_DROP_RAW, errors="ignore")


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Full feature engineering pipeline, applied in a fixed, documented order."""
    df = df.copy()
    df = encode_wind_direction(df)
    df = encode_cyclical_time(df)
    df = drop_redundant_columns(df)
    return df


def get_feature_columns(df: pd.DataFrame) -> list:
    """Every column except the target is treated as a model feature."""
    return [c for c in df.columns if c != config.TARGET]


if __name__ == "__main__":
    from src.data_loader import load_raw_data

    df = load_raw_data(nrows=10_000)
    df = build_features(df)
    print("Columns after feature engineering:")
    print(get_feature_columns(df))
