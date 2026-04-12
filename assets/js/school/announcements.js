/**
 * iSkool — assets/js/school/announcements.js
 * Handles the Announcements section inside school_admin_dashboard.php
 * Loaded via: <script src="assets/js/school/announcements.js?v=1.3"></script>
 *
 * Exposes: loadSdAnnouncements()
 * Called from: loadSection('announcements') in school_admin_dashboard.php
 */

// ══════════════════════════════════════════════════
// ENTRY POINT — called by the dashboard router
// ══════════════════════════════════════════════════
async function loadSdAnnouncements() {
    const content = document.getElementById('sd-content');

    // ── Skeleton ──
    content.innerHTML = `
        <div class="sd-ann-wrap">
            <div class="sd-page-header">
                <div>
                    <div class="sd-skeleton" style="height:20px;width:200px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:12px;width:280px;"></div>
                </div>
                <div class="sd-skeleton" style="height:32px;width:140px;border-radius:6px;"></div>
            </div>
            ${[1,2,3].map(() => `
                <div class="sd-ann-item" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:10px;">
                    <div class="sd-skeleton" style="height:13px;width:40%;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:11px;width:70%;margin-bottom:6px;"></div>
                    <div class="sd-skeleton" style="height:11px;width:55%;"></div>
                </div>`).join('')}
        </div>`;

    // ── Fetch ──
    let data;
    try {
        const res = await fetch('api/school/get_announcements.php');
        data = await res.json();
    } catch (e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">Failed to load announcements.</p>`;
        return;
    }

    if (!data.success) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;font-size:13px;">${data.error || 'Failed to load announcements.'}</p>`;
        return;
    }

    renderSdAnnouncements(data.announcements);
}

