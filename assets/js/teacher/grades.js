window.teacherGradesCache = null;

window.fetchTeacherGrades = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_grades");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_grades");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherGradesCache) {
        renderTeacherGrades(window.teacherGradesCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_grades.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherGradesCache = data;
        renderTeacherGrades(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading grades.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderTeacherGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Grades</h2>
            <button class="teacher-upload-btn" onclick="openAddQuizModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Quiz
            </button>
        </div>

        <div class="teacher-grades-info">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" style="flex-shrink:0;margin-top:2px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Click any quiz to view learner grades. Use <strong>Add Quiz</strong> to manually record marks for schools without online quizzes.</span>
        </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No quizzes found.</p>`;
    } else {
        data.forEach(termData => {
            html += `
                <div class="teacher-term-divider">
                    Term ${termData.term}
                </div>`;

            termData.classes.forEach(cls => {
                html += `
                    <div class="teacher-resource-section">
                        <div class="teacher-resource-class-label">${cls.class_name}</div>`;

                cls.quizzes.forEach(quiz => {
                    html += `
                        <div class="teacher-resource-card" onclick="openQuizGrades(${quiz.id})">
                            <div class="teacher-resource-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <div class="teacher-resource-info">
                                <div class="teacher-resource-name">${quiz.title}</div>
                                <div class="teacher-resource-meta">${quiz.created_at}</div>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>`;
                });

                html += `</div>`;
            });
        });
    }

    // Add Quiz Modal
    html += `
        <div id="addQuizModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:440px;">
                <div class="teacher-modal-header">
                    <span>Add Quiz Manually</span>
                    <button onclick="closeAddQuizModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">

                    <div class="teacher-grades-info" style="margin-bottom:16px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" style="flex-shrink:0;margin-top:2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>After adding, find the quiz in the list and click it to enter each learner's marks.</span>
                    </div>

                    <label class="teacher-modal-label">Quiz Title *</label>
                    <input type="text" id="quizTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Test">

                    <label class="teacher-modal-label">Select Class *</label>
                    <select id="quizClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="quizSummative" onchange="toggleWeightField()">
                        Counts toward term mark
                    </label>

                    <div id="weightContainer" style="display:none;margin-top:12px;">
                        <label class="teacher-modal-label">Weight %</label>
                        <input type="number" id="quizWeight" class="teacher-modal-input" 
                            min="0" max="100" step="0.1" placeholder="e.g. 30" style="max-width:150px;">
                    </div>

                    <div id="addQuizError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeAddQuizModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitAddQuiz()" class="teacher-modal-submit" id="addQuizSubmitBtn">Add Quiz</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    loadGradesClasses();
}

async function loadGradesClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        const sel  = document.getElementById('quizClass');
        if (!sel) return;
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load classes', e);
    }
}

window.toggleWeightField = function() {
    const cb        = document.getElementById('quizSummative');
    const container = document.getElementById('weightContainer');
    if (container) container.style.display = cb.checked ? 'block' : 'none';
};

window.openAddQuizModal = function() {
    const modal = document.getElementById('addQuizModal');
    if (modal) modal.style.display = 'flex';
};

window.closeAddQuizModal = function() {
    const modal = document.getElementById('addQuizModal');
    if (modal) modal.style.display = 'none';
    document.getElementById('quizTitle').value      = '';
    document.getElementById('quizClass').value      = '';
    document.getElementById('quizSummative').checked = false;
    document.getElementById('weightContainer').style.display = 'none';
    document.getElementById('addQuizError').style.display    = 'none';
};

window.submitAddQuiz = async function() {
    const title       = document.getElementById('quizTitle').value.trim();
    const classId     = document.getElementById('quizClass').value;
    const isSummative = document.getElementById('quizSummative').checked;
    const weight      = document.getElementById('quizWeight')?.value ?? '';
    const errorDiv    = document.getElementById('addQuizError');
    const submitBtn   = document.getElementById('addQuizSubmitBtn');
    const loader      = document.getElementById('loaderOverlay');

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter a quiz title.'; errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.';     errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',    title);
    fd.append('class_id', classId);
    if (isSummative) {
        fd.append('is_summative', '1');
        if (weight) fd.append('weight_percent', weight);
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Adding...';
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/add_manual_quiz.php', { method: 'POST', body: fd });
        const data = await res.json();

        if (data.success) {
            closeAddQuizModal();
            window.teacherGradesCache = null;
            fetchTeacherGrades();
        } else {
            errorDiv.textContent = data.error || 'Failed to add quiz.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Add Quiz';
        if (loader) loader.style.display = 'none';
    }
};

window.openQuizGrades = function(quizId) {
    sessionStorage.setItem("lastTeacherPage", "teacher_grades");
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'none';
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = `quiz_grades.php?quiz_id=${quizId}`;
    }
};