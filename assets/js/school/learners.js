// ═══════════════════════════════════════════════════════
// LEARNERS SECTION — school_admin_dashboard
// ═══════════════════════════════════════════════════════

window._sdLearnersCache = null;
window._sdLearnerProfileCache = {};

// ── INJECT STYLES ──────────────────────────────────────
(function injectLearnerStyles() {
    if (document.getElementById('sd-learner-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-learner-styles';
    s.textContent = `
    /* ── TOOLBAR ── */
    .sdl-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 16px 24px 0;
    }
    .sdl-search {
        flex: 1;
        min-width: 180px;
        max-width: 300px;
        padding: 6px 12px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        font-size: 13px;
        font-family: var(--font);
        transition: border-color 0.15s;
    }
    .sdl-search:focus        { outline: none; border-color: var(--border-hover); }
    .sdl-search::placeholder { color: var(--text-dim); }

    .sdl-filter {
        padding: 6px 10px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--text);
        font-size: 13px;
        font-family: var(--font);
        cursor: pointer;
        transition: border-color 0.15s;
    }
    .sdl-filter:focus { outline: none; border-color: var(--border-hover); }

    .sdl-count {
        margin-left: auto;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-dim);
        font-family: var(--font-mono);
    }

    /* ── TABLE ── */
    .sdl-table-wrap {
        padding: 12px 24px 40px;
        overflow-x: auto;
    }
    .sdl-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    .sdl-table th {
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
    .sdl-table th:hover       { color: var(--text-muted); }
    .sdl-table th.sort-active { color: var(--teal); }

    .sdl-table td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
        color: var(--text-muted);
        vertical-align: middle;
    }
    .sdl-table tr:last-child td { border-bottom: none; }
    .sdl-table tr:hover td      { background: var(--surface2); }

    .sdl-learner-cell {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
    }
    .sdl-avatar {
        width: 28px; height: 28px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--border-hover);
        flex-shrink: 0;
        background: var(--surface2);
    }
    .sdl-avatar-initials {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: var(--surface2);
        border: 1px solid var(--border-hover);
        color: var(--text-muted);
        font-size: 10px;
        font-weight: 600;
        font-family: var(--font-mono);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        text-transform: uppercase;
    }
    .sdl-name {
        font-weight: 500;
        color: var(--text);
        font-size: 13px;
        transition: color 0.15s;
    }
    .sdl-name:hover { color: var(--teal); }
    .sdl-email-sub {
        font-size: 11px;
        color: var(--text-dim);
        margin-top: 1px;
        font-family: var(--font-mono);
    }

    .sdl-class-chip {
        display: inline-block;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 20px;
        background: var(--surface2);
        border: 1px solid var(--border-hover);
        color: var(--text-muted);
        white-space: nowrap;
        font-family: var(--font-mono);
    }

    .sdl-gender {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 20px;
        font-family: var(--font-mono);
    }
    .sdl-gender.male   { background: var(--blue-dim);   color: var(--blue);   }
    .sdl-gender.female { background: rgba(225,87,89,0.1); color: #e15759;     }
    .sdl-gender.other  { background: var(--surface2);   color: var(--text-muted); }

    .sdl-avg {
        font-size: 12px;
        font-weight: 600;
        font-family: var(--font-mono);
        padding: 2px 8px;
        border-radius: 20px;
    }
    .sdl-avg.green  { background: var(--green-dim);  color: var(--green);  }
    .sdl-avg.orange { background: var(--orange-dim); color: var(--orange); }
    .sdl-avg.red    { background: var(--red-dim);    color: var(--red);    }
    .sdl-avg.gray   { background: var(--surface2);   color: var(--text-dim); }

    .sdl-delete-btn {
        background: none;
        border: 1px solid rgba(248,81,73,0.18);
        color: var(--red);
        border-radius: var(--radius);
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 500;
        font-family: var(--font);
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.15s;
    }
    .sdl-delete-btn:hover { opacity: 1; background: var(--red-dim); }

    /* ── CONFIRM DIALOG ── */
    .sdl-confirm-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(2px);
        z-index: 9500;
        align-items: center;
        justify-content: center;
    }
    .sdl-confirm-overlay.show { display: flex; }
    .sdl-confirm-box {
        background: var(--surface);
        border: 1px solid var(--border-hover);
        border-radius: var(--radius-lg);
        padding: 24px;
        max-width: 360px;
        width: 90%;
        text-align: center;
        animation: sdlPop 0.15s ease-out;
    }
    @keyframes sdlPop {
        from { opacity:0; transform:scale(0.95); }
        to   { opacity:1; transform:scale(1); }
    }
    .sdl-confirm-icon {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: var(--red-dim);
        border: 1px solid rgba(248,81,73,0.18);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 14px;
    }
    .sdl-confirm-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 6px;
    }
    .sdl-confirm-sub {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 20px;
        line-height: 1.5;
    }
    .sdl-confirm-name {
        color: var(--text);
        font-weight: 600;
    }
    .sdl-confirm-btns   { display: flex; gap: 8px; }
    .sdl-confirm-cancel {
        flex: 1;
        padding: 8px;
        background: var(--surface2);
        border: 1px solid var(--border-hover);
        border-radius: var(--radius);
        color: var(--text);
        font-size: 13px;
        font-weight: 500;
        font-family: var(--font);
        cursor: pointer;
        transition: background 0.15s;
    }
    .sdl-confirm-cancel:hover { background: var(--border-hover); }
    .sdl-confirm-delete {
        flex: 1;
        padding: 8px;
        background: var(--red-dim);
        border: 1px solid rgba(248,81,73,0.25);
        border-radius: var(--radius);
        color: var(--red);
        font-size: 13px;
        font-weight: 600;
        font-family: var(--font);
        cursor: pointer;
        transition: background 0.15s;
    }
    .sdl-confirm-delete:hover { background: rgba(248,81,73,0.15); }

    /* ── PROFILE VIEW ── */
    .sdp-shell { padding: 24px; }

    .sdp-back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-muted);
        cursor: pointer;
        margin-bottom: 20px;
        background: none;
        border: none;
        font-family: var(--font);
        padding: 0;
        transition: color 0.15s;
    }
    .sdp-back:hover { color: var(--text); }

    /* ── HERO ── */
    .sdp-hero {
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
    .sdp-hero:hover { border-color: var(--border-hover); }

    .sdp-hero-avatar {
        width: 56px; height: 56px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--border-hover);
        flex-shrink: 0;
    }
    .sdp-hero-avatar-init {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: var(--surface2);
        border: 1px solid var(--border-hover);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-muted);
        font-family: var(--font-mono);
        flex-shrink: 0;
        text-transform: uppercase;
    }
    .sdp-hero-info   { flex: 1; }
    .sdp-hero-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 4px;
    }
    .sdp-hero-meta {
        font-size: 12px;
        color: var(--text-muted);
        line-height: 1.6;
        font-family: var(--font-mono);
    }
    .sdp-hero-meta span { color: var(--text); font-weight: 500; }

    /* ── PERSONAL DETAILS CARD ── */
    .sdp-details-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 16px;
        margin-bottom: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 14px;
        transition: border-color 0.15s;
    }
    .sdp-details-card:hover { border-color: var(--border-hover); }
    .sdp-detail-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--text-dim);
        margin-bottom: 3px;
    }
    .sdp-detail-value {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
    }

    /* ── OVERALL BADGE ── */
    .sdp-overall-badge { text-align: center; flex-shrink: 0; }
    .sdp-overall-circle {
        width: 60px; height: 60px;
        border-radius: 50%;
        border: 2px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
    }
    .sdp-overall-pct {
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }
    .sdp-overall-lbl {
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--text-muted);
    }
    .sdp-overall-sub {
        font-size: 11px;
        color: var(--text-dim);
        font-family: var(--font-mono);
    }

    /* ── TERM TABS ── */
    .sdp-term-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }
    .sdp-term-tab {
        flex: 1;
        padding: 10px 8px;
        text-align: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: all 0.15s;
    }
    .sdp-term-tab:hover        { border-color: var(--border-hover); }
    .sdp-term-tab.active {
        background: var(--teal-dim);
        border-color: var(--teal-border);
    }
    .sdp-term-tab-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--text-dim);
        margin-bottom: 3px;
    }
    .sdp-term-tab.active .sdp-term-tab-label { color: var(--teal); }
    .sdp-term-tab-avg {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }
    .sdp-term-tab.active .sdp-term-tab-avg { color: var(--teal); }
    .sdp-term-tab-sub {
        font-size: 10px;
        color: var(--text-dim);
        margin-top: 2px;
        font-family: var(--font-mono);
    }

    /* ── SUBJECT CARDS ── */
    .sdp-subjects-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    .sdp-subject-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 16px 16px 16px 18px;
        position: relative;
        overflow: hidden;
        transition: border-color 0.15s;
    }
    .sdp-subject-card:hover { border-color: var(--border-hover); }
    .sdp-subject-card::before {
        content: '';
        position: absolute;
        left: 0; top: 10px; bottom: 10px;
        width: 2px;
        border-radius: 0 2px 2px 0;
        background: var(--accent, var(--text-dim));
    }
    .sdp-subject-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
        margin-bottom: 12px;
        padding-right: 60px;
        line-height: 1.4;
        min-height: 28px;
    }
    .sdp-subject-class {
        font-size: 10px;
        color: var(--text-dim);
        font-weight: 500;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: var(--font-mono);
    }
    .sdp-subject-pct {
        position: absolute;
        top: 14px; right: 14px;
        font-size: 20px;
        font-weight: 600;
        line-height: 1;
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }
    .sdp-subject-bar-track {
        height: 4px;
        background: var(--surface2);
        border-radius: 100px;
        overflow: hidden;
        margin-bottom: 6px;
    }
    .sdp-subject-bar-fill {
        height: 100%;
        border-radius: 100px;
        transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
    }
    .sdp-subject-meta {
        font-size: 11px;
        color: var(--text-dim);
        font-family: var(--font-mono);
    }
    .sdp-subject-no-data {
        font-size: 12px;
        color: var(--text-dim);
        padding: 8px 0 2px;
    }

    /* ── EMPTY STATE ── */
    .sdl-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        color: var(--text-dim);
        text-align: center;
        gap: 10px;
    }
    .sdl-empty h3 { color: var(--text-muted); font-size: 14px; font-weight: 600; }

    @media (max-width: 600px) {
        .sdl-toolbar        { padding: 14px 14px 0; }
        .sdl-table-wrap     { padding: 10px 14px 40px; }
        .sdp-shell          { padding: 14px; }
        .sdp-hero           { flex-direction: column; text-align: center; }
        .sdp-subjects-grid  { grid-template-columns: 1fr; }
        .sdp-term-tabs      { flex-wrap: wrap; }
        .sdp-term-tab       { min-width: calc(50% - 4px); flex: none; }
    }
    `;
    document.head.appendChild(s);
})();

// ── COLOR HELPER ──────────────────────────────────────
function sdlColor(v) {
    if (v === null || v === undefined) return { cls: 'gray', text: 'var(--text-dim)', bg: 'var(--surface2)', border: 'var(--text-dim)' };
    if (v >= 80) return { cls: 'green',  text: 'var(--green)',  bg: 'var(--green-dim)',  border: 'var(--green)'  };
    if (v >= 60) return { cls: 'green',  text: 'var(--teal)',   bg: 'var(--teal-dim)',   border: 'var(--teal)'   };
    if (v >= 40) return { cls: 'orange', text: 'var(--orange)', bg: 'var(--orange-dim)', border: 'var(--orange)' };
    return               { cls: 'red',   text: 'var(--red)',    bg: 'var(--red-dim)',    border: 'var(--red)'    };
}

function sdlEsc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// ═══════════════════════════════════════════════════
// LOAD LEARNERS TABLE
// ═══════════════════════════════════════════════════
window.loadSdLearners = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdLearnersCache) {
        renderLearnersTable(window._sdLearnersCache);
        return;
    }

    // Skeleton
    content.innerHTML = `
        <div style="padding:20px 24px 0;">
            <div class="sd-skeleton" style="height:32px;width:100%;max-width:480px;border-radius:var(--radius);"></div>
        </div>
        <div style="padding:14px 24px;">
            ${[1,2,3,4,5,6].map(() => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                    <div class="sd-skeleton" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div class="sd-skeleton" style="height:13px;width:160px;margin-bottom:5px;"></div>
                        <div class="sd-skeleton" style="height:11px;width:120px;"></div>
                    </div>
                    <div class="sd-skeleton" style="height:22px;width:60px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:22px;width:50px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:22px;width:40px;border-radius:var(--radius);"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_learners.php');
        const data = await res.json();
        window._sdLearnersCache = data;
        renderLearnersTable(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load learners.</p>`;
    }
};

