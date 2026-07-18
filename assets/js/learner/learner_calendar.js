// ══════════════════════════════════════════════════════════════
//  LEARNER CALENDAR — Full Page (Read-Only)
//  Save as: assets/js/learner/learner_calendar.js
//  Include in learner_dashboard.php after other learner JS files
// ══════════════════════════════════════════════════════════════

window.learnerCalendarPageState = {
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
    events: []
};
window.learnerCalendarEventsCache = window.learnerCalendarEventsCache || {};
window.learnerCalendarEventsPromises = window.learnerCalendarEventsPromises || {};

function learnerCalendarCacheKey(month, year) {
    return `${year}-${month}`;
}

async function loadLearnerCalendarEvents(month, year) {
    const key = learnerCalendarCacheKey(month, year);
    if (window.learnerCalendarEventsCache[key]) return window.learnerCalendarEventsCache[key];

    if (!window.learnerCalendarEventsPromises[key]) {
        window.learnerCalendarEventsPromises[key] = fetch(`api/learner/get_calendar_events.php?month=${month}&year=${year}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch calendar events');
                return res.json();
            })
            .then(data => {
                window.learnerCalendarEventsCache[key] = data.events || [];
                return window.learnerCalendarEventsCache[key];
            })
            .finally(() => {
                delete window.learnerCalendarEventsPromises[key];
            });
    }

    return window.learnerCalendarEventsPromises[key];
}

function saveLearnerCalendarState() {
    const mainContent = document.querySelector('.main-content');
    const { month, year } = window.learnerCalendarPageState;
    const state = {
        month,
        year,
        scrollTop: mainContent ? mainContent.scrollTop : 0,
    };
    if (window.learnerPageState) window.learnerPageState.set('learner_calendar', state);
    else sessionStorage.setItem('learnerCalendarPageState', JSON.stringify(state));
}

function getSavedLearnerCalendarState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('learner_calendar')
            : JSON.parse(sessionStorage.getItem('learnerCalendarPageState') || '{}');
        return state && typeof state === 'object' ? state : {};
    } catch (e) {
        return {};
    }
}

function wireLearnerCalendarScrollState() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent || mainContent.dataset.lcalScrollState === '1') return;
    mainContent.dataset.lcalScrollState = '1';
    mainContent.addEventListener('scroll', () => window.learnerPageState.queueSave('learner_calendar', saveLearnerCalendarState), { passive: true });
}

// ── ENTRY POINT ──
window.fetchLearnerCalendar = async function () {
    sessionStorage.setItem('lastLearnerPage', 'learner_calendar');
    if (typeof window.setActive === 'function') window.setActive('learner_calendar');

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const myClass = document.getElementById('myClassContent');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClass) myClass.classList.remove('active');

    // Hide calendar icon when we leave home
    hideLearnerCalIcon();

    // Configure header — show back button, hide menu buttons
    if (window.configureHeader) {
        window.configureHeader({ title: 'Calendar', mode: 'detail' });
    }

    const savedState = getSavedLearnerCalendarState();
    const month = savedState.month || window.learnerCalendarPageState.month;
    const year = savedState.year || window.learnerCalendarPageState.year;
    const loader = document.getElementById('loaderOverlay');
    const isCached = Boolean(window.learnerCalendarEventsCache[learnerCalendarCacheKey(month, year)]);
    if (!isCached && loader) loader.style.display = 'flex';

    try {
        await renderLearnerCalendarPage(month, year);
    } finally {
        if (loader) loader.style.display = 'none';
    }
    requestAnimationFrame(() => {
        const mainContent = document.querySelector('.main-content');
        if (mainContent && Number.isFinite(savedState.scrollTop)) mainContent.scrollTop = savedState.scrollTop;
        wireLearnerCalendarScrollState();
        saveLearnerCalendarState();
    });
};

// ── MAIN RENDER ──
async function renderLearnerCalendarPage(month, year) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // Show skeleton instantly
    apiArea.innerHTML = buildLearnerCalShell(month, year, []);
    bindLearnerCalNav();

    try {
        window.learnerCalendarPageState.events = await loadLearnerCalendarEvents(month, year);
        window.learnerCalendarPageState.month  = month;
        window.learnerCalendarPageState.year   = year;
        saveLearnerCalendarState();
    } catch (e) {
        window.learnerCalendarPageState.events = [];
    }

    apiArea.innerHTML = buildLearnerCalShell(month, year, window.learnerCalendarPageState.events);
    bindLearnerCalNav();
    wireLearnerCalendarScrollState();
}

// ── HTML BUILDER ──
function buildLearnerCalShell(month, year, events) {
    const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    const today       = new Date();
    const firstDay    = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    // Group events by day
    const eventMap = {};
    (events || []).forEach(e => {
        const day = parseInt(e.date.split('-')[2], 10);
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push(e);
    });

    // ── Legend ──
    const legend = `
        <div class="lcal-legend">
            <span class="lcal-legend-item">
                <span class="lcal-legend-dot" style="background:#fdd663"></span> Quiz
            </span>
            <span class="lcal-legend-item">
                <span class="lcal-legend-dot" style="background:#a78bfa"></span> Assignment
            </span>
            <span class="lcal-legend-item">
                <span class="lcal-legend-dot" style="background:#f472b6"></span> Academic
            </span>
            <span class="lcal-legend-item">
                <span class="lcal-legend-dot" style="background:#22c55e"></span> Completed
            </span>
        </div>`;

    // ── Page header ──
    const header = `
        <div class="lcal-topbar">
            <div class="lcal-header-left">
                <h2 class="lcal-page-title">My Calendar</h2>
                ${legend}
            </div>
        </div>`;

    // ── Month nav ──
    const nav = `
        <div class="lcal-nav-row">
            <button class="lcal-nav-btn" id="lcalPrev">&#8249;</button>
            <span class="lcal-month-label">${monthNames[month - 1]} ${year}</span>
            <button class="lcal-nav-btn" id="lcalNext">&#8250;</button>
        </div>`;

    // ── Day headers ──
    const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        .map(d => `<div class="lcal-day-header">${d}</div>`)
        .join('');

    // ── Cells ──
    let cells = '';

    for (let i = 0; i < startOffset; i++) {
        cells += `<div class="lcal-cell lcal-cell-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (
            d === today.getDate() &&
            month === today.getMonth() + 1 &&
            year  === today.getFullYear()
        );

        const dayEvents = eventMap[d] || [];
        const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        // Dot flags
        const hasAssignment   = dayEvents.some(e => e.type === 'assignment');
        const hasQuizUpcoming = dayEvents.some(e => e.subtype === 'quiz_upcoming');
        const hasQuizDone     = dayEvents.some(e => e.subtype === 'quiz_done');
        const hasAcademic     = dayEvents.some(e => e.type === 'academic');

        // Pills — up to 3, then overflow
        const visibleEvents = dayEvents.slice(0, 3);
        const overflow      = dayEvents.length - 3;

        const pills = visibleEvents.map(e => {
            let bg, text;
            if (e.type === 'assignment') {
                bg = 'rgba(167,139,250,0.15)'; text = '#a78bfa';
            } else if (e.subtype === 'quiz_upcoming') {
                bg = 'rgba(253,214,99,0.15)';  text = '#fdd663';
            } else if (e.subtype === 'quiz_done') {
                bg = 'rgba(34,197,94,0.15)';   text = '#22c55e';
            } else {
                bg = 'rgba(244,114,182,0.15)'; text = '#f472b6';
            }
            return `<div class="lcal-pill" style="background:${bg};color:${text}">${e.tooltip || e.title || ''}</div>`;
        }).join('');

        const overflowPill = overflow > 0
            ? `<div class="lcal-pill lcal-pill-more">+${overflow} more</div>`
            : '';

        const dots = `
            <div class="lcal-dots">
                ${hasQuizUpcoming ? '<span class="lcal-dot" style="background:#fdd663"></span>' : ''}
                ${hasQuizDone     ? '<span class="lcal-dot" style="background:#22c55e"></span>'  : ''}
                ${hasAssignment   ? '<span class="lcal-dot" style="background:#a78bfa"></span>'  : ''}
                ${hasAcademic     ? '<span class="lcal-dot" style="background:#f472b6"></span>'  : ''}
            </div>`;

        cells += `
            <div class="lcal-cell ${isToday ? 'lcal-cell-today' : ''} ${dayEvents.length ? 'lcal-cell-has-events' : ''}">
                <div class="lcal-cell-top">
                    <span class="lcal-day-num">${d}</span>
                    ${dots}
                </div>
                <div class="lcal-pills">
                    ${pills}
                    ${overflowPill}
                </div>
            </div>`;
    }

    // ── Upcoming sidebar ──
    const upcomingHtml = buildLearnerUpcomingPanel(events, month, year);

    return `
        <style>
            /* ── LEARNER FULL CALENDAR STYLES ── */
            .lcal-topbar {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 12px;
            }

            .lcal-header-left {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .lcal-page-title {
                font-size: 22px;
                font-weight: 900;
                color: #4fd1c5;
                margin: 0;
            }

            .lcal-legend {
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
            }

            .lcal-legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                font-weight: 700;
                color: #8b949e;
            }

            .lcal-legend-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }

            .lcal-body {
                display: flex;
                gap: 20px;
                align-items: flex-start;
            }

            .lcal-main {
                flex: 1;
                min-width: 0;
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 16px;
                overflow: hidden;
            }

            .lcal-nav-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            .lcal-nav-btn {
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

            .lcal-nav-btn:hover {
                background: rgba(79,209,197,0.1);
                border-color: rgba(79,209,197,0.3);
                color: #4fd1c5;
            }

            .lcal-month-label {
                font-size: 17px;
                font-weight: 900;
                color: #e2e8f0;
            }

            .lcal-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            .lcal-day-header {
                text-align: center;
                font-size: 11px;
                font-weight: 800;
                color: #555e6a;
                padding: 10px 4px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                border-right: 1px solid rgba(255,255,255,0.03);
            }

            .lcal-day-header:last-child { border-right: none; }

            .lcal-cells {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
            }

            .lcal-cell {
                min-height: 90px;
                padding: 8px;
                border-right: 1px solid rgba(255,255,255,0.04);
                border-bottom: 1px solid rgba(255,255,255,0.04);
                display: flex;
                flex-direction: column;
                gap: 4px;
                transition: background 0.2s;
            }

            .lcal-cell:nth-child(7n) { border-right: none; }

            .lcal-cell-empty {
                background: rgba(0,0,0,0.1);
            }

            .lcal-cell-today {
                background: rgba(79,209,197,0.05);
            }

            .lcal-cell-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .lcal-day-num {
                font-size: 13px;
                font-weight: 700;
                color: #8b949e;
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .lcal-cell-today .lcal-day-num {
                background: #4fd1c5;
                color: #0d1117;
                font-weight: 900;
            }

            .lcal-cell-has-events .lcal-day-num {
                color: #e2e8f0;
            }

            .lcal-dots {
                display: flex;
                gap: 3px;
                align-items: center;
            }

            .lcal-dot {
                width: 5px;
                height: 5px;
                border-radius: 50%;
                display: block;
                flex-shrink: 0;
            }

            .lcal-pills {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .lcal-pill {
                font-size: 11px;
                font-weight: 700;
                padding: 3px 7px;
                border-radius: 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.4;
            }

            .lcal-pill-more {
                background: rgba(255,255,255,0.05) !important;
                color: #8b949e !important;
                font-size: 10px;
            }

            /* ── UPCOMING PANEL ── */
            .lcal-upcoming {
                width: 260px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .lcal-upcoming-title {
                font-size: 11px;
                font-weight: 800;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 4px;
            }

            .lcal-upcoming-card {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
                padding: 12px 14px;
                transition: border-color 0.2s, transform 0.2s;
            }

            .lcal-upcoming-card:hover {
                border-color: rgba(79,209,197,0.2);
                transform: translateY(-2px);
            }

            .lcal-upcoming-type {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 5px;
            }

            .lcal-upcoming-title-text {
                font-size: 13px;
                font-weight: 700;
                color: #e2e8f0;
                margin-bottom: 5px;
                line-height: 1.3;
            }

            .lcal-upcoming-meta {
                font-size: 11px;
                color: #555e6a;
            }

            .lcal-upcoming-date {
                font-size: 12px;
                font-weight: 800;
                margin-top: 6px;
            }

            .lcal-upcoming-empty {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.06);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                font-size: 13px;
                color: #555e6a;
            }

            /* ── RESPONSIVE ── */
            @media (max-width: 900px) {
                .lcal-body { flex-direction: column; }
                .lcal-main { width: 100%; }
                .lcal-upcoming { width: 100%; }
            }

            @media (max-width: 600px) {
                .lcal-cell { min-height: 56px; padding: 4px; }
                .lcal-pill { display: none; }
                .lcal-topbar { flex-direction: column; align-items: flex-start; }
                .lcal-main { width: 100%; }
                .lcal-grid,
                .lcal-cells { width: 100%; }

                /* Mobile: lighter flat surface, no border, matching the rest of the app */
                .lcal-main {
                    background: #272726;
                    border: none;
                }
                .lcal-upcoming-card,
                .lcal-upcoming-empty {
                    background: #272726;
                    border: none;
                }
                .lcal-upcoming-card:hover {
                    border-color: transparent;
                }
            }
        </style>

        <div>
            ${header}
            <div class="lcal-body">
                <div class="lcal-main">
                    ${nav}
                    <div class="lcal-grid">${dayHeaders}</div>
                    <div class="lcal-cells">${cells}</div>
                </div>
                <div class="lcal-upcoming">
                    ${upcomingHtml}
                </div>
            </div>
        </div>`;
}

