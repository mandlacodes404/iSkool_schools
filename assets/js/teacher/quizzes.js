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
function formatPts(value) {
    const num = Number(value || 0);
    return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}
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

    const panel = document.getElementById('qz-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Loading...')
        : null;
    if (!hideInitialLoader && loader) loader.style.display = 'flex';

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
            termData.classes.forEach((cls, clsIdx) => {
                const classGroupId = `qz-class-group-${termData.term}-${clsIdx}`;
                let itemsHtml = '';
                cls.quizzes.forEach(quiz => {
                    const statusColor = quiz.status === 'Open' ? '#f28c38'
                        : quiz.status === 'Scheduled' ? '#1e90ff' : '#6b7280';
                    itemsHtml += `
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
                                <div class="qz-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                                <div class="qz-sidebar-item-meta">${escapeHtml(quiz.duration)} min</div>
                            </div>
                            <span class="qz-sidebar-status-dot" style="background:${statusColor};"></span>
                        </div>`;
                });
                sidebarHtml += window.buildCollapsibleClassGroup(
                    classGroupId,
                    'qz-sidebar-class-label',
                    escapeHtml(cls.class_name),
                    itemsHtml
                );
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
                min-height: 500px;
            }

            /* Left sidebar */
            .qz-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
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
            /* Extra vertical breathing room for the toggle row specifically */
            .qz-sidebar-class-label.tchr-sidebar-class-label--toggle {
                padding-top: 8px;
                padding-bottom: 6px;
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
            .qz-action-card.edit { border-color: rgba(79,209,197,0.2); }
            .qz-action-card.edit:hover { border-color: #4fd1c5; background: rgba(79,209,197,0.08); color: #4fd1c5; }
            .qz-action-card.delete { border-color: rgba(248,81,73,0.2); }
            .qz-action-card.delete:hover { border-color: #f85149; background: rgba(248,81,73,0.08); color: #f85149; }
            .qz-action-card-icon { flex-shrink: 0; }
            .qz-action-card-text { display: flex; flex-direction: column; gap: 2px; }
            .qz-action-card-sub  { font-size: 11px; font-weight: 400; color: #555e6a; }
            .teacher-quiz-action-btn.edit { background: rgba(79,209,197,0.1); color: #4fd1c5; border-color: rgba(79,209,197,0.25); }
            .teacher-quiz-action-btn.delete { background: rgba(248,81,73,0.1); color: #f85149; border-color: rgba(248,81,73,0.25); }
            @media (max-width: 899px) {
                .qz-desktop-only-btn { display: none !important; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="qz-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="qz-sidebar tchr-flat-sidebar">
                <div class="qz-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Quizzes</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openCreateQuiz()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="qz-sidebar-scroll">${sidebarHtml}</div>
            </div>

            <!-- Right Main Panel -->
            <div class="qz-main-panel tchr-flat-panel" id="qz-main-panel">
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
                        <div class="teacher-resource-class-label">${escapeHtml(cls.class_name)}</div>`;

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
                                    <div class="teacher-resource-name">${escapeHtml(quiz.title)}</div>
                                    <div class="teacher-resource-meta">
                                        ${escapeHtml(quiz.duration)} min &middot; ${escapeHtml(quiz.start_time)}
                                    </div>
                                </div>
                                <span class="teacher-quiz-status-badge" 
                                    style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;">
                                    ${escapeHtml(quiz.status)}
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
                                        data-quiz-id="${quiz.id}" data-quiz-status="${escapeHtml(quiz.status)}"
                                        onclick="toggleQuizStatusFromElement(this)">
                                        ${quiz.status === 'Closed' ? 'Reopen Quiz' : 'Close Quiz'}
                                    </button>
                                    <button class="teacher-quiz-action-btn results qz-desktop-only-btn"
                                        data-quiz-id="${quiz.id}" data-quiz-title="${escapeHtml(quiz.title)}"
                                        onclick="openQuizResultsFromElement(this)">
                                        View Results
                                    </button>
                                    <button class="teacher-quiz-action-btn edit qz-desktop-only-btn"
                                        data-action="edit-quiz"
                                        data-quiz-id="${quiz.id}">
                                        Edit Quiz
                                    </button>
                                    <button class="teacher-quiz-action-btn delete"
                                        data-action="delete-quiz"
                                        data-quiz-id="${quiz.id}" data-quiz-title="${escapeHtml(quiz.title)}">
                                        Delete Quiz
                                    </button>
                                    <button class="teacher-quiz-action-btn integrity"
                                        data-quiz-id="${quiz.id}" data-quiz-title="${escapeHtml(quiz.title)}"
                                        onclick="openIntegrityModalFromElement(this)">
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
        </div>
        <div id="deleteQuizModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:420px;">
                <div class="teacher-modal-header">
                    <span>Delete Quiz</span>
                    <button data-action="close-delete-quiz" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p style="color:#cbd5e0;line-height:1.6;margin-top:0;">
                        Delete <strong id="deleteQuizTitle" style="color:#e2e8f0;"></strong>?
                    </p>
                    <p style="color:#f85149;font-size:13px;margin-bottom:0;">This action cannot be undone.</p>
                    <div id="deleteQuizError" style="color:#ff5555;font-size:14px;margin-top:12px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button data-action="close-delete-quiz" class="teacher-modal-cancel">Cancel</button>
                    <button data-action="confirm-delete-quiz" class="teacher-modal-submit"
                        style="background:#f85149;color:#fff;">Delete Quiz</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
}

// Note: class-group collapsing is handled by the shared
// window.toggleSidebarClassGroup (see dashboard.js)

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
                    <div class="qz-panel-quiz-title" id="qz-panel-title-${quizId}">${escapeHtml(quiz.title)}</div>
                    <div class="qz-panel-quiz-meta">
                        <span>${escapeHtml(quiz.class_name)}</span>
                        <span>&bull;</span>
                        <span>${escapeHtml(quiz.duration)} min</span>
                        <span>&bull;</span>
                        <span>${escapeHtml(quiz.start_time)}</span>
                        <span class="qz-panel-status-badge" id="qz-panel-status-badge-${quizId}"
                            style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;">
                            ${escapeHtml(quiz.status)}
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
                    data-quiz-id="${quizId}" data-quiz-status="${escapeHtml(quiz.status)}"
                    onclick="toggleQuizStatusFromElement(this)">
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
                    data-quiz-id="${quizId}" data-quiz-title="${escapeHtml(quiz.title)}"
                    onclick="openQuizResultsFromElement(this)">
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

                <button class="qz-action-card edit"
                    data-action="edit-quiz"
                    data-quiz-id="${quizId}">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>Edit Quiz</span>
                        <span class="qz-action-card-sub">Update content</span>
                    </div>
                </button>

                <button class="qz-action-card delete"
                    data-action="delete-quiz"
                    data-quiz-id="${quizId}" data-quiz-title="${escapeHtml(quiz.title)}">
                    <div class="qz-action-card-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14H6L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                        </svg>
                    </div>
                    <div class="qz-action-card-text">
                        <span>Delete Quiz</span>
                        <span class="qz-action-card-sub">Remove draft quiz</span>
                    </div>
                </button>

                <button class="qz-action-card integrity"
                    data-quiz-id="${quizId}" data-quiz-title="${escapeHtml(quiz.title)}"
                    onclick="openIntegrityModalFromElement(this)">
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
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
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
window.toggleQuizStatusFromElement = function(el) {
    toggleQuizStatus(parseInt(el.dataset.quizId, 10), el.dataset.quizStatus || '');
};

window.toggleQuizStatus = async function(quizId, currentStatus) {
    const newStatus = currentStatus === 'Closed' ? 'Open' : 'Closed';
    const loader    = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/toggle_quiz_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ quiz_id: quizId, status: newStatus })
        });
        const data = await res.json();

        if (data.success) {
            const updatedStatus = data.newStatus || data.data?.newStatus || newStatus;
            const statusColor = updatedStatus === 'Open'
                ? '#f28c38' : updatedStatus === 'Scheduled'
                ? '#1e90ff' : '#6b7280';

            const badge = document.querySelector(
                `.teacher-quiz-card[data-quiz-id="${quizId}"] .teacher-quiz-status-badge`
            );
            const panelBadge = document.getElementById(`qz-panel-status-badge-${quizId}`);
            const btn = document.getElementById(`status-btn-${quizId}`);

            if (badge) {
                badge.textContent   = updatedStatus;
                badge.style.color   = statusColor;
                badge.style.background = `${statusColor}20`;
                badge.style.border  = `1px solid ${statusColor}50`;
            }
            if (panelBadge) {
                panelBadge.textContent = updatedStatus;
                panelBadge.style.color = statusColor;
                panelBadge.style.background = `${statusColor}20`;
                panelBadge.style.border = `1px solid ${statusColor}50`;
            }
            if (btn) {
                const newBtnText = updatedStatus === 'Closed' ? 'Reopen Quiz' : 'Close Quiz';
                const newBtnClass = updatedStatus === 'Closed' ? 'reopen' : 'close';
                // Handle both desktop card and mobile button
                if (btn.classList.contains('qz-action-card')) {
                    const span = btn.querySelector('.qz-action-card-text span:first-child');
                    if (span) span.textContent = newBtnText;
                    btn.className = `qz-action-card ${newBtnClass}`;
                } else {
                    btn.textContent = newBtnText;
                    btn.className   = `teacher-quiz-action-btn ${newBtnClass}`;
                }
                btn.dataset.quizStatus = updatedStatus;
                btn.onclick = () => toggleQuizStatus(quizId, updatedStatus);
            }
            // Update cached quiz data
            if (window._allQuizzesFlat) {
                const q = window._allQuizzesFlat.find(q => q.id == quizId);
                if (q) q.status = updatedStatus;
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
        const res  = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
            headers: { 'X-CSRF-Token': getCsrfToken() }
        });
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

window.openQuizResultsFromElement = function(el) {
    openQuizResults(parseInt(el.dataset.quizId, 10), el.dataset.quizTitle || '');
};

function renderQuizResults(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // On desktop, render inside the right panel; on mobile render in apiArea
    const panel = document.getElementById('qz-main-panel');
    const target = panel || apiArea;
    const backFn = panel ? `selectDesktopQuiz(${window._activeDesktopQuizId})` : 'fetchTeacherQuizzes()';
    const backLabel = panel ? 'Back to Quiz' : 'Back to Quizzes';
    const marksPublished = data.publish_marks == 1;

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
        <h3 class="teacher-quiz-grades-title">${escapeHtml(data.quiz_title)}</h3>
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
            const score = marksPublished
                ? `${escapeHtml(r.score)} / ${escapeHtml(r.total)}`
                : '***';
            const perc = !marksPublished
                ? '<span style="color:#c9d1d9;font-weight:800;">***</span>'
                : r.percentage !== 'N/A'
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(r.percentage)}">${escapeHtml(r.percentage)}</span>`
                : '<span style="color:#555e6a;">N/A</span>';

            html += `
                <tr>
                    <td>${escapeHtml(r.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>${escapeHtml(r.time_taken)}</td>
                    <td>${escapeHtml(r.submitted_at)}</td>
                    <td>
                        <button class="teacher-edit-marks-btn"
                            onclick="openQuizReview(${r.result_id}, '')">
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
        const payload = await res.json();
        if (payload.status === 'error' || payload.error) throw new Error(payload.message || payload.error);
        const data = payload.data || payload;
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
    const learnerLabel = data.learner_name
        ? `${data.learner_name}'s Answer`
        : 'Learner Answer';

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
            <div class="teacher-review-percentage">${escapeHtml(data.percentage)}%</div>
            <div class="teacher-review-title">${escapeHtml(data.title)}</div>
            <div class="teacher-review-meta">
                Points: <strong>${escapeHtml(data.score)} / ${escapeHtml(data.total)}</strong> &bull;
                Date: ${escapeHtml(data.submitted_at)}
            </div>
        </div>`;

    data.questions.forEach((q, i) => {
        html += `
            <div class="teacher-review-question">
                <div class="teacher-review-q-meta">Question ${i + 1} (${escapeHtml(q.points)} point${q.points != 1 ? 's' : ''})</div>
                <div style="color:#4fd1c5;font-weight:800;font-size:13px;margin-bottom:10px;">
                    ${escapeHtml(formatPts(q.points_earned))} / ${escapeHtml(formatPts(q.points_possible ?? q.points))} pts
                </div>
                <div class="teacher-review-q-text">${escapeHtml(q.text)}</div>`;

        if (q.image) {
            html += `<img src="${escapeHtml(q.image)}" class="teacher-review-q-image" alt="Question image">`;
        }

        if ((q.question_type || 'mcq') === 'fill_in_blank') {
            const fitb = q.fitb || { blanks: [] };
            html += `
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-top:12px;">
                    <div style="color:#8b949e;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Fill in the Blank</div>`;
            (fitb.blanks || []).forEach(blank => {
                const ok = !!blank.is_correct;
                html += `
                    <div style="border:1px solid ${ok ? 'rgba(39,174,96,.35)' : 'rgba(231,76,60,.35)'};background:${ok ? 'rgba(39,174,96,.10)' : 'rgba(231,76,60,.10)'};border-radius:8px;padding:10px 12px;margin-top:8px;">
                        <div style="display:flex;gap:8px;align-items:center;color:#d8dee9;">
                            <span style="color:${ok ? '#27ae60' : '#e74c3c'};font-weight:900;">${ok ? '&#10003;' : '&#10005;'}</span>
                            <strong>Blank ${escapeHtml(blank.blank_index)}:</strong>
                            <span>${escapeHtml(blank.learner_answer || 'No answer submitted.')}</span>
                        </div>
                        <div style="color:#8b949e;font-size:12px;margin-top:5px;">Accepted: ${escapeHtml((blank.accepted_answers || []).join(', '))}</div>
                    </div>`;
            });
            html += `</div></div>`;
            return;
        }

        if ((q.question_type || 'mcq') === 'open_ended') {
            if (q.grade) {
                html += `
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-top:12px;">
                        <div style="color:#8b949e;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Learner Answer</div>
                        <div style="color:#d8dee9;white-space:pre-wrap;line-height:1.55;">${escapeHtml(q.answer_text || 'No answer submitted.')}</div>
                    </div>
                    <div style="background:rgba(63,185,80,0.08);border:1px solid rgba(63,185,80,0.25);border-radius:10px;padding:14px;margin-top:10px;">
                        <div style="color:#7ee787;font-size:13px;font-weight:800;">Awarded: ${escapeHtml(q.grade.score ?? '0')} / ${escapeHtml(q.points)}</div>
                        ${q.grade.feedback ? `<div style="color:#c9d1d9;font-size:13px;margin-top:8px;white-space:pre-wrap;">${escapeHtml(q.grade.feedback)}</div>` : ''}
                    </div>`;
            } else {
                html += `
                    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-top:12px;">
                        <div style="color:#8b949e;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Learner Answer</div>
                        <div style="color:#d8dee9;white-space:pre-wrap;line-height:1.55;">${escapeHtml(q.answer_text || 'No answer submitted.')}</div>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(242,140,56,0.08);border:1px solid rgba(242,140,56,0.3);border-radius:10px;padding:12px;margin-top:10px;">
                        <span style="color:#f5c38b;font-size:13px;font-weight:800;">Not yet graded</span>
                        <button type="button" class="teacher-edit-marks-btn" data-action="go-to-open-ended-grade"
                            data-quiz-id="${escapeHtml(data.quiz_id)}"
                            data-quiz-title="${escapeHtml(data.title)}">
                            Go to Grades to mark this response
                        </button>
                    </div>`;
            }
            html += `</div>`;
            return;
        }

        if ((q.question_type || 'mcq') === 'multiple_answer') {
            const ma = q.multiple_answer || { selected_choice_ids: [] };
            const selectedIds = (ma.selected_choice_ids || []).map(id => String(id));
            const scoringLabel = ma.scoring_mode === 'partial_penalty' ? 'Partial Credit with Penalty' : 'Exact Match';
            const showDeduction = ma.scoring_mode === 'partial_penalty' && Number(ma.points_deducted || 0) > 0 && Number(ma.wrong_selected_count || 0) > 0;
            html += `
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-top:12px;color:#c9d1d9;font-size:13px;">
                    <strong style="color:#4fd1c5;">Multiple Answer</strong> &bull; ${escapeHtml(scoringLabel)}
                    ${showDeduction ? `<div style="margin-top:6px;color:#f5c38b;">${escapeHtml(ma.correct_selected_count || 0)} correct selected (+${escapeHtml(formatPts(ma.points_added))}pts), ${escapeHtml(ma.wrong_selected_count || 0)} wrong selected (-${escapeHtml(formatPts(ma.points_deducted))}pts deducted)</div>` : ''}
                </div>`;
            q.choices.forEach(choice => {
                const isSelected = selectedIds.includes(String(choice.id));
                const isCorrect  = choice.is_correct == 1;
                let cls = '';
                let icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#555e6a" stroke-width="2" fill="none"><rect x="4" y="4" width="16" height="16" rx="3"></rect></svg>`;
                if (isCorrect) {
                    cls = 'correct';
                    icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#27ae60" stroke-width="2" fill="none"><rect x="4" y="4" width="16" height="16" rx="3"></rect><polyline points="8 12 11 15 16 9"></polyline></svg>`;
                } else if (isSelected) {
                    cls = 'incorrect';
                    icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#e74c3c" stroke-width="2" fill="none"><rect x="4" y="4" width="16" height="16" rx="3"></rect><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
                }
                html += `
                    <div class="teacher-review-choice ${cls}">
                        ${icon}
                        <span>${escapeHtml(choice.text)}</span>
                        ${isCorrect ? `<span class="teacher-review-your-answer">Correct</span>` : ''}
                        ${isSelected ? `<span class="teacher-review-your-answer">${escapeHtml(learnerLabel)}</span>` : ''}
                    </div>`;
            });
            html += `</div>`;
            return;
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
                    <span>${escapeHtml(choice.text)}</span>
                    ${isSelected ? `<span class="teacher-review-your-answer">${escapeHtml(learnerLabel)}</span>` : ''}
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
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Loading...')
        : null;

    if (!hideInitialLoader && loader) loader.style.display = 'flex';

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
            <div style="max-width:${isDesktop ? '920px' : '760px'};margin:0 auto;${formPad}padding-top:${isDesktop ? '20px' : '0'};">
                <h2 style="color:#4fd1c5;font-size:${titleSize};margin:${titleMargin};font-weight:800;">Create a New Quiz</h2>
                <style>
                    .cq-section { background:#1a1919; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:18px; margin-bottom:16px; }
                    .cq-section-title { display:flex; align-items:center; gap:10px; color:#e2e8f0; font-size:15px; font-weight:900; margin:0 0 14px; }
                    .cq-step { width:24px; height:24px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; background:rgba(79,209,197,0.13); color:#4fd1c5; border:1px solid rgba(79,209,197,0.28); font-size:12px; font-weight:900; flex-shrink:0; }
                    .cq-section-help { color:#8b949e; font-size:13px; line-height:1.5; margin:-6px 0 14px; }
                    .cq-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; }
                    .cq-preview-card { background:#0d1117; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px; }
                    .cq-preview-label { color:#8b949e; font-size:11px; font-weight:900; letter-spacing:.8px; text-transform:uppercase; margin-bottom:10px; }
                    .cq-learner-card { background:#161b22; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:18px; margin-bottom:12px; }
                    .cq-learner-meta { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:12px; color:#94a3b8; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.7px; }
                    .cq-learner-question { color:#e2e8f0; font-size:15px; font-weight:800; line-height:1.55; margin-bottom:14px; }
                    .cq-learner-choice { display:flex; align-items:center; gap:12px; color:#e2e8f0; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:11px 13px; margin-top:8px; font-size:13px; font-weight:700; }
                    .cq-learner-radio { width:18px; height:18px; border:2px solid rgba(255,255,255,0.22); border-radius:50%; flex-shrink:0; }
                    .cq-learner-checkbox { border-radius:5px; }
                    .cq-preview-textarea { width:100%; min-height:110px; resize:vertical; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#8b949e; padding:12px; font-family:inherit; line-height:1.5; }
                    .cq-full-preview { max-height:560px; overflow:auto; padding-right:4px; }
                    @media (max-width: 760px) { .cq-grid { grid-template-columns:1fr; } .cq-section { padding:15px; } }
                </style>

                <form id="createQuizForm" enctype="multipart/form-data">

                    <div class="cq-section">
                        <div class="cq-section-title"><span class="cq-step">1</span>Quiz Basics</div>
                        <div class="cq-section-help">Start with the information learners and teachers need to recognise the quiz.</div>

                    <label class="teacher-modal-label">Quiz Title *</label>
                    <input type="text" name="quiz_title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 3: Fractions Quiz" required>

                    <label class="teacher-modal-label">Class *</label>
                    <div id="quizClassPicker"></div>

                    <div class="cq-grid">
                        <div>
                            <label class="teacher-modal-label">Time Limit *</label>
                            <input type="number" name="duration" class="teacher-modal-input"
                                min="1" max="180" placeholder="e.g. 45" required>
                            <div style="font-size:12px;color:#8b949e;margin-top:5px;">How long learners have after they press Start.</div>
                        </div>
                        <div>
                            <label class="teacher-modal-label">Attempts Allowed</label>
                            <input type="number" name="attempt_limit" class="teacher-modal-input"
                                min="1" max="10" value="1">
                            <div style="font-size:12px;color:#8b949e;margin-top:5px;">Use 1 for a normal test. Increase only when learners may retry.</div>
                        </div>
                    </div>
                    </div>

                    <div class="cq-section">
                        <div class="cq-section-title"><span class="cq-step">2</span>When Learners Can Access It</div>
                        <div class="cq-section-help">Most teachers should leave this as Scheduled, then choose the date and time.</div>

                    <!-- FIX 8: Start time with default + helper text -->
                    <div id="cqStartTimeWrapper">
                        <label class="teacher-modal-label">Start Date and Time *</label>
                        <input type="datetime-local" name="start_time" id="cqStartTime" class="teacher-modal-input" required>
                        <span id="cqStartTimeHelper" style="display:block;margin-top:5px;font-size:12px;color:#8b949e;">You can change this — learners won't see the quiz until this time.</span>
                        <span id="cqStartTimeIgnored" style="display:none;margin-top:5px;font-size:12px;color:#8b949e;font-style:italic;"><i class="fas fa-info-circle"></i> Start time is ignored when quiz is set to Open.</span>
                    </div>

                    <!-- FIX 4: Status with clearer label + conditional start time -->
                    <label class="teacher-modal-label">Availability</label>
                    <select name="status" id="cqStatus" class="teacher-modal-input" onchange="handleCqStatusChange(this.value)">
                        <option value="Scheduled">Scheduled - opens at the start time</option>
                        <option value="Open">Open now - learners can start immediately</option>
                        <option value="Closed">Closed - hidden from learners for now</option>
                    </select>

                    </div>

                    <div class="cq-section">
                        <div class="cq-section-title"><span class="cq-step">3</span>Marks, Term and Notifications</div>
                        <div class="cq-section-help">Choose how marks are released, whether this quiz affects term marks, and whether to send email.</div>

                    <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px;">
                        <div id="cqPublishMarksWrap">
                            <label id="cqPublishMarksLabel" style="display:flex;align-items:center;gap:10px;color:#c9d1d9;font-size:14px;cursor:pointer;">
                                <input type="checkbox" name="publish_marks" value="1"
                                    style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;">
                                Show learners their marks immediately after they submit
                            </label>
                            <div id="cqPublishMarksOpenMessage" style="display:none;background:rgba(242,140,56,0.08);border:1px solid rgba(242,140,56,0.28);border-radius:10px;color:#f5c38b;font-size:13px;line-height:1.5;padding:12px;">
                                Marks cannot be auto-released when the quiz contains open-ended questions. You must grade all responses manually before releasing marks.
                            </div>
                        </div>

                        <label style="display:flex;align-items:center;gap:10px;color:#c9d1d9;font-size:14px;cursor:pointer;">
                            <input type="checkbox" name="is_summative" value="1" id="cqSummative"
                                style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;"
                                onchange="toggleCqWeight()">
                            This counts toward the official term mark
                        </label>

                        <div id="cqWeightContainer" style="display:none;margin-left:28px;">
                            <label class="teacher-modal-label">Weight % of term mark</label>
                            <input type="number" name="weight_percent" id="cqWeight"
                                class="teacher-modal-input" min="0" max="100" step="0.1"
                                placeholder="e.g. 30" style="max-width:150px;">
                        </div>

                        <!-- FIX 7: Shortened force email label + helper -->
                        <div style="background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.15);border-radius:10px;padding:12px;">
                            <label style="display:flex;align-items:center;gap:10px;color:#4fd1c5;font-size:14px;font-weight:600;cursor:pointer;margin:0;">
                                <input type="checkbox" name="force_email" value="1"
                                    style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;flex-shrink:0;">
                                Also send email notifications
                            </label>
                            <p style="margin:6px 0 0 28px;font-size:12px;color:#8b949e;line-height:1.5;">Push notifications are sent automatically. Email is optional.</p>
                        </div>
                    </div>
                    </div>

                    <div class="cq-section">
                        <div class="cq-section-title"><span class="cq-step">4</span>Learner Experience</div>
                        <div class="cq-section-help">Single Page is easiest for normal class quizzes. Multi-Page is better for controlled tests.</div>

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
                    </div>

                    <div class="cq-section">
                        <div class="cq-section-title"><span class="cq-step">5</span>Questions and Learner Preview</div>
                        <div class="cq-section-help">Add each question, then check the preview to see what learners will see before you create the quiz.</div>

                    <!-- FIX 3: Live summary bar -->
                    <div id="cqSummaryBar" style="display:flex;align-items:center;justify-content:center;gap:16px;background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 16px;margin:16px 0 8px;font-size:13px;font-weight:700;color:#4fd1c5;">
                        <span><i class="fas fa-list-ol" style="margin-right:5px;"></i><span id="cqSummaryQCount">0</span> question<span id="cqSummaryQPlural">s</span></span>
                        <span style="color:rgba(255,255,255,0.15);font-size:18px;font-weight:300;">|</span>
                        <span><i class="fas fa-star" style="margin-right:5px;"></i><span id="cqSummaryMarks">0</span> mark<span id="cqSummaryMPlural">s</span> total</span>
                    </div>

                    <!-- Questions -->
                    <label class="teacher-modal-label" style="margin-top:8px;">Questions *</label>
                    <div id="cqOpenEndedBanner" style="display:none;background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.25);border-radius:10px;color:#b7f5ef;font-size:13px;line-height:1.5;padding:12px;margin:0 0 12px;">
                        This quiz contains open-ended questions. After all learners submit, you will need to manually grade their responses before you can release marks.
                    </div>
                    <div id="cqQuestionsContainer"></div>
                    <button type="button" onclick="addCqQuestion()"
                        style="width:100%;margin-top:8px;margin-bottom:16px;background:rgba(79,209,197,0.08);
                               border:1px dashed rgba(79,209,197,0.4);color:#4fd1c5;border-radius:8px;
                               padding:10px;cursor:pointer;font-size:13px;font-weight:700;">
                        + Add Question
                    </button>

                    <div class="cq-preview-card">
                        <div class="cq-preview-label" onclick="toggleCqFullPreview()"
                            style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:0;">
                            <span>Full Learner Preview</span>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                class="cq-full-preview-chevron" id="cqFullPreviewChevron"
                                style="transform:rotate(90deg);transition:transform .2s;flex-shrink:0;">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <div id="cqFullPreviewWrap" style="margin-top:10px;">
                            <div id="cqFullPreview" class="cq-full-preview"></div>
                        </div>
                    </div>
                    </div>

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
        cqQuestionIndex = 0;
        window.cqQuestionIndex = 0;
        addCqQuestion();

        // FIX 8: Set start time default to now + 1 hour rounded to nearest 15 min
        // Must run immediately after innerHTML is set — DOMContentLoaded has already fired
        (function() {
            const cqStartTimeEl = document.getElementById('cqStartTime');
            if (!cqStartTimeEl) return;
            const now = new Date();
            now.setHours(now.getHours() + 1);
            const roundedMins = Math.round(now.getMinutes() / 15) * 15;
            now.setMinutes(roundedMins === 60 ? 0 : roundedMins);
            if (roundedMins === 60) now.setHours(now.getHours() + 1);
            now.setSeconds(0);
            const pad = n => String(n).padStart(2, '0');
            cqStartTimeEl.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        })();

        // FIX 4: Init status handler on load
        handleCqStatusChange(document.getElementById('cqStatus')?.value || 'Scheduled');

        // FIX 3: Init summary bar
        updateCqSummaryBar();
        updateCqPreview();

        // Handle submit
        const form = document.getElementById('createQuizForm');
        form.addEventListener('input', function() {
            updateCqSummaryBar();
            updateCqPreview();
        });
        form.addEventListener('change', function() {
            updateCqSummaryBar();
            updateCqPreview();
        });
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv  = document.getElementById('cqError');
            const submitBtn = document.getElementById('cqSubmitBtn');
            errorDiv.style.display = 'none';

            const fd = new FormData(form);
            const classId = window.getClassPickerValue('quizClassPicker');
            if (!classId) {
                errorDiv.textContent = 'Please select a class.';
                errorDiv.style.display = 'block';
                return;
            }

            // FIX 9: Client-side pre-submit validation
            if (!cqValidateBeforeSubmit()) return;

            if (hasOpenEndedQuestions(form)) {
                fd.delete('publish_marks');
            }
            fd.set('class_id', classId);
            submitBtn.disabled    = true;
            submitBtn.textContent = 'Creating...';
            const hideSubmitLoader = window.showTeacherScopedLoader
                ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Creating...')
                : null;
            if (!hideSubmitLoader && loader) loader.style.display = 'flex';
            try {
                const res  = await fetch('create_quiz.php', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': getCsrfToken() },
                    body: fd
                });
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    console.error('Create quiz returned non-JSON response:', text);
                    throw new Error('Invalid server response');
                }

                if (data.success) {
                    window.teacherQuizzesCache = null;
                    fetchTeacherQuizzes();
                } else {
                    errorDiv.textContent = data.message || data.error || 'Failed to create quiz.';
                    errorDiv.style.display = 'block';
                    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } catch (err) {
                errorDiv.textContent = 'Something went wrong. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Create Quiz';
                if (hideSubmitLoader) hideSubmitLoader();
                else if (loader) loader.style.display = 'none';
            }
        });

    } catch (e) {
        console.error(e);
        target.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading create quiz form.
            </p>`;
    } finally {
        if (hideInitialLoader) hideInitialLoader();
        else if (loader) loader.style.display = 'none';
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
    div.style.cssText = 'background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:14px;transition:border-color 0.2s;';

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

        <label class="teacher-modal-label">Question Type</label>
        <select name="question_type[]" class="teacher-modal-input cq-qtype-select" data-action="change-question-type" style="max-width:260px;">
            <option value="mcq" selected>Multiple Choice - one correct answer</option>
            <option value="multiple_answer">Multiple Answer - more than one correct answer</option>
            <option value="open_ended">Open Ended - teacher marks the response</option>
            <option value="fill_in_blank">Fill in the Blank - learners type missing words</option>
        </select>
        <div class="cq-qtype-helper cq-mcq-helper" style="margin-top:6px;padding:8px 12px;background:rgba(79,209,197,0.07);border-left:3px solid #4fd1c5;border-radius:0 6px 6px 0;font-size:12px;color:#a0aec0;line-height:1.5;">Best for quick checks: learners choose one correct answer from the options you provide.</div>
        <div class="cq-qtype-helper cq-ma-helper" style="display:none;margin-top:6px;padding:8px 12px;background:rgba(79,209,197,0.07);border-left:3px solid #4fd1c5;border-radius:0 6px 6px 0;font-size:12px;color:#a0aec0;line-height:1.5;">Use this when two or more options are correct.</div>
        <div class="cq-qtype-helper cq-oe-helper" style="display:none;margin-top:6px;padding:8px 12px;background:rgba(79,209,197,0.07);border-left:3px solid #4fd1c5;border-radius:0 6px 6px 0;font-size:12px;color:#a0aec0;line-height:1.5;">Use this for explanations, paragraphs, calculations, or evidence-based answers. You will mark it manually.</div>
        <div class="cq-qtype-helper cq-fitb-helper" style="display:none;margin-top:6px;padding:8px 12px;background:rgba(79,209,197,0.07);border-left:3px solid #4fd1c5;border-radius:0 6px 6px 0;font-size:12px;color:#a0aec0;line-height:1.5;">Use <code style="background:rgba(79,209,197,0.15);color:#4fd1c5;padding:1px 4px;border-radius:3px;font-family:monospace;">{blank}</code> where the learner should type an answer.</div>

        <label class="teacher-modal-label" style="margin-top:12px;">Question Text *</label>

        <!-- FIX 2: FITB callout shown when fill_in_blank selected -->
        <div class="cq-fitb-callout" style="display:none;background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.35);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;color:#a0aec0;line-height:1.6;">
            <strong style="color:#4fd1c5;"><i class="fas fa-lightbulb"></i> Fill in the Blank instructions</strong><br>
            Type your question and use <code style="background:rgba(79,209,197,0.15);color:#4fd1c5;padding:1px 5px;border-radius:4px;font-family:monospace;">{blank}</code> where you want a gap.<br>
            <em>Example: The capital of France is {blank}.</em><br>
            <button type="button" onclick="cqInsertBlankTag(this)" style="margin-top:6px;background:rgba(79,209,197,0.15);color:#4fd1c5;border:1px solid rgba(79,209,197,0.4);border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;">+ Insert {blank} at cursor</button>
        </div>

        <input type="text" name="question[]" class="teacher-modal-input cq-question-text"
            placeholder="Enter your question..." required>

        <!-- FIX 2: Live blank counter -->
        <div class="cq-blank-counter" style="display:none;margin-top:5px;font-size:12px;color:#8b949e;">
            <span class="cq-blank-count" style="color:#4fd1c5;font-weight:700;">0</span> blank<span class="cq-blank-plural">s</span> detected → <span class="cq-blank-count" style="color:#4fd1c5;font-weight:700;">0</span> answer<span class="cq-blank-plural">s</span> required
        </div>

        <label class="teacher-modal-label" style="margin-top:12px;">Optional Image</label>
        <input type="file" name="question_images[]" accept="image/*"
            style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:8px 12px;box-sizing:border-box;font-size:13px;">

        <div class="cq-mcq-fields">
            <label class="teacher-modal-label" style="margin-top:12px;">Answer Choices *</label>
            <input type="text" name="choices[${i}][]" class="teacher-modal-input cq-choice-input"
                placeholder="Choice 1" required style="margin-bottom:8px;">
            <input type="text" name="choices[${i}][]" class="teacher-modal-input cq-choice-input"
                placeholder="Choice 2" required style="margin-bottom:8px;">
            <input type="text" name="choices[${i}][]" class="teacher-modal-input cq-choice-input"
                placeholder="Choice 3" style="margin-bottom:8px;">
            <input type="text" name="choices[${i}][]" class="teacher-modal-input cq-choice-input"
                placeholder="Choice 4" style="margin-bottom:8px;">

            <!-- FIX 6: Correct answer select mirrors typed choice text -->
            <label class="teacher-modal-label" style="margin-top:4px;">Correct Answer</label>
            <select name="correct_choice[${i}]" class="teacher-modal-input cq-correct-select">
                <option value="0">Choice 1</option>
                <option value="1">Choice 2</option>
                <option value="2">Choice 3</option>
                <option value="3">Choice 4</option>
            </select>
            <div class="cq-ma-correct-list" style="display:none;margin-top:8px;">
                ${[0, 1, 2, 3].map(n => `
                    <label style="display:flex;align-items:center;gap:8px;color:#c9d1d9;font-size:13px;margin:6px 0;">
                        <input type="checkbox" name="multiple_answer_correct[${i}][]" value="${n}" style="width:16px;height:16px;accent-color:#4fd1c5;">
                        <span>Choice ${n + 1}</span>
                    </label>
                `).join('')}
            </div>
            <div class="cq-ma-settings" style="display:none;margin-top:12px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;">
                <label class="teacher-modal-label">Scoring Mode</label>
                <select name="ma_scoring_mode[${i}]" class="teacher-modal-input">
                    <option value="exact_match" selected>Exact Match</option>
                    <option value="partial_penalty">Partial Credit with Penalty</option>
                </select>
                <label class="teacher-modal-label" style="margin-top:10px;">Optional: tell learners how many to select</label>
                <input type="number" name="ma_select_exactly[${i}]" min="1" class="teacher-modal-input" placeholder="Optional" style="max-width:150px;">
            </div>
        </div>
        <div class="cq-open-preview" style="display:none;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.14);border-radius:8px;color:#8b949e;font-size:13px;padding:12px;margin-top:12px;">
            Learners will type their answer here.
        </div>
        ${buildFitbBuilderHtml('cq', i, null, false)}

        <label class="teacher-modal-label" style="margin-top:12px;">Points</label>
        <input type="number" name="points[]" min="1" value="1"
            class="teacher-modal-input cq-points-input" style="max-width:100px;"
            oninput="document.getElementById('cq-pts-display-${i}').textContent = (this.value || 1) + ' pt' + (this.value > 1 ? 's' : ''); updateCqSummaryBar(); updateCqPreview();">

        <div class="cq-preview-card" style="margin-top:14px;">
            <div class="cq-preview-label">Learner Preview for this Question</div>
            <div class="cq-question-preview"></div>
        </div>`;

    container.appendChild(div);
    setQuestionTypeFields(div, 'mcq');
    updateOpenEndedBanner();
    cqQuestionIndex++;

    // FIX 1 & 2: Bind question type change for helpers + FITB callout
    const qtypeSelect = div.querySelector('.cq-qtype-select');
    qtypeSelect.addEventListener('change', function() {
        const val = this.value;
        // Toggle type helper texts
        div.querySelector('.cq-mcq-helper').style.display  = val === 'mcq'            ? 'block' : 'none';
        div.querySelector('.cq-ma-helper').style.display   = val === 'multiple_answer' ? 'block' : 'none';
        div.querySelector('.cq-oe-helper').style.display   = val === 'open_ended'     ? 'block' : 'none';
        div.querySelector('.cq-fitb-helper').style.display = val === 'fill_in_blank'  ? 'block' : 'none';
        // FITB callout + blank counter
        div.querySelector('.cq-fitb-callout').style.display  = val === 'fill_in_blank' ? 'block' : 'none';
        div.querySelector('.cq-blank-counter').style.display = val === 'fill_in_blank' ? 'block' : 'none';
        updateOpenEndedBanner();
        updateCqPreview();
    });

    // FIX 2: Bind live blank counter on question text input
    const questionInput = div.querySelector('.cq-question-text');
    questionInput.addEventListener('input', function() {
        const count = (this.value.match(/\{blank\}/gi) || []).length;
        div.querySelectorAll('.cq-blank-count').forEach(el => el.textContent = count);
        div.querySelectorAll('.cq-blank-plural').forEach(el => el.textContent = count === 1 ? '' : 's');
        updateCqPreview();
    });

    // FIX 6: Mirror choice text into correct-answer select
    const choiceInputs = div.querySelectorAll('.cq-choice-input');
    const correctSelect = div.querySelector('.cq-correct-select');
    choiceInputs.forEach((input, idx) => {
        input.addEventListener('input', () => {
            if (correctSelect && correctSelect.options[idx]) {
                correctSelect.options[idx].textContent = input.value.trim() || ('Choice ' + (idx + 1));
            }
            const maLabel = div.querySelectorAll('.cq-ma-correct-list span')[idx];
            if (maLabel) maLabel.textContent = input.value.trim() || ('Choice ' + (idx + 1));
            updateCqPreview();
        });
    });

    // FIX 3: Update summary bar after adding question
    updateCqSummaryBar();
    updateCqPreview();
};

window.removeCqQuestion = function(i) {
    const el = document.getElementById(`cq-question-${i}`);
    if (el) el.remove();
    updateOpenEndedBanner();
    updateCqSummaryBar();
    updateCqPreview();
};

function countFitbMarkers(text) {
    const matches = String(text || '').match(/\{blank\}/gi);
    return matches ? matches.length : 0;
}

function fitbPreviewHtml(text) {
    const parts = String(text || '').split(/(\{blank\})/i);
    let blankIndex = 1;
    return parts.map(part => {
        if (/^\{blank\}$/i.test(part)) {
            return `<input type="text" disabled placeholder="..." style="display:inline-block;width:110px;margin:0 4px;padding:5px 7px;border-radius:6px;border:1px solid rgba(79,209,197,.35);background:rgba(255,255,255,.05);color:#c9d1d9;">`;
        }
        return escapeHtml(part);
    }).join('') || '<span style="color:#8b949e;">Type a sentence using {blank}.</span>';
}

function buildChipInputs(name, values) {
    return (values || []).map(value => `
        <span class="fitb-chip-tag" style="display:inline-flex;align-items:center;gap:6px;background:rgba(79,209,197,.08);border:1px solid rgba(79,209,197,.25);color:#4fd1c5;border-radius:6px;padding:4px 7px;font-size:12px;font-weight:800;">
            ${escapeHtml(value)}
            <button type="button" data-action="remove-fitb-chip" style="background:transparent;border:0;color:#f85149;cursor:pointer;font-weight:900;">x</button>
            <input type="hidden" name="${name}" value="${escapeHtml(value)}">
        </span>`).join('');
}

function buildFitbBuilderHtml(prefix, index, fitb, locked) {
    const subType = fitb?.sub_type || 'free_type';
    const scoringMode = fitb?.scoring_mode || 'partial';
    const distractors = fitb?.distractors || [];
    const lockedAttr = locked ? 'data-locked="1" disabled' : '';
    const blanksJson = escapeHtml(JSON.stringify(fitb?.blanks || []));
    return `
        <div class="fitb-builder" data-prefix="${prefix}" data-locked="${locked ? '1' : '0'}" data-fitb-blanks="${blanksJson}" style="display:none;margin-top:12px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;">
            <div style="color:#b7f5ef;font-size:13px;line-height:1.5;margin-bottom:10px;">
                Type {blank} wherever you want a blank to appear. Example: "The capital of France is {blank}."
            </div>
            <label class="teacher-modal-label">Fill in the Blank Sub-Type</label>
            <select name="fitb_sub_type[${index}]" class="teacher-modal-input fitb-sub-type" ${lockedAttr}>
                <option value="free_type" ${subType === 'free_type' ? 'selected' : ''}>Free Type</option>
                <option value="word_bank" ${subType === 'word_bank' ? 'selected' : ''}>Word Bank</option>
            </select>
            <label class="teacher-modal-label" style="margin-top:10px;">Scoring Mode</label>
            <select name="fitb_scoring_mode[${index}]" class="teacher-modal-input fitb-scoring-mode" ${lockedAttr}>
                <option value="partial" ${scoringMode === 'partial' ? 'selected' : ''}>Partial Credit</option>
                <option value="all_or_nothing" ${scoringMode === 'all_or_nothing' ? 'selected' : ''}>All or Nothing</option>
            </select>
            <div class="fitb-preview" style="margin-top:10px;padding:10px;border:1px dashed rgba(79,209,197,.35);border-radius:8px;color:#e2e8f0;line-height:2;"></div>
            <div class="fitb-blanks" style="margin-top:10px;"></div>
            <div class="fitb-distractors" style="display:${subType === 'word_bank' ? 'block' : 'none'};margin-top:12px;">
                <label class="teacher-modal-label">Distractor Words</label>
                <div style="display:flex;gap:8px;">
                    <input type="text" class="teacher-modal-input fitb-distractor-input" placeholder="Extra word" style="margin:0;" ${lockedAttr}>
                    <button type="button" data-action="add-fitb-distractor" ${lockedAttr} style="background:rgba(79,209,197,.1);border:1px solid rgba(79,209,197,.3);color:#4fd1c5;border-radius:7px;padding:0 12px;cursor:pointer;">Add</button>
                </div>
                <div class="fitb-distractor-chips" style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;">${buildChipInputs(`fitb_distractors[${index}][]`, distractors)}</div>
                <div class="fitb-bank-count" style="font-size:12px;color:#8b949e;margin-top:8px;"></div>
            </div>
        </div>`;
}

function syncFitbBuilder(questionEl) {
    const builder = questionEl ? questionEl.querySelector('.fitb-builder') : null;
    if (!builder) return;
    const index = questionEl.dataset.questionIndex || questionEl.id?.replace(/\D/g, '') || 0;
    const questionInput = questionEl.querySelector('input[name="question[]"]');
    const text = questionInput ? questionInput.value : '';
    const blankCount = countFitbMarkers(text);
    const blanksContainer = builder.querySelector('.fitb-blanks');
    const preview = builder.querySelector('.fitb-preview');
    const stored = JSON.parse(builder.dataset.fitbBlanks || '[]');
    const current = [];
    builder.querySelectorAll('.fitb-blank-row').forEach(row => {
        current.push({
            blank_index: parseInt(row.dataset.blankIndex, 10),
            accepted_answers: Array.from(row.querySelectorAll('.fitb-answer-chips input[type="hidden"]')).map(input => input.value),
            case_sensitive: row.querySelector('input[type="checkbox"]')?.checked ? 1 : 0
        });
    });
    if (preview) preview.innerHTML = fitbPreviewHtml(text);
    let html = '';
    for (let blankIndex = 1; blankIndex <= blankCount; blankIndex++) {
        const existing = current.find(blank => parseInt(blank.blank_index, 10) === blankIndex)
            || stored.find(blank => parseInt(blank.blank_index, 10) === blankIndex)
            || {};
        const answers = existing.accepted_answers || [];
        const caseSensitive = existing.case_sensitive == 1;
        html += `
            <div class="fitb-blank-row" data-blank-index="${blankIndex}" style="border-top:1px solid rgba(255,255,255,.07);padding-top:10px;margin-top:10px;">
                <label class="teacher-modal-label">Blank ${blankIndex} accepted answers:</label>
                <div style="display:flex;gap:8px;">
                    <input type="text" class="teacher-modal-input fitb-answer-input" placeholder="Accepted answer" style="margin:0;">
                    <button type="button" data-action="add-fitb-answer" style="background:rgba(79,209,197,.1);border:1px solid rgba(79,209,197,.3);color:#4fd1c5;border-radius:7px;padding:0 12px;cursor:pointer;">Add</button>
                </div>
                <div class="fitb-answer-chips" style="display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;">${buildChipInputs(`fitb_accepted_answers[${index}][${blankIndex}][]`, answers)}</div>
                <label style="display:flex;align-items:center;gap:8px;margin-top:8px;color:#c9d1d9;font-size:13px;">
                    <input type="checkbox" name="fitb_case_sensitive[${index}][${blankIndex}]" value="1" ${caseSensitive ? 'checked' : ''} style="width:16px;height:16px;accent-color:#4fd1c5;">
                    Case sensitive
                </label>
            </div>`;
    }
    blanksContainer.innerHTML = html || '<div style="color:#f5c38b;font-size:12px;">Add at least one {blank} marker to generate answer fields.</div>';
    updateFitbBankCount(builder);
}

function updateFitbBankCount(builder) {
    const answerCount = builder.querySelectorAll('.fitb-answer-chips input[type="hidden"]').length;
    const distractorCount = builder.querySelectorAll('.fitb-distractor-chips input[type="hidden"]').length;
    const count = builder.querySelector('.fitb-bank-count');
    if (count) count.textContent = `Word bank will contain ${answerCount + distractorCount} words (${answerCount} answers + ${distractorCount} distractors).`;
}

function setQuestionTypeFields(questionEl, questionType) {
    const isOpenEnded = questionType === 'open_ended';
    const isFitb = questionType === 'fill_in_blank';
    const isMultipleAnswer = questionType === 'multiple_answer';
    const mcqFields = questionEl ? questionEl.querySelector('.cq-mcq-fields, .eq-mcq-fields') : null;
    const preview = questionEl ? questionEl.querySelector('.cq-open-preview, .eq-open-preview') : null;
    const fitbFields = questionEl ? questionEl.querySelector('.fitb-builder') : null;
    if (questionEl && questionEl.classList.contains('eq-question')) {
        updateEditChoiceCorrectControls(questionEl, isMultipleAnswer);
    }
    if (mcqFields) {
        mcqFields.style.display = (isOpenEnded || isFitb) ? 'none' : 'block';
        mcqFields.querySelectorAll('input, select, textarea').forEach(input => {
            input.disabled = isOpenEnded || isFitb;
            if (input.type === 'text') input.required = !isOpenEnded && !isFitb && (input.placeholder === 'Choice 1' || input.placeholder === 'Choice 2');
        });
        const correctSelect = mcqFields.querySelector('.cq-correct-select, .eq-correct-select');
        const maCorrectList = mcqFields.querySelector('.cq-ma-correct-list, .eq-ma-correct-list');
        const maSettings = mcqFields.querySelector('.cq-ma-settings, .eq-ma-settings');
        if (correctSelect) {
            correctSelect.style.display = isMultipleAnswer ? 'none' : '';
            correctSelect.disabled = isOpenEnded || isFitb || isMultipleAnswer;
        }
        if (maCorrectList) {
            maCorrectList.style.display = isMultipleAnswer ? 'block' : 'none';
            maCorrectList.querySelectorAll('input').forEach(input => input.disabled = !isMultipleAnswer || isOpenEnded || isFitb);
        }
        if (maSettings) {
            maSettings.style.display = isMultipleAnswer ? 'block' : 'none';
            maSettings.querySelectorAll('input, select').forEach(input => input.disabled = !isMultipleAnswer || isOpenEnded || isFitb);
        }
    }
    if (preview) preview.style.display = isOpenEnded ? 'block' : 'none';
    if (fitbFields) {
        fitbFields.style.display = isFitb ? 'block' : 'none';
        if (isFitb) syncFitbBuilder(questionEl);
        const builderLocked = fitbFields.dataset.locked === '1';
        fitbFields.querySelectorAll('input, select, button').forEach(input => {
            input.disabled = !isFitb || builderLocked || input.dataset.locked === '1';
        });
    }
}

function updateEditChoiceCorrectControls(questionEl, isMultipleAnswer) {
    const index = questionEl.dataset.questionIndex || 0;
    questionEl.querySelectorAll('.eq-choice-row').forEach((row, choiceIndex) => {
        const oldControl = row.querySelector('input[type="radio"], input[type="checkbox"]');
        if (!oldControl) return;
        if ((isMultipleAnswer && oldControl.type === 'checkbox') || (!isMultipleAnswer && oldControl.type === 'radio')) {
            oldControl.name = isMultipleAnswer ? `multiple_answer_correct[${index}][]` : `correct_choice[${index}]`;
            oldControl.value = choiceIndex;
            return;
        }
        const replacement = document.createElement('input');
        replacement.type = isMultipleAnswer ? 'checkbox' : 'radio';
        replacement.name = isMultipleAnswer ? `multiple_answer_correct[${index}][]` : `correct_choice[${index}]`;
        replacement.value = choiceIndex;
        replacement.checked = oldControl.checked;
        replacement.style.cssText = oldControl.style.cssText;
        replacement.disabled = oldControl.disabled;
        oldControl.replaceWith(replacement);
    });
}

function updateOpenEndedBanner() {
    const banner = document.getElementById('cqOpenEndedBanner') || document.getElementById('eqOpenEndedBanner');
    if (!banner) return;
    const hasOpenEnded = hasOpenEndedQuestions(document.getElementById('createQuizForm') || document.getElementById('editQuizForm') || document);
    banner.style.display = hasOpenEnded ? 'block' : 'none';
    updatePublishMarksOpenEndedGate();
}

function hasOpenEndedQuestions(scope) {
    return Array.from((scope || document).querySelectorAll('[name="question_type[]"]'))
        .some(field => field.value === 'open_ended');
}

function updatePublishMarksOpenEndedGate() {
    const createForm = document.getElementById('createQuizForm');
    const editForm = document.getElementById('editQuizForm');
    const hasOpenEnded = hasOpenEndedQuestions(createForm || editForm || document);

    const createLabel = document.getElementById('cqPublishMarksLabel');
    const createMessage = document.getElementById('cqPublishMarksOpenMessage');
    const createCheckbox = createLabel ? createLabel.querySelector('input[name="publish_marks"]') : null;
    if (createLabel && createMessage) {
        createLabel.style.display = hasOpenEnded ? 'none' : 'flex';
        createMessage.style.display = hasOpenEnded ? 'block' : 'none';
        if (hasOpenEnded && createCheckbox) createCheckbox.checked = false;
    }

    const editMessage = document.getElementById('eqPublishMarksOpenMessage');
    if (editMessage) {
        editMessage.style.display = hasOpenEnded ? 'block' : 'none';
    }
    const editLabel = document.getElementById('eqPublishMarksLabel');
    const editCheckbox = editLabel ? editLabel.querySelector('input[name="publish_marks"]') : null;
    if (editLabel) {
        editLabel.style.display = hasOpenEnded ? 'none' : 'flex';
        if (hasOpenEnded && editCheckbox) editCheckbox.checked = false;
    }
}

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
// FIX 3: Live summary bar
// ─────────────────────────────────────────────
function updateCqSummaryBar() {
    const container = document.getElementById('cqQuestionsContainer');
    if (!container) return;
    const questions = container.querySelectorAll('[id^="cq-question-"]');
    const qCount = questions.length;
    let totalMarks = 0;
    questions.forEach(q => {
        const pts = parseInt(q.querySelector('.cq-points-input')?.value) || 0;
        totalMarks += pts;
    });
    const qCountEl = document.getElementById('cqSummaryQCount');
    const qPluralEl = document.getElementById('cqSummaryQPlural');
    const marksEl = document.getElementById('cqSummaryMarks');
    const mPluralEl = document.getElementById('cqSummaryMPlural');
    if (qCountEl) qCountEl.textContent = qCount;
    if (qPluralEl) qPluralEl.textContent = qCount === 1 ? '' : 's';
    if (marksEl) marksEl.textContent = totalMarks;
    if (mPluralEl) mPluralEl.textContent = totalMarks === 1 ? '' : 's';
}

function getCqQuestionBlocks() {
    return Array.from(document.querySelectorAll('#cqQuestionsContainer [id^="cq-question-"]'));
}

function getCqQuestionData(block, index) {
    const questionText = block.querySelector('.cq-question-text')?.value.trim() || '';
    const questionType = block.querySelector('.cq-qtype-select')?.value || 'mcq';
    const points = parseInt(block.querySelector('.cq-points-input')?.value, 10) || 1;
    const rawChoices = Array.from(block.querySelectorAll('.cq-choice-input'))
        .map(input => input.value.trim())
        .filter(Boolean);
    const choices = rawChoices.length ? rawChoices : ['Choice 1', 'Choice 2'];
    const fitbSubType = block.querySelector('.fitb-sub-type')?.value || 'free_type';
    const wordBankWords = Array.from(block.querySelectorAll('.fitb-answer-chips input[type="hidden"], .fitb-distractor-chips input[type="hidden"]'))
        .map(input => input.value)
        .filter(Boolean);
    return { index, questionText, questionType, points, choices, fitbSubType, wordBankWords };
}

function buildCqLearnerQuestionPreview(data) {
    const questionText = data.questionText || 'Your question text will appear here.';
    let answerHtml = '';

    if (data.questionType === 'open_ended') {
        answerHtml = `<textarea class="cq-preview-textarea" disabled placeholder="Learner types their answer here..."></textarea>`;
    } else if (data.questionType === 'fill_in_blank') {
        answerHtml = `
            <div style="color:#e2e8f0;font-size:15px;line-height:2;margin-top:4px;">${fitbPreviewHtml(questionText)}</div>
            ${data.fitbSubType === 'word_bank' ? `
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
                    ${(data.wordBankWords.length ? data.wordBankWords : ['word', 'extra']).map(word => `
                        <span style="border:1px solid rgba(79,209,197,0.28);background:rgba(79,209,197,0.08);color:#4fd1c5;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:900;">${escapeHtml(word)}</span>
                    `).join('')}
                </div>` : ''}
        `;
    } else {
        const isMultiple = data.questionType === 'multiple_answer';
        const visibleChoices = data.choices.length ? data.choices : ['Choice 1', 'Choice 2'];
        answerHtml = visibleChoices.map(choice => `
            <div class="cq-learner-choice">
                <span class="cq-learner-radio ${isMultiple ? 'cq-learner-checkbox' : ''}"></span>
                <span>${escapeHtml(choice)}</span>
            </div>
        `).join('');
    }

    return `
        <div class="cq-learner-card">
            <div class="cq-learner-meta">
                <span>Question ${data.index + 1}</span>
                <span>${escapeHtml(data.points)} point${data.points === 1 ? '' : 's'}</span>
            </div>
            ${data.questionType === 'fill_in_blank' ? '' : `<div class="cq-learner-question">${escapeHtml(questionText)}</div>`}
            ${answerHtml}
        </div>`;
}

function updateCqPreview() {
    const blocks = getCqQuestionBlocks();
    const previews = [];
    blocks.forEach((block, index) => {
        const data = getCqQuestionData(block, index);
        const html = buildCqLearnerQuestionPreview(data);
        const target = block.querySelector('.cq-question-preview');
        if (target) target.innerHTML = html;
        previews.push(html);
    });

    const fullPreview = document.getElementById('cqFullPreview');
    if (!fullPreview) return;
    const title = document.querySelector('#createQuizForm input[name="quiz_title"]')?.value.trim() || 'Untitled Quiz';
    const duration = document.querySelector('#createQuizForm input[name="duration"]')?.value || '0';
    fullPreview.innerHTML = `
        <div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;margin-bottom:12px;">
            <div style="color:#e2e8f0;font-size:18px;font-weight:900;margin-bottom:6px;">${escapeHtml(title)}</div>
            <div style="color:#8b949e;font-size:13px;">${escapeHtml(duration)} minutes &bull; ${blocks.length} question${blocks.length === 1 ? '' : 's'}</div>
        </div>
        ${previews.join('') || '<div style="color:#8b949e;font-size:13px;">Add a question to preview the learner view.</div>'}
    `;
}

window.toggleCqFullPreview = function() {
    const wrap = document.getElementById('cqFullPreviewWrap');
    const chevron = document.getElementById('cqFullPreviewChevron');
    if (!wrap || !chevron) return;
    const isOpen = wrap.style.display !== 'none';
    wrap.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// FIX 4: Status / start time coupling
// ─────────────────────────────────────────────
window.handleCqStatusChange = function(val) {
    const wrapper    = document.getElementById('cqStartTimeWrapper');
    const ignoredMsg = document.getElementById('cqStartTimeIgnored');
    const helperMsg  = document.getElementById('cqStartTimeHelper');
    const startInput = document.getElementById('cqStartTime');
    if (!wrapper) return;
    if (val === 'Open') {
        wrapper.style.opacity        = '0.45';
        wrapper.style.pointerEvents  = 'none';
        if (ignoredMsg) ignoredMsg.style.display = 'block';
        if (helperMsg)  helperMsg.style.display  = 'none';
    } else {
        wrapper.style.opacity        = '1';
        wrapper.style.pointerEvents  = '';
        if (ignoredMsg) ignoredMsg.style.display = 'none';
        if (helperMsg)  helperMsg.style.display  = 'block';
    }
};

// ─────────────────────────────────────────────
// FIX 2: Insert {blank} at cursor
// ─────────────────────────────────────────────
window.cqInsertBlankTag = function(btn) {
    const questionBlock = btn.closest('[id^="cq-question-"]');
    if (!questionBlock) return;
    const input = questionBlock.querySelector('.cq-question-text');
    if (!input) return;
    const start = input.selectionStart;
    const end   = input.selectionEnd;
    input.value = input.value.substring(0, start) + '{blank}' + input.value.substring(end);
    input.selectionStart = input.selectionEnd = start + 7;
    input.focus();
    input.dispatchEvent(new Event('input'));
};

// ─────────────────────────────────────────────
// FIX 9: Client-side pre-submit validation
// ─────────────────────────────────────────────
function cqClearValidationErrors() {
    document.querySelectorAll('[id^="cq-question-"].cq-has-error').forEach(el => {
        el.classList.remove('cq-has-error');
        el.style.borderColor = 'rgba(255,255,255,0.06)';
    });
    document.querySelectorAll('.cq-field-error').forEach(el => el.remove());
    document.querySelectorAll('.cq-input-error').forEach(el => {
        el.classList.remove('cq-input-error');
        el.style.borderColor = '';
    });
}

function cqAddFieldError(field, msg) {
    if (field) {
        field.style.borderColor = '#f85149';
        field.classList.add('cq-input-error');
        const errEl = document.createElement('div');
        errEl.className = 'cq-field-error';
        errEl.style.cssText = 'color:#f85149;font-size:12px;margin-top:4px;display:flex;align-items:center;gap:4px;';
        errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        field.parentNode.insertBefore(errEl, field.nextSibling);
    }
}

function cqValidateBeforeSubmit() {
    cqClearValidationErrors();
    const container = document.getElementById('cqQuestionsContainer');
    if (!container) return true;
    const questions = container.querySelectorAll('[id^="cq-question-"]');
    let firstError = null;

    questions.forEach(block => {
        const qInput   = block.querySelector('.cq-question-text');
        const qtype    = block.querySelector('.cq-qtype-select')?.value || 'mcq';
        const ptsInput = block.querySelector('.cq-points-input');
        let hasError   = false;

        // Question text required
        if (!qInput || qInput.value.trim() === '') {
            cqAddFieldError(qInput, 'Question text is required.');
            hasError = true;
        }

        // FITB must have at least one {blank}
        if (qtype === 'fill_in_blank' && qInput && qInput.value.trim() !== '') {
            const blanks = (qInput.value.match(/\{blank\}/gi) || []).length;
            if (blanks < 1) {
                cqAddFieldError(qInput, 'Fill in the Blank questions must contain at least one {blank}.');
                hasError = true;
            }
        }

        // MCQ: at least 2 choices, valid correct answer
        if (qtype === 'mcq') {
            const choiceInputs = block.querySelectorAll('.cq-choice-input');
            const filled = Array.from(choiceInputs).filter(c => c.value.trim() !== '');
            if (filled.length < 2) {
                cqAddFieldError(choiceInputs[0], 'At least 2 choices are required.');
                hasError = true;
            }
            const correctSelect = block.querySelector('.cq-correct-select');
            if (correctSelect) {
                const selectedIdx = parseInt(correctSelect.value);
                const choiceArr = Array.from(choiceInputs);
                if (!choiceArr[selectedIdx] || choiceArr[selectedIdx].value.trim() === '') {
                    cqAddFieldError(correctSelect, 'The selected correct choice must not be empty.');
                    hasError = true;
                }
            }
        }

        if (qtype === 'multiple_answer') {
            const choiceInputs = block.querySelectorAll('.cq-choice-input');
            const filledIndexes = Array.from(choiceInputs)
                .map((choice, index) => choice.value.trim() !== '' ? index : null)
                .filter(index => index !== null);
            const checkedIndexes = Array.from(block.querySelectorAll('.cq-ma-correct-list input[type="checkbox"]:checked'))
                .map(input => parseInt(input.value, 10))
                .filter(index => filledIndexes.includes(index));
            if (filledIndexes.length < 3) {
                cqAddFieldError(choiceInputs[0], 'Multiple Answer questions need at least 3 choices.');
                hasError = true;
            }
            if (checkedIndexes.length < 2) {
                cqAddFieldError(block.querySelector('.cq-ma-correct-list'), 'Mark at least 2 correct answers.');
                hasError = true;
            }
            if (filledIndexes.length - checkedIndexes.length < 1) {
                cqAddFieldError(block.querySelector('.cq-ma-correct-list'), 'Leave at least 1 incorrect choice as a distractor.');
                hasError = true;
            }
        }

        // Points must be >= 1
        if (!ptsInput || parseInt(ptsInput.value) < 1) {
            cqAddFieldError(ptsInput, 'Points must be at least 1.');
            hasError = true;
        }

        if (hasError) {
            block.classList.add('cq-has-error');
            block.style.borderColor = '#f85149';
            if (!firstError) firstError = block;
        }
    });

    if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────
// INTEGRITY MODAL
// ─────────────────────────────────────────────
let activeDeleteQuizId = null;

function getQuizFormTarget() {
    const apiArea = document.getElementById('api-content-area');
    const panel = document.getElementById('qz-main-panel');
    return window.innerWidth >= 900 && panel ? panel : apiArea;
}

function buildEditQuestionHtml(question, index, locked) {
    const questionType = ['multiple_answer', 'open_ended', 'fill_in_blank'].includes(question.question_type) ? question.question_type : 'mcq';
    const isOpenEnded = questionType === 'open_ended';
    const isFitb = questionType === 'fill_in_blank';
    const isMultipleAnswer = questionType === 'multiple_answer';
    const choices = question.choices && question.choices.length ? question.choices : [
        { id: 0, choice_text: '', is_correct: 1 },
        { id: 0, choice_text: '', is_correct: 0 }
    ];
    const disabled = locked ? 'disabled' : '';
    const choiceDisabled = locked || isOpenEnded || isFitb ? 'disabled' : '';
    let choicesHtml = '';

    choices.forEach((choice, choiceIndex) => {
        const correctControl = isMultipleAnswer
            ? `<input type="checkbox" name="multiple_answer_correct[${index}][]" value="${choiceIndex}" ${choice.is_correct == 1 ? 'checked' : ''} ${choiceDisabled}
                    style="width:16px;height:16px;accent-color:#4fd1c5;flex-shrink:0;">`
            : `<input type="radio" name="correct_choice[${index}]" value="${choiceIndex}" ${choice.is_correct == 1 ? 'checked' : ''} ${choiceDisabled}
                    style="width:16px;height:16px;accent-color:#4fd1c5;flex-shrink:0;">`;
        choicesHtml += `
            <div class="eq-choice-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
                <input type="hidden" name="choice_id[${index}][]" value="${escapeHtml(choice.id || 0)}">
                ${correctControl}
                <input type="text" name="choices[${index}][]" class="teacher-modal-input"
                    value="${escapeHtml(choice.choice_text || '')}" placeholder="Choice ${choiceIndex + 1}" ${choiceDisabled}
                    style="margin:0;">
                ${!locked && !isOpenEnded && choices.length > 2 ? `<button type="button" data-action="remove-edit-choice"
                    style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;border-radius:6px;padding:7px 9px;cursor:pointer;">Remove</button>` : ''}
            </div>`;
    });

    return `
        <div class="eq-question" data-question-index="${index}"
            style="background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <span style="font-size:15px;font-weight:800;color:#4fd1c5;">Question ${index + 1}</span>
                ${!locked ? `<button type="button" data-action="remove-edit-question"
                    style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">Remove</button>` : ''}
            </div>
            <input type="hidden" name="question_id[]" value="${escapeHtml(question.id || 0)}">
            <input type="hidden" name="remove_image[]" value="0">
            <label class="teacher-modal-label">Question Text *</label>
            <input type="text" name="question[]" class="teacher-modal-input" value="${escapeHtml(question.question_text || '')}" ${disabled} required>
            <label class="teacher-modal-label" style="margin-top:12px;">Question Type</label>
            ${locked ? `
                <input type="hidden" name="question_type[]" value="${questionType}">
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#c9d1d9;padding:11px 12px;font-size:13px;">${questionType === 'open_ended' ? 'Open Ended' : questionType === 'fill_in_blank' ? 'Fill in the Blank' : questionType === 'multiple_answer' ? 'Multiple Answer' : 'Multiple Choice'}</div>
            ` : `
                <select name="question_type[]" class="teacher-modal-input" data-action="change-question-type">
                    <option value="mcq" ${questionType === 'mcq' ? 'selected' : ''}>Multiple Choice</option>
                    <option value="multiple_answer" ${questionType === 'multiple_answer' ? 'selected' : ''}>Multiple Answer</option>
                    <option value="open_ended" ${questionType === 'open_ended' ? 'selected' : ''}>Open Ended</option>
                    <option value="fill_in_blank" ${questionType === 'fill_in_blank' ? 'selected' : ''}>Fill in the Blank</option>
                </select>
            `}
            <label class="teacher-modal-label" style="margin-top:12px;">Optional Image</label>
            ${question.image_path ? `<div style="font-size:12px;color:#8b949e;margin-bottom:8px;">Current image: ${escapeHtml(question.image_path)}</div>` : ''}
            ${question.image_path && !locked ? `<label style="display:flex;align-items:center;gap:8px;color:#c9d1d9;font-size:13px;margin-bottom:8px;">
                <input type="checkbox" data-action="toggle-remove-image" style="accent-color:#4fd1c5;"> Remove current image
            </label>` : ''}
            <input type="file" name="question_images[]" accept="image/*" ${disabled}
                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:8px 12px;box-sizing:border-box;font-size:13px;">
            <div class="eq-mcq-fields" style="display:${(isOpenEnded || isFitb) ? 'none' : 'block'};">
                <label class="teacher-modal-label" style="margin-top:12px;">Answer Choices *</label>
                <div class="eq-choices">${choicesHtml}</div>
                ${!locked && !isOpenEnded ? `<button type="button" data-action="add-edit-choice"
                style="margin-top:2px;background:rgba(79,209,197,0.08);border:1px dashed rgba(79,209,197,0.4);color:#4fd1c5;border-radius:8px;padding:8px 10px;cursor:pointer;font-size:12px;font-weight:700;">+ Add Choice</button>` : ''}
                <div class="eq-ma-settings" style="display:${isMultipleAnswer ? 'block' : 'none'};margin-top:12px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;">
                    <label class="teacher-modal-label">Scoring Mode</label>
                    <select name="ma_scoring_mode[${index}]" class="teacher-modal-input" ${choiceDisabled}>
                        <option value="exact_match" ${(question.multiple_answer?.scoring_mode || 'exact_match') === 'exact_match' ? 'selected' : ''}>Exact Match</option>
                        <option value="partial_penalty" ${question.multiple_answer?.scoring_mode === 'partial_penalty' ? 'selected' : ''}>Partial Credit with Penalty</option>
                    </select>
                    <label class="teacher-modal-label" style="margin-top:10px;">Optional: tell learners how many to select</label>
                    <input type="number" name="ma_select_exactly[${index}]" min="1" class="teacher-modal-input" value="${escapeHtml(question.multiple_answer?.select_exactly ?? '')}" placeholder="Optional" ${choiceDisabled} style="max-width:150px;">
                </div>
            </div>
            <div class="eq-open-preview" style="display:${isOpenEnded ? 'block' : 'none'};background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.14);border-radius:8px;color:#8b949e;font-size:13px;padding:12px;margin-top:12px;">
                Learners will type their answer here.
            </div>
            ${buildFitbBuilderHtml('eq', index, question.fitb || null, locked).replace('display:none;', `display:${isFitb ? 'block' : 'none'};`)}
            <label class="teacher-modal-label" style="margin-top:12px;">Points</label>
            <input type="number" name="points[]" min="1" value="${escapeHtml(question.points || 1)}" class="teacher-modal-input" ${disabled}
                style="max-width:100px;">
        </div>`;
}

function refreshEditQuestionIndexes() {
    document.querySelectorAll('#editQuestionsContainer .eq-question').forEach((questionEl, index) => {
        questionEl.dataset.questionIndex = index;
        const title = questionEl.querySelector('span');
        if (title) title.textContent = `Question ${index + 1}`;
        questionEl.querySelectorAll('.eq-choice-row').forEach((choiceEl, choiceIndex) => {
            const idInput = choiceEl.querySelector('input[type="hidden"]');
            const radio = choiceEl.querySelector('input[type="radio"], input[type="checkbox"]');
            const text = choiceEl.querySelector('input[type="text"]');
            if (idInput) idInput.name = `choice_id[${index}][]`;
            if (radio) {
                radio.name = radio.type === 'checkbox' ? `multiple_answer_correct[${index}][]` : `correct_choice[${index}]`;
                radio.value = choiceIndex;
            }
            if (text) {
                text.name = `choices[${index}][]`;
                text.placeholder = `Choice ${choiceIndex + 1}`;
            }
        });
        const builder = questionEl.querySelector('.fitb-builder');
        if (builder) {
            builder.querySelectorAll('.fitb-sub-type').forEach(input => input.name = `fitb_sub_type[${index}]`);
            builder.querySelectorAll('.fitb-scoring-mode').forEach(input => input.name = `fitb_scoring_mode[${index}]`);
            builder.querySelectorAll('.fitb-blank-row').forEach(row => {
                const blankIndex = row.dataset.blankIndex;
                row.querySelectorAll('.fitb-answer-chips input[type="hidden"]').forEach(input => {
                    input.name = `fitb_accepted_answers[${index}][${blankIndex}][]`;
                });
                const caseBox = row.querySelector('input[type="checkbox"]');
                if (caseBox) caseBox.name = `fitb_case_sensitive[${index}][${blankIndex}]`;
            });
            builder.querySelectorAll('.fitb-distractor-chips input[type="hidden"]').forEach(input => {
                input.name = `fitb_distractors[${index}][]`;
            });
        }
        const maSettings = questionEl.querySelector('.eq-ma-settings');
        if (maSettings) {
            const scoring = maSettings.querySelector('select[name^="ma_scoring_mode"]');
            const selectExactly = maSettings.querySelector('input[name^="ma_select_exactly"]');
            if (scoring) scoring.name = `ma_scoring_mode[${index}]`;
            if (selectExactly) selectExactly.name = `ma_select_exactly[${index}]`;
        }
    });
}

window.openEditQuiz = async function(quizId) {
    const loader = document.getElementById('loaderOverlay');
    const target = getQuizFormTarget();
    const panel = document.getElementById('qz-main-panel');
    const isDesktop = target === panel;
    if (loader) loader.style.display = 'flex';

    try {
        const res = await fetch(`api/teacher/get_quiz_edit_data.php?quiz_id=${quizId}`, {
            headers: { 'X-CSRF-Token': getCsrfToken() }
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Failed to load quiz.');

        const quiz = data.data.quiz;
        const locked = data.data.has_attempts;
        const statusOptions = ['Scheduled', 'Open', 'Closed'].map(status =>
            `<option value="${status}" ${quiz.status === status ? 'selected' : ''}>${status}</option>`
        ).join('');
        const layoutDisabled = locked ? 'disabled' : '';
        const questionsHtml = (data.data.questions || []).map((question, index) => buildEditQuestionHtml(question, index, locked)).join('');

        target.innerHTML = `
            <div style="max-width:${isDesktop ? '620px' : '760px'};margin:0 auto;padding:${isDesktop ? '20px 32px 32px' : '0'};">
                <h2 style="color:#4fd1c5;font-size:${isDesktop ? '18px' : '22px'};margin:0 0 20px;font-weight:800;">Edit Quiz</h2>
                ${locked ? `<div style="background:rgba(242,140,56,0.08);border:1px solid rgba(242,140,56,0.35);color:#f5c38b;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;line-height:1.5;">${escapeHtml(data.data.locked_message)}</div>` : ''}
                <div id="eqOpenEndedBanner" style="display:${quiz.has_open_ended == 1 ? 'block' : 'none'};background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.25);border-radius:10px;color:#b7f5ef;font-size:13px;line-height:1.5;padding:12px;margin-bottom:16px;">
                    This quiz contains open-ended questions. After all learners submit, you will need to manually grade their responses before you can release marks.
                </div>
                <div id="eqPublishMarksOpenMessage" style="display:${quiz.has_open_ended == 1 ? 'block' : 'none'};background:rgba(242,140,56,0.08);border:1px solid rgba(242,140,56,0.28);border-radius:10px;color:#f5c38b;font-size:13px;line-height:1.5;padding:12px;margin-bottom:16px;">
                    Marks cannot be auto-released when the quiz contains open-ended questions. You must grade all responses manually before releasing marks.
                </div>
                <form id="editQuizForm" enctype="multipart/form-data">
                    <input type="hidden" name="quiz_id" value="${escapeHtml(quiz.id)}">
                    <label class="teacher-modal-label">Quiz Title *</label>
                    <input type="text" name="quiz_title" class="teacher-modal-input" value="${escapeHtml(quiz.title)}" required>
                    <div style="font-size:12px;color:#8b949e;margin:8px 0 14px;">Class: ${escapeHtml(quiz.class_name)}</div>
                    <label class="teacher-modal-label">Duration (minutes) *</label>
                    <input type="number" name="duration" class="teacher-modal-input" min="0" max="180" value="${escapeHtml(quiz.duration)}" required style="max-width:160px;">
                    <label class="teacher-modal-label">Attempt Limit</label>
                    <input type="number" name="attempt_limit" class="teacher-modal-input" min="0" value="${escapeHtml(quiz.attempt_limit)}" style="max-width:160px;">
                    <label class="teacher-modal-label">Start Time *</label>
                    <input type="datetime-local" name="start_time" class="teacher-modal-input" value="${escapeHtml(quiz.start_time_local)}" required>
                    <label class="teacher-modal-label">Quiz Status</label>
                    <select name="status" class="teacher-modal-input">${statusOptions}</select>
                    <div id="eqPublishMarksWrap" style="margin-top:16px;">
                        <label id="eqPublishMarksLabel" style="display:${quiz.has_open_ended == 1 ? 'none' : 'flex'};align-items:center;gap:10px;color:#c9d1d9;font-size:14px;cursor:pointer;">
                            <input type="checkbox" name="publish_marks" value="1" ${quiz.publish_marks == 1 ? 'checked' : ''}
                                style="width:18px;height:18px;accent-color:#4fd1c5;">
                            Publish marks immediately after submission
                        </label>
                    </div>
                    <label style="display:flex;align-items:center;gap:10px;color:#c9d1d9;font-size:14px;margin-top:16px;cursor:pointer;">
                        <input type="checkbox" name="is_summative" value="1" id="eqSummative" ${quiz.is_summative == 1 ? 'checked' : ''}
                            style="width:18px;height:18px;accent-color:#4fd1c5;">
                        Counts toward official term mark
                    </label>
                    <div id="eqWeightContainer" style="display:${quiz.is_summative == 1 ? 'block' : 'none'};margin-left:28px;">
                        <label class="teacher-modal-label">Weight % of term mark</label>
                        <input type="number" name="weight_percent" id="eqWeight" class="teacher-modal-input" min="0" max="100" step="0.1"
                            value="${escapeHtml(quiz.weight_percent ?? '')}" style="max-width:150px;">
                    </div>
                    <label class="teacher-modal-label" style="margin-top:18px;">Quiz Layout Mode</label>
                    <select name="layout_mode" class="teacher-modal-input" ${layoutDisabled}>
                        <option value="single_page" ${quiz.layout_mode === 'single_page' ? 'selected' : ''}>Single Page</option>
                        <option value="multi_page" ${quiz.layout_mode === 'multi_page' ? 'selected' : ''}>Multi-Page</option>
                    </select>
                    <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
                        <label style="display:flex;gap:10px;color:#c9d1d9;font-size:13px;">
                            <input type="checkbox" name="shuffle_questions" value="1" ${quiz.shuffle_questions == 1 ? 'checked' : ''} ${layoutDisabled}
                                style="width:16px;height:16px;accent-color:#4fd1c5;"> Shuffle Questions
                        </label>
                        <label style="display:flex;gap:10px;color:#c9d1d9;font-size:13px;">
                            <input type="checkbox" name="is_linear" value="1" ${quiz.is_linear == 1 ? 'checked' : ''} ${layoutDisabled}
                                style="width:16px;height:16px;accent-color:#4fd1c5;"> Linear Progression
                        </label>
                    </div>
                    <label class="teacher-modal-label" style="margin-top:18px;">Questions *</label>
                    <div id="editQuestionsContainer">${questionsHtml}</div>
                    ${!locked ? `<button type="button" data-action="add-edit-question"
                        style="width:100%;margin-top:8px;margin-bottom:16px;background:rgba(79,209,197,0.08);border:1px dashed rgba(79,209,197,0.4);color:#4fd1c5;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:700;">+ Add Question</button>` : ''}
                    <div id="eqError" style="color:#ff5555;font-size:14px;margin-top:8px;display:none;"></div>
                    <div style="display:flex;gap:12px;margin-top:16px;margin-bottom:32px;">
                        <button type="button" data-action="cancel-edit-quiz" class="teacher-modal-cancel" style="flex:1;padding:13px;">Cancel</button>
                        <button type="submit" class="teacher-modal-submit" id="eqSubmitBtn" style="flex:2;padding:13px;font-size:14px;">Save Quiz</button>
                    </div>
                </form>
            </div>`;

        document.getElementById('editQuizForm').addEventListener('submit', submitEditQuiz);
        document.querySelectorAll('#editQuestionsContainer .eq-question').forEach(questionEl => {
            const type = questionEl.querySelector('[name="question_type[]"]');
            if (type) setQuestionTypeFields(questionEl, type.value);
        });
        updatePublishMarksOpenEndedGate();
        document.getElementById('eqSummative').addEventListener('change', function() {
            const weightContainer = document.getElementById('eqWeightContainer');
            if (weightContainer) weightContainer.style.display = this.checked ? 'block' : 'none';
            if (!this.checked) document.getElementById('eqWeight').value = '';
        });
    } catch (e) {
        if (target) target.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">${escapeHtml(e.message || 'Error loading quiz.')}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

async function submitEditQuiz(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const errorDiv = document.getElementById('eqError');
    const submitBtn = document.getElementById('eqSubmitBtn');
    const loader = document.getElementById('loaderOverlay');
    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    if (loader) loader.style.display = 'flex';

    try {
        refreshEditQuestionIndexes();
        const res = await fetch('api/teacher/edit_quiz.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: new FormData(form)
        });
        const data = await res.json();
        if (data.status === 'success') {
            window.teacherQuizzesCache = null;
            fetchTeacherQuizzes();
            if (data.data?.message) alert(data.data.message);
        } else {
            errorDiv.textContent = data.message || 'Failed to save quiz.';
            errorDiv.style.display = 'block';
        }
    } catch (err) {
        errorDiv.textContent = 'Something went wrong. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Quiz';
        if (loader) loader.style.display = 'none';
    }
}

window.openDeleteQuizModal = function(quizId, quizTitle) {
    activeDeleteQuizId = quizId;
    const modal = document.getElementById('deleteQuizModal');
    const title = document.getElementById('deleteQuizTitle');
    const error = document.getElementById('deleteQuizError');
    if (title) title.textContent = quizTitle;
    if (error) error.style.display = 'none';
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteQuizModal = function() {
    const modal = document.getElementById('deleteQuizModal');
    if (modal) modal.style.display = 'none';
    activeDeleteQuizId = null;
};

window.confirmDeleteQuiz = async function() {
    if (!activeDeleteQuizId) return;
    const error = document.getElementById('deleteQuizError');
    const loader = document.getElementById('loaderOverlay');
    if (error) error.style.display = 'none';
    if (loader) loader.style.display = 'flex';

    try {
        const res = await fetch('api/teacher/delete_quiz.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ quiz_id: activeDeleteQuizId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            const row = document.querySelector(`.teacher-quiz-card[data-quiz-id="${activeDeleteQuizId}"]`);
            if (row) row.remove();
            window.teacherQuizzesCache = null;
            closeDeleteQuizModal();
            if (document.getElementById('qz-main-panel')) fetchTeacherQuizzes();
        } else if (error) {
            error.textContent = data.message || 'Failed to delete quiz.';
            error.style.display = 'block';
        }
    } catch (e) {
        if (error) {
            error.textContent = 'Connection error.';
            error.style.display = 'block';
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'edit-quiz') {
        openEditQuiz(parseInt(actionEl.dataset.quizId, 10));
    } else if (action === 'delete-quiz') {
        openDeleteQuizModal(parseInt(actionEl.dataset.quizId, 10), actionEl.dataset.quizTitle || '');
    } else if (action === 'close-delete-quiz') {
        closeDeleteQuizModal();
    } else if (action === 'confirm-delete-quiz') {
        confirmDeleteQuiz();
    } else if (action === 'cancel-edit-quiz') {
        fetchTeacherQuizzes();
    } else if (action === 'add-edit-question') {
        const container = document.getElementById('editQuestionsContainer');
        const index = container ? container.querySelectorAll('.eq-question').length : 0;
        if (container) {
            container.insertAdjacentHTML('beforeend', buildEditQuestionHtml({ id: 0, question_text: '', question_type: 'mcq', points: 1, choices: [] }, index, false));
            refreshEditQuestionIndexes();
            updateOpenEndedBanner();
        }
    } else if (action === 'remove-edit-question') {
        const question = actionEl.closest('.eq-question');
        if (question) question.remove();
        refreshEditQuestionIndexes();
        updateOpenEndedBanner();
    } else if (action === 'add-edit-choice') {
        const question = actionEl.closest('.eq-question');
        const typeSelect = question ? question.querySelector('select[name="question_type[]"]') : null;
        const currentType = typeSelect ? typeSelect.value : (question?.querySelector('input[name="question_type[]"]')?.value || 'mcq');
        if (currentType === 'open_ended' || currentType === 'fill_in_blank') return;
        const choices = question ? question.querySelector('.eq-choices') : null;
        if (choices) {
            const correctControl = currentType === 'multiple_answer'
                ? '<input type="checkbox" name="multiple_answer_correct[0][]" value="0" style="width:16px;height:16px;accent-color:#4fd1c5;flex-shrink:0;">'
                : '<input type="radio" name="correct_choice[0]" value="0" style="width:16px;height:16px;accent-color:#4fd1c5;flex-shrink:0;">';
            choices.insertAdjacentHTML('beforeend', `
                <div class="eq-choice-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
                    <input type="hidden" name="choice_id[0][]" value="0">
                    ${correctControl}
                    <input type="text" name="choices[0][]" class="teacher-modal-input" value="" placeholder="Choice" style="margin:0;">
                    <button type="button" data-action="remove-edit-choice"
                        style="background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;border-radius:6px;padding:7px 9px;cursor:pointer;">Remove</button>
                </div>`);
            refreshEditQuestionIndexes();
        }
    } else if (action === 'remove-edit-choice') {
        const row = actionEl.closest('.eq-choice-row');
        if (row) row.remove();
        refreshEditQuestionIndexes();
    } else if (action === 'toggle-remove-image') {
        const question = actionEl.closest('.eq-question');
        const removeInput = question ? question.querySelector('input[name="remove_image[]"]') : null;
        if (removeInput) removeInput.value = actionEl.checked ? '1' : '0';
    } else if (action === 'go-to-open-ended-grade') {
        openGradesForQuizFromReview(parseInt(actionEl.dataset.quizId, 10), actionEl.dataset.quizTitle || '');
    } else if (action === 'add-fitb-answer') {
        const row = actionEl.closest('.fitb-blank-row');
        const question = actionEl.closest('.eq-question') || actionEl.closest('[id^="cq-question-"]');
        const builder = actionEl.closest('.fitb-builder');
        const input = row ? row.querySelector('.fitb-answer-input') : null;
        if (row && input && input.value.trim() !== '') {
            const index = question?.dataset.questionIndex || question?.id?.replace(/\D/g, '') || 0;
            const blankIndex = row.dataset.blankIndex;
            row.querySelector('.fitb-answer-chips').insertAdjacentHTML('beforeend', buildChipInputs(`fitb_accepted_answers[${index}][${blankIndex}][]`, [input.value.trim()]));
            input.value = '';
            if (builder) updateFitbBankCount(builder);
            updateCqPreview();
        }
    } else if (action === 'add-fitb-distractor') {
        const builder = actionEl.closest('.fitb-builder');
        const question = actionEl.closest('.eq-question') || actionEl.closest('[id^="cq-question-"]');
        const input = builder ? builder.querySelector('.fitb-distractor-input') : null;
        if (builder && input && input.value.trim() !== '') {
            const index = question?.dataset.questionIndex || question?.id?.replace(/\D/g, '') || 0;
            builder.querySelector('.fitb-distractor-chips').insertAdjacentHTML('beforeend', buildChipInputs(`fitb_distractors[${index}][]`, [input.value.trim()]));
            input.value = '';
            updateFitbBankCount(builder);
            updateCqPreview();
        }
    } else if (action === 'remove-fitb-chip') {
        const builder = actionEl.closest('.fitb-builder');
        const chip = actionEl.closest('.fitb-chip-tag');
        if (chip) chip.remove();
        if (builder) updateFitbBankCount(builder);
        updateCqPreview();
    }
});

async function openGradesForQuizFromReview(quizId, quizTitle) {
    if (!quizId) return;
    if (typeof window.fetchTeacherGrades === 'function') {
        await window.fetchTeacherGrades();
    }
    if (typeof window.selectDesktopGradeQuiz === 'function' && window.innerWidth >= 900) {
        window.selectDesktopGradeQuiz(quizId);
    } else if (typeof window.openQuizGrades === 'function') {
        window.openQuizGrades(quizId, quizTitle);
    }
}

document.addEventListener('change', function(e) {
    const actionEl = e.target.closest('[data-action="change-question-type"]');
    if (actionEl) {
        const question = actionEl.closest('.eq-question') || actionEl.closest('[id^="cq-question-"]');
        if (question) setQuestionTypeFields(question, actionEl.value);
        updateOpenEndedBanner();
        return;
    }
    if (e.target.classList.contains('fitb-sub-type')) {
        const builder = e.target.closest('.fitb-builder');
        const distractors = builder ? builder.querySelector('.fitb-distractors') : null;
        if (distractors) distractors.style.display = e.target.value === 'word_bank' ? 'block' : 'none';
        if (builder) updateFitbBankCount(builder);
        updateCqPreview();
    }
});

document.addEventListener('input', function(e) {
    if (e.target.name !== 'question[]') return;
    const question = e.target.closest('.eq-question') || e.target.closest('[id^="cq-question-"]');
    const type = question ? question.querySelector('[name="question_type[]"]') : null;
    if (type && type.value === 'fill_in_blank') syncFitbBuilder(question);
    if (question && question.id && question.id.startsWith('cq-question-')) updateCqPreview();
});

let activeIntegrityQuizId = null;

window.openIntegrityModal = function(quizId, quizTitle) {
    activeIntegrityQuizId = quizId;

    document.getElementById('integrityModalTitle').textContent = `Integrity: ${quizTitle}`;
    document.getElementById('integrityWarning').style.display  = 'block';
    document.getElementById('integrityResults').style.display  = 'none';
    document.getElementById('integrityFooter').style.display   = 'none';
    document.getElementById('integrityModal').style.display    = 'flex';
};

window.openIntegrityModalFromElement = function(el) {
    openIntegrityModal(parseInt(el.dataset.quizId, 10), el.dataset.quizTitle || '');
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
                    <span style="color:#8b949e;font-size:13px;">${escapeHtml(data.length)} learner${data.length !== 1 ? 's' : ''} flagged</span>
                    <span style="background:rgba(79,209,197,0.2);color:#4fd1c5;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;border:1px solid #4fd1c5;">AI ACTIVE</span>
                </div>`;

            html += `<div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">`;

            data.forEach((row, i) => {
                const isLast = i === data.length - 1;
                html += `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;${isLast ? '' : 'border-bottom:1px solid rgba(255,255,255,0.06);'}">
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#f85149;flex-shrink:0;"></div>
            <span style="color:#e2e8f0;font-size:14px;">${escapeHtml(row.name)}</span>
        </div>
        <span style="color:#f85149;font-size:12px;font-weight:700;letter-spacing:0.3px;">Q ${escapeHtml(row.problem_questions)}</span>
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