function renderLearnersTable(data) {
    const content  = document.getElementById('sd-content');
    const learners = data.learners || [];
    const classes  = data.classes  || [];

    window._sdAllLearners = learners;

    const classOptions = classes.map(c =>
        `<option value="${c.id}">${sdlEsc(c.name)}</option>`
    ).join('');

    content.innerHTML = `
        <div style="padding:24px 24px 8px;">
            <div style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:3px;">Learners</div>
            <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);" id="sdl-count-header">${learners.length} learner${learners.length !== 1 ? 's' : ''}</div>
        </div>

        <div class="sdl-toolbar">
            <input type="text" class="sdl-search" placeholder="Search by name or email…"
                   oninput="sdlFilterTable()" id="sdl-search">
            <select class="sdl-filter" id="sdl-class-filter" onchange="sdlFilterTable()">
                <option value="">All classes</option>
                ${classOptions}
            </select>
            <select class="sdl-filter" id="sdl-gender-filter" onchange="sdlFilterTable()">
                <option value="">All genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
            </select>
        </div>

        <div class="sdl-table-wrap">
            <table class="sdl-table" id="sdl-table">
                <thead>
                    <tr>
                        <th onclick="sdlSort('name')"    id="sdth-name">Learner</th>
                        <th onclick="sdlSort('classes')" id="sdth-classes">Class</th>
                        <th onclick="sdlSort('gender')"  id="sdth-gender">Gender</th>
                        <th onclick="sdlSort('age')"     id="sdth-age">Age</th>
                        <th onclick="sdlSort('avg_pct')" id="sdth-avg">Avg %</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="sdl-tbody">
                    ${buildLearnerRows(learners)}
                </tbody>
            </table>
        </div>

        <!-- Confirm delete dialog -->
        <div class="sdl-confirm-overlay" id="sdl-confirm">
            <div class="sdl-confirm-box">
                <div class="sdl-confirm-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--red)" stroke-width="2" fill="none">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                    </svg>
                </div>
                <div class="sdl-confirm-title">Remove learner?</div>
                <div class="sdl-confirm-sub">
                    Are you sure you want to remove <span class="sdl-confirm-name" id="sdl-confirm-name"></span>?
                    They will no longer be able to log in.
                </div>
                <div class="sdl-confirm-btns">
                    <button class="sdl-confirm-cancel" onclick="sdlCloseConfirm()">Cancel</button>
                    <button class="sdl-confirm-delete" onclick="sdlConfirmDelete()">Remove</button>
                </div>
            </div>
        </div>`;
}

