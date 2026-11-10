/* assets/js/quiz.js */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLearnerQuizInitials(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatLearnerQuizPostedDate(rawDate) {
    if (!rawDate) return '';
    const d = new Date(String(rawDate).replace(/-/g, '/'));
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} at ${hours}:${mins}`;
}

window.learnerQuizCache          = null;
window.quizInstructionsCache     = {};
window.learnerQuizPrefetchPromise = null;

const LEARNER_QUIZ_PENCIL_SVG = `
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>`;

function learnerQuizPencilSvg(width = 20, height = 20, color = 'currentColor') {
    return LEARNER_QUIZ_PENCIL_SVG
        .replace('width="20"', `width="${width}"`)
        .replace('height="20"', `height="${height}"`)
        .replace('stroke="currentColor"', `stroke="${color}"`);
}

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// Called from the dashboard ~1 500 ms after home loads.
// Populates learnerQuizCache so the first click is instant.
// ─────────────────────────────────────────────
window.prefetchQuizzes = function () {
    if (window.learnerQuizCache) return;           // already cached
    if (window.learnerQuizPrefetchPromise) return; // already in-flight
    window.learnerQuizPrefetchPromise = fetch('api/learner/get_quizzes.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => {
            if (data.status === 'error') throw new Error(data.message || 'prefetch failed');
            window.learnerQuizCache = data.data ?? data;
        })
        .catch(() => { /* silent – user will retry on click */ })
        .finally(() => { window.learnerQuizPrefetchPromise = null; });
};

function showLearnerQuizMobileBottomNav() {
    if (window.innerWidth > 899) return;

    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (mobileBottomNav) {
        mobileBottomNav.style.setProperty('display', 'flex', 'important');
    }
}

const formatQuizDate = (dateStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr.replace(/-/g, "/"));
    return date.toLocaleString('en-GB', { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true 
    });
};

function parseLearnerQuizTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, "/")).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLearnerQuizTime(quiz) {
    return parseLearnerQuizTime(quiz.created_at || quiz.start_time);
}

function getSortedLearnerQuizTeacherEntries(quizzesByTeacher) {
    return Object.entries(quizzesByTeacher || {})
        .map(([teacher, quizzes], index) => {
            const sortedQuizzes = Array.isArray(quizzes)
                ? [...quizzes].sort((a, b) => getLearnerQuizTime(b) - getLearnerQuizTime(a))
                : [];
            const latestTime = sortedQuizzes.reduce((latest, quiz) => Math.max(latest, getLearnerQuizTime(quiz)), 0);
            return { teacher, quizzes: sortedQuizzes, latestTime, index };
        })
        .sort((a, b) => (b.latestTime - a.latestTime) || (a.index - b.index));
}

window.fetchQuizzes = async function() {
    const navigation = window.beginLearnerViewNavigation?.('quiz_list.php');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastLearnerPage", "quiz_list.php");

    // 1. STANDARD MODE: Show Bottom Nav and Sidebar Menu
    if (typeof window.configureHeader === 'function') {
        // Desktop matches the mockup (white title); mobile keeps the yellow header.
        const lqzIsDesktop = window.innerWidth >= 900;
        window.configureHeader({ title: 'Quizzes', mode: 'standard', color: lqzIsDesktop ? '#e6edf3' : '#fdd663' });
    }

    // 2. Sidebar & UI Management
    if (typeof window.setActive === 'function') window.setActive("quiz_list.php");
    
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 3a. If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.learnerQuizPrefetchPromise) {
        await window.learnerQuizPrefetchPromise;
    }
    if (!isCurrentNavigation()) return;

    // 3b. Cache Check – serve instantly
    if (window.learnerQuizCache) {
        renderQuizCards(window.learnerQuizCache);
        restoreQuizPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_quizzes.php');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const payload = await response.json();
        if (!isCurrentNavigation()) return;
        if (payload.status === 'error') throw new Error(payload.message || 'Unable to load quizzes');
        const groupedData = payload.data ?? payload;
        window.learnerQuizCache = groupedData; 
        renderQuizCards(groupedData);
        restoreQuizPageState();
    } catch (error) {
        if (!isCurrentNavigation()) return;
        console.error("Quiz Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load quizzes at the moment.</p>
                    <button class="lqz-retry-btn" onclick="window.learnerQuizCache=null; fetchQuizzes()" 
                            style="background:#4fd1c5; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; color:white;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveQuizPageState() {
    const sidebar = document.querySelector('.lqz-sidebar-scroll');
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('lqz-main-panel');
    const selected = (window._allLearnerQuizzesFlat || [])[window._learnerQuizSelectedIdx];
    const state = {
        selectedId:   selected ? String(selected.id) : null,
        selectedIdx:  window._learnerQuizSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   (document.querySelector('.lqz-body') || {}).scrollTop || 0,
        mobileSearch: document.getElementById('lqzMobileSearch')?.value || '',
        mobileFilter: window._lqzMobFilter || 'all',
        openFolders: Array.from(document.querySelectorAll('.lqz-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        // Desktop teacher groups the learner has folded away (open is the default)
        collapsedTeachers: Array.from(window._lqzCollapsed || []),
    };
    if (window.learnerPageState) window.learnerPageState.set('quiz', state);
    else sessionStorage.setItem('quizPageState', JSON.stringify(state));
}

function wireQuizScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.lqz-sidebar-scroll');
    const panel = document.querySelector('.lqz-body');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.lqzScrollWired === '1') return;
        el.dataset.lqzScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('quiz', saveQuizPageState), { passive: true });
    });
}

function restoreQuizPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('quiz')
            : JSON.parse(sessionStorage.getItem('quizPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            window.lqzEnsureSelection();
            wireQuizScrollState();
            return;
        }
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lqzMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lqzMobileSearch(state.mobileSearch);
                }
            }
            if (state.mobileFilter && state.mobileFilter !== 'all') window.lqzMobileSetFilter(state.mobileFilter);
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lqz-mobile-folder-body').forEach(body => {
                    const header = body.previousElementSibling;
                    if (header) lqzMobileSetFolder(header, body, state.openFolders.includes(body.id));
                });
            }
            if (Array.isArray(state.collapsedTeachers)) {
                window._lqzCollapsed = new Set(state.collapsedTeachers);
                if (typeof window.lqzRenderDesktopList === 'function') window.lqzRenderDesktopList();
            }
            const selectedIdx = state.selectedId
                ? (window._allLearnerQuizzesFlat || []).findIndex(quiz => String(quiz.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerQuiz(selectedIdx);
            }
            const sidebar = document.querySelector('.lqz-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panelBody = document.querySelector('.lqz-body');
            if (panelBody && Number.isFinite(state.panelScroll)) panelBody.scrollTop = state.panelScroll;
            window.lqzEnsureSelection();
            wireQuizScrollState();
            saveQuizPageState();
        });
    } catch (e) { /* ignore bad state */ }
}

// One row of the "Before you start" panel on the instructions screen (thin line icon, a title, one line of detail).
// Icons are the same Lucide line icons the learner menus use. `warn` colours the row orange (an unfinished attempt).
const INSTRUCTION_ICONS = {
    clock:  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    resume: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
};
function instructionRule(icon, title, text, warn = false) {
    return `<div class="inst-rule${warn ? ' inst-rule--warn' : ''}">`
        + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${INSTRUCTION_ICONS[icon] || ''}</svg>`
        + `<div><b>${title}</b><span>${text}</span></div></div>`;
}

window.loadQuizInstructions = async function(quizId) {
    const apiArea = document.getElementById('api-content-area');
    lqzEnsureFont();   // Nunito 400/600 for this screen, in case it is opened without the list having drawn first
    const loader = document.getElementById("loaderOverlay");

  // Check cache FIRST before showing loader
if (window.quizInstructionsCache[quizId]) {
    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Instructions', mode: 'detail' });
    }
    showLearnerQuizMobileBottomNav();
    apiArea.innerHTML = window.quizInstructionsCache[quizId];
    if (loader) loader.style.display = 'none';
    return;
}

