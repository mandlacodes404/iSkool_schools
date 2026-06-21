/**
 * assets/js/grades.js
 * API-driven Grades page — mirrors the logic of the old quiz_history.php
 * Drop-in replacement: call fetchGrades() from sidebar / bottom nav
 */

window.learnerGradesCache = null;
window.learnerGradesCachePromise = null;
window.learnerGradeStatsCache = window.learnerGradeStatsCache || {};
window.learnerProgressReportCache = window.learnerProgressReportCache || {};

// Shared learner-side state helper. Normalize the helper because learner_dashboard
// may define it before this file with a smaller API.
(function ensureLearnerPageState() {
    const existing = window.learnerPageState || {};
    const prefix = existing.prefix || 'learnerPageState:';

    window.learnerPageState = {
        prefix,
        get(page) {
            if (typeof existing.get === 'function') {
                const value = existing.get(page);
                if (value && typeof value === 'object') return value;
            }
            try {
                const raw = sessionStorage.getItem(prefix + page) || sessionStorage.getItem(page);
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return {};
            }
        },
        set(page, state) {
            if (typeof existing.set === 'function') {
                existing.set(page, state || {});
                return;
            }
            try {
                sessionStorage.setItem(prefix + page, JSON.stringify(state || {}));
            } catch (e) {}
        },
        update(page, patch) {
            this.set(page, Object.assign({}, this.get(page), patch || {}));
        },
        clear(page) {
            if (typeof existing.clear === 'function') {
                existing.clear(page);
                return;
            }
            try {
                sessionStorage.removeItem(prefix + page);
                sessionStorage.removeItem(page);
            } catch (e) {}
        }
    };
})();

let gradesRestoringState = false;

function getGradesState() {
    const state = window.learnerPageState.get('grades') || {};
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
    if (window.learnerPageState && typeof window.learnerPageState.update === 'function') {
        window.learnerPageState.update('grades', patch);
    }
}

