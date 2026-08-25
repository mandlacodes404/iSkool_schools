window.manualCache       = null;
window.homeDataCache     = null;
window.learnerCalState   = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
window.learnerCalEvents  = [];
window.learnerCalEventsCache = window.learnerCalEventsCache || {}; // per-month cache: { "YYYY-M": events[] }

// Shared state-save queue for learner pages. Keeping it here means every
// learner section uses the same lightweight, debounced persistence logic.
(function addLearnerQueuedSaveSupport() {
    const state = window.learnerPageState;
    if (!state) return;

    state._queuedSaves = state._queuedSaves || {};
    state._saveTimers = state._saveTimers || {};
    state.queueSave = function(key, save) {
        if (typeof save !== 'function') return;
        this._queuedSaves[key] = save;
        clearTimeout(this._saveTimers[key]);
        this._saveTimers[key] = setTimeout(() => {
            const queuedSave = this._queuedSaves[key];
            delete this._queuedSaves[key];
            delete this._saveTimers[key];
            if (queuedSave) queuedSave();
        }, 150);
    };
    state.flushQueuedSaves = function() {
        Object.keys(this._queuedSaves).forEach(key => {
            clearTimeout(this._saveTimers[key]);
            const queuedSave = this._queuedSaves[key];
            delete this._queuedSaves[key];
            delete this._saveTimers[key];
            if (queuedSave) queuedSave();
        });
    };

    if (!window._learnerStateFlushWired) {
        window._learnerStateFlushWired = true;
        window.addEventListener('pagehide', () => window.learnerPageState.flushQueuedSaves());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') window.learnerPageState.flushQueuedSaves();
        });
    }
})();

function saveManualPageState(patch = {}) {
    const mainContent = document.querySelector('.main-content');
    const state = Object.assign({
        calendarMonth: window.learnerCalState.month,
        calendarYear: window.learnerCalState.year,
        scrollTop: mainContent ? mainContent.scrollTop : 0,
    }, patch);
    if (window.learnerPageState) window.learnerPageState.set('manual', state);
    else sessionStorage.setItem('manualPageState', JSON.stringify(state));
}

function getManualPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('manual')
            : JSON.parse(sessionStorage.getItem('manualPageState') || '{}');
        return state && typeof state === 'object' ? state : {};
    } catch (e) {
        return {};
    }
}

function restoreManualPageState() {
    const state = getManualPageState();
    if (!state || Object.keys(state).length === 0) return;
    if (Number.isFinite(state.calendarMonth) && Number.isFinite(state.calendarYear)) {
        window.learnerCalState = {
            month: state.calendarMonth,
            year: state.calendarYear
        };
    }
    requestAnimationFrame(() => {
        const mainContent = document.querySelector('.main-content');
        if (mainContent && Number.isFinite(state.scrollTop)) mainContent.scrollTop = state.scrollTop;
    });
}

function wireManualScrollState() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent || mainContent.dataset.manualScrollState === '1') return;
    mainContent.dataset.manualScrollState = '1';
    mainContent.addEventListener('scroll', () => {
        saveManualPageState();
    }, { passive: true });
}

