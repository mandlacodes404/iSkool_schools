/**
 * assets/js/grades.js
 * API-driven Grades page — mirrors the logic of the old quiz_history.php
 * Drop-in replacement: call fetchGrades() from sidebar / bottom nav
 */

window.learnerGradesCache = null;
window.learnerGradesCachePromise = null;
window.learnerGradeStatsCache = window.learnerGradeStatsCache || {};
window.learnerProgressReportCache = window.learnerProgressReportCache || {};
window.learnerQuizReviewCache = window.learnerQuizReviewCache || {};

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
    const navigation = window.beginLearnerViewNavigation?.('grades');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem('lastLearnerPage', 'grades');
    if (typeof window.setActive === 'function') window.setActive('grades');

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

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const data = await loadGradesData();
        if (!isCurrentNavigation()) return;
        renderGrades(data);
    } catch (e) {
        if (!isCurrentNavigation()) return;
        if (apiArea) apiArea.innerHTML = `
            <p class="grades-error-state">
                Error loading grades. Please try again.
            </p>`;
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
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
                <div class="grades-mobile-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="grades-search" id="gradesSearch"
                        placeholder="Search quiz..." oninput="gradesSearch(this.value)">
                </div>
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
        mobileHtml += `
            <div class="grades-mobile-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="#68d391" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6"  y1="20" x2="6"  y2="14"/>
                </svg>
                <p class="grades-mobile-empty-title">No grades yet</p>
                <p class="grades-mobile-empty-body">Your teachers haven't published any grades. Check back soon.</p>
            </div>`;
    } else {
        groups.forEach((group, gi) => {
            const quizzes = group.quizzes;
            mobileHtml += `
            <div class="subject-card" id="scard-${gi}">
                <div class="subject-header subject-header--collapsed" onclick="toggleSubjectCard(${gi})">
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
            <div class="grades-dt-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="grades-search" id="gradesSearchDt"
                    placeholder="Search quiz..." oninput="gradesSearchDesktop(this.value)">
            </div>
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
                    <p>${groups.length > 0 ? 'Select an assessment to view your grade' : "Your teachers haven't published any grades yet."}</p>
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

    // Desktop doesn't have this dynamic bottom-nav/header behaviour, so
    // window.recalcMobileScrollUI won't exist there —
    // recheckMobileNavAfterToggle() already no-ops safely when it's missing.
    recheckMobileNavAfterToggle();
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
            ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#68d391" stroke-width="1.3" fill="none">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6"  y1="20" x2="6"  y2="14"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#f85149" stroke-width="1.3" fill="none">
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
                const header = chev ? chev.closest('.subject-header') : null;
                body.style.display = open ? 'block' : 'none';
                if (chev) chev.classList.toggle('open', open);
                if (header) header.classList.toggle('subject-header--collapsed', !open);
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


// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a subject card or quiz row is expanded/collapsed — same
// fix as in announcements.js / assignments.js. A single delayed check
// would need to know the exact CSS transition duration used for the
// collapse/expand animation (unknown from here, and could change) —
// polling a few times over ~400ms means it settles on the right answer
// regardless of how long that transition actually takes.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

window.toggleSubjectCard = function (gi) {
    const body = document.getElementById(`scard-body-${gi}`);
    const chev = document.getElementById(`scard-chev-${gi}`);
    const header = chev ? chev.closest('.subject-header') : null;
    if (!body || !chev) return;
    const open = chev.classList.contains('open');
    body.style.display = open ? 'none' : 'block';
    chev.classList.toggle('open', !open);
    if (header) header.classList.toggle('subject-header--collapsed', open);
    const openSubjects = Array.from(document.querySelectorAll('[id^="scard-chev-"].open'))
        .map(el => el.id.replace('scard-chev-', ''));
    saveGradesState({ openSubjects });

    // Opening/closing a subject card changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the card toggled.
    recheckMobileNavAfterToggle();
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

    // Same reasoning as toggleSubjectCard above — expanding a quiz row's
    // detail also changes scrollable height without a real scroll event.
    recheckMobileNavAfterToggle();
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

// Injects the shared <style id="pr-styles"> block (Progress Report card,
// mobile full-screen sheet treatment, hero header, subject rows, and the
// Quiz Review sheet's own .review-modal-sheet/.review-modal-frame rules --
// all of it lives in this one block). Guarded so it only runs once no
// matter which entry point calls it first.
//
// BUG FIX: this used to be inlined directly inside renderProgressReport(),
// so the styles only existed once the Progress Report sheet had been opened
// at least once. openQuizReview() never called renderProgressReport() and
// never injected this stylesheet itself, so opening Quiz Review first (with
// Progress Report never opened yet) produced a modal/sheet with correct DOM
// and correct JS wiring (wireSheetDragToClose ran fine) but NO CSS at all --
// .pr-modal-overlay wasn't fixed/full-screen, .pr-modal-sheet had no
// background or slide-up transform, etc. It looked like the sheet "didn't
// open" but really it opened unstyled and invisible/inert. Extracting the
// injection into its own function callable from both entry points fixes
// this at the source instead of duplicating the styles.
function ensurePrStylesInjected() {
    if (document.getElementById('pr-styles')) return;
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

            /* ── MAIN CARD ── */
            .pr-card {
                background: #161b22;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 16px;
                overflow: hidden;
                margin-bottom: 20px;
            }

            /* The report's only header, shown on every viewport (desktop
               right panel and the mobile sheet alike): top line
               (school/term + status), name + overall average sharing a
               row, then a slim term-trend line that also drives term
               switching (see prSwitchTerm). */
            .pr-hero { display: block; }
            .pr-hero-topline {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 16px 12px;
                gap: 10px;
            }
            .pr-hero-school {
                display: flex;
                align-items: center;
                gap: 7px;
                min-width: 0;
                flex: 1;
                font-size: 12px;
                color: #8b949e;
            }
            .pr-hero-school > span {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                min-width: 0;
            }
            .pr-hero-status {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.3px;
                color: #68d391;
                background: rgba(104,211,145,0.12);
                padding: 4px 9px;
                border-radius: 100px;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .pr-hero-idrow {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0 16px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .pr-hero-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(104,211,145,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 800;
                color: #68d391;
                flex-shrink: 0;
            }
            .pr-hero-nameblock { flex: 1; min-width: 0; }
            .pr-hero-name {
                font-size: 14px;
                font-weight: 700;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .pr-hero-class { font-size: 11px; color: #8b949e; margin-top: 1px; }
            .pr-hero-avgblock { text-align: right; flex-shrink: 0; }
            .pr-hero-avgnum { font-size: 26px; font-weight: 900; line-height: 1; }
            .pr-hero-avglabel { font-size: 10px; color: #555e6a; margin-top: 3px; }
            .pr-hero-trendrow {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .pr-hero-trendlabel {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: #555e6a;
            }
            .pr-hero-trenditems { display: flex; gap: 14px; }
            .pr-hero-trenditem { display: flex; align-items: center; gap: 5px; }
            .pr-hero-trenditem-t { font-size: 10px; color: #8b949e; }
            .pr-hero-trenditem-v { font-size: 12px; font-weight: 800; }
            .pr-hero-trenditem.pr-hero-trend-current .pr-hero-trenditem-t { color: #68d391; }
            .pr-hero-trenditem.pr-hero-trend-disabled { opacity: 0.4; }

            /* ── SUBJECTS SECTION ── */
            .pr-subjects-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18.4px 25.3px 11.5px;
            }
            .pr-subjects-title {
                font-size: 12.65px;
                font-weight: 800;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: #8b949e;
            }

            /* ── SUBJECT ROWS ── grade-letter colors, shared by the v2
               subject badges below and the footer's grade-pill legend. */
            .pr-subjects-list { padding: 0 25.3px 6.9px; }
            .pr-grade-a { background: rgba(34,197,94,0.14);  color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
            .pr-grade-b { background: rgba(59,130,246,0.14); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
            .pr-grade-c { background: rgba(245,158,11,0.14); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25); }
            .pr-grade-d { background: rgba(248,81,73,0.14);  color: #f85149; border: 1px solid rgba(248,81,73,0.25); }

            /* ── SUBJECT ROWS v2 (bar-free) ──
               Design 2: grade badge leads, name + coverage as plain muted
               text, mark % on the right -- no progress bars, no legend
               needed to decode them. This is the simplified card design
               used on both mobile and desktop. */
            .pr-subject-row-v2 {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 0;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            .pr-subjects-list > .pr-subject-row-v2:first-child { border-top: none; }
            .pr-subject-v2-badge {
                width: 30px;
                height: 24px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 800;
                flex-shrink: 0;
            }
            .pr-subject-v2-info { flex: 1; min-width: 0; }
            .pr-subject-v2-name {
                font-size: 13px;
                font-weight: 500;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .pr-subject-v2-meta { font-size: 10px; color: #555e6a; margin-top: 1px; }
            .pr-subject-v2-pct { font-size: 14px; font-weight: 700; flex-shrink: 0; }

            /* ── FOOTER LEGEND ── */
            .pr-footer-legend {
                padding: 13.8px 25.3px;
                border-top: 1px solid rgba(255,255,255,0.06);
                display: flex;
                gap: 23px;
                flex-wrap: wrap;
                align-items: center;
            }
            .pr-grade-pills { margin-left: auto; display: flex; gap: 9.2px; flex-wrap: wrap; }
            .pr-grade-pill { font-size: 12.65px; font-weight: 700; padding: 2.3px 10.35px; border-radius: 7px; }

            /* ── EMPTY STATE ── */
            .pr-empty { text-align: center; color: #555e6a; padding: 50px 20px; font-size: 14px; }

            /* ── PRINT ── */
            @media print {
                .pr-wrap { padding: 0; max-width: 100%; }
                .pr-card { background: #fff !important; border: 1px solid #ddd !important; }
                .pr-subject-v2-name { color: #111 !important; }
            }

            /* ── MOBILE ── */
            @media (max-width: 600px) {
                .pr-wrap { padding-bottom: 80px; }
                .pr-card { border: none; }
            }

            /* ── MOBILE: PROGRESS REPORT AS FULL-SCREEN MODAL ── */
            @media (max-width: 899px) {
                .pr-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.55);
                    z-index: 9300;
                    display: flex;
                    align-items: flex-end;
                    opacity: 0;
                    animation: prOverlayFadeIn 0.22s ease forwards;
                }
                @keyframes prOverlayFadeIn { to { opacity: 1; } }

                .pr-modal-sheet {
                    width: 100%;
                    max-height: 92vh;
                    margin-top: auto;
                    /* Matches #api-content-area's mobile background (quiz.css)
                       so the sheet reads as part of the same app surface
                       instead of a slightly different, bluer near-black. */
                    background: #20201f;
                    border-radius: 18px 18px 0 0;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    /* Open/close transform + transition are driven entirely from JS
                       (see wireSheetDragToClose / openSheetAnimated) so nothing --
                       no CSS animation, no leftover fill-mode -- ever fights the
                       live drag transform. This is what caused the flicker. */
                    transform: translateY(100%);
                }

                .pr-modal-handle-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    padding: 14px 0 10px;
                    flex-shrink: 0;
                    touch-action: none;
                    cursor: grab;
                }
                .pr-modal-grabber {
                    width: 36px;
                    height: 4px;
                    border-radius: 100px;
                    background: rgba(255,255,255,0.18);
                }
                .pr-modal-scroll {
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    padding: 4px 0 0;
                }

                /* The simplified card (hero header, bar-free subject rows,
                   grade-pill legend only) is now the only layout, rendered
                   the same way inside the mobile sheet and directly in the
                   desktop right panel -- nothing left to switch on/off here. */
                .pr-modal-sheet .pr-wrap { padding-top: 4px; max-width: 100%; }

                /* Flat style: the report's content sits directly on the sheet's
                   own background instead of inside a nested "card" panel. */
                .pr-modal-sheet .pr-card {
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    margin-bottom: 0;
                }

                /* ── QUIZ REVIEW: same modal sheet treatment ── */
                .pr-modal-sheet.review-modal-sheet {
                    height: 92vh;
                    max-height: 92vh;
                }
                .review-modal-sheet .pr-modal-scroll {
                    flex: 1;
                    padding: 18px 16px 40px;
                }

                /* Quiz review content -- rendered directly from
                   get_quiz_review.php's JSON (see buildQuizReviewHtml),
                   replacing the old <iframe src="review_quiz.php"> so the
                   review shares the app's cache and dark-mode handling
                   instead of loading a whole separate document. */
                .qr-scorehead {
                    padding-bottom: 16px;
                    margin-bottom: 6px;
                    border-bottom: 1px solid rgba(255,255,255,0.07);
                }
                .qr-pct {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 62px;
                    height: 34px;
                    padding: 0 12px;
                    border-radius: 10px;
                    background: rgba(79,209,197,0.08);
                    border: 1px solid rgba(79,209,197,0.28);
                    color: #4fd1c5;
                    font-size: 18px;
                    font-weight: 900;
                    margin-bottom: 12px;
                }
                .qr-title {
                    margin: 0 0 8px;
                    color: #e2e8f0;
                    font-size: 20px;
                    line-height: 1.28;
                    font-weight: 800;
                }
                .qr-meta { color: #8b949e; font-size: 12px; }
                .qr-not-published {
                    text-align: center;
                    padding: 60px 20px;
                    color: #e2e8f0;
                }
                .qr-not-published i { font-size: 30px; color: #4fd1c5; margin-bottom: 14px; display: block; }
                .qr-not-published p { color: #8b949e; font-size: 13px; margin-top: 8px; }
                .qr-error {
                    text-align: center;
                    padding: 60px 20px;
                    color: #8b949e;
                    font-size: 13px;
                }

                .qr-qbox {
                    padding: 16px 0 18px;
                    border-bottom: 1px solid rgba(255,255,255,0.07);
                }
                .qr-qbox:last-child { border-bottom: none; }
                .qr-qmeta {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px 8px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #8b949e;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                }
                .qr-qtext {
                    color: #e2e8f0;
                    font-size: 14px;
                    line-height: 1.6;
                    font-weight: 700;
                    margin: 0 0 12px;
                    overflow-wrap: anywhere;
                }
                .qr-qimage {
                    width: 100%;
                    border-radius: 10px;
                    margin: 0 0 12px;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .qr-choices { display: flex; flex-direction: column; gap: 8px; }
                .qr-choice {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    min-height: 40px;
                    padding: 10px 12px;
                    border-radius: 9px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #c9d1d9;
                    font-size: 13px;
                    line-height: 1.4;
                }
                .qr-choice.qr-correct { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.09); color: #e2e8f0; }
                .qr-choice.qr-incorrect { border-color: rgba(248,81,73,0.42); background: rgba(248,81,73,0.09); color: #e2e8f0; }
                .qr-choice i { font-size: 15px; flex-shrink: 0; }
                .qr-choice i.qr-icon-correct { color: #22c55e; }
                .qr-choice i.qr-icon-incorrect { color: #f85149; }
                .qr-choice i.qr-icon-neutral { opacity: 0.3; }
                .qr-badge-user {
                    margin-left: auto;
                    color: #4fd1c5;
                    background: rgba(79,209,197,0.08);
                    border: 1px solid rgba(79,209,197,0.2);
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .qr-deduction-note {
                    color: #f5c38b;
                    font-size: 12px;
                    margin-bottom: 10px;
                }

                .qr-fitb-row {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 9px;
                    padding: 11px 12px;
                    margin-top: 8px;
                    font-size: 13px;
                }
                .qr-fitb-row.qr-correct { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.09); }
                .qr-fitb-row.qr-incorrect { border-color: rgba(248,81,73,0.42); background: rgba(248,81,73,0.09); }
                .qr-fitb-row i { margin-right: 6px; }
                .qr-fitb-answer { font-weight: 800; color: #e2e8f0; }
                .qr-fitb-correct { font-size: 11px; color: #8b949e; margin-top: 5px; }

                .qr-open-box {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 9px;
                    padding: 12px;
                    font-size: 13px;
                    line-height: 1.55;
                    color: #e2e8f0;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                }
                .qr-open-grade {
                    background: rgba(34,197,94,0.1);
                    border: 1px solid rgba(34,197,94,0.25);
                    border-radius: 9px;
                    padding: 11px 12px;
                    margin-top: 8px;
                    font-size: 13px;
                    color: #d8f5df;
                }
                .qr-open-pending {
                    background: rgba(245,158,11,0.09);
                    border: 1px solid rgba(245,158,11,0.25);
                    border-radius: 9px;
                    padding: 11px 12px;
                    margin-top: 8px;
                    font-size: 13px;
                    color: #f5c38b;
                }
                .pr-subjects-header { padding: 14px 16px 8px; flex-direction: column; align-items: flex-start; gap: 4px; }
                .pr-subjects-list { padding: 0 16px 6px; }
                .pr-footer-legend { padding: 12px 16px; gap: 12px; }
                .pr-grade-pills { margin-left: 0; }
            }

            /* ── "LEARN MORE" TRIGGER (next to the Progress Report title) ── */
            .pr-learn-more-btn {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                color: #8b949e;
                font-family: 'Nunito', sans-serif;
                font-size: 12px;
                font-weight: 700;
                padding: 5px 11px;
                border-radius: 20px;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s;
            }
            .pr-learn-more-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); color: #c9d1d9; }
            .pr-learn-more-btn svg { flex-shrink: 0; }
            .pr-hero-school .pr-learn-more-btn { flex-shrink: 0; }

            /* ── STATUS PILL: chevron affordance (signals it's tappable) ── */
            .pr-status-badge, .pr-strip-status, .pr-hero-status {
                cursor: pointer;
            }
            .pr-status-chevron {
                display: inline-flex;
                margin-left: 2px;
                transition: transform 0.15s;
            }
            .pr-status-badge:hover .pr-status-chevron,
            .pr-strip-status:hover .pr-status-chevron,
            .pr-hero-status:hover .pr-status-chevron { transform: translateY(1px); }

            /* ── INFO MODALS (shared shell: "Learn more" + status explainer) ── */
            .pr-info-modal-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 9500;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
            }
            .pr-info-modal-overlay.pr-info-modal-visible { display: flex; }
            .pr-info-modal-box {
                background: #20201f;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                max-width: 440px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                padding: 24px 22px;
                box-sizing: border-box;
                font-family: 'Nunito', sans-serif;
                position: relative;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            .pr-info-modal-close {
                position: absolute;
                top: 14px;
                right: 14px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: rgba(255,255,255,0.06);
                border: none;
                color: #8b949e;
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .pr-info-modal-close:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
            .pr-info-modal-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 800;
                padding: 5px 12px;
                border-radius: 20px;
                margin-bottom: 14px;
            }
            .pr-info-modal-title {
                font-size: 18px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 12px;
                padding-right: 24px;
                line-height: 1.3;
            }
            .pr-info-modal-body { font-size: 14px; line-height: 1.6; color: #c9d1d9; }
            .pr-info-modal-body p { margin: 0 0 12px; }
            .pr-info-modal-body p:last-child { margin-bottom: 0; }
            .pr-info-modal-body strong { color: #e2e8f0; }
            .pr-info-modal-notes {
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 13px 14px;
                margin-top: 14px;
            }
            .pr-info-modal-notes-title {
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: #8b949e;
                margin-bottom: 8px;
            }
            .pr-info-modal-notes ul { margin: 0; padding-left: 18px; }
            .pr-info-modal-notes li { font-size: 13px; line-height: 1.55; color: #c9d1d9; margin-bottom: 6px; }
            .pr-info-modal-notes li:last-child { margin-bottom: 0; }

            @media (max-width: 480px) {
                .pr-info-modal-box { padding: 20px 18px; border-radius: 14px; border: none; }
                .pr-info-modal-notes { border: none; }
                .pr-info-modal-badge { border: none !important; }
                .pr-info-modal-title { font-size: 16.5px; }
                .pr-info-modal-body { font-size: 13.5px; }
            }
        `;
    document.head.appendChild(style);
}

function renderProgressReport(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    ensurePrStylesInjected();

    const currentTerm = data.current_term || 1;
    const subjects    = data.subjects || [];

    // Thresholds and colors here MUST match the legend key rendered in
    // .pr-grade-pills (pr-grade-a/b/c/d, see ensurePrStylesInjected) and the
    // status-band logic in statusForPct() below. Keep all three in sync.
    function pctColor(v) {
        if (v === null) return { text: '#555e6a', bg: 'rgba(74,85,104,0.15)', border: '#555e6a' };
        if (v >= 80)   return { text: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: '#22c55e' }; // A: green
        if (v >= 60)   return { text: '#60a5fa', bg: 'rgba(59,130,246,0.15)', border: '#60a5fa' }; // B: blue
        if (v >= 40)   return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: '#f59e0b' }; // C/D band: amber
        return           { text: '#f85149', bg: 'rgba(248,81,73,0.15)',   border: '#f85149' };     // At risk: red
    }

    // Status badge text/color, driven by the SAME thresholds as pctColor()
    // and the grade legend, so "On Track" / color / letter grade never
    // disagree with each other for a given percentage.
    function statusForPct(v) {
        if (v === null)  return { label: 'No Data',           text: '#555e6a', bg: 'rgba(74,85,104,0.15)',  border: 'rgba(85,94,106,0.35)' };
        if (v >= 60)     return { label: 'On Track',          text: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' };
        if (v >= 40)     return { label: 'Needs Improvement', text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
        return              { label: 'At Risk',                text: '#f85149', bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.25)' };
    }

    function termAvg(termNum) {
        const vals = subjects.map(s => s.terms[termNum]?.pct).filter(v => v !== null);
        return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : null;
    }

    const overallAvg = data.overall_avg;
    const oc = pctColor(overallAvg);
    const st = statusForPct(overallAvg);

    // ── HERO HEADER ──
    // One compressed block (top line, name + overall average, term-trend
    // row) is the report's only header now, on every viewport. The
    // term-trend items double as the term switcher (onclick -> prSwitchTerm),
    // replacing the old separate term-tabs row. Shown on every viewport --
    // see .pr-hero CSS above.
    const heroTrendItemsHtml = [1,2,3,4].map(t => {
        const avg = termAvg(t);
        const c = pctColor(avg);
        const hasData = subjects.some(s => s.terms[t]?.pct !== null);
        const isCurrent = t === currentTerm;
        return `
            <div class="pr-hero-trenditem ${isCurrent ? 'pr-hero-trend-current' : ''} ${!hasData ? 'pr-hero-trend-disabled' : ''}"
                 onclick="prSwitchTerm(${t})"
                 style="${!hasData ? 'pointer-events:none;' : 'cursor:pointer;'}">
                <span class="pr-hero-trenditem-t">T${t}</span>
                <span class="pr-hero-trenditem-v" style="color:${hasData ? c.text : '#555e6a'};">${avg !== null ? avg : '—'}</span>
            </div>`;
    }).join('');

    const heroHtml = `
        <div class="pr-hero">
            <div class="pr-hero-topline">
                <div class="pr-hero-school">
                    <span>${escHtmlPr(data.school_name)} &middot; Term ${currentTerm}</span>
                    <button class="pr-learn-more-btn" onclick="prOpenInfoModal('about')" style="padding:3px 9px;font-size:11px;">
                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Learn more
                    </button>
                </div>
                <span class="pr-hero-status" id="pr-hero-status" onclick="prOpenInfoModal('status')" style="color:${st.text};background:${st.bg};">${st.label}<span class="pr-status-chevron"><svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none"><polyline points="6 9 12 15 18 9"/></svg></span></span>
            </div>
            <div class="pr-hero-idrow">
                <div class="pr-hero-avatar">${initials(data.learner_name)}</div>
                <div class="pr-hero-nameblock">
                    <div class="pr-hero-name">${escHtmlPr(data.learner_name)}</div>
                    <div class="pr-hero-class">${escHtmlPr(data.learner_class)}</div>
                </div>
                <div class="pr-hero-avgblock">
                    <div class="pr-hero-avgnum" id="pr-hero-avgnum" style="color:${oc.text};">${overallAvg !== null ? overallAvg + '%' : '—'}</div>
                    <div class="pr-hero-avglabel">overall</div>
                </div>
            </div>
            <div class="pr-hero-trendrow">
                <span class="pr-hero-trendlabel">Term trend</span>
                <div class="pr-hero-trenditems">${heroTrendItemsHtml}</div>
            </div>
        </div>`;

    function gradeLabel(pct) {
        if (pct === null) return { letter: '?', cls: '' };
        if (pct >= 80) return { letter: 'A', cls: 'pr-grade-a' };
        if (pct >= 60) return { letter: 'B', cls: 'pr-grade-b' };
        if (pct >= 50) return { letter: 'C', cls: 'pr-grade-c' };
        return { letter: 'D', cls: 'pr-grade-d' };
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
                return '<div class="pr-subject-row-v2">' +
                    '<div class="pr-subject-v2-badge" style="background:rgba(255,255,255,0.05);color:#555e6a;border:1px solid rgba(255,255,255,0.08);">?</div>' +
                    '<div class="pr-subject-v2-info">' +
                        '<div class="pr-subject-v2-name">' + escHtmlPr(s.name) + '</div>' +
                        '<div class="pr-subject-v2-meta">No assessments this term</div>' +
                    '</div>' +
                '</div>';
            }

            const coveredTxt = covered !== null ? covered + '%' : '—';
            const countText  = td.count + ' assessment' + (td.count !== 1 ? 's' : '');
            const v2MetaText = countText + (covered !== null ? ' &middot; ' + coveredTxt + ' covered for this term' : '');

            return '<div class="pr-subject-row-v2">' +
                '<div class="pr-subject-v2-badge ' + gl.cls + '">' + gl.letter + '</div>' +
                '<div class="pr-subject-v2-info">' +
                    '<div class="pr-subject-v2-name">' + escHtmlPr(s.name) + '</div>' +
                    '<div class="pr-subject-v2-meta">' + v2MetaText + '</div>' +
                '</div>' +
                '<div class="pr-subject-v2-pct" style="color:' + c.text + ';">' + Math.round(pct) + '%</div>' +
            '</div>';
        }).join('');
    }

    function initials(name) {
        return (name || '').split(' ').filter(Boolean).slice(0,2).map(function(w){ return w[0].toUpperCase(); }).join('');
    }

    const reportInnerHtml = `
        <div class="pr-wrap" id="pr-wrap">

            <div class="pr-card">

                ${heroHtml}

                <div class="pr-subjects-header">
                    <span class="pr-subjects-title">Subject results</span>
                </div>

                <div class="pr-subjects-list" id="pr-subjects-grid">${buildSubjectCards(currentTerm)}</div>

                <div class="pr-footer-legend">
                    <div class="pr-grade-pills">
                        <span class="pr-grade-pill pr-grade-a">A 80&ndash;100</span>
                        <span class="pr-grade-pill pr-grade-b">B 60&ndash;79</span>
                        <span class="pr-grade-pill pr-grade-c">C 50&ndash;59</span>
                        <span class="pr-grade-pill pr-grade-d">D &lt;50</span>
                    </div>
                </div>

            </div>
        </div>`;

    const isMobileGradesView = window.innerWidth <= 899;

    if (isMobileGradesView) {
        // Mobile: report opens as a full-screen modal sheet layered over the
        // grades view underneath, so the underlying grades screen is left
        // untouched and "closing" the report is a dismiss, not a navigation.
        let modal = document.getElementById('prReportModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'prReportModal';
            document.body.appendChild(modal);
        }
        modal.className = 'pr-modal-overlay';
        modal.innerHTML = `
            <div class="pr-modal-sheet" onclick="event.stopPropagation()">
                <div class="pr-modal-handle-row">
                    <div class="pr-modal-grabber"></div>
                </div>
                <div class="pr-modal-scroll">
                    ${reportInnerHtml}
                </div>
            </div>`;
        wireSheetDragToClose(modal, () => prBackToGrades());
    } else {
        // Desktop: #api-content-area is the OUTER page shell (sidebar +
        // main panel together, see fetchGrades()'s grades-desktop-layout
        // markup) -- writing the report there would wipe out the sidebar
        // along with it and center the card against the full shell width
        // instead of the actual right column. #grades-dt-panel is that
        // right column (.grades-dt-panel-scroll), so the report replaces
        // only its contents (the .grades-dt-empty placeholder) and the
        // sidebar stays exactly where it was.
        const panel = document.getElementById('grades-dt-panel');
        (panel || apiArea).innerHTML = reportInnerHtml;
    }

    apiArea._prData            = data;
    apiArea._buildSubjectCards = buildSubjectCards;
    apiArea._pctColor          = pctColor;
    apiArea._statusForPct      = statusForPct;
    apiArea._termAvg           = termAvg;
    apiArea._currentTerm       = currentTerm;
    // Info-modal state: mirrors whatever is currently on screen (status pill
    // colour/label + overall %) so the "status" modal always explains the
    // term actually selected. prSwitchTerm keeps this updated on every switch.
    apiArea._prCurrentStatus   = st;
    apiArea._prCurrentAvg      = overallAvg;
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO MODALS ("Learn more" + tappable status pill explainer)
//
// Both share one small centred dialog (.pr-info-modal-*, injected via
// ensurePrStylesInjected) built fresh into its own overlay on <body> --
// same pattern as #prReportModal -- so it always renders above the mobile
// full-screen sheet instead of being nested/clipped inside it.
// ─────────────────────────────────────────────────────────────────────────────

function prAboutModalHtml() {
    return `
        <div class="pr-info-modal-title">About Progress Report</div>
        <div class="pr-info-modal-body">
            <p>Your Progress Report shows how you're doing <strong>right now</strong>, while the term is still happening.</p>
            <p>It works together with your <strong>Syllabus</strong>: at the start of the term, your Syllabus tells you what marks are coming up and how much each one counts. Your Progress Report then fills in the marks as your teachers grade them — so as the term goes on, you can see your mark building up assessment by assessment, instead of only finding out at the end.</p>
            <p><strong>The number and status at the top are your overall average</strong> — combining all your subjects together for this term. <strong>The list further down breaks that down subject by subject</strong>, so if your overall status says you need to improve, that's where you'll see exactly which subjects are pulling it down.</p>
            <p><strong>Why it matters:</strong> it helps you see early — not just at the end of term — whether you're on track, or whether you need to put in more work before it's too late to catch up.</p>
            <div class="pr-info-modal-notes">
                <div class="pr-info-modal-notes-title">A few important things to know</div>
                <ul>
                    <li>This is <strong>not your final, official report</strong>. It only shows what's been marked so far — some assessments for the term might not be recorded yet.</li>
                    <li>Your official report only comes from the school once everything for the term has been marked and released.</li>
                    <li>"Covered" tells you how much of a subject's total mark has been assessed so far — not your final mark in that subject.</li>
                </ul>
            </div>
        </div>`;
}

function prStatusModalHtml(status, avg) {
    const avgTxt = avg !== null && avg !== undefined ? avg + '%' : '—';
    const copyByLabel = {
        'On Track': 'Your overall average across all your subjects this term is strong so far. Keep it up.',
        'Needs Improvement': `Your overall average across all your subjects this term is a bit below where it should be.
            <br><br>This is an overall number — it doesn't say which subject is the issue. Check your Subject Results below to see which ones are pulling your average down, and speak to those teachers if you're unsure where to focus.`,
        'At Risk': `Your overall average across all your subjects this term is low enough that you're at risk of not passing the term overall.
            <br><br>This is an overall number — it doesn't say which subject is the issue. Look at your Subject Results below to see which subjects need the most attention, and speak to your teachers soon about extra support.`,
        'No Data': 'There are no assessed marks for this term yet, so a status can\'t be calculated. Check back once your teachers have recorded some marks.'
    };
    const body = copyByLabel[status.label] || '';
    return `
        <div class="pr-info-modal-badge" style="color:${status.text};background:${status.bg};border:1px solid ${status.border};">${escHtmlPr(status.label)}</div>
        <div class="pr-info-modal-title">Overall average: ${avgTxt}</div>
        <div class="pr-info-modal-body"><p>${body}</p></div>`;
}

window.prOpenInfoModal = function (type) {
    const apiArea = document.getElementById('api-content-area');
    ensurePrStylesInjected();

    let modal = document.getElementById('prInfoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'prInfoModal';
        modal.className = 'pr-info-modal-overlay';
        modal.onclick = function (e) { if (e.target === modal) window.prCloseInfoModal(); };
        document.body.appendChild(modal);
    }

    const status = (apiArea && apiArea._prCurrentStatus) || null;
    const avg    = apiArea ? apiArea._prCurrentAvg : null;

    const bodyHtml = type === 'status' && status
        ? prStatusModalHtml(status, avg)
        : prAboutModalHtml();

    modal.innerHTML = `
        <div class="pr-info-modal-box" onclick="event.stopPropagation()">
            <button class="pr-info-modal-close" onclick="prCloseInfoModal()">×</button>
            ${bodyHtml}
        </div>`;
    modal.classList.add('pr-info-modal-visible');
};

window.prCloseInfoModal = function () {
    const modal = document.getElementById('prInfoModal');
    if (modal) modal.classList.remove('pr-info-modal-visible');
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE SHEET: keep the browser/status bar in sync with the dimmed overlay
//
// The sheet's dark overlay (rgba(0,0,0,0.55)) only dims the page DOM — it
// can't reach the OS status bar, which reads the separate
// <meta name="theme-color"> tag. If the Grades page had already scrolled
// past its header threshold, that tag is sitting on the page's own accent
// colour (e.g. Grades' green), so opening a sheet left a bright status bar
// sitting above a dimmed, darkened header/page — the exact mismatch in the
// screenshots. toggleSidebar() (the hamburger menu) already solves this for
// itself: save whatever the header/theme-color currently legitimately are,
// force both to the sheet/menu's own dark #20201f while open, then restore
// the saved values on close instead of guessing. Same approach here.
//
// IMPORTANT: the sliver of background peeking out above the sheet (around
// the header) is NOT plain #20201f -- it's #20201f seen THROUGH the sheet's
// own rgba(0,0,0,0.55) dimming overlay, which sits in the DOM on top of it.
// #20201f composited under 55% black works out to ~#0e0e0e, visibly darker
// than flat #20201f. The status bar can't see that overlay at all (it's a
// DOM element, not something the OS compositor knows about), so if we push
// plain #20201f to theme-color, the status bar ends up lighter than the
// dimmed strip sitting directly below it -- a visible seam right at the top,
// even though the header/theme-color values technically "match" on paper.
// Pushing the pre-composited value instead makes the status bar read as the
// same dimmed shade the eye actually sees just below it.
// The header background itself stays plain #20201f (not composited) since
// .main-header is a real DOM element sitting under the same overlay as
// everything else -- it gets dimmed by the overlay naturally, same as the
// rest of the page. Only theme-color needs the pre-composited value, since
// it's the one color the overlay can never reach.
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_OVERLAY_DIMMED_COLOR = '#0e0e0e'; // #20201f composited under rgba(0,0,0,0.55)

function darkenBrowserBarForSheet() {
    if (window.innerWidth > 899) return null;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const mainHeader = document.querySelector('.main-header');
    const saved = {
        themeColor: themeColorMeta ? themeColorMeta.getAttribute('content') : null,
        headerBg: mainHeader ? mainHeader.style.background : ''
    };
    if (themeColorMeta) themeColorMeta.setAttribute('content', SHEET_OVERLAY_DIMMED_COLOR);
    if (mainHeader) mainHeader.style.background = '#20201f';
    return saved;
}

function restoreBrowserBarAfterSheet(saved) {
    if (!saved) return;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const mainHeader = document.querySelector('.main-header');
    if (themeColorMeta && saved.themeColor !== null) themeColorMeta.setAttribute('content', saved.themeColor);
    if (mainHeader) mainHeader.style.background = saved.headerBg;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE SHEET: open animation + drag-down-to-close on the handle row
//
// Everything that touches the sheet's `transform` lives in this one function
// (open slide-up, live drag tracking, snap-back, close slide-down). Previously
// the open animation was a separate CSS `animation ... forwards` rule, which
// keeps "holding" translateY(0) as a higher-priority layer even after it
// finishes -- so when the drag handler set an inline transform to follow the
// finger, the animation's held value and the drag's inline value fought each
// other every frame, which is what caused the flicker. Routing both through
// plain inline transform + transition (one owner, never overlapping) fixes it.
//
// Drag behaviour: press+drag the grabber, the sheet tracks the finger 1:1.
// Release past ~30% of the sheet's height (or a fast downward flick) and it
// finishes closing; otherwise it snaps back open. Tapping the dimmed area
// above the sheet (wired via modal.onclick) still closes it instantly.
// ─────────────────────────────────────────────────────────────────────────────
function openSheetAnimated(sheet) {
    sheet.style.transition = 'none';
    sheet.style.transform = 'translateY(100%)';
    // Force a reflow so the browser registers the starting position before
    // we switch on the transition -- otherwise the two style writes collapse
    // into one and there's nothing to animate from.
    void sheet.offsetHeight;
    sheet.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
    sheet.style.transform = 'translateY(0)';
    sheet.addEventListener('transitionend', function clearInline() {
        sheet.style.transition = '';
        sheet.removeEventListener('transitionend', clearInline);
    }, { once: true });
}

function wireSheetDragToClose(modal, onClose) {
    const sheet  = modal.querySelector('.pr-modal-sheet');
    const handle = modal.querySelector('.pr-modal-handle-row');
    if (!sheet || !handle) return;

    openSheetAnimated(sheet);
    const savedBrowserBar = darkenBrowserBarForSheet();
    // Wrap the real close so every path that ends the sheet -- tapping
    // outside, dragging past the threshold, or the caller's own close
    // function -- restores the browser bar exactly once, in one place.
    const closeAndRestore = () => {
        restoreBrowserBarAfterSheet(savedBrowserBar);
        onClose();
    };
    modal.onclick = closeAndRestore;

    const CLOSE_THRESHOLD_RATIO = 0.3; // 30% of sheet height
    const FLICK_VELOCITY = 0.6;        // px/ms - fast downward swipe also closes

    let startY = 0;
    let currentY = 0;
    let startTime = 0;
    let dragging = false;
    let sheetHeight = 0;

    function onPointerDown(e) {
        // Ignore non-primary touches / right-click drags
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        startY = e.clientY;
        currentY = startY;
        startTime = Date.now();
        sheetHeight = sheet.getBoundingClientRect().height;
        // No transition while actively dragging -- the transform must track
        // the finger with zero lag, with nothing else animating it at the
        // same time.
        sheet.style.transition = 'none';
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
        if (!dragging) return;
        currentY = e.clientY;
        const delta = Math.max(0, currentY - startY); // only allow dragging down
        sheet.style.transform = `translateY(${delta}px)`;
    }

    function finishDrag() {
        if (!dragging) return;
        dragging = false;

        const delta = Math.max(0, currentY - startY);
        const elapsed = Math.max(1, Date.now() - startTime);
        const velocity = delta / elapsed;
        const pastThreshold = sheetHeight > 0 && (delta / sheetHeight) >= CLOSE_THRESHOLD_RATIO;
        const isFlick = velocity >= FLICK_VELOCITY && delta > 10;

        if (pastThreshold || isFlick) {
            // Let it continue the rest of the way down, then close.
            sheet.style.transition = 'transform 0.2s ease-out';
            sheet.style.transform = 'translateY(100%)';
            setTimeout(() => closeAndRestore(), 200);
        } else {
            // Snap back open.
            sheet.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
            sheet.style.transform = 'translateY(0)';
            sheet.addEventListener('transitionend', function clearInline() {
                sheet.style.transition = '';
                sheet.removeEventListener('transitionend', clearInline);
            }, { once: true });
        }
    }

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
}

window.prSwitchTerm = function (term) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea || !apiArea._prData) return;

    apiArea._currentTerm = term;

    // Highlight the selected term in the hero's term-trend row (its only
    // remaining "current term" indicator now that .pr-term-tab is gone).
    document.querySelectorAll('.pr-hero-trenditem').forEach((item, i) => {
        item.classList.toggle('pr-hero-trend-current', i + 1 === term);
    });

    // Re-render subject cards for the selected term.
    const grid = document.getElementById('pr-subjects-grid');
    if (grid) grid.innerHTML = apiArea._buildSubjectCards(term);

    // Recompute the term average, color and status for the SELECTED term
    // (not the term the report originally loaded on) and push them into
    // every place that previously showed a frozen "Term 1 / On Track".
    const selectedTermAvg = apiArea._termAvg(term);
    const c  = apiArea._pctColor(selectedTermAvg);
    const st = apiArea._statusForPct(selectedTermAvg);

    const avgNum = document.getElementById('pr-avg-num');
    if (avgNum) {
        avgNum.textContent = selectedTermAvg !== null ? selectedTermAvg + '%' : '—';
        avgNum.style.color = c.text;
    }

    // Mobile hero's "overall" number — same value/color as pr-avg-num above,
    // just rendered in the compact hero block instead of the desktop strip.
    const heroAvgNum = document.getElementById('pr-hero-avgnum');
    if (heroAvgNum) {
        heroAvgNum.textContent = selectedTermAvg !== null ? selectedTermAvg + '%' : '—';
        heroAvgNum.style.color = c.text;
    }

    const heroStatus = document.getElementById('pr-hero-status');
    if (heroStatus) {
        const heroChevron = heroStatus.querySelector('.pr-status-chevron');
        heroStatus.textContent = st.label;
        heroStatus.style.color = st.text;
        heroStatus.style.background = st.bg;
        if (heroChevron) heroStatus.appendChild(heroChevron);
    }

    // Keep the info-modal content in sync with whichever term is now
    // selected, so tapping the status pill always explains the CURRENT
    // on-screen status/mark rather than the term the report first loaded with.
    apiArea._prCurrentStatus = st;
    apiArea._prCurrentAvg    = selectedTermAvg;
};

window.prBackToGrades = function () {
    const modal = document.getElementById('prReportModal');
    if (modal && window.innerWidth <= 899) {
        modal.remove();
        return;
    }
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

// ── QUIZ REVIEW RENDERER ──
// Client-side port of review_quiz.php's question templates, operating on
// the JSON shape returned by get_quiz_review.php. Ported branch-for-branch
// from the original PHP `foreach ($questions as $q)` loop: MCQ, fill-in-
// blank, open-ended, and multiple-answer each keep the same visibility
// rules (e.g. multiple-answer's is_correct/accepted_answers are only ever
// non-null in the JSON once publish_marks is true, same as the PHP
// template's own `(int)$quizInfo['publish_marks'] === 1` checks).
function buildQuizReviewQuestionHtml(q, index) {
    const ptsEarned   = q.points_earned_display;
    const ptsPossible = q.points_possible_display;
    let bodyHtml = '';

    if (q.question_type === 'fill_in_blank') {
        const blanks = (q.fitb && q.fitb.blanks) || [];
        bodyHtml = blanks.map(function(blank) {
            const cls = blank.is_correct ? 'qr-correct' : 'qr-incorrect';
            const icon = blank.is_correct ? 'fa-check-circle qr-icon-correct' : 'fa-times-circle qr-icon-incorrect';
            const answerText = blank.learner_answer !== '' ? escHtmlPr(blank.learner_answer) : 'No answer submitted.';
            const acceptedHtml = (blank.accepted_answers && blank.accepted_answers.length)
                ? '<div class="qr-fitb-correct">Accepted answers: ' + escHtmlPr(blank.accepted_answers.join(', ')) + '</div>'
                : '';
            return '<div class="qr-fitb-row ' + cls + '">' +
                '<div><i class="fas ' + icon + '"></i>Blank ' + escHtmlPr(String(blank.blank_index)) + ' - Your answer: ' +
                '<span class="qr-fitb-answer">' + answerText + '</span></div>' +
                acceptedHtml +
            '</div>';
        }).join('');
    } else if (q.question_type === 'open_ended') {
        const oe = q.open_ended || {};
        const answerText = q.answer_text !== '' ? escHtmlPr(q.answer_text).replace(/\n/g, '<br>') : 'No answer submitted.';
        bodyHtml = '<div class="qr-open-box"><strong>Your answer:</strong><br>' + answerText + '</div>';
        if (oe.grade) {
            const feedbackHtml = oe.grade.feedback
                ? '<div style="margin-top:8px;"><strong>Teacher feedback:</strong><br>' + escHtmlPr(oe.grade.feedback).replace(/\n/g, '<br>') + '</div>'
                : '';
            bodyHtml += '<div class="qr-open-grade"><strong>Awarded:</strong> ' +
                escHtmlPr(String(oe.grade.score)) + ' / ' + escHtmlPr(String(q.points_possible)) +
                feedbackHtml + '</div>';
        } else {
            bodyHtml += '<div class="qr-open-pending">Awaiting teacher grading.</div>';
        }
    } else if (q.question_type === 'multiple_answer') {
        const ma = q.multiple_answer || {};
        const selectedIds = ma.selected_choice_ids || [];
        const deductionHtml = ma.show_deduction
            ? '<div class="qr-deduction-note">' + (ma.correct_selected_count || 0) + ' correct selected (+' +
                (ma.points_added_display || '0') + 'pts), ' + (ma.wrong_selected_count || 0) + ' wrong selected (-' +
                (ma.points_deducted_display || '0') + 'pts deducted)</div>'
            : '';
        const choicesHtml = (q.choices || []).map(function(choice) {
            const isSelected = selectedIds.indexOf(choice.id) !== -1;
            const isCorrect = choice.is_correct === true;
            let cls = '';
            let icon = '<i class="far fa-square qr-icon-neutral"></i>';
            if (isCorrect) { cls = 'qr-correct'; icon = '<i class="fas fa-check-circle qr-icon-correct"></i>'; }
            else if (isSelected && choice.is_correct === false) { cls = 'qr-incorrect'; icon = '<i class="fas fa-times-circle qr-icon-incorrect"></i>'; }
            const userBadge = isSelected ? '<span class="qr-badge-user">Your Answer</span>' : '';
            return '<div class="qr-choice ' + cls + '">' + icon + escHtmlPr(choice.text) + userBadge + '</div>';
        }).join('');
        bodyHtml = deductionHtml + '<div class="qr-choices">' + choicesHtml + '</div>';
    } else {
        // Plain MCQ (single-select)
        bodyHtml = '<div class="qr-choices">' + (q.choices || []).map(function(choice) {
            const isSelected = choice.id === q.selected_choice_id;
            const isCorrect = choice.is_correct === true;
            let cls = '';
            let icon = '<i class="far fa-circle qr-icon-neutral"></i>';
            if (isCorrect) { cls = 'qr-correct'; icon = '<i class="fas fa-check-circle qr-icon-correct"></i>'; }
            else if (isSelected && !isCorrect) { cls = 'qr-incorrect'; icon = '<i class="fas fa-times-circle qr-icon-incorrect"></i>'; }
            const userBadge = isSelected ? '<span class="qr-badge-user">Your Answer</span>' : '';
            return '<div class="qr-choice ' + cls + '">' + icon + escHtmlPr(choice.text) + userBadge + '</div>';
        }).join('') + '</div>';
    }

    const imageHtml = q.image ? '<img src="' + escHtmlPr(q.image) + '" class="qr-qimage" alt="Question Image">' : '';

    return '<div class="qr-qbox">' +
        '<div class="qr-qmeta">Question ' + (index + 1) + ' - ' + ptsEarned + ' / ' + ptsPossible + ' pts</div>' +
        '<div class="qr-qtext">' + escHtmlPr(q.text) + '</div>' +
        imageHtml + bodyHtml +
    '</div>';
}

function buildQuizReviewHtml(data) {
    if (!data.published) {
        return '<div class="qr-not-published">' +
            '<i class="fas fa-chart-simple"></i>' +
            '<div style="font-weight:800;font-size:15px;">Results Not Published</div>' +
            '<p>' + escHtmlPr(data.message || 'Your teacher has not released the marks for this quiz yet.') + '</p>' +
        '</div>';
    }
    const quiz = data.quiz;
    const questionsHtml = (data.questions || []).map(function(q, i) {
        return buildQuizReviewQuestionHtml(q, i);
    }).join('');
    return '<div class="qr-scorehead">' +
        '<div class="qr-pct">' + quiz.percentage + '%</div>' +
        '<div class="qr-title">' + escHtmlPr(quiz.title) + '</div>' +
        '<div class="qr-meta">Points: <strong>' + quiz.score + ' / ' + quiz.total + '</strong> &middot; Date: ' + escHtmlPr(quiz.submitted_at_display) + '</div>' +
    '</div>' + questionsHtml;
}

window.openQuizReview = function(resultId, event) {
    if (event) event.stopPropagation();
    const isMobileGradesView = window.innerWidth <= 899;
    const reviewUrl = `review_quiz.php?result_id=${encodeURIComponent(resultId)}`;

    sessionStorage.setItem('lastLearnerPage', 'grades');

    if (isMobileGradesView) {
        // Mobile: same full-screen modal sheet treatment as the progress
        // report. Grades view (and its header/bottom nav) underneath is
        // left completely alone; closing the sheet is a dismiss, not a
        // navigation, so no configureHeader/back-button wiring is needed.
        //
        // ensurePrStylesInjected() is required here: the .pr-modal-* /
        // .review-modal-* CSS this sheet depends on used to only get
        // injected from inside renderProgressReport(), so opening Quiz
        // Review before ever opening the Progress Report sheet produced a
        // correctly-wired but completely unstyled (invisible/inert) modal.
        // See ensurePrStylesInjected()'s own comment for the full story.
        ensurePrStylesInjected();
        let modal = document.getElementById('prReportModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'prReportModal';
            document.body.appendChild(modal);
        }
        modal.className = 'pr-modal-overlay';
        modal.innerHTML = `
            <div class="pr-modal-sheet review-modal-sheet" onclick="event.stopPropagation()">
                <div class="pr-modal-handle-row">
                    <div class="pr-modal-grabber"></div>
                </div>
                <div class="pr-modal-scroll">
                    <div id="qr-content" class="qr-loading" style="text-align:center;padding:60px 20px;color:#8b949e;font-size:13px;">Loading review…</div>
                </div>
            </div>`;
        wireSheetDragToClose(modal, () => closeQuizReviewModal());

        // Fetch-and-render (replaces the old <iframe src="review_quiz.php">):
        // instant re-render from cache on repeat opens of the same result,
        // same pattern as learnerProgressReportCache/renderProgressReport.
        // Guards against the modal having already been closed/replaced by
        // the time an in-flight fetch resolves (e.g. user swiped it shut,
        // or opened a different quiz review before this one returned).
        const renderInto = (html) => {
            const el = document.getElementById('qr-content');
            if (el) el.innerHTML = html;
        };
        if (window.learnerQuizReviewCache[resultId]) {
            renderInto(buildQuizReviewHtml(window.learnerQuizReviewCache[resultId]));
            return;
        }
        fetch(`get_quiz_review.php?result_id=${encodeURIComponent(resultId)}`)
            .then(r => {
                if (!r.ok) throw new Error('http_' + r.status);
                return r.json();
            })
            .then(data => {
                if (data.error) throw new Error(data.error);
                window.learnerQuizReviewCache[resultId] = data;
                renderInto(buildQuizReviewHtml(data));
            })
            .catch(() => {
                renderInto('<div class="qr-error">Couldn\'t load this review. Please try again.</div>');
            });
        return;
    }

    // Desktop: unchanged — swap the iframe into the panel, header goes detail-mode.
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');

    if (window.configureHeader) {
        window.configureHeader({ title: 'Review', mode: 'detail', detailType: 'Review', backLabel: 'Grades' });
    }
    if (myClassContent) myClassContent.classList.remove('active');
    if (apiArea) apiArea.style.display = 'none';
    if (iframe)  {
        iframe.style.display = 'block';
        iframe.src = reviewUrl;
    }
    if (mainContent) mainContent.scrollTop = 0;
};

window.closeQuizReviewModal = function () {
    const modal = document.getElementById('prReportModal');
    if (modal) modal.remove();
};