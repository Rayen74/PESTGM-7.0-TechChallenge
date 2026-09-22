# Operator & System Maintenance Guide

This guide describes how to **monitor incoming weather forecast data**, **control the interactive dashboard**, and **maintain the automated continuous pipeline** in production for the Tunisia Solar Power Forecasting System.

---

## 1. Capacity Normalization Principle (1 kWp)

> [!IMPORTANT]
> **Why are all model predictions normalized to 1 kWp?**
> Because photovoltaic installations across the 24 Tunisian governorates continuously expand, retire, or upgrade, the raw dataset and deep neural network models predict power output normalized to **1 kWp installed capacity** (unit: **W/kWp**).
> 
> To obtain total regional, farm, or district power:
> $$\text{Power}_{\text{Total}} = P_{\text{model}} \times \text{Capacity}_{\text{installed (kWp)}}$$
> 
> In the interactive dashboard and the dispatch export module, an operator can input custom capacities (in **kWp** or **MWp**) and the system automatically scales point predictions and confidence bounds.

---

## 2. Monitoring Incoming Weather Data (Open-Meteo API)

The system automatically consumes numerical weather prediction (NWP) forecasts from Open-Meteo:
- **API Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Resolution:** Hourly time series, up to 16 days forward.
- **Key Meteorological Variables:** Global Horizontal Irradiance (GHI / `shortwave_radiation`), Direct Normal Irradiance (DNI), Diffuse Irradiance (DHI), 2m Temperature (`temperature_2m`), Wind Speed (`wind_speed_10m`), Relative Humidity (`relative_humidity_2m`), Surface Pressure (`pressure_msl`), and Low/Mid/High Cloud Cover.

### Automated Health Checks (`src/weather_monitor.py`)
Run a diagnostic health check at any time:

```bash
python -m src.weather_monitor
```

This tests:
1. **Network Connectivity & Latency:** Verifies response time (typically 200–500 ms).
2. **Schema Verification:** Ensures all 13 necessary variables are returned in the payload.
3. **Physical Limits Sanity Check:**
   - Irradiance $GHI \in [0, 1400]\text{ W/m}^2$
   - Temperature $T2m \in [-15, 55]^\circ\text{C}$
   - Relative Humidity $RH \in [0, 100]\%$
   - Wind speed $WS \in [0, 60]\text{ m/s}$

Health telemetry is automatically logged to `data/processed/weather_monitor_health.json`.

---

## 3. Running and Controlling the Interactive Web Dashboard

The web dashboard is built with Streamlit and Plotly, providing real-time visualization, uncertainty evaluation, maps, and grid dispatch integration.

### Launching the Dashboard

From the project root:

```bash
streamlit run app.py
```

The application will start and open automatically in your browser (default URL: `http://localhost:8501`).

### Dashboard Features & Operator Controls:
1. **Model Governance:** The active model is permanently locked to **`keras_nn`** (the top performer on the 2017–2019 validation set, achieving 0.759 W RMSE). Random Forest is strictly barred.
2. **Multi-Scale Aggregation:**
   - **National (Agrégé):** Aggregated power generation for all of Tunisia.
   - **District (Régional):** 7 Tunisian regional grid districts (Grand Tunis, Nord-Est, Nord-Ouest, Centre-Est, Centre-Ouest, Sud-Est, Sud-Ouest).
   - **Gouvernorat (Local):** Individual drilldown for any of the 24 governorates.
3. **Multi-Horizon Slicing:**
   - **Intra-day (Today / 24h):** Hourly dispatch for the current day.
   - **D to D+3 (96h):** Operational planning horizon for STEG dispatch.
   - **Extended Horizon:** Up to 16 days ahead.
4. **Uncertainty Quantification & Certitude:**
   - Displays dynamic confidence bands ($P_{lower}$ to $P_{upper}$) based on calibrated conformal quantiles.
   - At night ($H_{sun} \le 0$ or $G(i) = 0$), $P = 0$ with 100% certitude.
   - During the day, an operational **Certitude Index (%)** indicates forecast stability against cloud variability.
5. **STEG Dispatch Tools Integration:**
   - One-click export of **CSV** and **JSON (SCADA/EMS standard)** files for direct consumption by grid management systems.

---

## 4. Scheduling Continuous Automated Updates

To keep forecasts synchronized with new weather model runs (which update every 3 to 6 hours), schedule the continuous updater.

### Under Windows (Task Scheduler)
1. Open **Task Scheduler** (`taskschd.msc`).
2. Create a task named `Tunisia_PV_Continuous_Updater`.
3. Set trigger: **Repeat task every 3 hours**.
4. Set action:
   - Program: `C:\Users\MSI\Desktop\solar_power_forecasting (3)\solar_power_forecasting\venv\Scripts\python.exe`
   - Arguments: `-m src.weather_monitor --force --days 4`
   - Start in: `C:\Users\MSI\Desktop\solar_power_forecasting (3)\solar_power_forecasting`

### Under Linux / macOS (cron)
Add the following line to `crontab -e`:

```bash
# Refresh 4-day forecast for 24 governorates every 3 hours
0 */3 * * * cd /path/to/solar_power_forecasting && ./venv/bin/python -m src.weather_monitor --force --days 4 >> data/processed/updater.log 2>&1
```

---

## 5. Summary of Key Files

| File | Purpose |
|---|---|
| `app.py` | Interactive web dashboard (Streamlit + Plotly) |
| `src/forecast.py` | Core forecasting pipeline (`keras_nn`, $1\text{ kWp}$ base, confidence intervals) |
| `src/uncertainty.py` | Calibrated conformal prediction engine ($P_{lower}, P_{upper}$, certitude score) |
| `src/dispatch_export.py` | STEG SCADA/EMS dispatch data formatter and exporter (JSON/CSV) |
| `src/weather_monitor.py` | Continuous API ingestion, health telemetry, and bounds checker |
| `data/processed/latest_forecast.csv` | Single source of truth for the newest multi-governorate forecast |
