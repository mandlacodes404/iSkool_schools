// ══════════════════════════════════════════════════════════
// CONTENT SECTION — assets/js/school/content.js
// ══════════════════════════════════════════════════════════

window._sdConCache   = null; // content data
window._sdEvalCache  = null; // evaluations data
window._sdConTab     = 'content'; // 'content' | 'evaluations'
window._sdConFilters = { class_id: 0, term: 0, teacher_email: '', type: '' };
window._sdConSearch  = '';
window._sdEvalFilters= { class_id: 0, term: 0, teacher_email: '' };
window._sdEvalSearch = '';
window._sdEvalOpen   = null;

// ── INJECT STYLES ──
(function injectConStyles() {
    if (document.getElementById('sd-con-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-con-styles';
    s.textContent = `
        .sdcon-shell { padding: 28px 28px 80px; max-width: 1200px; }

        /* Tab bar */
        .sdcon-tabs {
            display: flex; gap: 4px;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px;
            padding: 4px;
            margin-bottom: 24px;
            width: fit-content;
        }
        .sdcon-tab {
            font-size: 13px; font-weight: 800;
            padding: 8px 20px; border-radius: 9px;
            border: none; background: none;
            color: #4a5568; cursor: pointer;
            font-family: 'Nunito', sans-serif;
            transition: all 0.18s;
            display: flex; align-items: center; gap: 7px;
        }
        .sdcon-tab:hover { color: #8b949e; }
        .sdcon-tab.active {
            background: rgba(79,209,197,0.12);
            border: 1px solid rgba(79,209,197,0.3);
            color: #4fd1c5;
        }
        .sdcon-tab svg { width: 14px; height: 14px; stroke: currentColor; }

        /* Stats row */
        .sdcon-stats {
            display: flex; gap: 10px; flex-wrap: wrap;
            margin-bottom: 20px;
        }
        .sdcon-stat {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            padding: 12px 18px;
        }
        .sdcon-stat-val   { font-size: 20px; font-weight: 900; }
        .sdcon-stat-label { font-size: 11px; color: #4a5568; font-weight: 700; margin-top: 2px; }
        .sdcon-stat.c-teal   .sdcon-stat-val { color: #4fd1c5; }
        .sdcon-stat.c-blue   .sdcon-stat-val { color: #4e79a7; }
        .sdcon-stat.c-purple .sdcon-stat-val { color: #a78bfa; }
        .sdcon-stat.c-orange .sdcon-stat-val { color: #f59e0b; }
        .sdcon-stat.c-green  .sdcon-stat-val { color: #22c55e; }

        /* Toolbar */
        .sdcon-toolbar {
            display: flex; align-items: center;
            gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
        }
        .sdcon-search-wrap {
            position: relative; flex: 1;
            min-width: 180px; max-width: 300px;
        }
        .sdcon-search-wrap svg {
            position: absolute; left: 11px; top: 50%;
            transform: translateY(-50%);
            width: 14px; height: 14px; stroke: #4a5568;
            pointer-events: none;
        }
        .sdcon-search {
            width: 100%;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 8px 12px 8px 32px;
            font-family: 'Nunito', sans-serif;
            font-size: 13px; font-weight: 600;
            color: #e2e8f0; outline: none;
            transition: border-color 0.2s;
        }
        .sdcon-search::placeholder { color: #4a5568; }
        .sdcon-search:focus { border-color: rgba(79,209,197,0.4); }
        .sdcon-select {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 8px 12px;
            font-family: 'Nunito', sans-serif;
            font-size: 12px; font-weight: 700;
            color: #8b949e; outline: none; cursor: pointer;
        }
        .sdcon-select:focus { border-color: rgba(79,209,197,0.4); }
        .sdcon-count {
            font-size: 11px; font-weight: 800;
            padding: 5px 12px; border-radius: 20px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            color: #4a5568; white-space: nowrap;
            margin-left: auto;
        }

        /* Content table */
        .sdcon-table-wrap { overflow-x: auto; }
        .sdcon-table {
            width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .sdcon-table th {
            padding: 10px 14px;
            text-align: left;
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #4a5568;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            white-space: nowrap;
        }
        .sdcon-table td {
            padding: 12px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            color: #c9d1d9; vertical-align: middle;
        }
        .sdcon-table tr:last-child td { border-bottom: none; }
        .sdcon-table tbody tr:hover td { background: rgba(255,255,255,0.02); }

        /* Type badge */
        .sdcon-type {
            font-size: 10px; font-weight: 800;
            padding: 3px 9px; border-radius: 8px;
            letter-spacing: 0.5px; text-transform: uppercase;
            white-space: nowrap;
        }
        .sdcon-type.quiz        { background: rgba(79,209,197,0.1);  color: #4fd1c5; }
        .sdcon-type.summative   { background: rgba(34,197,94,0.1);   color: #22c55e; }
        .sdcon-type.assignment  { background: rgba(78,121,167,0.1);  color: #4e79a7; }
        .sdcon-type.resource    { background: rgba(167,139,250,0.1); color: #a78bfa; }

        .sdcon-title-cell { font-weight: 800; color: #e2e8f0; }
        .sdcon-sub-cell   { font-size: 11px; color: #4a5568; margin-top: 2px; }

        .sdcon-badge {
            font-size: 10px; font-weight: 800;
            padding: 2px 8px; border-radius: 8px;
        }
        .sdcon-badge.class { background: rgba(79,209,197,0.08); color: #4fd1c5; }
        .sdcon-badge.term  { background: rgba(167,139,250,0.08); color: #a78bfa; }

        .sdcon-avg {
            font-size: 12px; font-weight: 800;
            padding: 3px 10px; border-radius: 20px;
        }
        .sdcon-avg.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sdcon-avg.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sdcon-avg.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sdcon-avg.gray   { background: rgba(255,255,255,0.06); color: #4a5568; }

        /* ── EVALUATIONS ── */
        .sdeval-list { display: flex; flex-direction: column; gap: 12px; }

        .sdeval-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px; overflow: hidden;
            transition: border-color 0.2s;
        }
        .sdeval-card:hover { border-color: rgba(255,255,255,0.13); }
        .sdeval-card.open  { border-color: rgba(79,209,197,0.25); }

        .sdeval-header {
            display: flex; align-items: center;
            gap: 14px; padding: 16px 20px;
            cursor: pointer;
        }

        .sdeval-score-circle {
            width: 52px; height: 52px; border-radius: 50%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            flex-shrink: 0;
            border: 3px solid;
        }
        .sdeval-score-circle.green  { border-color: #22c55e; background: rgba(34,197,94,0.08); }
        .sdeval-score-circle.orange { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
        .sdeval-score-circle.red    { border-color: #f85149; background: rgba(248,81,73,0.08); }
        .sdeval-score-circle.gray   { border-color: #2d3340; background: rgba(255,255,255,0.03); }
        .sdeval-score-num {
            font-size: 16px; font-weight: 900; line-height: 1;
        }
        .sdeval-score-num.green  { color: #22c55e; }
        .sdeval-score-num.orange { color: #f59e0b; }
        .sdeval-score-num.red    { color: #f85149; }
        .sdeval-score-num.gray   { color: #2d3340; }
        .sdeval-score-label { font-size: 9px; color: #4a5568; font-weight: 700; }

        .sdeval-main { flex: 1; min-width: 0; }
        .sdeval-title {
            font-size: 14px; font-weight: 800; color: #e2e8f0;
            margin-bottom: 5px;
        }
        .sdeval-meta {
            display: flex; align-items: center;
            gap: 8px; flex-wrap: wrap;
        }
        .sdeval-meta-text { font-size: 11px; color: #4a5568; }
        .sdeval-badge {
            font-size: 10px; font-weight: 800;
            padding: 2px 8px; border-radius: 8px;
            letter-spacing: 0.3px;
        }
        .sdeval-badge.class  { background: rgba(79,209,197,0.1);  color: #4fd1c5; }
        .sdeval-badge.term   { background: rgba(167,139,250,0.1); color: #a78bfa; }
        .sdeval-badge.active { background: rgba(34,197,94,0.1);   color: #22c55e; }
        .sdeval-badge.closed { background: rgba(255,255,255,0.05); color: #4a5568; }
        .sdeval-resp-count {
            font-size: 12px; font-weight: 800; color: #4fd1c5;
            white-space: nowrap; flex-shrink: 0;
        }
        .sdeval-chevron {
            color: #2d3340; flex-shrink: 0;
            transition: transform 0.2s, color 0.2s;
        }
        .sdeval-card.open .sdeval-chevron {
            transform: rotate(180deg); color: #4fd1c5;
        }
        .sdeval-chevron svg { width: 16px; height: 16px; stroke: currentColor; }

        /* Body */
        .sdeval-body {
            display: none;
            padding: 0 20px 20px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        .sdeval-card.open .sdeval-body { display: block; }

        /* Statements */
        .sdeval-statements { padding-top: 16px; margin-bottom: 16px; }
        .sdeval-stmt-row {
            display: flex; align-items: center; gap: 12px;
            padding: 9px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .sdeval-stmt-row:last-child { border-bottom: none; }
        .sdeval-stmt-text {
            flex: 1; font-size: 13px; font-weight: 600; color: #c9d1d9;
        }
        .sdeval-stmt-bar-wrap {
            width: 120px; height: 6px;
            background: rgba(255,255,255,0.05);
            border-radius: 3px; overflow: hidden; flex-shrink: 0;
        }
        .sdeval-stmt-bar { height: 100%; border-radius: 3px; }
        .sdeval-stmt-score {
            font-size: 12px; font-weight: 800;
            width: 32px; text-align: right; flex-shrink: 0;
        }

        /* Score label */
        .sdeval-score-tag {
            font-size: 10px; font-weight: 800;
            padding: 2px 8px; border-radius: 8px;
            white-space: nowrap; flex-shrink: 0;
        }
        .sdeval-score-tag.s5 { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sdeval-score-tag.s4 { background: rgba(79,209,197,0.12); color: #4fd1c5; }
        .sdeval-score-tag.s3 { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sdeval-score-tag.s2 { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sdeval-score-tag.s1 { background: rgba(248,81,73,0.2);   color: #f85149; }

        /* Comments */
        .sdeval-comments-title {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #4a5568; margin-bottom: 10px;
        }
        .sdeval-comment {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-left: 3px solid rgba(79,209,197,0.3);
            border-radius: 8px; padding: 12px 14px;
            margin-bottom: 8px;
        }
        .sdeval-comment-text {
            font-size: 13px; font-weight: 600; color: #c9d1d9;
            line-height: 1.6; margin-bottom: 6px;
        }
        .sdeval-comment-date { font-size: 11px; color: #2d3340; }

        .sdeval-no-responses {
            text-align: center; padding: 20px;
            color: #2d3340; font-size: 13px; font-style: italic;
        }

        /* Empty state */
        .sdcon-empty {
            text-align: center; padding: 60px 20px;
            color: #4a5568; font-size: 13px; font-style: italic;
        }

        @media (max-width: 700px) {
            .sdcon-shell { padding: 16px 14px 80px; }
            .sdcon-tabs  { width: 100%; }
        }
    `;
    document.head.appendChild(s);
})();

// ── Helpers ──
function sdconAvgColor(v) {
    if (v === null || v === undefined) return 'gray';
    if (v >= 60) return 'green';
    if (v >= 40) return 'orange';
    return 'red';
}
function sdevalScoreColor(v) {
    if (v === null) return 'gray';
    if (v >= 4.5) return 'green';
    if (v >= 3.5) return 'green';
    if (v >= 2.5) return 'orange';
    return 'red';
}
function sdevalScoreTag(v) {
    if (v === null) return '';
    if (v >= 4.5) return '<span class="sdeval-score-tag s5">Excellent</span>';
    if (v >= 3.5) return '<span class="sdeval-score-tag s4">Good</span>';
    if (v >= 2.5) return '<span class="sdeval-score-tag s3">Neutral</span>';
    if (v >= 1.5) return '<span class="sdeval-score-tag s2">Poor</span>';
    return '<span class="sdeval-score-tag s1">Very Poor</span>';
}
function sdconTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-ZA', { day:'numeric', month:'short' });
}

// ══════════════════════════════════════════════════════════
// LOAD CONTENT SECTION
// ══════════════════════════════════════════════════════════
window.loadSdContent = async function() {
    const content = document.getElementById('sd-content');

    // Show skeleton
    content.innerHTML = `
        <div class="sdcon-shell">
            <div class="sd-skeleton" style="height:44px;width:300px;border-radius:12px;margin-bottom:24px;"></div>
            <div style="display:flex;gap:10px;margin-bottom:20px;">
                ${[1,2,3,4].map(()=>`<div class="sd-skeleton" style="height:56px;width:100px;border-radius:10px;"></div>`).join('')}
            </div>
            ${[1,2,3,4,5].map(()=>`<div class="sd-skeleton" style="height:52px;border-radius:8px;margin-bottom:6px;"></div>`).join('')}
        </div>`;

    // Load both in parallel
    try {
        const [conRes, evalRes] = await Promise.all([
            fetch('api/school/get_content.php'),
            fetch('api/school/get_evaluations.php'),
        ]);
        window._sdConCache  = await conRes.json();
        window._sdEvalCache = await evalRes.json();
        renderContentSection();
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load content.</p>`;
    }
};

function renderContentSection() {
    if (window._sdConTab === 'content') {
        renderContentTab();
    } else {
        renderEvaluationsTab();
    }
}

window.sdconSwitchTab = function(tab) {
    window._sdConTab = tab;
    renderContentSection();
};

// ══════════════════════════════════════════════════════════
// CONTENT TAB
// ══════════════════════════════════════════════════════════
function renderContentTab() {
    const content = document.getElementById('sd-content');
    const d = window._sdConCache;
    const f = window._sdConFilters;
    const search = window._sdConSearch.toLowerCase().trim();

    // Merge all content into one list
    let all = [
        ...d.quizzes,
        ...d.assignments,
        ...d.resources,
    ];

    // Filter
    if (f.class_id)      all = all.filter(i => i.class_id == f.class_id);
    if (f.term)          all = all.filter(i => i.term == f.term);
    if (f.teacher_email) all = all.filter(i => i.teacher_email === f.teacher_email);
    if (f.type === 'quiz')       all = all.filter(i => i.type === 'quiz');
    if (f.type === 'summative')  all = all.filter(i => i.type === 'quiz' && i.is_summative);
    if (f.type === 'assignment') all = all.filter(i => i.type === 'assignment');
    if (f.type === 'resource')   all = all.filter(i => i.type === 'resource');
    if (search) all = all.filter(i =>
        i.title.toLowerCase().includes(search) ||
        i.teacher_name.toLowerCase().includes(search) ||
        i.class_name.toLowerCase().includes(search)
    );

    // Sort by date desc
    all.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const classOptions = (d.classes||[]).map(c =>
        `<option value="${c.id}" ${f.class_id == c.id ? 'selected':''}>${c.name}</option>`).join('');
    const teacherOptions = (d.teachers||[]).map(t =>
        `<option value="${t.email}" ${f.teacher_email===t.email?'selected':''}>${t.name}</option>`).join('');

    const rows = all.length ? all.map(item => {
        let typeBadge, subInfo, rightCol;
        const clickable = `onclick="sdconViewItem('${item.type}', ${item.id})" style="cursor:pointer;"`;

        if (item.type === 'quiz') {
            typeBadge = item.is_summative
                ? `<span class="sdcon-type summative">Summative</span>`
                : `<span class="sdcon-type quiz">Quiz</span>`;
            subInfo   = `Term ${item.term}${item.weight ? ' · ' + item.weight + '%' : ''}`;
            const col = sdconAvgColor(item.avg_pct);
            rightCol  = item.avg_pct !== null
                ? `<span class="sdcon-avg ${col}">${item.avg_pct}%</span>`
                : `<span class="sdcon-avg gray">—</span>`;
        } else if (item.type === 'assignment') {
            typeBadge = `<span class="sdcon-type assignment">Assignment</span>`;
            subInfo   = item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString('en-ZA', {day:'numeric',month:'short'})}` : '';
            rightCol  = `<span style="font-size:12px;color:#4a5568;">${item.submissions} submitted</span>`;
        } else {
            typeBadge = `<span class="sdcon-type resource">Resource</span>`;
            subInfo   = item.file_type ? item.file_type.toUpperCase() : 'File';
            rightCol  = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#4a5568" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
        }

        return `
            <tr ${clickable}>
                <td>${typeBadge}</td>
                <td>
                    <div class="sdcon-title-cell">${item.title}</div>
                    <div class="sdcon-sub-cell">${subInfo}</div>
                </td>
                <td style="font-size:12px;color:#8b949e;">${item.teacher_name}</td>
                <td><span class="sdcon-badge class">${item.class_name}</span></td>
                <td style="font-size:11px;color:#4a5568;">${sdconTimeAgo(item.created_at)}</td>
                <td>${rightCol}</td>
            </tr>`;
    }).join('') : `<tr><td colspan="6" class="sdcon-empty">No content found${search ? ' matching "'+search+'"':''}</td></tr>`;

    content.innerHTML = `
        <div class="sdcon-shell">

            <!-- TABS -->
            <div class="sdcon-tabs">
                <button class="sdcon-tab active" onclick="sdconSwitchTab('content')">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Content
                </button>
                <button class="sdcon-tab" onclick="sdconSwitchTab('evaluations')">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Evaluations
                </button>
            </div>

            <!-- STATS -->
            <div class="sdcon-stats">
                <div class="sdcon-stat c-teal">
                    <div class="sdcon-stat-val">${d.total_quizzes}</div>
                    <div class="sdcon-stat-label">Quizzes</div>
                </div>
                <div class="sdcon-stat c-green">
                    <div class="sdcon-stat-val">${d.summative_count}</div>
                    <div class="sdcon-stat-label">Summative</div>
                </div>
                <div class="sdcon-stat c-blue">
                    <div class="sdcon-stat-val">${d.total_assignments}</div>
                    <div class="sdcon-stat-label">Assignments</div>
                </div>
                <div class="sdcon-stat c-purple">
                    <div class="sdcon-stat-val">${d.total_resources}</div>
                    <div class="sdcon-stat-label">Resources</div>
                </div>
            </div>

            <!-- TOOLBAR -->
            <div class="sdcon-toolbar">
                <div class="sdcon-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input class="sdcon-search" type="text" placeholder="Search content…"
                        value="${window._sdConSearch}"
                        oninput="sdconSearch(this.value)">
                </div>

                <select class="sdcon-select" onchange="sdconFilter('type', this.value)">
                    <option value="">All Types</option>
                    <option value="quiz"       ${f.type==='quiz'?'selected':''}>Quizzes</option>
                    <option value="summative"  ${f.type==='summative'?'selected':''}>Summative Only</option>
                    <option value="assignment" ${f.type==='assignment'?'selected':''}>Assignments</option>
                    <option value="resource"   ${f.type==='resource'?'selected':''}>Resources</option>
                </select>

                <select class="sdcon-select" onchange="sdconFilter('class_id', this.value)">
                    <option value="0">All Classes</option>
                    ${classOptions}
                </select>

                <select class="sdcon-select" onchange="sdconFilter('term', this.value)">
                    <option value="0">All Terms</option>
                    <option value="1" ${f.term==1?'selected':''}>Term 1</option>
                    <option value="2" ${f.term==2?'selected':''}>Term 2</option>
                    <option value="3" ${f.term==3?'selected':''}>Term 3</option>
                    <option value="4" ${f.term==4?'selected':''}>Term 4</option>
                </select>

                <select class="sdcon-select" onchange="sdconFilter('teacher_email', this.value)">
                    <option value="">All Teachers</option>
                    ${teacherOptions}
                </select>

                <span class="sdcon-count">${all.length} item${all.length!==1?'s':''}</span>
            </div>

            <!-- TABLE -->
            <div class="sdcon-table-wrap">
                <table class="sdcon-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Teacher</th>
                            <th>Class</th>
                            <th>Date</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// ══════════════════════════════════════════════════════════
// EVALUATIONS TAB
// ══════════════════════════════════════════════════════════
function renderEvaluationsTab() {
    const content = document.getElementById('sd-content');
    const d = window._sdEvalCache;
    const f = window._sdEvalFilters;
    const search = window._sdEvalSearch.toLowerCase().trim();

    let list = d.evaluations || [];
    if (f.class_id)      list = list.filter(e => e.class_id == f.class_id);
    if (f.term)          list = list.filter(e => e.term == f.term);
    if (f.teacher_email) list = list.filter(e => e.teacher_email === f.teacher_email);
    if (search)          list = list.filter(e =>
        e.title.toLowerCase().includes(search) ||
        e.teacher_name.toLowerCase().includes(search) ||
        e.class_name.toLowerCase().includes(search)
    );

    const classOptions   = (d.classes||[]).map(c =>
        `<option value="${c.id}" ${f.class_id==c.id?'selected':''}>${c.name}</option>`).join('');
    const teacherOptions = (d.teachers||[]).map(t =>
        `<option value="${t.email}" ${f.teacher_email===t.email?'selected':''}>${t.name}</option>`).join('');

    const cards = list.length ? list.map(ev => {
        const isOpen  = window._sdEvalOpen === ev.id;
        const col     = sdevalScoreColor(ev.overall_score);
        const scoreDisplay = ev.overall_score !== null
            ? `<div class="sdeval-score-num ${col}">${ev.overall_score}</div><div class="sdeval-score-label">/5</div>`
            : `<div class="sdeval-score-num gray">—</div><div class="sdeval-score-label">no data</div>`;

        // Answer options config — matches teacher side
        const answerOptions = [
            { key: 'strongly_agree',    label: 'Strongly Agree',    color: '#22c55e' },
            { key: 'agree',             label: 'Agree',             color: '#4fd1c5' },
            { key: 'neutral',           label: 'Neutral',           color: '#f59e0b' },
            { key: 'disagree',          label: 'Disagree',          color: '#f85149' },
            { key: 'strongly_disagree', label: 'Strongly Disagree', color: '#991b1b' },
        ];

        // Statements with percentage breakdown bars
        const stmtRows = ev.statements.length ? ev.statements.map(st => {
            // Build breakdown from avg_score + count
            // API gives us avg_score and count — we approximate breakdown
            // For actual breakdown we need counts per answer, but avg_score gives us the story
            const sc = sdevalScoreColor(st.avg_score);
            const scoreLabel = st.avg_score !== null
                ? `<span style="font-size:12px;font-weight:900;color:${sc==='green'?'#22c55e':sc==='orange'?'#f59e0b':'#f85149'};">${st.avg_score}/5</span>`
                : '—';

            // Build percentage bars using breakdown if available, else show avg bar
            let barsHTML = '';
            if (st.breakdown && st.breakdown.length) {
                barsHTML = st.breakdown.map(b => `
                    <div style="margin-bottom:6px;">
                        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#4a5568;margin-bottom:3px;">
                            <span>${b.label}</span>
                            <span style="color:${b.color};">${b.count} (${b.percentage}%)</span>
                        </div>
                        <div style="height:7px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${b.percentage}%;background:${b.color};border-radius:4px;transition:width 0.6s ease;"></div>
                        </div>
                    </div>`).join('');
            } else {
                // Fallback: single bar showing avg as percentage of 5
                const pct = st.avg_score !== null ? Math.round((st.avg_score / 5) * 100) : 0;
                const barColor = sc==='green'?'#22c55e':sc==='orange'?'#f59e0b':'#f85149';
                barsHTML = `
                    <div style="margin-bottom:6px;">
                        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#4a5568;margin-bottom:3px;">
                            <span>Average score</span>
                            <span style="color:${barColor};">${st.avg_score ?? '—'}/5</span>
                        </div>
                        <div style="height:7px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s ease;"></div>
                        </div>
                    </div>`;
            }

            return `
                <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:12px;">
                        <div style="font-size:13px;font-weight:700;color:#c9d1d9;flex:1;">${st.statement}</div>
                        ${scoreLabel}
                    </div>
                    ${barsHTML}
                </div>`;
        }).join('') : `<div class="sdeval-no-responses">No responses yet</div>`;

        // Comments
        const commentBlocks = ev.comments.length ? `
            <div class="sdeval-comments-title">Anonymous Comments (${ev.comments.length})</div>
            ${ev.comments.map(c => `
                <div class="sdeval-comment">
                    <div class="sdeval-comment-text">"${c.text}"</div>
                    <div class="sdeval-comment-date">${new Date(c.submitted_at).toLocaleDateString('en-ZA', {day:'numeric',month:'long',year:'numeric'})}</div>
                </div>`).join('')}` : '';

        return `
            <div class="sdeval-card${isOpen?' open':''}" id="sdeval-card-${ev.id}">
                <div class="sdeval-header" onclick="sdevalToggle(${ev.id})">
                    <div class="sdeval-score-circle ${col}">${scoreDisplay}</div>
                    <div class="sdeval-main">
                        <div class="sdeval-title">${ev.title}</div>
                        <div class="sdeval-meta">
                            <span class="sdeval-meta-text">${ev.teacher_name}</span>
                            <span class="sdeval-badge class">${ev.class_name}</span>
                            <span class="sdeval-badge term">Term ${ev.term}</span>
                            <span class="sdeval-badge ${ev.is_active?'active':'closed'}">${ev.is_active?'Active':'Closed'}</span>
                        </div>
                    </div>
                    <div class="sdeval-resp-count">${ev.response_count} response${ev.response_count!==1?'s':''}</div>
                    <div class="sdeval-chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                </div>
                <div class="sdeval-body">
                    ${ev.response_count > 0 ? `
                        <div class="sdeval-statements">${stmtRows}</div>
                        ${commentBlocks}
                    ` : `<div class="sdeval-no-responses">No learners have responded to this evaluation yet.</div>`}
                </div>
            </div>`;
    }).join('') : `<div class="sdcon-empty">No evaluations found${search?' matching "'+search+'"':''}.</div>`;

    content.innerHTML = `
        <div class="sdcon-shell">

            <!-- TABS -->
            <div class="sdcon-tabs">
                <button class="sdcon-tab" onclick="sdconSwitchTab('content')">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    Content
                </button>
                <button class="sdcon-tab active" onclick="sdconSwitchTab('evaluations')">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Evaluations
                </button>
            </div>

            <!-- STATS -->
            <div class="sdcon-stats">
                <div class="sdcon-stat c-teal">
                    <div class="sdcon-stat-val">${d.total_evals}</div>
                    <div class="sdcon-stat-label">Total Evaluations</div>
                </div>
                <div class="sdcon-stat c-blue">
                    <div class="sdcon-stat-val">${d.total_responses}</div>
                    <div class="sdcon-stat-label">Responses</div>
                </div>
                <div class="sdcon-stat c-green">
                    <div class="sdcon-stat-val">${d.school_eval_avg !== null ? d.school_eval_avg + '/5' : '—'}</div>
                    <div class="sdcon-stat-label">School Avg Score</div>
                </div>
            </div>

            <!-- TOOLBAR -->
            <div class="sdcon-toolbar">
                <div class="sdcon-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input class="sdcon-search" type="text" placeholder="Search evaluations…"
                        value="${window._sdEvalSearch}"
                        oninput="sdevalSearch(this.value)">
                </div>

                <select class="sdcon-select" onchange="sdevalFilter('class_id', this.value)">
                    <option value="0">All Classes</option>
                    ${classOptions}
                </select>

                <select class="sdcon-select" onchange="sdevalFilter('term', this.value)">
                    <option value="0">All Terms</option>
                    <option value="1" ${f.term==1?'selected':''}>Term 1</option>
                    <option value="2" ${f.term==2?'selected':''}>Term 2</option>
                    <option value="3" ${f.term==3?'selected':''}>Term 3</option>
                    <option value="4" ${f.term==4?'selected':''}>Term 4</option>
                </select>

                <select class="sdcon-select" onchange="sdevalFilter('teacher_email', this.value)">
                    <option value="">All Teachers</option>
                    ${teacherOptions}
                </select>

                <span class="sdcon-count">${list.length} evaluation${list.length!==1?'s':''}</span>
            </div>

            <!-- EVALUATION CARDS -->
            <div class="sdeval-list">${cards}</div>

        </div>`;
}

// ── Filters & search ──
window.sdconFilter  = function(k,v) { window._sdConFilters[k] = (k==='class_id'||k==='term') ? parseInt(v) : v; renderContentTab(); };
window.sdconSearch  = function(v)   { window._sdConSearch = v; renderContentTab(); };
window.sdevalFilter = function(k,v) { window._sdEvalFilters[k] = (k==='class_id'||k==='term') ? parseInt(v) : v; renderEvaluationsTab(); };
window.sdevalSearch = function(v)   { window._sdEvalSearch = v; renderEvaluationsTab(); };

// ── Evaluation card toggle (direct DOM) ──
window.sdevalToggle = function(id) {
    const card = document.getElementById('sdeval-card-' + id);
    if (!card) return;
    const isOpen = card.classList.contains('open');
    document.querySelectorAll('.sdeval-card.open').forEach(c => c.classList.remove('open'));
    if (!isOpen) card.classList.add('open');
};


// ══════════════════════════════════════════════════════════
// VIEW CONTENT MODAL
// ══════════════════════════════════════════════════════════

// Inject modal styles
(function injectModalStyles() {
    if (document.getElementById('sdcon-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'sdcon-modal-styles';
    s.textContent = `
        .sdcon-modal-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(6px);
            z-index: 9000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .sdcon-modal-box {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            width: 100%; max-width: 700px;
            max-height: 85vh;
            display: flex; flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        }
        .sdcon-modal-header {
            display: flex; align-items: center;
            justify-content: space-between;
            padding: 18px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            flex-shrink: 0;
        }
        .sdcon-modal-title {
            font-size: 16px; font-weight: 900; color: #e2e8f0;
        }
        .sdcon-modal-close {
            width: 32px; height: 32px;
            border-radius: 50%; border: none;
            background: rgba(255,255,255,0.06);
            color: #8b949e; cursor: pointer;
            font-size: 18px; line-height: 1;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.2s;
        }
        .sdcon-modal-close:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
        .sdcon-modal-body {
            flex: 1; overflow-y: auto; padding: 20px 24px;
        }
        .sdcon-modal-body::-webkit-scrollbar { width: 4px; }
        .sdcon-modal-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* Meta row */
        .sdcon-modal-meta {
            display: flex; flex-wrap: wrap; gap: 8px;
            margin-bottom: 20px;
        }
        .sdcon-modal-tag {
            font-size: 11px; font-weight: 800;
            padding: 3px 10px; border-radius: 8px;
        }
        .sdcon-modal-tag.teal   { background: rgba(79,209,197,0.1);  color: #4fd1c5; }
        .sdcon-modal-tag.purple { background: rgba(167,139,250,0.1); color: #a78bfa; }
        .sdcon-modal-tag.green  { background: rgba(34,197,94,0.1);   color: #22c55e; }
        .sdcon-modal-tag.orange { background: rgba(245,158,11,0.1);  color: #f59e0b; }
        .sdcon-modal-tag.blue   { background: rgba(78,121,167,0.1);  color: #4e79a7; }
        .sdcon-modal-tag.red    { background: rgba(248,81,73,0.1);   color: #f85149; }
        .sdcon-modal-tag.gray   { background: rgba(255,255,255,0.06); color: #8b949e; }

        /* Stats row */
        .sdcon-modal-stats {
            display: flex; gap: 10px; flex-wrap: wrap;
            padding: 14px 16px;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .sdcon-modal-stat { text-align: center; flex: 1; min-width: 60px; }
        .sdcon-modal-stat-val   { font-size: 18px; font-weight: 900; color: #4fd1c5; }
        .sdcon-modal-stat-label { font-size: 10px; color: #4a5568; font-weight: 700; margin-top: 2px; }

        /* Manual quiz notice */
        .sdcon-manual-notice {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 16px; border-radius: 10px;
            background: rgba(245,158,11,0.06);
            border: 1px solid rgba(245,158,11,0.2);
            margin-bottom: 16px;
        }
        .sdcon-manual-notice svg { width: 18px; height: 18px; stroke: #f59e0b; flex-shrink: 0; margin-top: 1px; }
        .sdcon-manual-notice-text { font-size: 13px; color: #c9d1d9; line-height: 1.6; }
        .sdcon-manual-notice-text strong { color: #f59e0b; }

        /* Question cards */
        .sdcon-question {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .sdcon-question-num {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1px; text-transform: uppercase;
            color: #4a5568; margin-bottom: 8px;
        }
        .sdcon-question-text {
            font-size: 14px; font-weight: 700; color: #e2e8f0;
            margin-bottom: 12px; line-height: 1.5;
        }
        .sdcon-question-points {
            font-size: 11px; font-weight: 800; color: #a78bfa;
            margin-bottom: 10px;
        }
        .sdcon-choice {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 12px; border-radius: 7px;
            margin-bottom: 6px; font-size: 13px; font-weight: 600;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .sdcon-choice.correct {
            background: rgba(34,197,94,0.08);
            border-color: rgba(34,197,94,0.25);
            color: #22c55e;
        }
        .sdcon-choice.wrong { color: #8b949e; }
        .sdcon-choice-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .sdcon-choice.correct .sdcon-choice-dot { background: #22c55e; }
        .sdcon-choice.wrong   .sdcon-choice-dot { background: rgba(255,255,255,0.1); }

        /* Assignment description */
        .sdcon-desc {
            font-size: 14px; font-weight: 600; color: #c9d1d9;
            line-height: 1.7; margin-bottom: 16px;
            white-space: pre-wrap;
        }
        .sdcon-file-link {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 18px; border-radius: 8px;
            background: rgba(79,209,197,0.1);
            border: 1px solid rgba(79,209,197,0.25);
            color: #4fd1c5; text-decoration: none;
            font-size: 13px; font-weight: 800;
            transition: background 0.2s;
        }
        .sdcon-file-link:hover { background: rgba(79,209,197,0.18); }
        .sdcon-file-link svg { width: 15px; height: 15px; stroke: currentColor; }

        /* Loading */
        .sdcon-modal-loading {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 60px 20px; gap: 14px; color: #4a5568;
        }
        .sdcon-modal-spinner {
            width: 32px; height: 32px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #4fd1c5;
            border-radius: 50%;
            animation: sd-spin 0.8s linear infinite;
        }
    `;
    document.head.appendChild(s);
})();

window.sdconViewItem = async function(type, id) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sdcon-modal-overlay';
    overlay.id = 'sdcon-view-modal';
    overlay.onclick = function(e) {
        if (e.target === overlay) sdconCloseModal();
    };
    overlay.innerHTML = `
        <div class="sdcon-modal-box">
            <div class="sdcon-modal-header">
                <div class="sdcon-modal-title">Loading...</div>
                <button class="sdcon-modal-close" onclick="sdconCloseModal()">×</button>
            </div>
            <div class="sdcon-modal-body">
                <div class="sdcon-modal-loading">
                    <div class="sdcon-modal-spinner"></div>
                    Loading content...
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    try {
        const res  = await fetch(`api/school/view_content.php?type=${type}&id=${id}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        sdconRenderModal(data);
    } catch(e) {
        document.querySelector('#sdcon-view-modal .sdcon-modal-body').innerHTML =
            `<p style="color:var(--red);text-align:center;padding:40px;">Failed to load: ${e.message}</p>`;
    }
};

window.sdconCloseModal = function() {
    const modal = document.getElementById('sdcon-view-modal');
    if (modal) modal.remove();
};

function sdconRenderModal(d) {
    const box   = document.querySelector('#sdcon-view-modal .sdcon-modal-box');
    const avgC  = v => v === null ? 'gray' : v >= 60 ? 'green' : v >= 40 ? 'orange' : 'red';

    if (d.type === 'quiz') {
        const statusColor = d.status === 'Open' ? 'green' : d.status === 'Closed' ? 'gray' : 'orange';
        const summBadge   = d.is_summative
            ? `<span class="sdcon-modal-tag green">Summative${d.weight ? ' · ' + d.weight + '%' : ''}</span>`
            : `<span class="sdcon-modal-tag gray">Practice Quiz</span>`;

        let bodyHTML = `
            <div class="sdcon-modal-meta">
                <span class="sdcon-modal-tag teal">${d.teacher_name}</span>
                <span class="sdcon-modal-tag blue">${d.class_name}</span>
                <span class="sdcon-modal-tag purple">Term ${d.term}</span>
                ${summBadge}
                <span class="sdcon-modal-tag ${statusColor}">${d.status}</span>
                ${d.duration ? `<span class="sdcon-modal-tag gray">${d.duration} min</span>` : ''}
            </div>

            <div class="sdcon-modal-stats">
                <div class="sdcon-modal-stat">
                    <div class="sdcon-modal-stat-val">${d.question_count}</div>
                    <div class="sdcon-modal-stat-label">Questions</div>
                </div>
                <div class="sdcon-modal-stat">
                    <div class="sdcon-modal-stat-val">${d.total_points}</div>
                    <div class="sdcon-modal-stat-label">Total Points</div>
                </div>
                <div class="sdcon-modal-stat">
                    <div class="sdcon-modal-stat-val">${d.stats.submitted}</div>
                    <div class="sdcon-modal-stat-label">Submitted</div>
                </div>
                <div class="sdcon-modal-stat">
                    <div class="sdcon-modal-stat-val" style="color:${d.stats.avg_pct >= 60 ? '#22c55e' : d.stats.avg_pct >= 40 ? '#f59e0b' : '#f85149'};">
                        ${d.stats.avg_pct !== null ? d.stats.avg_pct + '%' : '—'}
                    </div>
                    <div class="sdcon-modal-stat-label">Avg Score</div>
                </div>
            </div>`;

        if (d.is_manual) {
            bodyHTML += `
                <div class="sdcon-manual-notice">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div class="sdcon-manual-notice-text">
                        <strong>Manual Assessment</strong> — Marks were loaded directly into the system without digital questions.
                        The content of this assessment is not available on the platform.
                        <br><br>
                        In a future update, teachers will be able to upload a PDF of manually written tests.
                    </div>
                </div>`;
        } else {
            bodyHTML += d.questions.map((q, qi) => {
                const choicesHTML = q.choices.map(c => `
                    <div class="sdcon-choice ${c.is_correct ? 'correct' : 'wrong'}">
                        <div class="sdcon-choice-dot"></div>
                        ${c.text}
                        ${c.is_correct ? ' <span style="font-size:10px;margin-left:auto;font-weight:800;">✓ Correct</span>' : ''}
                    </div>`).join('');

                return `
                    <div class="sdcon-question">
                        <div class="sdcon-question-num">Question ${qi + 1}</div>
                        <div class="sdcon-question-text">${q.question_text}</div>
                        <div class="sdcon-question-points">${q.points} point${q.points !== 1 ? 's' : ''}</div>
                        ${choicesHTML || '<div style="font-size:12px;color:#4a5568;font-style:italic;">No choices recorded</div>'}
                    </div>`;
            }).join('');
        }

        box.innerHTML = `
            <div class="sdcon-modal-header">
                <div class="sdcon-modal-title">${d.title}</div>
                <button class="sdcon-modal-close" onclick="sdconCloseModal()">×</button>
            </div>
            <div class="sdcon-modal-body">${bodyHTML}</div>`;

    } else if (d.type === 'assignment') {
        const fileSection = d.file_url
            ? `<a href="${d.file_url}" target="_blank" class="sdcon-file-link">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Assignment File
              </a>`
            : `<div style="font-size:13px;color:#4a5568;font-style:italic;">No file attached</div>`;

        const dueDate = d.due_date
            ? new Date(d.due_date).toLocaleDateString('en-ZA', {weekday:'long', day:'numeric', month:'long', year:'numeric'})
            : 'No due date';

        box.innerHTML = `
            <div class="sdcon-modal-header">
                <div class="sdcon-modal-title">${d.title}</div>
                <button class="sdcon-modal-close" onclick="sdconCloseModal()">×</button>
            </div>
            <div class="sdcon-modal-body">
                <div class="sdcon-modal-meta">
                    <span class="sdcon-modal-tag teal">${d.teacher_name}</span>
                    <span class="sdcon-modal-tag blue">${d.class_name}</span>
                    <span class="sdcon-modal-tag purple">Term ${d.term}</span>
                    <span class="sdcon-modal-tag gray">Due: ${dueDate}</span>
                    <span class="sdcon-modal-tag ${d.allow_late ? 'green' : 'gray'}">${d.allow_late ? 'Late allowed' : 'No late submissions'}</span>
                </div>
                <div class="sdcon-modal-stats">
                    <div class="sdcon-modal-stat">
                        <div class="sdcon-modal-stat-val">${d.submissions}</div>
                        <div class="sdcon-modal-stat-label">Submissions</div>
                    </div>
                </div>
                ${d.description ? `<div class="sdcon-desc">${d.description}</div>` : ''}
                ${fileSection}
            </div>`;

    } else if (d.type === 'resource') {
        const ext = d.file_type.toUpperCase();
        const isViewable = ['PDF','JPG','JPEG','PNG','GIF','WEBP'].includes(d.file_type.toUpperCase());

        box.innerHTML = `
            <div class="sdcon-modal-header">
                <div class="sdcon-modal-title">${d.title}</div>
                <button class="sdcon-modal-close" onclick="sdconCloseModal()">×</button>
            </div>
            <div class="sdcon-modal-body">
                <div class="sdcon-modal-meta">
                    <span class="sdcon-modal-tag teal">${d.teacher_name}</span>
                    <span class="sdcon-modal-tag blue">${d.class_name}</span>
                    <span class="sdcon-modal-tag purple">Term ${d.term}</span>
                    <span class="sdcon-modal-tag gray">${ext} file</span>
                </div>
                <a href="${d.filename}" target="_blank" class="sdcon-file-link">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Open Resource File
                </a>
            </div>`;
    }
}