// ═══════════════════════════════════════════════════════
// CLASSES SECTION
// ═══════════════════════════════════════════════════════

window._sdClassesCache    = null;
window._sdClassDetailCache = {};

// ── INJECT STYLES ──
(function injectClassStyles() {
    if (document.getElementById('sd-class-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-class-styles';
    s.textContent = `
        /* ── CLASS GRID ── */
        .sd-class-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
            padding: 28px;
        }

        .sd-class-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        .sd-class-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            border-radius: 14px 14px 0 0;
        }
        .sd-class-card.avg-green::before  { background: #22c55e; }
        .sd-class-card.avg-orange::before { background: #f59e0b; }
        .sd-class-card.avg-red::before    { background: #f85149; }
        .sd-class-card.avg-gray::before   { background: #4a5568; }

        .sd-class-card:hover {
            border-color: rgba(79,209,197,0.3);
            transform: translateY(-3px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .sd-class-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .sd-class-card-name {
            font-size: 22px;
            font-weight: 900;
            color: #e2e8f0;
            line-height: 1;
        }

        .sd-class-card-avg {
            font-size: 13px;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 20px;
        }
        .sd-class-card-avg.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sd-class-card-avg.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sd-class-card-avg.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sd-class-card-avg.gray   { background: rgba(255,255,255,0.06); color: #8b949e; }

        .sd-class-stats {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            margin-bottom: 16px;
        }

        .sd-class-stat {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 10px 8px;
            text-align: center;
        }
        .sd-class-stat-val {
            font-size: 18px;
            font-weight: 900;
            color: #e2e8f0;
            line-height: 1;
            margin-bottom: 4px;
        }
        .sd-class-stat-label {
            font-size: 10px;
            color: #8b949e;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .sd-class-teachers {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .sd-class-teacher-chip {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 20px;
            background: rgba(79,209,197,0.08);
            border: 1px solid rgba(79,209,197,0.2);
            color: #4fd1c5;
        }
        .sd-class-no-teachers {
            font-size: 11px;
            color: #4a5568;
            font-style: italic;
        }

        .sd-class-arrow {
            position: absolute;
            bottom: 16px;
            right: 16px;
            color: #4a5568;
            transition: color 0.2s, transform 0.2s;
        }
        .sd-class-card:hover .sd-class-arrow {
            color: #4fd1c5;
            transform: translateX(3px);
        }

        /* ── DETAIL VIEW ── */
        .sd-detail-shell {
            padding: 28px;
        }

        .sd-detail-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            color: #8b949e;
            cursor: pointer;
            margin-bottom: 24px;
            transition: color 0.2s;
            background: none;
            border: none;
            font-family: 'Nunito', sans-serif;
            padding: 0;
        }
        .sd-detail-back:hover { color: #e2e8f0; }
        .sd-detail-back svg { width: 16px; height: 16px; stroke: currentColor; }

        .sd-detail-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 28px;
        }
        .sd-detail-class-name {
            font-size: 28px;
            font-weight: 900;
            color: #e2e8f0;
            margin-bottom: 4px;
        }
        .sd-detail-meta {
            font-size: 13px;
            color: #8b949e;
        }

        /* ── SUBJECT BLOCK ── */
        .sd-subject-block {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            margin-bottom: 20px;
            overflow: hidden;
        }

        .sd-subject-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            cursor: pointer;
            transition: background 0.15s;
        }
        .sd-subject-header:hover { background: rgba(255,255,255,0.02); }

        .sd-subject-name {
            font-size: 15px;
            font-weight: 800;
            color: #e2e8f0;
        }
        .sd-subject-name span {
            font-size: 11px;
            font-weight: 700;
            color: #4fd1c5;
            margin-left: 8px;
            letter-spacing: 0.5px;
        }

        .sd-subject-avg-badge {
            font-size: 13px;
            font-weight: 800;
            padding: 4px 14px;
            border-radius: 20px;
        }
        .sd-subject-avg-badge.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sd-subject-avg-badge.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sd-subject-avg-badge.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sd-subject-avg-badge.gray   { background: rgba(255,255,255,0.06); color: #8b949e; }

        /* ── LEARNER TABLE ── */
        .sd-learner-table-wrap {
            overflow-x: auto;
        }

        .sd-learner-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .sd-learner-table th {
            padding: 10px 16px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #8b949e;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            white-space: nowrap;
            background: rgba(255,255,255,0.02);
        }

        .sd-learner-table td {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            color: #c9d1d9;
            white-space: nowrap;
        }

        .sd-learner-table tr:last-child td { border-bottom: none; }
        .sd-learner-table tr:hover td { background: rgba(255,255,255,0.02); }

        .sd-learner-rank {
            font-size: 11px;
            font-weight: 800;
            color: #4a5568;
            width: 24px;
        }

        .sd-learner-name-cell {
            font-weight: 700;
            color: #e2e8f0;
            min-width: 160px;
        }

        .sd-learner-gender {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }
        .sd-learner-gender.male   { background: rgba(78,121,167,0.15); color: #4e79a7; }
        .sd-learner-gender.female { background: rgba(225,87,89,0.15);  color: #e15759; }
        .sd-learner-gender.other  { background: rgba(255,255,255,0.06); color: #8b949e; }

        .sd-quiz-score {
            font-size: 12px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 10px;
            text-align: center;
            min-width: 52px;
            display: inline-block;
        }
        .sd-quiz-score.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sd-quiz-score.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sd-quiz-score.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sd-quiz-score.none   { background: rgba(255,255,255,0.04); color: #4a5568; font-style: italic; font-size: 11px; }

        .sd-learner-avg {
            font-size: 13px;
            font-weight: 800;
        }
        .sd-learner-avg.green  { color: #22c55e; }
        .sd-learner-avg.orange { color: #f59e0b; }
        .sd-learner-avg.red    { color: #f85149; }
        .sd-learner-avg.gray   { color: #4a5568; }

        /* ── EMPTY STATE ── */
        .sd-classes-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 20px;
            color: #4a5568;
            text-align: center;
            gap: 12px;
        }
        .sd-classes-empty svg { opacity: 0.3; }
        .sd-classes-empty h3  { color: #8b949e; font-size: 16px; }

        /* ── NO ASSESSMENTS ── */
        .sd-no-assessments {
            padding: 30px 20px;
            text-align: center;
            color: #4a5568;
            font-size: 13px;
            font-style: italic;
        }

        @media (max-width: 600px) {
            .sd-class-grid  { grid-template-columns: 1fr; padding: 16px; }
            .sd-detail-shell { padding: 16px; }
        }
    `;
    document.head.appendChild(s);
})();

// ── COLOR HELPER ──
function sdAvgColor(v) {
    if (v === null || v === undefined) return 'gray';
    if (v >= 60) return 'green';
    if (v >= 40) return 'orange';
    return 'red';
}

// ═══════════════════════════════════════
// LOAD CLASSES GRID
// ═══════════════════════════════════════
window.loadSdClasses = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdClassesCache) {
        renderClassesGrid(window._sdClassesCache);
        return;
    }

    // Skeleton
    content.innerHTML = `
        <div class="sd-class-grid">
            ${[1,2,3,4].map(() => `
                <div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px;">
                    <div class="sd-skeleton" style="height:24px;width:60px;margin-bottom:16px;"></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
                        ${[1,2,3].map(() => `<div class="sd-skeleton" style="height:56px;border-radius:8px;"></div>`).join('')}
                    </div>
                    <div class="sd-skeleton" style="height:24px;width:80%;border-radius:20px;"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_classes.php');
        const data = await res.json();
        window._sdClassesCache = data;
        renderClassesGrid(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load classes.</p>`;
    }
};

function renderClassesGrid(data) {
    const content = document.getElementById('sd-content');
    const classes = data.classes || [];

    if (!classes.length) {
        content.innerHTML = `
            <div class="sd-classes-empty">
                <svg viewBox="0 0 24 24" width="56" height="56" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <h3>No classes yet</h3>
                <p>Classes will appear here once created.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div style="padding:28px 28px 8px;">
            <div style="font-size:22px;font-weight:900;color:#e2e8f0;margin-bottom:4px;">Classes</div>
            <div style="font-size:13px;color:#8b949e;">${classes.length} class${classes.length !== 1 ? 'es' : ''} · Click a class to drill into learner performance</div>
        </div>
        <div class="sd-class-grid">
            ${classes.map(cls => {
                const col = sdAvgColor(cls.avg_pct);
                const teacherChips = cls.teachers.length
                    ? cls.teachers.map(t =>
                        `<span class="sd-class-teacher-chip">${t.subject_name || t.name}</span>`
                      ).join('')
                    : `<span class="sd-class-no-teachers">No content posted yet</span>`;

                return `
                    <div class="sd-class-card avg-${col}" onclick="loadSdClassDetail(${cls.id}, '${cls.name.replace(/'/g,"\\'")}')">
                        <div class="sd-class-card-header">
                            <div class="sd-class-card-name">${cls.name}</div>
                            <div class="sd-class-card-avg ${col}">${cls.avg_pct !== null ? cls.avg_pct + '%' : '—'}</div>
                        </div>
                        <div class="sd-class-stats">
                            <div class="sd-class-stat">
                                <div class="sd-class-stat-val">${cls.learner_count}</div>
                                <div class="sd-class-stat-label">Learners</div>
                            </div>
                            <div class="sd-class-stat">
                                <div class="sd-class-stat-val">${cls.quiz_count}</div>
                                <div class="sd-class-stat-label">Quizzes</div>
                            </div>
                            <div class="sd-class-stat">
                                <div class="sd-class-stat-val">${cls.assignment_count}</div>
                                <div class="sd-class-stat-label">Assignments</div>
                            </div>
                        </div>
                        <div class="sd-class-teachers">${teacherChips}</div>
                        <div class="sd-class-arrow">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="5" y1="12" x2="19" y2="12"/>
                                <polyline points="12 5 19 12 12 19"/>
                            </svg>
                        </div>
                    </div>`;
            }).join('')}
        </div>`;
}

// ═══════════════════════════════════════
// LOAD CLASS DETAIL (DRILL DOWN)
// ═══════════════════════════════════════
window.loadSdClassDetail = async function(classId, className) {
    const content = document.getElementById('sd-content');

    // Skeleton
    content.innerHTML = `
        <div class="sd-detail-shell">
            <div class="sd-skeleton" style="height:16px;width:100px;margin-bottom:24px;border-radius:6px;"></div>
            <div class="sd-skeleton" style="height:28px;width:200px;margin-bottom:8px;"></div>
            <div class="sd-skeleton" style="height:13px;width:160px;margin-bottom:28px;"></div>
            ${[1,2].map(() => `
                <div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:20px;overflow:hidden;">
                    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                        <div class="sd-skeleton" style="height:16px;width:160px;"></div>
                    </div>
                    <div style="padding:16px;">
                        <div class="sd-skeleton" style="height:180px;border-radius:8px;"></div>
                    </div>
                </div>`).join('')}
        </div>`;

    // Use cache if available
    if (window._sdClassDetailCache[classId]) {
        renderClassDetail(window._sdClassDetailCache[classId]);
        return;
    }

    try {
        const res  = await fetch('api/school/get_class_detail.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `class_id=${classId}`
        });
        const data = await res.json();
        window._sdClassDetailCache[classId] = data;
        renderClassDetail(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load class detail.</p>`;
    }
};

