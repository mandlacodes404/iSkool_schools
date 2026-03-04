/* assets/js/learner/discussions.js */

window.discussionCache     = null;
window.teacherListCache    = null;
let discPollInterval       = null;
let discTypingPollInterval = null;
let discTypingTimeout      = null;
let currentDiscId          = null;
let lastReplyId            = 0;
let lastSeenDateKey        = null;

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

function getDateKey(dateStr) { return dateStr.substring(0, 10); }

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

function renderDiscussions(data) {
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
    if (window.configureHeader) window.configureHeader({ title: 'Discussion', mode: 'detail' });

    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch(`api/learner/get_discussion_thread.php?discussion_id=${discId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        renderThread(data);
        currentDiscId = discId;

        // Start polling for new replies + typing
        discPollInterval       = setInterval(() => pollNewReplies(discId), 4000);
        discTypingPollInterval = setInterval(() => pollTyping(discId), 2000);

    } catch (e) {
        if (apiArea) apiArea.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">${escHtml(e.message)}</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderThread(data) {
    const { discussion: disc, replies, user_role, is_in_class } = data;
    const apiArea = document.getElementById('api-content-area');


    // Track date separators
    let lastDate = null;

    function maybeDate(dateStr) {
        const key   = getDateKey(dateStr);
        const label = getDateLabel(dateStr);
        if (key === lastDate) return '';
        lastDate = key;
        return `<div class="disc-date-sep"><span>${label}</span></div>`;
    }

    // Build OP card
    const opInitial = disc.creator_display.charAt(0).toUpperCase();
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

    // Build reply cards
    replies.forEach((r, i) => {
        postsHtml += maybeDate(r.created_at);
        postsHtml += buildPostCard(r, user_role, is_in_class, disc.id);
    });

    // Track last reply id for polling
    lastReplyId    = replies.length > 0 ? replies[replies.length - 1].id : 0;
    lastSeenDateKey = replies.length > 0
        ? getDateKey(replies[replies.length - 1].created_at)
        : getDateKey(disc.created_at);

    const composeHtml = is_in_class ? buildCompose(disc.id) : '';

    apiArea.innerHTML = `
        <style>
            .disc-thread-wrap { display:flex; flex-direction:column; height:calc(100vh - 120px); }
            .disc-thread-header { padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0; }
            .disc-thread-header .class-badge { display:inline-flex;align-items:center;gap:6px;background:rgba(79,209,197,0.08);border:1px solid rgba(79,209,197,0.2);color:#4fd1c5;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px; }
            .disc-thread-header h2 { font-size:17px;font-weight:800;color:#e2e8f0;margin:0;line-height:1.3; }
            .disc-thread-header .meta { font-size:12px;color:#8b949e;margin-top:4px; }
            .disc-posts-scroll { flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:#1b1b1b transparent; }
            .disc-date-sep { display:flex;align-items:center;gap:12px;margin:14px 0 8px;color:#8b949e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px; }
            .disc-date-sep::before,.disc-date-sep::after { content:'';flex:1;height:1px;background:rgba(255,255,255,0.07); }
            .disc-post-card { background:#1a1919;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px;border-left:3px solid transparent;animation:discFadeUp 0.3s ease both; }
            .disc-post-card.is-op { background:rgba(79,209,197,0.03);border-color:rgba(79,209,197,0.15);border-left-color:#4fd1c5; }
            .disc-post-card.is-me { border-left-color:#4fd1c5; }
            @keyframes discFadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
            .disc-post-header { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
            .disc-avatar { width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.1);flex-shrink:0; }
            .disc-avatar-ph { width:30px;height:30px;border-radius:50%;background:#222;border:2px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#8b949e;flex-shrink:0;text-transform:uppercase; }
            .disc-author { font-size:13px;font-weight:700;color:#e2e8f0;display:flex;align-items:center;gap:6px; }
            .disc-time { font-size:11px;color:#8b949e;margin-top:1px; }
            .disc-tag { font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;text-transform:uppercase; }
            .disc-tag.op { background:rgba(79,209,197,0.1);color:#4fd1c5;border:1px solid rgba(79,209,197,0.2); }
            .disc-tag.me { background:rgba(79,209,197,0.1);color:#4fd1c5;border:1px solid rgba(79,209,197,0.2); }
            .disc-quote { background:rgba(255,255,255,0.03);border-left:3px solid #4fd1c5;border-radius:0 8px 8px 0;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#8b949e; }
            .disc-quote-author { color:#4fd1c5;font-weight:700;margin-bottom:2px;font-size:11px; }
            .disc-body { font-size:14px;line-height:1.65;color:#e2e8f0;word-wrap:break-word;white-space:pre-wrap; }
            .disc-attachment { margin-top:10px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);display:inline-block;max-width:260px; }
            .disc-attachment img { width:100%;display:block;cursor:zoom-in; }
            .disc-pdf-link { display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(79,209,197,0.06);color:#4fd1c5;cursor:pointer;font-size:13px;font-weight:600; }
            .disc-footer { display:flex;align-items:center;gap:4px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06); }
            .disc-action-btn { background:none;border:none;color:#8b949e;font-size:12px;font-weight:600;cursor:pointer;padding:4px 10px;border-radius:6px;display:flex;align-items:center;gap:5px;font-family:'Nunito',sans-serif;transition:0.15s; }
            .disc-action-btn:hover { background:rgba(255,255,255,0.05);color:#e2e8f0; }
            .disc-action-btn.reply:hover { color:#4fd1c5; }
            .disc-action-btn.report:hover { color:#f85149; }
            /* Compose */
            .disc-compose { flex-shrink:0;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.07); }
            .disc-reply-preview { display:none;background:rgba(79,209,197,0.06);border:1px solid rgba(79,209,197,0.2);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#8b949e;align-items:center;gap:8px; }
            .disc-reply-preview.show { display:flex; }
            .disc-file-preview { display:none;align-items:center;gap:8px;background:#1b1b1b;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#8b949e; }
            .disc-file-preview.show { display:flex; }
            .disc-file-preview img { width:32px;height:32px;object-fit:cover;border-radius:4px; }
            .disc-compose-box { background:#1b1b1b;border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;transition:border-color 0.2s; }
            .disc-compose-box:focus-within { border-color:rgba(79,209,197,0.4); }
            .disc-compose-box textarea { width:100%;background:transparent;border:none;color:#e2e8f0;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;padding:12px 14px 8px;resize:none;outline:none;min-height:44px;max-height:120px;line-height:1.5;box-sizing:border-box; }
            .disc-compose-box textarea::placeholder { color:#8b949e; }
            .disc-toolbar { display:flex;align-items:center;gap:4px;padding:6px 10px;border-top:1px solid rgba(255,255,255,0.07); }
            .disc-tool-btn { background:none;border:none;color:#8b949e;cursor:pointer;padding:6px 8px;border-radius:6px;transition:0.15s;display:flex;align-items:center;gap:5px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700; }
            .disc-tool-btn:hover { background:rgba(255,255,255,0.06);color:#e2e8f0; }
            .disc-tool-btn.anon-on { color:#4fd1c5; }
            .disc-post-btn { background:#4fd1c5;color:#0d1117;border:none;padding:7px 16px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;margin-left:auto;transition:0.2s; }
            .disc-post-btn:hover { background:#38b2ac; }
            /* Typing */
            .disc-typing { display:none;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#8b949e;font-weight:700;min-height:28px; }
            .disc-typing.show { display:flex; }
            .disc-typing-dots { display:flex;align-items:center;gap:4px; }
            .disc-typing-dots span { width:8px;height:8px;border-radius:50%;background:#4fd1c5;animation:discTypeBounce 1.2s infinite ease-in-out;display:inline-block; }
            .disc-typing-dots span:nth-child(2){animation-delay:0.2s}
            .disc-typing-dots span:nth-child(3){animation-delay:0.4s}
            @keyframes discTypeBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
        </style>

        <div class="disc-thread-wrap">

            <div class="disc-posts-scroll" id="discPostsScroll">
                ${postsHtml}
                <div id="discBottom"></div>
            </div>

            ${composeHtml}
        </div>`;

    // Scroll to bottom
    const scroll = document.getElementById('discPostsScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;

    // Wire up compose
    wireCompose(disc.id);
}

function buildPostCard(r, user_role, is_in_class, discId) {
    const isOp      = r.is_op || false;
    const isMe      = r.is_me == 1;
    const showAvatar = !(r.replier_anonymous && user_role === 'learner');
    const initial    = (r.replier_display || '?').charAt(0).toUpperCase();
    const picFolder  = 'uploads/learners/';

    const avatarHtml = showAvatar
        ? `<img src="${picFolder}${escHtml(r.profile_picture || 'default.png')}" class="disc-avatar"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="disc-avatar-ph" style="display:none;">${initial}</div>`
        : `<div class="disc-avatar-ph">?</div>`;

    const tags = (isOp ? `<span class="disc-tag op">OP</span>` : '') +
                 (isMe ? `<span class="disc-tag me">You</span>` : '');

    const quoteHtml = r.quote_author
        ? `<div class="disc-quote">
               <div class="disc-quote-author">${escHtml(r.quote_author)}</div>
               <div>${escHtml(r.quote_text || '')}${(r.quote_text||'').length >= 100 ? '…' : ''}</div>
           </div>` : '';

    let attachHtml = '';
    if (r.attachment) {
        const ext    = r.attachment.split('.').pop().toLowerCase();
        const path   = 'uploads/discussions/' + r.attachment;
        const isImg  = ['jpg','jpeg','png','gif','webp'].includes(ext);
        attachHtml   = `<div class="disc-attachment">` + (isImg
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

    return `
        <div class="disc-post-card ${isOp?'is-op':''} ${isMe?'is-me':''}" data-id="${r.id || 0}">
            <div class="disc-post-header">
                ${avatarHtml}
                <div>
                    <div class="disc-author">${escHtml(r.replier_display)} ${tags}</div>
                    <div class="disc-time">${formatTime(r.created_at)}</div>
                </div>
            </div>
            ${quoteHtml}
            <div class="disc-body">${escHtml(r.message || '')}</div>
            ${attachHtml}
            <div class="disc-footer">${replyBtn}${reportBtn}</div>
        </div>`;
}

function buildCompose(discId) {
    return `
        <div class="disc-compose">
            <div class="disc-typing" id="discTypingIndicator">
                <div class="disc-typing-dots"><span></span><span></span><span></span></div>
                <span id="discTypingText">Someone is typing...</span>
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
                        <i class="fas fa-user-secret"></i> Anon
                    </label>
                    <button class="disc-post-btn" onclick="discSubmitReply(${discId})">
                        <i class="fas fa-paper-plane"></i> Post
                    </button>
                </div>
            </div>
        </div>`;
}

function wireCompose(discId) {
    // Auto-grow textarea
    const ta = document.getElementById('discTextarea');
    if (ta) {
        ta.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            // Send typing signal
            sendTypingSignal(discId);
            clearTimeout(discTypingTimeout);
            discTypingTimeout = setTimeout(() => {}, 5000);
        });
    }

    // File preview
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

// Typing
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

// Poll new replies
async function pollNewReplies(discId) {
    try {
        const res  = await fetch(`api/learner/get_new_replies.php?discussion_id=${discId}&after_id=${lastReplyId}`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;

        const scroll    = document.getElementById('discPostsScroll');
        const bottom    = document.getElementById('discBottom');
        const atBottom  = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;

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
        // Update reply count in cache directly (no reload needed)
        if (window.discussionCache) {
            const disc = window.discussionCache.find(d => d.id == discId);
            if (disc) disc.reply_count = (parseInt(disc.reply_count) || 0) + rows.length;
        }
    } catch (e) {}
}

// Submit reply
window.discSubmitReply = async function(discId) {
    const ta       = document.getElementById('discTextarea');
    const fi       = document.getElementById('discFileInput');
    const anon     = document.getElementById('discAnon');
    const replyTo  = window._discReplyTo ?? 0;
    const message  = ta ? ta.value.trim() : '';

    if (!message && (!fi || !fi.files[0])) return;

    const fd = new FormData();
    fd.append('discussion_id', discId);
    fd.append('message', message);
    fd.append('anonymous', anon?.checked ? '1' : '0');
    fd.append('reply_to', replyTo);
    if (fi?.files[0]) fd.append('attachment', fi.files[0]);

    // Optimistic UI — disable button
    const btn = document.querySelector('.disc-post-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const res  = await fetch('api/learner/submit_reply.php', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Clear compose
        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        if (fi) fi.value = '';
        discCancelReply();
        discClearFile();

        // Render new reply instantly
        const scroll = document.getElementById('discPostsScroll');
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

        // Bust cache so list shows updated reply count
       // Update reply count in cache directly (no reload needed)
if (window.discussionCache) {
    const disc = window.discussionCache.find(d => d.id == discId);
    if (disc) disc.reply_count = (parseInt(disc.reply_count) || 0) + 1;
}

    } catch (e) {
        alert(e.message || 'Failed to post reply');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post'; }
    }
};

// Reply helpers
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

// Report modal (inline — no separate page needed)
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

// Media overlay
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
    if (window.configureHeader) window.configureHeader({ title: 'New Discussion', mode: 'detail' });

    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        // Fetch teacher list (cached)
        if (!window.teacherListCache) {
            const res  = await fetch('api/learner/get_teachers.php');
            const data = await res.json();
            window.teacherListCache = data;
        }

        renderCreateForm(window.teacherListCache);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `<p style="color:#ff5555;text-align:center;margin-top:50px;">Error loading form.</p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderCreateForm(teachers) {
    const apiArea = document.getElementById('api-content-area');

    const teacherOptions = teachers.map(t =>
        `<div class="disc-teacher-option" data-email="${escHtml(t.email)}" onclick="discToggleTeacher(this)">
            ${escHtml(t.display_name)}
         </div>`
    ).join('');

    apiArea.innerHTML = `
        <style>
            .disc-form-wrap { max-width:640px;margin:0 auto;padding:20px; }
            .disc-form-wrap h2 { color:#e2e8f0;font-size:20px;font-weight:800;margin:0 0 24px; }
            .disc-field { margin-bottom:20px; }
            .disc-field label { display:block;margin-bottom:8px;font-size:14px;font-weight:700;color:#c9d1d9; }
            .disc-field input,.disc-field textarea { width:100%;background:#1b1b1b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#e2e8f0;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;padding:12px 14px;box-sizing:border-box;outline:none;transition:border-color 0.2s; }
            .disc-field input:focus,.disc-field textarea:focus { border-color:rgba(79,209,197,0.4); }
            .disc-field textarea { min-height:110px;resize:vertical; }
            .disc-teachers-list { display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;background:#1b1b1b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px; }
            .disc-teacher-option { padding:10px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#c9d1d9;transition:0.15s; }
            .disc-teacher-option:hover { background:rgba(255,255,255,0.06); }
            .disc-teacher-option.selected { background:rgba(79,209,197,0.1);color:#4fd1c5;border:1px solid rgba(79,209,197,0.2); }
            .disc-anon-toggle { display:flex;align-items:center;gap:10px;padding:14px;background:#1b1b1b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer; }
            .disc-anon-toggle input { width:16px;height:16px;cursor:pointer;accent-color:#4fd1c5; }
            .disc-anon-toggle span { font-size:14px;font-weight:600;color:#c9d1d9; }
            .disc-attach-area { background:#1b1b1b;border:1px dashed rgba(255,255,255,0.15);border-radius:10px;padding:14px;text-align:center;cursor:pointer; }
            .disc-attach-area:hover { border-color:rgba(79,209,197,0.3); }
            .disc-submit-btn { width:100%;background:#4fd1c5;color:#0d1117;border:none;padding:14px;border-radius:12px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;transition:0.2s;display:flex;align-items:center;justify-content:center;gap:8px; }
            .disc-submit-btn:hover { background:#38b2ac; }
            .disc-submit-btn:disabled { opacity:0.6;cursor:not-allowed; }
            .disc-error { background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;padding:12px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;display:none; }
        </style>

        <div class="disc-form-wrap">
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
    const title    = document.getElementById('discTitle')?.value.trim();
    const message  = document.getElementById('discMessage')?.value.trim();
    const anon     = document.getElementById('discCreateAnon')?.checked;
    const fileInput= document.getElementById('discCreateFile');
    const errorEl  = document.getElementById('discFormError');
    const btn      = document.getElementById('discSubmitBtn');

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

        // Bust cache and go back to list
        window.discussionCache = null;
        window.fetchDiscussions();

    } catch (e) {
        errorEl.textContent = e.message || 'Failed to create discussion.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create Discussion';
    }
};