/* assets/js/learner/mobile_menu.js
   Mobile drawer behaviour (max-width: 768px). Load it AFTER the other learner scripts, including desktop_menu.js.

   - The drawer follows your finger (edge swipe to open, drag left to close) and settles on release speed.
     Open and close still go through your own toggleSidebar(), so the header, theme colour and overlay
     logic in learner_dashboard.php keep working exactly as before.
   - The account row opens a bottom sheet (it reuses the desktop account menu element).
   - Search finds pages and account actions and opens them through the real menu links.
   - window.dmSetBadge(pageKey, count) puts a count on a menu item and its bottom-nav tab, e.g.
       dmSetBadge('assignment_list.php', 2);   dmSetBadge('assignment_list.php', 0);  // clears it
     It shows nothing until something calls it, because the page has no counts to show yet. */
(function () {
  'use strict';

  var sidebar = document.getElementById('dmSidebar');
  if (!sidebar) return;

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var mq = window.matchMedia('(max-width: 768px)');
  function isMobile() { return window.innerWidth <= 768; }
  function isOpen() { return sidebar.classList.contains('active'); }
  function toggle(forceClose) { if (typeof window.toggleSidebar === 'function') window.toggleSidebar(forceClose); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var acc = $('dmAccount'), pop = $('dmAccountMenu'), searchBtn = $('dmSearchBtn');

  /* ── Drag ────────────────────────────────────────────────────────────── */
  var EDGE = 32;       // px from the left edge where an opening swipe may start
  var LOCK = 8;        // px of horizontal travel before the gesture is ours
  var FLICK = 0.35;    // px per ms: faster than this decides the direction by itself
  var W = 300, g = null, durTimer = 0;

  function parts() {
    return {
      side: sidebar,
      main: document.querySelector('.main-content'),
      nav: $('mobileBottomNav'),
      dim: $('mobileOverlay')
    };
  }
  function apply(p) {
    var o = parts(), x = Math.round(p * W * 10) / 10;
    o.side.style.transform = 'translate3d(' + (x - W) + 'px,0,0)';
    if (o.main) o.main.style.transform = 'translate3d(' + x + 'px,0,0)';
    if (o.nav) o.nav.style.transform = 'translate3d(' + x + 'px,0,0)';
    if (o.dim) { o.dim.style.transform = 'translate3d(' + x + 'px,0,0)'; o.dim.style.opacity = String(p); }
  }
  function clearInline() {
    var o = parts();
    [o.side, o.main, o.nav, o.dim].forEach(function (n) { if (n) { n.style.transform = ''; n.style.opacity = ''; } });
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function touchOf(e) {
    for (var i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === g.id) return e.touches[i];
    return null;
  }
  function sheetOpen() { return !!pop && pop.classList.contains('is-open'); }

  // Registered on window in the capture phase so these run before the older swipe handler in the page,
  // which we silence for gestures we own (otherwise its touchend would toggle the menu a second time).
  window.addEventListener('touchstart', function (e) {
    g = null;
    if (!isMobile() || e.touches.length !== 1 || sheetOpen() || searchIsOpen()) return;
    var t = e.touches[0], open = isOpen();
    if (!open && t.clientX > EDGE) return;
    g = { id: t.identifier, x: t.clientX, y: t.clientY, open: open, p0: open ? 1 : 0, p: open ? 1 : 0, locked: false, dead: false, pts: [[t.clientX, e.timeStamp]] };
    e.stopPropagation();
  }, { capture: true, passive: true });

  window.addEventListener('touchmove', function (e) {
    if (!g) return;
    var t = touchOf(e);
    if (!t) return;
    e.stopPropagation();
    if (g.dead) return;
    var dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.locked) {
      if (Math.abs(dx) > LOCK && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (!g.open && dx < 0) { g.dead = true; return; }      // swiping left from the edge: not ours
        g.locked = true;
        W = sidebar.offsetWidth || 300;
        root.classList.add('dmm-drag');
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
    root.style.setProperty('--dmm-dur', dur + 'ms');
    // Change the menu state and hand the position back to the stylesheet in the same frame, so the
    // CSS transition carries on from exactly where the finger let go.
    if (target === 1 && !isOpen()) toggle(false);
    else if (target === 0 && isOpen()) toggle(true);
    clearInline();
    root.classList.remove('dmm-drag');
    clearTimeout(durTimer);
    durTimer = setTimeout(function () { root.style.removeProperty('--dmm-dur'); }, dur + 80);
  }
  function end(e) {
    if (!g) return;
    e.stopPropagation();
    if (g.locked) { if (e.cancelable) e.preventDefault(); finish(e.timeStamp); }
    g = null;
  }
  window.addEventListener('touchend', end, { capture: true, passive: false });
  window.addEventListener('touchcancel', end, { capture: true, passive: false });

  /* ── Browser bar colour while the drawer is open ─────────────────────── */
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta && window.MutationObserver) {
    new MutationObserver(function () {
      if (isMobile() && isOpen()) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--dm-bg').trim() || '#0a0d12');
    }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Account sheet ───────────────────────────────────────────────────── */
  var sheetBg = null;
  function openSheet() {
    if (!pop || !acc) return;
    if (!sheetBg) { sheetBg = el('div', 'dmm-sheet-bg'); sheetBg.id = 'dmmSheetBg'; document.body.appendChild(sheetBg); sheetBg.addEventListener('click', closeSheet); }
    pop.classList.add('is-open');
    sheetBg.classList.add('on');
    acc.setAttribute('aria-expanded', 'true');
  }
  function closeSheet() {
    if (!pop) return;
    pop.classList.remove('is-open');
    if (sheetBg) sheetBg.classList.remove('on');
    if (acc) acc.setAttribute('aria-expanded', 'false');
  }
  if (acc && pop) {
    acc.addEventListener('click', function (e) {
      if (!isMobile()) return;
      e.preventDefault();
      if (sheetOpen()) closeSheet(); else openSheet();
    });
    pop.addEventListener('click', function (e) {
      if (!isMobile() || !e.target.closest('[data-act]')) return;
      closeSheet();
      setTimeout(function () { if (isOpen()) toggle(true); }, 0);   // the action runs from desktop_menu.js; also close the drawer
    });
  }

  /* ── Profile picture file input ──────────────────────────────────────── */
  // #profileInput sits inside #dmAccount. When something calls profileInput.click() (Upload photo in the sheet,
  // the change-photo buttons in Settings), that click bubbles up to the account row above, whose handler calls
  // preventDefault() (which cancels the file picker) and opens the sheet. Keep the input's own click to itself.
  var photoInput = $('profileInput');
  if (photoInput) photoInput.addEventListener('click', function (e) { if (isMobile()) e.stopPropagation(); });

  /* ── Search ──────────────────────────────────────────────────────────── */
  var ICON = {
    'nav-home-sidebar': 'home', 'nav-quiz-sidebar': 'quiz', 'nav-assignments-sidebar': 'assign', 'nav-resources-sidebar': 'folder',
    'nav-announcements-sidebar': 'bell', 'nav-discussions-sidebar': 'chat', 'nav-syllabus-sidebar': 'book',
    'nav-grades-sidebar': 'chart', 'nav-evaluations-sidebar': 'star', 'nav-calendar-sidebar': 'calendar',
    'nav-myclass-sidebar': 'users', 'nav-joinclass-sidebar': 'plus'
  };
  var WORDS = {
    'nav-home-sidebar': 'dashboard overview start', 'nav-quiz-sidebar': 'quizzes tests exams', 'nav-assignments-sidebar': 'homework tasks submissions',
    'nav-resources-sidebar': 'files notes downloads materials', 'nav-announcements-sidebar': 'news notices updates',
    'nav-discussions-sidebar': 'chat forum messages', 'nav-syllabus-sidebar': 'curriculum topics outline',
    'nav-grades-sidebar': 'grades marks results reports progress', 'nav-evaluations-sidebar': 'feedback rate teacher survey',
    'nav-calendar-sidebar': 'events dates schedule timetable', 'nav-myclass-sidebar': 'class classmates parent', 'nav-joinclass-sidebar': 'enrol register'
  };
  var ACT_ICON = { profile: 'user', settings: 'sliders', photo: 'upload', signout: 'logout' };
  var ACT_WORDS = { profile: 'details guardian emergency', settings: 'notifications account', photo: 'avatar picture image', signout: 'log out logout' };
  var S = null, sInput = null, sList = null, sAll = [], sBefore = null;

  function searchIsOpen() { return !!S && S.classList.contains('on'); }
  function collect() {
    var rows = [];
    sidebar.querySelectorAll('.sidebar-links .dm-item').forEach(function (n) {
      if (!ICON[n.id] || n.offsetParent === null) return;
      var l = n.querySelector('.dm-label');
      rows.push({ group: 'Pages', label: (l ? l.textContent : n.textContent).trim(), ico: ICON[n.id], kw: WORDS[n.id] || '', tag: n.classList.contains('active') ? 'Current' : '',
        run: function () { n.click(); setTimeout(function () { if (isOpen()) toggle(true); }, 80); } });
    });
    if (pop) pop.querySelectorAll('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      if (!ACT_ICON[a]) return;
      rows.push({ group: 'Account', label: b.textContent.trim(), ico: ACT_ICON[a], kw: ACT_WORDS[a] || '', tag: '', run: function () { b.click(); } });
    });
    return rows;
  }
  // Word-start hits beat mid-word hits; three or more letters may also match in order ("asg" finds Assignments).
  function matchTok(text, tok) {
    var i = text.indexOf(tok), h = [], c;
    if (i > -1) { for (c = 0; c < tok.length; c++) h.push(i + c); return { s: i === 0 ? 100 : text.charAt(i - 1) === ' ' ? 80 : 60, hits: h }; }
    if (tok.length < 3) return null;
    var from = 0;
    for (c = 0; c < tok.length; c++) { var f = text.indexOf(tok.charAt(c), from); if (f < 0) return null; h.push(f); from = f + 1; }
    return { s: 30 - Math.min(20, h[h.length - 1] - h[0] - tok.length + 1), hits: h };
  }
  function rank(row, toks) {
    var label = row.label.toLowerCase(), kw = row.kw.toLowerCase(), total = 0, hits = [];
    for (var t = 0; t < toks.length; t++) {
      var m = matchTok(label, toks[t]);
      if (!m) { if (kw.indexOf(toks[t]) === -1) return null; m = { s: 40, hits: [] }; }
      total += m.s; hits = hits.concat(m.hits);
    }
    return { s: total, hits: hits };
  }
  function fill(node, text, hits) {
    if (!hits.length) { node.textContent = text; return; }
    var mark = {}, buf = '', on = false, i;
    hits.forEach(function (h) { mark[h] = true; });
    function flush() { if (!buf) return; if (on) node.appendChild(el('b', '', buf)); else node.appendChild(document.createTextNode(buf)); buf = ''; }
    for (i = 0; i < text.length; i++) { var m = !!mark[i]; if (m !== on) { flush(); on = m; } buf += text.charAt(i); }
    flush();
  }
  function render(q) {
    var toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean), rows = [];
    if (!toks.length) rows = sAll.map(function (r) { return { r: r, hits: [] }; });
    else {
      sAll.forEach(function (r, n) { var k = rank(r, toks); if (k) rows.push({ r: r, hits: k.hits, s: k.s - n * 0.001 }); });
      rows.sort(function (a, b) { return b.s - a.s; });
    }
    sList.textContent = '';
    if (!rows.length) { sList.appendChild(el('div', 'dmm-s-empty', 'Nothing matches \u201C' + q.trim() + '\u201D. Try Quiz, Gradebook or Settings.')); return; }
    var last = null;
    rows.forEach(function (x) {
      if (!toks.length && x.r.group !== last) { sList.appendChild(el('div', 'dmm-s-head', x.r.group)); last = x.r.group; }
      var b = el('button', 'dmm-s-row'); b.type = 'button';
      b.style.setProperty('--dm-ico', 'var(--dm-i-' + x.r.ico + ')');
      var lab = el('span'); fill(lab, x.r.label, x.hits); b.appendChild(lab);
      if (x.r.tag) b.appendChild(el('span', 't', x.r.tag));
      b.addEventListener('click', function () { closeSearch(false); setTimeout(x.r.run, 0); });
      sList.appendChild(b);
    });
  }
  function buildSearch() {
    if (S) return;
    S = el('div', 'dmm-s'); S.id = 'dmmSearch'; S.setAttribute('role', 'dialog'); S.setAttribute('aria-label', 'Search pages and actions');
    var bar = el('div', 'dmm-s-bar'), field = el('div', 'dmm-s-field');
    sInput = el('input'); sInput.type = 'text'; sInput.placeholder = 'Search'; sInput.autocomplete = 'off'; sInput.spellcheck = false; sInput.setAttribute('aria-label', 'Search pages and actions');
    sInput.setAttribute('enterkeyhint', 'go');
    field.appendChild(sInput);
    var cancel = el('button', 'dmm-s-cancel', 'Cancel'); cancel.type = 'button';
    bar.appendChild(field); bar.appendChild(cancel);
    sList = el('div', 'dmm-s-list');
    S.appendChild(bar); S.appendChild(sList);
    document.body.appendChild(S);
    cancel.addEventListener('click', function () { closeSearch(true); });
    sInput.addEventListener('input', function () { render(sInput.value); });
    sInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var first = sList.querySelector('.dmm-s-row'); if (first) first.click(); } });
  }
  function openSearch() {
    if (!isMobile()) return;
    buildSearch();
    sBefore = document.activeElement;
    sAll = collect();
    sInput.value = '';
    render('');
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
  if (searchBtn) searchBtn.addEventListener('click', openSearch);

  document.addEventListener('keydown', function (e) {
    if (!isMobile() || e.key !== 'Escape') return;
    if (searchIsOpen()) closeSearch(true);
    else if (sheetOpen()) closeSheet();
    else if (isOpen()) toggle(true);
  });

  /* ── Badges ──────────────────────────────────────────────────────────── */
  window.dmSetBadge = function (pageKey, count) {
    var sel = '.sidebar [data-page="' + pageKey + '"], #mobileBottomNav [data-page="' + pageKey + '"]';
    document.querySelectorAll(sel).forEach(function (n) {
      var b = n.querySelector(':scope > .dmm-badge');
      if (!count) { if (b) b.remove(); return; }
      if (!b) { b = el('span', 'dmm-badge'); n.appendChild(b); }
      b.textContent = count > 99 ? '99+' : String(count);
    });
  };

  /* ── Leaving mobile width: put everything away ───────────────────────── */
  function onChange(e) {
    if (e.matches) return;
    g = null; closeSheet(); closeSearch(false);
    clearInline(); root.classList.remove('dmm-drag'); root.style.removeProperty('--dmm-dur');
  }
  if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
})();