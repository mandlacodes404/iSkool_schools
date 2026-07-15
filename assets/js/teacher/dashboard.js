function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.showTeacherScopedLoader = function(panel, message = 'Working...') {
    const isDesktop = window.innerWidth >= 900 && panel;

    if (!isDesktop) {
        const globalLoader = document.getElementById('loaderOverlay');
        if (globalLoader) globalLoader.style.display = 'flex';
        return function hideGlobalLoader() {
            if (globalLoader) globalLoader.style.display = 'none';
        };
    }

    if (!document.getElementById('teacher-scoped-loader-style')) {
        const style = document.createElement('style');
        style.id = 'teacher-scoped-loader-style';
        style.textContent = '@keyframes teacher-scoped-spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(style);
    }

    panel.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.className = 'teacher-scoped-loader';
    overlay.style.cssText = `
        position:absolute;inset:0;
        background:rgba(13,17,23,0.7);
        backdrop-filter:blur(2px);
        display:flex;align-items:center;justify-content:center;
        border-radius:14px;z-index:10;
    `;
    overlay.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div style="width:32px;height:32px;border:3px solid rgba(79,209,197,0.2);
                        border-top-color:#4fd1c5;border-radius:50%;
                        animation:teacher-scoped-spin 0.7s linear infinite;"></div>
            <span style="font-size:13px;color:#8b949e;">${message}</span>
        </div>`;
    panel.appendChild(overlay);

    return function hidePanelLoader() {
        overlay.remove();
    };
};

// ─────────────────────────────────────────────
// SHARED: COLLAPSIBLE SIDEBAR CLASS GROUPS
// Reusable across quizzes/grades/resources/announcements/
// assignments (or any teacher page with a left sidebar
// grouped by class). Injects one shared stylesheet + one
// shared toggle function so every page's sidebar behaves
// the same way without duplicating CSS/JS per file.
// ─────────────────────────────────────────────
(function () {
    if (document.getElementById('teacher-collapsible-sidebar-style')) return;
    const style = document.createElement('style');
    style.id = 'teacher-collapsible-sidebar-style';
    style.textContent = `
        .tchr-sidebar-class-label--toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            user-select: none;
            transition: color 0.15s ease;
        }
        .tchr-sidebar-class-label--toggle:hover {
            color: #c9d1d9;
        }
        .tchr-sidebar-class-chevron {
            flex-shrink: 0;
            transition: transform 0.18s ease;
            transform: rotate(0deg);
        }
        .tchr-sidebar-class-label--toggle.collapsed .tchr-sidebar-class-chevron {
            transform: rotate(-90deg);
        }
        .tchr-sidebar-class-group {
            overflow: hidden;
            max-height: 2000px;
            transition: max-height 0.22s ease;
        }
        .tchr-sidebar-class-group.collapsed {
            max-height: 0;
        }
    `;
    document.head.appendChild(style);
})();

// ─────────────────────────────────────────────
// SHARED: DESKTOP "FLAT LAYOUT" STYLES
// One injected copy, reused by every teacher page that renders a
// sidebar + main-panel split (Quizzes, Announcements, Assignments,
// Resources, Grades).
//
// Replaces the old per-page boxed-card look (border + border-radius +
// solid #0d1117 panel backgrounds) with a flat, VS-Code/GitHub style:
// no outer card, panels transparent, single 1px divider between
// sidebar and main panel. #api-content-area's inline 20px padding is
// overridden to 0 on desktop, and each page's own -panel-content-style
// padding (already present per page) keeps panel content readable, so
// the divider line runs flush from the top nav all the way to the
// bottom of the viewport. The layout height is filled via 100% rather
// than each page's own calc(100vh - 140px) guess, since
// #api-content-area is already flex:1 inside .main-content — a fixed
// guess on top of that just risks drifting out of sync again.
//
// Usage: call injectSharedTeacherDesktopLayoutStyles() once when a
// page's HTML is built, then add these classes alongside each page's
// own prefixed classes:
//   .tchr-flat-layout   → on the outer sidebar+panel flex wrapper
//   .tchr-flat-sidebar  → on the sidebar column
//   .tchr-flat-panel    → on the main (right-hand) panel column
// ─────────────────────────────────────────────
function injectSharedTeacherDesktopLayoutStyles() {
    if (document.getElementById('tchr-shared-desktop-layout-style')) return;

    const style = document.createElement('style');
    style.id = 'tchr-shared-desktop-layout-style';
    style.textContent = `
        @media (min-width: 900px) {
            #api-content-area {
                padding: 0 !important;
            }
        }

        .tchr-flat-layout {
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            margin-top: 0 !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        .tchr-flat-sidebar {
            background: transparent !important;
            border-right: 1px solid rgba(255,255,255,0.07) !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        .tchr-flat-panel {
            background: transparent !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        /* Restores the breathing room #api-content-area used to give,
           now scoped to just the sidebar's scrollable list, so the
           divider itself stays flush. */
        .tchr-flat-sidebar .qz-sidebar-scroll,
        .tchr-flat-sidebar .an-sidebar-scroll,
        .tchr-flat-sidebar .as-sidebar-scroll,
        .tchr-flat-sidebar .rs-sidebar-scroll,
        .tchr-flat-sidebar .gr-sidebar-scroll {
            padding-top: 20px !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Builds the markup for one collapsible class group in a sidebar.
 * @param {string} groupId       - unique DOM id for the collapsible content wrapper
 * @param {string} labelClass    - page-specific label class, e.g. "qz-sidebar-class-label"
 * @param {string} labelInnerHtml - the label's contents (name, icons, badges, etc.)
 * @param {string} itemsHtml     - the already-built HTML for the items inside this class
 * @returns {string}
 */
window.buildCollapsibleClassGroup = function(groupId, labelClass, labelInnerHtml, itemsHtml) {
    return `
        <div class="${labelClass} tchr-sidebar-class-label--toggle"
            onclick="toggleSidebarClassGroup(this)"
            data-target="${groupId}"
            role="button"
            aria-expanded="true">
            <svg class="tchr-sidebar-class-chevron" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span>${labelInnerHtml}</span>
        </div>
        <div class="tchr-sidebar-class-group" id="${groupId}">${itemsHtml}</div>`;
};

/**
 * Generic toggle handler for any collapsible class-group label.
 * Default state (no click yet) is always expanded.
 */
window.toggleSidebarClassGroup = function(labelEl) {
    if (!labelEl) return;
    const targetId = labelEl.getAttribute('data-target');
    const group = targetId ? document.getElementById(targetId) : null;
    if (!group) return;

    const isCollapsed = group.classList.toggle('collapsed');
    labelEl.classList.toggle('collapsed', isCollapsed);
    labelEl.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
};

document.addEventListener('DOMContentLoaded', function () {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('mobileOverlay');
    const loader   = document.getElementById('loaderOverlay');
    const apiArea  = document.getElementById('api-content-area');
    const iframe   = document.getElementById('mainFrame');
    window.loaderTimeout = null;

    // ─────────────────────────────────────────────
    // LOAD TEACHER MANUAL (defined once only)
    // ─────────────────────────────────────────────
   window.loadTeacherManual = async function() {
    sessionStorage.setItem("lastTeacherPage", "teacher_manual");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_manual");
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    try {
        const [manualRes, snapshotRes] = await Promise.all([
            fetch('partials/teacher_manual.html'),
            fetch('api/teacher/get_dashboard_snapshot.php')
        ]);
        const manualHtml = await manualRes.text();
        const snapshot   = await snapshotRes.json();

        // Desktop: two column layout. Mobile: manual only
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            apiArea.innerHTML = manualHtml;
        } else {
            apiArea.innerHTML = `
                <div class="dashboard-home-layout">
                    <div class="dashboard-snapshot-panel">
                        ${renderSnapshotPanel(snapshot)}
                    </div>
                    <div class="dashboard-manual-panel">
                        ${manualHtml}
                    </div>
                </div>`;
                
    window.loadCalendar(window.calendarState.month, window.calendarState.year);

        }
    } catch(e) {
        console.error('Home load error:', e);
        const res = await fetch('partials/teacher_manual.html');
        const html = await res.text();
        if (apiArea) apiArea.innerHTML = html;
        // Load calendar after DOM is ready

    }
};

function renderSnapshotPanel(data) {
    const cards = [
        {
            key:     'quiz',
            data:    data.quiz,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            label:   'Latest Quiz',
            color:   '#4fd1c5',
            onclick: 'fetchTeacherQuizzes()',
            empty:   'No quizzes created yet',
            meta:    data.quiz ? `${data.quiz.class_name} &bull; ${data.quiz.start_time}` : '',
            badge:   data.quiz ? `<span class="snap-status-badge" style="background:${data.quiz.status === 'Open' ? 'rgba(242,140,56,0.15)' : 'rgba(107,114,128,0.15)'};color:${data.quiz.status === 'Open' ? '#f28c38' : '#6b7280'}">${data.quiz.status}</span>` : ''
        },
        {
            key:     'assignment',
            data:    data.assignment,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#a78bfa" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
            label:   'Upcoming Assignment',
            color:   '#a78bfa',
            onclick: 'fetchTeacherAssignments()',
            empty:   'No upcoming assignments',
            meta:    data.assignment ? `${data.assignment.class_name} &bull; Due ${data.assignment.due_date}` : '',
            badge:   data.assignment ? `<span class="snap-status-badge" style="background:rgba(167,139,250,0.15);color:#a78bfa;">in ${data.assignment.days_left} day${data.assignment.days_left !== 1 ? 's' : ''}</span>` : ''
        },
        {
            key:     'announcement',
            data:    data.announcement,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#f59e0b" stroke-width="2" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            label:   'Latest Announcement',
            color:   '#f59e0b',
            onclick: 'fetchTeacherAnnouncements()',
            empty:   'No announcements sent yet',
            meta:    data.announcement ? `${data.announcement.class_name} &bull; ${data.announcement.created_at}` : '',
            badge:   ''
        }
    ];

    let html = `<div class="snap-panel-title">Quick Snapshot</div>`;

    cards.forEach(card => {
        if (!card.data) {
            html += `
                <div class="snap-card snap-card-empty">
                    <div class="snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
                    <div class="snap-empty-text">${card.empty}</div>
                </div>`;
        } else {
            html += `
                <div class="snap-card" onclick="${card.onclick}">
                    <div class="snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
                    <div class="snap-card-title">${card.data.title}</div>
                    <div class="snap-card-meta">
                        ${card.meta}
                        ${card.badge}
                    </div>
                </div>`;
        }
    });
    
    html += `<div class="snap-panel-title" style="margin-top:20px;">Calendar & Reminders</div>
         <div id="snap-calendar"></div>`;
    return html;
}

    // ─────────────────────────────────────────────
    // RESTORE LAST PAGE ON REFRESH
    // ─────────────────────────────────────────────
    const savedPage = sessionStorage.getItem("lastTeacherPage");

    if (savedPage === "teacher_announcements") {
        window.fetchTeacherAnnouncements();
    } else if (savedPage === "teacher_quizzes") {
        window.fetchTeacherQuizzes();
    } else if (savedPage === "teacher_evaluations") {
        window.fetchTeacherEvaluations();
    } else if (savedPage === "teacher_resources") {
        window.fetchTeacherResources();
    } else if (savedPage === "teacher_assignments") {
        window.fetchTeacherAssignments();
    } else if (savedPage === "teacher_analytics") {
        window.fetchTeacherAnalytics();
    } else if (savedPage === "teacher_grades") {
        window.fetchTeacherGrades();
    } else if (savedPage === "teacher_syllabus") {
        window.fetchTeacherSyllabus();
    } else if (savedPage === "teacher_calendar") {
    window.fetchTeacherCalendar();
    } else {
        window.loadTeacherManual();
    }

    // ─────────────────────────────────────────────
    // ACTIVE STATE
    // ─────────────────────────────────────────────
    window.setTeacherActive = function(page) {
        document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === page);
        });
        const topNavTabs = {
            teacher_syllabus: 'tab-syllabus',
            teacher_evaluations: 'tab-evaluations',
            teacher_analytics: 'tab-analytics',
            teacher_calendar: 'tab-calendar',
            teacher_settings: 'tab-settings'
        };
        if (typeof window.setTopNavTab === 'function') {
            window.setTopNavTab(topNavTabs[page] || null);
        }
    };

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — MOBILE
    // ─────────────────────────────────────────────
 window.toggleDesktopSidebar = function() {
    sidebar.classList.toggle('desktop-open');
    const svg = document.querySelector('#toggleIcon svg');
    if (svg) {
        const isOpen = sidebar.classList.contains('desktop-open');
        svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

 overlay?.addEventListener('click', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('desktop-open');
    } else {
        toggleSidebar(true);
    }
});

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — DESKTOP
    // ─────────────────────────────────────────────
    window.toggleDesktopSidebar = function() {
        sidebar.classList.toggle('desktop-open');
        const collapsed = !sidebar.classList.contains('desktop-open');
        const svg = document.querySelector('#toggleIcon svg');
        if (svg) {
            svg.style.transform = collapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    };

    document.getElementById('desktopMenuToggle')
        ?.addEventListener('click', toggleDesktopSidebar);

    // ─────────────────────────────────────────────
    // RESTORE DESKTOP SIDEBAR STATE
    // ─────────────────────────────────────────────
    if (window.innerWidth > 768) {
        const saved = localStorage.getItem('sidebarCollapsed') === 'true';
        if (saved) {
            sidebar.classList.add('desktop-open');
        }
    }

    // ─────────────────────────────────────────────
    // AUTO CLOSE SIDEBAR ON NAV CLICK + LOADER
    // ─────────────────────────────────────────────
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                if (typeof window.closeMobileSidebar === 'function') {
                    window.closeMobileSidebar();
                } else {
                    sidebar.classList.remove('active');
                    if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.pointerEvents = 'none';
                    }
                }
                return;
            }

            if (sidebar.classList.contains('desktop-open')) {
                sidebar.classList.remove('desktop-open');
            }
        });
    });

    // ─────────────────────────────────────────────
    // IFRAME LOAD — HIDE LOADER + SAVE STATE
    // ─────────────────────────────────────────────
    iframe?.addEventListener('load', () => {
        clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';

        try {
            const fullPage = iframe.contentWindow.location.pathname.split("/").pop()
                           + iframe.contentWindow.location.search;
            if (fullPage && !fullPage.startsWith('blank.php') && fullPage !== '') {
                sessionStorage.setItem("lastTeacherPage", fullPage);
            }
        } catch (e) {
            console.log("External or restricted page loaded, cannot save state.");
        }
    });

    // ─────────────────────────────────────────────
    // SETTINGS BUTTON
    // ─────────────────────────────────────────────
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        if (loader) loader.style.display = 'flex';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'teacher_settings.php';
        }
        if (apiArea) apiArea.style.display = 'none';

        document.querySelectorAll('.sidebar a').forEach(link => {
            link.classList.remove('active');
        });

        toggleSidebar(true);
    });

    // ─────────────────────────────────────────────
    // PROFILE UPLOAD
    // ─────────────────────────────────────────────
    const avatarWrapper = document.querySelector('.profile-picture-wrapper');
    const profileInput  = document.getElementById('teacherProfileInput');

    avatarWrapper?.addEventListener('click', () => profileInput.click());

    profileInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        updateTeacherAvatar(previewUrl);

        const fd = new FormData();
        fd.append('profile', file);

        fetch('upload_teacher_profile.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    updateTeacherAvatar('uploads/teachers/' + d.file + '?t=' + Date.now());
                } else {
                    alert(d.error || 'Upload failed');
                }
                profileInput.value = '';
            })
            .catch(() => {
                alert('Connection error during upload');
                profileInput.value = '';
            });
    });

    function updateTeacherAvatar(url) {
        let img = avatarWrapper.querySelector('img');
        if (img) {
            img.src = url;
        } else {
            const initials = avatarWrapper.querySelector('.initials-avatar');
            if (initials) initials.remove();
            const newImg = document.createElement('img');
            newImg.className = 'teacher-avatar';
            newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            newImg.src = url;
            avatarWrapper.insertBefore(newImg, profileInput);
        }
    }

    if (loader) loader.style.display = 'none';
    clearTimeout(window.loaderTimeout);
});