function buildLearnerRows(learners) {
    if (!learners.length) {
        return `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px;">No learners found.</td></tr>`;
    }

    return learners.map(l => {
        const c   = sdlColor(l.avg_pct);
        const avg = l.avg_pct !== null ? `<span class="sdl-avg ${c.cls}">${l.avg_pct}%</span>` : `<span class="sdl-avg gray">—</span>`;
        const initials = (l.first_name?.[0] || '') + (l.surname?.[0] || '');
        const avatar = l.profile_pic && l.profile_pic !== 'uploads/default_profile.png'
            ? `<img src="${sdlEsc(l.profile_pic)}" class="sdl-avatar" onerror="this.outerHTML='<div class=sdl-avatar-initials>${initials}</div>'">`
            : `<div class="sdl-avatar-initials">${initials}</div>`;

        const genderLabel = l.gender === 'male' ? 'Boy' : l.gender === 'female' ? 'Girl' : '—';
        const genderCls   = l.gender === 'male' ? 'male' : l.gender === 'female' ? 'female' : 'other';

        const classDisplay = l.classes !== '—'
            ? l.classes.split(', ').map(cn => `<span class="sdl-class-chip">${sdlEsc(cn)}</span>`).join(' ')
            : '<span style="color:var(--text-dim);font-size:12px;">—</span>';

        return `
            <tr data-id="${l.id}" data-name="${sdlEsc(l.name)}" data-email="${sdlEsc(l.email)}"
                data-classes="${sdlEsc(l.classes)}" data-class-ids="${sdlEsc(l.class_ids)}"
                data-gender="${l.gender || ''}" data-avg="${l.avg_pct || 0}" data-age="${l.age || 0}">
                <td>
                    <div class="sdl-learner-cell" onclick="loadSdLearnerProfile('${sdlEsc(l.email)}', '${sdlEsc(l.name)}')">
                        ${avatar}
                        <div>
                            <div class="sdl-name">${sdlEsc(l.name)}</div>
                            <div class="sdl-email-sub">${sdlEsc(l.email)}</div>
                        </div>
                    </div>
                </td>
                <td>${classDisplay}</td>
                <td><span class="sdl-gender ${genderCls}">${genderLabel}</span></td>
                <td style="font-family:var(--font-mono);color:var(--text-muted);">${l.age || '—'}</td>
                <td>${avg}</td>
                <td>
                    <button class="sdl-delete-btn"
                            onclick="sdlPromptDelete(${l.id}, '${sdlEsc(l.name)}')">
                        Remove
                    </button>
                </td>
            </tr>`;
    }).join('');
}

