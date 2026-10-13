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
    const navigation = window.beginLearnerViewNavigation?.('resource_list.php');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
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
    if (!isCurrentNavigation()) return;

    // 4b. CACHE CHECK (Instant Load)
    if (window.resourceCache) {
        renderResourceCards(window.resourceCache);
        restoreResourcePageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_resources.php');
        if (!response.ok) throw new Error('Failed to fetch resources');
        const data = await response.json();
        if (!isCurrentNavigation()) return;
        window.resourceCache = data;
        renderResourceCards(data);
        restoreResourcePageState();
    } catch (error) {
        if (!isCurrentNavigation()) return;
        console.error("Resource Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p class='lrs-error-state'>Error loading resources.</p>";
        }
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
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
        panelScroll:   (document.querySelector('.lrs-pvw') || {}).scrollTop || 0,
        mobileSearch: document.getElementById('lrsMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lrs-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        // Desktop teacher groups the learner has folded away (open is the default)
        collapsedTeachers: Array.from(window._lrsCollapsed || []),
    };
    if (window.learnerPageState) window.learnerPageState.set('resources', state);
    else sessionStorage.setItem('resourcePageState', JSON.stringify(state));
}

function wireResourceScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.lrs-sidebar-scroll');
    const panel = document.querySelector('.lrs-pvw');
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
            window.lrsEnsureSelection();
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
            if (Array.isArray(state.collapsedTeachers)) {
                window._lrsCollapsed = new Set(state.collapsedTeachers);
                if (typeof window.lrsRenderDesktopList === 'function') window.lrsRenderDesktopList();
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
            const panelBody = document.querySelector('.lrs-pvw');
            if (panelBody && Number.isFinite(state.panelScroll)) panelBody.scrollTop = state.panelScroll;
            window.lrsEnsureSelection();
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
        apiArea.innerHTML = `
            <!-- ═══ DESKTOP EMPTY ═══ -->
            <div class="lrs-desktop-layout lqz-flat-layout" id="lrs-desktop-layout">
                <div class="lrs-sidebar">
                    <div class="lrs-lh">
                        <div class="lrs-desktop-search-wrap">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input type="text" class="lrs-desktop-search" id="lrsDesktopSearch" placeholder="Filter resources" disabled>
                        </div>
                    </div>
                    <div class="lrs-sidebar-scroll" id="lrs-list"></div>
                </div>
                <div class="lrs-split" aria-hidden="true"></div>
                <div class="lrs-main-panel lqz-flat-panel" id="lrs-main-panel">
                    <div class="lrs-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <p>Your teachers haven't posted any resources yet.</p>
                    </div>
                </div>
            </div>

            <!-- ═══ MOBILE EMPTY ═══ -->
            <div class="lrs-mobile-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="lrs-mobile-search" id="lrsMobileSearch"
                    placeholder="Search resources..." oninput="lrsMobileSearch(this.value)">
            </div>
            <div class="lrs-mobile-list">
                <div class="lrs-mobile-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#f28c38" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p class="lrs-mobile-empty-title">No resources yet</p>
                    <p class="lrs-mobile-empty-body">Your teachers haven't posted any resources. Check back soon.</p>
                </div>
            </div>`;
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

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/resources.css
    // — the inline <style> block that used to be injected here was removed
    // as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lrs-desktop-layout lqz-flat-layout" id="lrs-desktop-layout">
            <div class="lrs-sidebar">
                <div class="lrs-lh">
                    <div class="lrs-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lrs-desktop-search" id="lrsDesktopSearch"
                            placeholder="Filter resources" oninput="lrsDesktopSearch(this.value)">
                    </div>
                    <div class="lrs-chips" id="lrs-chips"></div>
                </div>
                <div class="lrs-sidebar-scroll" id="lrs-list" tabindex="0" onkeydown="lrsListKeydown(event)"></div>
            </div>
            <div class="lrs-split" id="lrs-split" role="separator" aria-orientation="vertical" aria-label="Resize resource list" tabindex="0"></div>
            <div class="lrs-main-panel lqz-flat-panel" id="lrs-main-panel">
                <div class="lrs-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
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

    html += `
        <div class="lrs-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lrs-mobile-search" id="lrsMobileSearch"
                placeholder="Search resources..." oninput="lrsMobileSearch(this.value)">
        </div>`;

    html += `<div class="lrs-mobile-list">`;

    let mobileGroupIdx = 0;
    for (const { teacher, files } of teacherEntries) {
        const gid = `lrs-mg-${mobileGroupIdx}`;
        html += `
            <div class="lrs-mobile-folder-header lrs-mobile-folder-header--collapsed" onclick="toggleLrsMobileFolder('${gid}', this)">
                <div class="lrs-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
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
                const icon = getFileIconThin(file.ext, false);
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
    lrsEnsureFont();
    window.lrsInitDesktop();
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

// ─────────────────────────────────────────────
// DESKTOP LIST: folding teacher groups, type chips, search
// ─────────────────────────────────────────────
window._lrsFilter = 'all';
window._lrsTerm = '';

function lrsKind(file) {
    if (file.resource_type === 'video') return 'vid';
    const e = (file.ext || '').toLowerCase();
    if (e === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) return 'img';
    if (['ppt', 'pptx'].includes(e)) return 'ppt';
    if (['xls', 'xlsx', 'csv'].includes(e)) return 'xls';
    return 'doc';
}
function lrsCat(kind) { return kind === 'vid' ? 'vid' : kind === 'img' ? 'img' : 'doc'; }
function lrsTag(file, kind) { return kind === 'vid' ? 'VID' : String(file.ext || 'FILE').toUpperCase().slice(0, 4); }
function lrsTypeLabel(kind) {
    return { vid: 'Video', pdf: 'PDF document', img: 'Image', ppt: 'Presentation', xls: 'Spreadsheet', doc: 'Document' }[kind];
}
function lrsDaysAgo(file) {
    const t = getLearnerResourceTime(file);
    if (!t) return null;
    const a = new Date(); a.setHours(0, 0, 0, 0);
    const b = new Date(t); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
}
function lrsShortDate(file) {
    const t = getLearnerResourceTime(file);
    if (!t) return file.uploaded_at || '';
    const d = new Date(t);
    return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' });
}
function lrsRelTime(file) {
    const d = lrsDaysAgo(file);
    if (d === null) return '';
    if (d <= 0) return 'Today';
    return d < 14 ? d + 'd' : lrsShortDate(file);
}
function lrsYoutubeWatchUrl(file) {
    const m = String(file.video_url || '').match(/embed\/([A-Za-z0-9_-]{11})/);
    return m ? 'https://www.youtube.com/watch?v=' + m[1] : (file.video_url || '#');
}

window.lrsRenderDesktopList = function () {
    const list = document.getElementById('lrs-list');
    if (!list) return;
    const keepScroll = list.scrollTop;
    const term = window._lrsTerm;
    const items = (window._allLearnerResourcesFlat || []).map((file, idx) => ({ file, idx, kind: lrsKind(file) }));
    const showActive = !!document.querySelector('#lrs-main-panel .lrs-dh');

    const counts = { all: items.length, doc: 0, vid: 0, img: 0 };
    items.forEach(i => { counts[lrsCat(i.kind)]++; });
    const chipsEl = document.getElementById('lrs-chips');
    if (chipsEl) {
        chipsEl.innerHTML = [['all', 'All'], ['doc', 'Docs'], ['vid', 'Videos'], ['img', 'Images']]
            .map(([k, label]) => `<button type="button" class="lrs-chip${window._lrsFilter === k ? ' on' : ''}" onclick="lrsSetFilter('${k}')">${label} ${counts[k]}</button>`)
            .join('');
    }

    const visible = items.filter(({ file, kind }) =>
        (window._lrsFilter === 'all' || lrsCat(kind) === window._lrsFilter) &&
        (!term || `${file.title || ''} ${file.teacher || ''} ${file.ext || ''}`.toLowerCase().includes(term))
    );

    // Group by teacher, in the order the page already sorts them (most recent file first),
    // the same way the assignments and announcements lists group. Rows keep their order inside a group.
    const groups = [];
    const byTeacher = new Map();
    visible.forEach(item => {
        const teacher = item.file.teacher || 'Teacher';
        let g = byTeacher.get(teacher);
        if (!g) { g = { teacher, rows: [] }; byTeacher.set(teacher, g); groups.push(g); }
        g.rows.push(item);
    });

    if (!window._lrsCollapsed) window._lrsCollapsed = new Set();
    const CHEV = '<svg class="lrs-gl-chev" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    let html = '';
    groups.forEach(({ teacher, rows }) => {
        // a search always shows every match, whatever was folded away
        const collapsed = !term && window._lrsCollapsed.has(teacher);
        html += `
            <div class="lrs-group">
                <div class="lrs-gl" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}"
                     data-teacher="${escapeResourceHtml(teacher)}"
                     onclick="lrsToggleGroup(this)" onkeydown="lrsGroupKeydown(event, this)">
                    ${CHEV}<span class="lrs-gl-name">${escapeResourceHtml(teacher)}</span>
                </div>
                <div class="lrs-gb${collapsed ? ' collapsed' : ''}">`;
        rows.forEach(({ file, idx, kind }) => {
            const meta = (kind === 'vid' ? 'YouTube' : (file.size || 'N/A')) + ' &middot; ' + escapeResourceHtml(lrsShortDate(file));
            const active = showActive && idx === window._learnerResourceSelectedIdx ? ' active' : '';
            html += `
                <div class="lrs-sidebar-item${active}" id="lrs-sidebar-${idx}" data-title="${escapeResourceHtml(file.title || '').toLowerCase()}" onclick="selectDesktopLearnerResource(${idx})">
                    <span class="lrs-ft lrs-t-${kind}">${escapeResourceHtml(lrsTag(file, kind))}</span>
                    <div class="lrs-sidebar-item-info">
                        <div class="lrs-sidebar-item-title">${escapeResourceHtml(file.title || '')}</div>
                        <div class="lrs-sidebar-item-meta">${meta}</div>
                    </div>
                    <span class="lrs-tm">${escapeResourceHtml(lrsRelTime(file))}</span>
                </div>`;
        });
        html += `
                </div>
            </div>`;
    });
    list.innerHTML = html || `<div class="lrs-list-empty">${items.length ? 'No resources match.' : "Your teachers haven't posted any resources yet."}</div>`;
    list.scrollTop = keepScroll;
};

// Fold / unfold one teacher group. The DOM is updated in place so the list does not jump.
window.lrsToggleGroup = function (headerEl) {
    if (!headerEl) return;
    const body = headerEl.nextElementSibling;
    if (!body) return;
    const teacher = headerEl.dataset.teacher || '';
    if (!window._lrsCollapsed) window._lrsCollapsed = new Set();
    const nowCollapsed = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', nowCollapsed);
    headerEl.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    if (nowCollapsed) window._lrsCollapsed.add(teacher);
    else window._lrsCollapsed.delete(teacher);
    saveResourcePageState();
};

window.lrsGroupKeydown = function (e, headerEl) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    window.lrsToggleGroup(headerEl);
};

window.lrsSetFilter = function (key) { window._lrsFilter = key; window.lrsRenderDesktopList(); };
window.lrsDesktopSearch = function (val) {
    window._lrsTerm = String(val || '').toLowerCase().trim();
    window.lrsRenderDesktopList();
};

// ↑ / ↓ move through the list
window.lrsListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // rows inside a folded group are hidden, so ↑ / ↓ step over them
    const ids = Array.from(document.querySelectorAll('#lrs-list .lrs-sidebar-item'))
        .filter(el => el.offsetParent !== null)
        .map(el => parseInt(el.id.replace('lrs-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._learnerResourceSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopLearnerResource(ids[next]);
    const el = document.getElementById(`lrs-sidebar-${ids[next]}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
};

