function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

// Uses the same eight-pill spinner as the login button, but keeps it inside
// the action button that started the request. The returned function restores
// the button after the request settles.
window.showTeacherButtonLoader = function(button) {
    if (!button) return function() {};

    if (!button.querySelector('.btn-label')) {
        const label = document.createElement('span');
        label.className = 'btn-label';
        while (button.firstChild) label.appendChild(button.firstChild);
        button.appendChild(label);

        const spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        spinner.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
        button.appendChild(spinner);
    }

    button.classList.add('btn-loadable', 'is-loading');
    button.disabled = true;

    return function hideTeacherButtonLoader() {
        const label = Array.from(button.children).find(function(child) {
            return child.classList.contains('btn-label');
        });
        const spinner = Array.from(button.children).find(function(child) {
            return child.classList.contains('btn-spinner');
        });

        // Restore the button's original child structure. This matters for
        // action-card buttons whose icons and labels need to remain direct
        // children after their label/status has been updated.
        if (label) {
            while (label.firstChild) button.insertBefore(label.firstChild, label);
            label.remove();
        }
        if (spinner) spinner.remove();
        button.classList.remove('btn-loadable', 'is-loading');
        button.disabled = false;
    };
};

window.showTeacherScopedLoader = function(panel, message = 'Working...') {
    const isDesktop = window.innerWidth >= 900 && panel;

    if (!isDesktop) {
        const globalLoader = document.getElementById('loaderOverlay');
        if (globalLoader) globalLoader.style.display = 'flex';
        return function hideGlobalLoader() {
            if (globalLoader) globalLoader.style.display = 'none';
        };
    }

    panel.classList.add('teacher-scoped-loader-host');
    const overlay = document.createElement('div');
    overlay.className = 'teacher-scoped-loader';
    overlay.innerHTML = `
        <div class="teacher-scoped-loader-inner">
            <div class="teacher-scoped-loader-spinner"></div>
            <span class="teacher-scoped-loader-text">${message}</span>
        </div>`;
    panel.appendChild(overlay);

    return function hidePanelLoader() {
        overlay.remove();
    };
};

// ─────────────────────────────────────────────
// SHARED: COLLAPSIBLE SIDEBAR CLASS GROUPS
// Reusable across quizzes/grades/resources/announcements/
// assignments (or any teacher page with a left sidebar
// grouped by class). Styling for .tchr-sidebar-class-label--toggle,
// .tchr-sidebar-class-chevron, and .tchr-sidebar-class-group now
// lives in dashboard.css (loaded once in <head>) instead of being
// injected here at runtime.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// SHARED: DESKTOP "FLAT LAYOUT" STYLES
// One shared copy, reused by every teacher page that renders a
// sidebar + main-panel split (Quizzes, Announcements, Assignments,
// Resources, Grades).
//
// This styling — the flat, VS-Code/GitHub style layout (no outer card,
// panels transparent, single 1px divider between sidebar and main
// panel), .tchr-flat-layout / .tchr-flat-sidebar / .tchr-flat-panel,
// the shared .tchr-info-rail, and the .teacher-desktop-create.active
// state — now lives in dashboard.css (loaded once in <head>) instead
// of being injected into <head> at runtime.
//
// This function is kept as a no-op so every other page's existing
// `injectSharedTeacherDesktopLayoutStyles()` call (already present in
// each page's render function) keeps working without any changes
// needed on their end.
// ─────────────────────────────────────────────
function injectSharedTeacherDesktopLayoutStyles() {
    // Intentionally empty — see comment above.
}

/**
 * Builds the markup for the shared right-hand info rail — a fixed,
 * always-visible third column reserved for contextual help text (and
 * later, potentially, an AI/chat assistant). Call
 * injectSharedTeacherDesktopLayoutStyles() once per page load (already
 * required for the flat layout) before using this; it owns the rail's
 * CSS too.
 * @param {string} title    - header label, e.g. "About Quizzes"
 * @param {string} bodyHtml - one or more <p> elements (can include <strong>)
 * @param {string} [railId] - optional id on the header/body elements, so a
 *                            page can target and update the rail's content
 *                            dynamically (e.g. in response to a tap
 *                            elsewhere on the page). Omit for a static rail.
 * @returns {string}
 */
window.buildInfoRail = function(title, bodyHtml, railId) {
    const headerId = railId ? ` id="${railId}-header"` : '';
    const bodyId    = railId ? ` id="${railId}-body"`   : '';
    return `
        <div class="tchr-info-rail">
            <div class="tchr-info-rail-header"${headerId}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span${railId ? ` id="${railId}-header-text"` : ''}>${title}</span>
            </div>
            <div class="tchr-info-rail-body"${bodyId}>${bodyHtml}</div>
        </div>`;
};

/**
 * Updates an info rail built with buildInfoRail(title, bodyHtml, railId)
 * in place — swaps its header text and body content without re-rendering
 * anything else on the page. Used for tap-to-explain: clicking a card or
 * chart calls this to show that item's explanation in the rail.
 * @param {string} railId   - the same railId passed to buildInfoRail()
 * @param {string} title    - new header label
 * @param {string} bodyHtml - new body content (one or more <p> elements)
 */
window.updateInfoRail = function(railId, title, bodyHtml) {
    const headerText = document.getElementById(`${railId}-header-text`);
    const body        = document.getElementById(`${railId}-body`);
    if (headerText) headerText.textContent = title;
    if (body) body.innerHTML = bodyHtml;
};

