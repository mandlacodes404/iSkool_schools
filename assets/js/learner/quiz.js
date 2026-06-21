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

window.fetchQuizzes = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastLearnerPage", "quiz_list.php");

    // 1. STANDARD MODE: Show Bottom Nav and Sidebar Menu
    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Quizzes', mode: 'standard', color: '#fdd663' });
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

    // 3a. If prefetch is still in-flight, wait for it (no duplicate request)
    if (window.learnerQuizPrefetchPromise) {
        if (loader) loader.style.display = 'flex';
        await window.learnerQuizPrefetchPromise;
    }

    // 3b. Cache Check – serve instantly
    if (window.learnerQuizCache) {
        renderQuizCards(window.learnerQuizCache);
        if (loader) loader.style.display = 'none';
        restoreQuizPageState();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_quizzes.php');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const payload = await response.json();
        if (payload.status === 'error') throw new Error(payload.message || 'Unable to load quizzes');
        const groupedData = payload.data ?? payload;
        window.learnerQuizCache = groupedData; 
        renderQuizCards(groupedData);
        restoreQuizPageState();
    } catch (error) {
        console.error("Quiz Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load quizzes at the moment.</p>
                    <button onclick="window.learnerQuizCache=null; fetchQuizzes()" 
                            style="background:#4fd1c5; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; color:white;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveQuizPageState() {
    const sidebar = document.querySelector('.lqz-sidebar-scroll');
    const state = {
        selectedIdx:  window._learnerQuizSelectedIdx ?? null,
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mobileSearch: document.getElementById('lqzMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lqz-mobile-folder-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('quiz', state);
    else sessionStorage.setItem('quizPageState', JSON.stringify(state));
}

function restoreQuizPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('quiz')
            : JSON.parse(sessionStorage.getItem('quizPageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lqzMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lqzMobileSearch(state.mobileSearch);
                }
            }
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lqz-mobile-folder-body').forEach(body => {
                    const open = state.openFolders.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const chev = body.previousElementSibling?.querySelector('.lqz-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
                window.selectDesktopLearnerQuiz(state.selectedIdx);
                const sidebar = document.querySelector('.lqz-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            }
        });
    } catch (e) { /* ignore bad state */ }
}

window.loadQuizInstructions = async function(quizId) {
    const apiArea = document.getElementById('api-content-area');
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
if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`api/learner/get_quiz_instructions.php?quiz_id=${quizId}`);
        const payload = await response.json();

        if (payload.status === 'error') throw new Error(payload.message || 'Unable to load instructions');
        if (payload.error) throw new Error(payload.error);
        const data = payload.data ?? payload;

        // 2. Inject your EXACT HTML and Styles
        apiArea.innerHTML = `
            <style>
                .inst-container { max-width: 700px; margin: auto; background-color: #1b1b1b; padding: 30px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); }
                .quiz-info-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 18px; border-radius: 10px; margin-bottom: 25px; color: #8b949e; }
                .inst-list { list-style: none; padding: 0; }
                .inst-list li { margin-bottom: 12px; color: #8b949e; position: relative; padding-left: 24px; }
                .inst-list li::before { content: "•"; color: #4fd1c5; position: absolute; left: 0; font-weight: bold; }
                .ai-box { background: rgba(79, 209, 197, 0.05); border: 1px solid rgba(79, 209, 197, 0.3); border-radius: 10px; padding: 15px; margin-top: 25px; }
                .start-btn { background: rgba(79, 209, 197, 0.1); color: #e2e8f0; padding: 14px 30px; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; font-weight: 700; cursor: pointer; width: 100%; max-width: 320px; display: block; margin: 35px auto 0; transition: 0.3s; }
                .start-btn:hover { border-color: #4fd1c5; background: rgba(79, 209, 197, 0.2); }
                @media (max-width: 899px) {
                    .inst-container {
                        background-color: transparent;
                        border: 0;
                        border-radius: 0;
                        padding: 18px 16px 110px;
                    }
                }
            </style>
            
            <div class="inst-container">
                <h2 style="text-align:center; color:#e2e8f0; margin-bottom:25px;">Quiz Instructions</h2>
                
                <div class="quiz-info-box">
                    <p><strong>Quiz Title:</strong> ${escapeHtml(data.title)}</p>
                    <p><strong>Duration:</strong> ${escapeHtml(data.duration)} minutes</p>
                    <p><strong>Attempts Allowed:</strong> ${escapeHtml(data.attemptLimit)}</p>
                </div>

                <h3 style="color:#c9d1d9;">⚠️ Please read carefully:</h3>
                <ul class="inst-list">
                    ${data.isContinuing ? `<li style="color: #e67e22;"><strong>Note:</strong> You have an unfinished attempt. You will resume.</li>` : ''}
                    <li>You can only attempt this quiz <strong>${escapeHtml(data.attemptLimit)}</strong> time(s).</li>
                    <li>The timer starts immediately and cannot be paused.</li>
                </ul>

                ${data.layout_mode === 'multi_page' ? `
<div class="ai-box">
    <h4 style="color: #4fd1c5; margin-top: 0;">
        <i class="fas fa-robot"></i> AI Invigilator Active
    </h4>
    <p style="font-size: 13px; color: #8b949e; margin: 0;">
        Tab switching and quiz exits are monitored and logged per question.
    </p>
</div>` : `
<div class="ai-box" style="border-color: rgba(139,148,158,0.3);">
    <h4 style="color: #8b949e; margin-top: 0;">
        <i class="fas fa-robot"></i> Session Monitoring Active
    </h4>
    <p style="font-size: 13px; color: #8b949e; margin: 0;">
        Your session integrity is being tracked.
    </p>
</div>`}

                <form action="take_quiz.php" method="GET" style="margin-top: 35px; text-align:center;">
                    <input type="hidden" name="quiz_id" value="${quizId}">
                    <button type="submit" class="start-btn" style="${data.isContinuing ? 'background-color: #e67e22;' : ''}">
                        ${data.isContinuing ? 'Continue Quiz' : 'Start Quiz'}
                    </button>
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

function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const now = new Date();

    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; margin-top:60px; color: #888;'>No quizzes available.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerQuizzesFlat = [];
    const desktopQuizzesByTeacher = {};
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        quizzes.forEach(quiz => {
            const teacher = String(quiz.teacher || quiz.teacher_name || quiz.created_by_name || subject || 'Unknown Teacher').trim() || 'Unknown Teacher';
            const desktopQuiz = { ...quiz, subject, teacher };
            window._allLearnerQuizzesFlat.push(desktopQuiz);
            if (!desktopQuizzesByTeacher[teacher]) desktopQuizzesByTeacher[teacher] = [];
            desktopQuizzesByTeacher[teacher].push(desktopQuiz);
        });
    }

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

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    let desktopGroupIdx = 0;
    for (const [teacher, quizzes] of Object.entries(desktopQuizzesByTeacher)) {
        const groupId = `lqz-dg-${desktopGroupIdx++}`;
        sidebarHtml += `
            <div class="lqz-desktop-teacher-group">
                <button type="button" class="lqz-desktop-teacher-header" onclick="toggleLqzDesktopGroup('${groupId}', this)">
                    <svg class="lqz-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="lqz-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="lqz-desktop-teacher-name">${escapeHtml(teacher)}</span>
                    <span class="lqz-desktop-teacher-count">${quizzes.length}</span>
                </button>
                <div class="lqz-desktop-teacher-body collapsed" id="${groupId}">`;
        quizzes.forEach(quiz => {
            flatIdx = window._allLearnerQuizzesFlat.indexOf(quiz);
            const startTimeStr = quiz.start_time || "";
            let isScheduled = false;
            if (startTimeStr) {
                const st = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = ((quiz.status === 'Scheduled' || quiz.status === 'Open') && st > now);
            }
            const dotColor = quiz.attempt_status === 'submitted' ? '#22c55e'
                : quiz.status === 'Closed' ? '#6b7280'
                : isScheduled ? '#fdd663'
                : quiz.attempt_status === 'in_progress' ? '#e67e22'
                : '#4fd1c5';

            sidebarHtml += `
                <div class="lqz-sidebar-item" id="lqz-sidebar-${flatIdx}"
                    data-title="${escapeHtml(quiz.title || '').toLowerCase()}"
                    onclick="selectDesktopLearnerQuiz(${flatIdx})">
                    <div class="lqz-sidebar-item-icon">
                        ${learnerQuizPencilSvg(16, 16, '#4fd1c5')}
                    </div>
                    <div class="lqz-sidebar-item-info">
                        <div class="lqz-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                        <div class="lqz-sidebar-item-meta">${escapeHtml(quiz.duration)} mins &middot; ${escapeHtml(formatQuizDate(quiz.start_time))}</div>
                    </div>
                    <span class="lqz-sidebar-status-dot" style="background:${dotColor};"></span>
                </div>`;
        });
        sidebarHtml += `</div></div>`;
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lqz-desktop-layout { display: flex !important; }
                .lqz-mobile-list    { display: none !important; }
                .lqz-mobile-search-wrap { display: none !important; }
            }
            @media (max-width: 899px) {
                .lqz-desktop-layout { display: none !important; }
                .lqz-mobile-list    { display: block !important; }
            }

            .lqz-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lqz-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lqz-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lqz-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lqz-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lqz-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lqz-desktop-teacher-group { border-bottom: 1px solid rgba(255,255,255,0.04); }
            .lqz-desktop-teacher-header {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                background: transparent;
                border: 0;
                color: #8b949e;
                cursor: pointer;
                font-family: inherit;
                text-align: left;
            }
            .lqz-desktop-teacher-header:hover { background: rgba(255,255,255,0.03); color: #c9d1d9; }
            .lqz-desktop-teacher-chevron { flex-shrink: 0; transition: transform 0.2s ease; }
            .lqz-desktop-teacher-chevron.open { transform: rotate(90deg); }
            .lqz-desktop-teacher-folder-icon { flex-shrink: 0; opacity: 0.85; }
            .lqz-desktop-teacher-name {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
            }
            .lqz-desktop-teacher-count {
                flex-shrink: 0;
                font-size: 10px;
                font-weight: 800;
                color: #fdd663;
                background: rgba(253,214,99,0.1);
                border: 1px solid rgba(253,214,99,0.25);
                border-radius: 999px;
                padding: 1px 7px;
            }
            .lqz-desktop-teacher-body.collapsed { display: none; }
            .lqz-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lqz-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lqz-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .lqz-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .lqz-sidebar-item-info { flex: 1; min-width: 0; }
            .lqz-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-sidebar-item.active .lqz-sidebar-item-title { color: #e2e8f0; }
            .lqz-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .lqz-sidebar-status-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .lqz-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lqz-main-panel::-webkit-scrollbar { width: 5px; }
            .lqz-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lqz-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lqz-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lqz-panel-empty svg { opacity: 0.3; }
            .lqz-panel-empty p { font-size: 14px; margin: 0; }

            .lqz-panel-content { padding: 28px 32px; }

            .lqz-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lqz-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 8px;
            }
            .lqz-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .lqz-panel-action-row {
                margin-top: 28px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            /* ── MOBILE LIST STYLES ── */
            .lqz-mobile-list {
                background: #1a1919;
                border-radius: 12px;
                overflow: hidden;
                margin: 0 0 14px;
            }
            .lqz-mobile-folder-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 18px 20px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                cursor: pointer;
                user-select: none;
                transition: background 0.2s;
            }
            .lqz-mobile-folder-header:active { background: #1a1919; }
            .lqz-mobile-folder-icon { flex-shrink: 0; }
            .lqz-mobile-folder-name {
                flex: 1;
                font-size: 16px;
                font-weight: 800;
                color: #e2e8f0;
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lqz-mobile-folder-count {
                font-size: 12px;
                color: #8b949e;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                padding: 2px 8px;
                border-radius: 20px;
                flex-shrink: 0;
            }
            .lqz-mobile-folder-chevron {
                flex-shrink: 0;
                color: #555e6a;
                transition: transform 0.3s ease;
            }
            .lqz-mobile-folder-chevron.open { transform: rotate(90deg); }
            .lqz-mobile-folder-body { display: block; }
            .lqz-mobile-folder-body.collapsed { display: none; }
            .lqz-mobile-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 13px 16px;
                background: #1a1919;
                border-bottom: 0;
                border-radius: 0;
                border-left: 0;
                border-right: 0;
                cursor: pointer;
                transition: border-color 0.2s, transform 0.2s;
                position: relative;
            }
            .lqz-mobile-row::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 16px;
                right: 16px;
                height: 1px;
                background: rgba(255,255,255,0.05);
            }
            .lqz-mobile-row:last-child::after { display: none; }
            .lqz-mobile-row:hover:not([style*="opacity"]) { border-color: rgba(104,211,145,0.2); transform: translateX(3px); }
            .lqz-mobile-row-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: #fdd66318;
                border: 1px solid #fdd66330;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .lqz-mobile-row-body { flex: 1; min-width: 0; }
            .lqz-mobile-row-title {
                font-size: 14px;
                font-weight: 700;
                color: #e2e8f0;
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lqz-mobile-row-action {
                flex-shrink: 0;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
            }
            .lqz-mobile-row-status-dot {
                display: inline-block;
                width: 7px;
                height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .lqz-mobile-row-title-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .lqz-mobile-row-chevron {
                flex-shrink: 0;
                color: #555e6a;
            }
            .lqz-mobile-row-meta {
                font-size: 11px;
                color: #555e6a;
                margin-top: 2px;
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

            /* ── MOBILE SEARCH BAR ── */
            @media (max-width: 899px) {
                .lqz-mobile-search-wrap {
                    display: block;
                    margin-bottom: 10px;
                    position: relative;
                }
                .lqz-mobile-search-wrap svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    opacity: 0.4;
                }
                .lqz-mobile-search {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 9px 14px 9px 36px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #e2e8f0;
                    font-size: 13px;
                    font-family: 'Nunito', sans-serif;
                    transition: border-color 0.2s;
                }
                .lqz-mobile-search:focus { outline: none; border-color: #fdd663; }
                .lqz-mobile-search::placeholder { color: #555e6a; }
            }

            /* ── DESKTOP SEARCH BAR ── */
            .lqz-desktop-search-wrap {
                display: none;
                position: relative;
                padding: 10px 10px 8px;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lqz-desktop-search-wrap svg {
                position: absolute;
                left: 22px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                opacity: 0.4;
            }
            .lqz-desktop-search {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 12px 8px 32px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                color: #e2e8f0;
                font-size: 12.5px;
                font-family: 'Nunito', sans-serif;
                transition: border-color 0.2s;
            }
            .lqz-desktop-search:focus { outline: none; border-color: #fdd663; }
            .lqz-desktop-search::placeholder { color: #555e6a; }
            @media (min-width: 900px) {
                .lqz-desktop-search-wrap { display: block; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lqz-desktop-layout">
            <div class="lqz-sidebar">
                <div class="lqz-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lqz-desktop-search" id="lqzDesktopSearch"
                        placeholder="Search quizzes..." oninput="lqzDesktopSearch(this.value)">
                </div>
                <div class="lqz-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lqz-main-panel" id="lqz-main-panel">
                <div class="lqz-panel-empty">
                    ${learnerQuizPencilSvg(48, 48, '#fdd663').replace('stroke-width="2"', 'stroke-width="1.5"')}
                    <p>Select a quiz from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->`;

    // Mobile search bar (rendered outside the card so it spans full width)
    if (Object.keys(groupedData).length > 0) {
        html += `
        <div class="lqz-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lqz-mobile-search" id="lqzMobileSearch"
                placeholder="Search quizzes..." oninput="lqzMobileSearch(this.value)">
        </div>`;
    }

    html += `<div class="lqz-mobile-list">`;

    let mobileGroupIdx = 0;
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        const gid = `lqz-mg-${mobileGroupIdx}`;
        html += `
            <div class="lqz-mobile-folder-header" onclick="toggleLqzMobileFolder('${gid}', this)">
                <div class="lqz-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#fdd663" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lqz-mobile-folder-name">${escapeHtml(subject)}</span>
                <span class="lqz-mobile-folder-count">${quizzes.length} assessment${quizzes.length !== 1 ? 's' : ''}</span>
                <svg class="lqz-mobile-folder-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="lqz-mobile-folder-body collapsed" id="${gid}">`;
        mobileGroupIdx++;

        quizzes.forEach(quiz => {
            const displayDate = formatQuizDate(quiz.start_time);
            let isScheduled = false;
            let startTimeStr = quiz.start_time || "";
            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = ((quiz.status === 'Scheduled' || quiz.status === 'Open') && startTime > now);
            }
            const isClosed = quiz.status === 'Closed';

            let actionBtn = '';
            let rowClick = '';
            let rowKeydown = '';
            let statusText = '';
            let statusColor = '#8b949e';

            if (quiz.attempt_status === 'submitted') {
                if (quiz.publish_marks === 0 || quiz.result_label === 'Pending') {
                    actionBtn = `<span class="lqz-mobile-row-action" style="color:#fdd663;">Pending</span>`;
                    statusText = 'Awaiting Results';
                    statusColor = '#fdd663';
                } else {
                    actionBtn = `<span class="lqz-mobile-row-action" style="color:#22c55e;">✓ Done</span>`;
                    statusText = 'Completed';
                    statusColor = '#22c55e';
                }
            } else if (isClosed) {
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#6b7280;">Closed</span>`;
                statusText = 'No Longer Available';
                statusColor = '#6b7280';
            } else if (isScheduled) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                actionBtn = `<span class="quiz-countdown lqz-mobile-row-action"
                                   data-start="${startTime.getTime()}"
                                   data-quiz-id="${quiz.id}"
                                   style="color:#fdd663; font-size:11px;">
                                Calculating...
                             </span>`;
                statusText = `Opens ${formatQuizDate(quiz.start_time)}`;
                statusColor = '#fdd663';
            } else if (quiz.attempt_status === 'in_progress') {
                rowClick = `onclick="loadQuizInstructions(${quiz.id})"`;
                rowKeydown = `onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadQuizInstructions(${quiz.id}); }"`;
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#e67e22;" onclick="loadQuizInstructions(${quiz.id})">Continue</span>`;
                statusText = 'In Progress';
                statusColor = '#e67e22';
            } else {
                rowClick = `onclick="loadQuizInstructions(${quiz.id})"`;
                rowKeydown = `onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadQuizInstructions(${quiz.id}); }"`;
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#4fd1c5;" onclick="loadQuizInstructions(${quiz.id})">Start</span>`;
                statusText = 'Available Now';
                statusColor = '#4fd1c5';
            }
            const rowAttrs = rowClick ? `role="button" tabindex="0" ${rowClick} ${rowKeydown}` : '';

            const dotColor = quiz.attempt_status === 'submitted' ? '#22c55e'
                : isClosed ? '#6b7280'
                : isScheduled ? '#fdd663'
                : quiz.attempt_status === 'in_progress' ? '#e67e22'
                : '#4fd1c5';

            const metaPoints = (quiz.total_points > 0 || quiz.question_count > 0)
                ? `${quiz.total_points} pts &bull; ${quiz.question_count} Question${quiz.question_count !== 1 ? 's' : ''} &bull; `
                : '';

            html += `
                <div class="lqz-mobile-row" ${rowAttrs} data-title="${escapeHtml(quiz.title).toLowerCase()}">
                    <div class="lqz-mobile-row-icon">
                        ${learnerQuizPencilSvg(20, 20, '#fdd663')}
                    </div>
                    <div class="lqz-mobile-row-body">
                        <div class="lqz-mobile-row-title">
                            <span class="lqz-mobile-row-title-text">${escapeHtml(quiz.title)}</span>
                        </div>
                        <div class="lqz-mobile-row-meta">${metaPoints}<span style="color:${statusColor};">${statusText}</span></div>
                    </div>
                    <div class="lqz-mobile-row-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
        });
        html += `</div>`; // close .lqz-mobile-folder-body
    }

    html += `</div>`; // close .lqz-mobile-list

    apiArea.innerHTML = html;
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

    let actionBtn = '';
    if (quiz.attempt_status === 'submitted') {
        if (quiz.publish_marks === 0 || quiz.result_label === 'Pending') {
            actionBtn = `<span style="color:#fdd663; font-weight:700; font-size:15px;">Pending</span>`;
        } else {
        actionBtn = `<span style="color:#27ae60; font-weight:700; font-size:15px;">✓ Completed</span>`;
        }
    } else if (isClosed) {
        actionBtn = `<span style="color:#8b949e; font-weight:700; font-size:15px;">Closed</span>`;
    } else if (isScheduled) {
        const st = new Date(startTimeStr.replace(/-/g, "/"));
        actionBtn = `<span class="quiz-countdown" 
                         data-start="${st.getTime()}" 
                         data-quiz-id="${quiz.id}"
                         style="color:#fdd663; font-weight:700; font-size:15px;">
                        Calculating...
                     </span>`;
    } else if (quiz.attempt_status === 'in_progress') {
        actionBtn = `<button onclick="loadQuizInstructions(${quiz.id})"
            style="background:rgba(230,126,34,0.1);border:1px solid rgba(230,126,34,0.4);color:#e67e22;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
            Continue Quiz
        </button>`;
    } else {
        actionBtn = `<button onclick="loadQuizInstructions(${quiz.id})"
            style="background:rgba(79,209,197,0.1);border:1px solid rgba(79,209,197,0.4);color:#4fd1c5;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
            Start Quiz
        </button>`;
    }

    const summativeBadge = quiz.is_summative
        ? `<span style="background:rgba(79,209,197,0.1);border:1px solid rgba(79,209,197,0.3);color:#4fd1c5;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">Summative</span>`
        : '';

    panel.innerHTML = `
        <div class="lqz-panel-content">
            <div class="lqz-panel-header">
                <div class="lqz-panel-title">
                    ${escapeHtml(quiz.title)} ${summativeBadge}
                </div>
                <div class="lqz-panel-meta">
                    <span>${escapeHtml(quiz.subject)}</span>
                    <span>&bull;</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>${escapeHtml(quiz.duration)} mins</span>
                    <span>&bull;</span>
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${escapeHtml(formatQuizDate(quiz.start_time))}</span>
                </div>
            </div>
            <div class="lqz-panel-action-row">
                ${actionBtn}
            </div>
        </div>`;

    // Kick off countdown if needed
    startQuizCountdowns();
};

window.lqzMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('quiz', { mobileSearch: val });
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lqz-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const folderName = header ? header.querySelector('.lqz-mobile-folder-name').textContent.toLowerCase() : '';
        const rows = body.querySelectorAll('.lqz-mobile-row');
        let visible = 0;
        rows.forEach(row => {
            const title = (row.dataset.title || '');
            const show = !term || title.includes(term) || folderName.includes(term);
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        // Show/hide entire folder based on matches
        const folderWrap = header ? header.parentElement : null;
        if (header) header.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        body.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        // Keep folder open while searching
        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header ? header.querySelector('.lqz-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });
};

window.lqzDesktopSearch = function(val) {
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lqz-desktop-teacher-group').forEach(group => {
        const header = group.querySelector('.lqz-desktop-teacher-header');
        const body   = group.querySelector('.lqz-desktop-teacher-body');
        const nameEl = group.querySelector('.lqz-desktop-teacher-name');
        const groupName = nameEl ? nameEl.textContent.toLowerCase() : '';
        if (!header || !body) return;

        const items = body.querySelectorAll('.lqz-sidebar-item');
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
            const chev = header.querySelector('.lqz-desktop-teacher-chevron');
            if (chev) chev.classList.add('open');
        } else if (!term) {
            body.classList.add('collapsed');
            const chev = header.querySelector('.lqz-desktop-teacher-chevron');
            if (chev) chev.classList.remove('open');
        }
    });
};

window.toggleLqzMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lqz-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveQuizPageState();
};

window.toggleLqzDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lqz-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
};

function startQuizCountdowns() {
    const countdowns = document.querySelectorAll('.quiz-countdown');
    if (!countdowns.length) return;

    countdowns.forEach(el => {
        const startMs = parseInt(el.dataset.startMs || el.dataset.start);
        const quizId  = el.dataset.quizId;

        const tick = setInterval(() => {
            const diff = startMs - Date.now();

            if (diff <= 0) {
                clearInterval(tick);
                // Smooth swap to Start button
                el.style.transition = 'opacity 0.4s';
                el.style.opacity = '0';
                setTimeout(() => {
                    el.outerHTML = `<span style="color:#4fd1c5; font-weight:700; font-size:13px; cursor:pointer;"
                                         onclick="loadQuizInstructions(${quizId})">Start</span>`;
                }, 400);
                return;
            }

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
        if (diff0 > 0) {
            const h = Math.floor(diff0 / 3600000);
            const m = Math.floor((diff0 % 3600000) / 60000);
            const s = Math.floor((diff0 % 60000) / 1000);
            if (h > 0)      el.textContent = `Starts in ${h}h ${m}m ${s}s`;
            else if (m > 0) el.textContent = `Starts in ${m}m ${s}s`;
            else            el.textContent = `Starts in ${s}s`;
        }
    });
}