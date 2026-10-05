/* assets/js/teacher/teacher_desktop_settings.js
   Teacher settings for desktops and tablets (min-width: 769px). Load it AFTER teacher_mobile_settings.js.

   - Replaces the desktop layout of Settings and adds Change Password. On phones it hands straight back to
     teacher_mobile_settings.js, so nothing there changes.
   - One page with a left sub-navigation (Profile, Password, Notifications, Sign out). Change password is an inline
     form. Quick decisions (sign out, remove photo, help) are centred dialogs.
   - Reuses what the page already has: triggerTopNavUpload() + upload_teacher_profile.php for new photos,
     upload_profile.php for removing one, requestTeacherPush(), logout.php. New: change_password.php.

   Optional, set before or after this file loads (both are read when the page opens):
     window.ISKOOL_TEACHER  = { name, email, initials };   // read from the page's DOM when missing
     window.ISKOOL_SETTINGS = { sendResetUrl: 'auth/password/send_reset_link.php' };  // that path is the default */
(function () {
  'use strict';
  if (window.__tdsLoaded) return;
  window.__tdsLoaded = true;

  function isDesktop() { return window.innerWidth > 768; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function csrf() { try { return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : ''; } catch (e) { return ''; } }
  function resetUrl() { return (window.ISKOOL_SETTINGS || {}).sendResetUrl || 'auth/password/send_reset_link.php'; }

  /* ── Icons (inline, stroke) ─────────────────────────────────────────── */
  var P = {
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A16.8 16.8 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  function ico(n, cls) { return '<svg class="ds-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + '</svg>'; }

  /* ── Who is this ────────────────────────────────────────────────────── */
  function who() {
    var b = window.ISKOOL_TEACHER || {};
    var n = document.querySelector('.sidebar .teacher-name') || document.querySelector('.teacher-name');
    var m = document.querySelector('.sidebar .teacher-email') || document.querySelector('.teacher-email');
    var i = document.querySelector('.sidebar .profile-picture-wrapper .initials-avatar');
    var name = b.name || (n ? n.textContent.trim() : '');
    // With a photo set there is no initials element in the page, so fall back to the name (first + last word)
    var parts = name.split(/\s+/).filter(Boolean);
    var fromName = parts.length ? (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase() : '';
    return {
      name: name,
      email: b.email || (m ? m.textContent.trim() : ''),
      initials: b.initials || (i ? i.textContent.trim() : '') || fromName || '??'
    };
  }
  function avatarSrc() { var i = document.querySelector('.sidebar .profile-picture-wrapper img.teacher-avatar'); return i ? i.src : ''; }
  function avatarFace() { var s = avatarSrc(); return s ? '<img src="' + esc(s) + '" alt="">' : esc(who().initials); }

  /* ── Page plumbing ──────────────────────────────────────────────────── */
  var curPane = 'profile';

  function stage() {
    var f = $('mainFrame'), a = $('api-content-area');
    if (f) f.style.display = 'none';
    if (a) { a.style.display = 'block'; a.scrollTop = 0; }
    return a;
  }

  /* ── Dialogs and toast ──────────────────────────────────────────────── */
  var dlg = null, restoreFocus = null, onKey = null;
  function openDialog(o) {
    closeDialog(true);
    restoreFocus = document.activeElement;
    var w = document.createElement('div');
    w.className = 'ds-ov';
    w.innerHTML = '<div class="ds-dl" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h3>' + esc(o.title) + '</h3>' +
      (o.text ? '<p class="ds-dl-p">' + esc(o.text) + '</p>' : '') + (o.html || '') +
      '<div class="ds-dl-a">' + o.actions.map(function (a) { return '<button type="button" class="ds-b ' + (a.cls || '') + '" data-k="' + a.k + '">' + esc(a.label) + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(w);
    var el = w.querySelector('.ds-dl');
    dlg = w;
    w.addEventListener('mousedown', function (e) { if (e.target === w) closeDialog(); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var keep = o.on && o.on(b.getAttribute('data-k')) === false;
      if (!keep) closeDialog();
    });
    onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
      if (e.key !== 'Tab') return;
      var f = el.querySelectorAll('button'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('on'); }); });
    var first = el.querySelector('button'); if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 40);
  }
  function closeDialog(now) {
    if (!dlg) return;
    var w = dlg; dlg = null;
    document.removeEventListener('keydown', onKey);
    w.classList.remove('on');
    var done = function () { if (w.parentNode) w.parentNode.removeChild(w); };
    if (now) done(); else setTimeout(done, 180);
    if (restoreFocus && restoreFocus.focus) { try { restoreFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  var toastEl = null, toastT = null;
  function toast(msg, bad) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ds-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'ds-toast' + (bad ? ' is-bad' : '');
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, bad ? 3600 : 2400);
  }

  /* ── Photo, sign out, help ──────────────────────────────────────────── */
  function pickPhoto() {
    if (typeof window.triggerTopNavUpload === 'function') window.triggerTopNavUpload();
    else toast('Photo upload isn\u2019t available right now', true);
  }
  function refreshAvatar() {
    var f = document.querySelector('.ds-av-face'); if (f) f.innerHTML = avatarFace();
    var r = $('dsRm'); if (r) r.hidden = !avatarSrc();
  }
  function removeDialog() {
    openDialog({
      title: 'Remove your profile photo?', text: 'Your initials will be shown instead.',
      actions: [{ k: 'no', label: 'Cancel', cls: 'is-q' }, { k: 'go', label: 'Remove photo', cls: 'is-d' }],
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
        refreshAvatar(); toast('Photo removed');
      })
      .catch(function () { toast('Connection problem. Try again.', true); });
  }
  function signOutDialog() {
    openDialog({
      title: 'Sign out of iSkool?', text: 'You\u2019ll need your email and password to sign back in.',
      actions: [{ k: 'no', label: 'Cancel', cls: 'is-q' }, { k: 'go', label: 'Sign out', cls: 'is-d' }],
      on: function (k) { if (k === 'go') { try { sessionStorage.removeItem('lastTeacherPage'); } catch (e) {} window.location.href = 'logout.php'; return false; } }
    });
  }
  function helpDialog() {
    openDialog({
      title: 'Not getting alerts?',
      html: '<div class="ds-steps">' +
        '<h4>iPhone</h4><ol><li>Open iSkool in <b>Safari</b> (alerts only work there on iPhone).</li><li>Tap Share, then <b>Add to Home Screen</b>.</li><li>Open iSkool from your home screen and choose <b>Sync notifications</b>.</li><li>Choose <b>Allow</b> on the pop-up.</li></ol>' +
        '<h4>Android</h4><ol><li>Open iSkool in Chrome and open the menu (\u22EE).</li><li>Choose <b>Add to Home Screen</b>.</li><li>Open it from your home screen, then choose <b>Sync notifications</b>.</li><li>Choose <b>Allow</b> when asked.</li></ol>' +
        '<h4>Computer browsers</h4><ol><li>Choose <b>Sync notifications</b> and <b>Allow</b> when your browser asks.</li><li>If you blocked them before, switch notifications back on in your browser\u2019s site settings for iSkool, then sync again.</li></ol>' +
        '</div>',
      actions: [{ k: 'ok', label: 'Done', cls: 'is-p' }]
    });
  }
  function pushState() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return { t: 'Not available', c: '' };
    var p = Notification.permission;
    return p === 'granted' ? { t: 'On', c: 'ds-ok' } : p === 'denied' ? { t: 'Blocked', c: 'ds-warn' } : { t: 'Not set up', c: 'ds-warn' };
  }
  function showPush() { var s = pushState(), v = $('dsPushVal'); if (v) { v.textContent = s.t; v.className = 'ds-rv ' + (s.c || ''); } }
  function syncPush() {
    // Unavailable or blocked: the steps help more than an error pop-up
    var go = window.requestTeacherPush;
    if (typeof go !== 'function' || pushState().t === 'Not available' || ('Notification' in window && Notification.permission === 'denied')) { helpDialog(); return; }
    Promise.resolve(go()).catch(function () {}).then(showPush);
  }

  /* ── Change password ────────────────────────────────────────────────── */
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
  function pwField(id, label, auto, extra) {
    return '<div class="ds-f" data-f="' + id + '"><label for="' + id + '">' + label + '</label><div class="ds-pw"><input id="' + id + '" type="password" autocomplete="' + auto + '" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="72">' +
      '<button type="button" class="ds-eye" data-eye="' + id + '" aria-label="Show password" aria-pressed="false">' + ico('eye') + '</button></div>' + (extra || '') + '<p class="ds-err" id="' + id + '_e" role="alert"></p></div>';
  }
  function passwordPane() {
    var meter = '<div class="ds-meter" id="dsMeter" data-s="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="ds-meter-l" id="dsMeterL"></div>';
    return '<section class="ds-pane" data-pane="security" hidden><div class="ds-gt is-first">Change password</div><div class="ds-card ds-pwgrid"><div class="ds-pwform">' +
      '<div class="ds-okb" id="dsPwOk" role="status" hidden>Password updated. Use it the next time you sign in.</div>' +
      '<div class="ds-banner" id="dsPwBn" role="alert" hidden></div>' +
      pwField('ds_cur', 'Current password', 'current-password') + pwField('ds_new', 'New password', 'new-password', meter) + pwField('ds_con', 'Confirm new password', 'new-password') +
      '<div class="ds-row"><button type="button" class="ds-link" data-go="forgot" id="dsForgot">Forgot your password?</button><span class="ds-sp"></span><button type="button" class="ds-b is-p" id="dsPwGo">Update password</button></div></div>' +
      '<div><p class="ds-ckt">Your new password needs</p><ul class="ds-checks" id="dsChecks">' +
        '<li data-c="len"><span class="ds-dot">' + ico('check') + '</span>At least 8 characters</li>' +
        '<li data-c="diff"><span class="ds-dot">' + ico('check') + '</span>Different from your current password</li>' +
        '<li data-c="match"><span class="ds-dot">' + ico('check') + '</span>Both new passwords match</li></ul>' +
        '<p class="ds-foot" style="margin-left:0">Devices that were set to stay signed in will ask for your new password next time.</p></div>' +
      '</div></section>';
  }
  function forgotDialog() {
    var email = who().email, url = resetUrl(); if (!email || !url) return;
    openDialog({
      title: 'Email you a reset link?', text: 'We\u2019ll send a link to ' + email + '. It works for one hour.',
      actions: [{ k: 'no', label: 'Cancel', cls: 'is-q' }, { k: 'go', label: 'Send reset link', cls: 'is-p' }],
      on: function (k) {
        if (k !== 'go') return;
        fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: new URLSearchParams({ email: email, csrf_token: csrf() }) })
          .then(function (r) { return r.json(); }).then(function (d) { toast(d && d.success ? 'Check your email for the reset link' : ((d && d.message) || 'Couldn\u2019t send the link'), !(d && d.success)); })
          .catch(function () { toast('Connection problem. Try again.', true); });
      }
    });
  }
  function wirePassword() {
    var cur = $('ds_cur'), nw = $('ds_new'), con = $('ds_con'), go = $('dsPwGo'), bn = $('dsPwBn'), ok = $('dsPwOk');
    function banner(msg) { bn.hidden = !msg; bn.textContent = msg || ''; }
    function fieldErr(id, msg) { var fe = $(id).closest('.ds-f'); fe.classList.toggle('is-bad', !!msg); $(id + '_e').textContent = msg || ''; $(id).setAttribute('aria-invalid', msg ? 'true' : 'false'); }
    function state() { var a = cur.value, b = nw.value, c = con.value; return { len: b.length >= 8, diff: b.length > 0 && b !== a, match: b.length > 0 && b === c }; }
    function update() {
      var s = state();
      $('dsMeter').setAttribute('data-s', nw.value ? score(nw.value) : 0);
      $('dsMeterL').textContent = nw.value ? scoreLabel(nw.value) : '';
      [].forEach.call($('dsChecks').children, function (li) { li.classList.toggle('ok', !!s[li.getAttribute('data-c')]); });
    }
    [cur, nw, con].forEach(function (el) { el.addEventListener('input', function () { fieldErr(el.id, ''); banner(''); ok.hidden = true; update(); }); });
    con.addEventListener('blur', function () { if (con.value && nw.value && con.value !== nw.value) fieldErr('ds_con', 'The passwords don\u2019t match.'); });
    [cur, nw, con].forEach(function (el) { el.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); }); });
    go.addEventListener('click', function () {
      if (go.disabled) return;
      var a = cur.value, b = nw.value, c = con.value, good = true;
      if (!a) { fieldErr('ds_cur', 'Enter your current password.'); good = false; }
      if (b.length < 8) { fieldErr('ds_new', b ? 'Use at least 8 characters.' : 'Enter a new password.'); good = false; }
      else if (b === a) { fieldErr('ds_new', 'Choose a password different from your current one.'); good = false; }
      if (!c || c !== b) { fieldErr('ds_con', c ? 'The passwords don\u2019t match.' : 'Confirm your new password.'); good = false; }
      if (!good) { var bad = document.querySelector('.ds-pwform .ds-f.is-bad input'); if (bad) bad.focus(); return; }
      go.disabled = true; go.innerHTML = '<span class="ds-spin"></span><span>Updating</span>'; banner(''); ok.hidden = true;
      fetch('change_password.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() },
        body: new URLSearchParams({ current_password: a, new_password: b, confirm_password: c, csrf_token: csrf() }) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) {} return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (x) {
          go.disabled = false; go.textContent = 'Update password';
          if (x.d && x.d.success) {
            cur.value = nw.value = con.value = ''; update(); ok.hidden = false; toast('Password updated'); return;
          }
          var d = x.d || {};
          if (d.field === 'current_password') { fieldErr('ds_cur', d.error || 'That password isn\u2019t right.'); var fe = cur.closest('.ds-f'); fe.classList.remove('ds-shake'); void fe.offsetWidth; fe.classList.add('ds-shake'); cur.focus(); cur.select(); }
          else if (d.field === 'new_password') fieldErr('ds_new', d.error);
          else banner(d.error || (x.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : 'Couldn\u2019t update your password. Please try again.'));
        })
        .catch(function () { go.disabled = false; go.textContent = 'Update password'; banner('Connection problem. Check your internet and try again.'); });
    });
  }

  /* ── Shell ──────────────────────────────────────────────────────────── */
  var TABS = [['profile', 'Profile', 'user'], ['security', 'Password', 'lock'], ['notif', 'Notifications', 'bell']];

  function goPane(p) {
    var root = document.querySelector('.ds'); if (!root) return;
    curPane = p;
    root.querySelectorAll('.ds-pane').forEach(function (s) { s.hidden = s.getAttribute('data-pane') !== p; });
    root.querySelectorAll('[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === p;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var panel = root.querySelector('.ds-panel'); if (panel) panel.scrollTop = 0;
    if (p === 'notif') showPush();
  }

  function mount(pane) {
    var area = stage(); if (!area) return;
    curPane = 'profile';
    try { sessionStorage.setItem('lastTeacherPage', 'teacher_settings'); } catch (e) {}
    var w = who(), ps = pushState();
    area.innerHTML =
      '<div class="ds">' +
        '<aside class="ds-rail"><h1 class="ds-title">Settings</h1><nav class="ds-nav" aria-label="Settings">' +
          TABS.map(function (t) { return '<button type="button" class="ds-nv" data-tab="' + t[0] + '">' + ico(t[2]) + '<span>' + t[1] + '</span></button>'; }).join('') +
          '<hr><button type="button" class="ds-nv is-danger" data-go="signout">' + ico('out') + '<span>Sign out</span></button></nav></aside>' +
        '<div class="ds-panel"><div class="ds-wrap">' +
          '<section class="ds-pane" data-pane="profile">' +
            '<div class="ds-card ds-prof"><span class="ds-av"><span class="ds-av-face">' + avatarFace() + '</span></span>' +
              '<div class="ds-prof-t"><b>' + esc(w.name) + '</b><span>' + esc(w.email) + '</span></div>' +
              '<button type="button" class="ds-b" data-go="photo">Change photo</button>' +
              '<button type="button" class="ds-b is-t" data-go="removephoto" id="dsRm"' + (avatarSrc() ? '' : ' hidden') + '>Remove</button></div>' +
            '<div class="ds-gt">Account details</div><div class="ds-card ds-g2">' +
              '<div class="ds-f"><span class="ds-fl">Name</span><input type="text" value="' + esc(w.name) + '" placeholder="Not set" readonly tabindex="-1" aria-label="Name"></div>' +
              '<div class="ds-f"><span class="ds-fl">Email</span><input type="text" value="' + esc(w.email) + '" placeholder="Not set" readonly tabindex="-1" aria-label="Email"></div></div>' +
            '<p class="ds-foot">Your name and email can\u2019t be changed here. Ask your school to update them.</p>' +
          '</section>' +
          passwordPane() +
          '<section class="ds-pane" data-pane="notif" hidden><div class="ds-gt is-first">Notifications</div><div class="ds-card ds-rows">' +
            '<div class="ds-rowx"><span class="ds-rt"><b>Sync notifications</b><span>Fix missing alerts on this device</span></span><span class="ds-rv ' + (ps.c || '') + '" id="dsPushVal">' + esc(ps.t) + '</span><button type="button" class="ds-b" data-go="push">Sync now</button></div>' +
            '<div class="ds-rowx"><span class="ds-rt"><b>Notification help</b><span>Steps for iPhone, Android, and browsers</span></span><button type="button" class="ds-b" data-go="pushhelp">View steps</button></div>' +
          '</div></section>' +
        '</div></div>' +
      '</div>';

    area.querySelector('.ds').addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { goPane(t.getAttribute('data-tab')); return; }
      var eye = e.target.closest('[data-eye]');
      if (eye) {
        var inp = $(eye.getAttribute('data-eye')), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        eye.innerHTML = ico(show ? 'eyeoff' : 'eye'); eye.setAttribute('aria-pressed', show ? 'true' : 'false'); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        return;
      }
      var g = e.target.closest('[data-go]'); if (!g) return;
      var k = g.getAttribute('data-go');
      if (k === 'photo') pickPhoto();
      else if (k === 'removephoto') removeDialog();
      else if (k === 'signout') signOutDialog();
      else if (k === 'push') syncPush();
      else if (k === 'pushhelp') helpDialog();
      else if (k === 'forgot') forgotDialog();
    });
    wirePassword();
    goPane(pane || 'profile');
  }

  // Open the settings page. If it is already on screen, keep it (and anything typed into the password form) and just
  // refresh the avatar, which is what the photo upload flow needs when it calls loadTeacherSettings() afterwards.
  function open(pane) {
    var area = $('api-content-area');
    var mounted = area && area.querySelector('.ds') && window.getComputedStyle(area).display !== 'none';
    if (mounted) { refreshAvatar(); if (pane) goPane(pane); return; }
    mount(pane);
  }

  /* ── Hook into the page ─────────────────────────────────────────────── */
  // teacher_mobile_settings.js has already put an accessor on window for loadTeacherSettings. This puts a second
  // wrapper in front of it: desktop widths get this page, everything else falls through to what was there (the mobile
  // wrapper, which in turn keeps the page's original). Assignments by the page are forwarded to the previous setter so
  // the chain stays intact whatever order the page defines things in.
  function hook(name, desktopFn) {
    var d = Object.getOwnPropertyDescriptor(window, name) || {};
    var prevGet = d.get, prevSet = d.set, prevVal = d.get ? undefined : d.value;
    var wrapper = function () {
      if (isDesktop()) return desktopFn.apply(this, arguments);
      var p = prevGet ? prevGet.call(window) : prevVal;
      return typeof p === 'function' ? p.apply(this, arguments) : undefined;
    };
    try {
      Object.defineProperty(window, name, {
        configurable: true, enumerable: true,
        get: function () { return wrapper; },
        set: function (fn) { if (prevSet) prevSet.call(window, fn); else prevVal = fn; }
      });
    } catch (e) { window[name] = wrapper; }
  }
  hook('loadTeacherSettings', function () { return open('profile'); });

  var prevPassword = window.loadTeacherPassword;
  window.loadTeacherPassword = function () {
    if (isDesktop()) return open('security');
    return typeof prevPassword === 'function' ? prevPassword.apply(this, arguments) : undefined;
  };
})();
