function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherAssignmentsCache = null;
window.teacherAssignmentsCachePromise = null;

// ─────────────────────────────────────────────
// ASSIGNMENTS LIST
// ─────────────────────────────────────────────
window.fetchTeacherAssignments = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_assignments");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_assignments");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAssignmentsCache) {
        renderTeacherAssignments(window.teacherAssignmentsCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

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
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading assignments.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
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
        sidebarHtml = `<p class="teacher-empty-state" style="padding:16px;font-size:13px;">No assignments created yet.</p>`;
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
                        <span class="as-sidebar-status-dot" style="background:${dotColor};"></span>
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
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .as-desktop-layout { display: flex !important; }
                .as-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .as-desktop-layout { display: none !important; }
                .as-mobile-list    { display: block !important; }
            }

            .as-desktop-layout {
                display: flex;
                gap: 0;
                min-height: 500px;
            }

            /* Left sidebar */
            .as-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .as-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .as-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .as-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .as-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .as-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .as-sidebar-class-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .as-sidebar-class-label.tchr-sidebar-class-label--toggle {
                padding-top: 8px;
                padding-bottom: 6px;
            }

            .as-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .as-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .as-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .as-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .as-sidebar-item-info { flex: 1; min-width: 0; }
            .as-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .as-sidebar-item.active .as-sidebar-item-title { color: #e2e8f0; }
            .as-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .as-sidebar-status-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            /* Right panel */
            .as-main-panel {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .as-main-panel::-webkit-scrollbar { width: 5px; }
            .as-main-panel::-webkit-scrollbar-track { background: transparent; }
            .as-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .as-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .as-panel-empty svg { opacity: 0.3; }
            .as-panel-empty p { font-size: 14px; margin: 0; }

            .as-panel-content { padding: 28px 32px; }

            .as-panel-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-wrap: wrap;
            }
            .as-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 6px;
            }
            .as-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .as-panel-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
                flex-wrap: wrap;
            }
            .as-panel-desc {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 16px 18px;
                font-size: 13px;
                color: #c9d1d9;
                line-height: 1.7;
                margin-bottom: 20px;
            }
            .as-panel-progress-row {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 14px 18px;
            }
            .as-panel-progress-bar {
                flex: 1;
                height: 6px;
                background: rgba(255,255,255,0.08);
                border-radius: 4px;
                overflow: hidden;
            }
            .as-panel-progress-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.4s ease;
            }
            .as-panel-progress-label {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
            }
            @media (max-width: 899px) {
                .as-desktop-only-btn { display: none !important; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="as-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="as-sidebar tchr-flat-sidebar">
                <div class="as-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Assignments</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openCreateAssignment()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
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
                                        style="width:${subPercent}%;background:${progressColor};">
                                    </div>
                                </div>
                                <span class="teacher-assignment-progress-label" style="color:${progressColor};">
                                    ${subCount}/${totalCount} submitted
                                </span>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
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
                                class="teacher-assignment-chevron" id="achevron-${index}"
                                style="transition:transform 0.3s ease;">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <div class="teacher-assignment-submissions" id="asubs-${index}" style="display:none;">
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
                       <div style="font-size:11px;color:#8b949e;margin-top:3px;">${sub.submitted_at}</div>`
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
                            <audio controls style="max-width:200px;height:32px;">
                                <source src="${sub.audio_url}" type="audio/mpeg">
                            </audio>`;
                    }
                }

                html += `
                    <tr>
                        <td>${sub.name}</td>
                        <td>${statusBadge}</td>
                        <td style="color:#8b949e;font-size:13px;">${sub.submission_type || '—'}</td>
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
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
window.selectDesktopAssignment = function(index) {
    // Update sidebar active state
    document.querySelectorAll('.as-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`as-sidebar-${index}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const assignment = (window._allAssignmentsFlat || [])[index];
    if (!assignment) return;

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
               <div style="font-size:11px;color:#8b949e;margin-top:3px;">${sub.submitted_at}</div>`
            : `<span class="teacher-sub-badge not-submitted">Not Submitted</span>`;

        let subContent = '—';
        if (sub.submitted) {
            if (sub.submission_type === 'file' && sub.file_url) {
                subContent = `<a href="${sub.file_url}" target="_blank" class="teacher-sub-file-link">View File</a>`;
            } else if (sub.submission_type === 'text' && sub.text_answer) {
                subContent = `<div class="teacher-sub-text">${sub.text_answer.replace(/\n/g, '<br>')}</div>`;
            } else if (sub.submission_type === 'audio' && sub.audio_url) {
                subContent = `<audio controls style="max-width:180px;height:32px;"><source src="${sub.audio_url}" type="audio/mpeg"></audio>`;
            }
        }

        tableRows += `
            <tr>
                <td>${sub.name}</td>
                <td>${statusBadge}</td>
                <td style="color:#8b949e;font-size:13px;">${sub.submission_type || '—'}</td>
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
                </div>
            </div>

            <!-- Progress -->
            <div class="as-panel-progress-row">
                <div class="as-panel-progress-bar">
                    <div class="as-panel-progress-fill"
                        style="width:${subPercent}%;background:${progressColor};"></div>
                </div>
                <span class="as-panel-progress-label" style="color:${progressColor};">
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
        }

        const backFn    = isDesktop ? `selectDesktopAssignment(window._lastSelectedAssignmentIdx)` : `fetchTeacherAssignments()`;
        const headerPad = isDesktop ? 'padding:20px 32px 0;' : '';
        const formPad   = isDesktop ? 'padding:0 32px 32px;' : '';

        target.innerHTML = `
            <div style="max-width:560px;margin:0 auto;${formPad}padding-top:${isDesktop ? '20px' : '0'};">
                <h2 style="color:#4fd1c5;font-size:${isDesktop ? '18px' : '22px'};margin:${isDesktop ? '0 0 20px' : '0 0 24px'};font-weight:800;">
                    Create New Assignment
                </h2>

                <form id="createAssignmentForm" enctype="multipart/form-data">

                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" name="title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 5 Essay" required>

                    <label class="teacher-modal-label">Description *</label>
                    <textarea name="description" class="teacher-modal-input" rows="4"
                        style="resize:vertical;" placeholder="Describe the assignment..." required></textarea>

                    <label class="teacher-modal-label">Due Date *</label>
                    <input type="datetime-local" name="due_date" class="teacher-modal-input" required>

                    <label class="teacher-modal-label">Assign to Class *</label>
                    <div id="assignmentClassPicker"></div>

                    <div style="background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.2);border-left:5px solid #4fd1c5;border-radius:10px;padding:14px;margin:16px 0;text-align:center;">
                        <div style="font-size:18px;font-weight:800;color:#4fd1c5;">
                            Posting to: TERM ${currentTerm}
                        </div>
                        <div style="font-size:12px;color:#8b949e;margin-top:4px;">
                            This assignment belongs to the current active term.
                        </div>
                    </div>

                    <label class="teacher-modal-label">Attachment (optional)</label>
                    <input type="file" name="attachment"
                        style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:8px 12px;box-sizing:border-box;font-size:13px;">

                    <label style="display:flex;align-items:flex-start;gap:10px;color:#c9d1d9;font-size:13px;cursor:pointer;background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.15);border-radius:10px;padding:12px;margin-top:16px;">
                        <input type="checkbox" name="force_email" value="1"
                            style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;margin-top:2px;flex-shrink:0;">
                        <span>Learners automatically get mobile notifications. Tick this box to also send email notifications.</span>
                    </label>

                    <div id="caError" style="color:#ff5555;font-size:14px;margin-top:12px;display:none;"></div>

                    <div style="display:flex;gap:12px;margin-top:20px;margin-bottom:32px;">
                        <button type="button" onclick="fetchTeacherAssignments()"
                            class="teacher-modal-cancel" style="flex:1;padding:13px;">
                            Cancel
                        </button>
                        <button type="submit" class="teacher-modal-submit"
                            id="caSubmitBtn" style="flex:2;padding:13px;font-size:14px;">
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
            submitBtn.disabled    = true;
            submitBtn.textContent = 'Creating...';
            const hideSubmitLoader = window.showTeacherScopedLoader
                ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Creating...')
                : null;
            if (!hideSubmitLoader && loader) loader.style.display = 'flex';
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
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Create Assignment';
                if (hideSubmitLoader) hideSubmitLoader();
                else if (loader) loader.style.display = 'none';
            }
        });

    } catch (e) {
        console.error(e);
        target.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading create assignment form.
            </p>`;
    } finally {
        if (hideInitialLoader) hideInitialLoader();
        else if (loader) loader.style.display = 'none';
    }
};
