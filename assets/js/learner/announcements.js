window.announcementCache          = null;
window.announcementPrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchAnnouncements = function () {
    if (window.announcementCache) return;
    if (window.announcementPrefetchPromise) return;
    window.announcementPrefetchPromise = fetch('api/learner/get_announcements.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.announcementCache = data; })
        .catch(() => {})
        .finally(() => { window.announcementPrefetchPromise = null; });
};

function showLearnerAnnouncementMobileBottomNav() {
    if (window.innerWidth > 899) return;

    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (mobileBottomNav) {
        mobileBottomNav.style.setProperty('display', 'flex', 'important');
    }
}

window.fetchAnnouncements = async function() {
    const navigation = window.beginLearnerViewNavigation?.('announcement_list.php');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "announcement_list.php");
    if (typeof window.setActive === 'function') window.setActive("announcement_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Announcements', mode: 'standard', color: '#f28c38' });
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
    if (window.announcementPrefetchPromise) {
        await window.announcementPrefetchPromise;
    }
    if (!isCurrentNavigation()) return;

    // 4b. CACHE CHECK (Instant Load)
    if (window.announcementCache) {
        renderAnnouncements(window.announcementCache);
        restoreAnnouncementPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_announcements.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        if (!isCurrentNavigation()) return;
        window.announcementCache = data;
        renderAnnouncements(data);
        restoreAnnouncementPageState();
    } catch (error) {
        if (!isCurrentNavigation()) return;
        console.error("Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p class='lan-error-state'>Error loading announcements.</p>";
        }
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveAnnouncementPageState() {
    const sidebar = document.querySelector('.lan-sidebar-scroll');
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('lan-main-panel');
    const selected = (window._allLearnerAnnouncementsFlat || [])[window._learnerAnnouncementSelectedIdx];
    const state = {
        // School and teacher announcements can come from separate sources,
        // so keep the source with the id to avoid an accidental collision.
        selectedKey:   selected ? `${selected._type || 'teacher'}:${selected.id}` : null,
        selectedId:    selected ? String(selected.id) : null,
        selectedIdx:   window._learnerAnnouncementSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   (document.querySelector('.lan-body') || {}).scrollTop || 0,
        mobileSearch: document.getElementById('lanMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lan-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        openDesktopGroups: Array.from(document.querySelectorAll('.lan-desktop-teacher-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('announcements', state);
    else sessionStorage.setItem('announcementPageState', JSON.stringify(state));
}

// Wires a passive scroll listener onto .main-content so mobile scroll
// position saves as the learner scrolls, mirroring wireManualScrollState()
// in manual.js. Guarded so it's only wired once per page load.
function wireAnnouncementScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.lan-sidebar-scroll');
    const panel = document.querySelector('.lan-body');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.lanScrollWired === '1') return;
        el.dataset.lanScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('announcements', saveAnnouncementPageState), { passive: true });
    });
}

function restoreAnnouncementPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('announcements')
            : JSON.parse(sessionStorage.getItem('announcementPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            window.lanEnsureSelection();
            wireAnnouncementScrollState();
            return;
        }
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lanMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lanMobileSearch(state.mobileSearch);
                }
            }
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lan-mobile-folder-body').forEach(body => {
                    const open = state.openFolders.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const header = body.previousElementSibling;
                    if (header) header.classList.toggle('lan-mobile-folder-header--collapsed', !open);
                    const chev = header?.querySelector('.lan-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (Array.isArray(state.openDesktopGroups)) {
                document.querySelectorAll('.lan-desktop-teacher-body').forEach(body => {
                    const open = state.openDesktopGroups.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const header = body.previousElementSibling;
                    const chevron = header ? header.querySelector('.lan-desktop-teacher-chevron') : null;
                    if (chevron) chevron.classList.toggle('open', open);
                });
            }
            const selectedIdx = state.selectedKey
                ? (window._allLearnerAnnouncementsFlat || []).findIndex(ann => `${ann._type || 'teacher'}:${ann.id}` === state.selectedKey)
                : state.selectedId
                    ? (window._allLearnerAnnouncementsFlat || []).findIndex(ann => String(ann.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerAnnouncement(selectedIdx);
            }
            const sidebar = document.querySelector('.lan-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panelBody = document.querySelector('.lan-body');
            if (panelBody && Number.isFinite(state.panelScroll)) panelBody.scrollTop = state.panelScroll;
            window.lanEnsureSelection();
            wireAnnouncementScrollState();
            saveAnnouncementPageState();
        });
    } catch (e) { /* ignore bad state */ }
}

function parseLearnerAnnouncementTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLearnerAnnouncementTime(ann) {
    return parseLearnerAnnouncementTime(ann.created_at);
}

function getSortedLearnerAnnouncementEntries(teacherData) {
    return Object.entries(teacherData || {})
        .map(([teacher, items], index) => {
            const sortedItems = Array.isArray(items)
                ? [...items].sort((a, b) => getLearnerAnnouncementTime(b) - getLearnerAnnouncementTime(a))
                : [];
            const latestTime = sortedItems.reduce((latest, ann) => Math.max(latest, getLearnerAnnouncementTime(ann)), 0);
            return { teacher, items: sortedItems, latestTime, index };
        })
        .sort((a, b) => (b.latestTime - a.latestTime) || (a.index - b.index));
}

function renderAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // data shape expected:
    // {
    //   school_wide: [ { id, title, message, created_at, display_date, sender } ],
    //   teacher:     { "Teacher Name": [ { id, title, message, created_at, display_date } ], ... }
    // }

    const schoolWide  = data.school_wide  || [];
    const teacherData = data.teacher      || {};
    const teacherEntries = getSortedLearnerAnnouncementEntries(teacherData);

    const hasSchoolWide  = schoolWide.length > 0;
    const hasTeacher     = teacherEntries.length > 0;

    if (!hasSchoolWide && !hasTeacher) {
        apiArea.innerHTML = `
            <!-- ═══ DESKTOP EMPTY ═══ -->
            <div class="lan-desktop-layout lqz-flat-layout" id="lan-desktop-layout">
                <div class="lan-sidebar">
                    <div class="lan-lh">
                        <div class="lan-desktop-search-wrap">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input type="text" class="lan-desktop-search" id="lanDesktopSearch" placeholder="Filter announcements" disabled>
                        </div>
                    </div>
                    <div class="lan-sidebar-scroll" id="lan-list"></div>
                </div>
                <div class="lan-split" aria-hidden="true"></div>
                <div class="lan-main-panel lqz-flat-panel" id="lan-main-panel">
                    <div class="lan-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                        <p>Your teachers haven't posted any announcements yet.</p>
                    </div>
                </div>
            </div>

            <!-- ═══ MOBILE EMPTY ═══ -->
            <div class="lan-mobile-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="lan-mobile-search" id="lanMobileSearch"
                    placeholder="Search announcements..." oninput="lanMobileSearch(this.value)">
            </div>
            <div class="lan-mobile-list">
                <div class="lan-mobile-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#f28c38" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p class="lan-mobile-empty-title">No announcements yet</p>
                    <p class="lan-mobile-empty-body">Your teachers haven't posted any announcements. Check back soon.</p>
                </div>
            </div>`;
        return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ── Build flat list (school-wide FIRST, then teacher) ──
    window._allLearnerAnnouncementsFlat = [];

    schoolWide.forEach(ann => {
        window._allLearnerAnnouncementsFlat.push({ ...ann, _type: 'school', teacher: ann.sender || 'School Admin', initials: ann.sender_initials || null });
    });

    for (const { teacher, items } of teacherEntries) {
        items.forEach(ann => {
            window._allLearnerAnnouncementsFlat.push({ ...ann, _type: 'teacher', teacher, initials: ann.teacher_initials || null });
        });
    }

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/announcements.css
    // — the ~440-line inline <style> block that used to be injected here was
    // removed as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lan-desktop-layout lqz-flat-layout" id="lan-desktop-layout">
            <div class="lan-sidebar">
                <div class="lan-lh">
                    <div class="lan-lh-row">
                        <div class="lan-desktop-search-wrap">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input type="text" class="lan-desktop-search" id="lanDesktopSearch"
                                placeholder="Filter announcements" oninput="lanDesktopSearch(this.value)">
                        </div>
                        <button type="button" class="lan-markall" id="lan-markall" title="Mark all as read" aria-label="Mark all as read" onclick="lanMarkAllRead()">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                        </button>
                    </div>
                    <div class="lan-chips" id="lan-chips"></div>
                </div>
                <div class="lan-sidebar-scroll" id="lan-list" tabindex="0" onkeydown="lanListKeydown(event)"></div>
            </div>
            <div class="lan-split" id="lan-split" role="separator" aria-orientation="vertical" aria-label="Resize announcement list" tabindex="0"></div>
            <div class="lan-main-panel lqz-flat-panel" id="lan-main-panel">
                <div class="lan-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p>Select an announcement from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    html += `
        <div class="lan-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lan-mobile-search" id="lanMobileSearch"
                placeholder="Search announcements..." oninput="lanMobileSearch(this.value)">
        </div>`;

    html += `<div class="lan-mobile-list">`;

    let mobileFlatIdx = 0;

    // Mobile — School-wide section
    if (hasSchoolWide) {
        const swGid = 'lan-mg-school';
        html += `
            <div class="lan-mobile-folder-header lan-mobile-folder-header--collapsed" onclick="toggleLanMobileFolder('${swGid}', this)">
                <div class="lan-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lan-mobile-folder-name">School-wide</span>
                <span class="lan-mobile-folder-count">${schoolWide.length} announcement${schoolWide.length !== 1 ? 's' : ''}</span>
                <svg class="lan-mobile-folder-chevron lan-icon-crisp" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="lan-mobile-folder-body collapsed" id="${swGid}">`;

        schoolWide.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            html += `
                <div class="lan-mobile-card lan-mobile-card--school" role="button" tabindex="0"
                    data-title="${escapeLearnerAnnouncementHtml(ann.title||''). toLowerCase()}"
                    onclick="openMobileLearnerAnnouncement(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAnnouncement(${mobileFlatIdx}); }">
                    <div class="lan-mobile-card-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
                            <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
                            <path d="M8 6v8"/>
                        </svg>
                    </div>
                    <div class="lan-mobile-card-body">
                        <div class="lan-mobile-card-title">
                            <span class="lan-mobile-card-title-text">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</span>
                            ${ann.is_edited ? '<span class="lan-edited-tag">Edited</span>' : ''}
                        </div>
                        <div class="lan-mobile-card-date">${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                    </div>
                    <div class="lan-mobile-card-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
            mobileFlatIdx++;
        });
        html += `</div>`; // close school folder body
    }

    // Mobile — Teacher section
    if (hasTeacher) {
        let teacherGroupIdx = 0;
        for (const { teacher, items } of teacherEntries) {
            const tGid = `lan-mg-teacher-${teacherGroupIdx}`;
            html += `
                <div class="lan-mobile-folder-header lan-mobile-folder-header--collapsed" onclick="toggleLanMobileFolder('${tGid}', this)">
                    <div class="lan-mobile-folder-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <span class="lan-mobile-folder-name">${escapeLearnerAnnouncementHtml(teacher)}</span>
                    <span class="lan-mobile-folder-count">${items.length} announcement${items.length !== 1 ? 's' : ''}</span>
                    <svg class="lan-mobile-folder-chevron lan-icon-crisp" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
                <div class="lan-mobile-folder-body collapsed" id="${tGid}">`;
            teacherGroupIdx++;
            items.forEach(ann => {
                const isNew = new Date(ann.created_at) > sevenDaysAgo;
                html += `
                    <div class="lan-mobile-card" role="button" tabindex="0"
                        data-title="${escapeLearnerAnnouncementHtml(ann.title||''). toLowerCase()}"
                        onclick="openMobileLearnerAnnouncement(${mobileFlatIdx})"
                        onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAnnouncement(${mobileFlatIdx}); }">
                        <div class="lan-mobile-card-icon">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
                                <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
                                <path d="M8 6v8"/>
                            </svg>
                        </div>
                        <div class="lan-mobile-card-body">
                            <div class="lan-mobile-card-title">
                                <span class="lan-mobile-card-title-text">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</span>
                                ${ann.is_edited ? '<span class="lan-edited-tag">Edited</span>' : ''}
                            </div>
                            <div class="lan-mobile-card-date">${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                        </div>
                        <div class="lan-mobile-card-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
                mobileFlatIdx++;
            });
            html += `</div>`; // close teacher folder body
        }
    }

    html += `</div>`; // close .lan-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
    window.lanInitDesktop();
}

window.lanMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('announcements', { mobileSearch: val });
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lan-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const folderName = header ? header.querySelector('.lan-mobile-folder-name').textContent.toLowerCase() : '';
        const cards = body.querySelectorAll('.lan-mobile-card');
        let visible = 0;
        cards.forEach(card => {
            const title = (card.dataset.title || '');
            const show = !term || title.includes(term) || folderName.includes(term);
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (header) header.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        body.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        if (term && visible) {
            body.classList.remove('collapsed');
            if (header) header.classList.remove('lan-mobile-folder-header--collapsed');
            const chev = header ? header.querySelector('.lan-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });
};

// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a folder is expanded/collapsed — same fix as in
// assignments.js. A single delayed check would need to know the exact
// CSS transition duration used for the collapse/expand animation
// (unknown from here, and could change) — polling a few times over
// ~400ms means it settles on the right answer regardless of how long
// that transition actually takes.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

window.toggleLanMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lan-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    headerEl.classList.toggle('lan-mobile-folder-header--collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveAnnouncementPageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
};

function escapeLearnerAnnouncementHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function formatLearnerAnnouncementMessage(message) {
    return escapeLearnerAnnouncementHtml(message).replace(/\n/g, '<br>');
}

// For edited announcements, the backend sends `message_html`: the current
// message already escaped and rendered to HTML server-side, with the
// changed/new words wrapped in a highlight span. That HTML is trusted
// (built server-side from an escaped string, not user input at this layer)
// and must NOT be re-escaped here, or the <span> tags would show up as
// literal text. Unedited announcements have no message_html and fall back
// to the normal escape-and-linebreak path.
function renderLearnerAnnouncementBody(ann) {
    if (ann && ann.is_edited && ann.message_html) {
        return ann.message_html;
    }
    return formatLearnerAnnouncementMessage(ann ? ann.message : '');
}

function getLearnerAnnouncementInitials(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

window.openMobileLearnerAnnouncement = function(flatIdx) {
    if (window.innerWidth > 899) return;

    const ann = (window._allLearnerAnnouncementsFlat || [])[flatIdx];
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');

    if (!ann || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');
    if (mainContent) mainContent.scrollTop = 0;

    sessionStorage.setItem("lastLearnerPage", "announcement_list.php");
    if (window.configureHeader) {
        window.configureHeader({ title: ann.title || 'Announcement', mode: 'detail', detailType: 'Announcement' });
    }
    showLearnerAnnouncementMobileBottomNav();

    const isSchool = ann._type === 'school';
    const sender = ann.teacher || ann.sender || (isSchool ? 'School Admin' : 'Teacher');
    const roleLabel = isSchool ? 'School Admin' : 'Teacher';
    const initials = ann.initials || getLearnerAnnouncementInitials(sender);

    apiArea.innerHTML = `
        <article class="lan-mobile-detail">
            <div class="lan-mobile-detail-author-row">
                <div class="lan-mobile-detail-avatar">${escapeLearnerAnnouncementHtml(initials)}</div>
                <div class="lan-mobile-detail-author-info">
                    <div class="lan-mobile-detail-author-name">${escapeLearnerAnnouncementHtml(sender)}</div>
                    <div class="lan-mobile-detail-author-role">
                        <span>Author</span><span class="lan-mobile-detail-role-sep">|</span><span class="lan-mobile-detail-role-badge">${escapeLearnerAnnouncementHtml(roleLabel)}</span>
                    </div>
                    <div class="lan-mobile-detail-posted">Posted ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                </div>
            </div>
            <h1 class="lan-mobile-detail-title learner-mobile-detail-title">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}${ann.is_edited ? '<span class="lan-edited-tag">Edited</span>' : ''}</h1>
            ${ann.is_edited ? `<div class="lan-edited-meta">Edited ${escapeLearnerAnnouncementHtml(ann.edited_date || '')}</div>` : ''}
            <div class="lan-mobile-detail-message">${renderLearnerAnnouncementBody(ann)}</div>
        </article>`;

    if (mainContent) mainContent.scrollTop = 0;
};

window.openMobileLearnerAnnouncementById = function(announcementId, scope = '') {
    const targetId = String(announcementId || '');
    const flatIdx = (window._allLearnerAnnouncementsFlat || []).findIndex(ann =>
        String(ann.id) === targetId && (!scope || (ann._type || 'teacher') === scope)
    );
    if (flatIdx >= 0) {
        window.openMobileLearnerAnnouncement(flatIdx);
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DESKTOP LIST: time groups, filter chips, unread state
// ─────────────────────────────────────────────
window._lanFilter = 'all';
window._lanTerm = '';
window._lanRead = null;
window._lanReadTimer = null;

function lanKey(ann) { return `${ann._type || 'teacher'}:${ann.id}`; }
function lanReadStoreKey() { return 'lan.read.' + (window.learnerQueueUser || ''); }

// Read state lives in this browser. First visit: anything older than 7 days
// counts as read (the same window the old NEW badge used).
function lanLoadRead() {
    const items = window._allLearnerAnnouncementsFlat || [];
    try {
        const stored = JSON.parse(localStorage.getItem(lanReadStoreKey()));
        if (Array.isArray(stored)) { window._lanRead = new Set(stored); return; }
    } catch (e) {}
    const cutoff = Date.now() - 7 * 86400000;
    window._lanRead = new Set(items.filter(a => getLearnerAnnouncementTime(a) < cutoff).map(lanKey));
    lanSaveRead();
}
function lanSaveRead() {
    try { localStorage.setItem(lanReadStoreKey(), JSON.stringify(Array.from(window._lanRead))); } catch (e) {}
}

function lanDaysAgo(ann) {
    const t = getLearnerAnnouncementTime(ann);
    if (!t) return 999;
    const a = new Date(); a.setHours(0, 0, 0, 0);
    const b = new Date(t); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
}
function lanGroupOf(ann) {
    const d = lanDaysAgo(ann);
    return d <= 0 ? 'Today' : d <= 7 ? 'This week' : 'Earlier';
}
function lanRowTime(ann) {
    const t = getLearnerAnnouncementTime(ann);
    if (!t) return '';
    const d = new Date(t), days = lanDaysAgo(ann);
    if (days <= 0) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (days === 1) return 'Yesterday';
    if (days < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' });
}
function lanPlain(ann) { return String(ann.message || '').replace(/\s+/g, ' ').trim(); }
function lanUnreadCount() {
    return (window._allLearnerAnnouncementsFlat || []).filter(a => !window._lanRead.has(lanKey(a))).length;
}

window.lanRenderDesktopList = function () {
    const list = document.getElementById('lan-list');
    if (!list || !window._lanRead) return;
    const keepScroll = list.scrollTop;
    const term = window._lanTerm;
    const read = window._lanRead;
    const items = (window._allLearnerAnnouncementsFlat || []).map((ann, idx) => ({ ann, idx }));
    const showActive = !!document.querySelector('#lan-main-panel .lan-dh');

    const counts = { all: items.length, unread: 0, school: 0, teacher: 0 };
    items.forEach(({ ann }) => {
        if (!read.has(lanKey(ann))) counts.unread++;
        if (ann._type === 'school') counts.school++; else counts.teacher++;
    });
    const chipsEl = document.getElementById('lan-chips');
    if (chipsEl) {
        chipsEl.innerHTML = [['all', 'All'], ['unread', 'Unread'], ['school', 'School-wide'], ['teacher', 'Teachers']]
            .map(([k, label]) => `<button type="button" class="lan-chip${window._lanFilter === k ? ' on' : ''}" onclick="lanSetFilter('${k}')">${label} ${counts[k]}</button>`)
            .join('');
    }
    const markAll = document.getElementById('lan-markall');
    if (markAll) markAll.disabled = counts.unread === 0;

    const visible = items.filter(({ ann }) => {
        const f = window._lanFilter;
        const ok = f === 'all' || (f === 'unread' && !read.has(lanKey(ann))) ||
            (f === 'school' && ann._type === 'school') || (f === 'teacher' && ann._type !== 'school');
        return ok && (!term || `${ann.title || ''} ${ann.teacher || ''} ${ann.message || ''}`.toLowerCase().includes(term));
    });

    let html = '';
    ['Today', 'This week', 'Earlier'].forEach(group => {
        const rows = visible.filter(({ ann }) => lanGroupOf(ann) === group)
            .sort((a, b) => getLearnerAnnouncementTime(b.ann) - getLearnerAnnouncementTime(a.ann));
        if (!rows.length) return;
        html += `<div class="lan-gh">${group}</div>`;
        rows.forEach(({ ann, idx }) => {
            const isSchool = ann._type === 'school';
            const sender = ann.teacher || ann.sender || (isSchool ? 'School Admin' : 'Teacher');
            const initials = ann.initials || getLearnerAnnouncementInitials(sender);
            const unread = !read.has(lanKey(ann));
            const active = showActive && idx === window._learnerAnnouncementSelectedIdx ? ' active' : '';
            html += `
                <div class="lan-sidebar-item lan-row${active}" id="lan-sidebar-${idx}" onclick="selectDesktopLearnerAnnouncement(${idx})">
                    <span class="lan-ava${isSchool ? ' lan-ava--school' : ''}">${escapeLearnerAnnouncementHtml(initials)}</span>
                    <div class="lan-sidebar-item-info">
                        <div class="lan-sidebar-item-title${unread ? ' lan-unread' : ''}">${escapeLearnerAnnouncementHtml(ann.title || '')}</div>
                        <div class="lan-sidebar-item-meta">${escapeLearnerAnnouncementHtml(sender)} &middot; ${escapeLearnerAnnouncementHtml(lanPlain(ann).slice(0, 140))}</div>
                    </div>
                    <span class="lan-rr"><span class="lan-tm">${escapeLearnerAnnouncementHtml(lanRowTime(ann))}</span>${unread ? '<span class="lan-udot"></span>' : ''}</span>
                </div>`;
        });
    });
    list.innerHTML = html || `<div class="lan-list-empty">${items.length ? 'No announcements match.' : "Your teachers haven't posted any announcements yet."}</div>`;
    list.scrollTop = keepScroll;
};

window.lanSetFilter = function (key) { window._lanFilter = key; window.lanRenderDesktopList(); };
window.lanDesktopSearch = function (val) {
    window._lanTerm = String(val || '').toLowerCase().trim();
    window.lanRenderDesktopList();
};

function lanSelected() { return (window._allLearnerAnnouncementsFlat || [])[window._learnerAnnouncementSelectedIdx]; }

function lanRefreshReadBtn() {
    const btn = document.getElementById('lan-readbtn');
    const ann = lanSelected();
    if (btn && ann) btn.textContent = window._lanRead.has(lanKey(ann)) ? 'Mark as unread' : 'Mark as read';
}

// Opening an announcement marks it read after a short pause
window.lanScheduleRead = function (ann) {
    clearTimeout(window._lanReadTimer);
    const key = lanKey(ann);
    if (window._lanRead.has(key)) return;
    window._lanReadTimer = setTimeout(() => {
        const cur = lanSelected();
        if (!cur || lanKey(cur) !== key) return;
        window._lanRead.add(key);
        lanSaveRead();
        window.lanRenderDesktopList();
        lanRefreshReadBtn();
    }, 900);
};

window.lanToggleRead = function () {
    const ann = lanSelected();
    if (!ann) return;
    clearTimeout(window._lanReadTimer);
    const key = lanKey(ann);
    if (window._lanRead.has(key)) window._lanRead.delete(key); else window._lanRead.add(key);
    lanSaveRead();
    window.lanRenderDesktopList();
    lanRefreshReadBtn();
};

window.lanMarkAllRead = function () {
    clearTimeout(window._lanReadTimer);
    (window._allLearnerAnnouncementsFlat || []).forEach(a => window._lanRead.add(lanKey(a)));
    lanSaveRead();
    window.lanRenderDesktopList();
    lanRefreshReadBtn();
};

// ↑ / ↓ move through the list
window.lanListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const ids = Array.from(document.querySelectorAll('#lan-list .lan-sidebar-item'))
        .map(el => parseInt(el.id.replace('lan-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._learnerAnnouncementSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopLearnerAnnouncement(ids[next]);
    const el = document.getElementById(`lan-sidebar-${ids[next]}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
};

// Desktop never shows an empty detail pane when there's something to show
window.lanEnsureSelection = function () {
    if (window.innerWidth < 900) return;
    if (document.querySelector('#lan-list .lan-sidebar-item.active')) return;
    const first = document.querySelector('#lan-list .lan-sidebar-item');
    if (first) window.selectDesktopLearnerAnnouncement(parseInt(first.id.replace('lan-sidebar-', ''), 10));
};

// Drag (or ← / →) to resize the list; width is remembered and shared with Quiz and Assignments
window.lanInitSplit = function () {
    const layout = document.getElementById('lan-desktop-layout');
    const split = document.getElementById('lan-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--lan-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--lan-listw'), 10) || 320;
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

window.lanInitDesktop = function () {
    clearTimeout(window._lanReadTimer);
    window._lanFilter = 'all';
    window._lanTerm = '';
    lanLoadRead();
    window.lanRenderDesktopList();
    window.lanInitSplit();
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
window.selectDesktopLearnerAnnouncement = function(flatIdx) {
    const flat = window._allLearnerAnnouncementsFlat || [];
    const ann = flat[flatIdx];
    if (!ann) return;
    window._learnerAnnouncementSelectedIdx = flatIdx;
    saveAnnouncementPageState();
    document.querySelectorAll('.lan-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lan-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const panel = document.getElementById('lan-main-panel');
    if (!panel) return;

    const isSchool = ann._type === 'school';
    const sender = ann.teacher || ann.sender || (isSchool ? 'School Admin' : 'Teacher');
    const roleLabel = isSchool ? 'School Admin' : 'Teacher';
    const initials = ann.initials || getLearnerAnnouncementInitials(sender);
    const isRead = window._lanRead ? window._lanRead.has(lanKey(ann)) : true;

    const chips =
        (isSchool ? '<span class="lan-panel-status" style="background:rgba(210,149,34,0.12);border-color:rgba(210,149,34,0.35);color:#d29522;">School-wide</span>' : '') +
        (ann.is_edited ? '<span class="lan-panel-status">Edited</span>' : '');

    // More from the same sender (most recent first)
    const more = flat
        .map((a, i) => ({ a, i }))
        .filter(({ a, i }) => i !== flatIdx && a._type === ann._type && (a.teacher || a.sender) === (ann.teacher || ann.sender))
        .sort((x, y) => getLearnerAnnouncementTime(y.a) - getLearnerAnnouncementTime(x.a))
        .slice(0, 3)
        .map(({ a, i }) => `
            <button type="button" class="lan-more" onclick="selectDesktopLearnerAnnouncement(${i})">
                <b>${escapeLearnerAnnouncementHtml(a.title || '')}</b>
                <small>${escapeLearnerAnnouncementHtml(a.display_date || '')}</small>
            </button>`)
        .join('');

    panel.innerHTML = `
        <div class="lan-dh">
            <h2 class="lan-dh-title">${escapeLearnerAnnouncementHtml(ann.title || '')}</h2>
            ${chips}
            <span class="lan-dsp"></span>
            <button type="button" class="lan-btn2" id="lan-readbtn" onclick="lanToggleRead()">${isRead ? 'Mark as unread' : 'Mark as read'}</button>
        </div>
        <div class="lan-dbody">
            <div class="lan-body">
                <div class="lan-read">
                    <div class="lan-auth">
                        <span class="lan-ava lan-ava--lg${isSchool ? ' lan-ava--school' : ''}">${escapeLearnerAnnouncementHtml(initials)}</span>
                        <div>
                            <b>${escapeLearnerAnnouncementHtml(sender)}</b>
                            <small>${escapeLearnerAnnouncementHtml(roleLabel)} &middot; Posted ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</small>
                        </div>
                    </div>
                    ${ann.is_edited ? `<div class="lan-edn">Edited ${escapeLearnerAnnouncementHtml(ann.edited_date || '')}. Changes are highlighted.</div>` : ''}
                    <div class="lan-msg">${renderLearnerAnnouncementBody(ann)}</div>
                </div>
            </div>
            <aside class="lan-rail">
                <h4>Details</h4>
                <div class="lan-kv"><span>From</span><b>${escapeLearnerAnnouncementHtml(sender)}</b></div>
                <div class="lan-kv"><span>Role</span><b>${escapeLearnerAnnouncementHtml(roleLabel)}</b></div>
                <div class="lan-kv"><span>Audience</span><b>${isSchool ? 'Whole school' : 'Your class'}</b></div>
                <div class="lan-kv"><span>Posted</span><b>${escapeLearnerAnnouncementHtml(ann.display_date || '')}</b></div>
                ${ann.is_edited ? `<div class="lan-kv"><span>Edited</span><b>${escapeLearnerAnnouncementHtml(ann.edited_date || '')}</b></div>` : ''}
                ${more ? `<h4 class="lan-rail-sub">More from ${escapeLearnerAnnouncementHtml(sender)}</h4>${more}` : ''}
            </aside>
        </div>`;

    // Keep the selected row visible inside the list (scrolls the list only)
    const listBox = document.getElementById('lan-list');
    if (listBox && sidebarItem) {
        const top = sidebarItem.offsetTop, bottom = top + sidebarItem.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }
    if (window._lanRead) window.lanScheduleRead(ann);
    if (window.learnerPageState) wireAnnouncementScrollState();
};