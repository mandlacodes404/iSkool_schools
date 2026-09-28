/* assets/js/learner/desktop_menu.js
   Behaviour for the desktop sidebar: collapse to a rail (remembered), rail
   tooltips, account menu, and quick search (Ctrl/Cmd + K).

   It never re-implements navigation. Quick search clicks the real sidebar
   links, so every existing onclick, loader and setActive() path still runs. */
(function () {
  'use strict';

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
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var MOD = IS_MAC ? '\u2318' : 'Ctrl';

  function onChange(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); }
  function call(name) { if (typeof window[name] === 'function') window[name](); }

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

  /* ── Current page for assistive tech ───────────────────────────────── */
  var links = sidebar.querySelector('.sidebar-links');
  function syncCurrent() {
    sidebar.querySelectorAll('.dm-item').forEach(function (el) {
      if (el.classList.contains('active')) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }
  if (links && window.MutationObserver) {
    new MutationObserver(syncCurrent).observe(links, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  syncCurrent();

  /* ── Tooltips ──────────────────────────────────────────────────────── */
  sidebar.querySelectorAll('.sidebar-links .dm-item').forEach(function (el) {
    var l = el.querySelector('.dm-label');
    if (l) el.setAttribute('data-tip', l.textContent.trim());
  });
  var nameEl = sidebar.querySelector('.learner-name');
  acc.setAttribute('data-tip', nameEl ? nameEl.textContent.trim() : 'Account');
  searchBtn.setAttribute('data-tip', 'Search');
  searchBtn.setAttribute('data-tip-kbd', MOD + ' K');
  $('dmSearchKbd').textContent = IS_MAC ? '\u2318K' : 'Ctrl K';

  function showTip(el) {
    var text = el.getAttribute('data-tip');
    if (!text || !desktop.matches) return;
    if (!isCollapsed() && !el.hasAttribute('data-tip-always')) return;
    var k = el.getAttribute('data-tip-kbd');
    $('dmTipText').textContent = text;
    $('dmTipKbd').textContent = k || '';
    $('dmTipKbd').style.display = k ? '' : 'none';
    var r = el.getBoundingClientRect();
    tip.style.left = Math.round(r.right + 10) + 'px';
    tip.style.top = Math.round(r.top + r.height / 2) + 'px';
    tip.classList.add('is-on');
  }
  function hideTip() { tip.classList.remove('is-on'); }
  sidebar.addEventListener('mouseover', function (e) {
    var el = e.target.closest('[data-tip]');
    if (el) showTip(el); else hideTip();
  });
  sidebar.addEventListener('mouseleave', hideTip);
  sidebar.addEventListener('focusin', function (e) { var el = e.target.closest('[data-tip]'); if (el) showTip(el); });
  sidebar.addEventListener('focusout', hideTip);
  sidebar.addEventListener('click', hideTip);

  // "Join a Class" needs room for its form, so open the rail first.
  var joinBtn = $('nav-joinclass-sidebar');
  if (joinBtn) joinBtn.addEventListener('click', function () {
    if (desktop.matches && isCollapsed()) setCollapsed(false, false);
  }, true);

  /* ── Actions shared by the account menu and quick search ───────────── */
  function signOut() {
    try { sessionStorage.removeItem('lastLearnerPage'); } catch (e) {}
    window.location.href = 'logout.php';
  }
  var ACTIONS = {
    profile:  function () { call('loadLearnerPersonalInfo'); },
    settings: function () { call('loadLearnerSettings'); },
    photo:    function () { call('triggerLearnerProfileUpload'); },
    signout:  signOut
  };

  /* ── Account menu ──────────────────────────────────────────────────── */
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
    if (focusFirst) { var first = pop.querySelector('.dm-pop-item'); if (first) first.focus(); }
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
    ACTIONS[btn.getAttribute('data-act')]();
  });
  pop.addEventListener('keydown', function (e) {
    var items = Array.prototype.slice.call(pop.querySelectorAll('.dm-pop-item'));
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Tab') { closePop(false); }
  });
  document.addEventListener('mousedown', function (e) {
    if (popOpen() && !pop.contains(e.target) && !acc.contains(e.target)) closePop(false);
  });
  window.addEventListener('resize', function () { if (popOpen()) placePop(); });

  /* ── Quick search ──────────────────────────────────────────────────── */
  // Same order as the sidebar. Each entry is [icon key, extra search words].
  var NAV = {
    'nav-home-sidebar':          ['home', 'dashboard overview start'],
    'nav-quiz-sidebar':          ['quiz', 'quizzes tests exams'],
    'nav-assignments-sidebar':   ['assign', 'homework tasks submissions'],
    'nav-resources-sidebar':     ['folder', 'files notes downloads materials'],
    'nav-syllabus-sidebar':      ['book', 'curriculum topics outline'],
    'nav-grades-sidebar':        ['chart', 'grades marks results reports progress'],
    'nav-announcements-sidebar': ['megaphone', 'news notices updates'],
    'nav-evaluations-sidebar':   ['star', 'feedback rate teacher survey'],
    'nav-myclass-sidebar':       ['users', 'class classmates parent'],
    'nav-joinclass-sidebar':     ['plus', 'enrol register']
  };
  var EXTRA = [
    { label: 'Personal information', ico: 'user',    kw: 'profile details guardian emergency', run: ACTIONS.profile },
    { label: 'Settings',             ico: 'sliders', kw: 'notifications account photo',        run: ACTIONS.settings },
    { label: 'Sign out',             ico: 'logout',  kw: 'log out logout',                     run: ACTIONS.signout }
  ];
  var all = [], shown = [], sel = 0, before = null;

  function collect() {
    var out = [];
    Object.keys(NAV).forEach(function (id) {
      var el = document.getElementById(id);
      // Skip anything absent or hidden on desktop (Discussions and Calendar live on Home there).
      if (!el || !sidebar.contains(el) || getComputedStyle(el).display === 'none') return;
      var l = el.querySelector('.dm-label');
      out.push({
        label: l ? l.textContent.trim() : el.textContent.trim(), ico: NAV[id][0], kw: NAV[id][1],
        tag: el.classList.contains('active') ? 'Current' : '',
        run: function () { el.click(); }
      });
    });
    EXTRA.forEach(function (a) { out.push({ label: a.label, ico: a.ico, kw: a.kw, tag: 'Account', run: a.run }); });
    return out;
  }
  function palOpen() { return pal.classList.contains('is-open'); }
  function render(q) {
    q = q.trim().toLowerCase();
    shown = all.filter(function (it) { return !q || (it.label + ' ' + it.kw).toLowerCase().indexOf(q) !== -1; });
    if (q) shown.sort(function (a, b) {
      return (a.label.toLowerCase().indexOf(q) === 0 ? 0 : 1) - (b.label.toLowerCase().indexOf(q) === 0 ? 0 : 1);
    });
    sel = 0;
    list.textContent = '';
    shown.forEach(function (it, i) {
      var li = document.createElement('li');
      li.id = 'dmOpt' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      var ico = document.createElement('span'); ico.className = 'dm-pico'; ico.style.setProperty('--dm-ico', 'var(--dm-i-' + it.ico + ')');
      var lab = document.createElement('span'); lab.className = 'dm-plabel'; lab.textContent = it.label;
      li.appendChild(ico); li.appendChild(lab);
      if (it.tag) { var t = document.createElement('span'); t.className = 'dm-ptag'; t.textContent = it.tag; li.appendChild(t); }
      li.addEventListener('mousemove', function () { if (sel !== i) select(i); });
      li.addEventListener('click', function () { choose(i); });
      list.appendChild(li);
    });
    empty.hidden = shown.length > 0;
    empty.textContent = 'Nothing matches \u201C' + input.value.trim() + '\u201D. Try Quiz, Gradebook or Settings.';
    input.setAttribute('aria-activedescendant', shown.length ? 'dmOpt0' : '');
  }
  function select(i) {
    if (!shown.length) return;
    sel = (i + shown.length) % shown.length;
    Array.prototype.forEach.call(list.children, function (li, n) { li.setAttribute('aria-selected', n === sel ? 'true' : 'false'); });
    var cur = list.children[sel];
    input.setAttribute('aria-activedescendant', cur.id);
    if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    if (!desktop.matches) return;
    closePop(false); hideTip();
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

  /* ── Global shortcuts ──────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (!desktop.matches) return;
    if (e.key === 'Escape') {
      if (palOpen()) { e.preventDefault(); closePalette(); }
      else if (popOpen()) { e.preventDefault(); closePop(true); }
      return;
    }
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    var t = e.target;
    var typing = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]') && !pal.contains(t);
    if (typing) return; // never hijack Ctrl+B / Ctrl+K while someone is typing an answer
    var k = String(e.key).toLowerCase();
    if (k === 'k') { e.preventDefault(); if (palOpen()) closePalette(); else openPalette(); }
    else if (k === 'b') { e.preventDefault(); setCollapsed(!isCollapsed(), true); }
  });

  /* ── Desktop / mobile switch ───────────────────────────────────────── */
  function syncMode() {
    if (desktop.matches) {
      acc.setAttribute('role', 'button');
      acc.setAttribute('tabindex', '0');
      acc.setAttribute('aria-haspopup', 'menu');
      acc.setAttribute('aria-label', 'Account menu');
      acc.setAttribute('aria-expanded', popOpen() ? 'true' : 'false');
    } else {
      ['role', 'tabindex', 'aria-haspopup', 'aria-label', 'aria-expanded'].forEach(function (a) { acc.removeAttribute(a); });
      closePop(false); closePalette(); hideTip();
    }
  }
  onChange(desktop, syncMode);
  syncMode();
})();