// ── FILTER ──────────────────────────────────────────
window.sdlFilterTable = function() {
    const search  = (document.getElementById('sdl-search')?.value || '').toLowerCase();
    const classF  = document.getElementById('sdl-class-filter')?.value || '';
    const genderF = document.getElementById('sdl-gender-filter')?.value || '';

    const rows = document.querySelectorAll('#sdl-tbody tr[data-id]');
    let visible = 0;

    rows.forEach(row => {
        const name     = (row.dataset.name    || '').toLowerCase();
        const email    = (row.dataset.email   || '').toLowerCase();
        const classIds = (row.dataset.classIds || '').split(',');
        const gender   = row.dataset.gender || '';

        const matchSearch  = !search  || name.includes(search) || email.includes(search);
        const matchClass   = !classF  || classIds.includes(classF);
        const matchGender  = !genderF || gender === genderF;

        const show = matchSearch && matchClass && matchGender;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });

    const hdr = document.getElementById('sdl-count-header');
    if (hdr) hdr.textContent = `${visible} learner${visible !== 1 ? 's' : ''}`;
};

// ── SORT ────────────────────────────────────────────
let _sdlSortCol = 'name', _sdlSortAsc = true;
window.sdlSort = function(col) {
    if (_sdlSortCol === col) _sdlSortAsc = !_sdlSortAsc;
    else { _sdlSortCol = col; _sdlSortAsc = true; }

    document.querySelectorAll('.sdl-table th').forEach(th => th.classList.remove('sort-active'));
    const th = document.getElementById(`sdth-${col}`);
    if (th) th.classList.add('sort-active');

    const tbody = document.getElementById('sdl-tbody');
    const rows  = Array.from(tbody.querySelectorAll('tr[data-id]'));

    rows.sort((a, b) => {
        let av = a.dataset[col] || '';
        let bv = b.dataset[col] || '';
        const numCols = ['avg', 'age'];
        if (numCols.includes(col)) {
            av = parseFloat(av) || 0;
            bv = parseFloat(bv) || 0;
            return _sdlSortAsc ? av - bv : bv - av;
        }
        return _sdlSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    rows.forEach(r => tbody.appendChild(r));
};

// ── SOFT DELETE ─────────────────────────────────────
let _sdlDeleteTarget = null;
window.sdlPromptDelete = function(id, name) {
    _sdlDeleteTarget = id;
    document.getElementById('sdl-confirm-name').textContent = name;
    document.getElementById('sdl-confirm').classList.add('show');
};
window.sdlCloseConfirm = function() {
    document.getElementById('sdl-confirm').classList.remove('show');
    _sdlDeleteTarget = null;
};
window.sdlConfirmDelete = async function() {
    if (!_sdlDeleteTarget) return;
    const id = _sdlDeleteTarget;
    sdlCloseConfirm();

    try {
        const res  = await fetch('api/school/delete_learner.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `learner_id=${id}`
        });
        const data = await res.json();
        if (data.success) {
            const row = document.querySelector(`#sdl-tbody tr[data-id="${id}"]`);
            if (row) row.remove();
            window._sdLearnersCache = null;
        }
    } catch(e) {
        alert('Failed to remove learner. Please try again.');
    }
};

// ═══════════════════════════════════════════════════
// LEARNER PROFILE (REPORT CARD VIEW)
// ═══════════════════════════════════════════════════
window.loadSdLearnerProfile = async function(email, name) {
    const content = document.getElementById('sd-content');

    if (window._sdLearnerProfileCache[email]) {
        renderLearnerProfile(window._sdLearnerProfileCache[email]);
        return;
    }

    // Skeleton
    content.innerHTML = `
        <div class="sdp-shell">
            <div class="sd-skeleton" style="height:14px;width:80px;margin-bottom:20px;border-radius:var(--radius);"></div>
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;display:flex;gap:16px;margin-bottom:16px;">
                <div class="sd-skeleton" style="width:56px;height:56px;border-radius:50%;flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div class="sd-skeleton" style="height:18px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:12px;width:260px;"></div>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                ${[1,2,3,4].map(() => `<div class="sd-skeleton" style="flex:1;height:68px;border-radius:var(--radius-lg);"></div>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                ${[1,2,3,4].map(() => `<div class="sd-skeleton" style="height:90px;border-radius:var(--radius-lg);"></div>`).join('')}
            </div>
        </div>`;

    try {
        const res  = await fetch('api/school/get_learner_profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `email=${encodeURIComponent(email)}`
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window._sdLearnerProfileCache[email] = data;
        renderLearnerProfile(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load learner profile.</p>`;
    }
};

