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
        },
        {
            key:     'discussion',
            data:    data.discussion,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#34d399" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
            label:   'Latest Discussion',
            color:   '#34d399',
            onclick: 'fetchTeacherDiscussions()',
            empty:   'No discussions yet',
            meta:    data.discussion ? `${data.discussion.class_name} &bull; ${data.discussion.created_at}` : '',
            badge:   data.discussion ? `<span class="snap-status-badge" style="background:rgba(52,211,153,0.15);color:#34d399;">${data.discussion.reply_count} ${data.discussion.reply_count === 1 ? 'reply' : 'replies'}</span>` : ''
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
    } else if (savedPage === "teacher_discussions") {
        window.fetchTeacherDiscussions();
    } else if (savedPage === "teacher_grades") {
        window.fetchTeacherGrades();
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

            if (sidebar.classList.contains('active') ||
                sidebar.classList.contains('desktop-open')) {
                sidebar.classList.remove('active');
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

        fetch('upload_teacher_profile.php', { method: 'POST', body: fd })
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
                </div>
                ${dayEvents.length > 0 ? `
                <div class="cal-tooltip">
                    ${dayEvents.map(e => `
                        <div class="cal-tooltip-item cal-tooltip-${e.type}">
                            ${e.type === 'assignment' ? '📝' : e.type === 'quiz' ? '📊' : '🔔'}
                            ${e.title}${e.class_name ? ` <span style="opacity:0.6;">— ${e.class_name}</span>` : ''}
                        </div>`).join('')}
                </div>` : ''}
            </div>`;
    }

    html += `</div>

        <!-- Reminder Modal -->
        <div id="reminderModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9998;align-items:center;justify-content:center;">
            <div style="background:#1a1919;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:320px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <span style="font-weight:800;color:#e2e8f0;">Add Reminder</span>
                    <button onclick="closeReminderModal()" style="background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;">&times;</button>
                </div>
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

window.openReminderModal = function(dateStr = '') {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDate').value  = dateStr;
    document.getElementById('reminderError').style.display = 'none';
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
            headers: { 'Content-Type': 'application/json' },
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