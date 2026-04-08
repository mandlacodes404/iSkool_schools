// ══════════════════════════════════════════════════════════
// ANALYTICS SECTION — assets/js/school/analytics.js
// ══════════════════════════════════════════════════════════

window._sdAnalyticsCache = null;
window._sdAnalyticsCharts = [];
window._sdAnalyticsTerm   = 0;

// ── INJECT STYLES ──
(function injectAnalyticsStyles() {
    if (document.getElementById('sd-analytics-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-analytics-styles';
    s.textContent = `

        .sda-shell { padding: 24px 24px 80px; max-width: 1400px; }

        /* ── Page header + term tabs ── */
        .sda-header {
            display: flex; align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap; gap: 10px;
        }
        .sda-title { font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
        .sda-sub   { font-size: 12px; color: var(--text-muted); }

        /* Term tabs — GitHub subnav style */
        .sda-term-tabs {
            display: flex;
            gap: 0;
            border-bottom: 1px solid var(--border);
            margin-bottom: -17px; /* align with header border */
        }
        .sda-term-tab {
            font-size: 13px;
            font-weight: 400;
            padding: 6px 12px;
            border: none;
            border-bottom: 2px solid transparent;
            background: none;
            color: var(--text-muted);
            cursor: pointer;
            font-family: var(--font);
            transition: color 0.15s, border-color 0.15s;
            position: relative;
            top: 1px;
            white-space: nowrap;
        }
        .sda-term-tab:hover { color: var(--text); }
        .sda-term-tab.active {
            color: var(--text);
            font-weight: 600;
            border-bottom-color: #f78166;
        }

        /* ── KPI row ── */
        .sda-kpi-row {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
            margin-bottom: 16px;
        }
        .sda-kpi {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 14px;
            position: relative;
            overflow: hidden;
            transition: border-color 0.15s;
        }
        .sda-kpi:hover { border-color: var(--border-hover); }
        .sda-kpi::before {
            content: ''; position: absolute;
            top: 10px; bottom: 10px;
            left: 0; width: 2px;
            border-radius: 0 2px 2px 0;
        }
        .sda-kpi.c-teal::before   { background: var(--teal);   }
        .sda-kpi.c-blue::before   { background: var(--blue);   }
        .sda-kpi.c-orange::before { background: var(--orange); }
        .sda-kpi.c-green::before  { background: var(--green);  }
        .sda-kpi.c-purple::before { background: var(--purple); }
        .sda-kpi.c-pink::before   { background: #e15759; }

        .sda-kpi-val {
            font-size: 22px;
            font-weight: 600;
            line-height: 1;
            margin-bottom: 5px;
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sda-kpi.c-teal   .sda-kpi-val { color: var(--teal);   }
        .sda-kpi.c-blue   .sda-kpi-val { color: var(--blue);   }
        .sda-kpi.c-orange .sda-kpi-val { color: var(--orange); }
        .sda-kpi.c-green  .sda-kpi-val { color: var(--green);  }
        .sda-kpi.c-purple .sda-kpi-val { color: var(--purple); }
        .sda-kpi.c-pink   .sda-kpi-val { color: #e15759; }

        .sda-kpi-label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: var(--text-dim);
        }

        /* ── Grid layouts ── */
        .sda-row { display: grid; gap: 12px; margin-bottom: 12px; }
        .sda-row.col-2   { grid-template-columns: 1fr 1fr; }
        .sda-row.col-3-2 { grid-template-columns: 3fr 2fr; }
        .sda-row.col-2-3 { grid-template-columns: 2fr 3fr; }
        .sda-row.col-1   { grid-template-columns: 1fr; }

        /* ── Chart cards ── */
        .sda-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 16px;
            transition: border-color 0.15s;
        }
        .sda-card:hover { border-color: var(--border-hover); }

        .sda-card-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 14px;
            display: flex; align-items: center; gap: 6px;
        }
        .sda-card-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--teal);
            flex-shrink: 0;
        }
        .sda-chart-wrap { position: relative; }
        .sda-chart-wrap.h200 { height: 200px; }
        .sda-chart-wrap.h240 { height: 240px; }
        .sda-chart-wrap.h280 { height: 280px; }
        .sda-no-data {
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; color: var(--text-dim);
            height: 100%;
        }

        /* ── Gender comparison ── */
        .sda-gender-row {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 12px;
        }
        .sda-gender-label {
            font-size: 12px;
            font-weight: 500;
            width: 48px; flex-shrink: 0;
        }
        .sda-gender-label.male   { color: var(--blue); }
        .sda-gender-label.female { color: #e15759; }
        .sda-gender-bar-wrap {
            flex: 1; height: 6px;
            background: var(--surface2);
            border-radius: 3px; overflow: hidden;
        }
        .sda-gender-bar { height: 100%; border-radius: 3px; transition: width 0.7s ease; }
        .sda-gender-bar.male   { background: var(--blue); }
        .sda-gender-bar.female { background: #e15759; }
        .sda-gender-val {
            font-size: 12px;
            font-weight: 600;
            width: 40px; text-align: right; flex-shrink: 0;
            font-family: var(--font-mono);
        }
        .sda-gender-val.male   { color: var(--blue); }
        .sda-gender-val.female { color: #e15759; }
        .sda-gender-count {
            font-size: 11px; color: var(--text-dim);
            width: 64px; flex-shrink: 0;
            font-family: var(--font-mono);
        }

        /* ── Top learners table ── */
        .sda-top-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sda-top-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); }
        .sda-top-table tr:last-child td { border-bottom: none; }
        .sda-top-table tr:hover td { background: var(--surface2); }

        .sda-rank {
            font-size: 11px; font-weight: 600;
            color: var(--text-dim); width: 20px;
            font-family: var(--font-mono);
        }
        .sda-rank.gold   { color: var(--orange); }
        .sda-rank.silver { color: var(--text-muted); }
        .sda-rank.bronze { color: #b45309; }

        .sda-learner-name  { font-weight: 500; color: var(--text); }
        .sda-learner-class { font-size: 11px; color: var(--text-dim); margin-top: 1px; font-family: var(--font-mono); }

        .sda-gender-dot {
            width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
            display: inline-block; margin-right: 4px;
        }
        .sda-gender-dot.male   { background: var(--blue); }
        .sda-gender-dot.female { background: #e15759; }

        .sda-avg-pill {
            font-size: 12px; font-weight: 600;
            padding: 2px 8px; border-radius: 20px;
            font-family: var(--font-mono);
        }
        .sda-avg-pill.green  { background: var(--green-dim);  color: var(--green);  }
        .sda-avg-pill.orange { background: var(--orange-dim); color: var(--orange); }
        .sda-avg-pill.red    { background: var(--red-dim);    color: var(--red);    }
        .sda-avg-pill.gray   { background: var(--surface2);   color: var(--text-dim); }

        /* ── Most improved ── */
        .sda-improved-row {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        .sda-improved-row:last-child { border-bottom: none; }
        .sda-improved-name  { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-muted); }
        .sda-improved-from  { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
        .sda-improved-arrow { color: var(--green); font-size: 13px; }
        .sda-improved-to    { font-size: 12px; font-weight: 600; color: var(--text); font-family: var(--font-mono); }
        .sda-improved-badge {
            font-size: 12px; font-weight: 600;
            padding: 2px 8px; border-radius: 20px;
            background: var(--green-dim); color: var(--green);
            white-space: nowrap; font-family: var(--font-mono);
        }

        /* ── Completion bars ── */
        .sda-completion-row {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 8px;
        }
        .sda-completion-name {
            font-size: 12px; font-weight: 500;
            color: var(--text-muted);
            width: 56px; flex-shrink: 0;
            font-family: var(--font-mono);
        }
        .sda-completion-bar-wrap {
            flex: 1; height: 4px;
            background: var(--surface2);
            border-radius: 2px; overflow: hidden;
        }
        .sda-completion-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
        .sda-completion-val {
            font-size: 11px; font-weight: 600;
            width: 40px; text-align: right; flex-shrink: 0;
            color: var(--text-muted); font-family: var(--font-mono);
        }
        .sda-completion-count {
            font-size: 10px; color: var(--text-dim);
            width: 56px; flex-shrink: 0;
            font-family: var(--font-mono);
        }

        /* ── No data states ── */
        .sda-no-improved {
            text-align: center; padding: 28px 20px;
            color: var(--text-dim); font-size: 13px;
        }

        @media (max-width: 1100px) {
            .sda-kpi-row { grid-template-columns: repeat(3, 1fr); }
            .sda-row.col-3-2, .sda-row.col-2-3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
            .sda-kpi-row { grid-template-columns: repeat(2, 1fr); }
            .sda-row.col-2 { grid-template-columns: 1fr; }
            .sda-shell { padding: 14px 12px 80px; }
            .sda-term-tabs { overflow-x: auto; }
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
    if (v >= 75) return 'var(--green)';
    if (v >= 50) return 'var(--orange)';
    return 'var(--red)';
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

    content.innerHTML = `
        <div class="sda-shell">
            <div class="sda-header">
                <div>
                    <div class="sd-skeleton" style="height:20px;width:200px;margin-bottom:6px;"></div>
                    <div class="sd-skeleton" style="height:12px;width:240px;"></div>
                </div>
                <div class="sd-skeleton" style="height:32px;width:260px;border-radius:var(--radius);"></div>
            </div>
            <div class="sda-kpi-row">
                ${[1,2,3,4,5,6].map(() => `<div class="sd-skeleton" style="height:64px;border-radius:var(--radius-lg);"></div>`).join('')}
            </div>
            <div class="sda-row col-2" style="margin-bottom:12px;">
                <div class="sd-skeleton" style="height:240px;border-radius:var(--radius-lg);"></div>
                <div class="sd-skeleton" style="height:240px;border-radius:var(--radius-lg);"></div>
            </div>
            <div class="sda-row col-2">
                <div class="sd-skeleton" style="height:280px;border-radius:var(--radius-lg);"></div>
                <div class="sd-skeleton" style="height:280px;border-radius:var(--radius-lg);"></div>
            </div>
        </div>`;

    try {
        const res  = await fetch('api/school/get_analytics.php');
        const data = await res.json();
        window._sdAnalyticsCache = data;
        window._sdAnalyticsTerm  = 0;
        renderAnalytics(data, 0);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load analytics.</p>`;
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

    const termLabels = ['All Terms', 'Term 1', 'Term 2', 'Term 3', 'Term 4'];
    const termTabs = termLabels.map((label, i) => `
        <button class="sda-term-tab${activeTerm === i ? ' active' : ''}" onclick="sdaSwitchTerm(${i})">
            ${label}
        </button>`).join('');

    const classData = (d.class_performance || []).map(cls => {
        const avg = activeTerm === 0
            ? cls.overall
            : (cls.terms ? cls.terms[activeTerm] : null);
        return { ...cls, display_avg: avg };
    }).sort((a, b) => (b.display_avg ?? -1) - (a.display_avg ?? -1));

    const displaySchoolAvg = activeTerm === 0
        ? d.school_overall_avg
        : (d.term_averages && d.term_averages[activeTerm - 1]?.avg) ?? null;

    const latestTerm = (d.term_averages || []).reduce((last, t) => t.avg !== null ? t.term : last, 1);

    const displayLearners = activeTerm === 0
        ? Math.max(...(d.term_averages || []).map(t => t.learners || 0))
        : (d.term_averages && d.term_averages[activeTerm - 1]?.learners) ?? 0;

    const maleAvg   = activeTerm === 0
        ? d.gender_breakdown?.male?.overall
        : d.gender_breakdown?.male?.terms?.[activeTerm] ?? null;
    const femaleAvg = activeTerm === 0
        ? d.gender_breakdown?.female?.overall
        : d.gender_breakdown?.female?.terms?.[activeTerm] ?? null;
    const maleLearners   = 0;
    const femaleLearners = 0;

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
                <td style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${l.submissions} quizzes</td>
            </tr>`;
    }).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:20px;font-size:13px;">No data yet</td></tr>`;

    const improvedRows = (d.most_improved || []).length
        ? d.most_improved.map(l => `
            <div class="sda-improved-row">
                <div>
                    <div class="sda-improved-name">${l.name}</div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                        <span class="sda-improved-from">T${l.from_term}: ${l.from_avg}%</span>
                        <span class="sda-improved-arrow">→</span>
                        <span class="sda-improved-to">T${l.to_term}: ${l.to_avg}%</span>
                    </div>
                </div>
                <span class="sda-improved-badge">+${l.jump}%</span>
            </div>`).join('')
        : `<div class="sda-no-improved">Need data in at least 2 terms to show improvement</div>`;

    content.innerHTML = `
        <div class="sda-shell">

            <div class="sda-header">
                <div>
                    <div class="sda-title">School Analytics</div>
                    <div class="sda-sub">${d.year_name} · Data from summative assessments</div>
                </div>
                <div class="sda-term-tabs">${termTabs}</div>
            </div>

            <div class="sda-kpi-row">
                <div class="sda-kpi c-teal">
                    <div class="sda-kpi-val">${displaySchoolAvg !== null ? displaySchoolAvg + '%' : '—'}</div>
                    <div class="sda-kpi-label">School avg</div>
                </div>
                <div class="sda-kpi c-blue">
                    <div class="sda-kpi-val">${displayLearners}</div>
                    <div class="sda-kpi-label">Active learners</div>
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
                    <div class="sda-kpi-label">Total learners</div>
                </div>
            </div>

            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:var(--teal);"></span>
                        School average by term
                    </div>
                    <div class="sda-chart-wrap h200">
                        ${(d.term_averages||[]).some(v => v.avg !== null)
                            ? `<canvas id="sda-trend-chart"></canvas>`
                            : `<div class="sda-no-data">No assessment data yet</div>`}
                    </div>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:var(--blue);"></span>
                        Class performance ${activeTerm ? '— Term ' + activeTerm : '— All terms'}
                    </div>
                    <div class="sda-chart-wrap h200">
                        ${classData.some(c => c.display_avg !== null)
                            ? `<canvas id="sda-class-chart"></canvas>`
                            : `<div class="sda-no-data">No data for this term yet</div>`}
                    </div>
                </div>
            </div>

            <div class="sda-row col-3-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:var(--purple);"></span>
                        Subject performance
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
                        Gender breakdown ${activeTerm ? '— Term ' + activeTerm : ''}
                    </div>
                    <div style="margin-bottom:16px;">
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

                    <div class="sda-card-title" style="margin-top:16px;">
                        <span class="sda-card-dot" style="background:var(--green);"></span>
                        Completion rate by class
                    </div>
                    ${completionRows}
                </div>
            </div>

            <div class="sda-row col-2">
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:var(--orange);"></span>
                        Top 10 learners (school-wide)
                    </div>
                    <table class="sda-top-table">
                        <tbody>${topRows}</tbody>
                    </table>
                </div>
                <div class="sda-card">
                    <div class="sda-card-title">
                        <span class="sda-card-dot" style="background:var(--green);"></span>
                        Most improved (Term 1 → Term ${latestTerm})
                    </div>
                    ${improvedRows}
                </div>
            </div>

        </div>`;

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
    const gridColor = 'rgba(255,255,255,0.04)';
    const tickColor = '#8b949e';

    // ── 1. Term Trend (line) ──
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
                    borderColor: '#39d5c1',
                    backgroundColor: 'rgba(57,213,193,0.06)',
                    borderWidth: 2,
                    pointBackgroundColor: trendAvgs.map(v =>
                        v === null ? 'transparent' :
                        v >= 60 ? '#3fb950' : v >= 40 ? '#d29922' : '#f85149'
                    ),
                    pointRadius: 5,
                    pointHoverRadius: 7,
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
                        backgroundColor: '#1c2128',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
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
                        ticks: { color: tickColor, callback: v => v + '%', stepSize: 20, font: { size: 11 } },
                        grid: { color: gridColor },
                        border: { color: gridColor }
                    },
                    x: {
                        ticks: { color: tickColor, font: { size: 11 } },
                        grid: { color: gridColor },
                        border: { color: gridColor }
                    }
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
                        c.display_avg >= 60 ? 'rgba(63,185,80,0.5)'  :
                        c.display_avg >= 40 ? 'rgba(210,153,34,0.5)' :
                        'rgba(248,81,73,0.5)'
                    ),
                    borderColor: filtered.map(c =>
                        c.display_avg >= 60 ? '#3fb950' :
                        c.display_avg >= 40 ? '#d29922' : '#f85149'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                ...chartDefaults,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1c2128',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
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
                        ticks: { color: tickColor, callback: v => v + '%', font: { size: 11 } },
                        grid: { color: gridColor },
                        border: { color: gridColor }
                    },
                    y: {
                        ticks: { color: tickColor, font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }

    // ── 3. Subject performance (horizontal bar) ──
    const subjectCtx = document.getElementById('sda-subject-chart')?.getContext('2d');
    if (subjectCtx) {
        const subjs = d.subject_performance.slice(0, 10);
        const chart = new Chart(subjectCtx, {
            type: 'bar',
            data: {
                labels: subjs.map(s => s.subject.length > 18 ? s.subject.slice(0, 18) + '…' : s.subject),
                datasets: [{
                    data: subjs.map(s => s.avg),
                    backgroundColor: subjs.map(s =>
                        s.avg >= 60 ? 'rgba(188,140,255,0.5)' :
                        s.avg >= 40 ? 'rgba(210,153,34,0.5)'  :
                        'rgba(248,81,73,0.5)'
                    ),
                    borderColor: subjs.map(s =>
                        s.avg >= 60 ? '#bc8cff' :
                        s.avg >= 40 ? '#d29922' : '#f85149'
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                ...chartDefaults,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1c2128',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
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
                        ticks: { color: tickColor, callback: v => v + '%', font: { size: 11 } },
                        grid: { color: gridColor },
                        border: { color: gridColor }
                    },
                    y: {
                        ticks: { color: tickColor, font: { size: 11 } },
                        grid: { display: false }
                    }
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
                        backgroundColor: 'rgba(88,166,255,0.5)',
                        borderColor: '#58a6ff',
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false,
                    },
                    {
                        label: 'Girls',
                        data: [1,2,3,4].map(t => d.gender_breakdown?.female?.terms?.[t] ?? null),
                        backgroundColor: 'rgba(225,87,89,0.5)',
                        borderColor: '#e15759',
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                ...chartDefaults,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: tickColor,
                            font: { size: 11 },
                            boxWidth: 10,
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1c2128',
                        borderColor: '#30363d',
                        borderWidth: 1,
                        titleColor: '#e6edf3',
                        bodyColor: '#8b949e',
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + '%' : 'No data'}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true, max: 100,
                        ticks: { color: tickColor, callback: v => v + '%', stepSize: 25, font: { size: 11 } },
                        grid: { color: gridColor },
                        border: { color: gridColor }
                    },
                    x: {
                        ticks: { color: tickColor, font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
        window._sdAnalyticsCharts.push(chart);
    }
}