// Only reach here if NOT cached
if (typeof window.configureHeader === 'function') {
    window.configureHeader({ title: 'Instructions', mode: 'detail' });
}
showLearnerQuizMobileBottomNav();
if (!window.suppressInitialLoader && loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`api/learner/get_quiz_instructions.php?quiz_id=${quizId}`);
        const payload = await response.json();

        if (payload.status === 'error') throw new Error(payload.message || 'Unable to load instructions');
        if (payload.error) throw new Error(payload.error);
        const data = payload.data ?? payload;

        // 2. Draw the instructions. The look lives in quiz.css (.inst-*), so the markup carries no inline colours.
        // The title and the section label are not <h2>/<h3> on purpose: "#api-content-area h2/h3" in quiz.css styles
        // every heading on the page (teal, uppercase, a rule underneath), which this screen does not want.
        const continuing = !!data.isContinuing;
        const monitoringRule = data.layout_mode === 'multi_page'
            ? instructionRule('shield', 'AI invigilator is on', 'Switching tabs or leaving the quiz is logged for each question.')
            : instructionRule('shield', 'Session monitoring is on', 'Your session integrity is being tracked.');

        apiArea.innerHTML = `
            <div class="inst-container">
                <div class="inst-top">
                    <span class="inst-eyebrow">Quiz instructions</span>
                    <span class="inst-pill ${continuing ? 'inst-pill--progress' : 'inst-pill--ready'}">${continuing ? 'In progress' : 'Available now'}</span>
                </div>
                <div class="inst-title" role="heading" aria-level="2">${escapeHtml(data.title)}</div>

                <dl class="inst-facts">
                    <div class="inst-fact"><dt>Time allowed</dt><dd>${escapeHtml(data.duration)}<small>min</small></dd></div>
                    <div class="inst-fact"><dt>Attempts allowed</dt><dd>${escapeHtml(data.attemptLimit)}</dd></div>
                </dl>

                <div class="inst-gt" role="heading" aria-level="3">Before you start</div>
                <div class="inst-rules">
                    ${continuing ? instructionRule('resume', 'You have an unfinished attempt', 'Tap Continue to pick up where you left off.', true) : ''}
                    ${instructionRule('clock', 'The timer can’t be paused', 'It starts as soon as you begin.')}
                    ${monitoringRule}
                </div>

                <form action="take_quiz.php" method="GET" class="inst-form">
                    <input type="hidden" name="quiz_id" value="${quizId}">
                    <button type="submit" class="start-btn${continuing ? ' start-btn--continue' : ''}">${continuing ? 'Continue quiz' : 'Start quiz'}</button>
                </form>
            </div>
        `;
         // Only cache if NOT a continuing attempt (status could change)
if (!data.isContinuing) {
    window.quizInstructionsCache[quizId] = apiArea.innerHTML;
}
    } catch (err) {
        apiArea.innerHTML = `<p style="color:red; text-align:center;">Error: ${escapeHtml(err.message)}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// Nunito 400/600/700 for the MOBILE quiz list (.lqz-mobile-*). The desktop page now uses Geist
// (loaded in learner_dashboard.php). Keep this loader: the global Nunito link only has weight 600.
function lqzEnsureFont() {
    if (document.getElementById('lqz-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'lqz-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}

// ── Phone list helpers ──────────────────────────────────────────────────────────────────────────────────────
// The status ring at the start of a row. It draws in currentColor, so the colour comes from the
// .lqz-mobile-row-icon--{go|prog|soonq|wait|done|closed} classes (and follows light and dark mode with no extra rules).
function lqzMobileRing(kind) {
    const circle = (extra = '') => `<circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.7"${extra}/>`;
    let inner = circle();
    if (kind === 'done') inner = '<circle cx="12" cy="12" r="9.6" fill="currentColor" stroke="none"/><path d="m7.8 12.4 2.8 2.8 5.6-6" stroke="#fff" stroke-width="2"/>';
    else if (kind === 'closed') inner = circle() + '<path d="M8.6 12h6.8" stroke="currentColor" stroke-width="1.8"/>';
    else if (kind === 'wait') inner = circle() + '<path d="m8.2 12.3 2.6 2.6 5-5.4" stroke="currentColor" stroke-width="1.8"/>';
    else if (kind === 'soonq') inner = circle(' stroke-dasharray="2.6 3.4"');
    else if (kind === 'prog') inner = circle() + '<path class="lqz-mobile-ring-arc" d="M12 2.8a9.2 9.2 0 0 1 0 18.4" stroke-width="2.3"/>';
    return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

function lqzMobileDay(ms) {
    const d = new Date(ms);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' });
}

function lqzMobileTime(ms) {
    const d = new Date(ms);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// "2d 3h", "5h 20m", "12m 5s": short, because it sits on the right of a row (the row itself says when the quiz opens)
function lqzMobileCountdownText(diff) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// A quiz that was "not open yet" has just opened: turn its row into an open one (ring, line, Start, tap to open)
function lqzMobileRowOpen(row, quizId) {
    if (!row) return;
    row.dataset.state = 'open';
    row.classList.remove('lqz-mobile-row--static');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.onclick = () => loadQuizInstructions(quizId);
    row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadQuizInstructions(quizId); } };
    const icon = row.querySelector('.lqz-mobile-row-icon');
    if (icon) { icon.className = 'lqz-mobile-row-icon lqz-mobile-row-icon--go'; icon.innerHTML = lqzMobileRing('go'); }
    const meta = row.querySelector('.lqz-mobile-row-meta');
    if (meta) {
        meta.textContent = '';
        const word = document.createElement('span');
        word.className = 'lqz-mobile-st lqz-mobile-st--go';
        word.textContent = 'Available now';
        meta.appendChild(word);
        if (row.dataset.details) meta.appendChild(document.createTextNode(' · ' + row.dataset.details));
    }
    const action = row.querySelector('.lqz-mobile-cd');
    if (action) { action.className = 'lqz-mobile-row-action'; action.textContent = 'Start'; }
}

