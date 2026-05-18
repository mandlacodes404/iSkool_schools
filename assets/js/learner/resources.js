/* assets/js/resources.js */
window.resourceCache          = null;
window.resourcePrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchResources = function () {
    if (window.resourceCache) return;
    if (window.resourcePrefetchPromise) return;
    window.resourcePrefetchPromise = fetch('api/learner/get_resources.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.resourceCache = data; })
        .catch(() => {})
        .finally(() => { window.resourcePrefetchPromise = null; });
};

window.fetchResources = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "resource_list.php");
    if (typeof window.setActive === 'function') window.setActive("resource_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Resources', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Preparation
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4a. If prefetch is still in-flight, wait for it (no duplicate request)
    if (window.resourcePrefetchPromise) {
        if (loader) loader.style.display = 'flex';
        await window.resourcePrefetchPromise;
    }

    // 4b. CACHE CHECK (Instant Load)
    if (window.resourceCache) {
        renderResourceCards(window.resourceCache);
        if (loader) loader.style.display = 'none';
        restoreResourcePageState();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_resources.php');
        if (!response.ok) throw new Error('Failed to fetch resources');
        const data = await response.json();
        window.resourceCache = data;
        renderResourceCards(data);
        restoreResourcePageState();
    } catch (error) {
        console.error("Resource Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading resources.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveResourcePageState() {
    const sidebar = document.querySelector('.lrs-sidebar-scroll');
    const state = {
        selectedIdx:   window._learnerResourceSelectedIdx ?? null,
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
    };
    sessionStorage.setItem('resourcePageState', JSON.stringify(state));
}

function restoreResourcePageState() {
    const raw = sessionStorage.getItem('resourcePageState');
    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
            requestAnimationFrame(() => {
                window.selectDesktopLearnerResource(state.selectedIdx);
                const sidebar = document.querySelector('.lrs-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            });
        }
    } catch (e) { /* ignore bad state */ }
}

function renderResourceCards(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No resources found.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerResourcesFlat = [];
    for (const [teacher, files] of Object.entries(data)) {
        files.forEach(file => {
            window._allLearnerResourcesFlat.push({ ...file, teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    for (const [teacher, files] of Object.entries(data)) {
        sidebarHtml += `<div class="lrs-sidebar-teacher-label">${teacher}</div>`;
        files.forEach(file => {
            const isVideo = file.resource_type === 'video';
            const metaLabel = isVideo
                ? 'VIDEO'
                : (file.ext ? file.ext.toUpperCase() : 'FILE');
            const metaRight = isVideo
                ? 'YouTube'
                : (file.size || 'N/A');

            sidebarHtml += `
                <div class="lrs-sidebar-item" id="lrs-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerResource(${flatIdx})">
                    <div class="lrs-sidebar-item-icon">
                        ${getFileIcon(file.ext, isVideo)}
                    </div>
                    <div class="lrs-sidebar-item-info">
                        <div class="lrs-sidebar-item-title">${file.title}</div>
                        <div class="lrs-sidebar-item-meta">${metaLabel} &middot; ${metaRight}</div>
                    </div>
                </div>`;
            flatIdx++;
        });
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lrs-desktop-layout { display: flex !important; }
                .lrs-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .lrs-desktop-layout { display: none !important; }
                .lrs-mobile-list    { display: block !important; }
            }

            .lrs-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lrs-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lrs-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .lrs-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lrs-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lrs-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lrs-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lrs-sidebar-teacher-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .lrs-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lrs-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lrs-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .lrs-sidebar-item-icon { flex-shrink: 0; opacity: 0.8; }
            .lrs-sidebar-item-info { flex: 1; min-width: 0; }
            .lrs-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-sidebar-item.active .lrs-sidebar-item-title { color: #e2e8f0; }
            .lrs-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            .lrs-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lrs-main-panel::-webkit-scrollbar { width: 5px; }
            .lrs-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lrs-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lrs-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lrs-panel-empty svg { opacity: 0.3; }
            .lrs-panel-empty p { font-size: 14px; margin: 0; }

            .lrs-panel-content { padding: 28px 32px; }

            .lrs-panel-header {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: flex-start;
                gap: 18px;
            }
            .lrs-panel-icon { flex-shrink: 0; opacity: 0.9; }
            .lrs-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #4fd1c5;
                margin: 0 0 6px;
                line-height: 1.3;
            }
            .lrs-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .lrs-open-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(79,209,197,0.1);
                border: 1px solid rgba(79,209,197,0.4);
                color: #4fd1c5;
                padding: 12px 28px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                transition: all 0.2s ease;
                margin-top: 8px;
            }
            .lrs-open-btn:hover {
                background: rgba(79,209,197,0.2);
                border-color: #4fd1c5;
            }

            /* ── VIDEO EMBED STYLES ── */
            .lrs-video-wrap {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                min-height: 0;
                background: #000;
            }
            .lrs-video-iframe-wrap {
                position: relative;
                flex: 1;
                min-height: 0;
                background: #000;
            }
            .lrs-video-iframe-wrap iframe {
                position: absolute;
                top: 0; left: 0;
                width: 100%;
                height: 100%;
                border: none;
            }

            /* ── MOBILE VIDEO STYLES ── */
            .lrs-mobile-video-wrap {
                width: 100%;
                aspect-ratio: 16 / 9;
                background: #000;
                border-radius: 10px;
                overflow: hidden;
                margin-top: 4px;
            }
            .lrs-mobile-video-wrap iframe {
                width: 100%;
                height: 100%;
                border: none;
                display: block;
            }
            .lrs-mobile-video-card {
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                padding: 14px 16px;
            }
            .lrs-mobile-video-title {
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
                margin: 0 0 4px;
            }
            .lrs-mobile-video-meta {
                font-size: 12px;
                color: #8b949e;
                margin: 0 0 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            /* ── MOBILE LIST STYLES ── */
            .lrs-mobile-list {
                background: #1a1919;
                border-radius: 12px;
                overflow: hidden;
                margin: 0 0 16px;
            }
            .lrs-mobile-teacher-header {
                padding: 16px 16px 6px;
                font-size: 11px;
                font-weight: 600;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: #1a1919;
            }
            .lrs-mobile-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 16px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                cursor: pointer;
            }
            .lrs-mobile-row:last-child { border-bottom: none; }
            .lrs-mobile-row:active { background: rgba(255,255,255,0.04); }
            .lrs-mobile-row-icon { flex-shrink: 0; opacity: 0.85; }
            .lrs-mobile-row-body { flex: 1; min-width: 0; }
            .lrs-mobile-row-title {
                font-size: 14px;
                font-weight: 400;
                color: #ffffff;
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-mobile-row-chevron {
                flex-shrink: 0;
                color: #30363d;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lrs-desktop-layout">
            <div class="lrs-sidebar">
                <div class="lrs-sidebar-header">All Resources</div>
                <div class="lrs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lrs-main-panel" id="lrs-main-panel">
                <div class="lrs-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select a resource from the left to open it</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="lrs-mobile-list">`;

    for (const [teacher, files] of Object.entries(data)) {
        html += `<div class="lrs-mobile-teacher-header">${teacher}</div>`;
        files.forEach(file => {
            const isVideo = file.resource_type === 'video';

            if (isVideo) {
                // ── Mobile: inline video embed ──
                html += `
                    <div class="lrs-mobile-video-card">
                        <div class="lrs-mobile-video-title">${file.title}</div>
                        <div class="lrs-mobile-video-meta">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="#ff4444" stroke="none">
                                <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.5 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
                            </svg>
                            <span>VIDEO</span>
                            <span style="color:#30363d;">&bull;</span>
                            <span>${file.uploaded_at}</span>
                        </div>
                        <div class="lrs-mobile-video-wrap">
                            <iframe
                                src="${file.video_url}"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen
                                title="${file.title}">
                            </iframe>
                        </div>
                    </div>`;
            } else {
                // ── Mobile: regular file row ──
                const icon = getFileIcon(file.ext, false);
                html += `
                    <div class="lrs-mobile-row"
                         onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')">
                        <div class="lrs-mobile-row-icon">${icon}</div>
                        <div class="lrs-mobile-row-body">
                            <div class="lrs-mobile-row-title">${file.title}</div>
                        </div>
                        <div class="lrs-mobile-row-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
            }
        });
    }

    html += `</div>`; // close .lrs-mobile-list

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE (inline preview)
// ─────────────────────────────────────────────
window.selectDesktopLearnerResource = function(flatIdx) {
    window._learnerResourceSelectedIdx = flatIdx;
    saveResourcePageState();
    document.querySelectorAll('.lrs-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lrs-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const file = (window._allLearnerResourcesFlat || [])[flatIdx];
    if (!file) return;

    const panel = document.getElementById('lrs-main-panel');
    if (!panel) return;

    const isVideo = file.resource_type === 'video';
    const ext     = (file.ext || '').toLowerCase();

    // ── Shared top bar styles ──
    const topbarStyles = `
        <style>
            .lrs-preview-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-shrink: 0;
                flex-wrap: wrap;
                background: #0d1117;
            }
            .lrs-preview-topbar-info { flex: 1; min-width: 0; }
            .lrs-preview-topbar-title {
                font-size: 14px;
                font-weight: 700;
                color: #e2e8f0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-preview-topbar-meta {
                font-size: 11px;
                color: #555e6a;
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .lrs-preview-topbar-actions { display: flex; gap: 8px; flex-shrink: 0; }
            .lrs-preview-open-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(79,209,197,0.1);
                border: 1px solid rgba(79,209,197,0.3);
                color: #4fd1c5;
                padding: 7px 14px;
                border-radius: 7px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                transition: background 0.15s;
            }
            .lrs-preview-open-btn:hover { background: rgba(79,209,197,0.2); }
            .lrs-yt-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(255,68,68,0.1);
                border: 1px solid rgba(255,68,68,0.3);
                color: #ff6b6b;
                padding: 7px 14px;
                border-radius: 7px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                transition: background 0.15s;
            }
            .lrs-yt-btn:hover { background: rgba(255,68,68,0.2); }
            .lrs-preview-wrap {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                min-height: 0;
            }
            .lrs-preview-iframe {
                flex: 1;
                width: 100%;
                height: 100%;
                border: none;
                background: #fff;
                display: block;
            }
            .lrs-preview-img-wrap {
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(255,255,255,0.02);
                overflow-y: auto;
            }
            .lrs-preview-img {
                max-width: 100%;
                max-height: 100%;
                border-radius: 8px;
                object-fit: contain;
                box-shadow: 0 4px 32px rgba(0,0,0,0.4);
            }
            .lrs-preview-fallback {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                padding: 40px;
                color: #555e6a;
            }
            .lrs-preview-fallback-label {
                font-size: 14px;
                color: #555e6a;
                margin: 0;
                text-align: center;
            }
            /* Desktop video embed */
            .lrs-video-embed-wrap {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #000;
                min-height: 0;
                position: relative;
            }
            .lrs-video-embed-wrap iframe {
                position: absolute;
                top: 0; left: 0;
                width: 100%;
                height: 100%;
                border: none;
            }
        </style>`;

    // ── VIDEO BRANCH ──
    if (isVideo) {
        // Convert embed URL back to watch URL for "open in YouTube" button
        const youtubeWatchUrl = (file.video_url || '').replace(
            /youtube\.com\/embed\/([A-Za-z0-9_-]{11}).*/,
            'youtube.com/watch?v=$1'
        );

        panel.innerHTML = `
            ${topbarStyles}

            <div class="lrs-preview-topbar">
                <div class="lrs-preview-topbar-info">
                    <div class="lrs-preview-topbar-title">${file.title}</div>
                    <div class="lrs-preview-topbar-meta">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="#ff4444" stroke="none">
                            <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.5 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
                        </svg>
                        <span>VIDEO</span>
                        <span>&bull;</span>
                        <span>${file.teacher}</span>
                        <span>&bull;</span>
                        <span>${file.uploaded_at}</span>
                    </div>
                </div>
                <div class="lrs-preview-topbar-actions">
                    <a href="https://${youtubeWatchUrl}" target="_blank" class="lrs-yt-btn">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="#ff6b6b" stroke="none">
                            <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.5 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
                        </svg>
                        Open in YouTube
                    </a>
                </div>
            </div>

            <!-- Full-panel YouTube embed -->
            <div class="lrs-video-embed-wrap">
                <iframe
                    src="${file.video_url}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowfullscreen
                    title="${file.title}">
                </iframe>
            </div>`;
        return;
    }

    // ── FILE BRANCH ──
    const path = file.path;

    let previewHtml = '';

    if (ext === 'pdf') {
        previewHtml = `
            <div class="lrs-preview-wrap">
                <iframe
                    src="${path}"
                    class="lrs-preview-iframe"
                    title="${file.title}">
                </iframe>
            </div>`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        previewHtml = `
            <div class="lrs-preview-wrap lrs-preview-img-wrap">
                <img src="${path}" alt="${file.title}" class="lrs-preview-img">
            </div>`;
    } else {
        const icon = getFileIcon(file.ext, false);
        previewHtml = `
            <div class="lrs-preview-fallback">
                <div style="opacity:0.5;">${icon.replace('width="20"','width="52"').replace('height="20"','height="52"')}</div>
                <p class="lrs-preview-fallback-label">Preview not available for .${ext.toUpperCase()} files</p>
                <a href="${path}" target="_blank" class="lrs-open-btn" style="margin-top:0;">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    Open File
                </a>
            </div>`;
    }

    panel.innerHTML = `
        ${topbarStyles}

        <div class="lrs-preview-topbar">
            <div class="lrs-preview-topbar-info">
                <div class="lrs-preview-topbar-title">${file.title}</div>
                <div class="lrs-preview-topbar-meta">
                    <span>${file.teacher}</span>
                    <span>&bull;</span>
                    <span>${ext ? ext.toUpperCase() : 'FILE'}</span>
                    <span>&bull;</span>
                    <span>${file.size || 'N/A'}</span>
                    <span>&bull;</span>
                    <span>${file.uploaded_at}</span>
                </div>
            </div>
            <div class="lrs-preview-topbar-actions">
                <a href="${path}" target="_blank" class="lrs-preview-open-btn">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    Open in new tab
                </a>
            </div>
        </div>

        ${previewHtml}`;
};

function getFileIcon(ext, isVideo = false) {
    const color = "#4fd1c5";

    // Video icon (YouTube red play button style)
    if (isVideo) {
        return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${color}" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="3" ry="3"></rect>
            <polygon points="10 9 16 12 10 15" fill="${color}" stroke="none"></polygon>
        </svg>`;
    }
    // PDF Icon
    if (ext === 'pdf') {
        return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h3a2 2 0 0 1 0 4h-3V15z"></path></svg>`;
    }
    // Image Icon
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
        return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }
    // Word/Doc/Default Icon
    return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
}

// Reuse your Menu Logic
window.openResourceMenu = function(btn) {
    window.open(path, '_blank');
};