async function loadGradesData() {
    if (window.learnerGradesCache) return window.learnerGradesCache;
    if (!window.learnerGradesCachePromise) {
        window.learnerGradesCachePromise = fetch('api/learner/get_grades.php')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'error' || data.error) throw new Error(data.message || data.error);
                const payload = data.status === 'success' && data.data
                    ? Object.assign({}, data, data.data)
                    : data;
                window.learnerGradesCache = payload;
                return payload;
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
        window.configureHeader({ title: 'Grades', mode: 'standard', color: '#68d391' });
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
        color: #68d391;
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
        background: rgba(104,211,145,0.08);
        border-left-color: #68d391;
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
    .grades-search:focus { outline: none; border-color: #68d391; }
    .grades-search::placeholder { color: #555e6a; }
    .grades-report-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 9px 16px;
        background: rgba(104,211,145,0.1);
        color: #68d391;
        border: 1px solid rgba(104,211,145,0.3);
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: 'Nunito', sans-serif;
        transition: all 0.2s;
    }
    .grades-report-btn:hover { background: rgba(104,211,145,0.2); }
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
    .view-toggle-btn:hover { background: rgba(104,211,145,0.08); color: #68d391; }
    .view-toggle-btn.active-view { color: #68d391; background: rgba(104,211,145,0.08); }
    .quiz-list { padding: 8px 16px 16px; }
    .quiz-row { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; margin-bottom: 8px; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
    .quiz-row:hover:not(.quiz-unpublished) { border-color: rgba(104,211,145,0.2); transform: translateX(3px); }
    .quiz-unpublished { opacity: 0.5; }
    .quiz-unpublished:hover { transform: none; }
    .quiz-row-header { display: flex; align-items: center; gap: 12px; padding: 13px 16px; cursor: pointer; }
    .quiz-row-icon { flex-shrink: 0; }
    .quiz-row-title { flex: 1; font-size: 14px; font-weight: 700; color: #68d391; display: flex; align-items: center; gap: 6px; }
    .quiz-row-title a { color: #68d391; text-decoration: none; transition: color 0.2s; }
    .quiz-row-title a:hover { color: #22c55e; }
    .quiz-title-link { color: #68d391; cursor: pointer; }
    .quiz-unpublished .quiz-row-title { color: #8b949e; }
    @media (max-width: 899px) {
        .quiz-row-title { color: #e2e8f0; }
        .quiz-row-title a { color: #e2e8f0; }
        .quiz-row-title a:hover { color: #fff; }
        .quiz-title-link { color: #fff; }
        .quiz-unpublished .quiz-row-title { color: #8b949e; }
    }
    .quiz-score-pill { font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
    .quiz-score-pill.high { background: rgba(34,197,94,0.15); color: #22c55e; }
    .quiz-score-pill.mid  { background: rgba(104,211,145,0.15); color: #68d391; }
    .quiz-score-pill.low  { background: rgba(248,81,73,0.15); color: #f85149; }
    .quiz-score-pill.hidden-score { background: rgba(255,255,255,0.05); color: #555e6a; }
    .quiz-grading-status { display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:800; border-radius:999px; padding:2px 8px; white-space:nowrap; }
    .quiz-grading-status.pending { color:#f5c38b; background:rgba(242,140,56,0.12); border:1px solid rgba(242,140,56,0.28); }
    .quiz-grading-status.done { color:#22c55e; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.28); }
    .quiz-grading-status.partial { color:#f5c38b; background:rgba(242,140,56,0.12); border:1px solid rgba(242,140,56,0.28); }
    .quiz-expand-btn { background: none; border: none; color: #555e6a; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.2s; flex-shrink: 0; }
    .quiz-expand-btn:hover { color: #68d391; }
    .quiz-expand-btn svg { transition: transform 0.3s ease; }
    .quiz-expand-btn.open svg { transform: rotate(180deg); }
    .quiz-row-details { display: none; padding: 12px 16px 14px; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.2); font-size: 13px; color: #8b949e; line-height: 1.7; }
    .quiz-row-details p { margin: 2px 0; }
    .quiz-row-details strong { color: #c9d1d9; }
    .view-details-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(104,211,145,0.08); color: #68d391; border: 1px solid rgba(104,211,145,0.2); padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'Nunito', sans-serif; cursor: pointer; margin-top: 6px; transition: background 0.2s; }
    .view-details-btn:hover { background: rgba(104,211,145,0.15); }
    .term-marks-view { padding: 0 16px 16px; }
    .term-selector-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
    .term-selector { padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e2e8f0; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; }
    .term-selector:focus { outline: none; border-color: #68d391; }
    .term-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
    .term-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .term-table th { padding: 10px 14px; text-align: left; color: #68d391; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .term-table th:not(:first-child) { text-align: center; }
    .term-table td { padding: 10px 14px; color: #c9d1d9; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .term-table td:not(:first-child) { text-align: center; }
    .term-table tr:last-child td { border-bottom: none; }
    .term-table tr:hover td { background: rgba(255,255,255,0.01); }
    .term-table-total td { font-weight: 800; color: #68d391; border-top: 2px solid rgba(104,211,145,0.3) !important; padding-top: 12px; }
    .term-total-result { color: #22c55e; font-size: 14px; }
    .term-still-pending { text-align: center; font-size: 12px; color: #555e6a; padding: 10px 0 0; }
    .no-summative { text-align: center; color: #555e6a; font-style: italic; font-size: 13px; padding: 20px; }
    .review-link { color: #68d391; font-size: 11px; text-decoration: none; margin-left: 6px; opacity: 0.7; }
    .review-link:hover { opacity: 1; }
    .grades-mobile-review-frame {
        width: 100%;
        min-height: calc(100vh - 72px);
        border: 0;
        background: #0d1117;
        display: block;
    }
    .summative-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: #68d391; border: 1px solid rgba(104,211,145,0.3); padding: 1px 6px; border-radius: 10px; font-weight: 700; letter-spacing: 0.3px; }
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
    .dist-marker.me { background: #fff; border: 3px solid #68d391; }
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
    .report-modal-header span { font-size: 15px; font-weight: 800; color: #68d391; }
    .report-modal-close { background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer; line-height: 1; }
    .report-modal-close:hover { color: #e2e8f0; }
    #gradesReportFrame { flex: 1; width: 100%; border: none; background: #0d1117; }

    @media (max-width: 768px) {
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
            display: block;
        }
        .grades-mobile-search-wrap {
            display: block;
            margin-bottom: 10px;
            position: relative;
        }
        .grades-mobile-search-wrap svg {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            opacity: 0.4;
        }
        .grades-mobile-search-wrap .grades-search {
            width: 100%;
            box-sizing: border-box;
            padding: 9px 14px 9px 36px;
            border-radius: 10px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            color: #e2e8f0;
            font-size: 13px;
            font-family: 'Nunito', sans-serif;
            transition: border-color 0.2s;
        }
        .grades-mobile-search-wrap .grades-search:focus { outline: none; border-color: #68d391; }
        .grades-mobile-search-wrap .grades-search::placeholder { color: #555e6a; }
        .grades-report-btn {
            width: 100%;
            min-height: 35px;
            box-sizing: border-box;
            justify-content: center;
            padding: 9px 14px;
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
            background: #68d39118;
            border: 1px solid #68d39130;
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
                     data-grade-subject-index="${gi}"
                     onclick="selectDesktopGradeSubject(${gi})">
                    <div class="grades-dt-subject-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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
                <div class="grades-mobile-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="grades-search" id="gradesSearch"
                        placeholder="Search quiz..." oninput="gradesSearch(this.value)">
                </div>
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
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        ${escHtml(group.group)}
                        <span class="subject-count">${quizzes.length} assessment${quizzes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <svg class="subject-chevron" id="scard-chev-${gi}"
                         viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
                <div id="scard-body-${gi}" style="display:none;">
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
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#68d391" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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
                <div><span style="color:#68d391">●</span> Blue dot — your score</div>
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
    wireDesktopGradeSubjectClicks();
    if (window.innerWidth >= 900 && groups.length > 0) {
        const state = getGradesState();
        const selected = Number.isInteger(parseInt(state.desktopSubject, 10))
            ? parseInt(state.desktopSubject, 10)
            : 0;
        if (typeof window.selectDesktopGradeSubject === 'function' && apiArea._gradesData.groups[selected]) {
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
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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
function buildOpenEndedGradingStatus(q) {
    if (q.has_open_ended != 1) {
        return { badge: '', details: '' };
    }

    if (q.publish_marks != 1) {
        return {
            badge: '<span class="quiz-grading-status pending">Pending</span>',
            details: '<p><strong>Grading Status:</strong> Pending - awaiting teacher grading.</p>'
        };
    }

    if (q.quiz_fully_graded === true || q.is_fully_graded === true) {
        return {
            badge: '<span class="quiz-grading-status done">Fully Graded</span>',
            details: '<p><strong>Grading Status:</strong> <span style="color:#22c55e;font-weight:800;">Fully Graded</span></p>'
        };
    }

    return {
        badge: '<span class="quiz-grading-status partial">Partially Graded</span>',
        details: '<p><strong>Grading Status:</strong> <span style="color:#f5c38b;font-weight:800;">Partially Graded</span></p>'
    };
}

function buildQuizList(quizzes, gi) {
    if (!quizzes || quizzes.length === 0) return '<p class="no-summative">No quizzes found.</p>';

    return quizzes.map((q, qi) => {
        const published  = q.publish_marks == 1;
        const pct        = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0;
        const pillClass  = !published ? 'hidden-score' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
        const pillText   = published ? `${pct}%` : 'Pending';
        const gradingStatus = buildOpenEndedGradingStatus(q);
        const titleHtml  = published
            ? `<span class="quiz-title-link" onclick="openQuizReview(${q.result_id}, event)">${escHtml(q.quiz_title)}</span>`
            : escHtml(q.quiz_title);

        const summBadge = q.is_summative
            ? `<span class="summative-badge">
                <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
               </span>` : '';

        const iconHtml = published
            ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="2" fill="none">
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
                    <p><strong>Score:</strong> ${escHtml(String(q.score))} / ${escHtml(String(q.total))} &nbsp;·&nbsp; <strong>${pct}%</strong></p>
                ` : `<p style="color:#555e6a;font-style:italic;">Marks not published yet.</p>`}
                ${gradingStatus.details}
                <p style="margin-top:8px;"><strong>Duration:</strong> ${escHtml(String(duration))} min</p>
                <p><strong>Time Taken:</strong> ${escHtml(timeTaken)}</p>
                <p><strong>Taken on:</strong> ${escHtml(submittedAt)}</p>
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
            <td>${escHtml(String(q.score))}/${escHtml(String(q.total))}</td>
            <td style="color:#68d391;font-weight:800;">${earned.toFixed(1)}/${w.toFixed(1)}</td>
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

function wireDesktopGradeSubjectClicks() {
    const sidebar = document.querySelector('.grades-dt-sidebar-scroll');
    if (!sidebar || sidebar.dataset.gradesSubjectClicks === '1') return;
    sidebar.dataset.gradesSubjectClicks = '1';
    sidebar.addEventListener('click', event => {
        const item = event.target.closest('.grades-dt-subject-item');
        if (!item || !sidebar.contains(item)) return;
        window.selectDesktopGradeSubject(item.dataset.gradeSubjectIndex);
    });
}

window.toggleSubjectCard = function (gi) {
    const body = document.getElementById(`scard-body-${gi}`);
    const chev = document.getElementById(`scard-chev-${gi}`);
    if (!body || !chev) return;
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
    if (!listEl || !termEl || !btnList || !btnTerm) return;
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
    const tableWrap = document.getElementById(`term-table-wrap-${gi}`);
    if (!tableWrap) return;
    tableWrap.innerHTML = buildTermTable(group.quizzes, term);
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
                    <div><span style="color:#68d391">●</span> Blue dot - your score</div>
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
                        <div><span style="color:#68d391">●</span> Blue dot - your score</div>
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
            /* ── PROGRESS REPORT WRAP ── */
            .pr-wrap {
                max-width: 680px;
                margin: 0 auto;
                padding-bottom: 60px;
                font-family: 'Nunito', sans-serif;
                box-sizing: border-box;
            }

            /* ── TOPBAR ── */
            .pr-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 10px;
            }
            .pr-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                color: #c9d1d9;
                padding: 9px 16px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 700;
                font-family: 'Nunito', sans-serif;
                cursor: pointer;
                transition: all 0.2s;
            }
            .pr-back-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
            .pr-print-btn {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                background: rgba(104,211,145,0.1);
                border: 1px solid rgba(104,211,145,0.3);
                color: #68d391;
                padding: 9px 16px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 700;
                font-family: 'Nunito', sans-serif;
                cursor: pointer;
                transition: all 0.2s;
            }
            .pr-print-btn:hover { background: rgba(104,211,145,0.2); }

            /* ── MAIN CARD ── */
            .pr-card {
                background: #161b22;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 16px;
                overflow: hidden;
                margin-bottom: 20px;
            }

            /* ── SCHOOL BAND (coloured top strip) ── */
            .pr-school-band {
                background: #0d5c3a;
                padding: 18px 22px;
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .pr-logo-wrap {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                background: rgba(255,255,255,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                overflow: hidden;
                border: 2px solid rgba(255,255,255,0.2);
            }
            .pr-logo {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                object-fit: cover;
            }
            .pr-logo-fallback {
                font-size: 20px;
                color: rgba(255,255,255,0.9);
            }
            .pr-school-name {
                font-size: 15px;
                font-weight: 800;
                color: #d1fae5;
                margin: 0;
                line-height: 1.2;
            }
            .pr-school-sub {
                font-size: 12px;
                color: #6ee7b7;
                margin-top: 3px;
            }

            /* ── STUDENT ROW ── */
            .pr-student-row {
                padding: 18px 22px;
                display: flex;
                align-items: center;
                gap: 14px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .pr-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: rgba(104,211,145,0.12);
                border: 1px solid rgba(104,211,145,0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 17px;
                font-weight: 800;
                color: #68d391;
                flex-shrink: 0;
                letter-spacing: -0.5px;
            }
            .pr-learner-name {
                font-size: 17px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 3px;
                line-height: 1.2;
            }
            .pr-learner-meta {
                font-size: 13px;
                color: #8b949e;
            }
            .pr-status-badge {
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: rgba(34,197,94,0.12);
                border: 1px solid rgba(34,197,94,0.25);
                color: #22c55e;
                font-size: 12px;
                font-weight: 700;
                padding: 5px 12px;
                border-radius: 20px;
                white-space: nowrap;
                flex-shrink: 0;
            }

            /* ── AVERAGE STRIP ── */
            .pr-avg-strip {
                padding: 16px 22px;
                display: flex;
                align-items: center;
                gap: 0;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                flex-wrap: wrap;
            }
            .pr-avg-block { padding-right: 24px; }
            .pr-avg-label { font-size: 12px; color: #8b949e; margin-bottom: 3px; }
            .pr-avg-num {
                font-size: 32px;
                font-weight: 900;
                color: #22c55e;
                line-height: 1;
            }
            .pr-avg-denom { font-size: 13px; color: #555e6a; margin-left: 3px; }
            .pr-strip-divider {
                width: 1px;
                height: 36px;
                background: rgba(255,255,255,0.07);
                margin: 0 24px 0 0;
                flex-shrink: 0;
            }
            .pr-strip-item { padding-right: 24px; }
            .pr-strip-label { font-size: 11px; color: #8b949e; margin-bottom: 3px; }
            .pr-strip-val { font-size: 14px; font-weight: 700; color: #e2e8f0; }
            .pr-strip-status {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(34,197,94,0.12);
                border: 1px solid rgba(34,197,94,0.22);
                color: #22c55e;
                font-size: 12px;
                font-weight: 700;
                padding: 3px 10px;
                border-radius: 20px;
                margin-top: 2px;
            }

            /* ── TERM TABS ── */
            .pr-term-tabs {
                display: flex;
                gap: 8px;
                padding: 16px 22px 0;
                flex-wrap: wrap;
            }
            .pr-term-tab {
                flex: 1;
                min-width: 70px;
                padding: 10px 8px;
                text-align: center;
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            .pr-term-tab:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); }
            .pr-term-tab.active {
                background: rgba(104,211,145,0.08);
                border-color: rgba(104,211,145,0.35);
            }
            .pr-term-tab-label {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: #8b949e;
                margin-bottom: 4px;
            }
            .pr-term-tab.active .pr-term-tab-label { color: #68d391; }
            .pr-term-tab-avg { font-size: 17px; font-weight: 900; color: #e2e8f0; }
            .pr-term-tab.active .pr-term-tab-avg { color: #68d391; }
            .pr-term-tab-sub { font-size: 10px; color: #555e6a; margin-top: 2px; }
            .pr-current-dot {
                position: absolute;
                top: 7px;
                right: 7px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #68d391;
            }

            /* ── SUBJECTS SECTION ── */
            .pr-subjects-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 22px 10px;
            }
            .pr-subjects-title {
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: #8b949e;
            }
            .pr-subjects-col-hint {
                font-size: 11px;
                color: #555e6a;
            }

            /* ── SUBJECT ROWS ── */
            .pr-subjects-list { padding: 0 22px 6px; }
            .pr-subject-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 13px 0;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            .pr-subject-row:first-child { border-top: none; }
            .pr-subject-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: rgba(104,211,145,0.1);
                border: 1px solid rgba(104,211,145,0.18);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
                color: #68d391;
                font-weight: 800;
            }
            .pr-subject-info { min-width: 0; flex: 0 0 130px; }
            .pr-subject-name {
                font-size: 13px;
                font-weight: 800;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            .pr-subject-code { font-size: 11px; color: #555e6a; }
            .pr-subject-bars { flex: 1; display: flex; flex-direction: column; gap: 5px; }
            .pr-bar-row { display: flex; align-items: center; gap: 8px; }
            .pr-bar-tag { font-size: 10px; color: #555e6a; min-width: 46px; flex-shrink: 0; }
            .pr-bar-bg {
                flex: 1;
                height: 5px;
                background: rgba(255,255,255,0.06);
                border-radius: 100px;
                overflow: hidden;
            }
            .pr-bar-fill { height: 100%; border-radius: 100px; transition: width 0.7s cubic-bezier(0.4,0,0.2,1); }
            .pr-bar-pct { font-size: 11px; font-weight: 700; min-width: 32px; text-align: right; flex-shrink: 0; }
            .pr-subject-grade {
                width: 30px;
                height: 26px;
                border-radius: 7px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 800;
                flex-shrink: 0;
            }
            .pr-grade-a { background: rgba(34,197,94,0.14);  color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
            .pr-grade-b { background: rgba(59,130,246,0.14); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
            .pr-grade-c { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
            .pr-grade-d { background: rgba(248,81,73,0.14);  color: #f85149; border: 1px solid rgba(248,81,73,0.25); }
            .pr-subject-no-data { font-size: 12px; color: #555e6a; font-style: italic; flex: 1; }

            /* ── FOOTER LEGEND ── */
            .pr-footer-legend {
                padding: 12px 22px;
                border-top: 1px solid rgba(255,255,255,0.06);
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                align-items: center;
            }
            .pr-legend-item { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #8b949e; }
            .pr-legend-bar { width: 22px; height: 5px; border-radius: 100px; }
            .pr-grade-pills { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
            .pr-grade-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 6px; }

            /* ── EMPTY STATE ── */
            .pr-empty { text-align: center; color: #555e6a; padding: 50px 20px; font-size: 14px; }

            /* ── PRINT ── */
            @media print {
                .pr-topbar { display: none !important; }
                .pr-term-tabs { display: none !important; }
                .pr-wrap { padding: 0; max-width: 100%; }
                .pr-card { background: #fff !important; border: 1px solid #ddd !important; }
                .pr-school-band { background: #0d5c3a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .pr-learner-name, .pr-subject-name { color: #111 !important; }
                .pr-avg-num { color: #16a34a !important; }
            }

            /* ── MOBILE ── */
            @media (max-width: 600px) {
                .pr-wrap { padding-bottom: 80px; }
                .pr-school-band { padding: 14px 16px; gap: 12px; }
                .pr-school-name { font-size: 14px; }
                .pr-student-row { padding: 14px 16px; flex-wrap: wrap; gap: 10px; }
                .pr-status-badge { margin-left: 0; }
                .pr-avg-strip { padding: 14px 16px; gap: 0; flex-wrap: wrap; row-gap: 10px; }
                .pr-strip-divider { display: none; }
                .pr-avg-block { width: 100%; padding-right: 0; margin-bottom: 6px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
                .pr-strip-item { flex: 1; min-width: 90px; padding-right: 0; }
                .pr-term-tabs { padding: 14px 16px 0; gap: 6px; }
                .pr-term-tab { min-width: calc(50% - 4px); flex: none; padding: 10px 6px; }
                .pr-subjects-header { padding: 14px 16px 8px; flex-direction: column; align-items: flex-start; gap: 4px; }
                .pr-subjects-list { padding: 0 16px 6px; }
                .pr-subject-info { flex: 0 0 100px; }
                .pr-subject-row { gap: 8px; }
                .pr-bar-tag { font-size: 9px; min-width: 38px; }
                .pr-footer-legend { padding: 12px 16px; gap: 12px; }
                .pr-grade-pills { margin-left: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const currentTerm = data.current_term || 1;
    const subjects    = data.subjects || [];

    function pctColor(v) {
        if (v === null) return { text: '#555e6a', bg: 'rgba(74,85,104,0.15)', border: '#555e6a' };
        if (v >= 80)   return { text: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: '#22c55e' };
        if (v >= 60)   return { text: '#68d391', bg: 'rgba(104,211,145,0.15)',  border: '#68d391' };
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

    function gradeLabel(pct) {
        if (pct === null) return { letter: '?', cls: '' };
        if (pct >= 80) return { letter: 'A', cls: 'pr-grade-a' };
        if (pct >= 60) return { letter: 'B', cls: 'pr-grade-b' };
        if (pct >= 50) return { letter: 'C', cls: 'pr-grade-c' };
        return { letter: 'D', cls: 'pr-grade-d' };
    }

    function subjectInitial(name) {
        return (name || '?')[0].toUpperCase();
    }

    function buildSubjectCards(termNum) {
        if (!subjects.length) return '<div class="pr-empty">No assessments found.</div>';
        return subjects.map(function(s) {
            const td      = s.terms[termNum] || {};
            const pct     = td.pct != null ? td.pct : null;
            const covered = td.remaining != null ? Math.round(100 - td.remaining) : null;
            const c       = pctColor(pct);
            const gl      = gradeLabel(pct);

            if (pct === null) {
                return '<div class="pr-subject-row">' +
                    '<div class="pr-subject-icon">' + subjectInitial(s.name) + '</div>' +
                    '<div class="pr-subject-info">' +
                        '<div class="pr-subject-name">' + escHtmlPr(s.name) + '</div>' +
                        '<div class="pr-subject-code">' + escHtmlPr(s.code || '') + '</div>' +
                    '</div>' +
                    '<div class="pr-subject-no-data">No assessments this term</div>' +
                '</div>';
            }

            const coveredPct = covered !== null ? covered : 0;
            const coveredTxt = covered !== null ? covered + '%' : '—';
            const codeText   = escHtmlPr(s.code || (td.count + ' assessment' + (td.count !== 1 ? 's' : '')));

            return '<div class="pr-subject-row">' +
                '<div class="pr-subject-icon" style="background:' + c.bg + ';border-color:' + c.border + '30;color:' + c.text + ';">' +
                    subjectInitial(s.name) +
                '</div>' +
                '<div class="pr-subject-info">' +
                    '<div class="pr-subject-name">' + escHtmlPr(s.name) + '</div>' +
                    '<div class="pr-subject-code">' + codeText + '</div>' +
                '</div>' +
                '<div class="pr-subject-bars">' +
                    '<div class="pr-bar-row">' +
                        '<span class="pr-bar-tag">Mark</span>' +
                        '<div class="pr-bar-bg"><div class="pr-bar-fill" style="width:' + Math.round(pct) + '%;background:' + c.text + ';"></div></div>' +
                        '<span class="pr-bar-pct" style="color:' + c.text + ';">' + Math.round(pct) + '%</span>' +
                    '</div>' +
                    '<div class="pr-bar-row">' +
                        '<span class="pr-bar-tag">Covered</span>' +
                        '<div class="pr-bar-bg"><div class="pr-bar-fill" style="width:' + coveredPct + '%;background:' + c.text + ';opacity:0.35;"></div></div>' +
                        '<span class="pr-bar-pct" style="color:' + c.text + ';opacity:0.7;">' + coveredTxt + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="pr-subject-grade ' + gl.cls + '">' + gl.letter + '</div>' +
            '</div>';
        }).join('');
    }

    function initials(name) {
        return (name || '').split(' ').filter(Boolean).slice(0,2).map(function(w){ return w[0].toUpperCase(); }).join('');
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

            <div class="pr-card">

                <div class="pr-school-band">
                    <div class="pr-logo-wrap">
                        <img src="${escAttr(data.school_logo)}" alt="School Logo" class="pr-logo"
                             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                        <span class="pr-logo-fallback" style="display:none;">
                            <svg viewBox="0 0 24 24" width="22" height="22" stroke="rgba(255,255,255,0.85)" stroke-width="1.8" fill="none">
                                <path d="M22 10v12H2V10"/><path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M7 9.5v5M17 9.5v5M12 14.5v5"/>
                            </svg>
                        </span>
                    </div>
                    <div>
                        <div class="pr-school-name">${escHtmlPr(data.school_name)}</div>
                        <div class="pr-school-sub">Progress Report &nbsp;&middot;&nbsp; Term ${currentTerm}, ${escHtmlPr(data.date)}</div>
                    </div>
                </div>

                <div class="pr-student-row">
                    <div class="pr-avatar">${initials(data.learner_name)}</div>
                    <div>
                        <div class="pr-learner-name">${escHtmlPr(data.learner_name)}</div>
                        <div class="pr-learner-meta">${escHtmlPr(data.learner_class)}</div>
                    </div>
                    <div class="pr-status-badge">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                            <polyline points="17 6 23 6 23 12"/>
                        </svg>
                        On Track
                    </div>
                </div>

                <div class="pr-avg-strip">
                    <div class="pr-avg-block">
                        <div class="pr-avg-label">Overall average</div>
                        <div style="display:flex;align-items:baseline;gap:4px;">
                            <div class="pr-avg-num" style="color:${oc.text};">${overallAvg !== null ? overallAvg + '%' : '&mdash;'}</div>
                            <span class="pr-avg-denom">/ 100</span>
                        </div>
                    </div>
                    <div class="pr-strip-divider"></div>
                    <div class="pr-strip-item">
                        <div class="pr-strip-label">Term</div>
                        <div class="pr-strip-val">Term ${currentTerm}</div>
                    </div>
                    <div class="pr-strip-divider"></div>
                    <div class="pr-strip-item">
                        <div class="pr-strip-label">Report date</div>
                        <div class="pr-strip-val">${escHtmlPr(data.date)}</div>
                    </div>
                    <div class="pr-strip-divider"></div>
                    <div class="pr-strip-item">
                        <div class="pr-strip-label">Status</div>
                        <div class="pr-strip-status">
                            <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                            </svg>
                            On Track
                        </div>
                    </div>
                </div>

                <div class="pr-term-tabs" id="pr-term-tabs">${termTabsHtml}</div>

                <div class="pr-subjects-header">
                    <span class="pr-subjects-title">Subject results</span>
                    <span class="pr-subjects-col-hint">Mark earned &nbsp;&middot;&nbsp; Mark covered</span>
                </div>

                <div class="pr-subjects-list" id="pr-subjects-grid">${buildSubjectCards(currentTerm)}</div>

                <div class="pr-footer-legend">
                    <div class="pr-legend-item">
                        <div class="pr-legend-bar" style="background:#22c55e;"></div>
                        Mark earned so far
                    </div>
                    <div class="pr-legend-item">
                        <div class="pr-legend-bar" style="background:rgba(34,197,94,0.3);"></div>
                        % of mark covered this term
                    </div>
                    <div class="pr-grade-pills">
                        <span class="pr-grade-pill pr-grade-a">A 80&ndash;100</span>
                        <span class="pr-grade-pill pr-grade-b">B 60&ndash;79</span>
                        <span class="pr-grade-pill pr-grade-c">C 50&ndash;59</span>
                        <span class="pr-grade-pill pr-grade-d">D &lt;50</span>
                    </div>
                </div>

            </div>
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
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const isMobileGradesView = window.innerWidth <= 899;
    const reviewUrl = `review_quiz.php?result_id=${encodeURIComponent(resultId)}`;

    sessionStorage.setItem('lastLearnerPage', 'grades');
    if (window.configureHeader) {
        window.configureHeader({ title: 'Review', mode: 'detail', detailType: 'Review', backLabel: 'Grades' });
    }
    if (myClassContent) myClassContent.classList.remove('active');
    if (apiArea) apiArea.style.display = 'none';
    if (iframe)  {
        iframe.style.display = 'block';
        iframe.src = reviewUrl;
        if (isMobileGradesView) {
            iframe.classList.add('grades-mobile-review-frame');
            iframe.setAttribute('title', 'Quiz review');
        } else {
            iframe.classList.remove('grades-mobile-review-frame');
        }
    }
    if (isMobileGradesView && mobileBottomNav) {
        mobileBottomNav.style.setProperty('display', 'none', 'important');
    }
    if (mainContent) mainContent.scrollTop = 0;
};