function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const now = new Date();
    const hasAnyQuizzes = groupedData && Object.keys(groupedData).length > 0;

    // ── Build flat list for desktop panel lookup ──
    const desktopQuizzesByTeacher = {};
    for (const [subject, quizzes] of Object.entries(groupedData || {})) {
        quizzes.forEach(quiz => {
            const teacher = String(quiz.teacher || quiz.teacher_name || quiz.created_by_name || subject || 'Unknown Teacher').trim() || 'Unknown Teacher';
            const desktopQuiz = { ...quiz, subject, teacher };
            if (!desktopQuizzesByTeacher[teacher]) desktopQuizzesByTeacher[teacher] = [];
            desktopQuizzesByTeacher[teacher].push(desktopQuiz);
        });
    }
    const teacherEntries = getSortedLearnerQuizTeacherEntries(desktopQuizzesByTeacher);

    window._allLearnerQuizzesFlat = [];
    teacherEntries.forEach(({ quizzes }) => {
        quizzes.forEach(quiz => window._allLearnerQuizzesFlat.push(quiz));
    });

    // ── Helper: build action button HTML for a quiz ──
    function buildActionBtn(quiz) {
        let isScheduled = false;
        const startTimeStr = quiz.start_time || "";
        if (startTimeStr) {
            const startTime = new Date(startTimeStr.replace(/-/g, "/"));
            isScheduled = ((quiz.status === 'Scheduled' || quiz.status === 'Open') && startTime > now);
        }
        const isClosed = quiz.status === 'Closed';

        if (quiz.attempt_status === 'submitted') {
            if (quiz.publish_marks === 0 || quiz.result_label === 'Pending') {
                return `<span style="color:#fdd663; font-weight:700; font-size:13px;">Pending</span>`;
            }
            return `<span style="color:#27ae60; font-weight:700; font-size:13px;">✓ Completed</span>`;
        } else if (isClosed) {
            return `<span style="color:#8b949e; font-weight:700; font-size:13px;">Closed</span>`;
        } else if (isScheduled) {
            const startTime = new Date(startTimeStr.replace(/-/g, "/"));
            return `<span class="quiz-countdown" 
                         data-start="${startTime.getTime()}" 
                         data-quiz-id="${quiz.id}"
                         style="color:#fdd663; font-weight:700; font-size:13px;">
                        Calculating...
                     </span>`;
        } else if (quiz.attempt_status === 'in_progress') {
            return `<span style="color:#e67e22; font-weight:700; font-size:13px; cursor:pointer;" onclick="loadQuizInstructions(${quiz.id})">Continue</span>`;
        } else {
            return `<span style="color:#4fd1c5; font-weight:700; font-size:13px; cursor:pointer;" onclick="loadQuizInstructions(${quiz.id})">Start</span>`;
        }
    }

    let html = `
        <style>
            @media (min-width: 900px) {
                .lqz-desktop-layout { display: flex !important; }
                .lqz-mobile-list    { display: none !important; }
                .lqz-mobile-search-wrap { display: none !important; }
                .lqz-mobile-head    { display: none !important; }
                .lqz-mobile-chips   { display: none !important; }
            }
            @media (max-width: 899px) {
                .lqz-desktop-layout { display: none !important; }
                .lqz-mobile-list    { display: block !important; }
            }

            .lqz-desktop-layout {
                --lqz-listw: 320px;
                /* Teacher palette */
                --lqz-text:   #f0efec;
                --lqz-soft:   #c2c3b7;
                --lqz-muted:  #9b9c92;
                --lqz-faint:  #7a7b73;
                --lqz-accent: #4fd1c5;
                --lqz-line:        rgba(255,255,255,0.07);
                --lqz-line-strong: rgba(255,255,255,0.14);
                --lqz-hover:  rgba(255,255,255,0.055);
                --lqz-active: rgba(255,255,255,0.095);
                /* Type weights for the whole desktop quiz page (Geist). Tune here. */
                --lqz-w-strong: 500;  /* title, status chip, group labels, primary button, selected row */
                --lqz-w-medium: 400;  /* filter chips, values, small actions */
                display: flex;
                gap: 0;
                min-height: 500px;
                font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
                font-size: 14px;
                font-weight: 400;
                font-variant-numeric: tabular-nums; /* marks, times and counts line up */
                -webkit-font-smoothing: antialiased; /* keeps light weights from looking heavy on dark */
                -moz-osx-font-smoothing: grayscale;
                line-height: normal;
                color: var(--lqz-text);
            }
            /* The mockup sizes everything border-box; without this the header is
               65px instead of 64px and the rail is 321px instead of 280px. */
            .lqz-desktop-layout,
            .lqz-desktop-layout *,
            .lqz-desktop-layout *::before,
            .lqz-desktop-layout *::after { box-sizing: border-box; }
            .lqz-desktop-layout :focus-visible { outline: 2px solid var(--lqz-accent); outline-offset: -2px; }

            /* ── List pane (transparent, same as the detail pane) ── */
            .lqz-sidebar {
                width: var(--lqz-listw);
                min-width: 260px;
                max-width: 420px;
                flex-shrink: 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: transparent;
                border-right: 1px solid var(--lqz-line);
            }
            .lqz-lh {
                padding: 12px 12px 10px;
                border-bottom: 1px solid var(--lqz-line);
                flex-shrink: 0;
            }
            .lqz-desktop-search-wrap { position: relative; }
            .lqz-desktop-search-wrap svg {
                position: absolute;
                left: 11px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--lqz-faint);
            }
            .lqz-desktop-search {
                width: 100%;
                box-sizing: border-box;
                height: 34px;
                padding: 0 10px 0 33px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--lqz-line);
                color: var(--lqz-text);
                font-size: 13px;
                font-weight: 400;
                font-family: inherit;
                transition: border-color 0.2s;
            }
            .lqz-desktop-search:focus { outline: none; border-color: var(--lqz-accent); }
            .lqz-desktop-search::placeholder { color: var(--lqz-faint); }
            /* Filter pills stay under the search bar; the active pill is neutral, like the teacher chips */
            .lqz-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
            .lqz-chip {
                height: 26px;
                padding: 0 10px;
                border-radius: 999px;
                border: 1px solid var(--lqz-line);
                background: none;
                color: var(--lqz-muted);
                font-family: inherit;
                font-size: 12px;
                font-weight: var(--lqz-w-medium);
                white-space: nowrap;
                cursor: pointer;
            }
            .lqz-chip:hover { color: var(--lqz-text); background: var(--lqz-hover); }
            .lqz-chip.on {
                background: var(--lqz-active);
                border-color: var(--lqz-line-strong);
                color: var(--lqz-text);
                font-weight: var(--lqz-w-strong);
            }
            .lqz-sidebar-scroll {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                position: relative;
                outline: none;
                padding-bottom: 8px;
            }
            .lqz-sidebar-scroll:focus-visible { outline: 2px solid var(--lqz-accent); outline-offset: -2px; }
            .lqz-sidebar-scroll::-webkit-scrollbar { width: 8px; }
            .lqz-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lqz-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; transition: background 0.15s ease; }
            .lqz-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

            /* Collapsible teacher group (same as the learner assignments list) */
            .lqz-gl {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 12px 14px 6px;
                color: var(--lqz-muted);
                font-size: 10px;
                font-weight: var(--lqz-w-strong);
                letter-spacing: 0.08em;
                text-transform: uppercase;
                cursor: pointer;
                user-select: none;
                outline: none;
            }
            .lqz-gl:hover { color: var(--lqz-soft); }
            .lqz-gl-chev { flex-shrink: 0; transition: transform 0.15s ease; }
            .lqz-gl[aria-expanded="false"] .lqz-gl-chev { transform: rotate(-90deg); }
            .lqz-gl-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .lqz-gb.collapsed { display: none; }

            /* Row: ring (green once handed in), title, date */
            .lqz-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 48px;
                padding: 6px 14px;
                cursor: pointer;
            }
            .lqz-sidebar-item:hover { background: var(--lqz-hover); }
            .lqz-sidebar-item.active { background: var(--lqz-active); }
            .lqz-sidebar-dot {
                width: 7px;
                height: 7px;
                box-sizing: border-box;
                border-radius: 50%;
                border: 1.5px solid var(--lqz-faint);
                background: transparent;
                flex-shrink: 0;
            }
            .lqz-sidebar-dot.is-done { background: #22c55e; border-color: #22c55e; }
            .lqz-sidebar-item-info { flex: 1; min-width: 0; }
            .lqz-sidebar-item-title {
                font-size: 14px;
                font-weight: 400;
                color: var(--lqz-soft);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-sidebar-item-meta {
                font-size: 11px;
                font-weight: 400;
                color: var(--lqz-faint);
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            /* the selected row reads as current through brighter text and one step more weight */
            .lqz-sidebar-item.active .lqz-sidebar-item-title { color: var(--lqz-text); font-weight: var(--lqz-w-strong); }
            .lqz-list-empty { padding: 40px 20px; text-align: center; color: var(--lqz-faint); font-size: 13px; }

            /* ── Resize handle ── */
            .lqz-split {
                width: 6px;
                margin-left: -3px;
                flex-shrink: 0;
                cursor: col-resize;
                position: relative;
                z-index: 2;
                outline: none;
            }
            .lqz-split:hover, .lqz-split.drag, .lqz-split:focus-visible {
                background: linear-gradient(90deg, transparent 2px, #4fd1c5 2px, #4fd1c5 4px, transparent 4px);
            }

            /* ── Detail pane ── */
            .lqz-main-panel {
                flex: 1;
                min-width: 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                container-type: inline-size;
            }
            .lqz-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--lqz-faint);
                gap: 12px;
                padding: 40px;
            }
            .lqz-panel-empty svg { opacity: 0.3; }
            .lqz-panel-empty p { font-size: 14px; margin: 0; }

            .lqz-dh {
                height: 64px;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 28px;
                border-bottom: 1px solid var(--lqz-line);
                flex-shrink: 0;
            }
            /* id prefix so a host-level #api-content-area h2 rule cannot recolour the title */
            #lqz-main-panel .lqz-dh-title {
                margin: 0;
                min-width: 0;
                font-family: inherit;
                font-size: 18px;
                font-weight: var(--lqz-w-strong);
                line-height: 1.25;
                color: var(--lqz-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            /* Fixed height + line-height:1 so the chip is the same 23px tall whatever
               line-height the host page sets, and sits centred on the title. */
            .lqz-panel-status {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
                height: 23px;
                padding: 0 8px;
                border-radius: 6px;
                border: 1px solid var(--lqz-line);
                font-size: 11px;
                font-weight: var(--lqz-w-strong);
                line-height: 1;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                white-space: nowrap;
                color: var(--lqz-muted);
            }
            .lqz-panel-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .lqz-panel-status--sum {
                background: var(--lqz-active);
                border-color: var(--lqz-line-strong);
                color: var(--lqz-text);
            }
            .lqz-dsp { flex: 1; }
            /* Non-clickable states (Completed / Pending / Closed / countdown) share the
               primary button's 34px height so the right edge of the header lines up. */
            .lqz-act-text {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
                height: 34px;
                padding: 0 14px;
                border-radius: 8px;
                border: 1px solid var(--lqz-line);
                font-size: 13px;
                font-weight: var(--lqz-w-medium);
                line-height: 1;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }
            .lqz-act-text svg { flex-shrink: 0; }
            .lqz-pri {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                height: 34px;
                padding: 0 18px;
                border-radius: 8px;
                background: #c2c3b7;
                color: #0d1117;
                font-weight: var(--lqz-w-strong);
                font-size: 13px;
                text-decoration: none;
                flex-shrink: 0;
                cursor: pointer;
            }
            .lqz-pri:hover { background: #adaea2; }
            .lqz-pri--warn { background: #e67e22; }
            .lqz-pri--warn:hover { background: #d06f1c; }
            .lqz-dbody { flex: 1; min-height: 0; display: flex; }
            .lqz-body { flex: 1; min-width: 0; overflow-y: auto; padding: 28px; }
            .lqz-body::-webkit-scrollbar { width: 8px; }
            .lqz-body::-webkit-scrollbar-track { background: transparent; }
            .lqz-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            .lqz-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            .lqz-read { max-width: 760px; }
            .lqz-lead { color: var(--lqz-soft); line-height: 1.7; margin: 0 0 20px; font-size: 14px; }

            .lqz-panel-marks-note {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                font-size: 13px;
                line-height: 1.6;
                color: var(--lqz-muted);
                padding: 10px 12px;
                margin-bottom: 20px;
                border: 1px solid var(--lqz-line);
                border-radius: 8px;
            }
            .lqz-panel-marks-note svg { flex-shrink: 0; margin-top: 3px; }
            .lqz-panel-marks-note strong { color: var(--lqz-soft); font-weight: var(--lqz-w-medium); }
            .lqz-panel-inst-list strong, .lqz-panel-inst-note strong { font-weight: var(--lqz-w-medium); }
            .lqz-panel-marks-note--ready, .lqz-panel-marks-note--ready strong { color: #6fcf97; }

            .lqz-panel-instructions-loading { color: var(--lqz-faint); font-size: 13px; }
            .lqz-panel-inst-label {
                font-size: 12px;
                font-weight: var(--lqz-w-strong);
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: var(--lqz-muted);
                margin: 0 0 10px;
            }
            .lqz-panel-inst-list { margin: 0; padding-left: 18px; color: var(--lqz-soft); line-height: 1.8; font-size: 14px; }
            .lqz-panel-inst-list li.lqz-panel-inst-warn { color: #e67e22; }
            .lqz-panel-inst-note { color: var(--lqz-faint); font-size: 13px; }
            .lqz-panel-inst-note strong { color: var(--lqz-soft); }

            /* ── Context rail (hides when the detail pane is under 900px wide) ── */
            .lqz-rail {
                width: 280px;
                flex-shrink: 0;
                border-left: 1px solid var(--lqz-line);
                padding: 24px 20px;
                overflow-y: auto;
            }
            .lqz-rail h4 {
                margin: 0 0 14px;
                font-size: 12px;
                font-weight: var(--lqz-w-strong);
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: var(--lqz-muted);
            }
            .lqz-kv {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid var(--lqz-line);
                font-size: 13px;
            }
            .lqz-kv span { color: var(--lqz-muted); }
            .lqz-kv b { font-weight: var(--lqz-w-medium); text-align: right; color: var(--lqz-text); }
            @container (max-width: 899px) { .lqz-rail { display: none; } }

            /* ── MOBILE LIST: the quiet list (phones, and the 769–899px range that still shows the phone layout). Same look as the Assignments list ──
               One calm column: a title with a counts line, a search box, filter chips, then a label for each teacher with
               a status ring, a title and one line of detail per row. Weights stay at 400 (text) and 600 (titles and names),
               the same as the rest of the phone pages. The colours are the --qm-* tokens below, so light mode only has to
               change the tokens (see the light blocks in quiz.css). */
            .lqz-mobile-head,
            .lqz-mobile-search-wrap,
            .lqz-mobile-chips,
            .lqz-mobile-list {
                --qm-title: #ecece9;
                --qm-body: #c2c3b7;
                --qm-muted: #8b8b87;
                --qm-faint: #5f605a;
                --qm-line: rgba(255,255,255,0.07);
                --qm-press: rgba(255,255,255,0.04);
                --qm-surf: #272726;
                --qm-ring: #73746d;
                --qm-soon: #f28c38;
                --qm-go: #4fd1c5;
                --qm-amber: #fdd663;
                --qm-ok: #4dbb85;
                --qm-chipline: rgba(255,255,255,0.12);
                --qm-chipon: #ecece9;
                --qm-chipon-text: #20201f;
            }

            .lqz-mobile-head { padding: 4px 2px 0; }
            .lqz-mobile-title {
                margin: 0;
                font-family: inherit;
                font-size: 28px;
                font-weight: 600;
                line-height: 1.15;
                letter-spacing: -0.2px;
                color: var(--qm-title);
            }
            .lqz-mobile-sub { margin: 5px 0 0; font-size: 14px; line-height: 1.4; font-weight: 400; color: var(--qm-muted); }
            .lqz-mobile-sub b { font-weight: 600; color: var(--qm-soon); }

            .lqz-mobile-list {
                background: transparent;
                border-radius: 0;
                overflow: visible;
                margin: 0 0 14px;
            }
            @media (max-width: 899px) {
                .lqz-mobile-list {
                    margin-left: -18px;
                    margin-right: -18px;
                }
            }

            /* search */
            .lqz-mobile-search-wrap { display: block; position: relative; margin: 14px 0 0; }
            .lqz-mobile-search-wrap svg {
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--qm-muted);
            }
            .lqz-mobile-search {
                width: 100%;
                box-sizing: border-box;
                height: 42px;
                padding: 0 14px 0 42px;
                border: 0;
                border-radius: 12px;
                background: var(--qm-surf);
                color: var(--qm-title);
                font: inherit;
                font-size: 16px; /* 16px stops iOS zooming the page when the box is focused */
                font-weight: 400;
                -webkit-appearance: none;
                appearance: none;
            }
            .lqz-mobile-search:focus { outline: none; box-shadow: inset 0 0 0 1px var(--qm-chipline); }
            .lqz-mobile-search::placeholder { color: var(--qm-muted); opacity: 1; }

            /* filter chips */
            .lqz-mobile-chips {
                display: flex;
                gap: 6px;
                margin: 12px 0 0;
                overflow-x: auto;
                scrollbar-width: none;
            }
            .lqz-mobile-chips::-webkit-scrollbar { display: none; }
            .lqz-mobile-chip {
                flex: none;
                height: 32px;
                padding: 0 10px;
                border-radius: 16px;
                border: 1px solid var(--qm-chipline);
                background: transparent;
                color: var(--qm-muted);
                font: inherit;
                font-size: 13px;
                font-weight: 400;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            .lqz-mobile-chip.on { background: var(--qm-chipon); border-color: var(--qm-chipon); color: var(--qm-chipon-text); }

            /* a teacher's label: name, class, how many, fold arrow */
            .lqz-mobile-folder-header {
                display: flex;
                align-items: baseline;
                gap: 8px;
                padding: 20px 20px 4px;
                background: transparent;
                cursor: pointer;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            .lqz-mobile-folder-header:focus-visible { outline: 2px solid var(--qm-chipline); outline-offset: -2px; }
            .lqz-mobile-folder-name {
                flex: 0 1 auto;
                min-width: 0;
                font-size: 14px;
                font-weight: 600;
                color: var(--qm-body);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-mobile-folder-sub {
                flex: 1 1 0;
                min-width: 0;
                font-size: 13px;
                font-weight: 400;
                color: var(--qm-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-mobile-folder-count { flex: none; margin-left: auto; font-size: 13px; font-weight: 400; color: var(--qm-muted); }
            .lqz-mobile-folder-chevron {
                flex: none;
                align-self: center;
                color: var(--qm-muted);
                transition: transform 0.2s ease;
            }
            .lqz-mobile-folder-header--collapsed .lqz-mobile-folder-chevron { transform: rotate(-90deg); }
            .lqz-mobile-folder-body { display: block; }
            .lqz-mobile-folder-body.collapsed { display: none; }
            /* while a search or filter is on, every group that has a match shows open and nothing is saved */
            .lqz-mobile-list.is-filtering .lqz-mobile-folder-body.collapsed { display: block; }
            .lqz-mobile-list.is-filtering .lqz-mobile-folder-header--collapsed .lqz-mobile-folder-chevron { transform: none; }

            /* a row: ring, title, one line of detail, arrow. The hairline starts under the title, not under the ring. */
            .lqz-mobile-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 11px 20px;
                background: transparent;
                cursor: pointer;
                transition: background 0.15s;
                position: relative;
                -webkit-tap-highlight-color: transparent;
            }
            .lqz-mobile-row::before {
                content: '';
                position: absolute;
                top: 0;
                left: 58px;
                right: 0;
                height: 1px;
                background: var(--qm-line);
            }
            .lqz-mobile-row--first::before { display: none; }
            .lqz-mobile-row:active { background: var(--qm-press); }
            .lqz-mobile-row:focus-visible { outline: 2px solid var(--qm-chipline); outline-offset: -2px; }
            .lqz-mobile-row-icon { flex: none; width: 24px; height: 24px; display: inline-flex; color: var(--qm-ring); }
            .lqz-mobile-row-icon svg { width: 24px; height: 24px; }
            .lqz-mobile-row-icon--go { color: var(--qm-go); }
            .lqz-mobile-row-icon--wait { color: var(--qm-amber); }
            .lqz-mobile-row-icon--prog { color: var(--qm-ring); }
            .lqz-mobile-row-icon--prog .lqz-mobile-ring-arc { stroke: var(--qm-soon); }
            .lqz-mobile-row-icon--done { color: var(--qm-ok); }
            .lqz-mobile-row-icon--closed { color: var(--qm-faint); }
            .lqz-mobile-row-icon--soonq { color: var(--qm-ring); }
            .lqz-mobile-row-body { flex: 1; min-width: 0; }
            .lqz-mobile-row-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.25;
                color: var(--qm-title);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-mobile-row-title-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .lqz-mobile-row-meta {
                margin-top: 3px;
                font-size: 13px;
                font-weight: 400;
                line-height: 1.3;
                color: var(--qm-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-mobile-st--soon { color: var(--qm-soon); }
            .lqz-mobile-st--ok { color: var(--qm-ok); }
            .lqz-mobile-st--go { color: var(--qm-go); }
            .lqz-mobile-st--amber { color: var(--qm-amber); }
            /* Start / Continue on the right, and the live countdown for a quiz that has not opened yet */
            .lqz-mobile-row-action { flex: none; font-size: 14px; font-weight: 600; color: var(--qm-go); }
            .lqz-mobile-row-action--prog { color: var(--qm-soon); }
            .lqz-mobile-cd { flex: none; font-size: 12.5px; font-weight: 400; color: var(--qm-amber); font-variant-numeric: tabular-nums; }
            /* a row with nothing to open (closed, done, not open yet) does not press or point */
            .lqz-mobile-row--static { cursor: default; }
            .lqz-mobile-row--static:active { background: transparent; }

            /* ── MOBILE EMPTY STATES (no assignments / no search or filter matches) ── */
            .lqz-mobile-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 24px;
                color: var(--qm-muted);
                min-height: 46vh;
            }
            .lqz-mobile-empty svg { opacity: 0.5; margin-bottom: 14px; }
            .lqz-mobile-empty-title {
                color: var(--qm-title);
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 6px;
            }
            .lqz-mobile-empty-body {
                color: var(--qm-muted);
                font-size: 14px;
                font-weight: 400;
                margin: 0;
                line-height: 1.5;
            }
            .lqz-summative-badge {
                display: inline-flex;
                align-items: center;
                background: rgba(245,200,66,0.12);
                color: #f5c842;
                border: 1px solid rgba(245,200,66,0.3);
                font-size: 9px;
                font-weight: 700;
                padding: 1px 5px;
                border-radius: 4px;
                letter-spacing: 0.4px;
                flex-shrink: 0;
                white-space: nowrap;
            }

        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lqz-desktop-layout lqz-flat-layout" id="lqz-desktop-layout">
            <div class="lqz-sidebar">
                <div class="lqz-lh">
                    <div class="lqz-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lqz-desktop-search" id="lqzDesktopSearch"
                            placeholder="Filter quizzes" oninput="lqzDesktopSearch(this.value)">
                    </div>
                    <div class="lqz-chips" id="lqz-chips"></div>
                </div>
                <div class="lqz-sidebar-scroll" id="lqz-list" tabindex="0" onkeydown="lqzListKeydown(event)"></div>
            </div>
            <div class="lqz-split" id="lqz-split" role="separator" aria-orientation="vertical" aria-label="Resize quiz list" tabindex="0"></div>
            <div class="lqz-main-panel lqz-flat-panel" id="lqz-main-panel">
                <div class="lqz-panel-empty">
                    ${learnerQuizPencilSvg(48, 48, '#4fd1c5').replace('stroke-width="2"', 'stroke-width="1.5"')}
                    <p>${hasAnyQuizzes ? 'Select a quiz from the left' : "Your teachers haven't posted any quizzes yet."}</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    // ── Phone: title and counts, search, filter chips, then the teacher groups ──
    // (the desktop layout above is a separate tree; the phone tree below is hidden from 900px up)
    let openCount = 0, progressCount = 0, upcomingCount = 0;
    window._allLearnerQuizzesFlat.forEach(quiz => {
        const s = lqzQuizState(quiz);
        if (s.key === 'open') { if (quiz.attempt_status === 'in_progress') progressCount++; else openCount++; }
        else if (s.key === 'upcoming') upcomingCount++;
    });
    const mobileSummary = !hasAnyQuizzes ? ''
        : [openCount && `${openCount} available now`, progressCount && `${progressCount} in progress`].filter(Boolean).join(' · ')
            || (upcomingCount ? `${upcomingCount} coming up` : 'Nothing open right now');

    html += `
        <div class="lqz-mobile-head">
            <h1 class="lqz-mobile-title">Quizzes</h1>
            ${mobileSummary ? `<p class="lqz-mobile-sub">${mobileSummary}</p>` : ''}
        </div>`;

    // Mobile search bar — always rendered and always tappable, even in
    // empty states, so the learner can search/clear without a dead-end UI.
    html += `
        <div class="lqz-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"/>
            </svg>
            <input type="text" class="lqz-mobile-search" id="lqzMobileSearch"
                placeholder="Search quizzes" aria-label="Search quizzes" oninput="lqzMobileSearch(this.value)">
        </div>`;

    if (hasAnyQuizzes) {
        html += `<div class="lqz-mobile-chips" role="group" aria-label="Filter quizzes">${
            [['all', 'All'], ['open', 'Open'], ['upcoming', 'Upcoming'], ['done', 'Done'], ['closed', 'Closed']]
                .map(([k, label]) => `<button type="button" class="lqz-mobile-chip${k === 'all' ? ' on' : ''}" data-filter="${k}" aria-pressed="${k === 'all'}" onclick="lqzMobileSetFilter('${k}')">${label}</button>`)
                .join('')
        }</div>`;
    }

    window._lqzMobFilter = 'all';
    window._lqzMobTerm = '';

    html += `<div class="lqz-mobile-list">`;

    // True empty state — no quizzes posted at all yet.
    if (!hasAnyQuizzes) {
        html += `
            <div class="lqz-mobile-empty">
                ${learnerQuizPencilSvg(44, 44, 'currentColor').replace('stroke-width="2"', 'stroke-width="1.5"')}
                <p class="lqz-mobile-empty-title">No quizzes yet</p>
                <p class="lqz-mobile-empty-body">Your teachers haven't posted any quizzes. Check back soon.</p>
            </div>`;
    }

    // Zero-results state — hidden by default, shown by lqzMobileApply() when a
    // search or filter matches nothing. Kept in the DOM (not injected fresh
    // each keystroke) so it can just be toggled.
    html += `
        <div class="lqz-mobile-empty lqz-mobile-search-empty" id="lqzMobileSearchEmpty" style="display:none;">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p class="lqz-mobile-empty-title" id="lqzMobileSearchEmptyText">No matches</p>
            <p class="lqz-mobile-empty-body" id="lqzMobileSearchEmptyBody">Try a different title or teacher name.</p>
        </div>`;

    let mobileGroupIdx = 0;
    for (const { teacher, quizzes } of teacherEntries) {
        const gid = `lqz-mg-${mobileGroupIdx}`;
        // A teacher's group starts open while it holds a quiz that is open or still to come; one that is all done or
        // closed starts folded. A learner's own choice (saved page state) wins, see restoreQuizPageState().
        const open = quizzes.some(quiz => ['open', 'upcoming'].includes(lqzQuizState(quiz).key));
        html += `
            <div class="lqz-mobile-folder-header${open ? '' : ' lqz-mobile-folder-header--collapsed'}" role="button" tabindex="0"
                aria-expanded="${open}" aria-controls="${gid}"
                data-search="${escapeHtml(String(teacher).toLowerCase())}"
                onclick="toggleLqzMobileFolder('${gid}', this)"
                onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLqzMobileFolder('${gid}', this); }">
                <span class="lqz-mobile-folder-name">${escapeHtml(teacher)}</span>
                <span class="lqz-mobile-folder-sub"></span>
                <span class="lqz-mobile-folder-count">${quizzes.length}</span>
                <svg class="lqz-mobile-folder-chevron" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </div>
            <div class="lqz-mobile-folder-body${open ? '' : ' collapsed'}" id="${gid}">`;
        mobileGroupIdx++;

        quizzes.forEach((quiz, quizIdx) => {
            const s = lqzQuizState(quiz);
            const inProgress = s.key === 'open' && quiz.attempt_status === 'in_progress';
            const pending = s.key === 'done' && (quiz.publish_marks === 0 || quiz.result_label === 'Pending');
            const ringKind = s.key === 'done' ? (pending ? 'wait' : 'done')
                : s.key === 'closed' ? 'closed'
                : s.key === 'upcoming' ? 'soonq'
                : inProgress ? 'prog' : 'go';

            // the one line under the title: a state word where there is one, then what the quiz is made of
            const qs = quiz.question_count > 0 ? `${quiz.question_count} question${quiz.question_count !== 1 ? 's' : ''}` : '';
            const pts = quiz.total_points > 0 ? `${quiz.total_points} pts` : '';
            const mins = Number(quiz.duration) > 0 ? `${Number(quiz.duration)} min` : '';
            const openDetail = [mins, qs].filter(Boolean).join(' · ');
            const detail = (s.key === 'open' && !inProgress ? openDetail : [pts, qs].filter(Boolean).join(' · '));
            const word = (cls, text) => `<span class="lqz-mobile-st lqz-mobile-st--${cls}">${text}</span>`;
            let metaHtml, action = '';
            const startMs = parseLearnerQuizTime(quiz.start_time);
            if (s.key === 'done') metaHtml = word(pending ? 'amber' : 'ok', pending ? 'Awaiting results' : 'Completed') + (detail ? ' · ' + detail : '');
            else if (s.key === 'closed') metaHtml = 'Closed' + (detail ? ' · ' + detail : '');
            else if (s.key === 'upcoming') {
                metaHtml = 'Opens ' + lqzMobileDay(startMs) + ', ' + lqzMobileTime(startMs);
                action = `<span class="quiz-countdown lqz-mobile-cd" data-start="${startMs}" data-quiz-id="${quiz.id}"></span>`;
            }
            else if (inProgress) {
                metaHtml = word('soon', 'In progress') + (detail ? ' · ' + detail : '');
                action = '<span class="lqz-mobile-row-action lqz-mobile-row-action--prog">Continue</span>';
            }
            else {
                metaHtml = word('go', 'Available now') + (detail ? ' · ' + detail : '');
                action = '<span class="lqz-mobile-row-action">Start</span>';
            }

            // only a quiz that is open (or unfinished) can be opened; the other rows are information
            const canOpen = s.key === 'open';
            const rowAttrs = canOpen
                ? `role="button" tabindex="0" onclick="loadQuizInstructions(${quiz.id})" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadQuizInstructions(${quiz.id}); }"`
                : '';

            html += `
                <div class="lqz-mobile-row${quizIdx === 0 ? ' lqz-mobile-row--first' : ''}${canOpen ? '' : ' lqz-mobile-row--static'}" ${rowAttrs}
                    data-quiz-id="${quiz.id}" data-title="${escapeHtml(quiz.title).toLowerCase()}" data-state="${s.key}" data-details="${escapeHtml(openDetail)}">
                    <div class="lqz-mobile-row-icon lqz-mobile-row-icon--${ringKind}">${lqzMobileRing(ringKind)}</div>
                    <div class="lqz-mobile-row-body">
                        <div class="lqz-mobile-row-title">
                            <span class="lqz-mobile-row-title-text">${escapeHtml(quiz.title)}</span>
                        </div>
                        <div class="lqz-mobile-row-meta">${metaHtml}</div>
                    </div>
                    ${action}
                </div>`;
        });
        html += `</div>`; // close .lqz-mobile-folder-body
    }

    html += `</div>`; // close .lqz-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
    lqzEnsureFont();
    window.lqzInitDesktop();
    startQuizCountdowns();
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT QUIZ
// ─────────────────────────────────────────────
window.selectDesktopLearnerQuiz = function(flatIdx) {
    window._learnerQuizSelectedIdx = flatIdx;
    saveQuizPageState();
    document.querySelectorAll('.lqz-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lqz-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const quiz = (window._allLearnerQuizzesFlat || [])[flatIdx];
    if (!quiz) return;

    const panel = document.getElementById('lqz-main-panel');
    if (!panel) return;

    const now = new Date();
    const startTimeStr = quiz.start_time || "";
    let isScheduled = false;
    if (startTimeStr) {
        const st = new Date(startTimeStr.replace(/-/g, "/"));
        isScheduled = ((quiz.status === 'Scheduled' || quiz.status === 'Open') && st > now);
    }
    const isClosed = quiz.status === 'Closed';
    const isCompleted = quiz.attempt_status === 'submitted' && !(quiz.publish_marks === 0 || quiz.result_label === 'Pending');
    const isPendingResult = quiz.attempt_status === 'submitted' && (quiz.publish_marks === 0 || quiz.result_label === 'Pending');
    const isInProgress = quiz.attempt_status === 'in_progress';
    const canTakeQuiz = !isClosed && !isScheduled && !isCompleted && !isPendingResult;

    // ── Status badge — colour comes from lqzQuizState(), the same helper the list
    //    dots use, so a row's dot and the panel chip can never disagree. ──
    const state = lqzQuizState(quiz);
    const statusDotColor = state.color;
    let statusLabel = 'Not Started';
    if (isCompleted) statusLabel = 'Completed';
    else if (isPendingResult) statusLabel = 'Pending Result';
    else if (isClosed) statusLabel = 'Closed';
    else if (isScheduled) statusLabel = 'Scheduled';
    else if (isInProgress) statusLabel = 'In Progress';

    const checkSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

    // ── Primary action (header, right-aligned) ──
    let actionBtn = '';
    if (isCompleted) {
        actionBtn = `<span class="lqz-act-text" style="color:${state.color};">${checkSvg}Completed</span>`;
    } else if (isPendingResult) {
        actionBtn = `<span class="lqz-act-text" style="color:${state.color};">Pending</span>`;
    } else if (isClosed) {
        actionBtn = `<span class="lqz-act-text" style="color:#9aa4b2;">Closed</span>`;
    } else if (isScheduled) {
        const st = new Date(startTimeStr.replace(/-/g, "/"));
        actionBtn = `<span class="quiz-countdown lqz-act-text" data-start="${st.getTime()}" data-quiz-id="${quiz.id}" style="color:${state.color};">Calculating...</span>`;
    } else if (isInProgress) {
        actionBtn = `<a class="lqz-pri lqz-pri--warn" href="take_quiz.php?quiz_id=${quiz.id}">Continue quiz</a>`;
    } else {
        actionBtn = `<a class="lqz-pri" href="take_quiz.php?quiz_id=${quiz.id}">Start quiz</a>`;
    }

    const summativeBadge = quiz.is_summative
        ? `<span class="lqz-panel-status lqz-panel-status--sum">Summative</span>`
        : '';

    const sender = quiz.teacher || 'Teacher';
    const instructionsBoxId = `lqz-inst-${quiz.id}-${flatIdx}`;

    // ── Marks-availability note (shown for submitted quizzes only) ──
    let marksNoteHtml = '';
    if (isPendingResult) {
        marksNoteHtml = `
            <div class="lqz-panel-marks-note">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Your marks will be available on <strong>Gradebook</strong> once your teacher releases them.</span>
            </div>`;
    } else if (isCompleted) {
        marksNoteHtml = `
            <div class="lqz-panel-marks-note lqz-panel-marks-note--ready">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span>Your marks are available on <strong>Gradebook</strong>.</span>
            </div>`;
    }

    let leadHtml = '';
    if (isScheduled) {
        leadHtml = `<p class="lqz-lead">This quiz opens on ${escapeHtml(formatQuizDate(quiz.start_time))}. The Start button appears here automatically when it opens.</p>`;
    } else if (isClosed && !isCompleted && !isPendingResult) {
        leadHtml = `<p class="lqz-lead">This quiz is closed and can no longer be attempted.</p>`;
    }

    const showInstructions = canTakeQuiz || isInProgress;
    const attemptsRow = showInstructions
        ? `<div class="lqz-kv"><span>Attempts allowed</span><b id="lqz-attempts-${quiz.id}">—</b></div>`
        : '';

    panel.innerHTML = `
        <div class="lqz-dh">
            <h2 class="lqz-dh-title">${escapeHtml(quiz.title)}</h2>
            <span class="lqz-panel-status"><span class="lqz-panel-status-dot" style="background:${statusDotColor};"></span>${statusLabel}</span>
            ${summativeBadge}
            <span class="lqz-dsp"></span>
            ${actionBtn}
        </div>
        <div class="lqz-dbody">
            <div class="lqz-body">
                <div class="lqz-read">
                    ${marksNoteHtml}
                    ${leadHtml}
                    ${showInstructions ? `
                    <div class="lqz-panel-instructions" id="${instructionsBoxId}">
                        <div class="lqz-panel-instructions-loading">Loading instructions…</div>
                    </div>` : ''}
                </div>
            </div>
            <aside class="lqz-rail">
                <h4>Details</h4>
                <div class="lqz-kv"><span>Subject</span><b>${escapeHtml(quiz.subject)}</b></div>
                <div class="lqz-kv"><span>Teacher</span><b>${escapeHtml(sender)}</b></div>
                <div class="lqz-kv"><span>Time limit</span><b>${escapeHtml(quiz.duration)} min</b></div>
                <div class="lqz-kv"><span>Opens</span><b>${escapeHtml(formatQuizDate(quiz.start_time))}</b></div>
                <div class="lqz-kv"><span>Type</span><b>${quiz.is_summative ? 'Summative' : 'Formative'}</b></div>
                ${attemptsRow}
            </aside>
        </div>`;

    // Keep the selected row visible inside the list (scrolls the list only)
    const listBox = document.getElementById('lqz-list');
    if (listBox && sidebarItem && sidebarItem.offsetParent !== null) {
        const top = sidebarItem.offsetTop, bottom = top + sidebarItem.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }

    // Kick off countdown if needed
    startQuizCountdowns();

    // Load instructions inline for actionable quizzes only
    if (showInstructions) {
        loadLearnerQuizPanelInstructions(quiz.id, instructionsBoxId);
    }
    if (window.learnerPageState) wireQuizScrollState();
};

// Fetches quiz instructions and renders them inline in the desktop panel,
// in the same simple/unboxed style as the rest of the panel (no separate screen).
window.loadLearnerQuizPanelInstructions = async function(quizId, boxId) {
    try {
        const response = await fetch(`api/learner/get_quiz_instructions.php?quiz_id=${quizId}`);
        const payload = await response.json();
        if (payload.status === 'error') throw new Error(payload.message || 'Unable to load instructions');

        const box = document.getElementById(boxId);
        if (!box) return; // user navigated away before this resolved

        const data = payload.data ?? payload;

        const attemptsEl = document.getElementById(`lqz-attempts-${quizId}`);
        if (attemptsEl && data.attemptLimit !== undefined && data.attemptLimit !== null) attemptsEl.textContent = String(data.attemptLimit);

        const bullets = [
            data.isContinuing ? `<li class="lqz-panel-inst-warn"><strong>Note:</strong> you have an unfinished attempt — you'll resume where you left off.</li>` : '',
            `<li>You can attempt this quiz <strong>${escapeHtml(data.attemptLimit)}</strong> time(s).</li>`,
            `<li>The timer starts immediately once you begin and cannot be paused.</li>`,
            data.layout_mode === 'multi_page'
                ? `<li>AI invigilator is active — tab switches and exits are monitored per question.</li>`
                : `<li>Session monitoring is active for this quiz.</li>`,
        ].filter(Boolean).join('');

        box.innerHTML = `
            <div class="lqz-panel-inst-label">Instructions</div>
            <ul class="lqz-panel-inst-list">${bullets}</ul>
        `;
    } catch (err) {
        const box = document.getElementById(boxId);
        if (box) box.innerHTML = `<div class="lqz-panel-inst-note">Couldn't load instructions: ${escapeHtml(err.message)}</div>`;
    }
};

window._lqzMobFilter = 'all';
window._lqzMobTerm = '';

// Shows the rows that match both the filter chip and the search box, and only the groups that still have a row.
// Folding is left alone (the list just shows every match while filtering), so clearing the search puts it back as it was.
function lqzMobileApply() {
    const list = document.querySelector('.lqz-mobile-list');
    if (!list) return;
    const term = window._lqzMobTerm || '';
    const filter = window._lqzMobFilter || 'all';
    const filtering = !!term || filter !== 'all';
    list.classList.toggle('is-filtering', filtering);

    let totalVisible = 0;
    list.querySelectorAll('.lqz-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        // a search that names the teacher shows all of that group's rows
        const groupHit = !!term && (header?.dataset.search || '').includes(term);
        let visible = 0;
        body.querySelectorAll('.lqz-mobile-row').forEach(row => {
            const show = (filter === 'all' || row.dataset.state === filter)
                && (!term || groupHit || (row.dataset.title || '').includes(term));
            row.style.display = show ? '' : 'none';
            row.classList.toggle('lqz-mobile-row--first', show && visible === 0);
            if (show) visible++;
        });
        if (header) {
            header.style.display = visible ? '' : 'none';
            const count = header.querySelector('.lqz-mobile-folder-count');
            if (count) count.textContent = String(visible);
        }
        body.style.display = visible ? '' : 'none';
        totalVisible += visible;
    });

    // Zero-results empty state — only when a search or filter is on and nothing matched.
    const searchEmpty = document.getElementById('lqzMobileSearchEmpty');
    if (searchEmpty) {
        const showEmpty = filtering && totalVisible === 0;
        searchEmpty.style.display = showEmpty ? 'flex' : 'none';
        if (showEmpty) {
            const label = document.getElementById('lqzMobileSearchEmptyText');
            const body = document.getElementById('lqzMobileSearchEmptyBody');
            const raw = (document.getElementById('lqzMobileSearch')?.value || '').trim();
            const none = { open: 'Nothing open right now', upcoming: 'Nothing coming up', done: 'Nothing completed yet', closed: 'No closed quizzes' };
            if (label) label.textContent = raw ? `No matches for "${raw}"` : (none[filter] || 'No matches');
            if (body) body.textContent = raw ? 'Try a different title or teacher name.' : 'Pick another filter to see more.';
        }
    }

    // Filtering rows/folders in/out of view changes the page's scrollable
    // height just like expanding/collapsing a folder does, but without a
    // real scroll event — same recalculation fix as the folder toggle.
    recheckMobileNavAfterToggle();
}

