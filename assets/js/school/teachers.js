// ══════════════════════════════════════════════════════════
// TEACHERS SECTION — assets/js/school/teachers.js
// ══════════════════════════════════════════════════════════

window._sdTeachersCache = null;
window._sdTeacherProfileCache = {};

// ── INJECT STYLES ──
(function injectTeacherStyles() {
    if (document.getElementById('sd-teacher-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-teacher-styles';
    s.textContent = `

        /* ── TOOLBAR ── */
        .sdt-toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 16px 24px 0;
            flex-wrap: wrap;
        }

        .sdt-search-wrap {
            position: relative;
            flex: 1;
            min-width: 200px;
            max-width: 320px;
        }
        .sdt-search-wrap svg {
            position: absolute;
            left: 10px; top: 50%;
            transform: translateY(-50%);
            width: 14px; height: 14px;
            stroke: var(--text-dim);
            pointer-events: none;
        }
        .sdt-search {
            width: 100%;
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 6px 10px 6px 32px;
            font-family: var(--font);
            font-size: 13px;
            font-weight: 400;
            color: var(--text);
            outline: none;
            transition: border-color 0.15s;
        }
        .sdt-search::placeholder { color: var(--text-dim); }
        .sdt-search:focus         { border-color: var(--border-hover); }

        .sdt-count-badge {
            font-size: 11px;
            font-weight: 500;
            padding: 3px 10px;
            border-radius: 20px;
            background: var(--surface2);
            border: 1px solid var(--border);
            color: var(--text-muted);
            white-space: nowrap;
            font-family: var(--font-mono);
        }

        /* ── TABLE ── */
        .sdt-table-wrap {
            padding: 12px 24px 60px;
            overflow-x: auto;
        }

        .sdt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .sdt-table th {
            padding: 8px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: var(--text-dim);
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            cursor: pointer;
            user-select: none;
            font-family: var(--font);
        }
        .sdt-table th:hover  { color: var(--text-muted); }
        .sdt-table th.sorted { color: var(--teal); }
        .sdt-sort-arrow      { margin-left: 4px; opacity: 0.6; }

        .sdt-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            vertical-align: middle;
        }
        .sdt-table tr:last-child td { border-bottom: none; }
        .sdt-table tbody tr {
            cursor: pointer;
            transition: background 0.15s;
        }
        .sdt-table tbody tr:hover td { background: var(--surface2); }

        /* Avatar cell */
        .sdt-avatar-cell { display: flex; align-items: center; gap: 10px; }
        .sdt-avatar-sm {
            width: 28px; height: 28px;
            border-radius: 50%;
            background: var(--surface2);
            border: 1px solid var(--border-hover);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            flex-shrink: 0;
            overflow: hidden;
            font-family: var(--font-mono);
        }
        .sdt-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .sdt-name-primary  { font-weight: 500; color: var(--text); font-size: 13px; }
        .sdt-name-email    { font-size: 11px; color: var(--text-dim); margin-top: 1px; font-family: var(--font-mono); }

        /* Content stat chips */
        .sdt-stat-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .sdt-chip {
            font-size: 11px;
            font-weight: 500;
            padding: 2px 7px;
            border-radius: 20px;
            font-family: var(--font-mono);
        }
        .sdt-chip.quiz { background: var(--teal-dim);   color: var(--teal);   }
        .sdt-chip.asgn { background: var(--blue-dim);   color: var(--blue);   }
        .sdt-chip.res  { background: var(--purple-dim); color: var(--purple); }
        .sdt-chip.ann  { background: var(--orange-dim); color: var(--orange); }

        /* Classes tags */
        .sdt-classes-cell {
            font-size: 12px;
            color: var(--text-muted);
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Avg badge */
        .sdt-avg-badge {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 20px;
            white-space: nowrap;
            font-family: var(--font-mono);
        }
        .sdt-avg-badge.green  { background: var(--green-dim);  color: var(--green);  }
        .sdt-avg-badge.orange { background: var(--orange-dim); color: var(--orange); }
        .sdt-avg-badge.red    { background: var(--red-dim);    color: var(--red);    }
        .sdt-avg-badge.gray   { background: var(--surface2);   color: var(--text-dim); }

        /* Last active */
        .sdt-last-active {
            font-size: 11px;
            color: var(--text-dim);
            font-family: var(--font-mono);
        }

        /* Total score */
        .sdt-total {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            font-family: var(--font-mono);
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 2px 8px;
            display: inline-block;
        }

        /* Row arrow */
        .sdt-row-arrow { color: var(--border-hover); transition: color 0.15s; }
        .sdt-table tbody tr:hover .sdt-row-arrow { color: var(--teal); }

        /* Empty state */
        .sdt-empty {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-dim);
            font-size: 13px;
        }

        /* ══ PROFILE VIEW ══ */
        .sdt-profile-shell { padding: 24px; max-width: 1100px; }

        .sdt-back-btn {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: 13px; font-weight: 500; color: var(--text-muted);
            cursor: pointer; margin-bottom: 20px;
            background: none; border: none;
            font-family: var(--font); padding: 0;
            transition: color 0.15s;
        }
        .sdt-back-btn:hover { color: var(--text); }
        .sdt-back-btn svg   { width: 14px; height: 14px; stroke: currentColor; }

        /* Hero card */
        .sdt-hero {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
            transition: border-color 0.15s;
        }
        .sdt-hero:hover { border-color: var(--border-hover); }

        .sdt-hero-avatar {
            width: 56px; height: 56px;
            border-radius: 50%;
            background: var(--surface2);
            border: 1px solid var(--border-hover);
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            flex-shrink: 0;
            overflow: hidden;
            font-family: var(--font-mono);
        }
        .sdt-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .sdt-hero-info  { flex: 1; min-width: 0; }
        .sdt-hero-name  { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
        .sdt-hero-email { font-size: 12px; color: var(--text-dim); margin-bottom: 10px; font-family: var(--font-mono); }
        .sdt-hero-tags  { display: flex; gap: 6px; flex-wrap: wrap; }
        .sdt-hero-tag {
            font-size: 11px;
            font-weight: 500;
            padding: 2px 8px;
            border-radius: 20px;
            letter-spacing: 0.3px;
        }
        .sdt-hero-tag.teal   { background: var(--teal-dim);   border: 1px solid var(--teal-border);          color: var(--teal);   }
        .sdt-hero-tag.gray   { background: var(--surface2);   border: 1px solid var(--border-hover);          color: var(--text-muted); }
        .sdt-hero-tag.green  { background: var(--green-dim);  border: 1px solid rgba(63,185,80,0.25);         color: var(--green);  }
        .sdt-hero-tag.orange { background: var(--orange-dim); border: 1px solid rgba(210,153,34,0.25);        color: var(--orange); }
        .sdt-hero-tag.red    { background: var(--red-dim);    border: 1px solid rgba(248,81,73,0.25);         color: var(--red);    }

        .sdt-hero-avg       { text-align: right; flex-shrink: 0; }
        .sdt-hero-avg-val   {
            font-size: 28px; font-weight: 600; line-height: 1;
            margin-bottom: 3px; font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sdt-hero-avg-val.green  { color: var(--green);  }
        .sdt-hero-avg-val.orange { color: var(--orange); }
        .sdt-hero-avg-val.red    { color: var(--red);    }
        .sdt-hero-avg-val.gray   { color: var(--text-dim); }
        .sdt-hero-avg-label {
            font-size: 10px; color: var(--text-dim);
            font-weight: 600; letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        /* Content KPI row */
        .sdt-kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }
        .sdt-kpi-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 14px 16px;
            text-align: center;
            transition: border-color 0.15s;
        }
        .sdt-kpi-card:hover { border-color: var(--border-hover); }
        .sdt-kpi-num {
            font-size: 22px; font-weight: 600; line-height: 1;
            margin-bottom: 5px; font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sdt-kpi-label {
            font-size: 10px; font-weight: 600;
            letter-spacing: 0.5px; text-transform: uppercase;
            color: var(--text-dim);
        }
        .sdt-kpi-card.c-teal   .sdt-kpi-num { color: var(--teal);   }
        .sdt-kpi-card.c-blue   .sdt-kpi-num { color: var(--blue);   }
        .sdt-kpi-card.c-purple .sdt-kpi-num { color: var(--purple); }
        .sdt-kpi-card.c-orange .sdt-kpi-num { color: var(--orange); }

        /* vs school avg comparison bar */
        .sdt-compare-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 16px;
            margin-bottom: 16px;
            transition: border-color 0.15s;
        }
        .sdt-compare-card:hover { border-color: var(--border-hover); }
        .sdt-compare-label {
            font-size: 11px; font-weight: 600;
            letter-spacing: 0.5px; text-transform: uppercase;
            color: var(--text-muted); margin-bottom: 14px;
        }
        .sdt-compare-row {
            display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
        }
        .sdt-compare-name {
            font-size: 12px; font-weight: 500;
            color: var(--text-muted); width: 90px; flex-shrink: 0;
        }
        .sdt-compare-bar-wrap {
            flex: 1; height: 6px;
            background: var(--surface2);
            border-radius: 4px; overflow: hidden;
        }
        .sdt-compare-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .sdt-compare-val {
            font-size: 12px; font-weight: 600;
            width: 40px; text-align: right; flex-shrink: 0;
            font-family: var(--font-mono);
        }

        /* Subject class blocks */
        .sdt-class-block {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            margin-bottom: 12px;
            overflow: hidden;
            transition: border-color 0.15s;
        }
        .sdt-class-block:hover { border-color: var(--border-hover); }

        .sdt-class-block-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background 0.15s;
        }
        .sdt-class-block-header:hover { background: var(--surface2); }

        .sdt-class-block-title { font-size: 14px; font-weight: 600; color: var(--text); }
        .sdt-class-block-sub {
            font-size: 11px; color: var(--teal);
            margin-left: 8px; font-weight: 500;
            font-family: var(--font-mono);
        }

        .sdt-class-block-body { padding: 14px 16px; }

        /* Top/Bottom learner rows */
        .sdt-perf-section { margin-bottom: 12px; }
        .sdt-perf-title {
            font-size: 10px; font-weight: 600;
            letter-spacing: 0.6px; text-transform: uppercase;
            color: var(--text-dim); margin-bottom: 6px;
        }
        .sdt-perf-row {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
        }
        .sdt-perf-row:last-child { border-bottom: none; }
        .sdt-perf-rank { font-size: 11px; font-weight: 500; color: var(--text-dim); width: 18px; font-family: var(--font-mono); }
        .sdt-perf-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-muted); }
        .sdt-perf-avg  { font-size: 12px; font-weight: 600; font-family: var(--font-mono); }
        .sdt-perf-avg.green  { color: var(--green);  }
        .sdt-perf-avg.orange { color: var(--orange); }
        .sdt-perf-avg.red    { color: var(--red);    }
        .sdt-perf-avg.gray   { color: var(--text-dim); }

        .sdt-no-perf { font-size: 12px; color: var(--text-dim); padding: 4px 0; }

        /* Stats row inside class block */
        .sdt-class-stats-row {
            display: flex; gap: 20px; margin-bottom: 14px; flex-wrap: wrap;
        }
        .sdt-class-stat-item { font-size: 12px; color: var(--text-muted); }
        .sdt-class-stat-item strong { color: var(--text); font-weight: 600; font-family: var(--font-mono); }

        /* No assessments state */
        .sdt-no-classes {
            text-align: center; padding: 40px 20px;
            color: var(--text-dim); font-size: 13px;
        }

        @media (max-width: 900px) {
            .sdt-kpi-row        { grid-template-columns: repeat(2, 1fr); }
            .sdt-toolbar        { padding: 14px 14px 0; }
            .sdt-table-wrap     { padding: 10px 14px 60px; }
            .sdt-profile-shell  { padding: 14px; }
            .sdt-hero           { flex-direction: column; text-align: center; }
            .sdt-hero-avg       { text-align: center; }
            .sdt-hero-tags      { justify-content: center; }
        }
    `;
    document.head.appendChild(s);
})();

// ── COLOR HELPER ──
function sdtAvgColor(v) {
    if (v === null || v === undefined) return 'gray';
    if (v >= 60) return 'green';
    if (v >= 40) return 'orange';
    return 'red';
}

function sdtTimeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)      return diff + 's ago';
    if (diff < 3600)    return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)   return Math.floor(diff/3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff/86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-ZA', { day:'numeric', month:'short' });
}

