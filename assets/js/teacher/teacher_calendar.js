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
                <span class="full-cal-legend-dot" style="background:#4fd1c5"></span> Quiz
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot" style="background:#a78bfa"></span> Assignment
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot" style="background:#f59e0b"></span> Reminder
            </span>
            <span class="full-cal-legend-item">
                <span class="full-cal-legend-dot" style="background:#f472b6"></span> Academic
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
            const colors = {
                quiz:       { bg: 'rgba(79,209,197,0.15)',  text: '#4fd1c5' },
                assignment: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
                reminder:   { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
                academic:   { bg: 'rgba(244,114,182,0.15)', text: '#f472b6' },
            };
            const c = colors[e.type] || colors.reminder;
            const label = e.class_name
                ? `${e.title} <span style="opacity:0.6;font-weight:600">— ${e.class_name}</span>`
                : e.title;
            return `<div class="full-cal-pill" style="background:${c.bg};color:${c.text}">${label}</div>`;
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
        <style>
            /* ── FULL CALENDAR PAGE STYLES ── */
            .full-cal-page-wrapper {
                display: flex;
                flex-direction: column;
                gap: 0;
            }

            .full-cal-topbar {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 12px;
            }

            .full-cal-header-left {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .full-cal-page-title {
                font-size: 22px;
                font-weight: 900;
                color: #4fd1c5;
                margin: 0;
            }

            .full-cal-legend {
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
            }

            .full-cal-legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                font-weight: 700;
                color: #8b949e;
            }

            .full-cal-legend-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }

            .full-cal-add-btn {
                display: flex;
                align-items: center;
                gap: 7px;
                background: #4fd1c5;
                color: #0d1117;
                border: none;
                padding: 10px 16px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
                transition: background 0.2s;
                font-family: 'Nunito', sans-serif;
            }

            .full-cal-add-btn:hover { background: #3ab8ae; }

            .full-cal-body {
                display: flex;
                gap: 20px;
                align-items: flex-start;
            }

            .full-cal-main {
                flex: 1;
                min-width: 0;
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 16px;
                overflow: hidden;
            }

            .full-cal-nav-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            .full-cal-nav-btn {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                color: #8b949e;
                width: 34px;
                height: 34px;
                border-radius: 8px;
                font-size: 22px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                transition: all 0.2s;
                font-family: 'Nunito', sans-serif;
            }

            .full-cal-nav-btn:hover {
                background: rgba(79,209,197,0.1);
                border-color: rgba(79,209,197,0.3);
                color: #4fd1c5;
            }

            .full-cal-month-label {
                font-size: 17px;
                font-weight: 900;
                color: #e2e8f0;
            }

            .full-cal-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            .full-cal-day-header {
                text-align: center;
                font-size: 11px;
                font-weight: 800;
                color: #555e6a;
                padding: 10px 4px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                border-right: 1px solid rgba(255,255,255,0.03);
            }

            .full-cal-day-header:last-child { border-right: none; }

            .full-cal-cells {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
            }

            .full-cal-cell {
                min-height: 90px;
                padding: 8px;
                border-right: 1px solid rgba(255,255,255,0.04);
                border-bottom: 1px solid rgba(255,255,255,0.04);
                cursor: pointer;
                transition: background 0.2s;
                display: flex;
                flex-direction: column;
                gap: 4px;
                position: relative;
            }

            .full-cal-cell:hover {
                background: rgba(255,255,255,0.03);
            }

            .full-cal-cell:nth-child(7n) { border-right: none; }

            .full-cal-cell-empty {
                cursor: default;
                background: rgba(0,0,0,0.1);
                pointer-events: none;
            }

            .full-cal-cell-today {
                background: rgba(79,209,197,0.05);
            }

            .full-cal-cell-today:hover {
                background: rgba(79,209,197,0.08);
            }

            .full-cal-cell-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .full-cal-day-num {
                font-size: 13px;
                font-weight: 700;
                color: #8b949e;
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
                flex-shrink: 0;
            }

            .full-cal-cell-today .full-cal-day-num {
                background: #4fd1c5;
                color: #0d1117;
                font-weight: 900;
            }

            .full-cal-cell-has-events .full-cal-day-num {
                color: #e2e8f0;
            }

            .full-cal-dots {
                display: flex;
                gap: 3px;
                align-items: center;
            }

            .full-cal-pills {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .full-cal-pill {
                font-size: 11px;
                font-weight: 700;
                padding: 3px 7px;
                border-radius: 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.4;
            }

            .full-cal-pill-more {
                background: rgba(255,255,255,0.05) !important;
                color: #8b949e !important;
                font-size: 10px;
                font-weight: 700;
            }

            /* ── UPCOMING PANEL ── */
            .full-cal-upcoming {
                width: 260px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .full-cal-upcoming-title {
                font-size: 11px;
                font-weight: 800;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 4px;
            }

            .full-cal-upcoming-card {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
                padding: 12px 14px;
                transition: border-color 0.2s, transform 0.2s;
            }

            .full-cal-upcoming-card:hover {
                border-color: rgba(79,209,197,0.2);
                transform: translateY(-2px);
            }

            .full-cal-upcoming-type {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 5px;
            }

            .full-cal-upcoming-title-text {
                font-size: 13px;
                font-weight: 700;
                color: #e2e8f0;
                margin-bottom: 5px;
                line-height: 1.3;
            }

            .full-cal-upcoming-meta {
                font-size: 11px;
                color: #555e6a;
            }

            .full-cal-upcoming-date {
                font-size: 12px;
                font-weight: 800;
                margin-top: 6px;
            }

            .full-cal-upcoming-empty {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                font-size: 13px;
                color: #555e6a;
            }

            /* ── MODAL (full-page version) ── */
            #fullCalModal {
                display: none;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.65);
                backdrop-filter: blur(4px);
                z-index: 9998;
                align-items: center;
                justify-content: center;
            }

            #fullCalModal.open {
                display: flex;
            }

            .full-cal-modal-box {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                padding: 24px;
                width: 340px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            }

            .full-cal-modal-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .full-cal-modal-head span {
                font-weight: 900;
                color: #e2e8f0;
                font-size: 15px;
            }

            .full-cal-modal-close {
                background: none;
                border: none;
                color: #8b949e;
                font-size: 22px;
                cursor: pointer;
                line-height: 1;
                font-family: 'Nunito', sans-serif;
            }

            .full-cal-modal-close:hover { color: #e2e8f0; }

            .full-cal-tab-row {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
            }

            .full-cal-tab-btn {
                flex: 1;
                padding: 8px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Nunito', sans-serif;
            }

            .full-cal-modal-error {
                color: #f85149;
                font-size: 13px;
                margin-top: 8px;
                display: none;
            }

            .full-cal-modal-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            /* ── RESPONSIVE ── */
            @media (max-width: 900px) {
                .full-cal-body { flex-direction: column; }
                .full-cal-upcoming { width: 100%; }
            }

            @media (max-width: 600px) {
                .full-cal-cell { min-height: 56px; padding: 4px; }
                .full-cal-pill { display: none; }
                .full-cal-cell-has-events .full-cal-dots { display: flex; }
                .full-cal-topbar { flex-direction: column; align-items: flex-start; }
            }
        </style>

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
        quiz:       { label: 'Quiz',       color: '#4fd1c5' },
        assignment: { label: 'Assignment', color: '#a78bfa' },
        reminder:   { label: 'Reminder',   color: '#f59e0b' },
        academic:   { label: 'Academic',   color: '#f472b6' },
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
                <div class="full-cal-upcoming-type" style="color:${cfg.color}">${cfg.label}</div>
                <div class="full-cal-upcoming-title-text">${e.title}</div>
                ${meta ? `<div class="full-cal-upcoming-meta">${meta}</div>` : ''}
                <div class="full-cal-upcoming-date" style="color:${cfg.color}">${dateLabel}</div>
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
                        class="full-cal-tab-btn"
                        style="border:1px solid #4fd1c5;background:rgba(79,209,197,0.15);color:#4fd1c5;">
                        Personal Reminder
                    </button>
                    <button id="fullCalTabAcademicBtn"
                        onclick="switchFullCalTab('academic')"
                        class="full-cal-tab-btn"
                        style="border:1px solid rgba(255,255,255,0.1);background:transparent;color:#8b949e;">
                        Academic Event
                    </button>
                </div>

                <!-- Reminder Tab -->
                <div id="fullCalTabReminder">
                    <label class="teacher-modal-label">Reminder Title</label>
                    <input type="text" id="fullCalReminderTitle" class="teacher-modal-input" placeholder="e.g. Prepare test papers">
                    <label class="teacher-modal-label" style="margin-top:12px;">Date</label>
                    <input type="date" id="fullCalReminderDate" class="teacher-modal-input">
                    <div id="fullCalReminderError" class="full-cal-modal-error"></div>
                    <div class="full-cal-modal-actions">
                        <button onclick="closeFullCalModal()" class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                        <button onclick="saveFullCalReminder()" class="teacher-modal-submit" style="flex:1;">Save</button>
                    </div>
                </div>

                <!-- Academic Tab -->
                <div id="fullCalTabAcademic" style="display:none;">
                    <label class="teacher-modal-label">Event Title</label>
                    <input type="text" id="fullCalAcademicTitle" class="teacher-modal-input" placeholder="e.g. Term 2 Test Week">
                    <label class="teacher-modal-label" style="margin-top:12px;">Date</label>
                    <input type="date" id="fullCalAcademicDate" class="teacher-modal-input">
                    <label class="teacher-modal-label" style="margin-top:12px;">Event Type</label>
                    <select id="fullCalAcademicType" class="teacher-modal-input">
                        <option value="test">Test</option>
                        <option value="exam">Exam</option>
                        <option value="holiday">Holiday</option>
                        <option value="event">School Event</option>
                        <option value="other">Other</option>
                    </select>
                    <label class="teacher-modal-label" style="margin-top:12px;">Class</label>
                    <select id="fullCalAcademicClass" class="teacher-modal-input">
                        <option value="">Loading classes...</option>
                    </select>
                    <div id="fullCalAcademicError" class="full-cal-modal-error"></div>
                    <div class="full-cal-modal-actions">
                        <button onclick="closeFullCalModal()" class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                        <button onclick="saveFullCalAcademic()" class="teacher-modal-submit" style="flex:1;">Post Event</button>
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

    if (rTab) rTab.style.display = isReminder ? 'block' : 'none';
    if (aTab) aTab.style.display = isReminder ? 'none'  : 'block';

    if (rBtn) {
        rBtn.style.background   = isReminder ? 'rgba(79,209,197,0.15)' : 'transparent';
        rBtn.style.borderColor  = isReminder ? '#4fd1c5' : 'rgba(255,255,255,0.1)';
        rBtn.style.color        = isReminder ? '#4fd1c5' : '#8b949e';
    }
    if (aBtn) {
        aBtn.style.background   = isReminder ? 'transparent' : 'rgba(244,114,182,0.15)';
        aBtn.style.borderColor  = isReminder ? 'rgba(255,255,255,0.1)' : '#f472b6';
        aBtn.style.color        = isReminder ? '#8b949e' : '#f472b6';
    }
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