// ══════════════════════════════════════════════════
// RENDER — list view
// ══════════════════════════════════════════════════
function renderSdAnnouncements(announcements) {
    const content = document.getElementById('sd-content');

    function timeAgo(dateStr) {
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
        if (diff < 60)    return diff + 's ago';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    }

    function audienceBadge(targetRole) {
        const map = {
            all:      { label: 'Everyone',  color: 'var(--teal)',   bg: 'var(--teal-dim)',   border: 'var(--teal-border)' },
            learners: { label: 'Learners',  color: 'var(--blue)',   bg: 'var(--blue-dim)',   border: 'rgba(88,166,255,0.25)' },
            teachers: { label: 'Teachers',  color: 'var(--purple)', bg: 'var(--purple-dim)', border: 'rgba(188,140,255,0.25)' },
        };
        const s = map[targetRole] || map['all'];
        return `<span style="
            font-size:10px;font-weight:500;font-family:var(--font-mono);
            padding:2px 8px;border-radius:20px;
            color:${s.color};background:${s.bg};border:1px solid ${s.border};
        ">${s.label}</span>`;
    }

    const listHtml = announcements.length === 0
        ? `<div class="sd-coming-soon" style="padding:60px 0;">
               <svg viewBox="0 0 24 24" width="40" height="40" stroke="var(--text-dim)" stroke-width="1.5" fill="none">
                   <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                   <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
               </svg>
               <h3 style="margin-top:12px;">No school-wide announcements yet</h3>
               <p>Use the button above to send your first announcement to staff or learners.</p>
           </div>`
        : announcements.map(a => `
            <div class="sd-ann-item">
                <div class="sd-ann-item-header">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="sd-ann-item-title">${escHtml(a.title)}</span>
                        ${audienceBadge(a.target_role)}
                    </div>
                    <span class="sd-ann-item-time">${timeAgo(a.created_at)}</span>
                </div>
                <div class="sd-ann-item-msg">${escHtml(a.message)}</div>
                <div class="sd-ann-item-meta">
                    Sent by <strong>${escHtml(a.sender_display)}</strong>
                    &nbsp;·&nbsp; Term ${a.term_number}
                    &nbsp;·&nbsp; ${new Date(a.created_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })}
                </div>
            </div>`).join('');

    content.innerHTML = `
        <div class="sd-ann-wrap">

            <!-- PAGE HEADER -->
            <div class="sd-page-header">
                <div>
                    <div class="sd-page-title">School Announcements</div>
                    <div class="sd-page-sub">School-wide messages sent to staff and learners via push notification</div>
                </div>
                <button class="sd-ann-new-btn" onclick="openAnnDrawer()">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    New Announcement
                </button>
            </div>

            <!-- LIST -->
            <div id="sdAnnList">
                ${listHtml}
            </div>

        </div>

        <!-- ══ CREATE DRAWER ══ -->
        <div id="sdAnnOverlay" class="sd-ann-overlay" onclick="closeAnnDrawer()"></div>
        <div id="sdAnnDrawer" class="sd-ann-drawer">

            <div class="sd-ann-drawer-header">
                <div>
                    <div class="sd-ann-drawer-title">New Announcement</div>
                    <div class="sd-ann-drawer-sub">Sent as a push notification — no email</div>
                </div>
                <button class="sd-ann-drawer-close" onclick="closeAnnDrawer()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div class="sd-ann-drawer-body">

                <!-- AUDIENCE -->
                <div class="sd-ann-field">
                    <label class="sd-ann-label">Send to</label>
                    <div class="sd-ann-audience-row">
                        <button type="button" class="sd-ann-aud-btn active" data-val="both"     onclick="selectAudience('both')">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Everyone
                        </button>
                        <button type="button" class="sd-ann-aud-btn" data-val="learners"  onclick="selectAudience('learners')">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                            Learners only
                        </button>
                        <button type="button" class="sd-ann-aud-btn" data-val="teachers"  onclick="selectAudience('teachers')">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            Teachers only
                        </button>
                    </div>
                    <input type="hidden" id="annSendTo" value="both">
                </div>

                <!-- TITLE -->
                <div class="sd-ann-field">
                    <label class="sd-ann-label" for="annTitle">Title <span style="color:var(--red);">*</span></label>
                    <input type="text" id="annTitle" class="sd-ann-input" placeholder="e.g. Staff Meeting — Friday 14h00" maxlength="200">
                    <div class="sd-ann-err" id="annTitleErr">Title is required</div>
                </div>

                <!-- MESSAGE -->
                <div class="sd-ann-field">
                    <label class="sd-ann-label" for="annMessage">Message <span style="color:var(--red);">*</span></label>
                    <textarea id="annMessage" class="sd-ann-textarea" placeholder="Write your announcement here..." maxlength="1000" oninput="updateAnnCharCount(this)"></textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                        <div class="sd-ann-err" id="annMsgErr">Message is required</div>
                        <span id="annCharCount" style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">0 / 1000</span>
                    </div>
                </div>

                <!-- PUSH NOTE -->
                <div class="sd-ann-push-note">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Only users with push notifications enabled will receive this. No emails are sent.
                </div>

            </div>

            <div class="sd-ann-drawer-footer">
                <button class="sd-ann-cancel-btn" onclick="closeAnnDrawer()">Cancel</button>
                <button class="sd-ann-send-btn" id="annSendBtn" onclick="submitAnnouncement()">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send Announcement
                </button>
            </div>

        </div>

        <!-- ── INLINE STYLES (scoped to announcements section) ── -->
        <style>
            /* ── Wrap ── */
            .sd-ann-wrap { padding: 24px 24px 80px; max-width: 860px; }

            /* ── New button ── */
            .sd-ann-new-btn {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 7px 14px; border-radius: var(--radius);
                background: var(--teal); color: #0d1117;
                border: none; cursor: pointer;
                font-size: 13px; font-weight: 600;
                transition: opacity 0.2s;
            }
            .sd-ann-new-btn:hover { opacity: 0.85; }

            /* ── List items ── */
            .sd-ann-item {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-lg);
                padding: 16px 18px;
                margin-bottom: 8px;
                transition: border-color var(--transition);
            }
            .sd-ann-item:hover { border-color: var(--border-hover); }
            .sd-ann-item-header {
                display: flex; justify-content: space-between;
                align-items: flex-start; gap: 12px; margin-bottom: 8px;
            }
            .sd-ann-item-title {
                font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4;
            }
            .sd-ann-item-time {
                font-size: 11px; color: var(--text-dim);
                font-family: var(--font-mono); white-space: nowrap; flex-shrink: 0;
            }
            .sd-ann-item-msg {
                font-size: 13px; color: var(--text-muted);
                line-height: 1.55; margin-bottom: 10px;
                display: -webkit-box; -webkit-line-clamp: 2;
                -webkit-box-orient: vertical; overflow: hidden;
            }
            .sd-ann-item-meta {
                font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);
            }
            .sd-ann-item-meta strong { color: var(--text-muted); font-weight: 500; }

            /* ── Drawer overlay ── */
            .sd-ann-overlay {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
                z-index: 1200;
            }
            .sd-ann-overlay.open { display: block; }

            /* ── Drawer ── */
            .sd-ann-drawer {
                position: fixed; top: 0; right: 0; bottom: 0;
                width: 420px; max-width: 100vw;
                background: var(--surface);
                border-left: 1px solid var(--border);
                display: flex; flex-direction: column;
                z-index: 1201;
                transform: translateX(100%);
                transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .sd-ann-drawer.open { transform: translateX(0); }

            .sd-ann-drawer-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                padding: 20px 20px 16px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .sd-ann-drawer-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
            .sd-ann-drawer-sub   { font-size: 11px; color: var(--text-dim); }
            .sd-ann-drawer-close {
                background: none; border: none; cursor: pointer;
                color: var(--text-dim); padding: 4px;
                border-radius: var(--radius); transition: color var(--transition), background var(--transition);
            }
            .sd-ann-drawer-close:hover { color: var(--text); background: var(--surface2); }

            .sd-ann-drawer-body {
                flex: 1; overflow-y: auto; padding: 20px;
                display: flex; flex-direction: column; gap: 18px;
            }
            .sd-ann-drawer-body::-webkit-scrollbar { width: 4px; }
            .sd-ann-drawer-body::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 4px; }

            .sd-ann-drawer-footer {
                display: flex; gap: 8px; justify-content: flex-end;
                padding: 14px 20px;
                border-top: 1px solid var(--border);
                flex-shrink: 0;
            }

            /* ── Form elements ── */
            .sd-ann-field { display: flex; flex-direction: column; gap: 6px; }
            .sd-ann-label {
                font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
                text-transform: uppercase; color: var(--text-muted);
            }
            .sd-ann-input, .sd-ann-textarea {
                background: var(--surface2); border: 1px solid var(--border-hover);
                border-radius: var(--radius); padding: 10px 12px;
                font-family: var(--font); font-size: 13px; color: var(--text);
                outline: none; transition: border-color var(--transition);
                width: 100%;
            }
            .sd-ann-input::placeholder, .sd-ann-textarea::placeholder { color: var(--text-dim); }
            .sd-ann-input:focus, .sd-ann-textarea:focus { border-color: var(--teal); }
            .sd-ann-input.err, .sd-ann-textarea.err { border-color: var(--red); }
            .sd-ann-textarea { resize: vertical; min-height: 120px; line-height: 1.6; }

            .sd-ann-err { font-size: 11px; color: var(--red); display: none; }
            .sd-ann-err.show { display: block; }

            /* ── Audience buttons ── */
            .sd-ann-audience-row { display: flex; gap: 6px; flex-wrap: wrap; }
            .sd-ann-aud-btn {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 6px 12px; border-radius: var(--radius);
                background: var(--surface2); border: 1px solid var(--border-hover);
                color: var(--text-muted); font-size: 12px; font-weight: 500;
                cursor: pointer; transition: all var(--transition);
                font-family: var(--font);
            }
            .sd-ann-aud-btn:hover { border-color: var(--teal); color: var(--teal); }
            .sd-ann-aud-btn.active {
                background: var(--teal-dim); border-color: var(--teal-border);
                color: var(--teal);
            }

            /* ── Push note ── */
            .sd-ann-push-note {
                display: flex; align-items: flex-start; gap: 7px;
                padding: 10px 12px; border-radius: var(--radius);
                background: var(--orange-dim); border: 1px solid rgba(210,153,34,0.2);
                font-size: 11.5px; color: var(--text-muted); line-height: 1.5;
            }
            .sd-ann-push-note svg { flex-shrink: 0; margin-top: 1px; stroke: var(--orange); }

            /* ── Footer buttons ── */
            .sd-ann-cancel-btn {
                padding: 7px 16px; border-radius: var(--radius);
                background: none; border: 1px solid var(--border-hover);
                color: var(--text-muted); font-size: 13px; font-weight: 500;
                cursor: pointer; font-family: var(--font);
                transition: border-color var(--transition), color var(--transition);
            }
            .sd-ann-cancel-btn:hover { border-color: var(--text-dim); color: var(--text); }

            .sd-ann-send-btn {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 7px 18px; border-radius: var(--radius);
                background: var(--teal); border: none;
                color: #0d1117; font-size: 13px; font-weight: 600;
                cursor: pointer; font-family: var(--font);
                transition: opacity 0.2s;
            }
            .sd-ann-send-btn:hover   { opacity: 0.85; }
            .sd-ann-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

            @media (max-width: 600px) {
                .sd-ann-wrap  { padding: 16px 12px 80px; }
                .sd-ann-drawer { width: 100vw; }
            }
        </style>`;
}

