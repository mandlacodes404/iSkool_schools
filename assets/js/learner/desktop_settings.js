/* assets/js/learner/desktop_settings.js
   Learner settings for desktops and tablets (min-width: 769px). Load it AFTER mobile_settings.js.

   - Opens Settings as a centred modal over the dashboard (Claude-style), the same modal the teachers have, and adds
     Change Password. The page behind it is left exactly as it was: no page swap, nothing hidden. On phones it hands
     straight back to mobile_settings.js, so nothing there changes.
   - Left rail with a search box and sub-navigation (Profile, Personal info, Password, Notifications, Sign out).
     Personal info (date of birth, ID, address, guardian, emergency contact, medical notes) and Change password are
     forms inside the modal. Quick decisions (sign out, remove photo, discard changes, help) are small confirm dialogs
     above it. An unsaved-changes bar sticks to the bottom of Personal info once something is edited.
   - Close with the X, the Escape key, or a click on the dimmed backdrop. If Personal info has unsaved edits, closing
     asks first.
   - Reuses what the page already has: api/learner/get_learner_profile.php, api/learner/save_learner_profile.php,
     #profileInput for new photos, upload_profile.php for removing one, resetAvatarUI(), requestIphonePush(),
     logout.php, change_password.php.

   Optional, set before or after this file loads (both are read when the modal opens):
     window.ISKOOL_LEARNER  = { name, email, gender, initials };   // read from the page's DOM when missing
     window.ISKOOL_SETTINGS = { sendResetUrl: 'auth/password/send_reset_link.php' };  // shows "Forgot your password?" */