/**
 * Builds the markup for one collapsible class group in a sidebar.
 * Collapsed/expanded state is remembered per groupId (via
 * window.teacherSectionState.collapsedGroups) so re-rendering the same
 * sidebar — e.g. from cache when switching back to this section — keeps
 * whichever groups the teacher had collapsed, instead of resetting
 * every group back to expanded.
 * @param {string} groupId       - unique DOM id for the collapsible content wrapper
 * @param {string} labelClass    - page-specific label class, e.g. "qz-sidebar-class-label"
 * @param {string} labelInnerHtml - the label's contents (name, icons, badges, etc.)
 * @param {string} itemsHtml     - the already-built HTML for the items inside this class
 * @returns {string}
 */
window.buildCollapsibleClassGroup = function(groupId, labelClass, labelInnerHtml, itemsHtml) {
    const isCollapsed = window.teacherSectionState.collapsedGroups.has(groupId);
    return `
        <div class="${labelClass} tchr-sidebar-class-label--toggle${isCollapsed ? ' collapsed' : ''}"
            onclick="toggleSidebarClassGroup(this)"
            data-target="${groupId}"
            role="button"
            aria-expanded="${isCollapsed ? 'false' : 'true'}">
            <svg class="tchr-sidebar-class-chevron" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span>${labelInnerHtml}</span>
        </div>
        <div class="tchr-sidebar-class-group${isCollapsed ? ' collapsed' : ''}" id="${groupId}">${itemsHtml}</div>`;
};

/**
 * ─────────────────────────────────────────────
 * SHARED: TEACHER MOBILE DETAIL-MODE HEADER
 * ─────────────────────────────────────────────
 * Teacher-side equivalent of the learner app's configureHeader/
 * handleHeaderBack (learner_dashboard.php). Learner had this built
 * in from the start; teacher never had it, so this is new
 * infrastructure, not a port of existing teacher code.
 *
 * Lives here (not in teacher_dashboard.php) deliberately, so it sits
 * alongside the other shared, cross-page teacher helpers already in
 * this file (teacherSectionState, buildCollapsibleClassGroup,
 * buildInfoRail) rather than growing the PHP shell file. See
 * PROJECT_NOTES.md §6 for the reasoning.
 *
 * Usage from any teacher list page, mirroring the learner pattern:
 *   window.configureTeacherHeader({ title: 'Assignment', mode: 'detail', detailType: 'Assignment' });
 *   ...on the way back into the list...
 *   window.configureTeacherHeader({ title: 'Assignments', mode: 'standard' });
 *
 * mode: 'standard' -> normal browsing chrome (hamburger + brand visible,
 *   bottom nav visible on mobile, back button hidden).
 * mode: 'detail'   -> hides hamburger + bottom nav, shows the back
 *   button and a detail title in place of the brand, on mobile. Desktop
 *   is intentionally left alone here — every teacher page's desktop
 *   view is a sidebar+panel split, not a page navigation, so desktop
 *   never enters "detail mode" (same as learner's own convention).
 *
 * Row 2 (#topNavRow2, the Syllabus/Evaluations/Analytics/Calendar/
 * Settings tab bar) is already "desktop only" by its own CSS (see the
 * "ROW 2: tab links (desktop only)" comment in teacher_dashboard.php)
 * — confirmed no JS anywhere currently shows/hides it, so this
 * controller does not need to touch it for mobile detail mode.
 */
window.configureTeacherHeader = function(config) {
    const { title, mode } = config || {};

    const backBtn      = document.getElementById('teacherHeaderBackBtn');
    const backLabelEl  = document.getElementById('teacherHeaderBackLabel');
    const brandEl      = document.getElementById('teacherHeaderBrand');
    const detailTitleEl = document.getElementById('teacherHeaderDetailTitle');
    const titleEl      = document.getElementById('teacherHeaderTitle');
    const mobileBtn    = document.getElementById('mobileToggle');
    const rightSide    = document.getElementById('teacherHeaderRight');
    const mobileBottomNav = document.getElementById('mobileBottomNav');

    const isMobile = window.innerWidth <= 768;

    if (mode === 'detail') {
        window.teacherHeaderDetailType = config.detailType || title || null;
        window.teacherHeaderBackAction = typeof config.backAction === 'function'
            ? config.backAction
            : null;

        const backLabel = config.backLabel || '';
        if (backLabelEl) backLabelEl.innerText = backLabel;
        if (titleEl) titleEl.innerText = title || '';

        if (isMobile) {
            if (backBtn) backBtn.style.display = 'flex';
            if (mobileBtn) mobileBtn.style.display = 'none';
            if (brandEl) brandEl.style.display = 'none';
            if (detailTitleEl) detailTitleEl.style.display = 'flex';
            if (rightSide) rightSide.style.visibility = 'hidden';
            if (mobileBottomNav) mobileBottomNav.style.setProperty('display', 'none', 'important');
        }
        // Desktop: intentionally no-op. Desktop teacher pages use the
        // sidebar+panel split, not page navigation, so there is no
        // desktop "detail mode" to enter (mirrors learner's convention).
    } else {
        window.teacherHeaderDetailType = null;
        window.teacherHeaderBackAction = null;

        if (backBtn) backBtn.style.display = 'none';
        if (brandEl) brandEl.style.display = '';
        if (detailTitleEl) detailTitleEl.style.display = 'none';
        if (rightSide) rightSide.style.visibility = 'visible';
        if (mobileBtn) mobileBtn.style.display = isMobile ? 'block' : 'none';
        if (mobileBottomNav) {
            mobileBottomNav.style.display = isMobile ? 'flex' : 'none';
        }
    }
};