function renderLearnerProfile(data) {
    const content  = document.getElementById('sd-content');
    const subjects = data.subjects || [];
    const ct       = data.current_term || 1;

    const initials = (data.first_name?.[0] || '') + (data.surname?.[0] || '');
    const avatar   = data.profile_pic && data.profile_pic !== 'uploads/default_profile.png'
        ? `<img src="${sdlEsc(data.profile_pic)}" class="sdp-hero-avatar" onerror="this.outerHTML='<div class=sdp-hero-avatar-init>${initials}</div>'">`
        : `<div class="sdp-hero-avatar-init">${initials}</div>`;

    const oc = sdlColor(data.overall_avg);

    function termAvg(t) {
        const vals = subjects.map(s => s.terms[t]?.pct).filter(v => v !== null && v !== undefined);
        return vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
    }

    const termTabsHtml = [1,2,3,4].map(t => {
        const avg     = termAvg(t);
        const c       = sdlColor(avg);
        const hasData = subjects.some(s => s.terms[t]?.pct !== null && s.terms[t]?.pct !== undefined);
        return `
            <div class="sdp-term-tab ${t === ct ? 'active' : ''}"
                 id="sdp-tab-${t}"
                 onclick="sdpSwitchTerm(${t})"
                 style="${!hasData ? 'opacity:0.35;pointer-events:none;' : ''}">
                <div class="sdp-term-tab-label">Term ${t}</div>
                <div class="sdp-term-tab-avg" style="color:${hasData ? c.text : 'var(--text-dim)'};">
                    ${avg !== null ? avg + '%' : '—'}
                </div>
                <div class="sdp-term-tab-sub">${t === ct ? 'Current' : (hasData ? 'Done' : 'Upcoming')}</div>
            </div>`;
    }).join('');

    function buildSubjectCards(termNum) {
        if (!subjects.length) {
            return `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:40px;font-size:13px;">No assessments found.</div>`;
        }
        return subjects.map(s => {
            const td  = s.terms[termNum] || {};
            const pct = td.pct ?? null;
            const c   = sdlColor(pct);
            return `
                <div class="sdp-subject-card" style="--accent:${c.border};">
                    <div class="sdp-subject-class">${sdlEsc(s.class_name)}</div>
                    <div class="sdp-subject-name">${sdlEsc(s.name)}</div>
                    <div class="sdp-subject-pct" style="color:${c.text};">
                        ${pct !== null ? pct + '%' : '—'}
                    </div>
                    ${pct !== null ? `
                        <div class="sdp-subject-bar-track">
                            <div class="sdp-subject-bar-fill" style="width:${pct}%;background:${c.text};"></div>
                        </div>
                        <div class="sdp-subject-meta">
                            ${td.count} of ${td.total_count} assessment${td.total_count !== 1 ? 's' : ''} counted
                            ${td.remaining > 0 ? `· ${td.remaining}% still to come` : '· Complete'}
                        </div>
                    ` : `<div class="sdp-subject-no-data">No assessments this term</div>`}
                </div>`;
        }).join('');
    }

    const joinedDate  = data.joined ? new Date(data.joined).toLocaleDateString('en-ZA', { year:'numeric', month:'long', day:'numeric' }) : '—';
    const genderLabel = data.gender === 'male' ? 'Male' : data.gender === 'female' ? 'Female' : data.gender || '—';

    content.innerHTML = `
        <div class="sdp-shell">
            <button class="sdp-back" onclick="loadSdLearners()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                All learners
            </button>

            <!-- HERO -->
            <div class="sdp-hero">
                ${avatar}
                <div class="sdp-hero-info">
                    <div class="sdp-hero-name">${sdlEsc(data.name)}</div>
                    <div class="sdp-hero-meta">
                        <span>${sdlEsc(data.email)}</span><br>
                        ${sdlEsc(data.classes)} · ${sdlEsc(data.school_name)} · ${sdlEsc(data.year_name || '')}
                    </div>
                </div>
                <div class="sdp-overall-badge">
                    <div class="sdp-overall-circle" style="border-color:${oc.border};background:${oc.bg};">
                        <div class="sdp-overall-pct" style="color:${oc.text};">${data.overall_avg !== null ? data.overall_avg + '%' : '—'}</div>
                        <div class="sdp-overall-lbl">Avg</div>
                    </div>
                    <div class="sdp-overall-sub">Overall</div>
                </div>
            </div>

            <!-- PERSONAL DETAILS -->
            <div class="sdp-details-card">
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Gender</div>
                    <div class="sdp-detail-value">${sdlEsc(genderLabel)}</div>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Age</div>
                    <div class="sdp-detail-value">${data.age || '—'}</div>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Email</div>
                    <div class="sdp-detail-value" style="font-size:12px;font-family:var(--font-mono);">${sdlEsc(data.email)}</div>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Enrolled in</div>
                    <div class="sdp-detail-value">${sdlEsc(data.classes)}</div>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Joined</div>
                    <div class="sdp-detail-value" style="font-family:var(--font-mono);font-size:12px;">${joinedDate}</div>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Subjects</div>
                    <div class="sdp-detail-value">${subjects.length}</div>
                </div>
            </div>

            <!-- TERM TABS -->
            <div class="sdp-term-tabs">${termTabsHtml}</div>

            <!-- SUBJECT CARDS -->
            <div class="sdp-subjects-grid" id="sdp-subjects-grid">
                ${buildSubjectCards(ct)}
            </div>
        </div>`;

    content._sdpBuildCards  = buildSubjectCards;
    content._sdpCurrentTerm = ct;
}

window.sdpSwitchTerm = function(term) {
    const content = document.getElementById('sd-content');
    if (!content._sdpBuildCards) return;

    document.querySelectorAll('.sdp-term-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i + 1 === term);
    });

    const grid = document.getElementById('sdp-subjects-grid');
    if (grid) grid.innerHTML = content._sdpBuildCards(term);
    content._sdpCurrentTerm = term;
};