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
            topNavWrapper.style.borderBottom = '2px solid ' + color + '55';
            topNavWrapper.setAttribute('data-page-color', color);
        } else {
            window.teacherCurrentPageColor = '#0d1117';
            topNavWrapper.style.borderBottom = '';
            topNavWrapper.removeAttribute('data-page-color');
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
    // A scroll caused by prepareTeacherMobileNavigation() resetting the
    // page to the top is not the teacher scrolling, so it must never be
    // recorded as their position — otherwise tapping away from a section
    // would overwrite the very value restoreTeacherScrollState() needs
    // when they come back.
    if (window._teacherNavResetInProgress) return;
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
            apiArea.innerHTML = renderMobileHomePanel(window.teacherSnapshotCache);
            window.loadMobileHomeClasses();
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
    if (!trail || trail.length === 0) {
        return `
            <div class="mh-empty-card">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="#8b949e" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <div class="mh-empty-title">Nothing yet</div>
                <div class="mh-empty-sub">Quizzes, assignments, announcements, and resources you create will show up here.</div>
            </div>`;
    }

    return trail.map((item, i) => {
        const meta  = MOBILE_TRAIL_ICONS[item.type] || MOBILE_TRAIL_ICONS.assignment;
        const verb  = MOBILE_TRAIL_VERB[item.type] || 'Created';
        const isLast = i === trail.length - 1;
        const onclick = mobileTrailOnclick(item);
        return `
            <div class="mh-trail-item"${onclick ? ` onclick="${onclick}"` : ''}>
                <div class="mh-trail-line">
                    <div class="mh-trail-dot" style="background:${meta.color}22;">${meta.svg}</div>
                    ${isLast ? '' : '<div class="mh-trail-connector"></div>'}
                </div>
                <div class="mh-trail-content">
                    <div class="mh-trail-text">${verb} <b>${item.title}</b>${item.class_name ? ` &middot; ${item.class_name}` : ''}</div>
                    <div class="mh-trail-time">${item.time_label}</div>
                </div>
            </div>`;
    }).join('');
}

const WEEK_EVENT_META = {
    assignment: { color: '#a78bfa', dot: 'dot-assignment' },
    quiz:       { color: '#4fd1c5', dot: 'dot-quiz' },
    academic:   { color: '#f472b6', dot: 'dot-academic' },
    reminder:   { color: '#f59e0b', dot: 'dot-reminder' }
};