/**
 * Shared back-button handler wired to #teacherHeaderBackBtn's onclick.
 * Same dispatch shape as learner's handleHeaderBack: a page-specific
 * backAction callback (set via configureTeacherHeader's backAction
 * option) always wins if present; otherwise dispatch on detailType.
 *
 * Add one branch here per teacher page as each one gets a mobile
 * detail view — Assignments is the first.
 */
window.handleTeacherHeaderBack = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const backAction = window.teacherHeaderBackAction;
    if (typeof backAction === 'function') {
        backAction();
        return false;
    }

    const detailType = window.teacherHeaderDetailType;

    if (detailType === 'Assignment') {
        if (typeof window.fetchTeacherAssignments === 'function') {
            window.fetchTeacherAssignments();
            return false;
        }
    }

    // Fallback: no known detail type / page cache function missing.
    // Return to Home rather than leaving the teacher stranded on a
    // detail page with a back button that does nothing.
    if (typeof window.loadTeacherManual === 'function') {
        window.loadTeacherManual();
    }
    return false;
};

/**
 * ─────────────────────────────────────────────
 * SHARED TEACHER SECTION STATE
 * ─────────────────────────────────────────────
 * One place to remember "where the teacher was" on each section so
 * switching pages, or a plain browser refresh, restores the same view
 * instead of resetting to each section's default empty state. Mirrors
 * the learner side's per-page state pattern (manual.js).
 *
 * - selection: per-section selected item id (e.g. selected quiz in
 *   Grades/Quizzes, selected class+term in Analytics). Each section
 *   reads its own key and, if the id still exists in fresh data,
 *   re-selects it instead of showing the empty placeholder.
 * - scrollTop: per-section sidebar/panel scroll position, saved on
 *   scroll and restored right after that section's content renders.
 * - collapsedGroups: sidebar class-group ids the teacher has manually
 *   collapsed, shared across every page that uses collapsible groups
 *   (Quizzes, Grades, Resources, Announcements, Assignments) since a
 *   group id is unique per page+class already.
 *
 * Persisted to sessionStorage (not just kept in memory) so a plain
 * page refresh — not only switching between sidebar links — restores
 * the same view too. sessionStorage only stores strings, so the whole
 * object is JSON-serialized; collapsedGroups is converted between a
 * Set (used everywhere else in the code) and a plain array (the only
 * thing JSON.stringify can store) only at the save/load boundary.
 */
const TEACHER_SECTION_STATE_KEY = 'teacherSectionState';

function loadTeacherSectionState() {
    try {
        const raw = sessionStorage.getItem(TEACHER_SECTION_STATE_KEY);
        if (!raw) throw new Error('no saved state');
        const parsed = JSON.parse(raw);
        return {
            selection: parsed.selection || {},
            scrollTop: parsed.scrollTop || {},
            collapsedGroups: new Set(parsed.collapsedGroups || [])
        };
    } catch (e) {
        return { selection: {}, scrollTop: {}, collapsedGroups: new Set() };
    }
}

window.teacherSectionState = loadTeacherSectionState();

/**
 * Writes the current in-memory teacherSectionState to sessionStorage.
 * Called after every mutation (selection change, scroll, group
 * toggle) so a refresh at any point picks up the latest state.
 */
window.persistTeacherSectionState = function() {
    try {
        const s = window.teacherSectionState;
        sessionStorage.setItem(TEACHER_SECTION_STATE_KEY, JSON.stringify({
            selection: s.selection,
            scrollTop: s.scrollTop,
            collapsedGroups: Array.from(s.collapsedGroups)
        }));
    } catch (e) {
        // sessionStorage can throw in rare cases (private browsing quota,
        // etc.) — state simply won't survive a refresh in that case,
        // which is a safe, silent fallback rather than a broken page.
    }
};

/**
 * Generic toggle handler for any collapsible class-group label.
 * Default state (no click yet) is always expanded. Persists the choice
 * in window.teacherSectionState.collapsedGroups so buildCollapsibleClassGroup()
 * can restore it next time this group's sidebar is rendered.
 */
window.toggleSidebarClassGroup = function(labelEl) {
    if (!labelEl) return;
    const targetId = labelEl.getAttribute('data-target');
    const group = targetId ? document.getElementById(targetId) : null;
    if (!group) return;

    const isCollapsed = group.classList.toggle('collapsed');
    labelEl.classList.toggle('collapsed', isCollapsed);
    labelEl.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

    if (isCollapsed) window.teacherSectionState.collapsedGroups.add(targetId);
    else window.teacherSectionState.collapsedGroups.delete(targetId);
    window.persistTeacherSectionState();
};

/**
 * Saves the scroll position of a section's scrollable sidebar/panel
 * element under the given key. Call from a scroll listener wired up
 * once per section (see wireTeacherSectionScroll below). The in-memory
 * value updates immediately; the sessionStorage write is debounced
 * since scroll fires very frequently and writing on every event would
 * be wasteful.
 */
