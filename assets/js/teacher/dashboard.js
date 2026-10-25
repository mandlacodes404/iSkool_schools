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
 * Builds the markup for the shared right-hand info rail — a fixed
 * third column reserved for contextual help text (and later,
 * potentially, an AI/chat assistant), collapsible via the chevron
 * button in its header. Call injectSharedTeacherDesktopLayoutStyles()
 * once per page load (already required for the flat layout) before
 * using this; it owns the rail's CSS too.
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
    const isCollapsed = !!window.teacherSectionState?.infoRailCollapsed;
    return `
        <div class="tchr-info-rail${isCollapsed ? ' collapsed' : ''}">
            <div class="tchr-info-rail-header"${headerId}>
                <div class="tchr-info-rail-header-text">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span${railId ? ` id="${railId}-header-text"` : ''}>${title}</span>
                </div>
                <button type="button" class="tchr-info-rail-toggle"
                    onclick="toggleInfoRail(this)"
                    aria-label="${isCollapsed ? 'Expand panel' : 'Collapse panel'}"
                    aria-expanded="${isCollapsed ? 'false' : 'true'}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
            <div class="tchr-info-rail-body"${bodyId}>${bodyHtml}</div>
        </div>`;
};

/**
 * Toggles the shared info rail between expanded and collapsed. Persists
 * the choice in window.teacherSectionState.infoRailCollapsed — shared
 * across all six pages that render this rail (Announcements,
 * Assignments, Quizzes, Resources, Syllabus, Evaluations, Grades), same
 * as collapsedGroups, so collapsing it on one page keeps it collapsed
 * when you switch to another.
 * @param {HTMLElement} toggleBtn - the button that was clicked (inside .tchr-info-rail-header)
 */
window.toggleInfoRail = function(toggleBtn) {
    const rail = toggleBtn?.closest('.tchr-info-rail');
    if (!rail) return;

    const isCollapsed = rail.classList.toggle('collapsed');
    toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    toggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand panel' : 'Collapse panel');

    window.teacherSectionState.infoRailCollapsed = isCollapsed;
    window.persistTeacherSectionState();
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
 * SHARED: TEACHER SEARCH BAR (desktop sidebar + mobile list)
 * ─────────────────────────────────────────────
 * Teacher-side port of the learner app's mobile/desktop search bar
 * (assets/js/learner/announcements.js — lanMobileSearch/lanDesktopSearch),
 * generalised so any teacher list page (Announcements, Assignments, and
 * future pages built on the same sidebar + class-group pattern) can drop
 * one in without re-implementing the markup, filtering, or auto-expand
 * behaviour each time.
 *
 * Filtering is done against a `data-title` attribute you put on each
 * filterable row/item when you build its HTML — this helper never reads
 * visible text out of the DOM, so it works the same regardless of a
 * row's internal markup. Class-group name text (the sidebar label or
 * mobile folder label) is always matched too, so searching a class name
 * surfaces that whole group even if no single item title matches it.
 *
 * Usage:
 *   1) In your page's render function, drop the markup where you want
 *      the bar to sit:
 *        desktop (top of sidebar, before the scroll container):
 *          window.buildTeacherSearchBar('an')
 *        mobile (top of the mobile list, inside .an-mobile-list):
 *          window.buildTeacherSearchBar('an', { mobile: true })
 *   2) Give each filterable item a data-title attribute, e.g.:
 *        <div class="an-sidebar-item" data-title="${escapeHtml(ann.title)}">
 *      (lowercasing happens inside the filter, so pass the raw title.)
 *   3) After apiArea.innerHTML = html, call once:
 *        window.wireTeacherSearchBar('an')
 *      This binds both the desktop and mobile inputs (whichever exist
 *      in the current DOM) — safe to call even if only one is present.
 *
 * @param {string} prefix - page prefix, e.g. 'an' (announcements), 'as' (assignments)
 * @param {object} [opts]
 * @param {boolean} [opts.mobile] - build the mobile-styled bar instead of desktop
 * @param {string}  [opts.placeholder] - override the input placeholder text
 * @returns {string}
 */
window.buildTeacherSearchBar = function(prefix, opts) {
    opts = opts || {};
    const mobile = !!opts.mobile;
    const placeholder = opts.placeholder || 'Search...';
    const wrapClass  = mobile ? `tchr-mobile-search-wrap`  : `tchr-desktop-search-wrap`;
    const inputClass = mobile ? `tchr-mobile-search`       : `tchr-desktop-search`;
    const inputId    = mobile ? `${prefix}MobileSearch`    : `${prefix}DesktopSearch`;
    return `
        <div class="${wrapClass}">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="${inputClass}" id="${inputId}" placeholder="${placeholder}">
        </div>`;
};

/**
 * Binds the input(s) built by buildTeacherSearchBar() for a given page
 * prefix. Call once per render, after the HTML is in the DOM. Filters
 * whichever of desktop/mobile is present; harmless if only one exists
 * (e.g. a page that hasn't added a mobile list yet).
 *
 * Desktop filtering targets `.tchr-sidebar-class-group` blocks (built by
 * buildCollapsibleClassGroup) and their preceding
 * `.tchr-sidebar-class-label--toggle` header. Mobile filtering targets
 * the same pairing rendered in a page's mobile list. Both read each
 * item's `data-title` attribute — see buildTeacherSearchBar's doc
 * comment above for how to set that on your rows.
 *
 * A matching group auto-expands (same as the learner version) so a
 * search result is never hidden inside a collapsed group; clearing the
 * search restores each group to whatever collapsed/expanded state it
 * had before (tracked via window.teacherSectionState.collapsedGroups,
 * same store buildCollapsibleClassGroup already uses).
 *
 * @param {string} prefix - same prefix passed to buildTeacherSearchBar, e.g. 'an'
 */
