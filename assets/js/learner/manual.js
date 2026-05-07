window.manualCache       = null;
window.homeDataCache     = null;
window.learnerCalState   = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
window.learnerCalEvents  = [];

window.loadManual = async function(containerId = 'api-content-area') {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    sessionStorage.setItem("lastLearnerPage", "partials/manual.html");
    if (typeof window.setActive === 'function') window.setActive("partials/manual.html");

    if (window.configureHeader) {
        window.configureHeader({ title: 'Home', mode: 'standard' });
    }

    const apiArea        = document.getElementById(containerId);
    const iframe         = document.getElementById('mainFrame');
    const loader         = document.getElementById('loaderOverlay');
    const myClassContent = document.getElementById('myClassContent');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    // Serve from cache instantly
    if (window.manualCache && window.homeDataCache) {
        apiArea.innerHTML = buildHomeLayout(window.homeDataCache, window.manualCache);
        afterHomeRender();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const [manualRes, homeRes, classRes] = await Promise.all([
            fetch('partials/manual.html?v=1.1'),
            fetch('api/learner/get_home_data.php'),
            fetch('api/learner/get_my_class.php')
        ]);

        const manualHtml = await manualRes.text();
        const homeData   = await homeRes.json();
        const classData  = classRes.ok ? await classRes.json().catch(() => null) : null;
        if (classData) homeData.myClass = classData;

        if (!document.getElementById('manual-style')) {
            const link  = document.createElement('link');
            link.id     = 'manual-style';
            link.rel    = 'stylesheet';
            link.href   = 'assets/css/manual.css';
            document.head.appendChild(link);
        }

        window.manualCache   = manualHtml;
        window.homeDataCache = homeData;

        apiArea.innerHTML = buildHomeLayout(homeData, manualHtml);
        afterHomeRender();

    } catch (error) {
        console.error('Home load failed:', error);
        apiArea.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">
            Could not load home screen.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// Called after home HTML is injected — loads calendar on desktop only
function afterHomeRender() {
    if (window.innerWidth > 768) {
        window.loadLearnerCalendar(
            window.learnerCalState.month,
            window.learnerCalState.year
        );
          if (typeof window.showLearnerCalIcon === 'function') window.showLearnerCalIcon();

    }
}

// ─────────────────────────────────────────────
// BUILD LAYOUT
// ─────────────────────────────────────────────
function buildHomeLayout(data, manualHtml) {
    const todo   = data.todo   || [];
    const recent = data.recent || [];

    // Cap both at 4
    const todoSlice   = todo.slice(0, 4);
    const recentSlice = recent.slice(0, 4);

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // ── MOBILE: GitHub-style stacked layout ──
        return `
        <div class="lh-mobile-wrapper">

            <!-- MY CLASS CARD -->
            ${buildMobileClassCard(data.myClass)}

            <!-- TO-DO SECTION -->
            <div class="lh-section">
                <div class="lh-section-header">
                    <div class="lh-section-title">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4fd1c5" stroke-width="2.5" fill="none" style="flex-shrink:0;">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        To-Do
                    </div>
                    ${todoSlice.length > 0 ? `<span class="lh-badge">${todoSlice.length}</span>` : ''}
                </div>
                <div class="lh-card">
                    ${buildMobileTodo(todoSlice)}
                </div>
            </div>

            <!-- RECENTS SECTION -->
            <div class="lh-section">
                <div class="lh-section-header">
                    <div class="lh-section-title">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#f28c38" stroke-width="2.5" fill="none" style="flex-shrink:0;">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Recent
                    </div>
                </div>
                <div class="lh-card">
                    ${buildMobileRecent(recentSlice)}
                </div>
            </div>

        </div>`;
    }

    // ── DESKTOP: existing split layout ──
    return `
        <div class="learner-home-wrapper">

            <!-- LEFT COLUMN -->
            <div class="learner-home-left">

                <!-- RECENT ACTIVITY -->
                <div class="learner-home-panel">
                    <div class="learner-home-panel-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#f28c38" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Recent Activity
                    </div>
                    ${buildRecentActivity(recentSlice)}
                </div>

                <!-- TO-DO (capped at 4) -->
                <div class="learner-home-panel" style="margin-top:16px;">
                    <div class="learner-home-panel-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                        To-Do
                    </div>
                    ${buildTodoList(todoSlice)}
                </div>

                <!-- CALENDAR (desktop only — populated by loadLearnerCalendar) -->
                <div class="learner-home-panel learner-cal-panel" style="margin-top:16px; display:none;">
                    <div class="learner-home-panel-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        My Calendar
                    </div>
                    <div id="learner-cal-container">
                        <div style="text-align:center;padding:20px;color:#8b949e;font-size:13px;">Loading...</div>
                    </div>
                </div>

            </div>

            <!-- RIGHT COLUMN: MANUAL -->
            <div class="learner-home-right">
                ${manualHtml}
            </div>

        </div>`;
}

// ─────────────────────────────────────────────
// MOBILE CLASS CARD
// ─────────────────────────────────────────────
function buildMobileClassCard(myClass) {
    if (!myClass || !myClass.name) {
        // Not joined yet — show a prompt card
        return `
            <div class="lh-class-card lh-class-empty" onclick="window.showMyClass ? showMyClass() : null">
                <div class="lh-class-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#48bb78" stroke-width="2" fill="none">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                </div>
                <div class="lh-class-body">
                    <div class="lh-class-name">No class joined yet</div>
                    <div class="lh-class-sub">Tap to join a class</div>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4a5568" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>`;
    }

    return `
        <div class="lh-class-card">
            <div class="lh-class-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#48bb78" stroke-width="2" fill="none">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
            </div>
            <div class="lh-class-body">
                <div class="lh-class-label">My Class</div>
                <div class="lh-class-name">${myClass.name}</div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// MOBILE TO-DO
// ─────────────────────────────────────────────
function buildMobileTodo(todo) {
    if (!todo.length) {
        return `
            <div class="lh-empty-state">
                <div class="lh-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                </div>
                <div class="lh-empty-title">You're all caught up</div>
                <div class="lh-empty-desc">Quizzes and assignments that need your attention will appear here.</div>
            </div>`;
    }

    const colorMap = {
        quiz:       '#4fd1c5',
        assignment: '#a78bfa',
        evaluation: '#f28c38'
    };
    const labelMap = {
        quiz:       'Quiz',
        assignment: 'Assignment',
        evaluation: 'Evaluation'
    };
    const actionMap = {
        quiz:       'window.learnerQuizCache=null; fetchQuizzes()',
        assignment: 'window.learnerAssignmentCache=null; fetchAssignments()',
        evaluation: 'window.evaluationCache=null; fetchEvaluations()'
    };
    const iconMap = {
        quiz: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
        assignment: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        evaluation: `<polygon points="12 2 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8 12 2"/>`
    };

    return todo.map((item, i) => {
        const color  = colorMap[item.type]  || '#4fd1c5';
        const label  = labelMap[item.type]  || item.type;
        const action = actionMap[item.type] || '';
        const icon   = iconMap[item.type]   || iconMap.quiz;
        const isLast = i === todo.length - 1;

        return `
            <div class="lh-row${isLast ? ' lh-row-last' : ''}" onclick="${action}">
                <div class="lh-row-icon" style="background:${color}18; border-color:${color}30;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="${color}" stroke-width="2" fill="none">
                        ${icon}
                    </svg>
                </div>
                <div class="lh-row-body">
                    <div class="lh-row-title">${item.title}</div>
                    <div class="lh-row-meta">
                        <span class="lh-type-tag" style="color:${color}; background:${color}18;">${label}</span>
                        <span>${item.meta}</span>
                    </div>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4a5568" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>`;
    }).join('');
}