let _teacherScrollPersistTimeout = null;
window.saveTeacherScrollState = function(key, el) {
    if (!el) return;
    window.teacherSectionState.scrollTop[key] = el.scrollTop;
    clearTimeout(_teacherScrollPersistTimeout);
    _teacherScrollPersistTimeout = setTimeout(window.persistTeacherSectionState, 250);
};

/**
 * Restores a previously saved scroll position onto the given element,
 * if one exists. Safe to call even if nothing was saved yet.
 */
window.restoreTeacherScrollState = function(key, el) {
    if (!el) return;
    const saved = window.teacherSectionState.scrollTop[key];
    if (Number.isFinite(saved)) {
        requestAnimationFrame(() => { el.scrollTop = saved; });
    }
};

/**
 * Wires a passive scroll listener onto an element that saves its
 * scroll position under `key` as the teacher scrolls. Uses a data
 * attribute to avoid double-wiring the same element across re-renders
 * (the element itself is usually rebuilt each render, so this mostly
 * guards against wiring the same DOM node twice in one render).
 */
window.wireTeacherSectionScroll = function(key, el) {
    if (!el || el.dataset.scrollStateWired === '1') return;
    el.dataset.scrollStateWired = '1';
    el.addEventListener('scroll', () => {
        window.saveTeacherScrollState(key, el);
    }, { passive: true });
};

