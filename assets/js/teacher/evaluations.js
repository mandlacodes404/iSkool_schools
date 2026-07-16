function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherEvaluationCache = null;
window.teacherEvaluationCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherEvaluations = function () {
    if (window.teacherEvaluationCache) return;
    if (window.teacherEvaluationCachePromise) return;
    window.teacherEvaluationCachePromise = fetch('api/teacher/get_evaluations.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherEvaluationCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherEvaluationCachePromise = null; });
};

window.fetchTeacherEvaluations = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_evaluations");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_evaluations");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherEvaluationCache) {
        renderTeacherEvaluations(window.teacherEvaluationCache);
        return;
    }

    try {
        if (!window.teacherEvaluationCachePromise) {
            window.teacherEvaluationCachePromise = fetch('api/teacher/get_evaluations.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherEvaluationCache = data;
                    return data;
                })
                .finally(() => { window.teacherEvaluationCachePromise = null; });
        }
        const data = await window.teacherEvaluationCachePromise;
        renderTeacherEvaluations(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading evaluations.
            </p>`;
    }
};

// Track active evaluation for desktop panel
window._activeDesktopEvalKey = null;

function renderTeacherEvaluations(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Build flat list for desktop panel lookup ──
    window._allEvalsFlat = [];
    if (data && data.length > 0) {
        data.forEach((group, gIdx) => {
            group.evaluations.forEach((ev, eIdx) => {
                window._allEvalsFlat.push({ ev, groupIndex: gIdx, evIndex: eIdx, class_name: group.class_name });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p style="padding:16px;font-size:13px;color:#555e6a;">No evaluations released yet.</p>`;
    } else {
        data.forEach((group, gIdx) => {
            const classGroupId = `ev-class-group-${gIdx}`;
            let itemsHtml = '';
            group.evaluations.forEach((ev, eIdx) => {
                const key = `${gIdx}-${eIdx}`;
                itemsHtml += `
                    <div class="ev-sidebar-item" id="ev-sidebar-${key}"
                        onclick="selectDesktopEval(${gIdx}, ${eIdx})">
                        <div class="ev-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                        </div>
                        <div class="ev-sidebar-item-info">
                            <div class="ev-sidebar-item-title">${ev.title}</div>
                            <div class="ev-sidebar-item-meta">${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}</div>
                        </div>
                    </div>`;
            });
            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                'ev-sidebar-class-label',
                group.class_name,
                itemsHtml
            );
        });
    }

    let html = `
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .ev-desktop-layout { display: flex !important; }
                .ev-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .ev-desktop-layout { display: none !important; }
                .ev-mobile-list    { display: block !important; }
            }

            .ev-desktop-layout {
                display: flex;
                gap: 0;
                min-height: 500px;
            }

            /* Left sidebar */
            .ev-sidebar {
                width: 260px;
                min-width: 220px;
                max-width: 280px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .ev-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .ev-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .ev-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .ev-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .ev-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .ev-sidebar-class-label {
                padding: 4px 16px 2px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .ev-sidebar-class-label.tchr-sidebar-class-label--toggle {
                padding-top: 8px;
                padding-bottom: 6px;
            }
            .ev-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px 10px 32px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .ev-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .ev-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .ev-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .ev-sidebar-item-info { flex: 1; min-width: 0; }
            .ev-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .ev-sidebar-item.active .ev-sidebar-item-title { color: #e2e8f0; }
            .ev-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            /* Right panel */
            .ev-main-panel {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .ev-main-panel::-webkit-scrollbar { width: 5px; }
            .ev-main-panel::-webkit-scrollbar-track { background: transparent; }
            .ev-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .ev-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .ev-panel-empty svg { opacity: 0.3; }
            .ev-panel-empty p { font-size: 14px; margin: 0; }

            .ev-panel-content { padding: 28px 32px; }

            .ev-panel-header {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .ev-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 6px;
            }
            .ev-panel-meta {
                font-size: 13px;
                color: #8b949e;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="ev-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="ev-sidebar tchr-flat-sidebar">
                <div class="ev-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Evaluations</span>
                    <button class="teacher-upload-btn teacher-desktop-create" id="ev-new-btn" onclick="openReleaseEvaluationForm()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="ev-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="ev-main-panel tchr-flat-panel" id="ev-main-panel">
                <div class="ev-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <p>Select an evaluation to view results</p>
                </div>
            </div>

            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Evaluations', `
                <p>Responses are always anonymous — you'll see the breakdown of answers per statement, but never which learner gave which response.</p>
                <p>Comments are optional for learners, so a low response count doesn't necessarily mean few learners completed the evaluation.</p>
            `) : ''}
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="ev-mobile-list">`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No evaluations released yet.</p>`;
    } else {
        data.forEach((group, groupIndex) => {
            html += `<div class="teacher-resource-section">
                <div class="teacher-resource-class-label">${group.class_name}</div>`;

            group.evaluations.forEach((ev, evIndex) => {
                html += `
                    <div class="teacher-resource-card" onclick="openEvaluationResults(${groupIndex}, ${evIndex})">
                        <div class="teacher-resource-icon">
                            <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                        </div>
                        <div class="teacher-resource-info">
                            <div class="teacher-resource-name">${ev.title}</div>
                            <div class="teacher-resource-meta">
                                ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
                                ${ev.description ? ' &middot; ' + ev.description : ''}
                            </div>
                        </div>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>`;
            });

            html += `</div>`;
        });
    }

    html += `</div>`;

    // Results Modal (shared by both desktop panel and mobile)
    html += `
        <div id="evalResultsModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:640px;max-height:85vh;overflow-y:auto;">
                <div class="teacher-modal-header">
                    <span id="evalResultsTitle">Results</span>
                    <button onclick="closeEvalResultsModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body" id="evalResultsBody"></div>
                <div class="teacher-modal-footer">
                    <button onclick="closeEvalResultsModal()" class="teacher-modal-cancel">Close</button>
                </div>
            </div>
        </div>

        <div id="releaseEvalModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:560px;max-height:85vh;overflow-y:auto;">
                <div class="teacher-modal-header">
                    <span>Release Evaluation</span>
                    <button onclick="closeReleaseEvaluationModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" id="evalTitle" class="teacher-modal-input" placeholder="e.g. Term 1 Feedback">

                    <label class="teacher-modal-label">Description (optional)</label>
                    <textarea id="evalDescription" class="teacher-modal-input" rows="3" 
                        style="resize:vertical;" placeholder="Optional description..."></textarea>

                    <label class="teacher-modal-label">Select Class *</label>
                    <div id="evalClassPicker"></div>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="evalUseDefault" checked>
                        Use default questions (recommended)
                    </label>

                    <div style="margin-top:8px;">
                        <a href="javascript:void(0)" onclick="toggleDefaultPreview()" 
                           style="color:#4fd1c5;font-size:13px;text-decoration:none;">
                            👁 View default questions
                        </a>
                        <div id="defaultStatementsPreview" style="display:none;margin-top:10px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;"></div>
                    </div>

                    <div id="customStatements" style="margin-top:16px;"></div>
                    <button type="button" onclick="addCustomStatement()" 
                        style="background:rgba(79,209,197,0.1);border:1px dashed #4fd1c5;color:#4fd1c5;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;margin-top:8px;width:100%;">
                        + Add Custom Question
                    </button>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="evalForceEmail">
                        Also send email notification
                    </label>

                    <div id="releaseEvalError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeReleaseEvaluationModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitReleaseEvaluation()" class="teacher-modal-submit" id="releaseEvalSubmitBtn">Release</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();

    loadEvalClasses();
}

