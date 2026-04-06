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
                sidebarHtml += `<div class="gr-sidebar-class-label">${cls.class_name}</div>`;
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
                                <div class="gr-sidebar-item-title">${quiz.title}</div>
                                <div class="gr-sidebar-item-meta">${quiz.created_at}</div>
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
        </style>

        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Grades</h2>
            <button class="teacher-upload-btn" onclick="openAddQuizModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Quiz
            </button>
        </div>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="gr-desktop-layout">
            <!-- Left Sidebar -->
            <div class="gr-sidebar">
                <div class="gr-sidebar-header">All Quizzes</div>
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
                <span>Click any quiz to view learner grades. Use <strong>Add Quiz</strong> to manually record marks for schools without online quizzes.</span>
            </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No quizzes found.</p>`;
    } else {
        data.forEach(termData => {
            html += `<div class="teacher-term-divider">Term ${termData.term}</div>`;

            termData.classes.forEach(cls => {
                html += `
                    <div class="teacher-resource-section">
                        <div class="teacher-resource-class-label">${cls.class_name}</div>`;

                cls.quizzes.forEach(quiz => {
                    html += `
                        <div class="teacher-resource-card" onclick="openQuizGrades(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}')">
                            <div class="teacher-resource-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <div class="teacher-resource-info">
                                <div class="teacher-resource-name">${quiz.title}</div>
                                <div class="teacher-resource-meta">${quiz.created_at}</div>
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
        window.currentQuizData = data;
        renderGradesInPanel(data, panel);
    } catch (e) {
        panel.innerHTML = `<div class="gr-panel-empty"><p style="color:#f85149;">Error loading grades.</p></div>`;
    }
};

function renderGradesInPanel(data, panel) {
    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div class="gr-panel-title">${data.quiz_title}</div>
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
                ? `${learner.score} / ${learner.total}`
                : '<span style="color:#555e6a;">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${learner.percentage}</span>`
                : '<span style="color:#555e6a;">—</span>';

            html += `
                <tr>
                    <td>${learner.name}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>
                        <button class="teacher-edit-marks-btn"
                            onclick="openEditMarksInPanel('${learner.email.replace(/'/g, "\\'")}', '${learner.name.replace(/'/g, "\\'")}', ${data.quiz_id}, '${data.quiz_title.replace(/'/g, "\\'")}', ${learner.score ?? 'null'}, ${learner.total ?? 100})">
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
                    <div class="gr-panel-meta">${name} &bull; ${quizTitle}</div>
                </div>
            </div>

            <div class="teacher-edit-marks-box">
                <label class="teacher-modal-label">Score Received</label>
                <input type="number" step="0.01" id="editScore" class="teacher-modal-input"
                    value="${scoreVal}" placeholder="e.g. 15">

                <label class="teacher-modal-label" style="margin-top:14px;">Maximum Possible Score</label>
                <input type="number" step="0.01" id="editTotal" class="teacher-modal-input"
                    value="${totalVal}" placeholder="e.g. 20">

                <div id="editMarksError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                <div id="editMarksSuccess" style="color:#4fd1c5;font-size:13px;margin-top:10px;display:none;"></div>

                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button class="teacher-modal-cancel" style="flex:1;"
                        onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))">Cancel</button>
                    <button class="teacher-modal-submit" style="flex:2;"
                        id="saveMarksBtn"
                        onclick="saveMarks('${email.replace(/'/g, "\\'")}', ${quizId})">
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

        window.currentQuizData = data;
        renderQuizGrades(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading grades.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
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

        <h3 class="teacher-quiz-grades-title">${data.quiz_title}</h3>
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
                ? `${learner.score} / ${learner.total}`
                : '<span style="color:#555e6a;">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${learner.percentage}</span>`
                : '<span style="color:#555e6a;">—</span>';

            html += `
                <tr>
                    <td>${learner.name}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>
                        <button class="teacher-edit-marks-btn" 
                            onclick="openEditMarks('${learner.email.replace(/'/g, "\\'")}', '${learner.name.replace(/'/g, "\\'")}', ${data.quiz_id}, '${data.quiz_title.replace(/'/g, "\\'")}', ${learner.score ?? 'null'}, ${learner.total ?? 100})">
                            Edit
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    apiArea.innerHTML = html;
}

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
                Back to ${quizTitle}
            </button>
        </div>

        <div class="teacher-edit-marks-box">
            <h3 class="teacher-edit-marks-title">Edit Marks</h3>
            <p class="teacher-edit-marks-meta">
                <strong>${name}</strong><br>
                <span style="color:#8b949e;">${quizTitle}</span>
            </p>

            <label class="teacher-modal-label">Score Received</label>
            <input type="number" step="0.01" id="editScore" class="teacher-modal-input" 
                value="${scoreVal}" placeholder="e.g. 15">

            <label class="teacher-modal-label" style="margin-top:14px;">Maximum Possible Score</label>
            <input type="number" step="0.01" id="editTotal" class="teacher-modal-input" 
                value="${totalVal}" placeholder="e.g. 20">

            <div id="editMarksError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
            <div id="editMarksSuccess" style="color:#4fd1c5;font-size:13px;margin-top:10px;display:none;"></div>

            <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="teacher-modal-cancel" style="flex:1;" 
                    onclick="renderQuizGrades(window.currentQuizData)">Cancel</button>
                <button class="teacher-modal-submit" style="flex:2;" 
                    id="saveMarksBtn"
                    onclick="saveMarks('${email.replace(/'/g, "\\'")}', ${quizId})">
                    Save Marks
                </button>
            </div>
        </div>`;
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
        const res  = await fetch('api/teacher/save_marks.php', { method: 'POST', body: fd });
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
        const res  = await fetch('api/teacher/add_manual_quiz.php', { method: 'POST', body: fd });
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