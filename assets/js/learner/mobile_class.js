/* assets/js/learner/mobile_class.js
   Learner "My Class" page on phones: the "Parent link" bottom sheet.
   Load it AFTER mobile_settings.js (it uses that file's sheet and toast through window.msUI) and AFTER
   parent_invite.js (window.parentInvite: list, create, remove, copy).
   Phones only (max-width: 768px).

   The learner creates a one-use invite link and sends it to their parent however they like. The sheet also
   lists the parents already linked, each with a Remove button (tap twice to confirm). */
(function () {
  if (window.__mcLoaded) return;
  window.__mcLoaded = true;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function sheetHtml() {
    return '<p class="ms-sh-t">Parent link</p>' +
      '<p class="ms-sh-p">Create a link and send it to your parent yourself. It works once and expires after 48 hours.</p>' +
      '<div class="mc-list" data-mc-list></div>' +
      '<div class="mc-result" data-mc-result hidden>' +
        '<input class="mc-link" data-mc-link type="text" readonly aria-label="Invite link">' +
        '<button type="button" class="ms-sh-b is-primary" data-k="copy"><span>Copy link</span></button>' +
      '</div>' +
      '<button type="button" class="ms-sh-b is-primary" data-k="create"><span>Create invite link</span></button>' +
      '<button type="button" class="ms-sh-b is-quiet" data-k="no"><span>Close</span></button>';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#myClassContent [data-mc="manage"]');
    var pi = window.parentInvite;
    if (!btn || window.innerWidth > 768 || !window.msUI || !pi) return;
    var ui = window.msUI;
    var busy = false;
    var copyTimer = null;

    ui.open({
      label: 'Parent link',
      html: sheetHtml(),
      on: function (k, b) {
        var sheet = b.closest('.ms-sheet');

        if (k === 'create') {
          if (busy) return false;
          busy = true;
          var label = b.querySelector('span');
          b.disabled = true; label.textContent = 'Creating…';
          pi.create().then(function (d) {
            busy = false; b.disabled = false;
            if (!d.success) { label.textContent = 'Create invite link'; ui.toast(d.error || 'Couldn’t create the link', true); return; }
            var box = sheet.querySelector('[data-mc-result]');
            var input = sheet.querySelector('[data-mc-link]');
            input.value = pi.linkFor(d.code);
            box.hidden = false;
            label.textContent = 'Create another link';
            b.classList.remove('is-primary');
          });
          return false;
        }

        if (k === 'copy') {
          var input = sheet.querySelector('[data-mc-link]');
          var copyLabel = b.querySelector('span');
          pi.copy(input.value, input).then(function (ok) {
            ui.toast(ok ? 'Link copied' : 'Couldn’t copy. Press and hold the link to copy it.', !ok);
            if (ok) {
              copyLabel.textContent = 'Copied';
              clearTimeout(copyTimer);
              copyTimer = setTimeout(function () { copyLabel.textContent = 'Copy link'; }, 2000);
            }
          });
          return false;
        }

        if (k === 'rm') {
          if (busy) return false;
          // first tap asks, second tap removes
          if (!b.hasAttribute('data-sure')) {
            b.setAttribute('data-sure', '1');
            b.textContent = 'Tap again to remove';
            setTimeout(function () {
              if (b.isConnected && b.hasAttribute('data-sure')) { b.removeAttribute('data-sure'); b.textContent = 'Remove'; }
            }, 4000);
            return false;
          }
          busy = true; b.disabled = true;
          pi.remove(b.getAttribute('data-id')).then(function (d) {
            busy = false;
            if (d.success) { ui.toast('Parent removed'); refresh(sheet); }
            else { b.disabled = false; b.removeAttribute('data-sure'); b.textContent = 'Remove'; ui.toast(d.error || 'Couldn’t remove the parent', true); }
          });
          return false;
        }
        // "no" falls through and closes the sheet
      }
    });

    var sheetEl = document.querySelector('.ms-sheet');
    if (sheetEl) refresh(sheetEl);

    function refresh(sheet) {
      var list = sheet.querySelector('[data-mc-list]');
      if (!list) return;
      pi.list().then(function (d) {
        if (!d.success) { ui.toast(d.error || 'Couldn’t load your parent links', true); return; }
        list.innerHTML = '';
        d.data.parents.forEach(function (p) {
          var row = el('div', 'mc-row');
          row.appendChild(el('span', 'mc-av', pi.initials(p.name)));
          row.appendChild(el('span', 'mc-nm', p.name));
          var rm = el('button', 'mc-rm', 'Remove');
          rm.type = 'button';
          rm.setAttribute('data-k', 'rm');
          rm.setAttribute('data-id', String(p.id));
          rm.setAttribute('aria-label', 'Remove ' + p.name);
          row.appendChild(rm);
          list.appendChild(row);
        });
        pi.applyCount(d.data.parents.length);
      });
    }
  });
})();
