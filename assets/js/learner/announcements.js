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
        mobileFilter: window._lanMobFilter || 'all',
        openFolders: Array.from(document.querySelectorAll('.lan-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        // Desktop sender groups the learner has folded away (open is the default)
        collapsedTeachers: Array.from(window._lanCollapsed || []),
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
            if (state.mobileFilter && state.mobileFilter !== 'all') window.lanMobileSetFilter(state.mobileFilter);
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lan-mobile-folder-body').forEach(body => {
                    const header = body.previousElementSibling;
                    if (header) lanMobileSetFolder(header, body, state.openFolders.includes(body.id));
                });
            }
            if (Array.isArray(state.collapsedTeachers)) {
                window._lanCollapsed = new Set(state.collapsedTeachers);
                if (typeof window.lanRenderDesktopList === 'function') window.lanRenderDesktopList();
            }
            const selectedIdx = state.selectedKey
                ? (window._allLearnerAnnouncementsFlat || []).findIndex(ann => `${ann._type || 'teacher'}:${ann.id}` === state.selectedKey)
                : state.selectedId
                    ? (window._allLearnerAnnouncementsFlat || []).findIndex(ann => String(ann.id) === String(state.selectedId))
                : state.selectedIdx;
            // The desktop pane marks what it shows as read, so it is only driven on desktop: on a phone the
            // learner has not opened anything yet, and nothing should turn read behind their back.
            if (window.innerWidth >= 900 && selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
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
            ${lanMobileHeadHtml('', false)}
            ${lanMobileSearchHtml()}
            <div class="lan-mobile-list">
                <div class="lan-mobile-empty">
                    <svg viewBox="0 0 24 24" width="44" height="44" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp" aria-hidden="true">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                    </svg>
                    <p class="lan-mobile-empty-title">No announcements yet</p>
                    <p class="lan-mobile-empty-body">Your teachers haven't posted any announcements. Check back soon.</p>
                </div>
            </div>`;
        return;
    }

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

    // ── Phone: title and counts, search, filter chips, then the sender groups ──
    // (the desktop layout above is a separate tree; the phone tree below is hidden from 900px up)
    // Read state is loaded here, before the phone rows are drawn, so the dots are right on the first paint.
    lanLoadRead();
    const lanReadSet = window._lanRead;
    const flatAll = window._allLearnerAnnouncementsFlat;
    const unreadTotal = flatAll.filter(a => !lanReadSet.has(lanKey(a))).length;

    html += lanMobileHeadHtml(lanMobileSummary(unreadTotal, flatAll.length), unreadTotal > 0);
    html += lanMobileSearchHtml();
    html += `<div class="lan-mobile-chips" role="group" aria-label="Filter announcements">${
        [['all', 'All'], ['unread', 'Unread'], ['school', 'School-wide'], ['teacher', 'Teachers']]
            .map(([k, label]) => `<button type="button" class="lan-mobile-chip${k === 'all' ? ' on' : ''}" data-filter="${k}" aria-pressed="${k === 'all'}" onclick="lanMobileSetFilter('${k}')">${label}</button>`)
            .join('')
    }</div>`;

    window._lanMobFilter = 'all';
    window._lanMobTerm = '';

    html += `<div class="lan-mobile-list">`;

    // Zero-results state: hidden by default, shown by lanMobileApply() when a search or filter matches nothing.
    html += `
        <div class="lan-mobile-empty lan-mobile-search-empty" id="lanMobileSearchEmpty" style="display:none;">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p class="lan-mobile-empty-title" id="lanMobileSearchEmptyText">No matches</p>
            <p class="lan-mobile-empty-body" id="lanMobileSearchEmptyBody">Try a different word or sender.</p>
        </div>`;

    // The flat list is school-wide first, then each teacher, so a group's rows are consecutive indexes into it.
    let flatCursor = 0;
    const mobileGroups = [];
    if (hasSchoolWide) {
        mobileGroups.push({ gid: 'lan-mg-school', name: 'School-wide', sub: 'Whole school', rows: schoolWide.map(() => flatCursor++) });
    }
    teacherEntries.forEach(({ teacher, items }, i) => {
        mobileGroups.push({ gid: `lan-mg-teacher-${i}`, name: teacher, sub: '', rows: items.map(() => flatCursor++) });
    });

    // A group starts open while it holds something unread. If nothing is unread anywhere the first group opens,
    // so the page is never just a column of folded labels. A learner's own choice (saved page state) wins over
    // this, see restoreAnnouncementPageState().
    const groupHasUnread = g => g.rows.some(idx => !lanReadSet.has(lanKey(flatAll[idx])));
    const anyOpen = mobileGroups.some(groupHasUnread);

    mobileGroups.forEach((g, gi) => {
        const open = anyOpen ? groupHasUnread(g) : gi === 0;
        html += `
            <div class="lan-mobile-folder-header${open ? '' : ' lan-mobile-folder-header--collapsed'}" role="button" tabindex="0"
                aria-expanded="${open}" aria-controls="${g.gid}"
                data-search="${escapeLearnerAnnouncementHtml(g.name.toLowerCase())}"
                onclick="toggleLanMobileFolder('${g.gid}', this)"
                onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLanMobileFolder('${g.gid}', this); }">
                <span class="lan-mobile-folder-name">${escapeLearnerAnnouncementHtml(g.name)}</span>
                <span class="lan-mobile-folder-sub">${escapeLearnerAnnouncementHtml(g.sub)}</span>
                <span class="lan-mobile-folder-count">${g.rows.length}</span>
                <svg class="lan-mobile-folder-chevron lan-icon-crisp" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </div>
            <div class="lan-mobile-folder-body${open ? '' : ' collapsed'}" id="${g.gid}">`;
        g.rows.forEach((idx, rowIdx) => {
            html += lanMobileRowHtml(flatAll[idx], idx, rowIdx === 0, !lanReadSet.has(lanKey(flatAll[idx])));
        });
        html += `</div>`; // close .lan-mobile-folder-body
    });

    html += `</div>`; // close .lan-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
    lanEnsureFont();
    window.lanInitDesktop();
}

// ── Phone list helpers ──────────────────────────────────────────────────────────────────────────────────────

// The title and counts line at the top of the phone list. "Mark all read" only shows while something is unread.
function lanMobileHeadHtml(summaryHtml, showMarkAll) {
    return `
        <div class="lan-mobile-head">
            <h1 class="lan-mobile-title">Announcements</h1>
            ${summaryHtml || showMarkAll ? `<div class="lan-mobile-subrow">
                <p class="lan-mobile-sub" id="lanMobileSub">${summaryHtml}</p>
                <button type="button" class="lan-mobile-markall" id="lanMobileMarkAll" onclick="lanMobileMarkAllRead()"${showMarkAll ? '' : ' hidden'}>Mark all read</button>
            </div>` : ''}
        </div>`;
}

function lanMobileSearchHtml() {
    return `
        <div class="lan-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lan-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"/>
            </svg>
            <input type="text" class="lan-mobile-search" id="lanMobileSearch"
                placeholder="Search announcements" aria-label="Search announcements" oninput="lanMobileSearch(this.value)">
        </div>`;
}

function lanMobileSummary(unread, total) {
    if (!total) return '';
    return unread === 0 ? 'All caught up' : `<b>${unread} unread</b> · ${total} in all`;
}

// The bell at the start of each row, 20px inside a soft 40px tile. It draws in currentColor, so the colour comes from the
// .lan-mobile-row-icon classes (muted when read, orange when unread) and follows light and dark mode with no extra rules.
function lanMobileBell() {
    return '<svg class="lan-icon-crisp" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
}

// The one line under a row's title: the state word where there is one, then when it was posted, then "Edited".
function lanMobileMeta(ann, unread) {
    const parts = [];
    if (unread) parts.push('<span class="lan-mobile-st lan-mobile-st--new">Unread</span>');
    if (ann.display_date) parts.push(escapeLearnerAnnouncementHtml(ann.display_date));
    if (ann.is_edited) parts.push('Edited');
    return parts.join(' · ');
}

function lanMobileRowHtml(ann, idx, first, unread) {
    const kind = ann._type === 'school' ? 'school' : 'teacher';
    return `
            <div class="lan-mobile-row${first ? ' lan-mobile-row--first' : ''}${unread ? ' lan-mobile-row--unread' : ''}" role="button" tabindex="0"
                data-idx="${idx}" data-kind="${kind}" data-state="${unread ? 'unread' : 'read'}"
                onclick="openMobileLearnerAnnouncement(${idx})"
                onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAnnouncement(${idx}); }">
                <div class="lan-mobile-row-icon${unread ? ' lan-mobile-row-icon--unread' : ''}">${lanMobileBell()}</div>
                <div class="lan-mobile-row-body">
                    <div class="lan-mobile-row-title">
                        <span class="lan-mobile-row-title-text">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</span>
                    </div>
                    <div class="lan-mobile-row-meta">${lanMobileMeta(ann, unread)}</div>
                </div>
                <svg class="lan-mobile-row-chevron lan-icon-crisp" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6"></path>
                </svg>
            </div>`;
}

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

// Open or fold one sender group, keeping the header, the body and the screen-reader state in step.
function lanMobileSetFolder(header, body, open) {
    body.classList.toggle('collapsed', !open);
    header.classList.toggle('lan-mobile-folder-header--collapsed', !open);
    header.setAttribute('aria-expanded', open ? 'true' : 'false');
}

window.toggleLanMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body || !headerEl) return;
    // While a search or filter is on, every group with a match is shown open; folding one would change nothing.
    if (body.closest('.lan-mobile-list')?.classList.contains('is-filtering')) return;
    lanMobileSetFolder(headerEl, body, body.classList.contains('collapsed'));
    saveAnnouncementPageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
};

window._lanMobFilter = 'all';
window._lanMobTerm = '';

// Shows the rows that match both the filter chip and the search box, and only the groups that still have a row.
// Folding is left alone (the list just shows every match while filtering), so clearing the search puts it back as it was.
function lanMobileApply() {
    const list = document.querySelector('.lan-mobile-list');
    if (!list) return;
    const flat = window._allLearnerAnnouncementsFlat || [];
    const term = window._lanMobTerm || '';
    const filter = window._lanMobFilter || 'all';
    const filtering = !!term || filter !== 'all';
    list.classList.toggle('is-filtering', filtering);

    let totalVisible = 0;
    list.querySelectorAll('.lan-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        // a search that names the sender shows all of that group's rows
        const groupHit = !!term && (header?.dataset.search || '').includes(term);
        let visible = 0;
        body.querySelectorAll('.lan-mobile-row').forEach(row => {
            const ann = flat[Number(row.dataset.idx)] || {};
            const okFilter = filter === 'all'
                || (filter === 'unread' && row.dataset.state === 'unread')
                || (filter === row.dataset.kind);
            const hay = `${ann.title || ''} ${ann.message || ''}`.toLowerCase();
            const show = okFilter && (!term || groupHit || hay.includes(term));
            row.style.display = show ? '' : 'none';
            row.classList.toggle('lan-mobile-row--first', show && visible === 0);
            if (show) visible++;
        });
        if (header) {
            header.style.display = visible ? '' : 'none';
            const count = header.querySelector('.lan-mobile-folder-count');
            if (count) count.textContent = String(visible);
        }
        body.style.display = visible ? '' : 'none';
        totalVisible += visible;
    });

    // Zero-results empty state: only when a search or filter is on and nothing matched.
    const searchEmpty = document.getElementById('lanMobileSearchEmpty');
    if (searchEmpty) {
        const showEmpty = filtering && totalVisible === 0;
        searchEmpty.style.display = showEmpty ? 'flex' : 'none';
        if (showEmpty) {
            const label = document.getElementById('lanMobileSearchEmptyText');
            const body = document.getElementById('lanMobileSearchEmptyBody');
            const raw = (document.getElementById('lanMobileSearch')?.value || '').trim();
            const none = { unread: "You're all caught up", school: 'No school-wide announcements', teacher: 'No teacher announcements' };
            if (label) label.textContent = raw ? `No matches for "${raw}"` : (none[filter] || 'No matches');
            if (body) body.textContent = raw ? 'Try a different word or sender.' : (filter === 'unread' ? 'Nothing unread right now.' : 'Pick another filter to see more.');
        }
    }

    // Filtering rows/folders in/out of view changes the page's scrollable
    // height just like expanding/collapsing a folder does, but without a
    // real scroll event — same recalculation fix as the folder toggle.
    recheckMobileNavAfterToggle();
}

window.lanMobileSetFilter = function(key) {
    window._lanMobFilter = key || 'all';
    document.querySelectorAll('.lan-mobile-chip').forEach(chip => {
        const on = chip.dataset.filter === window._lanMobFilter;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    lanMobileApply();
    saveAnnouncementPageState();
};

window.lanMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('announcements', { mobileSearch: val });
    window._lanMobTerm = String(val || '').toLowerCase().trim();
    lanMobileApply();
};

// Brings every row, the counts line and the "Mark all read" button back in line with the read state.
function lanMobileRefreshRead() {
    const flat = window._allLearnerAnnouncementsFlat || [];
    const read = window._lanRead || new Set();
    document.querySelectorAll('.lan-mobile-row').forEach(row => {
        const ann = flat[Number(row.dataset.idx)];
        if (!ann) return;
        const unread = !read.has(lanKey(ann));
        row.dataset.state = unread ? 'unread' : 'read';
        row.classList.toggle('lan-mobile-row--unread', unread);
        const icon = row.querySelector('.lan-mobile-row-icon');
        if (icon) icon.classList.toggle('lan-mobile-row-icon--unread', unread);
        const meta = row.querySelector('.lan-mobile-row-meta');
        if (meta) meta.innerHTML = lanMobileMeta(ann, unread);
    });
    const unreadTotal = flat.filter(a => !read.has(lanKey(a))).length;
    const sub = document.getElementById('lanMobileSub');
    if (sub) sub.innerHTML = lanMobileSummary(unreadTotal, flat.length);
    const btn = document.getElementById('lanMobileMarkAll');
    if (btn) btn.hidden = unreadTotal === 0;
    lanMobileApply();
}

window.lanMobileMarkAllRead = function () {
    if (!window._lanRead) lanLoadRead();
    (window._allLearnerAnnouncementsFlat || []).forEach(a => window._lanRead.add(lanKey(a)));
    lanSaveRead();
    lanMobileRefreshRead();
    if (typeof window.lanRenderDesktopList === 'function') window.lanRenderDesktopList();
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

    // Opening an announcement on a phone reads it. "Mark as unread" at the bottom puts it back.
    if (!window._lanRead) lanLoadRead();
    window._lanRead.add(lanKey(ann));
    lanSaveRead();

    apiArea.innerHTML = `
        <article class="lan-mobile-detail">
            <div class="lan-mobile-detail-top">
                <span class="lan-mobile-detail-eyebrow">${isSchool ? 'School-wide' : 'Announcement'}</span>
                ${ann.is_edited ? '<span class="lan-mobile-detail-status lan-mobile-detail-status--edited">Edited</span>' : ''}
            </div>
            <h1 class="lan-mobile-detail-title learner-mobile-detail-title">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</h1>
            ${ann.display_date ? `<div class="lan-mobile-detail-posted">Posted ${escapeLearnerAnnouncementHtml(ann.display_date)}</div>` : ''}
            <div class="lan-mobile-detail-facts">
                <div class="lan-mobile-detail-fact">
                    <div class="lan-mobile-detail-fact-label">From</div>
                    <div class="lan-mobile-detail-fact-value">${escapeLearnerAnnouncementHtml(sender)}</div>
                    <div class="lan-mobile-detail-fact-note">${escapeLearnerAnnouncementHtml(roleLabel)}</div>
                </div>
                <div class="lan-mobile-detail-fact">
                    <div class="lan-mobile-detail-fact-label">Sent to</div>
                    <div class="lan-mobile-detail-fact-value">${isSchool ? 'Whole school' : 'Your class'}</div>
                </div>
            </div>
            <div class="lan-mobile-detail-label">Message</div>
            ${ann.is_edited ? `<div class="lan-mobile-detail-edited">Edited ${escapeLearnerAnnouncementHtml(ann.edited_date || '')} · Changes are highlighted</div>` : ''}
            <div class="lan-mobile-detail-message">${renderLearnerAnnouncementBody(ann)}</div>
            <button type="button" class="lan-mobile-detail-action lan-mobile-detail-action--quiet" id="lanMobileReadBtn" onclick="lanMobileToggleRead(${flatIdx})">Mark as unread</button>
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

