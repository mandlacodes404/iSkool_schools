/* assets/js/assignments.js */
window.learnerAssignmentCache          = null;
window.learnerAssignmentPrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchAssignments = function () {
    if (window.learnerAssignmentCache) return;
    if (window.learnerAssignmentPrefetchPromise) return;
    window.learnerAssignmentPrefetchPromise = fetch('api/learner/get_assignments.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.learnerAssignmentCache = data; })
        .catch(() => {})
        .finally(() => { window.learnerAssignmentPrefetchPromise = null; });
};

function showLearnerAssignmentMobileBottomNav() {
    if (window.innerWidth > 899) return;

    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (mobileBottomNav) {
        mobileBottomNav.style.setProperty('display', 'flex', 'important');
    }
}

window.openLearnerAssignmentSubmission = function(event, href) {
    if (event) event.preventDefault();

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    if (apiArea) apiArea.style.display = 'none';
    if (iframe) {
        const keepNavVisible = function() {
            showLearnerAssignmentMobileBottomNav();
            iframe.removeEventListener('load', keepNavVisible);
        };
        iframe.addEventListener('load', keepNavVisible);
        iframe.style.display = 'block';
        iframe.src = href;
    }
    showLearnerAssignmentMobileBottomNav();
};

window.fetchAssignments = async function() {
    // 1. Clear any existing timers
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 2. Set the UI State
    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (typeof window.setActive === 'function') window.setActive("assignment_list.php");

    // 3. Elements
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 4. Update Header (Safely)
    if (window.configureHeader) {
        window.configureHeader({ title: 'Assignments', mode: 'standard', color: '#a78bfa' });
    }

    // 5. Immediate UI Swap
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 6a. If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.learnerAssignmentPrefetchPromise) {
        await window.learnerAssignmentPrefetchPromise;
    }

    // 6b. CACHE LOGIC
    if (window.learnerAssignmentCache) {
        renderAssignmentCards(window.learnerAssignmentCache);
        restoreAssignmentPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    // 7. FETCH LOGIC
    if (!window.suppressInitialLoader && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_assignments.php');
        if (!response.ok) throw new Error('Failed to fetch assignments');
        
        const groupedData = await response.json();
        window.learnerAssignmentCache = groupedData;
        renderAssignmentCards(groupedData);
        restoreAssignmentPageState();
    } catch (error) {
        console.error("Assignment Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div class="las-error-state">
                    <p>Unable to load assignments.</p>
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

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveAssignmentPageState() {
    const sidebar = document.querySelector('.las-sidebar-scroll');
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('las-main-panel');
    const selected = (window._allLearnerAssignmentsFlat || [])[window._learnerAssignmentSelectedIdx];
    const state = {
        // Keep the id, rather than only the rendered position. New work can
        // appear at the top of the list between visits, changing every index.
        selectedId:    selected ? String(selected.id) : null,
        selectedIdx:   window._learnerAssignmentSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   panel ? panel.scrollTop : 0,
        mobileSearch: document.getElementById('lasMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.las-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        openDesktopGroups: Array.from(document.querySelectorAll('.las-desktop-teacher-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('assignments', state);
    else sessionStorage.setItem('assignmentPageState', JSON.stringify(state));
}

function wireAssignmentScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.las-sidebar-scroll');
    const panel = document.getElementById('las-main-panel');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.lasScrollWired === '1') return;
        el.dataset.lasScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('assignments', saveAssignmentPageState), { passive: true });
    });
}

function restoreAssignmentPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('assignments')
            : JSON.parse(sessionStorage.getItem('assignmentPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            wireAssignmentScrollState();
            return;
        }
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lasMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lasMobileSearch(state.mobileSearch);
                }
            }
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.las-mobile-folder-body').forEach(body => {
                    const open = state.openFolders.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const chev = body.previousElementSibling?.querySelector('.las-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (Array.isArray(state.openDesktopGroups)) {
                document.querySelectorAll('.las-desktop-teacher-body').forEach(body => {
                    const open = state.openDesktopGroups.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const header = body.previousElementSibling;
                    const chevron = header ? header.querySelector('.las-desktop-teacher-chevron') : null;
                    if (chevron) chevron.classList.toggle('open', open);
                });
            }
            const selectedIdx = state.selectedId
                ? (window._allLearnerAssignmentsFlat || []).findIndex(task => String(task.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerAssignment(selectedIdx);
            }
            const sidebar = document.querySelector('.las-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panel = document.getElementById('las-main-panel');
            if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
            wireAssignmentScrollState();
            saveAssignmentPageState();
        });
    } catch (e) { /* ignore bad state */ }
}

