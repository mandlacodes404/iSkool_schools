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
        window.configureHeader({ title: 'Resources', mode: 'standard', color: '#f28c38' });
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
        mobileSearch: document.getElementById('lrsMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lrs-mobile-folder-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('resources', state);
    else sessionStorage.setItem('resourcePageState', JSON.stringify(state));
}

function restoreResourcePageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('resources')
            : JSON.parse(sessionStorage.getItem('resourcePageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lrsMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lrsMobileSearch(state.mobileSearch);
                }
            }
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lrs-mobile-folder-body').forEach(body => {
                    const open = state.openFolders.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const chev = body.previousElementSibling?.querySelector('.lrs-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
                window.selectDesktopLearnerResource(state.selectedIdx);
                const sidebar = document.querySelector('.lrs-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            }
        });
    } catch (e) { /* ignore bad state */ }
}

function parseLearnerResourceTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLearnerResourceTime(file) {
    return parseLearnerResourceTime(file.raw_uploaded_at || file.uploaded_at || file.created_at);
}

function getSortedLearnerResourceEntries(data) {
    return Object.entries(data || {})
        .map(([teacher, files], index) => {
            const sortedFiles = Array.isArray(files)
                ? [...files].sort((a, b) => getLearnerResourceTime(b) - getLearnerResourceTime(a))
                : [];
            const latestTime = sortedFiles.reduce((latest, file) => Math.max(latest, getLearnerResourceTime(file)), 0);
            return { teacher, files: sortedFiles, latestTime, index };
        })
        .sort((a, b) => (b.latestTime - a.latestTime) || (a.index - b.index));
}