window.lqzMobileSetFilter = function(key) {
    window._lqzMobFilter = key || 'all';
    document.querySelectorAll('.lqz-mobile-chip').forEach(chip => {
        const on = chip.dataset.filter === window._lqzMobFilter;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    lqzMobileApply();
    saveQuizPageState();
};

window.lqzMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('quiz', { mobileSearch: val });
    window._lqzMobTerm = String(val || '').toLowerCase().trim();
    lqzMobileApply();
};

// ─────────────────────────────────────────────
// DESKTOP LIST: status groups, filter chips, search
// ─────────────────────────────────────────────
window._lqzFilter = 'all';
window._lqzTerm = '';
window._lqzCollapsed = window._lqzCollapsed || new Set();

// "15 Oct 2026" — the date the quiz opens, with no time (the detail panel shows the full time)
function lqzDateOnly(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(/-/g, '/'));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lqzQuizState(quiz) {
    const st = quiz.start_time ? new Date(String(quiz.start_time).replace(/-/g, '/')) : null;
    const scheduled = !!st && (quiz.status === 'Scheduled' || quiz.status === 'Open') && st > new Date();
    const submitted = quiz.attempt_status === 'submitted';
    const pending = submitted && (quiz.publish_marks === 0 || quiz.result_label === 'Pending');
    if (submitted) return { key: 'done', group: 'Completed', color: pending ? '#fdd663' : '#22c55e', badge: pending ? 'Pending' : 'Done' };
    if (quiz.status === 'Closed') return { key: 'closed', group: 'Closed', color: '#6b7280', badge: 'Closed' };
    if (scheduled) return { key: 'upcoming', group: 'Upcoming', color: '#fdd663', badge: st.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) };
    if (quiz.attempt_status === 'in_progress') return { key: 'open', group: 'Available now', color: '#e67e22', badge: 'Continue' };
    return { key: 'open', group: 'Available now', color: '#4fd1c5', badge: 'Start' };
}

