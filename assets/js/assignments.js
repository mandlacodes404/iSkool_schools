/* assets/js/assignments.js */
window.learnerAssignmentCache = null;

window.fetchAssignments = async function() {
    // 1. Clear any existing timers
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 2. Set the UI State
    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (typeof window.setActive === 'function') window.setActive("assignment_list.php");

    // 3. Elements
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 4. Update Header (Safely)
    if (window.configureHeader) {
        window.configureHeader({ title: 'Assignments', mode: 'standard' });
    }

    // 5. Immediate UI Swap
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 6. CACHE LOGIC: Ensure loader hides here too!
    if (window.learnerAssignmentCache) {
        renderAssignmentCards(window.learnerAssignmentCache);
        if (loader) loader.style.display = 'none'; // Critical: Stop loader for cached data
        return; 
    }

    // 7. FETCH LOGIC
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_assignments.php');
        if (!response.ok) throw new Error('Failed to fetch assignments');
        
        const groupedData = await response.json();
        window.learnerAssignmentCache = groupedData;
        renderAssignmentCards(groupedData);
    } catch (error) {
        console.error("Assignment Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; margin-top:50px; padding:20px;">
                    <p style="color: #ff5555;">Unable to load assignments.</p>
                    <button onclick="window.learnerAssignmentCache=null; window.fetchAssignments()" 
                            class="quiz-start-btn">Try Again</button>
                </div>`;
        }
    } finally {
        // 8. ALWAYS hide the loader, even if it fails
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ... renderAssignmentCards remains mostly the same, 
// but ensure it doesn't hardcode a <h2> title if the header is doing the work now!

function renderAssignmentCards(groupedData) {
   const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // Handle Empty State: Removed the <h2> title
    if (Object.keys(groupedData).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No assignments found.</p>";
        return;
    }

    // Start building HTML without the redundant 'Your Assignments' header
    let html = ''; 
    
    for (const [teacher, tasks] of Object.entries(groupedData)) {
        // Teacher name as the grouping header
        html += `<h3 style="margin: 20px 15px 10px;">${teacher}</h3>`;
        
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
                            <span style="color: ${task.is_past_due ? '#888' : '#888'}">
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

                    <div style="text-align: right; min-width: 120px; display: flex; align-items: center; justify-content: flex-end;">
                        <a href="${task.is_past_due ? '#' : 'submit_assignment.php?assignment_id=' + task.id}" 
                           class="quiz-start-btn" 
                           style="${task.is_past_due ? 'background: #333; cursor: not-allowed;' : ''}"
                           ${task.is_past_due ? 'onclick="return false;"' : ''}>
                           ${btnText}
                        </a>
                    </div>
                </div>`;
        });
    }
    apiArea.innerHTML = html;
}