// ── CALENDAR ──
window.calendarState = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
window.calendarEvents = [];

window.loadCalendar = async function(month, year) {
    const container = document.getElementById('snap-calendar');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center;padding:20px;color:#8b949e;font-size:13px;">Loading...</div>`;

    try {
        const res  = await fetch(`api/teacher/get_calendar_events.php?month=${month}&year=${year}`);
        const data = await res.json();
        window.calendarEvents = data.events || [];
        renderCalendar(month, year, window.calendarEvents);
    } catch(e) {
        container.innerHTML = `<div style="color:#ff5555;font-size:13px;text-align:center;">Failed to load calendar</div>`;
    }
};

function renderCalendar(month, year, events) {
    const container = document.getElementById('snap-calendar');
    if (!container) return;

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    const today     = new Date();
    const firstDay  = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    // Group events by date
    const eventMap = {};
    events.forEach(e => {
        const day = parseInt(e.date.split('-')[2]);
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push(e);
    });

    // Start from Monday — adjust firstDay
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

    let html = `
        <div class="cal-header">
            <button class="cal-nav" onclick="calPrev()">&#8249;</button>
            <span class="cal-month-title">${monthNames[month-1]} ${year}</span>
            <button class="cal-nav" onclick="calNext()">&#8250;</button>
            <button class="cal-add-btn" onclick="openReminderModal()">+</button>
        </div>
        <div class="cal-grid">
            <div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div>
            <div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div>
            <div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
            <div class="cal-day-label">Su</div>`;

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="cal-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear());
        const dayEvents = eventMap[d] || [];
        const hasAssignment = dayEvents.some(e => e.type === 'assignment');
        const hasQuiz       = dayEvents.some(e => e.type === 'quiz');
        const hasReminder   = dayEvents.some(e => e.type === 'reminder');
        const hasAcademic   = dayEvents.some(e => e.type === 'academic');

        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        html += `
            <div class="cal-cell ${isToday ? 'cal-today' : ''} ${dayEvents.length > 0 ? 'cal-has-events' : ''}"
                onclick="openReminderModal('${dateStr}')"
                ${dayEvents.length > 0 ? `data-events='${JSON.stringify(dayEvents).replace(/'/g, "&#39;")}'` : ''}>
                <span class="cal-day-num">${d}</span>
                <div class="cal-dots">
                    ${hasAssignment ? '<span class="cal-dot dot-assignment"></span>' : ''}
                    ${hasQuiz       ? '<span class="cal-dot dot-quiz"></span>'       : ''}
                    ${hasReminder   ? '<span class="cal-dot dot-reminder"></span>'   : ''}
                    ${hasAcademic   ? '<span class="cal-dot dot-academic"></span>'   : ''}
                </div>
                ${dayEvents.length > 0 ? `
                <div class="cal-tooltip">
                    ${dayEvents.map(e => `
                        <div class="cal-tooltip-item cal-tooltip-${e.type}">
                            ${e.type === 'assignment' 
    ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#a78bfa" stroke-width="2" fill="none" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
   : e.type === 'quiz' 
? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#4fd1c5" stroke-width="2" fill="none" style="flex-shrink:0;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
: e.type === 'academic'
? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#f472b6" stroke-width="2" fill="none" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#f59e0b" stroke-width="2" fill="none" style="flex-shrink:0;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
}
                            ${e.title}${e.class_name ? ` <span style="opacity:0.6;">— ${e.class_name}</span>` : ''}
                        </div>`).join('')}
                </div>` : ''}
            </div>`;
    }

    html += `</div>

       <!-- Add Event Modal — two tabs -->
