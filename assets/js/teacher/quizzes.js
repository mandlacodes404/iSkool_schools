window.teacherQuizzesCache = null;
window.currentQuizResultsData = null;

// ─────────────────────────────────────────────
// QUIZ LIST
// ─────────────────────────────────────────────
window.fetchTeacherQuizzes = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_quizzes");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_quizzes");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherQuizzesCache) {
        renderTeacherQuizzes(window.teacherQuizzesCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_quizzes.php');
        const data = await res.json();
        window.teacherQuizzesCache = data;
        renderTeacherQuizzes(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading quizzes.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderTeacherQuizzes(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const terms       = data.terms || [];
    const currentTerm = data.current_term || 1;
    const yearName    = data.year_name || '';

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Quizzes</h2>
            <button class="teacher-upload-btn" onclick="openCreateQuiz()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Quiz
            </button>
        </div>

        <div class="teacher-year-badge">${yearName} &bull; Term ${currentTerm} Active</div>`;

    if (!terms || terms.length === 0) {
        html += `<p class="teacher-empty-state">No quizzes found for this year.</p>`;
    } else {
        terms.forEach(termData => {
            const isActive = termData.term === currentTerm;
            html += `
                <div class="teacher-term-card ${isActive ? 'term-active' : ''}">
                    <div class="teacher-term-card-header">
                        <span class="teacher-term-card-title">TERM ${termData.term}</span>
                        ${isActive ? '<span class="teacher-term-active-badge">ACTIVE</span>' : ''}
                    </div>`;

            termData.classes.forEach(cls => {
                html += `
                    <div class="teacher-resource-section" style="margin-top:0;">
                        <div class="teacher-resource-class-label">${cls.class_name}</div>`;

                cls.quizzes.forEach(quiz => {
                    const statusColor = quiz.status === 'Open'
                        ? '#f28c38'
                        : quiz.status === 'Scheduled'
                        ? '#1e90ff'
                        : '#6b7280';

                    html += `
                        <div class="teacher-quiz-card" data-quiz-id="${quiz.id}">
                            <div class="teacher-quiz-card-main" onclick="toggleQuizDetails(${quiz.id})">
                                <div class="teacher-resource-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                        <line x1="18" y1="20" x2="18" y2="10"></line>
                                        <line x1="12" y1="20" x2="12" y2="4"></line>
                                        <line x1="6" y1="20" x2="6" y2="14"></line>
                                    </svg>
                                </div>
                                <div class="teacher-resource-info">
                                    <div class="teacher-resource-name">${quiz.title}</div>
                                    <div class="teacher-resource-meta">
                                        ${quiz.duration} min &middot; ${quiz.start_time}
                                    </div>
                                </div>
                                <span class="teacher-quiz-status-badge" 
                                    style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;">
                                    ${quiz.status}
                                </span>
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                    class="teacher-quiz-chevron" id="chevron-${quiz.id}">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </div>

                            <div class="teacher-quiz-details" id="details-${quiz.id}" style="display:none;">
                                <div class="teacher-quiz-detail-row">
                                    <span class="teacher-quiz-detail-label">Marks</span>
                                    <span class="teacher-quiz-publish-status ${quiz.publish_marks ? 'published' : 'hidden'}"
                                        id="publish-label-${quiz.id}">
                                        ${quiz.publish_marks ? 'Published' : 'Hidden'}
                                    </span>
                                </div>

                                <div class="teacher-quiz-actions">
                                    <button class="teacher-quiz-action-btn publish"
                                        id="publish-btn-${quiz.id}"
                                        onclick="togglePublishMarks(${quiz.id})">
                                        ${quiz.publish_marks ? 'Unpublish Marks' : 'Publish Marks'}
                                    </button>
                                    <button class="teacher-quiz-action-btn ${quiz.status === 'Closed' ? 'reopen' : 'close'}"
                                        id="status-btn-${quiz.id}"
                                        onclick="toggleQuizStatus(${quiz.id}, '${quiz.status}')">
                                        ${quiz.status === 'Closed' ? 'Reopen Quiz' : 'Close Quiz'}
                                    </button>
                                    <button class="teacher-quiz-action-btn results"
                                        onclick="openQuizResults(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}')">
                                        View Results
                                    </button>
                                    <button class="teacher-quiz-action-btn integrity"
                                        onclick="openIntegrityModal(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}')">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        </svg>
                                        Integrity Report
                                    </button>
                                </div>
                            </div>
                        </div>`;
                });

                html += `</div>`;
            });

            html += `</div>`;
        });
    }

    // Integrity Modal
    html += `
        <div id="integrityModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:640px;max-height:85vh;overflow-y:auto;">
                <div class="teacher-modal-header">
                    <span id="integrityModalTitle">Integrity Report</span>
                    <button onclick="closeIntegrityModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body" id="integrityModalBody">
                    <div id="integrityWarning">
                        <div style="text-align:center;margin-bottom:20px;">
                            <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none" style="margin-bottom:10px;">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            <h3 style="color:#e2e8f0;margin:0;letter-spacing:1px;">ARTIFICIAL INVIGILATOR</h3>
                            <p style="color:#8b949e;font-size:14px;">Behavioral Integrity Analysis Engine</p>
                        </div>
                        <p style="line-height:1.6;color:#cbd5e0;font-size:14px;">
                            The Artificial Invigilator processes session logs and cross-references 
                            <strong>tab-switching frequency</strong> with <strong>active question IDs</strong> 
                            and <strong>layout constraints</strong> to determine risk levels.
                        </p>
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:15px;margin:20px 0;">
                            <h4 style="margin:0 0 10px;font-size:14px;color:#4fd1c5;">Detection Logic:</h4>
                            <ul style="margin:0;padding-left:20px;font-size:13px;color:#cbd5e0;line-height:1.8;">
                                <li><strong>Multi-Page Precision:</strong> Direct link between events and specific questions.</li>
                                <li><strong>Single-Page Viewport:</strong> Tracks question currently at top of screen.</li>
                                <li><strong>Time-Stamp Analysis:</strong> Identifies rapid navigation through questions.</li>
                            </ul>
                        </div>
                        <button class="teacher-modal-submit" style="width:100%;padding:15px;font-size:15px;"
                            id="decodeBtn" onclick="decodeIntegrity()">
                            DECODE LEARNER BEHAVIOR
                        </button>
                    </div>
                    <div id="integrityResults" style="display:none;"></div>
                </div>
                <div class="teacher-modal-footer" id="integrityFooter" style="display:none;">
                    <button onclick="closeIntegrityModal()" class="teacher-modal-cancel">Dismiss</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// QUIZ CARD TOGGLE
// ─────────────────────────────────────────────
window.toggleQuizDetails = function(quizId) {
    const details  = document.getElementById(`details-${quizId}`);
    const chevron  = document.getElementById(`chevron-${quizId}`);
    const isOpen   = details.style.display === 'block';
    details.style.display  = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// TOGGLE PUBLISH MARKS
// ─────────────────────────────────────────────
window.togglePublishMarks = async function(quizId) {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: quizId })
        });
        const data = await res.json();

        if (data.success) {
            const published = data.newStatus == 1;
            const label     = document.getElementById(`publish-label-${quizId}`);
            const btn       = document.getElementById(`publish-btn-${quizId}`);

            if (label) {
                label.textContent = published ? 'Published' : 'Hidden';
                label.className   = `teacher-quiz-publish-status ${published ? 'published' : 'hidden'}`;
            }
            if (btn) btn.textContent = published ? 'Unpublish Marks' : 'Publish Marks';

            window.teacherQuizzesCache = null;
        } else {
            alert(data.message || 'Failed to update');
        }
    } catch (e) {
        alert('Connection error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// TOGGLE QUIZ STATUS
// ─────────────────────────────────────────────
window.toggleQuizStatus = async function(quizId, currentStatus) {
    const newStatus = currentStatus === 'Closed' ? 'Open' : 'Closed';
    const loader    = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/toggle_quiz_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: quizId, status: newStatus })
        });
        const data = await res.json();

        if (data.success) {
            const statusColor = newStatus === 'Open'
                ? '#f28c38' : newStatus === 'Scheduled'
                ? '#1e90ff' : '#6b7280';

            const badge = document.querySelector(
                `.teacher-quiz-card[data-quiz-id="${quizId}"] .teacher-quiz-status-badge`
            );
            const btn = document.getElementById(`status-btn-${quizId}`);

            if (badge) {
                badge.textContent   = newStatus;
                badge.style.color   = statusColor;
                badge.style.background = `${statusColor}20`;
                badge.style.border  = `1px solid ${statusColor}50`;
            }
            if (btn) {
                btn.textContent  = newStatus === 'Closed' ? 'Reopen Quiz' : 'Close Quiz';
                btn.className    = `teacher-quiz-action-btn ${newStatus === 'Closed' ? 'reopen' : 'close'}`;
                btn.onclick      = () => toggleQuizStatus(quizId, newStatus);
            }

            window.teacherQuizzesCache = null;
        } else {
            alert(data.message || 'Failed to update status');
        }
    } catch (e) {
        alert('Connection error');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// QUIZ RESULTS VIEW
// ─────────────────────────────────────────────
window.openQuizResults = async function(quizId, quizTitle) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.currentQuizResultsData = data;
        renderQuizResults(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading results.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderQuizResults(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn" onclick="fetchTeacherQuizzes()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Quizzes
            </button>
        </div>

        <h3 class="teacher-quiz-grades-title">${data.quiz_title}</h3>
        <p class="teacher-quiz-grades-meta">${data.results.length} submission${data.results.length !== 1 ? 's' : ''}</p>`;

    if (data.results.length === 0) {
        html += `<p class="teacher-empty-state">No submissions yet for this quiz.</p>`;
    } else {
        html += `
            <div class="teacher-grades-table-wrapper">
                <table class="teacher-grades-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Score</th>
                            <th>Percentage</th>
                            <th>Time Taken</th>
                            <th>Submitted</th>
                            <th>Script</th>
                        </tr>
                    </thead>
                    <tbody>`;

        data.results.forEach(r => {
            const perc = r.percentage !== 'N/A'
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(r.percentage)}">${r.percentage}</span>`
                : '<span style="color:#555e6a;">N/A</span>';

            html += `
                <tr>
                    <td>${r.name}</td>
                    <td>${r.score} / ${r.total}</td>
                    <td>${perc}</td>
                    <td>${r.time_taken}</td>
                    <td>${r.submitted_at}</td>
                    <td>
                        <button class="teacher-edit-marks-btn"
                            onclick="openQuizReview(${r.result_id}, '${data.quiz_title.replace(/'/g, "\\'")}')">
                            Review
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    apiArea.innerHTML = html;
}

function getGradeBadgeClass(percentage) {
    const val = parseFloat(percentage);
    if (val >= 75) return 'grade-high';
    if (val >= 50) return 'grade-mid';
    return 'grade-low';
}

// ─────────────────────────────────────────────
// QUIZ REVIEW VIEW
// ─────────────────────────────────────────────
window.openQuizReview = async function(resultId, quizTitle) {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/teacher/get_quiz_review.php?result_id=${resultId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderQuizReview(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading review.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderQuizReview(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn"
                onclick="renderQuizResults(window.currentQuizResultsData)">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Results
            </button>
        </div>

        <div class="teacher-review-score-card">
            <div class="teacher-review-percentage">${data.percentage}%</div>
            <div class="teacher-review-title">${data.title}</div>
            <div class="teacher-review-meta">
                Points: <strong>${data.score} / ${data.total}</strong> &bull;
                Date: ${data.submitted_at}
            </div>
        </div>`;

    data.questions.forEach((q, i) => {
        html += `
            <div class="teacher-review-question">
                <div class="teacher-review-q-meta">Question ${i + 1} (${q.points} point${q.points != 1 ? 's' : ''})</div>
                <div class="teacher-review-q-text">${q.text}</div>`;

        if (q.image) {
            html += `<img src="${q.image}" class="teacher-review-q-image" alt="Question image">`;
        }

        q.choices.forEach(choice => {
            const isSelected = choice.id == q.selected;
            const isCorrect  = choice.is_correct == 1;

            let cls = '';
            let icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#555e6a" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                        </svg>`;

            if (isCorrect) {
                cls  = 'correct';
                icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#27ae60" stroke-width="2" fill="none">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>`;
            } else if (isSelected && !isCorrect) {
                cls  = 'incorrect';
                icon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#e74c3c" stroke-width="2" fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>`;
            }

            html += `
                <div class="teacher-review-choice ${cls}">
                    ${icon}
                    <span>${choice.text}</span>
                    ${isSelected ? '<span class="teacher-review-your-answer">Your Answer</span>' : ''}
                </div>`;
        });

        html += `</div>`;
    });

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// CREATE QUIZ VIEW
// ─────────────────────────────────────────────
window.openCreateQuiz = async function() {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('create_quiz.php');
        const html = await res.text();

        // Extract just the body content
        const parser = new DOMParser();
        const doc    = parser.parseFromString(html, 'text/html');

        // Inject a back button at the top
        const backBtn = document.createElement('div');
        backBtn.style.marginBottom = '20px';
        backBtn.innerHTML = `
            <button class="teacher-back-btn" onclick="fetchTeacherQuizzes()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Quizzes
            </button>`;

        const body = doc.body;

        // Re-execute scripts from the fetched page
        const scripts = body.querySelectorAll('script');
        apiArea.innerHTML = '';
        apiArea.appendChild(backBtn);
        apiArea.innerHTML += body.innerHTML;

        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
        });

        // Override the form submit to go back to quiz list on success
        const form = apiArea.querySelector('#quizForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const loader = document.getElementById('loaderOverlay');
                if (loader) loader.style.display = 'flex';

                const fd = new FormData(form);
                try {
                    const res  = await fetch('create_quiz.php', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) {
                        window.teacherQuizzesCache = null;
                        fetchTeacherQuizzes();
                    } else {
                        alert(data.message || 'Failed to create quiz.');
                    }
                } catch (err) {
                    alert('Something went wrong. Please try again.');
                } finally {
                    if (loader) loader.style.display = 'none';
                }
            });
        }
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading create quiz form.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// INTEGRITY MODAL
// ─────────────────────────────────────────────
let activeIntegrityQuizId = null;

