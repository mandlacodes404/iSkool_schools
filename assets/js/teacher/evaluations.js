window.teacherEvaluationCache = null;

window.fetchTeacherEvaluations = async function() {
    sessionStorage.setItem("lastTeacherPage", "teacher_evaluations");
    if (typeof window.setTeacherActive === 'function') {
        window.setTeacherActive("teacher_evaluations");
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherEvaluationCache) {
        renderTeacherEvaluations(window.teacherEvaluationCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_evaluations.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherEvaluationCache = data;
        renderTeacherEvaluations(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555; text-align:center; margin-top:50px;">
                Error loading evaluations.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
          if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderTeacherEvaluations(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!data || data.length === 0) {
        apiArea.innerHTML = `
            <p class="teacher-empty-state">No evaluations released yet.</p>`;
        return;
    }

    let html = '';

    data.forEach((group, groupIndex) => {
        html += `
            <div class="teacher-class-group">
                <div class="teacher-class-header" onclick="toggleEvalGroup(${groupIndex})">
                    <span class="teacher-class-name">${group.class_name}</span>
                    <span class="teacher-class-count">
                        ${group.evaluations.length} evaluation${group.evaluations.length !== 1 ? 's' : ''}
                    </span>
                    <svg class="teacher-chevron" id="eval-chevron-${groupIndex}" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="teacher-class-items" id="eval-group-${groupIndex}">`;

        group.evaluations.forEach((ev, evIndex) => {
            const uid = `${groupIndex}-${evIndex}`;
            html += `
                <div class="eval-card">
                    <div class="eval-title">${ev.title}</div>
                    <div class="eval-meta">
                        Responses: <strong>${ev.response_count}</strong>
                        ${ev.description ? ' — ' + ev.description : ''}
                    </div>`;

            ev.statements.forEach((s, sIndex) => {
                html += `
                    <div class="eval-question-block">
                        <div class="eval-question-text">${s.statement}</div>
                        <div class="eval-bars">`;

                s.breakdown.forEach(b => {
                    html += `
                        <div class="eval-bar-container">
                            <div class="eval-bar-label">${b.label} (${b.count})</div>
                            <div class="eval-bar-bg">
                                <div class="eval-bar-fill" 
                                     style="width:${b.percentage}%; background:${b.color};">
                                    ${b.percentage}%
                                </div>
                            </div>
                        </div>`;
                });

                html += `</div></div>`;
            });

            // Comments
            html += `<div class="eval-comments-section">
                <div class="eval-comments-title">
                    Anonymous Comments (${ev.response_count} total responses)
                </div>`;

            if (ev.comments.length === 0) {
                html += `<p class="eval-no-comments">No additional comments.</p>`;
            } else {
                ev.comments.forEach(c => {
                    html += `<div class="eval-comment">${c.replace(/\n/g, '<br>')}</div>`;
                });
            }

            html += `</div></div>`;
        });

        html += `</div></div>`;
    });

    apiArea.innerHTML = html;
}

window.toggleEvalGroup = function(index) {
    const group   = document.getElementById(`eval-group-${index}`);
    const chevron = document.getElementById(`eval-chevron-${index}`);
    const isOpen  = group.classList.toggle('open');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
};