// ── DESKTOP PANEL: SELECT EVALUATION ────────────────────────────────────────
window.selectDesktopEval = function(groupIndex, evIndex) {
    const key = `${groupIndex}-${evIndex}`;

    document.querySelectorAll('.ev-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('ev-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`ev-sidebar-${key}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeDesktopEvalKey = key;

    const ev = window.teacherEvaluationCache[groupIndex].evaluations[evIndex];
    if (!ev) return;

    const panel = document.getElementById('ev-main-panel');
    if (!panel) return;

    let body = `
        <div class="ev-panel-content">
            <div class="ev-panel-header">
                <div class="ev-panel-title">${ev.title}</div>
                <div class="ev-panel-meta">
                    ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
                    ${ev.description ? ' &mdash; ' + ev.description : ''}
                </div>
            </div>`;

    ev.statements.forEach(s => {
        body += `<div class="eval-question-block">
            <div class="eval-question-text">${s.statement}</div>
            <div class="eval-bars">`;

        s.breakdown.forEach(b => {
            body += `
                <div class="eval-bar-container">
                    <div class="eval-bar-label">${b.label} (${b.count})</div>
                    <div class="eval-bar-bg">
                        <div class="eval-bar-fill" style="width:${b.percentage}%;background:${b.color};">
                            ${b.percentage}%
                        </div>
                    </div>
                </div>`;
        });

        body += `</div></div>`;
    });

    body += `<div class="eval-comments-section">
        <div class="eval-comments-title">
            Anonymous Comments (${ev.response_count} total responses)
        </div>`;

    if (ev.comments.length === 0) {
        body += `<p class="eval-no-comments">No additional comments.</p>`;
    } else {
        ev.comments.forEach(c => {
            body += `<div class="eval-comment">${c.replace(/\n/g, '<br>')}</div>`;
        });
    }

    body += `</div></div>`;

    panel.innerHTML = body;
};

// ─────────────────────────────────────────────
// RESULTS MODAL (mobile)
// ─────────────────────────────────────────────
window.openEvaluationResults = function(groupIndex, evIndex) {
    const ev = window.teacherEvaluationCache[groupIndex].evaluations[evIndex];
    
    document.getElementById('evalResultsTitle').textContent = ev.title;

    let body = `<p style="color:#8b949e;font-size:14px;margin-bottom:20px;">
        ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
        ${ev.description ? ' &mdash; ' + ev.description : ''}
    </p>`;

    ev.statements.forEach(s => {
        body += `<div class="eval-question-block">
            <div class="eval-question-text">${s.statement}</div>
            <div class="eval-bars">`;

        s.breakdown.forEach(b => {
            body += `
                <div class="eval-bar-container">
                    <div class="eval-bar-label">${b.label} (${b.count})</div>
                    <div class="eval-bar-bg">
                        <div class="eval-bar-fill" style="width:${b.percentage}%;background:${b.color};">
                            ${b.percentage}%
                        </div>
                    </div>
                </div>`;
        });

        body += `</div></div>`;
    });

    body += `<div class="eval-comments-section">
        <div class="eval-comments-title">
            Anonymous Comments (${ev.response_count} total responses)
        </div>`;

    if (ev.comments.length === 0) {
        body += `<p class="eval-no-comments">No additional comments.</p>`;
    } else {
        ev.comments.forEach(c => {
            body += `<div class="eval-comment">${c.replace(/\n/g, '<br>')}</div>`;
        });
    }

    body += `</div>`;

    document.getElementById('evalResultsBody').innerHTML = body;
    document.getElementById('evalResultsModal').style.display = 'flex';
};

window.closeEvalResultsModal = function() {
    document.getElementById('evalResultsModal').style.display = 'none';
};

// ─────────────────────────────────────────────
// RELEASE MODAL
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ROUTER: panel on desktop, modal on mobile
// ─────────────────────────────────────────────
window.openReleaseEvaluationForm = function() {
    const panel = document.getElementById('ev-main-panel');
    if (window.innerWidth >= 900 && panel) {
        openReleaseEvaluationPanel(panel);
    } else {
        openReleaseEvaluationModal();
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL FORM
// ─────────────────────────────────────────────
function openReleaseEvaluationPanel(panel) {
    document.querySelectorAll('.ev-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('ev-new-btn');
    if (newBtn) newBtn.classList.add('active');

    panel.innerHTML = `
        <div class="ev-panel-content">
            <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.07);
                        display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:18px;font-weight:800;color:#e2e8f0;">Release Evaluation</div>
                <button onclick="fetchTeacherEvaluations()"
                    style="background:none;border:none;color:#8b949e;font-size:22px;
                           cursor:pointer;line-height:1;padding:0;">&times;</button>
            </div>

            <label class="teacher-modal-label">Title *</label>
            <input type="text" id="evalTitle" class="teacher-modal-input"
                placeholder="e.g. Term 1 Feedback">

            <label class="teacher-modal-label">Description (optional)</label>
            <textarea id="evalDescription" class="teacher-modal-input" rows="3"
                style="resize:vertical;" placeholder="Optional description..."></textarea>

            <label class="teacher-modal-label">Select Class *</label>
            <div id="evalClassPicker"></div>

            <label class="teacher-modal-label"
                style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                <input type="checkbox" id="evalUseDefault" checked>
                Use default questions (recommended)
            </label>

            <div style="margin-top:8px;">
                <a href="javascript:void(0)" onclick="toggleDefaultPreview()"
                    style="color:#4fd1c5;font-size:13px;text-decoration:none;">
                    👁 View default questions
                </a>
                <div id="defaultStatementsPreview"
                    style="display:none;margin-top:10px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;"></div>
            </div>

            <div id="customStatements" style="margin-top:16px;"></div>
            <button type="button" onclick="addCustomStatement()"
                style="background:rgba(79,209,197,0.1);border:1px dashed #4fd1c5;color:#4fd1c5;
                       padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;
                       margin-top:8px;width:100%;">
                + Add Custom Question
            </button>

            <label class="teacher-modal-label"
                style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                <input type="checkbox" id="evalForceEmail">
                Also send email notification
            </label>

            <div id="releaseEvalError"
                style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>

            <div style="display:flex;gap:12px;margin-top:24px;">
                <button onclick="fetchTeacherEvaluations()"
                    class="teacher-modal-cancel" style="flex:1;padding:13px;">
                    Cancel
                </button>
                <button onclick="submitReleaseEvaluation()"
                    class="teacher-modal-submit" id="releaseEvalSubmitBtn"
                    style="flex:2;padding:13px;font-size:14px;">
                    Release
                </button>
            </div>
        </div>`;

    loadEvalClasses();
}

window.openReleaseEvaluationModal = function() {
    document.getElementById('releaseEvalModal').style.display = 'flex';
};

window.closeReleaseEvaluationModal = function() {
    const modal = document.getElementById('releaseEvalModal');
    if (modal) modal.style.display = 'none';
    // Reset fields wherever they live (panel or modal)
    ['evalTitle','evalDescription'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    window.resetClassPicker('evalClassPicker');
    const useDefault = document.getElementById('evalUseDefault');
    if (useDefault) useDefault.checked = true;
    const forceEmail = document.getElementById('evalForceEmail');
    if (forceEmail) forceEmail.checked = false;
    const customStatements = document.getElementById('customStatements');
    if (customStatements) customStatements.innerHTML = '';
    const preview = document.getElementById('defaultStatementsPreview');
    if (preview) preview.style.display = 'none';
    const errorDiv = document.getElementById('releaseEvalError');
    if (errorDiv) errorDiv.style.display = 'none';
};

async function loadEvalClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('evalClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
    }
}

window.toggleDefaultPreview = async function() {
    const preview = document.getElementById('defaultStatementsPreview');
    if (preview.style.display === 'block') {
        preview.style.display = 'none';
        return;
    }

    if (preview.innerHTML === '') {
        try {
            const res  = await fetch('api/teacher/get_default_statements.php');
            const data = await res.json();
            let html   = '<ol style="margin:0;padding-left:18px;color:#8b949e;font-size:13px;">';
            data.forEach(s => { html += `<li style="margin-bottom:6px;">${s}</li>`; });
            html += '</ol>';
            preview.innerHTML = html;
        } catch (e) {
            preview.innerHTML = '<p style="color:#ff5555;font-size:13px;">Failed to load.</p>';
        }
    }

    preview.style.display = 'block';
};

window.addCustomStatement = function() {
    const container = document.getElementById('customStatements');
    const count     = container.querySelectorAll('textarea').length;
    const div       = document.createElement('div');
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <textarea name="statements[${count}]" class="teacher-modal-input" rows="2" 
            style="resize:vertical;" placeholder="Enter custom question..."></textarea>`;
    container.appendChild(div);
};

