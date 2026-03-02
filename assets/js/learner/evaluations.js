/* assets/js/evaluations.js */
window.fetchEvaluations = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    
    sessionStorage.setItem("lastLearnerPage", "evaluation_list.php");

    if (typeof window.setActive === 'function') {
        window.setActive("evaluation_list.php");
    }

    if (window.configureHeader) {
        window.configureHeader({ title: 'Evaluations', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';

    // Inject CSS
    if (!document.getElementById('eval-style')) {
        const link = document.createElement('link');
        link.id = 'eval-style'; link.rel = 'stylesheet'; link.href = 'assets/css/learner/evaluations.css';
        document.head.appendChild(link);
    }

    // 4. FIXED CACHE CHECK
    if (window.evaluationCache) {
        renderEvaluationsUI(window.evaluationCache); // Call the correct internal function
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_evaluations.php');
        const data = await response.json();
        window.evaluationCache = data; 
        renderEvaluationsUI(data); // Call the helper function here too
    } catch (e) {
        apiArea.innerHTML = "<p style='text-align:center; color:red;'>Error loading evaluations.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// New Helper Function to handle the actual HTML building
function renderEvaluationsUI(data) {
    const apiArea = document.getElementById('api-content-area');
    let html = '';
    
    if (data.status === 'no_class') {
        html += '<p style="text-align:center;">You are not enrolled in a class yet.</p>';
    } else if (data.length === 0) {
        html += '<p style="text-align:center;">No active evaluations at the moment.</p>';
    } else {
        data.forEach(evaluation => {
            html += `
            <div class="eval-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div class="eval-title">${evaluation.title}</div>
                        <div class="teacher-name">by ${evaluation.teacher}</div>
                    </div>
                    ${evaluation.submitted ? '<div class="completed-badge"><i class="fas fa-check-circle"></i> Completed</div>' : ''}
                </div>`;

            if (evaluation.submitted) {
                
            } else {
                html += `
                <div class="eval-description">${evaluation.description || ''}</div>
                <form onsubmit="handleEvalSubmit(event, ${evaluation.id})">
                    <input type="hidden" name="eval_id" value="${evaluation.id}">
                    ${evaluation.statements.map(s => `
                        <div class="question-box">
                            <div class="question-text">${s.statement}</div>
                            <div class="eval-options">
                                ${['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'].map(val => `
                                    <label class="option-label">
                                        <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                        <span>${val.replace('_', ' ').toUpperCase()}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                    <div style="margin-top:35px;">
                        <label style="font-weight:600; display:block; margin-bottom:10px;">Additional Comments (Optional)</label>
                        <textarea name="comments" style="width:100%; min-height:120px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; color:white; padding:15px;"></textarea>
                    </div>
                    <button type="submit" class="eval-submit-btn"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
                </form>`;
            }
            html += `</div>`;
        });
    }
    apiArea.innerHTML = html + '</div>';
}

// Keep your handleEvalSubmit function exactly as it was...
window.handleEvalSubmit = async function(e, id) {
    e.preventDefault();
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/submit_evaluation.php', {
            method: 'POST',
            body: new FormData(e.target)
        });
        const res = await response.json();
        if (res.success) {
            window.evaluationCache = null; // Clear cache so it fetches fresh "Completed" state
            fetchEvaluations(); 
        } else {
            alert(res.message);
        }
    } catch (err) {
        alert("Submission failed.");
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        
        
    }
};