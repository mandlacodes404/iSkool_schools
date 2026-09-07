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
            <p class="ev-error-message">
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
        sidebarHtml = `<p class="ev-empty-state-inline">No evaluations released yet.</p>`;
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
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="ev-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="ev-sidebar tchr-flat-sidebar">
                <div class="ev-sidebar-header">
                    <span>Evaluations</span>
                    <button class="teacher-upload-btn teacher-desktop-create ev-new-btn" id="ev-new-btn" onclick="openReleaseEvaluationForm()">
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

        <div id="deleteEvaluationModal" class="teacher-modal-overlay ev-modal-hidden">
            <div class="teacher-modal-box ev-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Evaluation</span>
                    <button onclick="closeDeleteEvaluationModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="ev-delete-modal-text">Are you sure you want to delete this evaluation? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteEvaluationModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteEvaluation()" class="teacher-modal-submit ev-delete-confirm-btn">Delete</button>
                </div>
            </div>
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
        <div id="evalResultsModal" class="teacher-modal-overlay ev-modal-hidden">
            <div class="teacher-modal-box ev-modal-box--results">
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

        <div id="releaseEvalModal" class="teacher-modal-overlay ev-modal-hidden">
            <div class="teacher-modal-box ev-modal-box--release">
                <div class="teacher-modal-header">
                    <span>Release Evaluation</span>
                    <button onclick="closeReleaseEvaluationModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" id="evalTitle" class="teacher-modal-input" placeholder="e.g. Term 1 Feedback">

                    <label class="teacher-modal-label">Description (optional)</label>
                    <textarea id="evalDescription" class="teacher-modal-input ev-form-textarea" rows="3"
                        placeholder="Optional description..."></textarea>

                    <label class="teacher-modal-label">Select Class *</label>
                    <div id="evalClassPicker"></div>

                    <label class="teacher-modal-label ev-checkbox-label">
                        <input type="checkbox" id="evalUseDefault" checked>
                        Use default questions (recommended)
                    </label>

                    <div class="ev-preview-toggle-wrap">
                        <a href="javascript:void(0)" onclick="toggleDefaultPreview()" class="ev-preview-toggle-link">
                            👁 View default questions
                        </a>
                        <div id="defaultStatementsPreview" class="ev-modal-hidden ev-default-preview-box"></div>
                    </div>

                    <div id="customStatements" class="ev-custom-statements-wrap"></div>
                    <button type="button" onclick="addCustomStatement()" class="ev-add-statement-btn">
                        + Add Custom Question
                    </button>

                    <label class="teacher-modal-label ev-checkbox-label">
                        <input type="checkbox" id="evalForceEmail">
                        Also send email notification
                    </label>

                    <div id="releaseEvalError" class="ev-form-error"></div>
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

    const sidebarScrollEl = apiArea.querySelector('.ev-sidebar-scroll');
    window.wireTeacherSectionScroll('evaluations-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('evaluations-sidebar', sidebarScrollEl);

    // Restore whichever evaluation was selected before navigating away,
    // if that same group/index still exists in the freshly-loaded data.
    const saved = window.teacherSectionState.selection.evaluations;
    if (saved) {
        const group = (window.teacherEvaluationCache || [])[saved.groupIndex];
        const ev = group && group.evaluations && group.evaluations[saved.evIndex];
        if (ev) selectDesktopEval(saved.groupIndex, saved.evIndex);
    }
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
    window.teacherSectionState.selection.evaluations = { groupIndex, evIndex };
    window.persistTeacherSectionState();

    const ev = window.teacherEvaluationCache[groupIndex].evaluations[evIndex];
    if (!ev) return;

    const panel = document.getElementById('ev-main-panel');
    if (!panel) return;

    let body = `
        <div class="ev-panel-content">
            <div class="ev-panel-header">
                <div>
                    <div class="ev-panel-title">${ev.title}</div>
                    <div class="ev-panel-meta">
                        ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
                        ${ev.description ? ' &mdash; ' + ev.description : ''}
                    </div>
                </div>
                <button class="ev-panel-delete-btn" onclick="confirmDeleteEvaluation(${ev.id})">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    Delete
                </button>
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
                        <div class="eval-bar-fill" style="--eval-bar-width:${b.percentage}%;--eval-bar-color:${b.color};">
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

    let body = `<p class="ev-mobile-results-subtitle">
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
                        <div class="eval-bar-fill" style="--eval-bar-width:${b.percentage}%;--eval-bar-color:${b.color};">
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
            <div class="ev-form-header">
                <div class="ev-form-title">Release Evaluation</div>
                <button onclick="fetchTeacherEvaluations()" class="ev-form-close-btn">&times;</button>
            </div>

            <label class="teacher-modal-label">Title *</label>
            <input type="text" id="evalTitle" class="teacher-modal-input"
                placeholder="e.g. Term 1 Feedback">

            <label class="teacher-modal-label">Description (optional)</label>
            <textarea id="evalDescription" class="teacher-modal-input ev-form-textarea" rows="3"
                placeholder="Optional description..."></textarea>

            <label class="teacher-modal-label">Select Class *</label>
            <div id="evalClassPicker"></div>

            <label class="teacher-modal-label ev-checkbox-label">
                <input type="checkbox" id="evalUseDefault" checked>
                Use default questions (recommended)
            </label>

            <div class="ev-preview-toggle-wrap">
                <a href="javascript:void(0)" onclick="toggleDefaultPreview()" class="ev-preview-toggle-link">
                    👁 View default questions
                </a>
                <div id="defaultStatementsPreview" class="ev-modal-hidden ev-default-preview-box"></div>
            </div>

            <div id="customStatements" class="ev-custom-statements-wrap"></div>
            <button type="button" onclick="addCustomStatement()" class="ev-add-statement-btn">
                + Add Custom Question
            </button>

            <label class="teacher-modal-label ev-checkbox-label">
                <input type="checkbox" id="evalForceEmail">
                Also send email notification
            </label>

            <div id="releaseEvalError" class="ev-form-error"></div>

            <div class="ev-form-actions">
                <button onclick="fetchTeacherEvaluations()"
                    class="teacher-modal-cancel ev-form-cancel-btn">
                    Cancel
                </button>
                <button onclick="submitReleaseEvaluation()"
                    class="teacher-modal-submit ev-form-submit-btn" id="releaseEvalSubmitBtn">
                    Release
                </button>
            </div>
        </div>`;

    loadEvalClasses(panel, true);
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

async function loadEvalClasses(panel = null, showLoader = false) {
    const hideInitialLoader = showLoader && window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(panel, 'Loading...')
        : null;
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('evalClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
    } finally {
        if (hideInitialLoader) hideInitialLoader();
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
            let html   = '<ol class="ev-default-preview-list">';
            data.forEach(s => { html += `<li>${s}</li>`; });
            html += '</ol>';
            preview.innerHTML = html;
        } catch (e) {
            preview.innerHTML = '<p class="ev-default-preview-error">Failed to load.</p>';
        }
    }

    preview.style.display = 'block';
};

window.addCustomStatement = function() {
    const container = document.getElementById('customStatements');
    const count     = container.querySelectorAll('textarea').length;
    const div       = document.createElement('div');
    div.className   = 'ev-custom-statement-row';
    div.innerHTML = `
        <textarea name="statements[${count}]" class="teacher-modal-input ev-form-textarea" rows="2"
            placeholder="Enter custom question..."></textarea>`;
    container.appendChild(div);
};

window.submitReleaseEvaluation = async function() {
    const title      = document.getElementById('evalTitle').value.trim();
    const desc       = document.getElementById('evalDescription').value.trim();
    const classId    = window.getClassPickerValue('evalClassPicker');
    const useDefault = document.getElementById('evalUseDefault').checked;
    // The desktop panel and mobile modal can both exist in the page. Read
    // the visible checkbox so the teacher's selected value is the one sent.
    const forceEmailInput = Array.from(document.querySelectorAll('[id="evalForceEmail"]'))
        .find(input => input.getClientRects().length > 0);
    const forceEmail = Boolean(forceEmailInput?.checked);
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

    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

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
        hideSubmitLoader();
    }
};

// ─────────────────────────────────────────────
// DELETE EVALUATION (desktop)
// ─────────────────────────────────────────────
let evaluationToDelete = null;

window.confirmDeleteEvaluation = function(id) {
    evaluationToDelete = id;
    const modal = document.getElementById('deleteEvaluationModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteEvaluationModal = function() {
    evaluationToDelete = null;
    const modal = document.getElementById('deleteEvaluationModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteEvaluation = async function() {
    if (!evaluationToDelete) return;
    const idToDelete = evaluationToDelete;
    const deleteButton = document.querySelector('#deleteEvaluationModal .ev-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteEvaluationModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_evaluation.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherEvaluationCache = null;
            fetchTeacherEvaluations();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};
