// ══════════════════════════════════════════════════════════
// ANNOUNCEMENTS SECTION — assets/js/school/announcements.js
// ══════════════════════════════════════════════════════════

window._sdAnnCache    = null;
window._sdAnnFilters  = { class_id: 0, term: 0, send_to: '', teacher_email: '' };
window._sdAnnSearch   = '';
window._sdAnnExpanded = null; // id of expanded announcement

// ── INJECT STYLES ──
(function injectAnnStyles() {
    if (document.getElementById('sd-ann-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-ann-styles';
    s.textContent = `
        .sdan-shell { padding: 28px 28px 80px; max-width: 1100px; }

        /* Header */
        .sdan-header {
            display: flex; align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
        }
        .sdan-title { font-size: 22px; font-weight: 900; color: #e2e8f0; margin-bottom: 4px; }
        .sdan-sub   { font-size: 13px; color: #8b949e; }

        /* Stats row */
        .sdan-stats {
            display: flex; gap: 10px; flex-wrap: wrap;
            margin-bottom: 20px;
        }
        .sdan-stat {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            padding: 12px 18px;
            display: flex; align-items: center; gap: 10px;
        }
        .sdan-stat-val  { font-size: 20px; font-weight: 900; }
        .sdan-stat-label{ font-size: 11px; color: #4a5568; font-weight: 700; letter-spacing: 0.5px; }
        .sdan-stat.c-teal   .sdan-stat-val { color: #4fd1c5; }
        .sdan-stat.c-blue   .sdan-stat-val { color: #4e79a7; }
        .sdan-stat.c-orange .sdan-stat-val { color: #f59e0b; }

        /* Toolbar */
        .sdan-toolbar {
            display: flex; align-items: center;
            gap: 10px; margin-bottom: 16px;
            flex-wrap: wrap;
        }

        .sdan-search-wrap {
            position: relative; flex: 1;
            min-width: 180px; max-width: 320px;
        }
        .sdan-search-wrap svg {
            position: absolute; left: 11px; top: 50%;
            transform: translateY(-50%);
            width: 14px; height: 14px; stroke: #4a5568;
            pointer-events: none;
        }
        .sdan-search {
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
        .sdan-search::placeholder { color: #4a5568; }
        .sdan-search:focus { border-color: rgba(79,209,197,0.4); }

        .sdan-select {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 8px 12px;
            font-family: 'Nunito', sans-serif;
            font-size: 12px; font-weight: 700;
            color: #8b949e; outline: none;
            cursor: pointer;
            transition: border-color 0.2s;
        }
        .sdan-select:focus { border-color: rgba(79,209,197,0.4); }

        .sdan-count {
            font-size: 11px; font-weight: 800;
            padding: 5px 12px; border-radius: 20px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            color: #4a5568; white-space: nowrap;
            margin-left: auto;
        }

        /* Announcement cards */
        .sdan-list { display: flex; flex-direction: column; gap: 10px; }

        .sdan-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            overflow: hidden;
            transition: border-color 0.2s;
        }
        .sdan-card:hover { border-color: rgba(255,255,255,0.13); }
        .sdan-card.expanded { border-color: rgba(79,209,197,0.25); }

        .sdan-card-header {
            display: flex; align-items: center;
            gap: 14px; padding: 16px 20px;
            cursor: pointer;
        }

        /* Avatar */
        .sdan-avatar {
            width: 38px; height: 38px;
            border-radius: 50%;
            background: #1b1b1b;
            border: 2px solid #2d3340;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 800;
            color: #8b949e; text-transform: uppercase;
            flex-shrink: 0; overflow: hidden;
        }
        .sdan-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .sdan-card-main { flex: 1; min-width: 0; }
        .sdan-card-title {
            font-size: 14px; font-weight: 800; color: #e2e8f0;
            margin-bottom: 4px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sdan-card-meta {
            display: flex; align-items: center;
            gap: 8px; flex-wrap: wrap;
        }
        .sdan-meta-text { font-size: 11px; color: #4a5568; }
        .sdan-meta-sep  { font-size: 11px; color: #2d3340; }

        /* Badges */
        .sdan-badge {
            font-size: 10px; font-weight: 800;
            padding: 2px 8px; border-radius: 10px;
            letter-spacing: 0.5px; text-transform: uppercase;
            white-space: nowrap;
        }
        .sdan-badge.class   { background: rgba(79,209,197,0.1);  color: #4fd1c5; border: 1px solid rgba(79,209,197,0.2); }
        .sdan-badge.term    { background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }
        .sdan-badge.learners{ background: rgba(78,121,167,0.1);  color: #4e79a7; border: 1px solid rgba(78,121,167,0.2); }
        .sdan-badge.parents { background: rgba(245,158,11,0.1);  color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }

        /* Chevron */
        .sdan-chevron {
            color: #2d3340; flex-shrink: 0;
            transition: transform 0.2s, color 0.2s;
        }
        .sdan-card.expanded .sdan-chevron {
            transform: rotate(180deg);
            color: #4fd1c5;
        }
        .sdan-chevron svg { width: 16px; height: 16px; stroke: currentColor; }

        /* Expanded message body */
        .sdan-card-body {
            display: none;
            padding: 0 20px 20px;
            border-top: 1px solid rgba(255,255,255,0.06);
            margin-top: 0;
        }
        .sdan-card.expanded .sdan-card-body { display: block; }

        .sdan-message {
            font-size: 14px; font-weight: 600;
            color: #c9d1d9; line-height: 1.7;
            padding-top: 16px;
            white-space: pre-wrap;
        }

        .sdan-teacher-line {
            display: flex; align-items: center; gap: 8px;
            margin-top: 14px; padding-top: 14px;
            border-top: 1px solid rgba(255,255,255,0.05);
            font-size: 12px; color: #4a5568;
        }
        .sdan-teacher-line strong { color: #8b949e; }

        /* Empty state */
        .sdan-empty {
            text-align: center; padding: 60px 20px;
            color: #4a5568; font-size: 13px; font-style: italic;
        }

        @media (max-width: 700px) {
            .sdan-shell { padding: 16px 14px 80px; }
            .sdan-toolbar { gap: 8px; }
            .sdan-select { font-size: 11px; padding: 7px 8px; }
        }
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

    // Skeleton
    content.innerHTML = `
        <div class="sdan-shell">
            <div class="sd-skeleton" style="height:22px;width:220px;margin-bottom:8px;"></div>
            <div class="sd-skeleton" style="height:13px;width:300px;margin-bottom:20px;"></div>
            <div style="display:flex;gap:10px;margin-bottom:20px;">
                ${[1,2,3].map(()=>`<div class="sd-skeleton" style="height:56px;width:120px;border-radius:10px;"></div>`).join('')}
            </div>
            ${[1,2,3,4,5].map(()=>`<div class="sd-skeleton" style="height:68px;border-radius:14px;margin-bottom:10px;"></div>`).join('')}
        </div>`;

    try {
        const res  = await fetch('api/school/get_announcements.php');
        const data = await res.json();
        window._sdAnnCache = data;
        renderAnnouncements(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load announcements.</p>`;
    }
};

// ══════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════
function renderAnnouncements(data) {
    const content = document.getElementById('sd-content');
    const f       = window._sdAnnFilters;
    const search  = window._sdAnnSearch.toLowerCase().trim();

    // ── Filter ──
    let list = data.announcements || [];
    if (f.class_id)     list = list.filter(a => a.class_id == f.class_id);
    if (f.term)         list = list.filter(a => a.term == f.term);
    if (f.send_to)      list = list.filter(a => a.send_to === f.send_to);
    if (f.teacher_email)list = list.filter(a => a.teacher_email === f.teacher_email);
    if (search)         list = list.filter(a =>
        a.title.toLowerCase().includes(search) ||
        a.message.toLowerCase().includes(search) ||
        a.teacher_name.toLowerCase().includes(search) ||
        (a.class_name||'').toLowerCase().includes(search)
    );

    // ── Filter dropdowns ──
    const classOptions = (data.classes || []).map(c =>
        `<option value="${c.id}" ${f.class_id == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const teacherOptions = (data.teachers || []).map(t =>
        `<option value="${t.email}" ${f.teacher_email === t.email ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    // ── Cards ──
    const cards = list.length ? list.map(a => {
        const initials  = a.teacher_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
        const picHTML   = a.profile_pic && a.profile_pic !== 'default.png'
            ? `<img src="uploads/teachers/${a.profile_pic}" alt="">`
            : initials;
        const isExpanded = window._sdAnnExpanded === a.id;
        const sendBadge  = a.send_to === 'parents'
            ? `<span class="sdan-badge parents">Parents</span>`
            : `<span class="sdan-badge learners">Learners</span>`;

        return `
            <div class="sdan-card${isExpanded ? ' expanded' : ''}" id="sdan-card-${a.id}">
                <div class="sdan-card-header" onclick="sdanToggle(${a.id})">
                    <div class="sdan-avatar">${picHTML}</div>
                    <div class="sdan-card-main">
                        <div class="sdan-card-title">${a.title}</div>
                        <div class="sdan-card-meta">
                            <span class="sdan-meta-text">${a.teacher_name}</span>
                            <span class="sdan-meta-sep">·</span>
                            <span class="sdan-meta-text">${sdanTimeAgo(a.created_at)}</span>
                            <span class="sdan-meta-sep">·</span>
                            <span class="sdan-badge class">${a.class_name}</span>
                            <span class="sdan-badge term">Term ${a.term}</span>
                            ${sendBadge}
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
                        <strong>Posted by</strong> ${a.teacher_name}
                        &nbsp;·&nbsp;
                        ${new Date(a.created_at).toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                        &nbsp;·&nbsp;
                        Sent to: ${a.send_to === 'parents' ? 'Parents' : 'Learners'}
                    </div>
                </div>
            </div>`;
    }).join('') : `<div class="sdan-empty">No announcements found${search ? ' matching "' + search + '"' : ''}.</div>`;

    content.innerHTML = `
        <div class="sdan-shell">

            <!-- HEADER -->
            <div class="sdan-header">
                <div>
                    <div class="sdan-title">Announcements</div>
                    <div class="sdan-sub">All announcements posted across the school</div>
                </div>
            </div>

            <!-- STATS -->
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
                        <div class="sdan-stat-label">For Learners</div>
                    </div>
                </div>
                <div class="sdan-stat c-orange">
                    <div>
                        <div class="sdan-stat-val">${data.for_parents}</div>
                        <div class="sdan-stat-label">For Parents</div>
                    </div>
                </div>
            </div>

            <!-- TOOLBAR -->
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
                    <option value="0">All Classes</option>
                    ${classOptions}
                </select>

                <select class="sdan-select" onchange="sdanFilter('term', this.value)">
                    <option value="0">All Terms</option>
                    <option value="1" ${f.term==1?'selected':''}>Term 1</option>
                    <option value="2" ${f.term==2?'selected':''}>Term 2</option>
                    <option value="3" ${f.term==3?'selected':''}>Term 3</option>
                    <option value="4" ${f.term==4?'selected':''}>Term 4</option>
                </select>

                <select class="sdan-select" onchange="sdanFilter('send_to', this.value)">
                    <option value="">All Recipients</option>
                    <option value="learners" ${f.send_to==='learners'?'selected':''}>Learners</option>
                    <option value="parents"  ${f.send_to==='parents' ?'selected':''}>Parents</option>
                </select>

                <select class="sdan-select" onchange="sdanFilter('teacher_email', this.value)">
                    <option value="">All Teachers</option>
                    ${teacherOptions}
                </select>

                <span class="sdan-count">${list.length} announcement${list.length !== 1 ? 's' : ''}</span>
            </div>

            <!-- LIST -->
            <div class="sdan-list">${cards}</div>

        </div>`;
}

// ── Toggle expand/collapse — direct DOM, no re-render ──
window.sdanToggle = function(id) {
    const card = document.getElementById('sdan-card-' + id);
    if (!card) return;
    const isExpanded = card.classList.contains('expanded');
    // Collapse all
    document.querySelectorAll('.sdan-card.expanded').forEach(c => c.classList.remove('expanded'));
    // Expand this one if it wasn't already open
    if (!isExpanded) card.classList.add('expanded');
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