function renderMobileWeekStrip(weekEvents, weekStart) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const start = new Date(weekStart + 'T00:00:00');
    // weekStart from the backend is a Monday; shift so the strip still
    // renders Sun-first to match the existing learner week-strip look.
    const monday = new Date(start);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() - 1);

    const today = new Date();
    today.setHours(0,0,0,0);

    const eventsByDate = {};
    (weekEvents || []).forEach(e => {
        if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
        eventsByDate[e.date].push(e);
    });

    let dayCells = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const dateStr = d.toISOString().slice(0,10);
        const isToday = d.getTime() === today.getTime();
        const hasEvents = !!eventsByDate[dateStr];
        dayCells += `
            <div class="mh-week-day">
                <span class="mh-week-day-label">${days[i].toUpperCase()}</span>
                <span class="mh-week-day-num${isToday ? ' mh-week-day-today' : ''}">${d.getDate()}</span>
                ${hasEvents ? '<span class="mh-week-day-dot"></span>' : ''}
            </div>`;
    }

    const monthLabel = sunday.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();

    let rowsHtml = '';
    if (!weekEvents || weekEvents.length === 0) {
        rowsHtml = `<div class="mh-week-empty">Nothing on the calendar this week.</div>`;
    } else {
        rowsHtml = weekEvents.map(e => {
            const meta = WEEK_EVENT_META[e.type] || WEEK_EVENT_META.reminder;
            const d = new Date(e.date + 'T00:00:00');
            const dayLabel = d.toLocaleString('default', { weekday: 'short', day: 'numeric', month: 'short' });
            return `
                <div class="mh-week-row">
                    <span class="mh-week-row-dot" style="background:${meta.color};"></span>
                    <div class="mh-week-row-content">
                        <div class="mh-week-row-title">${e.title}</div>
                        <div class="mh-week-row-sub">
                            <span class="mh-week-row-pill" style="background:${meta.color}22;color:${meta.color};">${e.label}</span>
                            ${e.class_name ? ` &middot; ${e.class_name}` : ''} &middot; ${dayLabel}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    return `
        <div class="mh-week-month-label">${monthLabel}</div>
        <div class="mh-week-strip">${dayCells}</div>
        <div class="mh-week-rows">${rowsHtml}</div>`;
}

function renderMobileClassList() {
    // Populated async by loadMobileHomeClasses() once the fetch resolves.
    return `<div id="mh-class-list" class="mh-class-list"><div class="mh-class-loading">Loading classes...</div></div>`;
}

window.loadMobileHomeClasses = async function() {
    const container = document.getElementById('mh-class-list');
    if (!container) return;
    try {
        const res  = await fetch('api/teacher/get_teacher_classes_summary.php');
        const data = await res.json();
        const classes = data.classes || [];

        if (classes.length === 0) {
            container.innerHTML = `
                <div class="mh-class-loading">
                    No classes yet — post something to a class, or add one below.
                </div>`;
            return;
        }

        container.innerHTML = classes.map(c => {
            const initials = c.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
            const subjectLine = c.needs_subject
                ? `<span class="mh-class-add-subject" onclick="event.stopPropagation(); window.openAddSubjectFlow(${c.id}, '${c.name.replace(/'/g, "\\'")}')">+ Add subject</span>`
                : `${c.subject_name}`;
            return `
                <div class="mh-class-row" onclick="window.openTeacherClassFromHome(${c.id})">
                    <div class="mh-class-avatar">${initials}</div>
                    <div class="mh-class-info">
                        <div class="mh-class-name">${c.name}</div>
                        <div class="mh-class-sub">${subjectLine} &middot; ${c.learner_count} learner${c.learner_count !== 1 ? 's' : ''}</div>
                    </div>
                    <svg class="mh-chevron" viewBox="0 0 24 24" width="16" height="16" stroke="#6e7681" stroke-width="2" fill="none"><path d="M9 18l6-6-6-6"/></svg>
                </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="mh-class-loading">Failed to load classes.</div>`;
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

function renderMobileHomePanel(snapshot) {
    const trailHtml = renderMobileTrail(snapshot.trail);
    const weekHtml  = renderMobileWeekStrip(snapshot.week_events, snapshot.week_start);
    const classesHtml = renderMobileClassList();
    const schoolHtml = snapshot.school_name
        ? `<div class="mh-school-flat"><span class="mh-school-dot"></span>${snapshot.school_name}</div>`
        : '';

    return `
        <div class="mh-home">
            ${schoolHtml}
            <div class="mh-section-label mh-section-label--first">Recent activity</div>
            <div class="mh-trail">${trailHtml}</div>

            <div class="mh-section-label">Upcoming</div>
            <div class="mh-upcoming">${weekHtml}</div>

            <div class="mh-classes-header">
                <div class="mh-section-label mh-section-label--inline">
                    Your classes
                    <span class="mh-info-icon" onclick="window.toggleMobileHomeInfo()" title="How this list works">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="#6e7681" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    </span>
                </div>
                <span class="mh-add-class-btn" onclick="window.openAddClassFlow()">+ Add class</span>
            </div>
            <div id="mh-classes-info" class="mh-classes-info mh-classes-info--hidden">
                Classes you've posted to appear here automatically. Add others you teach with
                <b>+ Add class</b>, and name your subject for each so learners see it instead of your name.
            </div>
            ${classesHtml}
            ${TEACHER_SUBJECT_MODAL_HTML}
        </div>`;
}

window.toggleMobileHomeInfo = function() {
    const el = document.getElementById('mh-classes-info');
    if (el) el.classList.toggle('mh-classes-info--hidden');
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
                // Fallback for input that never sent a touchstart (mouse,
                // keyboard, assistive tech). Harmless if touchstart already ran.
                if (typeof window.prepareTeacherMobileNavigation === 'function') {
                    window.prepareTeacherMobileNavigation();
                }
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
    // MOBILE NAV STABILIZATION — runs the instant a nav link is touched,
    // BEFORE the next section starts loading. Ported from the learner's
    // prepareLearnerMobileNavigation (learner_dashboard.php).
    //
    // Without it, the new section inherits whatever the old one left
    // behind: the previous scroll offset, the previous section's header
    // tint, and a bottom-nav state that was decided against the OLD
    // content. The scroll-watching below only corrects that once the new
    // content has rendered, so there was a visible stale frame first.
    //
    // 1) scroll #api-content-area back to the top, instantly (no smooth
    //    animation) and with iOS momentum scrolling briefly disabled —
    //    otherwise a fling in progress carries into the new section
    // 2) clear the old section's header tint/scrolled state
    // 3) make sure the bottom nav is visible in its glass state
    // 4) re-run the scroll-UI check a few times as content settles, since
    //    cached sections swap in synchronously and fetched ones don't
    //
    // Per-section scroll positions saved by saveTeacherScrollState() are
    // deliberately NOT cleared: this only resets the live scroll of the
    // shared container. _teacherNavResetInProgress stops that reset from
    // being recorded as the teacher's own position.
    // ─────────────────────────────────────────────────────────────────────
    window.prepareTeacherMobileNavigation = function() {
        if (window.innerWidth > 768) return;

        const topNav = document.querySelector('.top-nav-wrapper');
        const bottomNavEl = document.getElementById('mobileBottomNav');

        window._teacherNavResetInProgress = true;

        if (apiArea) {
            apiArea.style.scrollBehavior = 'auto';
            apiArea.scrollTop = 0;
            apiArea.style.webkitOverflowScrolling = 'auto';
            apiArea.style.overflowY = 'hidden';
            void apiArea.offsetHeight;   // force reflow so the hidden state applies
            apiArea.scrollTop = 0;

            requestAnimationFrame(() => {
                apiArea.style.overflowY = '';            // back to the stylesheet's auto
                apiArea.style.webkitOverflowScrolling = 'touch';
                apiArea.scrollTop = 0;
                // Let the scroll event this causes flow through the saver
                // guard first, THEN lift the guard on the following frame.
                requestAnimationFrame(() => {
                    window._teacherNavResetInProgress = false;
                });
            });
        } else {
            window._teacherNavResetInProgress = false;
        }

        if (topNav) {
            topNav.classList.remove('header-scrolled');
            topNav.style.background = '';
        }

        if (bottomNavEl) {
            // Only restore visibility when this is a normal (non-detail)
            // page. Detail mode hides it with !important on purpose.
            if (!window.teacherHeaderDetailType) {
                bottomNavEl.style.setProperty('display', 'flex');
            }
            bottomNavEl.classList.add('nav-scrolled');
        }

        if (typeof window.recalcTeacherMobileScrollUI === 'function') {
            [50, 150, 300, 500].forEach(delay => {
                setTimeout(() => window.recalcTeacherMobileScrollUI(), delay);
            });
        }
    };

    // Fire on touch so the reset happens ahead of the click (real touch
    // devices), with click as the fallback for mouse/keyboard/assistive
    // tech that never sends a touchstart. Same two-step the learner uses.
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('touchstart', () => {
            window.prepareTeacherMobileNavigation();
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

            const scrollTop      = apiArea.scrollTop;
            const scrollHeight   = apiArea.scrollHeight;
            const clientHeight   = apiArea.clientHeight;
            const distFromBottom = scrollHeight - scrollTop - clientHeight;

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
            if (scrollTop > SCROLL_THRESHOLD) {
                topNavWrapper.classList.add('header-scrolled');
                if (pageColor) {
                    topNavWrapper.style.background = pageColor;
                    if (themeColorMeta && !sidebarOpen) themeColorMeta.setAttribute('content', pageColor);
                }
            } else {
                topNavWrapper.classList.remove('header-scrolled');
                topNavWrapper.style.background = '';
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