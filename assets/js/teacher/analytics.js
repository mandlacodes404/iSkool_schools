function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherAnalyticsCache     = null;
window.analyticsCharts            = {};
window.analyticsCurrentClassId    = null;
window.analyticsCurrentTerm       = null;
window.analyticsActiveTerm        = 1;

// ─────────────────────────────────────────────
// INJECT STYLES
// ─────────────────────────────────────────────
(function injectAnalyticsStyles() {
    if (document.getElementById('analytics-styles')) return;
    const style = document.createElement('style');
    style.id = 'analytics-styles';
    style.textContent = `
        /* ── PALETTE (single source of truth) ──
           Scoped to :root rather than .an-shell so the subject modal — which
           renders as a sibling of .an-shell, not a descendant — can use these
           too. Names are namespaced (--an-*) to avoid clashing with the rest
           of the app's styles. */
        :root {
            --an-bg: #0d1117;
            --an-panel: #161b22;
            --an-panel-alt: #1a2030;
            --an-accent: #4fd1c5;
            --an-accent-rgb: 79,209,197;
            --an-green: #22c55e;
            --an-green-rgb: 34,197,94;
            --an-orange: #f59e0b;
            --an-orange-rgb: 245,158,11;
            --an-red: #f85149;
            --an-red-rgb: 248,81,73;
            --an-blue: #4e79a7;
            --an-blue-rgb: 78,121,167;
            --an-purple: #af7aa1;
            --an-purple-rgb: 175,122,161;
            --an-text: #e2e8f0;
            --an-text-dim: #8b949e;
            --an-text-dimmer: #4a5568;
            --an-card-pad: 18px;
        }

        /* ── SHELL ── */
        .an-shell {
            display: flex;
            gap: 0;
            height: calc(100vh - 120px);
            overflow: hidden;
            font-family: 'Nunito', sans-serif;
        }

        /* ── LEFT PANEL ── */
        .an-left {
            width: 260px;
            min-width: 260px;
            background: var(--an-bg);
            border-right: 1px solid rgba(255,255,255,0.06);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .an-left-header {
            padding: 20px 16px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .an-left-title {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--an-accent);
            margin-bottom: 14px;
        }

        /* Term tabs */
        .an-term-tabs {
            display: flex;
            gap: 4px;
        }

        .an-term-tab {
            flex: 1;
            padding: 6px 0;
            text-align: center;
            font-size: 11px;
            font-weight: 800;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.03);
            color: var(--an-text-dim);
            transition: all 0.2s;
            position: relative;
        }

        .an-term-tab:hover {
            background: rgba(255,255,255,0.07);
            color: var(--an-text);
        }

        .an-term-tab.active {
            background: rgba(var(--an-accent-rgb),0.12);
            border-color: rgba(var(--an-accent-rgb),0.4);
            color: var(--an-accent);
        }

        .an-term-tab:focus-visible {
            outline: 2px solid var(--an-accent);
            outline-offset: 2px;
        }

        .an-term-tab[aria-disabled="true"] {
            cursor: default;
        }

        .an-term-tab .active-dot {
            position: absolute;
            top: -3px;
            right: -3px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--an-accent);
            display: none;
        }

        .an-term-tab.is-current-term .active-dot {
            display: block;
        }

        /* Class list */
        .an-class-list {
            flex: 1;
            overflow-y: auto;
            padding: 10px 10px;
        }

        .an-class-list::-webkit-scrollbar { width: 3px; }
        .an-class-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        .an-class-item {
            padding: 12px 12px;
            border-radius: 10px;
            cursor: pointer;
            margin-bottom: 6px;
            border: 1px solid transparent;
            transition: all 0.2s;
            position: relative;
        }

        .an-class-item:hover {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.08);
        }

        .an-class-item.active {
            background: rgba(var(--an-accent-rgb),0.08);
            border-color: rgba(var(--an-accent-rgb),0.25);
        }

        .an-class-item:focus-visible {
            outline: 2px solid var(--an-accent);
            outline-offset: 2px;
        }

        .an-class-item-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .an-class-subject {
            font-size: 13px;
            font-weight: 800;
            color: var(--an-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 140px;
        }

        .an-class-subject.unset {
            color: var(--an-accent);
            font-style: italic;
            font-size: 12px;
        }

        .an-class-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .an-class-name {
            font-size: 11px;
            color: var(--an-text-dim);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .an-class-avg-badge {
            font-size: 11px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 20px;
            flex-shrink: 0;
        }

        .an-class-avg-badge.green  { background: rgba(var(--an-green-rgb),0.12);  color: var(--an-green); }
        .an-class-avg-badge.orange { background: rgba(var(--an-orange-rgb),0.12); color: var(--an-orange); }
        .an-class-avg-badge.red    { background: rgba(var(--an-red-rgb),0.12);  color: var(--an-red); }
        .an-class-avg-badge.gray   { background: rgba(255,255,255,0.06); color: var(--an-text-dim); }

        .an-class-edit-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: var(--an-text-dimmer);
            cursor: pointer;
            padding: 2px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .an-class-item:hover .an-class-edit-btn,
        .an-class-item:focus-visible .an-class-edit-btn { opacity: 1; }
        .an-class-edit-btn:hover { color: var(--an-accent); }

        .an-class-edit-btn:focus-visible {
            opacity: 1;
            outline: 2px solid var(--an-accent);
            outline-offset: 2px;
        }

        .an-empty-term {
            text-align: center;
            color: var(--an-text-dimmer);
            font-size: 13px;
            padding: 30px 16px;
            font-style: italic;
        }

        /* ── RIGHT PANEL ── */
        .an-right {
            flex: 1;
            overflow-y: auto;
            background: var(--an-bg);
            padding: 24px 28px 40px;
        }

        .an-fade-in { animation: an-fade-in 0.25s ease; }

        @keyframes an-fade-in {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .an-right::-webkit-scrollbar { width: 4px; }
        .an-right::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* Empty state */
        .an-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #4a5568;
            text-align: center;
            gap: 12px;
        }

        .an-empty-state svg { opacity: 0.3; }
        .an-empty-state h3 { font-size: 16px; color: var(--an-text-dim); margin: 0; }
        .an-empty-state p  { font-size: 13px; margin: 0; }

        .an-retry-btn {
            margin-top: 6px;
            padding: 8px 20px;
            border-radius: 20px;
            border: 1px solid rgba(var(--an-accent-rgb),0.4);
            background: rgba(var(--an-accent-rgb),0.12);
            color: var(--an-accent);
            font-family: 'Nunito', sans-serif;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: background 0.2s;
        }

        .an-retry-btn:hover { background: rgba(var(--an-accent-rgb),0.2); }
        .an-retry-btn:focus-visible { outline: 2px solid var(--an-accent); outline-offset: 2px; }

        /* Dashboard header */
        .an-dash-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .an-dash-title {
            font-size: 20px;
            font-weight: 800;
            color: var(--an-text);
            margin: 0 0 4px;
        }

        .an-dash-meta {
            font-size: 12px;
            color: var(--an-text-dim);
        }

        .an-dash-term-badge {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
            padding: 5px 12px;
            border-radius: 20px;
            background: rgba(var(--an-accent-rgb),0.1);
            border: 1px solid rgba(var(--an-accent-rgb),0.3);
            color: var(--an-accent);
        }

        /* ── KPI CARDS ── */
        .an-kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        .an-kpi-card {
            background: var(--an-panel);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: var(--an-card-pad);
            position: relative;
            overflow: hidden;
            transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
        }

        .an-kpi-card:hover {
            border-color: rgba(255,255,255,0.12);
            background: var(--an-panel-alt);
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.25);
        }

        /* Each variant sets ONE custom property on the card itself. ::before and
           .an-kpi-value both just read it — so a dynamic inline override on the
           card (used by the Gender Gap card) automatically keeps the top-border
           accent and the value text in sync, instead of drifting apart. */
        .an-kpi-card.teal  { --an-kpi-accent: var(--an-accent); }
        .an-kpi-card.green { --an-kpi-accent: var(--an-green); }
        .an-kpi-card.blue  { --an-kpi-accent: var(--an-blue); }
        .an-kpi-card.pink  { --an-kpi-accent: var(--an-purple); }

        .an-kpi-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: var(--an-kpi-accent, transparent);
        }

        .an-kpi-label {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--an-text-dim);
            margin-bottom: 10px;
        }

        .an-kpi-value {
            font-size: 28px;
            font-weight: 900;
            line-height: 1;
            margin-bottom: 6px;
            color: var(--an-kpi-accent, var(--an-text));
        }

        .an-kpi-sub {
            font-size: 11px;
            color: var(--an-text-dim);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* ── CHART ROWS ── */
        .an-chart-row {
            display: grid;
            gap: 16px;
            margin-bottom: 16px;
        }

        .an-chart-row.two-col { grid-template-columns: 1fr 1fr; }
        .an-chart-row.one-col { grid-template-columns: 1fr; }

        .an-chart-card {
            background: var(--an-panel);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: var(--an-card-pad);
            position: relative;
        }

        .an-chart-title {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--an-text-dim);
            margin-bottom: 16px;
        }

        .an-chart-title-note {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: normal;
            text-transform: none;
            color: var(--an-text-dimmer);
            white-space: nowrap;
        }

        .an-chart-wrap {
            position: relative;
            height: 220px;
        }

        .an-chart-wrap.tall { height: 260px; }

        .an-no-data {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--an-text-dimmer);
            font-size: 13px;
            font-style: italic;
        }

        /* ── TOP PERFORMERS ── */
        .an-performers-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }

        .an-performers-card {
            background: var(--an-panel);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: var(--an-card-pad);
        }

        .an-performers-title {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 14px;
        }

        .an-performer-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 8px;
            margin-bottom: 6px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            transition: background 0.2s;
        }

        .an-performer-item:hover { background: rgba(255,255,255,0.06); }

        .an-performer-rank {
            font-size: 11px;
            font-weight: 800;
            color: var(--an-text-dimmer);
            width: 16px;
            flex-shrink: 0;
        }

        .an-performer-name {
            flex: 1;
            font-size: 13px;
            font-weight: 700;
            color: var(--an-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .an-performer-avg {
            font-size: 13px;
            font-weight: 800;
        }

        /* ── LOADING SKELETON ── */
        .an-skeleton {
            background: linear-gradient(90deg, var(--an-panel) 25%, var(--an-panel-alt) 50%, var(--an-panel) 75%);
            background-size: 200% 100%;
            animation: an-shimmer 1.5s infinite;
            border-radius: 8px;
        }

        @keyframes an-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        /* ── PASS/FAIL BAR ── */
        .an-pass-bar-wrap {
            margin-bottom: 10px;
        }

        .an-pass-bar-label {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 5px;
        }

        .an-pass-bar-track {
            height: 8px;
            background: rgba(var(--an-red-rgb),0.2);
            border-radius: 100px;
            overflow: hidden;
        }

        .an-pass-bar-fill {
            height: 100%;
            background: var(--an-green);
            border-radius: 100px;
            transition: width 0.6s ease;
        }

        /* ── REDUCED MOTION ── */
        @media (prefers-reduced-motion: reduce) {
            .an-fade-in { animation: none; }
            .an-skeleton { animation: none; }
            .an-kpi-card, .an-class-item, .an-performer-item,
            .an-term-tab, .an-pass-bar-fill { transition: none; }
            .an-kpi-card:hover { transform: none; }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
            .an-shell { flex-direction: column; height: auto; }
            .an-left  { width: 100%; min-width: unset; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
            .an-class-list { max-height: 200px; }
            .an-kpi-row { grid-template-columns: repeat(2, 1fr); }
            .an-chart-row.two-col { grid-template-columns: 1fr; }
            .an-performers-row { grid-template-columns: 1fr; }
        }
    `;
    document.head.appendChild(style);
})();

