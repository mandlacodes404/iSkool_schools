function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
/* assets/js/learner/discussions.js */

window.discussionCache       = null;
window.discussionThreadCache = {};
window.discussionPrefetchPromise = null;
let discPollInterval         = null;
let discTypingPollInterval   = null;
let discTypingTimeout        = null;
let currentDiscId            = null;
let lastReplyId              = 0;
let lastSeenDateKey          = null;

function saveDiscussionPageState(patch = {}) {
    const list = document.getElementById('disc-sidebar-list');
    const mainContent = document.querySelector('.main-content');
    const state = Object.assign({
        activeDiscId: currentDiscId,
        sidebarScroll: list ? list.scrollTop : 0,
        mainScroll: mainContent ? mainContent.scrollTop : 0,
    }, patch);
    if (window.learnerPageState) window.learnerPageState.set('discussions', state);
    else sessionStorage.setItem('discussionPageState', JSON.stringify(state));
}

function restoreDiscussionPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('discussions')
            : JSON.parse(sessionStorage.getItem('discussionPageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
        requestAnimationFrame(() => {
            const list = document.getElementById('disc-sidebar-list');
            const mainContent = document.querySelector('.main-content');
            if (list) list.scrollTop = state.sidebarScroll || 0;
            if (mainContent) mainContent.scrollTop = state.mainScroll || 0;
            if (isDesktop() && state.activeDiscId) {
                window.loadDiscussionThread(state.activeDiscId);
            }
        });
    } catch (e) { /* ignore bad state */ }
}

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

