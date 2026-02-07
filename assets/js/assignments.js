/* assets/js/assignments.js */
let learnerAssignmentCache = null;

window.fetchAssignments = async function() {
    // 1. SAVE STATE: For Refresh Persistence
    localStorage.setItem("lastLearnerPage", "assignment_list.php");

    // 2. UI Setup & Highlighting
    if (typeof window.setActive === 'function') window.setActive("assignment_list.php");
    
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Swap
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4. SMART CACHE CHECK (Fast Loading)
    if (learnerAssignmentCache) {
        renderAssignmentCards(learnerAssignmentCache);
        if (loader) loader.style.display = 'none';
        return; 
    }

    // 5. Fetch Data from the new PHP API
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_assignments.php');
        if (!response.ok) throw new Error('Failed to fetch assignments');
        
        const groupedData = await response.json();
        learnerAssignmentCache = groupedData; 
        renderAssignmentCards(groupedData);
    } catch (error) {
        console.error("Assignment Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load assignments.</p>
                    <button onclick="learnerAssignmentCache=null; fetchAssignments()" 
                            class="quiz-start-btn">Try Again</button>
                </div>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderAssignmentCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<h2>Assignments</h2><p style='text-align:center; color:#888; margin-top:40px;'>No assignments found.</p>";
        return;
    }

    let html = '<h2>Your Assignments</h2>';
    
    for (const [teacher, tasks] of Object.entries(groupedData)) {
        html += `<h3>${teacher}</h3>`;
        
        tasks.forEach(task => {
            // Logic for status colors and icons
            const isDone = !!task.submission_file;
            const statusIcon = task.is_past_due ? 'fa-lock' : (isDone ? 'fa-check-circle' : 'fa-file-alt');
            const statusColor = task.is_past_due ? '#f85149' : (isDone ? '#4fd1c5' : '#888');
            const btnText = task.is_past_due ? 'LOCKED' : (isDone ? 'UPDATE' : 'SUBMIT');

            html += `
                <div class="quiz-card" style="${task.is_past_due ? 'opacity: 0.7;' : ''}">
                    <div style="flex: 1; padding-right: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                            <i class="fas ${statusIcon}" style="color: ${statusColor};"></i>
                            <h4>${task.title}</h4>
                        </div>
                        <div class="quiz-info-text">
                            <i class="fas fa-chalkboard"></i> ${task.class_name} | 
                            <span style="color: ${task.is_past_due ? '#f85149' : '#888'}">
                                <i class="fas fa-clock"></i> Due: ${task.due_date}
                            </span>
                        </div>
                        <p style="color: #bbb; font-size: 13px; margin-top: 10px; line-height: 1.4;">${task.description || 'No description'}</p>
                        
                        <div style="margin-top: 15px; display: flex; gap: 15px;">
                            ${task.teacher_file ? `
                                <a href="${task.teacher_file}" target="_blank" style="color: #4fd1c5; font-size: 12px; text-decoration:none;">
                                    <i class="fas fa-paperclip"></i> Teacher Attachment
                                </a>` : ''}
                            ${task.submission_file ? `
                                <a href="${task.submission_file}" target="_blank" style="color: #4fd1c5; font-size: 12px; text-decoration:none;">
                                    <i class="fas fa-eye"></i> View My Work
                                </a>` : ''}
                        </div>
                    </div>

                    <div style="text-align: right; min-width: 120px;">
                        <a href="${task.is_past_due ? '#' : 'submit_assignment.php?assignment_id=' + task.id}" 
                           class="quiz-start-btn" 
                           style="${task.is_past_due ? 'background: #333; cursor: not-allowed;' : ''}"
                           ${task.is_past_due ? 'onclick="return false;"' : ''}>
                           ${btnText}
                        </a>
                        ${task.is_past_due ? '<div style="color:#f85149; font-size:11px; margin-top:5px; font-weight:700;">CLOSED</div>' : ''}
                    </div>
                </div>`;
        });
    }
    apiArea.innerHTML = html;
}