// ─────────────────────────────────────────────
// MAIN FETCH
// ─────────────────────────────────────────────
window.fetchTeacherAnalytics = async function () {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem('lastTeacherPage', 'teacher_analytics');
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive('teacher_analytics');

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAnalyticsCache) {
        renderTeacherAnalytics(window.teacherAnalyticsCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_analytics.php');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.teacherAnalyticsCache = data;
        renderTeacherAnalytics(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <div class="an-empty-state" style="height:auto;padding:60px 20px;">
                <svg viewBox="0 0 24 24" width="40" height="40" stroke="var(--an-red)" stroke-width="1.5" fill="none">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/>
                </svg>
                <h3>Couldn't load analytics</h3>
                <p>Check your connection and try again.</p>
                <button class="an-retry-btn" onclick="window.teacherAnalyticsCache=null;window.fetchTeacherAnalytics();">Retry</button>
            </div>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// RENDER SHELL
// ─────────────────────────────────────────────
function renderTeacherAnalytics(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const terms       = data.terms || [];
    const currentTerm = data.current_term || 1;

    const currentTermData = terms.find(t => t.term === currentTerm);
    window.analyticsActiveTerm = currentTermData ? currentTerm : terms[0]?.term || currentTerm;
    window._analyticsAllTerms  = terms;
    window._analyticsCurrentGlobalTerm = currentTerm;

    if (!terms.length) {
        apiArea.innerHTML = `
            <div class="teacher-resources-header">
                <h2 class="teacher-resources-title">Analytics</h2>
            </div>
            <p class="teacher-empty-state" style="margin-top:60px;">
                No published summative assessments yet — analytics will appear here once you publish one.
            </p>`;
        return;
    }

    // Build term tab labels
    const termTabs = [1, 2, 3, 4].map(t => {
        const hasData  = terms.find(td => td.term === t);
        const isCurrent = t === currentTerm;
        return `
            <div class="an-term-tab ${t === window.analyticsActiveTerm ? 'active' : ''} ${isCurrent ? 'is-current-term' : ''}"
                 onclick="switchAnalyticsTerm(${t})"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
                 role="button" tabindex="${hasData ? '0' : '-1'}" aria-disabled="${!hasData}"
                 style="${!hasData ? 'opacity:0.35;pointer-events:none;' : ''}">
                T${t}
                <span class="active-dot"></span>
            </div>`;
    }).join('');

    apiArea.innerHTML = `
        <div class="teacher-resources-header" style="margin-bottom:16px;">
            <h2 class="teacher-resources-title">Analytics</h2>
        </div>
        <div class="an-shell an-fade-in">
            <!-- LEFT -->
            <div class="an-left">
                <div class="an-left-header">
                    <div class="an-left-title">Classes</div>
                    <div class="an-term-tabs">${termTabs}</div>
                </div>
                <div class="an-class-list" id="an-class-list"></div>
            </div>
            <!-- RIGHT -->
            <div class="an-right" id="an-right">
                <div class="an-empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" style="stroke:var(--an-accent);" stroke-width="1.5" fill="none">
                        <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                    <h3>Select a class to view analytics</h3>
                    <p>Choose a class from the left to explore performance insights</p>
                </div>
            </div>
        </div>

        <!-- Subject Modal -->
        <div id="subjectModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:420px;">
                <div class="teacher-modal-header">
                    <span>Subject Name</span>
                    <button onclick="closeSubjectModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p style="color:var(--an-text-dim);font-size:14px;margin:0 0 16px;">
                        What subject do you teach in
                        <strong id="subjectModalClassName" style="color:var(--an-text);"></strong>?
                    </p>
                    <label class="teacher-modal-label">Subject Name</label>
                    <input type="text" id="subjectInput" class="teacher-modal-input"
                        placeholder="e.g. Mathematics, English HL">
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeSubjectModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="saveSubject()" class="teacher-modal-submit">Save</button>
                </div>
            </div>
        </div>`;

    renderClassList(window.analyticsActiveTerm);
}

// ─────────────────────────────────────────────
// RENDER CLASS LIST (LEFT PANEL)
// ─────────────────────────────────────────────
function renderClassList(term) {
    const listEl = document.getElementById('an-class-list');
    if (!listEl) return;

    const termData = (window._analyticsAllTerms || []).find(t => t.term === term);
    const classes  = termData ? termData.classes : [];

    if (!classes.length) {
        listEl.innerHTML = `<div class="an-empty-term">No assessments for Term ${term}</div>`;
        return;
    }

    listEl.innerHTML = classes.map(cls => {
        const subject    = cls.subject || null;
        const safeSubject = (cls.subject || '').replace(/'/g, "\\'");
        const safeName    = cls.name.replace(/'/g, "\\'");
        const isActive    = cls.id === window.analyticsCurrentClassId && term === window.analyticsCurrentTerm;

        return `
            <div class="an-class-item ${isActive ? 'active' : ''}"
                 id="an-cls-${cls.id}-${term}"
                 role="button" tabindex="0"
                 onclick="selectAnalyticsClass(${cls.id}, ${term})"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}">
                <div class="an-class-item-top">
                    <span class="an-class-subject ${!subject ? 'unset' : ''}">
                        ${subject || 'Set Subject'}
                    </span>
                </div>
                <div class="an-class-meta">
                    <span class="an-class-name">${cls.name} · ${cls.student_count} students</span>
                    <span class="an-class-avg-badge gray" id="an-badge-${cls.id}-${term}">—</span>
                </div>
                <button class="an-class-edit-btn"
                    onclick="event.stopPropagation();openSubjectModal(${cls.id},'${safeSubject}','${safeName}')">
                    <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            </div>`;
    }).join('');

    // Auto-select first class if none selected for this term
    if (window.analyticsCurrentTerm !== term) {
        window.analyticsCurrentClassId = null;
    }
    if (!window.analyticsCurrentClassId && classes.length) {
        selectAnalyticsClass(classes[0].id, term);
    }
}

// ─────────────────────────────────────────────
// SWITCH TERM TAB
// ─────────────────────────────────────────────
window.switchAnalyticsTerm = function (term) {
    window.analyticsActiveTerm     = term;
    window.analyticsCurrentClassId = null;

    // Update tab styles
    document.querySelectorAll('.an-term-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i + 1 === term);
    });

    renderClassList(term);

    // Clear right panel
    const right = document.getElementById('an-right');
    if (right) {
        right.innerHTML = `
            <div class="an-empty-state an-fade-in">
                <svg viewBox="0 0 24 24" width="48" height="48" style="stroke:var(--an-accent);" stroke-width="1.5" fill="none">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
                <h3>Select a class to view analytics</h3>
                <p>Choose a class from the left to explore performance insights</p>
            </div>`;
    }
};

// ─────────────────────────────────────────────
// SELECT CLASS → LOAD DASHBOARD
// ─────────────────────────────────────────────
window.selectAnalyticsClass = async function (classId, term) {
    window.analyticsCurrentClassId = classId;
    window.analyticsCurrentTerm    = term;

    // Highlight active class
    document.querySelectorAll('.an-class-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`an-cls-${classId}-${term}`);
    if (activeEl) activeEl.classList.add('active');

    // Find class info
    const termData = (window._analyticsAllTerms || []).find(t => t.term === term);
    const cls      = termData ? termData.classes.find(c => c.id === classId) : null;
    if (!cls) return;

    // Show skeleton
    const right = document.getElementById('an-right');
    if (!right) return;
    right.innerHTML = renderDashboardSkeleton(cls, term);

    // Destroy old charts
    Object.values(window.analyticsCharts).forEach(c => { try { c.destroy(); } catch(e){} });
    window.analyticsCharts = {};

    // Fetch data
    try {
        const res  = await fetch('api/teacher/get_analytics_data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' , 'X-CSRF-Token': getCsrfToken() },
            body: `class_id=${classId}&term=${term}`
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderDashboard(cls, term, data);
    } catch (e) {
        right.innerHTML = `
            <div class="an-empty-state an-fade-in" style="height:auto;padding:60px 20px;">
                <svg viewBox="0 0 24 24" width="40" height="40" stroke="var(--an-red)" stroke-width="1.5" fill="none">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/>
                </svg>
                <h3>Couldn't load this class</h3>
                <p>Check your connection and try again.</p>
                <button class="an-retry-btn" onclick="selectAnalyticsClass(${classId}, ${term});">Retry</button>
            </div>`;
    }
};

// ─────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────
function renderDashboardSkeleton(cls, term) {
    return `
        <div class="an-fade-in">
        <div class="an-dash-header">
            <div>
                <div class="an-dash-title">${cls.subject || cls.name}</div>
                <div class="an-dash-meta">${cls.name} · ${cls.student_count} students</div>
            </div>
            <div class="an-dash-term-badge">TERM ${term}</div>
        </div>
        <div class="an-kpi-row">
            ${[1,2,3,4].map(() => `
                <div class="an-kpi-card">
                    <div class="an-skeleton" style="height:10px;width:60%;margin-bottom:12px;"></div>
                    <div class="an-skeleton" style="height:28px;width:50%;margin-bottom:8px;"></div>
                    <div class="an-skeleton" style="height:10px;width:80%;"></div>
                </div>`).join('')}
        </div>
        <div class="an-chart-row two-col">
            ${[1,2].map(() => `
                <div class="an-chart-card">
                    <div class="an-skeleton" style="height:10px;width:40%;margin-bottom:16px;"></div>
                    <div class="an-skeleton" style="height:220px;border-radius:8px;"></div>
                </div>`).join('')}
        </div>
        <div class="an-chart-row one-col">
            <div class="an-chart-card">
                <div class="an-skeleton" style="height:10px;width:40%;margin-bottom:16px;"></div>
                <div class="an-skeleton" style="height:240px;border-radius:8px;"></div>
            </div>
        </div>
        </div>`;
}

// ─────────────────────────────────────────────
// RENDER FULL DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard(cls, term, data) {
    const right = document.getElementById('an-right');
    if (!right) return;

    const quizAvgs   = data.quiz_averages             || [];
    const genderData = data.quiz_gender_averages       || [];
    const topGirls   = data.top_girls                  || [];
    const topBoys    = data.top_boys                    || [];
    const byTerm     = data.boys_vs_girls_by_term      || { boys: [null,null,null,null], girls: [null,null,null,null] };
    const classTrend = data.class_performance_by_term  || [null,null,null,null];
    const medianScore = (typeof data.median_score === 'number') ? data.median_score : null;
    const scoreDistribution = data.score_distribution || [];

    // ── KPI calculations ──
    const classAvg = quizAvgs.length
        ? Math.round(quizAvgs.reduce((s, q) => s + q.avg, 0) / quizAvgs.length * 10) / 10
        : null;

    const highestQuiz = quizAvgs.length
        ? quizAvgs.reduce((max, q) => q.avg > max.avg ? q : max, quizAvgs[0])
        : null;

    // Lowest-averaging quiz this term — paired with highestQuiz for the "hardest / easiest" callout
    const lowestQuiz = quizAvgs.length
        ? quizAvgs.reduce((min, q) => q.avg < min.avg ? q : min, quizAvgs[0])
        : null;

    // Only worth flagging as "hardest / easiest" if there's more than one quiz and a real spread —
    // otherwise it's just relabelling the single quiz you already see in the chart.
    const quizSpread = (highestQuiz && lowestQuiz) ? highestQuiz.avg - lowestQuiz.avg : 0;
    const showQuizExtremes = quizAvgs.length > 1 && quizSpread >= 15;

    // Term-over-term delta — this class's own average this term vs. its own average last term.
    // (Comparing against the immediately preceding term, not a fixed Term-1 baseline — that's a
    // judgment call worth revisiting if a "progress toward a fixed goal" framing is wanted instead.)
    const termIdx = term - 1;
    const priorTermAvg = termIdx > 0 ? classTrend[termIdx - 1] : null;
    const currentTermAvg = classTrend[termIdx];
    const termDelta = (currentTermAvg !== null && currentTermAvg !== undefined &&
                        priorTermAvg   !== null && priorTermAvg   !== undefined)
        ? Math.round((currentTermAvg - priorTermAvg) * 10) / 10
        : null;

    const topOverall = [...topGirls, ...topBoys].sort((a, b) => b.avg - a.avg)[0] || null;

    const boysAvg  = genderData.length ? genderData.reduce((s, d) => s + (d.boys  || 0), 0) / genderData.filter(d => d.boys  !== null).length : null;
    const girlsAvg = genderData.length ? genderData.reduce((s, d) => s + (d.girls || 0), 0) / genderData.filter(d => d.girls !== null).length : null;

    let gapValue = '—', gapSub = 'Based on quiz averages', gapColor = 'var(--an-text-dim)';
    if (boysAvg !== null && girlsAvg !== null) {
        const diff = Math.abs(boysAvg - girlsAvg).toFixed(1);
        const leader = boysAvg >= girlsAvg ? 'Boys' : 'Girls';
        gapValue = `${diff}%`;
        gapSub   = `${leader} leading`;
        gapColor = boysAvg >= girlsAvg ? 'var(--an-blue)' : 'var(--an-purple)';
    }

    // Pass/fail per quiz
    const passData = quizAvgs.map(q => ({
        title:   q.title,
        passing: q.avg >= 50 ? 100 : Math.round((q.avg / 50) * 100)
    }));

    function buildNormalCurve(distribution) {
        const buckets = distribution.map(b => {
            const parts = String(b.bucket).split('-').map(Number);
            const min = parts[0];
            const max = parts[1];
            return {
                min,
                max,
                midpoint: (min + max) / 2,
                count: Number(b.student_count) || 0
            };
        }).filter(b => Number.isFinite(b.midpoint));

        const total = buckets.reduce((sum, b) => sum + b.count, 0);
        if (total < 2) return null;

        const maxCount = Math.max(...buckets.map(b => b.count));
        if (maxCount <= 0) return null;

        const mean = buckets.reduce((sum, b) => sum + b.midpoint * b.count, 0) / total;
        const variance = buckets.reduce((sum, b) => sum + Math.pow(b.midpoint - mean, 2) * b.count, 0) / total;
        const stdDev = Math.sqrt(variance);
        if (!Number.isFinite(stdDev) || stdDev < 0.5) return null;

        const normalPdf = value => {
            const z = (value - mean) / stdDev;
            return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
        };

        const rawPoints = buckets.map(b => normalPdf(b.midpoint));
        const maxRaw = Math.max(...rawPoints);
        if (!Number.isFinite(maxRaw) || maxRaw <= 0) return null;

        const points = rawPoints.map(v => Math.round((v / maxRaw) * maxCount * 10) / 10);
        return points.some(v => v > 0) ? points : null;
    }

    const normalCurve = buildNormalCurve(scoreDistribution);
    const distributionCounts = scoreDistribution.map(b => Number(b.student_count) || 0);
    const distributionPeak = Math.max(...distributionCounts, ...(normalCurve || []), 1);
    const distributionSuggestedMax = Math.ceil(distributionPeak * 1.25);

    // Colour helper
    function avgColor(v) {
        if (v === null) return 'gray';
        if (v >= 60) return 'green';
        if (v >= 40) return 'orange';
        return 'red';
    }

    // Update left panel badge (the single source of performance signal per class now)
    const badge = document.getElementById(`an-badge-${cls.id}-${term}`);
    const col   = avgColor(classAvg);
    if (badge) { badge.textContent = classAvg !== null ? classAvg + '%' : '—'; badge.className = `an-class-avg-badge ${col}`; }

    right.innerHTML = `
        <div class="an-fade-in">
        <!-- HEADER -->
        <div class="an-dash-header">
            <div>
                <div class="an-dash-title">${cls.subject || cls.name}</div>
                <div class="an-dash-meta">${cls.name} · ${cls.student_count} students · Term ${term} summative assessments</div>
            </div>
            <div class="an-dash-term-badge">TERM ${term}</div>
        </div>

        <!-- ROW 1: KPI CARDS -->
        <div class="an-kpi-row">
            <div class="an-kpi-card teal">
                <div class="an-kpi-label">Class Average</div>
                <div class="an-kpi-value">${classAvg !== null ? classAvg + '%' : '—'}</div>
                <div class="an-kpi-sub">${quizAvgs.length} assessment${quizAvgs.length !== 1 ? 's' : ''}${medianScore !== null ? ` · Median ${medianScore}%` : ' this term'}</div>
            </div>
            <div class="an-kpi-card green">
                <div class="an-kpi-label">Highest Quiz</div>
                <div class="an-kpi-value">${highestQuiz ? highestQuiz.avg + '%' : '—'}</div>
                <div class="an-kpi-sub">${highestQuiz ? highestQuiz.title : 'No data'}</div>
            </div>
            <div class="an-kpi-card blue">
                <div class="an-kpi-label">Top Performer</div>
                <div class="an-kpi-value">${topOverall ? topOverall.avg + '%' : '—'}</div>
                <div class="an-kpi-sub">${topOverall ? topOverall.name : 'No data'}</div>
            </div>
            <div class="an-kpi-card pink" style="--an-kpi-accent:${gapColor};">
                <div class="an-kpi-label">Gender Gap</div>
                <div class="an-kpi-value">${gapValue}</div>
                <div class="an-kpi-sub">${gapSub}</div>
            </div>
        </div>

        <!-- ROW 2: Quiz Average + Boys vs Girls per Quiz -->
        <div class="an-chart-row two-col">
            <div class="an-chart-card">
                <div class="an-chart-title">
                    <span>Quiz Average</span>
                    ${showQuizExtremes ? `<span class="an-chart-title-note">Toughest: ${lowestQuiz.title} (${lowestQuiz.avg}%)</span>` : ''}
                </div>
                <div class="an-chart-wrap">
                    ${quizAvgs.length ? `<canvas id="chart-quiz-avg-${cls.id}-${term}"></canvas>` : '<div class="an-no-data">No quiz data yet</div>'}
                </div>
            </div>
            <div class="an-chart-card">
                <div class="an-chart-title">Boys vs Girls per Quiz</div>
                <div class="an-chart-wrap">
                    ${genderData.length ? `<canvas id="chart-quiz-gender-${cls.id}-${term}"></canvas>` : '<div class="an-no-data">No gender data yet</div>'}
                </div>
            </div>
        </div>

        <!-- ROW 3: Score Distribution (full width) -->
        <div class="an-chart-row one-col">
            <div class="an-chart-card">
                <div class="an-chart-title">
                    <span>Score Distribution</span>
                    ${scoreDistribution.length ? `<span class="an-chart-title-note">${scoreDistribution.reduce((s, b) => s + b.student_count, 0)} of ${cls.student_count} learners</span>` : ''}
                </div>
                <div class="an-chart-wrap tall">
                    ${scoreDistribution.some(b => b.student_count > 0) ? `<canvas id="chart-score-dist-${cls.id}-${term}"></canvas>` : '<div class="an-no-data">No quiz data yet</div>'}
                </div>
            </div>
        </div>

        <!-- ROW 4: Class Performance by Term (full width) -->
        <div class="an-chart-row one-col">
            <div class="an-chart-card">
                <div class="an-chart-title">
                    <span>Class Performance by Term</span>
                    ${termDelta !== null ? `<span class="an-chart-title-note" style="color:${termDelta >= 0 ? 'var(--an-green)' : 'var(--an-red)'};">${termDelta >= 0 ? '+' : ''}${termDelta}% vs Term ${termIdx}</span>` : ''}
                </div>
                <div class="an-chart-wrap tall">
                    ${classTrend.some(v => v !== null) ? `<canvas id="chart-class-trend-${cls.id}-${term}"></canvas>` : '<div class="an-no-data">More terms needed to show trend</div>'}
                </div>
            </div>
        </div>

        <!-- ROW 5: Boys vs Girls by Term + Pass/Fail -->
        <div class="an-chart-row two-col">
            <div class="an-chart-card">
                <div class="an-chart-title">Boys vs Girls by Term</div>
                <div class="an-chart-wrap">
                    ${(byTerm.boys.some(v=>v!==null)||byTerm.girls.some(v=>v!==null)) ? `<canvas id="chart-term-gender-${cls.id}-${term}"></canvas>` : '<div class="an-no-data">More terms needed</div>'}
                </div>
            </div>
            <div class="an-chart-card">
                <div class="an-chart-title">Pass Rate per Quiz (50% threshold)</div>
                <div class="an-chart-wrap" style="overflow-y:auto;">
                    ${passData.length ? `<div id="pass-fail-${cls.id}-${term}"></div>` : '<div class="an-no-data">No data yet</div>'}
                </div>
            </div>
        </div>

        <!-- ROW 6: Top Performers -->
        <div class="an-performers-row">
            <div class="an-performers-card">
                <div class="an-performers-title" style="color:var(--an-purple);">
                    Top 5 Girls
                </div>
                ${topGirls.length
                    ? topGirls.map((p, i) => `
                        <div class="an-performer-item">
                            <span class="an-performer-rank">${i + 1}</span>
                            <span class="an-performer-name">${p.name}</span>
                            <span class="an-performer-avg" style="color:var(--an-purple);">${p.avg}%</span>
                        </div>`).join('')
                    : '<p style="color:var(--an-text-dimmer);font-size:13px;text-align:center;margin-top:16px;">No data</p>'}
            </div>
            <div class="an-performers-card">
                <div class="an-performers-title" style="color:var(--an-blue);">
                    Top 5 Boys
                </div>
                ${topBoys.length
                    ? topBoys.map((p, i) => `
                        <div class="an-performer-item">
                            <span class="an-performer-rank">${i + 1}</span>
                            <span class="an-performer-name">${p.name}</span>
                            <span class="an-performer-avg" style="color:var(--an-blue);">${p.avg}%</span>
                        </div>`).join('')
                    : '<p style="color:var(--an-text-dimmer);font-size:13px;text-align:center;margin-top:16px;">No data</p>'}
            </div>
        </div>
        </div>`;

    // ── Render charts ──
    const chartOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e2e8f0', font: { family: 'Nunito', size: 12 } } },
            tooltip: {
                callbacks: { label: ctx => ` ${ctx.parsed.y !== null ? ctx.parsed.y + '%' : 'No data'}` }
            }
        },
        scales: {
            y: {
                beginAtZero: true, max: 100,
                ticks: { color: '#8b949e', callback: v => v + '%', stepSize: 20 },
                grid: { color: 'rgba(255,255,255,0.05)' }
            },
            x: {
                ticks: { color: '#8b949e', maxRotation: 30 },
                grid: { color: 'rgba(255,255,255,0.05)' }
            }
        }
    };

    // Separate options for count-based charts (Score Distribution) — chartOpts above assumes a
    // 0-100% axis, which would mislabel a "number of students" axis as a percentage.
    const histogramOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#e2e8f0',
                    font: { family: 'Nunito', size: 12 },
                    boxWidth: 16,
                    boxHeight: 8,
                    padding: 14
                }
            },
            tooltip: {
                callbacks: {
                    title: items => items.length ? `${items[0].label} score range` : '',
                    label: ctx => {
                        const value = ctx.parsed.y;
                        if (ctx.dataset.type === 'line') {
                            return ` Normal curve: about ${value} learner${value === 1 ? '' : 's'}`;
                        }
                        return ` ${value} learner${value === 1 ? '' : 's'} in this range`;
                    }
                }
            },
            datalabels: false
        },
        scales: {
            y: {
                beginAtZero: true,
                suggestedMax: distributionSuggestedMax,
                title: { display: true, text: 'Learners', color: '#8b949e', font: { family: 'Nunito', size: 11, weight: '700' } },
                ticks: { color: '#8b949e', precision: 0 },
                grid: { color: 'rgba(255,255,255,0.05)' }
            },
            x: {
                title: { display: true, text: 'Average score range', color: '#8b949e', font: { family: 'Nunito', size: 11, weight: '700' } },
                ticks: { color: '#8b949e' },
                grid: { display: false }
            }
        }
    };

    // Quiz Average bar
    if (quizAvgs.length) {
        const ctx = document.getElementById(`chart-quiz-avg-${cls.id}-${term}`)?.getContext('2d');
        if (ctx) {
            window.analyticsCharts[`qa-${cls.id}-${term}`] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: quizAvgs.map(q => q.title),
                    datasets: [{
                        label: 'Class Average %',
                        data: quizAvgs.map(q => q.avg),
                        backgroundColor: quizAvgs.map(q =>
                            q.avg >= 60 ? 'rgba(34,197,94,0.6)' :
                            q.avg >= 40 ? 'rgba(245,158,11,0.6)' :
                                          'rgba(248,81,73,0.6)'),
                        borderColor: quizAvgs.map(q =>
                            q.avg >= 60 ? '#22c55e' :
                            q.avg >= 40 ? '#f59e0b' : '#f85149'),
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    ...chartOpts,
                    plugins: {
                        ...chartOpts.plugins,
                        datalabels: false,
                        legend: { display: false }
                    }
                }
            });
        }
    }

    // Score Distribution histogram — bucket colours match the same 60%/40% cutoffs as the
    // Quiz Average bars above, so "red" and "green" mean the same thing everywhere on this page.
    if (scoreDistribution.some(b => b.student_count > 0)) {
        const ctx = document.getElementById(`chart-score-dist-${cls.id}-${term}`)?.getContext('2d');
        if (ctx) {
            window.analyticsCharts[`sd-${cls.id}-${term}`] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: scoreDistribution.map(b => b.bucket + '%'),
                    datasets: [
                        {
                            label: 'Learners',
                            data: scoreDistribution.map(b => b.student_count),
                            backgroundColor: scoreDistribution.map(b =>
                                b.bucket === '0-39'  ? 'rgba(248,81,73,0.58)' :
                                b.bucket === '40-59' ? 'rgba(245,158,11,0.58)' :
                                                        'rgba(34,197,94,0.58)'),
                            borderColor: scoreDistribution.map(b =>
                                b.bucket === '0-39'  ? '#f85149' :
                                b.bucket === '40-59' ? '#f59e0b' :
                                                        '#22c55e'),
                            borderWidth: 1,
                            borderRadius: 0,
                            borderSkipped: false,
                            barPercentage: 1,
                            categoryPercentage: 1,
                            order: 2
                        },
                        ...(normalCurve ? [{
                            type: 'line',
                            label: 'Normal curve',
                            data: normalCurve,
                            borderColor: '#f8fafc',
                            backgroundColor: 'rgba(248,250,252,0.12)',
                            borderWidth: 3,
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointBackgroundColor: '#f8fafc',
                            tension: 0.45,
                            fill: false,
                            order: 1
                        }] : [])
                    ]
                },
                options: histogramOpts
            });
        }
    }

    // Boys vs Girls per Quiz
    if (genderData.length) {
        const ctx = document.getElementById(`chart-quiz-gender-${cls.id}-${term}`)?.getContext('2d');
        if (ctx) {
            window.analyticsCharts[`qg-${cls.id}-${term}`] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: genderData.map(d => d.title),
                    datasets: [
                        {
                            label: 'Boys %',
                            data: genderData.map(d => d.boys),
                            backgroundColor: 'rgba(78,121,167,0.7)',
                            borderColor: '#4e79a7',
                            borderWidth: 2,
                            borderRadius: 6
                        },
                        {
                            label: 'Girls %',
                            data: genderData.map(d => d.girls),
                            backgroundColor: 'rgba(175,122,161,0.7)',
                            borderColor: '#af7aa1',
                            borderWidth: 2,
                            borderRadius: 6
                        }
                    ]
                },
                options: chartOpts
            });
        }
    }

    // Class trend line
    if (classTrend.some(v => v !== null)) {
        const ctx = document.getElementById(`chart-class-trend-${cls.id}-${term}`)?.getContext('2d');
        if (ctx) {
            window.analyticsCharts[`ct-${cls.id}-${term}`] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
                    datasets: [{
                        label: 'Class Average',
                        data: classTrend,
                        borderColor: '#4fd1c5',
                        backgroundColor: 'rgba(79,209,197,0.08)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#4fd1c5',
                        pointRadius: 6,
                        pointHoverRadius: 9,
                        borderWidth: 3,
                        spanGaps: true
                    }]
                },
                options: chartOpts
            });
        }
    }

    // Boys vs Girls by Term
    if (byTerm.boys.some(v => v !== null) || byTerm.girls.some(v => v !== null)) {
        const ctx = document.getElementById(`chart-term-gender-${cls.id}-${term}`)?.getContext('2d');
        if (ctx) {
            window.analyticsCharts[`tg-${cls.id}-${term}`] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
                    datasets: [
                        {
                            label: 'Boys',
                            data: byTerm.boys,
                            borderColor: '#4e79a7',
                            backgroundColor: 'rgba(78,121,167,0.08)',
                            tension: 0.4, fill: true,
                            pointBackgroundColor: '#4e79a7',
                            pointRadius: 6, pointHoverRadius: 9, spanGaps: true
                        },
                        {
                            label: 'Girls',
                            data: byTerm.girls,
                            borderColor: '#af7aa1',
                            backgroundColor: 'rgba(175,122,161,0.08)',
                            tension: 0.4, fill: true,
                            pointBackgroundColor: '#af7aa1',
                            pointRadius: 6, pointHoverRadius: 9, spanGaps: true
                        }
                    ]
                },
                options: chartOpts
            });
        }
    }

    // Pass/Fail bars
    if (passData.length) {
        const wrap = document.getElementById(`pass-fail-${cls.id}-${term}`);
        if (wrap) {
            wrap.innerHTML = passData.map(q => `
                <div class="an-pass-bar-wrap">
                    <div class="an-pass-bar-label">
                        <span style="color:var(--an-text);font-size:12px;">${q.title}</span>
                        <span style="color:${q.passing >= 100 ? 'var(--an-green)' : q.passing >= 60 ? 'var(--an-orange)' : 'var(--an-red)'};font-weight:800;font-size:12px;">${q.passing}%</span>
                    </div>
                    <div class="an-pass-bar-track">
                        <div class="an-pass-bar-fill"
                            style="width:${q.passing}%;background:${q.passing >= 100 ? 'var(--an-green)' : q.passing >= 60 ? 'var(--an-orange)' : 'var(--an-red)'};">
                        </div>
                    </div>
                </div>`).join('');
        }
    }
}

