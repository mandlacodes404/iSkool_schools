function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherAssignmentsCache = null;
window.teacherAssignmentsCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherAssignments = function () {
    if (window.teacherAssignmentsCache) return;
    if (window.teacherAssignmentsCachePromise) return;
    window.teacherAssignmentsCachePromise = fetch('api/teacher/get_assignments.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherAssignmentsCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherAssignmentsCachePromise = null; });
};

// ─────────────────────────────────────────────
// ASSIGNMENTS LIST
// ─────────────────────────────────────────────
window.fetchTeacherAssignments = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_assignments");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_assignments");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAssignmentsCache) {
        renderTeacherAssignments(window.teacherAssignmentsCache);
        return;
    }

    try {
        if (!window.teacherAssignmentsCachePromise) {
            window.teacherAssignmentsCachePromise = fetch('api/teacher/get_assignments.php')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch');
                    return res.json();
                })
                .then(data => {
                    window.teacherAssignmentsCache = data;
                    return data;
                })
                .finally(() => { window.teacherAssignmentsCachePromise = null; });
        }
        const data = await window.teacherAssignmentsCachePromise;
        renderTeacherAssignments(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p class="as-error-message">
                Error loading assignments.
            </p>`;
    }
};

function renderTeacherAssignments(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Store flat list for desktop panel lookup ──
    window._allAssignmentsFlat = data || [];

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state as-empty-state-inline">No assignments created yet.</p>`;
    } else {
        // Group by class_name for display, but keep each item's original
        // index into window._allAssignmentsFlat so selectDesktopAssignment(index)
        // and mobile-list logic (which use that flat array) keep working unchanged.
        const groupsByClass = new Map();
        data.forEach((assignment, index) => {
            const key = assignment.class_name || 'Other';
            if (!groupsByClass.has(key)) groupsByClass.set(key, []);
            groupsByClass.get(key).push({ assignment, index });
        });

        let classGroupIdx = 0;
        groupsByClass.forEach((entries, className) => {
            const classGroupId = `as-class-group-${classGroupIdx++}`;
            let itemsHtml = '';
            entries.forEach(({ assignment, index }) => {
                const subPercent = assignment.total_learners > 0
                    ? Math.round((assignment.submitted_count / assignment.total_learners) * 100)
                    : 0;
                const dotColor = subPercent === 100 ? '#22c55e'
                    : subPercent >= 50 ? '#f39c12' : '#4fd1c5';

                itemsHtml += `
                    <div class="as-sidebar-item" id="as-sidebar-${index}"
                        onclick="selectDesktopAssignment(${index})">
                        <div class="as-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                        </div>
                        <div class="as-sidebar-item-info">
                            <div class="as-sidebar-item-title">${assignment.title}</div>
                            <div class="as-sidebar-item-meta">${assignment.class_name} &middot; Due ${assignment.due_date}</div>
                        </div>
                        <span class="as-sidebar-status-dot" style="--as-dot-color:${dotColor};"></span>
                    </div>`;
            });
            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                'as-sidebar-class-label',
                className,
                itemsHtml
            );
        });
    }

    // ── Build full HTML ──
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="as-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="as-sidebar tchr-flat-sidebar">
                <div class="as-sidebar-header">
                    <span>Assignments</span>
                    <button class="teacher-upload-btn teacher-desktop-create as-new-btn" id="as-new-btn" onclick="openCreateAssignment()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="as-sidebar-scroll">${sidebarHtml}</div>
            </div>

            <!-- Right Main Panel -->
            <div class="as-main-panel tchr-flat-panel" id="as-main-panel">
                <div class="as-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select an assignment from the left to view it</p>
                </div>
            </div>

            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Assignments', `
                <p>The submissions table shows every learner in the class, even those who haven't submitted yet, so you can see who's still missing.</p>
                <p>Use <strong>Download Submissions</strong> to export all files for a single assignment in one go.</p>
            `) : ''}
        </div>

        <div id="deleteAssignmentModal" class="teacher-modal-overlay as-modal-hidden">
            <div class="teacher-modal-box as-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Assignment</span>
                    <button onclick="closeDeleteAssignmentModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="as-delete-modal-text">Are you sure you want to delete this assignment? Learner submissions for it will also be removed. This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteAssignmentModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteAssignment()" class="teacher-modal-submit as-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="as-mobile-list">`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No assignments created yet.</p>`;
    } else {
        data.forEach((assignment, index) => {
            const dueDate     = assignment.due_date;
            const subCount    = assignment.submitted_count;
            const totalCount  = assignment.total_learners;
            const subPercent  = totalCount > 0
                ? Math.round((subCount / totalCount) * 100)
                : 0;
            const progressColor = subPercent === 100
                ? '#22c55e'
                : subPercent >= 50
                ? '#f39c12'
                : '#4fd1c5';

            html += `
                <div class="teacher-assignment-card" id="acard-${index}">
                    <div class="teacher-assignment-main" onclick="toggleAssignmentSubmissions(${index})">
                        <div class="teacher-resource-icon">
                            <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <div class="teacher-resource-info">
                            <div class="teacher-resource-name">${assignment.title}</div>
                            <div class="teacher-resource-meta">
                                ${assignment.class_name} &middot; Due ${dueDate}
                            </div>
                            <div class="teacher-assignment-progress">
                                <div class="teacher-assignment-progress-bar">
                                    <div class="teacher-assignment-progress-fill"
                                        style="--as-progress-width:${subPercent}%;--as-progress-color:${progressColor};">
                                    </div>
                                </div>
                                <span class="teacher-assignment-progress-label" style="--as-progress-color:${progressColor};">
                                    ${subCount}/${totalCount} submitted
                                </span>
                            </div>
                        </div>
                        <div class="as-card-side-actions">
                            ${assignment.file_url ? `
                                <a href="${assignment.file_url}" target="_blank"
                                    onclick="event.stopPropagation()"
                                    class="teacher-assignment-file-link as-desktop-only-btn">
                                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                    </svg>
                                    Attachment
                                </a>` : ''}
                            <button class="teacher-assignment-download-btn as-desktop-only-btn"
                                onclick="event.stopPropagation(); downloadSubmissions(${assignment.id})">
                                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download All
                            </button>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                class="teacher-assignment-chevron as-chevron" id="achevron-${index}">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <div class="teacher-assignment-submissions as-submissions-collapsible" id="asubs-${index}">
                        <div class="teacher-assignment-desc">
                            ${assignment.description.replace(/\n/g, '<br>')}
                        </div>
                        <div class="teacher-grades-table-wrapper">
                            <table class="teacher-grades-table">
                                <thead>
                                    <tr>
                                        <th>Learner</th>
                                        <th>Status</th>
                                        <th>Type</th>
                                        <th>Submission</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            assignment.submissions.forEach(sub => {
                const statusBadge = sub.submitted
                    ? `<span class="teacher-sub-badge submitted">Submitted</span>
                       <div class="as-sub-timestamp">${sub.submitted_at}</div>`
                    : `<span class="teacher-sub-badge not-submitted">Not Submitted</span>`;

                let subContent = '—';
                if (sub.submitted) {
                    if (sub.submission_type === 'file' && sub.file_url) {
                        subContent = `<a href="${sub.file_url}" target="_blank" class="teacher-sub-file-link">View File</a>`;
                    } else if (sub.submission_type === 'text' && sub.text_answer) {
                        subContent = `
                            <div class="teacher-sub-text">
                                ${sub.text_answer.replace(/\n/g, '<br>')}
                            </div>`;
                    } else if (sub.submission_type === 'audio' && sub.audio_url) {
                        subContent = `
                            <audio controls class="as-sub-audio">
                                <source src="${sub.audio_url}" type="audio/mpeg">
                            </audio>`;
                    }
                }

                html += `
                    <tr>
                        <td>${sub.name}</td>
                        <td>${statusBadge}</td>
                        <td class="as-sub-type-cell">${sub.submission_type || '—'}</td>
                        <td>${subContent}</td>
                    </tr>`;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
        });
    }

    html += `</div>`; // close .as-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    if (typeof applyTeacherRailCollapsedState === 'function') applyTeacherRailCollapsedState();

    const sidebarScrollEl = apiArea.querySelector('.as-sidebar-scroll');
    window.wireTeacherSectionScroll('assignments-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('assignments-sidebar', sidebarScrollEl);

    // Restore whichever assignment was selected before navigating
    // away/refreshing. Re-derive its current array index from the
    // saved stable id rather than storing the index itself, since the
    // index can shift if assignments are added/removed/reordered.
    const savedId = window.teacherSectionState.selection.assignments;
    if (savedId) {
        const index = window._allAssignmentsFlat.findIndex(a => a.id == savedId);
        if (index !== -1) selectDesktopAssignment(index);
    }
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
window.selectDesktopAssignment = function(index) {
    // Update sidebar active state
    document.querySelectorAll('.as-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('as-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`as-sidebar-${index}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const assignment = (window._allAssignmentsFlat || [])[index];
    if (!assignment) return;

    window.teacherSectionState.selection.assignments = assignment.id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('as-main-panel');
    if (!panel) return;

    const subCount   = assignment.submitted_count;
    const totalCount = assignment.total_learners;
    const subPercent = totalCount > 0 ? Math.round((subCount / totalCount) * 100) : 0;
    const progressColor = subPercent === 100 ? '#22c55e'
        : subPercent >= 50 ? '#f39c12' : '#4fd1c5';

    // Build submissions table rows
    let tableRows = '';
    assignment.submissions.forEach(sub => {
        const statusBadge = sub.submitted
            ? `<span class="teacher-sub-badge submitted">Submitted</span>
               <div class="as-sub-timestamp">${sub.submitted_at}</div>`
            : `<span class="teacher-sub-badge not-submitted">Not Submitted</span>`;

        let subContent = '—';
        if (sub.submitted) {
            if (sub.submission_type === 'file' && sub.file_url) {
                subContent = `<a href="${sub.file_url}" target="_blank" class="teacher-sub-file-link">View File</a>`;
            } else if (sub.submission_type === 'text' && sub.text_answer) {
                subContent = `<div class="teacher-sub-text">${sub.text_answer.replace(/\n/g, '<br>')}</div>`;
            } else if (sub.submission_type === 'audio' && sub.audio_url) {
                subContent = `<audio controls class="as-sub-audio as-sub-audio--panel"><source src="${sub.audio_url}" type="audio/mpeg"></audio>`;
            }
        }

        tableRows += `
            <tr>
                <td>${sub.name}</td>
                <td>${statusBadge}</td>
                <td class="as-sub-type-cell">${sub.submission_type || '—'}</td>
                <td>${subContent}</td>
            </tr>`;
    });

    panel.innerHTML = `
        <div class="as-panel-content">
            <div class="as-panel-header">
                <div>
                    <div class="as-panel-title">${assignment.title}</div>
                    <div class="as-panel-meta">
                        <span>${assignment.class_name}</span>
                        <span>&bull;</span>
                        <span>Due ${assignment.due_date}</span>
                    </div>
                </div>
                <div class="as-panel-actions">
                    ${assignment.file_url ? `
                        <a href="${assignment.file_url}" target="_blank" class="teacher-assignment-file-link">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                            Attachment
                        </a>` : ''}
                    <button class="teacher-assignment-download-btn"
                        onclick="downloadSubmissions(${assignment.id})">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download All
                    </button>
                    <button class="as-panel-delete-btn" onclick="confirmDeleteAssignment(${assignment.id})">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>

            <!-- Progress -->
            <div class="as-panel-progress-row">
                <div class="as-panel-progress-bar">
                    <div class="as-panel-progress-fill"
                        style="--as-progress-width:${subPercent}%;--as-progress-color:${progressColor};"></div>
                </div>
                <span class="as-panel-progress-label" style="--as-progress-color:${progressColor};">
                    ${subCount}/${totalCount} submitted
                </span>
            </div>

            <!-- Description -->
            <div class="as-panel-desc">
                ${assignment.description.replace(/\n/g, '<br>')}
            </div>

            <!-- Submissions Table -->
            <div class="teacher-grades-table-wrapper">
                <table class="teacher-grades-table">
                    <thead>
                        <tr>
                            <th>Learner</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Submission</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>`;
};

// ─────────────────────────────────────────────
// TOGGLE SUBMISSIONS (mobile)
// ─────────────────────────────────────────────
window.toggleAssignmentSubmissions = function(index) {
    const subs    = document.getElementById(`asubs-${index}`);
    const chevron = document.getElementById(`achevron-${index}`);
    const isOpen  = subs.style.display === 'block';
    subs.style.display      = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// DOWNLOAD SUBMISSIONS
// ─────────────────────────────────────────────
window.downloadSubmissions = function(assignmentId) {
    window.open(`download_submissions.php?assignment_id=${assignmentId}`, '_blank');
};

// ─────────────────────────────────────────────
// CREATE ASSIGNMENT VIEW
// ─────────────────────────────────────────────
window.openCreateAssignment = async function() {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    const panel   = document.getElementById('as-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;

    // Target: panel on desktop, full apiArea on mobile
    const target = isDesktop ? panel : apiArea;
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Loading...')
        : null;

    if (!hideInitialLoader && loader) loader.style.display = 'flex';

    try {
        const [classRes, termRes] = await Promise.all([
            fetch('api/teacher/get_classes.php'),
            fetch('api/teacher/get_quizzes.php')
        ]);
        const classes  = await classRes.json();
        const quizData = await termRes.json();
        const currentTerm = quizData.current_term || 1;

        // Clear sidebar active state on desktop
        if (isDesktop) {
            document.querySelectorAll('.as-sidebar-item').forEach(el => el.classList.remove('active'));
            const newBtn = document.getElementById('as-new-btn');
            if (newBtn) newBtn.classList.add('active');
        }

        const backFn = isDesktop ? `selectDesktopAssignment(window._lastSelectedAssignmentIdx)` : `fetchTeacherAssignments()`;

        target.innerHTML = `
            <div class="as-form-wrap ${isDesktop ? 'as-form-wrap--desktop' : 'as-form-wrap--mobile'}">
                <div class="as-form-header ${isDesktop ? 'as-form-header--desktop' : ''}">
                    <h2 class="as-form-title ${isDesktop ? 'as-form-title--desktop' : ''}">
                        Create New Assignment
                    </h2>
                    ${isDesktop ? `
                        <button onclick="fetchTeacherAssignments()" class="as-form-close-btn">&times;</button>
                    ` : ''}
                </div>

                <form id="createAssignmentForm" enctype="multipart/form-data">

                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" name="title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 5 Essay" required>

                    <label class="teacher-modal-label">Description *</label>
                    <textarea name="description" class="teacher-modal-input as-form-textarea" rows="4"
                        placeholder="Describe the assignment..." required></textarea>

                    <label class="teacher-modal-label">Due Date *</label>
                    <input type="datetime-local" name="due_date" class="teacher-modal-input" required>

                    <label class="teacher-modal-label">Assign to Class *</label>
                    <div id="assignmentClassPicker"></div>

                    <div class="as-term-banner">
                        <div class="as-term-banner-title">
                            Posting to: TERM ${currentTerm}
                        </div>
                        <div class="as-term-banner-subtitle">
                            This assignment belongs to the current active term.
                        </div>
                    </div>

                    <label class="teacher-modal-label">Attachment (optional)</label>
                    <input type="file" name="attachment" class="as-file-input">

                    <label class="as-email-checkbox-label">
                        <input type="checkbox" name="force_email" value="1" class="as-email-checkbox">
                        <span>Learners automatically get mobile notifications. Tick this box to also send email notifications.</span>
                    </label>

                    <div id="caError" class="as-form-error"></div>

                    <div class="as-form-actions">
                        <button type="button" onclick="fetchTeacherAssignments()"
                            class="teacher-modal-cancel as-form-cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" class="teacher-modal-submit as-form-submit-btn"
                            id="caSubmitBtn">
                            Create Assignment
                        </button>
                    </div>

                </form>
            </div>`;

        // Init class picker
        window.renderClassPicker('assignmentClassPicker', classes, function() {});

        // Handle submit
        const form = document.getElementById('createAssignmentForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv  = document.getElementById('caError');
            const submitBtn = document.getElementById('caSubmitBtn');
            errorDiv.style.display = 'none';

            const fd = new FormData(form);
            const classId = window.getClassPickerValue('assignmentClassPicker');
            if (!classId) {
                errorDiv.textContent = 'Please select a class.';
                errorDiv.style.display = 'block';
                return;
            }
            fd.set('class_id', classId);
            const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);
            try {
                const res  = await fetch('api/teacher/create_assignment.php', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': getCsrfToken() },
                    body: fd
                });
                const data = await res.json();

                if (data.success) {
                    window.teacherAssignmentsCache = null;
                    fetchTeacherAssignments();
                } else {
                    errorDiv.textContent = data.error || 'Failed to create assignment.';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Something went wrong. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                hideSubmitLoader();
            }
        });

    } catch (e) {
        console.error(e);
        target.innerHTML = `
            <p class="as-error-message">
                Error loading create assignment form.
            </p>`;
    } finally {
        if (hideInitialLoader) hideInitialLoader();
        else if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// DELETE ASSIGNMENT (desktop)
// ─────────────────────────────────────────────
let assignmentToDelete = null;

window.confirmDeleteAssignment = function(id) {
    assignmentToDelete = id;
    const modal = document.getElementById('deleteAssignmentModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteAssignmentModal = function() {
    assignmentToDelete = null;
    const modal = document.getElementById('deleteAssignmentModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteAssignment = async function() {
    if (!assignmentToDelete) return;
    const idToDelete = assignmentToDelete;
    const deleteButton = document.querySelector('#deleteAssignmentModal .as-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteAssignmentModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_assignment.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherAssignmentsCache = null;
            fetchTeacherAssignments();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};