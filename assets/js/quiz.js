/* assets/js/quiz.js */
window.learnerQuizCache = null; 

window.fetchQuizzes = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastLearnerPage", "quiz_list.php");

    // 1. Use the new Dynamic Header instead of the old updateHeaderTitle
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
        clearTimeout(window.loaderTimeout);
    }
};

window.loadQuizInstructions = async function(quizId) {
    const apiArea = document.getElementById('api-content-area');
    const loader = document.getElementById("loaderOverlay");

    // 1. Set Header to Detail Mode (Shows Back Button)
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

                <button class="start-btn" 
                    style="${data.isContinuing ? 'background-color: #e67e22;' : ''}"
                    onclick="window.location.href='take_quiz.php?quiz_id=${quizId}'">
                    ${data.isContinuing ? 'Continue Quiz' : 'Start Quiz'}
                </button>
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
    
    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<h3 style='text-align:center; margin-top:50px; color: #888;'>No quizzes available.</h3>";
        return;
    }
    
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        html += `<h3 style="margin: 20px 15px 10px;">${subject}</h3>`;
        
        quizzes.forEach(quiz => {
            const now = new Date();
            let isScheduled = false;
            let startTimeStr = quiz.start_time || "";
            
            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = (quiz.status === 'Scheduled' && startTime > now);
            }

            const isClosed = quiz.status === 'Closed';
            let actionBtn = '';

            if (quiz.attempt_status === 'submitted') {
                actionBtn = `<button class="quiz-start-btn" style="background: #27ae60; cursor: default;">COMPLETED</button>`;
            } 
            else if (isClosed) {
                actionBtn = `<button class="quiz-start-btn" style="opacity: 0.5; cursor: not-allowed;">CLOSED</button>`;
            } 
            else if (isScheduled) {
                actionBtn = `<button class="quiz-start-btn" style="background: #fdd663; color: #000; cursor: default;">SCHEDULED</button>`;
            }
            else if (quiz.attempt_status === 'in_progress') {
    // Change this to use loadQuizInstructions instead of window.location
    actionBtn = `<button class="quiz-start-btn" style="background: #e67e22;" onclick="loadQuizInstructions(${quiz.id})">CONTINUE</button>`;
}
            else {
                actionBtn = `<button class="quiz-start-btn" onclick="loadQuizInstructions(${quiz.id})">START</button>`;
            }

            // EXACT ORIGINAL STYLE/CLASSES PRESERVED
            html += `
                <div class="quiz-card">
                    <div>
                        <h4>${quiz.title} ${quiz.is_summative ? '<i class="fas fa-check-circle" style="color:#4fd1c5; font-size: 0.8em;"></i>' : ''}</h4>
                        <div class="quiz-info-text">
                            <i class="fas fa-clock"></i> ${quiz.duration} mins | 
                            <i class="fas fa-calendar"></i> ${startTimeStr}
                        </div>
                    </div>
                    ${actionBtn}
                </div>`;
        });
    }
    apiArea.innerHTML = html;
}