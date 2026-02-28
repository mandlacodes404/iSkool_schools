/* assets/js/quiz.js */
window.learnerQuizCache = null; 
const formatQuizDate = (dateStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr.replace(/-/g, "/"));
    return date.toLocaleString('en-GB', { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true 
    });
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
        tick();
    });
}

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
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 3. Cache Check
    if (window.learnerQuizCache) {
        renderQuizCards(window.learnerQuizCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_quizzes.php');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const groupedData = await response.json();
        window.learnerQuizCache = groupedData; 
        renderQuizCards(groupedData);
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

window.loadQuizInstructions = async function(quizId) {
    const apiArea = document.getElementById('api-content-area');
    const loader = document.getElementById("loaderOverlay");

    // 1. DETAIL MODE: Hides Bottom Nav, Hides Sidebar Toggle, Shows Back Button
    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Instructions', mode: 'detail' });
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`api/get_quiz_instructions.php?quiz_id=${quizId}`);
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
            </style>
            
            <div class="inst-container">
                <h2 style="text-align:center; color:#e2e8f0; margin-bottom:25px;">Quiz Instructions</h2>
                
                <div class="quiz-info-box">
                    <p><strong>Quiz Title:</strong> ${data.title}</p>
                    <p><strong>Duration:</strong> ${data.duration} minutes</p>
                    <p><strong>Attempts Allowed:</strong> ${data.attemptLimit}</p>
                </div>

                <h3 style="color:#c9d1d9;">⚠️ Please read carefully:</h3>
                <ul class="inst-list">
                    ${data.isContinuing ? `<li style="color: #e67e22;"><strong>Note:</strong> You have an unfinished attempt. You will resume.</li>` : ''}
                    <li>You can only attempt this quiz <strong>${data.attemptLimit}</strong> time(s).</li>
                    <li>The timer starts immediately and cannot be paused.</li>
                </ul>

                <div class="ai-box">
                    <h4 style="color: #4fd1c5; margin-top: 0;"><i class="fas fa-robot"></i> AI Invigilator Active</h4>
                    <p style="font-size: 13px; color: #8b949e;">Focus Tracking and Session Integrity are monitored.</p>
                </div>

                <form action="take_quiz.php" method="GET" style="margin-top: 35px; text-align:center;">
                    <input type="hidden" name="quiz_id" value="${quizId}">
                    <button type="submit" class="start-btn" style="${data.isContinuing ? 'background-color: #e67e22;' : ''}">
                        ${data.isContinuing ? 'Continue Quiz' : 'Start Quiz'}
                    </button>
                </form>
            </div>
        `;

    } catch (err) {
        apiArea.innerHTML = `<p style="color:red; text-align:center;">Error: ${err.message}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = ''; 
    const now = new Date(); // <--- FIX 1: Define 'now' here!

    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; margin-top:60px; color: #888;'>No quizzes available.</p>";
        return;
    }
    
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        html += `<h3 style="margin: 20px 15px 10px;">${subject}</h3>`;
        
        quizzes.forEach(quiz => {
            const displayDate = formatQuizDate(quiz.start_time); // Clean version
            let isScheduled = false;
            let startTimeStr = quiz.start_time || "";
            
            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = (quiz.status === 'Scheduled' && startTime > now);
            }

            const isClosed = quiz.status === 'Closed';
            let actionBtn = '';

           if (quiz.attempt_status === 'submitted') {
    actionBtn = `<span style="color:#27ae60; font-weight:700; font-size:13px;">✓ Completed</span>`;
} 
else if (isClosed) {
    actionBtn = `<span style="color:#8b949e; font-weight:700; font-size:13px;">Closed</span>`;
} 
// TO:
else if (isScheduled) {
    const startTime = new Date(startTimeStr.replace(/-/g, "/"));
    actionBtn = `<span class="quiz-countdown" 
                       data-start="${startTime.getTime()}" 
                       data-quiz-id="${quiz.id}"
                       style="color:#fdd663; font-weight:700; font-size:13px;">
                    Calculating...
                 </span>`;
}
else if (quiz.attempt_status === 'in_progress') {
    actionBtn = `<span style="color:#e67e22; font-weight:700; font-size:13px; cursor:pointer;" onclick="loadQuizInstructions(${quiz.id})">Continue</span>`;
}
else {
    actionBtn = `<span style="color:#4fd1c5; font-weight:700; font-size:13px; cursor:pointer;" onclick="loadQuizInstructions(${quiz.id})">Start</span>`;
}

            html += `
                <div class="quiz-card">
                    <div>
                        <h4>${quiz.title} ${quiz.is_summative ? '<i class="fas fa-check-circle" style="color:#4fd1c5; font-size: 0.8em;"></i>' : ''}</h4>
                        <div class="quiz-info-text">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                             ${quiz.duration} mins | 
                              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px; margin-left: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              ${displayDate}
                        </div>
                    </div>
                    ${actionBtn}
                </div>`;
        });
    }
    apiArea.innerHTML = html;
    startQuizCountdowns();
}