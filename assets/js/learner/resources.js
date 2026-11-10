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
    // while a phone file screen is open the page is not the list, so its scroll must not overwrite the list's
    if (window._lrsMobDetail) return;
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
        mobileFilter: window._lrsMobFilter || 'all',
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
            if (state.mobileFilter && state.mobileFilter !== 'all') window.lrsMobileSetFilter(state.mobileFilter);
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lrs-mobile-folder-body').forEach(body => {
                    const header = body.previousElementSibling;
                    if (header) lrsMobileSetFolder(header, body, state.openFolders.includes(body.id));
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

    window._lrsMobDetail = false;
    window._lrsMobFilter = 'all';
    window._lrsMobTerm = '';

    if (Object.keys(data).length === 0) {
        window._allLearnerResourcesFlat = [];
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
            <div class="lrs-mobile-head"><h1 class="lrs-mobile-title">Resources</h1></div>
            <div class="lrs-mobile-list">
                <div class="lrs-mobile-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp" aria-hidden="true">
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

    // ── Phone: title and counts, search, type chips, then the teacher groups ──
    // (the desktop layout above is a separate tree; the phone tree below is hidden from 900px up)
    const flatAll = window._allLearnerResourcesFlat;
    const catCounts = { all: flatAll.length, doc: 0, vid: 0, img: 0 };
    flatAll.forEach(file => { catCounts[lrsCat(lrsKind(file))]++; });

    html += lrsMobileHeadHtml(lrsMobileSummary(flatAll.length, flatAll.length, teacherEntries.length, false));
    html += lrsMobileSearchHtml();
    html += `<div class="lrs-mobile-chips" role="group" aria-label="Filter resources by type">${
        [['all', 'All'], ['doc', 'Docs'], ['vid', 'Videos'], ['img', 'Images']]
            .map(([k, label]) => `<button type="button" class="lrs-mobile-chip${k === 'all' ? ' on' : ''}" data-filter="${k}" aria-pressed="${k === 'all'}" onclick="lrsMobileSetFilter('${k}')">${label} ${catCounts[k]}</button>`)
            .join('')
    }</div>`;

    html += `<div class="lrs-mobile-list" id="lrsMobileList">`;

    // Zero-results state: hidden by default, shown by lrsMobileApply() when a search or chip matches nothing.
    html += `
        <div class="lrs-mobile-empty lrs-mobile-search-empty" id="lrsMobileSearchEmpty" style="display:none;">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p class="lrs-mobile-empty-title" id="lrsMobileSearchEmptyText">No matches</p>
            <p class="lrs-mobile-empty-body" id="lrsMobileSearchEmptyBody">Try a different word or teacher.</p>
        </div>`;

    // The flat list is the teachers in order with their files in order, so a group's rows are consecutive indexes into it.
    // The first group starts open so the page is never just a column of folded labels; a learner's own choice
    // (saved page state) wins over this, see restoreResourcePageState().
    let flatCursor = 0;
    teacherEntries.forEach(({ teacher, files }, gi) => {
        const gid = `lrs-mg-${gi}`;
        const open = gi === 0;
        html += `
            <div class="lrs-mobile-folder-header${open ? '' : ' lrs-mobile-folder-header--collapsed'}" role="button" tabindex="0"
                aria-expanded="${open}" aria-controls="${gid}"
                onclick="toggleLrsMobileFolder('${gid}', this)"
                onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLrsMobileFolder('${gid}', this); }">
                <span class="lrs-mobile-folder-name">${escapeResourceHtml(teacher)}</span>
                <span class="lrs-mobile-folder-count">${files.length}</span>
                <svg class="lrs-mobile-folder-chevron lrs-icon-crisp" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </div>
            <div class="lrs-mobile-folder-body${open ? '' : ' collapsed'}" id="${gid}">`;
        files.forEach((file, rowIdx) => {
            html += lrsMobileRowHtml(flatAll[flatCursor], flatCursor, rowIdx === 0);
            flatCursor++;
        });
        html += `</div>`; // close .lrs-mobile-folder-body
    });

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

// ─────────────────────────────────────────────
// PHONE LIST: title and counts, search, type chips, teacher groups, and the open file
// ─────────────────────────────────────────────
window._lrsMobFilter = 'all';
window._lrsMobTerm = '';
window._lrsMobDetail = false;

// The line under the title: how many files and how many teachers, or how many of them match while searching.
function lrsMobileSummary(shown, total, teachers, filtering) {
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const files = filtering ? `${shown} of ${plural(total, 'file')}` : plural(total, 'file');
    // nothing matching leaves no teachers to count
    return teachers > 0 ? `<b>${files}</b> · ${plural(teachers, 'teacher')}` : `<b>${files}</b>`;
}

function lrsMobileHeadHtml(sub) {
    return `
        <div class="lrs-mobile-head">
            <h1 class="lrs-mobile-title">Resources</h1>
            <p class="lrs-mobile-sub" id="lrsMobileSub">${sub}</p>
        </div>`;
}

function lrsMobileSearchHtml() {
    return `
        <div class="lrs-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lrs-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"/>
            </svg>
            <input type="text" class="lrs-mobile-search" id="lrsMobileSearch"
                placeholder="Search resources" aria-label="Search resources" oninput="lrsMobileSearch(this.value)">
        </div>`;
}

// The server writes sizes with two decimals ("2.10 MB", "2.00 MB"); the page shows "2.1 MB" and "2 MB".
function lrsMobileSize(size) {
    return String(size == null ? '' : size).trim().replace(/\.00 /, ' ').replace(/(\.\d)0 /, '$1 ');
}

// The little play mark that stands in for the file type on a video's tile.
const LRS_PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="8 5 19 12 8 19"/></svg>';

// One file: its type in a soft tile (PDF, DOCX, PNG ... or a play mark for a video), the title, then size and date.
// Tapping opens the file's own screen. data-resource-id is what the Home screen uses to find a file.
function lrsMobileRowHtml(file, idx, first) {
    const kind = lrsKind(file);
    const isVid = kind === 'vid';
    const meta = [isVid ? 'YouTube' : lrsMobileSize(file.size), lrsShortDate(file)].filter(Boolean).map(escapeResourceHtml).join(' · ');
    return `
                <div class="lrs-mobile-row${first ? ' lrs-mobile-row--first' : ''}" role="button" tabindex="0"
                    data-idx="${idx}" data-resource-id="${escapeResourceHtml(file.id)}" data-cat="${lrsCat(kind)}"
                    onclick="openMobileLearnerResource(${idx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerResource(${idx}); }">
                    <div class="lrs-mobile-row-icon">${isVid ? LRS_PLAY_ICON : escapeResourceHtml(lrsTag(file, kind))}</div>
                    <div class="lrs-mobile-row-body">
                        <div class="lrs-mobile-row-title">${escapeResourceHtml(file.title || 'Untitled')}</div>
                        <div class="lrs-mobile-row-meta">${meta}</div>
                    </div>
                    <svg class="lrs-mobile-row-chevron lrs-icon-crisp" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </div>`;
}

function lrsMobileSetFolder(header, body, open) {
    body.classList.toggle('collapsed', !open);
    header.classList.toggle('lrs-mobile-folder-header--collapsed', !open);
    header.setAttribute('aria-expanded', open ? 'true' : 'false');
}

window.toggleLrsMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body || !headerEl) return;
    // while a search or a type is chosen every group that has a match shows open, so there is nothing to fold
    if (body.closest('.lrs-mobile-list')?.classList.contains('is-filtering')) return;
    lrsMobileSetFolder(headerEl, body, body.classList.contains('collapsed'));
    saveResourcePageState();

    // Opening/closing a group changes the page's actual scrollable height without firing a real 'scroll' event,
    // so the bottom nav and header are re-checked (see recheckMobileNavAfterToggle).
    recheckMobileNavAfterToggle();
};