window.lanMobileToggleRead = function (flatIdx) {
    const ann = (window._allLearnerAnnouncementsFlat || [])[flatIdx];
    if (!ann) return;
    if (!window._lanRead) lanLoadRead();
    const key = lanKey(ann);
    if (window._lanRead.has(key)) window._lanRead.delete(key); else window._lanRead.add(key);
    lanSaveRead();
    const btn = document.getElementById('lanMobileReadBtn');
    if (btn) btn.textContent = window._lanRead.has(key) ? 'Mark as unread' : 'Mark as read';
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
window._lanCollapsed = window._lanCollapsed || new Set();

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

    // Group by sender: school-wide first, then each teacher. The flat list is already in that
    // order (most recent first), the same way the learner assignments list groups by teacher.
    const groups = [];
    const byGroup = new Map();
    visible.forEach(item => {
        const isSchool = item.ann._type === 'school';
        const sender = item.ann.teacher || item.ann.sender || (isSchool ? 'School Admin' : 'Teacher');
        const key = isSchool ? 'school' : 'teacher:' + sender;
        let g = byGroup.get(key);
        if (!g) { g = { key, label: isSchool ? 'School-wide' : sender, rows: [] }; byGroup.set(key, g); groups.push(g); }
        g.rows.push(item);
    });
    groups.forEach(g => g.rows.sort((a, b) => getLearnerAnnouncementTime(b.ann) - getLearnerAnnouncementTime(a.ann)));

    if (!window._lanCollapsed) window._lanCollapsed = new Set();
    const CHEV = '<svg class="lan-gl-chev" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    let html = '';
    groups.forEach(({ key, label, rows }) => {
        // a search always shows every match, whatever was folded away
        const collapsed = !term && window._lanCollapsed.has(key);
        html += `
            <div class="lan-group">
                <div class="lan-gl" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}"
                     data-group="${escapeLearnerAnnouncementHtml(key)}"
                     onclick="lanToggleGroup(this)" onkeydown="lanGroupKeydown(event, this)">
                    ${CHEV}<span class="lan-gl-name">${escapeLearnerAnnouncementHtml(label)}</span>
                </div>
                <div class="lan-gb${collapsed ? ' collapsed' : ''}">`;
        rows.forEach(({ ann, idx }) => {
            const unread = !read.has(lanKey(ann));
            const stateText = unread ? 'Unread' : 'Read';
            const active = showActive && idx === window._learnerAnnouncementSelectedIdx ? ' active' : '';
            html += `
                    <div class="lan-sidebar-item${active}" id="lan-sidebar-${idx}" onclick="selectDesktopLearnerAnnouncement(${idx})">
                        <span class="lan-sidebar-dot${unread ? ' is-unread' : ''}" role="img" aria-label="${stateText}" title="${stateText}"></span>
                        <div class="lan-sidebar-item-info">
                            <div class="lan-sidebar-item-title${unread ? ' lan-unread' : ''}">${escapeLearnerAnnouncementHtml(ann.title || '')}</div>
                            <div class="lan-sidebar-item-meta">${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                        </div>
                    </div>`;
        });
        html += `
                </div>
            </div>`;
    });
    list.innerHTML = html || `<div class="lan-list-empty">${items.length ? 'No announcements match.' : "Your teachers haven't posted any announcements yet."}</div>`;
    list.scrollTop = keepScroll;
};

