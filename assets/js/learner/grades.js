/**
 * assets/js/grades.js
 * API-driven Grades page — mirrors the logic of the old quiz_history.php
 * Drop-in replacement: call fetchGrades() from sidebar / bottom nav
 */

window.learnerGradesCache = null;
window.learnerGradesCachePromise = null;
window.learnerGradeStatsCache = window.learnerGradeStatsCache || {};
window.learnerProgressReportCache = window.learnerProgressReportCache || {};

// Shared learner-side state helper. Other learner pages can reuse this shape:
// learnerPageState.get('page'), learnerPageState.update('page', patch).
window.learnerPageState = window.learnerPageState || {
    prefix: 'learnerPageState:',
    get(page) {
        try {
            return JSON.parse(sessionStorage.getItem(this.prefix + page) || '{}');
        } catch (e) {
            return {};
        }
    },
    set(page, state) {
        try {
            sessionStorage.setItem(this.prefix + page, JSON.stringify(state || {}));
        } catch (e) {}
    },
    update(page, patch) {
        this.set(page, Object.assign({}, this.get(page), patch || {}));
    }
};

let gradesRestoringState = false;

function getGradesState() {
    const state = window.learnerPageState.get('grades');
    state.openSubjects = Array.isArray(state.openSubjects) ? state.openSubjects : null;
    state.openRows = Array.isArray(state.openRows) ? state.openRows : [];
    state.views = state.views || {};
    state.terms = state.terms || {};
    state.search = state.search || {};
    state.scroll = state.scroll || {};
    return state;
}

function saveGradesState(patch) {
    if (gradesRestoringState) return;
    window.learnerPageState.update('grades', patch);
}

async function loadGradesData() {
    if (window.learnerGradesCache) return window.learnerGradesCache;
    if (!window.learnerGradesCachePromise) {
        window.learnerGradesCachePromise = fetch('api/learner/get_grades.php')
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                window.learnerGradesCache = data;
                return data;
            })
            .finally(() => {
                window.learnerGradesCachePromise = null;
            });
    }
    return window.learnerGradesCachePromise;
}

