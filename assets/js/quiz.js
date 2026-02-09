/* assets/js/quiz.js */
window.learnerQuizCache = null; // Use window so main script can see it

window.fetchQuizzes = async function() {
   clearTimeout(window.loaderTimeout); // Kill the main script's timer immediately
    sessionStorage.setItem("lastLearnerPage", "quiz_list.php"); // Match sessionStorage
    // 1. Sidebar Highlight
    if (typeof window.setActive === 'function') window.setActive("quiz_list.php");
    // 2. Highlighting Bridge
    if (typeof window.setActive === 'function') {
        window.setActive("quiz_list.php");
    }
    
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 2. UI Preparation
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 3. Cache Check (The "Instant" feel)
    if (window.learnerQuizCache) {
        renderQuizCards(window.learnerQuizCache);
        loader.style.display = 'none'; // Hide if main script accidentally showed it
        return;
    }

    // 4. Fetch Data (Only runs the first time)
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_quizzes.php');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const groupedData = await response.json();
        learnerQuizCache = groupedData; // Store in memory
        renderQuizCards(groupedData);
    } catch (error) {
        console.error("Quiz Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load quizzes at the moment.</p>
                    <button onclick="learnerQuizCache=null; fetchQuizzes()" 
                            style="background:#4fd1c5; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
        clearTimeout(window.loaderTimeout); // One last safety clear
    }
};

function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p class='empty'>No quizzes available for your class.</p>";
        return;
    }

    let html = '<h2>Quizzes</h2>';
    
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        html += `
            <div class="teacher-section">
                <div class="teacher-header">
                    <h3><i class="fas fa-book-open"></i> ${subject} 
                        <span class="file-count">(${quizzes.length} quiz${quizzes.length > 1 ? 'zes' : ''})</span>
                    </h3>
                </div>
                <div class="teacher-quizzes">`;

        quizzes.forEach(quiz => {
            const now = new Date();
            const startTime = new Date(quiz.start_time.replace(/-/g, "/")); // Cross-browser fix
            const isClosed = quiz.status === 'Closed';
            const isScheduled = quiz.status === 'Scheduled' && startTime > now;
            
            let actionBtn = '';

            // 1. Logic for Button Text and State (Matching your PHP)
            if (quiz.attempt_status === 'submitted') {
                actionBtn = `<a class='btn disabled' style='background: #27ae60; opacity: 1;'><i class='fas fa-check-double'></i> Completed</a>`;
            } 
            else if (isClosed) {
                actionBtn = `<a class='btn disabled'>Quiz Closed</a>`;
            } 
            else if (isScheduled) {
                // For JS, we just show the time. (Optional: You could add a live countdown here)
                actionBtn = `<span class="countdown">Starts: ${quiz.start_time}</span>`;
            } 
            else if (quiz.attempt_status === 'in_progress') {
                actionBtn = `<a class='btn' href='quiz_instructions.php?quiz_id=${quiz.id}' style='background: #e67e22;'>Continue Quiz</a>`;
            } 
            else {
                actionBtn = `<a class='btn' href='quiz_instructions.php?quiz_id=${quiz.id}'>Start Quiz</a>`;
            }

            html += `
                <div class="quiz ${isClosed ? 'closed' : ''}">
                    <div class="quiz-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="quiz-main-icon" style="width:24px; height:24px;">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <h3>
                            ${quiz.title}
                            ${quiz.is_summative ? '<i class="fas fa-check-circle" style="color:#4fd1c5; margin-left:6px;" title="Counts toward term mark"></i>' : ''}
                        </h3>
                    </div>
                    <div class="quiz-details" style="display: block; background: transparent;">
                        <p><strong>Duration:</strong> ${quiz.duration} mins</p>
                        <p><strong>Action:</strong> ${actionBtn}</p>
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    }
    
    apiArea.innerHTML = html;
}