// Desktop never shows an empty detail pane when there's something to show
window.lrsEnsureSelection = function () {
    if (window.innerWidth < 900) return;
    if (document.querySelector('#lrs-list .lrs-sidebar-item.active')) return;
    const first = Array.from(document.querySelectorAll('#lrs-list .lrs-sidebar-item')).find(el => el.offsetParent !== null);
    if (first) window.selectDesktopLearnerResource(parseInt(first.id.replace('lrs-sidebar-', ''), 10));
};

// Drag (or ← / →) to resize the list; width is remembered and shared with the other pages
window.lrsInitSplit = function () {
    const layout = document.getElementById('lrs-desktop-layout');
    const split = document.getElementById('lrs-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--lrs-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--lrs-listw'), 10) || 320;
    const persist = () => { try { localStorage.setItem('lqz.listWidth', String(current())); } catch (e) {} };
    try {
        const saved = parseInt(localStorage.getItem('lqz.listWidth'), 10);
        if (saved) apply(saved);
    } catch (e) {}

    split.addEventListener('mousedown', e => {
        e.preventDefault();
        split.classList.add('drag');
        document.body.style.userSelect = 'none';
        const left = layout.getBoundingClientRect().left;
        const move = ev => apply(ev.clientX - left);
        const up = () => {
            split.classList.remove('drag');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            persist();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
    split.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        apply(current() + (e.key === 'ArrowRight' ? 16 : -16));
        persist();
    });
};

