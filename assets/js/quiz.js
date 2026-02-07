/* assets/js/quiz.js */
let learnerQuizCache = null;

window.fetchQuizzes = async function() {
    localStorage.setItem("lastLearnerPage", "quiz_list.php");
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
    if (learnerQuizCache) {
        renderQuizCards(learnerQuizCache);
        if (loader) loader.style.display = 'none';
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
    }
};

function renderQuizCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!groupedData || Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<h3 style='text-align:center; margin-top:50px; color: #888;'>No quizzes available for this year.</h3>";
        return;
    }

    // This matches the h2 style in your CSS
    let html = '<h2>Your Quizzes</h2>';
    
    for (const [subject, quizzes] of Object.entries(groupedData)) {
        // This matches the h3 style in your CSS
        html += `<h3>${subject}</h3>`;
        
        quizzes.forEach(quiz => {
            html += `
                <div class="quiz-card">
                    <div>
                        <h4>${quiz.title}</h4>
                        <div class="quiz-info-text">
                            <i class="fas fa-clock"></i> ${quiz.duration} mins | 
                            <i class="fas fa-calendar"></i> ${quiz.start_time}
                        </div>
                    </div>
                    <button class="quiz-start-btn" onclick="window.location.href='take_quiz.php?id=${quiz.id}'">
                        START
                    </button>
                </div>`;
        });
    }
    apiArea.innerHTML = html;
}