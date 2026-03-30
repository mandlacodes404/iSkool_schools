/* assets/js/learner/discussions.js */

window.discussionCache       = null;
window.discussionThreadCache = {};
window.teacherListCache      = null;
let discPollInterval         = null;
let discTypingPollInterval   = null;
let discTypingTimeout        = null;
let currentDiscId            = null;
let lastReplyId              = 0;
let lastSeenDateKey          = null;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatTime(dateStr) {
    const d = new Date(dateStr.replace(' ','T'));
    return d.toLocaleTimeString('en-GB', { hour:'numeric', minute:'2-digit', hour12:true });
}

function getDateKey(dateStr)   { return dateStr.substring(0, 10); }

function getDateLabel(dateStr) {
    const d         = new Date(dateStr.replace(' ','T'));
    const today     = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const dc        = new Date(d); dc.setHours(0,0,0,0);
    if (dc.getTime() === today.getTime())     return 'Today';
    if (dc.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function stopDiscPolling() {
    clearInterval(discPollInterval);
    clearInterval(discTypingPollInterval);
    clearTimeout(discTypingTimeout);
    discPollInterval       = null;
    discTypingPollInterval = null;
    currentDiscId          = null;
}

// Returns true when the split layout should be active
function isDesktop() { return window.innerWidth >= 768; }

// Thread target: right panel on desktop, full api-content-area on mobile
function getThreadTarget() {
    if (isDesktop()) return document.getElementById('disc-thread-panel');
    return document.getElementById('api-content-area');
}

// ─────────────────────────────────────────────
// 1. DISCUSSION LIST
// ─────────────────────────────────────────────
window.fetchDiscussions = async function() {
    stopDiscPolling();
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    sessionStorage.setItem("lastLearnerPage", "discussion_list.php");
    if (typeof window.setActive === 'function') window.setActive("discussion_list.php");
    if (window.configureHeader) window.configureHeader({ title: 'Discussions', mode: 'standard' });

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    // On desktop: inject the split shell once
    if (isDesktop() && !document.getElementById('disc-split-wrap')) {
        injectDesktopShell(apiArea);
    }

    if (window.discussionCache) {
        renderDiscussions(window.discussionCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/learner/get_discussions.php');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        window.discussionCache = data;
        renderDiscussions(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading discussions.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ── Inject the desktop split shell into api-content-area (runs once)
function injectDesktopShell(apiArea) {
    apiArea.innerHTML = `
        <style>
            #disc-split-wrap {
                display: flex;
                height: calc(100vh - 64px);
                overflow: hidden;
            }
            #disc-sidebar {
                width: 300px;
                min-width: 260px;
                max-width: 320px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                background: #111;
                border-right: 1px solid rgba(255,255,255,0.07);
            }
            #disc-sidebar-head {
                padding: 14px 14px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }
            #disc-sidebar-head span {
                font-size: 13px;
                font-weight: 700;
                color: #e2e8f0;
                font-family: 'Nunito', sans-serif;
                letter-spacing: 0.01em;
            }
            #disc-new-btn {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                border: 1px solid rgba(79,209,197,0.3);
                padding: 5px 12px;
                border-radius: 7px;
                cursor: pointer;
                font-weight: 700;
                font-family: 'Nunito', sans-serif;
                font-size: 12px;
                transition: background 0.15s;
                white-space: nowrap;
            }
            #disc-new-btn:hover { background: rgba(79,209,197,0.2); }
            #disc-sidebar-list {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                scrollbar-width: thin;
                scrollbar-color: #1b1b1b transparent;
            }
            .dsk-item {
                padding: 11px 12px;
                border-radius: 8px;
                cursor: pointer;
                margin-bottom: 2px;
                border: 1px solid transparent;
                transition: background 0.15s, border-color 0.15s;
            }
            .dsk-item:hover { background: rgba(255,255,255,0.04); }
            .dsk-item.active {
                background: rgba(79,209,197,0.07);
                border-color: rgba(79,209,197,0.2);
            }
            .dsk-item-title {
                font-size: 12px;
                font-weight: 700;
                color: #e2e8f0;
                font-family: 'Nunito', sans-serif;
                line-height: 1.35;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dsk-item.active .dsk-item-title { color: #4fd1c5; }
            .dsk-item-meta {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 10px;
                color: #8b949e;
                font-family: 'Nunito', sans-serif;
            }
            .dsk-item-pill {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                padding: 1px 6px;
                border-radius: 10px;
                font-size: 9px;
                font-weight: 700;
            }
            .dsk-item-preview {
                font-size: 10px;
                color: #8b949e;
                font-family: 'Nunito', sans-serif;
                margin-top: 3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dsk-empty {
                padding: 40px 16px;
                text-align: center;
                font-size: 12px;
                color: #8b949e;
                font-family: 'Nunito', sans-serif;
            }
            #disc-thread-panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #0f0f0f;
            }
            .disc-empty-state {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 10px;
                color: #8b949e;
                font-family: 'Nunito', sans-serif;
                height: 100%;
            }
            .disc-empty-state i { font-size: 36px; color: rgba(79,209,197,0.2); }
            .disc-empty-state p { font-size: 13px; font-weight: 600; }
            .disc-empty-state small { font-size: 11px; color: #555; }
        </style>

        <div id="disc-split-wrap">
            <div id="disc-sidebar">
                <div id="disc-sidebar-head">
                    <span>Discussions</span>
                    <button id="disc-new-btn" onclick="loadCreateDiscussion()">
                        <i class="fas fa-plus"></i> New
                    </button>
                </div>
                <div id="disc-sidebar-list">
                    <div class="dsk-empty">Loading...</div>
                </div>
            </div>
            <div id="disc-thread-panel">
                <div class="disc-empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Select a discussion</p>
                    <small>Choose one from the list to join the conversation</small>
                </div>
            </div>
        </div>`;
}

// ── Route list rendering by device
function renderDiscussions(data) {
    if (isDesktop()) {
        renderSidebarList(data);
    } else {
        renderMobileList(data);
    }
}

function renderSidebarList(data) {
    const list = document.getElementById('disc-sidebar-list');
    if (!list) return;

    if (!data || data.length === 0) {
        list.innerHTML = `<div class="dsk-empty">No discussions yet.<br>Be the first to start one!</div>`;
        return;
    }

    list.innerHTML = data.map(d => `
        <div class="dsk-item" data-disc-id="${d.id}" onclick="loadDiscussionThread(${d.id})">
            <div class="dsk-item-title">${escHtml(d.title)}</div>
            <div class="dsk-item-meta">
                <span>${escHtml(d.display_date)}</span>
                <span class="dsk-item-pill">${d.reply_count} ${d.reply_count == 1 ? 'reply' : 'replies'}</span>
            </div>
            <div class="dsk-item-preview">${escHtml(d.preview)}</div>
        </div>`
    ).join('');
}

function renderMobileList(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div style="padding:16px 16px 0 16px;display:flex;justify-content:flex-end;">
            <button onclick="loadCreateDiscussion()"
                    style="background:rgba(79,209,197,0.1);color:#4fd1c5;
                           border:1px solid rgba(79,209,197,0.3);padding:10px 20px;
                           border-radius:10px;cursor:pointer;font-weight:700;
                           font-family:'Nunito',sans-serif;font-size:14px;transition:0.2s;"
                    onmouseover="this.style.background='rgba(79,209,197,0.2)'"
                    onmouseout="this.style.background='rgba(79,209,197,0.1)'">
                <i class="fas fa-plus"></i> Start Discussion
            </button>
        </div>`;

    if (!data || data.length === 0) {
        html += `<p style="text-align:center;color:#8b949e;padding:40px;">No discussions yet. Be the first to start one!</p>`;
    } else {
        html += `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;">`;
        data.forEach(d => {
            html += `
                <div onclick="loadDiscussionThread(${d.id})"
                     style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.06);
                            padding:18px;border-radius:12px;cursor:pointer;transition:border-color 0.2s;"
                     onmouseover="this.style.borderColor='rgba(79,209,197,0.3)'"
                     onmouseout="this.style.borderColor='rgba(255,255,255,0.06)'">
                    <h3 style="margin:0 0 8px 0;color:#e2e8f0;font-size:16px;">${escHtml(d.title)}</h3>
                    <div style="font-size:12px;color:#8b949e;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                        <span>By ${escHtml(d.creator_display)}</span>
                        <span>•</span>
                        <span>${escHtml(d.display_date)}</span>
                        <span style="background:rgba(79,209,197,0.1);color:#4fd1c5;
                                     padding:2px 10px;border-radius:12px;font-weight:700;">
                            ${d.reply_count} ${d.reply_count == 1 ? 'reply' : 'replies'}
                        </span>
                    </div>
                    <p style="margin:0;font-size:13px;color:#abb2bf;line-height:1.5;">${escHtml(d.preview)}</p>
                </div>`;
        });
        html += `</div>`;
    }

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// 2. THREAD VIEW
// ─────────────────────────────────────────────
window.loadDiscussionThread = async function(discId) {
    stopDiscPolling();
    window._inDiscussionThread = true;

    if (isDesktop()) {
        if (window.configureHeader) window.configureHeader({ title: 'Discussions', mode: 'standard' });
        document.querySelectorAll('.dsk-item').forEach(el => {
            el.classList.toggle('active', el.dataset.discId == discId);
        });
    } else {
        if (window.configureHeader) window.configureHeader({ title: 'Discussion', mode: 'detail' });
    }

    const loader = document.getElementById('loaderOverlay');

    if (window.discussionThreadCache[discId]) {
        renderThread(window.discussionThreadCache[discId]);
        currentDiscId          = discId;
        discPollInterval       = setInterval(() => pollNewReplies(discId), 4000);
        discTypingPollInterval = setInterval(() => pollTyping(discId), 2000);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/learner/get_discussion_thread.php?discussion_id=${discId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        renderThread(data);
        window.discussionThreadCache[discId] = data;
        currentDiscId          = discId;
        discPollInterval       = setInterval(() => pollNewReplies(discId), 4000);
        discTypingPollInterval = setInterval(() => pollTyping(discId), 2000);

    } catch (e) {
        const target = getThreadTarget();
        if (target) target.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">${escHtml(e.message)}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderThread(data) {
    const { discussion: disc, replies, user_role, is_in_class } = data;
    const target = getThreadTarget();
    if (!target) return;

    let lastDate = null;

    function maybeDate(dateStr) {
        const key   = getDateKey(dateStr);
        const label = getDateLabel(dateStr);
        if (key === lastDate) return '';
        lastDate = key;
        return `<div class="disc-date-sep"><span>${label}</span></div>`;
    }

    let postsHtml = maybeDate(disc.created_at);
    postsHtml += buildPostCard({
        id: 0,
        message: disc.initial_message,
        attachment: disc.attachment,
        created_at: disc.created_at,
        replier_display: disc.creator_display,
        profile_picture: disc.creator_pic,
        is_me: disc.is_op_me ? 1 : 0,
        replier_anonymous: false,
        quote_author: null,
        quote_text: null,
        is_op: true,
    }, user_role, is_in_class, disc.id);

    replies.forEach(r => {
        postsHtml += maybeDate(r.created_at);
        postsHtml += buildPostCard(r, user_role, is_in_class, disc.id);
    });

    lastReplyId     = replies.length > 0 ? replies[replies.length - 1].id : 0;
    lastSeenDateKey = replies.length > 0
        ? getDateKey(replies[replies.length - 1].created_at)
        : getDateKey(disc.created_at);

    const composeHtml = is_in_class ? buildCompose(disc.id) : '';
    const threadHeight = '100%'; // Parent container owns the height on both mobile and desktop

    target.innerHTML = `
        <style>
            /* ── LAYOUT ── */
            .disc-thread-wrap { display:flex; flex-direction:column; height:${threadHeight}; overflow:hidden; }
            .disc-thread-head { padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0; background:#111; }
            .disc-thread-head-title { font-size:14px; font-weight:700; color:#e2e8f0; font-family:'Nunito',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .disc-thread-head-meta { font-size:11px; color:#8b949e; font-family:'Nunito',sans-serif; margin-top:2px; }

            /* ── SCROLL AREA — full width, comfortable padding ── */
            .disc-posts-scroll { flex:1; overflow-y:auto; padding:12px 10px 8px; display:flex; flex-direction:column; gap:0; scrollbar-width:thin; scrollbar-color:#1b1b1b transparent; -webkit-overflow-scrolling:touch; }

            /* ── DATE CHIP ── */
            .disc-date-sep { display:flex; align-items:center; justify-content:center; margin:14px 0 10px; }
            .disc-date-sep span { font-size:10px; font-weight:700; color:#8b949e; background:#141414; border:1px solid rgba(255,255,255,0.07); padding:3px 12px; border-radius:20px; letter-spacing:0.06em; text-transform:uppercase; }

            /* ── FEED ITEM ── */
            .disc-post-card { display:flex; gap:10px; padding-bottom:14px; position:relative; animation:discFadeUp 0.25s ease both; }
            .disc-post-card:last-of-type { padding-bottom:0; }
            @keyframes discFadeUp { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

            /* ── SPINE ── */
            .disc-spine { display:flex; flex-direction:column; align-items:center; width:22px; flex-shrink:0; padding-top:3px; }
            .disc-spine-dot { width:9px; height:9px; border-radius:50%; background:#4fd1c5; flex-shrink:0; }
            .disc-spine-dot.muted { background:#2a2a2a; border:1px solid rgba(255,255,255,0.1); }
            .disc-spine-dot.is-op-dot { background:#4fd1c5; box-shadow:0 0 0 3px rgba(79,209,197,0.15); }
            .disc-spine-line { width:1px; flex:1; background:rgba(255,255,255,0.07); margin-top:4px; min-height:20px; }
            .disc-post-card:last-of-type .disc-spine-line { display:none; }

            /* ── CONTENT ── */
            .disc-post-content { flex:1; min-width:0; }
            .disc-post-header { display:flex; align-items:center; gap:6px; margin-bottom:5px; flex-wrap:wrap; }
            .disc-avatar { width:28px; height:28px; border-radius:50%; object-fit:cover; border:1.5px solid rgba(255,255,255,0.1); flex-shrink:0; }
            .disc-avatar-ph { width:28px; height:28px; border-radius:50%; background:#222; border:1.5px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#8b949e; flex-shrink:0; text-transform:uppercase; letter-spacing:0.03em; }
            .disc-author { font-size:14px; font-weight:700; color:#e2e8f0; }
            .disc-time { font-size:11px; color:#8b949e; margin-left:auto; white-space:nowrap; }
            .disc-tag { font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:0.04em; }
            .disc-tag.op { background:rgba(79,209,197,0.12); color:#4fd1c5; border:1px solid rgba(79,209,197,0.25); }
            .disc-tag.me { background:rgba(79,209,197,0.12); color:#4fd1c5; border:1px solid rgba(79,209,197,0.25); }
            .disc-tag.teacher { background:rgba(56,178,172,0.12); color:#38b2ac; border:1px solid rgba(56,178,172,0.25); }
            .disc-tag.anon { background:rgba(255,255,255,0.05); color:#8b949e; border:1px solid rgba(255,255,255,0.1); }

            /* ── BUBBLE ── */
            .disc-body-wrap { background:#1a1919; border:1px solid rgba(255,255,255,0.07); border-radius:0 12px 12px 12px; padding:11px 14px; }
            .disc-body-wrap.is-op { background:rgba(79,209,197,0.04); border-color:rgba(79,209,197,0.15); }
            .disc-body-wrap.is-me { border-color:rgba(79,209,197,0.2); }

            /* ── QUOTE ── */
            .disc-quote { background:rgba(255,255,255,0.03); border-left:2px solid #4fd1c5; border-radius:0 6px 6px 0; padding:7px 11px; margin-bottom:9px; font-size:12px; color:#8b949e; }
            .disc-quote-author { color:#4fd1c5; font-weight:700; margin-bottom:2px; font-size:11px; }

            /* ── BODY TEXT ── */
            .disc-body { font-size:14px; line-height:1.65; color:#e2e8f0; word-wrap:break-word; white-space:pre-wrap; }

            /* ── ATTACHMENT ── */
            .disc-attachment { margin-top:8px; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.07); display:inline-block; max-width:240px; }
            .disc-attachment img { width:100%; display:block; cursor:zoom-in; }
            .disc-pdf-link { display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(79,209,197,0.06); color:#4fd1c5; cursor:pointer; font-size:13px; font-weight:600; }

            /* ── FOOTER ── */
            .disc-footer { display:flex; align-items:center; gap:2px; margin-top:7px; }
            .disc-action-btn { background:none; border:none; color:#8b949e; font-size:12px; font-weight:700; cursor:pointer; padding:4px 10px; border-radius:6px; display:flex; align-items:center; gap:5px; font-family:'Nunito',sans-serif; transition:0.15s; }
            .disc-action-btn:hover { background:rgba(255,255,255,0.05); color:#e2e8f0; }
            .disc-action-btn.reply:hover { color:#4fd1c5; }
            .disc-action-btn.report:hover { color:#f85149; }

            /* ── NESTED REPLY ── */
            .disc-nested-reply { display:flex; gap:10px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); }
            .disc-nested-avatar { width:22px; height:22px; border-radius:50%; background:#222; border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#8b949e; flex-shrink:0; text-transform:uppercase; overflow:hidden; }
            .disc-nested-avatar img { width:100%; height:100%; object-fit:cover; }
            .disc-nested-content { flex:1; min-width:0; }
            .disc-nested-header { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
            .disc-nested-name { font-size:12px; font-weight:700; color:#c9d1d9; }
            .disc-nested-time { font-size:10px; color:#8b949e; margin-left:auto; }
            .disc-nested-body { font-size:13px; color:#c9d1d9; line-height:1.55; word-wrap:break-word; white-space:pre-wrap; }

            /* ── COMPOSE — stable, never jumps ── */
            .disc-compose { flex-shrink:0; padding:10px 12px 14px; border-top:1px solid rgba(255,255,255,0.07); background:#111; }
            .disc-reply-preview { display:none; background:rgba(79,209,197,0.06); border:1px solid rgba(79,209,197,0.2); border-radius:8px; padding:8px 12px; margin-bottom:8px; font-size:12px; color:#8b949e; align-items:center; gap:8px; }
            .disc-reply-preview.show { display:flex; }
            .disc-file-preview { display:none; align-items:center; gap:8px; background:#1b1b1b; border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:8px 12px; margin-bottom:8px; font-size:12px; color:#8b949e; }
            .disc-file-preview.show { display:flex; }
            .disc-file-preview img { width:30px; height:30px; object-fit:cover; border-radius:4px; }
            .disc-compose-box { background:#1b1b1b; border:1px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; transition:border-color 0.2s; }
            .disc-compose-box:focus-within { border-color:rgba(79,209,197,0.4); }
            .disc-compose-box textarea { width:100%; background:transparent; border:none; color:#e2e8f0; font-family:'Nunito',sans-serif; font-size:14px; font-weight:600; padding:12px 14px 8px; resize:none; outline:none; min-height:46px; max-height:120px; line-height:1.5; box-sizing:border-box; }
            .disc-compose-box textarea::placeholder { color:#8b949e; }
            .disc-toolbar { display:flex; align-items:center; gap:4px; padding:6px 10px; border-top:1px solid rgba(255,255,255,0.07); }
            .disc-tool-btn { background:none; border:none; color:#8b949e; cursor:pointer; padding:6px 8px; border-radius:6px; transition:0.15s; display:flex; align-items:center; gap:5px; font-family:'Nunito',sans-serif; font-size:12px; font-weight:700; }
            .disc-tool-btn:hover { background:rgba(255,255,255,0.06); color:#e2e8f0; }
            .disc-tool-btn.anon-on { color:#4fd1c5; }
            .disc-post-btn { background:#4fd1c5; color:#0d1117; border:none; padding:8px 16px; border-radius:9px; font-family:'Nunito',sans-serif; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; margin-left:auto; transition:0.2s; }
            .disc-post-btn:hover { background:#38b2ac; }

            /* ── TYPING — uses visibility instead of display:none so it never shifts layout ── */
            .disc-typing { visibility:hidden; display:flex; align-items:center; gap:8px; padding:0; font-size:12px; color:#8b949e; font-weight:700; height:0; overflow:hidden; transition:height 0.15s ease; }
            .disc-typing.show { visibility:visible; height:26px; padding-bottom:6px; }
            .disc-typing-dots { display:flex; align-items:center; gap:3px; }
            .disc-typing-dots span { width:6px; height:6px; border-radius:50%; background:#4fd1c5; animation:discTypeBounce 1.2s infinite ease-in-out; display:inline-block; }
            .disc-typing-dots span:nth-child(2){animation-delay:0.2s}
            .disc-typing-dots span:nth-child(3){animation-delay:0.4s}
            @keyframes discTypeBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
        </style>

        <div class="disc-thread-wrap">
            ${isDesktop() ? `
            <div class="disc-thread-head">
                <div class="disc-thread-head-title">${escHtml(disc.title)}</div>
                <div class="disc-thread-head-meta">${escHtml(disc.subject_name || '')}${disc.subject_name ? ' · ' : ''}${replies.length + 1} post${replies.length !== 0 ? 's' : ''}</div>
            </div>` : ''}
            <div class="disc-posts-scroll" id="discPostsScroll">
                ${postsHtml}
                <div id="discBottom"></div>
            </div>
            ${composeHtml}
        </div>`;

    const scroll = document.getElementById('discPostsScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;

    wireCompose(disc.id);
}

function buildPostCard(r, user_role, is_in_class, discId) {
    const isOp    = r.is_op || false;
    const isMe    = r.is_me == 1;
    const isAnon  = r.replier_anonymous && user_role === 'learner';
    const initial = (r.replier_display || '?').charAt(0).toUpperCase();
    const picFolder = 'uploads/learners/';

    const dotClass = isOp ? 'is-op-dot' : (isMe ? '' : 'muted');

    // Pick a consistent color per initial so the same person always gets the same colour
    const avatarColors = [
        { bg:'rgba(79,209,197,0.15)',  color:'#4fd1c5' },  // teal
        { bg:'rgba(99,153,250,0.15)',  color:'#63a0fa' },  // blue
        { bg:'rgba(246,173,85,0.15)', color:'#f6ad55' },  // amber
        { bg:'rgba(154,117,242,0.15)',color:'#9a75f2' },  // purple
        { bg:'rgba(72,199,142,0.15)', color:'#48c78e' },  // green
        { bg:'rgba(241,101,101,0.15)',color:'#f16565' },  // coral
    ];
    const colorIdx   = initial.charCodeAt(0) % avatarColors.length;
    const avatarColor = avatarColors[colorIdx];

    // Always render the initials circle. If a real (non-default) profile pic exists,
    // swap it in on successful load — this avoids the grey default.png problem.
    const hasPic = r.profile_picture && r.profile_picture !== 'default.png' && r.profile_picture !== '';
    const avatarHtml = isAnon
        ? `<div class="disc-avatar-ph" style="background:rgba(255,255,255,0.06);color:#8b949e;">?</div>`
        : (hasPic
            ? `<img src="${picFolder}${escHtml(r.profile_picture)}" class="disc-avatar"
                   onload="this.style.display='block';this.nextElementSibling.style.display='none';"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                   style="display:none;">
               <div class="disc-avatar-ph" style="background:${avatarColor.bg};color:${avatarColor.color};">${initial}</div>`
            : `<div class="disc-avatar-ph" style="background:${avatarColor.bg};color:${avatarColor.color};">${initial}</div>`);

    const opTag      = isOp   ? `<span class="disc-tag op">OP</span>`    : '';
    const meTag      = isMe   ? `<span class="disc-tag me">You</span>`   : '';
    const anonTag    = isAnon ? `<span class="disc-tag anon">Anon</span>`: '';
    const displayName = isAnon ? 'Anonymous' : escHtml(r.replier_display);

    const quoteHtml = r.quote_author
        ? `<div class="disc-quote">
               <div class="disc-quote-author">${escHtml(r.quote_author)}</div>
               <div>${escHtml(r.quote_text || '')}${(r.quote_text||'').length >= 100 ? '…' : ''}</div>
           </div>` : '';

    let attachHtml = '';
    if (r.attachment) {
        const ext   = r.attachment.split('.').pop().toLowerCase();
        const path  = 'uploads/discussions/' + r.attachment;
        const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
        attachHtml  = `<div class="disc-attachment">` + (isImg
            ? `<img src="${path}" onclick="discOpenMedia('${path}','image')">`
            : `<div class="disc-pdf-link" onclick="discOpenMedia('${path}','pdf')"><i class="fas fa-file-pdf"></i> Open PDF</div>`)
            + `</div>`;
    }

    const replyBtn  = is_in_class && r.id !== undefined
        ? `<button class="disc-action-btn reply" onclick="discSetReply(${r.id || 0},'${escHtml(r.replier_display)}','${escHtml((r.message||'').substring(0,80))}')"><i class="fas fa-reply"></i> Reply</button>`
        : '';
    const reportBtn = user_role === 'learner' && !isMe && r.id
        ? `<button class="disc-action-btn report" onclick="discShowReport(${r.id},${discId})"><i class="fas fa-flag"></i> Report</button>`
        : '';

    const bodyWrapClass = `disc-body-wrap${isOp ? ' is-op' : ''}${isMe ? ' is-me' : ''}`;

    return `
        <div class="disc-post-card" data-id="${r.id || 0}">
            <div class="disc-spine">
                <div class="disc-spine-dot ${dotClass}"></div>
                <div class="disc-spine-line"></div>
            </div>
            <div class="disc-post-content">
                <div class="disc-post-header">
                    ${avatarHtml}
                    <span class="disc-author">${displayName}</span>
                    ${opTag}${meTag}${anonTag}
                    <span class="disc-time">${formatTime(r.created_at)}</span>
                </div>
                <div class="${bodyWrapClass}">
                    ${quoteHtml}
                    <div class="disc-body">${escHtml(r.message || '')}</div>
                    ${attachHtml}
                </div>
                <div class="disc-footer">${replyBtn}${reportBtn}</div>
            </div>
        </div>`;
}

function buildCompose(discId) {
    return `
        <div class="disc-compose">
            <div class="disc-typing" id="discTypingIndicator">
                <div class="disc-typing-dots"><span></span><span></span><span></span></div>
                <span id="discTypingText">Classmate is typing...</span>
            </div>
            <div class="disc-reply-preview" id="discReplyPreview">
                <span style="color:#4fd1c5;font-weight:700;flex-shrink:0;">Replying to:</span>
                <span id="discPreviewText" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                <button onclick="discCancelReply()" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:16px;padding:0 4px;">✕</button>
            </div>
            <div class="disc-file-preview" id="discFilePreview">
                <img id="discPreviewImg" src="" style="display:none;">
                <span id="discFileName"></span>
                <button onclick="discClearFile()" style="background:none;border:none;color:#f85149;cursor:pointer;margin-left:auto;font-size:16px;">✕</button>
            </div>
            <div class="disc-compose-box">
                <textarea id="discTextarea" placeholder="Add to the discussion…" rows="1"></textarea>
                <div class="disc-toolbar">
                    <label class="disc-tool-btn" title="Attach file">
                        <i class="fas fa-paperclip"></i>
                        <input type="file" id="discFileInput" accept="image/*,.pdf" style="display:none;">
                    </label>
                    <label class="disc-tool-btn anon-on" id="discAnonLabel" title="Post anonymously">
                        <input type="checkbox" id="discAnon" checked onchange="document.getElementById('discAnonLabel').classList.toggle('anon-on',this.checked);" style="display:none;">
                        <i class="fas fa-user-secret"></i> Anonymous
                    </label>
                    <button class="disc-post-btn" onclick="discSubmitReply(${discId})">
                        <i class="fas fa-paper-plane"></i> Post
                    </button>
                </div>
            </div>
        </div>`;
}

function wireCompose(discId) {
    const ta = document.getElementById('discTextarea');
    if (ta) {
        ta.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            sendTypingSignal(discId);
            clearTimeout(discTypingTimeout);
            discTypingTimeout = setTimeout(() => {}, 5000);
        });
    }

    const fi = document.getElementById('discFileInput');
    if (fi) {
        fi.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            const preview = document.getElementById('discFilePreview');
            const img     = document.getElementById('discPreviewImg');
            const name    = document.getElementById('discFileName');
            preview.classList.add('show');
            name.textContent = file.name;
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => { img.src = e.target.result; img.style.display = 'block'; };
                reader.readAsDataURL(file);
            } else {
                img.style.display = 'none';
            }
        });
    }
}

// ─────────────────────────────────────────────
// TYPING
// ─────────────────────────────────────────────
function sendTypingSignal(discId) {
    fetch('api/set_typing.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `discussion_id=${discId}`
    }).catch(() => {});
}

async function pollTyping(discId) {
    try {
        const res  = await fetch(`api/get_typing.php?discussion_id=${discId}`);
        const data = await res.json();
        const el   = document.getElementById('discTypingIndicator');
        const txt  = document.getElementById('discTypingText');
        if (!el) return;
        if (data.count > 0) {
            txt.textContent = data.count === 1 ? 'Someone is typing...' : `${data.count} people are typing...`;
            el.classList.add('show');
        } else {
            el.classList.remove('show');
        }
    } catch (e) {}
}

// ─────────────────────────────────────────────
// POLL NEW REPLIES
// ─────────────────────────────────────────────
async function pollNewReplies(discId) {
    try {
        const res  = await fetch(`api/learner/get_new_replies.php?discussion_id=${discId}&after_id=${lastReplyId}`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;

        const scroll   = document.getElementById('discPostsScroll');
        const bottom   = document.getElementById('discBottom');
        const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;

        rows.forEach(r => {
            const dk = getDateKey(r.created_at);
            if (dk !== lastSeenDateKey) {
                const sep = document.createElement('div');
                sep.className = 'disc-date-sep';
                sep.innerHTML = `<span>${getDateLabel(r.created_at)}</span>`;
                scroll.insertBefore(sep, bottom);
                lastSeenDateKey = dk;
            }
            const card = document.createElement('div');
            card.innerHTML = buildPostCard(r, 'learner', true, discId).trim();
            scroll.insertBefore(card.firstChild, bottom);
            lastReplyId = Math.max(lastReplyId, r.id);
        });

        if (atBottom) scroll.scrollTop = scroll.scrollHeight;

        if (window.discussionCache) {
            const disc = window.discussionCache.find(d => d.id == discId);
            if (disc) {
                disc.reply_count = (parseInt(disc.reply_count) || 0) + rows.length;
                if (isDesktop()) {
                    const pill = document.querySelector(`.dsk-item[data-disc-id="${discId}"] .dsk-item-pill`);
                    if (pill) pill.textContent = `${disc.reply_count} ${disc.reply_count == 1 ? 'reply' : 'replies'}`;
                }
            }
        }
    } catch (e) {}
}

// ─────────────────────────────────────────────
// SUBMIT REPLY
// ─────────────────────────────────────────────
window.discSubmitReply = async function(discId) {
    const ta      = document.getElementById('discTextarea');
    const fi      = document.getElementById('discFileInput');
    const anon    = document.getElementById('discAnon');
    const replyTo = window._discReplyTo ?? 0;
    const message = ta ? ta.value.trim() : '';

    if (!message && (!fi || !fi.files[0])) return;

    const fd = new FormData();
    fd.append('discussion_id', discId);
    fd.append('message', message);
    fd.append('anonymous', anon?.checked ? '1' : '0');
    fd.append('reply_to', replyTo);
    if (fi?.files[0]) fd.append('attachment', fi.files[0]);

    const btn = document.querySelector('.disc-post-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const res  = await fetch('api/learner/submit_reply.php', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        if (fi) fi.value = '';
        discCancelReply();
        discClearFile();

        const scroll   = document.getElementById('discPostsScroll');
        const bottomEl = document.getElementById('discBottom');
        if (scroll && data.reply) {
            const dk = getDateKey(data.reply.created_at);
            if (dk !== lastSeenDateKey) {
                const sep = document.createElement('div');
                sep.className = 'disc-date-sep';
                sep.innerHTML = `<span>${getDateLabel(data.reply.created_at)}</span>`;
                scroll.insertBefore(sep, bottomEl);
                lastSeenDateKey = dk;
            }
            const card = document.createElement('div');
            card.innerHTML = buildPostCard(data.reply, 'learner', true, discId).trim();
            scroll.insertBefore(card.firstChild, bottomEl);
            lastReplyId = Math.max(lastReplyId, data.reply.id);
            scroll.scrollTop = scroll.scrollHeight;
        }

        if (window.discussionCache) {
            const disc = window.discussionCache.find(d => d.id == discId);
            if (disc) {
                disc.reply_count = (parseInt(disc.reply_count) || 0) + 1;
                if (isDesktop()) {
                    const pill = document.querySelector(`.dsk-item[data-disc-id="${discId}"] .dsk-item-pill`);
                    if (pill) pill.textContent = `${disc.reply_count} ${disc.reply_count == 1 ? 'reply' : 'replies'}`;
                }
            }
        }

    } catch (e) {
        alert(e.message || 'Failed to post reply');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post'; }
    }
};

// ─────────────────────────────────────────────
// REPLY HELPERS
// ─────────────────────────────────────────────
window.discSetReply = function(id, author, preview) {
    window._discReplyTo = id;
    const p = document.getElementById('discPreviewText');
    if (p) p.textContent = author + ': ' + preview;
    document.getElementById('discReplyPreview')?.classList.add('show');
    document.getElementById('discTextarea')?.focus();
};
window.discCancelReply = function() {
    window._discReplyTo = 0;
    document.getElementById('discReplyPreview')?.classList.remove('show');
};
window.discClearFile = function() {
    const fi = document.getElementById('discFileInput');
    if (fi) fi.value = '';
    document.getElementById('discFilePreview')?.classList.remove('show');
    const img = document.getElementById('discPreviewImg');
    if (img) img.style.display = 'none';
};

// ─────────────────────────────────────────────
// REPORT MODAL
// ─────────────────────────────────────────────
window.discShowReport = function(replyId, discId) {
    const existing = document.getElementById('discReportModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'discReportModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#1a1919;border:1px solid rgba(255,255,255,0.1);padding:28px;border-radius:16px;max-width:400px;width:90%;">
            <h3 style="color:#f85149;font-size:17px;margin:0 0 18px;display:flex;align-items:center;gap:8px;"><i class="fas fa-flag"></i> Report Content</h3>
            <select id="discReportReason" style="width:100%;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:8px;padding:10px 12px;font-family:'Nunito',sans-serif;margin-bottom:12px;">
                <option value="bullying">Bullying</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="off_topic">Off-topic</option>
                <option value="spam">Spam</option>
                <option value="other">Other</option>
            </select>
            <textarea id="discReportComment" placeholder="Additional comment (optional)" style="width:100%;height:80px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:8px;padding:10px 12px;font-family:'Nunito',sans-serif;resize:none;box-sizing:border-box;margin-bottom:14px;"></textarea>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button onclick="document.getElementById('discReportModal').remove()" style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.1);color:#8b949e;padding:9px 18px;border-radius:8px;cursor:pointer;font-family:'Nunito',sans-serif;font-weight:700;">Cancel</button>
                <button onclick="discSubmitReport(${replyId},${discId})" style="background:#f85149;border:none;color:white;padding:9px 18px;border-radius:8px;cursor:pointer;font-family:'Nunito',sans-serif;font-weight:800;">Submit</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.discSubmitReport = async function(replyId, discId) {
    const reason  = document.getElementById('discReportReason')?.value;
    const comment = document.getElementById('discReportComment')?.value;
    const fd = new FormData();
    fd.append('action', 'report');
    fd.append('reply_id', replyId);
    fd.append('discussion_id', discId);
    fd.append('reason', reason);
    fd.append('comment', comment);

    try {
        await fetch('view_discussion.php', { method: 'POST', body: fd });
        document.getElementById('discReportModal')?.remove();
    } catch (e) {}
};

// ─────────────────────────────────────────────
// MEDIA OVERLAY
// ─────────────────────────────────────────────
window.discOpenMedia = function(path, type) {
    const existing = document.getElementById('discMediaOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'discMediaOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;display:flex;flex-direction:column;';
    overlay.innerHTML = `
        <div style="padding:14px 16px;background:rgba(0,0,0,0.4);">
            <button onclick="document.getElementById('discMediaOverlay').remove()" style="background:#4fd1c5;color:#0d1117;border:none;padding:8px 18px;border-radius:20px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;align-items:center;gap:8px;"><i class="fas fa-arrow-left"></i> Back</button>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;">
            ${type === 'image'
                ? `<img src="${path}" style="max-width:100%;max-height:90vh;border-radius:8px;">`
                : `<iframe src="${path}" style="width:100%;height:100%;border:none;background:white;"></iframe>`}
        </div>`;
    document.body.appendChild(overlay);
};

// ─────────────────────────────────────────────
// 3. CREATE DISCUSSION FORM
// ─────────────────────────────────────────────
window.loadCreateDiscussion = async function() {
    stopDiscPolling();

    if (isDesktop()) {
        if (window.configureHeader) window.configureHeader({ title: 'Discussions', mode: 'standard' });
        document.querySelectorAll('.dsk-item').forEach(el => el.classList.remove('active'));
    } else {
        if (window.configureHeader) window.configureHeader({ title: 'New Discussion', mode: 'detail' });
    }

    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        if (!window.teacherListCache) {
            const res  = await fetch('api/learner/get_teachers.php');
            const data = await res.json();
            window.teacherListCache = data;
        }
        renderCreateForm(window.teacherListCache);
    } catch (e) {
        const target = getThreadTarget();
        if (target) target.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading form.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderCreateForm(teachers) {
    const target = getThreadTarget();
    if (!target) return;

    const teacherOptions = teachers.map(t =>
        `<div class="disc-teacher-option" data-email="${escHtml(t.email)}" onclick="discToggleTeacher(this)">
            ${escHtml(t.display_name)}
         </div>`
    ).join('');

    target.innerHTML = `
        <style>
            .disc-form-wrap { max-width:640px; margin:0 auto; padding:20px; }
            .disc-form-wrap h2 { color:#e2e8f0; font-size:20px; font-weight:800; margin:0 0 24px; }
            .disc-field { margin-bottom:20px; }
            .disc-field label { display:block; margin-bottom:8px; font-size:14px; font-weight:700; color:#c9d1d9; }
            .disc-field input,.disc-field textarea { width:100%; background:#1b1b1b; border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#e2e8f0; font-family:'Nunito',sans-serif; font-size:14px; font-weight:600; padding:12px 14px; box-sizing:border-box; outline:none; transition:border-color 0.2s; }
            .disc-field input:focus,.disc-field textarea:focus { border-color:rgba(79,209,197,0.4); }
            .disc-field textarea { min-height:110px; resize:vertical; }
            .disc-teachers-list { display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; background:#1b1b1b; border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; }
            .disc-teacher-option { padding:10px 12px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; color:#c9d1d9; transition:0.15s; }
            .disc-teacher-option:hover { background:rgba(255,255,255,0.06); }
            .disc-teacher-option.selected { background:rgba(79,209,197,0.1); color:#4fd1c5; border:1px solid rgba(79,209,197,0.2); }
            .disc-anon-toggle { display:flex; align-items:center; gap:10px; padding:14px; background:#1b1b1b; border:1px solid rgba(255,255,255,0.08); border-radius:10px; cursor:pointer; }
            .disc-anon-toggle input { width:16px; height:16px; cursor:pointer; accent-color:#4fd1c5; }
            .disc-anon-toggle span { font-size:14px; font-weight:600; color:#c9d1d9; }
            .disc-attach-area { background:#1b1b1b; border:1px dashed rgba(255,255,255,0.15); border-radius:10px; padding:14px; text-align:center; cursor:pointer; }
            .disc-attach-area:hover { border-color:rgba(79,209,197,0.3); }
            .disc-submit-btn { width:100%; background:#4fd1c5; color:#0d1117; border:none; padding:14px; border-radius:12px; font-family:'Nunito',sans-serif; font-size:16px; font-weight:800; cursor:pointer; margin-top:8px; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px; }
            .disc-submit-btn:hover { background:#38b2ac; }
            .disc-submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
            .disc-error { background:rgba(248,81,73,0.1); border:1px solid rgba(248,81,73,0.3); color:#f85149; padding:12px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; display:none; }
        </style>

        <div class="disc-form-wrap" style="overflow-y:auto;height:100%;box-sizing:border-box;">
            <h2><i class="fas fa-comments" style="color:#4fd1c5;margin-right:8px;"></i> Start a New Discussion</h2>
            <div class="disc-error" id="discFormError"></div>
            <div class="disc-field">
                <label>Discussion Title *</label>
                <input type="text" id="discTitle" placeholder="e.g. Help with Quadratic Equations">
            </div>
            <div class="disc-field">
                <label>Your Message / Question *</label>
                <textarea id="discMessage" placeholder="Explain what you need help with or want to discuss..."></textarea>
            </div>
            <div class="disc-field">
                <label>Tag Teacher(s) * <span style="font-size:12px;color:#8b949e;font-weight:600;">(tap to select)</span></label>
                <div class="disc-teachers-list">${teacherOptions}</div>
            </div>
            <div class="disc-field">
                <label class="disc-anon-toggle">
                    <input type="checkbox" id="discCreateAnon" checked>
                    <span>Post anonymously (classmates won't see your name)</span>
                </label>
            </div>
            <div class="disc-field">
                <label>Attachment <span style="color:#8b949e;font-weight:600;">(optional)</span></label>
                <div class="disc-attach-area" onclick="document.getElementById('discCreateFile').click()">
                    <i class="fas fa-paperclip" style="color:#8b949e;margin-right:6px;"></i>
                    <span style="color:#8b949e;font-size:13px;" id="discCreateFileName">Tap to attach PDF or image (max 5MB)</span>
                    <input type="file" id="discCreateFile" accept=".pdf,image/*" style="display:none;"
                           onchange="document.getElementById('discCreateFileName').textContent = this.files[0]?.name || 'Tap to attach'">
                </div>
            </div>
            <button class="disc-submit-btn" id="discSubmitBtn" onclick="discSubmitCreate()">
                <i class="fas fa-paper-plane"></i> Create Discussion
            </button>
        </div>`;
}

window.discToggleTeacher = function(el) {
    el.classList.toggle('selected');
};

window.discSubmitCreate = async function() {
    const title     = document.getElementById('discTitle')?.value.trim();
    const message   = document.getElementById('discMessage')?.value.trim();
    const anon      = document.getElementById('discCreateAnon')?.checked;
    const fileInput = document.getElementById('discCreateFile');
    const errorEl   = document.getElementById('discFormError');
    const btn       = document.getElementById('discSubmitBtn');

    const selectedTeachers = [...document.querySelectorAll('.disc-teacher-option.selected')]
        .map(el => el.dataset.email);

    if (!title || !message || selectedTeachers.length === 0) {
        errorEl.textContent = 'Please fill all required fields and tag at least one teacher.';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    const fd = new FormData();
    fd.append('title', title);
    fd.append('message', message);
    fd.append('anonymous', anon ? '1' : '0');
    selectedTeachers.forEach(e => fd.append('teachers[]', e));
    if (fileInput?.files[0]) fd.append('attachment', fileInput.files[0]);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const res  = await fetch('api/learner/create_discussion.php', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Bust cache and tear down the split shell so it rebuilds cleanly
        window.discussionCache = null;
        const splitWrap = document.getElementById('disc-split-wrap');
        if (splitWrap) splitWrap.remove();

        window.fetchDiscussions();

    } catch (e) {
        errorEl.textContent = e.message || 'Failed to create discussion.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create Discussion';
    }
};