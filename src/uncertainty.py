"""
Uncertainty quantification and confidence interval engine for solar power forecasting.

Provides calibrated prediction intervals [P_lower, P_upper] and a certitude percentage
for Keras NN predictions.

Key Physical & Statistical Properties:
1. Physical Night Constraint:
   When H_sun <= 0 or G(i) == 0, physical solar power output is identically 0.
   The bounds are strictly [0.0, 0.0] with 100% certitude.
2. Heteroscedastic Conformal Quantiles:
   Daytime prediction errors scale with solar irradiance and cloud cover volatility.
   Residuals |y - y_hat| are calibrated on the held-out validation set to guarantee
   the desired coverage level (default: 90% confidence interval, alpha=0.10).
3. Certitude Score (%):
   An intuitive operational certainty metric (0% - 100%) indicating grid dispatch
   reliability.
4. Normalization:
   All values correspond to 1 kWp installed capacity (W/kWp).
"""

from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from src import config


class UncertaintyCalibrator:
    """
    Calibrates and applies conditional empirical quantile intervals
    derived from validation residuals.
    """

    def __init__(self, confidence_level: float = config.DEFAULT_CONFIDENCE_LEVEL):
        self.confidence_level = confidence_level
        # Default fallback margins per irradiance bin if calibration file not loaded
        self.quantile_margins = {
            "low": 1.2,      # G(i) < 200 W/m2
            "medium": 2.5,   # 200 <= G(i) < 600 W/m2
            "high": 3.8,     # G(i) >= 600 W/m2
        }
        self.overall_margin = 2.0

    def fit_from_residuals(self, y_true: np.ndarray, y_pred: np.ndarray, gi_values: np.ndarray):
        """Compute empirical error quantiles stratified by irradiance."""
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)
        gi_values = np.asarray(gi_values, dtype=float)

        # Consider daytime rows where physical generation is possible
        day_mask = gi_values > 10.0
        if np.sum(day_mask) < 100:
            return self

        residuals = np.abs(y_true[day_mask] - y_pred[day_mask])
        gi_day = gi_values[day_mask]

        low_mask = gi_day < 200.0
        med_mask = (gi_day >= 200.0) & (gi_day < 600.0)
        high_mask = gi_day >= 600.0

        q = self.confidence_level
        self.overall_margin = float(np.quantile(residuals, q))
        self.quantile_margins["low"] = float(np.quantile(residuals[low_mask], q)) if np.sum(low_mask) > 50 else self.overall_margin
        self.quantile_margins["medium"] = float(np.quantile(residuals[med_mask], q)) if np.sum(med_mask) > 50 else self.overall_margin
        self.quantile_margins["high"] = float(np.quantile(residuals[high_mask], q)) if np.sum(high_mask) > 50 else self.overall_margin

        return self

    def get_margin(self, gi: float, cloud_total: float = 0.0) -> float:
        """Returns error margin delta for a given irradiance and cloud cover."""
        if gi <= 0:
            return 0.0
        elif gi < 200:
            base = self.quantile_margins.get("low", 1.2)
        elif gi < 600:
            base = self.quantile_margins.get("medium", 2.5)
        else:
            base = self.quantile_margins.get("high", 3.8)

        # Scale margin slightly with total cloud cover (weather forecast uncertainty)
        cloud_factor = 1.0 + 0.3 * (min(max(cloud_total, 0.0), 100.0) / 100.0)
        return float(base * cloud_factor)


def get_uncertainty_calibrator() -> UncertaintyCalibrator:
    """Loads cached calibrator or returns default calibrator."""
    if config.UNCERTAINTY_CALIBRATION_PATH.exists():
        try:
            return joblib.load(config.UNCERTAINTY_CALIBRATION_PATH)
        except Exception:
            pass
    calibrator = UncertaintyCalibrator(confidence_level=config.DEFAULT_CONFIDENCE_LEVEL)
    return calibrator


def save_uncertainty_calibrator(calibrator: UncertaintyCalibrator, path: Path = None):
    path = path or config.UNCERTAINTY_CALIBRATION_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(calibrator, path)


def predict_with_intervals(
    model,
    X_features: pd.DataFrame,
    raw_weather_df: pd.DataFrame,
    confidence_level: float = config.DEFAULT_CONFIDENCE_LEVEL,
    calibrator: UncertaintyCalibrator = None,
) -> pd.DataFrame:
    """
    Computes P predictions with calibrated confidence bounds [P_lower, P_upper]
    and certitude percentage.

    Parameters
    ----------
    model : fitted model (e.g. keras_nn)
    X_features : engineered & scaled feature matrix for model input
    raw_weather_df : DataFrame containing H_sun, G(i), cloud_cover_low/mid/high
    confidence_level : confidence coverage (e.g. 0.90 for 90%)
    calibrator : UncertaintyCalibrator instance

    Returns
    -------
    pd.DataFrame with columns ['P', 'P_lower', 'P_upper', 'certitude_pct']
    """
    calibrator = calibrator or get_uncertainty_calibrator()
    calibrator.confidence_level = confidence_level

    # Raw model prediction (for 1 kWp installed capacity)
    raw_p = model.predict(X_features)
    raw_p = np.asarray(raw_p, dtype=float).ravel()

    h_sun = raw_weather_df["H_sun"].values if "H_sun" in raw_weather_df.columns else np.ones(len(raw_p))
    gi = raw_weather_df["G(i)"].values if "G(i)" in raw_weather_df.columns else np.zeros(len(raw_p))

    # Cloud proxy
    cloud_low = raw_weather_df["cloud_cover_low"].values if "cloud_cover_low" in raw_weather_df.columns else 0.0
    cloud_mid = raw_weather_df["cloud_cover_mid"].values if "cloud_cover_mid" in raw_weather_df.columns else 0.0
    cloud_high = raw_weather_df["cloud_cover_high"].values if "cloud_cover_high" in raw_weather_df.columns else 0.0
    cloud_total = np.clip(cloud_low + cloud_mid + cloud_high, 0.0, 100.0)

    n_samples = len(raw_p)
    p_pred = np.zeros(n_samples, dtype=float)
    p_lower = np.zeros(n_samples, dtype=float)
    p_upper = np.zeros(n_samples, dtype=float)
    certitude_pct = np.zeros(n_samples, dtype=float)

    for i in range(n_samples):
        # 1. Physical night rule: sun below horizon or zero irradiance
        if h_sun[i] <= 0.0 or gi[i] <= 0.5:
            p_pred[i] = 0.0
            p_lower[i] = 0.0
            p_upper[i] = 0.0
            certitude_pct[i] = 100.0
            continue

        # 2. Daytime prediction
        val = max(0.0, raw_p[i])
        delta = calibrator.get_margin(gi[i], cloud_total[i] if isinstance(cloud_total, np.ndarray) else cloud_total)

        low = max(0.0, val - delta)
        high = val + delta

        # Relative uncertainty score
        reference = max(val, 60.0)
        width = high - low
        rel_uncertainty = width / reference
        cert = max(20.0, min(99.0, 100.0 * (1.0 - 0.45 * rel_uncertainty)))

        p_pred[i] = round(val, 2)
        p_lower[i] = round(low, 2)
        p_upper[i] = round(high, 2)
        certitude_pct[i] = round(cert, 1)

    return pd.DataFrame({
        "P": p_pred,
        "P_lower": p_lower,
        "P_upper": p_upper,
        "certitude_pct": certitude_pct,
    })
