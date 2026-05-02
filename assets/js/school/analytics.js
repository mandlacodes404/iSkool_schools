// ══════════════════════════════════════════════════════════
// ANALYTICS — iSkool School Admin  |  Desktop Control Center
// ══════════════════════════════════════════════════════════

window._sdAnalyticsCache  = null;
window._sdAnalyticsCharts = [];

// ── STYLES ──────────────────────────────────────────────
(function injectAnalyticsStyles() {
    if (document.getElementById('sd-analytics-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-analytics-styles';
    s.textContent = `
        .sda-shell { padding: 24px 28px 80px; max-width: 1600px; }

        /* ── Page header ── */
        .sda-header {
            display: flex; align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 24px; padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        .sda-title { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 3px; }
        .sda-sub   { font-size: 12px; color: var(--text-muted); font-weight: 400; }
        .sda-year-badge {
            font-size: 11px; font-weight: 500; font-family: var(--font-mono);
            padding: 3px 10px; border-radius: 20px;
            background: var(--teal-dim); border: 1px solid var(--teal-border); color: var(--teal);
        }

        /* ── KPI row (4 cards) ── */
        .sda-kpi-row {
            display: grid; grid-template-columns: repeat(4,1fr);
            gap: 12px; margin-bottom: 16px;
        }
        .sda-kpi {
            background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius-lg); padding: 16px;
            position: relative; overflow: hidden;
            transition: border-color 0.15s;
        }
        .sda-kpi:hover { border-color: var(--border-hover); }
        .sda-kpi::before {
            content:''; position:absolute; top:12px; bottom:12px;
            left:0; width:2px; border-radius:0 2px 2px 0;
        }
        .sda-kpi.c-teal::before   { background: var(--teal); }
        .sda-kpi.c-green::before  { background: var(--green); }
        .sda-kpi.c-orange::before { background: var(--orange); }
        .sda-kpi.c-red::before    { background: var(--red); }

        .sda-kpi-label {
            font-size: 11px; font-weight: 500; letter-spacing: 0.5px;
            text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;
        }
        .sda-kpi-val {
            font-size: 28px; font-weight: 500; line-height: 1;
            font-variant-numeric: tabular-nums; margin-bottom: 4px;
        }
        .sda-kpi.c-teal   .sda-kpi-val { color: var(--teal); }
        .sda-kpi.c-green  .sda-kpi-val { color: var(--green); }
        .sda-kpi.c-orange .sda-kpi-val { color: var(--orange); }
        .sda-kpi.c-red    .sda-kpi-val { color: var(--red); }
        .sda-kpi-sub { font-size: 11px; color: var(--text-dim); font-weight: 400; }

        /* ── Grid layouts ── */
        .sda-row { display: grid; gap: 12px; margin-bottom: 12px; }
        .sda-row.col-2   { grid-template-columns: 1fr 1fr; }
        .sda-row.col-3   { grid-template-columns: 1fr 1fr 1fr; }
        .sda-row.col-3-2 { grid-template-columns: 3fr 2fr; }
        .sda-row.col-2-1 { grid-template-columns: 2fr 1fr; }
        .sda-row.col-1   { grid-template-columns: 1fr; }

        /* ── Cards ── */
        .sda-card {
            background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius-lg); padding: 16px;
            transition: border-color 0.15s;
        }
        .sda-card:hover { border-color: var(--border-hover); }
        .sda-card-title {
            font-size: 11px; font-weight: 500; color: var(--text-muted);
            margin-bottom: 14px; display: flex; align-items: center;
            justify-content: space-between; gap: 6px;
            text-transform: uppercase; letter-spacing: 0.05em;
        }
        .sda-card-title-left { display: flex; align-items: center; gap: 6px; }
        .sda-card-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }

        .sda-chart-wrap { position:relative; }
        .sda-chart-wrap.h180 { height:180px; }
        .sda-chart-wrap.h220 { height:220px; }
        .sda-chart-wrap.h260 { height:260px; }
        .sda-no-data {
            display:flex; align-items:center; justify-content:center;
            font-size:12px; color:var(--text-dim); height:100%; font-weight:400;
        }

        /* ── Tables ── */
        .sda-table { width:100%; border-collapse:collapse; font-size:12px; }
        .sda-table thead th {
            padding: 7px 10px; text-align:left;
            font-size:10px; font-weight:500; color:var(--text-dim);
            text-transform:uppercase; letter-spacing:0.05em;
            border-bottom:1px solid var(--border); background:var(--surface);
        }
        .sda-table tbody tr { border-bottom:1px solid var(--border); transition:background 0.12s; }
        .sda-table tbody tr:last-child { border-bottom:none; }
        .sda-table tbody tr:hover { background:var(--surface2); }
        .sda-table td { padding:8px 10px; color:var(--text); font-weight:400; vertical-align:middle; }

        /* rank badges */
        .sda-rank { font-size:10px; font-weight:500; color:var(--text-dim); font-family:var(--font-mono); width:20px; }
        .sda-rank.gold   { color:var(--orange); }
        .sda-rank.silver { color:var(--text-muted); }
        .sda-rank.bronze { color:#b45309; }

        /* inline badges */
        .sda-badge {
            display:inline-block; padding:2px 8px; border-radius:20px;
            font-size:10px; font-weight:500; font-family:var(--font-mono);
        }
        .sda-badge.green  { background:var(--green-dim);  color:var(--green); }
        .sda-badge.orange { background:var(--orange-dim); color:var(--orange); }
        .sda-badge.red    { background:var(--red-dim);    color:var(--red); }
        .sda-badge.blue   { background:var(--blue-dim, rgba(88,166,255,0.1)); color:var(--blue); }
        .sda-badge.gray   { background:var(--surface2);   color:var(--text-muted); }

        /* trend arrow */
        .sda-trend { font-size:11px; font-weight:500; font-family:var(--font-mono); }
        .sda-trend.up   { color:var(--green); }
        .sda-trend.down { color:var(--red); }
        .sda-trend.flat { color:var(--text-dim); }

        /* ── Class health table specifics ── */
        .sda-health-bar-wrap { width:80px; height:4px; background:var(--surface2); border-radius:100px; overflow:hidden; display:inline-block; vertical-align:middle; }
        .sda-health-bar-fill { height:100%; border-radius:100px; }

        /* ── Gender bars ── */
        .sda-gender-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .sda-gender-label { font-size:11px; font-weight:500; width:44px; flex-shrink:0; }
        .sda-gender-label.male   { color:var(--blue); }
        .sda-gender-label.female { color:#e15759; }
        .sda-gender-bar-wrap { flex:1; height:5px; background:var(--surface2); border-radius:3px; overflow:hidden; }
        .sda-gender-bar { height:100%; border-radius:3px; transition:width 0.7s ease; }
        .sda-gender-bar.male   { background:var(--blue); }
        .sda-gender-bar.female { background:#e15759; }
        .sda-gender-val { font-size:11px; font-weight:500; width:38px; text-align:right; flex-shrink:0; font-family:var(--font-mono); }
        .sda-gender-val.male   { color:var(--blue); }
        .sda-gender-val.female { color:#e15759; }

        /* ── Risk score pill ── */
        .sda-risk-pill {
            display:inline-block; padding:2px 8px; border-radius:20px;
            font-size:10px; font-weight:500; font-family:var(--font-mono);
        }
        .sda-risk-pill.high   { background:rgba(248,81,73,0.12); color:var(--red); }
        .sda-risk-pill.medium { background:var(--orange-dim); color:var(--orange); }
        .sda-risk-pill.low    { background:var(--surface2); color:var(--text-muted); }

        /* ── Teacher status dots ── */
        .sda-status-dot { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:5px; }
        .sda-status-dot.full    { background:var(--green); }
        .sda-status-dot.partial { background:var(--orange); }
        .sda-status-dot.inactive{ background:var(--red); }

        /* ── Subject trend ── */
        .sda-subject-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
        .sda-subject-row:last-child { border-bottom:none; }
        .sda-subject-name { flex:1; font-size:12px; color:var(--text); font-weight:400; }
        .sda-subject-learners { font-size:11px; color:var(--text-dim); font-family:var(--font-mono); width:60px; text-align:right; }

        /* ── Difficulty card ── */
        .sda-diff-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
        .sda-diff-row:last-child { border-bottom:none; }
        .sda-diff-name { flex:1; font-size:12px; color:var(--text); font-weight:400; }
        .sda-diff-meta { font-size:10px; color:var(--text-dim); font-family:var(--font-mono); }
        .sda-diff-range { font-size:10px; color:var(--text-dim); font-family:var(--font-mono); white-space:nowrap; }

        /* ── Peak hours ── */
        .sda-peak-wrap { display:flex; align-items:flex-end; gap:3px; height:80px; }
        .sda-peak-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
        .sda-peak-bar { width:100%; border-radius:2px 2px 0 0; transition:height 0.5s ease; min-height:2px; }
        .sda-peak-label { font-size:8px; color:var(--text-dim); font-family:var(--font-mono); white-space:nowrap; }

        /* scrollable table body */
        .sda-scroll-body { max-height:280px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--border-hover) transparent; }
        .sda-scroll-body::-webkit-scrollbar { width:3px; }
        .sda-scroll-body::-webkit-scrollbar-thumb { background:var(--border-hover); border-radius:3px; }

        /* ── Drillable card ── */
        .sda-card.drillable { cursor:pointer; }
        .sda-card.drillable:hover { border-color:var(--teal); }
        .sda-drill-hint { font-size:10px; color:var(--text-dim); font-weight:400; text-transform:none; letter-spacing:0; opacity:0; transition:opacity 0.15s; }
        .sda-card.drillable:hover .sda-drill-hint { opacity:1; }

        /* ── Slide-in panel overlay ── */
        .sda-panel-overlay {
            position:fixed; inset:0; background:rgba(0,0,0,0.45);
            backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
            z-index:8000; opacity:0; pointer-events:none; transition:opacity 0.25s ease;
        }
        .sda-panel-overlay.open { opacity:1; pointer-events:all; }

        /* ── Slide-in panel ── */
        .sda-panel {
            position:fixed; top:0; right:0; bottom:0;
            width:62%; max-width:1000px;
            background:var(--bg); border-left:1px solid var(--border);
            z-index:8001; display:flex; flex-direction:column;
            transform:translateX(100%);
            transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);
            box-shadow:-20px 0 60px rgba(0,0,0,0.4);
        }
        .sda-panel.open { transform:translateX(0); }

        .sda-panel-header {
            display:flex; align-items:center; justify-content:space-between;
            padding:16px 24px; border-bottom:1px solid var(--border); flex-shrink:0;
        }
        .sda-panel-title { font-size:13px; font-weight:500; color:var(--text); margin-bottom:3px; }
        .sda-panel-sub   { font-size:11px; color:var(--text-muted); font-weight:400; }
        .sda-panel-close {
            width:28px; height:28px; border-radius:var(--radius);
            background:transparent; border:1px solid var(--border-hover);
            color:var(--text-muted); cursor:pointer; font-size:14px;
            display:flex; align-items:center; justify-content:center;
            transition:border-color 0.15s, color 0.15s; flex-shrink:0;
        }
        .sda-panel-close:hover { border-color:var(--red); color:var(--red); }

        .sda-panel-body {
            flex:1; overflow-y:auto; padding:24px;
            scrollbar-width:thin; scrollbar-color:var(--border-hover) transparent;
        }
        .sda-panel-body::-webkit-scrollbar { width:4px; }
        .sda-panel-body::-webkit-scrollbar-thumb { background:var(--border-hover); border-radius:4px; }
        .sda-panel-body .sda-scroll-body { max-height:none; overflow-y:visible; }
        .sda-panel-body .sda-table td,
        .sda-panel-body .sda-table th { padding:10px 12px; }
    `;
    document.head.appendChild(s);
})();

// ── CHART DEFAULTS ───────────────────────────────────────
const sdaTickColor = 'rgba(139,148,158,0.8)';
const sdaGridColor = 'rgba(255,255,255,0.04)';
const sdaTooltip   = {
    backgroundColor: '#1c2128', borderColor: '#30363d', borderWidth: 1,
    titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
};
const sdaChartDefaults = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: { legend: { display: false } },
};

// ── HELPERS ──────────────────────────────────────────────
function sdaAvgColor(avg) {
    if (avg === null) return 'gray';
    if (avg >= 60)   return 'green';
    if (avg >= 40)   return 'orange';
    return 'red';
}
function sdaHealthColor(score) {
    if (score >= 70) return 'var(--green)';
    if (score >= 40) return 'var(--orange)';
    return 'var(--red)';
}
function sdaRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}
function sdaTimeAgo(dt) {
    if (!dt) return '—';
    const diff = Math.floor((Date.now() - new Date(dt)) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
}
function sdaEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sdaDestroyCharts() {
    window._sdAnalyticsCharts.forEach(c => { try { c.destroy(); } catch(e){} });
    window._sdAnalyticsCharts = [];
}

// ══════════════════════════════════════════════════════════
// SLIDE-IN PANEL ENGINE
// ══════════════════════════════════════════════════════════
function sdaEnsurePanel() {
    if (document.getElementById('sda-panel')) return;
    const overlay = document.createElement('div');
    overlay.className = 'sda-panel-overlay';
    overlay.id = 'sda-panel-overlay';
    overlay.addEventListener('click', sdaClosePanel);

    const panel = document.createElement('div');
    panel.className = 'sda-panel';
    panel.id = 'sda-panel';
    panel.innerHTML = `
        <div class="sda-panel-header">
            <div>
                <div class="sda-panel-title" id="sda-panel-title">—</div>
                <div class="sda-panel-sub"  id="sda-panel-sub"></div>
            </div>
            <button class="sda-panel-close" id="sda-panel-close">✕</button>
        </div>
        <div class="sda-panel-body" id="sda-panel-body"></div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    document.getElementById('sda-panel-close').addEventListener('click', sdaClosePanel);

    // Close on Escape
    document.addEventListener('keydown', e => { if (e.key === 'Escape') sdaClosePanel(); });
}

function sdaOpenPanel(title, sub, html) {
    sdaEnsurePanel();
    document.getElementById('sda-panel-title').textContent = title;
    document.getElementById('sda-panel-sub').textContent   = sub || '';
    document.getElementById('sda-panel-body').innerHTML    = html;
    requestAnimationFrame(() => {
        document.getElementById('sda-panel-overlay').classList.add('open');
        document.getElementById('sda-panel').classList.add('open');
    });
}

function sdaClosePanel() {
    document.getElementById('sda-panel-overlay')?.classList.remove('open');
    document.getElementById('sda-panel')?.classList.remove('open');
}

// ══════════════════════════════════════════════════════════
// MAIN ENTRY
// ══════════════════════════════════════════════════════════
window.loadSdAnalytics = async function () {
    const content = document.getElementById('sd-content');
    sdaDestroyCharts();

    content.innerHTML = `
        <div class="sda-shell">
            <div class="sda-header">
                <div>
                    <div class="sda-title">Analytics</div>
                    <div class="sda-sub" id="sda-sub-text">Loading data…</div>
                </div>
                <div class="sda-year-badge" id="sda-year-badge">—</div>
            </div>

            <!-- KPI ROW -->
            <div class="sda-kpi-row" id="sda-kpi-row">
                ${[1,2,3,4].map(()=>`<div class="sda-kpi" style="height:88px;"><div class="sd-skeleton" style="height:100%;border-radius:var(--radius-lg);"></div></div>`).join('')}
            </div>

            <!-- ROW 1: Term trend + Gender -->
            <div class="sda-row col-3-2">
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--teal);"></span>School Average — Term Trend</div></div>
                    <div class="sda-chart-wrap h220"><canvas id="sda-trend-chart"></canvas><div class="sda-no-data" id="sda-trend-empty" style="display:none;">No summative data yet</div></div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--blue);"></span>Gender Performance</div></div>
                    <div id="sda-gender-content" style="margin-top:8px;"><div class="sda-no-data" style="height:120px;">Loading…</div></div>
                </div>
            </div>

            <!-- ROW 2: Top performers + Most improved -->
            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--orange);"></span>Top Performers</div></div>
                    <div id="sda-top-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--green);"></span>Most Improved</div></div>
                    <div id="sda-improved-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
            </div>

            <!-- ROW 3: Class Health Index (full width) -->
            <div class="sda-row col-1">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--purple);"></span>Class Health Index</div>
                        <span style="font-size:10px;color:var(--text-dim);font-weight:400;text-transform:none;">Score = avg (40%) + submission rate (30%) + teacher activity (20%) + has summative (10%)</span>
                    </div>
                    <div id="sda-health-content"><div class="sda-no-data" style="height:120px;">Loading…</div></div>
                </div>
            </div>

            <!-- ROW 4: At-Risk + Teacher Participation -->
            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--red);"></span>At-Risk Learners</div><span id="sda-risk-count" style="font-size:10px;color:var(--text-dim);font-weight:400;text-transform:none;"></span></div>
                    <div id="sda-risk-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--blue);"></span>Teacher Participation</div></div>
                    <div id="sda-teacher-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
            </div>

            <!-- ROW 5: Difficulty Index + Subject Performance -->
            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--red);"></span>Assessment Difficulty Index</div></div>
                    <div id="sda-diff-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--purple);"></span>Subject Performance</div></div>
                    <div id="sda-subject-content"><div class="sda-no-data" style="height:180px;">Loading…</div></div>
                </div>
            </div>

            <!-- ROW 6: Peak Activity Hours (full width) -->
            <div class="sda-row col-1">
                <div class="sda-card">
                    <div class="sda-card-title"><div class="sda-card-title-left"><span class="sda-card-dot" style="background:var(--teal);"></span>Peak Activity Hours — When Are Learners Most Active?</div></div>
                    <div class="sda-chart-wrap h180"><canvas id="sda-peak-chart"></canvas></div>
                </div>
            </div>
        </div>
    `;

    // Use cache or fetch
    let d = window._sdAnalyticsCache;
    if (!d) {
        try {
            const res = await fetch('api/school/get_analytics.php');
            d = await res.json();
            window._sdAnalyticsCache = d;
        } catch (e) {
            content.innerHTML = `<div style="padding:48px;text-align:center;color:var(--red);font-size:13px;">Failed to load analytics data.</div>`;
            return;
        }
    }

    // Update header
    document.getElementById('sda-year-badge').textContent = d.year_name || '—';
    document.getElementById('sda-sub-text').textContent = `${d.total_learners} learners · ${d.total_teachers} teachers · ${d.total_classes} classes`;

    // ── KPIs ──
    const kpis = [
        { label: 'School Average',     val: d.school_overall_avg !== null ? d.school_overall_avg + '%' : '—', sub: 'Summative assessments', color: 'c-teal' },
        { label: 'Pass Rate',          val: d.pass_rate !== null ? d.pass_rate + '%' : '—',          sub: 'Learners scoring ≥ 50%',  color: 'c-green' },
        { label: 'Assessed Learners',  val: d.assessed_learners,  sub: 'With ≥1 summative result',   color: 'c-orange' },
        { label: 'At-Risk Learners',   val: d.at_risk_count,      sub: 'Low marks + low activity',   color: 'c-red' },
    ];
    document.getElementById('sda-kpi-row').innerHTML = kpis.map(k => `
        <div class="sda-kpi ${k.color}">
            <div class="sda-kpi-label">${k.label}</div>
            <div class="sda-kpi-val">${k.val}</div>
            <div class="sda-kpi-sub">${k.sub}</div>
        </div>
    `).join('');

    // ── Chart: Term trend ──
    const termCtx = document.getElementById('sda-trend-chart')?.getContext('2d');
    if (termCtx && d.term_averages?.length) {
        const chart = new Chart(termCtx, {
            type: 'line',
            data: {
                labels: d.term_averages.map(t => 'Term ' + t.term),
                datasets: [{
                    data: d.term_averages.map(t => t.avg),
                    borderColor: 'var(--teal)',
                    backgroundColor: 'rgba(31,190,169,0.08)',
                    borderWidth: 2,
                    pointRadius: 5, pointHoverRadius: 7,
                    pointBackgroundColor: 'var(--teal)',
                    pointBorderColor: '#0d1117',
                    pointBorderWidth: 2,
                    tension: 0.35, fill: true,
                }]
            },
            options: {
                ...sdaChartDefaults,
                plugins: {
                    ...sdaChartDefaults.plugins,
                    tooltip: {
                        ...sdaTooltip,
                        callbacks: {
                            label: ctx => ` School avg: ${ctx.parsed.y}%`,
                            afterLabel: ctx => {
                                const t = d.term_averages[ctx.dataIndex];
                                return t ? ` ${t.learners} learners · ${t.submissions} submissions` : '';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero:true, max:100, ticks:{color:sdaTickColor,callback:v=>v+'%',stepSize:25,font:{size:11}}, grid:{color:sdaGridColor}, border:{color:sdaGridColor} },
                    x: { ticks:{color:sdaTickColor,font:{size:11}}, grid:{display:false} }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    } else if (!d.term_averages?.length) {
        document.getElementById('sda-trend-empty').style.display = 'flex';
        if (termCtx) termCtx.canvas.style.display = 'none';
    }

    // ── Gender breakdown ──
    const male   = d.gender_breakdown?.male;
    const female = d.gender_breakdown?.female;
    const maleAvg   = male?.overall;
    const femaleAvg = female?.overall;
    const maxAvg    = Math.max(maleAvg || 0, femaleAvg || 0, 1);

    document.getElementById('sda-gender-content').innerHTML = (maleAvg !== null || femaleAvg !== null) ? `
        <div style="margin-bottom:20px;">
            <div class="sda-gender-row">
                <span class="sda-gender-label male">Boys</span>
                <div class="sda-gender-bar-wrap"><div class="sda-gender-bar male" style="width:${Math.round((maleAvg||0)/maxAvg*100)}%"></div></div>
                <span class="sda-gender-val male">${maleAvg !== null ? maleAvg+'%' : '—'}</span>
            </div>
            <div class="sda-gender-row">
                <span class="sda-gender-label female">Girls</span>
                <div class="sda-gender-bar-wrap"><div class="sda-gender-bar female" style="width:${Math.round((femaleAvg||0)/maxAvg*100)}%"></div></div>
                <span class="sda-gender-val female">${femaleAvg !== null ? femaleAvg+'%' : '—'}</span>
            </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;">
            ${[1,2,3,4].map(t => {
                const mT = male?.terms?.[t]?.avg;
                const fT = female?.terms?.[t]?.avg;
                if (mT === undefined && fT === undefined) return '';
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono);width:46px;">Term ${t}</span>
                    <span style="font-size:11px;color:var(--blue);font-family:var(--font-mono);width:36px;">${mT !== undefined ? mT+'%' : '—'}</span>
                    <span style="font-size:11px;color:#e15759;font-family:var(--font-mono);width:36px;">${fT !== undefined ? fT+'%' : '—'}</span>
                </div>`;
            }).join('')}
        </div>
    ` : `<div class="sda-no-data" style="height:120px;">No gender data yet</div>`;

    // ── Top performers ──
    document.getElementById('sda-top-content').innerHTML = d.top_performers?.length ? `
        <div class="sda-scroll-body">
        <table class="sda-table">
            <thead><tr><th>#</th><th>Learner</th><th>Class</th><th>Avg</th><th>Tests</th></tr></thead>
            <tbody>
            ${d.top_performers.map((l,i) => {
                const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
                const col = sdaAvgColor(l.avg);
                return `<tr>
                    <td><span class="sda-rank ${rankClass}">${i+1}</span></td>
                    <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${sdaEsc(l.classes)}</td>
                    <td><span class="sda-badge ${col}">${l.avg}%</span></td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${l.submissions}</td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
        </div>
    ` : `<div class="sda-no-data" style="height:180px;">No assessment data yet</div>`;

    // ── Most improved ──
    document.getElementById('sda-improved-content').innerHTML = d.most_improved?.length ? `
        <div class="sda-scroll-body">
        <table class="sda-table">
            <thead><tr><th>#</th><th>Learner</th><th>From</th><th>To</th><th>Jump</th></tr></thead>
            <tbody>
            ${d.most_improved.map((l,i) => `<tr>
                <td><span class="sda-rank">${i+1}</span></td>
                <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">T${l.from_term} ${l.from_avg}%</td>
                <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">T${l.to_term} ${l.to_avg}%</td>
                <td><span class="sda-trend up">+${l.jump}%</span></td>
            </tr>`).join('')}
            </tbody>
        </table>
        </div>
    ` : `<div class="sda-no-data" style="height:180px;">Need data across 2+ terms</div>`;

    // ── Class Health Index ──
    document.getElementById('sda-health-content').innerHTML = d.class_health?.length ? `
        <div class="sda-scroll-body">
        <table class="sda-table">
            <thead><tr>
                <th>#</th><th>Class</th><th>Enrolled</th>
                <th>Overall Avg</th><th>Submission Rate</th>
                <th>Teacher Activity</th><th>Summatives</th>
                <th>Health Score</th>
            </tr></thead>
            <tbody>
            ${d.class_health.map((cls,i) => {
                const col = sdaAvgColor(cls.overall_avg);
                const hColor = sdaHealthColor(cls.health_score);
                return `<tr>
                    <td><span class="sda-rank">${i+1}</span></td>
                    <td style="font-weight:400;color:var(--text);">${sdaEsc(cls.class_name)}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.enrolled}</td>
                    <td><span class="sda-badge ${col}">${cls.overall_avg !== null ? cls.overall_avg+'%' : '—'}</span></td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div class="sda-health-bar-wrap"><div class="sda-health-bar-fill" style="width:${cls.submission_rate}%;background:${cls.submission_rate>=60?'var(--green)':cls.submission_rate>=30?'var(--orange)':'var(--red)'};"></div></div>
                            <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${cls.submission_rate}%</span>
                        </div>
                    </td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.teacher_activity} items</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.summative_count}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div class="sda-health-bar-wrap" style="width:60px;"><div class="sda-health-bar-fill" style="width:${cls.health_score}%;background:${hColor};"></div></div>
                            <span style="font-size:11px;font-weight:500;color:${hColor};font-family:var(--font-mono);">${cls.health_score}</span>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
        </div>
    ` : `<div class="sda-no-data" style="height:120px;">No classes yet</div>`;

    // ── At-Risk Learners ──
    document.getElementById('sda-risk-count').textContent = `${d.at_risk_count} learner${d.at_risk_count !== 1 ? 's' : ''} flagged`;
    document.getElementById('sda-risk-content').innerHTML = d.at_risk_learners?.length ? `
        <div class="sda-scroll-body">
        <table class="sda-table">
            <thead><tr><th>Learner</th><th>Class</th><th>Avg</th><th>Tests</th><th>Last Active</th><th>Risk</th></tr></thead>
            <tbody>
            ${d.at_risk_learners.map(l => {
                const level = sdaRiskLevel(l.risk_score);
                return `<tr>
                    <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${sdaEsc(l.classes)}</td>
                    <td><span class="sda-badge red">${l.avg_pct}%</span></td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${l.submissions}</td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${sdaTimeAgo(l.last_submission)}</td>
                    <td><span class="sda-risk-pill ${level}">${l.risk_score}</span></td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
        </div>
    ` : `<div class="sda-no-data" style="height:180px;">No at-risk learners — great sign! ✓</div>`;

    // ── Teacher Participation ──
    const full    = d.teacher_participation?.filter(t=>t.status==='full').length    || 0;
    const partial = d.teacher_participation?.filter(t=>t.status==='partial').length || 0;
    const inactive= d.teacher_participation?.filter(t=>t.status==='inactive').length|| 0;
    document.getElementById('sda-teacher-content').innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            <div style="text-align:center;">
                <div style="font-size:20px;font-weight:500;color:var(--green);">${full}</div>
                <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;">Fully Active</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:20px;font-weight:500;color:var(--orange);">${partial}</div>
                <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;">Partial</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:20px;font-weight:500;color:var(--red);">${inactive}</div>
                <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;">Inactive</div>
            </div>
            <div style="text-align:center;margin-left:auto;">
                <div style="font-size:20px;font-weight:500;color:var(--teal);">${d.teacher_participation_rate}%</div>
                <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;">Full Rate</div>
            </div>
        </div>
        <div class="sda-scroll-body">
        <table class="sda-table">
            <thead><tr><th>Teacher</th><th>Quizzes</th><th>Assignments</th><th>Resources</th><th>Status</th></tr></thead>
            <tbody>
            ${(d.teacher_participation||[]).map(t=>`<tr>
                <td style="font-weight:400;color:var(--text);">${sdaEsc(t.name)}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.quizzes}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.assignments}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.resources}</td>
                <td><span class="sda-status-dot ${t.status}"></span><span style="font-size:11px;color:var(--text-muted);">${t.status==='full'?'Active':t.status==='partial'?'Partial':'Inactive'}</span></td>
            </tr>`).join('')}
            </tbody>
        </table>
        </div>
    `;

    // ── Assessment Difficulty Index ──
    document.getElementById('sda-diff-content').innerHTML = d.difficulty_index?.length ? `
        ${d.difficulty_index.map(q=>`
            <div class="sda-diff-row">
                <div style="flex:1;">
                    <div class="sda-diff-name">${sdaEsc(q.title)}</div>
                    <div class="sda-diff-meta">${sdaEsc(q.class)} · Term ${q.term} · ${q.submissions} submissions</div>
                </div>
                <div style="text-align:right;">
                    <span class="sda-badge red">${q.avg_pct}% avg</span>
                    <div class="sda-diff-range">Range: ${q.lowest}%–${q.highest}%</div>
                </div>
            </div>
        `).join('')}
    ` : `<div class="sda-no-data" style="height:180px;">No consistently difficult assessments — great!</div>`;

    // ── Subject Performance ──
    document.getElementById('sda-subject-content').innerHTML = d.subject_performance?.length ? `
        <div class="sda-scroll-body">
        ${d.subject_performance.map(s => {
            const col   = sdaAvgColor(s.avg);
            const trend = s.trend === null ? '' : s.trend > 0
                ? `<span class="sda-trend up">↑+${s.trend}%</span>`
                : s.trend < 0
                ? `<span class="sda-trend down">↓${s.trend}%</span>`
                : `<span class="sda-trend flat">→</span>`;
            return `<div class="sda-subject-row">
                <span class="sda-subject-name">${sdaEsc(s.subject)}</span>
                <span class="sda-subject-learners">${s.learners} learners</span>
                ${trend}
                <span class="sda-badge ${col}">${s.avg !== null ? s.avg+'%' : '—'}</span>
            </div>`;
        }).join('')}
        </div>
    ` : `<div class="sda-no-data" style="height:180px;">No subject data — assign subjects in teacher settings</div>`;

    // ── Peak Activity Hours chart ──
    const peakCtx = document.getElementById('sda-peak-chart')?.getContext('2d');
    if (peakCtx && d.peak_hours?.length) {
        const maxCount = Math.max(...d.peak_hours.map(h=>h.count), 1);
        const chart = new Chart(peakCtx, {
            type: 'bar',
            data: {
                labels: d.peak_hours.map(h => h.label),
                datasets: [{
                    data: d.peak_hours.map(h => h.count),
                    backgroundColor: d.peak_hours.map(h => {
                        const intensity = h.count / maxCount;
                        return `rgba(31,190,169,${0.15 + intensity * 0.75})`;
                    }),
                    borderColor: 'transparent',
                    borderRadius: 3, borderSkipped: false,
                }]
            },
            options: {
                ...sdaChartDefaults,
                plugins: {
                    ...sdaChartDefaults.plugins,
                    tooltip: {
                        ...sdaTooltip,
                        callbacks: { label: ctx => ` ${ctx.parsed.y} submission${ctx.parsed.y !== 1 ? 's' : ''}` }
                    }
                },
                scales: {
                    y: { beginAtZero:true, ticks:{color:sdaTickColor,font:{size:10},stepSize:Math.ceil(maxCount/4)}, grid:{color:sdaGridColor}, border:{color:sdaGridColor} },
                    x: { ticks:{color:sdaTickColor,font:{size:10},maxRotation:0}, grid:{display:false} }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }

    // ══════════════════════════════════════════════════════
    // DRILL-DOWN — add drillable class + click handlers
    // ══════════════════════════════════════════════════════

    // 1. At-Risk Learners
    _sdaDrillable('sda-risk-content', 'At-Risk Learners', `${d.at_risk_count} learners flagged — low marks + low activity`, () => `
        <table class="sda-table">
            <thead><tr><th>Learner</th><th>Class</th><th>Avg</th><th>Tests</th><th>Last Active</th><th>Risk Score</th></tr></thead>
            <tbody>
            ${d.at_risk_learners.map(l => {
                const level = sdaRiskLevel(l.risk_score);
                return `<tr>
                    <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${sdaEsc(l.classes)}</td>
                    <td><span class="sda-badge red">${l.avg_pct}%</span></td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${l.submissions}</td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${sdaTimeAgo(l.last_submission)}</td>
                    <td><span class="sda-risk-pill ${level}">${l.risk_score}</span></td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    `);

    // 2. Class Health Index
    _sdaDrillable('sda-health-content', 'Class Health Index', `${d.class_health.length} classes · scored out of 100`, () => `
        <table class="sda-table">
            <thead><tr><th>#</th><th>Class</th><th>Enrolled</th><th>Avg</th><th>T1</th><th>T2</th><th>T3</th><th>T4</th><th>Sub Rate</th><th>Activity</th><th>Summatives</th><th>Health</th></tr></thead>
            <tbody>
            ${d.class_health.map((cls,i) => {
                const col = sdaAvgColor(cls.overall_avg);
                const hColor = sdaHealthColor(cls.health_score);
                return `<tr>
                    <td><span class="sda-rank">${i+1}</span></td>
                    <td style="font-weight:400;color:var(--text);white-space:nowrap;">${sdaEsc(cls.class_name)}</td>
                    <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">${cls.enrolled}</td>
                    <td><span class="sda-badge ${col}">${cls.overall_avg !== null ? cls.overall_avg+'%' : '—'}</span></td>
                    ${[1,2,3,4].map(t => `<td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${cls.terms[t] !== null && cls.terms[t] !== undefined ? cls.terms[t]+'%' : '—'}</td>`).join('')}
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.submission_rate}%</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.teacher_activity}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${cls.summative_count}</td>
                    <td><span style="font-size:12px;font-weight:500;color:${hColor};font-family:var(--font-mono);">${cls.health_score}</span></td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    `);

    // 3. Top Performers
    _sdaDrillable('sda-top-content', 'Top Performers', `Top ${d.top_performers.length} learners by summative average`, () => `
        <table class="sda-table">
            <thead><tr><th>#</th><th>Learner</th><th>Class</th><th>Gender</th><th>Avg</th><th>Tests Taken</th></tr></thead>
            <tbody>
            ${d.top_performers.map((l,i) => {
                const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
                return `<tr>
                    <td><span class="sda-rank ${rankClass}">${i+1}</span></td>
                    <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${sdaEsc(l.classes)}</td>
                    <td style="font-size:11px;color:var(--text-muted);">${l.gender || '—'}</td>
                    <td><span class="sda-badge ${sdaAvgColor(l.avg)}">${l.avg}%</span></td>
                    <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${l.submissions}</td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    `);

    // 4. Most Improved
    _sdaDrillable('sda-improved-content', 'Most Improved Learners', 'Biggest positive jump between consecutive terms', () => `
        <table class="sda-table">
            <thead><tr><th>#</th><th>Learner</th><th>From</th><th>To</th><th>Jump</th></tr></thead>
            <tbody>
            ${d.most_improved.map((l,i) => `<tr>
                <td><span class="sda-rank">${i+1}</span></td>
                <td style="font-weight:400;color:var(--text);">${sdaEsc(l.name)}</td>
                <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">Term ${l.from_term} · ${l.from_avg}%</td>
                <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">Term ${l.to_term} · ${l.to_avg}%</td>
                <td><span class="sda-trend up">+${l.jump}%</span></td>
            </tr>`).join('')}
            </tbody>
        </table>
    `);

    // 5. Teacher Participation
    _sdaDrillable('sda-teacher-content', 'Teacher Participation', `${d.teacher_participation_rate}% fully active this year`, () => `
        <table class="sda-table">
            <thead><tr><th>Teacher</th><th>Quizzes</th><th>Assignments</th><th>Resources</th><th>Announcements</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
            ${(d.teacher_participation||[]).map(t=>`<tr>
                <td style="font-weight:400;color:var(--text);">${sdaEsc(t.name)}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.quizzes}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.assignments}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.resources}</td>
                <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${t.announcements}</td>
                <td style="font-size:11px;font-weight:500;color:var(--text);font-family:var(--font-mono);">${t.total}</td>
                <td><span class="sda-status-dot ${t.status}"></span><span style="font-size:11px;color:var(--text-muted);">${t.status==='full'?'Fully Active':t.status==='partial'?'Partial':'Inactive'}</span></td>
            </tr>`).join('')}
            </tbody>
        </table>
    `);
};

// ── Helper: make a card's parent drillable ──
function _sdaDrillable(contentId, title, sub, htmlFn) {
    const el   = document.getElementById(contentId);
    if (!el) return;
    const card = el.closest('.sda-card');
    if (!card) return;
    card.classList.add('drillable');

    // Add hint to card title
    const titleEl = card.querySelector('.sda-card-title');
    if (titleEl && !titleEl.querySelector('.sda-drill-hint')) {
        const hint = document.createElement('span');
        hint.className = 'sda-drill-hint';
        hint.textContent = 'Click to expand →';
        titleEl.appendChild(hint);
    }

    card.addEventListener('click', () => sdaOpenPanel(title, sub, htmlFn()));
}