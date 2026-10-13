/* assets/js/learner/mobile_class.js
   Learner "My Class" page on phones: the "Manage parent link" bottom sheet.
   Load it AFTER mobile_settings.js (it uses that file's sheet and toast through window.msUI).
   Phones only (max-width: 768px). Saving posts to link_parent.php exactly like the old inline form did,
   but updates the page in place instead of reloading it. */
(function () {
  if (window.__mcLoaded) return;
  window.__mcLoaded = true;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function csrf() { try { return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : ''; } catch (e) { return ''; } }
  function initials(n) {
    var p = String(n || '').trim().split(/\s+/);
    return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase() || '?';
  }

  var busy = false;

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#myClassContent [data-mc="manage"]');
    if (!btn || window.innerWidth > 768 || !window.msUI) return;
    var group = btn.closest('.lmc-parent');
    var classId = btn.getAttribute('data-class') || '0';
    var current = group.getAttribute('data-current') || '';
    var parents = [];
    try { parents = JSON.parse(btn.getAttribute('data-parents') || '[]'); } catch (x) {}
    var ui = window.msUI;

    if (!parents.length) {
      ui.open({
        label: 'Parent link',
        html: '<p class="ms-sh-t">Parent link</p><p class="ms-sh-p">No parents in class yet.</p>' +
          '<button type="button" class="ms-sh-b is-quiet" data-k="no"><span>Close</span></button>'
      });
      return;
    }

    var selected = current;
    var list = parents.map(function (p) {
      return '<button type="button" class="ms-sh-b mc-opt' + (p.email === current ? ' is-on' : '') + '" data-k="pick" data-email="' + esc(p.email) + '">' +
        '<span class="mc-av">' + esc(initials(p.name)) + '</span><span class="mc-nm">' + esc(p.name) + '</span>' + ui.ico('check', 'mc-tick') + '</button>';
    }).join('');

    ui.open({
      label: 'Parent link',
      html: '<p class="ms-sh-t">Parent link</p><p class="ms-sh-p">Choose the parent who can see your progress.</p>' +
        '<div class="mc-list">' + list + '</div>' +
        '<button type="button" class="ms-sh-b is-primary" data-k="save" disabled><span>Save</span></button>' +
        '<button type="button" class="ms-sh-b is-quiet" data-k="no"><span>Cancel</span></button>',
      on: function (k, b) {
        var sheet = b.closest('.ms-sheet');
        var save = sheet.querySelector('[data-k="save"]');
        if (k === 'pick') {
          if (busy) return false;
          selected = b.getAttribute('data-email');
          Array.prototype.forEach.call(sheet.querySelectorAll('.mc-opt'), function (o) { o.classList.toggle('is-on', o === b); });
          save.disabled = !selected || selected === current;
          return false;
        }
        if (k === 'save') {
          if (busy || !selected || selected === current) return false;
          busy = true; save.disabled = true; save.firstChild.textContent = 'Saving\u2026';
          fetch('link_parent.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf() },
            body: 'parent_email=' + encodeURIComponent(selected) + '&class_id=' + encodeURIComponent(classId)
          })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              busy = false;
              if (d && d.success) {
                group.setAttribute('data-linked', '1');
                group.setAttribute('data-current', selected);
                ui.close();
                ui.toast(current ? 'Parent link updated' : 'Parent linked');
              } else {
                save.disabled = false; save.firstChild.textContent = 'Save';
                ui.toast((d && d.error) || 'Couldn\u2019t save the parent link', true);
              }
            })
            .catch(function () {
              busy = false; save.disabled = false; save.firstChild.textContent = 'Save';
              ui.toast('Connection problem. Try again.', true);
            });
          return false;
        }
      }
    });
  });
})();
