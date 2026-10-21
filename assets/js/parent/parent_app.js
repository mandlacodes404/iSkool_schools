/* assets/js/parent/parent_app.js
   The parent app: Home, Report and the frame around them (child switcher, account menu, phone menu, theme).
   Talks to api/parent/get_children.php, get_home.php and get_report.php.
   Everything that comes from the server is put on the page as text nodes (textContent), never as markup. */
(function () {
    'use strict';

    var PHONE_QUERY = '(max-width: 768px)';
    var CACHE_MS = 60 * 1000;
    var MINUS = '−';

    var view = document.getElementById('paView');
    var switcher = document.getElementById('paSwitcher');
    var drawer = document.getElementById('paDrawer');
    var overlay = document.getElementById('paOverlay');
    var menuBtn = document.getElementById('paMenuBtn');
    var menuTriggers = [
        { button: document.getElementById('paAccountBtn'), menu: document.getElementById('paMenuDesktop') },
        { button: document.getElementById('paAvatarBtn'), menu: document.getElementById('paMenuMobile') }
    ];

    var ROUTES = {
        home: renderHome,
        report: renderReport,
        syllabus: renderSyllabus,
        news: renderNews,
        events: function () {
            return renderSoon('Events', 'Tests, due dates and school events will be listed here. For now, what is coming up shows on Home.');
        }
    };

    var state = {
        parent: { name: textOf('.pa-account-name') || 'Parent', email: '' },
        children: [],
        // 'loading' until get_children.php answers, then 'ready' or 'failed'. An empty list only means "no children
        // linked" when the status is 'ready'; after a failed load it just means we do not know yet.
        childrenStatus: 'loading',
        childId: null,
        reportTerm: null,
        syllabusTerm: null,
        newsFilter: 'all',
        newsRead: null
    };
    // Screens that show one child's data (they need at least one linked child)
    var NEEDS_CHILD = { home: true, report: true, syllabus: true, news: true };
    // Screens that cover all the children at once, so the child switcher is hidden on them
    var ALL_CHILDREN = { news: true };
    var cache = {};
    var renderId = 0;
    var drawerOpen = false;
    var drawerCloseTimer = null;
    var lastFocus = null;

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

    function isPhone() {
        return window.matchMedia && window.matchMedia(PHONE_QUERY).matches;
    }

    // ── Talking to the server ──────────────────────────────────────────────────────────────────────────────

    function toLogin() {
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

    function cached(path, params) {
        var key = path + '?' + JSON.stringify(params || {});
        var hit = cache[key];
        if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
        return api(path, params).then(function (data) {
            cache[key] = { at: Date.now(), data: data };
            return data;
        });
    }

    // ── Theme ──────────────────────────────────────────────────────────────────────────────────────────────

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function themeLabel() {
        return currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }

    function syncThemeButtons() {
        var label = themeLabel();
        var buttons = document.querySelectorAll('[data-pa-theme]');
        for (var i = 0; i < buttons.length; i++) buttons[i].textContent = label;
    }

    function toggleTheme() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        storeSet('parentApp.theme', next);
        syncThemeButtons();
    }

    // ── Account menus (desktop sidebar, phone avatar) ──────────────────────────────────────────────────────

    function buildMenus() {
        menuTriggers.forEach(function (t) {
            if (!t.menu) return;
            clear(t.menu);
            var head = el('div', 'pa-menu-head');
            append(head, el('div', 'pa-menu-name', state.parent.name));
            if (state.parent.email) append(head, el('div', 'pa-menu-email', state.parent.email));

            var theme = el('button', 'pa-menu-item');
            theme.type = 'button';
            theme.setAttribute('data-pa-theme', '');

            var out = el('a', 'pa-menu-item pa-danger', 'Sign out');
            out.href = 'logout.php';

            append(t.menu, head, theme, out);
        });
        syncThemeButtons();
    }

    function closeMenus(except) {
        menuTriggers.forEach(function (t) {
            if (!t.menu || t === except) return;
            t.menu.hidden = true;
            if (t.button) t.button.setAttribute('aria-expanded', 'false');
        });
    }

    function toggleMenu(trigger) {
        var willOpen = trigger.menu.hidden;
        closeMenus(willOpen ? trigger : null);
        trigger.menu.hidden = !willOpen;
        trigger.button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    menuTriggers.forEach(function (t) {
        if (!t.button || !t.menu) return;
        t.button.addEventListener('click', function (ev) {
            ev.stopPropagation();
            toggleMenu(t);
        });
        // Clicks inside the menu must not reach the page-level "click outside closes the menu" handler below
        t.menu.addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (ev.target.closest && ev.target.closest('[data-pa-theme]')) {
                toggleTheme();
                closeMenus(null);
            }
        });
    });

    document.addEventListener('click', function (ev) {
        closeMenus(null);
        // The theme button in the phone menu sits outside the account menus
        var themeBtn = ev.target.closest ? ev.target.closest('[data-pa-theme]') : null;
        if (themeBtn) toggleTheme();
    });

    // ── Phone menu (drawer) ────────────────────────────────────────────────────────────────────────────────

    function drawerFocusable() {
        return Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled])'));
    }

    function openDrawer() {
        if (drawerOpen) return;
        drawerOpen = true;
        lastFocus = document.activeElement;
        clearTimeout(drawerCloseTimer);
        closeMenus(null);
        overlay.hidden = false;
        drawer.setAttribute('aria-hidden', 'false');
        menuBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        void drawer.offsetWidth; // start the slide from the closed position
        overlay.classList.add('is-open');
        drawer.classList.add('is-open');
        var items = drawerFocusable();
        if (items.length) items[0].focus();
    }

    function closeDrawer(returnFocus) {
        if (!drawerOpen) return;
        drawerOpen = false;
        overlay.classList.remove('is-open');
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        drawerCloseTimer = setTimeout(function () { overlay.hidden = true; }, 280);
        if (returnFocus !== false && lastFocus && lastFocus.focus) lastFocus.focus();
    }

    if (menuBtn) menuBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openDrawer();
    });
    if (overlay) overlay.addEventListener('click', function () { closeDrawer(); });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
            if (drawerOpen) {
                closeDrawer();
                return;
            }
            var open = menuTriggers.filter(function (t) { return t.menu && !t.menu.hidden; })[0];
            if (open) {
                closeMenus(null);
                open.button.focus();
            }
            return;
        }
        if (ev.key === 'Tab' && drawerOpen) {
            var items = drawerFocusable();
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (ev.shiftKey && document.activeElement === first) {
                ev.preventDefault();
                last.focus();
            } else if (!ev.shiftKey && document.activeElement === last) {
                ev.preventDefault();
                first.focus();
            }
        }
    });

    window.addEventListener('resize', function () {
        if (drawerOpen && !isPhone()) closeDrawer(false);
    });

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
            });
            switcher.appendChild(chip);
        });
    }

    // ── Router ─────────────────────────────────────────────────────────────────────────────────────────────

    function currentRoute() {
        var name = (window.location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
        return ROUTES[name] ? name : 'home';
    }

    function markActiveLinks(route) {
        var links = document.querySelectorAll('[data-route]');
        for (var i = 0; i < links.length; i++) {
            if (links[i].getAttribute('data-route') === route) links[i].setAttribute('aria-current', 'page');
            else links[i].removeAttribute('aria-current');
        }
    }

    function show(node) {
        clear(view);
        view.appendChild(node);
        view.removeAttribute('aria-busy');
    }

    function showLoading() {
        clear(view);
        view.appendChild(el('p', 'pa-muted pa-loading', 'Loading…'));
        view.setAttribute('aria-busy', 'true');
    }

    function render(afterNavigation) {
        var route = currentRoute();
        var id = ++renderId;
        markActiveLinks(route);
        syncSwitcher(route);

        var needsChildren = !!NEEDS_CHILD[route];
        if (needsChildren && state.childrenStatus === 'loading') {
            showLoading(); // start() draws the page once the children arrive
        } else if (needsChildren && state.childrenStatus === 'failed') {
            show(renderError());
        } else if (needsChildren && !state.children.length) {
            show(renderNoChildren());
        } else {
            var build = ROUTES[route];
            var result = build(id);
            if (result && typeof result.then === 'function') {
                showLoading();
                result.then(function (built) {
                    if (id === renderId && built) show(built);
                }, function (err) {
                    if (id !== renderId) return;
                    if (err && err.code === 'notfound') {
                        // The child is no longer linked: refresh the list once and draw again
                        cache = {};
                        loadChildren().then(function () {
                            renderSwitcher();
                            if (id === renderId) render();
                        }, function () {
                            if (id === renderId) show(renderError());
                        });
                        return;
                    }
                    show(err && err.code === 'noyear' ? renderNoYear() : renderError());
                });
            } else if (result) {
                show(result);
            }
        }

        if (afterNavigation) {
            window.scrollTo(0, 0);
            try { view.focus({ preventScroll: true }); } catch (e) { view.focus(); }
        }
    }

    window.addEventListener('hashchange', function () {
        closeDrawer(false);
        closeMenus(null);
        render(true);
    });

    // Tapping a link to the page you are already on does not change the hash, so close the phone menu here too
    document.addEventListener('click', function (ev) {
        var link = ev.target.closest ? ev.target.closest('a[data-route]') : null;
        if (link && drawerOpen) closeDrawer(false);
    });

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
            'To see your child here, ask them to create a parent link in their iSkool app (My Class). When you open that link while signed in, your child appears on this page.'
        );
    }

    function renderError() {
        return stateCard(
            'We could not load this page',
            'Please check your connection and try again.',
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

    function renderSoon(title, text) {
        return stateCard(title, text);
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
        return cached('api/parent/get_home.php', { child: child.id }).then(buildHome);
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
        var upcoming = section('Coming up');
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

    // ── Start ──────────────────────────────────────────────────────────────────────────────────────────────

    function loadChildren() {
        return api('api/parent/get_children.php').then(function (data) {
            state.parent = { name: data.parent.name, email: data.parent.email };
            state.children = data.children;
            state.childrenStatus = 'ready';
            chooseChild();
            buildMenus();
        });
    }

    /** First load, and "Try again" after a failed first load. */
    function start() {
        state.childrenStatus = 'loading';
        showLoading();

        loadChildren().then(function () {
            renderSwitcher();
            render();
        }, function (err) {
            if (err && err.code === 'auth') return;
            state.childrenStatus = 'failed';
            render(); // Home and Report show the error card, the "coming soon" pages still open
        });
    }

    buildMenus();
    markActiveLinks(currentRoute());
    start();
}());
