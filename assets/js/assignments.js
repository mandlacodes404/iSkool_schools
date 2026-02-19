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
    // 1. Define basic state first
    const isDone = !!task.submission_file;

    // 2. Define the color SECOND (So the SVG can use it)
    const statusColor = task.is_past_due ? '#f85149' : (isDone ? '#4fd1c5' : '#888');

    // 3. Define the SVG THIRD (Now it knows what statusColor is)
    const statusSVG = task.is_past_due 
        ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="${statusColor}" stroke-width="2" fill="none" style="vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>` 
        : (isDone 
            ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="${statusColor}" stroke-width="2.5" fill="none" style="vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` 
            : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="${statusColor}" stroke-width="2" fill="none" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`);

    // 4. Everything else
    const btnText = task.is_past_due ? 'LOCKED' : (isDone ? 'UPDATE' : 'SUBMIT');



            html += `
                <div class="quiz-card" style="${task.is_past_due ? 'opacity: 0.7;' : ''}">
                    <div style="flex: 1; padding-right: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
   ${statusSVG}
   <h4>${task.title}</h4>
</div>
                        <div class="quiz-info-text">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px;">
    <path d="M2 3h20v14H2z"></path>
    <path d="M8 21h8"></path>
    <path d="M12 17v4"></path>
</svg> ${task.class_name} | 
                            <span style="color: ${task.is_past_due ? '#888' : '#888'}">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px;">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
</svg> Due: ${task.due_date}
                            </span>
                        </div>
                        <p style="color: #bbb; font-size: 13px; margin-top: 10px; line-height: 1.4;">${task.description || 'No description'}</p>
                        
                        <div style="margin-top: 15px; display: flex; gap: 15px;">
                            ${task.teacher_file ? `
                               <a href="javascript:void(0)" 
   onclick="viewDocument('${task.teacher_file}', 'Teacher Attachment: ${task.title.replace(/'/g, "\\'")}')" 
   style="color: #4fd1c5; font-size: 12px; text-decoration:none;">
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="#4fd1c5" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px;">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
</svg> Teacher Attachment
</a>` : ''}
                            ${task.submission_file ? `
                               <a href="javascript:void(0)" 
   onclick="viewDocument('${task.submission_file}', 'My Submission: ${task.title.replace(/'/g, "\\'")}')" 
   style="color: #4fd1c5; font-size: 12px; text-decoration:none;">
    <svg viewBox="0 0 24 24" width="12" height="12" stroke="#4fd1c5" stroke-width="2" fill="none" style="vertical-align: middle; margin-right: 4px;">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
</svg> View My Work
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