function normaliseDiscId(discId) {
    const id = parseInt(discId, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function getDiscussionById(discId) {
    if (!Array.isArray(window.discussionCache)) return null;
    return window.discussionCache.find(d => String(d.id) === String(discId)) || null;
}

function formatReplyCount(count) {
    const value = parseInt(count, 10) || 0;
    return `${value} ${value === 1 ? 'reply' : 'replies'}`;
}

function updateThreadPostCount(discId) {
    const meta = document.getElementById('discThreadPostCount');
    if (!meta || String(currentDiscId) !== String(discId)) return;

    const cached = window.discussionThreadCache?.[discId];
    const replyCount = cached && Array.isArray(cached.replies)
        ? cached.replies.length
        : document.querySelectorAll('#discPostsScroll .disc-post-card[data-id]:not([data-id="0"])').length;
    const posts = replyCount + 1;
    const subject = cached?.discussion?.subject_name || '';
    meta.textContent = `${subject ? subject + ' · ' : ''}${posts} post${posts === 1 ? '' : 's'}`;
}

function updateDiscussionListCount(discId, count) {
    const value = parseInt(count, 10) || 0;
    const disc = getDiscussionById(discId);
    if (disc) disc.reply_count = value;

    const desktopPill = document.querySelector(`.dsk-item[data-disc-id="${discId}"] .dsk-item-pill`);
    if (desktopPill) desktopPill.textContent = formatReplyCount(value);

    const mobilePill = document.querySelector(`[data-disc-mobile-count="${discId}"]`);
    if (mobilePill) mobilePill.innerHTML = `<i class="fas fa-comment" style="font-size:10px;"></i>${value}`;
}

function bumpDiscussionListCount(discId, delta) {
    const disc = getDiscussionById(discId);
    const next = (parseInt(disc?.reply_count, 10) || 0) + delta;
    updateDiscussionListCount(discId, next);
}

function addRepliesToThreadCache(discId, replies) {
    if (!window.discussionThreadCache?.[discId] || !Array.isArray(replies) || replies.length === 0) return replies.length;

    const cachedReplies = window.discussionThreadCache[discId].replies || [];
    const knownIds = new Set(cachedReplies.map(r => String(r.id)));
    let added = 0;
    replies.forEach(reply => {
        if (!knownIds.has(String(reply.id))) {
            cachedReplies.push(reply);
            knownIds.add(String(reply.id));
            added++;
        }
    });
    cachedReplies.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    window.discussionThreadCache[discId].replies = cachedReplies;
    return added;
}

function appendReplyToDom(discId, reply, scrollToBottom = false) {
    const scroll   = document.getElementById('discPostsScroll');
    const bottomEl = document.getElementById('discBottom');
    if (!scroll || !bottomEl || !reply) return false;

    if (document.querySelector(`#discPostsScroll .disc-post-card[data-id="${reply.id}"]`)) {
        lastReplyId = Math.max(lastReplyId, parseInt(reply.id, 10) || 0);
        return false;
    }

    const dk = getDateKey(reply.created_at);
    if (dk !== lastSeenDateKey) {
        const sep = document.createElement('div');
        sep.className = 'disc-date-sep';
        sep.innerHTML = `<span>${getDateLabel(reply.created_at)}</span>`;
        scroll.insertBefore(sep, bottomEl);
        lastSeenDateKey = dk;
    }

    const card = document.createElement('div');
    card.innerHTML = buildPostCard(reply, 'learner', true, discId).trim();
    scroll.insertBefore(card.firstChild, bottomEl);
    lastReplyId = Math.max(lastReplyId, parseInt(reply.id, 10) || 0);
    if (scrollToBottom) scroll.scrollTop = scroll.scrollHeight;
    return true;
}

function handleRepliesAdded(discId, replies, options = {}) {
    const rows = Array.isArray(replies) ? replies : [replies].filter(Boolean);
    if (rows.length === 0) return 0;

    const newCount = addRepliesToThreadCache(discId, rows);

    let addedToDom = 0;
    if (String(currentDiscId) === String(discId)) {
        rows.forEach(reply => {
            if (appendReplyToDom(discId, reply, !!options.scrollToBottom)) addedToDom++;
        });
        updateThreadPostCount(discId);
    } else {
        rows.forEach(reply => {
            lastReplyId = Math.max(lastReplyId, parseInt(reply.id, 10) || 0);
        });
    }

    if (options.absoluteCount !== undefined) {
        updateDiscussionListCount(discId, options.absoluteCount);
    } else if (newCount > 0) {
        bumpDiscussionListCount(discId, newCount);
    }

    return addedToDom;
}

// Returns true when the split layout should be active
function isDesktop() { return window.innerWidth >= 768; }

// Thread target: right panel on desktop, full api-content-area on mobile
function getThreadTarget() {
    if (isDesktop()) return document.getElementById('disc-thread-panel');
    return document.getElementById('api-content-area');
}

function discAvatarColor(seed) {
    const text = String(seed || 'Learner');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;

    /* Mobile: softer, less saturated tint (rgba-style translucency via hsla).
       Desktop keeps the original solid, more saturated colour untouched. */
    if (!isDesktop()) {
        return {
            bg: `hsla(${hue}, 45%, 55%, 0.55)`,
            color: '#ffffff',
        };
    }

    return {
        bg: `hsl(${hue} 68% 38%)`,
        color: '#ffffff',
    };
}

function discInitials(displayName) {
    const parts = String(displayName || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function discAvatarSeed(email, displayName) {
    return email || displayName || 'Learner';
}

function discTypeLabel(discussion) {
    const labels = {
        homework: 'Homework help',
        general: 'General',
        off_topic: 'Off-topic',
    };
    return discussion?.type_label || labels[discussion?.type] || labels.general;
}

// ─────────────────────────────────────────────
// 1. DISCUSSION LIST
// ─────────────────────────────────────────────
function unlockMobileLayout() {
    const mc = document.querySelector('.main-content');
    if (mc) {
        mc.style.overflow      = '';
        mc.style.height        = '';
        mc.style.display       = '';
        mc.style.flexDirection = '';
    }
    const apiArea = document.getElementById('api-content-area');
    if (apiArea) {
        apiArea.classList.remove('disc-thread-active');
        apiArea.style.flex          = '';
        apiArea.style.overflow      = '';
        apiArea.style.display       = '';
        apiArea.style.flexDirection = '';
        apiArea.style.padding       = '';
        apiArea.style.paddingBottom = '';
        apiArea.style.height        = '';
    }
    /* Restore the bottom nav when leaving a thread */
    const nav = document.getElementById('mobileBottomNav');
    if (nav) nav.style.display = '';
    /* Remove the mobile sheet elements if they exist */
    document.getElementById('discMobileSheet')?.remove();
    document.getElementById('discMobileTrigger')?.remove();
    document.getElementById('discMobileOverlay')?.remove();
    /* Remove the long-press action popup if it exists */
    document.getElementById('discLongPressMenu')?.remove();
    document.getElementById('discLongPressOverlay')?.remove();
}

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// Only prefetches the discussion list (not threads — those stay on-demand).
// Safe to call while polling may be running: prefetch doesn't start polling.
// ─────────────────────────────────────────────
window.prefetchDiscussions = function () {
    if (window.discussionCache) return;
    if (window.discussionPrefetchPromise) return;
    window.discussionPrefetchPromise = fetch('api/learner/get_discussions.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.discussionCache = data; })
        .catch(() => {})
        .finally(() => { window.discussionPrefetchPromise = null; });
};

window.fetchDiscussions = async function(options = {}) {
    stopDiscPolling();
    const openDiscussionId = normaliseDiscId(
        typeof options === 'object' ? options.openDiscussionId : options
    );
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

    // If prefetch is still in-flight, wait for it (no duplicate request)
    if (window.discussionPrefetchPromise) {
        if (loader) loader.style.display = 'flex';
        await window.discussionPrefetchPromise;
    }

    if (window.discussionCache) {
        renderDiscussions(window.discussionCache);
        if (loader) loader.style.display = 'none';
        if (openDiscussionId) {
            await window.loadDiscussionThread(openDiscussionId, { forceRefresh: true });
        } else {
            restoreDiscussionPageState();
        }
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/learner/get_discussions.php');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        window.discussionCache = data;
        renderDiscussions(data);
        if (openDiscussionId) {
            await window.loadDiscussionThread(openDiscussionId, { forceRefresh: true });
        } else {
            restoreDiscussionPageState();
        }
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
            .dsk-item-type-pill {
                background: rgba(255,255,255,0.05);
                color: #8b949e;
                border: 1px solid rgba(255,255,255,0.07);
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
                background: #0a0a0c;
                position: relative;
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

    _discInjectChromeCanvas();
}

// ── Liquid chrome WebGL background for #disc-thread-panel
function _discInjectChromeCanvas() {
    if (document.getElementById('disc-chrome-canvas')) return;
    const panel = document.getElementById('disc-thread-panel');
    if (!panel) return;

    // Ensure panel is positioned so absolute canvas fills it
    panel.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.id = 'disc-chrome-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
    panel.insertBefore(canvas, panel.firstChild);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { canvas.remove(); return; }

    const vert = `attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0,1);}`;
    const frag = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
float hash21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*f*(f*(f*6.-15.)+10.);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.48;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res.xy;
  uv=(uv*2.-1.)*vec2(u_res.x/u_res.y,1.);
  float t=u_time*0.058;
  vec2 mouse=(u_mouse-0.5)*0.18;
  vec2 p=uv*1.4+mouse;
  vec2 w1=vec2(fbm(p+vec2(0.,t*0.6)+vec2(1.7,9.2)),fbm(p+vec2(t*0.5,0.)+vec2(8.3,2.8)));
  vec2 w2=vec2(fbm(p+1.8*w1+vec2(0.3,6.1)+t*0.4),fbm(p+1.8*w1+vec2(5.1,3.3)+t*0.35));
  float f=fbm(p+1.4*w2+vec2(t*0.25));
  float lum=pow(f,3.2)*0.28;
  float ridge=smoothstep(0.52,0.60,f);
  float soft=ridge*0.04;
  float vein=smoothstep(0.62,0.70,f)*0.10;
  vec3 base=vec3(0.015,0.016,0.020);
  vec3 mid=vec3(0.055,0.056,0.062);
  vec3 silver=vec3(0.22,0.24,0.28);
  vec3 col=mix(base,mid,smoothstep(0.,0.18,lum+soft));
  col=mix(col,silver,vein);
  vec2 vig=uv/vec2(u_res.x/u_res.y,1.);
  float v=1.-dot(vig*0.55,vig*0.55);
  v=clamp(pow(v,2.2),0.,1.);
  col*=mix(0.18,1.,v);
  gl_FragColor=vec4(col,1.);
}`;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes   = gl.getUniformLocation(prog, 'u_res');
    const uTime  = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    let mx=0.5, my=0.5, tx=0.5, ty=0.5;
    panel.addEventListener('mousemove', e => {
        const r = panel.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width;
        ty = 1 - (e.clientY - r.top) / r.height;
    });

    function resizeCanvas() {
        const rect = panel.getBoundingClientRect();
        const dpr  = Math.min(window.devicePixelRatio || 1, 2);
        const w = rect.width  || panel.offsetWidth  || 800;
        const h = rect.height || panel.offsetHeight || 600;
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);

    // Wait one frame for layout to settle before first resize
    requestAnimationFrame(() => {
        resizeCanvas();
        let start = null;
        function frame(ts) {
            if (!document.getElementById('disc-chrome-canvas')) return;
            if (!start) start = ts;
            const t = (ts - start) * 0.001;
            mx += (tx - mx) * 0.018;
            my += (ty - my) * 0.018;
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, t);
            gl.uniform2f(uMouse, mx, my);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
}
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
                <span class="dsk-item-type-pill">${escHtml(discTypeLabel(d))}</span>
                <span class="dsk-item-pill">${formatReplyCount(d.reply_count)}</span>
            </div>
            <div class="dsk-item-preview">${escHtml(d.preview)}</div>
        </div>`
    ).join('');
    if (list.dataset.discStateWired !== '1') {
        list.dataset.discStateWired = '1';
        list.addEventListener('scroll', () => saveDiscussionPageState(), { passive: true });
    }
}

function renderMobileList(data) {
    if (!isDesktop()) unlockMobileLayout();
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
            const avatarColor = discAvatarColor(discAvatarSeed(d.creator_email, d.creator_display));
            const initial      = discInitials(d.creator_display);
            html += `
                <div onclick="loadDiscussionThread(${d.id})"
                     style="background:#272726;border:none;
                            border-radius:14px;padding:14px;cursor:pointer;transition:background 0.2s;
                            display:flex;gap:12px;align-items:flex-start;"
                     onmouseover="this.style.background='rgba(79,209,197,0.06)'"
                     onmouseout="this.style.background='#272726'">
                    <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor.bg};
                                color:${avatarColor.color};display:flex;align-items:center;justify-content:center;
                                font-size:13px;font-weight:800;flex-shrink:0;text-transform:uppercase;
                                letter-spacing:0.03em;font-family:'Nunito',sans-serif;">${initial}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <h3 style="flex:1;min-width:0;margin:0;font-size:15px;font-weight:700;color:#e2e8f0;
                                       font-family:'Nunito',sans-serif;white-space:nowrap;overflow:hidden;
                                       text-overflow:ellipsis;">${escHtml(d.title)}</h3>
                            <span data-disc-mobile-count="${d.id}" style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:11px;
                                         font-weight:700;color:#4fd1c5;background:rgba(79,209,197,0.1);
                                         padding:3px 9px;border-radius:10px;font-family:'Nunito',sans-serif;">
                                <i class="fas fa-comment" style="font-size:10px;"></i>${d.reply_count}
                            </span>
                        </div>
                        <p style="margin:4px 0 0;font-size:13px;color:#abb2bf;font-family:'Nunito',sans-serif;
                                  line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${escHtml(d.preview)}
                        </p>
                        <div style="margin-top:6px;font-size:11px;color:#8b949e;font-family:'Nunito',sans-serif;
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            <span style="background:#1b1b1b;color:#8b949e;padding:3px 10px;border-radius:999px;margin-right:6px;">${escHtml(discTypeLabel(d))}</span>${escHtml(d.creator_display)} · ${escHtml(d.display_date)}
                        </div>
                    </div>
                </div>`;
        });
        html += `</div>`;
    }

    apiArea.innerHTML = html;
    const mainContent = document.querySelector('.main-content');
    if (mainContent && mainContent.dataset.discStateWired !== '1') {
        mainContent.dataset.discStateWired = '1';
        mainContent.addEventListener('scroll', () => saveDiscussionPageState(), { passive: true });
    }
}

// ─────────────────────────────────────────────
// 2. THREAD VIEW
// ─────────────────────────────────────────────
window.loadDiscussionThread = async function(discId, options = {}) {
    discId = normaliseDiscId(discId);
    if (!discId) return;

    stopDiscPolling();
    window._inDiscussionThread = true;
    saveDiscussionPageState({ activeDiscId: discId });

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (isDesktop() && apiArea && !document.getElementById('disc-split-wrap')) {
        injectDesktopShell(apiArea);
        if (window.discussionCache) renderSidebarList(window.discussionCache);
    }

    if (isDesktop()) {
        if (window.configureHeader) window.configureHeader({ title: 'Discussions', mode: 'standard' });
        document.querySelectorAll('.dsk-item').forEach(el => {
            el.classList.toggle('active', el.dataset.discId == discId);
        });
    } else {
        if (window.configureHeader) window.configureHeader({ title: 'Discussion', mode: 'detail' });
    }

    const loader = document.getElementById('loaderOverlay');

    if (window.discussionThreadCache[discId] && !options.forceRefresh) {
        renderThread(window.discussionThreadCache[discId]);
        currentDiscId          = discId;
        window._currentDiscId  = discId;
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
        window._currentDiscId  = discId;   /* used by mobile sheet reply */
        updateDiscussionListCount(discId, data.replies?.length || 0);
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
        replier_email: disc.creator_email,
        replier_display: disc.creator_display,
        profile_picture: disc.creator_pic,
        is_me: disc.is_op_me ? 1 : 0,
        quote_author: null,
        quote_text: null,
        is_op: true,
    }, user_role, is_in_class, disc.id);

    replies.forEach(r => {
        postsHtml += maybeDate(r.created_at);
        postsHtml += buildPostCard(r, user_role, is_in_class, disc.id);
    });

    lastReplyId     = replies.length > 0
        ? Math.max(...replies.map(r => parseInt(r.id, 10) || 0))
        : 0;
    lastSeenDateKey = replies.length > 0
        ? getDateKey(replies[replies.length - 1].created_at)
        : getDateKey(disc.created_at);

    const composeHtml = is_in_class ? buildCompose(disc.id) : '';

    /* MOBILE: lock .main-content so the thread fills it like WhatsApp */
    if (!isDesktop()) {
        const mc = document.querySelector('.main-content');
        if (mc) {
            mc.style.overflow      = 'hidden';
            mc.style.height        = '100%';
            mc.style.display       = 'flex';
            mc.style.flexDirection = 'column';
        }
        const apiArea = document.getElementById('api-content-area');
        if (apiArea) {
            apiArea.classList.add('disc-thread-active');
            apiArea.style.flex          = '1';
            apiArea.style.overflow      = 'hidden';
            apiArea.style.display       = 'flex';
            apiArea.style.flexDirection = 'column';
            apiArea.style.padding       = '0';
            apiArea.style.paddingBottom = '0';
            /* Use 100% not 0 — height:0 collapses the flex child and breaks scroll */
            apiArea.style.height        = '100%';
        }
        /* Hide the bottom nav while inside a thread */
        const nav = document.getElementById('mobileBottomNav');
        if (nav) nav.style.display = 'none';
    }

    target.innerHTML = `
        <style>
            /* LAYOUT */
            .disc-thread-wrap { display:flex; flex-direction:column; flex:1; overflow:hidden; height:100%; min-height:0; position:relative; z-index:1; }
            .disc-thread-head { padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0; background:rgba(10,10,14,0.75); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); position:relative; z-index:2; }
            .disc-thread-head-title { font-size:14px; font-weight:700; color:#e2e8f0; font-family:'Nunito',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .disc-thread-head-meta { font-size:11px; color:#8b949e; font-family:'Nunito',sans-serif; margin-top:2px; }

            /* ── SCROLL AREA — takes all remaining space, compose stays below ── */
            .disc-posts-scroll { flex:1; overflow-y:auto; padding:12px 10px 16px; display:flex; flex-direction:column; gap:0; scrollbar-width:thin; scrollbar-color:#1b1b1b transparent; -webkit-overflow-scrolling:touch; min-height:0; background:transparent; position:relative; z-index:1; }

            @media (max-width: 767px) {
                /* Enough room for the trigger bar (≈64px) + safe area + breathing room */
                .disc-posts-scroll { padding-bottom: 100px; }
                /* Hide the desktop compose box on mobile — replaced by the floating sheet */
                .disc-compose { display: none !important; }
                /* Transparent on mobile only — lets the chat/thread area show the real page background */
                .disc-thread-wrap { background: transparent; }
                .disc-posts-scroll { background: transparent; }
                /* Reply/Report buttons are replaced by the long-press action popup on mobile */
                .disc-footer { display: none !important; }
            }

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
            .disc-tag.me { background:rgba(79,209,197,0.12); color:#4fd1c5; border:1px solid rgba(79,209,197,0.25); }
            .disc-tag.teacher { background:rgba(56,178,172,0.12); color:#38b2ac; border:1px solid rgba(56,178,172,0.25); }

            /* ── BUBBLE ── */
            .disc-body-wrap { background:rgba(20,18,18,0.82); border:1px solid rgba(255,255,255,0.07); border-radius:0 12px 12px 12px; padding:11px 14px; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
            .disc-body-wrap.is-op { background:rgba(79,209,197,0.06); border-color:rgba(79,209,197,0.15); }
            .disc-body-wrap.is-me { border-color:rgba(79,209,197,0.2); }

            /* Mobile-only bubble overrides — placed after the base rules above so they
               win the cascade on mobile without needing !important or touching desktop. */
            @media (max-width: 767px) {
                .disc-body-wrap { background: #272726; border-color: transparent; }
                .disc-body-wrap.is-op { background: #272726; border-color: transparent; }
                .disc-body-wrap.is-me { border-color: rgba(79,209,197,0.2); }
            }

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

            /* ── MOBILE LONG-PRESS ACTION POPUP ── */
            @media (max-width: 767px) {
                /* Stop the native text-selection callout (Copy/Look Up/Translate)
                   from appearing underneath our custom long-press popup. */
                .disc-post-card {
                    -webkit-user-select: none;
                    user-select: none;
                    -webkit-touch-callout: none;
                }
                .disc-body-wrap.disc-pressed { background: rgba(255,255,255,0.06); }
                #discLongPressOverlay {
                    position:fixed; inset:0; background:rgba(0,0,0,0.55);
                    z-index:5500; display:none; backdrop-filter:blur(2px);
                    -webkit-backdrop-filter:blur(2px); transition:opacity 0.25s ease; opacity:0;
                }
                #discLongPressMenu {
                    position:fixed; z-index:5600; background:#272726;
                    border:1px solid rgba(255,255,255,0.08); border-radius:12px;
                    overflow:hidden; min-width:150px;
                    box-shadow:0 8px 28px rgba(0,0,0,0.45);
                    opacity:0; transform:scale(0.92); transition:opacity 0.15s ease, transform 0.15s ease;
                }
                #discLongPressMenu.show { opacity:1; transform:scale(1); }
                #discLongPressMenu button {
                    display:flex; align-items:center; gap:10px; width:100%;
                    background:none; border:none; color:#e2e8f0;
                    font-family:'Nunito',sans-serif; font-size:14px; font-weight:700;
                    padding:12px 16px; cursor:pointer; text-align:left;
                }
                #discLongPressMenu button:not(:last-child) { border-bottom:1px solid rgba(255,255,255,0.06); }
                #discLongPressMenu button.report { color:#f85149; }
                #discLongPressMenu button i { font-size:13px; width:16px; text-align:center; }
            }

            /* ── NESTED REPLY ── */
            .disc-nested-reply { display:flex; gap:10px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); }
            .disc-nested-avatar { width:22px; height:22px; border-radius:50%; background:#222; border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#8b949e; flex-shrink:0; text-transform:uppercase; overflow:hidden; }
            .disc-nested-avatar img { width:100%; height:100%; object-fit:cover; }
            .disc-nested-content { flex:1; min-width:0; }
            .disc-nested-header { display:flex; align-items:center; gap:5px; margin-bottom:3px; }
            .disc-nested-name { font-size:12px; font-weight:700; color:#c9d1d9; }
            .disc-nested-time { font-size:10px; color:#8b949e; margin-left:auto; }
            .disc-nested-body { font-size:13px; color:#c9d1d9; line-height:1.55; word-wrap:break-word; white-space:pre-wrap; }

            /* ── COMPOSE — always pinned to bottom of the flex column, never floats ── */
            .disc-compose { flex-shrink:0; padding:10px 12px 14px; border-top:1px solid rgba(255,255,255,0.07); background:rgba(10,10,14,0.75); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); position:relative; z-index:2; }

            /* disc-compose is desktop-only; mobile uses discMobileSheet instead */
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

            /* ── VOICE NOTE PLAYER — pill + dot trail ── */
            .disc-voice-player { display:flex; align-items:center; gap:8px; background:rgba(79,209,197,0.06); border:1px solid rgba(79,209,197,0.18); border-radius:999px; padding:5px 14px 5px 5px; margin-top:8px; min-width:200px; max-width:280px; }
            .disc-voice-play-btn { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#4fd1c5,#38b2ac); border:none; color:#0d1117; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; transition:0.2s; box-shadow:0 0 0 4px rgba(79,209,197,0.12); }
            .disc-voice-play-btn:hover { transform:scale(1.07); box-shadow:0 0 0 6px rgba(79,209,197,0.18); }
            .disc-voice-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
            /* dot trail replaces waveform bars */
            .disc-voice-waveform { display:flex; align-items:center; gap:4px; cursor:pointer; }
            .disc-voice-waveform-bar { width:8px; height:8px; border-radius:50%; background:rgba(79,209,197,0.2); transition:background 0.15s, transform 0.15s; flex-shrink:0; }
            .disc-voice-waveform-bar.played { background:#4fd1c5; }
            .disc-voice-waveform-bar.active { background:#4fd1c5; transform:scale(1.45); }
            .disc-voice-bottom { display:flex; align-items:center; justify-content:space-between; }
            .disc-voice-time { font-size:10px; color:#8b949e; font-weight:700; font-family:'Nunito',sans-serif; }
            .disc-voice-label { font-size:9px; color:rgba(79,209,197,0.6); font-weight:700; font-family:'Nunito',sans-serif; text-transform:uppercase; letter-spacing:0.05em; }

            /* ── VOICE RECORDER UI ── */
            .disc-voice-preview { display:none; align-items:center; gap:10px; background:rgba(248,81,73,0.05); border:1px solid rgba(248,81,73,0.2); border-radius:12px; padding:10px 14px; margin-bottom:8px; }
            .disc-voice-preview.show { display:flex; }
            .disc-voice-preview.ready { background:rgba(79,209,197,0.05); border-color:rgba(79,209,197,0.2); }
            .disc-voice-rec-dot { width:10px; height:10px; border-radius:50%; background:#f85149; animation:discRecPulse 1s infinite; flex-shrink:0; box-shadow:0 0 0 3px rgba(248,81,73,0.15); }
            @keyframes discRecPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
            .disc-voice-rec-done { width:10px; height:10px; border-radius:50%; background:#4fd1c5; flex-shrink:0; box-shadow:0 0 0 3px rgba(79,209,197,0.15); }
            .disc-voice-rec-bars { display:flex; align-items:center; gap:2px; height:18px; }
            .disc-voice-rec-bar { width:3px; border-radius:2px; background:#f85149; animation:discRecBounce 0.8s infinite ease-in-out; }
            .disc-voice-rec-bar:nth-child(2){animation-delay:0.15s; height:10px;}
            .disc-voice-rec-bar:nth-child(3){animation-delay:0.3s;  height:16px;}
            .disc-voice-rec-bar:nth-child(4){animation-delay:0.45s; height:8px;}
            .disc-voice-rec-bar:nth-child(5){animation-delay:0.6s;  height:14px;}
            @keyframes discRecBounce { 0%,100%{transform:scaleY(0.4);opacity:0.5} 50%{transform:scaleY(1);opacity:1} }
            .disc-voice-rec-status { flex:1; font-size:12px; font-weight:700; font-family:'Nunito',sans-serif; }
            .disc-tool-btn.recording { color:#f85149; }
        </style>

        <div class="disc-thread-wrap">
            ${isDesktop() ? `
            <div class="disc-thread-head">
                <div class="disc-thread-head-title">${escHtml(disc.title)}</div>
                <div class="disc-thread-head-meta" id="discThreadPostCount">${escHtml(disc.subject_name || '')}${disc.subject_name ? ' · ' : ''}${replies.length + 1} post${replies.length === 0 ? '' : 's'}</div>
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

    /* ── MOBILE: inject the floating trigger bar + bottom sheet ── */
    if (!isDesktop() && is_in_class) {
        injectMobileComposer(disc.id);
    }
    wireLongPress();
}

function buildPostCard(r, user_role, is_in_class, discId) {
    const isOp    = r.is_op || false;
    const isMe    = r.is_me == 1;
    const initial = discInitials(r.replier_display);
    const picFolder = 'uploads/learners/';

    const dotClass = isOp ? 'is-op-dot' : (isMe ? '' : 'muted');

    const avatarColor = discAvatarColor(discAvatarSeed(r.replier_email, r.replier_display));

    // Always render the initials circle. If a real (non-default) profile pic exists,
    // swap it in on successful load — this avoids the grey default.png problem.
    const hasPic = r.profile_picture && r.profile_picture !== 'default.png' && r.profile_picture !== '';
    const avatarHtml = hasPic
            ? `<img src="${picFolder}${escHtml(r.profile_picture)}" class="disc-avatar"
                   onload="this.style.display='block';this.nextElementSibling.style.display='none';"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                   style="display:none;">
               <div class="disc-avatar-ph" style="background:${avatarColor.bg};color:${avatarColor.color};">${initial}</div>`
            : `<div class="disc-avatar-ph" style="background:${avatarColor.bg};color:${avatarColor.color};">${initial}</div>`;

    const meTag      = isMe   ? `<span class="disc-tag me">You</span>`   : '';
    const displayName = escHtml(r.replier_display || 'Learner');

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
        const isVoice = ['webm','ogg','m4a','mp3'].includes(ext);
        if (isVoice) {
            const uid = 'vp_' + (r.id || Math.random().toString(36).slice(2));
            // Dot trail — 12 fixed dots, no heights needed
            const bars = Array.from({length: 12}, (_, i) => i);
            const barsHtml = bars.map((_, i) =>
                `<div class="disc-voice-waveform-bar" data-idx="${i}"></div>`
            ).join('');
            attachHtml = `
                <div class="disc-voice-player">
                    <button class="disc-voice-play-btn" id="btn_${uid}" onclick="discVoiceToggle('${uid}','${path}')">
                        <i class="fas fa-play" id="icon_${uid}"></i>
                    </button>
                    <div class="disc-voice-info">
                        <div class="disc-voice-waveform" id="wave_${uid}" onclick="discVoiceSeek(event,'${uid}')" data-bars="${bars.length}">
                            ${barsHtml}
                        </div>
                        <div class="disc-voice-bottom">
                            <span class="disc-voice-time" id="time_${uid}">0:00</span>
                            <span class="disc-voice-label">Voice note</span>
                        </div>
                    </div>
                </div>`;
        } else {
            attachHtml = `<div class="disc-attachment">` + (isImg
                ? `<img src="${path}" onclick="discOpenMedia('${path}','image')">`
                : `<div class="disc-pdf-link" onclick="discOpenMedia('${path}','pdf')"><i class="fas fa-file-pdf"></i> Open PDF</div>`)
                + `</div>`;
        }
    }

    const canReply  = is_in_class && r.id !== undefined;
    const canReport = user_role === 'learner' && !isMe && r.id;

    const replyBtn  = canReply
        ? `<button class="disc-action-btn reply" onclick="discSetReply(${r.id || 0},'${escHtml(r.replier_display)}','${escHtml((r.message||'').substring(0,80))}')"><i class="fas fa-reply"></i> Reply</button>`
        : '';
    const reportBtn = canReport
        ? `<button class="disc-action-btn report" onclick="discShowReport(${r.id},${discId})"><i class="fas fa-flag"></i> Report</button>`
        : '';

    const bodyWrapClass = `disc-body-wrap${isOp ? ' is-op' : ''}${isMe ? ' is-me' : ''}`;

    return `
        <div class="disc-post-card" data-id="${r.id || 0}"
             data-disc-id="${discId}"
             data-can-reply="${canReply ? '1' : '0'}"
             data-can-report="${canReport ? '1' : '0'}"
             data-author="${escHtml(r.replier_display || 'Learner')}"
             data-preview="${escHtml((r.message||'').substring(0,80))}">
            <div class="disc-spine">
                <div class="disc-spine-dot ${dotClass}"></div>
                <div class="disc-spine-line"></div>
            </div>
            <div class="disc-post-content">
                <div class="disc-post-header">
                    ${avatarHtml}
                    <span class="disc-author">${displayName}</span>
                    ${meTag}
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
            <div class="disc-voice-preview" id="discVoicePreview">
                <span id="discVoiceDot" class="disc-voice-rec-dot"></span>
                <div class="disc-voice-rec-bars" id="discVoiceRecBars" style="display:none;">
                    <div class="disc-voice-rec-bar" style="height:6px;"></div>
                    <div class="disc-voice-rec-bar"></div>
                    <div class="disc-voice-rec-bar"></div>
                    <div class="disc-voice-rec-bar"></div>
                    <div class="disc-voice-rec-bar"></div>
                </div>
                <span id="discVoiceStatus" class="disc-voice-rec-status" style="color:#f85149;">Ready to record</span>
                <button onclick="discStopRecording()" style="background:none;border:none;color:#4fd1c5;cursor:pointer;font-size:18px;padding:0 2px;" title="Stop"><i class="fas fa-stop-circle"></i></button>
                <button onclick="discCancelRecording()" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:16px;padding:0 2px;" title="Discard"><i class="fas fa-trash"></i></button>
            </div>
            <div class="disc-compose-box">
                <textarea id="discTextarea" placeholder="Add to the discussion…" rows="1"></textarea>
                <div class="disc-toolbar">
                    <label class="disc-tool-btn" title="Attach file">
                        <i class="fas fa-paperclip"></i>
                        <input type="file" id="discFileInput" accept="image/*,.pdf" style="display:none;">
                    </label>
                    <button class="disc-tool-btn" id="discMicBtn" title="Record voice note (max 2 min)" onclick="discToggleRecording(${discId})">
                        <i class="fas fa-microphone"></i>
                    </button>
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
// MOBILE COMPOSER — floating trigger + bottom sheet
// ─────────────────────────────────────────────
function injectMobileComposer(discId) {
    /* Clean up any stale instances */
    document.getElementById('discMobileSheet')?.remove();
    document.getElementById('discMobileTrigger')?.remove();
    document.getElementById('discMobileOverlay')?.remove();

    /* ── 1. Dimmer overlay (behind sheet, above posts) ── */
    const overlay = document.createElement('div');
    overlay.id = 'discMobileOverlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.55);
        z-index:5500;display:none;backdrop-filter:blur(2px);
        -webkit-backdrop-filter:blur(2px);transition:opacity 0.25s ease;opacity:0;`;
    overlay.addEventListener('click', discCloseMobileSheet);
    document.body.appendChild(overlay);

    /* ── 2. Fixed trigger bar at bottom — lifted 16px off the very bottom ── */
    const trigger = document.createElement('div');
    trigger.id = 'discMobileTrigger';
    trigger.style.cssText = `
        position:fixed;bottom:16px;left:0;right:0;
        padding:10px 14px;
        padding-bottom:calc(10px + env(safe-area-inset-bottom));
        background:rgba(17,17,17,0.96);
        border-top:1px solid rgba(255,255,255,0.08);
        border-radius:18px 18px 0 0;
        box-shadow:0 -4px 24px rgba(0,0,0,0.5);
        z-index:5000;
        display:flex;flex-direction:column;gap:0;
        backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);`;
    trigger.innerHTML = `
        <!-- Mobile typing indicator — shown above the trigger pill -->
        <div id="discMobileTyping" style="
            display:none;align-items:center;gap:8px;
            padding:4px 4px 6px;font-size:12px;
            color:#8b949e;font-weight:700;font-family:'Nunito',sans-serif;">
            <div style="display:flex;align-items:center;gap:3px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#4fd1c5;animation:discTypeBounce 1.2s infinite ease-in-out;display:inline-block;"></span>
                <span style="width:6px;height:6px;border-radius:50%;background:#4fd1c5;animation:discTypeBounce 1.2s 0.2s infinite ease-in-out;display:inline-block;"></span>
                <span style="width:6px;height:6px;border-radius:50%;background:#4fd1c5;animation:discTypeBounce 1.2s 0.4s infinite ease-in-out;display:inline-block;"></span>
            </div>
            <span id="discMobileTypingText">Someone is typing...</span>
        </div>
        <!-- Trigger row -->
        <div style="display:flex;align-items:center;gap:10px;">
            <div onclick="discOpenMobileSheet(${discId})" style="
                flex:1;background:#1b1b1b;border:1px solid rgba(255,255,255,0.08);
                border-radius:22px;padding:10px 16px;
                color:#8b949e;font-family:'Nunito',sans-serif;
                font-size:14px;font-weight:600;cursor:text;
                display:flex;align-items:center;gap:8px;">
                <i class="fas fa-comment-dots" style="color:#4fd1c5;font-size:13px;"></i>
                Write a reply…
            </div>
            <button onclick="discOpenMobileSheet(${discId},'attach')" style="
                width:40px;height:40px;border-radius:50%;background:#1b1b1b;
                border:1px solid rgba(255,255,255,0.08);color:#8b949e;
                display:flex;align-items:center;justify-content:center;
                cursor:pointer;flex-shrink:0;font-size:15px;">
                <i class="fas fa-paperclip"></i>
            </button>
        </div>`;
    document.body.appendChild(trigger);

    /* ── 3. Bottom sheet ── */
    const sheet = document.createElement('div');
    sheet.id = 'discMobileSheet';
    sheet.style.cssText = `
        position:fixed;bottom:0;left:0;right:0;
        background:#111;
        border-top:1px solid rgba(255,255,255,0.1);
        border-radius:20px 20px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.7);
        z-index:6000;
        transform:translateY(100%);
        transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);
        max-height:80vh;display:flex;flex-direction:column;`;
    sheet.innerHTML = `
        <!-- Drag handle -->
        <div style="display:flex;justify-content:center;padding:10px 0 6px;" onclick="discCloseMobileSheet()">
            <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);"></div>
        </div>

        <!-- Reply preview (hidden by default) -->
        <div id="discSheetReplyPreview" style="
            display:none;margin:0 12px 8px;
            background:rgba(79,209,197,0.06);
            border:1px solid rgba(79,209,197,0.2);
            border-radius:10px;padding:8px 12px;
            font-size:12px;color:#8b949e;
            flex-direction:row;align-items:center;gap:8px;">
            <i class="fas fa-reply" style="color:#4fd1c5;flex-shrink:0;"></i>
            <span style="color:#4fd1c5;font-weight:700;flex-shrink:0;">Replying to:</span>
            <span id="discSheetPreviewText" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <button onclick="discSheetCancelReply()" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:16px;padding:0 4px;flex-shrink:0;">✕</button>
        </div>

        <!-- File preview (hidden by default) -->
        <div id="discSheetFilePreview" style="
            display:none;margin:0 12px 8px;
            background:#1b1b1b;border:1px solid rgba(255,255,255,0.07);
            border-radius:10px;padding:8px 12px;
            font-size:12px;color:#8b949e;
            flex-direction:row;align-items:center;gap:8px;">
            <img id="discSheetPreviewImg" src="" style="display:none;width:30px;height:30px;object-fit:cover;border-radius:4px;">
            <span id="discSheetFileName" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            <button onclick="discSheetClearFile()" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:16px;margin-left:auto;">✕</button>
        </div>

        <!-- Voice preview (hidden by default) -->
        <div id="discSheetVoicePreview" style="
            display:none;margin:0 12px 8px;
            background:rgba(248,81,73,0.05);
            border:1px solid rgba(248,81,73,0.2);
            border-radius:10px;padding:10px 14px;
            flex-direction:row;align-items:center;gap:10px;">
            <span id="discSheetVoiceDot" class="disc-voice-rec-dot"></span>
            <div class="disc-voice-rec-bars" id="discSheetVoiceRecBars" style="display:none;">
                <div class="disc-voice-rec-bar" style="height:6px;"></div>
                <div class="disc-voice-rec-bar"></div>
                <div class="disc-voice-rec-bar"></div>
                <div class="disc-voice-rec-bar"></div>
                <div class="disc-voice-rec-bar"></div>
            </div>
            <span id="discSheetVoiceStatus" class="disc-voice-rec-status" style="color:#f85149;flex:1;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;">Ready to record</span>
            <button onclick="discSheetStopRecording()" style="background:none;border:none;color:#4fd1c5;cursor:pointer;font-size:18px;padding:0 2px;">
                <i class="fas fa-stop-circle"></i>
            </button>
            <button onclick="discSheetCancelRecording()" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:16px;padding:0 2px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>

        <!-- Compose box -->
        <div style="margin:0 12px;background:#1b1b1b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;transition:border-color 0.2s;" id="discSheetBox">
            <textarea id="discSheetTextarea"
                placeholder="Add to the discussion…"
                rows="1"
                style="width:100%;background:transparent;border:none;color:#e2e8f0;
                       font-family:'Nunito',sans-serif;font-size:15px;font-weight:600;
                       padding:13px 14px 8px;resize:none;outline:none;
                       min-height:48px;max-height:140px;line-height:1.5;
                       box-sizing:border-box;"></textarea>

            <!-- Toolbar -->
            <div style="display:flex;align-items:center;gap:4px;padding:6px 10px;border-top:1px solid rgba(255,255,255,0.07);">
                <!-- Attach -->
                <label style="background:none;border:none;color:#8b949e;cursor:pointer;padding:6px 8px;border-radius:6px;display:flex;align-items:center;gap:5px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;">
                    <i class="fas fa-paperclip"></i>
                    <input type="file" id="discSheetFileInput" accept="image/*,.pdf" style="display:none;">
                </label>
                <!-- Mic -->
                <button id="discSheetMicBtn"
                    onclick="discSheetToggleRecording(${discId})"
                    style="background:none;border:none;color:#8b949e;cursor:pointer;padding:6px 8px;border-radius:6px;display:flex;align-items:center;gap:5px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;">
                    <i class="fas fa-microphone"></i>
                </button>
                <!-- Post button -->
                <button id="discSheetPostBtn"
                    onclick="discSheetSubmitReply(${discId})"
                    style="background:#4fd1c5;color:#0d1117;border:none;padding:8px 18px;
                           border-radius:9px;font-family:'Nunito',sans-serif;font-size:13px;
                           font-weight:800;cursor:pointer;display:flex;align-items:center;
                           gap:6px;margin-left:auto;transition:background 0.2s;">
                    <i class="fas fa-paper-plane"></i> Post
                </button>
            </div>
        </div>

        <!-- Safe area spacer -->
        <div style="height:calc(14px + env(safe-area-inset-bottom));flex-shrink:0;"></div>`;
    document.body.appendChild(sheet);

    /* Wire up sheet textarea auto-resize + typing signal */
    const sheetTa = document.getElementById('discSheetTextarea');
    if (sheetTa) {
        sheetTa.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 140) + 'px';
            sendTypingSignal(discId);
        });
    }

    /* Wire up sheet file input */
    const sheetFi = document.getElementById('discSheetFileInput');
    if (sheetFi) {
        sheetFi.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            const preview = document.getElementById('discSheetFilePreview');
            const img     = document.getElementById('discSheetPreviewImg');
            const name    = document.getElementById('discSheetFileName');
            preview.style.display = 'flex';
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

    /* Focus sheet box border on focus */
    const sheetBox = document.getElementById('discSheetBox');
    if (sheetTa && sheetBox) {
        sheetTa.addEventListener('focus',  () => sheetBox.style.borderColor = 'rgba(79,209,197,0.4)');
        sheetTa.addEventListener('blur',   () => sheetBox.style.borderColor = 'rgba(255,255,255,0.08)');
    }
}