function renderResourceCards(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No resources found.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    const teacherEntries = getSortedLearnerResourceEntries(data);

    window._allLearnerResourcesFlat = [];
    for (const { teacher, files } of teacherEntries) {
        files.forEach(file => {
            window._allLearnerResourcesFlat.push({ ...file, teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    let desktopGroupIdx = 0;
    for (const { teacher, files } of teacherEntries) {
        const groupId = `lrs-dg-${desktopGroupIdx++}`;
        sidebarHtml += `
            <div class="lrs-desktop-teacher-group">
                <button type="button" class="lrs-desktop-teacher-header" onclick="toggleLrsDesktopGroup('${groupId}', this)">
                    <svg class="lrs-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="lrs-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="lrs-desktop-teacher-name">${escapeResourceHtml(teacher)}</span>
                    <span class="lrs-desktop-teacher-count">${files.length}</span>
                </button>
                <div class="lrs-desktop-teacher-body collapsed" id="${groupId}">`;
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
                    data-title="${escapeResourceHtml(file.title || '').toLowerCase()}"
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
        sidebarHtml += `</div></div>`;
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lrs-desktop-layout { display: flex !important; }
                .lrs-mobile-list    { display: none !important; }
                .lrs-mobile-search-wrap { display: none !important; }
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
            .lrs-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lrs-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lrs-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lrs-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lrs-desktop-teacher-group { border-bottom: 1px solid rgba(255,255,255,0.04); }
            .lrs-desktop-teacher-header {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                background: transparent;
                border: 0;
                color: #8b949e;
                cursor: pointer;
                font-family: inherit;
                text-align: left;
            }
            .lrs-desktop-teacher-header:hover { background: rgba(255,255,255,0.03); color: #c9d1d9; }
            .lrs-desktop-teacher-chevron { flex-shrink: 0; transition: transform 0.2s ease; }
            .lrs-desktop-teacher-chevron.open { transform: rotate(90deg); }
            .lrs-desktop-teacher-folder-icon { flex-shrink: 0; opacity: 0.85; }
            .lrs-desktop-teacher-name {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
            }
            .lrs-desktop-teacher-count {
                flex-shrink: 0;
                font-size: 10px;
                font-weight: 800;
                color: #f28c38;
                background: rgba(242,140,56,0.1);
                border: 1px solid rgba(242,140,56,0.25);
                border-radius: 999px;
                padding: 1px 7px;
            }
            .lrs-desktop-teacher-body.collapsed { display: none; }
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
                background: transparent;
                border-bottom: 0;
                padding: 13px 18px;
                position: relative;
            }
            .lrs-mobile-video-card::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 18px;
                right: 18px;
                height: 1px;
                background: rgba(255,255,255,0.06);
            }
            .lrs-mobile-video-card:last-child::after { display: none; }
            .lrs-mobile-video-title {
                font-size: 15px;
                font-weight: 700;
                color: #e2e8f0;
                margin: 0 0 3px;
            }
            .lrs-mobile-video-meta {
                font-size: 11px;
                color: #555e6a;
                margin: 0 0 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            /* ── MOBILE LIST STYLES (flat, no card wrapper) ── */
            .lrs-mobile-list {
                background: transparent;
                border-radius: 0;
                overflow: visible;
                margin: 0 0 14px;
            }
            @media (max-width: 899px) {
                .lrs-mobile-list {
                    margin-left: -18px;
                    margin-right: -18px;
                }
            }
            .lrs-mobile-folder-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 18px;
                background: transparent;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                cursor: pointer;
                user-select: none;
                transition: background 0.2s;
            }
            .lrs-mobile-folder-header:active { background: rgba(255,255,255,0.03); }
            .lrs-mobile-folder-icon { flex-shrink: 0; }
            .lrs-mobile-folder-name {
                flex: 1;
                font-size: 16px;
                font-weight: 800;
                color: #e2e8f0;
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-mobile-folder-count {
                font-size: 12px;
                color: #8b949e;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                padding: 2px 8px;
                border-radius: 20px;
                flex-shrink: 0;
            }
            .lrs-mobile-folder-chevron {
                flex-shrink: 0;
                color: #555e6a;
                transition: transform 0.3s ease;
            }
            .lrs-mobile-folder-chevron.open { transform: rotate(90deg); }
            .lrs-mobile-folder-body { display: block; }
            .lrs-mobile-folder-body.collapsed { display: none; }
            .lrs-mobile-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 13px 18px;
                background: transparent;
                border-bottom: 0;
                border-radius: 0;
                border-left: 0;
                border-right: 0;
                cursor: pointer;
                transition: background 0.15s;
                position: relative;
            }
            .lrs-mobile-row::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 18px;
                right: 18px;
                height: 1px;
                background: rgba(255,255,255,0.06);
            }
            .lrs-mobile-row:last-child::after { display: none; }
            .lrs-mobile-row:active { background: rgba(255,255,255,0.03); }
            .lrs-mobile-row-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: #f28c3818;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .lrs-mobile-row-body { flex: 1; min-width: 0; }
            .lrs-mobile-row-title {
                font-size: 15px;
                font-weight: 700;
                color: #e2e8f0;
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-mobile-row-size {
                font-size: 11px;
                color: #555e6a;
                margin-top: 2px;
            }
            .lrs-mobile-row-chevron {
                flex-shrink: 0;
                color: #555e6a;
            }

            /* ── MOBILE SEARCH BAR ── */
            @media (max-width: 899px) {
                .lrs-mobile-search-wrap {
                    display: block;
                    margin-bottom: 10px;
                    position: relative;
                }
                .lrs-mobile-search-wrap svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    opacity: 0.4;
                }
                .lrs-mobile-search {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 9px 14px 9px 36px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.05);
                    border: none;
                    color: #e2e8f0;
                    font-size: 15px;
                    font-family: 'Nunito', sans-serif;
                    transition: background 0.2s;
                }
                .lrs-mobile-search:focus { outline: none; background: rgba(255,255,255,0.08); }
                .lrs-mobile-search::placeholder { color: #555e6a; }
            }

            /* ── DESKTOP SEARCH BAR ── */
            .lrs-desktop-search-wrap {
                display: none;
                position: relative;
                padding: 10px 10px 8px;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lrs-desktop-search-wrap svg {
                position: absolute;
                left: 22px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                opacity: 0.4;
            }
            .lrs-desktop-search {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 12px 8px 32px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                color: #e2e8f0;
                font-size: 12.5px;
                font-family: 'Nunito', sans-serif;
                transition: border-color 0.2s;
            }
            .lrs-desktop-search:focus { outline: none; border-color: #f28c38; }
            .lrs-desktop-search::placeholder { color: #555e6a; }
            @media (min-width: 900px) {
                .lrs-desktop-search-wrap { display: block; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lrs-desktop-layout">
            <div class="lrs-sidebar">
                <div class="lrs-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lrs-desktop-search" id="lrsDesktopSearch"
                        placeholder="Search resources..." oninput="lrsDesktopSearch(this.value)">
                </div>
                <div class="lrs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lrs-main-panel" id="lrs-main-panel">
                <div class="lrs-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#f28c38" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select a resource from the left to open it</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    if (teacherEntries.length > 0) {
        html += `
        <div class="lrs-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lrs-mobile-search" id="lrsMobileSearch"
                placeholder="Search resources..." oninput="lrsMobileSearch(this.value)">
        </div>`;
    }

    html += `<div class="lrs-mobile-list">`;

    let mobileGroupIdx = 0;
    for (const { teacher, files } of teacherEntries) {
        const gid = `lrs-mg-${mobileGroupIdx}`;
        html += `
            <div class="lrs-mobile-folder-header" onclick="toggleLrsMobileFolder('${gid}', this)">
                <div class="lrs-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lrs-mobile-folder-name">${teacher}</span>
                <span class="lrs-mobile-folder-count">${files.length} file${files.length !== 1 ? 's' : ''}</span>
                <svg class="lrs-mobile-folder-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="lrs-mobile-folder-body collapsed" id="${gid}">`;
        mobileGroupIdx++;
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
                         data-title="${file.title.toLowerCase()}"
                         onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')">
                        <div class="lrs-mobile-row-icon">${icon}</div>
                        <div class="lrs-mobile-row-body">
                            <div class="lrs-mobile-row-title">${file.title}</div>
                            ${file.size ? `<div class="lrs-mobile-row-size">${file.size}</div>` : ''}
                        </div>
                        <div class="lrs-mobile-row-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
            }
        });
        html += `</div>`; // close .lrs-mobile-folder-body
    }

    html += `</div>`; // close .lrs-mobile-list

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE (inline preview)
// ─────────────────────────────────────────────
window.lrsDesktopSearch = function(val) {
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lrs-desktop-teacher-group').forEach(group => {
        const header = group.querySelector('.lrs-desktop-teacher-header');
        const body   = group.querySelector('.lrs-desktop-teacher-body');
        const nameEl = group.querySelector('.lrs-desktop-teacher-name');
        const groupName = nameEl ? nameEl.textContent.toLowerCase() : '';
        if (!header || !body) return;

        const items = body.querySelectorAll('.lrs-sidebar-item');
        let visible = 0;
        items.forEach(item => {
            const title = (item.dataset.title || '');
            const show = !term || title.includes(term) || groupName.includes(term);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        const groupShow = visible > 0 || !term || groupName.includes(term);
        group.style.display = groupShow ? '' : 'none';

        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header.querySelector('.lrs-desktop-teacher-chevron');
            if (chev) chev.classList.add('open');
        } else if (!term) {
            body.classList.add('collapsed');
            const chev = header.querySelector('.lrs-desktop-teacher-chevron');
            if (chev) chev.classList.remove('open');
        }
    });
};

window.toggleLrsMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lrs-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveResourcePageState();
};

window.toggleLrsDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lrs-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
};

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

window.lrsMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('resources', { mobileSearch: val });
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lrs-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const folderName = header ? header.querySelector('.lrs-mobile-folder-name').textContent.toLowerCase() : '';
        const rows = body.querySelectorAll('.lrs-mobile-row, .lrs-mobile-video-card');
        let visible = 0;
        rows.forEach(row => {
            const titleEl = row.querySelector('.lrs-mobile-row-title, .lrs-mobile-video-title');
            const title = (row.dataset.title || (titleEl ? titleEl.textContent : '')).toLowerCase();
            const show = !term || title.includes(term) || folderName.includes(term);
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (header) header.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        body.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header ? header.querySelector('.lrs-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });
};

function getFileIcon(ext, isVideo = false) {
    const color = "#f28c38";

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

function escapeResourceHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

// Reuse your Menu Logic
window.openResourceMenu = function(btn) {
    window.open(path, '_blank');
};