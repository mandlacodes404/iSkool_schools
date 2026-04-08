// ═══════════════════════════════════════════════════════
// LEARNERS SECTION — school_admin_dashboard
// Updated: profile_status badge + expanded personal details card
// ═══════════════════════════════════════════════════════

window._sdLearnersCache = null;
window._sdLearnerProfileCache = {};
window._sdpActiveTab = 'profile'; // 'profile' | 'academic'

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
        gap: 10px;
        flex-wrap: wrap;
        padding: 20px 28px 0;
    }
    .sdl-search {
        flex: 1;
        min-width: 180px;
        max-width: 320px;
        padding: 10px 16px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: #e2e8f0;
        font-size: 13px;
        font-family: 'Nunito', sans-serif;
        transition: border-color 0.2s;
    }
    .sdl-search:focus { outline: none; border-color: #4fd1c5; }
    .sdl-search::placeholder { color: #4a5568; }

    .sdl-filter {
        padding: 10px 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: #e2e8f0;
        font-size: 13px;
        font-family: 'Nunito', sans-serif;
        cursor: pointer;
    }
    .sdl-filter:focus { outline: none; border-color: #4fd1c5; }

    .sdl-count {
        margin-left: auto;
        font-size: 12px;
        font-weight: 700;
        color: #4a5568;
    }

    /* ── TABLE ── */
    .sdl-table-wrap {
        padding: 16px 28px 40px;
        overflow-x: auto;
    }
    .sdl-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    .sdl-table th {
        padding: 10px 14px;
        text-align: left;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #4a5568;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        white-space: nowrap;
        background: rgba(255,255,255,0.02);
        cursor: pointer;
        user-select: none;
    }
    .sdl-table th:hover { color: #8b949e; }
    .sdl-table th.sort-active { color: #4fd1c5; }

    .sdl-table td {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        color: #c9d1d9;
        vertical-align: middle;
    }
    .sdl-table tr:last-child td { border-bottom: none; }
    .sdl-table tr:hover td { background: rgba(255,255,255,0.02); }

    .sdl-learner-cell {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
    }
    .sdl-avatar {
        width: 34px; height: 34px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
        background: rgba(255,255,255,0.05);
    }
    .sdl-avatar-initials {
        width: 34px; height: 34px;
        border-radius: 50%;
        background: rgba(79,209,197,0.12);
        border: 1px solid rgba(79,209,197,0.2);
        color: #4fd1c5;
        font-size: 12px;
        font-weight: 900;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .sdl-name {
        font-weight: 700;
        color: #e2e8f0;
        font-size: 13px;
    }
    .sdl-name:hover { color: #4fd1c5; }
    .sdl-email-sub {
        font-size: 11px;
        color: #4a5568;
        margin-top: 1px;
    }

    .sdl-class-chip {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 20px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: #8b949e;
        white-space: nowrap;
    }

    .sdl-gender {
        font-size: 11px;
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 20px;
    }
    .sdl-gender.male   { background: rgba(78,121,167,0.12); color: #4e79a7; }
    .sdl-gender.female { background: rgba(225,87,89,0.12);  color: #e15759; }
    .sdl-gender.other  { background: rgba(255,255,255,0.05); color: #8b949e; }

    .sdl-avg {
        font-size: 13px;
        font-weight: 800;
    }
    .sdl-avg.green  { color: #22c55e; }
    .sdl-avg.orange { color: #f59e0b; }
    .sdl-avg.red    { color: #f85149; }
    .sdl-avg.gray   { color: #4a5568; }

    /* Profile status badge */
    .sdl-profile-badge {
        font-size: 10px;
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 20px;
        white-space: nowrap;
        letter-spacing: 0.3px;
    }
    .sdl-profile-badge.complete   { background: rgba(34,197,94,0.1);   color: #22c55e; }
    .sdl-profile-badge.incomplete { background: rgba(245,158,11,0.1);  color: #f59e0b; }

    .sdl-delete-btn {
        background: none;
        border: 1px solid rgba(248,81,73,0.2);
        color: #f85149;
        border-radius: 8px;
        padding: 5px 12px;
        font-size: 11px;
        font-weight: 800;
        font-family: 'Nunito', sans-serif;
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.2s;
    }
    .sdl-delete-btn:hover { opacity: 1; background: rgba(248,81,73,0.08); }

    /* ── CONFIRM DIALOG ── */
    .sdl-confirm-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(6px);
        z-index: 9500;
        align-items: center;
        justify-content: center;
    }
    .sdl-confirm-overlay.show { display: flex; }
    .sdl-confirm-box {
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 28px;
        max-width: 380px;
        width: 90%;
        text-align: center;
        animation: sdlPop 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes sdlPop {
        from { opacity:0; transform:scale(0.9); }
        to   { opacity:1; transform:scale(1); }
    }
    .sdl-confirm-icon {
        width: 48px; height: 48px;
        border-radius: 50%;
        background: rgba(248,81,73,0.1);
        border: 1px solid rgba(248,81,73,0.2);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
    }
    .sdl-confirm-title {
        font-size: 16px;
        font-weight: 800;
        color: #e2e8f0;
        margin-bottom: 8px;
    }
    .sdl-confirm-sub {
        font-size: 13px;
        color: #8b949e;
        margin-bottom: 24px;
        line-height: 1.5;
    }
    .sdl-confirm-name {
        color: #e2e8f0;
        font-weight: 700;
    }
    .sdl-confirm-btns { display: flex; gap: 10px; }
    .sdl-confirm-cancel {
        flex: 1;
        padding: 11px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 700;
        font-family: 'Nunito', sans-serif;
        cursor: pointer;
        transition: background 0.2s;
    }
    .sdl-confirm-cancel:hover { background: rgba(255,255,255,0.08); }
    .sdl-confirm-delete {
        flex: 1;
        padding: 11px;
        background: rgba(248,81,73,0.15);
        border: 1px solid rgba(248,81,73,0.3);
        border-radius: 10px;
        color: #f85149;
        font-size: 13px;
        font-weight: 800;
        font-family: 'Nunito', sans-serif;
        cursor: pointer;
        transition: background 0.2s;
    }
    .sdl-confirm-delete:hover { background: rgba(248,81,73,0.25); }

    /* ── PROFILE VIEW ── */
    .sdp-shell { padding: 28px; }

    .sdp-back {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #8b949e;
        cursor: pointer;
        margin-bottom: 24px;
        background: none;
        border: none;
        font-family: 'Nunito', sans-serif;
        padding: 0;
        transition: color 0.2s;
    }
    .sdp-back:hover { color: #e2e8f0; }

    /* ── HERO ── */
    .sdp-hero {
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
    }
    .sdp-hero::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: linear-gradient(90deg, #4fd1c5, #22c55e, #4e79a7);
    }
    .sdp-hero-avatar {
        width: 72px; height: 72px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(79,209,197,0.3);
        flex-shrink: 0;
    }
    .sdp-hero-avatar-init {
        width: 72px; height: 72px;
        border-radius: 50%;
        background: rgba(79,209,197,0.1);
        border: 2px solid rgba(79,209,197,0.3);
        display: flex; align-items: center; justify-content: center;
        font-size: 24px;
        font-weight: 900;
        color: #4fd1c5;
        flex-shrink: 0;
    }
    .sdp-hero-info { flex: 1; }
    .sdp-hero-name {
        font-size: 22px;
        font-weight: 900;
        color: #e2e8f0;
        margin-bottom: 4px;
    }
    .sdp-hero-meta {
        font-size: 13px;
        color: #8b949e;
        line-height: 1.6;
    }
    .sdp-hero-meta span { color: #c9d1d9; font-weight: 600; }

    /* ── PERSONAL DETAILS CARD ── */
    .sdp-details-card {
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 20px;
    }
    .sdp-details-section-title {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #4fd1c5;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(79,209,197,0.15);
    }
    .sdp-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
    }
    .sdp-details-grid:last-child { margin-bottom: 0; }
    .sdp-detail-item {}
    .sdp-detail-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #4a5568;
        margin-bottom: 4px;
    }
    .sdp-detail-value {
        font-size: 14px;
        font-weight: 700;
        color: #e2e8f0;
    }
    .sdp-detail-value.missing {
        color: #4a5568;
        font-style: italic;
        font-weight: 400;
        font-size: 13px;
    }
    .sdp-incomplete-notice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: rgba(245,158,11,0.06);
        border: 1px solid rgba(245,158,11,0.2);
        border-radius: 10px;
        margin-bottom: 20px;
        font-size: 13px;
        color: #f59e0b;
        font-weight: 700;
    }
    .sdp-incomplete-notice svg { flex-shrink: 0; }

    /* ── OVERALL BADGE ── */
    .sdp-overall-badge { text-align: center; flex-shrink: 0; }
    .sdp-overall-circle {
        width: 72px; height: 72px;
        border-radius: 50%;
        border: 3px solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
    }
    .sdp-overall-pct {
        font-size: 20px;
        font-weight: 900;
        line-height: 1;
    }
    .sdp-overall-lbl {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #8b949e;
    }
    .sdp-overall-sub { font-size: 11px; color: #8b949e; }

    /* ── PROFILE TABS ── */
    .sdp-profile-tabs {
        display: flex; gap: 4px;
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 20px;
        width: fit-content;
    }
    .sdp-profile-tab {
        font-size: 13px; font-weight: 800;
        padding: 8px 20px; border-radius: 9px;
        border: none; background: none;
        color: #4a5568; cursor: pointer;
        font-family: 'Nunito', sans-serif;
        transition: all 0.18s;
        display: flex; align-items: center; gap: 7px;
    }
    .sdp-profile-tab:hover { color: #8b949e; }
    .sdp-profile-tab.active {
        background: rgba(79,209,197,0.12);
        border: 1px solid rgba(79,209,197,0.3);
        color: #4fd1c5;
    }
    .sdp-profile-tab svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* ── PROFILE TABS (Profile / Academic) ── */
    .sdp-profile-tabs {
        display: flex;
        gap: 4px;
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 24px;
        width: fit-content;
    }
    .sdp-profile-tab {
        font-size: 13px; font-weight: 800;
        padding: 8px 20px; border-radius: 9px;
        border: none; background: none;
        color: #4a5568; cursor: pointer;
        font-family: 'Nunito', sans-serif;
        transition: all 0.18s;
        display: flex; align-items: center; gap: 7px;
    }
    .sdp-profile-tab:hover { color: #8b949e; }
    .sdp-profile-tab.active {
        background: rgba(79,209,197,0.12);
        border: 1px solid rgba(79,209,197,0.3);
        color: #4fd1c5;
    }
    .sdp-profile-tab svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }

    /* ── TERM TABS ── */
    .sdp-term-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }
    .sdp-term-tab {
        flex: 1;
        padding: 10px 8px;
        text-align: center;
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .sdp-term-tab:hover { border-color: rgba(255,255,255,0.15); }
    .sdp-term-tab.active {
        background: rgba(79,209,197,0.08);
        border-color: rgba(79,209,197,0.35);
    }
    .sdp-term-tab-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #8b949e;
        margin-bottom: 3px;
    }
    .sdp-term-tab.active .sdp-term-tab-label { color: #4fd1c5; }
    .sdp-term-tab-avg {
        font-size: 17px;
        font-weight: 900;
        color: #e2e8f0;
    }
    .sdp-term-tab.active .sdp-term-tab-avg { color: #4fd1c5; }
    .sdp-term-tab-sub {
        font-size: 10px;
        color: #4a5568;
        margin-top: 2px;
    }

    /* ── SUBJECT CARDS ── */
    .sdp-subjects-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
    }
    .sdp-subject-card {
        background: #161b22;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 12px;
        padding: 18px 18px 18px 20px;
        position: relative;
        overflow: hidden;
        transition: border-color 0.2s, transform 0.2s;
    }
    .sdp-subject-card:hover {
        border-color: rgba(255,255,255,0.12);
        transform: translateY(-2px);
    }
    .sdp-subject-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        border-radius: 3px 0 0 3px;
        background: var(--accent, #4a5568);
    }
    .sdp-subject-name {
        font-size: 13px;
        font-weight: 800;
        color: #e2e8f0;
        margin-bottom: 16px;
        padding-right: 70px;
        line-height: 1.3;
        min-height: 32px;
    }
    .sdp-subject-class {
        font-size: 10px;
        color: #4a5568;
        font-weight: 700;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .sdp-subject-pct {
        position: absolute;
        top: 16px; right: 16px;
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
    }
    .sdp-subject-bar-track {
        height: 6px;
        background: rgba(255,255,255,0.06);
        border-radius: 100px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    .sdp-subject-bar-fill {
        height: 100%;
        border-radius: 100px;
        transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
    }
    .sdp-subject-meta { font-size: 11px; color: #4a5568; }
    .sdp-subject-no-data {
        font-size: 12px;
        color: #4a5568;
        font-style: italic;
        padding: 10px 0 4px;
    }

    /* ── EMPTY ── */
    .sdl-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        color: #4a5568;
        text-align: center;
        gap: 12px;
    }
    .sdl-empty h3 { color: #8b949e; font-size: 16px; }

    @media (max-width: 600px) {
        .sdl-toolbar     { padding: 16px 16px 0; }
        .sdl-table-wrap  { padding: 12px 16px 40px; }
        .sdp-shell       { padding: 16px; }
        .sdp-hero        { flex-direction: column; text-align: center; }
        .sdp-subjects-grid { grid-template-columns: 1fr; }
        .sdp-term-tabs   { flex-wrap: wrap; }
        .sdp-term-tab    { min-width: calc(50% - 4px); flex: none; }
        .sdp-details-grid { grid-template-columns: 1fr 1fr; }
    }
    `;
    document.head.appendChild(s);
})();

// ── COLOR HELPER ──────────────────────────────────────
function sdlColor(v) {
    if (v === null || v === undefined) return { cls: 'gray', text: '#4a5568', bg: 'rgba(74,85,104,0.15)', border: '#4a5568' };
    if (v >= 80) return { cls: 'green',  text: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: '#22c55e' };
    if (v >= 60) return { cls: 'green',  text: '#4fd1c5', bg: 'rgba(79,209,197,0.15)',  border: '#4fd1c5' };
    if (v >= 40) return { cls: 'orange', text: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: '#f59e0b' };
    return               { cls: 'red',   text: '#f85149', bg: 'rgba(248,81,73,0.15)',   border: '#f85149' };
}

function sdlEsc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

// ── FIELD DISPLAY HELPER ──
function sdlField(val) {
    if (!val || val === '') return '<span class="sdp-detail-value missing">Not provided</span>';
    return `<span class="sdp-detail-value">${sdlEsc(val)}</span>`;
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

    content.innerHTML = `
        <div style="padding:20px 28px 0;">
            <div class="sd-skeleton" style="height:36px;width:100%;max-width:500px;border-radius:10px;"></div>
        </div>
        <div style="padding:16px 28px;">
            ${[1,2,3,4,5,6].map(() => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div class="sd-skeleton" style="width:34px;height:34px;border-radius:50%;flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div class="sd-skeleton" style="height:13px;width:160px;margin-bottom:5px;"></div>
                        <div class="sd-skeleton" style="height:11px;width:120px;"></div>
                    </div>
                    <div class="sd-skeleton" style="height:24px;width:60px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:24px;width:50px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:24px;width:70px;border-radius:20px;"></div>
                    <div class="sd-skeleton" style="height:24px;width:40px;border-radius:8px;"></div>
                </div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_learners.php');
        const data = await res.json();
        window._sdLearnersCache = data;
        renderLearnersTable(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load learners.</p>`;
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
        <div style="padding:28px 28px 8px;">
            <div style="font-size:22px;font-weight:900;color:#e2e8f0;margin-bottom:4px;">Learners</div>
            <div style="font-size:13px;color:#8b949e;" id="sdl-count-header">${learners.length} learner${learners.length !== 1 ? 's' : ''}</div>
        </div>

        <div class="sdl-toolbar">
            <input type="text" class="sdl-search" placeholder="Search by name or email…"
                   oninput="sdlFilterTable()" id="sdl-search">
            <select class="sdl-filter" id="sdl-class-filter" onchange="sdlFilterTable()">
                <option value="">All Classes</option>
                ${classOptions}
            </select>

        </div>

        <div class="sdl-table-wrap">
            <table class="sdl-table" id="sdl-table">
                <thead>
                    <tr>
                        <th onclick="sdlSort('name')" id="sdth-name">Learner</th>
                        <th onclick="sdlSort('classes')" id="sdth-classes">Class</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="sdl-tbody">
                    ${buildLearnerRows(learners)}
                </tbody>
            </table>
        </div>

        <div class="sdl-confirm-overlay" id="sdl-confirm">
            <div class="sdl-confirm-box">
                <div class="sdl-confirm-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#f85149" stroke-width="2" fill="none">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                    </svg>
                </div>
                <div class="sdl-confirm-title">Remove Learner?</div>
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
        return `<tr><td colspan="3" style="text-align:center;padding:40px;color:#4a5568;font-style:italic;">No learners found.</td></tr>`;
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
            : '<span style="color:#4a5568;font-size:12px;">—</span>';

        const profileStatus  = l.profile_status || 'incomplete';
        const profileBadge   = profileStatus === 'complete'
            ? `<span class="sdl-profile-badge complete">✓ Complete</span>`
            : `<span class="sdl-profile-badge incomplete">Incomplete</span>`;

        return `
            <tr data-id="${l.id}" data-name="${sdlEsc(l.name)}" data-email="${sdlEsc(l.email)}"
                data-classes="${sdlEsc(l.classes)}" data-class-ids="${sdlEsc(l.class_ids)}"
                data-gender="${l.gender || ''}" data-profile="${profileStatus}">
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

    const rows = document.querySelectorAll('#sdl-tbody tr[data-id]');
    let visible = 0;

    rows.forEach(row => {
        const name     = (row.dataset.name  || '').toLowerCase();
        const email    = (row.dataset.email || '').toLowerCase();
        const classIds = (row.dataset.classIds || '').split(',');

        const matchSearch = !search || name.includes(search) || email.includes(search);
        const matchClass  = !classF || classIds.includes(classF);

        const show = matchSearch && matchClass;
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

    content.innerHTML = `
        <div class="sdp-shell">
            <div class="sd-skeleton" style="height:16px;width:80px;margin-bottom:24px;border-radius:6px;"></div>
            <div style="background:#161b22;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;display:flex;gap:20px;margin-bottom:20px;">
                <div class="sd-skeleton" style="width:72px;height:72px;border-radius:50%;flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div class="sd-skeleton" style="height:22px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:13px;width:260px;"></div>
                </div>
            </div>
            <div class="sd-skeleton" style="height:200px;border-radius:14px;margin-bottom:20px;"></div>
            <div style="display:flex;gap:8px;margin-bottom:20px;">
                ${[1,2,3,4].map(() => `<div class="sd-skeleton" style="flex:1;height:72px;border-radius:10px;"></div>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                ${[1,2,3,4].map(() => `<div class="sd-skeleton" style="height:100px;border-radius:12px;"></div>`).join('')}
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
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load learner profile.</p>`;
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
                <div class="sdp-term-tab-avg" style="color:${hasData ? c.text : '#4a5568'};">
                    ${avg !== null ? avg + '%' : '—'}
                </div>
                <div class="sdp-term-tab-sub">${t === ct ? 'Current' : (hasData ? 'Done' : 'Upcoming')}</div>
            </div>`;
    }).join('');

    function buildSubjectCards(termNum) {
        if (!subjects.length) {
            return `<div style="grid-column:1/-1;text-align:center;color:#4a5568;padding:40px;font-style:italic;">No assessments found.</div>`;
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
    const isIncomplete = data.profile_status !== 'complete';

    // ── Profile tab HTML ──
    const profileTabHTML = `
        <div class="sdp-details-card">
            ${isIncomplete ? `
            <div class="sdp-incomplete-notice">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Profile incomplete — learner has not filled in all personal details yet
            </div>` : ''}

            <div class="sdp-details-section-title">Identity</div>
            <div class="sdp-details-grid">
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Gender</div>
                    ${sdlField(genderLabel)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Date of Birth</div>
                    ${sdlField(data.date_of_birth)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Age</div>
                    ${sdlField(data.age ? String(data.age) : null)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">ID Number</div>
                    ${sdlField(data.id_number)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Email</div>
                    <span class="sdp-detail-value" style="font-size:12px;">${sdlEsc(data.email)}</span>
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Address</div>
                    ${sdlField(data.address)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Enrolled In</div>
                    ${sdlField(data.classes)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Joined</div>
                    <span class="sdp-detail-value" style="font-size:12px;">${joinedDate}</span>
                </div>
            </div>

            <div class="sdp-details-section-title">Guardian / Parent</div>
            <div class="sdp-details-grid">
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Guardian Name</div>
                    ${sdlField(data.guardian_name)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Relationship</div>
                    ${sdlField(data.guardian_relationship)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Guardian Phone</div>
                    ${sdlField(data.guardian_phone)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Guardian Email</div>
                    ${sdlField(data.guardian_email)}
                </div>
            </div>

            <div class="sdp-details-section-title">Emergency & Medical</div>
            <div class="sdp-details-grid">
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Emergency Contact</div>
                    ${sdlField(data.emergency_contact_name)}
                </div>
                <div class="sdp-detail-item">
                    <div class="sdp-detail-label">Emergency Phone</div>
                    ${sdlField(data.emergency_contact_phone)}
                </div>
                <div class="sdp-detail-item" style="grid-column:1/-1;">
                    <div class="sdp-detail-label">Medical Notes</div>
                    ${sdlField(data.medical_notes)}
                </div>
            </div>
        </div>`;

    // ── Academic tab HTML ──
    const academicTabHTML = `
        <div class="sdp-term-tabs">${termTabsHtml}</div>
        <div class="sdp-subjects-grid" id="sdp-subjects-grid">
            ${buildSubjectCards(ct)}
        </div>`;

    content.innerHTML = `
        <div class="sdp-shell">
            <button class="sdp-back" onclick="loadSdLearners()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                All Learners
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

            <!-- PROFILE / ACADEMIC TABS -->
            <div class="sdp-profile-tabs">
                <button class="sdp-profile-tab active" id="sdp-ptab-profile" onclick="sdpSwitchProfileTab('profile')">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                    ${isIncomplete ? '<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;margin-left:2px;"></span>' : ''}
                </button>
                <button class="sdp-profile-tab" id="sdp-ptab-academic" onclick="sdpSwitchProfileTab('academic')">
                    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    Academic
                </button>
            </div>

            <!-- TAB CONTENT -->
            <div id="sdp-tab-content">
                ${profileTabHTML}
            </div>
        </div>`;

    // Store for tab switching
    content._sdpBuildCards    = buildSubjectCards;
    content._sdpCurrentTerm   = ct;
    content._sdpProfileHTML   = profileTabHTML;
    content._sdpAcademicHTML  = academicTabHTML;
    content._sdpActiveTab     = 'profile';
}

window.sdpSwitchProfileTab = function(tab) {
    const content = document.getElementById('sd-content');
    const tabContent = document.getElementById('sdp-tab-content');
    if (!tabContent) return;

    document.getElementById('sdp-ptab-profile')?.classList.toggle('active', tab === 'profile');
    document.getElementById('sdp-ptab-academic')?.classList.toggle('active', tab === 'academic');

    if (tab === 'profile') {
        tabContent.innerHTML = content._sdpProfileHTML;
    } else {
        tabContent.innerHTML = content._sdpAcademicHTML;
    }
    content._sdpActiveTab = tab;
};

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