/*
 * Teacher dashboard: pull to refresh (phones).
 *
 * Swipe down from the very top of a list page and let go: the page is fetched again and redrawn in place. No full
 * reload, so the teacher stays where they were. The gesture itself lives in assets/js/shared/pull_to_refresh.js; this
 * file only says WHAT to refresh for each teacher page, and WHEN pulling is allowed.
 *
 * How a page refreshes: every teacher page keeps its last response in a window.teacher...Cache variable, and its
 * window.fetchTeacher...() function shows the cache when there is one. So a refresh is: empty that cache, then call the
 * same function the menu calls. Pages that are not listed here (Settings, the old iframe pages) never pull.
 *
 * Pulling is switched off:
 *   - on a detail page (a quiz, an assignment, ...): redrawing would send the teacher back to the list;
 *   - while the menu is open;
 *   - when the touch starts inside a pop-up, a drawer, a text field or an inner list that is scrolled down.
 *
 * Loaded after dashboard.js (which defines the page functions) and after the shared script.
 */
(function () {
    'use strict';

    // lastTeacherPage -> which caches to empty, which in-flight request to wait for, which function redraws the page.
    var PAGES = {
        teacher_manual:        { clear: ['teacherManualCache', 'teacherSnapshotCache', 'teacherClassesCache'], refresh: 'loadTeacherManual' },
        teacher_quizzes:       { clear: ['teacherQuizzesCache'],     pending: ['teacherQuizzesCachePromise'],     refresh: 'fetchTeacherQuizzes' },
        teacher_assignments:   { clear: ['teacherAssignmentsCache'], pending: ['teacherAssignmentsCachePromise'], refresh: 'fetchTeacherAssignments' },
        teacher_announcements: { clear: ['teacherAnnouncementCache'], pending: ['teacherAnnouncementCachePromise'], refresh: 'fetchTeacherAnnouncements' },
        teacher_evaluations:   { clear: ['teacherEvaluationCache'],  pending: ['teacherEvaluationCachePromise'],  refresh: 'fetchTeacherEvaluations' },
        teacher_resources:     { clear: ['teacherResourceCache'],    pending: ['teacherResourceCachePromise'],    refresh: 'fetchTeacherResources' },
        teacher_syllabus:      { clear: ['teacherSBOCache'],         pending: ['teacherSBOCachePromise'],         refresh: 'fetchTeacherSyllabus' },
        teacher_grades:        { clear: ['teacherGradesCache'],      pending: ['teacherGradesCachePromise'],      refresh: 'fetchTeacherGrades' },
        teacher_analytics:     { clear: ['teacherAnalyticsCache'],   pending: ['teacherAnalyticsCachePromise'],   refresh: 'fetchTeacherAnalytics' },
        // The calendar keeps one cache entry (and one in-flight request) per month, as objects.
        teacher_calendar:      { reset: ['teacherCalendarEventsCache', 'teacherCalendarEventsPromises'], refresh: 'fetchTeacherCalendar' }
    };

    var PENDING_WAIT_MS = 8000;      // how long to wait for a request already on its way before starting a fresh one

    // A touch that starts inside one of these never pulls (pop-ups, drawers, anything you type in).
    var IGNORE = [
        '[role="dialog"]', '[aria-modal="true"]',
        '.teacher-modal-overlay', '.mini-cal-modal', '#fullCalModal',
        '.sbo-drawer-backdrop', '.sbo-drawer-panel', '.rs-video-overlay',
        'input', 'textarea', 'select', '[contenteditable="true"]'
    ].join(',');

    function currentPage() {
        try { return sessionStorage.getItem('lastTeacherPage') || 'teacher_manual'; } catch (e) { return 'teacher_manual'; }
    }

    function delay(ms) {
        return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
    }

    function canPull() {
        if (window.teacherHeaderDetailType) return false;                 // a detail page
        if (document.querySelector('.sidebar.active')) return false;      // the menu is open
        return !!PAGES[currentPage()];
    }

    function refresh() {
        var key = currentPage();
        var page = PAGES[key];
        if (!page) return Promise.resolve();
        var redraw = window[page.refresh];
        if (typeof redraw !== 'function') return Promise.resolve();

        var inFlight = (page.pending || [])
            .map(function (name) { return window[name]; })
            .filter(function (request) { return request && typeof request.then === 'function'; })
            .map(function (request) { return Promise.resolve(request).then(function () {}, function () {}); });

        // A request that is already on its way (the page prefetches) is as fresh as a new one: let it land. If it
        // never does, drop it and start again, so the pull cannot spin forever.
        var wait = inFlight.length ? Promise.race([Promise.all(inFlight).then(function () { return false; }), delay(PENDING_WAIT_MS).then(function () { return true; })]) : Promise.resolve(false);

        return wait.then(function (timedOut) {
            if (currentPage() !== key) return;                            // the teacher went somewhere else meanwhile
            if (timedOut) (page.pending || []).forEach(function (name) { window[name] = null; });
            (page.clear || []).forEach(function (name) { window[name] = null; });
            (page.reset || []).forEach(function (name) { window[name] = {}; });
            return redraw();
        });
    }

    function start() {
        if (!window.iskoolPullToRefresh) return;
        window.iskoolPullToRefresh.init({
            scroller: '#api-content-area',
            loader: '#loaderOverlay',            // the full-screen loader must not show on top of the pull spinner
            ignoreSelector: IGNORE,
            canPull: canPull,
            refresh: refresh
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    // Exposed for the tests that check this table against the real page functions.
    window.iskoolTeacherPullPages = PAGES;
})();