document.addEventListener('DOMContentLoaded', function () {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('mobileOverlay');
    const loader   = document.getElementById('loaderOverlay');
    const apiArea  = document.getElementById('api-content-area');
    const iframe   = document.getElementById('mainFrame');
    window.loaderTimeout = null;

    // ─────────────────────────────────────────────
    // LOAD TEACHER MANUAL (defined once only)
    // ─────────────────────────────────────────────
   window.loadTeacherManual = async function() {
    sessionStorage.setItem("lastTeacherPage", "teacher_manual");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_manual");
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    // Serve from cache instantly — same short-circuit the learner
    // side uses in loadManual() (manual.js), so a cached repeat visit
    // never shows the loader at all.
    if (window.teacherManualCache && window.teacherSnapshotCache) {
        const isMobileCached = window.innerWidth <= 768;
        if (isMobileCached) {
            apiArea.innerHTML = window.teacherManualCache;
        } else {
            apiArea.innerHTML = `
                <div class="dashboard-home-layout">
                    <div class="dashboard-snapshot-panel">
                        ${renderSnapshotPanel(window.teacherSnapshotCache)}
                    </div>
                    <div class="dashboard-manual-panel">
                        ${window.teacherManualCache}
                    </div>
                </div>`;

            window.loadCalendar(window.calendarState.month, window.calendarState.year);
        }
        afterTeacherHomeRender();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const [manualRes, snapshotRes] = await Promise.all([
            fetch('partials/teacher_manual.html?v=1.5'),
            fetch('api/teacher/get_dashboard_snapshot.php')
        ]);
        const manualHtml = await manualRes.text();
        const snapshot   = await snapshotRes.json();

        window.teacherManualCache   = manualHtml;
        window.teacherSnapshotCache = snapshot;

        // Desktop: two column layout. Mobile: manual only
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            apiArea.innerHTML = manualHtml;
        } else {
            apiArea.innerHTML = `
                <div class="dashboard-home-layout">
                    <div class="dashboard-snapshot-panel">
                        ${renderSnapshotPanel(snapshot)}
                    </div>
                    <div class="dashboard-manual-panel">
                        ${manualHtml}
                    </div>
                </div>`;
                
    window.loadCalendar(window.calendarState.month, window.calendarState.year);

        }
        afterTeacherHomeRender();
    } catch(e) {
        console.error('Home load error:', e);
        const res = await fetch('partials/teacher_manual.html');
        const html = await res.text();
        if (apiArea) apiArea.innerHTML = html;
        // Load calendar after DOM is ready

    } finally {
        if (loader) loader.style.display = 'none';
        clearTimeout(window.loaderTimeout);
    }
};

// Called after teacher Home has rendered (cached or freshly fetched) —
// silently warms every other section's cache in staggered waves so it
// doesn't compete with Home's own network traffic. Mirrors the learner
// side's afterHomeRender() in manual.js.
function afterTeacherHomeRender() {
    setTimeout(() => {
        if (typeof window.prefetchTeacherQuizzes     === 'function') window.prefetchTeacherQuizzes();
        if (typeof window.prefetchTeacherAssignments === 'function') window.prefetchTeacherAssignments();
    }, 1500);
    setTimeout(() => {
        if (typeof window.prefetchTeacherGrades         === 'function') window.prefetchTeacherGrades();
        if (typeof window.prefetchTeacherAnnouncements   === 'function') window.prefetchTeacherAnnouncements();
    }, 3000);
    setTimeout(() => {
        if (typeof window.prefetchTeacherResources    === 'function') window.prefetchTeacherResources();
        if (typeof window.prefetchTeacherEvaluations   === 'function') window.prefetchTeacherEvaluations();
        if (typeof window.prefetchTeacherSyllabus      === 'function') window.prefetchTeacherSyllabus();
    }, 4500);
    setTimeout(() => {
        if (typeof window.prefetchTeacherAnalytics  === 'function') window.prefetchTeacherAnalytics();
        if (typeof window.prefetchTeacherCalendar   === 'function') window.prefetchTeacherCalendar();
    }, 6000);
}

function renderSnapshotPanel(data) {
    const cards = [
        {
            key:     'quiz',
            data:    data.quiz,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            label:   'Latest Quiz',
            color:   '#4fd1c5',
            onclick: data.quiz ? `openTeacherSnapshotDetail('quiz', ${Number(data.quiz.id) || 0})` : '',
            empty:   'No quizzes created yet',
            meta:    data.quiz ? `${data.quiz.class_name} &bull; ${data.quiz.start_time}` : '',
            badge:   data.quiz ? `<span class="snap-status-badge snap-status-badge--dynamic" style="--snap-badge-bg:${data.quiz.status === 'Open' ? 'rgba(242,140,56,0.15)' : 'rgba(107,114,128,0.15)'};--snap-badge-color:${data.quiz.status === 'Open' ? '#f28c38' : '#6b7280'};">${data.quiz.status}</span>` : ''
        },
        {
            key:     'assignment',
            data:    data.assignment,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#a78bfa" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
            label:   'Upcoming Assignment',
            color:   '#a78bfa',
            onclick: data.assignment ? `openTeacherSnapshotDetail('assignment', ${Number(data.assignment.id) || 0})` : '',
            empty:   'No upcoming assignments',
            meta:    data.assignment ? `${data.assignment.class_name} &bull; Due ${data.assignment.due_date}` : '',
            badge:   data.assignment ? `<span class="snap-status-badge snap-status-badge--dynamic" style="--snap-badge-bg:rgba(167,139,250,0.15);--snap-badge-color:#a78bfa;">in ${data.assignment.days_left} day${data.assignment.days_left !== 1 ? 's' : ''}</span>` : ''
        },
        {
            key:     'announcement',
            data:    data.announcement,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#f59e0b" stroke-width="2" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            label:   'Latest Announcement',
            color:   '#f59e0b',
            onclick: data.announcement ? `openTeacherSnapshotDetail('announcement', ${Number(data.announcement.id) || 0})` : '',
            empty:   'No announcements sent yet',
            meta:    data.announcement ? `${data.announcement.class_name} &bull; ${data.announcement.created_at}` : '',
            badge:   ''
        }
    ];

    let html = `<div class="snap-panel-title">Quick Snapshot</div>`;

    cards.forEach(card => {
        if (!card.data) {
            html += `
                <div class="snap-card snap-card-empty" style="--snap-label-color:${card.color};">
                    <div class="snap-card-label">${card.icon} ${card.label}</div>
                    <div class="snap-empty-text">${card.empty}</div>
                </div>`;
        } else {
            html += `
                <div class="snap-card" style="--snap-label-color:${card.color};" onclick="${card.onclick}">
                    <div class="snap-card-label">${card.icon} ${card.label}</div>
                    <div class="snap-card-title">${card.data.title}</div>
                    <div class="snap-card-meta">
                        ${card.meta}
                        ${card.badge}
                    </div>
                </div>`;
        }
    });
    
    html += `<div class="snap-panel-title snap-panel-title--spaced">Calendar & Reminders</div>
         <div id="snap-calendar"></div>`;
    return html;
}

    // ─────────────────────────────────────────────
    // RESTORE LAST PAGE ON REFRESH
    // ─────────────────────────────────────────────
// Snapshot cards load the normal desktop section, then select the exact
// matching item so its existing detail renderer fills the right panel.
window.openTeacherSnapshotDetail = async function(type, itemId) {
    if (window.innerWidth <= 768) return;

    const id = String(itemId || '');
    if (!id) return;

    const config = type === 'quiz'
        ? {
            cacheKey: 'teacherQuizzesCache',
            fetchPage: window.fetchTeacherQuizzes,
            find: () => (window._allQuizzesFlat || []).find(item => String(item.id) === id),
            select: item => window.selectDesktopQuiz?.(item.id)
        }
        : type === 'assignment'
            ? {
                cacheKey: 'teacherAssignmentsCache',
                fetchPage: window.fetchTeacherAssignments,
                find: () => (window._allAssignmentsFlat || []).findIndex(item => String(item.id) === id),
                select: index => window.selectDesktopAssignment?.(index)
            }
            : type === 'announcement'
                ? {
                    cacheKey: 'teacherAnnouncementCache',
                    fetchPage: window.fetchTeacherAnnouncements,
                    find: () => (window._allAnnouncementsFlat || []).findIndex(item => String(item.id) === id),
                    select: index => window.selectDesktopAnnouncement?.(index)
                }
                : null;

    if (!config || typeof config.fetchPage !== 'function') return;

    window[config.cacheKey] = null;
    await config.fetchPage();

    const target = config.find();
    if (target === undefined || target === -1 || target === null) return;
    config.select(target);
};

    const savedPage = sessionStorage.getItem("lastTeacherPage");

    if (savedPage === "teacher_announcements") {
        window.fetchTeacherAnnouncements();
    } else if (savedPage === "teacher_quizzes") {
        window.fetchTeacherQuizzes();
    } else if (savedPage === "teacher_evaluations") {
        window.fetchTeacherEvaluations();
    } else if (savedPage === "teacher_resources") {
        window.fetchTeacherResources();
    } else if (savedPage === "teacher_assignments") {
        window.fetchTeacherAssignments();
    } else if (savedPage === "teacher_analytics") {
        window.fetchTeacherAnalytics();
    } else if (savedPage === "teacher_grades") {
        window.fetchTeacherGrades();
    } else if (savedPage === "teacher_syllabus") {
        window.fetchTeacherSyllabus();
    } else if (savedPage === "teacher_calendar") {
    window.fetchTeacherCalendar();
    } else {
        window.loadTeacherManual();
    }

    // ─────────────────────────────────────────────
    // ACTIVE STATE
    // ─────────────────────────────────────────────
    window.setTeacherActive = function(page) {
        document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === page);
        });
        const topNavTabs = {
            teacher_syllabus: 'tab-syllabus',
            teacher_evaluations: 'tab-evaluations',
            teacher_analytics: 'tab-analytics',
            teacher_calendar: 'tab-calendar',
            teacher_settings: 'tab-settings'
        };
        if (typeof window.setTopNavTab === 'function') {
            window.setTopNavTab(topNavTabs[page] || null);
        }
    };

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — MOBILE
    // ─────────────────────────────────────────────
 window.toggleDesktopSidebar = function() {
    sidebar.classList.toggle('desktop-open');
    const svg = document.querySelector('#toggleIcon svg');
    if (svg) {
        const isOpen = sidebar.classList.contains('desktop-open');
        svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

 overlay?.addEventListener('click', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('desktop-open');
    } else {
        toggleSidebar(true);
    }
});

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — DESKTOP
    // ─────────────────────────────────────────────
    window.toggleDesktopSidebar = function() {
        sidebar.classList.toggle('desktop-open');
        const collapsed = !sidebar.classList.contains('desktop-open');
        const svg = document.querySelector('#toggleIcon svg');
        if (svg) {
            svg.style.transform = collapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    };

    document.getElementById('desktopMenuToggle')
        ?.addEventListener('click', toggleDesktopSidebar);

    // ─────────────────────────────────────────────
    // RESTORE DESKTOP SIDEBAR STATE
    // ─────────────────────────────────────────────
    if (window.innerWidth > 768) {
        const saved = localStorage.getItem('sidebarCollapsed') === 'true';
        if (saved) {
            sidebar.classList.add('desktop-open');
        }
    }

    // ─────────────────────────────────────────────
    // AUTO CLOSE SIDEBAR ON NAV CLICK + LOADER
    // ─────────────────────────────────────────────
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                if (typeof window.closeMobileSidebar === 'function') {
                    window.closeMobileSidebar();
                } else {
                    sidebar.classList.remove('active');
                    if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.pointerEvents = 'none';
                    }
                }
                return;
            }

            if (sidebar.classList.contains('desktop-open')) {
                sidebar.classList.remove('desktop-open');
            }
        });
    });

    // ─────────────────────────────────────────────
    // IFRAME LOAD — HIDE LOADER + SAVE STATE
    // ─────────────────────────────────────────────
    iframe?.addEventListener('load', () => {
        clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';

        try {
            const fullPage = iframe.contentWindow.location.pathname.split("/").pop()
                           + iframe.contentWindow.location.search;
            if (fullPage && !fullPage.startsWith('blank.php') && fullPage !== '') {
                sessionStorage.setItem("lastTeacherPage", fullPage);
            }
        } catch (e) {
            console.log("External or restricted page loaded, cannot save state.");
        }
    });

    // ─────────────────────────────────────────────
    // SETTINGS BUTTON
    // ─────────────────────────────────────────────
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        if (loader) loader.style.display = 'flex';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'teacher_settings.php';
        }
        if (apiArea) apiArea.style.display = 'none';

        document.querySelectorAll('.sidebar a').forEach(link => {
            link.classList.remove('active');
        });

        toggleSidebar(true);
    });

    // ─────────────────────────────────────────────
    // PROFILE UPLOAD
    // ─────────────────────────────────────────────
    const avatarWrapper = document.querySelector('.profile-picture-wrapper');
    const profileInput  = document.getElementById('teacherProfileInput');

    avatarWrapper?.addEventListener('click', () => profileInput.click());

    profileInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        updateTeacherAvatar(previewUrl);

        const fd = new FormData();
        fd.append('profile', file);

        fetch('upload_teacher_profile.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    updateTeacherAvatar('uploads/teachers/' + d.file + '?t=' + Date.now());
                } else {
                    alert(d.error || 'Upload failed');
                }
                profileInput.value = '';
            })
            .catch(() => {
                alert('Connection error during upload');
                profileInput.value = '';
            });
    });

    function updateTeacherAvatar(url) {
        let img = avatarWrapper.querySelector('img');
        if (img) {
            img.src = url;
        } else {
            const initials = avatarWrapper.querySelector('.initials-avatar');
            if (initials) initials.remove();
            const newImg = document.createElement('img');
            newImg.className = 'teacher-avatar teacher-avatar--uploaded';
            newImg.src = url;
            avatarWrapper.insertBefore(newImg, profileInput);
        }
    }

    // NOTE: no unconditional loader-hide here anymore. Previously this ran
    // synchronously right after loadTeacherManual() was kicked off above,
    // which hid the loader before that async function's own fetch had a
    // chance to resolve — undoing the 'flex' it had just set. Each function
    // that shows the loader (loadTeacherManual, the settings button handler,
    // the iframe 'load' listener) is responsible for hiding it again itself,
    // the same way the learner dashboard already does it.
});