window.lrsInitDesktop = function () {
    window._lrsFilter = 'all';
    window._lrsTerm = '';
    // keep which teacher groups are folded if the page is rebuilt (restore may overwrite it)
    if (!window._lrsCollapsed) window._lrsCollapsed = new Set();
    window.lrsRenderDesktopList();
    window.lrsInitSplit();
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE (inline preview)
// ─────────────────────────────────────────────
window.selectDesktopLearnerResource = function(flatIdx) {
    const flat = window._allLearnerResourcesFlat || [];
    const file = flat[flatIdx];
    if (!file) return;
    window._learnerResourceSelectedIdx = flatIdx;
    saveResourcePageState();
    document.querySelectorAll('.lrs-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lrs-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const panel = document.getElementById('lrs-main-panel');
    if (!panel) return;

    const kind = lrsKind(file);
    const ext = (file.ext || '').toLowerCase();
    const tag = lrsTag(file, kind);
    const title = escapeResourceHtml(file.title || '');
    const path = escapeResourceHtml(file.path || '');

    // ── Header actions ──
    let actions;
    if (kind === 'vid') {
        actions = `<a class="lrs-pri" href="${escapeResourceHtml(lrsYoutubeWatchUrl(file))}" target="_blank" rel="noopener">Open in YouTube</a>`;
    } else {
        const openLabel = (kind === 'pdf' || kind === 'img') ? 'Open in new tab' : 'Open file';
        actions = `<a class="lrs-btn2" href="${path}" download>Download</a>` +
                  `<a class="lrs-pri" href="${path}" target="_blank" rel="noopener">${openLabel}</a>`;
    }

    // ── Preview canvas ──
    let preview;
    if (kind === 'vid') {
        preview = `<div class="lrs-pvw"><div class="lrs-pvid"><iframe src="${escapeResourceHtml(file.video_url || '')}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen title="${title}"></iframe></div></div>`;
    } else if (kind === 'pdf') {
        preview = `<div class="lrs-pvw lrs-pvw--bleed"><iframe class="lrs-pdf" src="${path}" title="${title}"></iframe></div>`;
    } else if (kind === 'img') {
        preview = `<div class="lrs-pvw"><img class="lrs-pimg" src="${path}" alt="${title}"></div>`;
    } else {
        preview = `<div class="lrs-pvw"><div class="lrs-fb">
            <span class="lrs-ft lrs-ft--lg lrs-t-${kind}">${escapeResourceHtml(tag)}</span>
            <p>Preview isn't available for .${escapeResourceHtml(ext.toUpperCase() || 'this')} files</p>
        </div></div>`;
    }

    // ── Context rail ──
    const more = flat
        .map((f, i) => ({ f, i }))
        .filter(({ f, i }) => i !== flatIdx && f.teacher === file.teacher)
        .slice(0, 3)
        .map(({ f, i }) => {
            const k = lrsKind(f);
            return `
            <button type="button" class="lrs-more" onclick="selectDesktopLearnerResource(${i})">
                <span class="lrs-ft lrs-ft--sm lrs-t-${k}">${escapeResourceHtml(lrsTag(f, k))}</span>
                <span class="lrs-more-text"><b>${escapeResourceHtml(f.title || '')}</b><small>${escapeResourceHtml(lrsShortDate(f))}</small></span>
            </button>`;
        }).join('');

    panel.innerHTML = `
        <div class="lrs-dh">
            <h2 class="lrs-dh-title">${title}</h2>
            <span class="lrs-panel-status">${escapeResourceHtml(tag)}</span>
            <span class="lrs-dsp"></span>
            ${actions}
        </div>
        <div class="lrs-dbody">
            ${preview}
            <aside class="lrs-rail">
                <h4>Details</h4>
                <div class="lrs-kv"><span>Teacher</span><b>${escapeResourceHtml(file.teacher || '')}</b></div>
                <div class="lrs-kv"><span>Type</span><b>${lrsTypeLabel(kind)}</b></div>
                <div class="lrs-kv"><span>${kind === 'vid' ? 'Source' : 'Size'}</span><b>${kind === 'vid' ? 'YouTube' : escapeResourceHtml(file.size || 'N/A')}</b></div>
                <div class="lrs-kv"><span>Uploaded</span><b>${escapeResourceHtml(file.uploaded_at || lrsShortDate(file))}</b></div>
                ${more ? `<h4 class="lrs-rail-sub">More from ${escapeResourceHtml(file.teacher || '')}</h4>${more}` : ''}
            </aside>
        </div>`;

    // Keep the selected row visible inside the list (scrolls the list only)
    const listBox = document.getElementById('lrs-list');
    // (a row inside a folded group has no box, so there is nothing to scroll to)
    if (listBox && sidebarItem && sidebarItem.offsetParent !== null) {
        const top = sidebarItem.offsetTop, bottom = top + sidebarItem.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }
    if (window.learnerPageState) wireResourceScrollState();
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

// Mobile row-list only — thinner stroke for the folder-row icon.
// Desktop sidebar item and the preview-fallback panel keep the original
// weight via getFileIcon() above; don't repoint them at this helper.
function getFileIconThin(ext, isVideo = false) {
    return getFileIcon(ext, isVideo).replace('stroke-width="2"', 'stroke-width="1.3"');
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

// Desktop type is Geist 300/400/500 (see resources.css). Nunito stays loaded for the mobile views.
function lrsEnsureFont() {
    if (!document.getElementById('lrs-geist-font')) {
        const g = document.createElement('link');
        g.id = 'lrs-geist-font';
        g.rel = 'stylesheet';
        g.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap';
        document.head.appendChild(g);
    }
    if (document.getElementById('lrs-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'lrs-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}