function formatAssignmentDueDate(dueDateStr) {
    if (!dueDateStr || dueDateStr === 'No Due Date') return 'No Due Date';
    const date = new Date(dueDateStr.replace(/-/g, '/'));
    if (isNaN(date)) return dueDateStr;
    const day = date.getDate();
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `Due ${day} ${month}, ${hours}:${mins}`;
}

function parseLearnerAssignmentTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLearnerAssignmentTime(task) {
    return parseLearnerAssignmentTime(task.created_at || task.raw_created_at || task.due_date);
}

function getSortedLearnerAssignmentEntries(groupedData) {
    return Object.entries(groupedData || {})
        .map(([teacher, tasks], index) => {
            const sortedTasks = Array.isArray(tasks)
                ? [...tasks].sort((a, b) => getLearnerAssignmentTime(b) - getLearnerAssignmentTime(a))
                : [];
            const latestTime = sortedTasks.reduce((latest, task) => Math.max(latest, getLearnerAssignmentTime(task)), 0);
            return { teacher, tasks: sortedTasks, latestTime, index };
        })
        .sort((a, b) => (b.latestTime - a.latestTime) || (a.index - b.index));
}

function renderAssignmentCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p class='las-empty-state'>No assignments found.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    const teacherEntries = getSortedLearnerAssignmentEntries(groupedData);

    window._allLearnerAssignmentsFlat = [];
    for (const { teacher, tasks } of teacherEntries) {
        tasks.forEach(task => {
            window._allLearnerAssignmentsFlat.push({ ...task, teacher, initials: task.teacher_initials || null });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    let desktopGroupIdx = 0;
    for (const { teacher, tasks } of teacherEntries) {
        const groupId = `las-dg-${desktopGroupIdx++}`;
        sidebarHtml += `
            <div class="las-desktop-teacher-group">
                <button type="button" class="las-desktop-teacher-header" onclick="toggleLasDesktopGroup('${groupId}', this)">
                    <svg class="las-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="las-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="las-desktop-teacher-name">${escapeLearnerAssignmentHtml(teacher)}</span>
                    <span class="las-desktop-teacher-count">${tasks.length}</span>
                </button>
                <div class="las-desktop-teacher-body collapsed" id="${groupId}">`;
        tasks.forEach(task => {
            const isDone = !!task.submission_file;
            const dotClass = task.is_past_due ? 'las-sidebar-status-dot--past-due'
                : isDone ? 'las-sidebar-status-dot--done' : 'las-sidebar-status-dot--pending';

            sidebarHtml += `
                <div class="las-sidebar-item" id="las-sidebar-${flatIdx}"
                    data-title="${escapeLearnerAssignmentHtml(task.title || '').toLowerCase()}"
                    onclick="selectDesktopLearnerAssignment(${flatIdx})">
                    <div class="las-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#a78bfa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="las-sidebar-item-info">
                        <div class="las-sidebar-item-title">${task.title}</div>
                        <div class="las-sidebar-item-meta">${task.class_name} &middot; Due ${task.due_date}</div>
                    </div>
                    <span class="las-sidebar-status-dot ${dotClass}"></span>
                </div>`;
            flatIdx++;
        });
        sidebarHtml += `</div></div>`;
    }

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/assignments.css
    // — the inline <style> block that used to be injected here was removed
    // as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="las-desktop-layout lqz-flat-layout">
            <div class="las-sidebar lqz-flat-sidebar">
                <div class="las-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="las-desktop-search" id="lasDesktopSearch"
                        placeholder="Search assignments..." oninput="lasDesktopSearch(this.value)">
                </div>
                <div class="las-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="las-main-panel lqz-flat-panel" id="las-main-panel">
                <div class="las-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#a78bfa" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select an assignment from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    if (teacherEntries.length > 0) {
        html += `
        <div class="las-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="las-mobile-search" id="lasMobileSearch"
                placeholder="Search assignments..." oninput="lasMobileSearch(this.value)">
        </div>`;
    }

    html += `<div class="las-mobile-list">`;

    let mobileFlatIdx = 0;

    let mobileGroupIdx = 0;
    for (const { teacher, tasks } of teacherEntries) {
        const gid = `las-mg-${mobileGroupIdx}`;
        html += `
            <div class="las-mobile-folder-header" onclick="toggleLasMobileFolder('${gid}', this)">
                <div class="las-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#a78bfa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="las-mobile-folder-name">${escapeLearnerAssignmentHtml(teacher)}</span>
                <span class="las-mobile-folder-count">${tasks.length} assignment${tasks.length !== 1 ? 's' : ''}</span>
                <svg class="las-mobile-folder-chevron las-icon-crisp" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="las-mobile-folder-body collapsed" id="${gid}">`;
        mobileGroupIdx++;

        tasks.forEach(task => {
            const isDone = !!task.submission_file;
            const metaClass = task.is_past_due ? 'las-mobile-row-meta--past-due'
                : isDone ? 'las-mobile-row-meta--done' : 'las-mobile-row-meta--pending';

            html += `
                <div class="las-mobile-row${task.is_past_due ? ' las-mobile-row--past-due' : ''}" role="button" tabindex="0"
                    data-title="${escapeLearnerAssignmentHtml(task.title||''). toLowerCase()}"
                    onclick="openMobileLearnerAssignment(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAssignment(${mobileFlatIdx}); }">
                    <div class="las-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#a78bfa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                            <rect x="4" y="3" width="11" height="18" rx="1.5"></rect>
                            <rect x="7" y="6.3" width="5" height="3" rx="0.6"></rect>
                            <line x1="7" y1="13" x2="11" y2="13"></line>
                            <line x1="7" y1="16" x2="10" y2="16"></line>
                            <path d="M20.6283 13.1654A1.2685 1.2685 0 0 0 18.8346 11.3713L12.8289 17.3783A0.9 0.9 0 0 0 12.6039 17.7518L12.0095 19.7102A0.225 0.225 0 0 0 12.2898 19.9901L14.2487 19.3961A0.9 0.9 0 0 0 14.6222 19.1725Z"></path>
                            <path d="M17.85 12.35L19.65 14.15"></path>
                        </svg>
                    </div>
                    <div class="las-mobile-row-body">
                        <div class="las-mobile-row-title">
                            <span class="las-mobile-row-title-text">${escapeLearnerAssignmentHtml(task.title || 'Assignment')}</span>
                        </div>
                        <div class="las-mobile-row-meta ${metaClass}">
                            ${formatAssignmentDueDate(task.due_date)}
                        </div>
                    </div>
                    <div class="las-mobile-row-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
            mobileFlatIdx++;
        });
        html += `</div>`; // close .las-mobile-folder-body
    }

    html += `</div>`; // close .las-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
}

window.lasDesktopSearch = function(val) {
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.las-desktop-teacher-group').forEach(group => {
        const header = group.querySelector('.las-desktop-teacher-header');
        const body   = group.querySelector('.las-desktop-teacher-body');
        const nameEl = group.querySelector('.las-desktop-teacher-name');
        const groupName = nameEl ? nameEl.textContent.toLowerCase() : '';
        if (!header || !body) return;

        const items = body.querySelectorAll('.las-sidebar-item');
        let visible = 0;
        items.forEach(item => {
            const title = (item.dataset.title || '');
            const show = !term || title.includes(term) || groupName.includes(term);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        const groupShow = visible > 0 || !term || groupName.includes(term);
        group.style.display = groupShow ? '' : 'none';

        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header.querySelector('.las-desktop-teacher-chevron');
            if (chev) chev.classList.add('open');
        } else if (!term) {
            body.classList.add('collapsed');
            const chev = header.querySelector('.las-desktop-teacher-chevron');
            if (chev) chev.classList.remove('open');
        }
    });
};

window.toggleLasMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.las-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveAssignmentPageState();
};

window.toggleLasDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.las-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveAssignmentPageState();
};

window.lasMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('assignments', { mobileSearch: val });
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.las-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const folderName = header ? header.querySelector('.las-mobile-folder-name').textContent.toLowerCase() : '';
        const rows = body.querySelectorAll('.las-mobile-row');
        let visible = 0;
        rows.forEach(row => {
            const title = (row.dataset.title || '');
            const show = !term || title.includes(term) || folderName.includes(term);
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (header) header.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        body.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header ? header.querySelector('.las-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });
};

function escapeLearnerAssignmentHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function escapeLearnerAssignmentJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function getLearnerAssignmentInitials(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatLearnerAssignmentPostedDate(rawDate) {
    const d = new Date(String(rawDate).replace(/-/g, '/'));
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} at ${hours}:${mins}`;
}

window.openMobileLearnerAssignment = function(flatIdx) {
    if (window.innerWidth > 899) return;

    const task = (window._allLearnerAssignmentsFlat || [])[flatIdx];
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');

    if (!task || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');

    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (window.configureHeader) {
        window.configureHeader({ title: 'Submission', mode: 'detail' });
    }
    showLearnerAssignmentMobileBottomNav();

    const isDone = !!task.submission_file;
    const statusDotClass = task.is_past_due ? 'las-status-dot--past-due'
        : isDone ? 'las-status-dot--done' : 'las-status-dot--pending';
    const statusLabel = task.is_past_due ? 'Locked' : (isDone ? 'Submitted' : 'Not Submitted');
    const actionLabel = task.is_past_due ? 'Submission Closed' : (isDone ? 'Update Submission' : 'Submit Assignment');
    const actionHref = `submit_assignment.php?assignment_id=${encodeURIComponent(task.id)}`;

    const sender = task.teacher || 'Teacher';
    const initials = task.initials || getLearnerAssignmentInitials(sender);

    apiArea.innerHTML = `
        <article class="las-mobile-detail">
            <div class="las-mobile-detail-author-row">
                <div class="las-mobile-detail-avatar">${escapeLearnerAssignmentHtml(initials)}</div>
                <div class="las-mobile-detail-author-info">
                    <div class="las-mobile-detail-author-name">${escapeLearnerAssignmentHtml(sender)}</div>
                    <div class="las-mobile-detail-author-role">
                        <span>Author</span><span class="las-mobile-detail-role-sep">|</span><span class="las-mobile-detail-role-badge">Teacher</span>
                    </div>
                    <div class="las-mobile-detail-posted">Posted ${escapeLearnerAssignmentHtml(task.created_at ? formatLearnerAssignmentPostedDate(task.created_at) : '')}</div>
                </div>
            </div>
            <div class="las-mobile-detail-status">
                <span class="las-mobile-row-status-dot ${statusDotClass}"></span>
                ${statusLabel}
            </div>
            <h1 class="las-mobile-detail-title">${escapeLearnerAssignmentHtml(task.title || 'Assignment')}</h1>
            <div class="las-mobile-detail-meta">
                Due ${escapeLearnerAssignmentHtml(task.due_date || 'No Due Date')}
            </div>
            <div class="las-mobile-detail-desc">
                ${task.description ? escapeLearnerAssignmentHtml(task.description).replace(/\n/g, '<br>') : 'No description provided.'}
            </div>
            <div class="las-mobile-detail-links">
                ${task.teacher_file ? `
                    <a class="las-mobile-detail-link" href="javascript:void(0)"
                       onclick="viewDocument('${escapeLearnerAssignmentJsString(task.teacher_file)}', 'Teacher Attachment: ${escapeLearnerAssignmentJsString(task.title)}')">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Teacher Attachment
                    </a>` : ''}
                ${task.submission_file ? `
                    <a class="las-mobile-detail-link" href="javascript:void(0)"
                       onclick="viewDocument('${escapeLearnerAssignmentJsString(task.submission_file)}', 'My Submission: ${escapeLearnerAssignmentJsString(task.title)}')">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View My Work
                    </a>` : ''}
            </div>
            ${task.is_past_due
                ? `<span class="las-mobile-detail-action las-mobile-detail-action--locked">${actionLabel}</span>`
                : `<a class="las-mobile-detail-action" href="${actionHref}" target="mainFrame" onclick="openLearnerAssignmentSubmission(event, '${actionHref}')">${actionLabel}</a>`}
        </article>`;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
};

window.openMobileLearnerAssignmentById = function(assignmentId) {
    const targetId = String(assignmentId || '');
    const flatIdx = (window._allLearnerAssignmentsFlat || []).findIndex(task => String(task.id) === targetId);
    if (flatIdx >= 0) {
        window.openMobileLearnerAssignment(flatIdx);
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
window.selectDesktopLearnerAssignment = function(flatIdx) {
    window._learnerAssignmentSelectedIdx = flatIdx;
    saveAssignmentPageState();
    document.querySelectorAll('.las-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`las-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const task = (window._allLearnerAssignmentsFlat || [])[flatIdx];
    if (!task) return;

    const panel = document.getElementById('las-main-panel');
    if (!panel) return;

    const isDone = !!task.submission_file;
    const statusDotClass = task.is_past_due ? 'las-status-dot--past-due'
        : isDone ? 'las-status-dot--done' : 'las-status-dot--pending';
    const statusLabel = task.is_past_due ? 'Locked' : (isDone ? 'Submitted' : 'Not Submitted');
    const actionLabel = task.is_past_due ? 'Submission Closed' : (isDone ? 'Update Submission' : 'Submit Assignment');
    const actionHref = `submit_assignment.php?assignment_id=${encodeURIComponent(task.id)}`;

    const sender = task.teacher || 'Teacher';
    const initials = task.initials || getLearnerAssignmentInitials(sender);

    panel.innerHTML = `
        <div class="las-panel-content">
            <div class="las-panel-header">
                <div class="las-panel-author-row">
                    <div class="las-panel-avatar">${escapeLearnerAssignmentHtml(initials)}</div>
                    <div class="las-panel-author-info">
                        <div class="las-panel-author-name">${escapeLearnerAssignmentHtml(sender)}</div>
                        <div class="las-panel-author-role">
                            <span>Author</span><span class="las-panel-role-sep">|</span><span class="las-panel-role-badge">Teacher</span>
                        </div>
                        <div class="las-panel-posted">Posted ${escapeLearnerAssignmentHtml(task.created_at ? formatLearnerAssignmentPostedDate(task.created_at) : '')}</div>
                    </div>
                </div>
                <div class="las-panel-status">
                    <span class="las-panel-status-dot ${statusDotClass}"></span>
                    ${statusLabel}
                </div>
                <div class="las-panel-title">${task.title}</div>
                <div class="las-panel-meta">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp-inline"><path d="M2 3h20v14H2z"></path><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>
                    <span>${task.class_name}</span>
                    <span>&bull;</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp-inline"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Due: ${task.due_date}</span>
                </div>
            </div>

            <div class="las-panel-desc">
                ${task.description ? task.description.replace(/\n/g, '<br>') : 'No description provided.'}
            </div>

            <div class="las-panel-links">
                ${task.teacher_file ? `
                    <a class="las-panel-link" href="javascript:void(0)"
                        onclick="viewDocument('${task.teacher_file}', 'Teacher Attachment: ${task.title.replace(/'/g, "\\'")}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Teacher Attachment
                    </a>` : ''}
                ${task.submission_file ? `
                    <a class="las-panel-link" href="javascript:void(0)"
                        onclick="viewDocument('${task.submission_file}', 'My Submission: ${task.title.replace(/'/g, "\\'")}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View My Work
                    </a>` : ''}
            </div>

            ${task.is_past_due
                ? `<span class="las-panel-action las-panel-action--locked">${actionLabel}</span>`
                : `<a class="las-panel-action" href="${actionHref}" onclick="openLearnerAssignmentSubmission(event, '${actionHref}')">${actionLabel}</a>`}
        </div>`;
};