// ─────────────────────────────────────────────
// SUBJECT MODAL
// ─────────────────────────────────────────────
window.openSubjectModal = function (classId, currentSubject, className) {
    const modal  = document.getElementById('subjectModal');
    const nameEl = document.getElementById('subjectModalClassName');
    const input  = document.getElementById('subjectInput');
    if (!modal || !nameEl || !input) return;
    window.analyticsCurrentClassId = classId;
    nameEl.textContent = className;
    input.value = currentSubject || '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
};

window.closeSubjectModal = function () {
    const modal = document.getElementById('subjectModal');
    if (modal) modal.style.display = 'none';
};

window.saveSubject = async function () {
    const input  = document.getElementById('subjectInput');
    const loader = document.getElementById('loaderOverlay');
    if (!input) return;

    const subject = input.value.trim();
    if (!subject) {
        input.style.borderColor = '#f85149';
        setTimeout(() => input.style.borderColor = '', 1500);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/save_subject.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' , 'X-CSRF-Token': getCsrfToken() },
            body: `class_id=${window.analyticsCurrentClassId}&subject_name=${encodeURIComponent(subject)}`
        });
        const data = await res.json();

        if (data.success) {
            // Update cache and re-render left panel subject label
            if (window.teacherAnalyticsCache) {
                window.teacherAnalyticsCache.terms.forEach(t => {
                    t.classes.forEach(c => {
                        if (c.id === window.analyticsCurrentClassId) c.subject = data.subject_name;
                    });
                });
                window._analyticsAllTerms = window.teacherAnalyticsCache.terms;
            }
            renderClassList(window.analyticsActiveTerm);
            window.closeSubjectModal();

            // Reload dashboard with updated subject name
            if (window.analyticsCurrentClassId && window.analyticsCurrentTerm) {
                selectAnalyticsClass(window.analyticsCurrentClassId, window.analyticsCurrentTerm);
            }
        } else {
            alert(data.message || 'Failed to save subject.');
        }
    } catch (e) {
        alert('Connection error. Please try again.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};
