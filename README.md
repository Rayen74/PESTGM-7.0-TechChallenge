# Tunisia Solar Power Forecasting & Grid Dispatch System

Predicts hourly solar power output (`P`) across **all 24 governorates and 7 regional grid districts of Tunisia** from numerical weather predictions and solar geometry, benchmarked on 19 years of hourly historical data (~4M rows).

> [!IMPORTANT]
> **Standard 1 kWp Capacity Normalization:**
> All model predictions $P$ and confidence bounds $[P_{\text{lower}}, P_{\text{upper}}]$ represent generation normalized to **1 kWp of installed capacity** (unit: **W/kWp**). Because solar installations evolve per governorate, this provides a universal physical reference:
> $$\text{Power}_{\text{Total}} = P_{\text{model}} \times \text{Capacity}_{\text{installed (kWp)}}$$
> The web dashboard and dispatch exporters include dynamic capacity scaling ($kW_p$ / $MW_p$).

> [!NOTE]
> **Model Policy:**
> **`keras_nn`** (Deep Neural Network) is the designated standard production model, achieving the best performance on the 2017–2019 validation set ($\text{RMSE} = 0.759\text{ W}$, $\text{MAE} = 0.334\text{ W}$, $R^2 = 0.99999$). Random Forest is strictly barred from all production forecasting and retraining pipelines.

---

## Project Structure

```text
solar_power_forecasting/
├── app.py                      # Interactive Web Dashboard (Streamlit & Plotly)
├── data/
│   ├── raw/                    # final_merged_dataset.csv (~377 MB)
│   └── processed/              # latest_forecast.csv, telemetry, progress logs
├── docs/
│   ├── DATA_SOURCES.md         # Data provenance (PVGIS + Open-Meteo) & 1 kWp normalization
│   ├── OPERATOR_GUIDE.md       # Weather monitoring, website control & maintenance guide
│   └── SCHEDULING.md           # Continuous automated scheduling (cron / Task Scheduler)
├── notebooks/
│   └── eda.ipynb               # Exploratory data analysis, VIF, correlation analysis
├── src/
│   ├── config.py               # Paths, district mappings, model standards, single source of truth
│   ├── uncertainty.py          # Calibrated confidence intervals [P_lower, P_upper] & Certitude %
│   ├── data_loader.py          # Memory-efficient CSV loader with downcast dtypes
│   ├── feature_engineering.py  # Cyclical encodings (sin/cos) and collinear feature pruning
│   ├── split.py                # Chronological train/val/test splitting
│   ├── scaling.py              # StandardScaler fitted strictly on training data
│   ├── models.py               # Model registry (Linear, Trees, Boosting, SVR, MLP, Keras NN)
│   ├── evaluate.py             # MAE, RMSE, R2, non-zero MAPE metrics
│   ├── train.py                # Model training and validation benchmarking pipeline
│   ├── evaluate_on_test.py     # Final test set evaluation (2020-2023)
│   ├── forecast.py             # Operational live pipeline (intra-day, D to D+3, D to D+16)
│   ├── dispatch_export.py      # STEG SCADA/EMS dispatch data exporter (JSON & CSV)
│   ├── weather_monitor.py      # Open-Meteo API health checks and continuous ingestion
│   ├── retrain.py              # Periodic retraining pipeline once utility (STEG) data exists
│   └── bootstrap_pipeline.py   # Historical 2024->today catch-up using keras_nn
├── outputs/
│   ├── models/                 # Saved models (.joblib) and scalers
│   ├── metrics/                # model_comparison.csv
│   └── figures/                # Visualizations
├── requirements.txt
└── README.md
```

---

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Launch the Interactive Web Dashboard
```bash
streamlit run app.py
```
Opens the interactive dashboard in your browser (`http://localhost:8501`), featuring:
- **Multi-Scale Views:** National (country aggregate), 7 Regional Districts (Grand Tunis, Nord-Est, Nord-Ouest, Centre-Est, Centre-Ouest, Sud-Est, Sud-Ouest), and 24 individual Governorates.
- **Multi-Horizon Slicing:** Intra-day (24h) and D to D+3 operational dispatch (96h).
- **Uncertainty Quantification:** Plotly time series with shaded confidence intervals and certitude index.
- **Tunisia Spatial Map:** Interactive geographic generation intensity across governorates.
- **STEG Dispatch Tools:** One-click download of JSON and CSV files formatted for STEG SCADA/EMS.
- **Weather Health Diagnostics:** Live latency, physical bounds verification, and schema checks.

---

## Command-Line Pipelines

### 1. Run Live Operational Forecast (D to D+3)
```bash
# Full 4-day forecast for all 24 governorates (with 90% confidence interval)
python -m src.forecast --days 4

# Forecast for a single governorate (e.g. Tunis)
python -m src.forecast --gov Tunis --days 3
```
Outputs are saved to `data/processed/latest_forecast.csv` and archived with timestamps.

### 2. Monitor Weather API Health & Ingestion
```bash
# Check API latency, variable completeness, and physical limits
python -m src.weather_monitor

# Force an automated data refresh for all governorates
python -m src.weather_monitor --force --days 4
```

### 3. Export Data for STEG Grid Dispatch
Generate formatted dispatch tables (JSON/CSV) for SCADA/EMS systems:
```python
from src.dispatch_export import load_latest_forecast, prepare_dispatch_dataframe, export_dispatch_json, export_dispatch_csv

df = load_latest_forecast()
# Scale to a 50 MW solar plant
dispatch = prepare_dispatch_dataframe(df, scale_level="national", horizon="d_to_d3", capacity_kwp=50_000, unit="MW")
export_dispatch_json(dispatch)
export_dispatch_csv(dispatch)
```

### 4. Evaluate Keras NN on the Test Set (2020–2023)
```bash
python -m src.evaluate_on_test --model keras_nn
```

---

## Detailed Documentation
- [docs/OPERATOR_GUIDE.md](docs/OPERATOR_GUIDE.md): Complete guide on weather monitoring, dashboard management, and continuous automation.
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): Detailed information on PVGIS, Open-Meteo, collection methodology, and the 1 kWp normalization principle.
- [docs/SCHEDULING.md](docs/SCHEDULING.md): Setting up 3-hour automated updates with Windows Task Scheduler or Linux cron.
