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

    // 4a. If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.resourcePrefetchPromise) {
        await window.resourcePrefetchPromise;
    }

    // 4b. CACHE CHECK (Instant Load)
    if (window.resourceCache) {
        renderResourceCards(window.resourceCache);
        restoreResourcePageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && loader) loader.style.display = 'flex';

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
            apiArea.innerHTML = "<p class='lrs-error-state'>Error loading resources.</p>";
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
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('lrs-main-panel');
    const selected = (window._allLearnerResourcesFlat || [])[window._learnerResourceSelectedIdx];
    const state = {
        selectedId:    selected ? String(selected.id) : null,
        selectedIdx:   window._learnerResourceSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   panel ? panel.scrollTop : 0,
        mobileSearch: document.getElementById('lrsMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lrs-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        openDesktopGroups: Array.from(document.querySelectorAll('.lrs-desktop-teacher-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('resources', state);
    else sessionStorage.setItem('resourcePageState', JSON.stringify(state));
}

function wireResourceScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.lrs-sidebar-scroll');
    const panel = document.getElementById('lrs-main-panel');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.lrsScrollWired === '1') return;
        el.dataset.lrsScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('resources', saveResourcePageState), { passive: true });
    });
}

function restoreResourcePageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('resources')
            : JSON.parse(sessionStorage.getItem('resourcePageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            wireResourceScrollState();
            return;
        }
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
                    const header = body.previousElementSibling;
                    if (header) header.classList.toggle('lrs-mobile-folder-header--collapsed', !open);
                    const chev = header?.querySelector('.lrs-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (Array.isArray(state.openDesktopGroups)) {
                document.querySelectorAll('.lrs-desktop-teacher-body').forEach(body => {
                    const open = state.openDesktopGroups.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const header = body.previousElementSibling;
                    const chevron = header ? header.querySelector('.lrs-desktop-teacher-chevron') : null;
                    if (chevron) chevron.classList.toggle('open', open);
                });
            }
            const selectedIdx = state.selectedId
                ? (window._allLearnerResourcesFlat || []).findIndex(file => String(file.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerResource(selectedIdx);
            }
            const sidebar = document.querySelector('.lrs-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panel = document.getElementById('lrs-main-panel');
            if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
            wireResourceScrollState();
            saveResourcePageState();
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
        apiArea.innerHTML = "<p class='lrs-empty-state'>No resources found.</p>";
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
    // (Styles for this markup now live in assets/css/learner/resources.css
    // — the inline <style> block that used to be injected here was removed
    // as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lrs-desktop-layout lqz-flat-layout">
            <div class="lrs-sidebar lqz-flat-sidebar">
                <div class="lrs-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lrs-desktop-search" id="lrsDesktopSearch"
                        placeholder="Search resources..." oninput="lrsDesktopSearch(this.value)">
                </div>
                <div class="lrs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lrs-main-panel lqz-flat-panel" id="lrs-main-panel">
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
            <div class="lrs-mobile-folder-header lrs-mobile-folder-header--collapsed" onclick="toggleLrsMobileFolder('${gid}', this)">
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
                    <div class="lrs-mobile-video-card" data-resource-id="${file.id}">
                        <div class="lrs-mobile-video-title">${file.title}</div>
                        <div class="lrs-mobile-video-meta">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="#ff4444" stroke="none">
                                <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.5 21.6 12 21.6 12 21.6s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/>
                            </svg>
                            <span>VIDEO</span>
                            <span class="lrs-bullet-muted">&bull;</span>
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
                const fileMeta = [file.size, file.uploaded_at]
                    .filter(Boolean)
                    .map(escapeResourceHtml)
                    .join(' <span class="lrs-bullet-muted">&bull;</span> ');
                html += `
                    <div class="lrs-mobile-row"
                         data-resource-id="${file.id}"
                         data-title="${file.title.toLowerCase()}"
                         onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')">
                        <div class="lrs-mobile-row-icon">${icon}</div>
                        <div class="lrs-mobile-row-body">
                            <div class="lrs-mobile-row-title">${file.title}</div>
                            ${fileMeta ? `<div class="lrs-mobile-row-size">${fileMeta}</div>` : ''}
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
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE (inline preview)
// ─────────────────────────────────────────────

// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a folder is expanded/collapsed or a search filters rows
// in/out of view — both change the page's actual scrollable height
// without firing a real 'scroll' event, so the bottom nav's background
// (and header) never got re-checked against the new height on its own.
// A single delayed check would need to know the exact CSS transition
// duration (unknown from here, and could change) — polling a few times
// over ~400ms means it settles on the right answer regardless.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

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

    // Desktop doesn't use the dynamic bottom-nav/header behaviour, so
    // recheckMobileNavAfterToggle() will just no-op there — kept for
    // consistency in case that ever changes.
    recheckMobileNavAfterToggle();
};

window.toggleLrsMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lrs-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    headerEl.classList.toggle('lrs-mobile-folder-header--collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveResourcePageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
};

window.toggleLrsDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lrs-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveResourcePageState();

    // Desktop doesn't have this dynamic bottom-nav/header behaviour, so
    // window.recalcMobileScrollUI won't exist there —
    // recheckMobileNavAfterToggle() already no-ops safely when it's missing.
    recheckMobileNavAfterToggle();
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

    // ── VIDEO BRANCH ──
    if (isVideo) {
        // Convert embed URL back to watch URL for "open in YouTube" button
        const youtubeWatchUrl = (file.video_url || '').replace(
            /youtube\.com\/embed\/([A-Za-z0-9_-]{11}).*/,
            'youtube.com/watch?v=$1'
        );

        panel.innerHTML = `
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
                <div class="lrs-preview-fallback-icon">${icon.replace('width="20"','width="52"').replace('height="20"','height="52"')}</div>
                <p class="lrs-preview-fallback-label">Preview not available for .${ext.toUpperCase()} files</p>
                <a href="${path}" target="_blank" class="lrs-open-btn lrs-open-btn--flush">
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
            if (header) header.classList.remove('lrs-mobile-folder-header--collapsed');
            const chev = header ? header.querySelector('.lrs-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });

    // Filtering rows/folders in/out of view changes the page's scrollable
    // height just like expanding/collapsing a folder does, but without a
    // real scroll event — same recalculation fix as the folder toggle.
    recheckMobileNavAfterToggle();
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
