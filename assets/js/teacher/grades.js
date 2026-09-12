function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.teacherGradesCache        = null;
window.teacherGradesCachePromise = null;
window.currentQuizData           = null;
window._teacherGradeQuizCache    = {}; // per-quiz cache: { [quizId]: { type: 'standard'|'open_ended', data } }

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherGrades = function () {
    if (window.teacherGradesCache) return;
    if (window.teacherGradesCachePromise) return;
    window.teacherGradesCachePromise = fetch('api/teacher/get_grades.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherGradesCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherGradesCachePromise = null; });
};

// ─────────────────────────────────────────────
// GRADES LIST
// ─────────────────────────────────────────────
window.fetchTeacherGrades = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_grades");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_grades");

    // Reset header chrome back to standard mode. Needed whether this is
    // the initial load (no-op, already standard) or a return trip from
    // the mobile detail page (back button, hidden bottom nav) via
    // handleTeacherHeaderBack's 'Grade' branch.
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherGradesCache) {
        renderTeacherGrades(window.teacherGradesCache);
        return;
    }

    try {
        // Keep one request in flight so repeated taps cannot fetch Grades twice.
        if (!window.teacherGradesCachePromise) {
            window.teacherGradesCachePromise = fetch('api/teacher/get_grades.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherGradesCache = data;
                    return data;
                })
                .finally(() => {
                    window.teacherGradesCachePromise = null;
                });
        }

        const data = await window.teacherGradesCachePromise;
        renderTeacherGrades(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p class="gr-error-message">
                Error loading grades.
            </p>`;
    }
};

// Track active quiz for desktop panel
window._activeDesktopGradeQuizId = null;

function renderTeacherGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Collect all quizzes flat for desktop panel lookup ──
    window._allGradesQuizzesFlat = [];
    if (data && data.length > 0) {
        data.forEach(termData => {
            termData.classes.forEach(cls => {
                cls.quizzes.forEach(quiz => {
                    window._allGradesQuizzesFlat.push({ ...quiz, class_name: cls.class_name, term: termData.term });
                });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="gr-empty-state-inline">No assessments found.</p>`;
    } else {
        data.forEach(termData => {
            sidebarHtml += `<div class="gr-sidebar-term-label">TERM ${termData.term}</div>`;
            termData.classes.forEach((cls, clsIdx) => {
                const classGroupId = `gr-class-group-${termData.term}-${clsIdx}`;
                let itemsHtml = '';
                cls.quizzes.forEach(quiz => {
                    itemsHtml += `
                        <div class="gr-sidebar-item" id="gr-sidebar-${quiz.id}"
                            onclick="selectDesktopGradeQuiz(${quiz.id})">
                            <div class="gr-sidebar-item-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </div>
                            <div class="gr-sidebar-item-info">
                                <div class="gr-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                                <div class="gr-sidebar-item-meta">${escapeHtml(quiz.created_at)}</div>
                            </div>
                        </div>`;
                });
                sidebarHtml += window.buildCollapsibleClassGroup(
                    classGroupId,
                    'gr-sidebar-class-label',
                    escapeHtml(cls.class_name),
                    itemsHtml
                );
            });
        });
    }

    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="gr-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="gr-sidebar tchr-flat-sidebar">
                <div class="gr-sidebar-header">
                    <span>Assessments</span>
                    <button class="teacher-upload-btn teacher-desktop-create gr-new-btn" id="gr-new-btn" onclick="openAddQuizModal()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="gr-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="gr-main-panel tchr-flat-panel" id="gr-main-panel">
                <div class="gr-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select an assessment to view learner grades</p>
                </div>
            </div>

            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Grades', `
                <p>Marks stay hidden from learners until you toggle <strong>Publish Marks</strong> for that assessment.</p>
                <p>Use <strong>Progress Report</strong> in the sidebar footer to generate a printable term summary for the whole class.</p>
            `) : ''}
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="gr-mobile-list">
            <div class="teacher-grades-info">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" class="gr-info-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Click any assessment to view learner grades.</span>
            </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No assessments found.</p>`;
    } else {
        data.forEach(termData => {
            html += `<div class="teacher-term-divider">Term ${termData.term}</div>`;

            termData.classes.forEach((cls, clsIdx) => {
                // Separate id namespace from desktop's gr-class-group-{term}-{idx}
                // so mobile folder collapse-state / DOM ids never collide with the
                // desktop sidebar's groups when both happen to be in the DOM
                // during a resize.
                const mobileGroupId = `gr-mobile-class-group-${termData.term}-${clsIdx}`;
                let itemsHtml = '';

                cls.quizzes.forEach(quiz => {
                    itemsHtml += `
                        <div class="gr-mobile-row" data-quiz-id="${quiz.id}" onclick="openMobileTeacherGradeQuiz(${quiz.id})">
                            <div class="teacher-resource-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <div class="teacher-resource-info">
                                <div class="teacher-resource-name">${escapeHtml(quiz.title)}</div>
                                <div class="teacher-resource-meta">${escapeHtml(quiz.created_at)}</div>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>`;
                });

                html += window.buildCollapsibleClassGroup(
                    mobileGroupId,
                    'gr-mobile-class-label',
                    escapeHtml(cls.class_name),
                    itemsHtml
                );
            });
        });
    }

    html += `</div>`;

    // Add Quiz Modal
    html += `
        <div id="addQuizModal" class="teacher-modal-overlay gr-modal-hidden">
            <div class="teacher-modal-box gr-modal-box--add-quiz">
                <div class="teacher-modal-header">
                    <span>Add Assessment Manually</span>
                    <button onclick="closeAddQuizModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <div class="teacher-grades-info gr-info-box-spaced">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" class="gr-info-icon">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>After adding, find the assessment in the list and click it to enter each learner's marks.</span>
                    </div>

                    <label class="teacher-modal-label">Assessment Title *</label>
                    <input type="text" id="quizTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Test">

                    <label class="teacher-modal-label">Select Class *</label>
                    <select id="quizClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

                    <label class="teacher-modal-label gr-checkbox-label">
                        <input type="checkbox" id="quizSummative" onchange="toggleWeightField()">
                        Counts toward term mark
                    </label>

                    <div id="weightContainer" class="gr-weight-container">
                        <label class="teacher-modal-label">Weight %</label>
                        <input type="number" id="quizWeight" class="teacher-modal-input gr-weight-input"
                            min="0" max="100" step="0.1" placeholder="e.g. 30">
                    </div>

                    <div id="addQuizError" class="gr-form-error"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeAddQuizModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitAddQuiz()" class="teacher-modal-submit" id="addQuizSubmitBtn">Add Assessment</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    loadGradesClasses();

    // Restore whichever quiz was selected before navigating away, and
    // the sidebar's scroll position, so switching back to Grades looks
    // exactly as the teacher left it instead of resetting to empty.
    const sidebarScrollEl = apiArea.querySelector('.gr-sidebar-scroll');
    window.wireTeacherSectionScroll('grades-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('grades-sidebar', sidebarScrollEl);

    const savedQuizId = window.teacherSectionState.selection.grades;
    if (savedQuizId && window._allGradesQuizzesFlat.some(q => q.id == savedQuizId)) {
        selectDesktopGradeQuiz(savedQuizId);
    }
}

// ── DESKTOP PANEL: SELECT QUIZ ───────────────────────────────────────────────
window.selectDesktopGradeQuiz = async function(quizId) {
    document.querySelectorAll('.gr-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`gr-sidebar-${quizId}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeDesktopGradeQuizId = quizId;
    window.teacherSectionState.selection.grades = quizId;
    window.persistTeacherSectionState();

    const panel  = document.getElementById('gr-main-panel');
    if (!panel) return;

    // Already fetched this quiz this session — render instantly, no re-fetch, no spinner
    const cached = window._teacherGradeQuizCache[quizId];
    if (cached) {
        if (cached.type === 'open_ended') {
            window.currentOpenEndedQuizData = cached.data;
            renderOpenEndedGrades(cached.data, panel, true);
        } else {
            window.currentQuizData = cached.data;
            renderGradesInPanel(cached.data, panel);
        }
        return;
    }

    // Show a loading state inside the panel
    panel.innerHTML = `
        <div class="gr-panel-empty">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                class="gr-panel-loading-spinner">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p>Loading grades...</p>
        </div>`;

    try {
        const res  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const resultRes = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
            headers: { 'X-CSRF-Token': getCsrfToken() }
        });
        const resultPayload = await resultRes.json();
        const resultData = normalizeQuizResultsPayload(resultPayload);
        if (resultData && resultData.has_open_ended == 1) {
            window.currentOpenEndedQuizData = resultData;
            window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: resultData };
            renderOpenEndedGrades(resultData, panel, true);
        } else {
            window.currentQuizData = data;
            window._teacherGradeQuizCache[quizId] = { type: 'standard', data: data };
            renderGradesInPanel(data, panel);
        }
    } catch (e) {
        panel.innerHTML = `<div class="gr-panel-empty"><p class="gr-panel-error-text">Error loading grades.</p></div>`;
    }
};

