window.teacherAssignmentsCache = null;

// ─────────────────────────────────────────────
// ASSIGNMENTS LIST
// ─────────────────────────────────────────────
window.fetchTeacherAssignments = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_assignments");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_assignments");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAssignmentsCache) {
        renderTeacherAssignments(window.teacherAssignmentsCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_assignments.php');
        const data = await res.json();
        window.teacherAssignmentsCache = data;
        renderTeacherAssignments(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading assignments.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderTeacherAssignments(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Assignments</h2>
            <button class="teacher-upload-btn" onclick="openCreateAssignment()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Assignment
            </button>
        </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No assignments created yet.</p>`;
    } else {
        data.forEach((assignment, index) => {
            const dueDate     = assignment.due_date;
            const subCount    = assignment.submitted_count;
            const totalCount  = assignment.total_learners;
            const subPercent  = totalCount > 0
                ? Math.round((subCount / totalCount) * 100)
                : 0;
            const progressColor = subPercent === 100
                ? '#22c55e'
                : subPercent >= 50
                ? '#f39c12'
                : '#4fd1c5';

            html += `
                <div class="teacher-assignment-card" id="acard-${index}">
                    <div class="teacher-assignment-main" onclick="toggleAssignmentSubmissions(${index})">
                        <div class="teacher-resource-icon">
                            <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <div class="teacher-resource-info">
                            <div class="teacher-resource-name">${assignment.title}</div>
                            <div class="teacher-resource-meta">
                                ${assignment.class_name} &middot; Due ${dueDate}
                            </div>
                            <div class="teacher-assignment-progress">
                                <div class="teacher-assignment-progress-bar">
                                    <div class="teacher-assignment-progress-fill"
                                        style="width:${subPercent}%;background:${progressColor};">
                                    </div>
                                </div>
                                <span class="teacher-assignment-progress-label" style="color:${progressColor};">
                                    ${subCount}/${totalCount} submitted
                                </span>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
                            ${assignment.file_url ? `
                                <a href="${assignment.file_url}" target="_blank"
                                    onclick="event.stopPropagation()"
                                    class="teacher-assignment-file-link">
                                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                    </svg>
                                    Attachment
                                </a>` : ''}
                            <button class="teacher-assignment-download-btn"
                                onclick="event.stopPropagation(); downloadSubmissions(${assignment.id})">
                                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download All
                            </button>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                class="teacher-assignment-chevron" id="achevron-${index}"
                                style="transition:transform 0.3s ease;">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <div class="teacher-assignment-submissions" id="asubs-${index}" style="display:none;">
                        <div class="teacher-assignment-desc">
                            ${assignment.description.replace(/\n/g, '<br>')}
                        </div>
                        <div class="teacher-grades-table-wrapper">
                            <table class="teacher-grades-table">
                                <thead>
                                    <tr>
                                        <th>Learner</th>
                                        <th>Status</th>
                                        <th>Type</th>
                                        <th>Submission</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            assignment.submissions.forEach(sub => {
                const statusBadge = sub.submitted
                    ? `<span class="teacher-sub-badge submitted">Submitted</span>
                       <div style="font-size:11px;color:#8b949e;margin-top:3px;">${sub.submitted_at}</div>`
                    : `<span class="teacher-sub-badge not-submitted">Not Submitted</span>`;

                let subContent = '—';
                if (sub.submitted) {
                    if (sub.submission_type === 'file' && sub.file_url) {
                        subContent = `<a href="${sub.file_url}" target="_blank" class="teacher-sub-file-link">View File</a>`;
                    } else if (sub.submission_type === 'text' && sub.text_answer) {
                        subContent = `
                            <div class="teacher-sub-text">
                                ${sub.text_answer.replace(/\n/g, '<br>')}
                            </div>`;
                    } else if (sub.submission_type === 'audio' && sub.audio_url) {
                        subContent = `
                            <audio controls style="max-width:200px;height:32px;">
                                <source src="${sub.audio_url}" type="audio/mpeg">
                            </audio>`;
                    }
                }

                html += `
                    <tr>
                        <td>${sub.name}</td>
                        <td>${statusBadge}</td>
                        <td style="color:#8b949e;font-size:13px;">${sub.submission_type || '—'}</td>
                        <td>${subContent}</td>
                    </tr>`;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
        });
    }

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// TOGGLE SUBMISSIONS
// ─────────────────────────────────────────────
window.toggleAssignmentSubmissions = function(index) {
    const subs    = document.getElementById(`asubs-${index}`);
    const chevron = document.getElementById(`achevron-${index}`);
    const isOpen  = subs.style.display === 'block';
    subs.style.display      = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// DOWNLOAD SUBMISSIONS
// ─────────────────────────────────────────────
window.downloadSubmissions = function(assignmentId) {
    window.open(`download_submissions.php?assignment_id=${assignmentId}`, '_blank');
};

// ─────────────────────────────────────────────
// CREATE ASSIGNMENT VIEW
// ─────────────────────────────────────────────
window.openCreateAssignment = async function() {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const [classRes, termRes] = await Promise.all([
            fetch('api/teacher/get_classes.php'),
            fetch('api/teacher/get_quizzes.php')
        ]);
        const classes  = await classRes.json();
        const quizData = await termRes.json();
        const currentTerm = quizData.current_term || 1;

        let classOptions = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            classOptions += `<option value="${c.id}">${c.name}</option>`;
        });

        apiArea.innerHTML = `
            <div class="teacher-resources-header">
                <button class="teacher-back-btn" onclick="fetchTeacherAssignments()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Back to Assignments
                </button>
            </div>

            <div style="max-width:640px;margin:0 auto;">
                <h2 style="color:#4fd1c5;font-size:22px;margin:0 0 24px;font-weight:800;">
                    Create New Assignment
                </h2>

                <form id="createAssignmentForm" enctype="multipart/form-data">

                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" name="title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 5 Essay" required>

                    <label class="teacher-modal-label">Description *</label>
                    <textarea name="description" class="teacher-modal-input" rows="5"
                        style="resize:vertical;" placeholder="Describe the assignment..." required></textarea>

                    <label class="teacher-modal-label">Due Date *</label>
                    <input type="datetime-local" name="due_date" class="teacher-modal-input" required>

                    <label class="teacher-modal-label">Assign to Class *</label>
                    <select name="class_id" class="teacher-modal-input" required>
                        ${classOptions}
                    </select>

                    <div style="background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.2);border-left:5px solid #4fd1c5;border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
                        <div style="font-size:20px;font-weight:800;color:#4fd1c5;">
                            Posting to: TERM ${currentTerm}
                        </div>
                        <div style="font-size:13px;color:#8b949e;margin-top:4px;">
                            This assignment belongs to the current active term.
                        </div>
                    </div>

                    <label class="teacher-modal-label">Attachment (optional)</label>
                    <input type="file" name="attachment"
                        style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:8px 12px;box-sizing:border-box;font-size:13px;">

                    <label style="display:flex;align-items:flex-start;gap:10px;color:#c9d1d9;font-size:13px;cursor:pointer;background:rgba(79,209,197,0.05);border:1px solid rgba(79,209,197,0.15);border-radius:10px;padding:12px;margin-top:16px;">
                        <input type="checkbox" name="force_email" value="1"
                            style="width:18px;height:18px;accent-color:#4fd1c5;cursor:pointer;margin-top:2px;flex-shrink:0;">
                        <span>Learners automatically get mobile notifications. Tick this box to also send email notifications (not recommended — heavy on server).</span>
                    </label>

                    <div id="caError" style="color:#ff5555;font-size:14px;margin-top:12px;display:none;"></div>

                    <div style="display:flex;gap:12px;margin-top:24px;margin-bottom:40px;">
                        <button type="button" onclick="fetchTeacherAssignments()"
                            class="teacher-modal-cancel" style="flex:1;padding:14px;">
                            Cancel
                        </button>
                        <button type="submit" class="teacher-modal-submit"
                            id="caSubmitBtn" style="flex:2;padding:14px;font-size:15px;">
                            Create Assignment
                        </button>
                    </div>

                </form>
            </div>`;

        // Handle submit
        const form = document.getElementById('createAssignmentForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv  = document.getElementById('caError');
            const submitBtn = document.getElementById('caSubmitBtn');
            errorDiv.style.display = 'none';

            submitBtn.disabled    = true;
            submitBtn.textContent = 'Creating...';
            if (loader) loader.style.display = 'flex';

            const fd = new FormData(form);
            try {
                const res  = await fetch('api/teacher/create_assignment.php', {
                    method: 'POST',
                    body: fd
                });
                const data = await res.json();

                if (data.success) {
                    window.teacherAssignmentsCache = null;
                    fetchTeacherAssignments();
                } else {
                    errorDiv.textContent = data.error || 'Failed to create assignment.';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Something went wrong. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Create Assignment';
                if (loader) loader.style.display = 'none';
            }
        });

    } catch (e) {
        console.error(e);
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading create assignment form.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};