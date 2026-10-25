/*
 * iSkool back button, for phones: the Back button (or the swipe) closes what is on top, instead of leaving the app.
 *
 * Why it exists. The dashboards are one page that swaps its content, so the phone's history has nothing in it for "the
 * quiz list" or "an open menu". Back therefore leaves the app, or lands on the sign-in page, from anywhere: a teacher
 * who opened a menu, or a quiz, and pressed Back to close it was thrown out. In a phone app Back means "one step up".
 *
 * What it does. It keeps ONE extra history entry above the page (a "guard"). Pressing Back uses up the guard instead of
 * leaving; the script then does the one-step-up for the page and puts the guard back:
 *     1. the first layer that is open is closed (menu, pop-up, drop-down, a form that sits on top, ...);
 *     2. else, on a detail page, the same thing the header's back arrow does;
 *     3. else, on any page except Home, go Home;
 *     4. at Home: say "Press Back again to exit" and leave the guard off for a moment, so the next Back really leaves.
 *
 * The page supplies what is app-specific (the list of layers, what Home is, how to go there): the teacher dashboard in
 * assets/js/teacher/teacher_back_button.js. This file knows nothing about teachers or learners.
 *
 * Details that matter:
 *   - The guard is added only after the first tap or key press. Chrome ignores history entries that a page adds before
 *     the person has touched it (its "history manipulation" rule), and a guard that is ignored would not catch Back.
 *     Pressing Back before the very first tap leaves the page as it always did.
 *   - The address does not change (pushState without a URL), and the page does not reload.
 *   - Phone width only (max-width 768px). On a wider screen nothing is added and nothing is caught.
 *   - After a reload on a guard entry the guard is picked up again, not stacked.
 *
 * Public API (window.iskoolBack):
 *   init({ layers: [fn, ...], atHome: fn, goHome: fn, exitHint: 'text' })
 *       layers  functions tried in order on Back; each returns true if it closed something
 *   (nothing else is needed: it is not called from other scripts)
 *
 * Plain script, no dependencies; the hint is built with textContent.
 */
(function () {
    'use strict';
    if (window.iskoolBack) return;

    var PHONE = '(max-width: 768px)';
    var EXIT_WINDOW_MS = 2500;
    var GUARD = { iskoolBack: 1 };

    var options = null;
    var armed = false;            // the current history entry is the guard, with the page's own entry below it
    var hintEl = null;
    var exitTimer = null;

    function isPhone() { return !!(window.matchMedia && window.matchMedia(PHONE).matches); }
    function isGuard(state) { return !!(state && state.iskoolBack === 1); }
    function hasActivation(event) {
        // Taps and key presses count. Browsers that cannot say (older ones) get the benefit of the doubt for a real tap.
        if (navigator.userActivation) return navigator.userActivation.hasBeenActive;
        return !event || event.isTrusted !== false;
    }

    /* ── the guard ───────────────────────────────────────────────────────────────────────────────────────────── */

    function arm(event) {
        if (armed || !options || !isPhone() || !hasActivation(event)) return;
        if (isGuard(history.state)) { armed = true; return; }           // already on one (page was reloaded on it)
        try {
            history.pushState(GUARD, '');
            armed = true;
        } catch (e) { /* history locked down: Back simply keeps its normal behaviour */ }
    }

    /* ── the "press Back again" hint ─────────────────────────────────────────────────────────────────────────── */

    function placeHint() {
        if (!hintEl) return;
        // Above the strip of the connection status if that is showing, else above the bottom bar, else at the bottom.
        var strip = document.querySelector('.net-status');
        var nav = document.getElementById('mobileBottomNav');
        var bottom;
        if (strip && strip.offsetHeight) bottom = Math.max(0, window.innerHeight - strip.getBoundingClientRect().top) + 8;
        else if (nav && nav.offsetHeight) bottom = nav.offsetHeight + 12;
        hintEl.style.bottom = bottom != null ? bottom + 'px' : 'calc(12px + env(safe-area-inset-bottom, 0px))';
    }

    function showHint() {
        if (!hintEl) {
            hintEl = document.createElement('div');
            hintEl.className = 'iskool-back-hint';
            hintEl.setAttribute('role', 'status');
            document.body.appendChild(hintEl);
        }
        hintEl.textContent = options.exitHint || 'Press Back again to exit';
        placeHint();
        // restart the fade-in each time
        hintEl.classList.remove('is-on');
        void hintEl.offsetWidth;
        hintEl.classList.add('is-on');
    }

    function hideHint() {
        if (hintEl && hintEl.parentNode) hintEl.parentNode.removeChild(hintEl);
        hintEl = null;
    }

    function endExitWindow() {
        if (exitTimer == null) return;
        clearTimeout(exitTimer);
        exitTimer = null;
        hideHint();
        arm();                         // the person stayed: catch the next Back again
    }

    /* ── what Back does ──────────────────────────────────────────────────────────────────────────────────────── */

    function run(fn) {
        try { return fn(); } catch (e) { return false; }
    }

    function handleBack() {
        var layers = options.layers || [];
        for (var i = 0; i < layers.length; i++) {
            if (run(layers[i]) === true) { arm(); return; }
        }
        if (!run(options.atHome)) {
            run(options.goHome);
            arm();
            return;
        }
        // At Home. The guard stays off: the next Back is the system's and leaves. If the person stays, put it back.
        showHint();
        clearTimeout(exitTimer);
        exitTimer = setTimeout(endExitWindow, EXIT_WINDOW_MS);
    }

    function onPopState(event) {
        if (isGuard(event.state)) { armed = true; return; }             // moved forward onto the guard
        if (!armed) return;                                              // not one of ours
        armed = false;
        if (!isPhone()) { history.back(); return; }                      // the screen grew since: behave as a browser does
        handleBack();
    }

    /* ── start ───────────────────────────────────────────────────────────────────────────────────────────────── */

    function init(opts) {
        if (options) return;
        options = opts || {};
        armed = isGuard(history.state);
        window.addEventListener('popstate', onPopState);
        // The first tap or key press arms the guard (see the top of this file); later ones put it back after a hint.
        ['pointerup', 'click', 'keydown'].forEach(function (name) {
            document.addEventListener(name, function (event) {
                if (exitTimer != null) endExitWindow(); else arm(event);
            }, true);
        });
        window.addEventListener('resize', placeHint);
    }

    window.iskoolBack = { init: init };
})();
