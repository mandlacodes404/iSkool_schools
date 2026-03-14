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
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 12px;
            padding: 24px;
        }

        .sd-class-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 16px;
            cursor: pointer;
            transition: border-color 0.15s;
            position: relative;
            overflow: hidden;
        }

        /* Left accent bar — replaces top color bar */
        .sd-class-card::before {
            content: '';
            position: absolute;
            top: 10px; bottom: 10px;
            left: 0;
            width: 2px;
            border-radius: 0 2px 2px 0;
        }
        .sd-class-card.avg-green::before  { background: var(--green); }
        .sd-class-card.avg-orange::before { background: var(--orange); }
        .sd-class-card.avg-red::before    { background: var(--red); }
        .sd-class-card.avg-gray::before   { background: var(--text-dim); }

        .sd-class-card:hover {
            border-color: var(--border-hover);
            transform: none;
            box-shadow: none;
        }

        .sd-class-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 14px;
        }

        .sd-class-card-name {
            font-size: 18px;
            font-weight: 600;
            color: var(--text);
            line-height: 1;
        }

        .sd-class-card-avg {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            font-family: var(--font-mono);
        }
        .sd-class-card-avg.green  { background: var(--green-dim);  color: var(--green);  }
        .sd-class-card-avg.orange { background: var(--orange-dim); color: var(--orange); }
        .sd-class-card-avg.red    { background: var(--red-dim);    color: var(--red);    }
        .sd-class-card-avg.gray   { background: var(--surface2);   color: var(--text-muted); }

        .sd-class-stats {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 6px;
            margin-bottom: 14px;
        }

        .sd-class-stat {
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 8px 6px;
            text-align: center;
        }
        .sd-class-stat-val {
            font-size: 16px;
            font-weight: 600;
            color: var(--text);
            line-height: 1;
            margin-bottom: 3px;
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sd-class-stat-label {
            font-size: 10px;
            color: var(--text-dim);
            font-weight: 500;
            letter-spacing: 0.3px;
        }

        .sd-class-teachers {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .sd-class-teacher-chip {
            font-size: 11px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 20px;
            background: var(--teal-dim);
            border: 1px solid var(--teal-border);
            color: var(--teal);
            font-family: var(--font-mono);
        }
        .sd-class-no-teachers {
            font-size: 11px;
            color: var(--text-dim);
        }

        .sd-class-arrow {
            position: absolute;
            bottom: 14px;
            right: 14px;
            color: var(--border-hover);
            transition: color 0.15s;
        }
        .sd-class-card:hover .sd-class-arrow { color: var(--teal); }

        /* ── DETAIL VIEW ── */
        .sd-detail-shell { padding: 24px; }

        .sd-detail-back {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-muted);
            cursor: pointer;
            margin-bottom: 20px;
            transition: color 0.15s;
            background: none;
            border: none;
            font-family: var(--font);
            padding: 0;
        }
        .sd-detail-back:hover { color: var(--text); }
        .sd-detail-back svg   { width: 14px; height: 14px; stroke: currentColor; }

        .sd-detail-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        .sd-detail-class-name {
            font-size: 20px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 3px;
        }
        .sd-detail-meta {
            font-size: 12px;
            color: var(--text-muted);
            font-family: var(--font-mono);
        }

        /* ── SUBJECT BLOCK ── */
        .sd-subject-block {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            margin-bottom: 12px;
            overflow: hidden;
            transition: border-color 0.15s;
        }
        .sd-subject-block:hover { border-color: var(--border-hover); }

        .sd-subject-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background 0.15s;
        }
        .sd-subject-header:hover { background: var(--surface2); }

        .sd-subject-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text);
        }
        .sd-subject-name span {
            font-size: 11px;
            font-weight: 500;
            color: var(--teal);
            margin-left: 8px;
            font-family: var(--font-mono);
        }

        .sd-subject-avg-badge {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            font-family: var(--font-mono);
        }
        .sd-subject-avg-badge.green  { background: var(--green-dim);  color: var(--green);  }
        .sd-subject-avg-badge.orange { background: var(--orange-dim); color: var(--orange); }
        .sd-subject-avg-badge.red    { background: var(--red-dim);    color: var(--red);    }
        .sd-subject-avg-badge.gray   { background: var(--surface2);   color: var(--text-muted); }

        /* ── LEARNER TABLE ── */
        .sd-learner-table-wrap { overflow-x: auto; }

        .sd-learner-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .sd-learner-table th {
            padding: 8px 14px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: var(--text-dim);
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            font-family: var(--font);
        }

        .sd-learner-table td {
            padding: 8px 14px;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            white-space: nowrap;
        }

        .sd-learner-table tr:last-child td { border-bottom: none; }
        .sd-learner-table tr:hover td      { background: var(--surface2); }

        .sd-learner-rank {
            font-size: 11px;
            font-weight: 500;
            color: var(--text-dim);
            width: 22px;
            font-family: var(--font-mono);
        }

        .sd-learner-name-cell {
            font-weight: 500;
            color: var(--text);
            min-width: 160px;
        }

        .sd-learner-gender {
            font-size: 11px;
            padding: 2px 7px;
            border-radius: 20px;
            font-weight: 500;
            font-family: var(--font-mono);
        }
        .sd-learner-gender.male   { background: var(--blue-dim);         color: var(--blue);   }
        .sd-learner-gender.female { background: rgba(225,87,89,0.1);     color: #e15759;       }
        .sd-learner-gender.other  { background: var(--surface2);         color: var(--text-muted); }

        .sd-quiz-score {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            text-align: center;
            min-width: 48px;
            display: inline-block;
            font-family: var(--font-mono);
        }
        .sd-quiz-score.green  { background: var(--green-dim);  color: var(--green);  }
        .sd-quiz-score.orange { background: var(--orange-dim); color: var(--orange); }
        .sd-quiz-score.red    { background: var(--red-dim);    color: var(--red);    }
        .sd-quiz-score.none   { background: var(--surface2);   color: var(--text-dim); font-size: 11px; }

        .sd-learner-avg {
            font-size: 12px;
            font-weight: 600;
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sd-learner-avg.green  { color: var(--green);  }
        .sd-learner-avg.orange { color: var(--orange); }
        .sd-learner-avg.red    { color: var(--red);    }
        .sd-learner-avg.gray   { color: var(--text-dim); }

        /* ── EMPTY STATE ── */
        .sd-classes-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 20px;
            color: var(--text-dim);
            text-align: center;
            gap: 10px;
        }
        .sd-classes-empty svg { opacity: 0.2; }
        .sd-classes-empty h3  { color: var(--text-muted); font-size: 14px; font-weight: 600; }

        /* ── NO ASSESSMENTS ── */
        .sd-no-assessments {
            padding: 28px 16px;
            text-align: center;
            color: var(--text-dim);
            font-size: 13px;
        }

        @media (max-width: 600px) {
            .sd-class-grid   { grid-template-columns: 1fr; padding: 14px; }
            .sd-detail-shell { padding: 14px; }
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
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;">
                    <div class="sd-skeleton" style="height:20px;width:60px;margin-bottom:14px;"></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px;">
                        ${[1,2,3].map(() => `<div class="sd-skeleton" style="height:50px;border-radius:var(--radius);"></div>`).join('')}
                    </div>
                    <div class="sd-skeleton" style="height:22px;width:70%;border-radius:20px;"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_classes.php');
        const data = await res.json();
        window._sdClassesCache = data;
        renderClassesGrid(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load classes.</p>`;
    }
};

function renderClassesGrid(data) {
    const content = document.getElementById('sd-content');
    const classes = data.classes || [];

    if (!classes.length) {
        content.innerHTML = `
            <div class="sd-classes-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--teal)" stroke-width="1.5" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <h3>No classes yet</h3>
                <p style="font-size:12px;">Classes will appear here once created.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div style="padding:24px 24px 8px;">
            <div style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:3px;">Classes</div>
            <div style="font-size:12px;color:var(--text-muted);">${classes.length} class${classes.length !== 1 ? 'es' : ''} · Click a class to drill into learner performance</div>
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
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
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
            <div class="sd-skeleton" style="height:14px;width:100px;margin-bottom:20px;border-radius:var(--radius);"></div>
            <div class="sd-skeleton" style="height:20px;width:200px;margin-bottom:6px;"></div>
            <div class="sd-skeleton" style="height:12px;width:160px;margin-bottom:20px;"></div>
            ${[1,2].map(() => `
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:12px;overflow:hidden;">
                    <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
                        <div class="sd-skeleton" style="height:14px;width:160px;"></div>
                    </div>
                    <div style="padding:14px;">
                        <div class="sd-skeleton" style="height:160px;border-radius:var(--radius);"></div>
                    </div>
                </div>`).join('')}
        </div>`;

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
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load class detail.</p>`;
    }
};

function renderClassDetail(data) {
    const content  = document.getElementById('sd-content');
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

            const quizHeaders = sub.quizzes.map(q =>
                `<th title="${q.title}">T${q.term_number} · ${q.title.length > 12 ? q.title.substring(0,12)+'…' : q.title}</th>`
            ).join('');

            const learnerRows = sub.learner_perf.map((l, li) => {
                const avgCol      = sdAvgColor(l.avg);
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
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span class="sd-subject-avg-badge ${col}">${sub.subject_avg !== null ? sub.subject_avg + '%' : '—'}</span>
                            <svg id="sd-chevron-${si}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-muted)" stroke-width="2.5" style="transition:transform 0.2s;">
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
                All classes
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
    const isHidden        = body.style.display === 'none';
    body.style.display    = isHidden ? '' : 'none';
    chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
};