// ── CALENDAR ──
window.calendarState = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
window.calendarEvents = [];

window.loadCalendar = async function(month, year) {
    const container = document.getElementById('snap-calendar');
    if (!container) return;

    container.innerHTML = `<div class="mini-cal-loading">Loading...</div>`;

    try {
        const res  = await fetch(`api/teacher/get_calendar_events.php?month=${month}&year=${year}`);
        const data = await res.json();
        window.calendarEvents = data.events || [];
        renderCalendar(month, year, window.calendarEvents);
    } catch(e) {
        container.innerHTML = `<div class="mini-cal-error">Failed to load calendar</div>`;
    }
};

function renderCalendar(month, year, events) {
    const container = document.getElementById('snap-calendar');
    if (!container) return;

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    const today     = new Date();
    const firstDay  = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    // Group events by date
    const eventMap = {};
    events.forEach(e => {
        const day = parseInt(e.date.split('-')[2]);
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push(e);
    });

    // Start from Monday — adjust firstDay
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

    let html = `
        <div class="cal-header">
            <button class="cal-nav" onclick="calPrev()">&#8249;</button>
            <span class="cal-month-title">${monthNames[month-1]} ${year}</span>
            <button class="cal-nav" onclick="calNext()">&#8250;</button>
            <button class="cal-add-btn" onclick="openReminderModal()">+</button>
        </div>
        <div class="cal-grid">
            <div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div>
            <div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div>
            <div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
            <div class="cal-day-label">Su</div>`;

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="cal-cell empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear());
        const dayEvents = eventMap[d] || [];
        const hasAssignment = dayEvents.some(e => e.type === 'assignment');
        const hasQuiz       = dayEvents.some(e => e.type === 'quiz');
        const hasReminder   = dayEvents.some(e => e.type === 'reminder');
        const hasAcademic   = dayEvents.some(e => e.type === 'academic');

        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        html += `
            <div class="cal-cell ${isToday ? 'cal-today' : ''} ${dayEvents.length > 0 ? 'cal-has-events' : ''}"
                onclick="openReminderModal('${dateStr}')"
                ${dayEvents.length > 0 ? `data-events='${JSON.stringify(dayEvents).replace(/'/g, "&#39;")}'` : ''}>
                <span class="cal-day-num">${d}</span>
                <div class="cal-dots">
                    ${hasAssignment ? '<span class="cal-dot dot-assignment"></span>' : ''}
                    ${hasQuiz       ? '<span class="cal-dot dot-quiz"></span>'       : ''}
                    ${hasReminder   ? '<span class="cal-dot dot-reminder"></span>'   : ''}
                    ${hasAcademic   ? '<span class="cal-dot dot-academic"></span>'   : ''}
                </div>
                ${dayEvents.length > 0 ? `
                <div class="cal-tooltip">
                    ${dayEvents.map(e => `
                        <div class="cal-tooltip-item cal-tooltip-${e.type}">
                            ${e.type === 'assignment' 
    ? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#a78bfa" stroke-width="2" fill="none" class="mini-cal-tooltip-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
   : e.type === 'quiz' 
? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#4fd1c5" stroke-width="2" fill="none" class="mini-cal-tooltip-icon"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
: e.type === 'academic'
? `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#f472b6" stroke-width="2" fill="none" class="mini-cal-tooltip-icon"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="#f59e0b" stroke-width="2" fill="none" class="mini-cal-tooltip-icon"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
}
                            ${e.title}${e.class_name ? ` <span class="mini-cal-tooltip-class-suffix">— ${e.class_name}</span>` : ''}
                        </div>`).join('')}
                </div>` : ''}
            </div>`;
    }

    html += `</div>

       <!-- Add Event Modal — two tabs -->
<div id="reminderModal" class="mini-cal-modal">
    <div class="mini-cal-modal-box">

        <!-- Header -->
        <div class="mini-cal-modal-header">
            <span class="mini-cal-modal-title">Add to Calendar</span>
            <button onclick="closeReminderModal()" class="mini-cal-modal-close">&times;</button>
        </div>

        <!-- Tabs -->
        <div class="mini-cal-tab-row">
            <button id="tabReminder"
                onclick="switchCalTab('reminder')"
                class="mini-cal-tab-btn mini-cal-tab-btn--reminder active">
                Personal Reminder
            </button>
            <button id="tabAcademic"
                onclick="switchCalTab('academic')"
                class="mini-cal-tab-btn mini-cal-tab-btn--academic">
                Academic Event
            </button>
        </div>

        <!-- REMINDER TAB -->
        <div id="calTabReminder">
            <label class="teacher-modal-label">Reminder Title</label>
            <input type="text" id="reminderTitle" class="teacher-modal-input" placeholder="e.g. Create Test">
            <label class="teacher-modal-label mini-cal-form-label-spaced">Date</label>
            <input type="date" id="reminderDate" class="teacher-modal-input">
            <div id="reminderError" class="mini-cal-form-error"></div>
            <div class="mini-cal-form-actions">
                <button onclick="closeReminderModal()" class="teacher-modal-cancel mini-cal-form-btn-half">Cancel</button>
                <button onclick="saveReminder()" class="teacher-modal-submit mini-cal-form-btn-half">Save</button>
            </div>
        </div>

        <!-- ACADEMIC EVENT TAB -->
        <div id="calTabAcademic" class="mini-cal-tab-panel-hidden">
            <label class="teacher-modal-label">Event Title</label>
            <input type="text" id="academicTitle" class="teacher-modal-input" placeholder="e.g. Term 2 Test Week">
            <label class="teacher-modal-label mini-cal-form-label-spaced">Date</label>
            <input type="date" id="academicDate" class="teacher-modal-input">
            <label class="teacher-modal-label mini-cal-form-label-spaced">Event Type</label>
            <select id="academicType" class="teacher-modal-input">
                <option value="test">Test</option>
                <option value="exam">Exam</option>
                <option value="holiday">Holiday</option>
                <option value="event">School Event</option>
                <option value="other">Other</option>
            </select>
            <label class="teacher-modal-label mini-cal-form-label-spaced">Class</label>
            <select id="academicClass" class="teacher-modal-input">
                <option value="">Loading classes...</option>
            </select>
            <div id="academicError" class="mini-cal-form-error"></div>
            <div class="mini-cal-form-actions">
                <button onclick="closeReminderModal()" class="teacher-modal-cancel mini-cal-form-btn-half">Cancel</button>
                <button onclick="saveAcademicEvent()" class="teacher-modal-submit mini-cal-form-btn-half">Post Event</button>
            </div>
        </div>

    </div>
</div>`;

    container.innerHTML = html;
}