window.lqzRenderDesktopList = function () {
    const list = document.getElementById('lqz-list');
    if (!list) return;
    const term = window._lqzTerm;
    const items = (window._allLearnerQuizzesFlat || []).map((quiz, idx) => ({ quiz, idx, s: lqzQuizState(quiz) }));
    const showActive = !!document.querySelector('#lqz-main-panel .lqz-dh');

    // Filter chips with counts
    const counts = { all: items.length, open: 0, upcoming: 0, done: 0 };
    items.forEach(i => { if (counts[i.s.key] !== undefined) counts[i.s.key]++; });
    const chipsEl = document.getElementById('lqz-chips');
    if (chipsEl) {
        chipsEl.innerHTML = [['all', 'All'], ['open', 'Open'], ['upcoming', 'Upcoming'], ['done', 'Done']]
            .map(([k, label]) => `<button type="button" class="lqz-chip${window._lqzFilter === k ? ' on' : ''}" onclick="lqzSetFilter('${k}')">${label} ${counts[k]}</button>`)
            .join('');
    }

    const visible = items.filter(i =>
        (window._lqzFilter === 'all' || i.s.key === window._lqzFilter) &&
        (!term || `${i.quiz.title || ''} ${i.quiz.subject || ''} ${i.quiz.teacher || ''}`.toLowerCase().includes(term))
    );

    // Group by teacher, in the order the page already sorts them (most recent work first),
    // the same way the learner assignments list groups by teacher.
    const groups = [];
    const byTeacher = new Map();
    visible.forEach(item => {
        const key = String(item.quiz.teacher || item.quiz.subject || 'Teacher');
        let g = byTeacher.get(key);
        if (!g) { g = { key, rows: [] }; byTeacher.set(key, g); groups.push(g); }
        g.rows.push(item);
    });

    if (!window._lqzCollapsed) window._lqzCollapsed = new Set();
    const CHEV = '<svg class="lqz-gl-chev" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    let html = '';
    groups.forEach(({ key, rows }) => {
        // a search always shows every match, whatever was folded away
        const collapsed = !term && window._lqzCollapsed.has(key);
        html += `
            <div class="lqz-group">
                <div class="lqz-gl" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}"
                     data-teacher="${escapeHtml(key)}"
                     onclick="lqzToggleGroup(this)" onkeydown="lqzGroupKeydown(event, this)">
                    ${CHEV}<span class="lqz-gl-name">${escapeHtml(key)}</span>
                </div>
                <div class="lqz-gb${collapsed ? ' collapsed' : ''}">`;
        rows.forEach(({ quiz, idx, s }) => {
            const done = s.key === 'done';
            const active = showActive && idx === window._learnerQuizSelectedIdx ? ' active' : '';
            html += `
                    <div class="lqz-sidebar-item${active}" id="lqz-sidebar-${idx}" onclick="selectDesktopLearnerQuiz(${idx})">
                        <span class="lqz-sidebar-dot${done ? ' is-done' : ''}" role="img" aria-label="${done ? 'Handed in' : 'Not handed in'}" title="${done ? 'Handed in' : 'Not handed in'}"></span>
                        <div class="lqz-sidebar-item-info">
                            <div class="lqz-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                            <div class="lqz-sidebar-item-meta">${escapeHtml(lqzDateOnly(quiz.start_time || quiz.created_at))}</div>
                        </div>
                    </div>`;
        });
        html += `
                </div>
            </div>`;
    });
    list.innerHTML = html || `<div class="lqz-list-empty">${items.length ? 'No quizzes match.' : "Your teachers haven't posted any quizzes yet."}</div>`;
};