// ── UPCOMING PANEL ──
function buildLearnerUpcomingPanel(events, month, year) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = (events || [])
        .filter(e => new Date(e.date + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 8);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (!upcoming.length) {
        return `
            <div class="lcal-upcoming-title">Upcoming</div>
            <div class="lcal-upcoming-empty">Nothing coming up this month</div>`;
    }

    const cards = upcoming.map(e => {
        let color, typeLabel;
        if (e.type === 'assignment') {
            color = '#a78bfa'; typeLabel = 'Assignment';
        } else if (e.subtype === 'quiz_upcoming') {
            color = '#fdd663'; typeLabel = 'Quiz';
        } else if (e.subtype === 'quiz_done') {
            color = '#22c55e'; typeLabel = 'Quiz (Done)';
        } else {
            color = '#f472b6'; typeLabel = 'Academic';
        }

        const d         = new Date(e.date + 'T00:00:00');
        const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        const meta      = e.class_name || '';

        return `
            <div class="lcal-upcoming-card">
                <div class="lcal-upcoming-type" style="color:${color}">${typeLabel}</div>
                <div class="lcal-upcoming-title-text">${e.tooltip || e.title || ''}</div>
                ${meta ? `<div class="lcal-upcoming-meta">${meta}</div>` : ''}
                <div class="lcal-upcoming-date" style="color:${color}">${dateLabel}</div>
            </div>`;
    }).join('');

    return `
        <div class="lcal-upcoming-title">Upcoming</div>
        ${cards}`;
}