// ══════════════════════════════════════════════════
// DRAWER — open / close
// ══════════════════════════════════════════════════
function openAnnDrawer() {
    document.getElementById('sdAnnOverlay').classList.add('open');
    document.getElementById('sdAnnDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Reset form
    document.getElementById('annTitle').value   = '';
    document.getElementById('annMessage').value = '';
    document.getElementById('annSendTo').value  = 'both';
    document.getElementById('annCharCount').textContent = '0 / 1000';
    document.querySelectorAll('.sd-ann-aud-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.sd-ann-aud-btn[data-val="both"]').classList.add('active');
    clearAnnErrors();
}

function closeAnnDrawer() {
    document.getElementById('sdAnnOverlay').classList.remove('open');
    document.getElementById('sdAnnDrawer').classList.remove('open');
    document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════
// AUDIENCE SELECTION
// ══════════════════════════════════════════════════
function selectAudience(val) {
    document.getElementById('annSendTo').value = val;
    document.querySelectorAll('.sd-ann-aud-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
    });
}

// ══════════════════════════════════════════════════
// CHAR COUNT
// ══════════════════════════════════════════════════
function updateAnnCharCount(el) {
    const count = el.value.length;
    document.getElementById('annCharCount').textContent = count + ' / 1000';
}

// ══════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════
function clearAnnErrors() {
    ['annTitle', 'annMessage'].forEach(id => {
        document.getElementById(id).classList.remove('err');
    });
    document.getElementById('annTitleErr').classList.remove('show');
    document.getElementById('annMsgErr').classList.remove('show');
}

function validateAnn() {
    let valid = true;
    const title = document.getElementById('annTitle').value.trim();
    const msg   = document.getElementById('annMessage').value.trim();

    if (!title) {
        document.getElementById('annTitle').classList.add('err');
        document.getElementById('annTitleErr').classList.add('show');
        valid = false;
    } else {
        document.getElementById('annTitle').classList.remove('err');
        document.getElementById('annTitleErr').classList.remove('show');
    }
    if (!msg) {
        document.getElementById('annMessage').classList.add('err');
        document.getElementById('annMsgErr').classList.add('show');
        valid = false;
    } else {
        document.getElementById('annMessage').classList.remove('err');
        document.getElementById('annMsgErr').classList.remove('show');
    }
    return valid;
}

// ══════════════════════════════════════════════════
// SUBMIT
// ══════════════════════════════════════════════════
async function submitAnnouncement() {
    if (!validateAnn()) return;

    const btn = document.getElementById('annSendBtn');
    btn.disabled = true;
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
        Sending…`;

    const formData = new FormData();
    formData.append('title',   document.getElementById('annTitle').value.trim());
    formData.append('message', document.getElementById('annMessage').value.trim());
    formData.append('send_to', document.getElementById('annSendTo').value);

    try {
        const res  = await fetch('api/school/create_announcement.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            closeAnnDrawer();
            // Invalidate cache so list refreshes
            if (window._sdCache) delete window._sdCache.announcements;
            // Reload the section fresh
            await loadSdAnnouncements();
            // Brief toast
            showAnnToast(`Announcement sent — ${data.sent} device${data.sent !== 1 ? 's' : ''} notified`);
        } else {
            alert('Error: ' + (data.error || 'Failed to send announcement.'));
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send Announcement`;
        }
    } catch (err) {
        alert('Network error. Please try again.');
        btn.disabled = false;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send Announcement`;
    }
}

// ══════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════
function showAnnToast(message) {
    // Remove any existing toast
    const existing = document.getElementById('sdAnnToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'sdAnnToast';
    toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: var(--teal); color: #0d1117;
        padding: 10px 20px; border-radius: 6px;
        font-size: 13px; font-weight: 600;
        z-index: 9999; white-space: nowrap;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        animation: annToastIn 0.3s ease;
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `@keyframes annToastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity    = '0';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ══════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════
function escHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
}