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
                        <span class="sdan-meta-sep">·</span>
                        ${new Date(a.created_at).toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                        <span class="sdan-meta-sep">·</span>
                        Sent to: ${a.send_to === 'parents' ? 'Parents' : 'Learners'}
                    </div>
                </div>
            </div>`;
    }).join('') : `<div class="sdan-empty">No announcements found${search ? ' matching "' + search + '"' : ''}.</div>`;

    content.innerHTML = `
        <div class="sdan-shell">

            <div class="sdan-header">
                <div>
                    <div class="sdan-title">Announcements</div>
                    <div class="sdan-sub">All announcements posted across the school</div>
                </div>
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

        </div>`;
}

// ── Toggle expand/collapse ──
window.sdanToggle = function(id) {
    const card = document.getElementById('sdan-card-' + id);
    if (!card) return;
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.sdan-card.expanded').forEach(c => c.classList.remove('expanded'));
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