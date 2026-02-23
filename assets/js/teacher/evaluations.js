window.teacherEvaluationCache = null;

window.fetchTeacherEvaluations = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_evaluations");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_evaluations");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherEvaluationCache) {
        renderTeacherEvaluations(window.teacherEvaluationCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_evaluations.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherEvaluationCache = data;
        renderTeacherEvaluations(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading evaluations.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderTeacherEvaluations(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Evaluations</h2>
            <button class="teacher-upload-btn" onclick="openReleaseEvaluationModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Release Evaluation
            </button>
        </div>`;

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

    // Results Modal
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
                    <select id="evalClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

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

    loadEvalClasses();
}

// ─────────────────────────────────────────────
// RESULTS MODAL
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
window.openReleaseEvaluationModal = function() {
    document.getElementById('releaseEvalModal').style.display = 'flex';
};

window.closeReleaseEvaluationModal = function() {
    document.getElementById('releaseEvalModal').style.display = 'none';
    document.getElementById('evalTitle').value = '';
    document.getElementById('evalDescription').value = '';
    document.getElementById('evalClass').value = '';
    document.getElementById('evalUseDefault').checked = true;
    document.getElementById('evalForceEmail').checked = false;
    document.getElementById('customStatements').innerHTML = '';
    document.getElementById('defaultStatementsPreview').style.display = 'none';
    document.getElementById('releaseEvalError').style.display = 'none';
};

async function loadEvalClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        const sel  = document.getElementById('evalClass');
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
    const classId    = document.getElementById('evalClass').value;
    const useDefault = document.getElementById('evalUseDefault').checked;
    const forceEmail = document.getElementById('evalForceEmail').checked;
    const errorDiv   = document.getElementById('releaseEvalError');
    const submitBtn  = document.getElementById('releaseEvalSubmitBtn');
    const loader     = document.getElementById('loaderOverlay');

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
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/create_evaluation.php', { method: 'POST', body: fd });
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
        if (loader) loader.style.display = 'none';
    }
};