// Shows the files that match the chosen type and the search box, hides groups with nothing in them, and keeps the
// counts line, the group counts and the empty state in step.
function lrsMobileApply() {
    const list = document.getElementById('lrsMobileList');
    if (!list) return;
    const flat = window._allLearnerResourcesFlat || [];
    const filter = window._lrsMobFilter || 'all';
    const term = window._lrsMobTerm || '';
    const filtering = filter !== 'all' || !!term;
    list.classList.toggle('is-filtering', filtering);

    let shown = 0, teachers = 0;
    list.querySelectorAll('.lrs-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const rows = body.querySelectorAll('.lrs-mobile-row');
        let here = 0;
        rows.forEach(row => {
            const file = flat[Number(row.dataset.idx)];
            if (!file) return;
            const kind = lrsKind(file);
            const hay = `${file.title || ''} ${file.teacher || ''} ${file.ext || ''} ${lrsTypeLabel(kind)}`.toLowerCase();
            const show = (filter === 'all' || lrsCat(kind) === filter) && (!term || hay.includes(term));
            row.style.display = show ? '' : 'none';
            row.classList.toggle('lrs-mobile-row--first', show && here === 0);
            if (show) here++;
        });
        const any = here > 0;
        if (header) {
            header.style.display = any ? '' : 'none';
            const count = header.querySelector('.lrs-mobile-folder-count');
            if (count) count.textContent = String(here);
        }
        body.style.display = any ? '' : 'none';
        shown += here;
        if (any) teachers++;
    });

    const sub = document.getElementById('lrsMobileSub');
    if (sub) sub.innerHTML = lrsMobileSummary(shown, flat.length, filtering ? teachers : list.querySelectorAll('.lrs-mobile-folder-body').length, filtering);

    const empty = document.getElementById('lrsMobileSearchEmpty');
    if (empty) {
        const none = filtering && shown === 0;
        empty.style.display = none ? 'flex' : 'none';
        const label = document.getElementById('lrsMobileSearchEmptyText');
        const body = document.getElementById('lrsMobileSearchEmptyBody');
        if (none && label && body) {
            if (term) {
                label.textContent = `No matches for "${(document.getElementById('lrsMobileSearch')?.value || '').trim()}"`;
                body.textContent = filter === 'all' ? 'Try a different word or teacher.' : 'Try a different word, or another type.';
            } else {
                label.textContent = `No ${({ doc: 'documents', vid: 'videos', img: 'images' })[filter] || 'files'} yet`;
                body.textContent = 'Try another type.';
            }
        }
    }

    // Rows and groups coming and going change the scrollable height without a real scroll event.
    recheckMobileNavAfterToggle();
}

