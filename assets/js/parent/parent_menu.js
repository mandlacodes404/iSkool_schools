/* assets/js/parent/parent_menu.js
   The parent app's menus. Load it BEFORE parent_app.js (parent_app.js calls paMenu.setParent once it knows the parent).

   Desktop (769px and up): the sidebar collapses to a rail (remembered), the rail has tooltips, the account card opens
   from the account row, quick search (Ctrl/Cmd + K), go-to shortcuts (G then a letter), a shortcuts sheet (?),
   Ctrl/Cmd + B for the rail, arrow keys through the menu.
   Phones (768px and below): the menu slides in from the left and pushes the page aside. A finger drags it open from the
   left edge and drags it closed again. Search opens a full-screen sheet and the account row opens the account card as
   a bottom sheet.

   It never re-implements navigation: pages are opened by setting the same #/route the links point to, which is what
   parent_app.js listens for. Everything put on the page is built as text nodes, never as markup. */
(function () {
    'use strict';

    // Set to false to switch off the single-key shortcuts (G then a letter, and ?).
    // Ctrl/Cmd + K and Ctrl/Cmd + B always stay on.
    var SHORTCUTS_ENABLED = true;

    var root = document.documentElement;
    var app = document.getElementById('parentApp');
    var side = document.getElementById('paSide');
    var drawer = document.getElementById('paDrawer');
    if (!app || !side || !drawer) return;

    var $ = function (id) { return document.getElementById(id); };
    var toggleBtn = $('paToggle'), searchBtn = $('paSearchBtn'), accBtn = $('paAccountBtn');
    var menuBtn = $('paMenuBtn'), avatarBtn = $('paAvatarBtn');
    var overlay = $('paOverlay'), drawerSearch = $('paDrawerSearch'), drawerAcc = $('paDrawerAccount');
    var sheet = $('paMenuSheet'), sheetBg = $('paSheetBg');
    var pageParts = [document.querySelector('.pa-top'), document.querySelector('.pa-content'), document.querySelector('.pa-tabs')];

    var desktop = window.matchMedia('(min-width: 769px)');
    var phone = window.matchMedia('(max-width: 768px)');
    var narrow = window.matchMedia('(max-width: 1099px)');
    var COLLAPSE_KEY = 'parentApp.menuCollapsed';
    var THEME_KEY = 'parentApp.theme';
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    var IS_MAC = /Mac|iPhone|iPad/i.test(platform);
    var MOD = IS_MAC ? '⌘' : 'Ctrl';

    var parent = {
        name: (function () { var n = document.querySelector('.pa-account-name'); return n ? n.textContent.trim() : ''; })() || 'Parent',
        email: app.getAttribute('data-email') || ''
    };
    var appVersion = app.getAttribute('data-version') || '';

    // ── Small helpers ──────────────────────────────────────────────────────────────────────────────────────

    function onChange(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); }
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text) n.textContent = text;
        return n;
    }
    function inField(t) {
        return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
    }
    function focusableIn(node) {
        return Array.prototype.slice.call(node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
            .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
    }
    function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function storeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode: fine */ } }

    // ── Pages: [route, icon key, go-to letter, extra search words] in the order of the menu ───────────────────
    var NAV = [
        ['home',     'home',     'h', 'dashboard overview start children'],
        ['report',   'chart',    'r', 'grades marks results progress performance term'],
        ['syllabus', 'book',     's', 'curriculum topics outline subjects'],
        ['news',     'bell',     'n', 'announcements notices updates school'],
        ['events',   'calendar', 'e', 'dates schedule timetable']
    ];
    function sideLink(route) { return side.querySelector('.pa-nav-link[data-route="' + route + '"]'); }
    function labelOf(link) {
        var l = link.querySelector('.pa-nav-label');
        return (l ? l.textContent : link.textContent).trim();
    }
    function navigate(route) {
        var target = '#/' + route;
        if (window.location.hash !== target) window.location.hash = target;
        closeDrawer(false); // linking to the page you are already on does not change the hash
    }

    // ── Theme ──────────────────────────────────────────────────────────────────────────────────────────────
    function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    function themeLabel() { return currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'; }
    function syncThemeButtons() {
        var label = themeLabel(), buttons = document.querySelectorAll('[data-pa-theme]');
        for (var i = 0; i < buttons.length; i++) buttons[i].textContent = label;
    }
    function toggleTheme() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        storeSet(THEME_KEY, next);
        syncThemeButtons();
    }

    // ── Actions shared by the account card and quick search ───────────────────────────────────────────────
    function signOut() { window.location.href = 'logout.php'; }
    function addChild() { navigate('add-child'); }
    var ACTIONS = { add: addChild, theme: toggleTheme, keys: function () { openKeys(); }, signout: signOut };

    // ── Account card ───────────────────────────────────────────────────────────────────────────────────────
    // Opens in three places: above the desktop sidebar's account row, from the phone header's avatar, and as a bottom
    // sheet from the account row in the phone menu. All three get the same content. Same structure as the learner's
    // card: name and email, the actions (each with an icon), a divider, Sign out in red, the app version.

    var cards = [
        { button: accBtn, menu: $('paMenuDesktop') },
        { button: avatarBtn, menu: $('paMenuMobile') }
    ];

    function menuItem(tag, label, icon, extraClass) {
        var node = el(tag, 'pa-menu-item' + (extraClass ? ' ' + extraClass : ''), label);
        node.setAttribute('role', 'menuitem');
        node.setAttribute('data-ico', icon);
        return node;
    }

    function buildCards() {
        var menus = document.querySelectorAll('[data-pa-menu]');
        for (var i = 0; i < menus.length; i++) {
            var menu = menus[i];
            while (menu.firstChild) menu.removeChild(menu.firstChild);
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', 'Account');

            var head = el('div', 'pa-menu-head');
            head.appendChild(el('div', 'pa-menu-name', parent.name));
            if (parent.email) head.appendChild(el('div', 'pa-menu-email', parent.email));
            menu.appendChild(head);

            var add = menuItem('a', 'Add a child', 'plus');
            add.href = '#/add-child';
            add.setAttribute('data-route', 'add-child');
            menu.appendChild(add);

            var theme = menuItem('button', '', 'theme');
            theme.type = 'button';
            theme.setAttribute('data-pa-theme', '');
            menu.appendChild(theme);

            // Desktop only: the phone has no keyboard to show shortcuts for (the stylesheet hides it there)
            var keys = menuItem('button', 'Keyboard shortcuts', 'keyboard');
            keys.type = 'button';
            keys.setAttribute('data-act', 'keys');
            keys.appendChild(el('span', 'pa-menu-kbd', '?'));
            menu.appendChild(keys);

            var sep = el('div', 'pa-menu-sep');
            sep.setAttribute('role', 'separator');
            menu.appendChild(sep);

            var out = menuItem('a', 'Sign out', 'logout', 'pa-danger');
            out.href = 'logout.php';
            menu.appendChild(out);

            if (appVersion) menu.appendChild(el('div', 'pa-menu-ver', appVersion));
        }
        syncThemeButtons();
    }

    function closeCards(except) {
        cards.forEach(function (c) {
            if (!c.menu || c === except) return;
            c.menu.hidden = true;
            if (c.button) c.button.setAttribute('aria-expanded', 'false');
        });
    }
    function cardOpen() {
        return cards.filter(function (c) { return c.menu && !c.menu.hidden; })[0] || null;
    }
    function toggleCard(c, focusFirst) {
        var willOpen = c.menu.hidden;
        hideTip();
        closeCards(willOpen ? c : null);
        c.menu.hidden = !willOpen;
        c.button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen && focusFirst) {
            var first = c.menu.querySelector('.pa-menu-item');
            if (first) first.focus();
        }
    }

    cards.forEach(function (c) {
        if (!c.button || !c.menu) return;
        c.button.addEventListener('click', function (ev) {
            ev.stopPropagation();
            // ev.detail is 0 when the click came from the keyboard (Enter or Space): then move into the card
            toggleCard(c, ev.detail === 0);
        });
        c.button.addEventListener('keydown', function (ev) {
            if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && c.menu.hidden) {
                ev.preventDefault();
                toggleCard(c, true);
            }
        });
    });
    // Clicks outside a card close it; clicks inside it must not reach this handler
    document.addEventListener('click', function () { closeCards(); });

    // What the items in the three cards do
    function onCardClick(ev) {
        ev.stopPropagation();
        var item = ev.target.closest ? ev.target.closest('.pa-menu-item') : null;
        if (!item) return;
        if (item.hasAttribute('data-pa-theme')) {
            toggleTheme();
            closeCards();
            closeSheet(false);
            return;
        }
        if (item.getAttribute('data-act') === 'keys') {
            closeCards();
            closeSheet(false);
            openKeys();
            return;
        }
        // "Add a child" or "Sign out": the card goes away, and so does the phone menu behind it
        closeCards();
        closeSheet(false);
        closeDrawer(false);
    }

    // Arrow keys, Home and End move through a card's items (the learner card does the same); Tab leaves a popover
    function onCardKeydown(ev) {
        if (ev.key === 'Tab') {
            if (ev.currentTarget === sheet) return; // the sheet keeps focus inside itself (see the Tab handler below)
            // Put focus back on the button that opened the popover and close it; the Tab then moves on from there
            for (var t = 0; t < cards.length; t++) {
                if (cards[t].menu === ev.currentTarget && cards[t].button) cards[t].button.focus();
            }
            closeCards();
            return;
        }
        var items = Array.prototype.slice.call(ev.currentTarget.querySelectorAll('.pa-menu-item'));
        if (!items.length) return;
        var at = items.indexOf(document.activeElement), next = -1;
        if (ev.key === 'ArrowDown') next = (at + 1) % items.length;
        else if (ev.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
        else if (ev.key === 'Home') next = 0;
        else if (ev.key === 'End') next = items.length - 1;
        if (next < 0) return;
        ev.preventDefault();
        items[next].focus();
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-pa-menu]'), function (m) {
        m.addEventListener('click', onCardClick);
        m.addEventListener('keydown', onCardKeydown);
    });

    // ═══ Desktop ═══════════════════════════════════════════════════════════════════════════════════════════

    /* ── Collapse / expand ─────────────────────────────────────────────────────────────────────────────── */
    function storedPref() {
        var v = storeGet(COLLAPSE_KEY);
        return v === null ? null : v === '1';
    }
    function isCollapsed() { return root.classList.contains('pa-collapsed'); }

    // In the rail the text is hidden, so the links get their name as a label instead
    function syncLabels(collapsed) {
        Array.prototype.forEach.call(side.querySelectorAll('.pa-nav-link'), function (a) {
            if (collapsed) a.setAttribute('aria-label', labelOf(a)); else a.removeAttribute('aria-label');
        });
        if (accBtn) {
            if (collapsed) accBtn.setAttribute('aria-label', parent.name + ', account menu'); else accBtn.removeAttribute('aria-label');
        }
    }
    function setCollapsed(collapsed, persist) {
        root.classList.toggle('pa-collapsed', collapsed);
        if (persist) storeSet(COLLAPSE_KEY, collapsed ? '1' : '0');
        var label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.setAttribute('aria-label', label);
        toggleBtn.setAttribute('data-tip', label);
        syncLabels(collapsed);
        hideTip();
        closeCards();
    }
    toggleBtn.addEventListener('click', function () { setCollapsed(!isCollapsed(), true); });
    toggleBtn.setAttribute('data-tip-always', '');
    toggleBtn.setAttribute('data-tip-kbd', MOD + ' B');

    // With no saved choice, follow the window: rail on narrower screens
    onChange(narrow, function (e) { if (storedPref() === null && desktop.matches) setCollapsed(e.matches, false); });

    // Transitions come on only after first paint, so a saved rail never animates on load
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('pa-ready'); }); });

    /* ── Current page for assistive tech: parent_app.js sets aria-current on the links ──────────────────── */

    /* ── Keyboard: arrows move through the menu in the order you see it ─────────────────────────────────── */
    side.addEventListener('keydown', function (e) {
        if (!desktop.matches) return;
        var k = e.key;
        if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
        var cur = e.target.closest && e.target.closest('.pa-nav-link, .pa-search');
        if (!cur) return;
        var order = [searchBtn].concat(Array.prototype.slice.call(side.querySelectorAll('.pa-nav-link')));
        var i = order.indexOf(cur);
        if (i < 0) return;
        var next = k === 'Home' ? 0 : k === 'End' ? order.length - 1 : Math.max(0, Math.min(order.length - 1, i + (k === 'ArrowDown' ? 1 : -1)));
        e.preventDefault();
        order[next].focus();
    });

    /* ── Tooltips (rail, and the collapse button) ─────────────────────────────────────────────────────── */
    var tip = el('div', 'pa-tip');
    tip.id = 'paTip';
    tip.setAttribute('role', 'tooltip');
    var tipText = el('span'), tipKbd = el('kbd');
    tip.appendChild(tipText);
    tip.appendChild(tipKbd);
    document.body.appendChild(tip);

    NAV.forEach(function (n) {
        var link = sideLink(n[0]);
        if (!link) return;
        link.setAttribute('data-tip', labelOf(link));
        link.setAttribute('data-tip-kbd', 'G ' + n[2].toUpperCase());
    });
    if (accBtn) accBtn.setAttribute('data-tip', parent.name);
    searchBtn.setAttribute('data-tip', 'Search');
    searchBtn.setAttribute('data-tip-kbd', MOD + ' K');
    var kbdHint = $('paSearchKbd');
    if (kbdHint) kbdHint.textContent = IS_MAC ? '⌘K' : 'Ctrl K';

    // The first tooltip waits a beat; moving to a neighbour swaps it instantly
    var tipTimer = 0, tipFor = null, tipLastHide = 0;
    function placeTip(target) {
        var k = target.getAttribute('data-tip-kbd');
        tipText.textContent = target.getAttribute('data-tip');
        tipKbd.textContent = k || '';
        tipKbd.style.display = k ? '' : 'none';
        var r = target.getBoundingClientRect();
        tip.style.left = Math.round(r.right + 10) + 'px';
        tip.style.top = Math.round(r.top + r.height / 2) + 'px';
        tip.classList.add('is-on');
    }
    function showTip(target, instant) {
        if (!target.getAttribute('data-tip') || !desktop.matches) return;
        if (!isCollapsed() && !target.hasAttribute('data-tip-always')) return;
        if (cardOpen() && target === accBtn) return;
        if (tipFor === target && (tip.classList.contains('is-on') || tipTimer)) return;
        clearTimeout(tipTimer);
        tipTimer = 0;
        tipFor = target;
        if (instant || tip.classList.contains('is-on') || Date.now() - tipLastHide < 300) placeTip(target);
        else tipTimer = setTimeout(function () { tipTimer = 0; placeTip(target); }, 350);
    }
    function hideTip() {
        clearTimeout(tipTimer);
        tipTimer = 0;
        tipFor = null;
        if (tip.classList.contains('is-on')) { tip.classList.remove('is-on'); tipLastHide = Date.now(); }
    }
    side.addEventListener('mouseover', function (e) {
        var t = e.target.closest('[data-tip]');
        if (t) showTip(t, false); else hideTip();
    });
    side.addEventListener('mouseleave', hideTip);
    side.addEventListener('focusin', function (e) { var t = e.target.closest('[data-tip]'); if (t) showTip(t, true); });
    side.addEventListener('focusout', hideTip);
    side.addEventListener('click', hideTip);

    /* ── Search ranking (shared by the desktop palette and the phone search sheet) ──────────────────────── */
    // One search word against one piece of text. Whole-string hits beat word-start hits beat mid-word hits; three or
    // more letters may also match in order ("syl" finds Syllabus, "nws" finds News). Returns { s: score, hits: [indexes] } or null.
    function matchToken(text, tok) {
        var i = text.indexOf(tok), h = [], c;
        if (i > -1) {
            for (c = 0; c < tok.length; c++) h.push(i + c);
            return { s: i === 0 ? 100 : text.charAt(i - 1) === ' ' ? 80 : 60, hits: h };
        }
        if (tok.length < 3) return null;
        var from = 0;
        for (c = 0; c < tok.length; c++) {
            var f = text.indexOf(tok.charAt(c), from);
            if (f < 0) return null;
            h.push(f);
            from = f + 1;
        }
        return { s: 30 - Math.min(20, h[h.length - 1] - h[0] - tok.length + 1), hits: h };
    }
    function rank(it, toks) {
        var label = it.label.toLowerCase(), kw = (it.kw || '').toLowerCase(), total = 0, hits = [];
        for (var t = 0; t < toks.length; t++) {
            var m = matchToken(label, toks[t]);
            if (!m) {
                if (kw.indexOf(toks[t]) === -1) return null;
                m = { s: 40, hits: [] };
            }
            total += m.s;
            hits = hits.concat(m.hits);
        }
        return { s: total, hits: hits };
    }
    // Put text in a node with the matched letters wrapped in <hitTag class=hitClass> (text nodes only)
    function fillLabel(node, text, hits, hitTag, hitClass) {
        if (!hits.length) { node.textContent = text; return; }
        var mark = {}, buf = '', on = false, i;
        hits.forEach(function (h) { mark[h] = true; });
        function flush() {
            if (!buf) return;
            if (on) node.appendChild(el(hitTag, hitClass, buf)); else node.appendChild(document.createTextNode(buf));
            buf = '';
        }
        for (i = 0; i < text.length; i++) {
            var m = !!mark[i];
            if (m !== on) { flush(); on = m; }
            buf += text.charAt(i);
        }
        flush();
    }
    function search(all, q) {
        var toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean), rows = [];
        if (!toks.length) return { toks: toks, rows: all.map(function (it) { return { it: it, hits: [] }; }) };
        all.forEach(function (it, n) {
            var r = rank(it, toks);
            if (r) rows.push({ it: it, hits: r.hits, s: r.s - n * 0.001 });
        });
        rows.sort(function (x, y) { return y.s - x.s; });
        return { toks: toks, rows: rows };
    }

    // What quick search can open, in the order the menu shows it
    function collect(forPhone) {
        var out = [];
        NAV.forEach(function (n) {
            var link = (forPhone ? drawer : side).querySelector('.pa-nav-link[data-route="' + n[0] + '"]');
            if (!link) return;
            out.push({
                group: 'Pages', label: labelOf(link), ico: n[1], kw: n[3],
                tag: link.getAttribute('aria-current') === 'page' ? 'Current' : '',
                keys: forPhone ? null : ['G', n[2].toUpperCase()],
                run: function () { navigate(n[0]); }
            });
        });
        if (!forPhone) {
            out.push({ group: 'Actions', label: 'Toggle sidebar', ico: 'panel', kw: 'collapse expand rail hide show menu', keys: [MOD, 'B'], run: function () { setCollapsed(!isCollapsed(), true); } });
            out.push({ group: 'Actions', label: 'Keyboard shortcuts', ico: 'keyboard', kw: 'keys hotkeys help commands', keys: ['?'], run: ACTIONS.keys });
        }
        out.push({ group: 'Actions', label: themeLabel(), ico: currentTheme() === 'dark' ? 'sun' : 'moon', kw: 'theme appearance dark light mode night', run: ACTIONS.theme });
        out.push({ group: 'Account', label: 'Add a child', ico: 'plus', kw: 'link invite learner student connect', run: ACTIONS.add });
        out.push({ group: 'Account', label: 'Sign out', ico: 'logout', kw: 'log out logout', run: ACTIONS.signout });
        return out;
    }
    var NOTHING = ' Try Report, News or Events.';

    /* ── Quick search (desktop) ─────────────────────────────────────────────────────────────────────────── */
    var pal = null, palInput = null, palList = null, palEmpty = null;
    var palAll = [], palShown = [], palOpts = [], palSel = 0, palBefore = null;

    function buildPalette() {
        if (pal) return;
        pal = el('div', 'pa-palette');
        pal.id = 'paPalette';
        pal.setAttribute('aria-hidden', 'true');
        var panel = el('div', 'pa-palette-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Search pages and actions');
        var field = el('div', 'pa-palette-field');
        palInput = el('input');
        palInput.type = 'text';
        palInput.id = 'paPaletteInput';
        palInput.placeholder = 'Search pages and actions';
        palInput.autocomplete = 'off';
        palInput.spellcheck = false;
        palInput.setAttribute('role', 'combobox');
        palInput.setAttribute('aria-expanded', 'true');
        palInput.setAttribute('aria-controls', 'paPaletteList');
        palInput.setAttribute('aria-autocomplete', 'list');
        palInput.setAttribute('aria-label', 'Search pages and actions');
        field.appendChild(palInput);
        palList = el('ul');
        palList.id = 'paPaletteList';
        palList.setAttribute('role', 'listbox');
        palEmpty = el('p', 'pa-palette-empty');
        palEmpty.hidden = true;
        var foot = el('div', 'pa-palette-foot');
        [['↑↓', 'Navigate'], ['↵', 'Open'], ['Esc', 'Close']].forEach(function (f) {
            var s = el('span');
            s.appendChild(el('kbd', '', f[0]));
            s.appendChild(document.createTextNode(f[1]));
            foot.appendChild(s);
        });
        panel.appendChild(field);
        panel.appendChild(palList);
        panel.appendChild(palEmpty);
        panel.appendChild(foot);
        pal.appendChild(panel);
        document.body.appendChild(pal);

        palInput.addEventListener('input', function () { renderPalette(palInput.value); });
        palInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); selectOpt(palSel + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); selectOpt(palSel - 1); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(palSel); }
            else if (e.key === 'Tab') { e.preventDefault(); }
        });
        pal.addEventListener('mousedown', function (e) { if (e.target === pal) closePalette(); });
    }
    function palOpen() { return !!pal && pal.classList.contains('is-open'); }

    function renderPalette(q) {
        var res = search(palAll, q), rows = res.rows;
        palShown = rows.map(function (r) { return r.it; });
        palOpts = [];
        palSel = 0;
        palList.textContent = '';
        var lastGroup = null;
        rows.forEach(function (r, i) {
            var it = r.it;
            if (!res.toks.length && it.group !== lastGroup) {
                var h = el('li', 'pa-phead', it.group);
                h.setAttribute('role', 'presentation');
                palList.appendChild(h);
                lastGroup = it.group;
            }
            var li = el('li');
            li.id = 'paOpt' + i;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            var ico = el('span', 'pa-pico');
            ico.style.setProperty('--pa-ico', 'var(--pa-i-' + it.ico + ')');
            var lab = el('span', 'pa-plabel');
            fillLabel(lab, it.label, r.hits, 'span', 'pa-hit');
            li.appendChild(ico);
            li.appendChild(lab);
            if (it.tag) {
                li.appendChild(el('span', 'pa-ptag', it.tag));
            } else if (it.keys) {
                var k = el('span', 'pa-pkeys');
                it.keys.forEach(function (key) { k.appendChild(el('kbd', 'pa-pk', key)); });
                li.appendChild(k);
            }
            li.addEventListener('mousemove', function () { if (palSel !== i) selectOpt(i); });
            li.addEventListener('click', function () { choose(i); });
            palList.appendChild(li);
            palOpts.push(li);
        });
        palList.scrollTop = 0;
        palEmpty.hidden = palShown.length > 0;
        palEmpty.textContent = 'Nothing matches “' + palInput.value.trim() + '”.' + NOTHING;
        palInput.setAttribute('aria-activedescendant', palShown.length ? 'paOpt0' : '');
    }
    function selectOpt(i) {
        if (!palOpts.length) return;
        palSel = (i + palOpts.length) % palOpts.length;
        palOpts.forEach(function (li, n) { li.setAttribute('aria-selected', n === palSel ? 'true' : 'false'); });
        var cur = palOpts[palSel];
        palInput.setAttribute('aria-activedescendant', cur.id);
        if (palSel === 0) palList.scrollTop = 0;
        else if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    function openPalette() {
        if (!desktop.matches) return;
        buildPalette();
        closeCards();
        closeKeys(false);
        hideTip();
        palBefore = document.activeElement;
        palAll = collect(false);
        palInput.value = '';
        renderPalette('');
        pal.classList.add('is-open');
        pal.setAttribute('aria-hidden', 'false');
        palInput.focus();
    }
    function closePalette() {
        if (!palOpen()) return;
        pal.classList.remove('is-open');
        pal.setAttribute('aria-hidden', 'true');
        if (document.activeElement === palInput) palInput.blur();
        if (palBefore && palBefore.focus && document.contains(palBefore)) palBefore.focus();
        palBefore = null;
    }
    function choose(i) {
        var it = palShown[i];
        if (!it) return;
        closePalette();
        setTimeout(it.run, 0);
    }
    searchBtn.addEventListener('click', openPalette);

    /* ── Keyboard shortcuts sheet (desktop) ─────────────────────────────────────────────────────────────── */
    var keysEl = null, keysPanel = null, keysBody = null, keysClose = null, keysBefore = null;
    function keysOpen() { return !!keysEl && keysEl.classList.contains('is-open'); }
    function buildKeys() {
        if (keysEl) return;
        keysEl = el('div', 'pa-keys');
        keysEl.id = 'paKeys';
        keysEl.setAttribute('aria-hidden', 'true');
        keysPanel = el('div', 'pa-keys-panel');
        keysPanel.setAttribute('role', 'dialog');
        keysPanel.setAttribute('aria-modal', 'true');
        keysPanel.setAttribute('aria-labelledby', 'paKeysTitle');
        keysPanel.tabIndex = -1;
        var head = el('div', 'pa-keys-head');
        var h = el('h2', '', 'Keyboard shortcuts');
        h.id = 'paKeysTitle';
        keysClose = el('button', 'pa-keys-x');
        keysClose.type = 'button';
        keysClose.setAttribute('aria-label', 'Close');
        head.appendChild(h);
        head.appendChild(keysClose);
        keysBody = el('div', 'pa-keys-body');
        keysPanel.appendChild(head);
        keysPanel.appendChild(keysBody);
        keysEl.appendChild(keysPanel);
        document.body.appendChild(keysEl);

        keysClose.addEventListener('click', function () { closeKeys(true); });
        keysEl.addEventListener('mousedown', function (e) { if (e.target === keysEl) closeKeys(true); });
        keysEl.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); keysClose.focus(); } });
    }
    function keyRow(label, keys) {
        var row = el('div', 'pa-krow');
        row.appendChild(el('span', '', label));
        var k = el('i');
        keys.forEach(function (key) { k.appendChild(el('kbd', '', key)); });
        row.appendChild(k);
        return row;
    }
    function fillKeys() {
        keysBody.textContent = '';
        var gen = el('section', 'pa-keys-sec');
        gen.appendChild(el('h3', '', 'General'));
        [['Search pages and actions', [MOD, 'K']], ['Collapse or expand the sidebar', [MOD, 'B']],
         ['Show this list', ['?']], ['Close a menu or dialog', ['Esc']]].forEach(function (r) { gen.appendChild(keyRow(r[0], r[1])); });
        var go = el('section', 'pa-keys-sec');
        go.appendChild(el('h3', '', 'Go to'));
        NAV.forEach(function (n) {
            var link = sideLink(n[0]);
            if (link) go.appendChild(keyRow(labelOf(link), ['G', n[2].toUpperCase()]));
        });
        keysBody.appendChild(gen);
        keysBody.appendChild(go);
        if (SHORTCUTS_ENABLED) keysBody.appendChild(el('p', 'pa-keys-note', 'For the Go to shortcuts, press G, then the letter. They pause while you are typing in a field.'));
    }
    function openKeys() {
        if (!desktop.matches) return;
        buildKeys();
        var from = document.activeElement, open = cardOpen();
        keysBefore = open && open.menu.contains(from) ? open.button : from;
        closeCards();
        closePalette();
        hideTip();
        fillKeys();
        keysEl.classList.add('is-open');
        keysEl.setAttribute('aria-hidden', 'false');
        keysPanel.focus();
    }
    function closeKeys(restore) {
        if (!keysOpen()) return;
        keysEl.classList.remove('is-open');
        keysEl.setAttribute('aria-hidden', 'true');
        if (restore !== false && keysBefore && keysBefore.focus && document.contains(keysBefore)) keysBefore.focus();
        keysBefore = null;
    }

    /* ── Global shortcuts (desktop) ─────────────────────────────────────────────────────────────────────── */
    var GO = {}, gArmed = false, gTimer = 0;
    NAV.forEach(function (n) { GO[n[2]] = n[0]; });

    document.addEventListener('keydown', function (e) {
        if (!desktop.matches) return;
        if (e.key === 'Escape') {
            if (keysOpen()) { e.preventDefault(); closeKeys(true); }
            else if (palOpen()) { e.preventDefault(); closePalette(); }
            else if (cardOpen()) {
                e.preventDefault();
                var open = cardOpen();
                closeCards();
                open.button.focus();
            }
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            if (e.altKey || e.shiftKey) return;
            // Never hijack Ctrl+B / Ctrl+K while someone is typing in a field (the search box is the exception)
            if (inField(e.target) && !(pal && pal.contains(e.target))) return;
            var k = String(e.key).toLowerCase();
            if (k === 'k') { e.preventDefault(); closeKeys(false); if (palOpen()) closePalette(); else openPalette(); }
            else if (k === 'b') { e.preventDefault(); setCollapsed(!isCollapsed(), true); }
            return;
        }

        // Single-key shortcuts: only when nothing is being typed and nothing is open
        if (!SHORTCUTS_ENABLED || e.altKey || e.repeat || inField(e.target)) return;
        if (keysOpen() || palOpen() || cardOpen()) return;

        if (gArmed) {
            gArmed = false;
            clearTimeout(gTimer);
            var route = GO[String(e.key).toLowerCase()];
            if (route) { e.preventDefault(); navigate(route); }
            return;
        }
        if (e.key === 'g') {
            gArmed = true;
            clearTimeout(gTimer);
            gTimer = setTimeout(function () { gArmed = false; }, 1200);
        } else if (e.key === '?') {
            e.preventDefault();
            openKeys();
        }
    });

    // ═══ Phones ════════════════════════════════════════════════════════════════════════════════════════════

    var EDGE = 32;       // px from the left edge where an opening swipe may start
    var LOCK = 8;        // px of horizontal travel before the gesture is ours
    var FLICK = 0.35;    // px per ms: faster than this decides the direction by itself
    var W = 300, g = null, durTimer = 0, lastFocus = null;

    function menuOpen() { return root.classList.contains('pa-menu-open'); }
    function sheetOpen() { return !!sheet && sheet.classList.contains('is-open'); }

    function setMenu(open) {
        root.classList.toggle('pa-menu-open', open);
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function openDrawer() {
        if (menuOpen() || !phone.matches) return;
        lastFocus = document.activeElement;
        closeCards();
        setMenu(true);
        var items = focusableIn(drawer);
        if (items.length) { try { items[0].focus({ preventScroll: true }); } catch (e) { items[0].focus(); } }
    }
    function closeDrawer(returnFocus) {
        if (!menuOpen()) return;
        closeSheet(false);
        closeSearch(false);
        setMenu(false);
        if (returnFocus !== false && lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
        lastFocus = null;
    }
    if (menuBtn) menuBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openDrawer();
    });
    if (overlay) overlay.addEventListener('click', function () { closeDrawer(); });

    /* ── Drag: the menu follows your finger ──────────────────────────────────────────────────────────────
       Edge swipe to open, drag left to close, and it settles on release speed. While dragging, the stylesheet's
       transitions are off (html.pa-drag) and the menu, header, page, bottom tabs and the dimmer are all moved
       inline by the same amount; on release the inline values are dropped in the same frame as the state change, so
       the CSS transition carries on from exactly where the finger let go. */
    function apply(p) {
        var x = Math.round(p * W * 10) / 10;
        drawer.style.transform = 'translate3d(' + (x - W) + 'px,0,0)';
        pageParts.forEach(function (n) { if (n) n.style.transform = 'translate3d(' + x + 'px,0,0)'; });
        if (overlay) { overlay.style.transform = 'translate3d(' + x + 'px,0,0)'; overlay.style.opacity = String(p); }
    }
    function clearInline() {
        [drawer, overlay].concat(pageParts).forEach(function (n) { if (n) { n.style.transform = ''; n.style.opacity = ''; } });
    }
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function touchOf(e) {
        for (var i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === g.id) return e.touches[i];
        return null;
    }

    window.addEventListener('touchstart', function (e) {
        g = null;
        if (!phone.matches || e.touches.length !== 1 || sheetOpen() || searchIsOpen()) return;
        var t = e.touches[0], open = menuOpen();
        if (!open && t.clientX > EDGE) return;
        g = { id: t.identifier, x: t.clientX, y: t.clientY, open: open, p0: open ? 1 : 0, p: open ? 1 : 0, locked: false, dead: false, pts: [[t.clientX, e.timeStamp]] };
    }, { capture: true, passive: true });

    window.addEventListener('touchmove', function (e) {
        if (!g) return;
        var t = touchOf(e);
        if (!t || g.dead) return;
        var dx = t.clientX - g.x, dy = t.clientY - g.y;
        if (!g.locked) {
            if (Math.abs(dx) > LOCK && Math.abs(dx) > Math.abs(dy) * 1.2) {
                if (!g.open && dx < 0) { g.dead = true; return; }      // swiping left from the edge: not ours
                g.locked = true;
                W = drawer.offsetWidth || 300;
                root.classList.add('pa-drag');
                apply(g.p0);
            } else {
                if (Math.abs(dy) > 10) g.dead = true;                  // vertical: let the page or the list scroll
                return;
            }
        }
        if (e.cancelable) e.preventDefault();
        g.p = clamp(g.p0 + dx / W);
        g.pts.push([t.clientX, e.timeStamp]);
        if (g.pts.length > 6) g.pts.shift();
        apply(g.p);
    }, { capture: true, passive: false });

    function finish(now) {
        // Speed over the last ~120ms before the finger lifted. If it had stopped moving before lifting, that is not a flick.
        var last = g.pts[g.pts.length - 1], first = last, v = 0;
        if (now - last[1] < 60) {
            for (var i = g.pts.length - 1; i >= 0; i--) { if (now - g.pts[i][1] <= 120) first = g.pts[i]; else break; }
            v = (last[0] - first[0]) / Math.max(1, last[1] - first[1]);
        }
        var target = v > FLICK ? 1 : v < -FLICK ? 0 : g.p > 0.5 ? 1 : 0;
        var dur = Math.round(140 + 200 * Math.abs(target - g.p));
        root.style.setProperty('--pa-dur', dur + 'ms');
        if (target === 1) { lastFocus = null; setMenu(true); } else { closeDrawer(false); }
        clearInline();
        root.classList.remove('pa-drag');
        clearTimeout(durTimer);
        durTimer = setTimeout(function () { root.style.removeProperty('--pa-dur'); }, dur + 80);
    }
    function end(e) {
        if (!g) return;
        if (g.locked) { if (e.cancelable) e.preventDefault(); finish(e.timeStamp); }
        g = null;
    }
    window.addEventListener('touchend', end, { capture: true, passive: false });
    window.addEventListener('touchcancel', end, { capture: true, passive: false });

    /* ── Account sheet (the account row in the phone menu) ───────────────────────────────────────────────── */
    function openSheet() {
        if (!sheet || sheetOpen()) return;
        closeCards();
        sheet.classList.add('is-open');
        if (sheetBg) sheetBg.classList.add('is-open');
        if (drawerAcc) drawerAcc.setAttribute('aria-expanded', 'true');
        // The sheet is modal, so keyboard focus moves into it
        var first = sheet.querySelector('.pa-menu-item');
        if (first) first.focus({ preventScroll: true });
    }
    function closeSheet(returnFocus) {
        if (!sheetOpen()) return;
        sheet.classList.remove('is-open');
        if (sheetBg) sheetBg.classList.remove('is-open');
        if (drawerAcc) {
            drawerAcc.setAttribute('aria-expanded', 'false');
            if (returnFocus) drawerAcc.focus({ preventScroll: true });
        }
    }
    if (drawerAcc) drawerAcc.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (sheetOpen()) closeSheet(false); else openSheet();
    });
    if (sheetBg) sheetBg.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closeSheet(false);
    });

    /* ── Search (phone) ──────────────────────────────────────────────────────────────────────────────────── */
    var S = null, sInput = null, sList = null, sAll = [], sBefore = null;

    function searchIsOpen() { return !!S && S.classList.contains('on'); }
    function renderSearch(q) {
        var res = search(sAll, q), rows = res.rows;
        sList.textContent = '';
        if (!rows.length) {
            sList.appendChild(el('div', 'pa-s-empty', 'Nothing matches “' + q.trim() + '”.' + NOTHING));
            return;
        }
        var last = null;
        rows.forEach(function (x) {
            if (!res.toks.length && x.it.group !== last) { sList.appendChild(el('div', 'pa-s-head', x.it.group)); last = x.it.group; }
            var b = el('button', 'pa-s-row');
            b.type = 'button';
            b.style.setProperty('--pa-ico', 'var(--pa-i-' + x.it.ico + ')');
            var lab = el('span');
            fillLabel(lab, x.it.label, x.hits, 'b', '');
            b.appendChild(lab);
            if (x.it.tag) b.appendChild(el('span', 't', x.it.tag));
            b.addEventListener('click', function () { closeSearch(false); setTimeout(x.it.run, 0); });
            sList.appendChild(b);
        });
    }
    function buildSearch() {
        if (S) return;
        S = el('div', 'pa-s');
        S.id = 'paSearch';
        S.setAttribute('role', 'dialog');
        S.setAttribute('aria-label', 'Search pages and actions');
        var bar = el('div', 'pa-s-bar'), field = el('div', 'pa-s-field');
        sInput = el('input');
        sInput.type = 'text';
        sInput.placeholder = 'Search';
        sInput.autocomplete = 'off';
        sInput.spellcheck = false;
        sInput.setAttribute('aria-label', 'Search pages and actions');
        sInput.setAttribute('enterkeyhint', 'go');
        field.appendChild(sInput);
        var cancel = el('button', 'pa-s-cancel', 'Cancel');
        cancel.type = 'button';
        bar.appendChild(field);
        bar.appendChild(cancel);
        sList = el('div', 'pa-s-list');
        S.appendChild(bar);
        S.appendChild(sList);
        document.body.appendChild(S);
        cancel.addEventListener('click', function () { closeSearch(true); });
        sInput.addEventListener('input', function () { renderSearch(sInput.value); });
        sInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { var first = sList.querySelector('.pa-s-row'); if (first) first.click(); }
        });
    }
    function openSearch() {
        if (!phone.matches) return;
        buildSearch();
        sBefore = document.activeElement;
        sAll = collect(true);
        sInput.value = '';
        renderSearch('');
        S.classList.add('on');
        sInput.focus({ preventScroll: true });
    }
    function closeSearch(restore) {
        if (!searchIsOpen()) return;
        S.classList.remove('on');
        sInput.blur();
        if (restore && sBefore && sBefore.focus && document.contains(sBefore)) sBefore.focus({ preventScroll: true });
        sBefore = null;
    }
    if (drawerSearch) drawerSearch.addEventListener('click', openSearch);

    // Escape closes the top-most thing; Tab stays inside the sheet or the menu while one is open
    document.addEventListener('keydown', function (e) {
        if (!phone.matches) return;
        if (e.key === 'Escape') {
            if (searchIsOpen()) closeSearch(true);
            else if (sheetOpen()) closeSheet(true);
            else if (menuOpen()) closeDrawer();
            else if (cardOpen()) { var open = cardOpen(); closeCards(); open.button.focus(); }
            return;
        }
        if (e.key === 'Tab' && menuOpen()) {
            var items = focusableIn(searchIsOpen() ? S : sheetOpen() ? sheet : drawer);
            if (!items.length) return;
            var first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });

    // Tapping a link to the page you are already on does not change the hash, so close the phone menu here too
    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[data-route]') : null;
        if (link && menuOpen()) closeDrawer(false);
    });
    // A new page: everything that was open goes away
    window.addEventListener('hashchange', function () {
        closeDrawer(false);
        closeSheet(false);
        closeSearch(false);
        closeCards();
    });

    // ═══ Switching between phone and desktop width ═════════════════════════════════════════════════════════
    function syncMode() {
        closeCards();
        if (desktop.matches) {
            g = null;
            closeSheet(false);
            closeSearch(false);
            closeDrawer(false);
            clearInline();
            root.classList.remove('pa-drag');
            root.style.removeProperty('--pa-dur');
            setMenu(false);
        } else {
            closePalette();
            closeKeys(false);
            hideTip();
        }
    }
    onChange(desktop, syncMode);

    // ═══ Start ═════════════════════════════════════════════════════════════════════════════════════════════
    buildCards();
    setCollapsed(isCollapsed(), false);

    window.paMenu = {
        // Called by parent_app.js once the server has told us who the parent is
        setParent: function (p) {
            if (!p) return;
            if (p.name) parent.name = p.name;
            if (p.email !== undefined && p.email !== null) parent.email = p.email;
            buildCards();
            if (accBtn) accBtn.setAttribute('data-tip', parent.name);
            syncLabels(isCollapsed());
        },
        closeAll: function () {
            closeDrawer(false);
            closeSheet(false);
            closeSearch(false);
            closeCards();
        }
    };
}());