// ─────────────────────────────────────────────
// MOBILE LONG-PRESS ACTION POPUP (Reply / Report)
// Uses event delegation on #discPostsScroll so it keeps working for
// posts appended later (e.g. via live polling), not just the initial render.
// ─────────────────────────────────────────────
let discLongPressTimer  = null;
let discLongPressCard   = null;
let discLongPressMoved  = false;

function wireLongPress() {
    if (isDesktop()) return;
    const scroll = document.getElementById('discPostsScroll');
    if (!scroll || scroll.dataset.longPressWired === '1') return;
    scroll.dataset.longPressWired = '1';

    scroll.addEventListener('touchstart', e => {
        const card = e.target.closest('.disc-post-card');
        if (!card) return;
        discLongPressCard  = card;
        discLongPressMoved = false;
        discLongPressTimer = setTimeout(() => {
            if (!discLongPressMoved) {
                const touch = e.touches[0];
                discOpenLongPressMenu(card, touch.clientX, touch.clientY);
            }
        }, 450);
    }, { passive: true });

    scroll.addEventListener('touchmove', () => {
        discLongPressMoved = true;
        clearTimeout(discLongPressTimer);
    }, { passive: true });

    scroll.addEventListener('touchend', () => {
        clearTimeout(discLongPressTimer);
    }, { passive: true });

    /* Backstop: some browsers still fire the native text-selection callout
       (Copy/Look Up/Translate) despite user-select:none. Block it outright
       on post cards and clear any selection it may have already started. */
    scroll.addEventListener('contextmenu', e => {
        if (e.target.closest('.disc-post-card')) e.preventDefault();
    });
}