// ══════════════════════════════════════════════════════════
// LOAD TEACHERS TABLE
// ══════════════════════════════════════════════════════════
window.loadSdTeachers = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdTeachersCache) {
        renderTeachersTable(window._sdTeachersCache, '');
        return;
    }

    // Skeleton
    content.innerHTML = `
        <div class="sdt-toolbar">
            <div class="sd-skeleton" style="height:30px;width:280px;border-radius:var(--radius);"></div>
            <div class="sd-skeleton" style="height:24px;width:80px;border-radius:20px;"></div>
        </div>
        <div class="sdt-table-wrap">
            <div class="sd-skeleton" style="height:36px;border-radius:var(--radius);margin-bottom:4px;"></div>
            ${[1,2,3,4,5].map(() => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                    <div class="sd-skeleton" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div class="sd-skeleton" style="height:13px;width:140px;margin-bottom:5px;"></div>
                        <div class="sd-skeleton" style="height:11px;width:180px;"></div>
                    </div>
                    <div class="sd-skeleton" style="height:20px;width:120px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:20px;width:60px;border-radius:20px;"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_teachers.php');
        const data = await res.json();
        window._sdTeachersCache = data;
        renderTeachersTable(data, '');
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load teachers.</p>`;
    }
};

// ── Store search state so we can re-render after sort ──
let _sdtCurrentSearch = '';
let _sdtSortCol       = 'total';
let _sdtSortDir       = -1;

