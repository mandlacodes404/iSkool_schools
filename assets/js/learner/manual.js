window.manualCache    = null;
window.homeDataCache  = null;

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
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const [manualRes, homeRes] = await Promise.all([
            fetch('partials/manual.html?v=1.1'),
            fetch('api/learner/get_home_data.php')
        ]);

        const manualHtml = await manualRes.text();
        const homeData   = await homeRes.json();

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

    } catch (error) {
        console.error('Home load failed:', error);
        apiArea.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">
            Could not load home screen.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// BUILD LAYOUT
// ─────────────────────────────────────────────
function buildHomeLayout(data, manualHtml) {
    const todo   = data.todo   || [];
    const recent = data.recent || [];

    return `
        <div class="learner-home-wrapper">

            <!-- LEFT COLUMN -->
            <div class="learner-home-left">

                <!-- RECENT ACTIVITY -->
                <div class="learner-home-panel">
                    <div class="learner-home-panel-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Recent Activity
                    </div>
                    ${buildRecentActivity(recent)}
                </div>

                <!-- TO-DO -->
                <div class="learner-home-panel" style="margin-top:16px;">
                    <div class="learner-home-panel-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                        To-Do
                    </div>
                    ${buildTodoList(todo)}
                </div>

            </div>

            <!-- RIGHT COLUMN: MANUAL -->
            <div class="learner-home-right">
                ${manualHtml}
            </div>

        </div>`;
}

// ─────────────────────────────────────────────
// RECENT ACTIVITY
// FIX: added quiz to iconMap and actionMap
// FIX: items are now clickable with cursor:pointer
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
        // NEW: quiz icon added
        quiz: {
            stroke: '#fdd663',
            path: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
        }
    };

    const actionMap = {
        announcement: 'fetchAnnouncements()',
        resource:     'fetchResources()',
        assignment:   'fetchAssignments()',
        // NEW: quiz navigates to quiz list
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
// FIX: cache cleared before navigating so list is always fresh
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
        const color  = colorMap[item.type]  || '#4fd1c5';
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