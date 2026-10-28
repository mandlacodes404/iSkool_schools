/*
 * Parent app: what the phone's Back button does, step by step (the engine is assets/js/shared/back_button.js, the same
 * one the learner and teacher apps use, so Back behaves the same in all three).
 *
 * In this order, the first that applies wins:
 *   1. something is open on top: the search, the account sheet, the account card, or the menu itself (parent_menu.js
 *      paMenu.closeTop closes the top-most one, the way a tap on its backdrop would)
 *   2. any page other than Home (Report, Syllabus, News, Events, Add a child): Home
 *   3. Home: "Press Back again to exit"
 *
 * The parent app's pages are #/routes in one page, so opening a page would normally add a history entry and Back would
 * walk back through every page visited, and would not leave from Home. On phones a link to a page therefore rewrites the
 * address of the current entry instead (parent_menu.js paGo), which keeps Back to the three steps above.
 *
 * Phones only (the engine checks); the desktop layout is not touched.
 */
(function () {
    'use strict';
    if (!window.iskoolBack) return;

    var PHONE = '(max-width: 768px)';
    var OTHER_PAGES = ['report', 'syllabus', 'news', 'events', 'add-child'];

    function routeName(hash) {
        return String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
    }

    function closeOpenLayer() {
        return !!(window.paMenu && typeof window.paMenu.closeTop === 'function' && window.paMenu.closeTop());
    }

    function atHome() {
        // The page on show, not the address: going back pops the Back guard, which can leave an older address showing
        var shown = window.paRoute || routeName(window.location.hash);
        return OTHER_PAGES.indexOf(shown) === -1;
    }

    function goHome() {
        if (window.paGo) window.paGo('home');
        else window.location.replace('#/home');
    }

    // A tap on a link to a page (a tab, a menu entry, "See all", ...) replaces the history entry on phones
    document.addEventListener('click', function (ev) {
        if (!window.matchMedia || !window.matchMedia(PHONE).matches || !window.paGo) return;
        if (ev.defaultPrevented || ev.button > 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        var link = ev.target && ev.target.closest ? ev.target.closest('a[href^="#/"]') : null;
        if (!link) return;
        var name = routeName(link.getAttribute('href'));
        if (!name) return;
        ev.preventDefault();
        window.paGo(name);
    });

    window.iskoolBack.init({
        layers: [closeOpenLayer],
        atHome: atHome,
        goHome: goHome,
        exitHint: 'Press Back again to exit'
    });
})();