function renderTeachersTable(data, search) {
    const content = document.getElementById('sd-content');
    let teachers  = data.teachers || [];

    const q = (search || '').toLowerCase().trim();
    if (q) {
        teachers = teachers.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.email.toLowerCase().includes(q) ||
            (t.classes || '').toLowerCase().includes(q)
        );
    }

    teachers = [...teachers].sort((a, b) => {
        let av = a[_sdtSortCol], bv = b[_sdtSortCol];
        if (av === null) av = -Infinity;
        if (bv === null) bv = -Infinity;
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        return av < bv ? _sdtSortDir : av > bv ? -_sdtSortDir : 0;
    });

    const sortArrow = (col) => {
        if (_sdtSortCol !== col) return '';
        return `<span class="sdt-sort-arrow">${_sdtSortDir === -1 ? '↓' : '↑'}</span>`;
    };
    const thClass = (col) => _sdtSortCol === col ? 'sorted' : '';

    const rows = teachers.length ? teachers.map(t => {
        const col      = sdtAvgColor(t.avg_pct);
        const initials = ((t.first_name||'')[0]||'') + ((t.surname||'')[0]||'');
        const picHTML  = t.profile_pic && t.profile_pic !== 'default.png'
            ? `<img src="uploads/teachers/${t.profile_pic}" alt="">`
            : initials.toUpperCase();

        return `
            <tr onclick="loadSdTeacherProfile('${t.email.replace(/'/g, "\\'")}')">
                <td>
                    <div class="sdt-avatar-cell">
                        <div class="sdt-avatar-sm">${picHTML}</div>
                        <div>
                            <div class="sdt-name-primary">${t.name}</div>
                            <div class="sdt-name-email">${t.email}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="sdt-stat-chips">
                        <span class="sdt-chip quiz">${t.quizzes}Q</span>
                        <span class="sdt-chip asgn">${t.assignments}A</span>
                        <span class="sdt-chip res">${t.resources}R</span>
                        <span class="sdt-chip ann">${t.announcements}An</span>
                    </div>
                </td>
                <td class="sdt-classes-cell" title="${t.classes || '—'}">${t.classes || '<span style="color:var(--text-dim);">—</span>'}</td>
                <td><span class="sdt-avg-badge ${col}">${t.avg_pct !== null ? t.avg_pct + '%' : '—'}</span></td>
                <td class="sdt-last-active">${sdtTimeAgo(t.last_active)}</td>
                <td><span class="sdt-total">${t.total}</span></td>
                <td class="sdt-row-arrow">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </td>
            </tr>`;
    }).join('') : `<tr><td colspan="7" class="sdt-empty">No teachers found${q ? ' matching "' + q + '"' : ''}.</td></tr>`;

    content.innerHTML = `
        <div style="padding:24px 24px 8px;">
            <div style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:3px;">Teachers</div>
            <div style="font-size:12px;color:var(--text-muted);">Staff registry — click a teacher to view their profile</div>
        </div>
        <div class="sdt-toolbar">
            <div class="sdt-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input class="sdt-search" id="sdtSearch" type="text" placeholder="Search teachers…" value="${search || ''}" oninput="sdtHandleSearch(this.value)">
            </div>
            <span class="sdt-count-badge">${teachers.length} teacher${teachers.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="sdt-table-wrap">
            <table class="sdt-table">
                <thead>
                    <tr>
                        <th class="${thClass('name')}"        onclick="sdtSort('name')">Teacher ${sortArrow('name')}</th>
                        <th>Content</th>
                        <th class="${thClass('classes')}"     onclick="sdtSort('classes')">Classes ${sortArrow('classes')}</th>
                        <th class="${thClass('avg_pct')}"     onclick="sdtSort('avg_pct')">Learner avg ${sortArrow('avg_pct')}</th>
                        <th class="${thClass('last_active')}" onclick="sdtSort('last_active')">Last active ${sortArrow('last_active')}</th>
                        <th class="${thClass('total')}"       onclick="sdtSort('total')">Activity ${sortArrow('total')}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    if (search) {
        const inp = document.getElementById('sdtSearch');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
}

window.sdtHandleSearch = function(val) {
    _sdtCurrentSearch = val;
    if (window._sdTeachersCache) renderTeachersTable(window._sdTeachersCache, val);
};

window.sdtSort = function(col) {
    if (_sdtSortCol === col) {
        _sdtSortDir *= -1;
    } else {
        _sdtSortCol = col;
        _sdtSortDir = col === 'name' ? 1 : -1;
    }
    if (window._sdTeachersCache) renderTeachersTable(window._sdTeachersCache, _sdtCurrentSearch);
};

// ══════════════════════════════════════════════════════════
// TEACHER PROFILE
// ══════════════════════════════════════════════════════════
window.loadSdTeacherProfile = async function(email) {
    const content = document.getElementById('sd-content');

    // Skeleton
    content.innerHTML = `
        <div class="sdt-profile-shell">
            <div class="sd-skeleton" style="height:14px;width:100px;margin-bottom:20px;border-radius:var(--radius);"></div>
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:16px;">
                <div class="sd-skeleton" style="width:56px;height:56px;border-radius:50%;flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div class="sd-skeleton" style="height:18px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:12px;width:160px;margin-bottom:10px;"></div>
                    <div style="display:flex;gap:6px;">
                        <div class="sd-skeleton" style="height:22px;width:70px;border-radius:20px;"></div>
                        <div class="sd-skeleton" style="height:22px;width:60px;border-radius:20px;"></div>
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
                ${[1,2,3,4].map(() => `<div class="sd-skeleton" style="height:72px;border-radius:var(--radius-lg);"></div>`).join('')}
            </div>
            <div class="sd-skeleton" style="height:100px;border-radius:var(--radius-lg);margin-bottom:12px;"></div>
            <div class="sd-skeleton" style="height:160px;border-radius:var(--radius-lg);"></div>
        </div>`;

    if (window._sdTeacherProfileCache[email]) {
        renderTeacherProfile(window._sdTeacherProfileCache[email]);
        return;
    }

    try {
        const res  = await fetch('api/school/get_teacher_profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `email=${encodeURIComponent(email)}`
        });
        const data = await res.json();
        window._sdTeacherProfileCache[email] = data;
        renderTeacherProfile(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load teacher profile.</p>`;
    }
};