<div id="reminderModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9998;align-items:center;justify-content:center;">
    <div style="background:#1a1919;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-weight:800;color:#e2e8f0;">Add to Calendar</span>
            <button onclick="closeReminderModal()" style="background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;">&times;</button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:8px;margin-bottom:20px;">
            <button id="tabReminder"
                onclick="switchCalTab('reminder')"
                style="flex:1;padding:8px;border-radius:8px;border:1px solid #4fd1c5;background:rgba(79,209,197,0.15);color:#4fd1c5;font-weight:800;font-size:13px;cursor:pointer;">
                Personal Reminder
            </button>
            <button id="tabAcademic"
                onclick="switchCalTab('academic')"
                style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#8b949e;font-weight:800;font-size:13px;cursor:pointer;">
                Academic Event
            </button>
        </div>

        <!-- REMINDER TAB -->
        <div id="calTabReminder">
            <label class="teacher-modal-label">Reminder Title</label>
            <input type="text" id="reminderTitle" class="teacher-modal-input" placeholder="e.g. Create Test">
            <label class="teacher-modal-label" style="margin-top:12px;">Date</label>
            <input type="date" id="reminderDate" class="teacher-modal-input">
            <div id="reminderError" style="color:#ff5555;font-size:13px;margin-top:8px;display:none;"></div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button onclick="closeReminderModal()" class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                <button onclick="saveReminder()" class="teacher-modal-submit" style="flex:1;">Save</button>
            </div>
        </div>

        <!-- ACADEMIC EVENT TAB -->
        <div id="calTabAcademic" style="display:none;">
            <label class="teacher-modal-label">Event Title</label>
            <input type="text" id="academicTitle" class="teacher-modal-input" placeholder="e.g. Term 2 Test Week">
            <label class="teacher-modal-label" style="margin-top:12px;">Date</label>
            <input type="date" id="academicDate" class="teacher-modal-input">
            <label class="teacher-modal-label" style="margin-top:12px;">Event Type</label>
            <select id="academicType" class="teacher-modal-input">
                <option value="test">Test</option>
                <option value="exam">Exam</option>
                <option value="holiday">Holiday</option>
                <option value="event">School Event</option>
                <option value="other">Other</option>
            </select>
            <label class="teacher-modal-label" style="margin-top:12px;">Class</label>
            <select id="academicClass" class="teacher-modal-input">
                <option value="">Loading classes...</option>
            </select>
            <div id="academicError" style="color:#ff5555;font-size:13px;margin-top:8px;display:none;"></div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button onclick="closeReminderModal()" class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                <button onclick="saveAcademicEvent()" class="teacher-modal-submit" style="flex:1;">Post Event</button>
            </div>
        </div>

    </div>