window.prefetchLearnerGrades = function () {
    loadGradesData().catch(() => {});
};

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        if (!window.learnerGradesCache) window.prefetchLearnerGrades();
    }, 900);
});

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
window.fetchGrades = async function () {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem('lastLearnerPage', 'grades');

    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Grades', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.learnerGradesCache) {
        renderGrades(window.learnerGradesCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const data = await loadGradesData();
        renderGrades(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#f85149;text-align:center;margin-top:60px;font-family:'Nunito',sans-serif;">
                Error loading grades. Please try again.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────────────────────
function renderGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const groups      = data.groups       || [];
    const currentTerm = data.current_term || 1;
    const viewerRole  = data.viewer_role  || 'learner';
    const targetEmail = data.target_email || '';

    const styles = `
    <style id="grades-styles">

    /* ══ DESKTOP SPLIT LAYOUT (>=900px) ══ */
    @media (min-width: 900px) {
        .grades-desktop-layout { display: flex !important; }
        .grades-mobile-layout  { display: none  !important; }
    }
    @media (max-width: 899px) {
        .grades-desktop-layout { display: none  !important; }
        .grades-mobile-layout  { display: block !important; }
    }

    .grades-desktop-layout {
        display: flex;
        gap: 0;
        height: calc(100vh - 140px);
        min-height: 500px;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 14px;
        overflow: hidden;
        margin-top: 4px;
    }

    .grades-desktop-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: #0d1117;
        flex-shrink: 0;
    }

    /* Left sidebar */
    .grades-dt-sidebar {
        width: 240px;
        min-width: 210px;
        max-width: 260px;
        background: #0d1117;
        border-right: 1px solid rgba(255,255,255,0.07);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex-shrink: 0;
    }
    .grades-dt-sidebar-header {
        padding: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: #4fd1c5;
        text-transform: uppercase;
        flex-shrink: 0;
    }
    .grades-dt-sidebar-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
    }
    .grades-dt-sidebar-scroll::-webkit-scrollbar { width: 4px; }
    .grades-dt-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .grades-dt-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .grades-dt-sidebar-footer {
        padding: 12px 14px;
        border-top: 1px solid rgba(255,255,255,0.07);
        flex-shrink: 0;
    }

    .grades-dt-subject-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: all 0.15s ease;
    }
    .grades-dt-subject-item:hover { background: rgba(255,255,255,0.04); }
    .grades-dt-subject-item.active {
        background: rgba(79,209,197,0.08);
        border-left-color: #4fd1c5;
    }
    .grades-dt-subject-icon { flex-shrink: 0; opacity: 0.7; }
    .grades-dt-subject-info { flex: 1; min-width: 0; }
    .grades-dt-subject-name {
        font-size: 13px;
        font-weight: 700;
        color: #c9d1d9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .grades-dt-subject-item.active .grades-dt-subject-name { color: #e2e8f0; }
    .grades-dt-subject-count { font-size: 11px; color: #555e6a; margin-top: 2px; }

    /* Right panel */
    .grades-dt-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #0d1117;
    }
    .grades-dt-panel-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px 24px;
    }
    .grades-dt-panel-scroll::-webkit-scrollbar { width: 5px; }
    .grades-dt-panel-scroll::-webkit-scrollbar-track { background: transparent; }
    .grades-dt-panel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

    .grades-dt-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #555e6a;
        gap: 12px;
        padding: 40px;
    }
    .grades-dt-empty svg { opacity: 0.3; }
    .grades-dt-empty p { font-size: 14px; margin: 0; }

    .grades-dt-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        flex-wrap: wrap;
        gap: 10px;
    }
    .grades-dt-panel-title {
        font-size: 18px;
        font-weight: 800;
        color: #e2e8f0;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .grades-dt-panel-count {
        font-size: 12px;
        color: #8b949e;
        font-weight: 600;
        background: rgba(255,255,255,0.05);
        padding: 2px 8px;
        border-radius: 20px;
    }

    /* ══ MOBILE / SHARED STYLES (unchanged) ══ */
    .grades-wrap { max-width: 780px; margin: 0 auto; padding-bottom: 60px; font-family: 'Nunito', sans-serif; }
    .grades-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
    .grades-title { font-size: 20px; font-weight: 800; color: #e2e8f0; margin: 0; }
    .grades-header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .grades-search {
        padding: 9px 14px;
        border-radius: 10px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: #e2e8f0;
        font-size: 13px;
        font-family: 'Nunito', sans-serif;
        width: 180px;
        transition: border-color 0.2s;
    }
    .grades-search:focus { outline: none; border-color: #4fd1c5; }
    .grades-search::placeholder { color: #555e6a; }
    .grades-report-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 9px 16px;
        background: rgba(79,209,197,0.1);
        color: #4fd1c5;
        border: 1px solid rgba(79,209,197,0.3);
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: 'Nunito', sans-serif;
        transition: all 0.2s;
    }
    .grades-report-btn:hover { background: rgba(79,209,197,0.2); }
    .subject-card { background: #161b22; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; margin-bottom: 16px; overflow: hidden; transition: border-color 0.2s; }
    .subject-card:hover { border-color: rgba(255,255,255,0.1); }
    .subject-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; user-select: none; }
    .subject-header:hover { background: rgba(255,255,255,0.02); }
    .subject-name { flex: 1; font-size: 16px; font-weight: 800; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .subject-count { font-size: 12px; color: #8b949e; font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 20px; }
    .subject-chevron { transition: transform 0.3s ease; color: #555e6a; flex-shrink: 0; }
    .subject-chevron.open { transform: rotate(90deg); }
    .view-toggle-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px 6px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .view-toggle-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: #8b949e; font-size: 12px; font-weight: 700; font-family: 'Nunito', sans-serif; text-transform: uppercase; letter-spacing: 0.8px; cursor: pointer; padding: 6px 10px; border-radius: 8px; transition: all 0.2s; }
    .view-toggle-btn:hover { background: rgba(79,209,197,0.08); color: #4fd1c5; }
    .view-toggle-btn.active-view { color: #4fd1c5; background: rgba(79,209,197,0.08); }
    .quiz-list { padding: 8px 16px 16px; }
    .quiz-row { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; margin-bottom: 8px; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
    .quiz-row:hover:not(.quiz-unpublished) { border-color: rgba(79,209,197,0.2); transform: translateX(3px); }
    .quiz-unpublished { opacity: 0.5; }
    .quiz-unpublished:hover { transform: none; }
    .quiz-row-header { display: flex; align-items: center; gap: 12px; padding: 13px 16px; cursor: pointer; }
    .quiz-row-icon { flex-shrink: 0; }
    .quiz-row-title { flex: 1; font-size: 14px; font-weight: 700; color: #4fd1c5; display: flex; align-items: center; gap: 6px; }
    .quiz-row-title a { color: #4fd1c5; text-decoration: none; transition: color 0.2s; }
    .quiz-row-title a:hover { color: #22c55e; }
    .quiz-unpublished .quiz-row-title { color: #8b949e; }
    .quiz-score-pill { font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
    .quiz-score-pill.high { background: rgba(34,197,94,0.15); color: #22c55e; }
    .quiz-score-pill.mid  { background: rgba(79,209,197,0.15); color: #4fd1c5; }
    .quiz-score-pill.low  { background: rgba(248,81,73,0.15); color: #f85149; }
    .quiz-score-pill.hidden-score { background: rgba(255,255,255,0.05); color: #555e6a; }
    .quiz-expand-btn { background: none; border: none; color: #555e6a; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.2s; flex-shrink: 0; }
    .quiz-expand-btn:hover { color: #4fd1c5; }
    .quiz-expand-btn svg { transition: transform 0.3s ease; }
    .quiz-expand-btn.open svg { transform: rotate(180deg); }
    .quiz-row-details { display: none; padding: 12px 16px 14px; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.2); font-size: 13px; color: #8b949e; line-height: 1.7; }
    .quiz-row-details p { margin: 2px 0; }
    .quiz-row-details strong { color: #c9d1d9; }
    .view-details-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(79,209,197,0.08); color: #4fd1c5; border: 1px solid rgba(79,209,197,0.2); padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'Nunito', sans-serif; cursor: pointer; margin-top: 6px; transition: background 0.2s; }
    .view-details-btn:hover { background: rgba(79,209,197,0.15); }
    .term-marks-view { padding: 0 16px 16px; }
    .term-selector-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
    .term-selector { padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e2e8f0; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; }
    .term-selector:focus { outline: none; border-color: #4fd1c5; }
    .term-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
    .term-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .term-table th { padding: 10px 14px; text-align: left; color: #4fd1c5; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .term-table th:not(:first-child) { text-align: center; }
    .term-table td { padding: 10px 14px; color: #c9d1d9; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .term-table td:not(:first-child) { text-align: center; }
    .term-table tr:last-child td { border-bottom: none; }
    .term-table tr:hover td { background: rgba(255,255,255,0.01); }
    .term-table-total td { font-weight: 800; color: #4fd1c5; border-top: 2px solid rgba(79,209,197,0.3) !important; padding-top: 12px; }
    .term-total-result { color: #22c55e; font-size: 14px; }
    .term-still-pending { text-align: center; font-size: 12px; color: #555e6a; padding: 10px 0 0; }
    .no-summative { text-align: center; color: #555e6a; font-style: italic; font-size: 13px; padding: 20px; }
    .review-link { color: #4fd1c5; font-size: 11px; text-decoration: none; margin-left: 6px; opacity: 0.7; }
    .review-link:hover { opacity: 1; }
    .summative-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: #4fd1c5; border: 1px solid rgba(79,209,197,0.3); padding: 1px 6px; border-radius: 10px; font-weight: 700; letter-spacing: 0.3px; }
    .grades-empty { text-align: center; color: #555e6a; font-size: 15px; padding: 60px 20px; }
    .g-modal-overlay { display: none !important; }

    /* Inline performance overview */
    .grade-inline-stats { margin-top: 14px; padding: 14px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
    .grade-inline-stats.loading, .grade-inline-stats.error { color: #8b949e; font-size: 12px; text-align: center; }
    .grade-inline-title { font-size: 12px; font-weight: 800; color: #e2e8f0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
    .grade-inline-grid { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; align-items: center; }
    .score-circle-wrap { position: relative; width: 96px; height: 96px; margin: 0; }
    .score-circle-wrap svg { transform: rotate(-90deg); display: block; width: 96px; height: 96px; }
    .sc-track { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 10; }
    .sc-fill { fill: none; stroke: #22c55e; stroke-width: 10; stroke-linecap: round; stroke-dasharray: 314; stroke-dashoffset: 314; transition: stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1); }
    .score-circle-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 22px; font-weight: 800; color: #fff; }
    .score-out-of { font-size: 13px; color: #8b949e; margin-bottom: 16px; }
    .dist-bar-wrap { position: relative; height: 10px; background: rgba(255,255,255,0.06); border-radius: 100px; margin: 24px 0 8px; }
    .dist-marker { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%, -50%); z-index: 5; transition: left 0.6s cubic-bezier(0.175,0.885,0.32,1.275); }
    .dist-marker.me { background: #fff; border: 3px solid #4fd1c5; }
    .dist-line { position: absolute; top: -8px; bottom: -4px; width: 2px; transform: translateX(-50%); }
    .dist-line.low  { background: #f85149; }
    .dist-line.avg  { background: #f59e0b; }
    .dist-line.high { background: #22c55e; }
    .dist-labels { display: flex; justify-content: space-between; font-size: 11px; color: #555e6a; margin-bottom: 14px; }
    .dist-legend { text-align: left; font-size: 12px; color: #8b949e; line-height: 1.8; background: rgba(255,255,255,0.02); border-radius: 8px; padding: 10px 14px; }
    .dist-legend span { font-weight: 700; }

    /* Report modal */
    .report-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9200; align-items: center; justify-content: center; }
    .report-modal-overlay.show { display: flex; }
    .report-modal-box { background: #0d1117; border-radius: 14px; width: 95vw; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }
    .report-modal-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); background: #161b22; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .report-modal-header span { font-size: 15px; font-weight: 800; color: #4fd1c5; }
    .report-modal-close { background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer; line-height: 1; }
    .report-modal-close:hover { color: #e2e8f0; }
    #gradesReportFrame { flex: 1; width: 100%; border: none; background: #0d1117; }

    @media (max-width: 768px) {
        .grades-search { width: 140px; }
        .grades-wrap {
            max-width: none;
            padding: 0 0 64px;
        }
        .grades-header {
            margin: 0 0 12px;
            padding: 0 2px;
        }
        .grades-header-right {
            width: 100%;
            justify-content: space-between;
        }
        .grades-mobile-layout .subject-card {
            background: #1a1919;
            border-color: rgba(255,255,255,0.05);
            border-radius: 12px;
            margin: 0 0 14px;
        }
        .grades-mobile-layout .subject-header {
            background: #1a1919;
            border-bottom-color: rgba(255,255,255,0.05);
            padding: 16px;
        }
        .grades-mobile-layout .subject-header:hover {
            background: #1a1919;
        }
        .grades-mobile-layout .view-toggle-bar {
            background: #1a1919;
            padding: 10px 16px 8px;
        }
        .grades-mobile-layout .quiz-list,
        .grades-mobile-layout .term-marks-view {
            background: #1a1919;
            padding: 8px 16px 16px;
        }
        .grades-mobile-layout .quiz-row {
            background: #1a1919;
            border-color: rgba(255,255,255,0.05);
            border-radius: 0;
            border-left: 0;
            border-right: 0;
            margin-bottom: 0;
        }
        .grades-mobile-layout .quiz-row + .quiz-row {
            border-top: 0;
        }
        .grades-mobile-layout .quiz-row-details {
            background: #151515;
        }
        .grades-mobile-layout .quiz-row-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #4fd1c518;
            border: 1px solid #4fd1c530;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .grades-mobile-layout .quiz-unpublished .quiz-row-icon {
            background: #f8514914;
            border-color: #f8514926;
        }
        .grade-inline-grid {
            grid-template-columns: 1fr;
            justify-items: center;
            gap: 10px;
        }
        .grade-inline-stats {
            padding: 13px;
        }
        .report-modal-box { width: 100vw; height: 100vh; border-radius: 0; }
    }
    </style>`;

    // ── BUILD SIDEBAR ITEMS ──────────────────────────────────────────────────
    let sidebarItemsHtml = '';
    if (groups.length === 0) {
        sidebarItemsHtml = `<p style="padding:16px;font-size:13px;color:#555e6a;">No results yet.</p>`;
    } else {
        groups.forEach((group, gi) => {
            const quizzes = group.quizzes;
            sidebarItemsHtml += `
                <div class="grades-dt-subject-item" id="grades-dt-item-${gi}"
                     onclick="selectDesktopGradeSubject(${gi})">
                    <div class="grades-dt-subject-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                    </div>
                    <div class="grades-dt-subject-info">
                        <div class="grades-dt-subject-name">${escHtml(group.group)}</div>
                        <div class="grades-dt-subject-count">${quizzes.length} assessment${quizzes.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>`;
        });
    }

    // ── BUILD MOBILE HTML (unchanged accordion) ──────────────────────────────
    let mobileHtml = `<div class="grades-wrap">`;
    mobileHtml += `
        <div class="grades-header">
            <div class="grades-header-right">
                ${groups.length > 0 ? `
                <input type="text" class="grades-search" id="gradesSearch"
                    placeholder="Search quiz..." oninput="gradesSearch(this.value)">
                ` : ''}
                <button class="grades-report-btn" onclick="generateGradesReport('${targetEmail}')">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Progress Report
                </button>
            </div>
        </div>`;

    if (groups.length === 0) {
        mobileHtml += `<div class="grades-empty">No quiz results found yet.</div>`;
    } else {
        groups.forEach((group, gi) => {
            const quizzes = group.quizzes;
            mobileHtml += `
            <div class="subject-card" id="scard-${gi}">
                <div class="subject-header" onclick="toggleSubjectCard(${gi})">
                    <div class="subject-name">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        ${escHtml(group.group)}
                        <span class="subject-count">${quizzes.length} assessment${quizzes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <svg class="subject-chevron open" id="scard-chev-${gi}"
                         viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
                <div id="scard-body-${gi}">
                    <div class="view-toggle-bar">
                        <button class="view-toggle-btn active-view" id="vt-list-${gi}"
                                onclick="switchGradesView(${gi},'list')">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                                <line x1="8" y1="18" x2="21" y2="18"/>
                                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                                <line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                            Quiz List
                        </button>
                        <button class="view-toggle-btn" id="vt-term-${gi}"
                                onclick="switchGradesView(${gi},'term')">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                <rect x="4" y="2" width="16" height="20" rx="2"/>
                                <line x1="8" y1="6" x2="16" y2="6"/>
                                <line x1="8" y1="10" x2="16" y2="10"/>
                                <line x1="8" y1="14" x2="16" y2="14"/>
                            </svg>
                            Term Marks
                        </button>
                    </div>
                    <div class="quiz-list" id="view-list-${gi}">
                        ${buildQuizList(quizzes, gi)}
                    </div>
                    <div class="term-marks-view" id="view-term-${gi}" style="display:none;">
                        <div class="term-selector-wrap">
                            <select class="term-selector" onchange="refreshTermTable(${gi}, this.value)">
                                ${[1,2,3,4].map(t =>
                                    `<option value="${t}" ${t === currentTerm ? 'selected' : ''}>Term ${t}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div id="term-table-wrap-${gi}">
                            ${buildTermTable(quizzes, currentTerm)}
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }
    mobileHtml += `</div>`;

    // ── ASSEMBLE FULL HTML ───────────────────────────────────────────────────
    let html = styles;

    // Desktop layout
    html += `
    <div class="grades-desktop-layout">
        <!-- Sidebar -->
        <div class="grades-dt-sidebar">
            <div class="grades-dt-sidebar-header">Subjects</div>
            <div class="grades-dt-sidebar-scroll">
                ${sidebarItemsHtml}
            </div>
            <div class="grades-dt-sidebar-footer">
                <button class="grades-report-btn" style="width:100%;justify-content:center;"
                        onclick="generateGradesReport('${targetEmail}')">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Progress Report
                </button>
            </div>
        </div>

        <!-- Main panel -->
        <div class="grades-dt-main">
            ${groups.length > 0 ? `
            <div class="grades-desktop-topbar">
                <span style="font-size:13px;font-weight:700;color:#8b949e;">Select a subject</span>
                <input type="text" class="grades-search" id="gradesSearchDt"
                    placeholder="Search quiz..." oninput="gradesSearchDesktop(this.value)">
            </div>` : ''}
            <div class="grades-dt-panel-scroll" id="grades-dt-panel">
                <div class="grades-dt-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    <p>Select a subject to view your grades</p>
                </div>
            </div>
        </div>
    </div>`;

    // Mobile layout
    html += `<div class="grades-mobile-layout">${mobileHtml}</div>`;

    // Performance modal (shared)
    html += `
    <div class="g-modal-overlay" id="gradeStatsModal">
        <div class="g-modal-box">
            <button class="g-modal-close" onclick="closeGradeStatsModal()">×</button>
            <div class="g-modal-title">Performance Overview</div>
            <div class="score-circle-wrap">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle class="sc-track" cx="60" cy="60" r="50"/>
                    <circle class="sc-fill"  cx="60" cy="60" r="50" id="gsCircle"/>
                </svg>
                <div class="score-circle-text" id="gsPercText">0%</div>
            </div>
            <div class="score-out-of" id="gsOutOf"></div>
            <div class="dist-bar-wrap">
                <div class="dist-line low"  id="gsLow"></div>
                <div class="dist-line avg"  id="gsAvg"></div>
                <div class="dist-line high" id="gsHigh"></div>
                <div class="dist-marker me" id="gsMe"></div>
            </div>
            <div class="dist-labels"><span>0%</span><span>Class Distribution</span><span>100%</span></div>
            <div class="dist-legend">
                <div><span style="color:#4fd1c5">●</span> Blue dot — your score</div>
                <div><span style="color:#f85149">|</span> Red line — lowest in class</div>
                <div><span style="color:#f59e0b">|</span> Yellow line — class average</div>
                <div><span style="color:#22c55e">|</span> Green line — highest in class</div>
            </div>
        </div>
    </div>`;

    apiArea.innerHTML = html;
    apiArea._gradesData = data;
    restoreGradesStateAfterRender();
    wireGradesScrollState();
    if (window.innerWidth >= 900 && groups.length > 0) {
        const state = getGradesState();
        const selected = Number.isInteger(parseInt(state.desktopSubject, 10))
            ? parseInt(state.desktopSubject, 10)
            : 0;
        if (apiArea._gradesData.groups[selected]) {
            window.selectDesktopGradeSubject(selected);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PANEL: SELECT SUBJECT
// ─────────────────────────────────────────────────────────────────────────────
window.selectDesktopGradeSubject = function (gi) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._gradesData) return;
    const groupIndex = parseInt(gi, 10);
    if (!Number.isInteger(groupIndex) || !apiArea._gradesData.groups?.[groupIndex]) return;

    document.querySelectorAll('.grades-dt-subject-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`grades-dt-item-${groupIndex}`);
    if (item) item.classList.add('active');
    saveGradesState({ desktopSubject: groupIndex });

    const group       = apiArea._gradesData.groups[groupIndex];
    const currentTerm = apiArea._gradesData.current_term || 1;
    const quizzes     = group.quizzes;
    const panel       = document.getElementById('grades-dt-panel');
    if (!panel) return;

    // Use a prefixed ID to avoid any clash with mobile IDs
    const pfx = `dt${groupIndex}`;

    panel.innerHTML = `
        <div class="grades-dt-panel-header">
            <h3 class="grades-dt-panel-title">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fd1c5" stroke-width="2" fill="none">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                ${escHtml(group.group)}
            </h3>
            <span class="grades-dt-panel-count">${quizzes.length} assessment${quizzes.length !== 1 ? 's' : ''}</span>
        </div>

        <div class="view-toggle-bar" style="padding-left:0;padding-right:0;margin-bottom:12px;">
            <button class="view-toggle-btn active-view" id="vt-list-${pfx}"
                    onclick="switchGradesView('${pfx}','list')">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Quiz List
            </button>
            <button class="view-toggle-btn" id="vt-term-${pfx}"
                    onclick="switchGradesView('${pfx}','term')">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <rect x="4" y="2" width="16" height="20" rx="2"/>
                    <line x1="8" y1="6" x2="16" y2="6"/>
                    <line x1="8" y1="10" x2="16" y2="10"/>
                    <line x1="8" y1="14" x2="16" y2="14"/>
                </svg>
                Term Marks
            </button>
        </div>

        <div class="quiz-list" id="view-list-${pfx}" style="padding:0 0 16px;">
            ${buildQuizList(quizzes, pfx)}
        </div>

        <div class="term-marks-view" id="view-term-${pfx}" style="display:none;padding:0 0 16px;">
            <div class="term-selector-wrap">
                <select class="term-selector" onchange="refreshTermTable('${pfx}', this.value, ${groupIndex})">
                    ${[1,2,3,4].map(t =>
                        `<option value="${t}" ${t === currentTerm ? 'selected' : ''}>Term ${t}</option>`
                    ).join('')}
                </select>
            </div>
            <div id="term-table-wrap-${pfx}">
                ${buildTermTable(quizzes, currentTerm)}
            </div>
        </div>`;
    restoreDesktopGradePanelState(pfx);
};

// Desktop sidebar search
window.gradesSearchDesktop = function (val) {
    const state = getGradesState();
    saveGradesState({ search: Object.assign({}, state.search, { desktop: val }) });
    const term = val.toLowerCase();
    document.querySelectorAll('.grades-dt-subject-item').forEach(item => {
        const name = item.querySelector('.grades-dt-subject-name').textContent.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD QUIZ LIST
// ─────────────────────────────────────────────────────────────────────────────
function buildQuizList(quizzes, gi) {
    if (!quizzes || quizzes.length === 0) return '<p class="no-summative">No quizzes found.</p>';

    return quizzes.map((q, qi) => {
        const published  = q.publish_marks === 1;
        const pct        = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0;
        const pillClass  = !published ? 'hidden-score' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
        const pillText   = published ? `${pct}%` : 'Pending';
        const titleHtml  = published
            ? `<span style="color:#4fd1c5;cursor:pointer;" onclick="openQuizReview(${q.result_id}, event)">${escHtml(q.quiz_title)}</span>`
            : escHtml(q.quiz_title);

        const summBadge = q.is_summative
            ? `<span class="summative-badge">
                <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>Term
               </span>` : '';

        const iconHtml = published
            ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6"  y1="20" x2="6"  y2="14"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#f85149" stroke-width="2" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
               </svg>`;

        const duration    = q.duration;
        const timeTaken   = formatDuration(q.time_taken, duration * 60);
        const submittedAt = formatDate(q.submitted_at);

        const detailsHtml = `
            <div class="quiz-row-details" id="qdetail-${gi}-${qi}">
                ${published ? `
                    <p><strong>Score:</strong> ${q.score} / ${q.total} &nbsp;·&nbsp; <strong>${pct}%</strong></p>
                ` : `<p style="color:#555e6a;font-style:italic;">Marks not published yet.</p>`}
                <p style="margin-top:8px;"><strong>Duration:</strong> ${duration} min</p>
                <p><strong>Time Taken:</strong> ${timeTaken}</p>
                <p><strong>Taken on:</strong> ${submittedAt}</p>
                ${published ? `<div class="grade-inline-stats loading" id="gstats-${gi}-${qi}" data-quiz-id="${q.quiz_id}">Loading performance overview...</div>` : ''}
            </div>`;

        return `
        <div class="quiz-row ${published ? '' : 'quiz-unpublished'}"
             data-title="${escAttr(q.quiz_title)}"
             data-score="${published ? pct : 0}">
            <div class="quiz-row-header" onclick="toggleQuizRow('qdetail-${gi}-${qi}', 'qexp-${gi}-${qi}', 'gstats-${gi}-${qi}')">
                <div class="quiz-row-icon">${iconHtml}</div>
                <div class="quiz-row-title">
                    ${titleHtml}
                    ${summBadge}
                </div>
                <span class="quiz-score-pill ${pillClass}">${pillText}</span>
                <button class="quiz-expand-btn" id="qexp-${gi}-${qi}" type="button"
                        onclick="event.stopPropagation(); toggleQuizRow('qdetail-${gi}-${qi}', 'qexp-${gi}-${qi}', 'gstats-${gi}-${qi}')">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
            </div>
            ${detailsHtml}
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD TERM TABLE
// ─────────────────────────────────────────────────────────────────────────────
function buildTermTable(quizzes, selectedTerm) {
    const summative = quizzes.filter(q =>
        q.is_summative && q.term_number === parseInt(selectedTerm)
    );

    if (summative.length === 0) {
        return `<p class="no-summative">No summative assessments in Term ${selectedTerm}.</p>`;
    }

    const published = summative.filter(q => q.publish_marks === 1);
    let weights      = published.map(q => parseFloat(q.weight_percent) || 0);
    let totalWeight  = weights.reduce((a, b) => a + b, 0);

    if (totalWeight > 100) {
        const factor = 100 / totalWeight;
        weights = weights.map(w => w * factor);
        totalWeight = 100;
    } else if (totalWeight === 0 && published.length > 0) {
        const equal = 100 / published.length;
        weights = published.map(() => equal);
        totalWeight = 100;
    }

    let pubIdx = 0;
    let earnedTotal = 0;

    let rows = summative.map(q => {
        if (q.publish_marks !== 1) {
            return `<tr>
                <td>${escHtml(q.quiz_title)}</td>
                <td>—</td><td>—</td><td>—</td>
            </tr>`;
        }
        const w       = weights[pubIdx++];
        const earned  = q.total > 0 ? (q.score / q.total) * w : 0;
        earnedTotal  += earned;
        return `<tr>
            <td>${escHtml(q.quiz_title)}</td>
            <td>${w.toFixed(1)}%</td>
            <td>${q.score}/${q.total}</td>
            <td style="color:#4fd1c5;font-weight:800;">${earned.toFixed(1)}/${w.toFixed(1)}</td>
        </tr>`;
    }).join('');

    const finalPct  = totalWeight > 0 ? Math.round((earnedTotal / totalWeight) * 100) : 0;
    const remaining = 100 - totalWeight;

    return `
    <div class="term-table-wrap">
        <table class="term-table">
            <thead>
                <tr><th>Quiz</th><th>Weight</th><th>Score</th><th>Earned</th></tr>
            </thead>
            <tbody>
                ${rows}
                <tr class="term-table-total">
                    <td>TOTAL</td>
                    <td>${totalWeight.toFixed(1)}%</td>
                    <td>—</td>
                    <td class="term-total-result">${earnedTotal.toFixed(1)}/${totalWeight.toFixed(1)} → ${finalPct}%</td>
                </tr>
            </tbody>
        </table>
    </div>
    ${remaining > 0 ? `<p class="term-still-pending">${remaining.toFixed(1)}% of term still to be assessed</p>` : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────
function restoreGradesStateAfterRender() {
    const state = getGradesState();
    const apiArea = document.getElementById('api-content-area');
    gradesRestoringState = true;

    try {
        if (state.search.mobile) {
            const input = document.getElementById('gradesSearch');
            if (input) {
                input.value = state.search.mobile;
                window.gradesSearch(state.search.mobile);
            }
        }

        if (state.search.desktop) {
            const input = document.getElementById('gradesSearchDt');
            if (input) {
                input.value = state.search.desktop;
                window.gradesSearchDesktop(state.search.desktop);
            }
        }

        if (state.openSubjects) {
            document.querySelectorAll('[id^="scard-body-"]').forEach(body => {
                const gi = body.id.replace('scard-body-', '');
                const open = state.openSubjects.includes(gi);
                const chev = document.getElementById(`scard-chev-${gi}`);
                body.style.display = open ? 'block' : 'none';
                if (chev) chev.classList.toggle('open', open);
            });
        }

        Object.keys(state.views).forEach(prefix => {
            if (!String(prefix).startsWith('dt')) window.switchGradesView(prefix, state.views[prefix]);
        });

        Object.keys(state.terms).forEach(prefix => {
            if (!String(prefix).startsWith('dt')) {
                const selector = document.querySelector(`#view-term-${prefix} .term-selector`);
                if (selector) selector.value = state.terms[prefix];
                window.refreshTermTable(prefix, state.terms[prefix]);
            }
        });

        (state.openRows || []).forEach(rowId => {
            if (!String(rowId).startsWith('qdetail-dt')) openQuizRowByDetailId(rowId);
        });

        if (state.desktopSubject !== null && state.desktopSubject !== undefined && apiArea?._gradesData?.groups?.[state.desktopSubject]) {
            window.selectDesktopGradeSubject(state.desktopSubject);
        }

        requestAnimationFrame(() => {
            const mainContent = document.querySelector('.main-content');
            const panel = document.getElementById('grades-dt-panel');
            if (mainContent && Number.isFinite(state.scroll.main)) mainContent.scrollTop = state.scroll.main;
            if (panel && Number.isFinite(state.scroll.panel)) panel.scrollTop = state.scroll.panel;
        });
    } finally {
        gradesRestoringState = false;
    }
}

function restoreDesktopGradePanelState(prefix) {
    const state = getGradesState();
    gradesRestoringState = true;
    try {
        if (state.views[prefix]) window.switchGradesView(prefix, state.views[prefix]);

        if (state.terms[prefix]) {
            const sourceGi = parseInt(String(prefix).replace('dt', ''), 10);
            const selector = document.querySelector(`#view-term-${prefix} .term-selector`);
            if (selector) selector.value = state.terms[prefix];
            window.refreshTermTable(prefix, state.terms[prefix], sourceGi);
        }

        (state.openRows || []).forEach(rowId => {
            if (String(rowId).startsWith(`qdetail-${prefix}-`)) openQuizRowByDetailId(rowId);
        });

        requestAnimationFrame(() => {
            const panel = document.getElementById('grades-dt-panel');
            if (panel && Number.isFinite(state.scroll.panel)) panel.scrollTop = state.scroll.panel;
        });
    } finally {
        gradesRestoringState = false;
    }
}

function openQuizRowByDetailId(detailId) {
    const detail = document.getElementById(detailId);
    if (!detail) return;
    const suffix = detailId.replace('qdetail-', '');
    const btn = document.getElementById(`qexp-${suffix}`);
    const stats = document.getElementById(`gstats-${suffix}`);
    detail.style.display = 'block';
    if (btn) btn.classList.add('open');
    if (stats) loadGradeStatsInline(stats.id);
}

function saveOpenQuizRows() {
    const openRows = Array.from(document.querySelectorAll('.quiz-row-details'))
        .filter(el => el.style.display === 'block')
        .map(el => el.id);
    saveGradesState({ openRows });
}

function wireGradesScrollState() {
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('grades-dt-panel');
    if (mainContent && mainContent.dataset.gradesScrollState !== '1') {
        mainContent.dataset.gradesScrollState = '1';
        mainContent.addEventListener('scroll', () => {
            const state = getGradesState();
            saveGradesState({ scroll: Object.assign({}, state.scroll, { main: mainContent.scrollTop }) });
        }, { passive: true });
    }
    if (panel && panel.dataset.gradesScrollState !== '1') {
        panel.dataset.gradesScrollState = '1';
        panel.addEventListener('scroll', () => {
            const state = getGradesState();
            saveGradesState({ scroll: Object.assign({}, state.scroll, { panel: panel.scrollTop }) });
        }, { passive: true });
    }
}

window.toggleSubjectCard = function (gi) {
    const body = document.getElementById(`scard-body-${gi}`);
    const chev = document.getElementById(`scard-chev-${gi}`);
    const open = chev.classList.contains('open');
    body.style.display = open ? 'none' : 'block';
    chev.classList.toggle('open', !open);
    const openSubjects = Array.from(document.querySelectorAll('[id^="scard-chev-"].open'))
        .map(el => el.id.replace('scard-chev-', ''));
    saveGradesState({ openSubjects });
};

window.toggleQuizRow = function (detailId, btnId, statsId) {
    const detail = document.getElementById(detailId);
    const btn    = document.getElementById(btnId);
    if (!detail) return;
    const isOpen = detail.style.display === 'block';
    detail.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.classList.toggle('open', !isOpen);
    if (!isOpen && statsId) loadGradeStatsInline(statsId);
    saveOpenQuizRows();
};

// Works for both mobile (numeric gi) and desktop (string pfx like "dt0")
window.switchGradesView = function (gi, view) {
    const listEl  = document.getElementById(`view-list-${gi}`);
    const termEl  = document.getElementById(`view-term-${gi}`);
    const btnList = document.getElementById(`vt-list-${gi}`);
    const btnTerm = document.getElementById(`vt-term-${gi}`);
    if (view === 'list') {
        listEl.style.display = 'block';
        termEl.style.display = 'none';
        btnList.classList.add('active-view');
        btnTerm.classList.remove('active-view');
    } else {
        listEl.style.display = 'none';
        termEl.style.display = 'block';
        btnList.classList.remove('active-view');
        btnTerm.classList.add('active-view');
    }
    const state = getGradesState();
    saveGradesState({ views: Object.assign({}, state.views, { [gi]: view }) });
};

// gi = ID prefix, term = selected term value, sourceGi = numeric group index (desktop only)
window.refreshTermTable = function (gi, term, sourceGi) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._gradesData) return;
    const groupIndex = sourceGi !== undefined ? sourceGi : gi;
    const group = apiArea._gradesData.groups[groupIndex];
    if (!group) return;
    document.getElementById(`term-table-wrap-${gi}`).innerHTML = buildTermTable(group.quizzes, term);
    const state = getGradesState();
    saveGradesState({ terms: Object.assign({}, state.terms, { [gi]: String(term) }) });
};

// Mobile search
window.gradesSearch = function (val) {
    const state = getGradesState();
    saveGradesState({ search: Object.assign({}, state.search, { mobile: val }) });
    const term = val.toLowerCase();
    document.querySelectorAll('.subject-card').forEach(card => {
        const subjectName = card.querySelector('.subject-name').textContent.toLowerCase();
        const rows        = card.querySelectorAll('.quiz-row');
        let visible = 0;
        rows.forEach(r => {
            const title = (r.dataset.title || '').toLowerCase();
            const show  = title.includes(term) || subjectName.includes(term);
            r.style.display = show ? 'block' : 'none';
            if (show) visible++;
        });
        card.style.display = visible || subjectName.includes(term) ? 'block' : 'none';
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE PERFORMANCE OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function renderGradeStatsBox(box, data) {
    const pct    = data.user_score || 0;
    const offset = 314 - (314 * (pct / 100));

    box.className = 'grade-inline-stats';
    box.dataset.loaded = '1';
    box.innerHTML = `
        <div class="grade-inline-title">Performance Overview</div>
        <div class="grade-inline-grid">
            <div class="score-circle-wrap">
                <svg viewBox="0 0 120 120">
                    <circle class="sc-track" cx="60" cy="60" r="50"/>
                    <circle class="sc-fill" cx="60" cy="60" r="50" style="stroke-dashoffset:${offset};"/>
                </svg>
                <div class="score-circle-text">${pct}%</div>
            </div>
            <div style="width:100%;">
                <div class="score-out-of">You scored ${escHtml(String(data.score_out_of || ''))}</div>
                <div class="dist-bar-wrap">
                    <div class="dist-line low" style="left:${data.min || 0}%"></div>
                    <div class="dist-line avg" style="left:${data.avg || 0}%"></div>
                    <div class="dist-line high" style="left:${data.max || 0}%"></div>
                    <div class="dist-marker me" style="left:${pct}%"></div>
                </div>
                <div class="dist-labels"><span>0%</span><span>Class Distribution</span><span>100%</span></div>
                <div class="dist-legend">
                    <div><span style="color:#4fd1c5">●</span> Blue dot - your score</div>
                    <div><span style="color:#f85149">|</span> Red line - lowest in class</div>
                    <div><span style="color:#f59e0b">|</span> Yellow line - class average</div>
                    <div><span style="color:#22c55e">|</span> Green line - highest in class</div>
                </div>
            </div>
        </div>`;
}

async function loadGradeStatsInline(statsId) {
    const box = document.getElementById(statsId);
    if (!box || box.dataset.loaded === '1' || box.dataset.loading === '1') return;

    const quizId = box.dataset.quizId;
    if (!quizId) return;

    if (window.learnerGradeStatsCache[quizId]) {
        renderGradeStatsBox(box, window.learnerGradeStatsCache[quizId]);
        return;
    }

    box.dataset.loading = '1';
    box.className = 'grade-inline-stats loading';
    box.textContent = 'Loading performance overview...';

    try {
        const res  = await fetch(`get_quiz_stats.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.learnerGradeStatsCache[quizId] = data;
        renderGradeStatsBox(box, data);
        const pct    = data.user_score || 0;
        const offset = 314 - (314 * (pct / 100));

        box.className = 'grade-inline-stats';
        box.dataset.loaded = '1';
        box.innerHTML = `
            <div class="grade-inline-title">Performance Overview</div>
            <div class="grade-inline-grid">
                <div class="score-circle-wrap">
                    <svg viewBox="0 0 120 120">
                        <circle class="sc-track" cx="60" cy="60" r="50"/>
                        <circle class="sc-fill" cx="60" cy="60" r="50" style="stroke-dashoffset:${offset};"/>
                    </svg>
                    <div class="score-circle-text">${pct}%</div>
                </div>
                <div style="width:100%;">
                    <div class="score-out-of">You scored ${escHtml(String(data.score_out_of || ''))}</div>
                    <div class="dist-bar-wrap">
                        <div class="dist-line low" style="left:${data.min || 0}%"></div>
                        <div class="dist-line avg" style="left:${data.avg || 0}%"></div>
                        <div class="dist-line high" style="left:${data.max || 0}%"></div>
                        <div class="dist-marker me" style="left:${pct}%"></div>
                    </div>
                    <div class="dist-labels"><span>0%</span><span>Class Distribution</span><span>100%</span></div>
                    <div class="dist-legend">
                        <div><span style="color:#4fd1c5">●</span> Blue dot - your score</div>
                        <div><span style="color:#f85149">|</span> Red line - lowest in class</div>
                        <div><span style="color:#f59e0b">|</span> Yellow line - class average</div>
                        <div><span style="color:#22c55e">|</span> Green line - highest in class</div>
                    </div>
                </div>
            </div>`;
    } catch (e) {
        box.className = 'grade-inline-stats error';
        box.textContent = 'Could not load class performance.';
    } finally {
        box.dataset.loading = '0';
    }
}

window.openGradeStats = function (quizId) {
    const box = document.querySelector(`.grade-inline-stats[data-quiz-id="${quizId}"]`);
    if (box) loadGradeStatsInline(box.id);
};

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS REPORT
// ─────────────────────────────────────────────────────────────────────────────
window.generateGradesReport = async function (targetEmail) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    if (!apiArea) return;
    const cacheKey = targetEmail || 'self';
    if (window.learnerProgressReportCache[cacheKey]) {
        renderProgressReport(window.learnerProgressReportCache[cacheKey]);
        return;
    }
    if (loader) loader.style.display = 'flex';
    try {
        const res  = await fetch(`api/learner/get_progress_report.php?learner=${encodeURIComponent(targetEmail)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.learnerProgressReportCache[cacheKey] = data;
        renderProgressReport(data);
    } catch (e) {
        if (loader) loader.style.display = 'none';
        alert('Could not load progress report.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderProgressReport(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!document.getElementById('pr-styles')) {
        const style = document.createElement('style');
        style.id = 'pr-styles';
        style.textContent = `
            .pr-wrap { max-width: 860px; margin: 0 auto; padding-bottom: 60px; font-family: 'Nunito', sans-serif; }
            .pr-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 10px; }
            .pr-back-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Nunito', sans-serif; cursor: pointer; transition: all 0.2s; }
            .pr-back-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
            .pr-print-btn { display: inline-flex; align-items: center; gap: 7px; background: rgba(79,209,197,0.1); border: 1px solid rgba(79,209,197,0.3); color: #4fd1c5; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Nunito', sans-serif; cursor: pointer; transition: all 0.2s; }
            .pr-print-btn:hover { background: rgba(79,209,197,0.2); }
            .pr-hero { background: #161b22; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px; display: flex; align-items: center; gap: 24px; margin-bottom: 24px; position: relative; overflow: hidden; }
            .pr-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #4fd1c5, #22c55e, #4e79a7); }
            .pr-logo { width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; background: rgba(255,255,255,0.05); }
            .pr-hero-info { flex: 1; }
            .pr-school-name { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #4fd1c5; margin-bottom: 6px; }
            .pr-learner-name { font-size: 22px; font-weight: 900; color: #e2e8f0; margin-bottom: 4px; }
            .pr-learner-meta { font-size: 13px; color: #8b949e; }
            .pr-overall-badge { text-align: center; flex-shrink: 0; }
            .pr-overall-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px solid; margin-bottom: 6px; }
            .pr-overall-pct { font-size: 22px; font-weight: 900; line-height: 1; }
            .pr-overall-label { font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #8b949e; margin-top: 2px; }
            .pr-overall-sub { font-size: 11px; color: #8b949e; }
            .pr-term-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
            .pr-term-tab { flex: 1; padding: 10px; text-align: center; background: #161b22; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; cursor: pointer; transition: all 0.2s; position: relative; }
            .pr-term-tab:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
            .pr-term-tab.active { background: rgba(79,209,197,0.08); border-color: rgba(79,209,197,0.35); }
            .pr-term-tab-label { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #8b949e; margin-bottom: 4px; }
            .pr-term-tab.active .pr-term-tab-label { color: #4fd1c5; }
            .pr-term-tab-avg { font-size: 18px; font-weight: 900; color: #e2e8f0; }
            .pr-term-tab.active .pr-term-tab-avg { color: #4fd1c5; }
            .pr-term-tab-sub { font-size: 10px; color: #555e6a; margin-top: 2px; }
            .pr-current-dot { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #4fd1c5; }
            .pr-subjects-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
            .pr-subject-card { background: #161b22; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px 18px 18px 20px; position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
            .pr-subject-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-2px); }
            .pr-subject-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px; background: var(--accent, #555e6a); }
            .pr-subject-name { font-size: 13px; font-weight: 800; color: #e2e8f0; margin-bottom: 16px; padding-right: 70px; line-height: 1.3; min-height: 32px; }
            .pr-subject-pct { position: absolute; top: 16px; right: 16px; font-size: 24px; font-weight: 900; line-height: 1; }
            .pr-subject-bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 100px; overflow: hidden; margin-bottom: 8px; }
            .pr-subject-bar-fill { height: 100%; border-radius: 100px; transition: width 0.7s cubic-bezier(0.4,0,0.2,1); }
            .pr-subject-meta { font-size: 11px; color: #555e6a; }
            .pr-subject-no-data { font-size: 12px; color: #555e6a; font-style: italic; padding: 10px 0 4px; }
            .pr-empty { text-align: center; color: #555e6a; padding: 60px 20px; font-size: 15px; }
            @media print {
                .pr-topbar { display: none !important; }
                .pr-term-tabs { display: none !important; }
                .pr-wrap { padding: 0; }
                .pr-hero { background: #f8f9fa !important; color: #000 !important; }
                .pr-subjects-grid { grid-template-columns: repeat(2,1fr); }
                .pr-subject-card { background: #fff !important; border: 1px solid #ddd !important; }
                .pr-subject-name { color: #000 !important; }
            }
            @media (max-width: 600px) {
                .pr-subjects-grid { grid-template-columns: 1fr; }
                .pr-hero { flex-direction: column; text-align: center; }
                .pr-term-tabs { flex-wrap: wrap; }
                .pr-term-tab { min-width: calc(50% - 4px); flex: none; }
            }
        `;
        document.head.appendChild(style);
    }

    const currentTerm = data.current_term || 1;
    const subjects    = data.subjects || [];

    function pctColor(v) {
        if (v === null) return { text: '#555e6a', bg: 'rgba(74,85,104,0.15)', border: '#555e6a' };
        if (v >= 80)   return { text: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: '#22c55e' };
        if (v >= 60)   return { text: '#4fd1c5', bg: 'rgba(79,209,197,0.15)',  border: '#4fd1c5' };
        if (v >= 40)   return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: '#f59e0b' };
        return           { text: '#f85149', bg: 'rgba(248,81,73,0.15)',    border: '#f85149' };
    }

    function termAvg(termNum) {
        const vals = subjects.map(s => s.terms[termNum]?.pct).filter(v => v !== null);
        return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : null;
    }

    const overallAvg = data.overall_avg;
    const oc = pctColor(overallAvg);

    const termTabsHtml = [1,2,3,4].map(t => {
        const avg = termAvg(t);
        const c   = pctColor(avg);
        const hasData = subjects.some(s => s.terms[t]?.pct !== null);
        return `
            <div class="pr-term-tab ${t === currentTerm ? 'active' : ''} ${!hasData ? 'pr-term-disabled' : ''}"
                 onclick="prSwitchTerm(${t})"
                 style="${!hasData ? 'opacity:0.35;pointer-events:none;' : ''}">
                ${t === currentTerm ? '<div class="pr-current-dot"></div>' : ''}
                <div class="pr-term-tab-label">Term ${t}</div>
                <div class="pr-term-tab-avg" style="color:${hasData ? c.text : '#555e6a'};">
                    ${avg !== null ? avg + '%' : '—'}
                </div>
                <div class="pr-term-tab-sub">${t === currentTerm ? 'Current' : (hasData ? 'Completed' : 'Upcoming')}</div>
            </div>`;
    }).join('');

    function buildSubjectCards(termNum) {
        if (!subjects.length) return `<div class="pr-empty">No assessments found.</div>`;
        return subjects.map(s => {
            const td  = s.terms[termNum] || {};
            const pct = td.pct ?? null;
            const c   = pctColor(pct);
            return `
                <div class="pr-subject-card" style="--accent:${c.border};">
                    <div class="pr-subject-name">${escHtmlPr(s.name)}</div>
                    <div class="pr-subject-pct" style="color:${c.text};">${pct !== null ? pct + '%' : '—'}</div>
                    ${pct !== null ? `
                        <div class="pr-subject-bar-track">
                            <div class="pr-subject-bar-fill" style="width:${pct}%;background:${c.text};"></div>
                        </div>
                        <div class="pr-subject-meta">
                            ${td.count} of ${td.total_count} assessment${td.total_count !== 1 ? 's' : ''} counted
                            ${td.remaining > 0 ? `· ${td.remaining}% still to come` : '· Complete'}
                        </div>
                    ` : `<div class="pr-subject-no-data">No assessments this term</div>`}
                </div>`;
        }).join('');
    }

    apiArea.innerHTML = `
        <div class="pr-wrap" id="pr-wrap">
            <div class="pr-topbar">
                <button class="pr-back-btn" onclick="prBackToGrades()">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to Grades
                </button>
                <button class="pr-print-btn" onclick="window.print()">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Print Report
                </button>
            </div>
            <div class="pr-hero">
                <img src="${data.school_logo}" alt="School Logo" class="pr-logo" onerror="this.style.display='none'">
                <div class="pr-hero-info">
                    <div class="pr-school-name">${escHtmlPr(data.school_name)}</div>
                    <div class="pr-learner-name">${escHtmlPr(data.learner_name)}</div>
                    <div class="pr-learner-meta">
                        ${escHtmlPr(data.learner_class)} &nbsp;·&nbsp;
                        Term ${currentTerm} Progress Report &nbsp;·&nbsp;
                        ${data.date}
                    </div>
                </div>
                <div class="pr-overall-badge">
                    <div class="pr-overall-circle" style="border-color:${oc.border};background:${oc.bg};">
                        <div class="pr-overall-pct" style="color:${oc.text};">${overallAvg !== null ? overallAvg + '%' : '—'}</div>
                        <div class="pr-overall-label">Overall</div>
                    </div>
                    <div class="pr-overall-sub">Term ${currentTerm} Average</div>
                </div>
            </div>
            <div class="pr-term-tabs" id="pr-term-tabs">${termTabsHtml}</div>
            <div class="pr-subjects-grid" id="pr-subjects-grid">${buildSubjectCards(currentTerm)}</div>
        </div>`;

    apiArea._prData            = data;
    apiArea._buildSubjectCards = buildSubjectCards;
    apiArea._pctColor          = pctColor;
}

window.prSwitchTerm = function (term) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._prData) return;
    document.querySelectorAll('.pr-term-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i + 1 === term);
    });
    const grid = document.getElementById('pr-subjects-grid');
    if (grid) grid.innerHTML = apiArea._buildSubjectCards(term);
};

window.prBackToGrades = function () {
    window.fetchGrades();
};

function escHtmlPr(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

window.closeGradesReport = function () {};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDuration(seconds, maxSeconds) {
    if (maxSeconds !== undefined && seconds > maxSeconds) seconds = maxSeconds;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

window.openQuizReview = function(resultId, event) {
    if (event) event.stopPropagation();
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');

    sessionStorage.setItem('lastLearnerPage', 'grades');
    if (window.configureHeader) {
        window.configureHeader({ title: 'Review', mode: 'detail', detailType: 'Review', backLabel: 'Grades' });
    }
    if (myClassContent) myClassContent.classList.remove('active');
    if (apiArea) apiArea.style.display = 'none';
    if (iframe)  {
        iframe.style.display = 'block';
        iframe.src = `review_quiz.php?result_id=${resultId}`;
    }
    if (mainContent) mainContent.scrollTop = 0;
};
