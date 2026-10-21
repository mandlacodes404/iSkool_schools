/* assets/js/learner/mobile_settings.js
   Learner settings for phones (max-width: 768px). Load it AFTER mobile_menu.js.

   - Replaces the phone layout of Settings and Personal Information, and adds Change Password.
     On desktop it hands straight back to the original functions, so nothing there changes.
   - Pages push in through the header's own back button (configureHeader detail mode). Quick decisions
     (change photo, remove photo, sign out, discard changes) are bottom sheets.
   - Everything reuses what the page already has: get_learner_profile.php, save_learner_profile.php,
     upload_profile.php, #profileInput, requestIphonePush(), logout.php. New: change_password.php.

   Optional, set before this file loads:
     window.ISKOOL_LEARNER  = { name, email, gender, initials };   // read from the page's DOM when missing
     window.ISKOOL_SETTINGS = { sendResetUrl: 'path/to/send_reset_link.php' };  // shows "Forgot your password?" */
(function () {
  'use strict';
  if (window.__msLoaded) return;
  window.__msLoaded = true;

  // read lazily: learner_dashboard.php sets window.ISKOOL_SETTINGS in an inline script AFTER this file's <script src>,
  // so a one-off read at load time would always see an empty object and hide "Forgot your password?"
  var cfg = { get sendResetUrl() { return (window.ISKOOL_SETTINGS || {}).sendResetUrl || ''; } };
  var boot = window.ISKOOL_LEARNER || {};

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
    lockS: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };
  function ico(n, cls) { return '<svg class="ms-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + '</svg>'; }

  /* ── Who is this ────────────────────────────────────────────────────── */
  function who() {
    var n = document.querySelector('#dmAccount .learner-name') || document.querySelector('.learner-name');
    var m = document.querySelector('#dmAccount .learner-email') || document.querySelector('.learner-email');
    var i = document.querySelector('.profile-picture-wrapper .initials-avatar');
    return {
      name: boot.name || (n ? n.textContent.trim() : ''),
      email: boot.email || (m ? m.textContent.trim() : ''),
      gender: boot.gender || '',
      initials: boot.initials || (i ? i.textContent.trim() : '') || '??'
    };
  }
  function avatarSrc() { var i = document.querySelector('.profile-picture-wrapper img.learner-avatar'); return i ? i.src : ''; }
  function avatarFace() { var s = avatarSrc(); return s ? '<img src="' + esc(s) + '" alt="">' : esc(who().initials); }

  /* ── Page plumbing ──────────────────────────────────────────────────── */
  var profile = null;          // last profile fetched from the server
  var dirtyGuard = null;       // set while the personal-information form has unsaved edits

  function stage() {
    var f = $('mainFrame'), a = $('api-content-area');
    if (f) f.style.display = 'none';
    if (a) { a.style.display = 'block'; a.scrollTop = 0; }
    return a;
  }
  function head(title, detail) {
    var cfgH = { title: title, mode: detail ? 'detail' : 'standard' };
    if (detail) { cfgH.backLabel = 'Settings'; cfgH.backAction = function () { goBack(); }; }
    if (typeof window.configureHeader === 'function') window.configureHeader(cfgH);
  }
  function goBack() {
    if (dirtyGuard && dirtyGuard()) return;
    dirtyGuard = null;
    window.loadLearnerSettings();
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

  /* ── Profile data ───────────────────────────────────────────────────── */
  var REQUIRED = ['date_of_birth', 'id_number', 'address', 'guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_email', 'emergency_contact_name', 'emergency_contact_phone'];
  function missingCount(p) { return REQUIRED.filter(function (k) { return !p || !String(p[k] == null ? '' : p[k]).trim(); }).length; }
  function fetchProfile() {
    return fetch('api/learner/get_learner_profile.php', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.success) { profile = d.profile || {}; return profile; } throw new Error('no profile'); });
  }

  /* ── HOME ───────────────────────────────────────────────────────────── */
  function pushState() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return { t: 'Not available', c: '' };
    var p = Notification.permission;
    return p === 'granted' ? { t: 'On', c: 'ms-ok' } : p === 'denied' ? { t: 'Blocked', c: 'ms-warn' } : { t: 'Not set up', c: 'ms-warn' };
  }
  function row(k, icon, title, sub, val, cls) {
    return '<button type="button" class="ms-r' + (cls ? ' ' + cls : '') + '" data-go="' + k + '">' + ico(icon) +
      '<span class="ms-rt"><b>' + esc(title) + '</b>' + (sub ? '<span' + (k === 'personal' ? ' id="msPersonalSub"' : '') + '>' + esc(sub) + '</span>' : '') + '</span>' +
      (val ? '<span class="ms-rv ' + (val.c || '') + '" id="msVal-' + k + '">' + esc(val.t) + '</span>' : '') +
      (cls === 'is-danger' ? '' : ico('chev', 'ms-chev')) + '</button>';
  }
  function showHome() {
    var area = stage(); if (!area) return;
    dirtyGuard = null;
    try { sessionStorage.setItem('lastLearnerPage', 'learner_settings'); } catch (e) {}
    head('Settings', false);
    if (typeof window.setActive === 'function') window.setActive('learner_settings');
    var w = who(), ps = pushState();
    area.innerHTML =
      '<div class="ms">' +
        '<div class="ms-profile">' +
          '<button type="button" class="ms-av" data-go="photo" aria-label="Change profile photo"><span class="ms-av-face">' + avatarFace() + '</span><span class="ms-cam">' + ico('cam') + '</span></button>' +
          '<button type="button" class="ms-who" data-go="personal"><span class="ms-who-t"><b>' + esc(w.name) + '</b><span>' + esc(w.email) + '</span></span>' + ico('chev') + '</button>' +
        '</div>' +
        '<div class="ms-gt">Account</div>' +
        '<div class="ms-g">' +
          row('personal', 'user', 'Personal information', 'Details, guardian and emergency contacts') +
          row('password', 'lock', 'Change password', 'Keep your account secure') +
        '</div>' +
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
    // how complete is the profile? shown on the row once we know
    (profile ? Promise.resolve(profile) : fetchProfile()).then(function (p) {
      var el = $('msPersonalSub'); if (!el) return;
      var m = missingCount(p);
      if (m > 0) { el.textContent = m + (m === 1 ? ' detail' : ' details') + ' still to add'; el.className = 'ms-warn'; }
      else { el.textContent = 'Up to date'; el.className = 'ms-ok'; }
    }).catch(function () {});
  }
  function homeClick(e) {
    var b = e.target.closest('[data-go]'); if (!b) return;
    var k = b.getAttribute('data-go');
    if (k === 'personal') window.loadLearnerPersonalInfo();
    else if (k === 'password') showPassword();
    else if (k === 'appearance') showAppearance();
    else if (k === 'photo') photoSheet();
    else if (k === 'pushhelp') helpSheet();
    else if (k === 'signout') signOutSheet();
    else if (k === 'push') syncPush();
  }
  function syncPush() {
    // Unavailable (for example iPhone Safari before "Add to Home Screen") or blocked: the steps help more than an error pop-up
    var go = window.requestIphonePush;
    if (typeof go !== 'function' || pushState().t === 'Not available' || ('Notification' in window && Notification.permission === 'denied')) { helpSheet(); return; }
    Promise.resolve(go()).catch(function () {}).then(function () {
      var s = pushState(), v = $('msVal-push'); if (v) { v.textContent = s.t; v.className = 'ms-rv ' + (s.c || ''); }
    });
  }

  /* ── Appearance (light / dark on phones) ───────────────────────────── *
     The choice lives in mobile_theme.js (window.iskoolMobileTheme). If that file isn't loaded the page stays dark. */
  function themeNow() { return window.iskoolMobileTheme ? window.iskoolMobileTheme.get() : 'dark'; }
  function themeLabel() { return themeNow() === 'light' ? 'Light' : 'Dark'; }
  function themeOption(value, title, text, now) {
    var on = value === now;
    return '<button type="button" class="ms-opt' + (on ? ' on' : '') + '" data-theme-choice="' + value + '" aria-pressed="' + on + '">' +
      '<span class="ms-sw ms-sw--' + value + '" aria-hidden="true"><i></i><i></i></span>' +
      '<span class="ms-opt-t"><b>' + title + '</b><span>' + text + '</span></span></button>';
  }
  function showAppearance() {
    var area = stage(); if (!area) return;
    dirtyGuard = null;
    head('Appearance', true);
    var now = themeNow();
    area.innerHTML = '<div class="ms"><h1 class="ms-title">Appearance</h1>' +
      '<p class="ms-note">Choose how iSkool looks on your phone.</p>' +
      '<div class="ms-opts" role="group" aria-label="Theme">' +
        themeOption('light', 'Light', 'Bright, paper-like workspace', now) + themeOption('dark', 'Dark', 'Current iSkool appearance', now) +
      '</div><p class="ms-foot">Your choice is saved on this device.</p></div>';
    area.querySelector('.ms').addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme-choice]'); if (!b) return;
      if (window.iskoolMobileTheme) window.iskoolMobileTheme.set(b.getAttribute('data-theme-choice'));
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
        if (k === 'pick') { var inp = $('profileInput'); if (inp) inp.click(); else toast('Photo upload isn\u2019t available right now', true); }
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
    fetch('upload_profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() }, body: new URLSearchParams({ remove: '1' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.success) {
          if (typeof window.resetAvatarUI === 'function') window.resetAvatarUI(who().initials);
          toast('Photo removed');
          if ($('api-content-area') && document.querySelector('.ms-profile')) showHome();
          else if (document.querySelector('.ms-hero')) { var f = document.querySelector('.ms-hero .ms-av-face'); if (f) f.innerHTML = esc(who().initials); }
        } else toast((d && d.error) || 'Couldn\u2019t remove the photo', true);
      })
      .catch(function () { toast('Connection problem. Try again.', true); });
  }
  function signOutSheet() {
    openSheet({
      label: 'Sign out',
      html: '<p class="ms-sh-t">Sign out of iSkool?</p><p class="ms-sh-p">You\u2019ll need your email and password to sign back in.</p>' + sb('go', '', 'Sign out', 'is-solid') + sb('no', '', 'Cancel', 'is-quiet'),
      on: function (k) { if (k === 'go') { try { sessionStorage.removeItem('lastLearnerPage'); } catch (e) {} window.location.href = 'logout.php'; return false; } }
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

  /* ── PERSONAL INFORMATION ───────────────────────────────────────────── */
  var FIELDS = [
    // key, label, type, attrs
    ['date_of_birth', 'Date of birth', 'date', { autocomplete: 'bday' }],
    ['id_number', 'ID number', 'text', { inputmode: 'numeric', maxlength: 13, placeholder: '13-digit South African ID', autocomplete: 'off' }],
    ['address', 'Address', 'text', { maxlength: 255, placeholder: 'Street, city, province', autocomplete: 'street-address' }],
    ['guardian_name', 'Guardian name', 'text', { maxlength: 100, placeholder: 'Full name', autocomplete: 'off' }],
    ['guardian_relationship', 'Relationship', 'select', {}],
    ['guardian_phone', 'Guardian phone', 'tel', { maxlength: 20, placeholder: 'e.g. 071 234 5678', autocomplete: 'off' }],
    ['guardian_email', 'Guardian email', 'email', { maxlength: 100, placeholder: 'guardian@example.com', autocomplete: 'off', inputmode: 'email' }],
    ['emergency_contact_name', 'Emergency contact name', 'text', { maxlength: 100, placeholder: 'Full name', autocomplete: 'off' }],
    ['emergency_contact_phone', 'Emergency contact phone', 'tel', { maxlength: 20, placeholder: 'e.g. 082 345 6789', autocomplete: 'off' }],
    ['medical_notes', 'Medical notes', 'textarea', { maxlength: 2000, placeholder: 'Allergies, conditions, medication, etc.' }]
  ];
  var RELATIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sister', 'Brother', 'Legal Guardian', 'Other'];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validate(key, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (key === 'id_number' && !/^\d{13}$/.test(v)) return 'An ID number has 13 digits.';
    if ((key === 'guardian_phone' || key === 'emergency_contact_phone') && (!/^[+\d\s()\-]+$/.test(v) || v.replace(/\D/g, '').length < 9)) return 'Enter a phone number with at least 9 digits.';
    if (key === 'guardian_email' && !EMAIL_RE.test(v)) return 'Enter a valid email address.';
    if (key === 'date_of_birth' && new Date(v) > new Date()) return 'Date of birth can\u2019t be in the future.';
    return '';
  }
  function field(def, val) {
    var k = def[0], t = def[2], a = def[3], id = 'ms_' + k, attrs = '';
    Object.keys(a).forEach(function (n) { attrs += ' ' + n + '="' + esc(a[n]) + '"'; });
    var ctl;
    if (t === 'select') ctl = '<select id="' + id + '" name="' + k + '"><option value="">Select relationship</option>' + RELATIONS.map(function (r) { return '<option value="' + r + '"' + (val === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>';
    else if (t === 'textarea') ctl = '<textarea id="' + id + '" name="' + k + '" rows="3"' + attrs + '>' + esc(val) + '</textarea>';
    else ctl = '<input id="' + id + '" name="' + k + '" type="' + t + '" value="' + esc(val) + '"' + attrs + '>';
    return '<div class="ms-f" data-f="' + k + '"><label for="' + id + '">' + esc(def[1]) + (t === 'textarea' ? '<span class="ms-count" id="ms_c_' + k + '"></span>' : '') + '</label>' + ctl + '<p class="ms-err" id="ms_e_' + k + '" role="alert"></p></div>';
  }
  function ro(label, value) { return '<div class="ms-f is-ro"><span class="ms-fl">' + esc(label) + '</span><span class="ms-fv">' + (value ? esc(value) : '<span style="color:#62625f">Not set</span>') + '</span>' + ico('lockS') + '</div>'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function showPersonal() {
    var area = stage(); if (!area) return;
    dirtyGuard = null;
    head('Personal Information', true);
    area.innerHTML = '<div class="ms ms-detail"><h1 class="ms-title">Personal Information</h1>' +
      '<div class="ms-hero"><div class="ms-sk" style="width:84px;height:84px;border-radius:50%"></div></div>' +
      [1, 2, 3].map(function () { return '<div class="ms-gt"><span class="ms-sk" style="display:block;width:90px;height:12px"></span></div><div class="ms-g">' + [1, 2, 3].map(function () { return '<div class="ms-f"><span class="ms-sk" style="display:block;width:110px;height:11px;margin-bottom:9px"></span><span class="ms-sk" style="display:block;width:70%;height:15px"></span></div>'; }).join('') + '</div>'; }).join('') +
      '</div>';
    fetchProfile().catch(function () { return profile || {}; }).then(function (p) { if (document.querySelector('.ms-detail')) renderPersonal(p || {}); });
  }

  function renderPersonal(p) {
    var area = $('api-content-area'), w = who(), orig = {}, els = {};
    FIELDS.forEach(function (d) { orig[d[0]] = p[d[0]] == null ? '' : String(p[d[0]]); });
    var by = {}; FIELDS.forEach(function (d) { by[d[0]] = d; });
    function grp(title, keys, foot) { return '<div class="ms-gt">' + title + '</div><div class="ms-g">' + keys.map(function (k) { return field(by[k], orig[k]); }).join('') + '</div>' + (foot ? '<p class="ms-foot">' + foot + '</p>' : ''); }
    area.innerHTML = '<div class="ms ms-detail"><h1 class="ms-title">Personal Information</h1>' +
      '<div class="ms-banner" id="msBanner" role="alert"></div>' +
      '<div class="ms-hero"><button type="button" class="ms-av" data-go="photo" aria-label="Change profile photo"><span class="ms-av-face">' + avatarFace() + '</span><span class="ms-cam">' + ico('cam') + '</span></button><button type="button" class="ms-link" data-go="photo">Change photo</button></div>' +
      '<div class="ms-gt">About you</div><div class="ms-g">' + ro('Name', w.name) + ro('Email', w.email) + ro('Gender', cap(w.gender)) +
        field(by.date_of_birth, orig.date_of_birth) + field(by.id_number, orig.id_number) + field(by.address, orig.address) + '</div>' +
      '<p class="ms-foot">Name, email and gender can\u2019t be changed here. Ask your school to update them.</p>' +
      grp('Guardian or parent', ['guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_email']) +
      grp('Emergency and medical', ['emergency_contact_name', 'emergency_contact_phone', 'medical_notes'], 'Allergies, conditions or medication your school should know about.') +
      '<div class="ms-spacer"></div><div class="ms-bar"><button type="button" class="ms-btn" id="msSave" disabled>Save changes</button></div></div>';

    FIELDS.forEach(function (d) { els[d[0]] = $('ms_' + d[0]); });
    var save = $('msSave'), bannerEl = $('msBanner');

    function cur(k) { return els[k].value; }
    function dirty() { return FIELDS.some(function (d) { return cur(d[0]).trim() !== orig[d[0]].trim(); }); }
    function setErr(k, msg) {
      var f = els[k].closest('.ms-f'), e = $('ms_e_' + k);
      f.classList.toggle('is-bad', !!msg); e.textContent = msg || '';
      els[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function allValid(show) { var ok = true; FIELDS.forEach(function (d) { var m = validate(d[0], cur(d[0])); if (m) ok = false; if (show) setErr(d[0], m); }); return ok; }
    function refresh() { save.disabled = !(dirty() && allValid(false)); }
    function counter() { var t = els.medical_notes, c = $('ms_c_medical_notes'); if (c) c.textContent = t.value.length > 1500 ? t.value.length + ' / 2000' : ''; }

    FIELDS.forEach(function (d) {
      var k = d[0], el = els[k];
      el.addEventListener('input', function () { if (k === 'id_number') el.value = el.value.replace(/\D/g, '').slice(0, 13); if (el.closest('.ms-f').classList.contains('is-bad')) setErr(k, validate(k, cur(k))); if (k === 'medical_notes') counter(); refresh(); });
      el.addEventListener('change', refresh);
      el.addEventListener('blur', function () { setErr(k, validate(k, cur(k))); });
    });
    counter();

    dirtyGuard = function () {
      if (!dirty()) return false;
      openSheet({
        label: 'Unsaved changes',
        html: '<p class="ms-sh-t">Discard your changes?</p><p class="ms-sh-p">You have edits that haven\u2019t been saved.</p>' + sb('discard', '', 'Discard changes', 'is-solid') + sb('keep', '', 'Keep editing', 'is-quiet'),
        on: function (k) { if (k === 'discard') { dirtyGuard = null; setTimeout(function () { window.loadLearnerSettings(); }, 0); } }
      });
      return true;
    };

    area.querySelector('.ms-hero').addEventListener('click', function (e) { if (e.target.closest('[data-go="photo"]')) photoSheet(); });

    function banner(msg, kind) { bannerEl.className = 'ms-banner' + (msg ? ' on is-' + kind : ''); bannerEl.textContent = msg || ''; if (msg) area.scrollTop = 0; }

    save.addEventListener('click', function () {
      if (!allValid(true)) { var bad = area.querySelector('.ms-f.is-bad input, .ms-f.is-bad select'); if (bad) bad.focus(); return; }
      var payload = new URLSearchParams();
      FIELDS.forEach(function (d) { payload.set(d[0], cur(d[0]).trim()); });
      save.disabled = true; save.innerHTML = '<span class="ms-spin"></span><span>Saving</span>'; banner('', '');
      fetch('api/learner/save_learner_profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: payload })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.success) throw new Error((d && d.error) || 'Save failed');
          FIELDS.forEach(function (x) { orig[x[0]] = cur(x[0]).trim(); });
          profile = Object.assign({}, profile || {}, orig);
          save.textContent = 'Save changes'; refresh(); toast('Saved');
        })
        .catch(function (e) { save.textContent = 'Save changes'; refresh(); banner((e && e.message) || 'Couldn\u2019t save. Check your connection and try again.', 'bad'); });
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
    dirtyGuard = null;
    head('Change Password', true);
    area.innerHTML = '<div class="ms ms-detail"><h1 class="ms-title">Change Password</h1><div id="msPwBody">' +
      '<div class="ms-banner" id="msPwBanner" role="alert"></div>' +
      '<div class="ms-g">' + pwField('ms_cur', 'Current password', 'current-password') + '</div>' +
      (cfg.sendResetUrl ? '<button type="button" class="ms-link" id="msForgot" style="margin:8px 0 0 -2px">Forgot your password?</button>' : '') +
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
          fetch(cfg.sendResetUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: new URLSearchParams({ email: email, csrf_token: csrf() }) })
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
      dirtyGuard = null;
      $('msPwBody').innerHTML = '<div class="ms-done"><div class="ms-done-i">' + ico('shield') + '</div><h2>Password updated</h2><p>Your password has been changed. Use it the next time you sign in.</p></div>' +
        '<div class="ms-spacer"></div><div class="ms-bar"><button type="button" class="ms-btn" id="msDone">Done</button></div>';
      $('msDone').addEventListener('click', function () { window.loadLearnerSettings(); });
      $('api-content-area').scrollTop = 0;
    }
  }

  /* ── Hook into the page ─────────────────────────────────────────────── */
  // learner_dashboard.php defines loadLearnerSettings / loadLearnerPersonalInfo INSIDE its DOMContentLoaded handler,
  // which fires after this file has already run. A plain `window.x = ...` here is therefore overwritten a moment
  // later by the original, and the old screens come back. So instead of assigning, we put an accessor on window:
  // reading it always returns our wrapper, and when the page assigns its original later, the setter just stores
  // it as the desktop fallback. This works whatever order the scripts and DOMContentLoaded run in.
  function hook(name, mobileFn) {
    var orig = window[name];
    var wrapper = function () {
      if (!isMobile()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return mobileFn.apply(this, arguments);
    };
    try {
      Object.defineProperty(window, name, {
        configurable: true, enumerable: true,
        get: function () { return wrapper; },
        set: function (fn) { orig = fn; }
      });
    } catch (e) { window[name] = wrapper; }   // last resort: plain assignment
  }
  hook('loadLearnerSettings', showHome);
  hook('loadLearnerPersonalInfo', showPersonal);
  window.loadLearnerPassword = showPassword;
  // shared with mobile_class.js (the My Class page uses the same sheets and toast)
  window.msUI = { open: openSheet, close: closeSheet, toast: toast, ico: ico };
})();