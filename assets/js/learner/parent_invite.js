/* assets/js/learner/parent_invite.js
   Parent invite links on the learner "My Class" page.

   - window.parentInvite holds the shared calls (list, create, remove, copy) and applyCount(), which updates the
     "Linked / Not linked" status on the page. The phone sheet in mobile_class.js uses the same object.
   - The desktop panel (#parentDropdown) is wired at the bottom of this file.

   A learner creates a one-use link (api/learner/create_parent_invite.php) and sends it to their parent in
   whatever way they like. Nothing is sent from here. The raw code is only ever held in the open panel. */
(function () {
  'use strict';
  if (window.parentInvite) return;

  function csrf() {
    try { return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : ''; } catch (e) { return ''; }
  }

  /* All three endpoints answer with JSON, also on errors ({ success:false, error }). */
  function request(url, method, params) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() } };
    if (method === 'POST') {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      var body = new URLSearchParams(params || {});
      body.set('csrf_token', csrf());
      opts.body = body;
    }
    return fetch(url, opts)
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          return d || { success: false, error: 'Something went wrong. Please try again.' };
        });
      })
      .catch(function () {
        return { success: false, error: 'Connection problem. Check your internet and try again.' };
      });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function byId(id) { return document.getElementById(id); }

  function initials(name) {
    var p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() || '?';
  }

  /* The link the parent opens, resolved from the current page so it lands on this school's own address. */
  function linkFor(code) {
    return new URL('parent_link.php?code=' + encodeURIComponent(code), window.location.href).href;
  }

  /* Copies text. Uses the clipboard API where the browser allows it, otherwise selects the input and copies. */
  function copy(text, input) {
    function fallback() {
      try {
        var field = input || document.createElement('input');
        if (!input) {
          field.value = text;
          field.setAttribute('readonly', '');
          field.style.position = 'fixed';
          field.style.opacity = '0';
          document.body.appendChild(field);
        }
        field.focus();
        field.select();
        field.setSelectionRange(0, text.length);
        var ok = document.execCommand('copy');
        if (!input) document.body.removeChild(field);
        return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* ── Status text on the page (desktop panel + phone row) ───────────────────────────────────────────── */
  var PEOPLE_ICON = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
  var TICK_ICON = '<path d="M20 6L9 17l-5-5"/>';

  function applyCount(count) {
    var linked = count > 0;
    var sub = !linked ? 'No parent linked to your account yet'
      : count === 1 ? 'A parent can see your progress'
      : count + ' parents can see your progress';

    // phones: the page only flips data-linked, the rows are already in the markup
    Array.prototype.forEach.call(document.querySelectorAll('#myClassContent .lmc-parent'), function (g) {
      g.setAttribute('data-linked', linked ? '1' : '0');
    });

    // desktop
    var icon = byId('lmcParentIcon');
    if (icon) {
      icon.classList.toggle('lmc-parent-icon--linked', linked);
      var svg = icon.querySelector('svg');
      if (svg) {
        svg.setAttribute('stroke', linked ? '#68d391' : '#63b3ed');
        svg.innerHTML = linked ? TICK_ICON : PEOPLE_ICON;
      }
    }
    var name = byId('lmcParentName'); if (name) name.textContent = linked ? 'Linked' : 'Not linked';
    var subEl = byId('lmcParentSub'); if (subEl) subEl.textContent = sub;
    var bm = byId('lmcParentBtnM'); if (bm) bm.textContent = linked ? 'Manage Parent Link' : 'Link My Parent';
    var bd = byId('lmcParentBtnD'); if (bd) bd.textContent = linked ? 'Manage' : 'Link my parent';
    var rail = byId('lmcRailParent');
    if (rail) {
      rail.textContent = linked ? 'Linked' : 'Not linked';
      rail.classList.toggle('lmc-ok', linked);
    }
  }

  window.parentInvite = {
    list:    function () { return request('api/learner/get_parent_links.php', 'GET'); },
    create:  function () { return request('api/learner/create_parent_invite.php', 'POST'); },
    remove:  function (id) { return request('api/learner/remove_parent_link.php', 'POST', { id: id }); },
    linkFor: linkFor,
    copy:    copy,
    initials: initials,
    applyCount: applyCount
  };

  /* ── Desktop panel ─────────────────────────────────────────────────────────────────────────────────── */
  function initDesktop() {
    var panel = byId('parentDropdown');
    if (!panel) return;

    var listEl = byId('lmcParentLinked');
    var createBtn = byId('lmcInviteBtn');
    var result = byId('lmcInviteResult');
    var linkInput = byId('lmcInviteLink');
    var copyBtn = byId('lmcCopyBtn');
    var note = byId('lmcInviteNote');
    var msg = byId('lmcParentMsg');
    var busy = false;
    var copyTimer = null;

    function say(text, bad) {
      msg.textContent = text || '';
      msg.classList.toggle('is-bad', !!bad);
    }

    function clearInvite() {
      linkInput.value = '';
      result.style.display = 'none';
      copyBtn.textContent = 'Copy link';
    }

    function renderParents(parents) {
      listEl.innerHTML = '';
      if (!parents.length) return;
      listEl.appendChild(el('div', 'lmc-form-label', 'Linked parents'));
      parents.forEach(function (p) {
        var row = el('div', 'lmc-parent-row');
        row.appendChild(el('span', 'lmc-parent-name', p.name));
        var rm = el('button', 'lmc-parent-remove', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + p.name);
        rm.addEventListener('click', function () {
          if (busy) return;
          if (!window.confirm('Remove ' + p.name + '? They will no longer see your progress.')) return;
          busy = true; rm.disabled = true; say('');
          window.parentInvite.remove(p.id).then(function (d) {
            busy = false;
            if (d.success) { refresh(); } else { rm.disabled = false; say(d.error, true); }
          });
        });
        row.appendChild(rm);
        listEl.appendChild(row);
      });
    }

    function refresh() {
      return window.parentInvite.list().then(function (d) {
        if (!d.success) { say(d.error, true); return; }
        renderParents(d.data.parents);
        applyCount(d.data.parents.length);
      });
    }

    window.toggleParentDropdown = function () {
      var show = panel.style.display !== 'block';
      panel.style.display = show ? 'block' : 'none';
      if (show) { say(''); refresh(); } else { clearInvite(); }
    };

    createBtn.addEventListener('click', function () {
      if (busy) return;
      busy = true; createBtn.disabled = true; createBtn.textContent = 'Creating…'; say('');
      window.parentInvite.create().then(function (d) {
        busy = false; createBtn.disabled = false; createBtn.textContent = 'Create invite link';
        if (!d.success) { say(d.error, true); return; }
        linkInput.value = linkFor(d.code);
        note.textContent = 'Works once and expires in ' + d.expires_in_hours + ' hours. Send it to your parent yourself.';
        copyBtn.textContent = 'Copy link';
        result.style.display = 'block';
        linkInput.focus();
        linkInput.select();
      });
    });

    copyBtn.addEventListener('click', function () {
      copy(linkInput.value, linkInput).then(function (ok) {
        copyBtn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
        if (!ok) linkInput.select();
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 2000);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDesktop);
  } else {
    initDesktop();
  }
})();
