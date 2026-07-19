function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
// ══════════════════════════════════════════════════════
//  TEACHER CALENDAR — Full Page
//  Drop this file in your JS includes on teacher_dashboard.php
//  (or paste into your existing teacher JS bundle)
// ══════════════════════════════════════════════════════

window.calendarPageState = {
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
    events: []
};
window.teacherCalendarEventsCache = window.teacherCalendarEventsCache || {};
window.teacherCalendarEventsPromises = window.teacherCalendarEventsPromises || {};

function teacherCalendarCacheKey(month, year) {
    return `${year}-${month}`;
}

async function loadTeacherCalendarEvents(month, year) {
    const key = teacherCalendarCacheKey(month, year);
    if (window.teacherCalendarEventsCache[key]) return window.teacherCalendarEventsCache[key];

    if (!window.teacherCalendarEventsPromises[key]) {
        window.teacherCalendarEventsPromises[key] = fetch(`api/teacher/get_calendar_events.php?month=${month}&year=${year}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch calendar events');
                return res.json();
            })
            .then(data => {
                window.teacherCalendarEventsCache[key] = data.events || [];
                return window.teacherCalendarEventsCache[key];
            })
            .finally(() => {
                delete window.teacherCalendarEventsPromises[key];
            });
    }

    return window.teacherCalendarEventsPromises[key];
}

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// Warms the current month so the first click into Calendar is instant.
// ─────────────────────────────────────────────
window.prefetchTeacherCalendar = function () {
    const { month, year } = window.calendarPageState;
    loadTeacherCalendarEvents(month, year).catch(() => {});
};

// ── ENTRY POINT — called by sidebar "Calendar" link ──
window.fetchTeacherCalendar = async function () {
    sessionStorage.setItem('lastTeacherPage', 'teacher_calendar');
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive('teacher_calendar');

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    const { month, year } = window.calendarPageState;

    await renderFullCalendarPage(month, year);
};

// ── MAIN RENDER ──
async function renderFullCalendarPage(month, year) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // Show skeleton while loading
    apiArea.innerHTML = buildCalendarShell(month, year, []);
    bindCalendarPageNav();

    try {
        window.calendarPageState.events = await loadTeacherCalendarEvents(month, year);
        window.calendarPageState.month  = month;
        window.calendarPageState.year   = year;
    } catch (e) {
        window.calendarPageState.events = [];
    }

    apiArea.innerHTML = buildCalendarShell(month, year, window.calendarPageState.events);
    bindCalendarPageNav();
}

// ── HTML BUILDER ──
function buildCalendarShell(month, year, events) {
    const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    const today      = new Date();
    const firstDay   = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday-first

    // Group events by day number
    const eventMap = {};
    (events || []).forEach(e => {
        const day = parseInt(e.date.split('-')[2], 10);
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push(e);
    });

    // ── Legend ──
    const legend = `
        <div class="full-cal-legend">
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot full-cal-legend-dot--quiz"></span> Quiz
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot full-cal-legend-dot--assignment"></span> Assignment
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot full-cal-legend-dot--reminder"></span> Reminder
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot full-cal-legend-dot--academic"></span> Academic
            </span>
        </div>`;

    // ── Header ──
    const header = `
        <div class="full-cal-topbar">
            <div class="full-cal-header-left">
                <h2 class="full-cal-page-title">Calendar</h2>
                ${legend}
            </div>
            <div class="full-cal-header-right">
                <button class="full-cal-add-btn teacher-desktop-create" onclick="openFullCalReminderModal()">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Event
                </button>
            </div>
        </div>`;

    // ── Month nav ──
    const nav = `
        <div class="full-cal-nav-row">
            <button class="full-cal-nav-btn" id="fullCalPrev">&#8249;</button>
            <span class="full-cal-month-label">${monthNames[month - 1]} ${year}</span>
            <button class="full-cal-nav-btn" id="fullCalNext">&#8250;</button>
        </div>`;

    // ── Day headers ──
    const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        .map(d => `<div class="full-cal-day-header">${d}</div>`)
        .join('');

    // ── Cells ──
    let cells = '';

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
        cells += `<div class="full-cal-cell full-cal-cell-empty"></div>`;
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (
            d === today.getDate() &&
            month === today.getMonth() + 1 &&
            year  === today.getFullYear()
        );
        const dayEvents = eventMap[d] || [];
        const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        const hasAssignment = dayEvents.some(e => e.type === 'assignment');
        const hasQuiz       = dayEvents.some(e => e.type === 'quiz');
        const hasReminder   = dayEvents.some(e => e.type === 'reminder');
        const hasAcademic   = dayEvents.some(e => e.type === 'academic');

        // Event pills — show up to 3, then "+N more"
        const visibleEvents = dayEvents.slice(0, 3);
        const overflow      = dayEvents.length - 3;

        const pills = visibleEvents.map(e => {
            const typeClasses = {
                quiz:       'full-cal-pill--quiz',
                assignment: 'full-cal-pill--assignment',
                reminder:   'full-cal-pill--reminder',
                academic:   'full-cal-pill--academic',
            };
            const typeClass = typeClasses[e.type] || typeClasses.reminder;
            const label = e.class_name
                ? `${e.title} <span class="full-cal-pill-suffix">— ${e.class_name}</span>`
                : e.title;
            return `<div class="full-cal-pill ${typeClass}">${label}</div>`;
        }).join('');

        const overflowPill = overflow > 0
            ? `<div class="full-cal-pill full-cal-pill-more">+${overflow} more</div>`
            : '';

        const dots = `
            <div class="full-cal-dots">
                ${hasQuiz       ? '<span class="cal-dot dot-quiz"></span>'       : ''}
                ${hasAssignment ? '<span class="cal-dot dot-assignment"></span>' : ''}
                ${hasReminder   ? '<span class="cal-dot dot-reminder"></span>'   : ''}
                ${hasAcademic   ? '<span class="cal-dot dot-academic"></span>'   : ''}
            </div>`;

        cells += `
            <div class="full-cal-cell ${isToday ? 'full-cal-cell-today' : ''} ${dayEvents.length ? 'full-cal-cell-has-events' : ''}"
                 onclick="openFullCalReminderModal('${dateStr}')">
                <div class="full-cal-cell-top">
                    <span class="full-cal-day-num">${d}</span>
                    ${dots}
                </div>
                <div class="full-cal-pills">
                    ${pills}
                    ${overflowPill}
                </div>
            </div>`;
    }

    // ── Upcoming events sidebar ──
    const upcomingHtml = buildUpcomingPanel(events, month, year);

    return `
        <div class="full-cal-page-wrapper">
            ${header}
            <div class="full-cal-body">
                <div class="full-cal-main">
                    ${nav}
                    <div class="full-cal-grid">${dayHeaders}</div>
                    <div class="full-cal-cells">${cells}</div>
                </div>
                <div class="full-cal-upcoming">
                    ${upcomingHtml}
                </div>
            </div>
        </div>

        ${buildFullCalModal()}
    `;
}

// ── UPCOMING EVENTS PANEL ──
function buildUpcomingPanel(events, month, year) {
    const today  = new Date();
    today.setHours(0,0,0,0);

    const upcoming = (events || [])
        .filter(e => new Date(e.date + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 8);

    const typeConfig = {
        quiz:       { label: 'Quiz',       cls: 'quiz' },
        assignment: { label: 'Assignment', cls: 'assignment' },
        reminder:   { label: 'Reminder',   cls: 'reminder' },
        academic:   { label: 'Academic',   cls: 'academic' },
    };

    const monthNames = [
        'Jan','Feb','Mar','Apr','May','Jun',
        'Jul','Aug','Sep','Oct','Nov','Dec'
    ];

    if (!upcoming.length) {
        return `
            <div class="full-cal-upcoming-title">Upcoming Events</div>
            <div class="full-cal-upcoming-empty">No upcoming events this month</div>`;
    }

    const cards = upcoming.map(e => {
        const cfg  = typeConfig[e.type] || typeConfig.reminder;
        const d    = new Date(e.date + 'T00:00:00');
        const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        const meta = e.class_name ? e.class_name : '';
        return `
            <div class="full-cal-upcoming-card">
                <div class="full-cal-upcoming-type full-cal-upcoming-type--${cfg.cls}">${cfg.label}</div>
                <div class="full-cal-upcoming-title-text">${e.title}</div>
                ${meta ? `<div class="full-cal-upcoming-meta">${meta}</div>` : ''}
                <div class="full-cal-upcoming-date full-cal-upcoming-date--${cfg.cls}">${dateLabel}</div>
            </div>`;
    }).join('');

    return `
        <div class="full-cal-upcoming-title">Upcoming Events</div>
        ${cards}`;
}

// ── MODAL HTML ──
function buildFullCalModal() {
    return `
        <div id="fullCalModal">
            <div class="full-cal-modal-box">
                <div class="full-cal-modal-head">
                    <span>Add to Calendar</span>
                    <button class="full-cal-modal-close" onclick="closeFullCalModal()">&times;</button>
                </div>

                <!-- Tabs -->
                <div class="full-cal-tab-row">
                    <button id="fullCalTabReminderBtn"
                        onclick="switchFullCalTab('reminder')"
                        class="full-cal-tab-btn full-cal-tab-btn--reminder active">
                        Personal Reminder
                    </button>
                    <button id="fullCalTabAcademicBtn"
                        onclick="switchFullCalTab('academic')"
                        class="full-cal-tab-btn full-cal-tab-btn--academic">
                        Academic Event
                    </button>
                </div>

                <!-- Reminder Tab -->
                <div id="fullCalTabReminder">
                    <label class="teacher-modal-label">Reminder Title</label>
                    <input type="text" id="fullCalReminderTitle" class="teacher-modal-input" placeholder="e.g. Prepare test papers">
                    <label class="teacher-modal-label full-cal-form-label-spaced">Date</label>
                    <input type="date" id="fullCalReminderDate" class="teacher-modal-input">
                    <div id="fullCalReminderError" class="full-cal-modal-error"></div>
                    <div class="full-cal-modal-actions">
                        <button onclick="closeFullCalModal()" class="teacher-modal-cancel full-cal-modal-btn-half">Cancel</button>
                        <button onclick="saveFullCalReminder()" class="teacher-modal-submit full-cal-modal-btn-half">Save</button>
                    </div>
                </div>

                <!-- Academic Tab -->
                <div id="fullCalTabAcademic" class="full-cal-tab-panel-hidden">
                    <label class="teacher-modal-label">Event Title</label>
                    <input type="text" id="fullCalAcademicTitle" class="teacher-modal-input" placeholder="e.g. Term 2 Test Week">
                    <label class="teacher-modal-label full-cal-form-label-spaced">Date</label>
                    <input type="date" id="fullCalAcademicDate" class="teacher-modal-input">
                    <label class="teacher-modal-label full-cal-form-label-spaced">Event Type</label>
                    <select id="fullCalAcademicType" class="teacher-modal-input">
                        <option value="test">Test</option>
                        <option value="exam">Exam</option>
                        <option value="holiday">Holiday</option>
                        <option value="event">School Event</option>
                        <option value="other">Other</option>
                    </select>
                    <label class="teacher-modal-label full-cal-form-label-spaced">Class</label>
                    <select id="fullCalAcademicClass" class="teacher-modal-input">
                        <option value="">Loading classes...</option>
                    </select>
                    <div id="fullCalAcademicError" class="full-cal-modal-error"></div>
                    <div class="full-cal-modal-actions">
                        <button onclick="closeFullCalModal()" class="teacher-modal-cancel full-cal-modal-btn-half">Cancel</button>
                        <button onclick="saveFullCalAcademic()" class="teacher-modal-submit full-cal-modal-btn-half">Post Event</button>
                    </div>
                </div>
            </div>
        </div>`;
}

// ── BIND NAV BUTTONS after render ──
function bindCalendarPageNav() {
    const prev = document.getElementById('fullCalPrev');
    const next = document.getElementById('fullCalNext');
    if (prev) prev.addEventListener('click', fullCalPrev);
    if (next) next.addEventListener('click', fullCalNext);
}

window.fullCalPrev = async function () {
    let { month, year } = window.calendarPageState;
    month--;
    if (month < 1) { month = 12; year--; }
    await renderFullCalendarPage(month, year);
};

window.fullCalNext = async function () {
    let { month, year } = window.calendarPageState;
    month++;
    if (month > 12) { month = 1; year++; }
    await renderFullCalendarPage(month, year);
};

// ── MODAL CONTROLS ──
window.openFullCalReminderModal = function (dateStr = '') {
    const modal = document.getElementById('fullCalModal');
    if (!modal) return;

    // Reset fields
    const rTitle = document.getElementById('fullCalReminderTitle');
    const rDate  = document.getElementById('fullCalReminderDate');
    const rErr   = document.getElementById('fullCalReminderError');
    const aTitle = document.getElementById('fullCalAcademicTitle');
    const aDate  = document.getElementById('fullCalAcademicDate');
    const aErr   = document.getElementById('fullCalAcademicError');

    if (rTitle) rTitle.value = '';
    if (rDate)  rDate.value  = dateStr;
    if (rErr)   { rErr.textContent = ''; rErr.style.display = 'none'; }
    if (aTitle) aTitle.value = '';
    if (aDate)  aDate.value  = dateStr;
    if (aErr)   { aErr.textContent = ''; aErr.style.display = 'none'; }

    switchFullCalTab('reminder');
    loadFullCalClasses();
    modal.classList.add('open');
};

window.closeFullCalModal = function () {
    const modal = document.getElementById('fullCalModal');
    if (modal) modal.classList.remove('open');
};

window.switchFullCalTab = function (tab) {
    const isReminder = tab === 'reminder';
    const rTab = document.getElementById('fullCalTabReminder');
    const aTab = document.getElementById('fullCalTabAcademic');
    const rBtn = document.getElementById('fullCalTabReminderBtn');
    const aBtn = document.getElementById('fullCalTabAcademicBtn');

    if (rTab) rTab.classList.toggle('full-cal-tab-panel-hidden', !isReminder);
    if (aTab) aTab.classList.toggle('full-cal-tab-panel-hidden', isReminder);

    if (rBtn) rBtn.classList.toggle('active', isReminder);
    if (aBtn) aBtn.classList.toggle('active', !isReminder);
};

async function loadFullCalClasses() {
    const select = document.getElementById('fullCalAcademicClass');
    if (!select) return;
    try {
        const res     = await fetch('api/teacher/get_classes.php');
        const classes = await res.json();
        select.innerHTML = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch (e) {
        select.innerHTML = '<option value="">Failed to load</option>';
    }
}

window.saveFullCalReminder = async function () {
    const title = document.getElementById('fullCalReminderTitle').value.trim();
    const date  = document.getElementById('fullCalReminderDate').value;
    const err   = document.getElementById('fullCalReminderError');

    err.style.display = 'none';

    if (!title) { err.textContent = 'Please enter a title.'; err.style.display = 'block'; return; }
    if (!date)  { err.textContent = 'Please select a date.';  err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_reminder.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body:    JSON.stringify({ title, date })
        });
        const data = await res.json();
        if (data.success) {
            closeFullCalModal();
            delete window.teacherCalendarEventsCache[teacherCalendarCacheKey(
                window.calendarPageState.month,
                window.calendarPageState.year
            )];
            await renderFullCalendarPage(
                window.calendarPageState.month,
                window.calendarPageState.year
            );
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};

window.saveFullCalAcademic = async function () {
    const title     = document.getElementById('fullCalAcademicTitle').value.trim();
    const date      = document.getElementById('fullCalAcademicDate').value;
    const eventType = document.getElementById('fullCalAcademicType').value;
    const classId   = document.getElementById('fullCalAcademicClass').value;
    const err       = document.getElementById('fullCalAcademicError');

    err.style.display = 'none';

    if (!title)   { err.textContent = 'Please enter a title.';  err.style.display = 'block'; return; }
    if (!date)    { err.textContent = 'Please select a date.';  err.style.display = 'block'; return; }
    if (!classId) { err.textContent = 'Please select a class.'; err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_academic_event.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body:    JSON.stringify({
                title,
                event_date: date,
                event_type: eventType,
                class_id:   parseInt(classId)
            })
        });
        const data = await res.json();
        if (data.success) {
            closeFullCalModal();
            delete window.teacherCalendarEventsCache[teacherCalendarCacheKey(
                window.calendarPageState.month,
                window.calendarPageState.year
            )];
            await renderFullCalendarPage(
                window.calendarPageState.month,
                window.calendarPageState.year
            );
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};

// Close modal on backdrop click
document.addEventListener('click', function (e) {
    const modal = document.getElementById('fullCalModal');
    if (modal && e.target === modal) closeFullCalModal();
});