window.submitReleaseEvaluation = async function() {
    const title      = document.getElementById('evalTitle').value.trim();
    const desc       = document.getElementById('evalDescription').value.trim();
    const classId    = window.getClassPickerValue('evalClassPicker');
    const useDefault = document.getElementById('evalUseDefault').checked;
    const forceEmail = document.getElementById('evalForceEmail').checked;
    const errorDiv   = document.getElementById('releaseEvalError');
    const submitBtn  = document.getElementById('releaseEvalSubmitBtn');
    const loader     = document.getElementById('loaderOverlay');
    const panel      = document.getElementById('ev-main-panel');
    const isDesktop  = window.innerWidth >= 900 && panel;

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter a title.';  errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',       title);
    fd.append('description', desc);
    fd.append('class_id',    classId);
    if (useDefault)  fd.append('use_default', '1');
    if (forceEmail)  fd.append('force_email', '1');

    // Custom statements
    document.querySelectorAll('#customStatements textarea').forEach((ta, i) => {
        if (ta.value.trim()) fd.append(`statements[${i}]`, ta.value.trim());
    });

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Releasing...';
    const hideSubmitLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Releasing...')
        : null;
    if (!hideSubmitLoader && loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/create_evaluation.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            closeReleaseEvaluationModal();
            window.teacherEvaluationCache = null;
            fetchTeacherEvaluations();
        } else {
            errorDiv.textContent = data.error || 'Failed to release evaluation.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Release';
        if (hideSubmitLoader) hideSubmitLoader();
        else if (loader) loader.style.display = 'none';
    }
};