// ─────────────────────────────────────────────
// MOBILE RECENT
// ─────────────────────────────────────────────
function buildMobileRecent(recent) {
    if (!recent.length) {
        return `
            <div class="lh-empty-state">
                <div class="lh-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="#f28c38" stroke-width="1.5" fill="none">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <div class="lh-empty-title">Nothing yet</div>
                <div class="lh-empty-desc">Announcements, resources, and assignments posted to your class will show up here.</div>
            </div>`;
    }

    const colorMap = {
        announcement: '#4fd1c5',
        resource:     '#f28c38',
        assignment:   '#a78bfa',
        quiz:         '#fdd663'
    };
    const actionMap = {
        announcement: 'fetchAnnouncements()',
        resource:     'fetchResources()',
        assignment:   'fetchAssignments()',
        quiz:         'window.learnerQuizCache=null; fetchQuizzes()'
    };
    const iconMap = {
        announcement: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
        resource:     `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
        assignment:   `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        quiz:         `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
    };

    return recent.map((item, i) => {
        const color  = colorMap[item.type]  || '#4fd1c5';
        const action = actionMap[item.type] || '';
        const icon   = iconMap[item.type]   || iconMap.announcement;
        const isLast = i === recent.length - 1;

        return `
            <div class="lh-row${isLast ? ' lh-row-last' : ''}" onclick="${action}">
                <div class="lh-row-icon" style="background:${color}18; border-color:${color}30;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="${color}" stroke-width="2" fill="none">
                        ${icon}
                    </svg>
                </div>
                <div class="lh-row-body">
                    <div class="lh-row-title">${item.title}</div>
                    <div class="lh-row-meta">
                        <span>${item.meta}</span>
                        <span class="lh-dot-sep">·</span>
                        <span>${item.time_ago}</span>
                    </div>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="#4a5568" stroke-width="2" fill="none" style="flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>`;
    }).join('');
}