// Fold / unfold one teacher group. The DOM is updated in place so the list does not jump.
window.lqzToggleGroup = function (headerEl) {
    if (!headerEl) return;
    const body = headerEl.nextElementSibling;
    if (!body) return;
    const key = headerEl.dataset.teacher || '';
    if (!window._lqzCollapsed) window._lqzCollapsed = new Set();
    const nowCollapsed = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', nowCollapsed);
    headerEl.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    if (nowCollapsed) window._lqzCollapsed.add(key);
    else window._lqzCollapsed.delete(key);
    saveQuizPageState();
};

window.lqzGroupKeydown = function (e, headerEl) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    window.lqzToggleGroup(headerEl);
};

window.lqzSetFilter = function (key) {
    window._lqzFilter = key;
    window.lqzRenderDesktopList();
};

window.lqzDesktopSearch = function (val) {
    window._lqzTerm = String(val || '').toLowerCase().trim();
    window.lqzRenderDesktopList();
};

// ↑ / ↓ move through the list
window.lqzListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // rows inside a folded group are hidden, so up / down step over them
    const ids = Array.from(document.querySelectorAll('#lqz-list .lqz-sidebar-item'))
        .filter(el => el.offsetParent !== null)
        .map(el => parseInt(el.id.replace('lqz-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._learnerQuizSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopLearnerQuiz(ids[next]);
};

// Desktop never shows an empty detail pane when there's something to show
window.lqzEnsureSelection = function () {
    if (window.innerWidth < 900) return;
    if (document.querySelector('#lqz-list .lqz-sidebar-item.active')) return;
    const first = Array.from(document.querySelectorAll('#lqz-list .lqz-sidebar-item')).find(el => el.offsetParent !== null);
    if (first) window.selectDesktopLearnerQuiz(parseInt(first.id.replace('lqz-sidebar-', ''), 10));
};

// Drag (or ← / →) to resize the list; width is remembered
window.lqzInitSplit = function () {
    const layout = document.getElementById('lqz-desktop-layout');
    const split = document.getElementById('lqz-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--lqz-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--lqz-listw'), 10) || 320;
    const persist = () => { try { localStorage.setItem('lqz.listWidth', String(current())); } catch (e) {} };
    try {
        const saved = parseInt(localStorage.getItem('lqz.listWidth'), 10);
        if (saved) apply(saved);
    } catch (e) {}

    split.addEventListener('mousedown', e => {
        e.preventDefault();
        split.classList.add('drag');
        document.body.style.userSelect = 'none';
        const left = layout.getBoundingClientRect().left;
        const move = ev => apply(ev.clientX - left);
        const up = () => {
            split.classList.remove('drag');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            persist();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
    split.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        apply(current() + (e.key === 'ArrowRight' ? 16 : -16));
        persist();
    });
};

window.lqzInitDesktop = function () {
    window._lqzFilter = 'all';
    window._lqzTerm = '';
    window.lqzRenderDesktopList();
    window.lqzInitSplit();
};

// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a folder is expanded/collapsed — same fix as in
// assignments.js/announcements.js. A single delayed check would need to
// know the exact CSS transition/display change timing (unknown from
// here, and could change) — polling a few times over ~400ms means it
// settles on the right answer regardless.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

// Open or fold one teacher group, keeping the header, the body and the screen-reader state in step.
function lqzMobileSetFolder(header, body, open) {
    body.classList.toggle('collapsed', !open);
    header.classList.toggle('lqz-mobile-folder-header--collapsed', !open);
    header.setAttribute('aria-expanded', open ? 'true' : 'false');
}

window.toggleLqzMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body || !headerEl) return;
    // While a search or filter is on, every group with a match is shown open; folding one would change nothing.
    if (body.closest('.lqz-mobile-list')?.classList.contains('is-filtering')) return;
    lqzMobileSetFolder(headerEl, body, body.classList.contains('collapsed'));
    saveQuizPageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
};