function renderClassDetail(data) {
    const content = document.getElementById('sd-content');
    const subjects = data.subjects || [];

    let subjectsHTML = '';

    if (!subjects.length) {
        subjectsHTML = `
            <div class="sd-no-assessments">
                No summative assessments have been posted to this class yet.
            </div>`;
    } else {
        subjectsHTML = subjects.map((sub, si) => {
            const col = sdAvgColor(sub.subject_avg);

            // Quiz column headers
            const quizHeaders = sub.quizzes.map(q =>
                `<th title="${q.title}">T${q.term_number} · ${q.title.length > 12 ? q.title.substring(0,12)+'…' : q.title}</th>`
            ).join('');

            // Learner rows
            const learnerRows = sub.learner_perf.map((l, li) => {
                const avgCol = sdAvgColor(l.avg);
                const genderLabel = l.gender === 'male' ? 'Boy' : l.gender === 'female' ? 'Girl' : '—';

                const quizCells = sub.quizzes.map(q => {
                    const score = l.scores[q.id];
                    if (score === null || score === undefined) {
                        return `<td><span class="sd-quiz-score none">—</span></td>`;
                    }
                    const sc = sdAvgColor(score);
                    return `<td><span class="sd-quiz-score ${sc}">${score}%</span></td>`;
                }).join('');

                return `
                    <tr>
                        <td class="sd-learner-rank">${li + 1}</td>
                        <td class="sd-learner-name-cell">${l.name}</td>
                        <td><span class="sd-learner-gender ${l.gender || 'other'}">${genderLabel}</span></td>
                        ${quizCells}
                        <td><span class="sd-learner-avg ${avgCol}">${l.avg !== null ? l.avg + '%' : '—'}</span></td>
                    </tr>`;
            }).join('');

            return `
                <div class="sd-subject-block">
                    <div class="sd-subject-header" onclick="toggleSubjectBlock(${si})">
                        <div class="sd-subject-name">
                            ${sub.subject_name}
                            <span>${sub.quizzes.length} assessment${sub.quizzes.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span class="sd-subject-avg-badge ${col}">${sub.subject_avg !== null ? sub.subject_avg + '%' : '—'}</span>
                            <svg id="sd-chevron-${si}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8b949e" stroke-width="2.5" style="transition:transform 0.2s;">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div id="sd-subject-body-${si}" class="sd-learner-table-wrap">
                        <table class="sd-learner-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Learner</th>
                                    <th>Gender</th>
                                    ${quizHeaders}
                                    <th>Avg</th>
                                </tr>
                            </thead>
                            <tbody>${learnerRows}</tbody>
                        </table>
                    </div>
                </div>`;
        }).join('');
    }

    content.innerHTML = `
        <div class="sd-detail-shell">
            <button class="sd-detail-back" onclick="loadSdClasses()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                All Classes
            </button>

            <div class="sd-detail-header">
                <div>
                    <div class="sd-detail-class-name">${data.class_name}</div>
                    <div class="sd-detail-meta">${data.learner_count} learner${data.learner_count !== 1 ? 's' : ''} · ${subjects.length} subject${subjects.length !== 1 ? 's' : ''} with assessments</div>
                </div>
            </div>

            ${subjectsHTML}
        </div>`;
}

// ── TOGGLE SUBJECT BLOCK (accordion) ──
window.toggleSubjectBlock = function(idx) {
    const body    = document.getElementById(`sd-subject-body-${idx}`);
    const chevron = document.getElementById(`sd-chevron-${idx}`);
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display    = isHidden ? '' : 'none';
    chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
};