function renderGradesInPanel(data, panel) {
    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div class="gr-panel-title">${escapeHtml(data.quiz_title)}</div>
                <div class="gr-panel-meta">${data.learners.length} learner${data.learners.length !== 1 ? 's' : ''}</div>
            </div>`;

    if (data.learners.length === 0) {
        html += `<p class="teacher-empty-state">No learners found in this class.</p>`;
    } else {
        html += `<div class="teacher-grades-table-wrapper">
            <table class="teacher-grades-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Edit</th>
                    </tr>
                </thead>
                <tbody>`;

        data.learners.forEach(learner => {
            const score = learner.score !== null
                ? `${escapeHtml(learner.score)} / ${escapeHtml(learner.total)}`
                : '<span class="gr-cell-muted">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span class="gr-cell-muted">—</span>';

            html += `
                <tr>
                    <td>${escapeHtml(learner.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>
                        <button class="teacher-edit-marks-btn"
                            data-email="${escapeHtml(learner.email)}" data-name="${escapeHtml(learner.name)}" data-quiz-id="${data.quiz_id}" data-quiz-title="${escapeHtml(data.quiz_title)}" data-score="${escapeHtml(learner.score ?? '')}" data-total="${escapeHtml(learner.total ?? 100)}"
                            onclick="openEditMarksInPanelFromElement(this)">
                            Edit
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
}

// Edit marks inline within the desktop panel
window.openEditMarksInPanel = function(email, name, quizId, quizTitle, currentScore, currentTotal) {
    const panel = document.getElementById('gr-main-panel');
    if (!panel) return;

    const scoreVal = currentScore !== null ? currentScore : '';
    const totalVal = currentTotal !== null ? currentTotal : 100;

    panel.innerHTML = `
        <div class="gr-panel-content">
            <div class="gr-panel-header gr-panel-header--with-back">
                <button onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))"
                    class="gr-back-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Back
                </button>
                <div>
                    <div class="gr-panel-title">Edit Marks</div>
                    <div class="gr-panel-meta">${escapeHtml(name)} &bull; ${escapeHtml(quizTitle)}</div>
                </div>
            </div>

            <div class="teacher-edit-marks-box">
                <label class="teacher-modal-label">Score Received</label>
                <input type="number" step="0.01" id="editScore" class="teacher-modal-input"
                    value="${escapeHtml(scoreVal)}" placeholder="e.g. 15">

                <label class="teacher-modal-label gr-form-label-spaced">Maximum Possible Score</label>
                <input type="number" step="0.01" id="editTotal" class="teacher-modal-input"
                    value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

                <div id="editMarksError" class="gr-form-error"></div>
                <div id="editMarksSuccess" class="gr-form-success"></div>

                <div class="gr-form-actions">
                    <button class="teacher-modal-cancel gr-form-cancel-btn"
                        onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))">Cancel</button>
                    <button class="teacher-modal-submit gr-form-submit-btn"
                        id="saveMarksBtn"
                        data-email="${escapeHtml(email)}" data-quiz-id="${quizId}"
                        onclick="saveMarksFromElement(this)">
                        Save Marks
                    </button>
                </div>
            </div>
        </div>`;
};

// ─────────────────────────────────────────────
// QUIZ GRADES VIEW (mobile detail page — view only)
// ─────────────────────────────────────────────
// Mobile grading/editing was deliberately removed: teachers view marks
// on mobile but grade and edit only on desktop. This mirrors
// Assignments' detail-page navigation (configureTeacherHeader +
// handleTeacherHeaderBack) but renders read-only content — no Edit
// buttons, no open-ended grading form, no publish/unpublish toggle.
window.openMobileTeacherGradeQuiz = async function(quizId) {
    if (window.innerWidth > 899) return; // mobile-only guard, same convention as Assignments
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    window.teacherSectionState.selection.grades = quizId;
    window.persistTeacherSectionState();

    apiArea.innerHTML = `
        <div class="gr-panel-empty">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                class="gr-panel-loading-spinner">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p>Loading grades...</p>
        </div>`;

    try {
        // Reuse the same cache desktop already fills — no separate mobile
        // cache, same as Assignments unifying its flat array.
        const cached = window._teacherGradeQuizCache[quizId];
        if (cached) {
            renderMobileGradeDetail(cached.type, cached.data, apiArea);
            return;
        }

        const res  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const resultRes = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
            headers: { 'X-CSRF-Token': getCsrfToken() }
        });
        const resultPayload = await resultRes.json();
        const resultData = normalizeQuizResultsPayload(resultPayload);

        if (resultData && resultData.has_open_ended == 1) {
            window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: resultData };
            renderMobileGradeDetail('open_ended', resultData, apiArea);
        } else {
            window._teacherGradeQuizCache[quizId] = { type: 'standard', data: data };
            renderMobileGradeDetail('standard', data, apiArea);
        }
    } catch (e) {
        apiArea.innerHTML = `<div class="gr-panel-empty"><p class="gr-panel-error-text">Error loading grades.</p></div>`;
    }
};

