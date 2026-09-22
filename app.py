"""
Tunisia Solar Power Forecasting & Grid Dispatch Dashboard
Interactive Web Application for STEG and Solar Operations.

Features:
- Standardized Model: keras_nn (Random Forest strictly excluded)
- 1 kWp Capacity Normalization with dynamic scaling multiplier (kWp / MWp)
- Multi-Horizon Views: Intra-day (24h) and Day-ahead to D+3 (96h)
- Multi-Scale Aggregation: National (Countrywide), 7 Regional Districts, 24 Governorates
- Uncertainty Evaluation: Dynamic confidence intervals [P_lower, P_upper] & Certitude %
- Interactive Tunisia Spatial Map
- STEG SCADA/EMS Grid Dispatch Export (CSV and JSON)
- Weather API Monitoring & Health Diagnostics
"""

from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src import config
from src.forecast import GOVERNORATES, predict_for_all_governorates, save_forecast
from src.dispatch_export import prepare_dispatch_dataframe, export_dispatch_csv, export_dispatch_json
from src.weather_monitor import check_api_health, load_health_telemetry

st.set_page_config(
    page_title="Tunisia Solar Forecasting | STEG Dispatch",
    page_icon="☀️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -----------------------------------------------------------------------------
# CSS Styling & Theme Polish
# -----------------------------------------------------------------------------
st.markdown("""
<style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: #f59e0b;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 1.05rem;
        color: #94a3b8;
        margin-bottom: 1rem;
    }
    .norm-banner {
        background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
        border-left: 4px solid #f59e0b;
        padding: 0.9rem 1.2rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        color: #e2e8f0;
        font-size: 0.95rem;
    }
    .kpi-card {
        background-color: #1e293b;
        border-radius: 8px;
        padding: 1.1rem;
        border: 1px solid #334155;
        text-align: center;
    }
    .kpi-title {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 0.3rem;
    }
    .kpi-value {
        font-size: 1.85rem;
        font-weight: 700;
        color: #f8fafc;
    }
    .kpi-sub {
        font-size: 0.8rem;
        color: #38bdf8;
    }
</style>
""", unsafe_allow_html=True)


# -----------------------------------------------------------------------------
# Data Loader
# -----------------------------------------------------------------------------
@st.cache_data(ttl=600)
def get_forecast_data() -> pd.DataFrame:
    latest_path = config.DATA_PROCESSED_DIR / "latest_forecast.csv"
    if not latest_path.exists():
        # Generate initial forecast if missing
        with st.spinner("Generating initial 4-day solar forecast for Tunisia..."):
            df = predict_for_all_governorates(
                model_name=config.DEFAULT_MODEL,
                forecast_days=4,
                governorates=GOVERNORATES,
                confidence_level=config.DEFAULT_CONFIDENCE_LEVEL,
            )
            if not df.empty:
                save_forecast(df)
            return df

    df = pd.read_csv(latest_path)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df


# -----------------------------------------------------------------------------
# Sidebar Configuration
# -----------------------------------------------------------------------------
with st.sidebar:
    st.image("https://upload.wikimedia.org/wikipedia/commons/c/ce/Flag_of_Tunisia.svg", width=65)
    st.title("Paramètres du Système")
    st.markdown("**Modèle Actif :** `keras_nn` ⚡")
    st.caption("Deep Neural Network (Validation RMSE: 0.759 W — Top Performer)")

    st.markdown("---")
    st.subheader("1. Échelle Spatiale")
    scale_type = st.radio(
        "Niveau d'agrégation :",
        options=["National (Agrégé)", "District (Régional)", "Gouvernorat (Local)"],
        index=0,
    )

    selected_district = None
    selected_gov = None

    if scale_type == "District (Régional)":
        selected_district = st.selectbox("Choisir le District :", options=config.DISTRICTS, index=0)
    elif scale_type == "Gouvernorat (Local)":
        selected_gov = st.selectbox("Choisir le Gouvernorat :", options=list(GOVERNORATES.keys()), index=0)

    st.markdown("---")
    st.subheader("2. Horizon Temporel")
    horizon_choice = st.radio(
        "Horizon de prévision :",
        options=["Intra-journalier (Aujourd'hui / 24h)", "D à D+3 (Dispatch opérationnel / 96h)", "Horizon Étendu (Jusqu'à D+16)"],
        index=1,
    )

    st.markdown("---")
    st.subheader("3. Puissance Installée (kWp / MWp)")
    st.caption("Ajustez la capacité pour simuler une centrale ou une zone :")
    cap_val = st.number_input("Capacité installée :", min_value=0.1, value=1.0, step=1.0)
    cap_unit = st.selectbox("Unité de capacité :", options=["kWp", "MWp"], index=0)

    capacity_kwp = cap_val if cap_unit == "kWp" else cap_val * 1000.0
    display_unit = "kW" if capacity_kwp >= 10.0 and cap_unit == "kWp" else ("MW" if cap_unit == "MWp" else "W")

    st.markdown("---")
    st.subheader("4. Intervalle de Confiance")
    ci_level = st.slider("Niveau de couverture (%) :", min_value=80, max_value=98, value=90, step=5)

    st.markdown("---")
    if st.button("🔄 Rafraîchir les données météo", use_container_width=True):
        st.cache_data.clear()
        with st.spinner("Actualisation des prévisions via Open-Meteo..."):
            fresh_df = predict_for_all_governorates(
                model_name=config.DEFAULT_MODEL,
                forecast_days=4,
                governorates=GOVERNORATES,
                confidence_level=ci_level / 100.0,
            )
            if not fresh_df.empty:
                save_forecast(fresh_df)
                st.success("Données actualisées avec succès!")
                st.rerun()


# -----------------------------------------------------------------------------
# Main Application Content
# -----------------------------------------------------------------------------
st.markdown('<div class="main-title">☀️ Système National de Prévision Solaire & Dispatch STEG</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Plateforme prédictive multi-échelles (National, Districts, Gouvernorats) avec estimation d\'incertitude en continu.</div>', unsafe_allow_html=True)

# Normalization Rule Banner
st.markdown(f"""
<div class="norm-banner">
    <b>📐 Référence Normalisée (1 kWc) :</b> Les prédictions du modèle Keras NN sont intrinsèquement normalisées à <b>1 kWc de puissance installée (W/kWc)</b>, le parc photovoltaïque réel par région étant évolutif.
    <br>Dans cet affichage, les valeurs sont automatiquement multipliées par votre capacité configurée : <b>{cap_val:,.1f} {cap_unit}</b> (Sortie en <b>{display_unit}</b>).
</div>
""", unsafe_allow_html=True)

df_all = get_forecast_data()

if df_all.empty:
    st.error("Aucune donnée de prévision disponible. Veuillez cliquer sur 'Rafraîchir les données météo' dans le menu latéral.")
    st.stop()

# Filter Horizon
if "Intra-journalier" in horizon_choice:
    horizon_code = "intra_day"
    df_filtered = df_all[df_all["is_intra_day"] == True].copy()
elif "D à D+3" in horizon_choice:
    horizon_code = "d_to_d3"
    df_filtered = df_all[df_all["is_d_to_d3"] == True].copy()
else:
    horizon_code = "full"
    df_filtered = df_all.copy()

# Prepare Aggregated View
scale_level_code = "national" if "National" in scale_type else ("district" if "District" in scale_type else "governorate")
dispatch_df = prepare_dispatch_dataframe(
    forecast_df=df_filtered,
    scale_level=scale_level_code,
    horizon=horizon_code,
    capacity_kwp=capacity_kwp,
    unit=display_unit,
)

# Apply specific district/gov filter if chosen
if scale_type == "District (Régional)" and selected_district:
    dispatch_df = dispatch_df[dispatch_df["entity_name"] == selected_district].copy()
elif scale_type == "Gouvernorat (Local)" and selected_gov:
    dispatch_df = dispatch_df[dispatch_df["entity_name"] == selected_gov].copy()

# -----------------------------------------------------------------------------
# Tabs Layout
# -----------------------------------------------------------------------------
tab_forecast, tab_map, tab_dispatch, tab_monitor = st.tabs([
    "📊 Prévisions & Incertitude",
    "🗺️ Répartition Spatiale & Carte",
    "⚡ Échange Dispatch STEG (Export)",
    "🛰️ Surveillance Météo & Maintenance"
])


# =============================================================================
# TAB 1: Prévisions & Incertitude
# =============================================================================
with tab_forecast:
    # KPI Metrics Row
    kpi_col1, kpi_col2, kpi_col3, kpi_col4 = st.columns(4)

    peak_power = dispatch_df["power_forecast"].max() if not dispatch_df.empty else 0.0
    daytime_df = dispatch_df[dispatch_df["power_forecast"] > 0]
    avg_cert = daytime_df["certitude_pct"].mean() if not daytime_df.empty else 100.0
    peak_gi = dispatch_df["G(i)"].max() if not dispatch_df.empty else 0.0

    # Total energy estimation (kWh or MWh)
    # Integral of power over hours
    total_energy = dispatch_df["power_forecast"].sum()
    energy_unit = "kWh" if display_unit in ("kW", "W") else "MWh"
    if display_unit == "W":
        total_energy = total_energy / 1000.0

    with kpi_col1:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Puissance Crête Prévue</div>
            <div class="kpi-value">{peak_power:,.2f} <span style="font-size:1.1rem; color:#f59e0b;">{display_unit}</span></div>
            <div class="kpi-sub">Pic sur l'horizon</div>
        </div>
        """, unsafe_allow_html=True)

    with kpi_col2:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Énergie Totale Attendue</div>
            <div class="kpi-value">{total_energy:,.2f} <span style="font-size:1.1rem; color:#10b981;">{energy_unit}</span></div>
            <div class="kpi-sub">Production cumulée</div>
        </div>
        """, unsafe_allow_html=True)

    with kpi_col3:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Indice de Certitude Moyen</div>
            <div class="kpi-value">{avg_cert:.1f}%</div>
            <div class="kpi-sub">Fiabilité opérationnelle</div>
        </div>
        """, unsafe_allow_html=True)

    with kpi_col4:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Irradiance Max G(i)</div>
            <div class="kpi-value">{peak_gi:,.0f} <span style="font-size:1.1rem; color:#38bdf8;">W/m²</span></div>
            <div class="kpi-sub">Plan incliné 30° Sud</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Main Interactive Plotly Chart with Shaded Uncertainty Band
    entity_label = "Tunisie Entière" if scale_type == "National (Agrégé)" else (selected_district if scale_type == "District (Régional)" else selected_gov)
    st.subheader(f"Courbe de Charge Prédictive avec Intervalle de Confiance ({entity_label})")

    fig = go.Figure()

    # Upper Bound
    fig.add_trace(go.Scatter(
        x=dispatch_df["time"],
        y=dispatch_df["power_upper_bound"],
        mode="lines",
        line=dict(width=0),
        showlegend=False,
        name="Borne Supérieure",
        hoverinfo="skip"
    ))

    # Lower Bound with shaded fill to Upper Bound
    fig.add_trace(go.Scatter(
        x=dispatch_df["time"],
        y=dispatch_df["power_lower_bound"],
        mode="lines",
        line=dict(width=0),
        fill="tonexty",
        fillcolor="rgba(245, 158, 11, 0.22)",
        name=f"Intervalle de Confiance ({ci_level}%)",
        hoverinfo="skip"
    ))

    # Expected Point Forecast (P)
    fig.add_trace(go.Scatter(
        x=dispatch_df["time"],
        y=dispatch_df["power_forecast"],
        mode="lines+markers",
        line=dict(color="#f59e0b", width=2.8),
        marker=dict(size=4.5, color="#f59e0b"),
        name="Prévision Attendue (P)",
        customdata=np.stack([
            dispatch_df["power_lower_bound"],
            dispatch_df["power_upper_bound"],
            dispatch_df["certitude_pct"],
            dispatch_df["G(i)"]
        ], axis=-1),
        hovertemplate=(
            "<b>Heure (UTC) :</b> %{x|%Y-%m-%d %H:%M}<br>" +
            f"<b>Prévision P :</b> %{{y:,.2f}} {display_unit}<br>" +
            f"<b>Intervalle :</b> [%{{customdata[0]:,.2f}}, %{{customdata[1]:,.2f}}] {display_unit}<br>" +
            "<b>Certitude :</b> %{customdata[2]:.1f}%<br>" +
            "<b>Irradiance G(i) :</b> %{customdata[3]:.0f} W/m²" +
            "<extra></extra>"
        )
    ))

    fig.update_layout(
        template="plotly_dark",
        plot_bgcolor="#0f172a",
        paper_bgcolor="#0f172a",
        margin=dict(l=30, r=20, t=30, b=30),
        height=480,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        xaxis=dict(
            title="Date et Heure (UTC)",
            showgrid=True,
            gridcolor="#1e293b",
            zeroline=False,
        ),
        yaxis=dict(
            title=f"Puissance Électrique ({display_unit})",
            showgrid=True,
            gridcolor="#1e293b",
            zeroline=True,
            zerolinecolor="#334155",
        ),
        hovermode="x unified",
    )

    st.plotly_chart(fig, use_container_width=True)

    # Uncertainty Analysis & Diurnal Profiles
    col_chart1, col_chart2 = st.columns(2)

    with col_chart1:
        st.subheader("Indice de Certitude Opérationnel (%)")
        fig_cert = go.Figure()
        fig_cert.add_trace(go.Bar(
            x=dispatch_df["time"],
            y=dispatch_df["certitude_pct"],
            marker_color=dispatch_df["certitude_pct"],
            marker_colorscale="Tealgrn",
            name="Certitude (%)",
            hovertemplate="<b>Date :</b> %{x}<br><b>Certitude :</b> %{y:.1f}%<extra></extra>",
        ))
        fig_cert.update_layout(
            template="plotly_dark",
            plot_bgcolor="#0f172a",
            paper_bgcolor="#0f172a",
            height=300,
            margin=dict(l=30, r=20, t=20, b=20),
            yaxis=dict(title="Certitude (%)", range=[50, 102], gridcolor="#1e293b"),
            xaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_cert, use_container_width=True)

    with col_chart2:
        st.subheader("Irradiance Globale Inclinée G(i) (W/m²)")
        fig_gi = go.Figure()
        fig_gi.add_trace(go.Scatter(
            x=dispatch_df["time"],
            y=dispatch_df["G(i)"],
            mode="lines",
            fill="tozeroy",
            line=dict(color="#38bdf8", width=2),
            fillcolor="rgba(56, 189, 248, 0.15)",
            name="G(i)",
            hovertemplate="<b>Date :</b> %{x}<br><b>G(i) :</b> %{y:.0f} W/m²<extra></extra>",
        ))
        fig_gi.update_layout(
            template="plotly_dark",
            plot_bgcolor="#0f172a",
            paper_bgcolor="#0f172a",
            height=300,
            margin=dict(l=30, r=20, t=20, b=20),
            yaxis=dict(title="G(i) (W/m²)", gridcolor="#1e293b"),
            xaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_gi, use_container_width=True)


# =============================================================================
# TAB 2: Répartition Spatiale & Carte
# =============================================================================
with tab_map:
    st.subheader("Générateur Solaire par Gouvernorat & Districts Tunisiens")

    # Group latest data per governorate
    gov_summary = []
    for gov, (lat, lon) in GOVERNORATES.items():
        sub = df_filtered[df_filtered["governorate"] == gov]
        if not sub.empty:
            p_peak_base = sub["P"].max()
            scaled_peak = (p_peak_base * (capacity_kwp / 1000.0) if display_unit == "kW" else (p_peak_base * (capacity_kwp / 1_000_000.0) if display_unit == "MW" else p_peak_base * capacity_kwp))
            gov_summary.append({
                "governorate": gov,
                "district": config.GOVERNORATE_TO_DISTRICT.get(gov, "Autre"),
                "latitude": lat,
                "longitude": lon,
                "peak_power": round(scaled_peak, 2),
                "peak_gi": round(sub["G(i)"].max(), 0),
                "avg_cert": round(sub[sub["P"] > 0]["certitude_pct"].mean(), 1) if not sub[sub["P"] > 0].empty else 100.0,
            })

    map_df = pd.DataFrame(gov_summary)

    map_col, bar_col = st.columns([1.1, 0.9])

    with map_col:
        # Scatter Geo Map of Tunisia (compatible with Plotly 6/7 scatter_map and legacy scatter_mapbox)
        try:
            if hasattr(px, "scatter_map"):
                fig_map = px.scatter_map(
                    map_df,
                    lat="latitude",
                    lon="longitude",
                    size="peak_power",
                    color="peak_power",
                    color_continuous_scale="YlOrRd",
                    size_max=32,
                    zoom=5.7,
                    center=dict(lat=34.9, lon=9.7),
                    map_style="carto-darkmatter",
                    hover_name="governorate",
                    hover_data={
                        "district": True,
                        "peak_power": True,
                        "peak_gi": True,
                        "avg_cert": True,
                        "latitude": False,
                        "longitude": False,
                    },
                    title=f"Puissance Crête par Gouvernorat ({display_unit})",
                )
            else:
                fig_map = px.scatter_mapbox(
                    map_df,
                    lat="latitude",
                    lon="longitude",
                    size="peak_power",
                    color="peak_power",
                    color_continuous_scale="YlOrRd",
                    size_max=32,
                    zoom=5.7,
                    center=dict(lat=34.9, lon=9.7),
                    mapbox_style="carto-darkmatter",
                    hover_name="governorate",
                    hover_data={
                        "district": True,
                        "peak_power": True,
                        "peak_gi": True,
                        "avg_cert": True,
                        "latitude": False,
                        "longitude": False,
                    },
                    title=f"Puissance Crête par Gouvernorat ({display_unit})",
                )
            fig_map.update_layout(
                margin=dict(l=0, r=0, t=35, b=0),
                height=520,
                paper_bgcolor="#0f172a",
            )
            st.plotly_chart(fig_map, use_container_width=True)
        except Exception as e:
            st.warning(f"Affichage de la carte simplifié : {e}")
            fig_simple = px.scatter(
                map_df,
                x="longitude",
                y="latitude",
                size="peak_power",
                color="peak_power",
                hover_name="governorate",
                title=f"Positionnement Géographique ({display_unit})",
            )
            fig_simple.update_layout(template="plotly_dark", height=450)
            st.plotly_chart(fig_simple, use_container_width=True)

    with bar_col:
        st.markdown(f"**Comparatif Régional des Districts ({display_unit}) :**")
        district_summary = map_df.groupby("district")["peak_power"].sum().reset_index()
        district_summary = district_summary.sort_values("peak_power", ascending=True)

        fig_dist = px.bar(
            district_summary,
            x="peak_power",
            y="district",
            orientation="h",
            color="peak_power",
            color_continuous_scale="Sunsetdark",
            labels={"peak_power": f"Puissance Totale ({display_unit})", "district": "District"},
        )
        fig_dist.update_layout(
            template="plotly_dark",
            plot_bgcolor="#0f172a",
            paper_bgcolor="#0f172a",
            height=500,
            margin=dict(l=20, r=20, t=30, b=20),
            xaxis=dict(gridcolor="#1e293b"),
            yaxis=dict(title=""),
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_dist, use_container_width=True)


# =============================================================================
# TAB 3: Échange Dispatch STEG (Export)
# =============================================================================
with tab_dispatch:
    st.subheader("⚡ Outils d'Échange avec le Dispatching National de la STEG")
    st.markdown("""
    Cette interface génère des flux de données standardisés pour transmission aux systèmes
    de gestion de réseau (**EMS / SCADA**) de la STEG, intégrant la puissance attendue, les bandes
    d'incertitude et l'indice de certitude.
    """)

    dispatch_preview = dispatch_df[[
        "time", "scale_level", "entity_name", "power_forecast",
        "power_lower_bound", "power_upper_bound", "unit", "certitude_pct", "G(i)"
    ]].copy()

    # One-click Download Buttons
    csv_bytes = dispatch_preview.to_csv(index=False).encode("utf-8")

    json_payload = {
        "metadata": {
            "source": "Tunisia Solar Power Forecasting System",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "target_system": "STEG SCADA/EMS Grid Dispatch",
            "capacity_basis": f"{capacity_kwp} kWp",
            "normalization_note": config.NORMALIZATION_NOTE,
            "unit": display_unit,
            "records": len(dispatch_preview),
        },
        "forecasts": json.loads(dispatch_preview.to_json(orient="records", date_format="iso")),
    }
    json_bytes = json.dumps(json_payload, indent=2).encode("utf-8")

    btn_col1, btn_col2, btn_col3 = st.columns([1, 1, 2])

    with btn_col1:
        st.download_button(
            label="📥 Télécharger CSV Dispatch (STEG)",
            data=csv_bytes,
            file_name=f"steg_dispatch_{horizon_code}_{display_unit.lower()}.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with btn_col2:
        st.download_button(
            label="📥 Télécharger JSON Dispatch (SCADA)",
            data=json_bytes,
            file_name=f"steg_dispatch_{horizon_code}_{display_unit.lower()}.json",
            mime="application/json",
            use_container_width=True,
        )

    st.markdown("---")
    st.markdown(f"**Tableau Prévisionnel de Dispatch ({len(dispatch_preview)} créneaux horaires) :**")
    st.dataframe(dispatch_preview, use_container_width=True, height=350)


# =============================================================================
# TAB 4: Surveillance Météo & Maintenance
# =============================================================================
with tab_monitor:
    st.subheader("🛰️ Surveillance en Continu & Diagnostics de l'API Météo")
    st.markdown("Contrôle automatique de l'ingestion météorologique (Open-Meteo) et intégrité des signaux physiques.")

    telemetry = load_health_telemetry()

    mon_col1, mon_col2, mon_col3, mon_col4 = st.columns(4)

    status_str = telemetry.get("status", "HEALTHY")
    status_color = "#10b981" if status_str == "HEALTHY" else ("#f59e0b" if status_str in ("WARNING", "DEGRADED") else "#ef4444")

    with mon_col1:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">État du Flux Météo</div>
            <div class="kpi-value" style="color:{status_color};">{status_str}</div>
            <div class="kpi-sub">Open-Meteo Forecast API</div>
        </div>
        """, unsafe_allow_html=True)

    with mon_col2:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Temps de Réponse API</div>
            <div class="kpi-value">{telemetry.get('latency_ms', 0):.0f} <span style="font-size:1.1rem; color:#38bdf8;">ms</span></div>
            <div class="kpi-sub">Latence réseau mesurée</div>
        </div>
        """, unsafe_allow_html=True)

    with mon_col3:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Variables Vérifiées</div>
            <div class="kpi-value" style="color:#10b981;">{'13 / 13' if telemetry.get('variables_verified') else 'Incomplet'}</div>
            <div class="kpi-sub">Conformité du schéma</div>
        </div>
        """, unsafe_allow_html=True)

    with mon_col4:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Limites Physiques</div>
            <div class="kpi-value" style="color:#10b981;">{'Validées' if telemetry.get('physical_bounds_passed') else 'Alerte'}</div>
            <div class="kpi-sub">GHI, T2m, Pression, RH</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("### Guide Opérateur : Surveillance & Maintenance")
    st.markdown("""
    1. **Automatisation en continu (Tâche planifiée)** :
       - Le script `python -m src.weather_monitor --force` peut être programmé pour s'exécuter toutes les 3 heures (sous Windows Task Scheduler ou cron Linux).
       - Dès qu'un nouveau cycle de modèle météorologique (ECMWF/GFS) est disponible, il met à jour automatiquement `data/processed/latest_forecast.csv`.
    2. **Contrôle et Supervision** :
       - L'API Open-Meteo est vérifiée à chaque cycle pour s'assurer de l'absence de valeurs aberrantes (irradiance négative, températures hors normes).
       - En cas de défaillance réseau, le système conserve la dernière prévision valide sans interrompre le tableau de bord.
    3. **Modèle en Production** :
       - **Keras NN** est configuré comme le moteur exclusif. Les modèles Random Forest sont bloqués par sécurité d'intégrité logicielle.
    """)
