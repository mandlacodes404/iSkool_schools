/* assets/js/quiz.js */
window.learnerQuizCache = null; // Use window so main script can see it

window.updateHeaderTitle = function(newTitle) {
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.style.opacity = '0'; // Optional: fade out
        setTimeout(() => {
            headerTitle.innerText = newTitle;
            headerTitle.style.opacity = '1'; // Optional: fade in
        }, 150);
    }
};

window.fetchQuizzes = async function() {
   clearTimeout(window.loaderTimeout); // Kill the main script's timer immediately
   window.updateHeaderTitle("Quizzes"); // Instant feedback for the user
    sessionStorage.setItem("lastLearnerPage", "quiz_list.php"); // Match sessionStorage
    // 1. Sidebar Highlight
    if (typeof window.setActive === 'function') window.setActive("quiz_list.php");
    // 2. Highlighting Bridge
    if (typeof window.setActive === 'function') {
        window.setActive("quiz_list.php");
    }
    // 1. Change the Header Title instead of adding a new header
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) headerTitle.innerText = "Quizzes";
    
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

    // We NO LONGER put the header here. We only put the cards.
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
            
            // Logic Fix: Only format if time exists to prevent crash
            if (startTimeStr) {
                const startTime = new Date(startTimeStr.replace(/-/g, "/"));
                isScheduled = (quiz.status === 'Scheduled' && startTime > now);
            }

            const isClosed = quiz.status === 'Closed';
            let actionBtn = '';

            // Logic Fix: Use dynamic buttons based on status
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
                actionBtn = `<button class="quiz-start-btn" style="background: #e67e22;" onclick="window.location.href='quiz_instructions.php?quiz_id=${quiz.id}'">CONTINUE</button>`;
            } 
            else {
                // Default Start button
                actionBtn = `<button class="quiz-start-btn" onclick="window.location.href='quiz_instructions.php?quiz_id=${quiz.id}'">START</button>`;
            }

            // RESTORING YOUR EXACT ORIGINAL STYLE/CLASSES
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