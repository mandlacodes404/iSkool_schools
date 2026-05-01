window.teacherQuizzesCache = null;
window.currentQuizResultsData = null;

// ─────────────────────────────────────────────
// QUIZ LIST
// ─────────────────────────────────────────────
window.fetchTeacherQuizzes = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_quizzes");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_quizzes");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherQuizzesCache) {
        renderTeacherQuizzes(window.teacherQuizzesCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_quizzes.php');
        const data = await res.json();
        window.teacherQuizzesCache = data;
        renderTeacherQuizzes(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading quizzes.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// Track active quiz for desktop panel
window._activeDesktopQuizId = null;

function renderTeacherQuizzes(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const terms       = data.terms || [];
    const currentTerm = data.current_term || 1;
    const yearName    = data.year_name || '';

    // ── Collect all quizzes flat for desktop panel lookup ──
    window._allQuizzesFlat = [];
    terms.forEach(termData => {
        termData.classes.forEach(cls => {
            cls.quizzes.forEach(quiz => {
                window._allQuizzesFlat.push({ ...quiz, class_name: cls.class_name, term: termData.term });
            });
        });
    });

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!terms || terms.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state" style="padding:16px;font-size:13px;">No quizzes found.</p>`;
    } else {
        terms.forEach(termData => {
            const isActive = termData.term === currentTerm;
            sidebarHtml += `
                <div class="qz-sidebar-term">
                    <div class="qz-sidebar-term-label">
                        TERM ${termData.term}
                        ${isActive ? '<span class="qz-sidebar-term-active">ACTIVE</span>' : ''}
                    </div>`;
            termData.classes.forEach(cls => {
                sidebarHtml += `<div class="qz-sidebar-class-label">${cls.class_name}</div>`;
                cls.quizzes.forEach(quiz => {
                    const statusColor = quiz.status === 'Open' ? '#f28c38'
                        : quiz.status === 'Scheduled' ? '#1e90ff' : '#6b7280';
                    sidebarHtml += `
                        <div class="qz-sidebar-item" id="qz-sidebar-${quiz.id}"
                            onclick="selectDesktopQuiz(${quiz.id})">
                            <div class="qz-sidebar-item-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <line x1="18" y1="20" x2="18" y2="10"></line>
                                    <line x1="12" y1="20" x2="12" y2="4"></line>
                                    <line x1="6" y1="20" x2="6" y2="14"></line>
                                </svg>
                            </div>
                            <div class="qz-sidebar-item-info">
                                <div class="qz-sidebar-item-title">${quiz.title}</div>
                                <div class="qz-sidebar-item-meta">${quiz.duration} min</div>
                            </div>
                            <span class="qz-sidebar-status-dot" style="background:${statusColor};"></span>
                        </div>`;
                });
            });
            sidebarHtml += `</div>`;
        });
    }

    // ── Build full HTML: header + split layout ──
    let html = `
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .qz-desktop-layout { display: flex !important; }
                .qz-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .qz-desktop-layout { display: none !important; }
                .qz-mobile-list    { display: block !important; }
            }

            .qz-desktop-layout {
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
            .qz-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .qz-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .qz-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .qz-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .qz-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .qz-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .qz-sidebar-term { margin-bottom: 4px; }
            .qz-sidebar-term-label {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #555e6a;
                text-transform: uppercase;
            }
            .qz-sidebar-term-active {
                background: rgba(79,209,197,0.15);
                color: #4fd1c5;
                font-size: 9px;
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid rgba(79,209,197,0.3);
            }
            .qz-sidebar-class-label {
                padding: 4px 16px 2px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .qz-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .qz-sidebar-item:hover {
                background: rgba(255,255,255,0.04);
            }
            .qz-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .qz-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .qz-sidebar-item-info { flex: 1; min-width: 0; }
            .qz-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .qz-sidebar-item.active .qz-sidebar-item-title { color: #e2e8f0; }
            .qz-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .qz-sidebar-status-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            /* Right panel */
            .qz-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .qz-main-panel::-webkit-scrollbar { width: 5px; }
            .qz-main-panel::-webkit-scrollbar-track { background: transparent; }
            .qz-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .qz-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .qz-panel-empty svg { opacity: 0.3; }
            .qz-panel-empty p { font-size: 14px; margin: 0; }

            .qz-panel-content { padding: 28px 32px; }

            .qz-panel-quiz-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .qz-panel-quiz-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 6px;
            }
            .qz-panel-quiz-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .qz-panel-status-badge {
                padding: 3px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 700;
            }

            .qz-marks-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 14px 18px;
                margin-bottom: 12px;
            }
            .qz-marks-label {
                font-size: 13px;
                color: #8b949e;
                font-weight: 600;
            }

            .qz-actions-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-top: 8px;
            }
            .qz-action-card {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 18px 20px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 14px;
                font-size: 14px;
                font-weight: 700;
                color: #c9d1d9;
            }
            .qz-action-card:hover {
                background: rgba(255,255,255,0.06);
                border-color: rgba(255,255,255,0.15);
                transform: translateY(-1px);
            }
            .qz-action-card.publish { border-color: rgba(79,209,197,0.2); }
            .qz-action-card.publish:hover { border-color: #4fd1c5; background: rgba(79,209,197,0.08); color: #4fd1c5; }
            .qz-action-card.close   { border-color: rgba(248,81,73,0.2); }
            .qz-action-card.close:hover   { border-color: #f85149; background: rgba(248,81,73,0.08); color: #f85149; }
            .qz-action-card.reopen  { border-color: rgba(34,197,94,0.2); }
            .qz-action-card.reopen:hover  { border-color: #22c55e; background: rgba(34,197,94,0.08); color: #22c55e; }
            .qz-action-card.results { border-color: rgba(30,144,255,0.2); }
            .qz-action-card.results:hover { border-color: #1e90ff; background: rgba(30,144,255,0.08); color: #1e90ff; }
            .qz-action-card.integrity { border-color: rgba(242,140,56,0.2); }
            .qz-action-card.integrity:hover { border-color: #f28c38; background: rgba(242,140,56,0.08); color: #f28c38; }
            .qz-action-card-icon { flex-shrink: 0; }
            .qz-action-card-text { display: flex; flex-direction: column; gap: 2px; }
            .qz-action-card-sub  { font-size: 11px; font-weight: 400; color: #555e6a; }
        </style>

        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Quizzes</h2>
            <button class="teacher-upload-btn" onclick="openCreateQuiz()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Quiz
            </button>
        </div>
        <div class="teacher-year-badge">${yearName} &bull; Term ${currentTerm} Active</div>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="qz-desktop-layout">
            <!-- Left Sidebar -->
            <div class="qz-sidebar">
                <div class="qz-sidebar-header">All Quizzes</div>
                <div class="qz-sidebar-scroll">${sidebarHtml}</div>
            </div>

            <!-- Right Main Panel -->
            <div class="qz-main-panel" id="qz-main-panel">
                <div class="qz-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <p>Select a quiz from the left to manage it</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="qz-mobile-list">`;

    if (!terms || terms.length === 0) {
        html += `<p class="teacher-empty-state">No quizzes found for this year.</p>`;
    } else {
        terms.forEach(termData => {
            const isActive = termData.term === currentTerm;
            html += `
                <div class="teacher-term-card ${isActive ? 'term-active' : ''}">
                    <div class="teacher-term-card-header">
                        <span class="teacher-term-card-title">TERM ${termData.term}</span>
                        ${isActive ? '<span class="teacher-term-active-badge">ACTIVE</span>' : ''}
                    </div>`;

            termData.classes.forEach(cls => {
                html += `
                    <div class="teacher-resource-section" style="margin-top:0;">
                        <div class="teacher-resource-class-label">${cls.class_name}</div>`;

                cls.quizzes.forEach(quiz => {
                    const statusColor = quiz.status === 'Open'
                        ? '#f28c38'
                        : quiz.status === 'Scheduled'
                        ? '#1e90ff'
                        : '#6b7280';

                    html += `
                        <div class="teacher-quiz-card" data-quiz-id="${quiz.id}">
                            <div class="teacher-quiz-card-main" onclick="toggleQuizDetails(${quiz.id})">
                                <div class="teacher-resource-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                        <line x1="18" y1="20" x2="18" y2="10"></line>
                                        <line x1="12" y1="20" x2="12" y2="4"></line>
                                        <line x1="6" y1="20" x2="6" y2="14"></line>
                                    </svg>
                                </div>
                                <div class="teacher-resource-info">
                                    <div class="teacher-resource-name">${quiz.title}</div>
                                    <div class="teacher-resource-meta">
                                        ${quiz.duration} min &middot; ${quiz.start_time}
                                    </div>
                                </div>
                                <span class="teacher-quiz-status-badge" 
                                    style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;">
                                    ${quiz.status}
                                </span>
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                    class="teacher-quiz-chevron" id="chevron-${quiz.id}">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </div>

                            <div class="teacher-quiz-details" id="details-${quiz.id}" style="display:none;">
                                <div class="teacher-quiz-detail-row">
                                    <span class="teacher-quiz-detail-label">Marks</span>
                                    <span class="teacher-quiz-publish-status ${quiz.publish_marks ? 'published' : 'hidden'}"
                                        id="publish-label-${quiz.id}">
                                        ${quiz.publish_marks ? 'Published' : 'Hidden'}
                                    </span>
                                </div>

                                <div class="teacher-quiz-actions">
                                    <button class="teacher-quiz-action-btn publish"
                                        id="publish-btn-${quiz.id}"
                                        onclick="togglePublishMarks(${quiz.id})">
                                        ${quiz.publish_marks ? 'Unpublish Marks' : 'Publish Marks'}
                                    </button>
                                    <button class="teacher-quiz-action-btn ${quiz.status === 'Closed' ? 'reopen' : 'close'}"
                                        id="status-btn-${quiz.id}"
                                        onclick="toggleQuizStatus(${quiz.id}, '${quiz.status}')">
                                        ${quiz.status === 'Closed' ? 'Reopen Quiz' : 'Close Quiz'}
                                    </button>
                                    <button class="teacher-quiz-action-btn results"
                                        onclick="openQuizResults(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}')">
                                        View Results
                                    </button>
                                    <button class="teacher-quiz-action-btn integrity"
                                        onclick="openIntegrityModal(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}')">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        </svg>
                                        Integrity Report
                                    </button>
                                </div>
                            </div>
                        </div>`;
                });

                html += `</div>`;
            });

            html += `</div>`;
        });
    }

    html += `</div>`;

    // Integrity Modal
    html += `
        <div id="integrityModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:640px;max-height:85vh;overflow-y:auto;">
                <div class="teacher-modal-header">
                    <span id="integrityModalTitle">Integrity Report</span>
                    <button onclick="closeIntegrityModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body" id="integrityModalBody">
                    <div id="integrityWarning">
                        <div style="text-align:center;margin-bottom:24px;">
    <svg viewBox="0 0 24 24" width="44" height="44" stroke="#4fd1c5" stroke-width="1.5" fill="none" style="margin-bottom:12px;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
    <h3 style="color:#e2e8f0;margin:0 0 6px;letter-spacing:2px;font-size:16px;">INTEGRITY MONITOR</h3>
    <p style="color:#4fd1c5;font-size:12px;font-weight:700;letter-spacing:1px;margin:0;">POWERED BY AI INVIGILATOR</p>
</div>

<p style="line-height:1.8;color:#cbd5e0;font-size:14px;margin-bottom:20px;">
    Every quiz session is recorded in real time. When a learner leaves the quiz environment — 
    whether by switching tabs, minimizing the browser, or navigating away — the 
    <strong style="color:#e2e8f0;">exact question they were on is logged and timestamped.</strong>
</p>

<div style="background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.2);border-radius:12px;padding:16px;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style="color:#4fd1c5;font-size:12px;font-weight:800;letter-spacing:1px;">VERIFIED & TESTED</span>
    </div>
    <p style="margin:0;font-size:13px;color:#cbd5e0;line-height:1.7;">
        This report shows you <strong style="color:#e2e8f0;">precisely where interruptions happened, 
        question by question.</strong> No guesswork. No approximations. 
        Each finding is backed by a timestamped session log.
    </p>
</div>

<button class="teacher-modal-submit" style="width:100%;padding:15px;font-size:15px;letter-spacing:1px;"
    id="decodeBtn" onclick="decodeIntegrity()">
    VIEW SESSION REPORT
</button>
                    </div>
                    <div id="integrityResults" style="display:none;"></div>
                </div>
                <div class="teacher-modal-footer" id="integrityFooter" style="display:none;">
                    <button onclick="closeIntegrityModal()" class="teacher-modal-cancel">Dismiss</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT QUIZ
// ─────────────────────────────────────────────
window.selectDesktopQuiz = function(quizId) {
    // Update sidebar active state
    document.querySelectorAll('.qz-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`qz-sidebar-${quizId}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeDesktopQuizId = quizId;

    const quiz = (window._allQuizzesFlat || []).find(q => q.id == quizId);
    if (!quiz) return;

    const panel = document.getElementById('qz-main-panel');
    if (!panel) return;

    const statusColor = quiz.status === 'Open' ? '#f28c38'
        : quiz.status === 'Scheduled' ? '#1e90ff' : '#6b7280';

    const publishLabel = quiz.publish_marks ? 'Published' : 'Hidden';
    const publishBtnText = quiz.publish_marks ? 'Unpublish Marks' : 'Publish Marks';
    const statusBtnClass = quiz.status === 'Closed' ? 'reopen' : 'close';
    const statusBtnText  = quiz.status === 'Closed' ? 'Reopen Quiz' : 'Close Quiz';

    panel.innerHTML = `
        <div class="qz-panel-content">
            <div class="qz-panel-quiz-header">
                <div>
                    <div class="qz-panel-quiz-title" id="qz-panel-title-${quizId}">${quiz.title}</div>
                    <div class="qz-panel-quiz-meta">
                        <span>${quiz.class_name}</span>
                        <span>&bull;</span>
                        <span>${quiz.duration} min</span>
                        <span>&bull;</span>
                        <span>${quiz.start_time}</span>
                        <span class="qz-panel-status-badge" id="qz-panel-status-badge-${quizId}"
                            style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;">
                            ${quiz.status}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Marks Status Row -->
            <div class="qz-marks-row">
                <span class="qz-marks-label">Marks Visibility</span>
                <span class="teacher-quiz-publish-status ${quiz.publish_marks ? 'published' : 'hidden'}"
                    id="publish-label-${quizId}">${publishLabel}</span>
            </div>

            <!-- Action Cards Grid -->
            <div class="qz-actions-grid">
                <button class="qz-action-card publish"
                    id="publish-btn-${quizId}"
                    onclick="togglePublishMarks(${quizId})">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>${publishBtnText}</span>
                        <span class="qz-action-card-sub">Toggle mark visibility</span>
                    </div>
                </button>

                <button class="qz-action-card ${statusBtnClass}"
                    id="status-btn-${quizId}"
                    onclick="toggleQuizStatus(${quizId}, '${quiz.status}')">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            ${quiz.status === 'Closed'
                                ? '<polygon points="10 8 16 12 10 16 10 8"></polygon>'
                                : '<rect x="9" y="9" width="6" height="6"></rect>'}
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>${statusBtnText}</span>
                        <span class="qz-action-card-sub">Change quiz access</span>
                    </div>
                </button>

                <button class="qz-action-card results"
                    onclick="openQuizResults(${quizId}, '${quiz.title.replace(/'/g, "\\'")}')">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>View Results</span>
                        <span class="qz-action-card-sub">See submissions & scores</span>
                    </div>
                </button>

                <button class="qz-action-card integrity"
                    onclick="openIntegrityModal(${quizId}, '${quiz.title.replace(/'/g, "\\'")}')">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>Integrity Report</span>
                        <span class="qz-action-card-sub">AI-powered analysis</span>
                    </div>
                </button>
            </div>
        </div>`;
};

// ─────────────────────────────────────────────
// QUIZ CARD TOGGLE (mobile)
// ─────────────────────────────────────────────
window.toggleQuizDetails = function(quizId) {
    const details  = document.getElementById(`details-${quizId}`);
    const chevron  = document.getElementById(`chevron-${quizId}`);
    const isOpen   = details.style.display === 'block';
    details.style.display  = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// TOGGLE PUBLISH MARKS
// ─────────────────────────────────────────────
window.togglePublishMarks = async function(quizId) {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: quizId })
        });
        const data = await res.json();

        if (data.success) {
            const published = data.newStatus == 1;
            const label     = document.getElementById(`publish-label-${quizId}`);
            const btn       = document.getElementById(`publish-btn-${quizId}`);

            if (label) {
                label.textContent = published ? 'Published' : 'Hidden';
                label.className   = `teacher-quiz-publish-status ${published ? 'published' : 'hidden'}`;
            }
            if (btn) {
                // Desktop card button keeps full text; mobile button keeps short text
                const isDesktopBtn = btn.classList.contains('qz-action-card');
                btn.querySelector ? btn.querySelector('.qz-action-card-text span:first-child')
                    && (btn.querySelector('.qz-action-card-text span:first-child').textContent = published ? 'Unpublish Marks' : 'Publish Marks')
                    : (btn.textContent = published ? 'Unpublish Marks' : 'Publish Marks');
                if (!btn.classList.contains('qz-action-card')) {
                    btn.textContent = published ? 'Unpublish Marks' : 'Publish Marks';
                }
            }
            // Update cached quiz data so desktop re-select shows correct state
            if (window._allQuizzesFlat) {
                const q = window._allQuizzesFlat.find(q => q.id == quizId);
                if (q) q.publish_marks = published ? 1 : 0;
            }
            window.teacherQuizzesCache = null;
        } else {
            alert(data.message || 'Failed to update');
        }
    } catch (e) {
        alert('Connection error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// TOGGLE QUIZ STATUS
// ─────────────────────────────────────────────
window.toggleQuizStatus = async function(quizId, currentStatus) {
    const newStatus = currentStatus === 'Closed' ? 'Open' : 'Closed';
    const loader    = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/toggle_quiz_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: quizId, status: newStatus })
        });
        const data = await res.json();

        if (data.success) {
            const statusColor = newStatus === 'Open'
                ? '#f28c38' : newStatus === 'Scheduled'
                ? '#1e90ff' : '#6b7280';

            const badge = document.querySelector(
                `.teacher-quiz-card[data-quiz-id="${quizId}"] .teacher-quiz-status-badge`
            );
            const panelBadge = document.getElementById(`qz-panel-status-badge-${quizId}`);
            const btn = document.getElementById(`status-btn-${quizId}`);

            if (badge) {
                badge.textContent   = newStatus;
                badge.style.color   = statusColor;
                badge.style.background = `${statusColor}20`;
                badge.style.border  = `1px solid ${statusColor}50`;
            }
            if (panelBadge) {
                panelBadge.textContent = newStatus;
                panelBadge.style.color = statusColor;
                panelBadge.style.background = `${statusColor}20`;
                panelBadge.style.border = `1px solid ${statusColor}50`;
            }
            if (btn) {
                const newBtnText = newStatus === 'Closed' ? 'Reopen Quiz' : 'Close Quiz';
                const newBtnClass = newStatus === 'Closed' ? 'reopen' : 'close';
                // Handle both desktop card and mobile button
                if (btn.classList.contains('qz-action-card')) {
                    const span = btn.querySelector('.qz-action-card-text span:first-child');
                    if (span) span.textContent = newBtnText;
                    btn.className = `qz-action-card ${newBtnClass}`;
                } else {
                    btn.textContent = newBtnText;
                    btn.className   = `teacher-quiz-action-btn ${newBtnClass}`;
                }
                btn.onclick = () => toggleQuizStatus(quizId, newStatus);
            }
            // Update cached quiz data
            if (window._allQuizzesFlat) {
                const q = window._allQuizzesFlat.find(q => q.id == quizId);
                if (q) q.status = newStatus;
            }
            window.teacherQuizzesCache = null;
        } else {
            alert(data.message || 'Failed to update status');
        }
    } catch (e) {
        alert('Connection error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// QUIZ RESULTS VIEW
// ─────────────────────────────────────────────
window.openQuizResults = async function(quizId, quizTitle) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.currentQuizResultsData = data;
        renderQuizResults(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading results.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderQuizResults(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // On desktop, render inside the right panel; on mobile render in apiArea
    const panel = document.getElementById('qz-main-panel');
    const target = panel || apiArea;
    const backFn = panel ? `selectDesktopQuiz(${window._activeDesktopQuizId})` : 'fetchTeacherQuizzes()';
    const backLabel = panel ? 'Back to Quiz' : 'Back to Quizzes';

    let html = `
        <div class="teacher-resources-header" style="${panel ? 'padding:20px 32px 0;' : ''}">
            <button class="teacher-back-btn" onclick="${backFn}">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                ${backLabel}
            </button>
        </div>
        <div style="${panel ? 'padding:0 32px 28px;' : ''}">
        <h3 class="teacher-quiz-grades-title">${data.quiz_title}</h3>
        <p class="teacher-quiz-grades-meta">${data.results.length} submission${data.results.length !== 1 ? 's' : ''}</p>`;

    if (data.results.length === 0) {
        html += `<p class="teacher-empty-state">No submissions yet for this quiz.</p>`;
    } else {
        html += `
            <div class="teacher-grades-table-wrapper">
                <table class="teacher-grades-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Score</th>
                            <th>Percentage</th>
                            <th>Time Taken</th>
                            <th>Submitted</th>
                            <th>Script</th>
                        </tr>
                    </thead>
                    <tbody>`;

        data.results.forEach(r => {
            const perc = r.percentage !== 'N/A'
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(r.percentage)}">${r.percentage}</span>`
                : '<span style="color:#555e6a;">N/A</span>';

            html += `
                <tr>
                    <td>${r.name}</td>
                    <td>${r.score} / ${r.total}</td>
                    <td>${perc}</td>
                    <td>${r.time_taken}</td>
                    <td>${r.submitted_at}</td>
                    <td>
                        <button class="teacher-edit-marks-btn"
                            onclick="openQuizReview(${r.result_id}, '${data.quiz_title.replace(/'/g, "\\'")}')">
                            Review
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    target.innerHTML = html;
}

function getGradeBadgeClass(percentage) {
    const val = parseFloat(percentage);
    if (val >= 75) return 'grade-high';
    if (val >= 50) return 'grade-mid';
    return 'grade-low';
}

// ─────────────────────────────────────────────
// QUIZ REVIEW VIEW
// ─────────────────────────────────────────────
window.openQuizReview = async function(resultId, quizTitle) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/teacher/get_quiz_review.php?result_id=${resultId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderQuizReview(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading review.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderQuizReview(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const panel = document.getElementById('qz-main-panel');
    const target = panel || apiArea;
    const padStyle = panel ? 'padding:20px 32px 28px;' : '';

    let html = `
        <div class="teacher-resources-header" style="${panel ? 'padding:20px 32px 0;' : ''}">
            <button class="teacher-back-btn"
                onclick="renderQuizResults(window.currentQuizResultsData)">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Results
            </button>
        </div>

        <div style="${padStyle}">
        <div class="teacher-review-score-card">
            <div class="teacher-review-percentage">${data.percentage}%</div>
            <div class="teacher-review-title">${data.title}</div>
            <div class="teacher-review-meta">
                Points: <strong>${data.score} / ${data.total}</strong> &bull;
                Date: ${data.submitted_at}
            </div>
        </div>`;

    data.questions.forEach((q, i) => {
        html += `
            <div class="teacher-review-question">
                <div class="teacher-review-q-meta">Question ${i + 1} (${q.points} point${q.points != 1 ? 's' : ''})</div>
                <div class="teacher-review-q-text">${q.text}</div>`;

        if (q.image) {
            html += `<img src="${q.image}" class="teacher-review-q-image" alt="Question image">`;
        }

        q.choices.forEach(choice => {
            const isSelected = choice.id == q.selected;
            const isCorrect  = choice.is_correct == 1;

            let cls = '';
            let icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#555e6a" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>`;

            if (isCorrect) {
                cls  = 'correct';
                icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#27ae60" stroke-width="2" fill="none">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>`;
            } else if (isSelected && !isCorrect) {
                cls  = 'incorrect';
                icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#e74c3c" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>`;
            }

            html += `
                <div class="teacher-review-choice ${cls}">
                    ${icon}
                    <span>${choice.text}</span>
                    ${isSelected ? '<span class="teacher-review-your-answer">Your Answer</span>' : ''}
                </div>`;
        });

        html += `</div>`;
    });

    html += `</div>`;
    target.innerHTML = html;
}

// ─────────────────────────────────────────────
// CREATE QUIZ VIEW
// ─────────────────────────────────────────────
window.openCreateQuiz = async function() {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    const panel   = document.getElementById('qz-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;
    const target  = isDesktop ? panel : apiArea;

    if (loader) loader.style.display = 'flex';

    try {
        const [classRes, termRes] = await Promise.all([
            fetch('api/teacher/get_classes.php'),
            fetch('api/teacher/get_quizzes.php')
        ]);
        const classes = await classRes.json();
        const quizData = await termRes.json();
        const currentTerm = quizData.current_term || 1;

        // Clear sidebar active state on desktop
        if (isDesktop) {
            document.querySelectorAll('.qz-sidebar-item').forEach(el => el.classList.remove('active'));
        }

        const headerPad = isDesktop ? 'padding:20px 32px 0;' : '';
        const formPad   = isDesktop ? 'padding:0 32px 32px;' : '';
        const titleSize = isDesktop ? '18px' : '22px';
        const titleMargin = isDesktop ? '0 0 20px' : '0 0 24px';

        target.innerHTML = `
            <div class="teacher-resources-header" style="${headerPad}">
                <button class="teacher-back-btn" onclick="fetchTeacherQuizzes()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    ${isDesktop ? 'Back' : 'Back to Quizzes'}
                </button>
            </div>

            <div style="max-width:${isDesktop ? '560px' : '700px'};margin:0 auto;${formPad}">
                <h2 style="color:#4fd1c5;font-size:${titleSize};margin:${titleMargin};font-weight:800;">Create a New Quiz</h2>

                <form id="createQuizForm" enctype="multipart/form-data">

                    <label class="teacher-modal-label">Quiz Title *</label>
                    <input type="text" name="quiz_title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 3 Test" required>

                    <label class="teacher-modal-label">Assign to Class *</label>
                    <div id="quizClassPicker"></div>

                    <label class="teacher-modal-label">Duration (minutes) *</label>
                    <input type="number" name="duration" class="teacher-modal-input"
                        min="1" max="180" placeholder="e.g. 60" required style="max-width:160px;">

                    <label class="teacher-modal-label">Start Time *</label>
                    <input type="datetime-local" name="start_time" class="teacher-modal-input" required>

                    <label class="teacher-modal-label">Quiz Status</label>
                    <select name="status" class="teacher-modal-input">
                        <option value="Scheduled">Scheduled (Opens at start time)</option>
                        <option value="Open">Open (Available immediately)</option>
                        <option value="Closed">Closed (Not accessible)</option>
                    </select>

                    <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;">
                        <label style="display:flex;align-items:center;gap:10px;color:#c9d1d9;font-size:14px;cursor:pointer;">
                            <input type="checkbox" name="publish_marks" value="1"
                                style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;">
                            Publish marks immediately after submission
                        </label>

                        <label style="display:flex;align-items:center;gap:10px;color:#c9d1d9;font-size:14px;cursor:pointer;">
                            <input type="checkbox" name="is_summative" value="1" id="cqSummative"
                                style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;"
                                onchange="toggleCqWeight()">
                            Counts toward official term mark
                        </label>

                        <div id="cqWeightContainer" style="display:none;margin-left:28px;">
                            <label class="teacher-modal-label">Weight % of term mark</label>
                            <input type="number" name="weight_percent" id="cqWeight"
                                class="teacher-modal-input" min="0" max="100" step="0.1"
                                placeholder="e.g. 30" style="max-width:150px;">
                        </div>

                        <label style="display:flex;align-items:flex-start;gap:10px;color:#c9d1d9;font-size:13px;cursor:pointer;background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.15);border-radius:10px;padding:12px;">
                            <input type="checkbox" name="force_email" value="1"
                                style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;margin-top:2px;flex-shrink:0;">
                            <span>Learners automatically get mobile notifications. Tick this box to also send email notifications (not recommended — heavy on server).</span>
                        </label>
                    </div>

                    <!-- Term Info -->
                    <div style="background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.2);border-left:5px solid #4fd1c5;border-radius:10px;padding:14px;margin:16px 0;text-align:center;">
                        <div style="font-size:18px;font-weight:800;color:#4fd1c5;">Posting to: TERM ${currentTerm}</div>
                        <div style="font-size:12px;color:#8b949e;margin-top:4px;">This quiz belongs to the current active term.</div>
                    </div>

                    <!-- Layout Mode -->
                    <label class="teacher-modal-label" style="margin-bottom:10px;">Quiz Layout Mode</label>
                    <div style="display:flex;gap:12px;margin-bottom:8px;">
                        <label style="flex:1;cursor:pointer;">
                            <input type="radio" name="layout_mode" value="single_page" checked
                                style="display:none;" onchange="toggleCqMultiPage(this)">
                            <div class="cq-mode-card" id="cqModeSingle"
                                style="background:#1a1919;border:2px solid #4fd1c5;border-radius:10px;padding:14px;text-align:center;transition:all 0.3s;">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none" style="margin-bottom:4px;">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <div style="font-weight:700;color:#e2e8f0;font-size:13px;">Single Page</div>
                            </div>
                        </label>
                        <label style="flex:1;cursor:pointer;">
                            <input type="radio" name="layout_mode" value="multi_page"
                                style="display:none;" onchange="toggleCqMultiPage(this)">
                            <div class="cq-mode-card" id="cqModeMulti"
                                style="background:#1a1919;border:2px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px;text-align:center;transition:all 0.3s;">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#8b949e" stroke-width="2" fill="none" style="margin-bottom:4px;">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                                <div style="font-weight:700;color:#8b949e;font-size:13px;">Multi-Page</div>
                            </div>
                        </label>
                    </div>

                    <div id="cqMultiPageOptions" style="display:none;background:rgba(79,209,197,0.04);border:1px dashed rgba(79,209,197,0.3);border-radius:10px;padding:14px;margin-bottom:16px;">
                        <div style="font-size:12px;font-weight:800;color:#4fd1c5;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Multi-Page Security</div>
                        <label style="display:flex;align-items:flex-start;gap:10px;color:#c9d1d9;font-size:13px;margin-bottom:10px;cursor:pointer;">
                            <input type="checkbox" name="shuffle_questions" value="1"
                                style="width:16px;height:16px;accent-color:#4fd1c5;margin-top:2px;flex-shrink:0;">
                            <span><strong>Shuffle Questions</strong> — every learner gets questions in a different order.</span>
                        </label>
                        <label style="display:flex;align-items:flex-start;gap:10px;color:#c9d1d9;font-size:13px;cursor:pointer;">
                            <input type="checkbox" name="is_linear" value="1"
                                style="width:16px;height:16px;accent-color:#4fd1c5;margin-top:2px;flex-shrink:0;">
                            <span><strong>Linear Progression</strong> — learners cannot go back to previous questions.</span>
                        </label>
                    </div>

                    <!-- Questions -->
                    <label class="teacher-modal-label" style="margin-top:8px;">Questions *</label>
                    <div id="cqQuestionsContainer"></div>
                    <button type="button" onclick="addCqQuestion()"
                        style="width:100%;margin-top:8px;margin-bottom:16px;background:rgba(79,209,197,0.08);
                               border:1px dashed rgba(79,209,197,0.4);color:#4fd1c5;border-radius:8px;
                               padding:10px;cursor:pointer;font-size:13px;font-weight:700;">
                        + Add Question
                    </button>

                    <div id="cqError" style="color:#ff5555;font-size:14px;margin-top:8px;display:none;"></div>

                    <div style="display:flex;gap:12px;margin-top:16px;margin-bottom:32px;">
                        <button type="button" onclick="fetchTeacherQuizzes()"
                            class="teacher-modal-cancel" style="flex:1;padding:13px;">
                            Cancel
                        </button>
                        <button type="submit" class="teacher-modal-submit"
                            id="cqSubmitBtn" style="flex:2;padding:13px;font-size:14px;">
                            Create Quiz
                        </button>
                    </div>

                </form>
            </div>`;

        // Init class picker
        window.renderClassPicker('quizClassPicker', classes, function() {});

        // Add first question
        window.cqQuestionIndex = 0;
        addCqQuestion();

        // Handle submit
        const form = document.getElementById('createQuizForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv  = document.getElementById('cqError');
            const submitBtn = document.getElementById('cqSubmitBtn');
            errorDiv.style.display = 'none';

            submitBtn.disabled    = true;
            submitBtn.textContent = 'Creating...';
            if (loader) loader.style.display = 'flex';

            const fd = new FormData(form);
            const classId = window.getClassPickerValue('quizClassPicker');
            if (!classId) {
                errorDiv.textContent = 'Please select a class.';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Quiz';
                if (loader) loader.style.display = 'none';
                return;
            }
            fd.set('class_id', classId);
            try {
                const res  = await fetch('../../../create_quiz.php', {
                    method: 'POST',
                    body: fd
                });
                const data = await res.json();

                if (data.success) {
                    window.teacherQuizzesCache = null;
                    fetchTeacherQuizzes();
                } else {
                    errorDiv.textContent = data.error || 'Failed to create quiz.';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Something went wrong. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Create Quiz';
                if (loader) loader.style.display = 'none';
            }
        });

    } catch (e) {
        console.error(e);
        target.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading create quiz form.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};


// ─────────────────────────────────────────────
// CREATE QUIZ HELPERS
// ─────────────────────────────────────────────
let cqQuestionIndex = 0;

window.addCqQuestion = function() {
    const container = document.getElementById('cqQuestionsContainer');
    if (!container) return;

    const i   = cqQuestionIndex;
    const div = document.createElement('div');
    div.id    = `cq-question-${i}`;
    div.style.cssText = 'background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:14px;';

    div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-size:15px;font-weight:800;color:#4fd1c5;">Question ${i + 1}</span>
            <div style="display:flex;align-items:center;gap:10px;">
                <span id="cq-pts-display-${i}" style="font-size:13px;color:#4fd1c5;font-weight:700;">1 pt</span>
                ${i > 0 ? `<button type="button" onclick="removeCqQuestion(${i})"
                    style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">
                    Remove
                </button>` : ''}
            </div>
        </div>

        <label class="teacher-modal-label">Question Text *</label>
        <input type="text" name="question[]" class="teacher-modal-input" 
            placeholder="Enter your question..." required>

        <label class="teacher-modal-label" style="margin-top:12px;">Optional Image</label>
        <input type="file" name="question_images[]" accept="image/*"
            style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:8px 12px;box-sizing:border-box;font-size:13px;">

        <label class="teacher-modal-label" style="margin-top:12px;">Answer Choices *</label>
        <input type="text" name="choices[${i}][]" class="teacher-modal-input" 
            placeholder="Choice 1" required style="margin-bottom:8px;">
        <input type="text" name="choices[${i}][]" class="teacher-modal-input" 
            placeholder="Choice 2" required style="margin-bottom:8px;">
        <input type="text" name="choices[${i}][]" class="teacher-modal-input" 
            placeholder="Choice 3" style="margin-bottom:8px;">
        <input type="text" name="choices[${i}][]" class="teacher-modal-input" 
            placeholder="Choice 4" style="margin-bottom:8px;">

        <label class="teacher-modal-label" style="margin-top:4px;">Correct Answer</label>
        <select name="correct_choice[]" class="teacher-modal-input">
            <option value="0">Choice 1</option>
            <option value="1">Choice 2</option>
            <option value="2">Choice 3</option>
            <option value="3">Choice 4</option>
        </select>

        <label class="teacher-modal-label" style="margin-top:12px;">Points</label>
        <input type="number" name="points[]" min="1" value="1" 
            class="teacher-modal-input" style="max-width:100px;"
            oninput="document.getElementById('cq-pts-display-${i}').textContent = (this.value || 1) + ' pt' + (this.value > 1 ? 's' : '')">`;

    container.appendChild(div);
    cqQuestionIndex++;
};

window.removeCqQuestion = function(i) {
    const el = document.getElementById(`cq-question-${i}`);
    if (el) el.remove();
};

window.toggleCqWeight = function() {
    const cb        = document.getElementById('cqSummative');
    const container = document.getElementById('cqWeightContainer');
    if (container) container.style.display = cb.checked ? 'block' : 'none';
};

window.toggleCqMultiPage = function(radio) {
    const multiOptions = document.getElementById('cqMultiPageOptions');
    const singleCard   = document.getElementById('cqModeSingle');
    const multiCard    = document.getElementById('cqModeMulti');

    if (radio.value === 'multi_page') {
        if (multiOptions) multiOptions.style.display = 'block';
        if (singleCard) {
            singleCard.style.borderColor = 'rgba(255,255,255,0.1)';
            singleCard.querySelector('svg').style.stroke = '#8b949e';
            singleCard.querySelector('div').style.color  = '#8b949e';
        }
        if (multiCard) {
            multiCard.style.borderColor = '#4fd1c5';
            multiCard.querySelector('svg').style.stroke = '#4fd1c5';
            multiCard.querySelector('div').style.color  = '#e2e8f0';
        }
    } else {
        if (multiOptions) multiOptions.style.display = 'none';
        if (singleCard) {
            singleCard.style.borderColor = '#4fd1c5';
            singleCard.querySelector('svg').style.stroke = '#4fd1c5';
            singleCard.querySelector('div').style.color  = '#e2e8f0';
        }
        if (multiCard) {
            multiCard.style.borderColor = 'rgba(255,255,255,0.1)';
            multiCard.querySelector('svg').style.stroke = '#8b949e';
            multiCard.querySelector('div').style.color  = '#8b949e';
        }
    }
};

// ─────────────────────────────────────────────
// INTEGRITY MODAL
// ─────────────────────────────────────────────
let activeIntegrityQuizId = null;

window.openIntegrityModal = function(quizId, quizTitle) {
    activeIntegrityQuizId = quizId;

    document.getElementById('integrityModalTitle').textContent = `Integrity: ${quizTitle}`;
    document.getElementById('integrityWarning').style.display  = 'block';
    document.getElementById('integrityResults').style.display  = 'none';
    document.getElementById('integrityFooter').style.display   = 'none';
    document.getElementById('integrityModal').style.display    = 'flex';
};

window.closeIntegrityModal = function() {
    document.getElementById('integrityModal').style.display = 'none';
};

window.decodeIntegrity = async function() {
    const resultsDiv = document.getElementById('integrityResults');
    const warning    = document.getElementById('integrityWarning');
    const footer     = document.getElementById('integrityFooter');

    resultsDiv.innerHTML = `
        <div style="text-align:center;padding:40px 0;">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                style="animation:spin 1s linear infinite;margin-bottom:15px;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p style="color:#cbd5e0;letter-spacing:1px;font-size:13px;">SCANNING BEHAVIORAL PATTERNS...</p>
        </div>`;

    warning.style.display  = 'none';
    resultsDiv.style.display = 'block';

    try {
        const res  = await fetch(`api/teacher/fetch_integrity_report.php?quiz_id=${activeIntegrityQuizId}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = `
                <div style="text-align:center;padding:30px;background:rgba(79,209,197,0.05);border-radius:12px;border:1px dashed #4fd1c5;">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="#4fd1c5" stroke-width="2" fill="none" style="margin-bottom:10px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p style="color:#cbd5e0;margin:0;">No irregularities found for this quiz.</p>
                </div>`;
        } else {
            let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <span style="color:#8b949e;font-size:13px;">${data.length} learner${data.length !== 1 ? 's' : ''} flagged</span>
                    <span style="background:rgba(79,209,197,0.2);color:#4fd1c5;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;border:1px solid #4fd1c5;">AI ACTIVE</span>
                </div>`;

            html += `<div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">`;

            data.forEach((row, i) => {
                const isLast = i === data.length - 1;
                html += `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;${isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,0.06);'}">
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#f85149;flex-shrink:0;"></div>
            <span style="color:#e2e8f0;font-size:14px;">${row.name}</span>
        </div>
        <span style="color:#f85149;font-size:12px;font-weight:700;letter-spacing:0.3px;">Q ${row.problem_questions}</span>
    </div>`;
            });

            html += `</div>`;

            resultsDiv.innerHTML = html;
        }

        footer.style.display = 'flex';
    } catch (e) {
        resultsDiv.innerHTML = `
            <p style="color:#f85149;text-align:center;padding:20px;">
                AI Engine failed to retrieve data.
            </p>`;
        footer.style.display = 'flex';
    }
};