// ── NAV BINDING ──
function bindLearnerCalNav() {
    const prev = document.getElementById('lcalPrev');
    const next = document.getElementById('lcalNext');
    if (prev) prev.addEventListener('click', learnerCalPagePrev);
    if (next) next.addEventListener('click', learnerCalPageNext);
}

window.learnerCalPagePrev = async function () {
    let { month, year } = window.learnerCalendarPageState;
    month--;
    if (month < 1) { month = 12; year--; }
    await renderLearnerCalendarPage(month, year);
    saveLearnerCalendarState();
};

window.learnerCalPageNext = async function () {
    let { month, year } = window.learnerCalendarPageState;
    month++;
    if (month > 12) { month = 1; year++; }
    await renderLearnerCalendarPage(month, year);
    saveLearnerCalendarState();
};

// ══════════════════════════════════════════════════════════════
//  CALENDAR ICON IN HEADER
//  — Injects the icon into #headerRight
//  — Shown only on desktop, only when on home page
// ══════════════════════════════════════════════════════════════

function injectLearnerCalIcon() {
    // Don't inject twice
    if (document.getElementById('learnerCalIconBtn')) return;

    const headerRight = document.getElementById('headerRight');
    if (!headerRight) return;

    const btn = document.createElement('button');
    btn.id = 'learnerCalIconBtn';
    btn.title = 'My Calendar';
    btn.setAttribute('aria-label', 'Open calendar');
    btn.style.cssText = `
        display: none;
        background: none;
        border: none;
        color: #e2e8f0;
        cursor: pointer;
        padding: 8px;
        margin-right: 4px;
        border-radius: 8px;
        align-items: center;
        justify-content: center;
        transition: color 0.2s, background 0.2s;
    `;
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
             stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>`;

    btn.addEventListener('mouseenter', () => {
        btn.style.color = '#4fd1c5';
        btn.style.background = 'rgba(79,209,197,0.08)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.color = '#e2e8f0';
        btn.style.background = 'none';
    });
    btn.addEventListener('click', () => {
        window.fetchLearnerCalendar();
    });

    // Insert BEFORE the settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        headerRight.insertBefore(btn, settingsBtn);
    } else {
        headerRight.prepend(btn);
    }
}

// Show the icon (desktop only)
window.showLearnerCalIcon = function () {
    injectLearnerCalIcon();
    const btn = document.getElementById('learnerCalIconBtn');
    if (btn && window.innerWidth > 768) {
        btn.style.display = 'flex';
    }
};

// Hide the icon
window.hideLearnerCalIcon = function () {
    const btn = document.getElementById('learnerCalIconBtn');
    if (btn) btn.style.display = 'none';
};


// ── Hide icon when ANY other nav item is clicked ──
document.addEventListener('DOMContentLoaded', function () {
    // Intercept all sidebar/bottom-nav links
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {
            const onClick = link.getAttribute('onclick') || '';
            // Only hide if NOT going home
            if (!onClick.includes('loadManual')) {
                window.hideLearnerCalIcon();
            }
        });
    });

    // Also hide on settingsBtn click
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        window.hideLearnerCalIcon();
    });
});

// ── Restore on page refresh if last page was calendar ──
// (handled via sessionStorage in learner_dashboard.php)
// Add this to the savedPage restore chain in learner_dashboard.php:
//   } else if (savedPage === 'learner_calendar') {
//       window.fetchLearnerCalendar();
//   }