window.calPrev = function() {
    let { month, year } = window.calendarState;
    month--;
    if (month < 1) { month = 12; year--; }
    window.calendarState = { month, year };
    window.loadCalendar(month, year);
};

window.calNext = function() {
    let { month, year } = window.calendarState;
    month++;
    if (month > 12) { month = 1; year++; }
    window.calendarState = { month, year };
    window.loadCalendar(month, year);
};

// FROM:
window.openReminderModal = function(dateStr = '') {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDate').value  = dateStr;
    document.getElementById('reminderError').style.display = 'none';
    modal.classList.add('open');
};

// TO:
window.openReminderModal = function(dateStr = '') {
    const modal = document.getElementById('reminderModal');
    if (!modal) return;
    // Reset reminder tab
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDate').value  = dateStr;
    document.getElementById('reminderError').style.display = 'none';
    // Reset academic tab
    document.getElementById('academicTitle').value = '';
    document.getElementById('academicDate').value  = dateStr;
    document.getElementById('academicError').style.display = 'none';
    // Always open on reminder tab
    switchCalTab('reminder');
    // Pre-load classes for academic tab
    window.loadAcademicClasses();
    modal.classList.add('open');
};

window.closeReminderModal = function() {
    const modal = document.getElementById('reminderModal');
    if (modal) modal.classList.remove('open');
};

