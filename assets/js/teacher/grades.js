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
window.teacherGradesCache  = null;
window.currentQuizData     = null;

// ─────────────────────────────────────────────
// GRADES LIST
// ─────────────────────────────────────────────
window.fetchTeacherGrades = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_grades");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_grades");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherGradesCache) {
        renderTeacherGrades(window.teacherGradesCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_grades.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherGradesCache = data;
        renderTeacherGrades(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading grades.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
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
        sidebarHtml = `<p style="padding:16px;font-size:13px;color:#555e6a;">No quizzes found.</p>`;
    } else {
        data.forEach(termData => {
            sidebarHtml += `<div class="gr-sidebar-term-label">TERM ${termData.term}</div>`;
            termData.classes.forEach(cls => {
                sidebarHtml += `<div class="gr-sidebar-class-label">${escapeHtml(cls.class_name)}</div>`;
                cls.quizzes.forEach(quiz => {
                    sidebarHtml += `
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
            });
        });
    }

    let html = `
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .gr-desktop-layout { display: flex !important; }
                .gr-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .gr-desktop-layout { display: none !important; }
                .gr-mobile-list    { display: block !important; }
            }

            .gr-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            /* Left sidebar */
            .gr-sidebar {
                width: 260px;
                min-width: 220px;
                max-width: 280px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .gr-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .gr-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .gr-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .gr-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .gr-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .gr-sidebar-term-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #555e6a;
                text-transform: uppercase;
            }
            .gr-sidebar-class-label {
                padding: 4px 16px 2px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .gr-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .gr-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .gr-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .gr-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .gr-sidebar-item-info { flex: 1; min-width: 0; }
            .gr-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .gr-sidebar-item.active .gr-sidebar-item-title { color: #e2e8f0; }
            .gr-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            /* Right panel */
            .gr-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .gr-main-panel::-webkit-scrollbar { width: 5px; }
            .gr-main-panel::-webkit-scrollbar-track { background: transparent; }
            .gr-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .gr-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .gr-panel-empty svg { opacity: 0.3; }
            .gr-panel-empty p { font-size: 14px; margin: 0; }

            .gr-panel-content { padding: 28px 32px; }

            .gr-panel-header {
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .gr-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 4px;
            }
            .gr-panel-meta {
                font-size: 13px;
                color: #8b949e;
            }
            @media (max-width: 899px) {
                .gr-desktop-only-btn { display: none !important; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="gr-desktop-layout">
            <!-- Left Sidebar -->
            <div class="gr-sidebar">
                <div class="gr-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Quizzes</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openAddQuizModal()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        + New
                    </button>
                </div>
                <div class="gr-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="gr-main-panel" id="gr-main-panel">
                <div class="gr-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select a quiz to view learner grades</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="gr-mobile-list">
            <div class="teacher-grades-info">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" style="flex-shrink:0;margin-top:2px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Click any quiz to view learner grades.</span>
            </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No quizzes found.</p>`;
    } else {
        data.forEach(termData => {
            html += `<div class="teacher-term-divider">Term ${termData.term}</div>`;

            termData.classes.forEach(cls => {
                html += `
                    <div class="teacher-resource-section">
                        <div class="teacher-resource-class-label">${escapeHtml(cls.class_name)}</div>`;

                cls.quizzes.forEach(quiz => {
                    html += `
                        <div class="teacher-resource-card" data-quiz-id="${quiz.id}" data-quiz-title="${escapeHtml(quiz.title)}" onclick="openQuizGradesFromElement(this)">
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

                html += `</div>`;
            });
        });
    }

    html += `</div>`;

    // Add Quiz Modal
    html += `
        <div id="addQuizModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:440px;">
                <div class="teacher-modal-header">
                    <span>Add Quiz Manually</span>
                    <button onclick="closeAddQuizModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <div class="teacher-grades-info" style="margin-bottom:16px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" style="flex-shrink:0;margin-top:2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>After adding, find the quiz in the list and click it to enter each learner's marks.</span>
                    </div>

                    <label class="teacher-modal-label">Quiz Title *</label>
                    <input type="text" id="quizTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Test">

                    <label class="teacher-modal-label">Select Class *</label>
                    <select id="quizClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="quizSummative" onchange="toggleWeightField()">
                        Counts toward term mark
                    </label>

                    <div id="weightContainer" style="display:none;margin-top:12px;">
                        <label class="teacher-modal-label">Weight %</label>
                        <input type="number" id="quizWeight" class="teacher-modal-input"
                            min="0" max="100" step="0.1" placeholder="e.g. 30" style="max-width:150px;">
                    </div>

                    <div id="addQuizError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeAddQuizModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitAddQuiz()" class="teacher-modal-submit" id="addQuizSubmitBtn">Add Quiz</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    loadGradesClasses();
}

// ── DESKTOP PANEL: SELECT QUIZ ───────────────────────────────────────────────
window.selectDesktopGradeQuiz = async function(quizId) {
    document.querySelectorAll('.gr-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`gr-sidebar-${quizId}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeDesktopGradeQuizId = quizId;

    const panel  = document.getElementById('gr-main-panel');
    const loader = document.getElementById('loaderOverlay');
    if (!panel) return;

    // Show a loading state inside the panel
    panel.innerHTML = `
        <div class="gr-panel-empty">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                style="animation:spin 1s linear infinite;">
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
            renderOpenEndedGrades(resultData, panel, true);
        } else {
            window.currentQuizData = data;
            renderGradesInPanel(data, panel);
        }
    } catch (e) {
        panel.innerHTML = `<div class="gr-panel-empty"><p style="color:#f85149;">Error loading grades.</p></div>`;
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
                : '<span style="color:#555e6a;">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span style="color:#555e6a;">—</span>';

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
            <div class="gr-panel-header" style="display:flex;align-items:center;gap:12px;">
                <button onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))"
                    style="background:none;border:1px solid rgba(255,255,255,0.1);color:#8b949e;
                           border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;
                           display:flex;align-items:center;gap:6px;">
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

                <label class="teacher-modal-label" style="margin-top:14px;">Maximum Possible Score</label>
                <input type="number" step="0.01" id="editTotal" class="teacher-modal-input"
                    value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

                <div id="editMarksError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                <div id="editMarksSuccess" style="color:#4fd1c5;font-size:13px;margin-top:10px;display:none;"></div>

                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button class="teacher-modal-cancel" style="flex:1;"
                        onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))">Cancel</button>
                    <button class="teacher-modal-submit" style="flex:2;"
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
// QUIZ GRADES VIEW (mobile — replaces full apiArea)
// ─────────────────────────────────────────────
window.openQuizGrades = async function(quizId, quizTitle) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

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
            renderOpenEndedGrades(resultData, apiArea, false);
        } else {
            window.currentQuizData = data;
            renderQuizGrades(data);
        }
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading grades.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

window.openEditMarksInPanelFromElement = function(el) {
    openEditMarksInPanel(
        el.dataset.email || '',
        el.dataset.name || '',
        parseInt(el.dataset.quizId, 10),
        el.dataset.quizTitle || '',
        el.dataset.score === '' ? null : parseFloat(el.dataset.score),
        parseFloat(el.dataset.total || '100')
    );
};

window.openQuizGradesFromElement = function(el) {
    openQuizGrades(parseInt(el.dataset.quizId, 10), el.dataset.quizTitle || '');
};

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
                : '<span style="color:#555e6a;">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span style="color:#555e6a;">—</span>';

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
                    <div class="gr-panel-title">${escapeHtml(data.quiz_title || 'Quiz Results')}</div>
                    <div class="gr-panel-meta">${results.length} submitted learner${results.length !== 1 ? 's' : ''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                    <button type="button" class="teacher-modal-submit" data-action="toggle-open-ended-publish" data-quiz-id="${escapeHtml(data.quiz_id)}" ${releaseDisabled ? 'disabled' : ''}
                        title="${releaseDisabled ? 'Grade all open-ended responses before releasing marks.' : ''}"
                        style="padding:9px 12px;font-size:12px;opacity:${releaseDisabled ? '0.55' : '1'};cursor:${releaseDisabled ? 'not-allowed' : 'pointer'};">
                        ${marksPublished ? 'Unpublish Marks' : 'Release Marks'}
                    </button>
                    ${releaseDisabled ? `<div style="color:#f5c38b;font-size:12px;text-align:right;">Grade all open-ended responses before releasing marks.</div>` : ''}
                    <div id="oeReleaseMessage" style="display:none;font-size:12px;text-align:right;"></div>
                </div>
            </div>`;

    if (results.length === 0) {
        html += `<p class="teacher-empty-state">No submitted attempts found for this quiz.</p>`;
    } else {
        results.forEach(learner => {
            const openQuestions = learner.open_ended || [];
            const pendingCount = openQuestions.filter(question => !question.grade).length;
            const scoreDisplay = data.has_open_ended == 1 && !fullyGraded
                ? '***'
                : escapeHtml(learner.score ?? '0');
            const badge = learner.is_fully_graded
                ? `<span style="background:rgba(63,185,80,0.12);border:1px solid rgba(63,185,80,0.35);color:#7ee787;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;">Fully Graded</span>`
                : `<span style="background:rgba(242,140,56,0.12);border:1px solid rgba(242,140,56,0.35);color:#f5c38b;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;">Pending ${pendingCount} question${pendingCount !== 1 ? 's' : ''}</span>`;

            html += `
                <div style="background:#1a1919;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;margin:14px 0;">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
                        <div>
                            <div style="color:#e2e8f0;font-weight:800;">${escapeHtml(learner.name || learner.user_email || 'Learner')}</div>
                            <div style="color:#8b949e;font-size:12px;margin-top:3px;">Score: ${scoreDisplay} / ${escapeHtml(learner.total ?? '0')}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
                            ${badge}
                            <button type="button" class="teacher-edit-marks-btn gr-desktop-only-btn" data-action="toggle-open-ended-learner"
                                data-target-id="oe-learner-${escapeHtml(learner.attempt_id)}">
                                Grade Responses
                            </button>
                        </div>
                    </div>
                    <div id="oe-learner-${escapeHtml(learner.attempt_id)}" style="display:none;">`;

            openQuestions.forEach(question => {
                const savedScore = question.grade ? formatOpenEndedScore(question.grade.score) : '';
                const feedback = question.grade && question.grade.feedback ? question.grade.feedback : '';
                html += `
                    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:12px;">
                        <div style="color:#c9d1d9;font-weight:700;font-size:13px;line-height:1.45;">${escapeHtml(question.question_text || '')}</div>
                        <div style="color:#8b949e;font-size:12px;margin-top:4px;">Max points: ${escapeHtml(question.points)}</div>
                        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#d8dee9;font-size:13px;line-height:1.5;padding:12px;margin:10px 0;white-space:pre-wrap;">${escapeHtml(question.answer_text || 'No answer submitted.')}</div>
                        <div style="display:grid;grid-template-columns:minmax(90px,140px) 1fr auto;gap:10px;align-items:end;">
                            <label style="display:flex;flex-direction:column;gap:5px;color:#8b949e;font-size:12px;">Score
                                <input type="number" min="0" max="${escapeHtml(question.points)}" step="0.01" class="teacher-modal-input"
                                    id="oe-score-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    value="${escapeHtml(savedScore)}" style="margin:0;">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:5px;color:#8b949e;font-size:12px;">Feedback
                                <textarea class="teacher-modal-input" id="oe-feedback-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    rows="2" style="margin:0;resize:vertical;">${escapeHtml(feedback)}</textarea>
                            </label>
                            <button type="button" class="teacher-edit-marks-btn" data-action="save-open-ended-grade"
                                data-attempt-id="${escapeHtml(learner.attempt_id)}"
                                data-question-id="${escapeHtml(question.question_id)}">
                                Save
                            </button>
                        </div>
                        ${question.grade ? `<div style="color:#7ee787;font-size:12px;margin-top:8px;font-weight:700;">&#10003; Saved: ${escapeHtml(savedScore || '0')} / ${escapeHtml(question.points)}</div>` : ''}
                    </div>`;
            });

            html += `</div></div>`;
        });
    }

    if (pendingLearners > 0) {
        html += `<div style="color:#f5c38b;font-size:12px;margin-top:10px;">${pendingLearners} learner${pendingLearners !== 1 ? 's' : ''} still need manual grading.</div>`;
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

    button.disabled = true;
    button.textContent = 'Saving...';
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
        button.disabled = false;
        button.textContent = 'Save';
    }
}

async function toggleOpenEndedPublish(button) {
    if (button.disabled) return;
    const quizId = parseInt(button.dataset.quizId, 10);
    const message = document.getElementById('oeReleaseMessage');
    button.disabled = true;
    button.textContent = 'Updating...';
    if (message) message.style.display = 'none';
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
            message.style.color = '#7ee787';
            message.style.display = 'block';
        }
    } catch (e) {
        if (message) {
            message.textContent = e.message || 'Unable to release marks.';
            message.style.color = '#f85149';
            message.style.display = 'block';
        } else {
            alert(e.message || 'Unable to release marks.');
        }
    } finally {
        await refreshOpenEndedGrades(quizId, document.getElementById('gr-main-panel') && document.getElementById('gr-main-panel').contains(button) ? 'panel' : 'mobile').catch(() => {});
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
                <span style="color:#8b949e;">${escapeHtml(quizTitle)}</span>
            </p>

            <label class="teacher-modal-label">Score Received</label>
            <input type="number" step="0.01" id="editScore" class="teacher-modal-input" 
                value="${escapeHtml(scoreVal)}" placeholder="e.g. 15">

            <label class="teacher-modal-label" style="margin-top:14px;">Maximum Possible Score</label>
            <input type="number" step="0.01" id="editTotal" class="teacher-modal-input" 
                value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

            <div id="editMarksError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
            <div id="editMarksSuccess" style="color:#4fd1c5;font-size:13px;margin-top:10px;display:none;"></div>

            <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="teacher-modal-cancel" style="flex:1;" 
                    onclick="renderQuizGrades(window.currentQuizData)">Cancel</button>
                <button class="teacher-modal-submit" style="flex:2;" 
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

    errorDiv.style.display   = 'none';
    successDiv.style.display = 'none';

    if (score === '') { errorDiv.textContent = 'Please enter a score.'; errorDiv.style.display = 'block'; return; }
    if (!total)       { errorDiv.textContent = 'Please enter the total.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('quiz_id',    quizId);
    fd.append('user_email', email);
    fd.append('score',      score);
    fd.append('total',      total);

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/save_marks.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            successDiv.textContent = 'Marks saved successfully!';
            successDiv.style.display = 'block';

            // Update the cached quiz data so when we go back the table is fresh
            window.currentQuizData = null;
            setTimeout(async () => {
                const res2  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
                const fresh = await res2.json();
                window.currentQuizData = fresh;

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
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Marks';
        if (loader) loader.style.display = 'none';
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
};

window.closeAddQuizModal = function() {
    const modal = document.getElementById('addQuizModal');
    if (modal) modal.style.display = 'none';
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

    if (!title)   { errorDiv.textContent = 'Please enter a quiz title.'; errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.';     errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',    title);
    fd.append('class_id', classId);
    if (isSummative) {
        fd.append('is_summative', '1');
        if (weight) fd.append('weight_percent', weight);
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Adding...';
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/add_manual_quiz.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            closeAddQuizModal();
            window.teacherGradesCache = null;
            fetchTeacherGrades();
        } else {
            errorDiv.textContent = data.error || 'Failed to add quiz.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Add Quiz';
        if (loader) loader.style.display = 'none';
    }
};