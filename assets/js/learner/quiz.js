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
        .then(data => { window.learnerQuizCache = data; })
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
        window.configureHeader({ title: 'Quizzes', mode: 'standard' });
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
        
        const groupedData = await response.json();
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
    };
    sessionStorage.setItem('quizPageState', JSON.stringify(state));
}

function restoreQuizPageState() {
    const raw = sessionStorage.getItem('quizPageState');
    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
            requestAnimationFrame(() => {
                window.selectDesktopLearnerQuiz(state.selectedIdx);
                const sidebar = document.querySelector('.lqz-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            });
        }
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
        const data = await response.json();

        if (data.error) throw new Error(data.error);

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
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        quizzes.forEach(quiz => {
            window._allLearnerQuizzesFlat.push({ ...quiz, subject });
        });
    }

    // ── Helper: build action button HTML for a quiz ──
    function buildActionBtn(quiz) {
        let isScheduled = false;
        const startTimeStr = quiz.start_time || "";
        if (startTimeStr) {
            const startTime = new Date(startTimeStr.replace(/-/g, "/"));
            isScheduled = (quiz.status === 'Scheduled' && startTime > now);
        }
        const isClosed = quiz.status === 'Closed';

        if (quiz.attempt_status === 'submitted') {
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
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        sidebarHtml += `<div class="lqz-sidebar-subject-label">${escapeHtml(subject)}</div>`;
        quizzes.forEach(quiz => {
            const startTimeStr = quiz.start_time || "";
            let isScheduled = false;
            if (startTimeStr) {
                const st = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = (quiz.status === 'Scheduled' && st > now);
            }
            const dotColor = quiz.attempt_status === 'submitted' ? '#22c55e'
                : quiz.status === 'Closed' ? '#6b7280'
                : isScheduled ? '#fdd663'
                : quiz.attempt_status === 'in_progress' ? '#e67e22'
                : '#4fd1c5';

            sidebarHtml += `
                <div class="lqz-sidebar-item" id="lqz-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerQuiz(${flatIdx})">
                    <div class="lqz-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </div>
                    <div class="lqz-sidebar-item-info">
                        <div class="lqz-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                        <div class="lqz-sidebar-item-meta">${escapeHtml(quiz.duration)} mins &middot; ${escapeHtml(formatQuizDate(quiz.start_time))}</div>
                    </div>
                    <span class="lqz-sidebar-status-dot" style="background:${dotColor};"></span>
                </div>`;
            flatIdx++;
        });
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lqz-desktop-layout { display: flex !important; }
                .lqz-mobile-list    { display: none !important; }
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
            .lqz-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .lqz-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lqz-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lqz-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lqz-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lqz-sidebar-subject-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
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
                margin: 0 0 16px;
            }
            .lqz-mobile-subject-header {
                padding: 16px 16px 6px;
                font-size: 11px;
                font-weight: 600;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: #1a1919;
            }
            .lqz-mobile-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 16px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                cursor: pointer;
            }
            .lqz-mobile-row:last-child { border-bottom: none; }
            .lqz-mobile-row:active { background: rgba(255,255,255,0.04); }
            .lqz-mobile-row-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: #4fd1c518;
                border: 1px solid #4fd1c530;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .lqz-mobile-row-body { flex: 1; min-width: 0; }
            .lqz-mobile-row-title {
                font-size: 14px;
                font-weight: 400;
                color: #e2e8f0;
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .lqz-mobile-row-action {
                flex-shrink: 0;
                font-size: 13px;
                font-weight: 600;
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
                color: #30363d;
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
        <div class="lqz-desktop-layout">
            <div class="lqz-sidebar">
                <div class="lqz-sidebar-header">All Quizzes</div>
                <div class="lqz-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lqz-main-panel" id="lqz-main-panel">
                <div class="lqz-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <p>Select a quiz from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="lqz-mobile-list">`;

    for (const [subject, quizzes] of Object.entries(groupedData)) {
        html += `<div class="lqz-mobile-subject-header">${escapeHtml(subject)}</div>`;

        quizzes.forEach(quiz => {
            const displayDate = formatQuizDate(quiz.start_time);
            let isScheduled = false;
            let startTimeStr = quiz.start_time || "";
            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = (quiz.status === 'Scheduled' && startTime > now);
            }
            const isClosed = quiz.status === 'Closed';

            let actionBtn = '';
            let rowClick = '';
            let rowKeydown = '';
            if (quiz.attempt_status === 'submitted') {
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#22c55e;">✓ Done</span>`;
            } else if (isClosed) {
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#6b7280;">Closed</span>`;
            } else if (isScheduled) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                actionBtn = `<span class="quiz-countdown lqz-mobile-row-action"
                                   data-start="${startTime.getTime()}"
                                   data-quiz-id="${quiz.id}"
                                   style="color:#fdd663; font-size:11px;">
                                Calculating...
                             </span>`;
            } else if (quiz.attempt_status === 'in_progress') {
                rowClick = `onclick="loadQuizInstructions(${quiz.id})"`;
                rowKeydown = `onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadQuizInstructions(${quiz.id}); }"`;
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#e67e22;" onclick="loadQuizInstructions(${quiz.id})">Continue</span>`;
            } else {
                rowClick = `onclick="loadQuizInstructions(${quiz.id})"`;
                rowKeydown = `onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadQuizInstructions(${quiz.id}); }"`;
                actionBtn = `<span class="lqz-mobile-row-action" style="color:#4fd1c5;" onclick="loadQuizInstructions(${quiz.id})">Start</span>`;
            }
            const rowAttrs = rowClick ? `role="button" tabindex="0" ${rowClick} ${rowKeydown}` : '';

            const dotColor = quiz.attempt_status === 'submitted' ? '#22c55e'
                : isClosed ? '#6b7280'
                : isScheduled ? '#fdd663'
                : quiz.attempt_status === 'in_progress' ? '#e67e22'
                : '#4fd1c5';

            html += `
                <div class="lqz-mobile-row" ${rowAttrs}>
                    <div class="lqz-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                    </div>
                    <div class="lqz-mobile-row-body">
                        <div class="lqz-mobile-row-title">
                            <span class="lqz-mobile-row-title-text">${escapeHtml(quiz.title)}</span>
                            <span class="lqz-mobile-row-status-dot" style="background:${dotColor};"></span>
                        </div>
                    </div>
                    <div class="lqz-mobile-row-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
        });
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
        isScheduled = (quiz.status === 'Scheduled' && st > now);
    }
    const isClosed = quiz.status === 'Closed';

    let actionBtn = '';
    if (quiz.attempt_status === 'submitted') {
        actionBtn = `<span style="color:#27ae60; font-weight:700; font-size:15px;">✓ Completed</span>`;
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