function buildMobileHomeLoadingState() {
    return `
        <div aria-busy="true" aria-label="Loading home" style="padding:20px 16px 120px;">
            <div style="height:88px;border-radius:12px;background:rgba(255,255,255,0.05);margin-bottom:18px;"></div>
            <div style="height:18px;width:92px;border-radius:6px;background:rgba(255,255,255,0.08);margin-bottom:10px;"></div>
            <div style="height:146px;border-radius:12px;background:rgba(255,255,255,0.05);margin-bottom:18px;"></div>
            <div style="height:18px;width:72px;border-radius:6px;background:rgba(255,255,255,0.08);margin-bottom:10px;"></div>
            <div style="height:146px;border-radius:12px;background:rgba(255,255,255,0.05);"></div>
        </div>`;
}

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
    const isMobile       = window.innerWidth <= 768;

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    // Serve from cache instantly
    if (window.homeDataCache && (isMobile || window.manualCache)) {
        apiArea.innerHTML = buildHomeLayout(window.homeDataCache, window.manualCache);
        afterHomeRender();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && loader) loader.style.display = 'flex';

    // On a cold mobile launch, render an immediate placeholder instead of
    // leaving the API area empty while Home data is requested.
    if (isMobile && apiArea) apiArea.innerHTML = buildMobileHomeLoadingState();

    try {
        let manualHtml = '';
        let homeRes;
        let classRes;

        if (isMobile) {
            // The desktop-only manual fragment is not rendered in the mobile
            // Home layout, so do not wait for an unnecessary third request.
            [homeRes, classRes] = await Promise.all([
                fetch('api/learner/get_home_data.php'),
                fetch('api/learner/get_my_class.php')
            ]);
        } else {
            let manualRes;
            [manualRes, homeRes, classRes] = await Promise.all([
                fetch('partials/manual.html?v=1.1'),
                fetch('api/learner/get_home_data.php'),
                fetch('api/learner/get_my_class.php')
            ]);
            manualHtml = await manualRes.text();
        }

        const homeData   = await homeRes.json();
        const classData  = classRes.ok ? await classRes.json().catch(() => null) : null;
        if (classData) homeData.myClass = classData;

        const manualStyleHref = 'assets/css/learner/manual.css?v=5.9';
        const existingManualStyle = document.getElementById('manual-style');
        if (existingManualStyle) {
            existingManualStyle.href = manualStyleHref;
        } else {
            const link  = document.createElement('link');
            link.id     = 'manual-style';
            link.rel    = 'stylesheet';
            link.href   = manualStyleHref;
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

// ── Silent background prefetch for all learner pages ──
// Stagger them so they don't compete with whatever page is rendering right
// now. Pass the sessionStorage "lastLearnerPage" value (or equivalent) as
// `skipKey` to avoid double-fetching the page that's already being loaded
// directly — e.g. on refresh, the restored page gets its own real fetch,
// so there's no need to also prefetch it here.
window.kickOffLearnerPrefetches = function(skipKey) {
    const wants = (key) => !skipKey || !skipKey.includes(key);

    setTimeout(() => {
        if (wants('quiz_list.php')       && typeof window.prefetchQuizzes        === 'function') window.prefetchQuizzes();
        if (wants('assignment_list.php') && typeof window.prefetchAssignments    === 'function') window.prefetchAssignments();
    }, 1500);
    setTimeout(() => {
        if (wants('resource_list.php')     && typeof window.prefetchResources     === 'function') window.prefetchResources();
        if (wants('announcement_list.php') && typeof window.prefetchAnnouncements === 'function') window.prefetchAnnouncements();
    }, 3000);
    setTimeout(() => {
        if (wants('syllabus')            && typeof window.prefetchSyllabus       === 'function') window.prefetchSyllabus();
        if (wants('evaluation_list.php') && typeof window.prefetchEvaluations    === 'function') window.prefetchEvaluations();
        if (wants('discussion_list.php') && typeof window.prefetchDiscussions    === 'function') window.prefetchDiscussions();
    }, 5000);
};

// Called after home HTML is injected — loads calendar on desktop only, then kicks off prefetches
function afterHomeRender() {
    restoreManualPageState();
    wireManualScrollState();

    if (window.innerWidth > 768) {
        window.loadLearnerCalendar(
            window.learnerCalState.month,
            window.learnerCalState.year
        );
          if (typeof window.showLearnerCalIcon === 'function') window.showLearnerCalIcon();

    }

    // Skip nothing here — Home doesn't overlap with any of these pages.
    window.kickOffLearnerPrefetches();
}

// ─────────────────────────────────────────────
// BUILD LAYOUT
// ─────────────────────────────────────────────
function buildHomeLayout(data, manualHtml) {
    const todo    = data.todo    || [];
    const recent  = data.recent  || [];
    const events  = data.events  || [];

    // Cap both at 4
    const todoSlice   = todo.slice(0, 4);
    const recentSlice = recent.slice(0, 4);
    const eventsSlice = events.slice(0, 5);

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // ── MOBILE: GitHub-style stacked layout ──
        return `
        <style>
            @media (max-width: 768px) {
                .lh-mobile-wrapper,
                .lh-mobile-wrapper * {
                    font-weight: 300 !important;
                }
            }
        </style>
        <div class="lh-mobile-wrapper">

            <!-- MY CLASS CARD -->
            ${buildMobileClassCard(data.myClass)}

            <!-- TO-DO SECTION -->
            <div class="lh-section">
                <div class="lh-section-header">
                    <div class="lh-section-title">
                        <div style="width:22px;height:22px;border-radius:6px;background:#4fd1c518;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="#4fd1c5" stroke-width="2.5" fill="none">
                                <path d="M9 11l3 3L22 4"/>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                        </div>
                        To-Do
                    </div>
                    ${todoSlice.length > 0 ? `<span class="lh-badge">${todoSlice.length}</span>` : ''}
                </div>
                ${buildMobileTodo(todoSlice)}
            </div>

            <!-- RECENTS SECTION -->
            <div class="lh-section">
                <div class="lh-section-header">
                    <div class="lh-section-title">
                        <div style="width:22px;height:22px;border-radius:6px;background:#f28c3818;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="#f28c38" stroke-width="2.5" fill="none">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>
                        Recent
                    </div>
                </div>
                <div class="lh-card lh-card-recent">
                    ${buildMobileRecent(recentSlice)}
                </div>
            </div>

            <!-- UPCOMING EVENTS SECTION -->
            <div class="lh-section lh-events-section">
                <div class="lh-section-header" onclick="window.fetchLearnerCalendar ? fetchLearnerCalendar() : null" style="cursor:pointer;">
                    <div class="lh-section-title">
                        <div style="width:22px;height:22px;border-radius:6px;background:#f472b618;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="#f472b6" stroke-width="2.5" fill="none">
                                <rect x="3" y="4" width="18" height="18" rx="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                        </div>
                        Upcoming Events
                    </div>
                    ${eventsSlice.length > 0 ? `<span class="lh-badge">${eventsSlice.length}</span>` : ''}
                </div>
                <div class="lh-events-flat">
                    ${buildMobileEventsWeekStrip(eventsSlice)}
                    <div onclick="window.fetchLearnerCalendar ? fetchLearnerCalendar() : null" style="cursor:pointer;">
                        ${buildMobileEvents(eventsSlice)}
                    </div>
                </div>
            </div>

        </div>`;
    }

    // ── DESKTOP: existing split layout ──
    return `
        <div class="learner-home-wrapper">

            <!-- LEFT COLUMN -->
            <div class="learner-home-left">

                ${renderLearnerSnapshotPanel(data.snapshot)}

                <!-- CALENDAR (desktop only — populated by loadLearnerCalendar) -->
                <div class="learner-cal-panel" style="margin-top:20px; display:none;">
                    <div class="learner-snap-panel-title">
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
function buildLearnerSnapCard(card) {
    if (!card.data) {
        return `
            <div class="learner-snap-card learner-snap-card-empty" style="--snap-label-color:${card.color};">
                <div class="learner-snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
                <div class="learner-snap-empty-text">${card.empty}</div>
            </div>`;
    }

    return `
        <div class="learner-snap-card" style="--snap-label-color:${card.color};" onclick="${card.onclick}">
            <div class="learner-snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
            <div class="learner-snap-card-title">${card.data.title}</div>
            <div class="learner-snap-card-meta">
                ${card.meta}
                ${card.badge || ''}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// SNAPSHOT PANEL (desktop) — mirrors teacher's renderSnapshotPanel()
// One card each: Latest Quiz, Upcoming Assignment, Latest Announcement
// ─────────────────────────────────────────────
function renderLearnerSnapshotPanel(snapshot) {
    snapshot = snapshot || { quiz: null, assignment: null, announcement: null };

    const cards = [
        {
            key:     'quiz',
            data:    snapshot.quiz,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            label:   'Latest Quiz',
            color:   '#4fd1c5',
            onclick: 'window.learnerQuizCache=null; fetchQuizzes()',
            empty:   'No quizzes available yet',
            meta:    snapshot.quiz ? `${snapshot.quiz.start_time}` : '',
            badge:   snapshot.quiz ? `<span class="learner-snap-status-badge" style="background:${snapshot.quiz.status === 'Open' ? 'rgba(242,140,56,0.15)' : 'rgba(107,114,128,0.15)'};color:${snapshot.quiz.status === 'Open' ? '#f28c38' : '#6b7280'}">${snapshot.quiz.status}</span>` : ''
        },
        {
            key:     'assignment',
            data:    snapshot.assignment,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#a78bfa" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
            label:   'Upcoming Assignment',
            color:   '#a78bfa',
            onclick: snapshot.assignment ? `openLearnerDesktopSnapshotItem('assignment', ${Number(snapshot.assignment.id) || 0})` : '',
            empty:   'No upcoming assignments',
            meta:    snapshot.assignment ? `Due ${snapshot.assignment.due_date}` : '',
            badge:   snapshot.assignment ? (
                        snapshot.assignment.submitted
                            ? `<span class="learner-snap-status-badge" style="background:rgba(79,209,197,0.15);color:#4fd1c5;">Submitted</span>`
                            : `<span class="learner-snap-status-badge" style="background:rgba(167,139,250,0.15);color:#a78bfa;">in ${snapshot.assignment.days_left} day${snapshot.assignment.days_left !== 1 ? 's' : ''}</span>`
                     ) : ''
        },
        {
            key:     'announcement',
            data:    snapshot.announcement,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#f59e0b" stroke-width="2" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            label:   'Latest Announcement',
            color:   '#f59e0b',
            onclick: snapshot.announcement ? `openLearnerDesktopSnapshotItem('announcement', ${Number(snapshot.announcement.id) || 0})` : '',
            empty:   'No announcements yet',
            meta:    snapshot.announcement ? `${snapshot.announcement.teacher} &bull; ${snapshot.announcement.created_at}` : '',
            badge:   ''
        }
    ];

    let html = `<div class="learner-snap-panel-title">Quick Snapshot</div>`;

    cards.forEach(card => {
        html += buildLearnerSnapCard(card);
    });

    return html;
}

// Desktop Quick Snapshot cards reuse the existing split layouts. Once the
// relevant list has rendered, select the exact item so its full content is
// shown in the right-hand panel.
window.openLearnerDesktopSnapshotItem = async function(type, itemId) {
    if (window.innerWidth <= 899) return;

    const id = String(itemId || '');
    if (!id) return;

    const config = type === 'assignment'
        ? {
            cacheKey: 'learnerAssignmentCache',
            fetchPage: window.fetchAssignments,
            items: () => window._allLearnerAssignmentsFlat || [],
            select: window.selectDesktopLearnerAssignment,
            sidebarItemId: index => `las-sidebar-${index}`,
            groupSelector: '.las-desktop-teacher-body',
            headerClass: 'las-desktop-teacher-header',
            chevronSelector: '.las-desktop-teacher-chevron'
        }
        : type === 'announcement'
            ? {
                cacheKey: 'announcementCache',
                fetchPage: window.fetchAnnouncements,
                items: () => window._allLearnerAnnouncementsFlat || [],
                select: window.selectDesktopLearnerAnnouncement,
                sidebarItemId: index => `lan-sidebar-${index}`,
                groupSelector: '.lan-desktop-teacher-body',
                headerClass: 'lan-desktop-teacher-header',
                chevronSelector: '.lan-desktop-teacher-chevron'
            }
            : null;

    if (!config || typeof config.fetchPage !== 'function' || typeof config.select !== 'function') return;

    window[config.cacheKey] = null;
    await config.fetchPage();

    const index = config.items().findIndex(item =>
        String(item.id) === id && (type !== 'announcement' || item._type === 'teacher')
    );
    if (index < 0) return;

    config.select(index);

    const sidebarItem = document.getElementById(config.sidebarItemId(index));
    const group = sidebarItem?.closest(config.groupSelector);
    const header = group?.previousElementSibling;
    if (group && header) {
        group.classList.remove('collapsed');
        header.classList.add(config.headerClass);
        header.querySelector(config.chevronSelector)?.classList.add('open');
    }
};

function buildDesktopTodoCards(todo) {
    const colorMap = {
        quiz: '#fdd663',
        assignment: '#a78bfa',
        evaluation: '#f28c38'
    };
    const iconMap = {
        quiz: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
        assignment: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        evaluation: `<polygon points="12 2 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8 12 2"/>`
    };
    const actionMap = {
        quiz: 'window.learnerQuizCache=null; fetchQuizzes()',
        assignment: 'window.learnerAssignmentCache=null; fetchAssignments()',
        evaluation: 'window.evaluationCache=null; fetchEvaluations()'
    };

    let html = `<div class="learner-snap-panel-title" style="margin-top:20px;">To-Do</div>`;

    if (!todo.length) {
        return html + buildLearnerSnapCard({
            data: null,
            icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
            label: 'All Caught Up',
            color: '#4fd1c5',
            empty: "You're all caught up"
        });
    }

    todo.forEach(item => {
        const color = colorMap[item.type] || '#fdd663';
        const icon = iconMap[item.type] || iconMap.quiz;
        html += buildLearnerSnapCard({
            data: item,
            icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none">${icon}</svg>`,
            label: item.label || 'To-Do',
            color,
            onclick: actionMap[item.type] || '',
            meta: item.meta || '',
            badge: `<span class="learner-snap-status-badge" style="background:${color}26;color:${color};">${item.type || 'Task'}</span>`
        });
    });

    return html;
}

function buildDesktopRecentCards(recent) {
    const colorMap = {
        announcement: '#f59e0b',
        resource: '#f28c38',
        assignment: '#a78bfa',
        quiz: '#fdd663'
    };
    const labelMap = {
        announcement: 'Latest Announcement',
        resource: 'Latest Resource',
        assignment: 'Latest Assignment',
        quiz: 'Latest Quiz'
    };
    const actionMap = {
        announcement: 'fetchAnnouncements()',
        resource: 'fetchResources()',
        assignment: 'fetchAssignments()',
        quiz: 'window.learnerQuizCache=null; fetchQuizzes()'
    };
    const iconMap = {
        announcement: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
        resource: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
        assignment: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        quiz: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
    };

    let html = `<div class="learner-snap-panel-title">Recent Activity</div>`;

    if (!recent.length) {
        return html + buildLearnerSnapCard({
            data: null,
            icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#f28c38" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
            label: 'Nothing New',
            color: '#f28c38',
            empty: 'Nothing new in the last 7 days'
        });
    }

    recent.forEach(item => {
        const color = colorMap[item.type] || '#4fd1c5';
        const icon = iconMap[item.type] || iconMap.announcement;
        html += buildLearnerSnapCard({
            data: item,
            icon: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none">${icon}</svg>`,
            label: labelMap[item.type] || 'Recent Activity',
            color,
            onclick: actionMap[item.type] || '',
            meta: `${item.meta || ''}${item.time_ago ? ` &bull; ${item.time_ago}` : ''}`,
            badge: ''
        });
    });

    return html;
}

function buildMobileClassCard(myClass) {
    if (!myClass || !myClass.name) {
        // Not joined yet — render nothing
        return '';
    }

    const fullName = `${myClass.learner_name || ''} ${myClass.learner_surname || ''}`.trim();

    return `
        <div class="lh-class-flat">
            <div class="lh-class-flat-line">${fullName}</div>
            <div class="lh-class-flat-line lh-class-flat-school"><span class="lh-class-dot"></span>${myClass.school_name || ''}</div>
            <div class="lh-class-flat-line">${myClass.name}</div>
        </div>`;
}

// ─────────────────────────────────────────────
// CAROUSEL DOTS — syncs active dot with scroll position
// (shared by any horizontal snap-scroll carousel on mobile Home)
// ─────────────────────────────────────────────
function updateLhCarouselDots(trackEl, dotsId) {
    if (!trackEl) return;
    const dotsEl = document.getElementById(dotsId);
    if (!dotsEl) return;

    const cardEls = trackEl.children;
    if (!cardEls.length) return;

    const cardWidth = cardEls[0].getBoundingClientRect().width + parseFloat(getComputedStyle(trackEl).gap || 0);
    const activeIndex = Math.round(trackEl.scrollLeft / cardWidth);

    const dots = dotsEl.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('lh-carousel-dot-active', i === activeIndex);
    }
}

// ─────────────────────────────────────────────
// MOBILE TO-DO
// ─────────────────────────────────────────────
function buildMobileTodo(todo) {
    const sectionColor = '#4fd1c5';

    if (!todo.length) {
        return `
            <div class="lh-card">
                <div class="lh-empty-state">
                    <div class="lh-empty-icon">
                        <svg viewBox="0 0 24 24" width="28" height="28" stroke="${sectionColor}" stroke-width="1.5" fill="none">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                    </div>
                    <div class="lh-empty-title">You're all caught up</div>
                    <div class="lh-empty-desc">Quizzes and assignments that need your attention will appear here.</div>
                </div>
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
    const iconMap = {
        quiz: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
        assignment: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        evaluation: `<polygon points="12 2 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8 12 2"/>`
    };

    const cards = todo.map((item, i) => {
        const color = colorMap[item.type] || '#4fd1c5';
        const label = labelMap[item.type] || item.type;
        const icon  = iconMap[item.type]  || iconMap.quiz;

        return `
            <div class="lh-carousel-card" onclick="openLearnerHomeItem('${item.type}', ${Number(item.id) || 0})">
                <div class="lh-row-icon" style="background:${sectionColor}18;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="${sectionColor}" stroke-width="2" fill="none">
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

    const dots = todo.map((_, i) => `<span class="lh-carousel-dot${i === 0 ? ' lh-carousel-dot-active' : ''}"></span>`).join('');

    return `
        <div class="lh-carousel-bleed">
            <div class="lh-carousel-track" id="lhTodoTrack" onscroll="updateLhCarouselDots(this, 'lhTodoDots')">
                ${cards}
            </div>
        </div>
        ${todo.length > 1 ? `<div class="lh-carousel-dots" id="lhTodoDots">${dots}</div>` : ''}`;
}

// ─────────────────────────────────────────────
// MOBILE RECENT
// ─────────────────────────────────────────────
function buildMobileRecent(recent) {
    const sectionColor = '#f28c38';

    if (!recent.length) {
        return `
            <div class="lh-empty-state">
                <div class="lh-empty-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="${sectionColor}" stroke-width="1.5" fill="none">
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
    const iconMap = {
        announcement: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
        resource:     `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
        assignment:   `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
        quiz:         `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
    };

    return recent.map((item, i) => {
        const color  = colorMap[item.type]  || '#4fd1c5';
        const icon   = iconMap[item.type]   || iconMap.announcement;
        const isLast = i === recent.length - 1;

        return `
            <div class="lh-row${isLast ? ' lh-row-last' : ''}" onclick="openLearnerHomeItem('${item.type}', ${Number(item.id) || 0}, '${item.scope || ''}')">
                <div class="lh-row-icon" style="background:${sectionColor}18;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="${sectionColor}" stroke-width="2" fill="none">
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

// Home cards are only rendered on the mobile layout. Assignments and
// announcements open their detail screen; quizzes and resources open the
// list with the teacher folder containing the selected item expanded.
window.openLearnerHomeItem = async function(type, itemId, scope = '') {
    const id = String(itemId || '');
    if (!id) return;

    const clearPageState = key => {
        if (window.learnerPageState) window.learnerPageState.clear(key);
    };

    if (type === 'assignment') {
        clearPageState('assignments');
        window.learnerAssignmentCache = null;
        await window.fetchAssignments();
        window.openMobileLearnerAssignmentById?.(id);
        return;
    }

    if (type === 'announcement') {
        clearPageState('announcements');
        window.announcementCache = null;
        await window.fetchAnnouncements();
        window.openMobileLearnerAnnouncementById?.(id, scope);
        return;
    }

    // Evaluations are not part of the new deep-link behaviour; retain the
    // existing list navigation for them.
    if (type === 'evaluation') {
        window.evaluationCache = null;
        await window.fetchEvaluations?.();
        return;
    }

    const folderConfig = type === 'quiz'
        ? {
            stateKey: 'quiz',
            cacheKey: 'learnerQuizCache',
            fetchPage: window.fetchQuizzes,
            rowSelector: '.lqz-mobile-row',
            rowIdKey: 'quizId',
            folderSelector: '.lqz-mobile-folder-body',
            headerClass: 'lqz-mobile-folder-header--collapsed',
            chevronSelector: '.lqz-mobile-folder-chevron',
            toggle: window.toggleLqzMobileFolder
        }
        : type === 'resource'
            ? {
                stateKey: 'resources',
                cacheKey: 'resourceCache',
                fetchPage: window.fetchResources,
                rowSelector: '.lrs-mobile-row, .lrs-mobile-video-card',
                rowIdKey: 'resourceId',
                folderSelector: '.lrs-mobile-folder-body',
                headerClass: 'lrs-mobile-folder-header--collapsed',
                chevronSelector: '.lrs-mobile-folder-chevron',
                toggle: window.toggleLrsMobileFolder
            }
            : null;

    if (!folderConfig || typeof folderConfig.fetchPage !== 'function') return;

    clearPageState(folderConfig.stateKey);
    window[folderConfig.cacheKey] = null;
    await folderConfig.fetchPage();

    const row = Array.from(document.querySelectorAll(folderConfig.rowSelector))
        .find(element => String(element.dataset[folderConfig.rowIdKey]) === id);
    const folder = row?.closest(folderConfig.folderSelector);
    const header = folder?.previousElementSibling;
    if (!folder || !header) return;

    if (folder.classList.contains('collapsed') && typeof folderConfig.toggle === 'function') {
        folderConfig.toggle(folder.id, header);
    } else {
        folder.classList.remove('collapsed');
        header.classList.remove(folderConfig.headerClass);
        header.querySelector(folderConfig.chevronSelector)?.classList.add('open');
    }

    header.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ─────────────────────────────────────────────
// MOBILE UPCOMING EVENTS — WEEK STRIP
// Purely visual header sitting above the events list: shows the current
// week (Sun–Sat) with today highlighted, and a dot under any day that has
// an event. Does not filter the list below.
// ─────────────────────────────────────────────
function buildMobileEventsWeekStrip(events) {
    events = events || [];
    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monNames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const today     = new Date();
    today.setHours(0,0,0,0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // back up to Sunday

    // Build a Set of "YYYY-MM-DD" strings that have an event, so we can
    // check each day cell in O(1).
    const eventDates = new Set(events.map(e => e.event_date));

    const pad = n => String(n).padStart(2, '0');

    let cells = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const isToday = d.getTime() === today.getTime();
        const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const hasEvent = eventDates.has(dateKey);

        cells += `
            <div class="lh-week-cell">
                <span class="lh-week-day-label">${dayLabels[i]}</span>
                <span class="lh-week-day-num${isToday ? ' lh-week-today' : ''}">${d.getDate()}</span>
                <span class="lh-week-day-dot${hasEvent ? ' lh-week-day-dot-active' : ''}"></span>
            </div>`;
    }

    const monthLabel = `${monNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;

    return `
        <div class="lh-week-strip">
            <div class="lh-week-strip-header">
                <span class="lh-week-strip-month">${monthLabel}</span>
            </div>
            <div class="lh-week-strip-grid">
                ${cells}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// MOBILE UPCOMING EVENTS (academic_events)
// ─────────────────────────────────────────────
function buildMobileEvents(events) {
    const sectionColor = '#f472b6';

    if (!events.length) {
        return `
            <div class="lh-empty-state">
                <div class="lh-empty-icon" style="background:${sectionColor}14;">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="${sectionColor}" stroke-width="1.5" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </div>
                <div class="lh-empty-title">You have no upcoming events this week</div>
                <div class="lh-empty-desc">Tests, exams, and school events added by your teacher will appear here.</div>
            </div>`;
    }

    const typeColorMap = {
        test:    '#fdd663',
        exam:    '#f472b6',
        holiday: '#4fd1c5',
        event:   '#a78bfa',
        other:   '#8b949e'
    };
    const typeLabelMap = {
        test:    'Test',
        exam:    'Exam',
        holiday: 'Holiday',
        event:   'Event',
        other:   'Other'
    };
    const typeIconMap = {
        test:    `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
        exam:    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
        holiday: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`,
        event:   `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
        other:   `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`
    };

    return events.map((item, i) => {
        const type   = item.event_type || 'other';
        const color  = typeColorMap[type]  || '#8b949e';
        const label  = typeLabelMap[type]  || 'Event';
        const icon   = typeIconMap[type]   || typeIconMap.other;
        const isLast = i === events.length - 1;

        // Format the date nicely: "20 Mar" or "Mon, 20 Mar"
        const d       = new Date(item.event_date + 'T00:00:00');
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const monNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const dateStr = `${dayNames[d.getDay()]}, ${d.getDate()} ${monNames[d.getMonth()]}`;

        // Check if past
        const today   = new Date(); today.setHours(0,0,0,0);
        const isPast  = d < today;

        return `
            <div class="lh-row${isLast ? ' lh-row-last' : ''}" style="cursor:pointer;${isPast ? 'opacity:0.5;' : ''}">
                <div class="lh-row-icon" style="background:${sectionColor}18;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="${sectionColor}" stroke-width="2" fill="none">
                        ${icon}
                    </svg>
                </div>
                <div class="lh-row-body">
                    <div class="lh-row-title">${item.title}</div>
                    <div class="lh-row-meta">
                        <span class="lh-type-tag" style="color:${color}; background:${color}18;">${label}</span>
                        <span class="lh-dot-sep">·</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                ${isPast ? `<span style="font-size:10px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;">Done</span>` : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="#4a5568" stroke-width="2" fill="none" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>`}
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

    const cacheKey = `${year}-${month}`;

    // Already fetched this month this session — render instantly, no re-fetch, no spinner
    if (window.learnerCalEventsCache[cacheKey]) {
        window.learnerCalEvents = window.learnerCalEventsCache[cacheKey];
        renderLearnerCalendar(month, year, window.learnerCalEvents);
        return;
    }

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:20px;color:#8b949e;font-size:13px;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none"
                style="animation:spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            Loading...
        </div>`;

    try {
        const res  = await fetch(`api/learner/get_calendar_events.php?month=${month}&year=${year}`);
        const data = await res.json();
        window.learnerCalEvents = data.events || [];
        window.learnerCalEventsCache[cacheKey] = window.learnerCalEvents;
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
    saveManualPageState({ calendarMonth: month, calendarYear: year });
    window.loadLearnerCalendar(month, year);
};

window.learnerCalNext = function() {
    let { month, year } = window.learnerCalState;
    month++;
    if (month > 12) { month = 1; year++; }
    window.learnerCalState = { month, year };
    saveManualPageState({ calendarMonth: month, calendarYear: year });
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

// ─────────────────────────────────────────────
// SHARED DESKTOP "FLAT LAYOUT" STYLES
// One injected copy, reused by every learner page that renders a
// sidebar + main-panel split (quiz, announcements, assignments,
// resources, syllabus, evaluations, grades).
//
// Replaces the old per-page boxed-card look (border + border-radius +
// solid #0d1117 panel backgrounds) with a flat, VS-Code/GitHub style:
// no outer card, panels transparent, single 1px divider between
// sidebar and main panel. #api-content-area no longer carries desktop
// padding — the sidebar's top padding is restored via its existing
// -sidebar-scroll class, and each page's own -panel-content class
// already carries its own padding, so the divider line runs flush
// from the header's bottom border all the way to the bottom of the
// viewport.
//
// Height is no longer a calc(100vh - Npx) guess (that magic number
// drifted out of sync with the real header height and left the
// divider stopping short of the bottom, and the sidebar undersized
// so its scrollbar appeared before content actually filled it).
// Instead #api-content-area and .lqz-flat-layout simply fill 100% of
// whatever real space .main-content's flexbox gives them below the
// header, so the divider always reaches the true bottom of the
// viewport and the sidebar only scrolls once its content genuinely
// overflows its real height.
//
// Usage: call injectSharedDesktopLayoutStyles() once when a page's
// HTML is built, then add these classes alongside each page's own
// prefixed classes:
//   .lqz-flat-layout   → on the outer sidebar+panel flex wrapper
//   .lqz-flat-sidebar  → on the sidebar column
//   .lqz-flat-panel    → on the main (right-hand) panel column
// ─────────────────────────────────────────────
function injectSharedDesktopLayoutStyles() {
    if (document.getElementById('lqz-shared-desktop-layout-style')) return;

    const style = document.createElement('style');
    style.id = 'lqz-shared-desktop-layout-style';
    style.textContent = `
        /* Scoped with :has() so this only overrides #api-content-area while
           it actually contains a flat-layout page (Quiz, Announcements,
           Assignments, etc). Previously this targeted the bare #api-content-area
           ID unconditionally — once injected (on the first flat-layout page
           visit), padding:0/overflow:hidden/height:auto stuck around for the
           rest of the session and silently broke every OTHER page rendered
           into the same container afterward, including Home: its scroll
           container lost overflow-y (no more scrolling), and its own
           .learner-home-wrapper padding got squashed by the forced
           height:auto + overflow:hidden box behavior on return visits. */
        @media (min-width: 900px) {
            #api-content-area:has(.lqz-flat-layout) {
                padding: 0 !important;
                height: auto !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: hidden !important;
            }
        }

        .lqz-flat-layout {
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            margin-top: 0 !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        .lqz-flat-sidebar {
            background: #12161c !important;
            border-right: 1px solid rgba(255,255,255,0.07) !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        .lqz-flat-panel {
            background: transparent !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        /* Restores the breathing room #api-content-area used to give,
           now scoped to just the sidebar's scrollable list and the
           panel's inner content, so the divider itself stays flush. */
        .lqz-flat-sidebar .lqz-sidebar-scroll,
        .lqz-flat-sidebar .lan-sidebar-scroll,
        .lqz-flat-sidebar .las-sidebar-scroll,
        .lqz-flat-sidebar .lrs-sidebar-scroll,
        .lqz-flat-sidebar .syl-dt-sidebar-scroll,
        .lqz-flat-sidebar .lev-sidebar-scroll,
        .lqz-flat-sidebar .grades-dt-sidebar-scroll {
            padding-top: 25px !important;
        }
    `;
    document.head.appendChild(style);
}