window.lrsMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('resources', { mobileSearch: val });
    window._lrsMobTerm = String(val || '').toLowerCase().trim();
    lrsMobileApply();
};

window.lrsMobileSetFilter = function(kind) {
    window._lrsMobFilter = ['doc', 'vid', 'img'].includes(kind) ? kind : 'all';
    if (window.learnerPageState) window.learnerPageState.update('resources', { mobileFilter: window._lrsMobFilter });
    document.querySelectorAll('.lrs-mobile-chip').forEach(chip => {
        const on = chip.dataset.filter === window._lrsMobFilter;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    lrsMobileApply();
};

// The video id is the only part of a video's address the page trusts: the player and the YouTube link are both built
// from it, never from the stored address itself.
function lrsYoutubeId(file) {
    const m = String(file.video_url || '').match(/embed\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
}

// One open file: what it is, the title, when it was uploaded, (for a video) the player, who it is from and how big it
// is, one main button and one quiet one, then more from the same teacher.
function lrsMobileDetailHtml(file, idx) {
    const flat = window._allLearnerResourcesFlat || [];
    const kind = lrsKind(file);
    const isVid = kind === 'vid';
    const ytId = isVid ? lrsYoutubeId(file) : '';
    const title = escapeResourceHtml(file.title || 'Untitled');
    const uploaded = file.uploaded_at || lrsShortDate(file);

    let player = '';
    let actions = '';
    if (isVid) {
        if (ytId) {
            player = `<div class="lrs-mobile-player"><iframe src="https://www.youtube.com/embed/${ytId}?rel=0&amp;modestbranding=1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="${title}"></iframe></div>`;
            actions = `<a class="lrs-mobile-btn lrs-mobile-btn--pri" href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener">Open in YouTube</a>`;
        } else {
            player = `<div class="lrs-mobile-detail-posted">This video's link isn't available.</div>`;
        }
    } else if (file.path) {
        actions = `<button type="button" class="lrs-mobile-btn lrs-mobile-btn--pri" onclick="lrsMobileOpenFile(${idx})">Open</button>` +
                  `<a class="lrs-mobile-btn" href="${escapeResourceHtml(file.path)}" download>Download</a>`;
    }

    const more = flat
        .map((f, i) => ({ f, i }))
        .filter(({ f, i }) => i !== idx && f.teacher === file.teacher)
        .slice(0, 3)
        .map(({ f, i }, n) => lrsMobileRowHtml(f, i, n === 0))
        .join('');

    return `
        <article class="lrs-mobile-detail">
            <div class="lrs-mobile-detail-top">
                <span class="lrs-mobile-detail-eyebrow">${escapeResourceHtml(lrsTypeLabel(kind))}</span>
            </div>
            <h1 class="lrs-mobile-detail-title">${title}</h1>
            ${uploaded ? `<div class="lrs-mobile-detail-posted">Uploaded ${escapeResourceHtml(uploaded)}</div>` : ''}
            ${player}
            <div class="lrs-mobile-detail-facts">
                <div class="lrs-mobile-detail-fact">
                    <div class="lrs-mobile-detail-fact-label">From</div>
                    <div class="lrs-mobile-detail-fact-value">${escapeResourceHtml(file.teacher || '')}</div>
                </div>
                <div class="lrs-mobile-detail-fact">
                    <div class="lrs-mobile-detail-fact-label">${isVid ? 'Source' : 'Size'}</div>
                    <div class="lrs-mobile-detail-fact-value">${isVid ? 'YouTube' : (escapeResourceHtml(lrsMobileSize(file.size)) || 'N/A')}</div>
                </div>
            </div>
            ${actions ? `<div class="lrs-mobile-detail-actions">${actions}</div>` : ''}
            ${more ? `<div class="lrs-mobile-detail-label">More from ${escapeResourceHtml(file.teacher || '')}</div><div class="lrs-mobile-more">${more}</div>` : ''}
        </article>`;
}

// "Open" on a file's screen: the same viewer the app uses everywhere (PDFs and pictures show inline, the rest offer a download)
window.lrsMobileOpenFile = function(idx) {
    const file = (window._allLearnerResourcesFlat || [])[idx];
    if (file && file.path && typeof window.viewDocument === 'function') window.viewDocument(file.path, file.title || '');
};

window.openMobileLearnerResource = function(idx) {
    if (window.innerWidth > 899) return;
    const file = (window._allLearnerResourcesFlat || [])[idx];
    const apiArea = document.getElementById('api-content-area');
    if (!file || !apiArea) return;

    // Keep where the list was scrolled, then stop the scroll listener from saving this screen's scroll over it.
    saveResourcePageState();
    window._lrsMobDetail = true;

    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');
    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');

    sessionStorage.setItem('lastLearnerPage', 'resource_list.php');
    if (window.configureHeader) {
        window.configureHeader({
            title: file.title || 'Resources', mode: 'detail', detailType: 'Resource', backLabel: 'Resources',
            backAction: () => window.fetchResources(),
        });
    }
    // detail mode hides the bottom nav; the phone detail screens keep it
    const nav = document.getElementById('mobileBottomNav');
    if (nav) nav.style.setProperty('display', 'flex', 'important');

    apiArea.innerHTML = lrsMobileDetailHtml(file, idx);
    if (mainContent) mainContent.scrollTop = 0;
};

// Opens a file's screen by its id (not used by the list itself)
window.openMobileLearnerResourceById = function(id) {
    const idx = (window._allLearnerResourcesFlat || []).findIndex(f => String(f.id) === String(id));
    if (idx >= 0) window.openMobileLearnerResource(idx);
};

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