function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
// ══════════════════════════════════════════════════════════
// ANNOUNCEMENTS SECTION — assets/js/school/announcements.js
// ══════════════════════════════════════════════════════════

window._sdAnnCache    = null;
window._sdAnnFilters  = { class_id: 0, term: 0, send_to: '', teacher_email: '' };
window._sdAnnSearch   = '';
window._sdAnnExpanded = null;

// ── INJECT STYLES ──
(function injectAnnStyles() {
    if (document.getElementById('sd-ann-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-ann-styles';
    s.textContent = `
        .sdan-shell { padding: 24px 24px 80px; max-width: 1100px; }

        /* ── Header ── */
        .sdan-header {
            display: flex; align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap; gap: 10px;
        }
        .sdan-title { font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
        .sdan-sub   { font-size: 12px; color: var(--text-muted); }

        /* ── New announcement button ── */
        .sdan-new-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: var(--radius);
            background: var(--teal); border: none;
            color: #0d1117; font-size: 13px; font-weight: 600;
            cursor: pointer; font-family: var(--font);
            transition: opacity 0.2s; flex-shrink: 0;
        }
        .sdan-new-btn:hover { opacity: 0.85; }
        .sdan-new-btn svg { width: 13px; height: 13px; stroke: currentColor; }

        /* ── Stats row ── */
        .sdan-stats {
            display: flex; gap: 10px; flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .sdan-stat {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 12px 16px;
            display: flex; align-items: center; gap: 10px;
            transition: border-color 0.15s;
        }
        .sdan-stat:hover { border-color: var(--border-hover); }
        .sdan-stat-val {
            font-size: 18px;
            font-weight: 600;
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
        .sdan-stat-label {
            font-size: 11px;
            color: var(--text-dim);
            font-weight: 500;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }
        .sdan-stat.c-teal   .sdan-stat-val { color: var(--teal);   }
        .sdan-stat.c-blue   .sdan-stat-val { color: var(--blue);   }
        .sdan-stat.c-orange .sdan-stat-val { color: var(--orange); }
        .sdan-stat.c-purple .sdan-stat-val { color: var(--purple); }

        /* ── Toolbar ── */
        .sdan-toolbar {
            display: flex; align-items: center;
            gap: 8px; margin-bottom: 14px;
            flex-wrap: wrap;
        }
        .sdan-search-wrap {
            position: relative; flex: 1;
            min-width: 180px; max-width: 300px;
        }
        .sdan-search-wrap svg {
            position: absolute; left: 10px; top: 50%;
            transform: translateY(-50%);
            width: 13px; height: 13px;
            stroke: var(--text-dim);
            pointer-events: none;
        }
        .sdan-search {
            width: 100%;
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 6px 10px 6px 30px;
            font-family: var(--font);
            font-size: 13px; font-weight: 400;
            color: var(--text); outline: none;
            transition: border-color 0.15s;
        }
        .sdan-search::placeholder { color: var(--text-dim); }
        .sdan-search:focus         { border-color: var(--border-hover); }

        .sdan-select {
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 6px 10px;
            font-family: var(--font);
            font-size: 12px; font-weight: 400;
            color: var(--text-muted); outline: none;
            cursor: pointer;
            transition: border-color 0.15s;
        }
        .sdan-select:focus { border-color: var(--border-hover); }

        .sdan-count {
            font-size: 11px; font-weight: 500;
            padding: 3px 10px; border-radius: 20px;
            background: var(--surface2);
            border: 1px solid var(--border);
            color: var(--text-dim); white-space: nowrap;
            margin-left: auto;
            font-family: var(--font-mono);
        }

        /* ── Announcement cards ── */
        .sdan-list { display: flex; flex-direction: column; gap: 8px; }

        .sdan-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
            transition: border-color 0.15s;
        }
        .sdan-card:hover    { border-color: var(--border-hover); }
        .sdan-card.expanded { border-color: var(--teal-border); }
        /* School-wide cards get orange accent */
        .sdan-card.school-wide { border-left: 3px solid var(--orange); }
        .sdan-card.school-wide.expanded { border-color: rgba(210,153,34,0.4); }

        .sdan-card-header {
            display: flex; align-items: center;
            gap: 12px; padding: 12px 16px;
            cursor: pointer;
        }

        /* Avatar */
        .sdan-avatar {
            width: 30px; height: 30px;
            border-radius: 50%;
            background: var(--surface2);
            border: 1px solid var(--border-hover);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; font-weight: 600;
            color: var(--text-muted); text-transform: uppercase;
            flex-shrink: 0; overflow: hidden;
            font-family: var(--font-mono);
        }
        .sdan-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .sdan-card-main { flex: 1; min-width: 0; }
        .sdan-card-title {
            font-size: 13px; font-weight: 500; color: var(--text);
            margin-bottom: 3px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sdan-card-meta {
            display: flex; align-items: center;
            gap: 6px; flex-wrap: wrap;
        }
        .sdan-meta-text { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
        .sdan-meta-sep  { font-size: 11px; color: var(--text-dim); }

        /* Badges */
        .sdan-badge {
            font-size: 11px; font-weight: 500;
            padding: 2px 7px; border-radius: 20px;
            white-space: nowrap;
            font-family: var(--font-mono);
        }
        .sdan-badge.class    { background: var(--teal-dim);   color: var(--teal);   border: 1px solid var(--teal-border); }
        .sdan-badge.term     { background: var(--purple-dim); color: var(--purple); border: 1px solid rgba(188,140,255,0.2); }
        .sdan-badge.learners { background: var(--blue-dim);   color: var(--blue);   border: 1px solid rgba(88,166,255,0.2); }
        .sdan-badge.parents  { background: var(--orange-dim); color: var(--orange); border: 1px solid rgba(210,153,34,0.2); }
        .sdan-badge.teachers { background: var(--purple-dim); color: var(--purple); border: 1px solid rgba(188,140,255,0.2); }
        .sdan-badge.both     { background: var(--teal-dim);   color: var(--teal);   border: 1px solid var(--teal-border); }
        .sdan-badge.school   { background: var(--orange-dim); color: var(--orange); border: 1px solid rgba(210,153,34,0.2); }

        /* Chevron */
        .sdan-chevron {
            color: var(--border-hover); flex-shrink: 0;
            transition: transform 0.2s, color 0.2s;
        }
        .sdan-card.expanded .sdan-chevron {
            transform: rotate(180deg);
            color: var(--teal);
        }
        .sdan-chevron svg { width: 14px; height: 14px; stroke: currentColor; }

        /* Expanded body */
        .sdan-card-body {
            display: none;
            padding: 0 16px 16px;
            border-top: 1px solid var(--border);
        }
        .sdan-card.expanded .sdan-card-body { display: block; }

        .sdan-message {
            font-size: 13px; font-weight: 400;
            color: var(--text-muted); line-height: 1.7;
            padding-top: 14px;
            white-space: pre-wrap;
        }

        .sdan-teacher-line {
            display: flex; align-items: center; gap: 6px;
            margin-top: 12px; padding-top: 12px;
            border-top: 1px solid var(--border);
            font-size: 11px; color: var(--text-dim);
            font-family: var(--font-mono);
            flex-wrap: wrap;
        }
        .sdan-teacher-line strong { color: var(--text-muted); font-weight: 500; }

        /* Empty state */
        .sdan-empty {
            text-align: center; padding: 60px 20px;
            color: var(--text-dim); font-size: 13px;
        }

        @media (max-width: 700px) {
            .sdan-shell   { padding: 14px 12px 80px; }
            .sdan-toolbar { gap: 6px; }
            .sdan-select  { font-size: 11px; padding: 6px 8px; }
        }

        /* ══════════════════════════════════════
           CREATE ANNOUNCEMENT DRAWER
        ══════════════════════════════════════ */
        .sdan-overlay {
            display: none; position: fixed; inset: 0;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
            z-index: 1200;
        }
        .sdan-overlay.open { display: block; }

        .sdan-drawer {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: 420px; max-width: 100vw;
            background: var(--surface);
            border-left: 1px solid var(--border);
            display: flex; flex-direction: column;
            z-index: 1201;
            transform: translateX(100%);
            transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sdan-drawer.open { transform: translateX(0); }

        .sdan-drawer-hd {
            display: flex; justify-content: space-between; align-items: flex-start;
            padding: 20px 20px 16px; border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }
        .sdan-drawer-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .sdan-drawer-sub   { font-size: 11px; color: var(--text-dim); }
        .sdan-drawer-close {
            background: none; border: none; cursor: pointer; color: var(--text-dim);
            padding: 4px; border-radius: var(--radius);
            transition: color var(--transition), background var(--transition);
        }
        .sdan-drawer-close:hover { color: var(--text); background: var(--surface2); }

        .sdan-drawer-body {
            flex: 1; overflow-y: auto; padding: 20px;
            display: flex; flex-direction: column; gap: 16px;
        }
        .sdan-drawer-body::-webkit-scrollbar { width: 4px; }
        .sdan-drawer-body::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 4px; }

        .sdan-drawer-ft {
            display: flex; gap: 8px; justify-content: flex-end;
            padding: 14px 20px; border-top: 1px solid var(--border); flex-shrink: 0;
        }

        .sdan-field { display: flex; flex-direction: column; gap: 6px; }
        .sdan-label {
            font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
            text-transform: uppercase; color: var(--text-muted);
        }
        .sdan-input, .sdan-textarea {
            background: var(--surface2); border: 1px solid var(--border-hover);
            border-radius: var(--radius); padding: 10px 12px;
            font-family: var(--font); font-size: 13px; color: var(--text);
            outline: none; transition: border-color 0.15s; width: 100%;
        }
        .sdan-input::placeholder, .sdan-textarea::placeholder { color: var(--text-dim); }
        .sdan-input:focus, .sdan-textarea:focus { border-color: var(--teal); }
        .sdan-input.err, .sdan-textarea.err { border-color: var(--red); }
        .sdan-textarea { resize: vertical; min-height: 110px; line-height: 1.6; }
        .sdan-field-err { font-size: 11px; color: var(--red); display: none; }
        .sdan-field-err.show { display: block; }

        .sdan-aud-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .sdan-aud-btn {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 6px 12px; border-radius: var(--radius);
            background: var(--surface2); border: 1px solid var(--border-hover);
            color: var(--text-muted); font-size: 12px; font-weight: 500;
            cursor: pointer; transition: all 0.15s; font-family: var(--font);
        }
        .sdan-aud-btn:hover { border-color: var(--teal); color: var(--teal); }
        .sdan-aud-btn.active {
            background: var(--teal-dim); border-color: var(--teal-border); color: var(--teal);
        }
        .sdan-aud-btn svg { width: 12px; height: 12px; stroke: currentColor; }

        .sdan-push-note {
            display: flex; align-items: flex-start; gap: 7px; padding: 10px 12px;
            border-radius: var(--radius); background: var(--orange-dim);
            border: 1px solid rgba(210,153,34,0.2);
            font-size: 11.5px; color: var(--text-muted); line-height: 1.5;
        }
        .sdan-push-note svg { flex-shrink: 0; margin-top: 1px; stroke: var(--orange); width: 13px; height: 13px; }

        .sdan-cancel-btn {
            padding: 7px 16px; border-radius: var(--radius);
            background: none; border: 1px solid var(--border-hover);
            color: var(--text-muted); font-size: 13px; font-weight: 500;
            cursor: pointer; font-family: var(--font);
            transition: border-color 0.15s, color 0.15s;
        }
        .sdan-cancel-btn:hover { border-color: var(--text-dim); color: var(--text); }
        .sdan-send-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 18px; border-radius: var(--radius);
            background: var(--teal); border: none; color: #0d1117;
            font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--font);
            transition: opacity 0.2s;
        }
        .sdan-send-btn:hover   { opacity: 0.85; }
        .sdan-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .sdan-send-btn svg { width: 13px; height: 13px; stroke: currentColor; }
    `;
    document.head.appendChild(s);
})();

// ── Helpers ──
function sdanTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
}

// ══════════════════════════════════════════════════════════
// LOAD ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════
window.loadSdAnnouncements = async function() {
    const content = document.getElementById('sd-content');

    if (window._sdAnnCache) {
        renderAnnouncements(window._sdAnnCache);
        return;
    }

    content.innerHTML = `
        <div class="sdan-shell">
            <div class="sd-skeleton" style="height:20px;width:220px;margin-bottom:6px;border-radius:var(--radius);"></div>
            <div class="sd-skeleton" style="height:12px;width:280px;margin-bottom:16px;border-radius:var(--radius);"></div>
            <div style="display:flex;gap:10px;margin-bottom:16px;">
                ${[1,2,3].map(()=>`<div class="sd-skeleton" style="height:52px;width:110px;border-radius:var(--radius-lg);"></div>`).join('')}
            </div>
            ${[1,2,3,4,5].map(()=>`<div class="sd-skeleton" style="height:60px;border-radius:var(--radius-lg);margin-bottom:8px;"></div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_announcements.php');
        const data = await res.json();
        window._sdAnnCache = data;
        renderAnnouncements(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load announcements.</p>`;
    }
};

// ══════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════
function renderAnnouncements(data) {
    const content = document.getElementById('sd-content');
    const f       = window._sdAnnFilters;
    const search  = window._sdAnnSearch.toLowerCase().trim();

    let list = data.announcements || [];
    if (f.class_id)      list = list.filter(a => a.class_id == f.class_id);
    if (f.term)          list = list.filter(a => a.term == f.term);
    if (f.send_to)       list = list.filter(a => a.send_to === f.send_to);
    if (f.teacher_email) list = list.filter(a => a.teacher_email === f.teacher_email);
    if (search)          list = list.filter(a =>
        a.title.toLowerCase().includes(search) ||
        a.message.toLowerCase().includes(search) ||
        a.teacher_name.toLowerCase().includes(search) ||
        (a.class_name||'').toLowerCase().includes(search)
    );

    const classOptions = (data.classes || []).map(c =>
        `<option value="${c.id}" ${f.class_id == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const teacherOptions = (data.teachers || []).map(t =>
        `<option value="${t.email}" ${f.teacher_email === t.email ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    const cards = list.length ? list.map(a => {
        const isSchoolWide = !a.class_id;

        // Avatar: school icon for school-wide, initials for teacher
        let avatarContent;
        if (isSchoolWide) {
            avatarContent = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--orange)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        } else {
            const initials = a.teacher_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
            avatarContent  = a.profile_pic && a.profile_pic !== 'default.png'
                ? `<img src="uploads/teachers/${a.profile_pic}" alt="">`
                : initials;
        }

        const isExpanded = window._sdAnnExpanded === a.id;

        // Audience badge
        let audienceBadge;
        if (isSchoolWide) {
            const target = a.target_role;
            if (target === 'teachers')     audienceBadge = `<span class="sdan-badge teachers">Teachers</span>`;
            else if (target === 'learners') audienceBadge = `<span class="sdan-badge learners">Learners</span>`;
            else                            audienceBadge = `<span class="sdan-badge both">Everyone</span>`;
        } else {
            audienceBadge = a.send_to === 'parents'
                ? `<span class="sdan-badge parents">Parents</span>`
                : `<span class="sdan-badge learners">Learners</span>`;
        }

        // Class badge — school-wide shows "School-wide" instead
        const classBadge = isSchoolWide
            ? `<span class="sdan-badge school">School-wide</span>`
            : `<span class="sdan-badge class">${a.class_name}</span>`;

        const senderLabel = isSchoolWide ? 'School Admin' : a.teacher_name;

        return `
            <div class="sdan-card${isExpanded ? ' expanded' : ''}${isSchoolWide ? ' school-wide' : ''}" id="sdan-card-${a.id}">
                <div class="sdan-card-header" onclick="sdanToggle(${a.id})">
                    <div class="sdan-avatar">${avatarContent}</div>
                    <div class="sdan-card-main">
                        <div class="sdan-card-title">${a.title}</div>
                        <div class="sdan-card-meta">
                            <span class="sdan-meta-text">${senderLabel}</span>
                            <span class="sdan-meta-sep">·</span>
                            <span class="sdan-meta-text">${sdanTimeAgo(a.created_at)}</span>
                            <span class="sdan-meta-sep">·</span>
                            ${classBadge}
                            <span class="sdan-badge term">Term ${a.term}</span>
                            ${audienceBadge}
                        </div>
                    </div>
                    <div class="sdan-chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                </div>
                <div class="sdan-card-body">
                    <div class="sdan-message">${a.message}</div>
                    <div class="sdan-teacher-line">
                        <strong>Posted by</strong> ${senderLabel}
                        <span class="sdan-meta-sep">·</span>
                        ${new Date(a.created_at).toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                        <span class="sdan-meta-sep">·</span>
                        ${isSchoolWide ? 'Push notification only' : 'Sent to: ' + (a.send_to === 'parents' ? 'Parents' : 'Learners')}
                    </div>
                </div>
            </div>`;
    }).join('') : `<div class="sdan-empty">No announcements found${search ? ' matching "' + search + '"' : ''}.</div>`;

    content.innerHTML = `
        <div class="sdan-shell">

            <div class="sdan-header">
                <div>
                    <div class="sdan-title">Announcements</div>
                    <div class="sdan-sub">All announcements across the school — teacher-posted and school-wide</div>
                </div>
                <button class="sdan-new-btn" onclick="sdanOpenDrawer()">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    New Announcement
                </button>
            </div>

            <div class="sdan-stats">
                <div class="sdan-stat c-teal">
                    <div>
                        <div class="sdan-stat-val">${data.total}</div>
                        <div class="sdan-stat-label">Total</div>
                    </div>
                </div>
                <div class="sdan-stat c-blue">
                    <div>
                        <div class="sdan-stat-val">${data.for_learners}</div>
                        <div class="sdan-stat-label">For learners</div>
                    </div>
                </div>
                <div class="sdan-stat c-orange">
                    <div>
                        <div class="sdan-stat-val">${data.for_parents}</div>
                        <div class="sdan-stat-label">For parents</div>
                    </div>
                </div>
                <div class="sdan-stat c-purple">
                    <div>
                        <div class="sdan-stat-val">${data.school_wide || 0}</div>
                        <div class="sdan-stat-label">School-wide</div>
                    </div>
                </div>
            </div>

            <div class="sdan-toolbar">
                <div class="sdan-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input class="sdan-search" type="text" placeholder="Search announcements…"
                        value="${window._sdAnnSearch}"
                        oninput="sdanSearch(this.value)">
                </div>

                <select class="sdan-select" onchange="sdanFilter('class_id', this.value)">
                    <option value="0">All classes</option>
                    ${classOptions}
                </select>

                <select class="sdan-select" onchange="sdanFilter('term', this.value)">
                    <option value="0">All terms</option>
                    <option value="1" ${f.term==1?'selected':''}>Term 1</option>
                    <option value="2" ${f.term==2?'selected':''}>Term 2</option>
                    <option value="3" ${f.term==3?'selected':''}>Term 3</option>
                    <option value="4" ${f.term==4?'selected':''}>Term 4</option>
                </select>

                <select class="sdan-select" onchange="sdanFilter('send_to', this.value)">
                    <option value="">All recipients</option>
                    <option value="learners" ${f.send_to==='learners'?'selected':''}>Learners</option>
                    <option value="parents"  ${f.send_to==='parents' ?'selected':''}>Parents</option>
                </select>

                <select class="sdan-select" onchange="sdanFilter('teacher_email', this.value)">
                    <option value="">All teachers</option>
                    ${teacherOptions}
                </select>

                <span class="sdan-count">${list.length} announcement${list.length !== 1 ? 's' : ''}</span>
            </div>

            <div class="sdan-list">${cards}</div>

        </div>

        <!-- ══ CREATE DRAWER ══ -->
        <div id="sdanOverlay" class="sdan-overlay" onclick="sdanCloseDrawer()"></div>
        <div id="sdanDrawer"  class="sdan-drawer">

            <div class="sdan-drawer-hd">
                <div>
                    <div class="sdan-drawer-title">New School Announcement</div>
                    <div class="sdan-drawer-sub">Push notification only — no email sent</div>
                </div>
                <button class="sdan-drawer-close" onclick="sdanCloseDrawer()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="sdan-drawer-body">

                <div class="sdan-field">
                    <label class="sdan-label">Send to</label>
                    <div class="sdan-aud-row">
                        <button type="button" class="sdan-aud-btn active" data-val="both" onclick="sdanSelectAud('both')">
                            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            Everyone
                        </button>
                        <button type="button" class="sdan-aud-btn" data-val="learners" onclick="sdanSelectAud('learners')">
                            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                            </svg>
                            Learners only
                        </button>
                        <button type="button" class="sdan-aud-btn" data-val="teachers" onclick="sdanSelectAud('teachers')">
                            <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                            </svg>
                            Teachers only
                        </button>
                    </div>
                    <input type="hidden" id="sdanSendTo" value="both">
                </div>

                <div class="sdan-field">
                    <label class="sdan-label" for="sdanTitle">Title <span style="color:var(--red);">*</span></label>
                    <input type="text" id="sdanTitle" class="sdan-input" placeholder="e.g. Staff meeting — Friday 14h00" maxlength="200">
                    <div class="sdan-field-err" id="sdanTitleErr">Title is required</div>
                </div>

                <div class="sdan-field">
                    <label class="sdan-label" for="sdanMsg">Message <span style="color:var(--red);">*</span></label>
                    <textarea id="sdanMsg" class="sdan-textarea" placeholder="Write your announcement here…" maxlength="1000" oninput="document.getElementById('sdanCharCount').textContent=this.value.length+' / 1000'"></textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                        <div class="sdan-field-err" id="sdanMsgErr">Message is required</div>
                        <span id="sdanCharCount" style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">0 / 1000</span>
                    </div>
                </div>

                <div class="sdan-push-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Only users with push notifications enabled will receive this. No emails are sent.
                </div>

            </div>

            <div class="sdan-drawer-ft">
                <button class="sdan-cancel-btn" onclick="sdanCloseDrawer()">Cancel</button>
                <button class="sdan-send-btn" id="sdanSendBtn" onclick="sdanSubmit()">
                    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Announcement
                </button>
            </div>

        </div>`;
}

// ── Toggle expand/collapse ──
window.sdanToggle = function(id) {
    const card = document.getElementById('sdan-card-' + id);
    if (!card) return;
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.sdan-card.expanded').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) {
        card.classList.add('expanded');
        window._sdAnnExpanded = id;
    } else {
        window._sdAnnExpanded = null;
    }
};

// ── Filter ──
window.sdanFilter = function(key, val) {
    window._sdAnnFilters[key] = key === 'class_id' || key === 'term' ? parseInt(val) : val;
    window._sdAnnExpanded = null;
    if (window._sdAnnCache) renderAnnouncements(window._sdAnnCache);
};

// ── Search ──
window.sdanSearch = function(val) {
    window._sdAnnSearch   = val;
    window._sdAnnExpanded = null;
    if (window._sdAnnCache) renderAnnouncements(window._sdAnnCache);
};

// ══════════════════════════════════════════════════════════
// DRAWER — open / close / audience / submit
// ══════════════════════════════════════════════════════════
window.sdanOpenDrawer = function() {
    document.getElementById('sdanOverlay').classList.add('open');
    document.getElementById('sdanDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Reset
    document.getElementById('sdanTitle').value  = '';
    document.getElementById('sdanMsg').value    = '';
    document.getElementById('sdanSendTo').value = 'both';
    document.getElementById('sdanCharCount').textContent = '0 / 1000';
    document.querySelectorAll('.sdan-aud-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.sdan-aud-btn[data-val="both"]').classList.add('active');
    document.getElementById('sdanTitleErr').classList.remove('show');
    document.getElementById('sdanMsgErr').classList.remove('show');
    document.getElementById('sdanTitle').classList.remove('err');
    document.getElementById('sdanMsg').classList.remove('err');
};

window.sdanCloseDrawer = function() {
    document.getElementById('sdanOverlay').classList.remove('open');
    document.getElementById('sdanDrawer').classList.remove('open');
    document.body.style.overflow = '';
};

window.sdanSelectAud = function(val) {
    document.getElementById('sdanSendTo').value = val;
    document.querySelectorAll('.sdan-aud-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
    });
};

window.sdanSubmit = async function() {
    const title = document.getElementById('sdanTitle').value.trim();
    const msg   = document.getElementById('sdanMsg').value.trim();
    let valid   = true;

    if (!title) {
        document.getElementById('sdanTitle').classList.add('err');
        document.getElementById('sdanTitleErr').classList.add('show');
        valid = false;
    } else {
        document.getElementById('sdanTitle').classList.remove('err');
        document.getElementById('sdanTitleErr').classList.remove('show');
    }
    if (!msg) {
        document.getElementById('sdanMsg').classList.add('err');
        document.getElementById('sdanMsgErr').classList.add('show');
        valid = false;
    } else {
        document.getElementById('sdanMsg').classList.remove('err');
        document.getElementById('sdanMsgErr').classList.remove('show');
    }
    if (!valid) return;

    const btn = document.getElementById('sdanSendBtn');
    btn.disabled = true;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Sending…`;

    const fd = new FormData();
    fd.append('title',   title);
    fd.append('message', msg);
    fd.append('send_to', document.getElementById('sdanSendTo').value);

    try {
        const res  = await fetch('api/school/create_announcement.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            sdanCloseDrawer();
            // Bust cache so the new announcement appears
            window._sdAnnCache = null;
            loadSdAnnouncements();
            // Toast
            const toast = document.createElement('div');
            toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--teal);color:#0d1117;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);`;
            toast.textContent = `Sent — ${data.sent} device${data.sent !== 1 ? 's' : ''} notified`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.transition='opacity 0.4s'; toast.style.opacity='0'; setTimeout(()=>toast.remove(),400); }, 3500);
        } else {
            alert('Error: ' + (data.error || 'Failed to send.'));
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Announcement`;
        }
    } catch(e) {
        alert('Network error. Please try again.');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Announcement`;
    }
};
