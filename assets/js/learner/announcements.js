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

    // 4a. If prefetch is still in-flight, wait for it (no duplicate request)
    if (window.announcementPrefetchPromise) {
        if (loader) loader.style.display = 'flex';
        await window.announcementPrefetchPromise;
    }

    // 4b. CACHE CHECK (Instant Load)
    if (window.announcementCache) {
        renderAnnouncements(window.announcementCache);
        if (loader) loader.style.display = 'none';
        restoreAnnouncementPageState();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_announcements.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.announcementCache = data;
        renderAnnouncements(data);
        restoreAnnouncementPageState();
    } catch (error) {
        console.error("Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading announcements.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveAnnouncementPageState() {
    const sidebar = document.querySelector('.lan-sidebar-scroll');
    const state = {
        selectedIdx:   window._learnerAnnouncementSelectedIdx ?? null,
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mobileSearch: document.getElementById('lanMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lan-mobile-folder-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('announcements', state);
    else sessionStorage.setItem('announcementPageState', JSON.stringify(state));
}

function restoreAnnouncementPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('announcements')
            : JSON.parse(sessionStorage.getItem('announcementPageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
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
                    const chev = body.previousElementSibling?.querySelector('.lan-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
                window.selectDesktopLearnerAnnouncement(state.selectedIdx);
                const sidebar = document.querySelector('.lan-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            }
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
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No announcements found.</p>";
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
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
    let html = `
        <style>
            @media (min-width: 900px) {
                .lan-desktop-layout { display: flex !important; }
                .lan-mobile-list    { display: none !important; }
                .lan-mobile-search-wrap { display: none !important; }
            }
            @media (max-width: 899px) {
                .lan-desktop-layout { display: none !important; }
                .lan-mobile-list    { display: block !important; }
            }

            .lan-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lan-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lan-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lan-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lan-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lan-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lan-desktop-teacher-group { border-bottom: 1px solid rgba(255,255,255,0.04); }
            .lan-desktop-teacher-header {
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
            .lan-desktop-teacher-header:hover { background: rgba(255,255,255,0.03); color: #c9d1d9; }
            .lan-desktop-teacher-header--school { color: #d29522; }
            .lan-desktop-teacher-chevron { flex-shrink: 0; transition: transform 0.2s ease; }
            .lan-desktop-teacher-chevron.open { transform: rotate(90deg); }
            .lan-desktop-teacher-folder-icon { flex-shrink: 0; opacity: 0.85; }
            .lan-desktop-teacher-name {
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
            .lan-desktop-teacher-count {
                flex-shrink: 0;
                font-size: 10px;
                font-weight: 800;
                color: #f28c38;
                background: rgba(242,140,56,0.1);
                border: 1px solid rgba(242,140,56,0.25);
                border-radius: 999px;
                padding: 1px 7px;
            }
            .lan-desktop-teacher-body.collapsed { display: none; }

            .lan-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lan-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lan-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            /* School-wide active gets orange accent */
            .lan-sidebar-item--school.active {
                background: rgba(210,149,34,0.08);
                border-left-color: #d29522;
            }

            .lan-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .lan-sidebar-item-info { flex: 1; min-width: 0; }
            .lan-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lan-sidebar-item.active .lan-sidebar-item-title { color: #e2e8f0; }
            .lan-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .lan-sidebar-new-badge {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                border: 1px solid rgba(79,209,197,0.4);
                font-size: 9px;
                font-weight: 800;
                padding: 2px 5px;
                border-radius: 4px;
                flex-shrink: 0;
                letter-spacing: 0.5px;
            }

            .lan-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lan-main-panel::-webkit-scrollbar { width: 5px; }
            .lan-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lan-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lan-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lan-panel-empty svg { opacity: 0.3; }
            .lan-panel-empty p { font-size: 14px; margin: 0; }

            .lan-panel-content { padding: 28px 32px; }

            .lan-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }
            .lan-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #4fd1c5;
                margin: 0 0 8px;
            }
            .lan-panel-title--school { color: #d29522; }
            .lan-panel-meta { font-size: 13px; color: #8b949e; }

            /* School-wide badge in panel */
            .lan-school-wide-badge {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: rgba(210,149,34,0.1);
                color: #d29522;
                border: 1px solid rgba(210,149,34,0.35);
                font-size: 10px;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 5px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-bottom: 10px;
            }

            .lan-panel-message {
                font-size: 14px;
                color: #e2e8f0;
                line-height: 1.8;
            }

            /* ── MOBILE LIST STYLES (flat, no card wrapper) ── */
            .lan-mobile-list {
                background: transparent;
                border-radius: 0;
                overflow: visible;
                margin: 0 0 14px;
            }
            @media (max-width: 899px) {
                .lan-mobile-list {
                    margin-left: -18px;
                    margin-right: -18px;
                }
            }
            .lan-mobile-folder-header {
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
            .lan-mobile-folder-header:active { background: rgba(255,255,255,0.03); }
            .lan-mobile-folder-icon { flex-shrink: 0; }
            .lan-mobile-folder-name {
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
            .lan-mobile-folder-count {
                font-size: 12px;
                color: #8b949e;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                padding: 2px 8px;
                border-radius: 20px;
                flex-shrink: 0;
            }
            .lan-mobile-folder-chevron {
                flex-shrink: 0;
                color: #555e6a;
                transition: transform 0.3s ease;
            }
            .lan-mobile-folder-chevron.open { transform: rotate(90deg); }
            .lan-mobile-folder-body { display: block; }
            .lan-mobile-folder-body.collapsed { display: none; }
            .lan-mobile-card {
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
            .lan-mobile-card::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 18px;
                right: 18px;
                height: 1px;
                background: rgba(255,255,255,0.06);
            }
            .lan-mobile-card:last-child::after { display: none; }
            .lan-mobile-card--school {
                border-left: 0 !important;
            }
            .lan-mobile-card:active { background: rgba(255,255,255,0.03); }
            .lan-mobile-card-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: #f28c3818;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .lan-mobile-card--school .lan-mobile-card-icon {
                background: #f28c3818;
            }
            .lan-mobile-card-body { flex: 1; min-width: 0; }
            .lan-mobile-card-title {
                font-size: 15px;
                font-weight: 700;
                color: #e2e8f0;
                margin: 0;
                line-height: 1.3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lan-mobile-card-title-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .lan-mobile-status-dot {
                display: inline-block;
                width: 7px;
                height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .lan-mobile-card-chevron {
                flex-shrink: 0;
                color: #555e6a;
            }
            .lan-mobile-card-date {
                font-size: 11px;
                color: #555e6a;
                margin-top: 2px;
            }


            /* ── MOBILE SEARCH BAR ── */
            @media (max-width: 899px) {
                .lan-mobile-search-wrap {
                    display: block;
                    margin-bottom: 10px;
                    position: relative;
                }
                .lan-mobile-search-wrap svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    opacity: 0.4;
                }
                .lan-mobile-search {
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
                .lan-mobile-search:focus { outline: none; background: rgba(255,255,255,0.08); }
                .lan-mobile-search::placeholder { color: #555e6a; }
            }

            /* ── DESKTOP SEARCH BAR ── */
            .lan-desktop-search-wrap {
                display: none;
                position: relative;
                padding: 10px 10px 8px;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lan-desktop-search-wrap svg {
                position: absolute;
                left: 22px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                opacity: 0.4;
            }
            .lan-desktop-search {
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
            .lan-desktop-search:focus { outline: none; border-color: #f28c38; }
            .lan-desktop-search::placeholder { color: #555e6a; }
            @media (min-width: 900px) {
                .lan-desktop-search-wrap { display: block; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lan-desktop-layout">
            <div class="lan-sidebar">
                <div class="lan-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lan-desktop-search" id="lanDesktopSearch"
                        placeholder="Search announcements..." oninput="lanDesktopSearch(this.value)">
                </div>
                <div class="lan-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lan-main-panel" id="lan-main-panel">
                <div class="lan-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p>Select an announcement from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    if (hasSchoolWide || hasTeacher) {
        html += `
        <div class="lan-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lan-mobile-search" id="lanMobileSearch"
                placeholder="Search announcements..." oninput="lanMobileSearch(this.value)">
        </div>`;
    }

    html += `<div class="lan-mobile-list">`;

    let mobileFlatIdx = 0;

    // Mobile — School-wide section
    if (hasSchoolWide) {
        const swGid = 'lan-mg-school';
        html += `
            <div class="lan-mobile-folder-header" onclick="toggleLanMobileFolder('${swGid}', this)">
                <div class="lan-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lan-mobile-folder-name">School-wide</span>
                <span class="lan-mobile-folder-count">${schoolWide.length} announcement${schoolWide.length !== 1 ? 's' : ''}</span>
                <svg class="lan-mobile-folder-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                <div class="lan-mobile-folder-header" onclick="toggleLanMobileFolder('${tGid}', this)">
                    <div class="lan-mobile-folder-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <span class="lan-mobile-folder-name">${escapeLearnerAnnouncementHtml(teacher)}</span>
                    <span class="lan-mobile-folder-count">${items.length} announcement${items.length !== 1 ? 's' : ''}</span>
                    <svg class="lan-mobile-folder-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#f28c38" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
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

window.toggleLanMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lan-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveAnnouncementPageState();
};

window.toggleLanDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lan-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
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
        <style>
            .lan-mobile-detail {
                min-height: calc(100vh - 74px);
                padding: 18px 16px 96px;
            }
            .lan-mobile-detail-author-row {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 18px;
            }
            .lan-mobile-detail-avatar {
                flex: 0 0 auto;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 1px solid rgba(242,140,56,0.35);
                background: rgba(242,140,56,0.1);
                color: #f28c38;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
                font-weight: 800;
                letter-spacing: 0.2px;
            }
            .lan-mobile-detail-author-info {
                min-width: 0;
            }
            .lan-mobile-detail-author-name {
                color: #e2e8f0;
                font-size: 16px;
                font-weight: 700;
                line-height: 1.3;
                overflow-wrap: anywhere;
            }
            .lan-mobile-detail-author-role {
                color: #8b949e;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-top: 2px;
            }
            .lan-mobile-detail-role-badge {
                color: #f28c38;
            }
            .lan-mobile-detail-role-sep {
                color: #5a6472;
                margin: 0 6px;
            }
            .lan-mobile-detail-posted {
                color: #8b949e;
                font-size: 12px;
                margin-top: 4px;
            }
            .lan-mobile-detail-title {
                margin: 0 0 18px;
                color: #e2e8f0;
                font-size: 28px;
                line-height: 1.28;
                font-weight: 800;
                letter-spacing: 0;
                padding-bottom: 18px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lan-mobile-detail-message {
                color: #e2e8f0;
                font-size: 15px;
                line-height: 1.75;
                overflow-wrap: anywhere;
                white-space: normal;
            }
            @media (min-width: 900px) {
                .lan-mobile-detail { display: none; }
            }
        </style>
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

window.openMobileLearnerAnnouncementById = function(announcementId) {
    const targetId = String(announcementId || '');
    const flatIdx = (window._allLearnerAnnouncementsFlat || []).findIndex(ann => String(ann.id) === targetId);
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

    panel.innerHTML = `
        <div class="lan-panel-content">
            <div class="lan-panel-header">
                <div>
                    ${isSchool ? `
                        <div class="lan-school-wide-badge">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="#d29522" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            School-wide
                        </div>` : ''}
                    <div class="lan-panel-title ${isSchool ? 'lan-panel-title--school' : ''}">
                        <i class="${isSchool ? 'fas fa-school' : 'fas fa-bullhorn'}" style="margin-right:8px;"></i>${ann.title}
                    </div>
                    <div class="lan-panel-meta">${ann.teacher} &bull; ${ann.display_date}</div>
                </div>
                ${isNew ? '<span style="background:rgba(79,209,197,0.1);color:#4fd1c5;border:1px solid #4fd1c5;padding:3px 10px;font-size:11px;font-weight:800;border-radius:6px;letter-spacing:0.5px;">NEW</span>' : ''}
            </div>
            <div class="lan-panel-message">
                ${ann.message.replace(/\n/g, '<br>')}
            </div>
        </div>`;
};