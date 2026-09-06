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
        panelScroll:   panel ? panel.scrollTop : 0,
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
    const panel = document.getElementById('lan-main-panel');
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
            const panel = document.getElementById('lan-main-panel');
            if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
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
            <div class="lan-desktop-layout lqz-flat-layout">
                <div class="lan-sidebar lqz-flat-sidebar">
                    <div class="lan-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lan-desktop-search" id="lanDesktopSearch"
                            placeholder="Search announcements..." oninput="lanDesktopSearch(this.value)">
                    </div>
                    <div class="lan-sidebar-scroll"></div>
                </div>
                <div class="lan-main-panel lqz-flat-panel" id="lan-main-panel">
                    <div class="lan-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#f28c38" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
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

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;

    // School-wide section
    if (hasSchoolWide) {
        sidebarHtml += `
            <div class="lan-desktop-teacher-group">
                <button type="button" class="lan-desktop-teacher-header lan-desktop-teacher-header--school" onclick="toggleLanDesktopGroup('lan-dg-school', this)">
                    <svg class="lan-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="lan-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="lan-desktop-teacher-name">School-wide</span>
                    <span class="lan-desktop-teacher-count">${schoolWide.length}</span>
                </button>
                <div class="lan-desktop-teacher-body collapsed" id="lan-dg-school">`;

        schoolWide.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            sidebarHtml += `
                <div class="lan-sidebar-item lan-sidebar-item--school" id="lan-sidebar-${flatIdx}"
                    data-title="${escapeLearnerAnnouncementHtml(ann.title || '').toLowerCase()}"
                    onclick="selectDesktopLearnerAnnouncement(${flatIdx})">
                    <div class="lan-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                    </div>
                    <div class="lan-sidebar-item-info">
                        <div class="lan-sidebar-item-title">${ann.title}</div>
                        <div class="lan-sidebar-item-meta">${ann.display_date}</div>
                    </div>
                    ${isNew ? '<span class="lan-sidebar-new-badge">NEW</span>' : ''}
                </div>`;
            flatIdx++;
        });
        sidebarHtml += `</div></div>`;
    }

    // Teacher section
    if (hasTeacher) {
        let desktopGroupIdx = 0;
        for (const { teacher, items } of teacherEntries) {
            const groupId = `lan-dg-teacher-${desktopGroupIdx++}`;
            sidebarHtml += `
                <div class="lan-desktop-teacher-group">
                    <button type="button" class="lan-desktop-teacher-header" onclick="toggleLanDesktopGroup('${groupId}', this)">
                        <svg class="lan-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <svg class="lan-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="lan-desktop-teacher-name">${escapeLearnerAnnouncementHtml(teacher)}</span>
                        <span class="lan-desktop-teacher-count">${items.length}</span>
                    </button>
                    <div class="lan-desktop-teacher-body collapsed" id="${groupId}">`;
            items.forEach(ann => {
                const isNew = new Date(ann.created_at) > sevenDaysAgo;
                sidebarHtml += `
                    <div class="lan-sidebar-item" id="lan-sidebar-${flatIdx}"
                        data-title="${escapeLearnerAnnouncementHtml(ann.title || '').toLowerCase()}"
                        onclick="selectDesktopLearnerAnnouncement(${flatIdx})">
                        <div class="lan-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <div class="lan-sidebar-item-info">
                            <div class="lan-sidebar-item-title">${ann.title}</div>
                            <div class="lan-sidebar-item-meta">${ann.display_date}</div>
                        </div>
                        ${isNew ? '<span class="lan-sidebar-new-badge">NEW</span>' : ''}
                    </div>`;
                flatIdx++;
            });
            sidebarHtml += `</div></div>`;
        }
    }

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/announcements.css
    // — the ~440-line inline <style> block that used to be injected here was
    // removed as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lan-desktop-layout lqz-flat-layout">
            <div class="lan-sidebar lqz-flat-sidebar">
                <div class="lan-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lan-desktop-search" id="lanDesktopSearch"
                        placeholder="Search announcements..." oninput="lanDesktopSearch(this.value)">
                </div>
                <div class="lan-sidebar-scroll">${sidebarHtml}</div>
            </div>
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
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                            <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
                            <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
                            <path d="M8 6v8"/>
                        </svg>
                    </div>
                    <div class="lan-mobile-card-body">
                        <div class="lan-mobile-card-title">
                            <span class="lan-mobile-card-title-text">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</span>
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
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
                                <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
                                <path d="M8 6v8"/>
                            </svg>
                        </div>
                        <div class="lan-mobile-card-body">
                            <div class="lan-mobile-card-title">
                                <span class="lan-mobile-card-title-text">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</span>
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

