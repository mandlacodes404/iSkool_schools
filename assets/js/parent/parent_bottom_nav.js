/* assets/js/parent/parent_bottom_nav.js
   The parent app's dynamic bottom tabs (phones, max-width: 768px). Load it after parent_app.js.

   It does the same job as the learner app's recalcMobileScrollUI() in learner_dashboard.php:
   - Near the bottom of the page (or on a page too short to scroll) the bar is clear, so the page shows through.
   - Scrolled up, away from the bottom, the bar turns to glass.
   The look itself is CSS (DYNAMIC BOTTOM TABS in parent_app.css). This file only toggles .nav-scrolled on .pa-tabs
   and sets html.pa-dynamic-tabs, which tells the stylesheet that the script is running (without it the bar just stays glass).

   What keeps it right, copied from how the learner bar is kept right:
   - It is judged again whenever the page's height can have changed without a scroll: content drawn or replaced,
     a row opened or closed, a picture or font loaded, the window resized or turned, a pull to refresh.
     (A ResizeObserver does most of that; the delayed checks after each change catch CSS height transitions.)
   - A new page snaps the bar to its final look instead of fading through the wrong one while "Loading…" is on screen
     (html.pa-tabs-snap switches the fade off until the page has arrived and settled).
   - Tapping the tab of the page you are already on scrolls that page back to the top.
   - Crossing the phone breakpoint puts everything away / sets it up again.

   Nothing here touches navigation: the tabs are ordinary #/route links handled by parent_app.js.
   window.paTabs.recalc() is there for any page code that changes the page height without a scroll event. */
(function () {
    'use strict';

    var root = document.documentElement;
    var tabs = document.querySelector('.pa-tabs');
    // On phones .pa-content is the area that scrolls (the header and the tabs stay still)
    var content = document.querySelector('.pa-content');
    var view = document.getElementById('paView');
    if (!tabs || !content) return;

    var SCROLLED = 'nav-scrolled';
    var BOTTOM_THRESHOLD = 10;     // px from the bottom where the bar is still clear (same as the learner bar)
    var SNAP_SETTLE_MS = 450;      // quiet time after the new page has arrived before fades come back
    var SNAP_MAX_MS = 4000;        // never keep fades off longer than this (a page that never arrives)
    var phone = window.matchMedia('(max-width: 768px)');

    // ── Judge the bar ──────────────────────────────────────────────────────────────────────────────────────

    function recalc() {
        if (!phone.matches) return;
        var distFromBottom = content.scrollHeight - content.scrollTop - content.clientHeight;
        if (distFromBottom <= BOTTOM_THRESHOLD) tabs.classList.remove(SCROLLED);
        else tabs.classList.add(SCROLLED);
    }

    // Several checks after a change: two frames (layout has settled), then 150 and 400 ms for height transitions
    var frame = 0;
    var timers = [];
    function scheduleRecheck() {
        if (frame) cancelAnimationFrame(frame);
        timers.forEach(clearTimeout);
        timers = [];
        frame = requestAnimationFrame(function () {
            frame = requestAnimationFrame(function () {
                frame = 0;
                recalc();
            });
        });
        [150, 400].forEach(function (delay) { timers.push(setTimeout(recalc, delay)); });
    }

    // ── Snap: no fade while a page is arriving ─────────────────────────────────────────────────────────────

    var snapOn = false;
    var snapSettle = 0;
    var snapMax = 0;

    function endSnap() {
        clearTimeout(snapSettle);
        clearTimeout(snapMax);
        if (!snapOn) return;
        snapOn = false;
        // Let the final state paint with the fade off, THEN turn the fade back on
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { if (!snapOn) root.classList.remove('pa-tabs-snap'); });
        });
    }
    function beginSnap() {
        snapOn = true;
        root.classList.add('pa-tabs-snap');
        clearTimeout(snapSettle);
        clearTimeout(snapMax);
        snapMax = setTimeout(endSnap, SNAP_MAX_MS);
        // parent_app.js draws the new page in its own hashchange listener, which runs before ours. A page it already had
        // (a minute-old answer, or the start of the app) is on screen by now, so no later change would ever end the snap.
        noteChange();
    }
    // Called on every change to the page. While a snap is on, the page counts as arrived once parent_app.js has taken
    // aria-busy off the view; the snap ends after it has stayed quiet for a moment.
    function noteChange() {
        if (!snapOn) return;
        clearTimeout(snapSettle);
        if (!view || view.getAttribute('aria-busy') !== 'true') snapSettle = setTimeout(endSnap, SNAP_SETTLE_MS);
    }

    function onPageChange() {
        noteChange();
        scheduleRecheck();
    }

    // ── Wire it up ─────────────────────────────────────────────────────────────────────────────────────────

    content.addEventListener('scroll', recalc, { passive: true });

    if (window.MutationObserver) {
        // The view, but also the child switcher and the offline note, which sit next to it inside .pa-content
        new MutationObserver(onPageChange).observe(content, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'aria-busy']
        });
    }
    if (window.ResizeObserver) {
        var sizes = new ResizeObserver(function () { scheduleRecheck(); });
        sizes.observe(content);
        if (view) sizes.observe(view);
    }
    // Pictures and other embeds growing after their markup was inserted
    content.addEventListener('load', scheduleRecheck, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRecheck);
    window.addEventListener('resize', scheduleRecheck, { passive: true });
    window.addEventListener('orientationchange', scheduleRecheck, { passive: true });

    // A new page is coming: judge by where it will be, not by the outgoing one. parent_app.js scrolls to the top on
    // every page change, and the snap keeps the bar from fading through "Loading…" on the way.
    window.addEventListener('hashchange', function () {
        if (!phone.matches) return;
        beginSnap();
        scheduleRecheck();
    });

    // Tapping the tab of the page you are on: back to the top (the only thing that happens, as on the learner bar)
    tabs.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a.pa-tab') : null;
        if (!link || link.getAttribute('aria-current') !== 'page') return;
        if (content.scrollTop > 0) content.scrollTop = 0;
    });

    // Crossing the phone breakpoint
    function onBreakpoint() {
        if (phone.matches) {
            beginSnap();
            scheduleRecheck();
        } else {
            tabs.classList.remove(SCROLLED);
            endSnap();
        }
    }
    if (phone.addEventListener) phone.addEventListener('change', onBreakpoint);
    else if (phone.addListener) phone.addListener(onBreakpoint);

    // Start: the first page is still "Loading…", so the bar starts clear and snaps to glass when the page lands
    root.classList.add('pa-dynamic-tabs');
    if (phone.matches) beginSnap();
    recalc();
    scheduleRecheck();

    window.paTabs = { recalc: recalc };
}());