function renderMobileGradeDetail(type, data, apiArea) {
    window.configureTeacherHeader({
        title: data.quiz_title || 'Assessment',
        mode: 'detail',
        detailType: 'Grade',
        backLabel: 'Grades'
    });

    if (type === 'open_ended') {
        renderMobileOpenEndedGrades(data, apiArea);
    } else {
        renderMobileStandardGrades(data, apiArea);
    }
}

// Read-only table: same columns as the desktop/legacy table minus the
// Edit column entirely (not just visually hidden, since mobile never
// calls openEditMarksFromElement at all).
function renderMobileStandardGrades(data, apiArea) {
    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div class="gr-panel-title">${escapeHtml(data.quiz_title)}</div>
                <div class="gr-panel-meta">${data.learners.length} learner${data.learners.length !== 1 ? 's' : ''}</div>
            </div>`;

    if (data.learners.length === 0) {
        html += `<p class="teacher-empty-state">No learners found in this class.</p>`;
    } else {
        html += `<div class="teacher-grades-table-wrapper">
            <table class="teacher-grades-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>`;

        data.learners.forEach(learner => {
            const score = learner.score !== null
                ? `${escapeHtml(learner.score)} / ${escapeHtml(learner.total)}`
                : '<span class="gr-cell-muted">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span class="gr-cell-muted">—</span>';

            html += `
                <tr>
                    <td>${escapeHtml(learner.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    apiArea.innerHTML = html;
}

// Read-only open-ended summary: score/status per learner only. No
// per-learner accordion (that only ever housed the grading form), no
// Release/Unpublish toggle.
function renderMobileOpenEndedGrades(data, apiArea) {
    const results = data.results || [];
    const fullyGraded = data.quiz_fully_graded === true || data.quiz_fully_graded === 1;

    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div>
                    <div class="gr-panel-title">${escapeHtml(data.quiz_title || 'Assessment Results')}</div>
                    <div class="gr-panel-meta">${results.length} submitted learner${results.length !== 1 ? 's' : ''}</div>
                </div>
            </div>`;

    if (results.length === 0) {
        html += `<p class="teacher-empty-state">No submitted attempts found for this assessment.</p>`;
    } else {
        results.forEach(learner => {
            const openQuestions = learner.open_ended || [];
            const pendingCount = openQuestions.filter(question => !question.grade).length;
            const scoreDisplay = data.has_open_ended == 1 && !fullyGraded
                ? '***'
                : escapeHtml(learner.score ?? '0');
            const badge = learner.is_fully_graded
                ? `<span class="gr-oe-badge gr-oe-badge--graded">Fully Graded</span>`
                : `<span class="gr-oe-badge gr-oe-badge--pending">Pending ${pendingCount} question${pendingCount !== 1 ? 's' : ''}</span>`;

            html += `
                <div class="gr-oe-learner-card">
                    <div class="gr-oe-learner-card-top">
                        <div>
                            <div class="gr-oe-learner-name">${escapeHtml(learner.name || learner.user_email || 'Learner')}</div>
                            <div class="gr-oe-learner-score">Score: ${scoreDisplay} / ${escapeHtml(learner.total ?? '0')}</div>
                        </div>
                        <div class="gr-oe-learner-actions">
                            ${badge}
                        </div>
                    </div>
                </div>`;
        });
    }

    html += `</div>`;
    apiArea.innerHTML = html;
}

function renderQuizGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn" onclick="fetchTeacherGrades()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Grades
            </button>
        </div>

        <h3 class="teacher-quiz-grades-title">${escapeHtml(data.quiz_title)}</h3>
        <p class="teacher-quiz-grades-meta">${data.learners.length} learner${data.learners.length !== 1 ? 's' : ''}</p>`;

    if (data.learners.length === 0) {
        html += `<p class="teacher-empty-state">No learners found in this class.</p>`;
    } else {
        html += `<div class="teacher-grades-table-wrapper">
            <table class="teacher-grades-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Edit</th>
                    </tr>
                </thead>
                <tbody>`;

        data.learners.forEach(learner => {
            const score = learner.score !== null
                ? `${escapeHtml(learner.score)} / ${escapeHtml(learner.total)}`
                : '<span class="gr-cell-muted">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span class="gr-cell-muted">—</span>';

            html += `
                <tr>
                    <td>${escapeHtml(learner.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>
                        <button class="teacher-edit-marks-btn" 
                            data-email="${escapeHtml(learner.email)}" data-name="${escapeHtml(learner.name)}" data-quiz-id="${data.quiz_id}" data-quiz-title="${escapeHtml(data.quiz_title)}" data-score="${escapeHtml(learner.score ?? '')}" data-total="${escapeHtml(learner.total ?? 100)}"
                            onclick="openEditMarksFromElement(this)">
                            Edit
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    apiArea.innerHTML = html;
}

function normalizeQuizResultsPayload(payload) {
    if (!payload) return null;
    if (payload.status === 'error' || payload.error) return null;
    return payload.data || payload;
}

function formatOpenEndedScore(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toString() : '';
}

function renderOpenEndedGrades(data, target, isPanel) {
    if (!target) return;
    const results = data.results || [];
    const fullyGraded = data.quiz_fully_graded === true || data.quiz_fully_graded === 1;
    const pendingLearners = results.filter(row => !row.is_fully_graded).length;
    const releaseDisabled = data.has_open_ended == 1 && !fullyGraded;
    const marksPublished = data.publish_marks == 1;
    const backButton = isPanel
        ? ''
        : `<button class="teacher-back-btn" data-action="open-ended-back">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Grades
            </button>`;

    let html = `
        <div class="${isPanel ? 'gr-panel-content' : ''}">
            ${!isPanel ? `<div class="teacher-resources-header">${backButton}</div>` : ''}
            <div class="gr-panel-header">
                <div>
                    <div class="gr-panel-title">${escapeHtml(data.quiz_title || 'Assessment Results')}</div>
                    <div class="gr-panel-meta">${results.length} submitted learner${results.length !== 1 ? 's' : ''}</div>
                </div>
                <div class="gr-oe-header-actions">
                    <button type="button" class="teacher-modal-submit gr-oe-release-btn" data-action="toggle-open-ended-publish" data-quiz-id="${escapeHtml(data.quiz_id)}" ${releaseDisabled ? 'disabled' : ''}
                        title="${releaseDisabled ? 'Grade all open-ended responses before releasing marks.' : ''}">
                        ${marksPublished ? 'Unpublish Marks' : 'Release Marks'}
                    </button>
                    ${releaseDisabled ? `<div class="gr-oe-warning-text">Grade all open-ended responses before releasing marks.</div>` : ''}
                    <div id="oeReleaseMessage" class="gr-oe-release-message"></div>
                </div>
            </div>`;

    if (results.length === 0) {
        html += `<p class="teacher-empty-state">No submitted attempts found for this assessment.</p>`;
    } else {
        results.forEach(learner => {
            const openQuestions = learner.open_ended || [];
            const pendingCount = openQuestions.filter(question => !question.grade).length;
            const scoreDisplay = data.has_open_ended == 1 && !fullyGraded
                ? '***'
                : escapeHtml(learner.score ?? '0');
            const badge = learner.is_fully_graded
                ? `<span class="gr-oe-badge gr-oe-badge--graded">Fully Graded</span>`
                : `<span class="gr-oe-badge gr-oe-badge--pending">Pending ${pendingCount} question${pendingCount !== 1 ? 's' : ''}</span>`;

            html += `
                <div class="gr-oe-learner-card">
                    <div class="gr-oe-learner-card-top">
                        <div>
                            <div class="gr-oe-learner-name">${escapeHtml(learner.name || learner.user_email || 'Learner')}</div>
                            <div class="gr-oe-learner-score">Score: ${scoreDisplay} / ${escapeHtml(learner.total ?? '0')}</div>
                        </div>
                        <div class="gr-oe-learner-actions">
                            ${badge}
                            <button type="button" class="teacher-edit-marks-btn gr-desktop-only-btn" data-action="toggle-open-ended-learner"
                                data-target-id="oe-learner-${escapeHtml(learner.attempt_id)}">
                                Grade Responses
                            </button>
                        </div>
                    </div>
                    <div id="oe-learner-${escapeHtml(learner.attempt_id)}" class="gr-oe-learner-questions">`;

            openQuestions.forEach(question => {
                const savedScore = question.grade ? formatOpenEndedScore(question.grade.score) : '';
                const feedback = question.grade && question.grade.feedback ? question.grade.feedback : '';
                html += `
                    <div class="gr-oe-question-block">
                        <div class="gr-oe-question-text">${escapeHtml(question.question_text || '')}</div>
                        <div class="gr-oe-question-points">Max points: ${escapeHtml(question.points)}</div>
                        <div class="gr-oe-answer-text">${escapeHtml(question.answer_text || 'No answer submitted.')}</div>
                        <div class="gr-oe-grade-grid">
                            <label class="gr-oe-grade-field-label">Score
                                <input type="number" min="0" max="${escapeHtml(question.points)}" step="0.01" class="teacher-modal-input gr-oe-grade-input"
                                    id="oe-score-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    value="${escapeHtml(savedScore)}">
                            </label>
                            <label class="gr-oe-grade-field-label">Feedback
                                <textarea class="teacher-modal-input gr-oe-grade-textarea" id="oe-feedback-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    rows="2">${escapeHtml(feedback)}</textarea>
                            </label>
                            <button type="button" class="teacher-edit-marks-btn" data-action="save-open-ended-grade"
                                data-attempt-id="${escapeHtml(learner.attempt_id)}"
                                data-question-id="${escapeHtml(question.question_id)}">
                                Save
                            </button>
                        </div>
                        ${question.grade ? `<div class="gr-oe-saved-note">&#10003; Saved: ${escapeHtml(savedScore || '0')} / ${escapeHtml(question.points)}</div>` : ''}
                    </div>`;
            });

            html += `</div></div>`;
        });
    }

    if (pendingLearners > 0) {
        html += `<div class="gr-oe-pending-footer">${pendingLearners} learner${pendingLearners !== 1 ? 's' : ''} still need manual grading.</div>`;
    }

    html += `</div>`;
    target.innerHTML = html;
}

async function refreshOpenEndedGrades(quizId, targetMode) {
    const res = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
        headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const payload = await res.json();
    const data = normalizeQuizResultsPayload(payload);
    if (!data) throw new Error(payload.message || payload.error || 'Unable to reload open-ended results.');
    window.currentOpenEndedQuizData = data;
    window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: data };
    const panel = document.getElementById('gr-main-panel');
    const apiArea = document.getElementById('api-content-area');
    renderOpenEndedGrades(data, targetMode === 'panel' && panel ? panel : apiArea, targetMode === 'panel');
}

async function saveOpenEndedGrade(button) {
    const attemptId = button.dataset.attemptId;
    const questionId = button.dataset.questionId;
    const score = document.getElementById(`oe-score-${attemptId}-${questionId}`)?.value ?? '';
    const feedback = document.getElementById(`oe-feedback-${attemptId}-${questionId}`)?.value ?? '';
    const quizId = window.currentOpenEndedQuizData?.quiz_id;
    const panel = document.getElementById('gr-main-panel');
    const targetMode = panel && panel.contains(button) ? 'panel' : 'mobile';

    const fd = new FormData();
    fd.append('attempt_id', attemptId);
    fd.append('question_id', questionId);
    fd.append('score', score);
    fd.append('feedback', feedback);

    const hideButtonLoader = window.showTeacherButtonLoader(button);
    try {
        const res = await fetch('api/teacher/grade_open_ended.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: fd
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Unable to save grade.');
        await refreshOpenEndedGrades(quizId, targetMode);
    } catch (e) {
        alert(e.message || 'Unable to save grade.');
    } finally {
        hideButtonLoader();
    }
}

async function toggleOpenEndedPublish(button) {
    if (button.disabled) return;
    const quizId = parseInt(button.dataset.quizId, 10);
    const message = document.getElementById('oeReleaseMessage');
    const hideButtonLoader = window.showTeacherButtonLoader(button);
    if (message) { message.style.display = 'none'; message.classList.remove('is-success', 'is-error'); }
    try {
        const res = await fetch('api/teacher/toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ quiz_id: quizId })
        });
        const data = await res.json();
        if (data.status !== 'success' && !data.success) throw new Error(data.message || 'Unable to release marks.');
        if (message) {
            message.textContent = data.newStatus == 1 || data.data?.newStatus == 1 ? 'Marks released.' : 'Marks unpublished.';
            message.classList.add('is-success');
            message.style.display = 'block';
        }
    } catch (e) {
        if (message) {
            message.textContent = e.message || 'Unable to release marks.';
            message.classList.add('is-error');
            message.style.display = 'block';
        } else {
            alert(e.message || 'Unable to release marks.');
        }
    } finally {
        await refreshOpenEndedGrades(quizId, document.getElementById('gr-main-panel') && document.getElementById('gr-main-panel').contains(button) ? 'panel' : 'mobile').catch(() => {});
        hideButtonLoader();
    }
}

document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'save-open-ended-grade') {
        saveOpenEndedGrade(actionEl);
    } else if (actionEl.dataset.action === 'toggle-open-ended-publish') {
        toggleOpenEndedPublish(actionEl);
    } else if (actionEl.dataset.action === 'toggle-open-ended-learner') {
        const target = document.getElementById(actionEl.dataset.targetId || '');
        if (target) {
            const isHidden = target.style.display === 'none';
            target.style.display = isHidden ? 'block' : 'none';
            actionEl.textContent = isHidden ? 'Hide Responses' : 'Grade Responses';
        }
    } else if (actionEl.dataset.action === 'open-ended-back') {
        fetchTeacherGrades();
    }
});

function getGradeBadgeClass(percentage) {
    const val = parseFloat(percentage);
    if (val >= 75) return 'grade-high';
    if (val >= 50) return 'grade-mid';
    return 'grade-low';
}

// ─────────────────────────────────────────────
// EDIT MARKS VIEW (mobile — replaces full apiArea)
// ─────────────────────────────────────────────
window.openEditMarks = function(email, name, quizId, quizTitle, currentScore, currentTotal) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const scoreVal = currentScore !== null ? currentScore : '';
    const totalVal = currentTotal !== null ? currentTotal : 100;

    apiArea.innerHTML = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn" onclick="renderQuizGrades(window.currentQuizData)">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to ${escapeHtml(quizTitle)}
            </button>
        </div>

        <div class="teacher-edit-marks-box">
            <h3 class="teacher-edit-marks-title">Edit Marks</h3>
            <p class="teacher-edit-marks-meta">
                <strong>${escapeHtml(name)}</strong><br>
                <span class="gr-edit-marks-meta-sub">${escapeHtml(quizTitle)}</span>
            </p>

            <label class="teacher-modal-label">Score Received</label>
            <input type="number" step="0.01" id="editScore" class="teacher-modal-input" 
                value="${escapeHtml(scoreVal)}" placeholder="e.g. 15">

            <label class="teacher-modal-label gr-form-label-spaced">Maximum Possible Score</label>
            <input type="number" step="0.01" id="editTotal" class="teacher-modal-input" 
                value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

            <div id="editMarksError" class="gr-form-error"></div>
            <div id="editMarksSuccess" class="gr-form-success"></div>

            <div class="gr-form-actions">
                <button class="teacher-modal-cancel gr-form-cancel-btn" 
                    onclick="renderQuizGrades(window.currentQuizData)">Cancel</button>
                <button class="teacher-modal-submit gr-form-submit-btn" 
                    id="saveMarksBtn"
                    data-email="${escapeHtml(email)}" data-quiz-id="${quizId}"
                    onclick="saveMarksFromElement(this)">
                    Save Marks
                </button>
            </div>
        </div>`;
};

window.openEditMarksFromElement = function(el) {
    openEditMarks(
        el.dataset.email || '',
        el.dataset.name || '',
        parseInt(el.dataset.quizId, 10),
        el.dataset.quizTitle || '',
        el.dataset.score === '' ? null : parseFloat(el.dataset.score),
        parseFloat(el.dataset.total || '100')
    );
};

window.saveMarks = async function(email, quizId) {
    const score     = document.getElementById('editScore').value;
    const total     = document.getElementById('editTotal').value;
    const errorDiv  = document.getElementById('editMarksError');
    const successDiv = document.getElementById('editMarksSuccess');
    const saveBtn   = document.getElementById('saveMarksBtn');
    const loader    = document.getElementById('loaderOverlay');
    const panel     = document.getElementById('gr-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;

    errorDiv.style.display   = 'none';
    successDiv.style.display = 'none';

    if (score === '') { errorDiv.textContent = 'Please enter a score.'; errorDiv.style.display = 'block'; return; }
    if (!total)       { errorDiv.textContent = 'Please enter the total.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('quiz_id',    quizId);
    fd.append('user_email', email);
    fd.append('score',      score);
    fd.append('total',      total);

    const hideSubmitLoader = window.showTeacherButtonLoader(saveBtn);

    try {
        const res  = await fetch('api/teacher/save_marks.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            successDiv.textContent = 'Marks saved successfully!';
            successDiv.style.display = 'block';

            // Update the cached quiz data so when we go back the table is fresh
            window.currentQuizData = null;
            delete window._teacherGradeQuizCache[quizId];
            setTimeout(async () => {
                const res2  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
                const fresh = await res2.json();
                window.currentQuizData = fresh;
                window._teacherGradeQuizCache[quizId] = { type: 'standard', data: fresh };

                // Refresh whichever view is active
                const panel = document.getElementById('gr-main-panel');
                if (panel) {
                    renderGradesInPanel(fresh, panel);
                } else {
                    renderQuizGrades(fresh);
                }
            }, 800);
        } else {
            errorDiv.textContent = data.error || 'Failed to save marks.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

window.saveMarksFromElement = function(el) {
    saveMarks(el.dataset.email || '', parseInt(el.dataset.quizId, 10));
};

// ─────────────────────────────────────────────
// ADD QUIZ MODAL
// ─────────────────────────────────────────────
async function loadGradesClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        const sel  = document.getElementById('quizClass');
        if (!sel) return;
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load classes', e);
    }
}

window.toggleWeightField = function() {
    const cb        = document.getElementById('quizSummative');
    const container = document.getElementById('weightContainer');
    if (container) container.style.display = cb.checked ? 'block' : 'none';
};

window.openAddQuizModal = function() {
    const modal = document.getElementById('addQuizModal');
    if (modal) modal.style.display = 'flex';
    const newBtn = document.getElementById('gr-new-btn');
    if (newBtn) newBtn.classList.add('active');
};

window.closeAddQuizModal = function() {
    const modal = document.getElementById('addQuizModal');
    if (modal) modal.style.display = 'none';
    const newBtn = document.getElementById('gr-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    document.getElementById('quizTitle').value       = '';
    document.getElementById('quizClass').value       = '';
    document.getElementById('quizSummative').checked  = false;
    document.getElementById('weightContainer').style.display = 'none';
    document.getElementById('addQuizError').style.display    = 'none';
};

window.submitAddQuiz = async function() {
    const title       = document.getElementById('quizTitle').value.trim();
    const classId     = document.getElementById('quizClass').value;
    const isSummative = document.getElementById('quizSummative').checked;
    const weight      = document.getElementById('quizWeight')?.value ?? '';
    const errorDiv    = document.getElementById('addQuizError');
    const submitBtn   = document.getElementById('addQuizSubmitBtn');
    const loader      = document.getElementById('loaderOverlay');

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter an assessment title.'; errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.';     errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',    title);
    fd.append('class_id', classId);
    if (isSummative) {
        fd.append('is_summative', '1');
        if (weight) fd.append('weight_percent', weight);
    }

    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

    try {
        const res  = await fetch('api/teacher/add_manual_quiz.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            closeAddQuizModal();
            window.teacherGradesCache = null;
            fetchTeacherGrades();
        } else {
            errorDiv.textContent = data.error || 'Failed to add assessment.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};