(function () {
  'use strict';
  if (window.__dsLoaded) return;
  window.__dsLoaded = true;

  function isDesktop() { return window.innerWidth > 768; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function csrf() { try { return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : ''; } catch (e) { return ''; } }
  function resetUrl() { return (window.ISKOOL_SETTINGS || {}).sendResetUrl || ''; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── Icons (inline, stroke) ─────────────────────────────────────────── */
  var P = {
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><path d="M16 10h2"/><path d="M16 14h2"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A16.8 16.8 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };
  function ico(n, cls) { return '<svg class="ds-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + '</svg>'; }

  /* ── Who is this ────────────────────────────────────────────────────── */
  function who() {
    var b = window.ISKOOL_LEARNER || {};
    var n = document.querySelector('#dmAccount .learner-name') || document.querySelector('.learner-name');
    var m = document.querySelector('#dmAccount .learner-email') || document.querySelector('.learner-email');
    var i = document.querySelector('.profile-picture-wrapper .initials-avatar');
    var name = b.name || (n ? n.textContent.trim() : '');
    // With a photo set there is no initials element in the page, so fall back to the name (first + last word)
    var parts = name.split(/\s+/).filter(Boolean);
    var fromName = parts.length ? (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase() : '';
    return {
      name: name,
      email: b.email || (m ? m.textContent.trim() : ''),
      gender: b.gender || '',
      initials: b.initials || (i ? i.textContent.trim() : '') || fromName || '??'
    };
  }
  function avatarSrc() { var i = document.querySelector('.profile-picture-wrapper img.learner-avatar'); return i ? i.src : ''; }
  function avatarFace() { var s = avatarSrc(); return s ? '<img src="' + esc(s) + '" alt="">' : esc(who().initials); }

  /* ── State ──────────────────────────────────────────────────────────── */
  var modal = null, modalKey = null, modalFrom = null, curPane = 'profile';
  var profile = null;        // last profile fetched from the server
  var formDirty = null;      // set while the Personal info form is on screen
  var formReset = null;
  var loadSeq = 0;           // so a slow, older profile request can't overwrite a newer one

  /* ── Desktop theme (light / dark) ───────────────────────────────────── *
     Saved in localStorage and set on <html data-learner-theme>. Dark is the default; only "light" is ever written to
     the attribute's CSS. For no flash on load, also set it from a tiny inline script in the page <head>. */
  function themeKey() { return window.ISKOOL_LEARNER_THEME_KEY || 'iskoolLearnerDesktopTheme'; }
  function currentTheme() {
    return document.documentElement.dataset.learnerTheme === 'light' ? 'light' : 'dark';
  }
  function applyTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.learnerTheme = theme;
    try { localStorage.setItem(themeKey(), theme); } catch (e) {}
    // The login page (shown before anyone signs in) reads the theme last used on this browser from here.
    try { localStorage.setItem('iskoolDesktopThemeLastUsed', theme); } catch (e) {}
    if (modal) {
      modal.querySelectorAll('[data-theme-choice]').forEach(function (button) {
        var selected = button.getAttribute('data-theme-choice') === theme;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
  }
  // Fallback if the <head> script isn't there: restore the saved choice as soon as this file runs.
  try {
    var savedTheme = localStorage.getItem(themeKey());
    if (!document.documentElement.dataset.learnerTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      document.documentElement.dataset.learnerTheme = savedTheme;
    }
  } catch (e) {}

  function fetchProfile() {
    return fetch('api/learner/get_learner_profile.php', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.success) { profile = d.profile || {}; return profile; } throw new Error('no profile'); });
  }

  /* ── Confirm dialogs and toast ──────────────────────────────────────── */
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
  function pickPhoto() { var inp = $('profileInput'); if (inp) inp.click(); else toast('Photo upload isn\u2019t available right now', true); }
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
    fetch('upload_profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() }, body: new URLSearchParams({ remove: '1' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.success) {
          // the page's own clean-up: top nav avatar + sidebar avatar back to initials
          if (typeof window.resetAvatarUI === 'function') window.resetAvatarUI(who().initials);
          refreshAvatar(); toast('Photo removed');
        } else toast((d && d.error) || 'Couldn\u2019t remove the photo', true);
      })
      .catch(function () { toast('Connection problem. Try again.', true); });
  }
  function signOutDialog() {
    openDialog({
      title: 'Sign out of iSkool?', text: 'You\u2019ll need your email and password to sign back in.',
      actions: [{ k: 'no', label: 'Cancel', cls: 'is-q' }, { k: 'go', label: 'Sign out', cls: 'is-d' }],
      on: function (k) { if (k === 'go') { try { sessionStorage.removeItem('lastLearnerPage'); } catch (e) {} window.location.href = 'logout.php'; return false; } }
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
    var go = window.requestIphonePush;
    if (typeof go !== 'function' || pushState().t === 'Not available' || ('Notification' in window && Notification.permission === 'denied')) { helpDialog(); return; }
    Promise.resolve(go()).catch(function () {}).then(showPush);
  }

  /* ── Personal info form ─────────────────────────────────────────────── */
  var FIELDS = [
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
  function field(def, val, span) {
    var k = def[0], t = def[2], a = def[3], id = 'ds_' + k, attrs = '';
    Object.keys(a).forEach(function (n) { attrs += ' ' + n + '="' + esc(a[n]) + '"'; });
    var ctl;
    if (t === 'select') ctl = '<select id="' + id + '" name="' + k + '"><option value="">Select relationship</option>' + RELATIONS.map(function (r) { return '<option value="' + r + '"' + (val === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>';
    else if (t === 'textarea') ctl = '<textarea id="' + id + '" name="' + k + '" rows="3"' + attrs + '>' + esc(val) + '</textarea>';
    else ctl = '<input id="' + id + '" name="' + k + '" type="' + t + '" value="' + esc(val) + '"' + attrs + '>';
    return '<div class="ds-f' + (span ? ' ds-s2' : '') + '" data-f="' + k + '"><label for="' + id + '">' + esc(def[1]) + (t === 'textarea' ? '<span class="ds-count" id="ds_c_' + k + '"></span>' : '') + '</label>' + ctl + '<p class="ds-err" id="ds_e_' + k + '" role="alert"></p></div>';
  }
  function skel() {
    var box = function (w, h, mb) { return '<span class="ds-sk" style="width:' + w + ';height:' + h + 'px;' + (mb ? 'margin-bottom:' + mb + 'px' : '') + '"></span>'; };
    var grid = '<div class="ds-g2">' + [1, 2, 3, 4].map(function () { return '<div class="ds-f">' + box('90px', 12, 8) + box('100%', 38) + '</div>'; }).join('') + '</div>';
    return grid + '<div style="margin-top:34px">' + box('140px', 17) + '</div>' + grid;
  }
  // The form only ever shows what the server sent. If that failed and there is nothing cached, an empty form that could
  // be saved over real data is worse than no form, so offer a retry instead.
  function loadError() {
    formDirty = null; formReset = null;
    return '<div class="ds-state"><div class="ds-banner" role="alert">Couldn\u2019t load your details. Check your connection and try again.</div><button type="button" class="ds-b" data-go="retry">Try again</button></div>';
  }
  function setGender(p) {
    var g = $('dsGender'); if (!g) return;
    var v = cap(who().gender || (p && p.gender));
    g.textContent = v || 'Not set'; g.title = v;
  }
  function loadProfile() {
    var host = $('dsForms'); if (!host) return;
    var seq = ++loadSeq;
    formDirty = null; formReset = null;
    host.innerHTML = skel();
    fetchProfile().catch(function () { return profile; }).then(function (p) {
      if (seq !== loadSeq || !modal) return;
      setGender(p);
      if (!$('dsForms')) return;
      if (p) renderPersonal(p); else $('dsForms').innerHTML = loadError();
    });
  }

  function renderPersonal(p) {
    var host = $('dsForms'); if (!host) return;
    var orig = {}, els = {}, by = {};
    FIELDS.forEach(function (d) { orig[d[0]] = p[d[0]] == null ? '' : String(p[d[0]]); by[d[0]] = d; });
    function f(k, span) { return field(by[k], orig[k], span); }
    host.innerHTML =
      '<div class="ds-g2">' + f('date_of_birth') + f('id_number') + f('address', true) + '</div>' +
      '<h2 class="ds-h is-2">Guardian or parent</h2><div class="ds-g2">' + f('guardian_name') + f('guardian_relationship') + f('guardian_phone') + f('guardian_email') + '</div>' +
      '<h2 class="ds-h is-2">Emergency and medical</h2><div class="ds-g2">' + f('emergency_contact_name') + f('emergency_contact_phone') + f('medical_notes', true) + '</div>' +
      '<p class="ds-foot">Allergies, conditions or medication your school should know about.</p>' +
      '<div class="ds-bar" id="dsBar" hidden><span class="ds-bar-m" id="dsBarM" role="status">You have unsaved changes</span><span class="ds-sp"></span>' +
        '<button type="button" class="ds-b" id="dsDiscard">Discard</button><button type="button" class="ds-b is-p" id="dsSave">Save changes</button></div>';

    FIELDS.forEach(function (d) { els[d[0]] = $('ds_' + d[0]); });
    var bar = $('dsBar'), msg = $('dsBarM'), save = $('dsSave'), saving = false;

    function cur(k) { return els[k].value; }
    function dirty() { return FIELDS.some(function (d) { return cur(d[0]).trim() !== orig[d[0]].trim(); }); }
    function setErr(k, m) {
      var fe = els[k].closest('.ds-f'), e = $('ds_e_' + k);
      fe.classList.toggle('is-bad', !!m); e.textContent = m || '';
      els[k].setAttribute('aria-invalid', m ? 'true' : 'false');
    }
    function allValid(show) { var ok = true; FIELDS.forEach(function (d) { var m = validate(d[0], cur(d[0])); if (m) ok = false; if (show) setErr(d[0], m); }); return ok; }
    function note(text, bad) { msg.textContent = text; msg.classList.toggle('is-bad', !!bad); }
    function refresh() { if (!saving) note('You have unsaved changes', false); bar.hidden = !dirty() && !saving; }
    function counter() { var t = els.medical_notes, c = $('ds_c_medical_notes'); if (c) c.textContent = t.value.length > 1500 ? t.value.length + ' / 2000' : ''; }

    FIELDS.forEach(function (d) {
      var k = d[0], el = els[k];
      el.addEventListener('input', function () {
        if (k === 'id_number') el.value = el.value.replace(/\D/g, '').slice(0, 13);
        if (el.closest('.ds-f').classList.contains('is-bad')) setErr(k, validate(k, cur(k)));
        if (k === 'medical_notes') counter();
        refresh();
      });
      el.addEventListener('change', refresh);
      el.addEventListener('blur', function () { setErr(k, validate(k, cur(k))); });
    });
    counter();

    formDirty = dirty;
    formReset = function () { FIELDS.forEach(function (d) { els[d[0]].value = orig[d[0]]; setErr(d[0], ''); }); counter(); refresh(); };
    $('dsDiscard').addEventListener('click', formReset);

    save.addEventListener('click', function () {
      if (saving) return;
      if (!allValid(true)) {
        var bad = host.querySelector('.ds-f.is-bad input, .ds-f.is-bad select, .ds-f.is-bad textarea'); if (bad) bad.focus();
        note('Fix the highlighted fields, then save.', true); return;
      }
      var payload = new URLSearchParams();
      FIELDS.forEach(function (d) { payload.set(d[0], cur(d[0]).trim()); });
      saving = true; save.disabled = true; save.innerHTML = '<span class="ds-spin"></span><span>Saving</span>';
      fetch('api/learner/save_learner_profile.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() }, body: payload })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.success) throw new Error((d && d.error) || 'Save failed');
          FIELDS.forEach(function (x) { orig[x[0]] = cur(x[0]).trim(); });
          profile = Object.assign({}, profile || {}, orig);
          saving = false; save.disabled = false; save.textContent = 'Save changes'; refresh(); toast('Changes saved');
        })
        .catch(function (e) {
          saving = false; save.disabled = false; save.textContent = 'Save changes';
          note((e && e.message) || 'Couldn\u2019t save. Check your connection and try again.', true);
        });
    });
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
    return '<section class="ds-pane" data-pane="security" hidden><h2 class="ds-h">Change password</h2><div class="ds-pwgrid"><div class="ds-pwform">' +
      '<div class="ds-okb" id="dsPwOk" role="status" hidden>Password updated. Use it the next time you sign in.</div>' +
      '<div class="ds-banner" id="dsPwBn" role="alert" hidden></div>' +
      pwField('ds_cur', 'Current password', 'current-password') + pwField('ds_new', 'New password', 'new-password', meter) + pwField('ds_con', 'Confirm new password', 'new-password') +
      '<div class="ds-row"><button type="button" class="ds-link" data-go="forgot" id="dsForgot" hidden>Forgot your password?</button><span class="ds-sp"></span><button type="button" class="ds-b is-p" id="dsPwGo">Update password</button></div></div>' +
      '<div><p class="ds-ckt">Your new password needs</p><ul class="ds-checks" id="dsChecks">' +
        '<li data-c="len"><span class="ds-dot">' + ico('check') + '</span>At least 8 characters</li>' +
        '<li data-c="diff"><span class="ds-dot">' + ico('check') + '</span>Different from your current password</li>' +
        '<li data-c="match"><span class="ds-dot">' + ico('check') + '</span>Both new passwords match</li></ul>' +
        '<p class="ds-foot">Devices that were set to stay signed in will ask for your new password next time.</p></div>' +
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
    if (resetUrl()) $('dsForgot').hidden = false;
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

  /* ── Modal ──────────────────────────────────────────────────────────── */
  // [id, label, icon, search words]
  var TABS = [
    ['profile', 'Profile', 'user', 'profile photo picture avatar name email gender account details'],
    ['personal', 'Personal info', 'card', 'personal information date of birth id number address guardian parent relationship emergency contact medical notes allergies phone'],
    ['security', 'Password', 'lock', 'password security change forgot reset'],
    ['notif', 'Notifications', 'bell', 'notifications alerts push sync help iphone android browser'],
    ['appearance', 'Appearance', 'sun', 'appearance theme light dark colour color desktop']
  ];
  var SIGNOUT_KW = 'sign out log out logout leave';

  function appearancePane() {
    var theme = currentTheme();
    function option(value, title) {
      var selected = value === theme;
      return '<button type="button" class="ds-theme-btn' + (selected ? ' on' : '') + '" data-theme-choice="' + value + '" aria-pressed="' + selected + '" aria-label="' + title + '" title="' + title + '">' +
        ico(value === 'light' ? 'sun' : 'moon') + '</button>';
    }
    return '<section class="ds-pane" data-pane="appearance" hidden><h2 class="ds-h">Appearance</h2>' +
      '<p class="ds-foot ds-appearance-note">Choose how iSkool looks on desktop. Phones keep their current colours.</p>' +
      '<div class="ds-list"><div class="ds-r ds-r--appearance"><span class="ds-rt"><b>Desktop theme</b><span>Your choice is saved on this browser.</span></span>' +
      '<div class="ds-theme-toggle" role="group" aria-label="Desktop theme">' +
        option('light', 'Light') + option('dark', 'Dark') +
      '</div></div></div></section>';
  }

  function goPane(p) {
    if (!modal) return;
    curPane = p;
    modal.querySelectorAll('.ds-pane').forEach(function (s) { s.hidden = s.getAttribute('data-pane') !== p; });
    modal.querySelectorAll('[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === p;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var panel = $('dsPanel'); if (panel) panel.scrollTop = 0;
    if (p === 'notif') showPush();
  }

  // Search narrows the rail to the sections whose name or keywords match
  function filterNav(q) {
    if (!modal) return;
    q = (q || '').trim().toLowerCase();
    var any = false;
    modal.querySelectorAll('.ds-rail [data-kw]').forEach(function (b) {
      var hit = !q || (b.getAttribute('data-kw') + ' ' + b.textContent).toLowerCase().indexOf(q) !== -1;
      b.hidden = !hit; if (hit) any = true;
    });
    $('dsGl').hidden = !modal.querySelector('#dsNav [data-kw]:not([hidden])');
    $('dsNone').hidden = any;
  }

  function mount(pane) {
    // a previous modal that is still fading out must not share ids with this one
    [].forEach.call(document.querySelectorAll('.dsm'), function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var from = document.activeElement;
    try { modalFrom = from && from !== document.body && from.matches(':focus-visible') ? from : null; } catch (e) { modalFrom = null; }
    formDirty = null; formReset = null;
    var w = who(), ps = pushState();
    var m = document.createElement('div');
    m.className = 'dsm'; m.id = 'dsModal';
    m.innerHTML =
      '<div class="ds" role="dialog" aria-modal="true" aria-label="Settings" tabindex="-1">' +
        '<aside class="ds-rail">' +
          '<label class="ds-search">' + ico('search') + '<input type="text" id="dsSearch" placeholder="Search" autocomplete="off" spellcheck="false" aria-label="Search settings"></label>' +
          '<div class="ds-gl" id="dsGl">Settings</div>' +
          '<nav class="ds-nav" id="dsNav" aria-label="Settings">' +
            TABS.map(function (t) { return '<button type="button" class="ds-nv" data-tab="' + t[0] + '" data-kw="' + t[3] + '">' + ico(t[2]) + '<span>' + t[1] + '</span></button>'; }).join('') +
          '</nav>' +
          '<p class="ds-none" id="dsNone" hidden>No matches</p>' +
          '<div class="ds-nav-foot"><button type="button" class="ds-nv is-danger" data-go="signout" data-kw="' + SIGNOUT_KW + '">' + ico('out') + '<span>Sign out</span></button></div>' +
        '</aside>' +
        '<div class="ds-panel" id="dsPanel">' +
          '<section class="ds-pane" data-pane="profile">' +
            '<h2 class="ds-h">Profile</h2>' +
            '<div class="ds-list"><div class="ds-r"><span class="ds-av"><span class="ds-av-face">' + avatarFace() + '</span></span>' +
              '<span class="ds-rt"><b>' + esc(w.name) + '</b><span>' + esc(w.email) + '</span></span>' +
              '<button type="button" class="ds-b" data-go="photo">Change photo</button>' +
              '<button type="button" class="ds-b is-t" data-go="removephoto" id="dsRm"' + (avatarSrc() ? '' : ' hidden') + '>Remove</button></div></div>' +
            '<h2 class="ds-h is-2">Account details</h2>' +
            '<div class="ds-list">' +
              '<div class="ds-r"><span class="ds-rt"><b>Name</b></span><span class="ds-rv" title="' + esc(w.name) + '">' + (esc(w.name) || 'Not set') + '</span></div>' +
              '<div class="ds-r"><span class="ds-rt"><b>Email</b></span><span class="ds-rv" title="' + esc(w.email) + '">' + (esc(w.email) || 'Not set') + '</span></div>' +
              '<div class="ds-r"><span class="ds-rt"><b>Gender</b></span><span class="ds-rv" id="dsGender" title="' + esc(cap(w.gender)) + '">' + esc(cap(w.gender)) + '</span></div></div>' +
            '<p class="ds-foot">Your name, email and gender can\u2019t be changed here. Ask your school to update them.</p>' +
          '</section>' +
          '<section class="ds-pane" data-pane="personal" hidden>' +
            '<h2 class="ds-h">Personal information</h2>' +
            '<div id="dsForms"></div>' +
          '</section>' +
          passwordPane() +
          appearancePane() +
          '<section class="ds-pane" data-pane="notif" hidden><h2 class="ds-h">Notifications</h2><div class="ds-list">' +
            '<div class="ds-r"><span class="ds-rt"><b>Sync notifications</b><span>Fix missing alerts on this device</span></span><span class="ds-rv ' + (ps.c || '') + '" id="dsPushVal">' + esc(ps.t) + '</span><button type="button" class="ds-b" data-go="push">Sync now</button></div>' +
            '<div class="ds-r"><span class="ds-rt"><b>Notification help</b><span>Steps for iPhone, Android, and browsers</span></span><button type="button" class="ds-b" data-go="pushhelp">View steps</button></div>' +
          '</div></section>' +
        '</div>' +
        '<button type="button" class="ds-x" data-go="close" aria-label="Close settings">' + ico('x') + '</button>' +
      '</div>';
    document.body.appendChild(m);
    modal = m;
    var root = m.querySelector('.ds');

    m.addEventListener('mousedown', function (e) { if (e.target === m) requestClose(); });
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { goPane(t.getAttribute('data-tab')); return; }
      var themeChoice = e.target.closest('[data-theme-choice]');
      if (themeChoice) { applyTheme(themeChoice.getAttribute('data-theme-choice')); return; }
      var eye = e.target.closest('[data-eye]');
      if (eye) {
        var inp = $(eye.getAttribute('data-eye')), show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        eye.innerHTML = ico(show ? 'eyeoff' : 'eye'); eye.setAttribute('aria-pressed', show ? 'true' : 'false'); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        return;
      }
      var g = e.target.closest('[data-go]'); if (!g) return;
      var k = g.getAttribute('data-go');
      if (k === 'close') requestClose();
      else if (k === 'photo') pickPhoto();
      else if (k === 'removephoto') removeDialog();
      else if (k === 'signout') signOutDialog();
      else if (k === 'push') syncPush();
      else if (k === 'pushhelp') helpDialog();
      else if (k === 'forgot') forgotDialog();
      else if (k === 'retry') loadProfile();
    });

    var search = $('dsSearch');
    search.addEventListener('input', function () { filterNav(search.value); });
    search.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var first = m.querySelector('#dsNav [data-tab]:not([hidden])');
      if (first) { e.preventDefault(); goPane(first.getAttribute('data-tab')); }
    });

    // Escape closes the modal (or first clears the search box). Tab stays inside it. While a confirm dialog is open it owns the keys.
    modalKey = function (e) {
      if (dlg) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.activeElement === search && search.value) { search.value = ''; filterNav(''); } else requestClose();
        return;
      }
      if (e.key !== 'Tab') return;
      var f = [].filter.call(root.querySelectorAll('button, input, select, textarea'), function (n) { return !n.disabled && n.tabIndex >= 0 && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (a === root || !root.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', modalKey);

    wirePassword();
    goPane(pane || 'profile');
    loadProfile();
    requestAnimationFrame(function () { requestAnimationFrame(function () { m.classList.add('on'); }); });
    try { root.focus({ preventScroll: true }); } catch (e) {}
  }

  // X, Escape and the backdrop all come through here: unsaved Personal info edits are confirmed before they are lost
  function requestClose() {
    if (!modal || dlg) return;
    if (formDirty && formDirty()) {
      openDialog({
        title: 'Discard your changes?', text: 'You have edits that haven\u2019t been saved.',
        actions: [{ k: 'keep', label: 'Keep editing', cls: 'is-q' }, { k: 'discard', label: 'Discard changes', cls: 'is-d' }],
        on: function (k) { if (k === 'discard') closeModal(); }
      });
      return;
    }
    closeModal();
  }

  function closeModal(now) {
    if (!modal) return;
    var m = modal; modal = null;
    formDirty = null; formReset = null; loadSeq++;
    document.removeEventListener('keydown', modalKey);
    closeDialog(true);
    m.classList.remove('on');
    var done = function () { if (m.parentNode) m.parentNode.removeChild(m); };
    if (now) done(); else setTimeout(done, 180);
    // Give focus back only when the modal was opened from the keyboard; after a mouse click it would just flash a tooltip or ring
    if (modalFrom && modalFrom.focus) { try { modalFrom.focus({ preventScroll: true }); } catch (e) {} }
    modalFrom = null;
  }

  // Open settings. If the modal is already on screen, keep it (and anything typed into its forms) and just refresh the
  // avatar, which is what the photo upload and remove flows need when they call loadLearnerSettings() afterwards.
  function open(pane) {
    if (modal && document.body.contains(modal)) { refreshAvatar(); if (pane) goPane(pane); return; }
    mount(pane);
  }

  // Shrinking to a phone width while it is open: the modal's styles are desktop-only, so close it
  window.addEventListener('resize', function () { if (modal && !isDesktop()) closeModal(true); });

  /* ── Hook into the page ─────────────────────────────────────────────── */
  // learner_dashboard.php defines loadLearnerSettings / loadLearnerPersonalInfo inside its DOMContentLoaded handler, and
  // mobile_settings.js has already put an accessor on window for both. This puts a second wrapper in front of it:
  // desktop widths get this modal, everything else falls through to what was there (the mobile wrapper, which in turn
  // keeps the page's original). Assignments by the page are forwarded to the previous setter so the chain stays intact
  // whatever order the page defines things in.
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
  hook('loadLearnerSettings', function () { return open('profile'); });
  hook('loadLearnerPersonalInfo', function () { return open('personal'); });

  var prevPassword = window.loadLearnerPassword;
  window.loadLearnerPassword = function () {
    if (isDesktop()) return open('security');
    return typeof prevPassword === 'function' ? prevPassword.apply(this, arguments) : undefined;
  };
})();