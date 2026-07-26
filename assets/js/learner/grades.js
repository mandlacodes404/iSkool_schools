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
        // manual.js owns the shared queue; retain it while normalising this helper.
        queueSave: typeof existing.queueSave === 'function' ? existing.queueSave.bind(existing) : undefined,
        flushQueuedSaves: typeof existing.flushQueuedSaves === 'function' ? existing.flushQueuedSaves.bind(existing) : undefined,
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
    state.openGroups = Array.isArray(state.openGroups) ? state.openGroups : [];
    state.views = state.views || {};
    state.terms = state.terms || {};
    state.search = state.search || {};
    state.scroll = state.scroll || {};
    state.desktopSelection = state.desktopSelection || null;
    return state;
}

function saveGradesState(patch) {
    if (gradesRestoringState) return;
    if (window.learnerPageState && typeof window.learnerPageState.update === 'function') {
        window.learnerPageState.update('grades', patch);
    }
}

function parseLearnerGradeTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function sortLearnerGradeGroups(groups) {
    return [...(groups || [])]
        .map((group, index) => {
            const quizzes = Array.isArray(group.quizzes)
                ? [...group.quizzes].sort((a, b) => parseLearnerGradeTime(b.submitted_at) - parseLearnerGradeTime(a.submitted_at))
                : [];
            const latestTime = quizzes.reduce((latest, quiz) => Math.max(latest, parseLearnerGradeTime(quiz.submitted_at)), 0);
            return { ...group, quizzes, _latestTime: latestTime, _originalIndex: index };
        })
        .sort((a, b) => (b._latestTime - a._latestTime) || (a._originalIndex - b._originalIndex))
        .map(({ _latestTime, _originalIndex, ...group }) => group);
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
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && loader) loader.style.display = 'flex';

    try {
        const data = await loadGradesData();
        renderGrades(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p class="grades-error-state">
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

    const groups      = sortLearnerGradeGroups(data.groups || []);
    data.groups = groups;
    const currentTerm = data.current_term || 1;
    const viewerRole  = data.viewer_role  || 'learner';
    const targetEmail = data.target_email || '';

    // (Styles for this markup now live in assets/css/learner/grades.css
    // -- the inline <style id="grades-styles"> block that used to be injected
    // here was removed as part of the inline-style cleanup.)

    // ── BUILD SIDEBAR ITEMS (collapsible groups, one quiz row each) ──────────
    window._allGradesQuizzesFlat = [];
    let sidebarItemsHtml = '';
    if (groups.length === 0) {
        sidebarItemsHtml = `<p class="grades-sidebar-empty">No results yet.</p>`;
    } else {
        let flatIdx = 0;
        groups.forEach((group, gi) => {
            const quizzes = group.quizzes;
            const groupId = `grades-dg-${gi}`;
            sidebarItemsHtml += `
                <div class="grades-dt-teacher-group">
                    <button type="button" class="grades-dt-teacher-header" onclick="toggleGradesDesktopGroup('${groupId}', this)">
                        <svg class="grades-dt-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <svg class="grades-dt-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="grades-dt-teacher-name">${escHtml(group.group)}</span>
                        <span class="grades-dt-teacher-count">${quizzes.length}</span>
                    </button>
                    <div class="grades-dt-teacher-body collapsed" id="${groupId}">
                        <div class="grades-dt-subject-item grades-dt-term-row" id="grades-dt-termbtn-${gi}"
                             onclick="selectDesktopGradeTerm(${gi})">
                            <div class="grades-dt-subject-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="4" y="2" width="16" height="20" rx="2"/>
                                    <line x1="8" y1="6" x2="16" y2="6"/>
                                    <line x1="8" y1="10" x2="16" y2="10"/>
                                    <line x1="8" y1="14" x2="16" y2="14"/>
                                </svg>
                            </div>
                            <div class="grades-dt-subject-info">
                                <div class="grades-dt-subject-name">Term Marks</div>
                            </div>
                        </div>`;
            quizzes.forEach((q, qi) => {
                const published = q.publish_marks == 1;
                const pct       = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0;
                const pillClass = !published ? 'hidden-score' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
                const pillText  = published ? `${pct}%` : 'Pending';

                sidebarItemsHtml += `
                        <div class="grades-dt-subject-item" id="grades-dt-item-${flatIdx}"
                             data-grade-quiz-index="${flatIdx}"
                             data-title="${escAttr(q.quiz_title || '').toLowerCase()}"
                             onclick="selectDesktopGradeQuiz(${flatIdx})">
                            <div class="grades-dt-subject-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="20" x2="18" y2="10"/>
                                    <line x1="12" y1="20" x2="12" y2="4"/>
                                    <line x1="6"  y1="20" x2="6"  y2="14"/>
                                </svg>
                            </div>
                            <div class="grades-dt-subject-info">
                                <div class="grades-dt-subject-name">${escHtml(q.quiz_title)}</div>
                            </div>
                            <span class="quiz-score-pill ${pillClass}">${pillText}</span>
                        </div>`;
                window._allGradesQuizzesFlat.push({ quiz: q, groupIndex: gi, quizIndexInGroup: qi });
                flatIdx++;
            });
            sidebarItemsHtml += `</div></div>`;
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
    let html = '';

    // Desktop layout
    html += `
    <div class="grades-desktop-layout lqz-flat-layout">
        <!-- Sidebar -->
        <div class="grades-dt-sidebar lqz-flat-sidebar">
            ${groups.length > 0 ? `
            <div class="grades-dt-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="grades-search" id="gradesSearchDt"
                    placeholder="Search quiz..." oninput="gradesSearchDesktop(this.value)">
            </div>` : ''}
            <button class="grades-dt-report-btn"
                    onclick="generateGradesReport('${targetEmail}')">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Progress Report
            </button>
            <div class="grades-dt-sidebar-scroll">
                ${sidebarItemsHtml}
            </div>
        </div>

        <!-- Main panel -->
        <div class="grades-dt-main lqz-flat-panel">
            <div class="grades-dt-panel-scroll" id="grades-dt-panel">
                <div class="grades-dt-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#68d391" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>Select an assessment to view your grade</p>
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
                <div><span class="dist-legend-dot--me">●</span> Your score</div>
                <div><span class="dist-legend-dot--low">|</span> Lowest in class</div>
                <div><span class="dist-legend-dot--avg">|</span> Class average</div>
                <div><span class="dist-legend-dot--high">|</span> Highest in class</div>
            </div>
        </div>
    </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
    apiArea._gradesData = data;
    restoreGradesStateAfterRender();
    wireGradesScrollState();
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP SIDEBAR: TOGGLE TEACHER/SUBJECT GROUP
// ─────────────────────────────────────────────────────────────────────────────
window.toggleGradesDesktopGroup = function (id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.grades-dt-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    const openGroups = Array.from(document.querySelectorAll('.grades-dt-teacher-body:not(.collapsed)')).map(el => el.id);
    saveGradesState({ openGroups });
};

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PANEL: SELECT QUIZ
// ─────────────────────────────────────────────────────────────────────────────
window.selectDesktopGradeQuiz = function (flatIdx) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._gradesData) return;
    const idx = parseInt(flatIdx, 10);
    const entry = (window._allGradesQuizzesFlat || [])[idx];
    if (!entry) return;

    document.querySelectorAll('.grades-dt-subject-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`grades-dt-item-${idx}`);
    if (item) item.classList.add('active');
    saveGradesState({ desktopSelection: { type: 'quiz', flatIdx: idx } });

    const { quiz: q, groupIndex, quizIndexInGroup } = entry;
    const panel = document.getElementById('grades-dt-panel');
    if (!panel) return;

    // Prefixed IDs to avoid clashing with mobile accordion IDs for the same quiz
    const pfx = `dt${groupIndex}-${quizIndexInGroup}`;

    const published  = q.publish_marks == 1;
    const pct         = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0;
    const pillClass   = !published ? 'hidden-score' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
    const pillText    = published ? `${pct}%` : 'Pending';
    const gradingStatus = buildOpenEndedGradingStatus(q);
    const duration    = q.duration;
    const timeTaken   = formatDuration(q.time_taken, duration * 60);
    const submittedAt = formatDate(q.submitted_at);
    const titleHtml   = published
        ? `<span class="quiz-title-link" onclick="openQuizReview(${q.result_id}, event)">${escHtml(q.quiz_title)}</span>`
        : escHtml(q.quiz_title);
    const summBadge = q.is_summative
        ? `<span class="summative-badge">
            <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
           </span>` : '';

    panel.innerHTML = `
        <div class="grades-dt-panel-header">
            <h3 class="grades-dt-panel-title">
                ${titleHtml}
                ${summBadge}
            </h3>
            <span class="quiz-score-pill ${pillClass}">${pillText}</span>
        </div>

        <div class="quiz-row-details" id="qdetail-${pfx}" style="display:block;">
            ${published ? `
                <p><strong>Score:</strong> ${escHtml(String(q.score))} / ${escHtml(String(q.total))} &nbsp;·&nbsp; <strong>${pct}%</strong></p>
            ` : `<p class="grades-unpublished-note">Marks not published yet.</p>`}
            ${gradingStatus.details}
            <p class="grades-detail-spaced"><strong>Duration:</strong> ${escHtml(String(duration))} min</p>
            <p><strong>Time Taken:</strong> ${escHtml(timeTaken)}</p>
            <p><strong>Taken on:</strong> ${escHtml(submittedAt)}</p>
            ${published ? `<div class="grade-inline-stats loading" id="gstats-${pfx}" data-quiz-id="${q.quiz_id}">Loading performance overview...</div>` : ''}
        </div>`;

    if (published) loadGradeStatsInline(`gstats-${pfx}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP PANEL: SELECT TERM MARKS FOR A GROUP
// ─────────────────────────────────────────────────────────────────────────────
window.selectDesktopGradeTerm = function (gi, term) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._gradesData) return;
    const groupIndex = parseInt(gi, 10);
    const group = apiArea._gradesData.groups?.[groupIndex];
    if (!group) return;
    const currentTerm = term !== undefined ? parseInt(term, 10) : (apiArea._gradesData.current_term || 1);

    document.querySelectorAll('.grades-dt-subject-item').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`grades-dt-termbtn-${groupIndex}`);
    if (btn) btn.classList.add('active');
    saveGradesState({ desktopSelection: { type: 'term', groupIndex, term: currentTerm } });

    const panel = document.getElementById('grades-dt-panel');
    if (!panel) return;
    const pfx = `dtterm${groupIndex}`;

    panel.innerHTML = `
        <div class="grades-dt-panel-header">
            <h3 class="grades-dt-panel-title">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="#68d391" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                ${escHtml(group.group)}
            </h3>
        </div>

        <div class="term-marks-view term-marks-view--dt-panel">
            <div class="term-selector-wrap">
                <select class="term-selector" onchange="selectDesktopGradeTerm(${groupIndex}, this.value)">
                    ${[1,2,3,4].map(t =>
                        `<option value="${t}" ${t === currentTerm ? 'selected' : ''}>Term ${t}</option>`
                    ).join('')}
                </select>
            </div>
            <div id="term-table-wrap-${pfx}">
                ${buildTermTable(group.quizzes, currentTerm)}
            </div>
        </div>`;
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
            details: '<p><strong>Grading Status:</strong> <span class="grades-status-text--done">Fully Graded</span></p>'
        };
    }

    return {
        badge: '<span class="quiz-grading-status partial">Partially Graded</span>',
        details: '<p><strong>Grading Status:</strong> <span class="grades-status-text--pending">Partially Graded</span></p>'
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
                ` : `<p class="grades-unpublished-note">Marks not published yet.</p>`}
                ${gradingStatus.details}
                <p class="grades-detail-spaced"><strong>Duration:</strong> ${escHtml(String(duration))} min</p>
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
            <td class="term-table-earned">${earned.toFixed(1)}/${w.toFixed(1)}</td>
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

        if (state.openGroups) {
            document.querySelectorAll('.grades-dt-teacher-body').forEach(body => {
                const open = state.openGroups.includes(body.id);
                body.classList.toggle('collapsed', !open);
                const header = body.previousElementSibling?.querySelector('.grades-dt-teacher-header');
                const chevron = header ? header.querySelector('.grades-dt-teacher-chevron') : null;
                if (chevron) chevron.classList.toggle('open', open);
            });
        }

        if (state.desktopSelection && apiArea?._gradesData) {
            if (state.desktopSelection.type === 'quiz'
                && (window._allGradesQuizzesFlat || [])[state.desktopSelection.flatIdx]) {
                window.selectDesktopGradeQuiz(state.desktopSelection.flatIdx);
            } else if (state.desktopSelection.type === 'term'
                && apiArea._gradesData.groups?.[state.desktopSelection.groupIndex]) {
                window.selectDesktopGradeTerm(state.desktopSelection.groupIndex, state.desktopSelection.term);
            }
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

// gi = ID prefix (mobile subject-card index), term = selected term value
// sourceGi param kept for signature compatibility but no longer passed by any caller
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
window.toggleDistTip = function(el) {
    const wasActive = el.classList.contains('active');
    el.parentElement.querySelectorAll('.dist-line.active, .dist-marker.active')
        .forEach(sibling => sibling.classList.remove('active'));
    if (!wasActive) el.classList.add('active');
};

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
            <div class="grade-inline-dist-wrap">
                <div class="score-out-of">You scored ${escHtml(String(data.score_out_of || ''))}</div>
                <div class="dist-bar-wrap">
                    <div class="dist-line low" style="left:${data.min || 0}%" onclick="toggleDistTip(this)">
                        <span class="dist-tip">${data.min || 0}%</span>
                    </div>
                    <div class="dist-line avg" style="left:${data.avg || 0}%" onclick="toggleDistTip(this)">
                        <span class="dist-tip">${data.avg || 0}%</span>
                    </div>
                    <div class="dist-line high" style="left:${data.max || 0}%" onclick="toggleDistTip(this)">
                        <span class="dist-tip">${data.max || 0}%</span>
                    </div>
                    <div class="dist-marker me" style="left:${pct}%" onclick="toggleDistTip(this)">
                        <span class="dist-tip">${pct}%</span>
                    </div>
                </div>
                <div class="dist-labels"><span>0%</span><span>Class Distribution</span><span>100%</span></div>
                <div class="dist-legend">
                    <div><span class="dist-legend-dot--me">●</span> Your score</div>
                    <div><span class="dist-legend-dot--low">|</span> Lowest in class</div>
                    <div><span class="dist-legend-dot--avg">|</span> Class average</div>
                    <div><span class="dist-legend-dot--high">|</span> Highest in class</div>
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
                <div class="grade-inline-dist-wrap">
                    <div class="score-out-of">You scored ${escHtml(String(data.score_out_of || ''))}</div>
                    <div class="dist-bar-wrap">
                        <div class="dist-line low" style="left:${data.min || 0}%" onclick="toggleDistTip(this)">
                            <span class="dist-tip">${data.min || 0}%</span>
                        </div>
                        <div class="dist-line avg" style="left:${data.avg || 0}%" onclick="toggleDistTip(this)">
                            <span class="dist-tip">${data.avg || 0}%</span>
                        </div>
                        <div class="dist-line high" style="left:${data.max || 0}%" onclick="toggleDistTip(this)">
                            <span class="dist-tip">${data.max || 0}%</span>
                        </div>
                        <div class="dist-marker me" style="left:${pct}%" onclick="toggleDistTip(this)">
                            <span class="dist-tip">${pct}%</span>
                        </div>
                    </div>
                    <div class="dist-labels"><span>0%</span><span>Class Distribution</span><span>100%</span></div>
                    <div class="dist-legend">
                        <div><span class="dist-legend-dot--me">●</span> Your score</div>
                        <div><span class="dist-legend-dot--low">|</span> Lowest in class</div>
                        <div><span class="dist-legend-dot--avg">|</span> Class average</div>
                        <div><span class="dist-legend-dot--high">|</span> Highest in class</div>
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
                .pr-card { border: none; }
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
                '<div class="pr-subject-icon" style="background:' + c.bg + ';color:' + c.text + ';">' +
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