// ══════════════════════════════════════════════════════════
// ANALYTICS SECTION — assets/js/school/analytics.js
// ══════════════════════════════════════════════════════════

window._sdAnalyticsCache = null;
window._sdAnalyticsCharts = [];
window._sdAnalyticsTerm   = 0; // 0 = all terms

// ── INJECT STYLES ──
(function injectAnalyticsStyles() {
    if (document.getElementById('sd-analytics-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-analytics-styles';
    s.textContent = `

        .sda-shell { padding: 28px 28px 80px; max-width: 1400px; }

        /* Page header + term tabs */
        .sda-header {
            display: flex; align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 24px;
            flex-wrap: wrap; gap: 12px;
        }
        .sda-title { font-size: 22px; font-weight: 900; color: #e2e8f0; margin-bottom: 4px; }
        .sda-sub   { font-size: 13px; color: #8b949e; }

        .sda-term-tabs {
            display: flex; gap: 6px;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            padding: 4px;
        }
        .sda-term-tab {
            font-size: 12px; font-weight: 800;
            padding: 6px 14px;
            border-radius: 7px;
            border: none; background: none;
            color: #4a5568;
            cursor: pointer;
            font-family: 'Nunito', sans-serif;
            transition: all 0.18s;
            letter-spacing: 0.5px;
        }
        .sda-term-tab:hover { color: #8b949e; }
        .sda-term-tab.active {
            background: rgba(79,209,197,0.12);
            border: 1px solid rgba(79,209,197,0.3);
            color: #4fd1c5;
        }

        /* KPI row */
        .sda-kpi-row {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        .sda-kpi {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 16px;
            position: relative;
            overflow: hidden;
        }
        .sda-kpi::before {
            content: ''; position: absolute;
            top: 0; left: 0; right: 0; height: 2px;
        }
        .sda-kpi.c-teal::before   { background: #4fd1c5; }
        .sda-kpi.c-blue::before   { background: #4e79a7; }
        .sda-kpi.c-orange::before { background: #f59e0b; }
        .sda-kpi.c-green::before  { background: #22c55e; }
        .sda-kpi.c-purple::before { background: #a78bfa; }
        .sda-kpi.c-pink::before   { background: #e15759; }

        .sda-kpi-val {
            font-size: 26px; font-weight: 900;
            line-height: 1; margin-bottom: 6px;
        }
        .sda-kpi.c-teal   .sda-kpi-val { color: #4fd1c5; }
        .sda-kpi.c-blue   .sda-kpi-val { color: #4e79a7; }
        .sda-kpi.c-orange .sda-kpi-val { color: #f59e0b; }
        .sda-kpi.c-green  .sda-kpi-val { color: #22c55e; }
        .sda-kpi.c-purple .sda-kpi-val { color: #a78bfa; }
        .sda-kpi.c-pink   .sda-kpi-val { color: #e15759; }

        .sda-kpi-label {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1px; text-transform: uppercase;
            color: #4a5568;
        }

        /* Grid layouts */
        .sda-row { display: grid; gap: 16px; margin-bottom: 16px; }
        .sda-row.col-2   { grid-template-columns: 1fr 1fr; }
        .sda-row.col-3-2 { grid-template-columns: 3fr 2fr; }
        .sda-row.col-2-3 { grid-template-columns: 2fr 3fr; }
        .sda-row.col-1   { grid-template-columns: 1fr; }

        /* Chart cards */
        .sda-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 20px;
        }
        .sda-card-title {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #8b949e; margin-bottom: 16px;
            display: flex; align-items: center; gap: 8px;
        }
        .sda-card-dot {
            width: 6px; height: 6px;
            border-radius: 50%; background: #4fd1c5;
            flex-shrink: 0;
        }
        .sda-chart-wrap { position: relative; }
        .sda-chart-wrap.h200 { height: 200px; }
        .sda-chart-wrap.h240 { height: 240px; }
        .sda-chart-wrap.h280 { height: 280px; }
        .sda-no-data {
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; color: #2d3340; font-style: italic;
            height: 100%;
        }

        /* Gender comparison */
        .sda-gender-row {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: 14px;
        }
        .sda-gender-label {
            font-size: 12px; font-weight: 800;
            width: 52px; flex-shrink: 0;
        }
        .sda-gender-label.male   { color: #4e79a7; }
        .sda-gender-label.female { color: #e15759; }
        .sda-gender-bar-wrap {
            flex: 1; height: 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 5px; overflow: hidden;
        }
        .sda-gender-bar { height: 100%; border-radius: 5px; transition: width 0.7s ease; }
        .sda-gender-bar.male   { background: #4e79a7; }
        .sda-gender-bar.female { background: #e15759; }
        .sda-gender-val {
            font-size: 13px; font-weight: 800;
            width: 44px; text-align: right; flex-shrink: 0;
        }
        .sda-gender-val.male   { color: #4e79a7; }
        .sda-gender-val.female { color: #e15759; }
        .sda-gender-count {
            font-size: 11px; color: #4a5568;
            width: 70px; flex-shrink: 0;
        }

        /* Top learners table */
        .sda-top-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sda-top-table td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .sda-top-table tr:last-child td { border-bottom: none; }
        .sda-top-table tr:hover td { background: rgba(255,255,255,0.02); }

        .sda-rank { font-size: 11px; font-weight: 900; color: #2d3340; width: 24px; }
        .sda-rank.gold   { color: #f59e0b; }
        .sda-rank.silver { color: #8b949e; }
        .sda-rank.bronze { color: #b45309; }

        .sda-learner-name { font-weight: 800; color: #e2e8f0; }
        .sda-learner-class { font-size: 11px; color: #4a5568; margin-top: 2px; }

        .sda-gender-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
            display: inline-block; margin-right: 4px;
        }
        .sda-gender-dot.male   { background: #4e79a7; }
        .sda-gender-dot.female { background: #e15759; }

        .sda-avg-pill {
            font-size: 12px; font-weight: 800;
            padding: 3px 10px; border-radius: 20px;
        }
        .sda-avg-pill.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sda-avg-pill.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sda-avg-pill.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sda-avg-pill.gray   { background: rgba(255,255,255,0.06); color: #4a5568; }

        /* Most improved */
        .sda-improved-row {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .sda-improved-row:last-child { border-bottom: none; }
        .sda-improved-name { flex: 1; font-size: 13px; font-weight: 700; color: #c9d1d9; }
        .sda-improved-from { font-size: 11px; color: #4a5568; }
        .sda-improved-arrow { color: #22c55e; font-size: 14px; }
        .sda-improved-to { font-size: 13px; font-weight: 800; color: #e2e8f0; }
        .sda-improved-badge {
            font-size: 12px; font-weight: 900;
            padding: 3px 10px; border-radius: 20px;
            background: rgba(34,197,94,0.12); color: #22c55e;
            white-space: nowrap;
        }

        /* Completion bars */
        .sda-completion-row {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 10px;
        }
        .sda-completion-name {
            font-size: 12px; font-weight: 700; color: #8b949e;
            width: 60px; flex-shrink: 0;
        }
        .sda-completion-bar-wrap {
            flex: 1; height: 8px;
            background: rgba(255,255,255,0.05);
            border-radius: 4px; overflow: hidden;
        }
        .sda-completion-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .sda-completion-val {
            font-size: 11px; font-weight: 800;
            width: 44px; text-align: right; flex-shrink: 0; color: #8b949e;
        }
        .sda-completion-count { font-size: 10px; color: #2d3340; width: 60px; flex-shrink: 0; }

        /* No data state */
        .sda-no-improved {
            text-align: center; padding: 30px 20px;
            color: #2d3340; font-size: 13px; font-style: italic;
        }

        @media (max-width: 1100px) {
            .sda-kpi-row { grid-template-columns: repeat(3, 1fr); }
            .sda-row.col-3-2, .sda-row.col-2-3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
            .sda-kpi-row { grid-template-columns: repeat(2, 1fr); }
            .sda-row.col-2 { grid-template-columns: 1fr; }
            .sda-shell { padding: 16px 14px 80px; }
        }
    `;
    document.head.appendChild(s);
})();

// ── Helpers ──
function sdaAvgColor(v) {
    if (v === null || v === undefined) return 'gray';
    if (v >= 60) return 'green';
    if (v >= 40) return 'orange';
    return 'red';
}

function sdaCompletionColor(v) {
    if (v >= 75) return '#22c55e';
    if (v >= 50) return '#f59e0b';
    return '#f85149';
}

function sdaDestroyCharts() {
    window._sdAnalyticsCharts.forEach(c => { try { c.destroy(); } catch(e){} });
    window._sdAnalyticsCharts = [];
}

// ══════════════════════════════════════════════════════════
// LOAD ANALYTICS
// ══════════════════════════════════════════════════════════
window.loadSdAnalytics = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdAnalyticsCache) {
        renderAnalytics(window._sdAnalyticsCache, window._sdAnalyticsTerm);
        return;
    }

    // Skeleton
    content.innerHTML = `
        <div class="sda-shell">
            <div class="sda-header">
                <div>
                    <div class="sd-skeleton" style="height:22px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:13px;width:260px;"></div>
                </div>
                <div class="sd-skeleton" style="height:36px;width:240px;border-radius:10px;"></div>
            </div>
            <div class="sda-kpi-row">
                ${[1,2,3,4,5,6].map(() => `<div class="sd-skeleton" style="height:72px;border-radius:12px;"></div>`).join('')}
            </div>
            <div class="sda-row col-2" style="margin-bottom:16px;">
                <div class="sd-skeleton" style="height:260px;border-radius:14px;"></div>
                <div class="sd-skeleton" style="height:260px;border-radius:14px;"></div>
            </div>
            <div class="sda-row col-2">
                <div class="sd-skeleton" style="height:300px;border-radius:14px;"></div>
                <div class="sd-skeleton" style="height:300px;border-radius:14px;"></div>
            </div>
        </div>`;

    try {
        const res  = await fetch('api/school/get_analytics.php');
        const data = await res.json();
        window._sdAnalyticsCache = data;
        window._sdAnalyticsTerm  = 0;
        renderAnalytics(data, 0);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load analytics.</p>`;
    }
};

window.sdaSwitchTerm = function(term) {
    window._sdAnalyticsTerm = term;
    if (window._sdAnalyticsCache) renderAnalytics(window._sdAnalyticsCache, term);
};

// ══════════════════════════════════════════════════════════
// RENDER ANALYTICS
// ══════════════════════════════════════════════════════════
function renderAnalytics(d, activeTerm) {
    sdaDestroyCharts();
    const content = document.getElementById('sd-content');

    // ── Term tabs ──
    const termLabels = ['All Terms', 'Term 1', 'Term 2', 'Term 3', 'Term 4'];
    const termTabs = termLabels.map((label, i) => `
        <button class="sda-term-tab${activeTerm === i ? ' active' : ''}" onclick="sdaSwitchTerm(${i})">
            ${label}
        </button>`).join('');

    // ── Class data filtered by term ──
    // API returns: class_performance[].terms = {1:avg, 2:avg, ...}, overall
    const classData = (d.class_performance || []).map(cls => {
        const avg = activeTerm === 0
            ? cls.overall
            : (cls.terms ? cls.terms[activeTerm] : null);
        return { ...cls, display_avg: avg };
    }).sort((a, b) => (b.display_avg ?? -1) - (a.display_avg ?? -1));

    // ── Term trend data ──
    // API returns: term_averages[{term, avg, learners, submissions}]
    const termAvgs    = (d.term_averages || []).map(t => t.avg);
    const trendLabels = (d.term_averages || []).map(t => `Term ${t.term}`);

    // ── School avg for active term ──
    const displaySchoolAvg = activeTerm === 0
        ? d.school_overall_avg
        : (d.term_averages && d.term_averages[activeTerm - 1]?.avg) ?? null;

    const displayLearners = activeTerm === 0
        ? d.enrolled
        : (d.term_averages && d.term_averages[activeTerm - 1]?.learners) ?? 0;

    // ── Gender data for active term ──
    // API returns: gender_breakdown.male.terms = {1:avg,...}, overall
    const maleAvg   = activeTerm === 0
        ? d.gender_breakdown?.male?.overall
        : d.gender_breakdown?.male?.terms?.[activeTerm] ?? null;
    const femaleAvg = activeTerm === 0
        ? d.gender_breakdown?.female?.overall
        : d.gender_breakdown?.female?.terms?.[activeTerm] ?? null;
    const maleLearners   = 0; // not returned by this API
    const femaleLearners = 0;

    // ── Completion data ──
    // API returns: completion[{term, enrolled, submitted, rate}]
    const completionRows = (d.completion || []).map(c => {
        const col = sdaCompletionColor(c.rate);
        return `
            <div class="sda-completion-row">
                <div class="sda-completion-name">Term ${c.term}</div>
                <div class="sda-completion-bar-wrap">
                    <div class="sda-completion-bar" style="width:${c.rate}%;background:${col};"></div>
                </div>
                <div class="sda-completion-val">${c.rate}%</div>
                <div class="sda-completion-count">${c.submitted}/${c.enrolled}</div>
            </div>`;
    }).join('') || `<div class="sda-no-data" style="height:80px;">No data yet</div>`;

    // ── Top learners ──
    // API returns: top_performers[{name, email, gender, classes, avg, submissions}]
    const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const topRows = (d.top_performers || []).map((l, i) => {
        const col = sdaAvgColor(l.avg);
        return `
            <tr>
                <td><span class="sda-rank ${rankClass(i)}">${i + 1}</span></td>
                <td>
                    <div class="sda-learner-name">
                        <span class="sda-gender-dot ${l.gender || 'other'}"></span>
                        ${l.name}
                    </div>
                    <div class="sda-learner-class">${l.classes}</div>
                </td>
                <td><span class="sda-avg-pill ${col}">${l.avg}%</span></td>
                <td style="font-size:11px;color:#4a5568;">${l.submissions} quizzes</td>
            </tr>`;
    }).join('') || `<tr><td colspan="4" style="text-align:center;color:#2d3340;font-style:italic;padding:20px;">No data yet</td></tr>`;

    // ── Most improved ──
    // API returns: most_improved[{name, from_term, to_term, from_avg, to_avg, jump}]
    const improvedRows = (d.most_improved || []).length
        ? d.most_improved.map(l => `
            <div class="sda-improved-row">
                <div>
                    <div class="sda-improved-name">${l.name}</div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
                        <span class="sda-improved-from">T${l.from_term}: ${l.from_avg}%</span>
                        <span class="sda-improved-arrow">→</span>
                        <span class="sda-improved-to">T${l.to_term}: ${l.to_avg}%</span>
                    </div>
                </div>
                <span class="sda-improved-badge">+${l.jump}%</span>
            </div>`).join('')
        : `<div class="sda-no-improved">Need data in at least 2 terms to show improvement</div>`;

    // ── Render HTML ──
    content.innerHTML = `
        <div class="sda-shell">

            <!-- HEADER -->
            <div class="sda-header">
                <div>
                    <div class="sda-title">School Analytics</div>
                    <div class="sda-sub">${d.year_name} · Data from summative assessments</div>
                </div>
                <div class="sda-term-tabs">${termTabs}</div>
            </div>

            <!-- KPI ROW -->
            <div class="sda-kpi-row">
                <div class="sda-kpi c-teal">
                    <div class="sda-kpi-val">${displaySchoolAvg !== null ? displaySchoolAvg + '%' : '—'}</div>
                    <div class="sda-kpi-label">School Avg</div>
                </div>
                <div class="sda-kpi c-blue">
                    <div class="sda-kpi-val">${displayLearners}</div>
                    <div class="sda-kpi-label">Active Learners</div>
                </div>
                <div class="sda-kpi c-orange">
                    <div class="sda-kpi-val">${d.total_classes}</div>
                    <div class="sda-kpi-label">Classes</div>
                </div>
                <div class="sda-kpi c-green">
                    <div class="sda-kpi-val">${d.total_teachers}</div>
                    <div class="sda-kpi-label">Teachers</div>
                </div>
                <div class="sda-kpi c-purple">
                    <div class="sda-kpi-val">${(d.class_performance||[]).reduce((s,c)=>s+(c.terms?Object.values(c.terms).filter(v=>v!==null).length:0),0)}</div>
                    <div class="sda-kpi-label">Assessments</div>
                </div>
                <div class="sda-kpi c-pink">
                    <div class="sda-kpi-val">${d.total_learners}</div>
                    <div class="sda-kpi-label">Total Learners</div>
                </div>
            </div>

            <!-- ROW 1: Trend + Class Comparison -->
            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#4fd1c5;"></span>
                        School Average by Term
                    </div>
                    <div class="sda-chart-wrap h200">
                        ${(d.term_averages||[]).some(v => v.avg !== null)
                            ? `<canvas id="sda-trend-chart"></canvas>`
                            : `<div class="sda-no-data">No assessment data yet</div>`}
                    </div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#4e79a7;"></span>
                        Class Performance ${activeTerm ? '— Term ' + activeTerm : '— All Terms'}
                    </div>
                    <div class="sda-chart-wrap h200">
                        ${classData.some(c => c.display_avg !== null)
                            ? `<canvas id="sda-class-chart"></canvas>`
                            : `<div class="sda-no-data">No data for this term yet</div>`}
                    </div>
                </div>
            </div>

            <!-- ROW 2: Subject Performance + Gender Breakdown -->
            <div class="sda-row col-3-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#a78bfa;"></span>
                        Subject Performance
                    </div>
                    <div class="sda-chart-wrap h240">
                        ${d.subject_performance.length
                            ? `<canvas id="sda-subject-chart"></canvas>`
                            : `<div class="sda-no-data">No subject data yet</div>`}
                    </div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#e15759;"></span>
                        Gender Breakdown ${activeTerm ? '— Term ' + activeTerm : ''}
                    </div>
                    <div style="margin-bottom:20px;">
                        <div class="sda-gender-row">
                            <div class="sda-gender-label male">Boys</div>
                            <div class="sda-gender-bar-wrap">
                                <div class="sda-gender-bar male" style="width:${maleAvg !== null ? maleAvg : 0}%;"></div>
                            </div>
                            <div class="sda-gender-val male">${maleAvg !== null ? maleAvg + '%' : '—'}</div>
                            <div class="sda-gender-count">${maleLearners} learners</div>
                        </div>
                        <div class="sda-gender-row">
                            <div class="sda-gender-label female">Girls</div>
                            <div class="sda-gender-bar-wrap">
                                <div class="sda-gender-bar female" style="width:${femaleAvg !== null ? femaleAvg : 0}%;"></div>
                            </div>
                            <div class="sda-gender-val female">${femaleAvg !== null ? femaleAvg + '%' : '—'}</div>
                            <div class="sda-gender-count">${femaleLearners} learners</div>
                        </div>
                    </div>
                    ${(maleAvg !== null && femaleAvg !== null) ? `
                    <div class="sda-chart-wrap h160" style="--h:160px;">
                        <canvas id="sda-gender-chart"></canvas>
                    </div>` : ''}

                    <!-- Completion rates -->
                    <div class="sda-card-title" style="margin-top:20px;">
                        <span class="sda-card-dot" style="background:#22c55e;"></span>
                        Completion Rate by Class
                    </div>
                    ${completionRows}
                </div>
            </div>

            <!-- ROW 3: Top Learners + Most Improved -->
            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#f59e0b;"></span>
                        Top 10 Learners (School-wide)
                    </div>
                    <table class="sda-top-table">
                        <tbody>${topRows}</tbody>
                    </table>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:#22c55e;"></span>
                        Most Improved (Term 1 → Term ${d.latest_term})
                    </div>
                    ${improvedRows}
                </div>
            </div>

        </div>`;

    // ── Now render charts ──
    requestAnimationFrame(() => {
        sdaRenderCharts(d, classData, activeTerm, maleAvg, femaleAvg);
    });
}

// ══════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════
function sdaRenderCharts(d, classData, activeTerm, maleAvg, femaleAvg) {
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
    };
    const gridColor = 'rgba(255,255,255,0.05)';
    const tickColor = '#4a5568';

    // ── 1. Term Trend (line chart) ──
    const trendCtx = document.getElementById('sda-trend-chart')?.getContext('2d');
    if (trendCtx) {
        const trendAvgs = (d.term_averages || []).map(t => t.avg);
        const chart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: (d.term_averages || []).map(t => `Term ${t.term}`),
                datasets: [{
                    label: 'School Avg %',
                    data: trendAvgs,
                    borderColor: '#4fd1c5',
                    backgroundColor: 'rgba(79,209,197,0.08)',
                    borderWidth: 3,
                    pointBackgroundColor: trendAvgs.map(v =>
                        v === null ? 'transparent' :
                        v >= 60 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#f85149'
                    ),
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.35,
                    fill: true,
                    spanGaps: false,
                }]
            },
            options: {
                ...chartDefaults,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ctx.parsed.y !== null ? ` ${ctx.parsed.y}%` : ' No data',
                            afterLabel: ctx => {
                                const t = (d.term_averages || [])[ctx.dataIndex];
                                return t ? `${t.learners} learners · ${t.submissions} submissions` : '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true, max: 100,
                        ticks: { color: tickColor, callback: v => v + '%', stepSize: 20 },
                        grid: { color: gridColor }
                    },
                    x: { ticks: { color: tickColor }, grid: { color: gridColor } }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }

    // ── 2. Class comparison (horizontal bar) ──
    const classCtx = document.getElementById('sda-class-chart')?.getContext('2d');
    if (classCtx) {
        const filtered = classData.filter(c => c.display_avg !== null);
        const chart = new Chart(classCtx, {
            type: 'bar',
            data: {
                labels: filtered.map(c => c.class_name),
                datasets: [{
                    data: filtered.map(c => c.display_avg),
                    backgroundColor: filtered.map(c =>
                        c.display_avg >= 60 ? 'rgba(34,197,94,0.65)' :
                        c.display_avg >= 40 ? 'rgba(245,158,11,0.65)' :
                        'rgba(248,81,73,0.65)'
                    ),
                    borderColor: filtered.map(c =>
                        c.display_avg >= 60 ? '#22c55e' :
                        c.display_avg >= 40 ? '#f59e0b' : '#f85149'
                    ),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                ...chartDefaults,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.x}%`,
                            afterLabel: ctx => {
                                const cls = filtered[ctx.dataIndex];
                                return cls ? `${cls.learner_count} learners` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true, max: 100,
                        ticks: { color: tickColor, callback: v => v + '%' },
                        grid: { color: gridColor }
                    },
                    y: { ticks: { color: tickColor }, grid: { display: false } }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }

    // ── 3. Subject performance (horizontal bar) ──
    const subjectCtx = document.getElementById('sda-subject-chart')?.getContext('2d');
    if (subjectCtx) {
        const subjs = d.subject_performance.slice(0, 10); // top 10
        const chart = new Chart(subjectCtx, {
            type: 'bar',
            data: {
                labels: subjs.map(s => s.subject.length > 18 ? s.subject.slice(0, 18) + '…' : s.subject),
                datasets: [{
                    data: subjs.map(s => s.avg),
                    backgroundColor: subjs.map(s =>
                        s.avg >= 60 ? 'rgba(167,139,250,0.65)' :
                        s.avg >= 40 ? 'rgba(245,158,11,0.65)' :
                        'rgba(248,81,73,0.65)'
                    ),
                    borderColor: subjs.map(s =>
                        s.avg >= 60 ? '#a78bfa' :
                        s.avg >= 40 ? '#f59e0b' : '#f85149'
                    ),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                ...chartDefaults,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.x}%`,
                            afterLabel: ctx => {
                                const s = subjs[ctx.dataIndex];
                                return s ? `${s.learners} results · ${s.classes} class${s.classes !== 1 ? 'es' : ''}` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true, max: 100,
                        ticks: { color: tickColor, callback: v => v + '%' },
                        grid: { color: gridColor }
                    },
                    y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }

    // ── 4. Gender term-by-term (grouped bar) ──
    const genderCtx = document.getElementById('sda-gender-chart')?.getContext('2d');
    if (genderCtx && maleAvg !== null && femaleAvg !== null) {
        const chart = new Chart(genderCtx, {
            type: 'bar',
            data: {
                labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
                datasets: [
                    {
                        label: 'Boys',
                        data: [1,2,3,4].map(t => d.gender_breakdown?.male?.terms?.[t] ?? null),
                        backgroundColor: 'rgba(78,121,167,0.65)',
                        borderColor: '#4e79a7',
                        borderWidth: 2,
                        borderRadius: 5,
                        borderSkipped: false,
                    },
                    {
                        label: 'Girls',
                        data: [1,2,3,4].map(t => d.gender_breakdown?.female?.terms?.[t] ?? null),
                        backgroundColor: 'rgba(225,87,89,0.65)',
                        borderColor: '#e15759',
                        borderWidth: 2,
                        borderRadius: 5,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                ...chartDefaults,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: tickColor, font: { size: 11 }, boxWidth: 12, padding: 12 }
                    },
                    tooltip: {
                        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + '%' : 'No data'}` }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true, max: 100,
                        ticks: { color: tickColor, callback: v => v + '%', stepSize: 25 },
                        grid: { color: gridColor }
                    },
                    x: { ticks: { color: tickColor }, grid: { display: false } }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }
}