window.saveReminder = async function() {
    const title = document.getElementById('reminderTitle').value.trim();
    const date  = document.getElementById('reminderDate').value;
    const err   = document.getElementById('reminderError');

    if (!title) { err.textContent = 'Please enter a title.'; err.style.display = 'block'; return; }
    if (!date)  { err.textContent = 'Please select a date.'; err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_reminder.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ title, date })
        });
        const data = await res.json();
        if (data.success) {
            closeReminderModal();
            window.loadCalendar(window.calendarState.month, window.calendarState.year);
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};

// ── TAB SWITCHER ──
window.switchCalTab = function(tab) {
    const isReminder = tab === 'reminder';

    document.getElementById('calTabReminder').classList.toggle('mini-cal-tab-panel-hidden', !isReminder);
    document.getElementById('calTabAcademic').classList.toggle('mini-cal-tab-panel-hidden', isReminder);

    const btnR = document.getElementById('tabReminder');
    const btnA = document.getElementById('tabAcademic');

    btnR.classList.toggle('active', isReminder);
    btnA.classList.toggle('active', !isReminder);
};

// ── LOAD CLASSES INTO ACADEMIC DROPDOWN ──
window.loadAcademicClasses = async function() {
    const select = document.getElementById('academicClass');
    if (!select) return;
    try {
        const res     = await fetch('api/teacher/get_classes.php');
        const classes = await res.json();
        select.innerHTML = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch(e) {
        select.innerHTML = '<option value="">Failed to load</option>';
    }
};

// ── SAVE ACADEMIC EVENT ──
window.saveAcademicEvent = async function() {
    const title     = document.getElementById('academicTitle').value.trim();
    const date      = document.getElementById('academicDate').value;
    const eventType = document.getElementById('academicType').value;
    const classId   = document.getElementById('academicClass').value;
    const err       = document.getElementById('academicError');

    err.style.display = 'none';

    if (!title)   { err.textContent = 'Please enter a title.';    err.style.display = 'block'; return; }
    if (!date)    { err.textContent = 'Please select a date.';    err.style.display = 'block'; return; }
    if (!classId) { err.textContent = 'Please select a class.';   err.style.display = 'block'; return; }

    try {
        const res  = await fetch('api/teacher/save_academic_event.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body:    JSON.stringify({ title, event_date: date, event_type: eventType, class_id: parseInt(classId) })
        });
        const data = await res.json();
        if (data.success) {
            closeReminderModal();
            window.loadCalendar(window.calendarState.month, window.calendarState.year);
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch(e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};