/* ============================================================
   iSkool — quiz.js  v2.0
   Drop-in replacement for assets/js/learner/quiz.js
   Changes from v1:
     - renderQuizCards() adds stat summary row
     - Cards get status- CSS class for stripe colouring
     - Pills use new quiz-action-pill classes
     - Instructions page uses new inst-* classes
     - startQuizCountdowns() unchanged (still works)
   ============================================================ */

window.learnerQuizCache      = null;
window.quizInstructionsCache = {};

/* ── Utility ── */
const formatQuizDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr.replace(/-/g, '/'));
    return date.toLocaleString('en-GB', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
};

/* ────────────────────────────────────────────────
   FETCH QUIZZES  (unchanged logic, same API call)
──────────────────────────────────────────────── */
window.fetchQuizzes = async function () {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    sessionStorage.setItem('lastLearnerPage', 'quiz_list.php');

    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Quizzes', mode: 'standard' });
    }
    if (typeof window.setActive === 'function') window.setActive('quiz_list.php');

    const apiArea        = document.getElementById('api-content-area');
    const iframe         = document.getElementById('mainFrame');
    const loader         = document.getElementById('loaderOverlay');
    const myClassContent = document.getElementById('myClassContent');

    if (apiArea)        apiArea.style.display  = 'block';
    if (iframe)         iframe.style.display   = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    /* Cache hit */
    if (window.learnerQuizCache) {
        renderQuizCards(window.learnerQuizCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_quizzes.php');
        if (!response.ok) throw new Error('Network response was not ok');
        const groupedData = await response.json();
        window.learnerQuizCache = groupedData;
        renderQuizCards(groupedData);
    } catch (error) {
        console.error('Quiz Fetch Error:', error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div class="quiz-empty">
                    <p style="color:#f85149; margin-bottom:14px;">Unable to load quizzes at the moment.</p>
                    <button onclick="window.learnerQuizCache=null; fetchQuizzes()"
                            style="background:var(--teal-dim,rgba(79,209,197,.1));
                                   border:1px solid rgba(79,209,197,.25);
                                   padding:9px 20px; border-radius:8px;
                                   cursor:pointer; color:#4fd1c5;
                                   font-family:'Sora',sans-serif; font-weight:700;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

/* ────────────────────────────────────────────────
   LOAD QUIZ INSTRUCTIONS  (updated markup only)
──────────────────────────────────────────────── */
window.loadQuizInstructions = async function (quizId) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    /* Cache hit */
    if (window.quizInstructionsCache[quizId]) {
        if (typeof window.configureHeader === 'function') {
            window.configureHeader({ title: 'Instructions', mode: 'detail' });
        }
        apiArea.innerHTML = window.quizInstructionsCache[quizId];
        if (loader) loader.style.display = 'none';
        return;
    }

    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Instructions', mode: 'detail' });
    }
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`api/learner/get_quiz_instructions.php?quiz_id=${quizId}`);
        const data     = await response.json();
        if (data.error) throw new Error(data.error);

        const resumeNote = data.isContinuing
            ? `<li class="inst-resume">⚠ You have an unfinished attempt — you will resume where you left off.</li>`
            : '';

        const aiBox = data.layout_mode === 'multi_page'
            ? `<div class="inst-ai-box monitored">
                   <div class="inst-ai-icon">🤖</div>
                   <div>
                       <div class="inst-ai-title">AI Invigilator Active</div>
                       <div class="inst-ai-desc">Tab switching and quiz exits are monitored and logged per question.</div>
                   </div>
               </div>`
            : `<div class="inst-ai-box session">
                   <div class="inst-ai-icon">🔒</div>
                   <div>
                       <div class="inst-ai-title">Session Monitoring Active</div>
                       <div class="inst-ai-desc">Your session integrity is being tracked throughout this quiz.</div>
                   </div>
               </div>`;

        const btnClass = data.isContinuing ? 'inst-start-btn resume' : 'inst-start-btn';
        const btnLabel = data.isContinuing ? '↩ Resume Quiz' : 'Start Quiz →';

        apiArea.innerHTML = `
            <div class="inst-container">
                <div class="inst-page-title">Quiz Instructions</div>

                <div class="inst-info-box">
                    <div class="inst-info-row">
                        <span>Quiz</span>
                        <span>${data.title}</span>
                    </div>
                    <div class="inst-info-row">
                        <span>Duration</span>
                        <span>${data.duration} minutes</span>
                    </div>
                    <div class="inst-info-row">
                        <span>Attempts allowed</span>
                        <span>${data.attemptLimit}</span>
                    </div>
                </div>

                <div class="inst-rule-heading">Please read carefully</div>
                <ul class="inst-list">
                    ${resumeNote}
                    <li>You can only attempt this quiz <strong style="color:var(--text-primary)">${data.attemptLimit}</strong> time(s).</li>
                    <li>The timer starts immediately and <strong style="color:var(--text-primary)">cannot be paused</strong>.</li>
                    <li>Ensure a stable internet connection before starting.</li>
                    <li>Do not refresh or close the browser tab during the quiz.</li>
                </ul>

                ${aiBox}

                <form action="take_quiz.php" method="GET">
                    <input type="hidden" name="quiz_id" value="${quizId}">
                    <button type="submit" class="${btnClass}">${btnLabel}</button>
                </form>
            </div>`;

        /* Only cache non-continuing attempts */
        if (!data.isContinuing) {
            window.quizInstructionsCache[quizId] = apiArea.innerHTML;
        }

    } catch (err) {
        apiArea.innerHTML = `
            <div class="quiz-empty" style="color:#f85149;">
                Error: ${err.message}
            </div>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

/* ────────────────────────────────────────────────
   RENDER QUIZ CARDS  — main upgrade
──────────────────────────────────────────────── */
function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = `<div class="quiz-empty">No quizzes available at the moment.</div>`;
        return;
    }

    const now = new Date();

    /* ── Build stat counts across all subjects ── */
    let countActive = 0, countDone = 0, countSoon = 0;

    for (const quizzes of Object.values(groupedData)) {
        quizzes.forEach(q => {
            if (q.attempt_status === 'submitted') {
                countDone++;
            } else if (q.status === 'Closed') {
                /* closed — not counted as active or soon */
            } else if (q.status === 'Scheduled' && q.start_time) {
                const st = new Date(q.start_time.replace(/-/g, '/'));
                if (st > now) countSoon++;
                else         countActive++;
            } else if (q.attempt_status === 'in_progress' || q.attempt_status === null) {
                if (q.status !== 'Closed') countActive++;
            }
        });
    }

    /* ── Stat row HTML ── */
    const statRow = `
        <div class="quiz-stat-row">
            <div class="quiz-stat-card accent">
                <div class="quiz-stat-label">Active Now</div>
                <div class="quiz-stat-val">${countActive}</div>
                <div class="quiz-stat-sub">quizzes open</div>
            </div>
            <div class="quiz-stat-card">
                <div class="quiz-stat-label">Completed</div>
                <div class="quiz-stat-val">${countDone}</div>
                <div class="quiz-stat-sub">this term</div>
            </div>
            <div class="quiz-stat-card">
                <div class="quiz-stat-label">Upcoming</div>
                <div class="quiz-stat-val">${countSoon}</div>
                <div class="quiz-stat-sub">scheduled</div>
            </div>
        </div>`;

    /* ── Cards HTML ── */
    let cardsHtml = '';

    for (const [subject, quizzes] of Object.entries(groupedData)) {
        cardsHtml += `
            <div class="quiz-subject-header">
                <span class="quiz-subject-title">${subject}</span>
                <span class="quiz-subject-line"></span>
            </div>`;

        quizzes.forEach(quiz => {
            const displayDate  = formatQuizDate(quiz.start_time);
            const startTimeStr = quiz.start_time || '';
            let isScheduled    = false;

            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, '/'));
                isScheduled     = (quiz.status === 'Scheduled' && startTime > now);
            }

            const isClosed = quiz.status === 'Closed';

            /* Summative badge */
            const summativeBadge = quiz.is_summative
                ? `<span class="quiz-summative-badge">✓ Summative</span>`
                : '';

            /* Determine status class + action pill */
            let statusClass = 'status-start';
            let actionPill  = '';

            if (quiz.attempt_status === 'submitted') {
                statusClass = 'status-done';
                actionPill  = `<span class="quiz-action-pill pill-done">✓ Done</span>`;

            } else if (isClosed) {
                statusClass = 'status-closed';
                actionPill  = `<span class="quiz-action-pill pill-closed">Closed</span>`;

            } else if (isScheduled) {
                statusClass = 'status-scheduled';
                const startMs = new Date(startTimeStr.replace(/-/g, '/')).getTime();
                actionPill = `
                    <span class="quiz-action-pill pill-scheduled quiz-countdown"
                          data-start="${startMs}"
                          data-quiz-id="${quiz.id}">
                        <span class="quiz-countdown">Calculating…</span>
                    </span>`;

            } else if (quiz.attempt_status === 'in_progress') {
                statusClass = 'status-continue';
                actionPill  = `
                    <span class="quiz-action-pill pill-continue"
                          onclick="loadQuizInstructions(${quiz.id})">
                        Resume →
                    </span>`;

            } else {
                statusClass = 'status-start';
                actionPill  = `
                    <span class="quiz-action-pill pill-start"
                          onclick="loadQuizInstructions(${quiz.id})">
                        Start →
                    </span>`;
            }

            cardsHtml += `
                <div class="quiz-card ${statusClass}">
                    <div class="quiz-card-left">
                        <div class="quiz-card-icon">📝</div>
                        <div class="quiz-card-body">
                            <div class="quiz-card-title">
                                ${quiz.title}${summativeBadge}
                            </div>
                            <div class="quiz-card-meta">
                                <span>
                                    <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    ${quiz.duration} mins
                                </span>
                                <span>
                                    <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    ${displayDate}
                                </span>
                            </div>
                        </div>
                    </div>
                    ${actionPill}
                </div>`;
        });
    }

    apiArea.innerHTML = statRow + cardsHtml;
    startQuizCountdowns();
}

/* ────────────────────────────────────────────────
   COUNTDOWN TIMER  (logic unchanged, markup tweaked)
──────────────────────────────────────────────── */
function startQuizCountdowns() {
    const countdowns = document.querySelectorAll('.quiz-countdown[data-start]');
    if (!countdowns.length) return;

    countdowns.forEach(el => {
        const startMs = parseInt(el.dataset.start);
        const quizId  = el.dataset.quizId;

        /* Inner span for text updates (parent pill keeps its styling) */
        const textEl = el.querySelector('span.quiz-countdown') || el;

        const fmt = (diff) => {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            if (h > 0) return `${h}h ${m}m ${s}s`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        };

        /* Immediate render */
        const diff0 = startMs - Date.now();
        if (diff0 > 0) textEl.textContent = `Starts in ${fmt(diff0)}`;

        const tick = setInterval(() => {
            const diff = startMs - Date.now();
            if (diff <= 0) {
                clearInterval(tick);
                /* Smooth swap to Start pill */
                el.style.transition = 'opacity 0.4s';
                el.style.opacity    = '0';
                setTimeout(() => {
                    el.outerHTML = `
                        <span class="quiz-action-pill pill-start"
                              onclick="loadQuizInstructions(${quizId})">
                            Start →
                        </span>`;
                }, 400);
                return;
            }
            textEl.textContent = `Starts in ${fmt(diff)}`;
        }, 1000);
    });
}