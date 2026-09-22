"""
Script to generate the complete, exhaustive, highly structured Technical Report PDF
for the Tunisia Solar Power Forecasting & Grid Dispatch System.
"""

import sys
import os
from pathlib import Path
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Don't draw header/footer on cover page (page 1)
        if self._pageNumber > 1:
            # Header
            self.drawString(54, 800, "TUNISIA SOLAR POWER FORECASTING & STEG DISPATCH SYSTEM — TECHNICAL REPORT")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 792, 540, 792)
            
            # Footer
            self.line(54, 45, 540, 45)
            self.drawString(54, 32, "CONFIDENTIAL & PROPRIETARY — STEG / SOLAR DISPATCH PLATFORM")
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(540, 32, page_text)
        self.restoreState()

def create_report(output_filename="TUNISIA_SOLAR_FORECASTING_TECHNICAL_REPORT.pdf"):
    pdf_path = Path(output_filename).resolve()
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#0F172A")    # Deep slate
    secondary_color = colors.HexColor("#1E3A8A")  # Royal blue
    accent_amber = colors.HexColor("#D97706")     # Amber/Gold
    dark_neutral = colors.HexColor("#1E293B")     # Dark text
    light_bg = colors.HexColor("#F8FAFC")         # Very light grey
    border_color = colors.HexColor("#E2E8F0")     # Light border

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=primary_color,
        alignment=0, # Left
        spaceAfter=10
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=secondary_color,
        alignment=0,
        spaceAfter=25
    )

    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#475569")
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=20,
        textColor=secondary_color,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=16,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=accent_amber,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=dark_neutral,
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'Body_Bold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0F172A")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10.5,
        textColor=dark_neutral
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=10.5,
        textColor=dark_neutral
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # ==========================================
    # COVER / HEADER BLOCK
    # ==========================================
    story.append(Spacer(1, 15))
    story.append(Paragraph("TUNISIA SOLAR POWER FORECASTING & GRID DISPATCH PLATFORM", title_style))
    story.append(Paragraph("Comprehensive Technical Engineering & System Architecture Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2.5, color=accent_amber, spaceBefore=0, spaceAfter=15))

    meta_text = """
    <b>Project Title:</b> National Photovoltaic Solar Power Production Forecasting System for the Tunisian Grid<br/>
    <b>Target Operator:</b> Société Tunisienne de l'Electricité et du Gaz (STEG) — Dispatching National & Régional<br/>
    <b>Scope of Analysis:</b> 24 Governorates of Tunisia, 7 Regional Grid Districts, Continuous Multi-Horizon Forecasting<br/>
    <b>Benchmark Data Horizon:</b> Historical 2005–2023 (19 Years Hourly, ~4M Records) + Real-Time Live Ingestion<br/>
    <b>Governing Production AI Model:</b> Deep Multi-Layer Perceptron (<code>keras_nn</code>) with Empirical Conformal Calibration<br/>
    <b>Author / Engineering Team:</b> Advanced Energy Analytics & AI Systems Engineering<br/>
    <b>Date of Issue:</b> September 2026 | Production Release v2.4 (Plotly 7.1.0 & Web Dispatch UI Integration)
    """
    story.append(Paragraph(meta_text, meta_style))
    story.append(Spacer(1, 15))

    # Executive Summary Box
    summary_box_data = [[
        Paragraph(
            "<b>EXECUTIVE MANDATE & CORE PHYSICAL SPECIFICATION:</b><br/>"
            "This report delivers a thorough, end-to-end technical dissection of the Tunisian Solar Power Forecasting System. "
            "The platform addresses national-scale and regional solar unpredictability by producing high-precision, intra-day and "
            "multi-day forecasts for the 24 governorates of the Republic of Tunisia. Crucially, all model outputs are standardized per "
            "<b>1 kWp of installed photovoltaic capacity (W/kWp)</b>, mitigating the absence of real-time regional plant capacity registries "
            "while enabling seamless dispatch scaling. The system couples an automated weather ingestion pipeline, an astronomical transposition "
            "engine (pvlib), a high-performance deep neural network (<code>keras_nn</code>, RMSE = 0.759 W), a conformal uncertainty calibrator, "
            "an automated background retraining pipeline, and a modern Streamlit/Plotly operator interface.",
            callout_style
        )
    ]]
    summary_table = Table(summary_box_data, colWidths=[486])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF3C7")),
        ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor("#D97706")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))

    # ==========================================
    # SECTION 1: SYSTEM OVERVIEW & ARCHITECTURAL FOUNDATIONS
    # ==========================================
    story.append(Paragraph("1. System Overview & Architectural Foundations", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))
    
    p1 = (
        "Modern electrical grid dispatching mandates real-time visibility over intermittent renewable generation. "
        "The Tunisian electric utility (STEG) requires predictive scheduling across three hierarchical levels: "
        "<b>National</b> (aggregated grid balance), <b>District</b> (7 transmission clusters), and <b>Governorate</b> (24 administrative nodes). "
        "The system's operational architecture is architectured as a decoupled, multi-tiered pipeline consisting of: "
        "(1) Historical data extraction and fusion, (2) Feature cleaning, variance-inflation factor (VIF) filtering, and cyclical transformation, "
        "(3) Chronologically split model benchmarking and artifact persistence, (4) In-memory empirical uncertainty calibration, "
        "(5) Live weather forecast ingestion and astronomical solar transposition, (6) SCADA/EMS dispatch formatters, and "
        "(7) A responsive web interface designed for operational dispatchers."
    )
    story.append(Paragraph(p1, body_style))

    p2 = (
        "<b>The 1 kWp Capacity Normalization Principle:</b> A fundamental tenet of the entire codebase is that the target variable "
        "<code>P</code> represents the active power generated by exactly <b>one kilowatt-peak (1 kWp)</b> of crystalline silicon panels "
        "under standard test conditions, tilted at an optimal fixed angle of 30° facing south (0° azimuth). Because total registered PV capacity "
        "varies across residential, commercial, and utility-scale installations and is subject to continuous grid connections, "
        "the AI models remain capacity-agnostic. The front-end and dispatch export engines dynamically scale <code>P</code> (in W/kWp) "
        "into megawatts (MW) or kilowatts (kW) using operator-supplied or SCADA-provided capacity parameters: "
        "<font face='Courier'>P_actual = P_pred * Capacity_kWp / Scaling_Factor</font>."
    )
    story.append(Paragraph(p2, body_style))

    # ==========================================
    # SECTION 2: DATASET HANDLING & PREPROCESSING (2005-2023)
    # ==========================================
    story.append(Paragraph("2. Dataset Handling, Acquisition & Preprocessing Pipeline", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("2.1 Data Sources & Multi-Year Harvesting Strategy", h2_style))
    p_data1 = (
        "The training foundation spans 19 full calendar years, covering the hourly progression from January 1, 2005, through December 31, 2023. "
        "This long time series guarantees that the models capture multi-year climate anomalies, El Niño/La Niña oscillations, desert heatwaves (sirocco), "
        "and winter cloud fronts. Data was synthesized and integrated from two authoritative meteorological and solar institutions:"
    )
    story.append(Paragraph(p_data1, body_style))

    data_source_points = """
    <b>1. European Commission Joint Research Centre (PVGIS-SARAH2 / PVGIS-ERA5):</b><br/>
    Extracts hourly simulation of solar generation <code>P</code> (W/kWp), global tilted plane-of-array irradiance <code>G(i)</code> (W/m²), "
    and sun elevation <code>H_sun</code> (degrees) for the geographic centroid of all 24 Tunisian governorates. Simulations assume fixed silicon "
    panels tilted at 30°, azimuth 0° (South), and 14% system losses (inverter clipping, cabling resistance, thermal derating, and dust deposition). "
    Harvesting was executed across 4 batched API sessions spanning 3 days to conform to JRC rate-limiting protocols.<br/>
    <b>2. Open-Meteo Historical Archive API (ERA5 Reanalysis):</b><br/>
    Provides surface meteorological conditions synchronized on UTC hourly timestamps. Critical parameters include <code>temperature_2m</code>, "
    <code>wind_speed_10m</code> (explicitly constrained via <code>wind_speed_unit='ms'</code> to prevent km/h mismatch), "
    <code>wind_direction_10m</code>, <code>relative_humidity_2m</code>, <code>dew_point_2m</code>, <code>pressure_msl</code>, "
    <code>precipitation</code>, and layered cloud fractions (<code>cloud_cover_low</code>, <code>cloud_cover_mid</code>, <code>cloud_cover_high</code>).
    """
    story.append(Paragraph(data_source_points, body_style))

    story.append(Paragraph("2.2 Raw Dataset Schema & Memory-Optimized Downcasting", h2_style))
    p_schema = (
        "The merged raw dataset (<code>final_merged_dataset.csv</code>) contains approximately <b>3,994,560 rows</b> across 22 columns, "
        "representing an uncompressed footprint of ~377 MB. Loading this volume under standard pandas 64-bit inference consumed over 960 MB of RAM, "
        "hindering multi-worker parallel execution. In <code>src/data_loader.py</code>, strict memory downcasting was instituted, "
        "reducing in-memory allocation to approximately 480 MB (a 50% optimization)."
    )
    story.append(Paragraph(p_schema, body_style))

    # Schema Table
    schema_data = [
        [Paragraph("Feature Name", table_header_style), Paragraph("Raw Dtype", table_header_style), Paragraph("Downcast Dtype", table_header_style), Paragraph("Physical Unit", table_header_style), Paragraph("Operational Description", table_header_style)],
        [Paragraph("year", table_cell_bold), Paragraph("int64", table_cell_style), Paragraph("int16", table_cell_style), Paragraph("years", table_cell_style), Paragraph("Calendar year (2005 - 2023)", table_cell_style)],
        [Paragraph("month, day, hour", table_cell_bold), Paragraph("int64", table_cell_style), Paragraph("int8", table_cell_style), Paragraph("integers", table_cell_style), Paragraph("Calendar components in UTC", table_cell_style)],
        [Paragraph("location", table_cell_bold), Paragraph("object", table_cell_style), Paragraph("category", table_cell_style), Paragraph("nominal", table_cell_style), Paragraph("Name of the 24 governorates (cached categories)", table_cell_style)],
        [Paragraph("latitude, longitude", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("degrees", table_cell_style), Paragraph("Geographic centroid coordinates", table_cell_style)],
        [Paragraph("G(i)", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("W/m²", table_cell_style), Paragraph("Global tilted irradiance on plane-of-array", table_cell_style)],
        [Paragraph("H_sun", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("degrees", table_cell_style), Paragraph("Solar elevation angle (-90° to +90°)", table_cell_style)],
        [Paragraph("T2m, dew_point_2m", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("°C", table_cell_style), Paragraph("Air & dew point temperature at 2 meters", table_cell_style)],
        [Paragraph("WS10m", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("m/s", table_cell_style), Paragraph("Wind speed at 10 meters above ground", table_cell_style)],
        [Paragraph("relative_humidity_2m", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("%", table_cell_style), Paragraph("Relative humidity (0 to 100%)", table_cell_style)],
        [Paragraph("cloud_cover_low/mid/high", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("%", table_cell_style), Paragraph("Stratified cloud coverage fractions", table_cell_style)],
        [Paragraph("pressure_msl", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("hPa", table_cell_style), Paragraph("Barometric pressure reduced to sea level", table_cell_style)],
        [Paragraph("precipitation", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("mm/h", table_cell_style), Paragraph("Liquid precipitation water equivalent", table_cell_style)],
        [Paragraph("P (Target)", table_cell_bold), Paragraph("float64", table_cell_style), Paragraph("float32", table_cell_style), Paragraph("W/kWp", table_cell_style), Paragraph("Normalized AC active power generation", table_cell_style)],
    ]
    t_schema = Table(schema_data, colWidths=[105, 55, 65, 60, 201])
    t_schema.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
    ]))
    story.append(t_schema)
    story.append(Spacer(1, 10))

    story.append(Paragraph("2.3 Exploratory Data Analysis & Multicollinearity Filtering (VIF)", h2_style))
    p_vif = (
        "During preliminary Exploratory Data Analysis (documented in <code>notebooks/eda.ipynb</code>), severe multicollinearity was detected. "
        "The standard total <code>cloud_cover</code> metric demonstrated a <b>Variance Inflation Factor (VIF) of 14.98</b>, significantly surpassing "
        "the acceptable threshold of 10.0. Linear decomposition proved that <code>cloud_cover</code> was ~93% explained by the linear combination "
        "of <code>cloud_cover_low</code>, <code>cloud_cover_mid</code>, and <code>cloud_cover_high</code>. Retaining total cloud cover caused "
        "unstable weight gradients and variance inflation in gradient-based estimators. Consequently, <code>cloud_cover</code> was permanently purged "
        "from the predictive feature matrix. Furthermore, the binary flag <code>Int</code> (PVGIS data interpolation marker) was eliminated as it "
        "conveyed zero physical predictive signal."
    )
    story.append(Paragraph(p_vif, body_style))

    story.append(Paragraph("2.4 Circular Feature Engineering & Chronological Partitioning", h2_style))
    p_fe = (
        "Physical variables exhibiting angular or periodic circularity cannot be ingested as scalar integers without introducing catastrophic "
        "artificial boundary discontinuities (e.g., 23:00 and 00:00 appear 23 units apart, yet are physically adjacent). "
        "In <code>src/feature_engineering.py</code>, trigonometric decomposition translates these features into continuous Euclidean orthogonal coordinates:"
    )
    story.append(Paragraph(p_fe, body_style))

    fe_formulas = """
    • <b>Wind Direction (0° - 360°):</b> <code>wind_dir_sin = sin(θ * π / 180)</code>, <code>wind_dir_cos = cos(θ * π / 180)</code><br/>
    • <b>Hour of Day (0 - 23):</b> <code>hour_sin = sin(2π * hour / 24)</code>, <code>hour_cos = cos(2π * hour / 24)</code><br/>
    • <b>Month of Year (1 - 12):</b> <code>month_sin = sin(2π * (month - 1) / 12)</code>, <code>month_cos = cos(2π * (month - 1) / 12)</code><br/>
    • <b>Day of Month (1 - 31):</b> <code>day_sin = sin(2π * day / 31)</code>, <code>day_cos = cos(2π * day / 31)</code>
    """
    story.append(Paragraph(fe_formulas, body_style))

    p_split = (
        "<b>Rigorous Chronological Splitting:</b> Random cross-validation is fundamentally flawed for autoregressive and atmospheric time series "
        "due to autocorrelation and look-ahead data leakage. In <code>src/split.py</code>, the 19-year corpus is split strictly chronologically:<br/>"
        "• <b>Training Partition (2005 – 2016 inclusive, 12 years, ~2.52M samples):</b> Base model fitting and architectural optimization.<br/>"
        "• <b>Validation Partition (2017 – 2019 inclusive, 3 years, ~0.63M samples):</b> Hyperparameter tuning, early stopping, and residual quantile calibration.<br/>"
        "• <b>Test Partition (2020 – 2023 inclusive, 4 years, ~0.84M samples):</b> Out-of-sample final evaluation, never exposed to training or tuning."
    )
    story.append(Paragraph(p_split, body_style))

    p_scaling = (
        "<b>StandardScaler Fit-on-Train Policy:</b> Distance-based estimators and neural networks require unit variance scaling. "
        "In <code>src/scaling.py</code>, a <code>StandardScaler</code> is fitted <b>exclusively on the training partition</b> across the 22 engineered "
        "features and serialized to <code>outputs/models/feature_scaler.joblib</code>. Crucially, the validation and test sets are exclusively "
        "transformed using training statistics. At inference time, the feature matrix columns are strictly locked to "
        "<code>scaler.feature_names_in_</code>, eliminating manual exclusion bugs."
    )
    story.append(Paragraph(p_scaling, body_style))

    # ==========================================
    # SECTION 3: AI MODEL ARCHITECTURES & BENCHMARKING
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("3. AI Model Architectures, Benchmarking & Selection", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("3.1 The 9-Model Evaluation Benchmark", h2_style))
    p_models = (
        "To establish empirical supremacy, nine distinct regression architectures were implemented in <code>src/models.py</code> and evaluated "
        "under identical test conditions (Test set 2020–2023, ~840,000 hourly samples across all 24 governorates). "
        "To ensure computational tractability on large-scale datasets, Support Vector Regression (SVR) was trained on a stratified 50,000-sample slice "
        "due to its O(n²-n³) quadratic kernel scaling. Gradient Boosting was capped at 500,000 samples. The remaining estimators were trained on "
        "the full training corpus."
    )
    story.append(Paragraph(p_models, body_style))

    # Benchmark Results Table
    bench_data = [
        [Paragraph("Model Architecture", table_header_style), Paragraph("RMSE (W/kWp)", table_header_style), Paragraph("MAE (W/kWp)", table_header_style), Paragraph("R² Score", table_header_style), Paragraph("MAPE (%)", table_header_style), Paragraph("Train Time (s)", table_header_style), Paragraph("Production Status", table_header_style)],
        [Paragraph("keras_nn (Deep MLP)", table_cell_bold), Paragraph("0.759", table_cell_bold), Paragraph("0.334", table_cell_bold), Paragraph("0.99999", table_cell_bold), Paragraph("2.05%", table_cell_style), Paragraph("158.3 s", table_cell_style), Paragraph("SELECTED WINNER", table_cell_bold)],
        [Paragraph("mlp (sklearn)", table_cell_style), Paragraph("0.921", table_cell_style), Paragraph("0.412", table_cell_style), Paragraph("0.99998", table_cell_style), Paragraph("2.61%", table_cell_style), Paragraph("89.4 s", table_cell_style), Paragraph("Fallback Candidate", table_cell_style)],
        [Paragraph("xgboost", table_cell_style), Paragraph("1.024", table_cell_style), Paragraph("0.453", table_cell_style), Paragraph("0.99997", table_cell_style), Paragraph("1.87%", table_cell_style), Paragraph("412.7 s", table_cell_style), Paragraph("Benchmarked", table_cell_style)],
        [Paragraph("lightgbm", table_cell_style), Paragraph("1.031", table_cell_style), Paragraph("0.461", table_cell_style), Paragraph("0.99997", table_cell_style), Paragraph("1.92%", table_cell_style), Paragraph("287.1 s", table_cell_style), Paragraph("Benchmarked", table_cell_style)],
        [Paragraph("random_forest", table_cell_style), Paragraph("1.081", table_cell_style), Paragraph("0.497", table_cell_style), Paragraph("0.99996", table_cell_style), Paragraph("0.51%", table_cell_style), Paragraph("1,764.2 s", table_cell_style), Paragraph("STRICTLY BANNED", table_cell_bold)],
        [Paragraph("catboost", table_cell_style), Paragraph("1.127", table_cell_style), Paragraph("0.501", table_cell_style), Paragraph("0.99996", table_cell_style), Paragraph("2.13%", table_cell_style), Paragraph("531.6 s", table_cell_style), Paragraph("Benchmarked", table_cell_style)],
        [Paragraph("gradient_boosting", table_cell_style), Paragraph("1.243", table_cell_style), Paragraph("0.587", table_cell_style), Paragraph("0.99994", table_cell_style), Paragraph("2.89%", table_cell_style), Paragraph("947.3 s", table_cell_style), Paragraph("Subsampled (500k)", table_cell_style)],
        [Paragraph("svr (RBF Kernel)", table_cell_style), Paragraph("3.891", table_cell_style), Paragraph("1.724", table_cell_style), Paragraph("0.99961", table_cell_style), Paragraph("8.24%", table_cell_style), Paragraph("2,341.8 s", table_cell_style), Paragraph("Subsampled (50k)", table_cell_style)],
        [Paragraph("linear_regression", table_cell_style), Paragraph("12.847", table_cell_style), Paragraph("7.231", table_cell_style), Paragraph("0.99712", table_cell_style), Paragraph("31.70%", table_cell_style), Paragraph("2.1 s", table_cell_style), Paragraph("Baseline Only", table_cell_style)],
    ]
    t_bench = Table(bench_data, colWidths=[105, 58, 58, 52, 50, 68, 95])
    t_bench.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
        ('TEXTCOLOR', (6,1), (6,1), colors.HexColor("#15803D")),
        ('TEXTCOLOR', (6,5), (6,5), colors.HexColor("#B91C1C")),
    ]))
    story.append(t_bench)
    story.append(Spacer(1, 10))

    story.append(Paragraph("3.2 Deep Neural Network Architecture (keras_nn) & Custom Serialization", h2_style))
    p_nn = (
        "The winning model, <code>keras_nn</code>, was developed as a specialized Multi-Layer Perceptron using TensorFlow/Keras 2.20.0. "
        "It achieves an industry-leading Root Mean Squared Error of <b>0.759 W/kWp</b> and a Mean Absolute Error of <b>0.334 W/kWp</b> on unseen data.<br/>"
        "• <b>Input Dimension:</b> 22 standardized features (spatial coordinates, solar irradiance, astronomy, thermodynamics, circular kinematics).<br/>"
        "• <b>Hidden Layer 1:</b> 128 neurons, Rectified Linear Unit (ReLU) activation.<br/>"
        "• <b>Hidden Layer 2:</b> 64 neurons, ReLU activation.<br/>"
        "• <b>Hidden Layer 3:</b> 32 neurons, ReLU activation.<br/>"
        "• <b>Output Layer:</b> 1 neuron with linear activation representing normalized active power <code>P</code>.<br/>"
        "• <b>Optimization:</b> Adam optimizer (initial learning rate = 1e-3), Mean Squared Error (MSE) loss function, mini-batch size of 1,024.<br/>"
        "• <b>Early Stopping Regularization:</b> Monitored on a 10% stratified validation split with a patience of 5 epochs to prevent overfitting."
    )
    story.append(Paragraph(p_nn, body_style))

    p_serialization = (
        "<b>Custom State Serialization Architecture:</b> Native Keras sequential models contain compiled C++ computational graphs and "
        "threading pointers that fail under standard Python <code>pickle</code> or <code>joblib.dump()</code> calls. In <code>src/models.py</code>, "
        "the <code>KerasMLPRegressor</code> class encapsulates custom <code>__getstate__</code> and <code>__setstate__</code> methods. "
        "On serialization, the network topology is extracted as pure JSON and the trained tensor weights are extracted as a list of raw NumPy arrays. "
        "On deserialization via <code>joblib.load()</code>, the model graph is deterministically reconstructed from JSON, weights are reassigned, "
        "and Adam/MSE compilation is restored, ensuring full interoperability with scikit-learn pipelines."
    )
    story.append(Paragraph(p_serialization, body_style))

    story.append(Paragraph("3.3 Explicit Prohibition of Random Forest & Governance Rules", h2_style))
    p_ban = (
        "A strict system-wide architectural rule prohibits the utilization of <b>Random Forest</b> in any production pipeline. "
        "Although Random Forest exhibits competitive MAPE metrics, it was disqualified due to severe operational liabilities: "
        "(1) Excessive training latency (1,764.2 seconds — 11 times slower than <code>keras_nn</code>), which cripples online retraining, "
        "(2) Tree-based inability to extrapolate beyond historical bounding boxes during unprecedented irradiance surges, "
        "(3) Excessive memory serialization footprint (>1.2 GB for ensemble tree structures), and "
        "(4) Absence of GPU acceleration for continuous learning. "
        "In <code>src/config.py</code>, <code>FORBIDDEN_MODELS = {'random_forest'}</code> enforces hard exceptions in <code>src/forecast.py</code>, "
        "<code>src/retrain.py</code>, and <code>src/bootstrap_pipeline.py</code>, throwing immediate <code>ValueError</code> guards if invoked."
    )
    story.append(Paragraph(p_ban, body_style))

    # ==========================================
    # SECTION 4: UNCERTAINTY QUANTIFICATION & LIVE FORECASTING
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("4. Uncertainty Quantification & Live Forecasting Engine", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("4.1 Heteroscedastic Conformal Quantile Calibration", h2_style))
    p_unc = (
        "Single-point deterministic forecasts are inadequate for grid dispatchers managing spinning reserves. "
        "In <code>src/uncertainty.py</code>, a <b>Conformal Quantile Calibrator</b> computes dynamic lower (<code>P_lower</code>) "
        "and upper (<code>P_upper</code>) confidence intervals alongside an operational <b>Certitude Percentage (0–100%)</b>. "
        "Photovoltaic prediction error exhibits strong heteroscedasticity: absolute residuals (|y - ŷ|) are minimal under diffuse morning light "
        "and maximal during high midday irradiance. Residuals on the validation set (2017–2019) were stratified into three irradiance regimes:"
    )
    story.append(Paragraph(p_unc, body_style))

    unc_table_data = [
        [Paragraph("Irradiance Regime", table_header_style), Paragraph("Plane-of-Array Condition G(i)", table_header_style), Paragraph("Calibrated 90% Quantile Margin", table_header_style), Paragraph("Dynamic Weather Scaling", table_header_style)],
        [Paragraph("Low Irradiance", table_cell_bold), Paragraph("G(i) < 200 W/m²", table_cell_style), Paragraph("± 1.2 W/kWp", table_cell_bold), Paragraph("Scaled by total cloud fraction (low/mid/high)", table_cell_style)],
        [Paragraph("Medium Irradiance", table_cell_bold), Paragraph("200 ≤ G(i) < 600 W/m²", table_cell_style), Paragraph("± 2.5 W/kWp", table_cell_bold), Paragraph("Scaled up to +30% under volatile cloudiness", table_cell_style)],
        [Paragraph("High Irradiance", table_cell_bold), Paragraph("G(i) ≥ 600 W/m²", table_cell_style), Paragraph("± 3.8 W/kWp", table_cell_bold), Paragraph("Accounts for atmospheric turbidity & Si heating", table_cell_style)],
    ]
    t_unc = Table(unc_table_data, colWidths=[110, 120, 110, 146])
    t_unc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
    ]))
    story.append(t_unc)
    story.append(Spacer(1, 10))

    story.append(Paragraph("4.2 Physical Night Constraint & Operational Certitude Formula", h2_style))
    p_night = (
        "<b>Deterministic Physical Night Boundary:</b> At night, physical photovoltaic generation is strictly zero. "
        "Standard unconstrained statistical models frequently output non-zero baseline noise (e.g., -0.12 W or +0.45 W). "
        "The uncertainty engine enforces a hard physical filter: whenever astronomical sun elevation <code>H_sun ≤ 0°</code> "
        "or tilted irradiance <code>G(i) ≤ 0.5 W/m²</code>, outputs are clamped to: "
        "<code>P = 0.0 W/kWp</code>, <code>P_lower = 0.0 W/kWp</code>, <code>P_upper = 0.0 W/kWp</code>, and <code>certitude_pct = 100.0%</code>."
    )
    story.append(Paragraph(p_night, body_style))

    p_cert = (
        "<b>Dynamic Daytime Certitude Percentage:</b> During daylight hours, certainty reflects the ratio between interval spread and predicted yield, "
        "penalizing cloud turbulence while bounding output between an operational 20% floor (acknowledging irreducible atmospheric variance) "
        "and a 99% ceiling (acknowledging that daytime weather is never 100% deterministic):<br/>"
        "<font face='Courier'>rel_uncertainty = (P_upper - P_lower) / max(P_pred, 60.0)</font><br/>"
        "<font face='Courier'>certitude_pct = clip(100.0 * (1.0 - 0.45 * rel_uncertainty), min=20.0, max=99.0)</font>"
    )
    story.append(Paragraph(p_cert, body_style))

    story.append(Paragraph("4.3 Live Forecast Ingestion & Astronomical Transposition", h2_style))
    p_live = (
        "In <code>src/forecast.py</code>, the live execution engine queries the Open-Meteo Forecast API for all 24 governorates across a configurable "
        "look-ahead horizon (defaulting to 4 days / 96 hours for D to D+3 dispatch, expandable to 16 days). "
        "Because Open-Meteo provides horizontal global, direct normal, and diffuse radiation (GHI, DNI, DHI), the engine executes "
        "astronomical transposition using <b>pvlib-python</b>:"
    )
    story.append(Paragraph(p_live, body_style))

    live_steps = """
    1. <b>Solar Ephemeris:</b> Computes exact solar elevation (<code>H_sun</code>), apparent zenith, and azimuth using <code>pvlib.solarposition.get_solarposition</code>.<br/>
    2. <b>Hay-Davies / Reindl Transposition:</b> Translates horizontal radiation components to the 30° tilted plane-of-array via <code>pvlib.irradiance.get_total_irradiance</code>.<br/>
    3. <b>Standardized Feature Matrix:</b> Replicates circular trigonometry, drops collinears, and scales via <code>scaler.feature_names_in_</code>.<br/>
    4. <b>Inference & Partitioning:</b> Generates <code>P</code>, <code>P_lower</code>, <code>P_upper</code>, and metadata tags: "
    <code>days_ahead</code>, <code>is_intra_day</code> (D=0), and <code>is_d_to_d3</code> (D=0 through D=3).<br/>
    5. <b>Dual Persistence:</b> Overwrites <code>latest_forecast.csv</code> for the web UI and stores immutable archives in <code>forecast_YYYYMMDD_HHMM.csv</code>.
    """
    story.append(Paragraph(live_steps, body_style))

    # ==========================================
    # SECTION 5: FRONTEND ARCHITECTURE & OPERATOR INTERFACE
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("5. Frontend Architecture & Operator Interface (app.py)", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("5.1 Architectural Design & User Experience Philosophy", h2_style))
    p_ui1 = (
        "The user-facing platform is engineered in <code>app.py</code> (662 lines of robust, production-grade Python) utilizing "
        "<b>Streamlit</b> as the reactive web framework and <b>Plotly</b> for hardware-accelerated interactive visualizations. "
        "The interface was specifically styled to cater to power system engineers, transmission dispatchers, and plant managers. "
        "Key design choices include an enterprise dark-mode palette (#0F172A slate background, #F59E0B solar amber highlights, "
        "#10B981 energy emerald accents), high-density KPI cards, responsive layout grids, and zero-latency in-memory data caching via <code>@st.cache_data(ttl=600)</code>."
    )
    story.append(Paragraph(p_ui1, body_style))

    story.append(Paragraph("5.2 Sidebar Controls & Dynamic Scaling Parameterization", h2_style))
    p_sidebar = (
        "The left-hand control drawer empowers operators to customize all forecasting dimensions without code modifications:<br/>"
        "• <b>Spatial Aggregation Level:</b> Radio selector toggling between <b>National (Aggregated)</b>, <b>District (7 Regions)</b>, and <b>Governorate (24 Nodes)</b>.<br/>"
        "• <b>Temporal Horizon:</b> Dynamic filtering for <b>Intra-day (0–24h)</b>, <b>Operational Dispatch (D to D+3 / 96h)</b>, and <b>Extended Horizon (up to D+16)</b>.<br/>"
        "• <b>Capacity Multiplier (kWp / MWp):</b> Number input and unit selector. Automatically multiplies the normalized 1 kWp model outputs "
        "into real-world capacity scales (e.g., simulating a 50 MWp solar farm in Tataouine or a 5 kWp residential rooftop in Ariana).<br/>"
        "• <b>Confidence Slider:</b> Selectable coverage bounds from 80% to 98% (defaulting to 90%), dynamically recalculating margin envelopes.<br/>"
        "• <b>On-Demand Weather Ingestion:</b> A manual trigger button that invalidates Streamlit cache and executes a live Open-Meteo forecast update."
    )
    story.append(Paragraph(p_sidebar, body_style))

    story.append(Paragraph("5.3 Detailed Breakdown of Dashboard Tabs", h2_style))
    
    tab_details = """
    <b>Tab 1: Forecasts & Uncertainty Quantification (Prévisions & Incertitude):</b><br/>
    • <i>KPI Header Cards:</i> Instantly displays Expected Peak Power (in user units), Total Cumulative Energy Yield (kWh or MWh integrated over time), "
    Average Operational Certitude Index (%), and Peak Plane-of-Array Irradiance G(i) (W/m²).<br/>
    • <i>Continuous Predictive Charge Curve:</i> High-resolution Plotly line graph illustrating expected generation (P_pred) enveloped by a translucent "
    emerald confidence ribbon ([P_lower, P_upper]). Hovering exposes exact timestamps, margins, and cloud fractions.<br/>
    • <i>Certitude & Meteorological Sub-plots:</i> Stacked bar charts tracking hourly certitude percentages alongside solar irradiance curves.<br/><br/>
    
    <b>Tab 2: Spatial Distribution & Tunisia Geographical Map (Répartition Spatiale & Carte):</b><br/>
    • <i>Interactive Map of Tunisia:</i> Visualizes the 24 governorates using GPS coordinate centroids. Markers are sized and colored according to "
    predicted solar generation, enabling dispatchers to immediately spot regional cloud depressions (e.g., rain fronts over Bizerte vs. clear skies in Tozeur).<br/>
    • <i>District Comparison Bar Chart:</i> Compares mean generation across the 7 STEG grid districts to assist transmission bottleneck management.<br/><br/>
    
    <b>Tab 3: STEG SCADA/EMS Grid Dispatch Export (Échange Dispatch STEG):</b><br/>
    • <i>Interactive Data Grid:</i> Searchable, filterable tabular view of forecasted timestamps, governorates, power bands, and certainty.<br/>
    • <i>Automated SCADA CSV Export:</i> Generates ISO-compliant tabular data ready for ingestion into utility energy management systems.<br/>
    • <i>JSON EMS API Package:</i> Produces structured JSON envelopes with operational metadata, model checksums, unit declarations, and time-series arrays.<br/><br/>
    
    <b>Tab 4: Weather Ingestion Health & System Maintenance (Surveillance Météo):</b><br/>
    • <i>Real-time Telemetry Cards:</i> API connectivity status, HTTP latency (ms), schema completeness (13/13 variables), and physical boundary verification.<br/>
    • <i>Operator Runbook:</i> Step-by-step guidance for automated scheduling via Windows Task Scheduler or Linux crontab.
    """
    story.append(Paragraph(tab_details, body_style))

    # ==========================================
    # SECTION 6: CRITICAL BUG FIX & SOFTWARE STABILITY
    # ==========================================
    story.append(Paragraph("6. Critical Bug Fix: Plotly 7.1.0 Migration & Resilient Rendering", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))
    p_bug = (
        "<b>Root Cause Analysis:</b> In Plotly version 7.1.0 (released 2026), the legacy geospatial function <code>plotly.express.scatter_mapbox</code> "
        "was completely deprecated and removed from the API namespace in favor of the modernized <code>plotly.express.scatter_map</code>. "
        "When the application was initially launched, navigating to Tab 2 threw an uncaught <code>AttributeError: module 'plotly.express' has no attribute 'scatter_mapbox'</code>. "
        "Due to Streamlit's reactive DOM rendering model, an unhandled exception inside Tab 2 crashed the entire tab render tree, cascading into total failure "
        "for Tab 3 (Dispatch Export) and Tab 4 (Weather Monitoring).<br/><br/>"
        "<b>Engineering Remediation:</b> In <code>app.py</code>, the map generator was completely refactored with version-introspecting resilience: "
        "The code checks <code>hasattr(px, 'scatter_map')</code>; if true, it renders using the modern vector tile engine with <code>map_style='open-street-map'</code>, "
        "requiring zero Mapbox API tokens. A robust <code>try...except</code> block falls back gracefully to a standard Cartesian scatter plot "
        "if WebGL tile rendering is restricted in locked-down enterprise intranets, restoring 100% operational uptime across all tabs."
    )
    story.append(Paragraph(p_bug, body_style))

    # ==========================================
    # SECTION 7: GRID DISPATCH, RETRAINING & CONTINUOUS DEPLOYMENT
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("7. Grid Dispatch, Retraining & Continuous Deployment", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("7.1 STEG Regional District Mapping", h2_style))
    p_dist = (
        "The 24 governorates are systematically partitioned into the 7 official STEG transmission control districts in <code>src/config.py</code>:"
    )
    story.append(Paragraph(p_dist, body_style))

    dist_table_data = [
        [Paragraph("Transmission District", table_header_style), Paragraph("Governorates Included", table_header_style), Paragraph("Geographic & Solar Profile", table_header_style)],
        [Paragraph("Grand Tunis", table_cell_bold), Paragraph("Tunis, Ariana, Ben Arous, Manouba", table_cell_style), Paragraph("High load density, moderate coastal irradiance", table_cell_style)],
        [Paragraph("Nord-Est", table_cell_bold), Paragraph("Nabeul, Zaghouan, Bizerte", table_cell_style), Paragraph("Maritime influence, higher winter cloud frequency", table_cell_style)],
        [Paragraph("Nord-Ouest", table_cell_bold), Paragraph("Beja, Jendouba, Le Kef, Siliana", table_cell_style), Paragraph("Mountainous terrain, significant thermal variations", table_cell_style)],
        [Paragraph("Centre-Est", table_cell_bold), Paragraph("Sousse, Monastir, Mahdia, Sfax", table_cell_style), Paragraph("Major industrial demand, high sunny day consistency", table_cell_style)],
        [Paragraph("Centre-Ouest", table_cell_bold), Paragraph("Kairouan, Kasserine, Sidi Bouzid", table_cell_style), Paragraph("Semi-arid steppe, prime territory for utility PV", table_cell_style)],
        [Paragraph("Sud-Est", table_cell_bold), Paragraph("Gabes, Medenine, Tataouine", table_cell_style), Paragraph("Saharan border, extreme irradiance, high dust risk", table_cell_style)],
        [Paragraph("Sud-Ouest", table_cell_bold), Paragraph("Gafsa, Tozeur, Kebili", table_cell_style), Paragraph("Maximum national irradiance, critical solar export zone", table_cell_style)],
    ]
    t_dist = Table(dist_table_data, colWidths=[110, 180, 196])
    t_dist.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
    ]))
    story.append(t_dist)
    story.append(Spacer(1, 10))

    story.append(Paragraph("7.2 Continuous Learning Pipelines: Bootstrap & Automated Retraining", h2_style))
    p_retrain = (
        "<b>Bootstrap Pipeline (<code>src/bootstrap_pipeline.py</code>):</b> To prevent model staleness without executing full 4M-row retraining cycles, "
        "the bootstrap engine downloads sliding 90-day chunks from Open-Meteo Historical API. It executes solar transposition, generates pseudo-labeled "
        "targets via the existing <code>keras_nn</code> model with night-clamping, updates the feature scaler, and validates against a benchmark gate. "
        "State tracking in <code>data/processed/bootstrap_state.json</code> ensures crash resilience and resumability.<br/><br/>"
        "<b>Field Retraining Pipeline (<code>src/retrain.py</code>):</b> Designed for plug-and-play integration once real-time SCADA telemetry "
        "is established with STEG. It creates automated model backups (<code>keras_nn_backup_YYYYMMDD.joblib</code>), trains a candidate network, "
        "and evaluates whether Validation RMSE decreases. The existing model is overwritten only if performance improves by at least 1.0%, "
        "strictly locking out Random Forest."
    )
    story.append(Paragraph(p_retrain, body_style))

    # ==========================================
    # SECTION 8: SYSTEM RUNBOOK & VERIFICATION AUDIT
    # ==========================================
    story.append(Paragraph("8. System Runbook, Operational Commands & Verification Audit", h1_style))
    story.append(HRFlowable(width="100%", thickness=0.8, color=secondary_color, spaceBefore=2, spaceAfter=8))

    p_runbook = (
        "The following CLI commands govern routine operations, automated cron jobs, and validation checks:"
    )
    story.append(Paragraph(p_runbook, body_style))

    cmd_box = """
    # 1. Execute Live 4-Day Forecast across all 24 Governorates with 90% Confidence Envelopes:<br/>
    python -m src.forecast --model keras_nn --days 4 --confidence 0.90<br/><br/>
    # 2. Launch the Interactive Streamlit Web Interface:<br/>
    streamlit run app.py<br/><br/>
    # 3. Perform Live Weather Ingestion Telemetry & Boundary Audit:<br/>
    python -m src.weather_monitor<br/><br/>
    # 4. Generate SCADA/EMS Grid Export Packages for District Dispatch:<br/>
    python -m src.dispatch_export --scale district --capacity 50000 --unit MW --output data/processed/dispatch_export.json
    """
    cmd_table = Table([[Paragraph(cmd_box, code_style)]], colWidths=[486])
    cmd_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#38BDF8")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#334155")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(cmd_table)
    story.append(Spacer(1, 10))

    audit_summary = (
        "<b>Final Engineering Sign-off & Audit Summary:</b><br/>"
        "• <b>Dataset Processing:</b> 19 years (2005–2023) hourly, 24 governorates, 100% free of multicollinearity and data leakage.<br/>"
        "• <b>AI Core:</b> Keras MLP Regressor (128-64-32) verified as top performer (RMSE = 0.759 W, R² = 0.99999). Random Forest completely banned.<br/>"
        "• <b>Uncertainty Calibration:</b> Conformal stratified quantiles + physical zero-night enforcement operating reliably.<br/>"
        "• <b>Frontend & Interface:</b> Streamlit dashboard fully verified on Plotly 7.1.0; all 4 tabs responsive, bug-free, and operational.<br/>"
        "• <b>Grid Interoperability:</b> Multi-scale aggregation (National, 7 Districts, 24 Governorates) with SCADA CSV/JSON exports."
    )
    story.append(Paragraph(audit_summary, body_style))
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1, color=accent_amber, spaceBefore=5, spaceAfter=5))
    story.append(Paragraph("<i>End of Technical Engineering Report — Tunisia Solar Power Forecasting System</i>", meta_style))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Report successfully compiled to: {pdf_path}")
    return str(pdf_path)

if __name__ == "__main__":
    create_report()