// Fold / unfold one sender group. The DOM is updated in place so the list does not jump.
window.lanToggleGroup = function (headerEl) {
    if (!headerEl) return;
    const body = headerEl.nextElementSibling;
    if (!body) return;
    const key = headerEl.dataset.group || '';
    if (!window._lanCollapsed) window._lanCollapsed = new Set();
    const nowCollapsed = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', nowCollapsed);
    headerEl.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    if (nowCollapsed) window._lanCollapsed.add(key);
    else window._lanCollapsed.delete(key);
    saveAnnouncementPageState();
};

window.lanGroupKeydown = function (e, headerEl) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    window.lanToggleGroup(headerEl);
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
    // rows inside a folded group are hidden, so up / down step over them
    const ids = Array.from(document.querySelectorAll('#lan-list .lan-sidebar-item'))
        .filter(el => el.offsetParent !== null)
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
    const first = Array.from(document.querySelectorAll('#lan-list .lan-sidebar-item')).find(el => el.offsetParent !== null);
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
    const isRead = window._lanRead ? window._lanRead.has(lanKey(ann)) : true;

    const chips =
        (isSchool ? '<span class="lan-panel-status">School-wide</span>' : '') +
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
                        <b>${escapeLearnerAnnouncementHtml(sender)}</b>
                        <small>${escapeLearnerAnnouncementHtml(roleLabel)} &middot; Posted ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</small>
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
    if (listBox && sidebarItem && sidebarItem.offsetParent !== null) {
        const top = sidebarItem.offsetTop, bottom = top + sidebarItem.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }
    if (window._lanRead) window.lanScheduleRead(ann);
    if (window.learnerPageState) wireAnnouncementScrollState();
};

// Desktop type is Geist 300/400/500 (see announcements.css). Nunito stays loaded for the mobile views.
function lanEnsureFont() {
    if (!document.getElementById('lan-geist-font')) {
        const g = document.createElement('link');
        g.id = 'lan-geist-font';
        g.rel = 'stylesheet';
        g.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap';
        document.head.appendChild(g);
    }
    if (document.getElementById('lan-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'lan-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}