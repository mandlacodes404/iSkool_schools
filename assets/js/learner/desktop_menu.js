/* assets/js/learner/desktop_menu.js
   Behaviour for the desktop sidebar: collapse to a rail (remembered),
   rail tooltips, account menu, quick search (Ctrl/Cmd + K),
   go-to shortcuts (G then a letter), a shortcuts sheet (?) and the Join a Class dialog.

   It never re-implements navigation. Quick search and the shortcuts click the
   real sidebar links, so every existing onclick, loader and setActive() path
   still runs. */
(function () {
  'use strict';

  // Set to false to switch off the single-key shortcuts (G then a letter, and ?).
  // Ctrl/Cmd + K and Ctrl/Cmd + B always stay on.
  var SHORTCUTS_ENABLED = true;

  var root = document.documentElement;
  var sidebar = document.getElementById('dmSidebar');
  if (!sidebar) return;

  var $ = function (id) { return document.getElementById(id); };
  var toggleBtn = $('dmToggle'), searchBtn = $('dmSearchBtn'), acc = $('dmAccount');
  var pop = $('dmAccountMenu'), tip = $('dmTip'), pal = $('dmPalette');
  var input = $('dmPaletteInput'), list = $('dmPaletteList'), empty = $('dmPaletteEmpty');

  var desktop = window.matchMedia('(min-width: 769px)');
  var narrow = window.matchMedia('(max-width: 1099px)');
  var KEY = 'iskoolMenuCollapsed';
  var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  var IS_MAC = /Mac|iPhone|iPad/i.test(platform);
  var MOD = IS_MAC ? '\u2318' : 'Ctrl';

  function onChange(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); }
  function call(name) { if (typeof window[name] === 'function') window[name](); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function inField(t) {
    return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  }

  /* ── Navigation table ──────────────────────────────────────────────────
     [sidebar id, icon key, go-to letter, extra search words]. Same order as
     the sidebar, so the palette and the shortcuts sheet read the same way. */
  var NAV = [
    ['nav-home-sidebar',          'home',      'h', 'dashboard overview start'],
    ['nav-quiz-sidebar',          'quiz',      'q', 'quizzes tests exams'],
    ['nav-assignments-sidebar',   'assign',    'a', 'homework tasks submissions'],
    ['nav-resources-sidebar',     'folder',    'r', 'files notes downloads materials'],
    ['nav-announcements-sidebar', 'megaphone', 'n', 'news notices updates'],
    ['nav-syllabus-sidebar',      'book',      's', 'curriculum topics outline'],
    ['nav-grades-sidebar',        'chart',     'g', 'grades marks results reports progress'],
    ['nav-evaluations-sidebar',   'star',      'e', 'feedback rate teacher survey'],
    ['nav-myclass-sidebar',       'users',     'c', 'class classmates parent'],
    ['nav-joinclass-sidebar',     'plus',      '',  'enrol register']
  ];
  function navEl(id) {
    var n = $(id);
    return n && sidebar.contains(n) && getComputedStyle(n).display !== 'none' ? n : null;
  }
  function goTo(id) { var n = navEl(id); if (n) n.click(); }

  /* ── Collapse / expand ─────────────────────────────────────────────── */
  function storedPref() {
    try { var v = localStorage.getItem(KEY); return v === null ? null : v === '1'; } catch (e) { return null; }
  }
  function isCollapsed() { return root.classList.contains('dm-collapsed'); }
  function setCollapsed(collapsed, persist) {
    root.classList.toggle('dm-collapsed', collapsed);
    if (persist) { try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) {} }
    var label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('data-tip', label);
    hideTip();
    if (pop.classList.contains('is-open')) closePop(false);
  }
  toggleBtn.addEventListener('click', function () { setCollapsed(!isCollapsed(), true); });
  toggleBtn.setAttribute('data-tip-always', '');
  toggleBtn.setAttribute('data-tip-kbd', MOD + ' B');
  setCollapsed(isCollapsed(), false);

  // With no saved choice, follow the window: rail on narrower screens.
  onChange(narrow, function (e) { if (storedPref() === null && desktop.matches) setCollapsed(e.matches, false); });

  // Switch transitions on only after first paint, so a saved rail never animates on load.
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('dm-ready'); }); });

  /* ── Structure: navigation landmark (group headings live in the CSS) ── */
  var links = sidebar.querySelector('.sidebar-links');
  if (links) {
    links.setAttribute('role', 'navigation');
    links.setAttribute('aria-label', 'Main');
  }

  /* ── Current page for assistive tech ───────────────────────────────── */
  function syncCurrent() {
    sidebar.querySelectorAll('.dm-item').forEach(function (n) {
      if (n.classList.contains('active')) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });
  }
  if (links && window.MutationObserver) {
    new MutationObserver(syncCurrent).observe(links, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  syncCurrent();

  /* ── Keyboard: arrows move through the menu in the order you see it ── */
  function menuOrder() {
    var items = Array.prototype.slice.call(sidebar.querySelectorAll('.sidebar-links .dm-item'))
      .filter(function (n) { return n.offsetParent !== null; })
      .map(function (n, i) { return { n: n, i: i, o: parseInt(getComputedStyle(n).order, 10) || 0 }; })
      .sort(function (x, y) { return x.o - y.o || x.i - y.i; })
      .map(function (x) { return x.n; });
    return [searchBtn].concat(items);
  }
  sidebar.addEventListener('keydown', function (e) {
    if (!desktop.matches) return;
    var k = e.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
    var cur = e.target.closest && e.target.closest('.dm-item, .dm-search');
    if (!cur) return;
    var order = menuOrder(), i = order.indexOf(cur);
    if (i < 0) return;
    var next = k === 'Home' ? 0 : k === 'End' ? order.length - 1 : Math.max(0, Math.min(order.length - 1, i + (k === 'ArrowDown' ? 1 : -1)));
    e.preventDefault();
    order[next].focus();
  });

  /* ── Tooltips ──────────────────────────────────────────────────────── */
  NAV.forEach(function (n) {
    var item = $(n[0]);
    if (!item || !sidebar.contains(item)) return;
    var l = item.querySelector('.dm-label');
    if (l) item.setAttribute('data-tip', l.textContent.trim());
    if (n[2]) item.setAttribute('data-tip-kbd', 'G ' + n[2].toUpperCase());
  });
  var nameEl = sidebar.querySelector('.learner-name');
  acc.setAttribute('data-tip', nameEl ? nameEl.textContent.trim() : 'Account');
  searchBtn.setAttribute('data-tip', 'Search');
  searchBtn.setAttribute('data-tip-kbd', MOD + ' K');
  $('dmSearchKbd').textContent = IS_MAC ? '\u2318K' : 'Ctrl K';

  // First tooltip waits a beat; moving to a neighbour swaps it instantly.
  var tipTimer = 0, tipFor = null, tipLastHide = 0;
  function placeTip(target) {
    var k = target.getAttribute('data-tip-kbd');
    $('dmTipText').textContent = target.getAttribute('data-tip');
    $('dmTipKbd').textContent = k || '';
    $('dmTipKbd').style.display = k ? '' : 'none';
    var r = target.getBoundingClientRect();
    tip.style.left = Math.round(r.right + 10) + 'px';
    tip.style.top = Math.round(r.top + r.height / 2) + 'px';
    tip.classList.add('is-on');
  }
  function showTip(target, instant) {
    if (!target.getAttribute('data-tip') || !desktop.matches) return;
    if (!isCollapsed() && !target.hasAttribute('data-tip-always')) return;
    if (tipFor === target && (tip.classList.contains('is-on') || tipTimer)) return;
    clearTimeout(tipTimer); tipTimer = 0; tipFor = target;
    if (instant || tip.classList.contains('is-on') || Date.now() - tipLastHide < 300) placeTip(target);
    else tipTimer = setTimeout(function () { tipTimer = 0; placeTip(target); }, 350);
  }
  function hideTip() {
    clearTimeout(tipTimer); tipTimer = 0; tipFor = null;
    if (tip.classList.contains('is-on')) { tip.classList.remove('is-on'); tipLastHide = Date.now(); }
  }
  sidebar.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-tip]');
    if (t) showTip(t, false); else hideTip();
  });
  sidebar.addEventListener('mouseleave', hideTip);
  sidebar.addEventListener('focusin', function (e) { var t = e.target.closest('[data-tip]'); if (t) showTip(t, true); });
  sidebar.addEventListener('focusout', hideTip);
  sidebar.addEventListener('click', hideTip);

  /* ── Actions shared by the account menu and quick search ───────────── */
  function signOut() {
    try { sessionStorage.removeItem('lastLearnerPage'); } catch (e) {}
    window.location.href = 'logout.php';
  }
  var ACTIONS = {
    profile:  function () { call('loadLearnerPersonalInfo'); },
    settings: function () { call('loadLearnerSettings'); },
    photo:    function () { call('triggerLearnerProfileUpload'); },
    keys:     function () { openKeys(); },
    signout:  signOut
  };

  /* ── Account menu ──────────────────────────────────────────────────── */
  // "Keyboard shortcuts" is added here so the PHP markup stays as it was.
  (function () {
    var sep = pop.querySelector('.dm-pop-sep');
    if (!sep || pop.querySelector('[data-act="keys"]')) return;
    var b = el('button', 'dm-pop-item');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.setAttribute('data-act', 'keys');
    b.style.setProperty('--dm-ico', 'var(--dm-i-keyboard)');
    b.appendChild(document.createTextNode('Keyboard shortcuts'));
    b.appendChild(el('span', 'dm-pop-kbd', '?'));
    pop.insertBefore(b, sep);
  })();

  function popOpen() { return pop.classList.contains('is-open'); }
  function placePop() {
    var r = acc.getBoundingClientRect();
    if (isCollapsed()) {
      pop.style.width = '248px';
      pop.style.left = Math.round(r.right + 8) + 'px';
      pop.style.bottom = Math.round(window.innerHeight - r.bottom) + 'px';
    } else {
      pop.style.width = Math.round(Math.max(r.width, 240)) + 'px';
      pop.style.left = Math.round(r.left) + 'px';
      pop.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
    }
  }
  function openPop(focusFirst) {
    hideTip();
    placePop();
    pop.classList.add('is-open');
    acc.setAttribute('aria-expanded', 'true');
    if (focusFirst) { var f = pop.querySelector('.dm-pop-item'); if (f) f.focus(); }
  }
  function closePop(returnFocus) {
    if (!popOpen()) return;
    pop.classList.remove('is-open');
    acc.setAttribute('aria-expanded', 'false');
    if (returnFocus) acc.focus();
  }
  acc.addEventListener('click', function (e) {
    if (!desktop.matches) return;
    // The hidden file input lives inside the avatar; a programmatic
    // input.click() (Upload photo) bubbles here and must not reopen the menu.
    if (e.target.closest && e.target.closest('input')) return;
    e.preventDefault();
    if (popOpen()) closePop(false); else openPop(false);
  });
  acc.addEventListener('keydown', function (e) {
    if (!desktop.matches || e.target !== acc) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); openPop(true); }
  });
  pop.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    closePop(false);
    var run = ACTIONS[btn.getAttribute('data-act')];
    if (run) setTimeout(run, 0);
  });
  pop.addEventListener('keydown', function (e) {
    var items = Array.prototype.slice.call(pop.querySelectorAll('.dm-pop-item'));
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Tab') { closePop(false); }
  });
  document.addEventListener('mousedown', function (e) {
    if (popOpen() && !pop.contains(e.target) && !acc.contains(e.target)) closePop(false);
  });
  window.addEventListener('resize', function () { if (popOpen()) placePop(); });

  /* ── Quick search ──────────────────────────────────────────────────── */
  var EXTRA = [
    { group: 'Actions', label: 'Toggle sidebar',       ico: 'panel',    kw: 'collapse expand rail hide show menu', keys: [MOD, 'B'], run: function () { setCollapsed(!isCollapsed(), true); } },
    { group: 'Actions', label: 'Keyboard shortcuts',   ico: 'keyboard', kw: 'keys hotkeys help commands',          keys: ['?'],      run: ACTIONS.keys },
    { group: 'Actions', label: 'Upload profile photo', ico: 'upload',   kw: 'avatar picture image',                                     run: ACTIONS.photo },
    { group: 'Account', label: 'Personal information', ico: 'user',     kw: 'profile details guardian emergency',                       run: ACTIONS.profile },
    { group: 'Account', label: 'Settings',             ico: 'sliders',  kw: 'notifications account photo',                              run: ACTIONS.settings },
    { group: 'Account', label: 'Sign out',             ico: 'logout',   kw: 'log out logout',                                           run: ACTIONS.signout }
  ];
  var all = [], shown = [], opts = [], sel = 0, before = null;

  function collect() {
    var out = [];
    NAV.forEach(function (n) {
      var item = navEl(n[0]);
      // Skip anything absent or hidden on desktop (Discussions and Calendar live on Home there).
      if (!item) return;
      var l = item.querySelector('.dm-label');
      out.push({
        group: 'Pages', label: l ? l.textContent.trim() : item.textContent.trim(), ico: n[1], kw: n[3],
        tag: item.classList.contains('active') ? 'Current' : '',
        keys: n[2] ? ['G', n[2].toUpperCase()] : null,
        run: function () { item.click(); }
      });
    });
    return out.concat(EXTRA);
  }

  // One search word against one piece of text. Whole-string hits beat word-start
  // hits beat mid-word hits; three or more letters may also match in order
  // ("asg" finds Assignments). Returns { s: score, hits: [indexes] } or null.
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
      h.push(f); from = f + 1;
    }
    return { s: 30 - Math.min(20, h[h.length - 1] - h[0] - tok.length + 1), hits: h };
  }
  function rank(it, toks) {
    var label = it.label.toLowerCase(), kw = it.kw.toLowerCase(), total = 0, hits = [];
    for (var t = 0; t < toks.length; t++) {
      var m = matchToken(label, toks[t]);
      if (!m) {
        if (kw.indexOf(toks[t]) === -1) return null;
        m = { s: 40, hits: [] };
      }
      total += m.s; hits = hits.concat(m.hits);
    }
    return { s: total, hits: hits };
  }

  function fillLabel(node, text, hits) {
    if (!hits.length) { node.textContent = text; return; }
    var mark = {}, buf = '', on = false, i;
    hits.forEach(function (h) { mark[h] = true; });
    function flush() {
      if (!buf) return;
      if (on) node.appendChild(el('span', 'dm-hit', buf)); else node.appendChild(document.createTextNode(buf));
      buf = '';
    }
    for (i = 0; i < text.length; i++) {
      var m = !!mark[i];
      if (m !== on) { flush(); on = m; }
      buf += text.charAt(i);
    }
    flush();
  }

  function palOpen() { return pal.classList.contains('is-open'); }
  function render(q) {
    q = q.trim().toLowerCase();
    var toks = q ? q.split(/\s+/) : [], rows = [];
    if (!toks.length) {
      rows = all.map(function (it) { return { it: it, hits: [] }; });
    } else {
      all.forEach(function (it, n) {
        var r = rank(it, toks);
        if (r) rows.push({ it: it, hits: r.hits, s: r.s - n * 0.001 });
      });
      rows.sort(function (x, y) { return y.s - x.s; });
    }
    shown = rows.map(function (r) { return r.it; });
    opts = [];
    sel = 0;
    list.textContent = '';
    var lastGroup = null;
    rows.forEach(function (r, i) {
      var it = r.it;
      if (!toks.length && it.group !== lastGroup) {
        var h = el('li', 'dm-phead', it.group);
        h.setAttribute('role', 'presentation');
        list.appendChild(h);
        lastGroup = it.group;
      }
      var li = el('li');
      li.id = 'dmOpt' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      var ico = el('span', 'dm-pico'); ico.style.setProperty('--dm-ico', 'var(--dm-i-' + it.ico + ')');
      var lab = el('span', 'dm-plabel'); fillLabel(lab, it.label, r.hits);
      li.appendChild(ico); li.appendChild(lab);
      if (it.tag) {
        li.appendChild(el('span', 'dm-ptag', it.tag));
      } else if (it.keys) {
        var k = el('span', 'dm-pkeys');
        it.keys.forEach(function (key) { k.appendChild(el('kbd', 'dm-pk', key)); });
        li.appendChild(k);
      }
      li.addEventListener('mousemove', function () { if (sel !== i) select(i); });
      li.addEventListener('click', function () { choose(i); });
      list.appendChild(li);
      opts.push(li);
    });
    list.scrollTop = 0;
    empty.hidden = shown.length > 0;
    empty.textContent = 'Nothing matches \u201C' + input.value.trim() + '\u201D. Try Quiz, Gradebook or Settings.';
    input.setAttribute('aria-activedescendant', shown.length ? 'dmOpt0' : '');
  }
  function select(i) {
    if (!opts.length) return;
    sel = (i + opts.length) % opts.length;
    opts.forEach(function (li, n) { li.setAttribute('aria-selected', n === sel ? 'true' : 'false'); });
    var cur = opts[sel];
    input.setAttribute('aria-activedescendant', cur.id);
    if (sel === 0) list.scrollTop = 0;
    else if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (!desktop.matches) return;
    closePop(false); closeKeys(false); hideTip();
    before = document.activeElement;
    all = collect();
    input.value = '';
    render('');
    pal.classList.add('is-open');
    pal.setAttribute('aria-hidden', 'false');
    input.focus();
  }
  function closePalette() {
    if (!palOpen()) return;
    pal.classList.remove('is-open');
    pal.setAttribute('aria-hidden', 'true');
    if (document.activeElement === input) input.blur(); // don't wait for the browser to notice it is hidden
    if (before && before.focus && document.contains(before)) before.focus();
    before = null;
  }
  function choose(i) {
    var it = shown[i];
    if (!it) return;
    closePalette();
    setTimeout(it.run, 0);
  }
  searchBtn.addEventListener('click', openPalette);
  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  });
  pal.addEventListener('mousedown', function (e) { if (e.target === pal) closePalette(); });

  /* ── Keyboard shortcuts sheet ──────────────────────────────────────── */
  var keysEl = null, keysPanel = null, keysBody = null, keysClose = null, keysBefore = null;
  function keysOpen() { return !!keysEl && keysEl.classList.contains('is-open'); }
  function buildKeys() {
    if (keysEl) return;
    keysEl = el('div', 'dm-keys'); keysEl.id = 'dmKeys'; keysEl.setAttribute('aria-hidden', 'true');
    keysPanel = el('div', 'dm-keys-panel');
    keysPanel.setAttribute('role', 'dialog'); keysPanel.setAttribute('aria-modal', 'true');
    keysPanel.setAttribute('aria-labelledby', 'dmKeysTitle'); keysPanel.tabIndex = -1;
    var head = el('div', 'dm-keys-head');
    var h = el('h2', '', 'Keyboard shortcuts'); h.id = 'dmKeysTitle';
    keysClose = el('button', 'dm-keys-x'); keysClose.type = 'button'; keysClose.setAttribute('aria-label', 'Close');
    head.appendChild(h); head.appendChild(keysClose);
    keysBody = el('div', 'dm-keys-body');
    keysPanel.appendChild(head); keysPanel.appendChild(keysBody);
    keysEl.appendChild(keysPanel);
    document.body.appendChild(keysEl);

    keysClose.addEventListener('click', function () { closeKeys(true); });
    keysEl.addEventListener('mousedown', function (e) { if (e.target === keysEl) closeKeys(true); });
    keysEl.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); keysClose.focus(); } });
  }
  function keyRow(label, keys) {
    var row = el('div', 'dm-krow');
    row.appendChild(el('span', '', label));
    var k = el('i');
    keys.forEach(function (key) { k.appendChild(el('kbd', '', key)); });
    row.appendChild(k);
    return row;
  }
  function fillKeys() {
    keysBody.textContent = '';
    var gen = el('section', 'dm-keys-sec'); gen.appendChild(el('h3', '', 'General'));
    [['Search pages and actions', [MOD, 'K']], ['Collapse or expand the sidebar', [MOD, 'B']],
     ['Show this list', ['?']], ['Close a menu or dialog', ['Esc']]].forEach(function (r) { gen.appendChild(keyRow(r[0], r[1])); });
    var go = el('section', 'dm-keys-sec'); go.appendChild(el('h3', '', 'Go to'));
    NAV.forEach(function (n) {
      var item = navEl(n[0]);
      if (!item || !n[2]) return;
      var l = item.querySelector('.dm-label');
      go.appendChild(keyRow(l ? l.textContent.trim() : n[1], ['G', n[2].toUpperCase()]));
    });
    keysBody.appendChild(gen); keysBody.appendChild(go);
    if (SHORTCUTS_ENABLED) keysBody.appendChild(el('p', 'dm-keys-note', 'For the Go to shortcuts, press G, then the letter. They pause while you are typing in a field.'));
  }
  function openKeys() {
    if (!desktop.matches) return;
    buildKeys();
    var from = document.activeElement;
    keysBefore = pop.contains(from) ? acc : from;
    closePop(false); closePalette(); hideTip();
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

  /* ── Join a Class dialog ───────────────────────────────────────────────
     The form is still the one PHP renders (same CSRF token, same POST, same handler). It is
     moved into the dialog while the dialog is open and put back when it closes, so nothing is
     duplicated and the sidebar never has to make room for it. Choosing a class asks for one
     more confirmation first, because a learner can only choose their class once.
     Below 769px toggleJoinClassForm() is left exactly as the page defines it. */
  var joinEl = null, joinPanel = null, joinBody = null, joinWrap = null, joinFormEl = null;
  var joinSelect = null, joinSubmit = null, joinX = null, joinBack = null, joinYes = null;
  var joinAsk = null, joinConfirm = null, joinMark = null, joinSent = false;
  var JOIN_YES = 'Yes, join this class';

  function joinOpen() { return !!joinEl && joinEl.classList.contains('is-open'); }
  function joinTargets() {
    var t = joinPanel.classList.contains('is-confirming') ? [joinX, joinBack, joinYes] : [joinX, joinSelect, joinSubmit];
    return t.filter(function (n) { return n && !n.disabled; });
  }
  function joinAskConfirm() {
    var opt = joinSelect.options[joinSelect.selectedIndex];
    joinAsk.textContent = '';
    joinAsk.appendChild(document.createTextNode('Join '));
    joinAsk.appendChild(el('strong', '', opt ? opt.textContent.trim() : ''));
    joinAsk.appendChild(document.createTextNode('? You can only choose your class once, so make sure this is the right one.'));
    joinPanel.classList.add('is-confirming');
    joinYes.focus();
  }
  function buildJoin() {
    if (joinEl) return true;
    joinWrap = $('joinClassForm');
    joinFormEl = joinWrap && joinWrap.querySelector('form');
    joinSelect = joinFormEl && joinFormEl.querySelector('select');
    joinSubmit = joinFormEl && joinFormEl.querySelector('.join-class-btn');
    if (!joinSelect || !joinSubmit) return false;
    joinSelect.setAttribute('aria-label', 'Class');

    joinEl = el('div', 'dm-join'); joinEl.id = 'dmJoin'; joinEl.setAttribute('aria-hidden', 'true');
    joinPanel = el('div', 'dm-join-panel');
    joinPanel.setAttribute('role', 'dialog'); joinPanel.setAttribute('aria-modal', 'true');
    joinPanel.setAttribute('aria-labelledby', 'dmJoinTitle'); joinPanel.tabIndex = -1;
    var head = el('div', 'dm-join-head');
    var h = el('h2', '', 'Join a class'); h.id = 'dmJoinTitle';
    joinX = el('button', 'dm-keys-x'); joinX.type = 'button'; joinX.setAttribute('aria-label', 'Close');
    head.appendChild(h); head.appendChild(joinX);
    joinBody = el('div', 'dm-join-body');
    joinConfirm = el('div', 'dm-join-confirm');
    joinAsk = el('p', 'dm-join-ask');
    var row = el('div', 'dm-join-actions');
    joinBack = el('button', 'dm-join-btn', 'Go back'); joinBack.type = 'button';
    joinYes = el('button', 'dm-join-btn dm-join-btn--go', JOIN_YES); joinYes.type = 'button';
    row.appendChild(joinBack); row.appendChild(joinYes);
    joinConfirm.appendChild(joinAsk); joinConfirm.appendChild(row);
    joinBody.appendChild(joinConfirm);
    joinPanel.appendChild(head); joinPanel.appendChild(joinBody);
    joinEl.appendChild(joinPanel);
    document.body.appendChild(joinEl);

    joinX.addEventListener('click', function () { closeJoin(true); });
    joinEl.addEventListener('mousedown', function (e) { if (e.target === joinEl) closeJoin(true); });
    joinBack.addEventListener('click', function () { joinPanel.classList.remove('is-confirming'); joinSelect.focus(); });
    joinYes.addEventListener('click', function () {
      if (joinSent) return;
      joinSent = true;
      joinYes.disabled = true; joinBack.disabled = true; joinYes.textContent = 'Joining\u2026';
      // form.submit() leaves the clicked button out of the POST, and the PHP handler looks for join_class.
      var flag = joinFormEl.querySelector('input[name="join_class"]');
      if (!flag) { flag = el('input'); flag.type = 'hidden'; flag.name = 'join_class'; flag.value = '1'; joinFormEl.appendChild(flag); }
      joinFormEl.submit();
    });
    // The form's own submit button now opens the confirmation instead of posting straight away.
    joinFormEl.addEventListener('submit', function (e) {
      if (!joinOpen() || joinSent) return;
      e.preventDefault();
      if (joinSelect.value) joinAskConfirm(); else joinSelect.focus();
    });
    joinEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var t = joinTargets(), a = document.activeElement;
      if (!t.length) { e.preventDefault(); joinPanel.focus(); return; }
      if (e.shiftKey && (a === t[0] || a === joinPanel)) { e.preventDefault(); t[t.length - 1].focus(); }
      else if (!e.shiftKey && a === t[t.length - 1]) { e.preventDefault(); t[0].focus(); }
    });
    return true;
  }
  function openJoin() {
    if (!desktop.matches || !buildJoin() || joinOpen()) return;
    closePop(false); closePalette(); closeKeys(false); hideTip();
    joinMark = document.createComment('dm-join');
    joinWrap.parentNode.insertBefore(joinMark, joinWrap);
    joinBody.insertBefore(joinWrap, joinConfirm);
    joinWrap.style.display = 'block';
    joinEl.classList.add('is-open');
    joinEl.setAttribute('aria-hidden', 'false');
    joinSelect.focus();
  }
  function closeJoin(restore) {
    if (!joinOpen()) return;
    joinEl.classList.remove('is-open');
    joinEl.setAttribute('aria-hidden', 'true');
    joinWrap.style.display = 'none';
    if (joinMark && joinMark.parentNode) { joinMark.parentNode.insertBefore(joinWrap, joinMark); joinMark.parentNode.removeChild(joinMark); }
    joinMark = null;
    joinPanel.classList.remove('is-confirming');
    joinSent = false; joinYes.disabled = false; joinBack.disabled = false; joinYes.textContent = JOIN_YES;
    joinSelect.value = '';
    var from = $('nav-joinclass-sidebar');
    if (restore !== false && from && from.focus) from.focus();
  }
  // The sidebar button, quick search and the account of the page script all reach this through
  // the page's own toggleJoinClassForm(), so wrapping it covers every way of opening the form.
  var pageToggleJoin = window.toggleJoinClassForm;
  window.toggleJoinClassForm = function () {
    if (desktop.matches && buildJoin()) { openJoin(); return; }
    if (typeof pageToggleJoin === 'function') return pageToggleJoin.apply(this, arguments);
  };
  onChange(desktop, function (e) { if (!e.matches) closeJoin(false); });

  /* ── Global shortcuts ──────────────────────────────────────────────── */
  var GO = {}, gArmed = false, gTimer = 0;
  NAV.forEach(function (n) { if (n[2]) GO[n[2]] = n[0]; });

  document.addEventListener('keydown', function (e) {
    if (!desktop.matches) return;
    if (e.key === 'Escape') {
      if (joinOpen()) { e.preventDefault(); closeJoin(true); }
      else if (keysOpen()) { e.preventDefault(); closeKeys(true); }
      else if (palOpen()) { e.preventDefault(); closePalette(); }
      else if (popOpen()) { e.preventDefault(); closePop(true); }
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      if (e.altKey || e.shiftKey || joinOpen()) return;
      // Never hijack Ctrl+B / Ctrl+K while someone is typing an answer (the search box is the exception).
      if (inField(e.target) && !pal.contains(e.target)) return;
      var k = String(e.key).toLowerCase();
      if (k === 'k') { e.preventDefault(); closeKeys(false); if (palOpen()) closePalette(); else openPalette(); }
      else if (k === 'b') { e.preventDefault(); setCollapsed(!isCollapsed(), true); }
      return;
    }

    // Single-key shortcuts: only when nothing is being typed and nothing is open.
    if (!SHORTCUTS_ENABLED || e.altKey || e.repeat || inField(e.target)) return;
    if (keysOpen() || palOpen() || popOpen() || joinOpen()) return;

    if (gArmed) {
      gArmed = false; clearTimeout(gTimer);
      var id = GO[String(e.key).toLowerCase()];
      if (id) { e.preventDefault(); goTo(id); }
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

  /* ── Header title: "Home" instead of the school name (desktop only) ─────
     The page script puts the school name in the header whenever Home is
     showing. On desktop the school already has its logo and name at the top
     of the sidebar, so the header names the page instead, like every other
     page does. Mobile is left alone and keeps the school name.
     Only the visible text changes; the page script never sees a difference
     in what it wrote, and it can rewrite the title as often as it likes. */
  var HOME_TITLE = 'Home';
  var titleEl = $('headerTitle');
  var brandNameEl = sidebar.querySelector('.dm-brand-name');
  var schoolName = brandNameEl ? brandNameEl.textContent.trim() : '';
  var titleSwapped = false;

  // The page script writes the name through htmlspecialchars(), so a name like
  // "St. Mary's" can arrive as "St. Mary&#039;s". Accept both spellings.
  function escapeHtml(t) {
    return t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function isSchoolTitle(t) { return t === schoolName || t === escapeHtml(schoolName); }

  function syncTitle() {
    if (!titleEl || !schoolName) return;
    var now = titleEl.textContent.trim();
    if (now !== HOME_TITLE) titleSwapped = false;
    if (desktop.matches) {
      if (isSchoolTitle(now)) { titleEl.textContent = HOME_TITLE; titleSwapped = true; }
    } else if (titleSwapped) {
      titleEl.textContent = schoolName; titleSwapped = false; // window narrowed to mobile: put the name back
    }
  }
  if (titleEl && window.MutationObserver) {
    new MutationObserver(syncTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  /* ── Detail pages keep their top bar (desktop) ──────────────────────────
     The CSS hides the whole top bar on desktop, with one exception: configureHeader() in detail
     mode shows #headerBackBtn, which is the way back from a detail page. Watching that button's
     own display is the one hook needed. It puts .dm-detail on <html> while the button is showing,
     so the CSS can keep the bar for exactly those pages, and the page scripts never need to know
     this file exists. */
  var backBtn = $('headerBackBtn');
  function syncDetail() {
    root.classList.toggle('dm-detail', !!backBtn && getComputedStyle(backBtn).display !== 'none');
  }
  if (backBtn && window.MutationObserver) {
    new MutationObserver(syncDetail).observe(backBtn, { attributes: true, attributeFilter: ['style'] });
  }
  syncDetail();

  /* ── Desktop / mobile switch ───────────────────────────────────────── */
  function syncMode() {
    syncTitle();
    if (desktop.matches) {
      acc.setAttribute('role', 'button');
      acc.setAttribute('tabindex', '0');
      acc.setAttribute('aria-haspopup', 'menu');
      acc.setAttribute('aria-label', 'Account menu');
      acc.setAttribute('aria-expanded', popOpen() ? 'true' : 'false');
    } else {
      ['role', 'tabindex', 'aria-haspopup', 'aria-label', 'aria-expanded'].forEach(function (x) { acc.removeAttribute(x); });
      closePop(false); closePalette(); closeKeys(false); hideTip();
    }
  }
  onChange(desktop, syncMode);
  syncMode();
})();