function startQuizCountdowns() {
    const countdowns = document.querySelectorAll('.quiz-countdown');
    if (!countdowns.length) return;

    countdowns.forEach(el => {
        // Already ticking (this runs on every panel select and list render)
        if (el.dataset.cdRunning) return;
        el.dataset.cdRunning = '1';

        const startMs = parseInt(el.dataset.startMs || el.dataset.start);
        const quizId  = el.dataset.quizId;

        const tick = setInterval(() => {
            // Panel was re-rendered and this element is gone — stop its timer
            if (!el.isConnected) { clearInterval(tick); return; }
            const diff = startMs - Date.now();

            if (diff <= 0) {
                clearInterval(tick);
                // Phone list: the whole row becomes an open one
                if (el.classList.contains('lqz-mobile-cd')) { lqzMobileRowOpen(el.closest('.lqz-mobile-row'), quizId); return; }
                // Smooth swap to Start button
                el.style.transition = 'opacity 0.4s';
                el.style.opacity = '0';
                setTimeout(() => {
                    if (!el.isConnected) return;
                    // Desktop panel: swap in the same primary button the panel renders
                    // for an open quiz. Mobile rows keep the text action.
                    el.outerHTML = el.classList.contains('lqz-act-text')
                        ? `<a class="lqz-pri" href="take_quiz.php?quiz_id=${quizId}">Start quiz</a>`
                        : `<span style="color:#4fd1c5; font-weight:700; font-size:13px; cursor:pointer;"
                                 onclick="loadQuizInstructions(${quizId})">Start</span>`;
                }, 400);
                return;
            }

            if (el.classList.contains('lqz-mobile-cd')) { el.textContent = lqzMobileCountdownText(diff); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            if (h > 0) {
                el.textContent = `Starts in ${h}h ${m}m ${s}s`;
            } else if (m > 0) {
                el.textContent = `Starts in ${m}m ${s}s`;
            } else {
                el.textContent = `Starts in ${s}s`;
            }
        }, 1000);

         // Run immediately so there's no 1s delay on first render
        const diff0 = startMs - Date.now();
        if (diff0 > 0 && el.classList.contains('lqz-mobile-cd')) {
            el.textContent = lqzMobileCountdownText(diff0);
        } else if (diff0 > 0) {
            const h = Math.floor(diff0 / 3600000);
            const m = Math.floor((diff0 % 3600000) / 60000);
            const s = Math.floor((diff0 % 60000) / 1000);
            if (h > 0)      el.textContent = `Starts in ${h}h ${m}m ${s}s`;
            else if (m > 0) el.textContent = `Starts in ${m}m ${s}s`;
            else            el.textContent = `Starts in ${s}s`;
        }
    });
}