</div>`;

    container.innerHTML = html;
}

window.calPrev = function() {
    let { month, year } = window.calendarState;
    month--;
    if (month < 1) { month = 12; year--; }
    window.calendarState = { month, year };
    window.loadCalendar(month, year);
};

window.calNext = function() {
    let { month, year } = window.calendarState;
    month++;
    if (month > 12) { month = 1; year++; }
    window.calendarState = { month, year };
    window.loadCalendar(month, year);
};

// FROM:
window.openReminderModal = function(dateStr = '') {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDate').value  = dateStr;
    document.getElementById('reminderError').style.display = 'none';
    modal.style.display = 'flex';
};

// TO:
window.openReminderModal = function(dateStr = '') {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    // Reset reminder tab
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDate').value  = dateStr;
    document.getElementById('reminderError').style.display = 'none';
    // Reset academic tab
    document.getElementById('academicTitle').value = '';
    document.getElementById('academicDate').value  = dateStr;
    document.getElementById('academicError').style.display = 'none';
    // Always open on reminder tab
    switchCalTab('reminder');
    // Pre-load classes for academic tab
    window.loadAcademicClasses();
    modal.style.display = 'flex';
};

window.closeReminderModal = function() {
    const modal = document.getElementById('reminderModal');
    if (modal) modal.style.display = 'none';
};

window.saveReminder = async function() {
    const title = document.getElementById('reminderTitle').value.trim();
    const date  = document.getElementById('reminderDate').value;
    const err   = document.getElementById('reminderError');

    if (!title) { err.textContent = 'Please enter a title.'; err.style.display = 'block'; return; }
    if (!date)  { err.textContent = 'Please select a date.'; err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_reminder.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ title, date })
        });
        const data = await res.json();
        if (data.success) {
            closeReminderModal();
            window.loadCalendar(window.calendarState.month, window.calendarState.year);
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};

// ── TAB SWITCHER ──
window.switchCalTab = function(tab) {
    const isReminder = tab === 'reminder';

    document.getElementById('calTabReminder').style.display = isReminder ? 'block' : 'none';
    document.getElementById('calTabAcademic').style.display = isReminder ? 'none'  : 'block';

    const btnR = document.getElementById('tabReminder');
    const btnA = document.getElementById('tabAcademic');

    btnR.style.background   = isReminder ? 'rgba(79,209,197,0.15)' : 'transparent';
    btnR.style.borderColor  = isReminder ? '#4fd1c5' : 'rgba(255,255,255,0.1)';
    btnR.style.color        = isReminder ? '#4fd1c5' : '#8b949e';

    btnA.style.background   = isReminder ? 'transparent' : 'rgba(244,114,182,0.15)';
    btnA.style.borderColor  = isReminder ? 'rgba(255,255,255,0.1)' : '#f472b6';
    btnA.style.color        = isReminder ? '#8b949e' : '#f472b6';
};

// ── LOAD CLASSES INTO ACADEMIC DROPDOWN ──
window.loadAcademicClasses = async function() {
    const select = document.getElementById('academicClass');
    if (!select) return;
    try {
        const res     = await fetch('api/teacher/get_classes.php');
        const classes = await res.json();
        select.innerHTML = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch(e) {
        select.innerHTML = '<option value="">Failed to load</option>';
    }
};

// ── SAVE ACADEMIC EVENT ──
window.saveAcademicEvent = async function() {
    const title     = document.getElementById('academicTitle').value.trim();
    const date      = document.getElementById('academicDate').value;
    const eventType = document.getElementById('academicType').value;
    const classId   = document.getElementById('academicClass').value;
    const err       = document.getElementById('academicError');

    err.style.display = 'none';

    if (!title)   { err.textContent = 'Please enter a title.';    err.style.display = 'block'; return; }
    if (!date)    { err.textContent = 'Please select a date.';    err.style.display = 'block'; return; }
    if (!classId) { err.textContent = 'Please select a class.';   err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_academic_event.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body:    JSON.stringify({ title, event_date: date, event_type: eventType, class_id: parseInt(classId) })
        });
        const data = await res.json();
        if (data.success) {
            closeReminderModal();
            window.loadCalendar(window.calendarState.month, window.calendarState.year);
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};