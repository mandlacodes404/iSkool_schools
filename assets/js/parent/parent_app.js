/* assets/js/parent/parent_app.js
   The parent app: Home, Report, Syllabus, News, Events, the "Add a child" screen and the child switcher.
   The menus around them (sidebar, phone menu, account card, search, theme) are in parent_menu.js, which loads first.
   Talks to the endpoints in api/parent/ (get_children, get_home, get_report, get_syllabus, get_news, get_events and,
   for "Add a child", redeem_parent_invite).
   Everything that comes from the server is put on the page as text nodes (textContent), never as markup. */
(function () {
    'use strict';

    var CACHE_MS = 60 * 1000;
    var MINUS = '−';

    var root = document.getElementById('parentApp');
    var view = document.getElementById('paView');
    // On phones this is the area that scrolls (the header and the bottom tabs stay still); on desktop the page scrolls
    var content = document.querySelector('.pa-content');
    var switcher = document.getElementById('paSwitcher');

    var ROUTES = {
        home: renderHome,
        report: renderReport,
        syllabus: renderSyllabus,
        news: renderNews,
        events: renderEvents,
        'add-child': renderAddChild
    };

    var state = {
        parent: { name: textOf('.pa-account-name') || 'Parent', email: root ? (root.getAttribute('data-email') || '') : '' },
        children: [],
        // 'loading' until get_children.php answers, then 'ready' or 'failed'. An empty list only means "no children
        // linked" when the status is 'ready'; after a failed load it just means we do not know yet.
        childrenStatus: 'loading',
        childId: null,
        reportTerm: null,
        syllabusTerm: null,
        newsFilter: 'all',
        newsRead: null,
        eventsFilter: 'all'
    };
    // Screens that show one child's data (they need at least one linked child)
    var NEEDS_CHILD = { home: true, report: true, syllabus: true, news: true, events: true };
    // Screens that cover all the children at once (or none in particular), so the child switcher is hidden on them
    var ALL_CHILDREN = { news: true, events: true, 'add-child': true };
    var cache = {};
    // The last answer the server gave for each screen. Unlike `cache` (a minute, so a quick tap back does not ask
    // again) it is kept for as long as the app stays open, and on the phone for the next visit (see "Saved copies").
    // A screen with a copy is drawn from it at once while the server is asked again; it is also what shows when the
    // server cannot be reached.
    var lastSeen = {};
    var renderId = 0;
    // When the screen on show was drawn from lastSeen (no connection), the time that copy was fetched; otherwise null
    var viewCopy = null;
    var errorOnScreen = false;
    // Requests on their way, by key: asking again for the same thing joins the first request
    var inflight = {};
    var revalidating = {};
    // Goes up when the copies are thrown away, so an answer that was already on its way cannot bring an old one back
    var generation = 0;
    // Set by cached() while a screen has nothing to draw yet and must wait for the server; render() then shows the loader
    var waiting = false;
    // Set while a refresh runs: cached() asks the server instead of drawing the copy
    var forcing = false;
    var readyAnnounced = false;

    // ── Small helpers ──────────────────────────────────────────────────────────────────────────────────────

    function textOf(selector) {
        var node = document.querySelector(selector);
        return node ? node.textContent.trim() : '';
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function append(parent) {
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i]) parent.appendChild(arguments[i]);
        }
        return parent;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function pct(n) {
        return n === null || n === undefined ? '–' : n + '%';
    }

    function number(n) {
        return String(Math.round(n * 10) / 10);
    }

    /** "+3", "−2" or an en dash, with the colour class. */
    function deltaInfo(d) {
        if (d === null || d === undefined) return { text: '', cls: 'is-flat' };
        if (d > 0) return { text: '+' + d, cls: 'is-up' };
        if (d < 0) return { text: MINUS + Math.abs(d), cls: 'is-down' };
        return { text: '–', cls: 'is-flat' };
    }

    /** "+1 since Term 2", "Same as Term 2" or nothing. */
    function changeLine(change, prevTerm) {
        if (change === null || change === undefined || !prevTerm) return null;
        var label = 'Term ' + prevTerm;
        if (change > 0) return { text: '+' + change + ' since ' + label, cls: 'is-up' };
        if (change < 0) return { text: MINUS + Math.abs(change) + ' since ' + label, cls: 'is-down' };
        return { text: 'Same as ' + label, cls: 'is-flat' };
    }

    function storeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function storeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode: fine */ }
    }

    // ── Talking to the server ──────────────────────────────────────────────────────────────────────────────

    function toLogin() {
        forgetSaved();   // the session is over: the copy kept on this phone goes with it
        window.location.href = 'index.php?session=expired';
    }

    /** GET a parent API endpoint. Resolves with the data, rejects with an Error that has .code. */
    function api(path, params) {
        var url = path;
        if (params) {
            var q = [];
            Object.keys(params).forEach(function (k) {
                q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
            });
            url += '?' + q.join('&');
        }
        return fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(function (res) {
                if (res.status === 401 || res.status === 403) {
                    toLogin();
                    throw fail('auth');
                }
                return res.json().then(function (json) {
                    return { status: res.status, json: json };
                }, function () {
                    // A session timeout redirects to the login page, which is not JSON
                    toLogin();
                    throw fail('auth');
                });
            })
            .then(function (r) {
                if (r.json && r.json.success) return r.json.data;
                if (r.status === 404) throw fail('notfound');
                // The school has not marked an academic year as current: not a connection problem
                if (r.json && r.json.code === 'no_year') throw fail('noyear');
                throw fail('server', r.json && r.json.error);
            }, function (err) {
                if (err && err.code) throw err;
                throw fail('network');
            });
    }

    function fail(code, message) {
        var e = new Error(message || code);
        e.code = code;
        return e;
    }

    function csrfToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? (meta.getAttribute('content') || '') : '';
    }

    /** POST form fields to a parent API endpoint (with the CSRF token). Resolves { status, json } for any JSON answer. */
    function post(path, fields) {
        var body = new URLSearchParams();
        Object.keys(fields).forEach(function (k) { body.append(k, fields[k]); });
        body.append('csrf_token', csrfToken());
        return fetch(path, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRF-Token': csrfToken()
            },
            body: body.toString()
        }).then(function (res) {
            if (res.status === 401 || res.status === 403) {
                toLogin();
                throw fail('auth');
            }
            return res.json().then(function (json) {
                return { status: res.status, json: json || {} };
            }, function () {
                // Not JSON: the session timed out and the server sent the login page
                toLogin();
                throw fail('auth');
            });
        }, function () {
            throw fail('network');
        });
    }

    // ── Saved copies ───────────────────────────────────────────────────────────────────────────────────────
    // Like the learner app, which draws Home from what it saw last time while it asks again, the app keeps the last
    // answer for each screen (and the list of children) on this phone, under this parent's email. Opening the app, or
    // a screen not opened for a minute, draws that copy at once and the server is asked in the background; the screen
    // is drawn again only when the answer is different. The copy holds what the screens show (the marks), so it is
    // removed when the parent signs out or the session ends, a copy that belongs to another parent is removed when
    // the app opens, and none is used after 30 days.
    var SAVED_PREFIX = 'parentApp.saved.';
    var SAVED_KEY = state.parent.email ? SAVED_PREFIX + state.parent.email : '';
    var SAVED_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    var SAVED_MAX_SCREENS = 24;
    var savedChildren = null;       // { at, data }: the list of children from the last visit
    var savedTimer = 0;
    var savedOff = false;           // signed out: nothing may be written any more

    function readSaved() {
        if (!SAVED_KEY) return;
        var saved = null;
        try { saved = JSON.parse(storeGet(SAVED_KEY)); } catch (e) { saved = null; }
        if (!saved || saved.v !== 1) return;
        var usable = function (entry) {
            return !!entry && typeof entry.at === 'number' && !!entry.data && Date.now() - entry.at < SAVED_MAX_AGE;
        };
        if (usable(saved.children)) savedChildren = saved.children;
        Object.keys(saved.screens || {}).forEach(function (key) {
            if (usable(saved.screens[key])) lastSeen[key] = saved.screens[key];
        });
    }

    function writeSaved() {
        if (!SAVED_KEY || savedOff) return;
        var keys = Object.keys(lastSeen).sort(function (a, b) { return lastSeen[b].at - lastSeen[a].at; }).slice(0, SAVED_MAX_SCREENS);
        var screens = {};
        keys.forEach(function (key) { screens[key] = lastSeen[key]; });
        try {
            localStorage.setItem(SAVED_KEY, JSON.stringify({ v: 1, children: savedChildren, screens: screens }));
        } catch (e) { /* full, or private mode: the app just opens without a copy next time */ }
    }

    function saveSoon() {
        clearTimeout(savedTimer);
        savedTimer = setTimeout(writeSaved, 500);
    }

    /** Removes the copy kept on this phone (signing out, or the session ending). */
    function forgetSaved() {
        savedOff = true;
        clearTimeout(savedTimer);
        savedChildren = null;
        try { if (SAVED_KEY) localStorage.removeItem(SAVED_KEY); } catch (e) { /* nothing to remove */ }
    }

    /** The copy of another parent, left by an earlier sign-in on this browser. */
    function dropOtherSaved() {
        try {
            var others = [];
            for (var i = 0; i < localStorage.length; i++) {
                var name = localStorage.key(i);
                if (name && name.indexOf(SAVED_PREFIX) === 0 && name !== SAVED_KEY) others.push(name);
            }
            others.forEach(function (name) { localStorage.removeItem(name); });
        } catch (e) { /* storage blocked: nothing was kept */ }
    }

    /** Throws the copies away: the list of children changed, so a screen drawn from one could show the wrong children. */
    function forgetCopies() {
        generation++;
        cache = {};
        lastSeen = {};
        inflight = {};
        saveSoon();
    }

    function keyOf(path, params) {
        return path + '?' + JSON.stringify(params || {});
    }

    function sameData(a, b) {
        try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
    }

    /** Asks the server and keeps the answer. Asking again for the same thing while a request is on its way shares it. */
    function fetchInto(key, path, params) {
        if (inflight[key]) return inflight[key];
        var mine = generation;
        var request = api(path, params).then(function (data) {
            if (inflight[key] === request) delete inflight[key];
            if (mine === generation) {
                var entry = { at: Date.now(), data: data };
                cache[key] = entry;
                lastSeen[key] = entry;
                saveSoon();
            }
            return data;
        }, function (err) {
            if (inflight[key] === request) delete inflight[key];
            throw err;
        });
        inflight[key] = request;
        return request;
    }

    /**
     * The answer for a screen, as fast as it can be had:
     *   - asked for less than a minute ago: that answer, no request;
     *   - a copy from earlier in this visit, or from the last one: the copy now, and the server is asked in the
     *     background (revalidate), drawing the screen again if the answer is different;
     *   - nothing yet: wait for the server (`waiting` tells render() to show the loader).
     * A refresh (`forcing`) always asks the server, and falls back to the copy only when it cannot be reached.
     */
    function cached(path, params) {
        var key = keyOf(path, params);
        var hit = cache[key];
        var drawing = renderId;     // the screen being drawn now; a late answer must not label a newer screen
        if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);

        var older = lastSeen[key];
        if (older && !forcing) {
            revalidate(key, path, params, older, drawing);
            return Promise.resolve(older.data);
        }

        if (!forcing) waiting = true;
        return fetchInto(key, path, params).then(null, function (err) {
            // No connection, or the server is having a bad moment: show what this phone last saw, and say so (the
            // note above the page). Anything else (signed out, child no longer linked, no school year) is not that.
            var seen = lastSeen[key];
            if (seen && err && (err.code === 'network' || err.code === 'server')) {
                if (drawing === renderId) viewCopy = seen.at;
                return seen.data;
            }
            throw err;
        });
    }

    /** Asks the server again for a screen that was drawn from a copy, and draws it again only if the answer changed. */
    function revalidate(key, path, params, older, drawing) {
        if (revalidating[key]) return;
        revalidating[key] = true;
        fetchInto(key, path, params).then(function (data) {
            delete revalidating[key];
            if (drawing !== renderId) return;                 // the parent has moved on; the new answer is kept for next time
            if (!sameData(data, older.data)) render(false, true);
        }, function (err) {
            delete revalidating[key];
            if (drawing !== renderId || !err) return;
            if (err.code === 'network' || err.code === 'server') {
                // The copy stays on screen, labelled as a copy
                viewCopy = older.at;
                syncOfflineNote();
            } else if (err.code === 'notfound') {
                childGone(drawing);
            } else if (err.code === 'noyear') {
                show(renderNoYear());
            }
        });
    }

    // ── "No connection" note ───────────────────────────────────────────────────────────────────────────────

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    /** "today at 07:30", "yesterday at 07:30" or "27 Oct at 07:30". */
    function savedAtText(ms) {
        var d = new Date(ms);
        var now = new Date();
        var time = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        var sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
        if (sameDay(d, now)) return 'today at ' + time;
        var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        if (sameDay(d, yesterday)) return 'yesterday at ' + time;
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' at ' + time;
    }

    /** Shows or hides the note that tells a parent the page is the last copy this phone saw, not live. */
    function syncOfflineNote() {
        var box = document.getElementById('paOffline');
        if (!box) return;
        clear(box);
        if (viewCopy === null) {
            box.hidden = true;
            return;
        }
        var lead = navigator.onLine === false ? 'You are offline. ' : 'We could not update this page just now. ';
        var retry = el('button', 'pa-offline-btn', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', function () { refreshPage(); });
        append(box, el('span', 'pa-offline-text', lead + 'Showing what you last saw ' + savedAtText(viewCopy) + '.'), retry);
        box.hidden = false;
    }

    // ── Child switcher ─────────────────────────────────────────────────────────────────────────────────────

    function currentChild() {
        for (var i = 0; i < state.children.length; i++) {
            if (state.children[i].id === state.childId) return state.children[i];
        }
        return null;
    }

    function chooseChild() {
        var saved = parseInt(storeGet('parentApp.child'), 10);
        var found = state.children.filter(function (c) { return c.id === saved; })[0];
        state.childId = found ? found.id : (state.children[0] ? state.children[0].id : null);
    }

    function syncSwitcher(route) {
        switcher.hidden = state.children.length < 2 || !!ALL_CHILDREN[route];
    }

    function renderSwitcher() {
        clear(switcher);
        syncSwitcher(currentRoute());
        if (state.children.length < 2) return;
        state.children.forEach(function (c) {
            var chip = el('button', 'pa-chip');
            chip.type = 'button';
            chip.setAttribute('aria-pressed', c.id === state.childId ? 'true' : 'false');
            append(chip, el('span', 'pa-chip-av', c.initials), el('span', null, c.first_name || c.name));
            chip.addEventListener('click', function () {
                if (state.childId === c.id) return;
                state.childId = c.id;
                storeSet('parentApp.child', String(c.id));
                renderSwitcher();
                render();
                kickOffPrefetches(800);      // the other screens of this child, quietly, so they open at once too
            });
            switcher.appendChild(chip);
        });
    }

    // ── Router ─────────────────────────────────────────────────────────────────────────────────────────────

    function currentRoute() {
        var name = (window.location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
        return ROUTES[name] ? name : 'home';
    }

    /** Opens a page. On phones parent_menu.js replaces the history entry instead of adding one (see paGo there). */
    function go(route) {
        if (window.paGo) window.paGo(route);
        else window.location.hash = '#/' + route;
    }

    function markActiveLinks(route) {
        var links = document.querySelectorAll('[data-route]');
        for (var i = 0; i < links.length; i++) {
            if (links[i].getAttribute('data-route') === route) links[i].setAttribute('aria-current', 'page');
            else links[i].removeAttribute('aria-current');
        }
    }

    function show(node) {
        hideLoader();
        clear(view);
        view.appendChild(node);
        view.removeAttribute('aria-busy');
        syncOfflineNote();
    }

    // ── Loaders ────────────────────────────────────────────────────────────────────────────────────────────
    // Phones get the learner app's: a placeholder shaped like Home while Home loads, and the blue arc over the page
    // while a screen with nothing to show yet waits for the server. The arc comes up only if the wait lasts more
    // than a moment, so an answer that arrives at once never flashes it, and never while the splash is covering
    // the page. Desktop keeps the plain "Loading…" line.
    var LOADER_DELAY_MS = 150;
    var loaderEl = document.getElementById('paLoader');
    var loaderTimer = 0;

    function splashUp() {
        var splash = document.getElementById('pa-splash');
        return !!splash && splash.style.display !== 'none' && !splash.classList.contains('pa-splash-hidden');
    }

    function showLoader() {
        if (!loaderEl) return;
        clearTimeout(loaderTimer);
        loaderTimer = setTimeout(function () {
            if (!splashUp()) loaderEl.classList.add('is-on');
        }, LOADER_DELAY_MS);
    }

    function hideLoader() {
        clearTimeout(loaderTimer);
        if (loaderEl) loaderEl.classList.remove('is-on');
    }

    /** Grey blocks where Home will be, like the learner's Home placeholder. */
    function homeSkeleton() {
        var box = el('div', 'pa-sk-home');
        box.setAttribute('aria-hidden', 'true');
        ['pa-sk-chip', 'pa-sk-title', 'pa-sk-line', 'pa-sk-hero', 'pa-sk-label', 'pa-sk-grid', 'pa-sk-label', 'pa-sk-row', 'pa-sk-row'].forEach(function (cls) {
            var block = el('div', 'pa-sk ' + cls);
            if (cls === 'pa-sk-grid') {
                for (var i = 0; i < 4; i++) block.appendChild(el('span', 'pa-sk'));
            }
            box.appendChild(block);
        });
        return box;
    }

    function showLoading() {
        clear(view);
        view.setAttribute('aria-busy', 'true');
        viewCopy = null;
        syncOfflineNote();
        if (isPhone()) {
            if (currentRoute() === 'home') view.appendChild(homeSkeleton());
            showLoader();
        } else {
            view.appendChild(el('p', 'pa-muted pa-loading', 'Loading…'));
        }
    }

    /**
     * Draws the current screen. `quiet` keeps what is on screen until the new data arrives (a refresh), instead of
     * clearing it to "Loading…". Returns a promise that settles once the screen has been drawn.
     */
    function render(afterNavigation, quiet) {
        var route = currentRoute();
        var id = ++renderId;
        window.paRoute = route;     // the page on show (parent_menu.js paGo and parent_back_button.js read it)
        var done = Promise.resolve();
        viewCopy = null;
        errorOnScreen = false;
        waiting = false;
        hideLoader();
        markActiveLinks(route);
        syncSwitcher(route);

        var needsChildren = !!NEEDS_CHILD[route];
        if (route === 'add-child' && state.childrenStatus === 'loading') {
            // It does not need the list, but start() draws the page again when the list arrives, which would
            // wipe a link the parent had already pasted, so it waits for the first load too
            showLoading();
        } else if (needsChildren && state.childrenStatus === 'loading') {
            showLoading(); // start() draws the page once the children arrive
        } else if (needsChildren && state.childrenStatus === 'failed') {
            show(renderError());
        } else if (needsChildren && !state.children.length) {
            show(renderNoChildren());
        } else {
            var build = ROUTES[route];
            var result = build(id);
            if (result && typeof result.then === 'function') {
                // Only a screen with nothing to draw yet shows a loader. With an answer at hand the page on show
                // simply stays until the new one is drawn a moment later, so nothing flashes.
                if (!quiet && waiting) showLoading();
                done = result.then(function (built) {
                    if (id === renderId && built) show(built);
                }, function (err) {
                    if (id !== renderId) return;
                    if (err && err.code === 'notfound') return childGone(id);
                    show(err && err.code === 'noyear' ? renderNoYear() : renderError());
                });
            } else if (result) {
                show(result);
            }
        }

        if (afterNavigation) {
            window.scrollTo(0, 0);
            if (content) content.scrollTop = 0;
            try { view.focus({ preventScroll: true }); } catch (e) { view.focus(); }
        }
        return done;
    }

    /** The child on show is no longer linked: forget the copies, ask for the list of children again, and draw again. */
    function childGone(id) {
        forgetCopies();
        return loadChildren().then(function () {
            renderSwitcher();
            if (id === renderId) return render();
        }, function () {
            if (id === renderId) show(renderError());
        });
    }

    // (parent_menu.js listens for the same change and puts the menus away)
    window.addEventListener('hashchange', function () {
        render(true);
    });

    // Home draws a different layout on phones, so draw it again when the window crosses the phone breakpoint
    if (window.matchMedia) {
        var phoneQuery = window.matchMedia('(max-width: 768px)');
        var onBreakpoint = function () { if (currentRoute() === 'home') render(); };
        if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', onBreakpoint);
        else if (phoneQuery.addListener) phoneQuery.addListener(onBreakpoint);
    }

    // ── Shared view pieces ─────────────────────────────────────────────────────────────────────────────────

    function stateCard(title, text, buttonLabel, onClick) {
        var card = el('div', 'pa-card pa-state');
        append(card, el('h1', 'pa-h1', title), el('p', null, text));
        if (buttonLabel) {
            var btn = el('button', 'pa-btn', buttonLabel);
            btn.type = 'button';
            btn.addEventListener('click', onClick);
            card.appendChild(btn);
        }
        return card;
    }

    function renderNoChildren() {
        return stateCard(
            'No children linked yet',
            'Ask your child to create a parent link in their iSkool app (My Class). Paste that link here and your child appears on this page.',
            'Add a child',
            function () { go('add-child'); }
        );
    }

    function renderError() {
        errorOnScreen = true;
        var offline = navigator.onLine === false;
        return stateCard(
            offline ? 'You are offline' : 'We could not load this page',
            offline ? 'This page could not be loaded without a connection. It will load when you are back online.' : 'Please check your connection and try again.',
            'Try again',
            function () {
                cache = {};
                // If the children never loaded, load them again first. Drawing the page now would wrongly say
                // "No children linked yet".
                if (state.childrenStatus !== 'ready') start();
                else render();
            }
        );
    }

    function renderNoYear() {
        return stateCard(
            'The school year is not set up yet',
            'Your child’s marks and what is coming up will appear here once the school has set up the year. Please check again soon.'
        );
    }

    function eyebrow(child, term) {
        return [child.name, child.class_name, term ? 'Term ' + term : null].filter(Boolean).join(' · ');
    }

    function section(titleText, linkText, linkHref) {
        var wrap = el('section', 'pa-section');
        var head = el('div', 'pa-section-head');
        head.appendChild(el('h2', 'pa-h2', titleText));
        if (linkText) {
            var link = el('a', 'pa-sub', linkText);
            link.href = linkHref;
            link.setAttribute('data-route', linkHref.replace('#/', ''));
            head.appendChild(link);
        }
        wrap.appendChild(head);
        return wrap;
    }

    function emptyRow(text) {
        return el('div', 'pa-empty-row', text);
    }

    function chevron() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M6 9l6 6 6-6');
        svg.appendChild(path);
        return svg;
    }

    // ── Home ───────────────────────────────────────────────────────────────────────────────────────────────

    function renderHome() {
        var child = currentChild();
        if (!child) return renderNoChildren();
        return cached('api/parent/get_home.php', { child: child.id }).then(isPhone() ? buildHomePhone : buildHome);
    }

    function buildHome(d) {
        var root = document.createElement('div');

        // Summary
        var hero = el('div', 'pa-card pa-hero');
        var text = el('div', 'pa-hero-text');
        append(text, el('span', 'pa-eyebrow', eyebrow(d.child, d.term)), el('h1', 'pa-h1', d.headline));
        if (d.note) text.appendChild(el('p', 'pa-note', d.note));
        hero.appendChild(text);

        if (d.average !== null) {
            var avg = el('div', 'pa-avg');
            append(avg, el('span', 'pa-avg-label', 'Term ' + d.term + ' average'), el('span', 'pa-avg-num', pct(d.average)));
            var line = changeLine(d.change, d.prev_term);
            if (line) avg.appendChild(el('span', 'pa-avg-change ' + line.cls, line.text));
            hero.appendChild(avg);
        }
        root.appendChild(hero);

        var cols = el('div', 'pa-cols');
        var main = el('div', 'pa-col-main');
        var side = el('div', 'pa-col-side');

        // Subjects
        var subjects = section('Subjects', d.subjects.length ? 'Full report' : null, '#/report');
        var subjectCard = el('div', 'pa-card');
        if (!d.subjects.length) {
            subjectCard.appendChild(emptyRow('Marks appear here once teachers have marked and published them.'));
        }
        d.subjects.forEach(function (s) {
            var row = el('div', 'pa-row pa-subj');
            var bar = el('span', 'pa-bar');
            var fill = el('span', 'pa-bar-fill');
            fill.style.width = (s.mark === null ? 0 : Math.max(0, Math.min(100, s.mark))) + '%';
            bar.appendChild(fill);
            var delta = deltaInfo(s.delta);
            append(row,
                el('span', 'pa-subj-name', s.name),
                bar,
                el('span', 'pa-subj-mark', pct(s.mark)),
                el('span', 'pa-subj-delta ' + delta.cls, delta.text)
            );
            subjectCard.appendChild(row);
        });
        subjects.appendChild(subjectCard);
        main.appendChild(subjects);

        // Coming up
        var upcoming = section('Coming up', 'See all', '#/events');
        var upCard = el('div', 'pa-card');
        if (!d.upcoming.length) upCard.appendChild(emptyRow('Nothing is due in the next few weeks.'));
        d.upcoming.forEach(function (u) {
            var row = el('div', 'pa-row pa-up-row');
            var date = el('div', 'pa-date');
            append(date, el('span', 'pa-dow', u.dow), el('span', 'pa-day', u.day));
            var info = el('div', 'pa-up-text');
            append(info, el('span', 'pa-title', u.title), el('span', 'pa-sub', u.kind));
            append(row, date, info);
            upCard.appendChild(row);
        });
        upcoming.appendChild(upCard);
        side.appendChild(upcoming);

        // Latest news
        var news = section('Latest news', 'See all', '#/news');
        var newsCard = el('div', 'pa-card');
        if (!d.news.length) newsCard.appendChild(emptyRow('No announcements yet.'));
        d.news.forEach(function (n) {
            var row = el('div', 'pa-row pa-news-row');
            var meta = el('div', 'pa-news-meta');
            append(meta, el('span', 'pa-tag' + (n.tag === 'Teacher' ? ' is-teacher' : ''), n.tag), el('span', 'pa-sub', n.meta));
            append(row, el('span', 'pa-title', n.title), meta);
            newsCard.appendChild(row);
        });
        news.appendChild(newsCard);
        side.appendChild(news);

        append(cols, main, side);
        root.appendChild(cols);
        return root;
    }

    // ── Home on phones ─────────────────────────────────────────────────────────────────────────────────────
    // The same look as the learner app's phone Home: one summary card, the subjects as tiles, what is coming up and
    // the latest news. Phones only (max-width: 768px); buildHome above still draws the desktop page. Like the rest
    // of this file, text from the server goes in as text nodes, never as markup.

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function isPhone() {
        return !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }

    /** Month name for a "YYYY-MM-DD" date, or '' when it cannot be read. */
    function monthOf(ymd) {
        var m = /^\d{4}-(\d{2})-\d{2}/.exec(ymd || '');
        return m ? (MONTHS[parseInt(m[1], 10) - 1] || '') : '';
    }

    /** { text: 'Tomorrow', soon: true } for a date that has not passed yet, else null. "Soon" is within two days. */
    function whenInfo(ymd) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
        if (!m) return null;
        var now = new Date();
        var days = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
        if (isNaN(days) || days < 0) return null;
        return { text: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days', soon: days <= 2 };
    }

    /** "MD" from "Mrs Dlamini", "MR" from "Maple Ridge High". */
    function initialsOf(text) {
        var w = String(text || '').trim().split(/\s+/).filter(Boolean);
        return ((w[0] || '').charAt(0) + (w[1] || '').charAt(0)).toUpperCase();
    }

    function phoneHero(d) {
        var hero = el('div', 'pax-hero');
        var chip = el('span', 'pax-chip', [d.child.class_name, d.term ? 'Term ' + d.term : null].filter(Boolean).join(' · '));
        var text = el('div', 'pax-hero-text');
        append(text, el('h1', 'pax-hl', d.headline));
        if (d.note) text.appendChild(el('p', 'pax-note', d.note));
        append(hero, chip, text);

        if (d.average !== null) {
            var avg = el('div', 'pax-avg');
            var main = el('span', 'pax-avg-main');
            append(main, el('span', 'pax-avg-num', pct(d.average)), el('span', 'pax-avg-label', 'Term ' + d.term + ' average'));
            avg.appendChild(main);
            var line = changeLine(d.change, d.prev_term);
            if (line) avg.appendChild(el('span', 'pax-avg-change ' + line.cls, line.text));
            hero.appendChild(avg);
        }
        return hero;
    }

    function phoneSubjects(d) {
        var wrap = section('Subjects', d.subjects.length ? 'Full report' : null, '#/report');
        if (!d.subjects.length) {
            wrap.appendChild(emptyRow('Marks appear here once teachers have marked and published them.'));
            return wrap;
        }
        var grid = el('div', 'pax-grid');
        d.subjects.forEach(function (s) {
            var tile = el('a', 'pax-tile');
            tile.href = '#/report';
            var delta = deltaInfo(s.delta);
            var mark = el('span', 'pax-tile-mark');
            append(mark, el('b', null, pct(s.mark)), el('span', delta.cls, delta.text));
            var bar = el('span', 'pax-bar');
            var fill = el('span');
            fill.style.width = (s.mark === null ? 0 : Math.max(0, Math.min(100, s.mark))) + '%';
            bar.appendChild(fill);
            append(tile, el('span', 'pax-tile-name', s.name), mark, bar);
            grid.appendChild(tile);
        });
        wrap.appendChild(grid);
        return wrap;
    }

    function phoneUpcoming(d) {
        var wrap = section('Coming up', 'See all', '#/events');
        if (!d.upcoming.length) {
            wrap.appendChild(emptyRow('Nothing is due in the next few weeks.'));
            return wrap;
        }
        d.upcoming.forEach(function (u) {
            var row = el('a', 'pax-row');
            row.href = '#/events';
            var date = el('span', 'pax-date');
            append(date, el('b', null, u.day), el('span', null, monthOf(u.date) || u.dow));
            var info = el('span', 'pax-rt');
            append(info, el('span', 'pax-rt-title', u.title), el('span', 'pax-rt-meta', u.kind));
            append(row, date, info);
            var when = whenInfo(u.date);
            if (when) row.appendChild(el('span', 'pax-when' + (when.soon ? ' is-soon' : ''), when.text));
            wrap.appendChild(row);
        });
        return wrap;
    }

    function phoneNews(d) {
        var wrap = section('Latest news', 'See all', '#/news');
        if (!d.news.length) {
            wrap.appendChild(emptyRow('No announcements yet.'));
            return wrap;
        }
        d.news.forEach(function (n) {
            var teacher = n.tag === 'Teacher';
            var row = el('a', 'pax-row pax-news');
            row.href = '#/news';
            // meta reads "Thu 29 Oct · Mrs Dlamini": what follows the first " · " is who sent it
            var who = String(n.meta || '').split(' · ').slice(1).join(' · ');
            var meta = el('span', 'pax-rt-meta');
            append(meta, el('span', 'pa-tag' + (teacher ? ' is-teacher' : ''), n.tag), el('span', null, n.meta));
            var info = el('span', 'pax-rt');
            append(info, el('span', 'pax-rt-title', n.title), meta);
            append(row, who ? el('span', 'pax-ini' + (teacher ? ' is-round' : ''), initialsOf(who)) : null, info);
            wrap.appendChild(row);
        });
        return wrap;
    }

    function buildHomePhone(d) {
        var root = el('div', 'pax');
        append(root, phoneHero(d), phoneSubjects(d), phoneUpcoming(d), phoneNews(d));
        return root;
    }

    // ── Report ─────────────────────────────────────────────────────────────────────────────────────────────

    function renderReport() {
        var child = currentChild();
        if (!child) return renderNoChildren();
        var params = { child: child.id };
        if (state.reportTerm) params.term = state.reportTerm;
        return cached('api/parent/get_report.php', params).then(buildReport);
    }

    function stat(label, num, sub, subCls) {
        var box = el('div', 'pa-stat');
        append(box, el('span', 'pa-stat-label', label), el('span', 'pa-stat-num', num));
        if (sub) box.appendChild(el('span', 'pa-stat-sub' + (subCls ? ' ' + subCls : ''), sub));
        return box;
    }

    function buildReport(d) {
        var root = document.createElement('div');

        // Title and term buttons
        var head = el('div', 'pa-page-head');
        var titleBox = el('div');
        append(titleBox, el('h1', 'pa-h1', 'Progress report'), el('p', 'pa-sub', eyebrow(d.child, d.term)));
        var terms = el('div', 'pa-terms');
        terms.setAttribute('role', 'group');
        terms.setAttribute('aria-label', 'Term');
        [1, 2, 3, 4].forEach(function (t) {
            var b = el('button', 'pa-term', 'Term ' + t);
            b.type = 'button';
            b.setAttribute('aria-pressed', t === d.term ? 'true' : 'false');
            b.addEventListener('click', function () {
                if (t === d.term) return;
                state.reportTerm = t;
                render();
            });
            terms.appendChild(b);
        });
        append(head, titleBox, terms);
        root.appendChild(head);

        var anyMark = d.subjects.some(function (s) { return s.mark !== null; });
        if (!anyMark) {
            root.appendChild(stateCard(
                'Nothing to show for Term ' + d.term + ' yet',
                'Marks appear here once teachers have marked and published them.'
            ));
            return root;
        }

        // Summary strip
        var stats = el('div', 'pa-card pa-stats');
        var line = changeLine(d.change, d.prev_term);
        stats.appendChild(stat('Term ' + d.term + ' average', pct(d.average), line ? line.text : '', line ? 'pa-avg-change ' + line.cls : ''));
        if (d.highest) stats.appendChild(stat('Highest', pct(d.highest.mark), d.highest.name));
        if (d.lowest) stats.appendChild(stat('Lowest', pct(d.lowest.mark), d.lowest.name));
        root.appendChild(stats);

        // Subjects
        var table = el('div', 'pa-card');
        var cols = el('div', 'pa-table-head');
        ['Subject', 'Marked so far', 'Mark', 'Level', 'Change', ''].forEach(function (label) {
            cols.appendChild(el('span', null, label));
        });
        cols.setAttribute('aria-hidden', 'true');
        table.appendChild(cols);

        d.subjects.forEach(function (s, i) {
            table.appendChild(buildReportRow(s, d.term, i));
        });
        root.appendChild(table);

        root.appendChild(el('p', 'pa-foot', 'Levels use the CAPS scale, 1 to 7. Marks show once a teacher has marked and published them.'));
        return root;
    }

    function buildReportRow(s, term, index) {
        var wrap = el('div', 'pa-rsubj-wrap');
        var panelId = 'paWork' + index;

        var btn = el('button', 'pa-rsubj');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panelId);

        var name = el('span', 'c-name');
        name.appendChild(document.createTextNode(s.name));
        if (s.assessed !== null) name.appendChild(el('span', 'c-sub', s.assessed + '% of the term marked'));
        else name.appendChild(el('span', 'c-sub is-always', 'No marks published yet'));
        var delta = deltaInfo(s.delta);
        append(btn,
            name,
            el('span', 'c-marked', s.assessed !== null ? s.assessed + '%' : '–'),
            el('span', 'c-mark', pct(s.mark)),
            s.level !== null ? levelPill(s.level) : el('span', 'c-level'),
            el('span', 'c-delta ' + delta.cls, delta.text),
            append(el('span', 'c-chev'), chevron())
        );

        var panel = el('div', 'pa-work');
        panel.id = panelId;
        panel.hidden = true;
        fillWork(panel, s, term);

        btn.addEventListener('click', function () {
            var open = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            panel.hidden = open;
        });

        append(wrap, btn, panel);
        return wrap;
    }

    function levelPill(level) {
        var span = el('span', 'c-level');
        span.appendChild(el('span', 'pa-pill', 'Level ' + level));
        return span;
    }

    function fillWork(panel, s, term) {
        if (s.mark !== null && s.assessed !== null) {
            panel.appendChild(el('p', 'pa-work-note', 'Based on ' + s.assessed + '% of the term’s marks so far.'));
        }
        if (!s.work.length) {
            panel.appendChild(el('p', 'pa-work-note', 'No marked work yet for Term ' + term + '.'));
            return;
        }
        s.work.forEach(function (w) {
            var row = el('div', 'pa-work-row');
            var info = el('div', 'pa-work-text');
            var detail;
            if (w.summative) {
                detail = w.weight > 0 ? 'Counts ' + number(w.weight) + '% of the term' : 'Counts towards the term mark';
            } else {
                detail = 'Practice, not in the term mark';
            }
            append(info, el('span', 'pa-title', w.title), el('span', 'pa-sub', [w.date, detail].filter(Boolean).join(' · ')));
            append(row, info, el('span', 'pa-work-pct', pct(w.pct)));
            panel.appendChild(row);
        });
    }

    // ── Syllabus ───────────────────────────────────────────────────────────────────────────────────────────

    function renderSyllabus() {
        var child = currentChild();
        if (!child) return renderNoChildren();
        return cached('api/parent/get_syllabus.php', { child: child.id }).then(buildSyllabus);
    }

    /** The term to show: the one the parent chose, else the current term, else the latest one before it, else the first. */
    function pickSyllabusTerm(d) {
        if (state.syllabusTerm && d.terms.indexOf(state.syllabusTerm) !== -1) return state.syllabusTerm;
        if (d.terms.indexOf(d.current_term) !== -1) return d.current_term;
        var earlier = d.terms.filter(function (t) { return t <= d.current_term; });
        return earlier.length ? earlier[earlier.length - 1] : d.terms[0];
    }

    function buildSyllabus(d) {
        if (!d.briefs.length) {
            return stateCard(
                'No syllabus posted yet',
                'Teachers post the syllabus for each subject at the start of a term. It will appear here once they do.'
            );
        }

        var root = document.createElement('div');
        var term = pickSyllabusTerm(d);

        // Title and term buttons (only the terms that have a syllabus)
        var head = el('div', 'pa-page-head');
        var titleBox = el('div');
        var sub = [d.child.name, d.child.class_name, 'Term ' + term + (term === d.current_term ? ' (current)' : '')]
            .filter(Boolean).join(' · ');
        append(titleBox, el('h1', 'pa-h1', 'Syllabus'), el('p', 'pa-sub', sub));
        var terms = el('div', 'pa-terms');
        terms.setAttribute('role', 'group');
        terms.setAttribute('aria-label', 'Term');
        d.terms.forEach(function (t) {
            var b = el('button', 'pa-term', 'Term ' + t);
            b.type = 'button';
            b.setAttribute('aria-pressed', t === term ? 'true' : 'false');
            b.addEventListener('click', function () {
                if (t === term) return;
                state.syllabusTerm = t;
                render();
            });
            terms.appendChild(b);
        });
        append(head, titleBox, terms);
        root.appendChild(head);

        // One expandable row for each subject
        var card = el('div', 'pa-card');
        d.briefs.filter(function (b) { return b.term === term; }).forEach(function (b, i) {
            card.appendChild(buildBrief(b, i));
        });
        root.appendChild(card);
        root.appendChild(el('p', 'pa-foot', 'Posted by each subject teacher. This is the same syllabus your child sees.'));
        return root;
    }

    function buildBrief(b, index) {
        var wrap = el('div', 'pa-brief-wrap');
        var panelId = 'paBrief' + index;

        var btn = el('button', 'pa-brief');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panelId);
        var meta = [b.teacher];
        if (b.topics.length) meta.push(b.topics.length + (b.topics.length === 1 ? ' topic' : ' topics'));
        var main = el('span', 'pa-brief-main');
        append(main, el('span', 'pa-brief-name', b.subject), el('span', 'pa-brief-meta', meta.join(' · ')));
        append(btn, main, append(el('span', 'pa-chev'), chevron()));

        var panel = el('div', 'pa-brief-panel');
        panel.id = panelId;
        panel.hidden = true;
        fillBrief(panel, b);

        btn.addEventListener('click', function () {
            var open = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            panel.hidden = open;
        });

        append(wrap, btn, panel);
        return wrap;
    }

    function fillBrief(panel, b) {
        if (b.note) {
            var note = el('div', 'pa-brief-note');
            note.appendChild(el('small', null, 'Note from ' + b.teacher));
            note.appendChild(document.createTextNode(b.note));
            panel.appendChild(note);
        }

        if (b.topics.length) {
            panel.appendChild(el('h2', 'pa-label', 'Topics'));
            var list = el('ol', 'pa-topics');
            b.topics.forEach(function (topic, i) {
                var li = el('li');
                li.appendChild(el('span', null, (i < 9 ? '0' : '') + (i + 1)));
                li.appendChild(document.createTextNode(topic));
                list.appendChild(li);
            });
            panel.appendChild(list);
        }

        if (b.assessments.length) {
            panel.appendChild(el('h2', 'pa-label', 'How it is assessed'));
            var stack = el('div', 'pa-stack');
            stack.setAttribute('aria-hidden', 'true');
            b.assessments.forEach(function (a, i) {
                var seg = el('span', 'pa-seg pa-c' + (i % 6));
                seg.style.flex = String(a.weight);
                stack.appendChild(seg);
            });
            panel.appendChild(stack);
            b.assessments.forEach(function (a, i) {
                var row = el('div', 'pa-wrow');
                append(row, el('i', 'pa-c' + (i % 6)), el('span', null, a.type), el('b', null, number(a.weight) + '%'));
                panel.appendChild(row);
            });
        }

        if (!b.note && !b.topics.length && !b.assessments.length) {
            panel.appendChild(el('p', 'pa-work-note', 'No details have been posted for this subject yet.'));
        }
        if (b.updated) panel.appendChild(el('p', 'pa-brief-foot', 'Updated ' + b.updated));
    }

    // ── News ───────────────────────────────────────────────────────────────────────────────────────────────

    var NEWS_FILTERS = [['all', 'All'], ['school', 'School'], ['teacher', 'Teacher']];
    var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    function renderNews() {
        return cached('api/parent/get_news.php').then(buildNews);
    }

    function newsReadKey() {
        return 'parentApp.read.' + (state.parent.email || '');
    }

    function saveNewsRead(items) {
        // Keep only announcements still in the feed, so the saved list cannot grow for ever
        var ids = items.filter(function (n) { return state.newsRead[n.id]; }).map(function (n) { return n.id; });
        storeSet(newsReadKey(), JSON.stringify(ids));
    }

    /**
     * Which announcements this parent has opened. It is kept in this browser, like the learner's announcements.
     * On the first visit anything older than a week counts as read, so a new parent is not met by a long unread list.
     */
    function loadNewsRead(items) {
        if (state.newsRead) return state.newsRead;
        var saved = null;
        try { saved = JSON.parse(storeGet(newsReadKey())); } catch (e) { saved = null; }
        state.newsRead = {};
        if (Array.isArray(saved)) {
            saved.forEach(function (id) { state.newsRead[id] = true; });
        } else {
            var cutoff = Date.now() - WEEK_MS;
            items.forEach(function (n) {
                if (n.ts * 1000 < cutoff) state.newsRead[n.id] = true;
            });
            saveNewsRead(items);
        }
        return state.newsRead;
    }

    function buildNews(d) {
        if (!d.items.length) {
            return stateCard(
                'No news yet',
                'Announcements from the school and from your child’s teachers will appear here.'
            );
        }

        var read = loadNewsRead(d.items);
        var root = document.createElement('div');
        var rows = [];

        // Title, unread count and the All / School / Teacher buttons
        var head = el('div', 'pa-page-head');
        var titleBox = el('div');
        var sub = el('p', 'pa-news-sub');
        var subText = el('span');
        var markAll = el('button', 'pa-link-btn', 'Mark all as read');
        markAll.type = 'button';
        append(sub, subText, markAll);
        append(titleBox, el('h1', 'pa-h1', 'News'), sub);

        var filters = el('div', 'pa-terms');
        filters.setAttribute('role', 'group');
        filters.setAttribute('aria-label', 'Show');
        var filterButtons = NEWS_FILTERS.map(function (f) {
            var b = el('button', 'pa-term', f[1]);
            b.type = 'button';
            b.addEventListener('click', function () {
                if (state.newsFilter === f[0]) return;
                state.newsFilter = f[0];
                drawList();
            });
            filters.appendChild(b);
            return b;
        });
        append(head, titleBox, filters);
        root.appendChild(head);

        var card = el('div', 'pa-card');
        root.appendChild(card);
        if (d.more) {
            root.appendChild(el('p', 'pa-foot', 'Showing the latest ' + d.items.length + ' announcements.'));
        }

        function unreadCount() {
            return d.items.filter(function (n) { return !read[n.id]; }).length;
        }

        /** Dots, bold titles, the count and the Mark all button follow what has been read */
        function syncUnread() {
            var unread = unreadCount();
            subText.textContent = unread ? unread + ' unread' : 'You are all caught up';
            markAll.hidden = unread === 0;
            rows.forEach(function (r) { r.sync(); });
        }

        function markRead(n) {
            if (read[n.id]) return;
            read[n.id] = true;
            saveNewsRead(d.items);
            syncUnread();
        }

        markAll.addEventListener('click', function () {
            d.items.forEach(function (n) { read[n.id] = true; });
            saveNewsRead(d.items);
            syncUnread();
        });

        function drawList() {
            var f = state.newsFilter;
            filterButtons.forEach(function (b, i) {
                b.setAttribute('aria-pressed', NEWS_FILTERS[i][0] === f ? 'true' : 'false');
            });
            clear(card);
            rows = [];
            var shown = d.items.filter(function (n) { return f === 'all' || n.kind === f; });
            if (!shown.length) {
                card.appendChild(emptyRow(f === 'school' ? 'No school announcements yet.' : 'No teacher announcements yet.'));
            }
            shown.forEach(function (n) {
                var item = buildNewsItem(n, read, markRead);
                rows.push(item);
                card.appendChild(item.node);
            });
            syncUnread();
        }

        drawList();
        return root;
    }

    function buildNewsItem(n, read, markRead) {
        var wrap = el('div', 'pa-item-wrap');
        var panelId = 'paNews' + n.id;

        var btn = el('button', 'pa-item');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panelId);

        var dot = el('span', 'pa-dot');
        var main = el('span', 'pa-item-main');
        var meta = el('span', 'pa-item-meta');
        var who = n.kind === 'teacher' && n.for ? n.sender + ' · for ' + n.for : n.sender;
        append(meta, el('span', 'pa-tag' + (n.kind === 'teacher' ? ' is-teacher' : ''), n.tag), el('span', null, [who, n.date].filter(Boolean).join(' · ')));
        append(main, el('span', 'pa-item-title', n.title), meta);
        append(btn, dot, main, append(el('span', 'pa-chev'), chevron()));

        var panel = el('div', 'pa-item-panel');
        panel.id = panelId;
        panel.hidden = true;
        panel.appendChild(el('p', 'pa-item-body', n.message || 'This announcement has no message.'));
        var foot = ['Posted ' + [n.date, n.time].filter(Boolean).join(' at ')];
        if (n.edited) foot.push('Edited ' + n.edited);
        panel.appendChild(el('p', 'pa-brief-foot', foot.join(' · ')));

        btn.addEventListener('click', function () {
            var open = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            panel.hidden = open;
            if (!open) markRead(n);
        });

        // Unread: a dot, a bolder title and a hidden word for screen readers
        var sr = el('span', 'pa-sr', 'Unread. ');
        function sync() {
            var unread = !read[n.id];
            dot.classList.toggle('is-on', unread);
            btn.classList.toggle('is-unread', unread);
            if (unread && !sr.parentNode) main.insertBefore(sr, main.firstChild);
            if (!unread && sr.parentNode) main.removeChild(sr);
        }
        sync();

        append(wrap, btn, panel);
        return { node: wrap, sync: sync };
    }

    // ── Events ─────────────────────────────────────────────────────────────────────────────────────────────

    var EVENT_FILTERS = [['all', 'All'], ['work', 'Work'], ['school', 'School']];

    function renderEvents() {
        return cached('api/parent/get_events.php').then(buildEvents);
    }

    function buildEvents(d) {
        if (!d.items.length) {
            return stateCard(
                'Nothing coming up',
                'Tests, quizzes, assignment due dates and school events for your ' + (d.children > 1 ? 'children' : 'child') + ' will appear here.'
            );
        }

        var root = document.createElement('div');

        // Title and the All / Work / School buttons
        var head = el('div', 'pa-page-head');
        var titleBox = el('div');
        append(titleBox, el('h1', 'pa-h1', 'Events'), el('p', 'pa-sub', 'Coming up for your ' + (d.children > 1 ? 'children' : 'child')));
        var filters = el('div', 'pa-terms');
        filters.setAttribute('role', 'group');
        filters.setAttribute('aria-label', 'Show');
        var filterButtons = EVENT_FILTERS.map(function (f) {
            var b = el('button', 'pa-term', f[1]);
            b.type = 'button';
            b.addEventListener('click', function () {
                if (state.eventsFilter === f[0]) return;
                state.eventsFilter = f[0];
                drawList();
            });
            filters.appendChild(b);
            return b;
        });
        append(head, titleBox, filters);
        root.appendChild(head);

        var list = el('div', 'pa-ev-list');
        root.appendChild(list);
        if (d.more) {
            root.appendChild(el('p', 'pa-foot', 'Showing the next ' + d.items.length + ' items.'));
        }

        function drawList() {
            var f = state.eventsFilter;
            filterButtons.forEach(function (b, i) {
                b.setAttribute('aria-pressed', EVENT_FILTERS[i][0] === f ? 'true' : 'false');
            });
            clear(list);
            var shown = d.items.filter(function (n) { return f === 'all' || n.section === f; });
            if (!shown.length) {
                var empty = el('div', 'pa-card');
                empty.appendChild(emptyRow(f === 'work'
                    ? 'No tests, quizzes or due dates coming up.'
                    : 'No school events or holidays coming up.'));
                list.appendChild(empty);
                return;
            }
            // One heading and card for each run of items with the same heading (Today, Tomorrow, This week...)
            var group = null;
            var card = null;
            shown.forEach(function (n) {
                if (n.group !== group) {
                    group = n.group;
                    var sec = section(group);
                    card = el('div', 'pa-card');
                    sec.appendChild(card);
                    list.appendChild(sec);
                }
                card.appendChild(buildEventRow(n));
            });
        }

        drawList();
        return root;
    }

    function buildEventRow(n) {
        var row = el('div', 'pa-row pa-up-row pa-ev-row' + (n.done ? ' is-done' : ''));
        var date = el('div', 'pa-date');
        append(date, el('span', 'pa-dow', n.dow), el('span', 'pa-day', n.day));

        var text = el('div', 'pa-up-text');
        var meta = el('span', 'pa-ev-meta');
        var tagClass = 'pa-tag' + (n.section === 'work' ? ' is-work' : '');
        var detail = [n.subject, n.time, n.for ? 'for ' + n.for : ''].filter(Boolean).join(' · ');
        append(meta, el('span', tagClass, n.kind));
        if (detail) meta.appendChild(el('span', null, detail));
        append(text, el('span', 'pa-title', n.title), meta);

        append(row, date, text);
        return row;
    }

    // ── Add a child ────────────────────────────────────────────────────────────────────────────────────────
    // The parent pastes the invite link (or just the code) their child shared. Linking happens on the server
    // (api/parent/redeem_parent_invite.php), so it works the same inside the installed app as in a browser.

    var INVITE_CODE = /(?:^|[^a-f0-9])([a-f0-9]{32})(?![a-f0-9])/i;
    var INVITE_HOST = /https?:\/\/([^\s/?#]+)/i;

    /** The 32-character invite code inside what was pasted: the whole link, a message that holds the link, or the bare code. */
    function extractInviteCode(text) {
        var match = INVITE_CODE.exec(String(text || ''));
        return match ? match[1].toLowerCase() : null;
    }

    /** True when the pasted text holds a link to a different address than this app (usually another school). */
    function isOtherAddress(text) {
        var match = INVITE_HOST.exec(String(text || ''));
        return !!match && match[1].toLowerCase() !== window.location.host.toLowerCase();
    }

    /** Resolves { ok: true, name, already } or { ok: false, error }. Rejects only for network and session problems. */
    function redeemInvite(code) {
        return post('api/parent/redeem_parent_invite.php', { code: code }).then(function (r) {
            var json = r.json;
            if (json.success) {
                return { ok: true, name: json.learner_name || '', already: !!json.already_linked };
            }
            var known = json.error && json.error !== 'Invalid CSRF token';
            return { ok: false, error: known ? json.error : 'Something went wrong. Please refresh the page and try again.' };
        });
    }

    function renderAddChild() {
        var root = el('div', 'pa-card pa-state pa-add');
        drawAddForm(root);
        return root;
    }

    function drawAddForm(root) {
        clear(root);
        var intro = state.children.length
            ? 'Ask your child to open My Class in their iSkool app and create a parent link. Then paste the link or code here.'
            : 'Ask your child to open My Class in their iSkool app and create a parent link. Then paste the link or code here and your child appears on this page.';
        append(root, el('h1', 'pa-h1', 'Add a child'), el('p', null, intro));

        var form = el('form', 'pa-add-form');
        form.noValidate = true;

        var label = el('label', 'pa-add-label', 'Invite link or code');
        label.setAttribute('for', 'paInviteInput');

        var input = el('input', 'pa-input');
        input.type = 'text';
        input.id = 'paInviteInput';
        input.name = 'invite';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('autocapitalize', 'none');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('enterkeyhint', 'go');
        input.setAttribute('placeholder', 'Paste the link here');

        var msg = el('p', 'pa-form-msg');
        msg.setAttribute('role', 'status');
        msg.setAttribute('aria-live', 'polite');
        msg.hidden = true;

        // The learner's button with the pill spinner: the label is replaced by the ring while the link is checked
        var button = el('button', 'pa-btn btn-loadable');
        button.type = 'submit';
        var buttonLabel = el('span', 'btn-label', 'Link my child');
        var spinner = el('span', 'btn-spinner');
        spinner.setAttribute('aria-hidden', 'true');
        for (var dot = 0; dot < 8; dot++) spinner.appendChild(document.createElement('span'));
        append(button, buttonLabel, spinner);
        function busy(on) {
            button.disabled = on;
            button.classList.toggle('is-loading', on);
        }

        var note = el('p', 'pa-form-note', 'A link works once and expires after 48 hours. If it does not work, ask your child to make a new one.');

        append(form, label, input, msg, button);
        append(root, form, note);

        function say(text) {
            msg.textContent = text;
            msg.hidden = false;
            msg.classList.add('is-error');
        }

        input.addEventListener('input', function () { msg.hidden = true; });

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            if (button.disabled) return;

            var pasted = input.value;
            var code = extractInviteCode(pasted);
            if (!code) {
                say('That does not look like an invite link or code. Copy the whole link your child shared and paste it here.');
                input.focus();
                return;
            }

            busy(true);
            msg.hidden = true;

            redeemInvite(code).then(function (result) {
                if (!result.ok) {
                    var text = result.error;
                    if (isOtherAddress(pasted)) {
                        text += ' This link is for a different address than this app, so it may belong to another school.';
                    }
                    say(text);
                    busy(false);
                    input.focus();
                    return;
                }
                return finishAddChild(root, result);
            }).then(null, function (err) {
                if (err && err.code === 'auth') return;
                say('We could not reach iSkool. Check your connection and try again.');
                busy(false);
            });
        });
    }

    /** The child is linked: refresh the list, make the new child the one on show, and confirm. */
    function finishAddChild(root, result) {
        var before = state.children.map(function (c) { return c.id; });
        forgetCopies();    // the screens that cover every child must not come back from a copy that lacks the new one
        return loadChildren().then(function () {
            var added = state.children.filter(function (c) { return before.indexOf(c.id) === -1; })[0];
            if (added) {
                state.childId = added.id;
                storeSet('parentApp.child', String(added.id));
            }
            renderSwitcher();
            drawAddDone(root, result, false);
        }, function () {
            // Linked, but the list could not be refreshed: the page is reloaded when the parent goes to Home
            drawAddDone(root, result, true);
        });
    }

    function drawAddDone(root, result, needsReload) {
        clear(root);
        var who = result.name || 'Your child';
        var text = result.already
            ? who + ' was already on your account, so nothing changed.'
            : who + ' is now on your account. You can see their results, syllabus, news and events.';
        append(root, el('h1', 'pa-h1', result.already ? 'Already linked' : 'Child linked'), el('p', null, text));

        var actions = el('div', 'pa-actions');
        var home = el('button', 'pa-btn', 'Go to Home');
        home.type = 'button';
        home.addEventListener('click', function () {
            if (needsReload) {
                go('home');
                window.location.reload();
                return;
            }
            go('home');
        });
        var another = el('button', 'pa-btn is-ghost', 'Add another child');
        another.type = 'button';
        another.addEventListener('click', function () { drawAddForm(root); });
        append(actions, home, another);
        root.appendChild(actions);
        try { home.focus({ preventScroll: true }); } catch (e) { home.focus(); }
    }

    // ── Start ──────────────────────────────────────────────────────────────────────────────────────────────

    function applyChildren(data) {
        state.parent = { name: data.parent.name, email: data.parent.email };
        state.children = data.children;
        state.childrenStatus = 'ready';
        chooseChild();
        if (window.paMenu) window.paMenu.setParent(state.parent);
    }

    /** Asks for the list of children. Resolves true when it is different from the list kept from before. */
    function loadChildren() {
        return api('api/parent/get_children.php').then(function (data) {
            var changed = !savedChildren || !sameData(data, savedChildren.data);
            savedChildren = { at: Date.now(), data: data };
            if (!savedOff) saveSoon();
            applyChildren(data);
            return changed;
        });
    }

    // The five screens and what they ask for. The same list serves the quiet requests below, so the keys always match
    // the ones the screens use (see renderHome, renderReport and the others).
    var SCREENS = {
        home:     { path: 'api/parent/get_home.php',     child: true },
        report:   { path: 'api/parent/get_report.php',   child: true, term: true },
        syllabus: { path: 'api/parent/get_syllabus.php', child: true },
        news:     { path: 'api/parent/get_news.php' },
        events:   { path: 'api/parent/get_events.php' }
    };

    function screenParams(name, childId) {
        var spec = SCREENS[name];
        if (!spec.child) return null;
        var params = { child: childId };
        if (spec.term && state.reportTerm) params.term = state.reportTerm;
        return params;
    }

    /** The very first visit has no copy, so the first screen is asked for together with the list of children. */
    function warmUp() {
        var name = currentRoute();
        var spec = SCREENS[name];
        var guess = parseInt(storeGet('parentApp.child'), 10);   // the child this phone showed last time
        if (!spec || (spec.child && !guess)) return;
        var params = screenParams(name, guess);
        fetchInto(keyOf(spec.path, params), spec.path, params).then(null, function () { /* the screen asks again when it is drawn */ });
    }

    // ── Quiet requests for the other screens (like the learner app's prefetch) ──────────────────────────────

    var prefetchTimers = [];

    function prefetchScreen(name) {
        var spec = SCREENS[name];
        var child = currentChild();
        if (!spec || name === currentRoute() || navigator.onLine === false) return;
        if (spec.child && !child) return;
        var params = screenParams(name, child ? child.id : 0);
        var key = keyOf(spec.path, params);
        var hit = cache[key];
        if (hit && Date.now() - hit.at < CACHE_MS) return;
        fetchInto(key, spec.path, params).then(null, function () { /* quiet: the screen asks again when it is opened */ });
    }

    /**
     * Once the first screen is up, the others are asked for in the background, a few at a time so they never compete
     * with what the parent is looking at, the way the learner app does after Home. Tapping a tab then draws from
     * what is already here. Not on a phone set to save data.
     */
    function kickOffPrefetches(first) {
        if (navigator.connection && navigator.connection.saveData) return;
        prefetchTimers.forEach(clearTimeout);
        var base = first || 1500;
        prefetchTimers = [
            setTimeout(function () { prefetchScreen('home'); prefetchScreen('report'); }, base),
            setTimeout(function () { prefetchScreen('news'); prefetchScreen('events'); }, base * 2),
            setTimeout(function () { prefetchScreen('syllabus'); }, Math.round(base * 3.4))
        ];
    }

    /** The first screen is on the page (or has failed): the splash can go, and the quiet requests can start. */
    function announceReady() {
        if (readyAnnounced) return;
        readyAnnounced = true;
        try { window.dispatchEvent(new CustomEvent('iskool:home-ready')); } catch (e) { /* old browser: the splash's own time limit applies */ }
        kickOffPrefetches();
    }

    // ── Start ──────────────────────────────────────────────────────────────────────────────────────────────

    /** First load, and "Try again" after a failed first load. */
    function start() {
        // The list of children from the last visit: draw the first screen from it straight away and ask again in the
        // background, instead of waiting for the list before anything else can be asked.
        if (savedChildren) {
            applyChildren(savedChildren.data);
            renderSwitcher();
            var first = render();
            loadChildren().then(function (changed) {
                if (!changed) return;
                renderSwitcher();
                return render(false, true);
            }, function () { /* no signal: the saved list stays, and the screens say so if they are copies */ });
            return first.then(announceReady);
        }

        state.childrenStatus = 'loading';
        showLoading();
        warmUp();

        return loadChildren().then(function () {
            renderSwitcher();
            return render();
        }, function (err) {
            if (err && err.code === 'auth') return;
            state.childrenStatus = 'failed';
            return render(); // Home and Report show the error card, the "coming soon" pages still open
        }).then(announceReady);
    }

    // ── Refresh ────────────────────────────────────────────────────────────────────────────────────────────

    /** Draws the screen on show again in place, asking the server for it (not drawing from a copy first). */
    function renderFresh() {
        forcing = true;
        try {
            return render(false, true);
        } finally {
            forcing = false;
        }
    }

    /**
     * Asks the server again for the screen on show and draws it in place (nothing flashes to "Loading…", and the
     * parent stays where they were on the page). The list of children is fetched again too: a child linked since
     * the page opened appears, one that was unlinked goes away. With no connection the last copy stays on screen.
     * Used by pull to refresh, the "Try again" in the note, when the phone comes back online, and when the app comes
     * back to the front after a while.
     */
    function refreshPage() {
        var route = currentRoute();
        if (!ROUTES[route] || route === 'add-child') return Promise.resolve();
        if (state.childrenStatus === 'loading') return Promise.resolve();     // the first load is still on its way
        cache = {};
        if (state.childrenStatus !== 'ready') return start();                 // the first load failed: all of it again
        return loadChildren().then(function () {
            renderSwitcher();
            return renderFresh();
        }, function (err) {
            if (err && err.code === 'auth') return;
            return renderFresh();                                    // no signal: redraw from the last copy
        });
    }

    // Back online (or back in the app with a connection) while the page shows an old copy or an error: update it
    function updateIfStale() {
        if (navigator.onLine === false) return;
        if (viewCopy !== null || errorOnScreen) refreshPage();
    }

    // Back in the app after a while (the phone was locked, another app was open): what is on the page may be hours
    // old, so update it quietly, as the learner's pages do when they are opened again
    var RESUME_MS = 5 * 60 * 1000;
    var hiddenAt = 0;
    window.addEventListener('online', updateIfStale);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            hiddenAt = Date.now();
            return;
        }
        var away = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        if (away > RESUME_MS && navigator.onLine !== false) refreshPage();
        else updateIfStale();
    });

    // ── Pull to refresh (phones) ───────────────────────────────────────────────────────────────────────────

    function pullAllowed() {
        var route = currentRoute();
        if (!ROUTES[route] || route === 'add-child') return false;                 // the form would lose what was typed
        if (content && content.scrollTop > 0) return false;                        // only from the very top
        if (root.classList.contains('pa-menu-open')) return false;                 // the phone menu is open
        if (document.querySelector('[data-pa-menu]:not(.pa-sheet):not([hidden]), .pa-sheet.is-open')) return false;   // an account menu is open
        return true;
    }

    if (window.iskoolPullToRefresh) {
        window.iskoolPullToRefresh.init({
            scroller: '.pa-content',
            ignoreSelector: 'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
            canPull: pullAllowed,
            refresh: refreshPage
        });
    }

    // Signing out removes the copy kept on this phone (the menu's Sign out is a link to logout.php; the quick search
    // action goes through paData.forget)
    document.addEventListener('click', function (ev) {
        var link = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
        if (link && /(^|\/)logout\.php(\?|#|$)/.test(link.getAttribute('href') || '')) forgetSaved();
    }, true);
    window.paData = { forget: forgetSaved };

    readSaved();
    dropOtherSaved();
    markActiveLinks(currentRoute());
    start();
}());