window.discOpenLongPressMenu = function(card, x, y) {
    document.getElementById('discLongPressMenu')?.remove();
    document.getElementById('discLongPressOverlay')?.remove();

    /* Clear any native text selection the browser may have started —
       stops the Copy/Look Up/Translate callout from lingering underneath. */
    if (window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }

    const canReply  = card.dataset.canReply === '1';
    const canReport = card.dataset.canReport === '1';
    if (!canReply && !canReport) return; // nothing to show, e.g. not in class

    const replyId = card.dataset.id;
    const discId  = card.dataset.discId;
    const author  = card.dataset.author;
    const preview = card.dataset.preview;

    /* Haptic-style feedback via a quick highlight on the bubble */
    const bubble = card.querySelector('.disc-body-wrap');
    if (bubble) {
        bubble.classList.add('disc-pressed');
        setTimeout(() => bubble.classList.remove('disc-pressed'), 200);
    }
    if (navigator.vibrate) navigator.vibrate(15);

    /* ── Dim overlay, same look as the reply-composer sheet ── */
    const overlay = document.createElement('div');
    overlay.id = 'discLongPressOverlay';
    document.body.appendChild(overlay);
    overlay.style.display = 'block';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    overlay.addEventListener('click', discCloseLongPressMenu);

    /* ── Popup menu near the press point ── */
    const menu = document.createElement('div');
    menu.id = 'discLongPressMenu';
    menu.innerHTML = `
        ${canReply  ? `<button onclick="discCloseLongPressMenu();discSetReply(${replyId || 0},'${author.replace(/'/g,"\\'")}','${preview.replace(/'/g,"\\'")}')"><i class="fas fa-reply"></i> Reply</button>` : ''}
        ${canReport ? `<button class="report" onclick="discCloseLongPressMenu();discShowReport(${replyId},${discId})"><i class="fas fa-flag"></i> Report</button>` : ''}`;
    document.body.appendChild(menu);

    /* Position near the touch point, keeping it on-screen */
    const menuWidth  = 170;
    const menuHeight = (canReply && canReport) ? 92 : 46;
    let left = x - menuWidth / 2;
    let top  = y - menuHeight - 14;
    left = Math.max(10, Math.min(left, window.innerWidth - menuWidth - 10));
    if (top < 10) top = y + 14; // flip below the finger if too close to the top
    menu.style.left = left + 'px';
    menu.style.top  = top + 'px';

    requestAnimationFrame(() => menu.classList.add('show'));
};

window.discCloseLongPressMenu = function() {
    const menu    = document.getElementById('discLongPressMenu');
    const overlay = document.getElementById('discLongPressOverlay');
    if (menu) {
        menu.classList.remove('show');
        setTimeout(() => menu.remove(), 150);
    }
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
    }
};

/* Open the sheet */
window.discOpenMobileSheet = function(discId, mode) {
    const sheet   = document.getElementById('discMobileSheet');
    const overlay = document.getElementById('discMobileOverlay');
    const trigger = document.getElementById('discMobileTrigger');
    if (!sheet) return;

    overlay.style.display = 'block';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    sheet.style.transform = 'translateY(0)';
    if (trigger) trigger.style.display = 'none';

    /* If triggered via attach button, immediately open file picker */
    if (mode === 'attach') {
        setTimeout(() => document.getElementById('discSheetFileInput')?.click(), 320);
    } else {
        setTimeout(() => document.getElementById('discSheetTextarea')?.focus(), 320);
    }
};

/* Close the sheet */
window.discCloseMobileSheet = function() {
    const sheet   = document.getElementById('discMobileSheet');
    const overlay = document.getElementById('discMobileOverlay');
    const trigger = document.getElementById('discMobileTrigger');
    if (!sheet) return;

    sheet.style.transform = 'translateY(100%)';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 280);
    if (trigger) trigger.style.display = 'flex';

    /* Blur textarea to dismiss keyboard */
    document.getElementById('discSheetTextarea')?.blur();
};

/* Reply helpers for the sheet */
window.discSheetCancelReply = function() {
    window._discReplyTo = 0;
    const p = document.getElementById('discSheetReplyPreview');
    if (p) p.style.display = 'none';
};

window.discSheetClearFile = function() {
    const fi = document.getElementById('discSheetFileInput');
    if (fi) fi.value = '';
    const preview = document.getElementById('discSheetFilePreview');
    if (preview) preview.style.display = 'none';
    const img = document.getElementById('discSheetPreviewImg');
    if (img) img.style.display = 'none';
};

/* Submit reply from the sheet (mirrors discSubmitReply) */
window.discSheetSubmitReply = async function(discId) {
    const ta      = document.getElementById('discSheetTextarea');
    const fi      = document.getElementById('discSheetFileInput');
    const replyTo = window._discReplyTo ?? 0;
    const message = ta ? ta.value.trim() : '';

    if (!message && (!fi || !fi.files[0]) && !_discVoiceBlob) return;

    const fd = new FormData();
    fd.append('discussion_id', discId);
    fd.append('message', message);
    fd.append('reply_to', replyTo);
    if (_discVoiceBlob) {
        const ext = _discVoiceBlob.type.includes('ogg') ? 'ogg' : 'webm';
        fd.append('attachment', _discVoiceBlob, `voice_${Date.now()}.${ext}`);
    } else if (fi?.files[0]) {
        fd.append('attachment', fi.files[0]);
    }

    const btn = document.getElementById('discSheetPostBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const res  = await fetch('api/learner/submit_reply.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        /* Clear sheet */
        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        if (fi) fi.value = '';
        discSheetCancelReply();
        discSheetClearFile();
        _discVoiceBlob = null;
        _discAudioChunks = [];
        document.getElementById('discSheetVoicePreview').style.display = 'none';

        /* Close the sheet */
        discCloseMobileSheet();

        handleRepliesAdded(discId, data.reply, { scrollToBottom: true });

    } catch (e) {
        alert(e.message || 'Failed to post reply');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post'; }
    }
};

/* ── Sheet voice recording (mirrors desktop recorder but targets sheet elements) ── */
window.discSheetToggleRecording = async function(discId) {
    if (_discMediaRecorder && _discMediaRecorder.state === 'recording') {
        discSheetStopRecording();
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _discAudioChunks   = [];
        _discVoiceBlob     = null;
        _discRecordSeconds = 0;

        const mimeType     = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        _discMediaRecorder = new MediaRecorder(stream, { mimeType });

        _discMediaRecorder.ondataavailable = e => { if (e.data.size > 0) _discAudioChunks.push(e.data); };
        _discMediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            _discVoiceBlob = new Blob(_discAudioChunks, { type: mimeType });
            _discSheetShowVoiceReady(mimeType);
        };

        _discMediaRecorder.start(250);

        const preview = document.getElementById('discSheetVoicePreview');
        const dot     = document.getElementById('discSheetVoiceDot');
        const status  = document.getElementById('discSheetVoiceStatus');
        const micBtn  = document.getElementById('discSheetMicBtn');
        const recBars = document.getElementById('discSheetVoiceRecBars');
        if (preview) { preview.style.display = 'flex'; preview.classList.remove('ready'); }
        if (dot)     { dot.className = 'disc-voice-rec-dot'; dot.style.display = 'block'; }
        if (recBars) recBars.style.display = 'flex';
        if (micBtn)  micBtn.style.color = '#f85149';
        if (status)  { status.textContent = 'Recording… 0:00'; status.style.color = '#f85149'; }

        _discRecordTimer = setInterval(() => {
            _discRecordSeconds++;
            const m = Math.floor(_discRecordSeconds / 60);
            const s = String(_discRecordSeconds % 60).padStart(2, '0');
            const st = document.getElementById('discSheetVoiceStatus');
            if (st) st.textContent = `Recording… ${m}:${s}`;
            if (_discRecordSeconds >= VOICE_MAX_SECONDS) discSheetStopRecording();
        }, 1000);

    } catch (err) {
        alert('Microphone access denied. Please allow microphone permissions.');
    }
};

window.discSheetStopRecording = function() {
    if (_discMediaRecorder && _discMediaRecorder.state === 'recording') {
        _discMediaRecorder.stop();
    }
    clearInterval(_discRecordTimer);
    _discRecordTimer = null;
    const micBtn = document.getElementById('discSheetMicBtn');
    if (micBtn) micBtn.style.color = '#8b949e';
};

window.discSheetCancelRecording = function() {
    discSheetStopRecording();
    _discVoiceBlob = null;
    _discAudioChunks = [];
    const preview = document.getElementById('discSheetVoicePreview');
    if (preview) preview.style.display = 'none';
};

function _discSheetShowVoiceReady(mimeType) {
    const dot     = document.getElementById('discSheetVoiceDot');
    const status  = document.getElementById('discSheetVoiceStatus');
    const recBars = document.getElementById('discSheetVoiceRecBars');
    const preview = document.getElementById('discSheetVoicePreview');
    const m = Math.floor(_discRecordSeconds / 60);
    const s = String(_discRecordSeconds % 60).padStart(2, '0');
    if (dot)     dot.className = 'disc-voice-rec-done';
    if (recBars) recBars.style.display = 'none';
    if (preview) { preview.style.background = 'rgba(79,209,197,0.05)'; preview.style.borderColor = 'rgba(79,209,197,0.2)'; }
    if (status)  { status.textContent = `Voice note ready · ${m}:${s}`; status.style.color = '#4fd1c5'; }
}

// ─────────────────────────────────────────────
// TYPING
// ─────────────────────────────────────────────
function sendTypingSignal(discId) {
    fetch('api/set_typing.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' , 'X-CSRF-Token': getCsrfToken() },
        body: `discussion_id=${discId}`
    }).catch(() => {});
}

async function pollTyping(discId) {
    try {
        const res  = await fetch(`api/get_typing.php?discussion_id=${discId}`);
        const data = await res.json();

        /* ── Desktop indicator (inside .disc-compose) ── */
        const el  = document.getElementById('discTypingIndicator');
        const txt = document.getElementById('discTypingText');
        if (el) {
            if (data.count > 0) {
                if (txt) txt.textContent = data.count === 1 ? 'Someone is typing...' : `${data.count} people are typing...`;
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        }

        /* ── Mobile indicator (above the trigger bar) ── */
        const mob    = document.getElementById('discMobileTyping');
        const mobTxt = document.getElementById('discMobileTypingText');
        if (mob) {
            if (data.count > 0) {
                if (mobTxt) mobTxt.textContent = data.count === 1 ? 'Someone is typing...' : `${data.count} people are typing...`;
                mob.style.display = 'flex';
            } else {
                mob.style.display = 'none';
            }
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
        if (!scroll || !bottom) return;
        const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;

        handleRepliesAdded(discId, rows, { scrollToBottom: false });

        if (atBottom) scroll.scrollTop = scroll.scrollHeight;
    } catch (e) {}
}

// ─────────────────────────────────────────────
// SUBMIT REPLY
// ─────────────────────────────────────────────
window.discSubmitReply = async function(discId) {
    const ta      = document.getElementById('discTextarea');
    const fi      = document.getElementById('discFileInput');
    const replyTo = window._discReplyTo ?? 0;
    const message = ta ? ta.value.trim() : '';

    if (!message && (!fi || !fi.files[0]) && !_discVoiceBlob) return;

    const fd = new FormData();
    fd.append('discussion_id', discId);
    fd.append('message', message);
    fd.append('reply_to', replyTo);
    if (_discVoiceBlob) {
        const ext  = _discVoiceBlob.type.includes('ogg') ? 'ogg' : 'webm';
        fd.append('attachment', _discVoiceBlob, `voice_${Date.now()}.${ext}`);
    } else if (fi?.files[0]) {
        fd.append('attachment', fi.files[0]);
    }

    const btn = document.querySelector('.disc-post-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    try {
        const res  = await fetch('api/learner/submit_reply.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        if (fi) fi.value = '';
        discCancelReply();
        discClearFile();
        // Clear voice note state
        _discVoiceBlob = null;
        _discAudioChunks = [];
        document.getElementById('discVoicePreview')?.classList.remove('show');

        handleRepliesAdded(discId, data.reply, { scrollToBottom: true });

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
    const previewText = author + ': ' + preview;

    if (!isDesktop()) {
        /* ── Mobile: fill the sheet's reply preview and open the sheet ── */
        const sheetPreview = document.getElementById('discSheetReplyPreview');
        const sheetText    = document.getElementById('discSheetPreviewText');
        if (sheetPreview && sheetText) {
            sheetText.textContent = previewText;
            sheetPreview.style.display = 'flex';
        }
        /* Open the sheet and focus the textarea */
        const discId = window._currentDiscId;
        discOpenMobileSheet(discId);
    } else {
        /* ── Desktop: fill the existing compose reply preview ── */
        const p = document.getElementById('discPreviewText');
        if (p) p.textContent = previewText;
        document.getElementById('discReplyPreview')?.classList.add('show');
        document.getElementById('discTextarea')?.focus();
    }
};

window.discCancelReply = function() {
    window._discReplyTo = 0;
    /* Clear both desktop and mobile previews */
    document.getElementById('discReplyPreview')?.classList.remove('show');
    const sheetPreview = document.getElementById('discSheetReplyPreview');
    if (sheetPreview) sheetPreview.style.display = 'none';
};
window.discClearFile = function() {
    const fi = document.getElementById('discFileInput');
    if (fi) fi.value = '';
    document.getElementById('discFilePreview')?.classList.remove('show');
    const img = document.getElementById('discPreviewImg');
    if (img) img.style.display = 'none';
};

// ─────────────────────────────────────────────
// VOICE NOTE — RECORDER
// ─────────────────────────────────────────────
let _discMediaRecorder  = null;
let _discAudioChunks    = [];
let _discVoiceBlob      = null;
let _discRecordTimer    = null;
let _discRecordSeconds  = 0;
const VOICE_MAX_SECONDS = 120; // 2-minute limit

window.discToggleRecording = async function(discId) {
    if (_discMediaRecorder && _discMediaRecorder.state === 'recording') {
        discStopRecording();
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _discAudioChunks   = [];
        _discVoiceBlob     = null;
        _discRecordSeconds = 0;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        _discMediaRecorder = new MediaRecorder(stream, { mimeType });

        _discMediaRecorder.ondataavailable = e => { if (e.data.size > 0) _discAudioChunks.push(e.data); };
        _discMediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            _discVoiceBlob = new Blob(_discAudioChunks, { type: mimeType });
            _discShowVoiceReady(mimeType);
        };

        _discMediaRecorder.start(250);

        // Show recording UI
        const preview  = document.getElementById('discVoicePreview');
        const dot      = document.getElementById('discVoiceDot');
        const status   = document.getElementById('discVoiceStatus');
        const micBtn   = document.getElementById('discMicBtn');
        const recBars  = document.getElementById('discVoiceRecBars');
        if (preview) { preview.classList.add('show'); preview.classList.remove('ready'); }
        if (dot)     { dot.className = 'disc-voice-rec-dot'; dot.style.display = 'block'; }
        if (recBars) recBars.style.display = 'flex';
        if (micBtn)  micBtn.classList.add('recording');
        if (status)  { status.textContent = 'Recording… 0:00'; status.style.color = '#f85149'; }

        _discRecordTimer = setInterval(() => {
            _discRecordSeconds++;
            const m = Math.floor(_discRecordSeconds / 60);
            const s = String(_discRecordSeconds % 60).padStart(2, '0');
            const status = document.getElementById('discVoiceStatus');
            if (status) status.textContent = `Recording… ${m}:${s}`;
            if (_discRecordSeconds >= VOICE_MAX_SECONDS) discStopRecording();
        }, 1000);

    } catch (err) {
        alert('Microphone access denied. Please allow microphone permissions.');
    }
};

window.discStopRecording = function() {
    if (_discMediaRecorder && _discMediaRecorder.state === 'recording') {
        _discMediaRecorder.stop();
    }
    clearInterval(_discRecordTimer);
    _discRecordTimer = null;
    document.getElementById('discMicBtn')?.classList.remove('recording');
};

window.discCancelRecording = function() {
    discStopRecording();
    _discVoiceBlob = null;
    _discAudioChunks = [];
    document.getElementById('discVoicePreview')?.classList.remove('show');
};

function _discShowVoiceReady(mimeType) {
    const dot     = document.getElementById('discVoiceDot');
    const status  = document.getElementById('discVoiceStatus');
    const recBars = document.getElementById('discVoiceRecBars');
    const preview = document.getElementById('discVoicePreview');
    const m = Math.floor(_discRecordSeconds / 60);
    const s = String(_discRecordSeconds % 60).padStart(2, '0');
    if (dot)     { dot.className = 'disc-voice-rec-done'; }
    if (recBars) recBars.style.display = 'none';
    if (preview) preview.classList.add('ready');
    if (status)  { status.textContent = `Voice note ready · ${m}:${s}`; status.style.color = '#4fd1c5'; }
}

// ─────────────────────────────────────────────
// VOICE NOTE — INLINE PLAYER
// ─────────────────────────────────────────────
const _discAudioPlayers = {};

window.discVoiceToggle = function(uid, path) {
    if (!_discAudioPlayers[uid]) {
        _discAudioPlayers[uid] = new Audio(path);
        _discAudioPlayers[uid].addEventListener('loadedmetadata', () => {
            // Show total duration before first play
            const dur = _discAudioPlayers[uid].duration;
            if (dur && isFinite(dur)) {
                const m = Math.floor(dur / 60);
                const s = String(Math.floor(dur % 60)).padStart(2, '0');
                const timeEl = document.getElementById('time_' + uid);
                if (timeEl) timeEl.textContent = `${m}:${s}`;
            }
        });
        _discAudioPlayers[uid].addEventListener('timeupdate', () => _discVoiceProgress(uid));
        _discAudioPlayers[uid].addEventListener('ended',      () => _discVoiceEnded(uid));
        // Preload metadata immediately
        _discAudioPlayers[uid].load();
    }
    const audio = _discAudioPlayers[uid];
    if (audio.paused) {
        // Pause all others first
        Object.keys(_discAudioPlayers).forEach(k => {
            if (k !== uid && !_discAudioPlayers[k].paused) {
                _discAudioPlayers[k].pause();
                document.getElementById('icon_' + k)?.setAttribute('class', 'fas fa-play');
            }
        });
        audio.play();
        document.getElementById('icon_' + uid)?.setAttribute('class', 'fas fa-pause');
    } else {
        audio.pause();
        document.getElementById('icon_' + uid)?.setAttribute('class', 'fas fa-play');
    }
};

function _discVoiceProgress(uid) {
    const audio = _discAudioPlayers[uid];
    if (!audio || !audio.duration) return;
    const pct      = audio.currentTime / audio.duration;
    const remaining = audio.duration - audio.currentTime;
    const time     = document.getElementById('time_' + uid);
    const wave     = document.getElementById('wave_' + uid);
    // Countdown: show time remaining
    if (time) {
        const m = Math.floor(remaining / 60);
        const s = String(Math.floor(remaining % 60)).padStart(2, '0');
        time.textContent = `${m}:${s}`;
    }
    // Dot trail: mark played dots and highlight the active (current) dot
    if (wave) {
        const dots  = wave.querySelectorAll('.disc-voice-waveform-bar');
        const total = dots.length;
        const activeIdx = Math.floor(pct * total);
        dots.forEach((dot, i) => {
            dot.classList.toggle('played', i < activeIdx);
            dot.classList.toggle('active', i === activeIdx);
        });
    }
}

function _discVoiceEnded(uid) {
    const audio = _discAudioPlayers[uid];
    const time  = document.getElementById('time_' + uid);
    const wave  = document.getElementById('wave_' + uid);
    const icon  = document.getElementById('icon_' + uid);
    // Reset dot trail
    if (wave) wave.querySelectorAll('.disc-voice-waveform-bar').forEach(b => b.classList.remove('played', 'active'));
    // Show total duration again
    if (time && audio && audio.duration && isFinite(audio.duration)) {
        const m = Math.floor(audio.duration / 60);
        const s = String(Math.floor(audio.duration % 60)).padStart(2, '0');
        time.textContent = `${m}:${s}`;
    } else if (time) {
        time.textContent = '0:00';
    }
    if (icon) icon.setAttribute('class', 'fas fa-play');
}

window.discVoiceSeek = function(event, uid) {
    const audio = _discAudioPlayers[uid];
    if (!audio || !audio.duration) return;
    const wave  = event.currentTarget;
    const ratio = event.offsetX / wave.offsetWidth;
    audio.currentTime = ratio * audio.duration;
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
        await fetch('view_discussion.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
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
        unlockMobileLayout();
    }

    renderCreateForm();
};

function renderCreateForm() {
    const target = getThreadTarget();
    if (!target) return;

    target.innerHTML = `
        <style>
            .disc-form-wrap { max-width:640px; margin:0 auto; padding:20px; }
            .disc-form-wrap h2 { color:#e2e8f0; font-size:20px; font-weight:800; margin:0 0 24px; }
            .disc-field { margin-bottom:20px; }
            .disc-field label { display:block; margin-bottom:8px; font-size:14px; font-weight:700; color:#c9d1d9; }
            .disc-field input,.disc-field textarea,.disc-field select { width:100%; background:#1b1b1b; border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#e2e8f0; font-family:'Nunito',sans-serif; font-size:14px; font-weight:600; padding:12px 14px; box-sizing:border-box; outline:none; transition:border-color 0.2s; }
            .disc-field input:focus,.disc-field textarea:focus,.disc-field select:focus { border-color:rgba(79,209,197,0.4); }
            .disc-field textarea { min-height:110px; resize:vertical; }
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
                <label>Discussion Type</label>
                <select id="discType">
                    <option value="homework">Homework help</option>
                    <option value="general" selected>General</option>
                    <option value="off_topic">Off-topic</option>
                </select>
            </div>
            <div class="disc-field">
                <label>Your Message / Question *</label>
                <textarea id="discMessage" placeholder="Explain what you need help with or want to discuss..."></textarea>
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

window.discSubmitCreate = async function() {
    const title     = document.getElementById('discTitle')?.value.trim();
    const type      = document.getElementById('discType')?.value || 'general';
    const message   = document.getElementById('discMessage')?.value.trim();
    const fileInput = document.getElementById('discCreateFile');
    const errorEl   = document.getElementById('discFormError');
    const btn       = document.getElementById('discSubmitBtn');

    if (!title || !message) {
        errorEl.textContent = 'Please fill all required fields.';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    const fd = new FormData();
    fd.append('title', title);
    fd.append('type', type);
    fd.append('message', message);
    if (fileInput?.files[0]) fd.append('attachment', fileInput.files[0]);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const res  = await fetch('api/learner/create_discussion.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
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