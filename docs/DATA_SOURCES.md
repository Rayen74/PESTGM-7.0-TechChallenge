# Data Sources & Collection Methodology

This document explains where every column in `final_merged_dataset.csv`
comes from, how it was collected, and what preprocessing was applied
before merging — for reproducibility and so anyone else on the project
(or future-you) can understand the dataset's provenance without having
to reverse-engineer it from the columns alone.

The dataset combines two independent sources, collected separately for
each of the **24 governorates**, then merged:

1. **PVGIS** (Photovoltaic Geographical Information System, EU Joint Research Centre) — solar irradiance and PV output
2. **Open-Meteo** — general meteorological variables

---

## 1. PVGIS — solar & PV features

### How it was collected

For each of the 24 governorates, a separate dataset was generated
directly from the [PVGIS web tool](https://re.jrc.ec.europa.eu/pvg_tools/en/),
using the **latitude/longitude representative of that governorate**
(typically its capital or main city). This produced 24 separate CSVs,
one per governorate, later merged into a single table.

### Parameters used on the PVGIS site

| Parameter | Value used | What it means |
|---|---|---|
| Slope (tilt angle) | **30°** | The panel's angle from horizontal. 30° is a common fixed-tilt choice for this latitude range — it's close to the angle that maximizes annual energy yield for most mid-latitude locations. |
| Azimuth | **0°** | The panel's horizontal orientation. 0° = true south-facing (in the northern hemisphere, this is the orientation that maximizes annual sun exposure). |
| Mounting type | Fixed | The panel does not track the sun — it stays at the fixed slope/azimuth above for the entire year. |
| Output | Hourly time series | PVGIS was queried for hourly (not monthly/daily aggregated) values, matching the hourly resolution used throughout this project. |

*(If any of the values above don't match exactly what was selected on
the site, update this table — it should always reflect the actual
parameters used, since changing slope/azimuth changes `G(i)` and `P`
meaningfully.)*

### Features produced by PVGIS

| Column | Meaning | Notes |
|---|---|---|
| `time` | Timestamp of the observation | Later split into `year`, `month`, `day`, `hour` — see Preprocessing below |
| `G(i)` | Global irradiance on the inclined plane (W/m²) | Total solar power hitting the panel's tilted surface — direct + diffuse + ground-reflected light. This is the dominant driver of `P`. |
| `H_sun` | Sun height / solar elevation angle (degrees) | How high the sun sits above the horizon; 0° at sunrise/sunset, higher at midday. Pure astronomy — depends only on latitude, date and time, not weather. |
| `T2m` | Air temperature at 2m height (°C) | Affects panel efficiency (PV output drops slightly as panel temperature rises). |
| `WS10m` | Wind speed at 10m height (m/s) | Affects panel cooling, and therefore efficiency, to a smaller degree than temperature. |
| `Int` | Reconstructed-data flag (1 = value was reconstructed/interpolated by PVGIS, 0 = original satellite/reanalysis value) | **Removed** during preprocessing (see below) — it's a data-quality flag from PVGIS's internal processing, not a physical feature useful for predicting `P`. |
| `P` | PV system power output (W) | The **target variable**. Generated for a standardized **1 kWp installed capacity** (unit: W/kWp). Because actual installed capacities across Tunisia's 24 governorates vary and evolve over time, predicting per 1 kWp provides a universal physical reference: actual plant or regional power is obtained simply by multiplying P by total installed kWp (P_actual = P * Capacity_kWp). |

### Preprocessing applied to the PVGIS data

1. **Dropped `Int`** — a data-reconstruction quality flag from PVGIS, not a physical/meteorological feature, and not useful as a model input.
2. **Split `time` into `year`, `month`, `day`, `hour`** — done so each component could later be cyclically encoded (`hour_sin/cos`, `month_sin/cos`, `day_sin/cos` — see `src/feature_engineering.py`) instead of being kept as a single raw timestamp string.

---

## 2. Open-Meteo — meteorological features

### How it was collected

Open-Meteo's historical weather API was queried per governorate for the
same date range as the PVGIS data. Because of API rate limits on
volume, **the full 24-governorate, 19-year request could not be pulled
in one continuous session** — the API stopped returning data reliably
partway through.

To work around this, the data was collected in **4 batches over 3
days**, each batch covering a subset of governorates (e.g. 6
governorates per batch), and each batch was **saved to its own CSV
immediately** after retrieval — this meant that if a later batch failed
or the connection dropped, the governorates already retrieved were
safely preserved on disk rather than lost and needing to be re-fetched
from scratch.

The 4 batch CSVs were later concatenated into a single Open-Meteo
dataset covering all 24 governorates before merging with the PVGIS data.

### Features produced by Open-Meteo

| Column | Meaning | Notes |
|---|---|---|
| `time` | Timestamp of the observation | Split into the same `year`/`month`/`day`/`hour` components as the PVGIS data, for a consistent join key |
| `relative_humidity_2m` | Relative humidity at 2m height (%) | Strongest negative correlation with `P` found in EDA — high humidity often accompanies cloudy conditions |
| `dew_point_2m` | Dew point temperature at 2m (°C) | Tracks closely with `T2m`; drops sharply during dry/cold air mass passages |
| `precipitation` | Precipitation (mm) | Mostly zero (zero-inflated); occasional spikes align with cloud cover and low pressure |
| `cloud_cover` | Total cloud cover (%) | **Dropped during EDA/feature engineering** — found to be ~93% redundant with the three layers below (VIF ≈ 15) |
| `cloud_cover_low` | Low-altitude cloud cover (%) | Kept — has the most direct physical effect on blocking irradiance |
| `cloud_cover_mid` | Mid-altitude cloud cover (%) | Kept — low collinearity with the other layers after `cloud_cover` was dropped (VIF ≈ 1.6) |
| `cloud_cover_high` | High-altitude cloud cover (%) | Kept — same as above (VIF ≈ 1.3 after dropping `cloud_cover`) |
| `pressure_msl` | Mean sea-level pressure (hPa) | Smoothest/slowest-changing variable in the dataset — tracks synoptic-scale weather systems |
| `wind_direction_10m` | Wind direction at 10m (degrees, 0-360) | **Circular variable** — re-encoded as `wind_dir_sin`/`wind_dir_cos` during feature engineering rather than used raw (0° and 360° are the same direction but look maximally different as raw numbers) |

### Preprocessing applied to the Open-Meteo data

1. **Split `time` into `year`, `month`, `day`, `hour`** — same reasoning as for PVGIS: needed as a join key, and to eventually support cyclical encoding.
2. No feature was dropped at this stage (unlike PVGIS's `Int` flag) — the redundancy found in `cloud_cover` was identified later, during EDA on the *merged* dataset, not during Open-Meteo preprocessing itself.

---

## 3. Merging the two sources

The two preprocessed datasets (24 PVGIS files concatenated, 4 Open-Meteo
batch files concatenated) were merged **per governorate, on the matching
`year`/`month`/`day`/`hour` combination**, so each row in the final
dataset represents one governorate at one specific hour, with both the
solar/PV features (from PVGIS) and the meteorological features (from
Open-Meteo) present together.

This produced `final_merged_dataset.csv`: ~4 million rows (24
governorates × 19 years × hourly resolution), which is the file used
throughout `src/` in this project.

## 4. Where feature engineering picks up from here

Everything past this point — cyclical encoding of `hour`/`month`/`day`
and `wind_direction_10m`, dropping `cloud_cover`, dropping `location` in
favor of `latitude`/`longitude` — is handled in
`src/feature_engineering.py`, and the reasoning for each of those
decisions (VIF values, correlation checks, Random Forest importance) is
documented in `notebooks/eda.ipynb`.
