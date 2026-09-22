# Scheduling the Continuous Pipeline

Two separate scheduled jobs, on two separate schedules:

| Script | Purpose | Suggested frequency |
|---|---|---|
| `src/forecast.py` | Fetch Open-Meteo forecast, compute features, predict P for today + next 16 days | Daily (or a few times a day, since forecasts update) |
| `src/retrain.py` | Pull new ground-truth data, append it, retrain, keep the new model only if it's not worse | Every 30 days |

They are separate scripts on purpose: forecasting is cheap and needs to
run often; retraining is expensive (full pipeline re-run) and needs to
run rarely.

## Windows — Task Scheduler

### Daily forecast job

1. Open **Task Scheduler** (`taskschd.msc`)
2. **Create Basic Task** → name it `PV Forecast Daily`
3. Trigger: **Daily**, pick a time (e.g. 05:00, before the working day starts)
4. Action: **Start a program**
   - Program: `C:\Users\MSI\Desktop\solar_power_forecasting\solar_power_forecasting\venv\Scripts\python.exe`
   - Arguments: `-m src.forecast --model random_forest`
   - Start in: `C:\Users\MSI\Desktop\solar_power_forecasting\solar_power_forecasting`

### 30-day retrain job

Same steps, but:
- Name: `PV Retrain Monthly`
- Trigger: **Monthly**, or **Daily** with an "every 30 days" recurrence (Task Scheduler's monthly trigger is simpler — pick a fixed day of month)
- Arguments: `-m src.retrain --model random_forest`

## Linux/macOS — cron

```bash
# Daily forecast at 05:00
0 5 * * * cd /path/to/solar_power_forecasting && ./venv/bin/python -m src.forecast --model random_forest >> logs/forecast.log 2>&1

# Retrain on the 1st of every month at 02:00
0 2 1 * * cd /path/to/solar_power_forecasting && ./venv/bin/python -m src.retrain --model random_forest >> logs/retrain.log 2>&1
```

## What each job actually does

**`forecast.py`**: fetches Open-Meteo's Forecast API per governorate, computes `H_sun` (pvlib, pure astronomy) and `G(i)` (pvlib irradiance transposition, GHI/DNI/DHI → plane-of-array at 30° tilt / 0° azimuth), runs the same feature engineering as training, and predicts `P` with whatever model is currently saved in `outputs/models/`. Saves results to `data/processed/forecast_<timestamp>.csv`. This never touches the training data or retrains anything.

**`retrain.py`**: checks how long it's been since the last retrain (tracked in `data/processed/last_retrain_date.txt`), pulls that window's weather from Open-Meteo's **Historical** API, and — critically — only appends it as new *training* data if real ground-truth `P` is available for that window (see the docstring in `fetch_real_p_for_window()`). Right now that function returns `None` on purpose: PVGIS lags by about a year and there's no STEG data connection yet, so there is currently no legitimate ground truth for "the last 30 days." Wire in a real STEG data source there as soon as one exists — until then, this job safely does nothing rather than retraining on fabricated labels.

Once a real ground-truth source exists and the window is appended, the script retrains the full pipeline and only keeps the new model if its validation RMSE isn't meaningfully worse than the model it's replacing (see `retrain_if_improved()`) — a backup of the previous model is kept automatically (`*.joblib.bak`) either way.