function renderTeacherProfile(d) {
    const content  = document.getElementById('sd-content');
    const avgCol   = sdtAvgColor(d.overall_avg);
    const initials = ((d.first_name||'')[0]||'') + ((d.surname||'')[0]||'');
    const picHTML  = d.profile_pic && d.profile_pic !== 'default.png'
        ? `<img src="uploads/teachers/${d.profile_pic}" alt="">`
        : initials.toUpperCase();

    const joined  = d.joined ? new Date(d.joined).toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' }) : '—';
    const tBarW   = d.overall_avg !== null ? Math.round((d.overall_avg / 100) * 100) : 0;
    const sBarW   = d.school_avg  !== null ? Math.round((d.school_avg  / 100) * 100) : 0;
    const tBarCol = d.overall_avg !== null && d.overall_avg >= (d.school_avg || 0) ? 'var(--green)' : 'var(--orange)';

    const compareHTML = (d.overall_avg !== null || d.school_avg !== null) ? `
        <div class="sdt-compare-card">
            <div class="sdt-compare-label">Learner performance vs school average</div>
            <div class="sdt-compare-row">
                <div class="sdt-compare-name">This teacher</div>
                <div class="sdt-compare-bar-wrap">
                    <div class="sdt-compare-bar" style="width:${tBarW}%;background:${tBarCol};"></div>
                </div>
                <div class="sdt-compare-val" style="color:${tBarCol};">${d.overall_avg !== null ? d.overall_avg + '%' : '—'}</div>
            </div>
            <div class="sdt-compare-row">
                <div class="sdt-compare-name">School avg</div>
                <div class="sdt-compare-bar-wrap">
                    <div class="sdt-compare-bar" style="width:${sBarW}%;background:var(--text-dim);"></div>
                </div>
                <div class="sdt-compare-val" style="color:var(--text-muted);">${d.school_avg !== null ? d.school_avg + '%' : '—'}</div>
            </div>
        </div>` : '';

    const classBlocks = d.class_subjects && d.class_subjects.length
        ? d.class_subjects.map((cs, ci) => {
            const cCol = sdtAvgColor(cs.avg_pct);

            const topRows = cs.top_learners.length
                ? cs.top_learners.map((l, li) => `
                    <div class="sdt-perf-row">
                        <div class="sdt-perf-rank">${li + 1}</div>
                        <div class="sdt-perf-name">${l.name}</div>
                        <div class="sdt-perf-avg ${sdtAvgColor(l.avg)}">${l.avg !== null ? l.avg + '%' : '—'}</div>
                    </div>`).join('')
                : `<div class="sdt-no-perf">No results yet</div>`;

            const botRows = cs.bottom_learners.length > 0
                ? cs.bottom_learners.map((l, li) => `
                    <div class="sdt-perf-row">
                        <div class="sdt-perf-rank">${cs.submitted_count - li}</div>
                        <div class="sdt-perf-name">${l.name}</div>
                        <div class="sdt-perf-avg ${sdtAvgColor(l.avg)}">${l.avg !== null ? l.avg + '%' : '—'}</div>
                    </div>`).join('')
                : '';

            const showBottom = cs.bottom_learners.length > 0 && cs.submitted_count > 3;

            return `
                <div class="sdt-class-block">
                    <div class="sdt-class-block-header" onclick="sdtToggleClassBlock(${ci})">
                        <div>
                            <span class="sdt-class-block-title">${cs.subject_name}</span>
                            <span class="sdt-class-block-sub">${cs.class_name}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span class="sdt-avg-badge ${cCol}">${cs.avg_pct !== null ? cs.avg_pct + '%' : '—'}</span>
                            <svg id="sdt-chev-${ci}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-muted)" stroke-width="2.5" style="transition:transform 0.2s;">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div id="sdt-block-${ci}" class="sdt-class-block-body">
                        <div class="sdt-class-stats-row">
                            <div class="sdt-class-stat-item"><strong>${cs.learner_count}</strong> learners enrolled</div>
                            <div class="sdt-class-stat-item"><strong>${cs.submitted_count}</strong> submitted results</div>
                            <div class="sdt-class-stat-item"><strong>${cs.quiz_count}</strong> summative quizzes</div>
                        </div>
                        <div style="display:grid;grid-template-columns:${showBottom ? '1fr 1fr' : '1fr'};gap:20px;">
                            <div>
                                <div class="sdt-perf-title">Top learners</div>
                                ${topRows}
                            </div>
                            ${showBottom ? `
                            <div>
                                <div class="sdt-perf-title">Needs support</div>
                                ${botRows}
                            </div>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('')
        : `<div class="sdt-no-classes">This teacher hasn't posted any summative assessments yet.</div>`;

    content.innerHTML = `
        <div class="sdt-profile-shell">
            <button class="sdt-back-btn" onclick="loadSdTeachers()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                All teachers
            </button>

            <!-- HERO -->
            <div class="sdt-hero">
                <div class="sdt-hero-avatar">${picHTML}</div>
                <div class="sdt-hero-info">
                    <div class="sdt-hero-name">${d.name}</div>
                    <div class="sdt-hero-email">${d.email}</div>
                    <div class="sdt-hero-tags">
                        <span class="sdt-hero-tag teal">Teacher</span>
                        ${d.gender ? `<span class="sdt-hero-tag gray">${d.gender.charAt(0).toUpperCase() + d.gender.slice(1)}</span>` : ''}
                        <span class="sdt-hero-tag gray">Joined ${joined}</span>
                        ${d.last_active ? `<span class="sdt-hero-tag gray">Active ${sdtTimeAgo(d.last_active)}</span>` : ''}
                        ${d.class_subjects.length ? `<span class="sdt-hero-tag gray">${d.class_subjects.length} class${d.class_subjects.length !== 1 ? 'es' : ''}</span>` : ''}
                    </div>
                </div>
                <div class="sdt-hero-avg">
                    <div class="sdt-hero-avg-val ${avgCol}">${d.overall_avg !== null ? d.overall_avg + '%' : '—'}</div>
                    <div class="sdt-hero-avg-label">Learner avg</div>
                </div>
            </div>

            <!-- CONTENT KPI -->
            <div class="sdt-kpi-row">
                <div class="sdt-kpi-card c-teal">
                    <div class="sdt-kpi-num">${d.quizzes}</div>
                    <div class="sdt-kpi-label">Quizzes</div>
                </div>
                <div class="sdt-kpi-card c-blue">
                    <div class="sdt-kpi-num">${d.assignments}</div>
                    <div class="sdt-kpi-label">Assignments</div>
                </div>
                <div class="sdt-kpi-card c-purple">
                    <div class="sdt-kpi-num">${d.resources}</div>
                    <div class="sdt-kpi-label">Resources</div>
                </div>
                <div class="sdt-kpi-card c-orange">
                    <div class="sdt-kpi-num">${d.announcements}</div>
                    <div class="sdt-kpi-label">Announcements</div>
                </div>
            </div>

            <!-- VS SCHOOL AVG -->
            ${compareHTML}

            <!-- CLASS/SUBJECT PERFORMANCE -->
            <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:10px;">
                Classes & subject performance
            </div>
            ${classBlocks}
        </div>`;
}

// ── Accordion toggle ──
window.sdtToggleClassBlock = function(idx) {
    const body = document.getElementById(`sdt-block-${idx}`);
    const chev = document.getElementById(`sdt-chev-${idx}`);
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display       = hidden ? '' : 'none';
    chev.style.transform     = hidden ? '' : 'rotate(-90deg)';
};