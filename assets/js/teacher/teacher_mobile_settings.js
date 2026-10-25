/* assets/js/teacher/teacher_mobile_settings.js
   Teacher settings for phones (max-width: 768px). Load it AFTER teacher_mobile_menu.js.

   Same design language as the learner settings and the mobile menu. It replaces the phone layout of
   Settings and adds Change Password; on desktop it hands straight back to the original function.
   - Settings home: profile card (tap the avatar to change the photo), Account, Preferences (Appearance: light or dark,
     see teacher_mobile_theme.js), Notifications, Sign out.
   - Change Password is a full page with its own back row (the teacher page has no header back button),
     because a keyboard and a bottom sheet fight each other on a phone. Quick decisions are bottom sheets.
   - Reuses what the page already has: triggerTopNavUpload() + upload_teacher_profile.php for new photos,
     upload_profile.php for removing one, requestTeacherPush(), logout.php. New: change_password.php.

   Optional, set before this file loads:
     window.ISKOOL_TEACHER  = { name, email, initials };   // read from the page's DOM when missing
     window.ISKOOL_SETTINGS = { sendResetUrl: 'auth/password/send_reset_link.php' };  // that path is the default */
(function () {
  'use strict';
  if (window.__tmsLoaded) return;
  window.__tmsLoaded = true;

  var cfg = window.ISKOOL_SETTINGS || {};
  var boot = window.ISKOOL_TEACHER || {};
  var RESET_URL = cfg.sendResetUrl || 'auth/password/send_reset_link.php';

  function isMobile() { return window.innerWidth <= 768; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function csrf() { try { return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : ''; } catch (e) { return ''; } }

  /* ── Icons (inline, stroke) ─────────────────────────────────────────── */
  var P = {
    chev: '<path d="m9 18 6-6-6-6"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    img: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A16.8 16.8 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    lockS: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };
  function ico(n, cls) { return '<svg class="ms-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + '</svg>'; }

  /* ── Who is this ────────────────────────────────────────────────────── */
  function who() {
    var n = document.querySelector('.sidebar .teacher-name') || document.querySelector('.teacher-name');
    var m = document.querySelector('.sidebar .teacher-email') || document.querySelector('.teacher-email');
    var i = document.querySelector('.sidebar .profile-picture-wrapper .initials-avatar');
    var name = boot.name || (n ? n.textContent.trim() : '');
    // With a photo set there is no initials element in the page, so fall back to the name (first + last word)
    var parts = name.split(/\s+/).filter(Boolean);
    var fromName = parts.length ? (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase() : '';
    return {
      name: name,
      email: boot.email || (m ? m.textContent.trim() : ''),
      initials: boot.initials || (i ? i.textContent.trim() : '') || fromName || '??'
    };
  }
  function avatarSrc() { var i = document.querySelector('.sidebar .profile-picture-wrapper img.teacher-avatar'); return i ? i.src : ''; }
  function avatarFace() { var s = avatarSrc(); return s ? '<img src="' + esc(s) + '" alt="">' : esc(who().initials); }

  /* ── Page plumbing ──────────────────────────────────────────────────── */
  function stage() {
    var f = $('mainFrame'), a = $('api-content-area');
    if (f) f.style.display = 'none';
    if (a) { a.style.display = 'block'; a.scrollTop = 0; }
    return a;
  }
  // The teacher page has no header back button, so detail pages carry their own, pinned under the top nav
  function navRow() {
    return '<div class="ms-nav"><button type="button" class="ms-back" data-back aria-label="Back to Settings">' + ico('chev', 'ms-back-i') + '<span>Settings</span></button></div>';
  }

  /* ── Sheets and toast ───────────────────────────────────────────────── */
  var sheet = null, restoreFocus = null;
  function openSheet(o) {
    closeSheet(true);
    restoreFocus = document.activeElement;
    var w = document.createElement('div');
    w.className = 'ms-sheet-wrap';
    w.innerHTML = '<div class="ms-sheet-bg"></div><div class="ms-sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.label || '') + '">' + o.html + '</div>';
    document.body.appendChild(w);
    document.documentElement.classList.add('ms-sheet-open');
    var el = w.querySelector('.ms-sheet');
    sheet = { w: w, el: el };
    w.querySelector('.ms-sheet-bg').addEventListener('click', function () { closeSheet(); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      var keep = o.on && o.on(b.getAttribute('data-k'), b) === false;
      if (!keep) closeSheet();
    });
    // drag down to dismiss
    var y0 = null, dy = 0;
    el.addEventListener('touchstart', function (e) { if (el.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { el.classList.add('is-drag'); el.style.transform = 'translate3d(0,' + dy + 'px,0)'; }
    }, { passive: true });
    el.addEventListener('touchend', function () {
      if (y0 == null) return;
      el.classList.remove('is-drag'); el.style.transform = '';
      var close = dy > 90; y0 = null; dy = 0;
      if (close) closeSheet();
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('on'); }); });
    var first = el.querySelector('.ms-sh-b'); if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function closeSheet(now) {
    if (!sheet) return;
    var s = sheet; sheet = null;
    s.w.classList.remove('on');
    document.documentElement.classList.remove('ms-sheet-open');
    var done = function () { if (s.w.parentNode) s.w.parentNode.removeChild(s.w); };
    if (now) done(); else setTimeout(done, 300);
    if (restoreFocus && restoreFocus.focus) { try { restoreFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  var toastEl = null, toastT = null;
  function toast(msg, bad) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ms-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'ms-toast' + (bad ? ' is-bad' : '');
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, bad ? 3600 : 2400);
  }
  function sb(k, icon, label, cls) { return '<button type="button" class="ms-sh-b' + (cls ? ' ' + cls : '') + '" data-k="' + k + '">' + (icon ? ico(icon) : '') + '<span>' + esc(label) + '</span></button>'; }

  /* ── HOME ───────────────────────────────────────────────────────────── */
  function pushState() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return { t: 'Not available', c: '' };
    var p = Notification.permission;
    return p === 'granted' ? { t: 'On', c: 'ms-ok' } : p === 'denied' ? { t: 'Blocked', c: 'ms-warn' } : { t: 'Not set up', c: 'ms-warn' };
  }
  function row(k, icon, title, sub, val, cls) {
    return '<button type="button" class="ms-r' + (cls ? ' ' + cls : '') + '" data-go="' + k + '">' + ico(icon) +
      '<span class="ms-rt"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span>' +
      (val ? '<span class="ms-rv ' + (val.c || '') + '" id="msVal-' + k + '">' + esc(val.t) + '</span>' : '') +
      (cls === 'is-danger' ? '' : ico('chev', 'ms-chev')) + '</button>';
  }
  function showHome() {
    var area = stage(); if (!area) return;
    try { sessionStorage.setItem('lastTeacherPage', 'teacher_settings'); } catch (e) {}
    var w = who(), ps = pushState();
    area.innerHTML =
      '<div class="ms">' +
        '<h1 class="ms-title">Settings</h1>' +
        '<div class="ms-profile">' +
          '<button type="button" class="ms-av" data-go="photo" aria-label="Change profile photo"><span class="ms-av-face">' + avatarFace() + '</span><span class="ms-cam">' + ico('cam') + '</span></button>' +
          '<div class="ms-who"><span class="ms-who-t"><b>' + esc(w.name) + '</b><span>' + esc(w.email) + '</span></span></div>' +
        '</div>' +
        '<div class="ms-gt">Account</div>' +
        '<div class="ms-g">' + row('password', 'lock', 'Change password', 'Keep your account secure') + '</div>' +
        '<div class="ms-gt">Preferences</div>' +
        '<div class="ms-g">' + row('appearance', 'contrast', 'Appearance', 'Light or dark', { t: themeLabel() }) + '</div>' +
        '<div class="ms-gt">Notifications</div>' +
        '<div class="ms-g">' +
          row('push', 'bell', 'Sync notifications', 'Fix missing alerts', ps) +
          row('pushhelp', 'help', 'Notification help', 'Steps for iPhone, Android and browsers') +
        '</div>' +
        '<div class="ms-gt"></div>' +
        '<div class="ms-g">' + row('signout', 'out', 'Sign out', 'Log out of your account', null, 'is-danger') + '</div>' +
      '</div>';
    area.querySelector('.ms').addEventListener('click', homeClick);
  }
  function homeClick(e) {
    var b = e.target.closest('[data-go]'); if (!b) return;
    var k = b.getAttribute('data-go');
    if (k === 'password') showPassword();
    else if (k === 'appearance') showAppearance();
    else if (k === 'photo') photoSheet();
    else if (k === 'pushhelp') helpSheet();
    else if (k === 'signout') signOutSheet();
    else if (k === 'push') syncPush();
  }
  function syncPush() {
    // Unavailable (for example iPhone Safari before "Add to Home Screen") or blocked: the steps help more than an error pop-up
    var go = window.requestTeacherPush;
    if (typeof go !== 'function' || pushState().t === 'Not available' || ('Notification' in window && Notification.permission === 'denied')) { helpSheet(); return; }
    Promise.resolve(go()).catch(function () {}).then(function () {
      var s = pushState(), v = $('msVal-push'); if (v) { v.textContent = s.t; v.className = 'ms-rv ' + (s.c || ''); }
    });
  }

  /* ── Appearance (light / dark on phones) ───────────────────────────── *
     The choice lives in teacher_mobile_theme.js (window.iskoolTeacherMobileTheme). If that file isn't loaded the app stays dark. */
  function themeNow() { return window.iskoolTeacherMobileTheme ? window.iskoolTeacherMobileTheme.get() : 'dark'; }
  function themeLabel() { return themeNow() === 'light' ? 'Light' : 'Dark'; }
  function themeButton(value, title, now) {
    var on = value === now;
    return '<button type="button" class="ms-tb' + (on ? ' on' : '') + '" data-theme-choice="' + value + '" aria-pressed="' + on + '" aria-label="' + title + '" title="' + title + '">' +
      ico(value === 'light' ? 'sun' : 'moon') + '</button>';
  }
  function showAppearance() {
    var area = stage(); if (!area) return;
    var now = themeNow();
    // Not an .ms-detail page: there is no save bar here, so the bottom nav stays where it is.
    area.innerHTML = '<div class="ms">' + navRow() + '<h1 class="ms-title">Appearance</h1>' +
      '<p class="ms-note">Choose how iSkool looks on your phone.</p>' +
      '<div class="ms-g"><div class="ms-r ms-r--static"><span class="ms-rt"><b>Phone theme</b><span>Your choice is saved on this device.</span></span>' +
        '<div class="ms-toggle" role="group" aria-label="Phone theme">' +
          themeButton('light', 'Light', now) + themeButton('dark', 'Dark', now) +
        '</div></div></div></div>';
    area.querySelector('.ms').addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { showHome(); return; }
      var b = e.target.closest('[data-theme-choice]'); if (!b) return;
      if (window.iskoolTeacherMobileTheme) window.iskoolTeacherMobileTheme.set(b.getAttribute('data-theme-choice'));
      area.querySelectorAll('[data-theme-choice]').forEach(function (n) {
        n.classList.toggle('on', n === b); n.setAttribute('aria-pressed', String(n === b));
      });
    });
  }

  /* ── Sheets used by the settings pages ──────────────────────────────── */
  function photoSheet() {
    var has = !!avatarSrc();
    openSheet({
      label: 'Profile photo',
      html: '<p class="ms-sh-t">Profile photo</p>' + sb('pick', 'img', has ? 'Choose a new photo' : 'Choose a photo') + (has ? sb('remove', 'trash', 'Remove photo', 'is-danger') : ''),
      on: function (k) {
        if (k === 'pick') { if (typeof window.triggerTopNavUpload === 'function') window.triggerTopNavUpload(); else toast('Photo upload isn\u2019t available right now', true); }
        if (k === 'remove') { setTimeout(removeSheet, 320); }
      }
    });
  }
  function removeSheet() {
    openSheet({
      label: 'Remove photo',
      html: '<p class="ms-sh-t">Remove your profile photo?</p><p class="ms-sh-p">Your initials will be shown instead.</p>' + sb('go', '', 'Remove photo', 'is-solid') + sb('no', '', 'Cancel', 'is-quiet'),
      on: function (k) { if (k === 'go') removePhoto(); }
    });
  }
  function removePhoto() {
    fetch('upload_profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: 'remove=1' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!(d && d.success)) { toast((d && d.error) || 'Couldn\u2019t remove the photo', true); return; }
        // same clean-up the page's own remove does: top nav avatar + sidebar avatar back to initials
        var ini = who().initials, top = $('topNavAvatar');
        if (top) top.innerHTML = '<span class="initials-sm">' + esc(ini) + '</span>';
        var wrap = document.querySelector('.sidebar .profile-picture-wrapper');
        if (wrap) {
          var img = wrap.querySelector('img.teacher-avatar'); if (img) img.remove();
          if (!wrap.querySelector('.initials-avatar')) {
            var dv = document.createElement('div'); dv.className = 'initials-avatar teacher-avatar'; dv.textContent = ini;
            wrap.insertBefore(dv, wrap.querySelector('#teacherProfileInput'));
          }
        }
        toast('Photo removed');
        if (document.querySelector('.ms-profile')) showHome();
      })
      .catch(function () { toast('Connection problem. Try again.', true); });
  }
  function signOutSheet() {
    openSheet({
      label: 'Sign out',
      html: '<p class="ms-sh-t">Sign out of iSkool?</p><p class="ms-sh-p">You\u2019ll need your email and password to sign back in.</p>' + sb('go', '', 'Sign out', 'is-solid') + sb('no', '', 'Cancel', 'is-quiet'),
      on: function (k) { if (k === 'go') { try { sessionStorage.removeItem('lastTeacherPage'); } catch (e) {} window.location.href = 'logout.php'; return false; } }
    });
  }
  function helpSheet() {
    openSheet({
      label: 'Notification help',
      html: '<p class="ms-sh-t">Not getting alerts?</p><div class="ms-steps">' +
        '<h4>iPhone</h4><ol><li>Open iSkool in <b>Safari</b> (alerts only work there on iPhone).</li><li>Tap Share, then <b>Add to Home Screen</b>.</li><li>Open iSkool from your home screen and tap <b>Sync notifications</b>.</li><li>Choose <b>Allow</b> on the pop-up.</li></ol>' +
        '<h4>Android</h4><ol><li>Open iSkool in Chrome and tap the menu (\u22EE).</li><li>Choose <b>Add to Home Screen</b>.</li><li>Open it from your home screen, then tap <b>Sync notifications</b>.</li><li>Choose <b>Allow</b> when asked.</li></ol>' +
        '<h4>If you blocked them before</h4><ol><li>Open your browser or phone settings for iSkool and switch notifications back on, then tap <b>Sync notifications</b>.</li></ol>' +
        '</div>' + sb('ok', '', 'Done', 'is-quiet')
    });
  }

  /* ── CHANGE PASSWORD ────────────────────────────────────────────────── */
  var COMMON = ['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'iloveyou', '11111111', '00000000', 'abcd1234', 'iskool123', 'letmein1'];
  function score(pw) {
    if (pw.length < 8) return 1;
    if (COMMON.indexOf(pw.toLowerCase()) !== -1) return 1;
    var n = 1;
    if (pw.length >= 12) n++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) n++; else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) n += 0.5;
    return Math.max(1, Math.min(4, Math.floor(n)));
  }
  function scoreLabel(pw) { return pw.length < 8 ? 'Too short' : COMMON.indexOf(pw.toLowerCase()) !== -1 ? 'Too common, easy to guess' : ['', 'Weak', 'Fair', 'Good', 'Strong'][score(pw)]; }
  function pwField(id, label, auto) {
    return '<div class="ms-f" data-f="' + id + '"><label for="' + id + '">' + label + '</label><div class="ms-pw"><input id="' + id + '" type="password" autocomplete="' + auto + '" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="72">' +
      '<button type="button" class="ms-eye" data-eye="' + id + '" aria-label="Show password" aria-pressed="false">' + ico('eye') + '</button></div><p class="ms-err" id="' + id + '_e" role="alert"></p></div>';
  }
  function showPassword() {
    var area = stage(); if (!area) return;
    area.innerHTML = '<div class="ms ms-detail">' + navRow() + '<h1 class="ms-title">Change Password</h1><div id="msPwBody">' +
      '<div class="ms-banner" id="msPwBanner" role="alert"></div>' +
      '<div class="ms-g">' + pwField('ms_cur', 'Current password', 'current-password') + '</div>' +
      (RESET_URL ? '<button type="button" class="ms-link" id="msForgot" style="margin:8px 0 0 -2px">Forgot your password?</button>' : '') +
      '<div class="ms-gt">New password</div><div class="ms-g">' + pwField('ms_new', 'New password', 'new-password') + pwField('ms_con', 'Confirm new password', 'new-password') + '</div>' +
      '<div class="ms-meter" id="msMeter" data-s="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="ms-meter-l" id="msMeterL"></div>' +
      '<ul class="ms-checks" id="msChecks">' +
        '<li data-c="len"><span class="ms-dot">' + ico('check') + '</span>At least 8 characters</li>' +
        '<li data-c="diff"><span class="ms-dot">' + ico('check') + '</span>Different from your current password</li>' +
        '<li data-c="match"><span class="ms-dot">' + ico('check') + '</span>Both new passwords match</li></ul>' +
      '<p class="ms-foot">Devices that were set to stay signed in will ask for your new password next time.</p>' +
      '<div class="ms-spacer"></div><div class="ms-bar"><button type="button" class="ms-btn" id="msPwGo" disabled>Update password</button></div></div></div>';

    var cur = $('ms_cur'), nw = $('ms_new'), con = $('ms_con'), go = $('msPwGo'), bn = $('msPwBanner');
    function banner(msg, kind) { bn.className = 'ms-banner' + (msg ? ' on is-' + kind : ''); bn.textContent = msg || ''; if (msg) $('api-content-area').scrollTop = 0; }
    function fieldErr(id, msg) { var f = $(id).closest('.ms-f'); f.classList.toggle('is-bad', !!msg); $(id + '_e').textContent = msg || ''; $(id).setAttribute('aria-invalid', msg ? 'true' : 'false'); }
    function state() {
      var a = cur.value, b = nw.value, c = con.value;
      return { len: b.length >= 8, diff: b.length > 0 && b !== a, match: b.length > 0 && b === c, filled: a.length > 0 };
    }
    function update() {
      var s = state();
      $('msMeter').setAttribute('data-s', nw.value ? score(nw.value) : 0);
      $('msMeterL').textContent = nw.value ? scoreLabel(nw.value) : '';
      [].forEach.call($('msChecks').children, function (li) { li.classList.toggle('ok', !!s[li.getAttribute('data-c')]); });
      go.disabled = !(s.len && s.diff && s.match && s.filled);
    }
    [cur, nw, con].forEach(function (el) { el.addEventListener('input', function () { fieldErr(el.id, ''); banner('', ''); update(); }); });
    con.addEventListener('blur', function () { if (con.value && nw.value && con.value !== nw.value) fieldErr('ms_con', 'The passwords don\u2019t match.'); });
    area.querySelector('.ms-detail').addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { showHome(); return; }
      var eye = e.target.closest('[data-eye]');
      if (eye) {
        var inp = $(eye.getAttribute('data-eye')), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        eye.innerHTML = ico(show ? 'eyeoff' : 'eye'); eye.setAttribute('aria-pressed', show ? 'true' : 'false'); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      }
      if (e.target.closest('#msForgot')) sendReset();
    });
    function sendReset() {
      var email = who().email; if (!email) return;
      openSheet({
        label: 'Reset by email',
        html: '<p class="ms-sh-t">Email me a reset link?</p><p class="ms-sh-p">We\u2019ll send a link to ' + esc(email) + '. It works for one hour.</p>' + sb('go', 'mail', 'Send reset link', 'is-primary') + sb('no', '', 'Cancel', 'is-quiet'),
        on: function (k) {
          if (k !== 'go') return;
          fetch(RESET_URL, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: new URLSearchParams({ email: email, csrf_token: csrf() }) })
            .then(function (r) { return r.json(); }).then(function (d) { toast(d && d.success ? 'Check your email for the reset link' : ((d && d.message) || 'Couldn\u2019t send the link'), !(d && d.success)); })
            .catch(function () { toast('Connection problem. Try again.', true); });
        }
      });
    }
    go.addEventListener('click', function () {
      var s = state(); if (!(s.len && s.diff && s.match && s.filled)) return;
      go.disabled = true; go.innerHTML = '<span class="ms-spin"></span><span>Updating</span>'; banner('', '');
      fetch('change_password.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() },
        body: new URLSearchParams({ current_password: cur.value, new_password: nw.value, confirm_password: con.value, csrf_token: csrf() }) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) {} return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (x) {
          if (x.d && x.d.success) { done(); return; }
          go.textContent = 'Update password';
          var d = x.d || {};
          if (d.field === 'current_password') { fieldErr('ms_cur', d.error || 'That password isn\u2019t right.'); var f = cur.closest('.ms-f'); f.classList.remove('ms-shake'); void f.offsetWidth; f.classList.add('ms-shake'); cur.focus(); cur.select(); }
          else if (d.field === 'new_password') fieldErr('ms_new', d.error);
          else banner(d.error || (x.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : 'Couldn\u2019t update your password. Please try again.'), 'bad');
          update();
        })
        .catch(function () { go.textContent = 'Update password'; update(); banner('Connection problem. Check your internet and try again.', 'bad'); });
    });
    function done() {
        $('msPwBody').innerHTML = '<div class="ms-done"><div class="ms-done-i">' + ico('shield') + '</div><h2>Password updated</h2><p>Your password has been changed. Use it the next time you sign in.</p></div>' +
        '<div class="ms-spacer"></div><div class="ms-bar"><button type="button" class="ms-btn" id="msDone">Done</button></div>';
      $('msDone').addEventListener('click', function () { showHome(); });
      $('api-content-area').scrollTop = 0;
    }
  }

  /* ── Hook into the page ─────────────────────────────────────────────── */
  // teacher_dashboard.php may define loadTeacherSettings after this file has run (inside a DOMContentLoaded handler),
  // and a plain assignment here would then be overwritten by the original. So put an accessor on window instead:
  // reading it always returns our wrapper, and when the page assigns its original later, the setter just keeps it
  // as the desktop fallback. This works whatever order the scripts run in.
  function hook(name, mobileFn) {
    var orig = window[name];
    var wrapper = function () {
      if (!isMobile()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return mobileFn.apply(this, arguments);
    };
    try {
      Object.defineProperty(window, name, { configurable: true, enumerable: true, get: function () { return wrapper; }, set: function (fn) { orig = fn; } });
    } catch (e) { window[name] = wrapper; }
  }
  hook('loadTeacherSettings', showHome);
  window.loadTeacherPassword = showPassword;
})();
