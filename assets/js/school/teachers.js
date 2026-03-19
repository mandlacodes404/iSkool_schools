// ══════════════════════════════════════════════════════════
// TEACHERS SECTION — assets/js/school/teachers.js
// Updated: two-tab profile (Profile + Analytics)
// ══════════════════════════════════════════════════════════

window._sdTeachersCache = null;
window._sdTeacherProfileCache = {};
window._sdtProfileTab = 'profile'; // 'profile' | 'analytics'

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
            gap: 10px;
            padding: 20px 28px 0;
            flex-wrap: wrap;
        }

        .sdt-search-wrap {
            position: relative;
            flex: 1;
            min-width: 200px;
            max-width: 360px;
        }
        .sdt-search-wrap svg {
            position: absolute;
            left: 12px; top: 50%;
            transform: translateY(-50%);
            width: 15px; height: 15px;
            stroke: #4a5568;
            pointer-events: none;
        }
        .sdt-search {
            width: 100%;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 9px 12px 9px 36px;
            font-family: 'Nunito', sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #e2e8f0;
            outline: none;
            transition: border-color 0.2s;
        }
        .sdt-search::placeholder { color: #4a5568; }
        .sdt-search:focus { border-color: rgba(79,209,197,0.4); }

        .sdt-count-badge {
            font-size: 11px;
            font-weight: 800;
            padding: 5px 12px;
            border-radius: 20px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            color: #8b949e;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }

        /* ── TABLE ── */
        .sdt-table-wrap {
            padding: 16px 28px 60px;
            overflow-x: auto;
        }

        .sdt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .sdt-table th {
            padding: 10px 14px;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #8b949e;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            white-space: nowrap;
            cursor: pointer;
            user-select: none;
        }
        .sdt-table th:hover { color: #e2e8f0; }
        .sdt-table th.sorted { color: #4fd1c5; }
        .sdt-sort-arrow { margin-left: 4px; opacity: 0.6; }

        .sdt-table td {
            padding: 12px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            color: #c9d1d9;
            vertical-align: middle;
        }
        .sdt-table tr:last-child td { border-bottom: none; }
        .sdt-table tbody tr {
            cursor: pointer;
            transition: background 0.15s;
        }
        .sdt-table tbody tr:hover td { background: rgba(255,255,255,0.03); }

        .sdt-avatar-cell { display: flex; align-items: center; gap: 10px; }
        .sdt-avatar-sm {
            width: 34px; height: 34px;
            border-radius: 50%;
            background: #1b1b1b;
            border: 2px solid #2d3340;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 800;
            color: #8b949e;
            text-transform: uppercase;
            flex-shrink: 0;
            overflow: hidden;
        }
        .sdt-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .sdt-name-primary { font-weight: 800; color: #e2e8f0; font-size: 13px; }
        .sdt-name-email   { font-size: 11px; color: #4a5568; margin-top: 2px; }

        .sdt-stat-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .sdt-chip {
            font-size: 11px; font-weight: 700;
            padding: 2px 8px; border-radius: 8px;
        }
        .sdt-chip.quiz  { background: rgba(79,209,197,0.1);  color: #4fd1c5; }
        .sdt-chip.asgn  { background: rgba(78,121,167,0.1);  color: #4e79a7; }
        .sdt-chip.res   { background: rgba(167,139,250,0.1); color: #a78bfa; }
        .sdt-chip.ann   { background: rgba(245,158,11,0.1);  color: #f59e0b; }

        .sdt-classes-cell {
            font-size: 11px; color: #8b949e;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .sdt-avg-badge {
            font-size: 12px; font-weight: 800;
            padding: 3px 10px; border-radius: 20px; white-space: nowrap;
        }
        .sdt-avg-badge.green  { background: rgba(34,197,94,0.12);  color: #22c55e; }
        .sdt-avg-badge.orange { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .sdt-avg-badge.red    { background: rgba(248,81,73,0.12);  color: #f85149; }
        .sdt-avg-badge.gray   { background: rgba(255,255,255,0.06); color: #4a5568; }

        .sdt-last-active { font-size: 11px; color: #4a5568; }
        .sdt-total { font-size: 14px; font-weight: 900; color: #4fd1c5; }
        .sdt-row-arrow { color: #2d3340; transition: color 0.15s; }
        .sdt-table tbody tr:hover .sdt-row-arrow { color: #4fd1c5; }

        .sdt-empty {
            text-align: center; padding: 60px 20px;
            color: #4a5568; font-size: 13px; font-style: italic;
        }

        /* ══ PROFILE VIEW ══ */
        .sdt-profile-shell { padding: 28px; max-width: 1100px; }

        .sdt-back-btn {
            display: inline-flex; align-items: center; gap: 8px;
            font-size: 13px; font-weight: 700; color: #8b949e;
            cursor: pointer; margin-bottom: 24px;
            background: none; border: none;
            font-family: 'Nunito', sans-serif; padding: 0;
            transition: color 0.2s;
        }
        .sdt-back-btn:hover { color: #e2e8f0; }
        .sdt-back-btn svg { width: 16px; height: 16px; stroke: currentColor; }

        /* Hero */
        .sdt-hero {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 16px;
            padding: 28px;
            display: flex; align-items: center; gap: 24px;
            margin-bottom: 20px;
            position: relative; overflow: hidden;
        }
        .sdt-hero::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: #4fd1c5;
        }
        .sdt-hero-avatar {
            width: 72px; height: 72px; border-radius: 50%;
            border: 3px solid #2d3340; background: #1b1b1b;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; font-weight: 900; color: #4fd1c5;
            text-transform: uppercase; flex-shrink: 0; overflow: hidden;
        }
        .sdt-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sdt-hero-info { flex: 1; min-width: 0; }
        .sdt-hero-name  { font-size: 22px; font-weight: 900; color: #e2e8f0; margin-bottom: 4px; }
        .sdt-hero-email { font-size: 12px; color: #4a5568; margin-bottom: 10px; }
        .sdt-hero-tags  { display: flex; gap: 8px; flex-wrap: wrap; }
        .sdt-hero-tag {
            font-size: 11px; font-weight: 800;
            padding: 3px 10px; border-radius: 20px; letter-spacing: 0.5px;
        }
        .sdt-hero-tag.teal   { background: rgba(79,209,197,0.1);  border: 1px solid rgba(79,209,197,0.25);  color: #4fd1c5; }
        .sdt-hero-tag.gray   { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #8b949e; }
        .sdt-hero-tag.green  { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.25);   color: #22c55e; }
        .sdt-hero-tag.orange { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.25);  color: #f59e0b; }
        .sdt-hero-tag.purple { background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25); color: #a78bfa; }

        .sdt-hero-avg { text-align: right; flex-shrink: 0; }
        .sdt-hero-avg-val {
            font-size: 36px; font-weight: 900; line-height: 1; margin-bottom: 4px;
        }
        .sdt-hero-avg-val.green  { color: #22c55e; }
        .sdt-hero-avg-val.orange { color: #f59e0b; }
        .sdt-hero-avg-val.red    { color: #f85149; }
        .sdt-hero-avg-val.gray   { color: #4a5568; }
        .sdt-hero-avg-label { font-size: 11px; color: #4a5568; font-weight: 700; }

        /* ── PROFILE TABS ── */
        .sdt-profile-tabs {
            display: flex; gap: 4px;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px; padding: 4px;
            margin-bottom: 20px; width: fit-content;
        }
        .sdt-profile-tab {
            font-size: 13px; font-weight: 800;
            padding: 8px 20px; border-radius: 9px;
            border: none; background: none;
            color: #4a5568; cursor: pointer;
            font-family: 'Nunito', sans-serif;
            transition: all 0.18s;
            display: flex; align-items: center; gap: 7px;
        }
        .sdt-profile-tab:hover { color: #8b949e; }
        .sdt-profile-tab.active {
            background: rgba(79,209,197,0.12);
            border: 1px solid rgba(79,209,197,0.3);
            color: #4fd1c5;
        }
        .sdt-profile-tab svg {
            width: 14px; height: 14px; stroke: currentColor; fill: none;
            stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }

        /* ── PERSONAL DETAILS ── */
        .sdt-details-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px; padding: 20px; margin-bottom: 20px;
        }
        .sdt-details-section-title {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #4fd1c5; margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(79,209,197,0.15);
        }
        .sdt-details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px; margin-bottom: 20px;
        }
        .sdt-details-grid:last-child { margin-bottom: 0; }
        .sdt-detail-label {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #4a5568; margin-bottom: 4px;
        }
        .sdt-detail-value { font-size: 14px; font-weight: 700; color: #e2e8f0; }
        .sdt-detail-value.missing {
            color: #4a5568; font-style: italic;
            font-weight: 400; font-size: 13px;
        }

        /* KPI row */
        .sdt-kpi-row {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 12px; margin-bottom: 20px;
        }
        .sdt-kpi-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px; padding: 16px; text-align: center;
        }
        .sdt-kpi-num {
            font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 6px;
        }
        .sdt-kpi-label {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1px; text-transform: uppercase; color: #4a5568;
        }
        .sdt-kpi-card.c-teal   .sdt-kpi-num { color: #4fd1c5; }
        .sdt-kpi-card.c-blue   .sdt-kpi-num { color: #4e79a7; }
        .sdt-kpi-card.c-purple .sdt-kpi-num { color: #a78bfa; }
        .sdt-kpi-card.c-orange .sdt-kpi-num { color: #f59e0b; }

        /* vs school avg bar */
        .sdt-compare-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;
        }
        .sdt-compare-label {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #8b949e; margin-bottom: 14px;
        }
        .sdt-compare-row {
            display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
        }
        .sdt-compare-name { font-size: 12px; font-weight: 700; color: #8b949e; width: 90px; flex-shrink: 0; }
        .sdt-compare-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
        .sdt-compare-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .sdt-compare-val { font-size: 12px; font-weight: 800; width: 44px; text-align: right; flex-shrink: 0; }

        /* Class blocks */
        .sdt-class-block {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px; margin-bottom: 16px; overflow: hidden;
        }
        .sdt-class-block-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            cursor: pointer; transition: background 0.15s;
        }
        .sdt-class-block-header:hover { background: rgba(255,255,255,0.02); }
        .sdt-class-block-title { font-size: 15px; font-weight: 800; color: #e2e8f0; }
        .sdt-class-block-sub { font-size: 11px; color: #4fd1c5; margin-left: 8px; font-weight: 700; }
        .sdt-class-block-body { padding: 18px 20px; }

        .sdt-perf-title {
            font-size: 10px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #4a5568; margin-bottom: 8px;
        }
        .sdt-perf-row {
            display: flex; align-items: center; gap: 10px;
            padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .sdt-perf-row:last-child { border-bottom: none; }
        .sdt-perf-rank { font-size: 11px; font-weight: 800; color: #2d3340; width: 20px; }
        .sdt-perf-name { flex: 1; font-size: 13px; font-weight: 700; color: #c9d1d9; }
        .sdt-perf-avg  { font-size: 12px; font-weight: 800; }
        .sdt-perf-avg.green  { color: #22c55e; }
        .sdt-perf-avg.orange { color: #f59e0b; }
        .sdt-perf-avg.red    { color: #f85149; }
        .sdt-perf-avg.gray   { color: #4a5568; }

        .sdt-no-perf { font-size: 12px; color: #4a5568; font-style: italic; padding: 6px 0; }
        .sdt-class-stats-row { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
        .sdt-class-stat-item { font-size: 12px; color: #8b949e; }
        .sdt-class-stat-item strong { color: #e2e8f0; font-weight: 800; }
        .sdt-no-classes { text-align: center; padding: 40px 20px; color: #4a5568; font-size: 13px; font-style: italic; }

        @media (max-width: 900px) {
            .sdt-kpi-row { grid-template-columns: repeat(2, 1fr); }
            .sdt-toolbar { padding: 16px 16px 0; }
            .sdt-table-wrap { padding: 12px 16px 60px; }
            .sdt-profile-shell { padding: 16px; }
            .sdt-hero { flex-direction: column; text-align: center; }
            .sdt-hero-avg { text-align: center; }
            .sdt-hero-tags { justify-content: center; }
            .sdt-details-grid { grid-template-columns: 1fr 1fr; }
        }
    `;
    document.head.appendChild(s);
})();

// ── HELPERS ──
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

function sdtField(val) {
    if (!val || val === '') return '<span class="sdt-detail-value missing">Not provided</span>';
    return `<span class="sdt-detail-value">${val}</span>`;
}

// ══════════════════════════════════════════════════════════
// TEACHERS TABLE
// ══════════════════════════════════════════════════════════
window.loadSdTeachers = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdTeachersCache) {
        renderTeachersTable(window._sdTeachersCache, '');
        return;
    }

    content.innerHTML = `
        <div class="sdt-toolbar">
            <div class="sd-skeleton" style="height:36px;width:280px;border-radius:8px;"></div>
            <div class="sd-skeleton" style="height:28px;width:80px;border-radius:20px;"></div>
        </div>
        <div class="sdt-table-wrap">
            <div class="sd-skeleton" style="height:40px;border-radius:6px;margin-bottom:4px;"></div>
            ${[1,2,3,4,5].map(() => `
                <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div class="sd-skeleton" style="width:34px;height:34px;border-radius:50%;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div class="sd-skeleton" style="height:13px;width:140px;margin-bottom:5px;"></div>
                        <div class="sd-skeleton" style="height:11px;width:180px;"></div>
                    </div>
                    <div class="sd-skeleton" style="height:22px;width:120px;border-radius:8px;"></div>
                    <div class="sd-skeleton" style="height:22px;width:60px;border-radius:20px;"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_teachers.php');
        const data = await res.json();
        window._sdTeachersCache = data;
        renderTeachersTable(data, '');
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load teachers.</p>`;
    }
};

let _sdtCurrentSearch = '';
let _sdtSortCol = 'total';
let _sdtSortDir = -1;

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

    const sortArrow = (col) => _sdtSortCol !== col ? '' : `<span class="sdt-sort-arrow">${_sdtSortDir === -1 ? '↓' : '↑'}</span>`;
    const thClass   = (col) => _sdtSortCol === col ? 'sorted' : '';

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
                <td class="sdt-classes-cell" title="${t.classes || '—'}">${t.classes || '<span style="color:#2d3340;font-style:italic;">No content yet</span>'}</td>
                <td><span class="sdt-avg-badge ${col}">${t.avg_pct !== null ? t.avg_pct + '%' : '—'}</span></td>
                <td class="sdt-last-active">${sdtTimeAgo(t.last_active)}</td>
                <td class="sdt-total">${t.total}</td>
                <td class="sdt-row-arrow">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </td>
            </tr>`;
    }).join('') : `<tr><td colspan="7" class="sdt-empty">No teachers found${q ? ' matching "' + q + '"' : ''}.</td></tr>`;

    content.innerHTML = `
        <div style="padding:28px 28px 8px;">
            <div style="font-size:22px;font-weight:900;color:#e2e8f0;margin-bottom:4px;">Teachers</div>
            <div style="font-size:13px;color:#8b949e;">Staff registry — click a teacher to view their profile</div>
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
                        <th class="${thClass('avg_pct')}"     onclick="sdtSort('avg_pct')">Learner Avg ${sortArrow('avg_pct')}</th>
                        <th class="${thClass('last_active')}" onclick="sdtSort('last_active')">Last Active ${sortArrow('last_active')}</th>
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
    if (_sdtSortCol === col) _sdtSortDir *= -1;
    else { _sdtSortCol = col; _sdtSortDir = col === 'name' ? 1 : -1; }
    if (window._sdTeachersCache) renderTeachersTable(window._sdTeachersCache, _sdtCurrentSearch);
};

// ══════════════════════════════════════════════════════════
// TEACHER PROFILE
// ══════════════════════════════════════════════════════════
window.loadSdTeacherProfile = async function(email) {
    const content = document.getElementById('sd-content');

    content.innerHTML = `
        <div class="sdt-profile-shell">
            <div class="sd-skeleton" style="height:16px;width:100px;margin-bottom:24px;border-radius:6px;"></div>
            <div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px;margin-bottom:20px;display:flex;align-items:center;gap:24px;">
                <div class="sd-skeleton" style="width:72px;height:72px;border-radius:50%;flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div class="sd-skeleton" style="height:22px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:12px;width:160px;margin-bottom:12px;"></div>
                    <div style="display:flex;gap:8px;">
                        <div class="sd-skeleton" style="height:24px;width:80px;border-radius:20px;"></div>
                        <div class="sd-skeleton" style="height:24px;width:60px;border-radius:20px;"></div>
                    </div>
                </div>
            </div>
            <div class="sd-skeleton" style="height:44px;width:260px;border-radius:12px;margin-bottom:20px;"></div>
            <div class="sd-skeleton" style="height:180px;border-radius:14px;"></div>
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
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load teacher profile.</p>`;
    }
};

function renderTeacherProfile(d) {
    const content  = document.getElementById('sd-content');
    const avgCol   = sdtAvgColor(d.overall_avg);
    const initials = ((d.first_name||'')[0]||'') + ((d.surname||'')[0]||'');
    const picHTML  = d.profile_pic && d.profile_pic !== 'default.png'
        ? `<img src="uploads/teachers/${d.profile_pic}" alt="">`
        : initials.toUpperCase();

    const joined   = d.joined ? new Date(d.joined).toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' }) : '—';
    const tBarW    = d.overall_avg !== null ? d.overall_avg : 0;
    const sBarW    = d.school_avg  !== null ? d.school_avg  : 0;
    const tBarCol  = d.overall_avg !== null && d.overall_avg >= (d.school_avg || 0) ? '#22c55e' : '#f59e0b';

    // Employment type display
    const empTypeDisplay = d.employment_type
        ? d.employment_type.charAt(0).toUpperCase() + d.employment_type.slice(1)
        : null;

    // ── PROFILE TAB HTML ──
    const profileTabHTML = `
        <div class="sdt-details-card">
            <div class="sdt-details-section-title">Personal Details</div>
            <div class="sdt-details-grid">
                <div>
                    <div class="sdt-detail-label">Gender</div>
                    ${sdtField(d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null)}
                </div>
                <div>
                    <div class="sdt-detail-label">Email</div>
                    <span class="sdt-detail-value" style="font-size:12px;">${d.email}</span>
                </div>
                <div>
                    <div class="sdt-detail-label">Phone</div>
                    ${sdtField(d.phone)}
                </div>
                <div>
                    <div class="sdt-detail-label">Joined</div>
                    <span class="sdt-detail-value" style="font-size:12px;">${joined}</span>
                </div>
            </div>

            <div class="sdt-details-section-title">Professional</div>
            <div class="sdt-details-grid">
                <div>
                    <div class="sdt-detail-label">Subject Specialization</div>
                    ${sdtField(d.subject_specialization)}
                </div>
                <div>
                    <div class="sdt-detail-label">Employment Type</div>
                    ${sdtField(empTypeDisplay)}
                </div>
                <div>
                    <div class="sdt-detail-label">Classes Taught</div>
                    <span class="sdt-detail-value">${d.class_subjects.length || '—'}</span>
                </div>
                <div>
                    <div class="sdt-detail-label">Last Active</div>
                    <span class="sdt-detail-value">${sdtTimeAgo(d.last_active)}</span>
                </div>
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

        ${(d.overall_avg !== null || d.school_avg !== null) ? `
        <div class="sdt-compare-card">
            <div class="sdt-compare-label">Learner Performance vs School Average</div>
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
                    <div class="sdt-compare-bar" style="width:${sBarW}%;background:#4a5568;"></div>
                </div>
                <div class="sdt-compare-val" style="color:#8b949e;">${d.school_avg !== null ? d.school_avg + '%' : '—'}</div>
            </div>
        </div>` : ''}`;

    // ── ANALYTICS TAB HTML ──
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
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span class="sdt-avg-badge ${cCol}">${cs.avg_pct !== null ? cs.avg_pct + '%' : '—'}</span>
                            <svg id="sdt-chev-${ci}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8b949e" stroke-width="2.5" style="transition:transform 0.2s;">
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
                                <div class="sdt-perf-title">Top Learners</div>
                                ${topRows}
                            </div>
                            ${showBottom ? `
                            <div>
                                <div class="sdt-perf-title">Needs Support</div>
                                ${botRows}
                            </div>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('')
        : `<div class="sdt-no-classes">This teacher hasn't posted any summative assessments yet.</div>`;

    const analyticsTabHTML = `
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#4a5568;margin-bottom:12px;">
            Classes & Subject Performance
        </div>
        ${classBlocks}`;

    // ── Render shell ──
    const activeTab = window._sdtProfileTab || 'profile';

    content.innerHTML = `
        <div class="sdt-profile-shell">
            <button class="sdt-back-btn" onclick="loadSdTeachers()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                All Teachers
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
                        ${d.subject_specialization ? `<span class="sdt-hero-tag purple">${d.subject_specialization}</span>` : ''}
                        ${empTypeDisplay ? `<span class="sdt-hero-tag ${d.employment_type === 'permanent' ? 'green' : 'orange'}">${empTypeDisplay}</span>` : ''}
                        <span class="sdt-hero-tag gray">Joined ${joined}</span>
                        ${d.last_active ? `<span class="sdt-hero-tag gray">Active ${sdtTimeAgo(d.last_active)}</span>` : ''}
                    </div>
                </div>
                <div class="sdt-hero-avg">
                    <div class="sdt-hero-avg-val ${avgCol}">${d.overall_avg !== null ? d.overall_avg + '%' : '—'}</div>
                    <div class="sdt-hero-avg-label">LEARNER AVG</div>
                </div>
            </div>

            <!-- TABS -->
            <div class="sdt-profile-tabs">
                <button class="sdt-profile-tab ${activeTab === 'profile' ? 'active' : ''}"
                    id="sdt-ptab-profile" onclick="sdtSwitchProfileTab('profile')">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Profile
                </button>
                <button class="sdt-profile-tab ${activeTab === 'analytics' ? 'active' : ''}"
                    id="sdt-ptab-analytics" onclick="sdtSwitchProfileTab('analytics')">
                    <svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    Analytics
                </button>
            </div>

            <!-- TAB CONTENT -->
            <div id="sdt-tab-content">
                ${activeTab === 'profile' ? profileTabHTML : analyticsTabHTML}
            </div>
        </div>`;

    // Store for tab switching
    content._sdtProfileHTML   = profileTabHTML;
    content._sdtAnalyticsHTML = analyticsTabHTML;
}

// ── Tab switcher ──
window.sdtSwitchProfileTab = function(tab) {
    window._sdtProfileTab = tab;
    const content    = document.getElementById('sd-content');
    const tabContent = document.getElementById('sdt-tab-content');
    if (!tabContent) return;

    document.getElementById('sdt-ptab-profile')?.classList.toggle('active', tab === 'profile');
    document.getElementById('sdt-ptab-analytics')?.classList.toggle('active', tab === 'analytics');

    tabContent.innerHTML = tab === 'profile'
        ? content._sdtProfileHTML
        : content._sdtAnalyticsHTML;
};

// ── Accordion toggle ──
window.sdtToggleClassBlock = function(idx) {
    const body = document.getElementById(`sdt-block-${idx}`);
    const chev = document.getElementById(`sdt-chev-${idx}`);
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display   = hidden ? '' : 'none';
    chev.style.transform = hidden ? '' : 'rotate(-90deg)';
};