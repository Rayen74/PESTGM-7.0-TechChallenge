"""
Central configuration for the Solar Power Forecasting project.

Edit paths, constants, and cutoffs here. Nothing else in the project
should hardcode a file path or a magic number — this keeps the whole
pipeline reproducible from a single place.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_RAW_DIR = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
MODELS_DIR = OUTPUTS_DIR / "models"
METRICS_DIR = OUTPUTS_DIR / "metrics"
FIGURES_DIR = OUTPUTS_DIR / "figures"

RAW_CSV_PATH = DATA_RAW_DIR / "final_merged_dataset.csv"

for _d in (DATA_PROCESSED_DIR, MODELS_DIR, METRICS_DIR, FIGURES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Target column
# ---------------------------------------------------------------------------
TARGET = "P"

# ---------------------------------------------------------------------------
# Chronological split cutoffs (years) — same cutoffs applied to every
# governorate so the split is fair and consistent across all 24 tables.
# Data covers 2005-2023.
# ---------------------------------------------------------------------------
TRAIN_END_YEAR = 2016   # inclusive -> train: 2005-2016 (12 years)
VAL_END_YEAR = 2019     # inclusive -> val: 2017-2019 (3 years)
# everything after VAL_END_YEAR -> test: 2020-2023 (4 years)

# ---------------------------------------------------------------------------
# Columns removed during cleaning
# (raw versions of features that were re-encoded, plus redundant columns
# identified during EDA — see notebooks/eda.ipynb for the full justification)
# ---------------------------------------------------------------------------
COLS_TO_DROP_RAW = [
    "cloud_cover",          # VIF = 14.98 -> ~93% explained by low/mid/high combined
    "wind_direction_10m",   # circular variable -> replaced by wind_dir_sin/cos
    "hour",                 # circular variable -> replaced by hour_sin/cos
    "month",                # circular variable -> replaced by month_sin/cos
    "day",                  # circular variable -> replaced by day_sin/cos
    "location",             # categorical name -> latitude/longitude already encode position
    "P_source",             # provenance tag ('real' vs 'predicted') added by bootstrap_pipeline.py —
                            # kept in the raw CSV for auditing, never fed to the model as a feature
]

RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# Capacity Normalization & Model Standards
# ---------------------------------------------------------------------------
# All model predictions P represent power output normalized to 1 kWp installed
# capacity (unit: W/kWp). Local or plant power is obtained by multiplying by kWp.
NORMALIZATION_NOTE = "All P predictions are normalized per 1 kWp installed capacity (W/kWp)."
DEFAULT_MODEL = "keras_nn"
FORBIDDEN_MODELS = {"random_forest"}

# ---------------------------------------------------------------------------
# Calibration & Confidence Intervals
# ---------------------------------------------------------------------------
UNCERTAINTY_CALIBRATION_PATH = MODELS_DIR / "uncertainty_calibration.joblib"
DEFAULT_CONFIDENCE_LEVEL = 0.90  # 90% confidence interval

# ---------------------------------------------------------------------------
# Tunisian Territorial & Grid Districts (24 Governorates)
# ---------------------------------------------------------------------------
GOVERNORATE_TO_DISTRICT = {
    # Grand Tunis
    "Tunis": "Grand Tunis",
    "Ariana": "Grand Tunis",
    "Ben Arous": "Grand Tunis",
    "Manouba": "Grand Tunis",
    # Nord-Est
    "Nabeul": "Nord-Est",
    "Zaghouan": "Nord-Est",
    "Bizerte": "Nord-Est",
    # Nord-Ouest
    "Beja": "Nord-Ouest",
    "Jendouba": "Nord-Ouest",
    "Le Kef": "Nord-Ouest",
    "Siliana": "Nord-Ouest",
    # Centre-Est
    "Sousse": "Centre-Est",
    "Monastir": "Centre-Est",
    "Mahdia": "Centre-Est",
    "Sfax": "Centre-Est",
    # Centre-Ouest
    "Kairouan": "Centre-Ouest",
    "Kasserine": "Centre-Ouest",
    "Sidi Bouzid": "Centre-Ouest",
    # Sud-Est
    "Gabes": "Sud-Est",
    "Medenine": "Sud-Est",
    "Tataouine": "Sud-Est",
    # Sud-Ouest
    "Gafsa": "Sud-Ouest",
    "Tozeur": "Sud-Ouest",
    "Kebili": "Sud-Ouest",
}

DISTRICTS = list(dict.fromkeys(GOVERNORATE_TO_DISTRICT.values()))
