window.teacherAnalyticsCache = null;
const analyticsCharts        = {};
let   analyticsCurrentClassId = null;

// ─────────────────────────────────────────────
// MAIN FETCH
// ─────────────────────────────────────────────
window.fetchTeacherAnalytics = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_analytics");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_analytics");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAnalyticsCache) {
        renderTeacherAnalytics(window.teacherAnalyticsCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_analytics.php');
        const data = await res.json();
        window.teacherAnalyticsCache = data;
        renderTeacherAnalytics(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading analytics.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function renderTeacherAnalytics(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const terms       = data.terms || [];
    const currentTerm = data.current_term || 1;

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Analytics</h2>
        </div>
        <p style="color:#8b949e;font-size:14px;margin:0 0 24px;">
            Click a class to explore performance insights. Only published summative assessments are included.
        </p>`;

    if (!terms.length) {
        html += `<p class="teacher-empty-state">No published summative assessments yet.</p>`;
        apiArea.innerHTML = html;
        return;
    }

    terms.forEach(termData => {
        const isActive = termData.term === currentTerm;
        html += `
            <div class="teacher-term-card ${isActive ? 'term-active' : ''}" style="margin-bottom:28px;">
                <div class="teacher-term-card-header">
                    <span class="teacher-term-card-title">TERM ${termData.term}</span>
                    ${isActive ? '<span class="teacher-term-active-badge">ACTIVE</span>' : ''}
                </div>`;

        termData.classes.forEach(cls => {
            const subjectLabel = cls.subject
                ? `<span class="teacher-analytics-subject">${cls.subject}</span>`
                : `<span class="teacher-analytics-subject unset">Set Subject</span>`;

            html += `
                <div class="teacher-analytics-class-card" id="aclass-${cls.id}-${termData.term}">
                    <div class="teacher-analytics-class-header"
                        onclick="toggleAnalyticsClass(${cls.id}, ${termData.term})">
                        <div style="display:flex;align-items:center;gap:10px;flex:1;">
                            ${subjectLabel}
                            <span class="teacher-analytics-class-name">${cls.name}</span>
                            <button class="teacher-analytics-edit-btn"
                                onclick="event.stopPropagation();openSubjectModal(${cls.id}, '${(cls.subject || '').replace(/'/g, "\\'")}', '${cls.name.replace(/'/g, "\\'")}')">
                                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-size:12px;color:#8b949e;">${cls.student_count} students</span>
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                                class="teacher-analytics-chevron" id="achevron-${cls.id}-${termData.term}"
                                style="transition:transform 0.3s ease;">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>

                    <div class="teacher-analytics-class-content" id="acontent-${cls.id}-${termData.term}"
                        style="display:none;padding:16px;">

                        ${renderAnalyticsSection('quiz_avg',      cls.id, termData.term, 'Quiz Average')}
                        ${renderAnalyticsSection('quiz_gender',   cls.id, termData.term, 'Boys vs Girls per Quiz')}
                        ${renderAnalyticsSection('class_trend',   cls.id, termData.term, 'Class Performance by Term')}
                        ${renderAnalyticsSection('monthly_gender',cls.id, termData.term, 'Boys vs Girls by Term')}
                        ${renderAnalyticsSection('top_gender',    cls.id, termData.term, 'Top Performers')}

                    </div>
                </div>`;
        });

        html += `</div>`;
    });

    // Subject Modal
    html += `
        <div id="subjectModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:420px;">
                <div class="teacher-modal-header">
                    <span>Subject Name</span>
                    <button onclick="closeSubjectModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p style="color:#8b949e;font-size:14px;margin:0 0 16px;">
                        What subject do you teach in <strong id="subjectModalClassName" style="color:#e2e8f0;"></strong>?
                    </p>
                    <label class="teacher-modal-label">Subject Name</label>
                    <input type="text" id="subjectInput" class="teacher-modal-input"
                        placeholder="e.g. Mathematics, English HL">
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeSubjectModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="saveSubject()" class="teacher-modal-submit">Save</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
}

function renderAnalyticsSection(type, classId, term, title) {
    const key = `${type}-${classId}-${term}`;
    return `
        <div class="teacher-analytics-section" data-type="${type}" data-loaded="false">
            <div class="teacher-analytics-section-header"
                onclick="toggleAnalyticsSection(this, ${classId}, ${term})">
                <span class="teacher-analytics-section-title">${title}</span>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#8b949e" stroke-width="2" fill="none"
                    class="teacher-analytics-section-chevron" style="transition:transform 0.3s ease;flex-shrink:0;">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
            <div class="teacher-analytics-section-body" style="display:none;">
                ${type === 'top_gender'
                    ? `<div class="teacher-analytics-top-grid">
                           <div class="teacher-analytics-top-list">
                               <div class="teacher-analytics-top-title" style="color:#e15759;">Top 5 Girls</div>
                               <div id="top-girls-${key}"></div>
                           </div>
                           <div class="teacher-analytics-top-list">
                               <div class="teacher-analytics-top-title" style="color:#4e79a7;">Top 5 Boys</div>
                               <div id="top-boys-${key}"></div>
                           </div>
                       </div>`
                    : `<div class="teacher-analytics-chart-box">
                           <canvas id="chart-${key}"></canvas>
                       </div>`
                }
                <div class="teacher-analytics-no-data" id="no-data-${key}" style="display:none;">
                    No data available yet
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// TOGGLE CLASS
// ─────────────────────────────────────────────
window.toggleAnalyticsClass = function(classId, term) {
    const content = document.getElementById(`acontent-${classId}-${term}`);
    const chevron = document.getElementById(`achevron-${classId}-${term}`);
    const isOpen  = content.style.display === 'block';
    content.style.display   = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

// ─────────────────────────────────────────────
// TOGGLE SECTION + LAZY LOAD
// ─────────────────────────────────────────────
window.toggleAnalyticsSection = function(headerEl, classId, term) {
    const section = headerEl.parentElement;
    const body    = section.querySelector('.teacher-analytics-section-body');
    const chevron = section.querySelector('.teacher-analytics-section-chevron');
    const type    = section.dataset.type;
    const isOpen  = body.style.display === 'block';

    body.style.display      = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';

    if (!isOpen && section.dataset.loaded === 'false') {
        section.dataset.loaded = 'true';
        loadAnalyticsSectionData(classId, term, type);
    }
};

// ─────────────────────────────────────────────
// LOAD SECTION DATA
// ─────────────────────────────────────────────
async function loadAnalyticsSectionData(classId, term, type) {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_analytics_data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `class_id=${classId}&term=${term}`
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        renderAnalyticsSectionData(classId, term, type, data);
    } catch (e) {
        console.error('Analytics load error:', e);
        const key = `${type}-${classId}-${term}`;
        const noData = document.getElementById(`no-data-${key}`);
        if (noData) {
            noData.textContent = 'Failed to load data.';
            noData.style.display = 'block';
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function renderAnalyticsSectionData(classId, term, type, data) {
    if (type === 'quiz_avg')       renderQuizAverage(classId, term, data.quiz_averages);
    else if (type === 'quiz_gender')    renderQuizGender(classId, term, data.quiz_gender_averages);
    else if (type === 'class_trend')    renderClassTrend(classId, term, data.class_performance_by_term);
    else if (type === 'monthly_gender') renderTermGender(classId, term, data.boys_vs_girls_by_term);
    else if (type === 'top_gender')     renderTopPerformers(classId, term, data.top_girls, data.top_boys);
}

// ─────────────────────────────────────────────
// CHART HELPERS
// ─────────────────────────────────────────────
function getChartCtx(key) {
    if (analyticsCharts[key]) {
        analyticsCharts[key].destroy();
        delete analyticsCharts[key];
    }
    return document.getElementById(`chart-${key}`)?.getContext('2d');
}

function showNoData(key, message) {
    const canvas = document.getElementById(`chart-${key}`);
    const noData = document.getElementById(`no-data-${key}`);
    if (canvas) canvas.style.display = 'none';
    if (noData) { noData.textContent = message || 'No data available yet'; noData.style.display = 'block'; }
}

const chartDefaults = {
    plugins: { legend: { labels: { color: '#e2e8f0', font: { family: 'Nunito', size: 13 } } } },
    scales: {
        y: {
            beginAtZero: true, max: 100,
            ticks: { color: '#8b949e', callback: v => v + '%', stepSize: 10 },
            grid: { color: 'rgba(255,255,255,0.06)' }
        },
        x: {
            ticks: { color: '#8b949e' },
            grid: { color: 'rgba(255,255,255,0.06)' }
        }
    }
};

// ─────────────────────────────────────────────
// RENDER FUNCTIONS
// ─────────────────────────────────────────────
function renderQuizAverage(classId, term, averages) {
    const key = `quiz_avg-${classId}-${term}`;
    if (!averages || !averages.length) return showNoData(key);
    const ctx = getChartCtx(key);
    if (!ctx) return;

    analyticsCharts[key] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: averages.map(a => a.title),
            datasets: [{
                label: 'Class Average %',
                data: averages.map(a => a.avg),
                backgroundColor: 'rgba(79,209,197,0.5)',
                borderColor: '#4fd1c5',
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: { ...chartDefaults, responsive: true }
    });
}

function renderQuizGender(classId, term, genderData) {
    const key = `quiz_gender-${classId}-${term}`;
    if (!genderData || !genderData.length) return showNoData(key);
    const ctx = getChartCtx(key);
    if (!ctx) return;

    analyticsCharts[key] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: genderData.map(d => d.title),
            datasets: [
                {
                    label: 'Boys %',
                    data: genderData.map(d => d.boys),
                    backgroundColor: 'rgba(78,121,167,0.7)',
                    borderColor: '#4e79a7',
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: 'Girls %',
                    data: genderData.map(d => d.girls),
                    backgroundColor: 'rgba(225,87,89,0.7)',
                    borderColor: '#e15759',
                    borderWidth: 2,
                    borderRadius: 6
                }
            ]
        },
        options: { ...chartDefaults, responsive: true }
    });
}

function renderClassTrend(classId, term, averages) {
    const key = `class_trend-${classId}-${term}`;
    if (!averages || !averages.some(v => v !== null)) return showNoData(key);
    const ctx = getChartCtx(key);
    if (!ctx) return;

    analyticsCharts[key] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
            datasets: [{
                label: 'Class Average',
                data: averages,
                borderColor: '#4fd1c5',
                backgroundColor: 'rgba(79,209,197,0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#4fd1c5',
                pointRadius: 6,
                pointHoverRadius: 9,
                borderWidth: 3,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.parsed.y !== null
                            ? `Class Average: ${ctx.parsed.y}%`
                            : 'No data'
                    }
                }
            },
            scales: chartDefaults.scales
        }
    });
}

function renderTermGender(classId, term, data) {
    const key = `monthly_gender-${classId}-${term}`;
    const hasData = data.boys.some(v => v !== null) || data.girls.some(v => v !== null);
    if (!hasData) return showNoData(key);
    const ctx = getChartCtx(key);
    if (!ctx) return;

    analyticsCharts[key] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
            datasets: [
                {
                    label: 'Boys',
                    data: data.boys,
                    borderColor: '#4e79a7',
                    backgroundColor: 'rgba(78,121,167,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#4e79a7',
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    spanGaps: true
                },
                {
                    label: 'Girls',
                    data: data.girls,
                    borderColor: '#e15759',
                    backgroundColor: 'rgba(225,87,89,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#e15759',
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.parsed.y !== null
                            ? `${ctx.dataset.label}: ${ctx.parsed.y}%`
                            : 'No data'
                    }
                }
            },
            scales: chartDefaults.scales
        }
    });
}

function renderTopPerformers(classId, term, girls, boys) {
    const key     = `top_gender-${classId}-${term}`;
    const gEl     = document.getElementById(`top-girls-${key}`);
    const bEl     = document.getElementById(`top-boys-${key}`);
    const noData  = document.getElementById(`no-data-${key}`);

    if ((!girls || !girls.length) && (!boys || !boys.length)) {
        if (noData) noData.style.display = 'block';
        return;
    }

    if (gEl) {
        gEl.innerHTML = girls.length
            ? girls.map((p, i) => `
                <div class="teacher-analytics-performer">
                    <span class="teacher-analytics-performer-name">${i + 1}. ${p.name}</span>
                    <span class="teacher-analytics-performer-avg" style="color:#e15759;">${p.avg}%</span>
                </div>`).join('')
            : '<p style="color:#8b949e;font-size:13px;text-align:center;">No girls data</p>';
    }

    if (bEl) {
        bEl.innerHTML = boys.length
            ? boys.map((p, i) => `
                <div class="teacher-analytics-performer">
                    <span class="teacher-analytics-performer-name">${i + 1}. ${p.name}</span>
                    <span class="teacher-analytics-performer-avg" style="color:#4e79a7;">${p.avg}%</span>
                </div>`).join('')
            : '<p style="color:#8b949e;font-size:13px;text-align:center;">No boys data</p>';
    }
}

// ─────────────────────────────────────────────
// SUBJECT MODAL
// ─────────────────────────────────────────────
window.openSubjectModal = function(classId, currentSubject, className) {
    const modal = document.getElementById('subjectModal');
    if (!modal) return;
    analyticsCurrentClassId = classId;
    const nameEl = document.getElementById('subjectModalClassName');
    if (nameEl) nameEl.textContent = className;
    const input = document.getElementById('subjectInput');
    if (input) input.value = currentSubject || '';
    modal.style.display = 'flex';
    setTimeout(() => input?.focus(), 100);
};

window.closeSubjectModal = function() {
    const modal = document.getElementById('subjectModal');
    if (modal) modal.style.display = 'none';
};

window.saveSubject = async function() {
    const input  = document.getElementById('subjectInput');
    const loader = document.getElementById('loaderOverlay');
    if (!input) return;

    const subject = input.value.trim();
    if (!subject) {
        input.style.borderColor = '#f85149';
        setTimeout(() => input.style.borderColor = '', 1500);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/save_subject.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `class_id=${analyticsCurrentClassId}&subject_name=${encodeURIComponent(subject)}`
        });
        const data = await res.json();

        if (data.success) {
            document.querySelectorAll(
                `[id^="aclass-${analyticsCurrentClassId}-"] .teacher-analytics-subject`
            ).forEach(el => {
                el.textContent = data.subject_name;
                el.classList.remove('unset');
            });
            window.teacherAnalyticsCache = null;
            closeSubjectModal();
        } else {
            alert(data.message || 'Failed to save subject.');
        }
    } catch (e) {
        alert('Connection error. Please try again.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
};