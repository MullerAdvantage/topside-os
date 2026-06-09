import os
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import anthropic

st.set_page_config(
    page_title="Marketing Health Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
[data-testid="metric-container"] { background:#1e1e2e; border-radius:10px; padding:12px; }
.score-ring { font-size:80px; font-weight:900; line-height:1; }
</style>
""", unsafe_allow_html=True)


# ── Column auto-detection ────────────────────────────────────────────────────

COLUMN_ALIASES = {
    "date":        ["date", "period", "month", "week", "day"],
    "channel":     ["channel", "platform", "source", "medium", "network"],
    "campaign":    ["campaign", "campaign name", "ad set", "ad group"],
    "spend":       ["spend", "cost", "budget", "amount spent", "ad spend"],
    "impressions": ["impressions", "views", "reach"],
    "clicks":      ["clicks", "sessions", "visits", "link clicks"],
    "conversions": ["conversions", "leads", "sales", "purchases", "orders"],
    "revenue":     ["revenue", "value", "sales value", "return", "income"],
    "region":      ["region", "location", "country", "state", "city", "geo"],
    "audience":    ["audience", "segment", "demographic", "age group", "target"],
}


def detect_columns(df: pd.DataFrame) -> dict[str, str]:
    lower_map = {c.lower().strip(): c for c in df.columns}
    result = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_map:
                result[canonical] = lower_map[alias]
                break
    return result


# ── KPI calculation ──────────────────────────────────────────────────────────

def compute_kpis(df: pd.DataFrame, col: dict) -> dict:
    kpis = {}

    def _sum(name):
        c = col.get(name)
        return df[c].sum() if c and c in df.columns else None

    spend = _sum("spend")
    rev   = _sum("revenue")
    conv  = _sum("conversions")
    clicks = _sum("clicks")
    imps  = _sum("impressions")

    if spend  is not None: kpis["total_spend"]       = spend
    if rev    is not None: kpis["total_revenue"]      = rev
    if conv   is not None: kpis["total_conversions"]  = conv
    if clicks is not None: kpis["total_clicks"]       = clicks
    if imps   is not None: kpis["total_impressions"]  = imps

    if spend and rev and spend > 0:
        kpis["roas"]    = rev / spend
        kpis["roi_pct"] = (rev - spend) / spend * 100
    if spend and conv and conv > 0:
        kpis["cpa"] = spend / conv
    if clicks and imps and imps > 0:
        kpis["ctr"] = clicks / imps * 100
    if conv and clicks and clicks > 0:
        kpis["cvr"] = conv / clicks * 100

    return kpis


def efficiency_score(kpis: dict) -> float:
    """Weighted 0–100 score across ROAS, CTR, CVR, and ROI."""
    components = []

    if "roas" in kpis:
        # ROAS: 1 = break-even, ≥4 = excellent
        components.append((min(kpis["roas"] / 4 * 100, 100), 40))
    if "cvr" in kpis:
        # CVR: industry avg ~3 %, ≥8 % = excellent
        components.append((min(kpis["cvr"] / 8 * 100, 100), 30))
    if "ctr" in kpis:
        # CTR: industry avg ~2 %, ≥5 % = excellent
        components.append((min(kpis["ctr"] / 5 * 100, 100), 20))
    if "roi_pct" in kpis:
        # ROI: 0 % = break-even; ≥200 % = excellent
        components.append((min(max(kpis["roi_pct"] / 200 * 100, 0), 100), 10))

    if not components:
        return 50.0

    total_weight = sum(w for _, w in components)
    score = sum(s * w for s, w in components) / total_weight
    return round(score, 1)


def score_label(score: float) -> tuple[str, str]:
    if score >= 75: return "Excellent",          "#00d4aa"
    if score >= 50: return "Good",               "#4fc3f7"
    if score >= 25: return "Needs Improvement",  "#ffa726"
    return           "Critical",                 "#ef5350"


# ── Channel table ────────────────────────────────────────────────────────────

def channel_summary(df: pd.DataFrame, col: dict) -> pd.DataFrame | None:
    ch = col.get("channel")
    if not ch or ch not in df.columns:
        return None

    agg = {}
    rename = {}
    for key, label in [("spend", "Spend"), ("revenue", "Revenue"), ("conversions", "Conversions"),
                       ("clicks", "Clicks"), ("impressions", "Impressions")]:
        c = col.get(key)
        if c and c in df.columns:
            agg[c] = "sum"
            rename[c] = label

    if not agg:
        return None

    result = df.groupby(ch).agg(agg).reset_index().rename(columns=rename)

    if "Revenue" in result.columns and "Spend" in result.columns:
        result["ROAS"] = (result["Revenue"] / result["Spend"].replace(0, np.nan)).round(2)
    if "Spend" in result.columns and "Conversions" in result.columns:
        result["CPA"]  = (result["Spend"] / result["Conversions"].replace(0, np.nan)).round(2)
    if "Clicks" in result.columns and "Impressions" in result.columns:
        result["CTR%"] = (result["Clicks"] / result["Impressions"].replace(0, np.nan) * 100).round(2)

    sort_by = next((c for c in ["ROAS", "Revenue", "Conversions"] if c in result.columns), None)
    if sort_by:
        result = result.sort_values(sort_by, ascending=False).reset_index(drop=True)
        result.index += 1
        result.index.name = "Rank"

    return result


# ── Claude 5W analysis ───────────────────────────────────────────────────────

# Static system prompt: 1 024+ tokens so Haiku's cache breakpoint qualifies.
# Benchmarks + methodology + format rules are all genuinely useful context.
_ANALYST_SYSTEM_PROMPT = """\
You are a senior marketing analyst specializing in digital performance assessment. \
You evaluate marketing health across paid and organic channels and prescribe improvements.

## KPI Benchmarks by Channel

**Paid Search (Google Ads / Bing)**
- CTR: <2% poor | 3–5% average | >5% excellent
- CVR (click → conversion): <2% poor | 3–7% average | >8% excellent
- CPA: benchmark at ≤30% of average order value
- ROAS: <2× poor | 3–4× healthy | >5× excellent

**Paid Social (Facebook / Instagram / LinkedIn / TikTok)**
- CTR: <0.5% poor | 0.9–1.5% average | >2% excellent
- CVR: <1% poor | 2–4% average | >5% excellent
- ROAS: <1.5× poor | 2–3× average | >4× excellent
- Frequency >5 signals audience fatigue

**Email Marketing**
- Open rate: <15% poor | 20–35% average | >40% excellent
- CTR: <1% poor | 2–5% average | >6% excellent
- ROAS: 35–45× is average (email has the highest ROI of all channels)
- Unsubscribe rate >0.5% indicates list quality or frequency issues

**Display / Programmatic**
- CTR: <0.1% poor | 0.1–0.3% average | >0.5% excellent
- Brand recall and view-through matter more than CTR here

**SEO / Organic**
- MoM traffic change: <0% declining | 2–5% growing | >8% strong
- Organic CVR: <1% poor | 2–4% average | >5% excellent

**Overall Portfolio Benchmarks**
- Blended ROAS: <1.5× = unprofitable | 2–3.5× = healthy | >5× = exceptional
- Blended CPA: should not exceed 30% of customer lifetime value
- Marketing spend as % of revenue: 5–15% B2C | 2–8% B2B
- No single channel should exceed 60% of spend without strategic justification

## Diagnostic Framework

Apply this sequence when reading the data:
1. Budget efficiency — is the highest-spend channel also the highest-ROAS channel?
2. Funnel leakage — where does the funnel break: impressions → clicks, or clicks → conversions?
3. Geographic concentration — is spend and performance consistent across regions?
4. Audience saturation — are CPM or CPA rising over time? Rising metrics indicate exhaustion.
5. Channel mix risk — over-reliance on one source creates fragility.
6. Under-funded winners — identify channels with high ROAS but low spend.

## Red Flags (always call out if present)
- ROAS < 1.0 (campaign is losing money)
- Highest-spend channel has below-average ROAS
- CTR declining month-over-month (creative fatigue)
- CPA rising month-over-month (saturation or competition)
- Revenue growing slower than spend (efficiency eroding)

## Positive Signals (highlight when present)
- Any channel with ROAS > 4×
- CVR > 5% (strong offer or landing page)
- Email ROAS > 40×
- Under-funded channel outperforming well-funded peers

## Efficiency Score Key
The dashboard scores 0–100:
- 40% weight: ROAS (4.0× = full marks)
- 30% weight: CVR (8%+ = full marks)
- 20% weight: CTR (5%+ = full marks)
- 10% weight: ROI % (200%+ = full marks)
Scores: 75–100 Excellent | 50–74 Good | 25–49 Needs Improvement | 0–24 Critical

## Required Output Format

Use these exact headings. Max 4 sentences per section. Cite specific numbers. \
Compare against the benchmarks above. Never use "consider" — be direct and prescriptive.

**WHO** — Audience targeting: who is reached, segments, concentration.
**WHAT** — Channel and campaign breakdown: budget allocation, what is working.
**WHERE** — Geographic and platform distribution: where activity is concentrated or absent.
**WHEN** — Temporal patterns: timing, peaks, trends, seasonality.
**WHY** — Root causes: why performance is at this level.
**OVERALL HEALTH RANKING**
• Top Strength: [one sentence — name the specific channel/metric]
• Top Weakness: [one sentence — name the specific problem]
• #1 Recommendation: [one sentence — name the channel and the exact action]
"""

_claude = anthropic.Anthropic()


def five_w_analysis(df: pd.DataFrame, col: dict, kpis: dict, company: str) -> str:
    ch_df = channel_summary(df, col)

    kpi_text = "\n".join(
        f"  {k}: {v:.2f}" if isinstance(v, float) else f"  {k}: {v:,}"
        for k, v in kpis.items()
    )
    ch_text = ch_df.to_string() if ch_df is not None else "No channel data."

    # Sample: mapped columns only to avoid shipping irrelevant data
    mapped_cols = [c for c in col.values() if c in df.columns]
    sample = df[mapped_cols].head(8).to_string(index=False) if mapped_cols else df.head(8).to_string(index=False)

    prompt = (
        f"Company: {company or 'unknown'}\n"
        f"Rows: {len(df)} | Mapped fields: {col}\n\n"
        f"KPIs:\n{kpi_text}\n\n"
        f"Channel breakdown:\n{ch_text}\n\n"
        f"Data sample (8 rows, mapped columns only):\n{sample}"
    )

    response = _claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=700,
        system=[{"type": "text", "text": _ANALYST_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


# ── App ──────────────────────────────────────────────────────────────────────

def main():
    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")
        company = st.text_input("Company Name", placeholder="Acme Corp")
        st.divider()
        st.markdown("**Supported file types:** CSV, Excel")
        st.markdown("""**Recognized column names** (any match works):
- `date` / `period` / `month`
- `channel` / `platform` / `source`
- `spend` / `cost` / `budget`
- `revenue` / `value` / `return`
- `conversions` / `leads` / `sales`
- `clicks` / `sessions`
- `impressions` / `reach`
- `region` / `country` / `geo`
- `audience` / `segment`
""")

    st.title("📊 Marketing Health Dashboard")
    st.caption("Upload your marketing data to get KPIs, channel rankings, trend analysis, and a full 5W AI breakdown.")

    uploaded = st.file_uploader("Upload marketing data", type=["csv", "xlsx", "xls"])

    if uploaded is None:
        st.info("No file uploaded yet. Here's the expected format:")
        st.dataframe(pd.DataFrame({
            "Date":        ["2024-01", "2024-01", "2024-02", "2024-02"],
            "Channel":     ["Google Ads", "Facebook", "Google Ads", "Email"],
            "Region":      ["Northeast", "West", "Midwest", "National"],
            "Spend":       [5200, 3100, 4800, 800],
            "Impressions": [120000, 95000, 115000, 42000],
            "Clicks":      [3600, 1900, 3400, 2100],
            "Conversions": [180, 95, 170, 105],
            "Revenue":     [27000, 14250, 25500, 15750],
        }), use_container_width=True)
        return

    # Load
    try:
        df = pd.read_csv(uploaded) if uploaded.name.endswith(".csv") else pd.read_excel(uploaded)
    except Exception as e:
        st.error(f"Could not read file: {e}")
        return

    if df.empty:
        st.error("The file appears to be empty.")
        return

    col   = detect_columns(df)
    kpis  = compute_kpis(df, col)
    score = efficiency_score(kpis)
    label, color = score_label(score)

    # ── KPI strip ────────────────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("Key Performance Indicators")

    kpi_display = [
        ("Total Spend",       kpis.get("total_spend"),      "${:,.0f}"),
        ("Total Revenue",     kpis.get("total_revenue"),    "${:,.0f}"),
        ("ROAS",              kpis.get("roas"),              "{:.2f}×"),
        ("ROI",               kpis.get("roi_pct"),           "{:+.1f}%"),
        ("Conversions",       kpis.get("total_conversions"), "{:,.0f}"),
        ("CPA",               kpis.get("cpa"),               "${:.2f}"),
        ("CTR",               kpis.get("ctr"),               "{:.2f}%"),
        ("CVR",               kpis.get("cvr"),               "{:.2f}%"),
    ]
    available = [(n, v, f) for n, v, f in kpi_display if v is not None]
    cols = st.columns(min(len(available), 8))
    for c, (name, val, fmt) in zip(cols, available):
        c.metric(name, fmt.format(val))

    # ── Efficiency score ─────────────────────────────────────────────────────
    st.markdown("---")
    left, right = st.columns([1, 2])

    with left:
        st.subheader("Efficiency Score")
        st.markdown(
            f"<div class='score-ring' style='color:{color}'>{score}</div>"
            f"<div style='color:{color}; font-size:22px; font-weight:700'>{label}</div>"
            "<div style='color:#888; font-size:13px'>out of 100 · weighted ROAS / CVR / CTR / ROI</div>",
            unsafe_allow_html=True,
        )

    with right:
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=score,
            number={"suffix": " / 100", "font": {"size": 34}},
            gauge={
                "axis": {"range": [0, 100], "tickwidth": 1},
                "bar":  {"color": color, "thickness": 0.25},
                "bgcolor": "white",
                "steps": [
                    {"range": [0,  25], "color": "#ffebee"},
                    {"range": [25, 50], "color": "#fff8e1"},
                    {"range": [50, 75], "color": "#e8f5e9"},
                    {"range": [75, 100],"color": "#e0f7fa"},
                ],
            },
        ))
        fig.update_layout(height=260, margin=dict(t=20, b=0, l=20, r=20))
        st.plotly_chart(fig, use_container_width=True)

    # ── Channel rankings ─────────────────────────────────────────────────────
    ch_df = channel_summary(df, col)
    if ch_df is not None:
        st.markdown("---")
        st.subheader("WHAT — Channel Rankings")
        tab_tbl, tab_chart = st.tabs(["Table", "Chart"])

        with tab_tbl:
            st.dataframe(ch_df, use_container_width=True)

        with tab_chart:
            ch_col = col.get("channel")
            if "ROAS" in ch_df.columns:
                fig_ch = px.bar(
                    ch_df.reset_index().sort_values("ROAS"),
                    x="ROAS", y=ch_col, orientation="h",
                    color="ROAS", color_continuous_scale="Viridis",
                    title="ROAS by Channel",
                )
                st.plotly_chart(fig_ch, use_container_width=True)
            elif "Revenue" in ch_df.columns:
                fig_ch = px.bar(ch_df.reset_index(), x=ch_col, y="Revenue", title="Revenue by Channel")
                st.plotly_chart(fig_ch, use_container_width=True)

    # ── Trend ────────────────────────────────────────────────────────────────
    date_c  = col.get("date")
    spend_c = col.get("spend")
    rev_c   = col.get("revenue")

    if date_c and date_c in df.columns:
        try:
            df[date_c] = pd.to_datetime(df[date_c])
            trend_cols = [c for c in [spend_c, rev_c] if c and c in df.columns]
            if trend_cols:
                st.markdown("---")
                st.subheader("WHEN — Performance Over Time")
                trend = df.groupby(date_c)[trend_cols].sum().reset_index()
                fig_t = px.line(trend, x=date_c, y=trend_cols, markers=True,
                                title="Spend vs Revenue Over Time")
                st.plotly_chart(fig_t, use_container_width=True)
        except Exception:
            pass

    # ── Geographic breakdown ─────────────────────────────────────────────────
    region_c = col.get("region")
    if region_c and region_c in df.columns:
        st.markdown("---")
        st.subheader("WHERE — Geographic Distribution")
        geo_cols = [c for c in [spend_c, rev_c] if c and c in df.columns]
        if geo_cols:
            geo = df.groupby(region_c)[geo_cols].sum().reset_index()
            fig_g = px.bar(geo, x=region_c, y=geo_cols, barmode="group",
                           title="Spend & Revenue by Region")
            st.plotly_chart(fig_g, use_container_width=True)

    # ── Audience breakdown ───────────────────────────────────────────────────
    aud_c = col.get("audience")
    if aud_c and aud_c in df.columns:
        st.markdown("---")
        st.subheader("WHO — Audience Breakdown")
        aud_cols = [c for c in [spend_c, rev_c] if c and c in df.columns]
        if aud_cols:
            aud = df.groupby(aud_c)[aud_cols].sum().reset_index()
            fig_a = px.pie(aud, names=aud_c,
                           values=aud_cols[0],
                           title=f"Spend Distribution by Audience")
            st.plotly_chart(fig_a, use_container_width=True)

    # ── 5W AI analysis ───────────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("WHY — AI-Powered 5W Analysis")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        st.warning("Set the `ANTHROPIC_API_KEY` environment variable to enable AI analysis.")
    else:
        if st.button("Generate 5W Analysis", type="primary"):
            with st.spinner("Analyzing your marketing data with Claude..."):
                try:
                    analysis = five_w_analysis(df, col, kpis, company)
                    st.markdown(analysis)
                except Exception as e:
                    st.error(f"AI analysis failed: {e}")

    # ── Raw data ─────────────────────────────────────────────────────────────
    with st.expander("View / Download Raw Data"):
        st.dataframe(df, use_container_width=True)
        st.download_button(
            "Download CSV",
            data=df.to_csv(index=False),
            file_name="marketing_data.csv",
            mime="text/csv",
        )


if __name__ == "__main__":
    main()