// ─────────────────────────────────────────────
// LEARNER CALENDAR
// ─────────────────────────────────────────────
window.loadLearnerCalendar = async function(month, year) {
    // Only show on desktop
    if (window.innerWidth <= 768) return;

    const panel     = document.querySelector('.learner-cal-panel');
    const container = document.getElementById('learner-cal-container');
    if (!panel || !container) return;

    panel.style.display = 'block';
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#8b949e;font-size:13px;">Loading...</div>`;

    try {
        const res  = await fetch(`api/learner/get_calendar_events.php?month=${month}&year=${year}`);
        const data = await res.json();
        window.learnerCalEvents = data.events || [];
        renderLearnerCalendar(month, year, window.learnerCalEvents);
    } catch(e) {
        container.innerHTML = `<div style="color:#ff5555;font-size:13px;text-align:center;">Failed to load calendar</div>`;
    }
};

function renderLearnerCalendar(month, year, events) {
    const container = document.getElementById('learner-cal-container');
    if (!container) return;

    const monthNames  = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const today       = new Date();
    const firstDay    = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

    // Group events by day
    const eventMap = {};
    events.forEach(e => {
        const day = parseInt(e.date.split('-')[2]);
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push(e);
    });

    let html = `
        <div class="cal-header">
            <button class="cal-nav" onclick="learnerCalPrev()">&#8249;</button>
            <span class="cal-month-title">${monthNames[month-1]} ${year}</span>
            <button class="cal-nav" onclick="learnerCalNext()">&#8250;</button>
        </div>
        <div class="cal-grid">
            <div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div>
            <div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div>
            <div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
            <div class="cal-day-label">Su</div>`;

    // Empty cells
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="cal-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday   = (d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear());
        const dayEvents = eventMap[d] || [];

        const hasAssignment   = dayEvents.some(e => e.type === 'assignment');
        const hasQuizDone     = dayEvents.some(e => e.subtype === 'quiz_done');
        const hasQuizUpcoming = dayEvents.some(e => e.subtype === 'quiz_upcoming');
        const hasAcademic     = dayEvents.some(e => e.type === 'academic');

        html += `
            <div class="cal-cell ${isToday ? 'cal-today' : ''} ${dayEvents.length > 0 ? 'cal-has-events' : ''}">
                <span class="cal-day-num">${d}</span>
                <div class="cal-dots">
                    ${hasAssignment   ? '<span class="cal-dot dot-assignment"></span>'    : ''}
                    ${hasQuizUpcoming ? '<span class="cal-dot dot-quiz"></span>'          : ''}
                    ${hasQuizDone     ? '<span class="cal-dot dot-quiz-done"></span>'     : ''}
                    ${hasAcademic     ? '<span class="cal-dot dot-academic"></span>'      : ''}
                </div>
                ${dayEvents.length > 0 ? `
                <div class="cal-tooltip">
                    ${dayEvents.map(e => {
                        // Pick icon + colour per type
                        const isAssignment   = e.type === 'assignment';
                        const isQuizDone     = e.subtype === 'quiz_done';
                        const isQuizUpcoming = e.subtype === 'quiz_upcoming';
                        const isAcademic     = e.type === 'academic';

                        const color = isAssignment   ? '#a78bfa'
                                    : isQuizUpcoming ? '#fdd663'
                                    : isQuizDone     ? '#4fd1c5'
                                    : '#f472b6'; // academic

                        const icon = isAssignment
                            ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="${color}" stroke-width="2" fill="none" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
                            : (isQuizDone || isQuizUpcoming)
                            ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="${color}" stroke-width="2" fill="none" style="flex-shrink:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
                            : `<svg viewBox="0 0 24 24" width="12" height="12" stroke="${color}" stroke-width="2" fill="none" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

                        return `
                            <div class="cal-tooltip-item" style="color:${color};">
                                ${icon}
                                <span>${e.tooltip}</span>
                            </div>`;
                    }).join('')}
                </div>` : ''}
            </div>`;
    }

    html += `</div>

        <!-- Dot Legend -->
        <div class="cal-legend">
            <span><span class="cal-dot dot-assignment"></span> Assignment</span>
            <span><span class="cal-dot dot-quiz"></span> Quiz</span>
            <span><span class="cal-dot dot-quiz-done"></span> Completed</span>
            <span><span class="cal-dot dot-academic"></span> Academic</span>
        </div>`;

    container.innerHTML = html;
}

window.learnerCalPrev = function() {
    let { month, year } = window.learnerCalState;
    month--;
    if (month < 1) { month = 12; year--; }
    window.learnerCalState = { month, year };
    window.loadLearnerCalendar(month, year);
};

window.learnerCalNext = function() {
    let { month, year } = window.learnerCalState;
    month++;
    if (month > 12) { month = 1; year++; }
    window.learnerCalState = { month, year };
    window.loadLearnerCalendar(month, year);
};

// ─────────────────────────────────────────────
// RECENT ACTIVITY
// ─────────────────────────────────────────────
function buildRecentActivity(recent) {
    if (!recent.length) {
        return `<div class="learner-home-empty">Nothing new in the last 7 days</div>`;
    }

    const iconMap = {
        announcement: {
            stroke: '#4fd1c5',
            path: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
        },
        resource: {
            stroke: '#f28c38',
            path: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`
        },
        assignment: {
            stroke: '#a78bfa',
            path: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`
        },
        quiz: {
            stroke: '#fdd663',
            path: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
        }
    };

    const actionMap = {
        announcement: 'fetchAnnouncements()',
        resource:     'fetchResources()',
        assignment:   'fetchAssignments()',
        quiz:         'window.learnerQuizCache=null; fetchQuizzes()'
    };

    return recent.map(item => {
        const icon   = iconMap[item.type] || iconMap.announcement;
        const action = actionMap[item.type] || '';
        return `
            <div class="learner-home-activity-item"
                 onclick="${action}"
                 style="cursor:pointer;">
                <div class="learner-home-activity-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="${icon.stroke}" stroke-width="2" fill="none">
                        ${icon.path}
                    </svg>
                </div>
                <div class="learner-home-activity-info">
                    <div class="learner-home-activity-title">${item.title}</div>
                    <div class="learner-home-activity-meta">${item.meta} &middot; ${item.time_ago}</div>
                </div>
            </div>`;
    }).join('');
}

// ─────────────────────────────────────────────
// TO-DO LIST
// ─────────────────────────────────────────────
function buildTodoList(todo) {
    if (!todo.length) {
        return `<div class="learner-home-empty">You're all caught up! 🎉</div>`;
    }

    const colorMap = {
        quiz:       '#4fd1c5',
        assignment: '#f28c38',
        evaluation: '#a78bfa'
    };

    const actionMap = {
        quiz:       'window.learnerQuizCache=null; fetchQuizzes()',
        assignment: 'window.learnerAssignmentCache=null; fetchAssignments()',
        evaluation: 'window.evaluationCache=null; fetchEvaluations()'
    };

    return todo.map(item => {
        const color  = colorMap[item.type] || '#4fd1c5';
        const action = actionMap[item.type] || '';
        return `
            <div class="learner-home-todo-item" onclick="${action}" style="--todo-color:${color}; cursor:pointer;">
                <div class="learner-home-todo-dot" style="background:${color};"></div>
                <div class="learner-home-todo-info">
                    <div class="learner-home-todo-title">${item.title}</div>
                    <div class="learner-home-todo-meta">${item.label} &middot; ${item.meta}</div>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="${color}" stroke-width="2" fill="none">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>`;
    }).join('');
}