window.lanDesktopSearch = function(val) {
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lan-desktop-teacher-group').forEach(group => {
        const header = group.querySelector('.lan-desktop-teacher-header');
        const body   = group.querySelector('.lan-desktop-teacher-body');
        const nameEl = group.querySelector('.lan-desktop-teacher-name');
        const groupName = nameEl ? nameEl.textContent.toLowerCase() : '';
        if (!header || !body) return;

        const items = body.querySelectorAll('.lan-sidebar-item');
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
            const chev = header.querySelector('.lan-desktop-teacher-chevron');
            if (chev) chev.classList.add('open');
        } else if (!term) {
            body.classList.add('collapsed');
            const chev = header.querySelector('.lan-desktop-teacher-chevron');
            if (chev) chev.classList.remove('open');
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

window.toggleLanDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lan-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveAnnouncementPageState();

    // Desktop doesn't have this dynamic bottom-nav/header behaviour, so
    // window.recalcMobileScrollUI won't exist there —
    // recheckMobileNavAfterToggle() already no-ops safely when it's missing.
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
            <h1 class="lan-mobile-detail-title learner-mobile-detail-title">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</h1>
            <div class="lan-mobile-detail-message">${formatLearnerAnnouncementMessage(ann.message)}</div>
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
window.selectDesktopLearnerAnnouncement = function(flatIdx) {
    window._learnerAnnouncementSelectedIdx = flatIdx;
    saveAnnouncementPageState();
    document.querySelectorAll('.lan-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lan-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const ann = (window._allLearnerAnnouncementsFlat || [])[flatIdx];
    if (!ann) return;

    const panel = document.getElementById('lan-main-panel');
    if (!panel) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isNew = new Date(ann.created_at) > sevenDaysAgo;

    const isSchool = ann._type === 'school';
    const sender = ann.teacher || ann.sender || (isSchool ? 'School Admin' : 'Teacher');
    const roleLabel = isSchool ? 'School Admin' : 'Teacher';
    const initials = ann.initials || getLearnerAnnouncementInitials(sender);

    panel.innerHTML = `
        <div class="lan-panel-content">
            <div class="lan-panel-header">
                <div class="lan-panel-header-main">
                    ${isSchool ? `
                        <div class="lan-school-wide-badge">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            School-wide
                        </div>` : ''}
                    <div class="lan-panel-author-row">
                        <div class="lan-panel-avatar ${isSchool ? 'lan-panel-avatar--school' : ''}">${escapeLearnerAnnouncementHtml(initials)}</div>
                        <div class="lan-panel-author-info">
                            <div class="lan-panel-author-name">${escapeLearnerAnnouncementHtml(sender)}</div>
                            <div class="lan-panel-author-role">
                                <span>Author</span><span class="lan-panel-role-sep">|</span><span class="lan-panel-role-badge ${isSchool ? 'lan-panel-role-badge--school' : ''}">${escapeLearnerAnnouncementHtml(roleLabel)}</span>
                            </div>
                            <div class="lan-panel-posted">Posted ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                        </div>
                    </div>
                    <div class="lan-panel-title">${ann.title}</div>
                </div>
                ${isNew ? '<span class="lan-panel-new-badge">NEW</span>' : ''}
            </div>
            <div class="lan-panel-message">
                ${ann.message.replace(/\n/g, '<br>')}
            </div>
        </div>`;
};
