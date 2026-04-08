/* assets/js/assignments.js */
window.learnerAssignmentCache = null;

window.fetchAssignments = async function() {
    // 1. Clear any existing timers
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 2. Set the UI State
    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (typeof window.setActive === 'function') window.setActive("assignment_list.php");

    // 3. Elements
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 4. Update Header (Safely)
    if (window.configureHeader) {
        window.configureHeader({ title: 'Assignments', mode: 'standard' });
    }

    // 5. Immediate UI Swap
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 6. CACHE LOGIC: Ensure loader hides here too!
    if (window.learnerAssignmentCache) {
        renderAssignmentCards(window.learnerAssignmentCache);
        if (loader) loader.style.display = 'none'; // Critical: Stop loader for cached data
        return; 
    }

    // 7. FETCH LOGIC
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_assignments.php');
        if (!response.ok) throw new Error('Failed to fetch assignments');
        
        const groupedData = await response.json();
        window.learnerAssignmentCache = groupedData;
        renderAssignmentCards(groupedData);
    } catch (error) {
        console.error("Assignment Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load assignments.</p>
                    <button onclick="window.learnerAssignmentCache=null; window.fetchAssignments()" 
                            class="quiz-start-btn">Try Again</button>
                </div>`;
        }
    } finally {
        // 8. ALWAYS hide the loader, even if it fails
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderAssignmentCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No assignments found.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerAssignmentsFlat = [];
    for (const [teacher, tasks] of Object.entries(groupedData)) {
        tasks.forEach(task => {
            window._allLearnerAssignmentsFlat.push({ ...task, teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    for (const [teacher, tasks] of Object.entries(groupedData)) {
        sidebarHtml += `<div class="las-sidebar-teacher-label">${teacher}</div>`;
        tasks.forEach(task => {
            const isDone = !!task.submission_file;
            const dotColor = task.is_past_due ? '#6b7280'
                : isDone ? '#4fd1c5' : '#e67e22';

            sidebarHtml += `
                <div class="las-sidebar-item" id="las-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerAssignment(${flatIdx})">
                    <div class="las-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="las-sidebar-item-info">
                        <div class="las-sidebar-item-title">${task.title}</div>
                        <div class="las-sidebar-item-meta">${task.class_name} &middot; Due ${task.due_date}</div>
                    </div>
                    <span class="las-sidebar-status-dot" style="background:${dotColor};"></span>
                </div>`;
            flatIdx++;
        });
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .las-desktop-layout { display: flex !important; }
                .las-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .las-desktop-layout { display: none !important; }
                .las-mobile-list    { display: block !important; }
            }

            .las-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .las-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .las-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .las-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .las-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .las-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .las-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .las-sidebar-teacher-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .las-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .las-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .las-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .las-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .las-sidebar-item-info { flex: 1; min-width: 0; }
            .las-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .las-sidebar-item.active .las-sidebar-item-title { color: #e2e8f0; }
            .las-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .las-sidebar-status-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .las-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .las-main-panel::-webkit-scrollbar { width: 5px; }
            .las-main-panel::-webkit-scrollbar-track { background: transparent; }
            .las-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .las-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .las-panel-empty svg { opacity: 0.3; }
            .las-panel-empty p { font-size: 14px; margin: 0; }

            .las-panel-content { padding: 28px 32px; }

            .las-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .las-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 8px;
            }
            .las-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .las-panel-desc {
                font-size: 13px;
                color: #c9d1d9;
                line-height: 1.7;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 16px 18px;
                margin-bottom: 20px;
            }
            .las-panel-links {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                margin-bottom: 24px;
            }

            /* ── MOBILE LIST STYLES ── */
            .las-mobile-list {
                background: #1a1919;
                border-radius: 12px;
                overflow: hidden;
                margin: 8px 0 16px;
            }
            .las-mobile-teacher-header {
                padding: 16px 16px 6px;
                font-size: 11px;
                font-weight: 600;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: #1a1919;
            }
            .las-mobile-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 16px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .las-mobile-row:last-child { border-bottom: none; }
            .las-mobile-row-icon { flex-shrink: 0; opacity: 0.75; }
            .las-mobile-row-body { flex: 1; min-width: 0; }
            .las-mobile-row-title {
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;
                margin: 0 0 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .las-mobile-row-meta {
                font-size: 12px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .las-mobile-row-action {
                flex-shrink: 0;
                font-size: 13px;
                font-weight: 600;
                text-decoration: none;
            }
            .las-mobile-row-desc {
                font-size: 13px;
                color: #6b7280;
                margin: 6px 0 0;
                line-height: 1.5;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .las-mobile-attachment {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: #4fd1c5;
                text-decoration: none;
                margin-top: 6px;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="las-desktop-layout">
            <div class="las-sidebar">
                <div class="las-sidebar-header">All Assignments</div>
                <div class="las-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="las-main-panel" id="las-main-panel">
                <div class="las-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select an assignment from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="las-mobile-list">`;

    for (const [teacher, tasks] of Object.entries(groupedData)) {
        html += `<div class="las-mobile-teacher-header">${teacher}</div>`;

        tasks.forEach(task => {
            const isDone = !!task.submission_file;
            const actionColor = task.is_past_due ? '#6b7280' : (isDone ? '#4fd1c5' : '#e67e22');
            const actionLabel = task.is_past_due ? 'Locked' : (isDone ? 'Update' : 'Submit');
            const actionHref = task.is_past_due
                ? `javascript:void(0)`
                : `submit_assignment.php?assignment_id=${task.id}`;

            const statusDotColor = task.is_past_due ? '#6b7280' : (isDone ? '#22c55e' : '#e67e22');

            html += `
                <div class="las-mobile-row" style="${task.is_past_due ? 'opacity:0.65;' : ''}">
                    <div class="las-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="las-mobile-row-body">
                        <div class="las-mobile-row-title">${task.title}</div>
                        <div class="las-mobile-row-meta">
                            <span>${task.class_name}</span>
                            <span style="color:#333;">&bull;</span>
                            <span>Due ${task.due_date}</span>
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusDotColor}; flex-shrink:0;"></span>
                        </div>
                        ${task.description ? `<div class="las-mobile-row-desc">${task.description}</div>` : ''}
                        ${task.teacher_file ? `
                            <a class="las-mobile-attachment" href="javascript:void(0)"
                               onclick="viewDocument('${task.teacher_file}', 'Teacher Attachment: ${task.title.replace(/'/g, "\\'")}')">
                                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                Attachment
                            </a>` : ''}
                    </div>
                    <a class="las-mobile-row-action" href="${actionHref}" style="color:${actionColor};">
                        ${actionLabel}
                    </a>
                </div>`;
        });
    }

    html += `</div>`; // close .las-mobile-list

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
window.selectDesktopLearnerAssignment = function(flatIdx) {
    document.querySelectorAll('.las-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`las-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const task = (window._allLearnerAssignmentsFlat || [])[flatIdx];
    if (!task) return;

    const panel = document.getElementById('las-main-panel');
    if (!panel) return;

    const isDone = !!task.submission_file;
    const statusColor = task.is_past_due ? '#f85149' : (isDone ? '#4fd1c5' : '#888');
    const statusSVG = task.is_past_due
        ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${statusColor}" stroke-width="2" fill="none" style="vertical-align:middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
        : (isDone
            ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${statusColor}" stroke-width="2.5" fill="none" style="vertical-align:middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${statusColor}" stroke-width="2" fill="none" style="vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`);

    const submitAction = task.is_past_due
        ? `<span style="color:#8b949e; font-weight:700; font-size:14px;">Locked</span>`
        : `<a href="submit_assignment.php?assignment_id=${task.id}"
              style="background:rgba(${isDone ? '79,209,197' : '230,126,34'},0.1);border:1px solid rgba(${isDone ? '79,209,197' : '230,126,34'},0.4);color:${isDone ? '#4fd1c5' : '#e67e22'};padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;display:inline-block;">
              ${isDone ? 'Update Submission' : 'Submit Assignment'}
           </a>`;

    panel.innerHTML = `
        <div class="las-panel-content">
            <div class="las-panel-header">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    ${statusSVG}
                    <div class="las-panel-title">${task.title}</div>
                </div>
                <div class="las-panel-meta">
                    <span>${task.teacher}</span>
                    <span>&bull;</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;"><path d="M2 3h20v14H2z"></path><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>
                    <span>${task.class_name}</span>
                    <span>&bull;</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Due: ${task.due_date}</span>
                </div>
            </div>

            <div class="las-panel-desc">
                ${task.description ? task.description.replace(/\n/g, '<br>') : 'No description provided.'}
            </div>

            <div class="las-panel-links">
                ${task.teacher_file ? `
                    <a href="javascript:void(0)"
                        onclick="viewDocument('${task.teacher_file}', 'Teacher Attachment: ${task.title.replace(/'/g, "\\'")}')"
                        style="color:#4fd1c5;font-size:13px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4fd1c5" stroke-width="2" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Teacher Attachment
                    </a>` : ''}
                ${task.submission_file ? `
                    <a href="javascript:void(0)"
                        onclick="viewDocument('${task.submission_file}', 'My Submission: ${task.title.replace(/'/g, "\\'")}')"
                        style="color:#4fd1c5;font-size:13px;text-decoration:none;display:flex;align-items:center;gap:6px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4fd1c5" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View My Work
                    </a>` : ''}
            </div>

            ${submitAction}
        </div>`;
};