window.wireTeacherSearchBar = function(prefix) {
    const desktopInput = document.getElementById(`${prefix}DesktopSearch`);
    const mobileInput  = document.getElementById(`${prefix}MobileSearch`);

    function filterGroups(term) {
        term = term.toLowerCase().trim();
        document.querySelectorAll('.tchr-sidebar-class-group').forEach(group => {
            const header = group.previousElementSibling;
            const isHeader = header && header.classList.contains('tchr-sidebar-class-label--toggle');
            const labelSpan = isHeader ? header.querySelector('span') : null;
            const groupName = labelSpan ? labelSpan.textContent.toLowerCase() : '';

            const items = group.querySelectorAll('[data-title]');
            let visible = 0;
            items.forEach(item => {
                const title = (item.dataset.title || '').toLowerCase();
                const show = !term || title.includes(term) || groupName.includes(term);
                item.style.display = show ? '' : 'none';
                if (show) visible++;
            });

            const groupShow = !term || visible > 0 || groupName.includes(term);
            group.style.display = groupShow ? '' : 'none';
            if (isHeader) header.style.display = groupShow ? '' : 'none';

            if (!isHeader) return;
            if (term && visible) {
                group.classList.remove('collapsed');
                header.classList.remove('collapsed');
                header.setAttribute('aria-expanded', 'true');
            } else if (!term) {
                // Restore each group's own remembered collapsed state
                // rather than forcing everything open again.
                const groupId = group.id;
                const shouldBeCollapsed = groupId && window.teacherSectionState.collapsedGroups.has(groupId);
                group.classList.toggle('collapsed', !!shouldBeCollapsed);
                header.classList.toggle('collapsed', !!shouldBeCollapsed);
                header.setAttribute('aria-expanded', shouldBeCollapsed ? 'false' : 'true');
            }
        });
    }

    if (desktopInput) desktopInput.addEventListener('input', () => filterGroups(desktopInput.value));
    if (mobileInput)  mobileInput.addEventListener('input', () => filterGroups(mobileInput.value));
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
    const { title, mode, color } = config || {};

    const backBtn      = document.getElementById('teacherHeaderBackBtn');
    const backLabelEl  = document.getElementById('teacherHeaderBackLabel');
    const brandEl      = document.getElementById('teacherHeaderBrand');
    const detailTitleEl = document.getElementById('teacherHeaderDetailTitle');
    const titleEl      = document.getElementById('teacherHeaderTitle');
    const mobileBtn    = document.getElementById('mobileToggle');
    const rightSide    = document.getElementById('teacherHeaderRight');
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const topNavWrapper   = document.querySelector('.top-nav-wrapper');

    const isMobile = window.innerWidth <= 768;

    // ── Mobile signature-colour theming ─────────────────────────────────
    // Mirrors the learner side's configureHeader colour handling
    // (learner_dashboard.php): each page can pass its own accent
    // colour, stored globally so the scroll handler
    // (recalcTeacherMobileScrollUI) can keep the top nav background and
    // the browser's theme-color meta in sync with it once scrolled.
    // Pages that omit color leave teacherCurrentPageColor untouched —
    // NOT reset to the dark default — matching the learner convention
    // where only an explicit call (or mode:'standard' with no colour,
    // e.g. Home) clears it back to the base surface.
    if (isMobile && topNavWrapper) {
        if (color) {
            window.teacherCurrentPageColor = color;
            // (No border under the header on phones: see the end of the phone header block in teacher_dashboard.css.)
            topNavWrapper.setAttribute('data-page-color', color);
        } else {
            window.teacherCurrentPageColor = '#0d1117';
            topNavWrapper.removeAttribute('data-page-color');
        }
        // Tell the mobile scroll layer which view is about to show, so the
        // header/browser-bar state computed just below already reflects
        // where that view will be scrolled to (see MOBILE VIEW TRANSITIONS
        // in the DOMContentLoaded handler further down).
        if (typeof window.teacherBeginViewTransition === 'function') {
            const pageKey = sessionStorage.getItem('lastTeacherPage') || 'teacher_manual';
            const detailKey = (mode === 'detail' && (config.detailType || title))
                ? String(config.detailType || title) : 'list';
            window.teacherBeginViewTransition(pageKey + ':' + detailKey);
        }
        if (typeof window.recalcTeacherMobileScrollUI === 'function') {
            window.recalcTeacherMobileScrollUI();
        }
    }

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

    // Switching modes changes the top nav's rendered height (back button
    // + detail title vs. hamburger + brand), and the fixed top nav on
    // mobile relies on #api-content-area's offset matching that height
    // exactly (see recalcTeacherMobileScrollUI setup). Recheck on the
    // next frame so the offset and border/background state stay correct
    // immediately after a mode switch, not just after the next scroll.
    if (isMobile && typeof window.scheduleTeacherContentScrollUIRecheck === 'function') {
        window.scheduleTeacherContentScrollUIRecheck();
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

    if (detailType === 'Announcement') {
        if (typeof window.fetchTeacherAnnouncements === 'function') {
            window.fetchTeacherAnnouncements();
            return false;
        }
    }

    if (detailType === 'Quiz') {
        if (typeof window.fetchTeacherQuizzes === 'function') {
            window.fetchTeacherQuizzes();
            return false;
        }
    }

    if (detailType === 'Grade') {
        if (typeof window.fetchTeacherGrades === 'function') {
            window.fetchTeacherGrades();
            return false;
        }
    }

    if (detailType === 'Evaluation') {
        if (typeof window.fetchTeacherEvaluations === 'function') {
            window.fetchTeacherEvaluations();
            return false;
        }
    }

    if (detailType === 'SBO') {
        if (typeof window.fetchTeacherSyllabus === 'function') {
            window.fetchTeacherSyllabus();
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
 * - infoRailCollapsed: whether the shared right-hand info rail
 *   (buildInfoRail/toggleInfoRail) is collapsed. One flag shared across
 *   every page that renders the rail, not per-page — it's one physical
 *   panel the teacher is choosing to hide or show, same reasoning as
 *   collapsedGroups being shared rather than duplicated per page.
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
            collapsedGroups: new Set(parsed.collapsedGroups || []),
            infoRailCollapsed: !!parsed.infoRailCollapsed
        };
    } catch (e) {
        return { selection: {}, scrollTop: {}, collapsedGroups: new Set(), infoRailCollapsed: false };
    }
}

window.teacherSectionState = loadTeacherSectionState();

/**
 * Writes the current in-memory teacherSectionState to sessionStorage.
 * Called after every mutation (selection change, scroll, group
 * toggle, info rail toggle) so a refresh at any point picks up the
 * latest state.
 */
window.persistTeacherSectionState = function() {
    try {
        const s = window.teacherSectionState;
        sessionStorage.setItem(TEACHER_SECTION_STATE_KEY, JSON.stringify({
            selection: s.selection,
            scrollTop: s.scrollTop,
            collapsedGroups: Array.from(s.collapsedGroups),
            infoRailCollapsed: s.infoRailCollapsed
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
    document.documentElement.classList.add('teacher-home-active');
    // Home has no signature colour. Every other page calls
    // configureTeacherHeader, but Home never did, so after visiting any
    // coloured section (Assignments, Resources, ...) Home kept that
    // section's colour in the header and browser bar. Calling it with no
    // colour is the documented way to clear back to the base surface.
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ mode: 'standard' });
    }
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    // Serve from cache instantly — same short-circuit the learner
    // side uses in loadManual() (manual.js), so a cached repeat visit
    // never shows the loader at all.
    if (window.teacherManualCache && window.teacherSnapshotCache) {
        const isMobileCached = window.innerWidth <= 768;
        if (isMobileCached) {
            apiArea.innerHTML = renderMobileHomePanel(window.teacherSnapshotCache);
            window.loadMobileHomeClasses();
        } else {
            apiArea.innerHTML = buildTeacherDesktopHome(window.teacherSnapshotCache, window.teacherManualCache);

            window.loadCalendar(window.calendarState.month, window.calendarState.year); window.loadDesktopHomeClasses();
        }
        afterTeacherHomeRender();
        return;
    }

    // Cold load right after the login splash: the splash itself is the
    // loading state, so don't stack the pill loader on top of it. Mirrors
    // the learner side's suppressInitialLoader. Any later, in-session
    // navigation still shows the loader normally.
    if (loader && !window.suppressInitialLoader) loader.style.display = 'flex';

    try {
        const [manualRes, snapshotRes] = await Promise.all([
            fetch('partials/teacher_manual.html?v=1.5'),
            fetch('api/teacher/get_dashboard_snapshot.php')
        ]);
        const manualHtml = await manualRes.text();
        const snapshot   = await snapshotRes.json();

        window.teacherManualCache   = manualHtml;
        window.teacherSnapshotCache = snapshot;

        // Desktop: two column layout + manual. Mobile: activity trail,
        // upcoming week strip, and class list — the manual page itself
        // is still reachable from its own nav entry, it's just no
        // longer what mobile Home shows.
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            apiArea.innerHTML = renderMobileHomePanel(snapshot);
            window.loadMobileHomeClasses();
        } else {
            apiArea.innerHTML = buildTeacherDesktopHome(snapshot, manualHtml);
                
    window.loadCalendar(window.calendarState.month, window.calendarState.year); window.loadDesktopHomeClasses();

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
    // Home is now actually in the DOM — the signal the dashboard's splash
    // handoff (teacher_dashboard.php) waits on before hiding the splash it
    // inherited from index.php. Mirrors 'iskool:home-ready' on the learner
    // side (afterHomeRender in manual.js).
    try {
        window.dispatchEvent(new CustomEvent('iskool:teacher-home-ready'));
    } catch (e) {}

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
// DESKTOP HOME ("Focus" layout, .tdh-*)
// Desktop only; mobile keeps renderMobileHomePanel(). Mirrors the learner
// desktop home (buildDesktopHome in manual.js): one featured card (the
// latest quiz), your classes, what is coming and what you posted, with the
// calendar and Coming up in a side column. A teacher with nothing yet gets
// the getting-started variant. Data: get_dashboard_snapshot.php (quiz,
// assignment, announcement, trail, upcoming, teacher_name) and
// get_teacher_classes_summary.php. The calendar is the existing
// renderCalendar() mounted in #snap-calendar.
// ─────────────────────────────────────────────
window.TDH = {
    days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    colors: { quiz:'#4fd1c5', assignment:'#a78bfa', announcement:'#f59e0b', resource:'#f472b6', academic:'#f472b6', reminder:'#f59e0b' },
    names:  { quiz:'Quiz', assignment:'Assignment', announcement:'Announcement', resource:'Resource', reminder:'Reminder' },
    icons: {
        quiz: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        assignment: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
        announcement: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
        resource: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
        guide: '<path d="M2 5.5C4 4.5 7 4.5 12 7c5-2.5 8-2.5 10-1.5V19c-2-1-5-1-10 1.5C7 18 4 18 2 19z"/><path d="M12 7v13"/>',
        classes: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/>',
        calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        chevron: '<path d="m9 6 6 6-6 6"/>'
    },
    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    },
    svg(name, size = 19) {
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${this.icons[name] || ''}</svg>`;
    },
    tile(icon, color) { return `<span class="tdh-tile" style="--c:${color}">${this.svg(icon, 19)}</span>`; },
    chip(text) { return text ? `<span class="tdh-chip">${this.esc(text)}</span>` : ''; },
    row(o) {
        return `<button type="button" class="tdh-row" onclick="${o.go}">
            ${this.tile(o.icon, o.color)}
            <span class="tdh-row-text"><span class="tdh-row-title">${this.esc(o.title)}</span><span class="tdh-row-meta">${this.esc(o.meta)}</span></span>
            ${this.chip(o.chip)}
            ${o.when ? `<span class="tdh-when">${this.esc(o.when)}</span>` : ''}
            ${o.chevron ? `<span class="tdh-chev">${this.svg('chevron', 18)}</span>` : ''}
        </button>`;
    },
    empty(icon, title, text, actionHtml = '') {
        return `<div class="tdh-empty">${this.tile(icon, '#8b949e')}<div class="tdh-empty-body"><div class="tdh-row-title">${title}</div><div class="tdh-empty-text">${text}</div>${actionHtml ? `<div class="tdh-empty-action">${actionHtml}</div>` : ''}</div></div>`;
    },
    section(title, count, inner, action = '', id = '') {
        return `<section class="tdh-sec"><div class="tdh-sec-head"><h2>${title}</h2><span class="tdh-count"${id ? ` id="${id}"` : ''}>${count || ''}</span>${action}</div>${inner}</section>`;
    },
    hero(o) {
        return `<section class="tdh-hero" aria-label="${o.aria}">
            <div class="tdh-hero-top">${this.tile(o.icon, '#4fd1c5')}<span class="tdh-hero-label">${o.label}</span>${this.chip(o.chip)}</div>
            <h2 class="tdh-hero-title">${this.esc(o.title)}</h2>
            <p class="tdh-hero-text">${this.esc(o.text)}</p>
            <div class="tdh-hero-actions">
                <button type="button" class="tdh-btn" onclick="${o.go}">${o.cta}</button>
                ${o.link ? `<button type="button" class="tdh-link" onclick="${o.linkGo}">${o.link}</button>` : ''}
            </div>
        </section>`;
    }
};

// Where a click on the desktop home goes. Quizzes, assignments and
// announcements open the exact item (openTeacherSnapshotDetail); everything
// else opens its section page.
window.openTeacherHomeSection = function(type) {
    const fn = { quiz:'fetchTeacherQuizzes', assignment:'fetchTeacherAssignments', announcement:'fetchTeacherAnnouncements',
                 resource:'fetchTeacherResources', academic:'fetchTeacherCalendar', reminder:'fetchTeacherCalendar' }[type];
    if (fn && typeof window[fn] === 'function') return window[fn]();
};
window.openTeacherHomeItem = function(type, id) {
    if (id && (type === 'quiz' || type === 'assignment' || type === 'announcement')) return window.openTeacherSnapshotDetail(type, id);
    return window.openTeacherHomeSection(type);
};
window.openTeacherGuide = function() { document.getElementById('tdh-guide')?.showModal(); };

function buildTeacherDesktopHome(data, manualHtml) {
    const T = window.TDH, esc = T.esc.bind(T);
    data = data || {};
    const quiz = data.quiz, assignment = data.assignment, announcement = data.announcement;
    const trail = data.trail || [];
    const upcoming = data.upcoming || data.week_events || [];
    const name = data.teacher_name || '';
    const welcome = !quiz && !assignment && !announcement && !trail.length && !upcoming.length;

    // ── Heading ──
    const h = new Date().getHours();
    const title = welcome
        ? `Welcome to iSkool${name ? ', ' + name : ''}`
        : `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}${name ? ', ' + name : ''}`;
    const bits = [];
    if (assignment) bits.push(`${assignment.title} is due ${assignment.due_date}`);
    if (quiz && quiz.status === 'Open') bits.push(`${quiz.title} is open`);
    const sub = welcome
        ? 'Add your classes and create your first quiz. Everything you post will show up here.'
        : (bits.length ? bits.join(' and ') + '.' : 'You’re all caught up.');

    // ── Featured card: latest quiz, or the getting-started card ──
    const hero = quiz
        ? T.hero({ aria: 'Latest quiz', icon: 'quiz', label: 'Latest quiz', chip: quiz.status || '', title: quiz.title,
                   text: `${quiz.class_name}${quiz.start_time && quiz.start_time !== 'Not set' ? ', start date ' + quiz.start_time : ', no start date set'}`,
                   cta: 'Open quiz', go: `openTeacherHomeItem('quiz',${Number(quiz.id) || 0})`,
                   link: 'See all quizzes', linkGo: "openTeacherHomeSection('quiz')" })
        : T.hero({ aria: 'Getting started', icon: 'guide', label: welcome ? 'Getting started' : 'Quizzes', title: 'Create your first quiz',
                   text: 'Pick a class, add your questions and open it to your learners. Assignments, announcements and resources work the same way.',
                   cta: 'Go to quizzes', go: "openTeacherHomeSection('quiz')",
                   link: 'Open the guide', linkGo: 'openTeacherGuide()' });

    // ── Your classes (filled by loadDesktopHomeClasses) ──
    const classes = T.section('Your classes', '',
        `<div id="tdh-classes"><div class="tdh-empty tdh-loading">Loading classes…</div></div>`,
        `<button type="button" class="tdh-btn-ghost tdh-sec-action" onclick="openAddClassFlow()">+ Add class</button>`, 'tdh-classes-count');

    // ── At a glance (or "Start here" when there is nothing yet) ──
    let middle;
    if (welcome) {
        const start = [
            ['assignment', 'Post an assignment', 'Give a class work with a due date.'],
            ['announcement', 'Send an announcement', 'Share news with a class.'],
            ['resource', 'Upload a resource', 'Share notes and files with learners.']
        ];
        middle = T.section('Start here', '', `<div class="tdh-list">${start.map(s => T.row({
            go: `openTeacherHomeSection('${s[0]}')`, icon: s[0], color: T.colors[s[0]], title: s[1], meta: s[2], chevron: true })).join('')}</div>`);
    } else {
        const glance = [];
        if (assignment) {
            const n = Number(assignment.days_left);
            glance.push(T.row({ go: `openTeacherHomeItem('assignment',${Number(assignment.id) || 0})`, icon: 'assignment', color: T.colors.assignment,
                title: assignment.title, meta: `Assignment, ${assignment.class_name}, due ${assignment.due_date}`,
                chip: n <= 0 ? 'Due today' : n === 1 ? 'Tomorrow' : `In ${n} days`, chevron: true }));
        }
        if (announcement) {
            glance.push(T.row({ go: `openTeacherHomeItem('announcement',${Number(announcement.id) || 0})`, icon: 'announcement', color: T.colors.announcement,
                title: announcement.title, meta: `Announcement, ${announcement.class_name}, ${announcement.created_at}`, chevron: true }));
        }
        middle = T.section('At a glance', glance.length,
            glance.length ? `<div class="tdh-list">${glance.join('')}</div>`
                          : T.empty('assignment', 'Nothing upcoming', 'Assignments with a due date and your latest announcement will appear here.'));
    }

    // ── Recent activity (skipped in the getting-started view) ──
    const recent = welcome ? '' : T.section('Recent activity', trail.length,
        trail.length
            ? `<div class="tdh-list">${trail.map(it => T.row({
                  go: `openTeacherHomeItem('${esc(it.type)}',${Number(it.id) || 0})`, icon: T.icons[it.type] ? it.type : 'assignment',
                  color: T.colors[it.type] || T.colors.assignment, title: it.title,
                  meta: `${T.names[it.type] || 'Item'}${it.class_name ? ', ' + it.class_name : ''}`, when: it.time_label })).join('')}</div>`
            : T.empty('announcement', 'Nothing yet', 'Quizzes, assignments, announcements and resources you create will show up here.'));

    // ── Coming up ──
    const comingUp = T.section('Coming up', '',
        upcoming.length
            ? `<div class="tdh-list">${upcoming.map(e => {
                  const d = new Date(String(e.date || '') + 'T00:00:00'), ok = !isNaN(d);
                  const kind = e.type === 'academic' ? (e.label || 'School event') : (T.names[e.type] || e.label || '');
                  return `<div class="tdh-ev">
                      <div class="tdh-ev-date"><div class="tdh-ev-dow">${ok ? T.days[d.getDay()] : ''}</div><div class="tdh-ev-day">${ok ? d.getDate() : ''}</div></div>
                      <div class="tdh-row-text"><span class="tdh-row-title">${esc(e.type === 'assignment' ? e.title + ' due' : e.title)}</span><span class="tdh-ev-kind" style="color:${T.colors[e.type] || T.colors.reminder}">${esc(kind)}${e.class_name ? ' · ' + esc(e.class_name) : ''}</span></div>
                  </div>`; }).join('')}</div>`
            : T.empty('calendar', 'No dates yet', 'Due dates, quizzes and school events from the next 30 days will show here.'));

    return `
        <div class="tdh">
            <header class="tdh-head"><h1>${esc(title)}</h1><p>${esc(sub)}</p></header>
            <div class="tdh-cols">
                <div class="tdh-primary">${hero}${classes}${middle}${recent}</div>
                <aside class="tdh-aside">
                    <section class="tdh-cal" aria-label="Calendar"><div id="snap-calendar"></div></section>
                    ${comingUp}
                </aside>
            </div>
            ${welcome ? '' : `
            <section class="tdh-strip" aria-label="Guide">
                <div><div class="tdh-strip-title">New to iSkool?</div><div class="tdh-strip-text">A short guide walks you through the teacher dashboard.</div></div>
                <button type="button" class="tdh-btn-ghost" onclick="openTeacherGuide()">Open the guide</button>
            </section>`}
            <dialog id="tdh-guide" class="tdh-guide" aria-label="iSkool guide" onclick="if(event.target===this)this.close()">
                <div class="tdh-guide-head"><h2>Guide</h2><button type="button" class="tdh-btn-ghost" onclick="this.closest('dialog').close()">Close</button></div>
                ${manualHtml || ''}
            </dialog>
        </div>
        ${TEACHER_SUBJECT_MODAL_HTML}`;
}

// Paints "Your classes" on the desktop home. Same source and add-subject
// flow as the mobile list (get_teacher_classes_summary.php, openAddClassFlow,
// openAddSubjectFlow). The last result is cached so a repeat visit paints
// instantly, then refreshes.
window.loadDesktopHomeClasses = async function() {
    const T = window.TDH, esc = T.esc.bind(T);
    const paint = classes => {
        const box = document.getElementById('tdh-classes');
        if (!box) return;
        const count = document.getElementById('tdh-classes-count');
        if (count) count.textContent = classes.length || '';
        if (!classes.length) {
            box.innerHTML = T.empty('classes', 'No classes yet',
                'Classes you post to appear here on their own. Add the ones you teach and name your subject for each.',
                `<button type="button" class="tdh-btn" onclick="openAddClassFlow()">Add a class</button>`);
            return;
        }
        box.innerHTML = `<div class="tdh-classes">${classes.map(c => `
            <div class="tdh-class">
                <div class="tdh-class-name">${esc(c.name)}</div>
                <div class="tdh-class-sub">${c.needs_subject
                    ? `<button type="button" class="tdh-link" data-id="${Number(c.id) || 0}" data-name="${esc(c.name)}" onclick="openAddSubjectFlow(Number(this.dataset.id), this.dataset.name)">+ Add subject</button>`
                    : esc(c.subject_name)}</div>
                <span class="tdh-chip">${Number(c.learner_count) || 0} learner${Number(c.learner_count) === 1 ? '' : 's'}</span>
            </div>`).join('')}</div>`;
    };
    if (window.teacherClassesCache) paint(window.teacherClassesCache);
    try {
        const res  = await fetch('api/teacher/get_teacher_classes_summary.php');
        const data = await res.json();
        window.teacherClassesCache = data.classes || [];
        paint(window.teacherClassesCache);
    } catch (e) {
        if (!window.teacherClassesCache) {
            const box = document.getElementById('tdh-classes');
            if (box) box.innerHTML = `<div class="tdh-empty">Failed to load classes.</div>`;
        }
    }
};

// ─────────────────────────────────────────────
// MOBILE HOME PANEL
// Three sections: Recent activity (trail), Upcoming (week strip +
// event rows), Your classes (name + learner count). Built from the
// same get_dashboard_snapshot.php payload renderSnapshotPanel() uses
// on desktop, plus a dedicated classes-with-counts fetch.
// ─────────────────────────────────────────────

const MOBILE_TRAIL_ICONS = {
    quiz: {
        color: '#4fd1c5',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#4fd1c5" stroke-width="2" fill="none"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
    },
    assignment: {
        color: '#a78bfa',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#a78bfa" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
    },
    announcement: {
        color: '#f59e0b',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#f59e0b" stroke-width="2" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
    },
    resource: {
        color: '#f472b6',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#f472b6" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
    }
};

const MOBILE_TRAIL_VERB = {
    quiz:         'Created quiz',
    assignment:   'Created assignment',
    announcement: 'Posted announcement to',
    resource:     'Uploaded resource'
};

// Where each trail-item type opens on tap. Mirrors openTeacherSnapshotDetail's
// type dispatch — resources aren't wired into that function yet, so a
// resource tap is a no-op until a resource detail route exists.
function mobileTrailOnclick(item) {
    if (item.type === 'resource') return '';
    return `openTeacherSnapshotDetail('${item.type}', ${item.id})`;
}

function renderMobileTrail(trail) {
    const X = window.THX, T = window.TDH;
    const items = (trail || []).filter(it => it && T.icons[it.type]).slice(0, 3);
    if (!items.length) return '';
    return X.section('Recent activity') + items.map(it => X.row({
        go: X.go(it.type), icon: it.type, title: it.title,
        meta: [X.verbs[it.type], it.class_name, it.time_label].filter(Boolean).join(' · ')
    })).join('');
}

const WEEK_EVENT_META = {
    assignment: { color: '#a78bfa', dot: 'dot-assignment' },
    quiz:       { color: '#4fd1c5', dot: 'dot-quiz' },
    academic:   { color: '#f472b6', dot: 'dot-academic' },
    reminder:   { color: '#f59e0b', dot: 'dot-reminder' }
};

function renderMobileWeekStrip(weekEvents, weekStart) {
    const T = window.TDH, e = T.esc.bind(T), pad = n => String(n).padStart(2, '0');
    const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const month = d => d.toLocaleString('default', { month: 'short' });
    const events = weekEvents || [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // weekStart from the backend is a Monday; fall back to this week's Monday.
    let monday = new Date(String(weekStart || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(monday)) { monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); }
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dots = new Set(events.map(ev => String(ev.date).slice(0, 10)));

    let cells = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        const isToday = d.getTime() === today.getTime();
        cells += `<span class="thx-day${isToday ? ' thx-day--today' : ''}"><span class="thx-day-label">${names[i]}</span><span class="thx-day-num">${d.getDate()}</span><span class="thx-day-dot${dots.has(key(d)) ? ' thx-day-dot--on' : ''}"></span></span>`;
    }
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const range = `${monday.getDate()} ${month(monday)} – ${sunday.getDate()} ${month(sunday)}`;

    const list = events.slice(0, 2).map(ev => {
        const d = new Date(String(ev.date).slice(0, 10) + 'T00:00:00');
        const when = isNaN(d) ? '' : `${T.days[d.getDay()]} ${d.getDate()} ${month(d)}`;
        return `<span class="thx-ev"><span class="thx-ev-date">${e(when)}</span><span class="thx-ev-title">${e(ev.title)}</span><span class="thx-ev-kind">${e(ev.label)}</span></span>`;
    }).join('') || '<span class="thx-ev-empty">Nothing on the calendar this week</span>';

    return `${window.THX.section('This week', range)}
        <button type="button" class="thx-week-card" aria-label="Open calendar, ${e(range)}" onclick="window.fetchTeacherCalendar ? fetchTeacherCalendar() : null">
            <span class="thx-week">${cells}</span>
            <span class="thx-ev-list">${list}</span>
        </button>`;
}

function renderMobileClassList() {
    // Populated async by loadMobileHomeClasses() once the fetch resolves.
    // Until then, hold the height the list had last time. Without that,
    // Home is too short to scroll back to where you left it, so the
    // restored position could only be applied once the classes arrived,
    // and you would watch Home sit at the top and then jump.
    let reserve = 0;
    try { reserve = parseInt(sessionStorage.getItem('teacherHomeClassListH') || '0', 10) || 0; } catch (e) {}
    const style = reserve > 0 ? ` style="min-height:${reserve}px"` : '';
    return `<div id="mh-class-list" class="thx-list"${style}><div class="thx-note">Loading classes...</div></div>`;
}

// Wraps the loader below: once the list has its real content, drop the
// reserved height and remember the real one for next time.
window.loadMobileHomeClasses = async function() {
    await window._loadMobileHomeClassesInner();
    const box = document.getElementById('mh-class-list');
    if (!box) return;
    box.style.minHeight = '';
    try { sessionStorage.setItem('teacherHomeClassListH', String(Math.round(box.getBoundingClientRect().height))); } catch (e) {}
};

window._loadMobileHomeClassesInner = async function() {
    const container = document.getElementById('mh-class-list');
    if (!container) return;
    try {
        const res  = await fetch('api/teacher/get_teacher_classes_summary.php');
        const data = await res.json();
        const classes = data.classes || [];

        if (classes.length === 0) {
            container.innerHTML = `
                <div class="thx-note">
                    No classes yet — post something to a class, or add one below.
                </div>`;
            return;
        }

        const T = window.TDH;
        container.innerHTML = classes.map(c => {
            const initials = String(c.name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
            const subjectLine = c.needs_subject
                ? `<span class="thx-add-subject" data-name="${T.esc(c.name)}" onclick="event.stopPropagation(); window.openAddSubjectFlow(${Number(c.id) || 0}, this.dataset.name)">+ Add subject</span>`
                : T.esc(c.subject_name);
            const n = Number(c.learner_count) || 0;
            return `
                <button type="button" class="thx-row" onclick="window.openTeacherClassFromHome(${Number(c.id) || 0})">
                    <span class="thx-tile">${T.esc(initials)}</span>
                    <span class="thx-rt"><span class="thx-rt-title">${T.esc(c.name)}</span><span class="thx-rt-meta">${subjectLine} &middot; ${n} learner${n !== 1 ? 's' : ''}</span></span>
                    <span class="thx-chev">${T.svg('chevron', 18)}</span>
                </button>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="thx-note">Failed to load classes.</div>`;
    }
};

// ── Add class / Add subject modal ──
// Both flows write to teacher_subjects via save_teacher_subject.php,
// so they share one modal. "Add class" mode shows a class dropdown
// (populated from get_unlinked_classes.php) plus a subject field.
// "Add subject" mode locks the class (already known) and shows just
// the subject field. Same open/close/save shape as reminderModal.

window.openAddClassFlow = function() {
    const modal = document.getElementById('teacherSubjectModal');
    if (!modal) return;

    document.getElementById('tsModalTitle').textContent = 'Add a class';
    document.getElementById('tsClassFieldWrap').style.display = 'block';
    document.getElementById('tsSubjectInput').value = '';
    document.getElementById('tsError').style.display = 'none';
    document.getElementById('tsLockedClassId').value = '';

    window.loadUnlinkedClassesIntoModal();
    modal.classList.add('open');
};

window.openAddSubjectFlow = function(classId, className) {
    const modal = document.getElementById('teacherSubjectModal');
    if (!modal) return;

    document.getElementById('tsModalTitle').textContent = `Add subject — ${className || 'this class'}`;
    document.getElementById('tsClassFieldWrap').style.display = 'none';
    document.getElementById('tsSubjectInput').value = '';
    document.getElementById('tsError').style.display = 'none';
    document.getElementById('tsLockedClassId').value = classId;

    modal.classList.add('open');
};

window.closeTeacherSubjectModal = function() {
    const modal = document.getElementById('teacherSubjectModal');
    if (modal) modal.classList.remove('open');
};

window.loadUnlinkedClassesIntoModal = async function() {
    const select = document.getElementById('tsClassSelect');
    if (!select) return;
    select.innerHTML = `<option value="">Loading classes...</option>`;
    try {
        const res  = await fetch('api/teacher/get_unlinked_classes.php');
        const data = await res.json();
        const classes = data.classes || [];
        if (classes.length === 0) {
            select.innerHTML = `<option value="">No more classes to add</option>`;
            return;
        }
        select.innerHTML = `<option value="">Select a class</option>` +
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
        select.innerHTML = `<option value="">Failed to load classes</option>`;
    }
};

window.saveTeacherSubject = async function() {
    const lockedClassId = document.getElementById('tsLockedClassId').value;
    const isAddClass = !lockedClassId;
    const classId = isAddClass
        ? document.getElementById('tsClassSelect').value
        : lockedClassId;
    const subjectName = document.getElementById('tsSubjectInput').value.trim();
    const err = document.getElementById('tsError');

    if (isAddClass && !classId) {
        err.textContent = 'Please select a class.'; err.style.display = 'block'; return;
    }
    if (!subjectName) {
        err.textContent = 'Please enter a subject.'; err.style.display = 'block'; return;
    }

    try {
        const res = await fetch('api/teacher/save_teacher_subject.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ class_id: classId, subject_name: subjectName })
        });
        const data = await res.json();
        if (data.success) {
            closeTeacherSubjectModal();
            window.loadMobileHomeClasses();
            window.teacherClassesCache = null;   // desktop home: refetch so the new subject shows
            window.loadDesktopHomeClasses?.();
        } else {
            err.textContent = data.error || 'Failed to save.';
            err.style.display = 'block';
        }
    } catch (e) {
        err.textContent = 'Connection error.';
        err.style.display = 'block';
    }
};

// Navigates to a class's mobile hub. Mirrors the class-picker's own
// selection behaviour (class-picker.js) by writing the same session
// value it reads, then routing to the shared class-scoped view — swap
// the two lines below for whatever that view's actual entry point is
// if it differs from this guess.
window.openTeacherClassFromHome = function(classId) {
    if (window.selectClassById) {
        window.selectClassById(classId);
    } else {
        window.location.hash = `#class/${classId}`;
    }
};

const TEACHER_SUBJECT_MODAL_HTML = `
<div id="teacherSubjectModal" class="mini-cal-modal">
    <div class="mini-cal-modal-box">
        <div class="mini-cal-modal-header">
            <span id="tsModalTitle" class="mini-cal-modal-title">Add a class</span>
            <button onclick="closeTeacherSubjectModal()" class="mini-cal-modal-close">&times;</button>
        </div>

        <div id="tsClassFieldWrap">
            <label class="teacher-modal-label">Class</label>
            <select id="tsClassSelect" class="teacher-modal-input">
                <option value="">Loading classes...</option>
            </select>
        </div>
        <input type="hidden" id="tsLockedClassId" value="">

        <label class="teacher-modal-label mini-cal-form-label-spaced">Subject</label>
        <input type="text" id="tsSubjectInput" class="teacher-modal-input" placeholder="e.g. Mathematics">

        <div id="tsError" class="mini-cal-form-error"></div>
        <div class="mini-cal-form-actions">
            <button onclick="closeTeacherSubjectModal()" class="teacher-modal-cancel mini-cal-form-btn-half">Cancel</button>
            <button onclick="saveTeacherSubject()" class="teacher-modal-submit mini-cal-form-btn-half">Save</button>
        </div>
    </div>
</div>`;

// ─────────────────────────────────────────────
// MOBILE HOME ("Focus" layout)
// Greeting, one featured card (the latest quiz), what needs attention, a
// Mon–Sun week strip, your classes and what you posted. Phones only: desktop
// keeps buildTeacherDesktopHome(). Mirrors the learner phone Home
// (buildMobileHomeV2 in manual.js). Data: get_dashboard_snapshot.php.
// ─────────────────────────────────────────────
window.THX = {
    arrow: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    verbs: { quiz: 'Created quiz', assignment: 'Created assignment', announcement: 'Posted announcement', resource: 'Uploaded resource' },

    // Phones open the section page (openTeacherSnapshotDetail is desktop only).
    go(type) { return `openTeacherHomeSection('${type}')`; },
    section(title, meta) {
        const e = window.TDH.esc.bind(window.TDH);
        return `<div class="thx-st"><span class="thx-st-title">${e(title)}</span>${meta !== undefined && meta !== '' ? `<span class="thx-st-meta">${e(meta)}</span>` : ''}</div>`;
    },
    hero(o) {
        const e = window.TDH.esc.bind(window.TDH);
        return `<button type="button" class="thx-hero${o.calm ? ' thx-hero--calm' : ''}" onclick="${o.go}">
            <span class="thx-chip-hero">${e(o.chip)}</span>
            <span class="thx-hero-row">
                <span class="thx-hero-text"><span class="thx-hero-title">${e(o.title)}</span>${o.sub ? `<span class="thx-hero-sub">${e(o.sub)}</span>` : ''}</span>
                <span class="thx-go" aria-hidden="true">${this.arrow}</span>
            </span>
        </button>`;
    },
    row(o) {
        const T = window.TDH, e = T.esc.bind(T);
        return `<button type="button" class="thx-row" onclick="${o.go}">
            <span class="thx-tile">${T.svg(o.icon, 20)}</span>
            <span class="thx-rt"><span class="thx-rt-title">${e(o.title)}</span><span class="thx-rt-meta">${e(o.meta)}</span></span>
            ${o.chip ? `<span class="thx-chip${o.soon ? ' thx-chip--soon' : ''}">${e(o.chip)}</span>` : ''}
            ${o.chevron ? `<span class="thx-chev">${T.svg('chevron', 18)}</span>` : ''}
        </button>`;
    }
};

function renderMobileHomePanel(snapshot) {
    const X = window.THX, T = window.TDH, e = T.esc.bind(T);
    const data = snapshot || {};
    const quiz = data.quiz, assignment = data.assignment, announcement = data.announcement;
    const trail = data.trail || [];
    const events = data.week_events || data.upcoming || [];
    const welcome = !quiz && !assignment && !announcement && !trail.length && !events.length;
    const name = String(data.teacher_name || '').trim();
    const h = new Date().getHours();
    const hello = welcome ? 'Welcome to iSkool' : `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}`;

    // ── Featured card: latest quiz, or the getting-started card ──
    const hero = quiz
        ? X.hero({ go: X.go('quiz'), chip: quiz.status ? `Quiz · ${quiz.status}` : 'Latest quiz', title: quiz.title,
                   sub: [quiz.class_name, quiz.start_time && quiz.start_time !== 'Not set' ? `Start date ${quiz.start_time}` : 'No start date set'].filter(Boolean).join(' · ') })
        : X.hero({ calm: true, go: X.go('quiz'), chip: welcome ? 'Getting started' : 'Quizzes', title: 'Create your first quiz',
                   sub: 'Pick a class, add your questions and open it to your learners.' });

    // ── At a glance (or "Start here" when there is nothing yet) ──
    let middle = '';
    if (welcome) {
        middle = X.section('Start here') + [
            ['assignment', 'Post an assignment', 'Give a class work with a due date.'],
            ['announcement', 'Send an announcement', 'Share news with a class.'],
            ['resource', 'Upload a resource', 'Share notes and files with learners.']
        ].map(s => X.row({ go: X.go(s[0]), icon: s[0], title: s[1], meta: s[2], chevron: true })).join('');
    } else {
        const glance = [];
        if (assignment) {
            const n = Number(assignment.days_left);
            glance.push(X.row({ go: X.go('assignment'), icon: 'assignment', title: assignment.title,
                meta: `Assignment · ${assignment.class_name} · Due ${assignment.due_date}`,
                chip: isNaN(n) ? '' : n <= 0 ? 'Due today' : n === 1 ? 'Tomorrow' : `In ${n} days`, soon: !isNaN(n) && n <= 1 }));
        }
        if (announcement) {
            glance.push(X.row({ go: X.go('announcement'), icon: 'announcement', title: announcement.title,
                meta: `Announcement · ${announcement.class_name} · ${announcement.created_at}` }));
        }
        if (glance.length) middle = X.section('At a glance', glance.length) + glance.join('');
    }

    return `
        <div class="thx">
            ${data.school_name ? `<div class="thx-top"><span class="thx-top-dot"></span><span class="thx-top-text">${e(data.school_name)}</span></div>` : ''}
            <div class="thx-greet">${name
                ? `<div class="thx-hello">${hello}</div><div class="thx-name">${e(name)}</div>`
                : `<div class="thx-name">${hello}</div>`}</div>
            ${hero}
            ${middle}
            ${renderMobileWeekStrip(events, data.week_start)}

            <div class="thx-st">
                <span class="thx-st-title thx-st-left">Your classes
                    <button type="button" class="thx-info-btn" onclick="window.toggleMobileHomeInfo()" aria-label="How this list works">${X.info}</button>
                </span>
                <button type="button" class="thx-add" onclick="window.openAddClassFlow()">+ Add class</button>
            </div>
            <div id="thx-classes-info" class="thx-info thx-info--hidden">
                Classes you've posted to appear here automatically. Add others you teach with
                <b>+ Add class</b>, and name your subject for each so learners see it instead of your name.
            </div>
            ${renderMobileClassList()}

            ${renderMobileTrail(trail)}
        </div>
        ${TEACHER_SUBJECT_MODAL_HTML}`;
}

window.toggleMobileHomeInfo = function() {
    const el = document.getElementById('thx-classes-info');
    if (el) el.classList.toggle('thx-info--hidden');
};

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
        document.documentElement.classList.toggle('teacher-home-active', page === 'teacher_manual');
        document.documentElement.dataset.teacherPage = page || '';
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
    window.setTeacherActive(sessionStorage.getItem('lastTeacherPage') || 'teacher_manual');

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

    // ─────────────────────────────────────────────────────────────────────
    // DYNAMIC TOP NAV / BOTTOM NAV — mobile only
    // Mirrors the learner side's recalcMobileScrollUI: watches
    // #api-content-area's scroll position and toggles two classes,
    // border/background only (no colour changes):
    //   .top-nav-wrapper  gets 'header-scrolled' once scrolled down past
    //                     a small threshold (border fades in).
    //   #mobileBottomNav  gets 'nav-scrolled' whenever NOT within a small
    //                     distance of the bottom of the page (background
    //                     fades in); it's removed again once back near
    //                     the bottom.
    // Exposed globally (window.recalcTeacherMobileScrollUI) so
    // page-specific scripts (assignments.js, announcements.js, etc.) can
    // trigger a recalculation after anything that changes the page's
    // scrollable height without a real scroll event — e.g. expanding an
    // accordion, a class-group collapsing, or content swapping in via
    // fetch. Without that, the nav could get stuck showing a background
    // that no longer matches whether the page can actually scroll.
    // ─────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────
    // ACTIVE-TAB TAP — pressing the nav tab you are already on scrolls
    // that page back to the top (same convention as the learner side).
    //
    // This is deliberately the ONLY thing that happens on a nav press.
    // An earlier version reset the scroll position, header tint and
    // browser-bar colour the instant a link was touched. That made the
    // current page visibly jump, and made the header/browser bar flash to
    // their "at top" look and then flash back once a remembered scroll
    // position was restored 100-700ms later. Everything that changes when
    // you ARRIVE on a page (scroll offset, header tint, browser bar,
    // bottom nav) now happens together, in one step, in the MOBILE VIEW
    // TRANSITIONS block further down.
    //
    // Uses pointerdown rather than click: by the time click fires, the
    // inline onclick has already loaded the page and rewritten
    // lastTeacherPage, so "is this the page I was already on" can no
    // longer be answered.
    // ─────────────────────────────────────────────────────────────────────
    window.prepareTeacherMobileNavigation = function(link) {
        if (window.innerWidth > 768 || !apiArea) return;
        const tapped  = link && link.getAttribute ? link.getAttribute('data-page') : null;
        const current = sessionStorage.getItem('lastTeacherPage');
        if (!tapped || tapped !== current || window.teacherHeaderDetailType) return;
        if (apiArea.scrollTop > 0) {
            apiArea.style.scrollBehavior = 'auto';
            apiArea.scrollTop = 0;
        }
        if (typeof window.teacherForgetMobileScroll === 'function') window.teacherForgetMobileScroll();
    };

    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('pointerdown', () => {
            window.prepareTeacherMobileNavigation(link);
        }, { passive: true });
    });

    if (window.innerWidth <= 768) {
        const topNavWrapper = document.querySelector('.top-nav-wrapper');
        const bottomNav     = document.getElementById('mobileBottomNav');
        const SCROLL_THRESHOLD = 10; // px before top nav border solidifies
        const BOTTOM_THRESHOLD = 10; // px from bottom before bottom nav fades out

        // Sets #api-content-area's top offset to the fixed top nav's
        // actual rendered height, since row 1 + row 2 height can vary
        // (e.g. school name wrapping, safe-area insets on notched
        // devices) — the CSS fallback value only covers the common case.
        window.applyTeacherTopNavOffset = function() {
            if (!topNavWrapper || !apiArea) return;
            const height = topNavWrapper.getBoundingClientRect().height;
            if (height > 0) {
                apiArea.style.marginTop = height + 'px';
            }
        };

        window.recalcTeacherMobileScrollUI = function recalcTeacherMobileScrollUI() {
            if (!apiArea || !topNavWrapper) return;

            // While a page transition is in flight, judge the header, browser
            // bar and bottom nav by where the incoming page is about to be
            // scrolled to — not by the position the outgoing content
            // happens to be at. That is what lets them go straight to their
            // final look instead of flashing the "at top" look first. See
            // MOBILE VIEW TRANSITIONS below.
            const pending        = window._teacherPendingScroll;
            const realScrollTop  = apiArea.scrollTop;
            const scrollTop      = pending ? pending.target : realScrollTop;
            const scrollHeight   = apiArea.scrollHeight;
            const clientHeight   = apiArea.clientHeight;
            let distFromBottom   = scrollHeight - realScrollTop - clientHeight;
            if (pending && pending.atBottom !== undefined) {
                distFromBottom = pending.atBottom ? 0 : BOTTOM_THRESHOLD + 1;
            }

            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            const pageColor      = topNavWrapper.getAttribute('data-page-color');

            // While the mobile menu drawer is open, its own toggle logic
            // (toggleSidebar/closeMobileSidebar in teacher_dashboard.php)
            // owns the browser's theme-color so it matches the drawer's
            // background. Skip touching it here or a scroll recalculation
            // firing while the drawer is open would immediately overwrite
            // that colour back to the page's own value.
            const sidebarEl = document.querySelector('.sidebar');
            const sidebarOpen = sidebarEl && sidebarEl.classList.contains('active');

            // Top nav: border appears once scrolled down, transparent at top.
            // Once a page has a signature colour (data-page-color, set by
            // configureTeacherHeader), scrolling also tints the header
            // background and the browser's status bar to match it —
            // mirrors the learner side's recalcMobileScrollUI exactly.
            // While the menu is open, toggleSidebar (teacher_dashboard.php)
            // has recoloured the header to the menu's own colour so it
            // blends with the curved seam, and saved the real value in
            // data-bg-before-menu to restore on close. So the header
            // BACKGROUND is skipped here while open — same reason the
            // browser bar is — otherwise a recalc firing mid-open (scroll,
            // MutationObserver, timed rechecks) would repaint the page
            // colour over the menu. When the menu is open, the value that
            // will be restored on close is kept current instead.
            if (scrollTop > SCROLL_THRESHOLD) {
                topNavWrapper.classList.add('header-scrolled');
                if (pageColor) {
                    if (sidebarOpen) {
                        topNavWrapper.dataset.bgBeforeMenu = pageColor;
                    } else {
                        topNavWrapper.style.background = pageColor;
                    }
                    if (themeColorMeta && !sidebarOpen) themeColorMeta.setAttribute('content', pageColor);
                }
            } else {
                topNavWrapper.classList.remove('header-scrolled');
                if (sidebarOpen) {
                    topNavWrapper.dataset.bgBeforeMenu = '';
                } else {
                    topNavWrapper.style.background = '';
                }
                if (themeColorMeta && !sidebarOpen) themeColorMeta.setAttribute('content', '#0d1117');
            }

            // Bottom nav: transparent near bottom, glass background when scrolled up
            if (bottomNav) {
                if (distFromBottom <= BOTTOM_THRESHOLD) {
                    bottomNav.classList.remove('nav-scrolled');
                } else {
                    bottomNav.classList.add('nav-scrolled');
                }
            }
        };
        const recalcTeacherMobileScrollUI = window.recalcTeacherMobileScrollUI;

        if (apiArea && topNavWrapper) {
            window.applyTeacherTopNavOffset();
            apiArea.addEventListener('scroll', recalcTeacherMobileScrollUI, { passive: true });

            // Not every teacher section uses the loader or has its own
            // recheck helper, and pages render into #api-content-area via
            // very different paths (innerHTML swap, async fetch, cache
            // hit, accordion toggle, filter change). Observing that
            // shared container means the nav settles on the correct state
            // regardless of which path populated it, without requiring
            // the teacher to scroll first. The delayed checks also cover
            // CSS height transitions, whose final size isn't available
            // inside the mutation callback itself.
            let contentRecheckFrame = null;
            let contentRecheckTimers = [];
            const scheduleTeacherContentScrollUIRecheck = () => {
                if (contentRecheckFrame !== null) {
                    cancelAnimationFrame(contentRecheckFrame);
                }
                contentRecheckTimers.forEach(clearTimeout);
                contentRecheckTimers = [];

                contentRecheckFrame = requestAnimationFrame(() => {
                    contentRecheckFrame = requestAnimationFrame(() => {
                        contentRecheckFrame = null;
                        window.applyTeacherTopNavOffset();
                        recalcTeacherMobileScrollUI();
                    });
                });

                [150, 400].forEach(delay => {
                    contentRecheckTimers.push(setTimeout(() => {
                        window.applyTeacherTopNavOffset();
                        recalcTeacherMobileScrollUI();
                    }, delay));
                });
            };
            window.scheduleTeacherContentScrollUIRecheck = scheduleTeacherContentScrollUIRecheck;

            const contentObserver = new MutationObserver(scheduleTeacherContentScrollUIRecheck);
            contentObserver.observe(apiArea, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'open']
            });

            // Also observe the top nav itself, since row 2 tabs or the
            // detail-mode back button (configureTeacherHeader) can change
            // its rendered height independent of any #api-content-area
            // mutation.
            const topNavObserver = new MutationObserver(scheduleTeacherContentScrollUIRecheck);
            topNavObserver.observe(topNavWrapper, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            // Images, embedded content, and fonts can increase a page's
            // height after its markup has already been inserted.
            apiArea.addEventListener('load', scheduleTeacherContentScrollUIRecheck, true);
            window.addEventListener('resize', scheduleTeacherContentScrollUIRecheck, { passive: true });
            window.addEventListener('orientationchange', scheduleTeacherContentScrollUIRecheck, { passive: true });

            // Set the correct state for whichever teacher page loads first.
            scheduleTeacherContentScrollUIRecheck();

            // ─────────────────────────────────────────────────────────────
            // MOBILE VIEW TRANSITIONS — scroll memory + flicker-free chrome
            //
            // Two jobs, done as ONE step so they can never disagree:
            //   1. Remember where each list was scrolled to and put it back.
            //   2. Set the header tint, browser-bar colour and bottom-nav
            //      glass for the page you are ARRIVING on, from the position
            //      it is about to be restored to, before the first paint.
            //
            // Why one step: the header and browser bar are derived from
            // scrollTop. If a page is first shown at the top and only later
            // scrolled to its remembered spot, they show the "at top" look
            // first and switch a moment later — and with CSS transitions on
            // both, that switch is a visible fade out and back in.
            //
            // How it works
            //   configureTeacherHeader() announces the incoming view
            //   (teacherBeginViewTransition). From that moment,
            //   recalcTeacherMobileScrollUI() judges the chrome by the
            //   REMEMBERED position (window._teacherPendingScroll) rather
            //   than the outgoing content's. When the new content actually
            //   lands in #api-content-area, the scroll offset is applied in
            //   the same task — before the browser paints — and stays under
            //   watch until it sticks, because content can keep growing
            //   after first render (Home's class list arrives from a fetch
            //   into a NESTED element, which watching only direct children
            //   never saw). CSS transitions on the two bars are switched off
            //   for the duration so the state snaps rather than fades.
            //
            // Views are keyed  <section>:list  |  <section>:<detailType>.
            // Only lists are remembered. Every detail page (all assignments
            // share the one "Assignment" type) always opens at the top —
            // remembering per type would open assignment #5 scrolled to
            // wherever assignment #2 was left.
            // ─────────────────────────────────────────────────────────────
            window.teacherMobileViewKey = function() {
                const page = sessionStorage.getItem('lastTeacherPage') || 'teacher_manual';
                const detail = window.teacherHeaderDetailType;
                return page + ':' + (detail ? String(detail) : 'list');
            };
            const isListKey = (key) => /:list$/.test(key);

            const MOBILE_SCROLL_STORE = 'teacherMobileScroll';
            const MOBILE_BOTTOM_STORE = 'teacherMobileScrollAtBottom';
            const ARM_TIMEOUT_MS  = 4000;   // how long to wait for the new view's content to arrive
            const LAND_TIMEOUT_MS = 4000;   // how long to keep waiting for the page to become tall enough
            const HOLD_MS         = 500;    // keep re-asserting after landing (late layout, engine resets)

            const readStore = (name) => {
                try { return JSON.parse(sessionStorage.getItem(name) || '{}') || {}; }
                catch (e) { return {}; }
            };
            let scrollMemory = readStore(MOBILE_SCROLL_STORE);
            let bottomMemory = readStore(MOBILE_BOTTOM_STORE);
            let persistTimer = null;
            const persistMemory = () => {
                try {
                    sessionStorage.setItem(MOBILE_SCROLL_STORE, JSON.stringify(scrollMemory));
                    sessionStorage.setItem(MOBILE_BOTTOM_STORE, JSON.stringify(bottomMemory));
                } catch (e) { /* quota / private mode: memory just won't survive a refresh */ }
            };
            const schedulePersist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(persistMemory, 250); };
            const atBottomNow = () =>
                (apiArea.scrollHeight - apiArea.scrollTop - apiArea.clientHeight) <= BOTTOM_THRESHOLD;

            // While a transition runs, the header and bottom nav must take
            // their final state instantly, not fade through the wrong one.
            if (!document.getElementById('teacher-nav-snap-style')) {
                const snapStyle = document.createElement('style');
                snapStyle.id = 'teacher-nav-snap-style';
                snapStyle.textContent =
                    'html.teacher-nav-snap .top-nav-wrapper,' +
                    'html.teacher-nav-snap #mobileBottomNav{transition:none !important;}';
                document.head.appendChild(snapStyle);
            }
            let snapOn = false;
            const beginSnap = () => { snapOn = true; document.documentElement.classList.add('teacher-nav-snap'); };
            const endSnap = () => {
                if (!snapOn) return;
                snapOn = false;
                // Let the final state paint with transitions off, THEN turn them back on.
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!snapOn) document.documentElement.classList.remove('teacher-nav-snap');
                }));
            };

            const recalcNow = () => {
                if (typeof window.recalcTeacherMobileScrollUI === 'function') window.recalcTeacherMobileScrollUI();
            };
            const setPending = (t) => {
                window._teacherPendingScroll = t ? { target: t.target, atBottom: t.atBottom } : null;
            };

            // One transition at a time:
            //   { key, target, atBottom, swapped, swappedAt, landedAt }
            //   swapped = the new view's content has been inserted
            //   landedAt = when the remembered offset was successfully applied
            let trans = null;
            let rafId = 0;
            let armTimer = 0;
            let trackedKey = window.teacherMobileViewKey();   // view whose scroll we are recording
            let lastSeenKey = null;                           // last view whose content we saw swapped in

            const finish = () => {
                cancelAnimationFrame(rafId); rafId = 0;
                clearTimeout(armTimer);
                trans = null;
                setPending(null);
                recalcNow();
                endSnap();
            };

            // Apply the remembered offset. Returns false while the page is
            // still too short to reach it.
            const land = () => {
                const want = trans.target;
                const max = apiArea.scrollHeight - apiArea.clientHeight;
                if (want > max + 1) return false;
                if (Math.abs(apiArea.scrollTop - want) > 1) {
                    if (want === 0) {
                        // Going to the top: also stop any iOS momentum still
                        // carrying the outgoing page's offset.
                        apiArea.style.overflowY = 'hidden';
                        apiArea.scrollTop = 0;
                        void apiArea.offsetHeight;
                        requestAnimationFrame(() => { apiArea.style.overflowY = ''; });
                    } else {
                        apiArea.style.scrollBehavior = 'auto';
                        apiArea.scrollTop = want;
                    }
                }
                return true;
            };

            const step = () => {
                if (!trans || !trans.swapped) return;
                if (land() && !trans.landedAt) {
                    trans.landedAt = performance.now();
                    setPending(null);   // real scrollTop now equals the target
                    recalcNow();
                }
            };

            const tick = () => {
                rafId = 0;
                if (!trans) return;
                step();
                const t = performance.now();
                const expired = trans.landedAt
                    ? (t - trans.landedAt > HOLD_MS)
                    : (t - trans.swappedAt > LAND_TIMEOUT_MS);
                if (expired) { finish(); return; }
                rafId = requestAnimationFrame(tick);
            };

            const markSwapped = () => {
                if (!trans || trans.swapped) return;
                trans.swapped = true;
                trans.swappedAt = performance.now();
                lastSeenKey = trans.key;
                trackedKey = trans.key;     // retarget recording BEFORE any scroll event for the new content is delivered
                clearTimeout(armTimer);
                step();                     // lands right now — same task, before first paint
                if (!rafId && trans) rafId = requestAnimationFrame(tick);
            };

            const startTransition = (key, contentAlreadyHere) => {
                if (trans && trans.key === key) {
                    if (contentAlreadyHere) markSwapped();
                    return;
                }
                if (trans) { cancelAnimationFrame(rafId); rafId = 0; clearTimeout(armTimer); }
                const saved = isListKey(key) ? scrollMemory[key] : 0;
                trans = {
                    key,
                    target: (Number.isFinite(saved) && saved > 0) ? saved : 0,
                    atBottom: (key in bottomMemory) ? !!bottomMemory[key] : undefined,
                    swapped: false, swappedAt: 0, landedAt: 0
                };
                setPending(trans);
                beginSnap();
                clearTimeout(armTimer);
                // If the content never arrives (fetch failed, nothing rendered),
                // don't leave the chrome judged by a position we never reached.
                armTimer = setTimeout(() => { if (trans && !trans.swapped) finish(); }, ARM_TIMEOUT_MS);
                if (contentAlreadyHere) markSwapped();
            };
            window.teacherBeginViewTransition = (key) => startTransition(key, false);

            // A finger on the page always wins over anything restored.
            const cancelTransition = () => { if (trans) finish(); };
            apiArea.addEventListener('touchstart', cancelTransition, { passive: true });
            apiArea.addEventListener('wheel', cancelTransition, { passive: true });

            // Record where the teacher is, per list view.
            apiArea.addEventListener('scroll', () => {
                if (trans && trans.swapped) return;                       // our own landing / hold window
                // Page identity changed (lastTeacherPage is written when a
                // fetch STARTS) but the content hasn't been swapped in yet:
                // what is scrolling is still the previous view. Attribute the
                // scroll to neither.
                if (window.teacherMobileViewKey() !== trackedKey) return;
                if (!isListKey(trackedKey)) return;
                scrollMemory[trackedKey] = apiArea.scrollTop;
                bottomMemory[trackedKey] = atBottomNow();
                schedulePersist();
            }, { passive: true });

            // New content inserted into the container = the view has swapped.
            const onContentSwap = () => {
                const key = window.teacherMobileViewKey();
                if (trans && trans.key === key) {
                    if (!trans.swapped) {
                        markSwapped();
                    } else {
                        // Rendered again right after landing (loader -> content,
                        // double render): re-apply and restart the hold window.
                        trans.landedAt = 0;
                        trans.swappedAt = performance.now();
                        step();
                    }
                    return;
                }
                if (key !== lastSeenKey) startTransition(key, true);
                // else: the same view re-rendered itself (filter, search, data
                // refresh) — leave the scroll exactly where the teacher put it.
            };
            new MutationObserver(onContentSwap).observe(apiArea, { childList: true });

            // Tapping the tab you are already on: forget the position so it
            // isn't restored over the scroll-to-top.
            window.teacherForgetMobileScroll = function() {
                const key = window.teacherMobileViewKey();
                if (!isListKey(key)) return;
                scrollMemory[key] = 0;
                bottomMemory[key] = atBottomNow();
                schedulePersist();
            };

            // Persist on the way out so a refresh keeps the position too.
            window.addEventListener('pagehide', persistMemory);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') persistMemory();
            });

            // Re-run once the loader overlay hides — the one centralised
            // signal that reliably fires after ANY page's async content
            // has actually finished loading, regardless of which specific
            // fetch function (fetchTeacherAssignments, fetchTeacherQuizzes,
            // etc.) populated it. A MutationObserver is used instead of a
            // guessed setTimeout, since a fixed delay would either fire
            // too early on slow connections or waste time on fast ones.
            if (loader) {
                let wasLoaderVisible = getComputedStyle(loader).display !== 'none';
                const loaderObserver = new MutationObserver(() => {
                    const isLoaderVisible = getComputedStyle(loader).display !== 'none';
                    if (wasLoaderVisible && !isLoaderVisible) {
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            window.applyTeacherTopNavOffset();
                            recalcTeacherMobileScrollUI();
                        }));
                    }
                    wasLoaderVisible = isLoaderVisible;
                });
                loaderObserver.observe(loader, { attributes: true, attributeFilter: ['style'] });
            }
        }
    }
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