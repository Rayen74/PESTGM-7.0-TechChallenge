"""
Shared evaluation metrics, used identically for every model so results
are directly comparable.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    mean_absolute_percentage_error,
)

from src import config


def evaluate(y_true, y_pred, set_name: str = "") -> dict:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    # P is 0 at night for a large fraction of rows; MAPE divides by y_true
    # and would explode/undefined there, so it's computed on non-zero rows only.
    mask = y_true != 0
    mape = (
        mean_absolute_percentage_error(y_true[mask], y_pred[mask]) * 100
        if mask.sum() > 0
        else np.nan
    )

    metrics = {"set": set_name, "MAE": mae, "RMSE": rmse, "R2": r2, "MAPE_%": mape}

    print(f"--- {set_name} ---")
    print(f"MAE:   {mae:.3f}")
    print(f"RMSE:  {rmse:.3f}")
    print(f"R2:    {r2:.4f}")
    print(f"MAPE:  {mape:.2f}% (rows where P=0 excluded)")
    print()

    return metrics


def save_metrics_table(all_metrics: list, filename: str = "model_comparison.csv") -> pd.DataFrame:
    df = pd.DataFrame(all_metrics)
    path = config.METRICS_DIR / filename
    df.to_csv(path, index=False)
    print(f"Metrics table saved to {path}")
    return df