window.openIntegrityModal = function(quizId, quizTitle) {
    activeIntegrityQuizId = quizId;

    document.getElementById('integrityModalTitle').textContent = `Integrity: ${quizTitle}`;
    document.getElementById('integrityWarning').style.display  = 'block';
    document.getElementById('integrityResults').style.display  = 'none';
    document.getElementById('integrityFooter').style.display   = 'none';
    document.getElementById('integrityModal').style.display    = 'flex';
};

window.closeIntegrityModal = function() {
    document.getElementById('integrityModal').style.display = 'none';
};

window.decodeIntegrity = async function() {
    const resultsDiv = document.getElementById('integrityResults');
    const warning    = document.getElementById('integrityWarning');
    const footer     = document.getElementById('integrityFooter');

    resultsDiv.innerHTML = `
        <div style="text-align:center;padding:40px 0;">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                style="animation:spin 1s linear infinite;margin-bottom:15px;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p style="color:#cbd5e0;letter-spacing:1px;font-size:13px;">SCANNING BEHAVIORAL PATTERNS...</p>
        </div>`;

    warning.style.display  = 'none';
    resultsDiv.style.display = 'block';

    try {
        const res  = await fetch(`api/teacher/fetch_integrity_report.php?quiz_id=${activeIntegrityQuizId}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = `
                <div style="text-align:center;padding:30px;background:rgba(79,209,197,0.05);border-radius:12px;border:1px dashed #4fd1c5;">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="#4fd1c5" stroke-width="2" fill="none" style="margin-bottom:10px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p style="color:#cbd5e0;margin:0;">No irregularities found for this quiz.</p>
                </div>`;
        } else {
            let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <span style="color:#8b949e;font-size:13px;">${data.length} learner${data.length !== 1 ? 's' : ''} flagged</span>
                    <span style="background:rgba(79,209,197,0.2);color:#4fd1c5;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;border:1px solid #4fd1c5;">AI ACTIVE</span>
                </div>`;

            data.forEach(row => {
                const layoutBadge = row.layout_mode === 'multi_page'
                    ? `<span style="color:#4fd1c5;font-size:10px;border:1px solid #4fd1c5;padding:2px 5px;border-radius:4px;font-weight:bold;">MULTI-PAGE</span>`
                    : `<span style="color:#a855f7;font-size:10px;border:1px solid #a855f7;padding:2px 5px;border-radius:4px;font-weight:bold;">SINGLE-PAGE</span>`;

                html += `
                    <div style="background:rgba(255,255,255,0.04);padding:15px;border-radius:12px;margin-bottom:15px;border-left:5px solid ${row.color};border-top:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                            <div>
                                <strong style="color:#e0e6f0;font-size:15px;display:block;margin-bottom:4px;">${row.name}</strong>
                                ${layoutBadge}
                            </div>
                            <span style="background:${row.color};color:white;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:900;text-transform:uppercase;">
                                ${row.risk} RISK
                            </span>
                        </div>
                        <div style="background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;margin-bottom:10px;">
                            <p style="margin:0;font-size:13px;line-height:1.5;color:#cbd5e0;">${row.narrative}</p>
                        </div>
                        ${row.problem_questions && row.problem_questions !== 'N/A' ? `
                        <div style="margin-bottom:10px;padding:8px;background:rgba(248,81,73,0.05);border-radius:6px;border:1px solid rgba(248,81,73,0.2);">
                            <small style="color:#f85149;font-weight:bold;font-size:11px;">
                                Flags: Question(s) ${row.problem_questions}
                            </small>
                        </div>` : ''}
                        <div style="display:flex;justify-content:space-between;opacity:0.6;">
                            <small style="color:#8b949e;">Activity Count: <strong>${row.switches}</strong></small>
                            <small style="color:#8b949e;font-size:10px;">Last Event: ${row.last_event_time}</small>
                        </div>
                    </div>`;
            });

            resultsDiv.innerHTML = html;
        }

        footer.style.display = 'flex';
    } catch (e) {
        resultsDiv.innerHTML = `
            <p style="color:#f85149;text-align:center;padding:20px;">
                AI Engine failed to retrieve data.
            </p>`;
        footer.style.display = 'flex';
    }
};