"""
Feature (and optionally target) scaling.

WHY THIS FILE EXISTS
---------------------
Tree-based models (Random Forest, Gradient Boosting, XGBoost, LightGBM)
split on raw feature values and are invariant to monotonic rescaling, so
they do NOT need this step at all.

SVR and Neural Networks (MLPRegressor) are distance/gradient-based and
DO need scaled inputs:
- SVR's kernel distance calculation would otherwise be dominated by
  whichever feature has the largest raw range (pressure_msl ~1000-1040
  vs. wind_dir_sin in [-1, 1]).
- Neural network gradient descent converges slowly and unstably on
  unscaled features with very different magnitudes.

RULE THAT MATTERS MOST HERE
----------------------------
The scaler is fit ONLY on the training split, then applied (transform,
never fit_transform) to validation and test. Fitting on the full dataset
would leak val/test statistics into training — a subtle form of the same
leakage the chronological split in split.py is designed to prevent.
"""

import joblib
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

from src import config

FEATURE_SCALER_PATH = config.MODELS_DIR / "feature_scaler.joblib"
TARGET_SCALER_PATH = config.MODELS_DIR / "target_scaler.joblib"


def fit_scaler(X_train: pd.DataFrame, method: str = "standard"):
    """Fit a scaler on the TRAINING features only."""
    scaler = StandardScaler() if method == "standard" else MinMaxScaler()
    scaler.fit(X_train)
    return scaler


def apply_scaler(scaler, X: pd.DataFrame) -> pd.DataFrame:
    """Transform any split with an already-fitted scaler, preserving column names/index."""
    scaled = scaler.transform(X)
    return pd.DataFrame(scaled, columns=X.columns, index=X.index)


def scale_features(X_train, X_val, X_test, method: str = "standard", save: bool = True):
    """Fit on train, transform all three splits. Returns scaled splits + the fitted scaler."""
    scaler = fit_scaler(X_train, method=method)

    X_train_scaled = apply_scaler(scaler, X_train)
    X_val_scaled = apply_scaler(scaler, X_val)
    X_test_scaled = apply_scaler(scaler, X_test)

    if save:
        joblib.dump(scaler, FEATURE_SCALER_PATH)
        print(f"Feature scaler saved to {FEATURE_SCALER_PATH}")

    return X_train_scaled, X_val_scaled, X_test_scaled, scaler


def scale_target(y_train, y_val, y_test, save: bool = True):
    """
    Optional: scaling P itself mainly helps neural network training
    stability (P ranges from 0 to several hundred, which can otherwise
    produce large gradients early in training). Not required for tree
    models; optional for SVR.
    """
    scaler = StandardScaler()
    y_train_scaled = scaler.fit_transform(y_train.values.reshape(-1, 1)).ravel()
    y_val_scaled = scaler.transform(y_val.values.reshape(-1, 1)).ravel()
    y_test_scaled = scaler.transform(y_test.values.reshape(-1, 1)).ravel()

    if save:
        joblib.dump(scaler, TARGET_SCALER_PATH)
        print(f"Target scaler saved to {TARGET_SCALER_PATH}")

    return y_train_scaled, y_val_scaled, y_test_scaled, scaler


def inverse_scale_target(y_scaled, scaler):
    """Convert scaled predictions back to the original P units before computing metrics."""
    return scaler.inverse_transform(pd.Series(y_scaled).values.reshape(-1, 1)).ravel()


def load_feature_scaler():
    return joblib.load(FEATURE_SCALER_PATH)


def load_target_scaler():
    return joblib.load(TARGET_SCALER_PATH)
