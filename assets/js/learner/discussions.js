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

    if (window.configureHeader) window.configureHeader({ title: escHtml(disc.title), mode: 'detail' });

    let lastDate = null;

    function maybeDate(dateStr) {
        const key = getDateKey(dateStr);
        if (key === lastDate) return '';
        lastDate = key;
        return `<div class="date-separator"><span>${getDateLabel(dateStr)}</span></div>`;
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

    replies.forEach((r) => {
        postsHtml += maybeDate(r.created_at);
        postsHtml += buildPostCard(r, user_role, is_in_class, disc.id);
    });

    lastReplyId     = replies.length > 0 ? replies[replies.length - 1].id : 0;
    lastSeenDateKey = replies.length > 0
        ? getDateKey(replies[replies.length - 1].created_at)
        : getDateKey(disc.created_at);

    const composeHtml = is_in_class ? buildCompose(disc.id) : '';

    apiArea.innerHTML = `
        <style>
            :root {
                --bg:           #0d1117;
                --surface:      #1a1919;
                --surface-2:    #222222;
                --border:       rgba(255,255,255,0.07);
                --border-hover: rgba(79,209,197,0.3);
                --text:         #e2e8f0;
                --text-muted:   #8b949e;
                --accent:       #4fd1c5;
                --accent-dim:   rgba(79,209,197,0.08);
                --my-line:      #4fd1c5;
                --danger:       #f85149;
                --radius:       14px;
                --radius-sm:    8px;
            }

            .disc-thread-wrap {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 120px);
                max-width: 960px;
                margin: 0 auto;
                padding: 0 20px;
                box-sizing: border-box;
            }
            @media (max-width: 768px) {
                .disc-thread-wrap { padding: 0; height: calc(100vh - 110px); }
            }

            /* Topic header */
            .topic-header {
                padding: 24px 0 16px 0;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
            }
            .topic-header .class-badge {
                display: inline-flex; align-items: center; gap: 6px;
                background: var(--accent-dim); border: 1px solid rgba(79,209,197,0.2);
                color: var(--accent); font-size: 11px; font-weight: 700;
                padding: 3px 10px; border-radius: 20px;
                text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
            }
            .topic-header h1 { font-size: 20px; font-weight: 800; color: var(--text); line-height: 1.3; }
            .topic-header .meta {
                margin-top: 6px; font-size: 12px; color: var(--text-muted);
                display: flex; align-items: center; gap: 12px;
            }
            .reply-count-pill {
                background: var(--surface-2); border: 1px solid var(--border);
                padding: 2px 8px; border-radius: 20px; font-size: 11px; color: var(--text-muted);
            }
            @media (max-width: 768px) { .topic-header { display: none; } }

            /* Scroll area */
            .posts-scroll {
                flex: 1; overflow-y: auto; padding: 20px 0;
                display: flex; flex-direction: column; gap: 2px;
                scrollbar-width: thin; scrollbar-color: var(--surface-2) transparent;
            }
            .posts-scroll::-webkit-scrollbar { width: 4px; }
            .posts-scroll::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 4px; }
            @media (max-width: 768px) { .posts-scroll { padding: 12px; gap: 4px; } }

            /* Date separator */
            .date-separator {
                display: flex; align-items: center; gap: 12px;
                margin: 16px 0 10px 0; color: var(--text-muted);
                font-size: 11px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.8px; flex-shrink: 0;
            }
            .date-separator::before,.date-separator::after {
                content: ''; flex: 1; height: 1px; background: var(--border);
            }

            /* Post card */
            .post-card {
                background: var(--surface); border: 1px solid var(--border);
                border-radius: var(--radius); padding: 16px 18px;
                transition: border-color 0.2s; position: relative;
                border-left: 3px solid transparent;
                animation: fadeUp 0.3s ease both;
            }
            .post-card:hover { border-color: rgba(255,255,255,0.1); }
            .post-card.is-op { background: rgba(79,209,197,0.04); border-color: rgba(79,209,197,0.15); border-left-color: var(--accent); }
            .post-card.is-me { border-left-color: var(--my-line); }
            @keyframes fadeUp {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            /* Post header */
            .post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
            .post-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); flex-shrink: 0; }
            .post-avatar-placeholder {
                width: 32px; height: 32px; border-radius: 50%;
                background: var(--surface-2); border: 2px solid var(--border);
                display: flex; align-items: center; justify-content: center;
                font-size: 12px; font-weight: 800; color: var(--text-muted);
                flex-shrink: 0; text-transform: uppercase;
            }
            .post-meta { flex: 1; min-width: 0; }
            .post-author { font-size: 13px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 6px; }
            .op-tag, .me-tag {
                font-size: 10px; font-weight: 700; padding: 1px 6px;
                border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;
            }
            .op-tag { background: var(--accent-dim); color: var(--accent); border: 1px solid rgba(79,209,197,0.2); }
            .me-tag { background: rgba(79,209,197,0.1); color: var(--accent); border: 1px solid rgba(79,209,197,0.2); }
            .post-time { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

            /* Reply quote */
            .reply-quote {
                background: rgba(255,255,255,0.03); border-left: 3px solid var(--accent);
                border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
                padding: 8px 12px; margin-bottom: 10px; font-size: 12px; color: var(--text-muted);
            }
            .reply-quote .quote-author { color: var(--accent); font-weight: 700; margin-bottom: 2px; font-size: 11px; }
            .reply-quote .quote-text {
                line-height: 1.4; overflow: hidden;
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            }

            /* Post body */
            .post-body { font-size: 14px; line-height: 1.65; color: var(--text); word-wrap: break-word; white-space: pre-wrap; }

            /* Attachment */
            .post-attachment {
                margin-top: 12px; border-radius: var(--radius-sm);
                overflow: hidden; border: 1px solid var(--border);
                display: inline-block; max-width: 280px;
            }
            .post-attachment img { width: 100%; display: block; cursor: zoom-in; transition: opacity 0.2s; }
            .post-attachment img:hover { opacity: 0.9; }
            .post-attachment .pdf-link {
                display: flex; align-items: center; gap: 10px;
                padding: 12px 16px; background: rgba(79,209,197,0.06);
                color: var(--accent); cursor: pointer; font-size: 13px; font-weight: 600;
            }
            .post-attachment .pdf-link:hover { background: rgba(79,209,197,0.12); }

            /* Post footer */
            .post-footer {
                display: flex; align-items: center; gap: 4px;
                margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border);
            }
            .action-btn {
                background: none; border: none; color: var(--text-muted);
                font-size: 12px; font-weight: 600; cursor: pointer;
                padding: 4px 10px; border-radius: 6px;
                display: flex; align-items: center; gap: 5px;
                font-family: 'Nunito', sans-serif; transition: background 0.15s, color 0.15s;
            }
            .action-btn:hover { background: rgba(255,255,255,0.05); color: var(--text); }
            .action-btn.reply-btn:hover { color: var(--accent); }
            .action-btn.report-btn:hover { color: var(--danger); }

            /* Compose */
            .compose-area { flex-shrink: 0; padding: 16px 0 20px 0; border-top: 1px solid var(--border); }
            @media (max-width: 768px) { .compose-area { padding: 12px; } }

            #discReplyPreview {
                display: none; background: var(--accent-dim);
                border: 1px solid rgba(79,209,197,0.2); border-radius: var(--radius-sm);
                padding: 8px 12px; margin-bottom: 10px;
                font-size: 12px; color: var(--text-muted);
                align-items: center; gap: 8px;
            }
            #discReplyPreview.show { display: flex; }
            #discReplyPreview .rp-label { color: var(--accent); font-weight: 700; flex-shrink: 0; }
            #discReplyPreview .rp-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            #discReplyPreview .cancel-reply {
                background: none; border: none; color: var(--danger);
                cursor: pointer; font-size: 16px; line-height: 1; flex-shrink: 0; padding: 0 4px;
            }

            #discFilePreview {
                display: none; align-items: center; gap: 8px;
                background: var(--surface-2); border: 1px solid var(--border);
                border-radius: var(--radius-sm); padding: 8px 12px;
                margin-bottom: 10px; font-size: 12px; color: var(--text-muted);
            }
            #discFilePreview.show { display: flex; }
            #discFilePreview img { width: 36px; height: 36px; object-fit: cover; border-radius: 4px; }
            #discFilePreview .clear-file { background: none; border: none; color: var(--danger); cursor: pointer; margin-left: auto; font-size: 16px; }

            .compose-box {
                background: var(--surface); border: 1px solid var(--border);
                border-radius: var(--radius); transition: border-color 0.2s; overflow: hidden;
            }
            .compose-box:focus-within { border-color: rgba(79,209,197,0.4); }
            .compose-box textarea {
                width: 100%; background: transparent; border: none; color: var(--text);
                font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 600;
                padding: 14px 16px 8px 16px; resize: none; outline: none;
                min-height: 48px; max-height: 140px; line-height: 1.5; box-sizing: border-box;
            }
            .compose-box textarea::placeholder { color: var(--text-muted); }
            .compose-toolbar {
                display: flex; align-items: center; gap: 4px;
                padding: 8px 12px; border-top: 1px solid var(--border);
            }
            .tool-btn {
                background: none; border: none; color: var(--text-muted);
                cursor: pointer; padding: 6px 8px; border-radius: 6px;
                transition: background 0.15s, color 0.15s;
                display: flex; align-items: center; gap: 5px;
                font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700;
            }
            .tool-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
            .tool-btn.anon-btn { color: var(--text-muted); }
            .tool-btn.anon-btn.anon-on { color: var(--accent); }
            .spacer { flex: 1; }
            .post-btn {
                background: var(--accent); color: #0d1117; border: none;
                padding: 8px 18px; border-radius: 8px;
                font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800;
                cursor: pointer; display: flex; align-items: center; gap: 6px;
                transition: background 0.2s, transform 0.1s;
            }
            .post-btn:hover { background: #38b2ac; }
            .post-btn:active { transform: scale(0.97); }
            .post-btn:disabled { opacity: 0.6; cursor: not-allowed; }

            /* Typing indicator */
            .typing-indicator {
                display: none; align-items: center; gap: 10px;
                padding: 8px 0 4px 0; font-size: 14px;
                color: var(--text-muted); font-weight: 700; min-height: 32px;
            }
            .typing-indicator.visible { display: flex; }
            .typing-dots { display: flex; align-items: center; gap: 5px; }
            .typing-dots span {
                width: 9px; height: 9px; border-radius: 50%;
                background: var(--accent); display: inline-block;
                animation: typingBounce 1.2s infinite ease-in-out;
            }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typingBounce {
                0%,60%,100% { transform: translateY(0); opacity: 0.4; }
                30%          { transform: translateY(-6px); opacity: 1; }
            }

            /* New message banner */
            #discNewMsgBanner {
                position: sticky; bottom: 12px; left: 50%; transform: translateX(-50%);
                background: var(--accent); color: #0d1117; border: none; border-radius: 20px;
                padding: 8px 18px; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13px;
                cursor: pointer; display: block; margin: 0 auto;
                box-shadow: 0 4px 16px rgba(79,209,197,0.4); z-index: 50;
            }
        </style>

        <div class="disc-thread-wrap">

            <!-- Desktop topic header -->
            <div class="topic-header">
                <div class="class-badge"><i class="fas fa-chalkboard"></i> ${escHtml(disc.class_name)}</div>
                <h1>${escHtml(disc.title)}</h1>
                <div class="meta">
                    <span>${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>
                    <span class="reply-count-pill">
                        <i class="fas fa-clock" style="margin-right:4px;"></i>
                        Started ${new Date(disc.created_at.replace(' ','T')).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                    </span>
                </div>
            </div>

            <div class="posts-scroll" id="discPostsScroll">
                ${postsHtml}
                <div id="discBottom"></div>
            </div>

            ${composeHtml}
        </div>`;

    // Scroll to bottom
    const scroll = document.getElementById('discPostsScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;

    wireCompose(disc.id);
}

function buildPostCard(r, user_role, is_in_class, discId) {
    const isOp       = r.is_op || false;
    const isMe       = r.is_me == 1;
    const showAvatar = !(r.replier_anonymous && user_role === 'learner');
    const initial    = (r.replier_display || '?').charAt(0).toUpperCase();

    const avatarHtml = showAvatar
        ? `<img src="uploads/learners/${escHtml(r.profile_picture || 'default.png')}" class="post-avatar"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="post-avatar-placeholder" style="display:none;">${initial}</div>`
        : `<div class="post-avatar-placeholder">?</div>`;

    const tags = (isOp ? `<span class="op-tag">OP</span>` : '') +
                 (isMe ? `<span class="me-tag">You</span>` : '');

    const quoteHtml = r.quote_author
        ? `<div class="reply-quote">
               <div class="quote-author">${escHtml(r.quote_author)}</div>
               <div class="quote-text">${escHtml(r.quote_text || '')}${(r.quote_text||'').length >= 100 ? '…' : ''}</div>
           </div>` : '';

    let attachHtml = '';
    if (r.attachment) {
        const ext   = r.attachment.split('.').pop().toLowerCase();
        const path  = 'uploads/discussions/' + r.attachment;
        const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
        attachHtml  = `<div class="post-attachment">` + (isImg
            ? `<img src="${path}" alt="Attachment" onclick="discOpenMedia('${path}','image')">`
            : `<div class="pdf-link" onclick="discOpenMedia('${path}','pdf')"><i class="fas fa-file-pdf fa-lg"></i><span>Open PDF Document</span></div>`)
            + `</div>`;
    }

    const replyBtn  = is_in_class
        ? `<button class="action-btn reply-btn" onclick="discSetReply(${r.id || 0},'${escHtml(r.replier_display)}','${escHtml((r.message||'').substring(0,100))}')"><i class="fas fa-reply"></i> Reply</button>`
        : '';
    const reportBtn = user_role === 'learner' && !isMe && r.id
        ? `<button class="action-btn report-btn" onclick="discShowReport(${r.id},${discId})"><i class="fas fa-flag"></i> Report</button>`
        : '';

    return `
        <div class="post-card ${isOp ? 'is-op' : ''} ${isMe ? 'is-me' : ''}" data-id="${r.id || 0}" style="animation:fadeUp 0.3s ease both;">
            <div class="post-header">
                ${avatarHtml}
                <div class="post-meta">
                    <div class="post-author">${escHtml(r.replier_display)} ${tags}</div>
                    <div class="post-time">${formatTime(r.created_at)}</div>
                </div>
            </div>
            ${quoteHtml}
            <div class="post-body">${escHtml(r.message || '')}</div>
            ${attachHtml}
            <div class="post-footer">${replyBtn}${reportBtn}</div>
        </div>`;
}

function buildCompose(discId) {
    return `
        <div class="compose-area">
            <div class="typing-indicator" id="discTypingIndicator">
                <div class="typing-dots"><span></span><span></span><span></span></div>
                <span id="discTypingText">Someone is typing...</span>
            </div>
            <div id="discReplyPreview">
                <span class="rp-label">Replying to:</span>
                <span class="rp-text" id="discPreviewText"></span>
                <button class="cancel-reply" onclick="discCancelReply()" type="button">✕</button>
            </div>
            <div id="discFilePreview">
                <img id="discPreviewImg" src="" alt="Preview" style="display:none;">
                <span id="discFileName"></span>
                <button class="clear-file" type="button" onclick="discClearFile()">✕</button>
            </div>
            <div class="compose-box">
                <textarea id="discTextarea" rows="1" placeholder="Add to the discussion…"></textarea>
                <div class="compose-toolbar">
                    <label class="tool-btn" title="Attach image or PDF">
                        <i class="fas fa-paperclip"></i>
                        <input type="file" id="discFileInput" accept="image/*,.pdf" style="display:none;">
                    </label>
                    <label class="tool-btn anon-btn anon-on" id="discAnonLabel" title="Post anonymously">
                        <input type="checkbox" id="discAnon" checked onchange="document.getElementById('discAnonLabel').classList.toggle('anon-on',this.checked);" style="display:none;">
                        <i class="fas fa-user-secret"></i> Anonymous
                    </label>
                    <div class="spacer"></div>
                    <button class="post-btn" id="discPostBtn" onclick="discSubmitReply(${discId})">
                        <i class="fas fa-paper-plane"></i> Reply
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
        const res  = await fetch(`api/get_new_replies.php?discussion_id=${discId}&after_id=${lastReplyId}`);
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
        window.discussionCache = null;

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