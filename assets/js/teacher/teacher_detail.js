/* assets/js/teacher/teacher_detail.js
   Small helpers for the teacher app's phone detail pages (quiz, integrity report, grades, syllabus, evaluation, assignment).
   The look is teacher_detail.css; this file only builds the repeated pieces of markup so the five page scripts
   (quizzes.js, grades.js, sbo.js, evaluations.js, assignments.js) draw them the same way. Load it before those scripts.

   Every value that comes from a teacher or a learner goes through tdUi.esc(). */
(function () {
    'use strict';

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Lucide line icons, the same set the learner menus use
    var PATHS = {
        lock:    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        unlock:  '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
        shield:  '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
        trash:   '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
        chev:    '<polyline points="9 18 15 12 9 6"/>',
        x:       '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        check:   '<polyline points="20 6 9 17 4 12"/>',
        spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
        clip:     '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
    };

    function icon(name, cls, stroke) {
        return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (stroke || 1.75) +
            '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
    }

    // tone: green | orange | blue | red | grey, or '' for the neutral pill
    function pill(text, tone, attrs) {
        return '<span class="td-pill' + (tone ? ' td-pill--' + tone : '') + '"' + (attrs ? ' ' + attrs : '') + '>' + esc(text) + '</span>';
    }

    function initials(name) {
        var words = String(name == null ? '' : name).trim().split(/\s+/).filter(Boolean);
        return words.slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    }

    // Line breaks in a teacher's note are kept; everything else is plain text
    function multiline(text) {
        return esc(text).replace(/\r?\n/g, '<br>');
    }

    // One "Delete …?" bottom sheet. It reuses the ids and class names the page's delete handlers already look for.
    //   id           overlay id the handlers open and close (display flex / none)
    //   closeCall    JS called when the scrim or Cancel is tapped
    //   title / body heading and the sentence under it (body is HTML: escape what you put in it)
    //   confirmAttrs attributes on the red button (a click handler or a data-action)
    //   confirmClass an extra class on the red button when the page's handler selects it by class
    //   errorId      optional empty line under the text for an error message
    function confirmSheet(o) {
        return '<div id="' + o.id + '" class="td-overlay" style="display:none;" onclick="if(event.target===this){' + o.closeCall + '}">' +
            '<section class="td-sheet" role="alertdialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
            '<div class="td-grab"></div>' +
            '<div class="td-sheet-head"><div><h1>' + esc(o.title) + '</h1></div></div>' +
            '<p class="td-ptext">' + o.body + '</p>' +
            (o.errorId ? '<div id="' + o.errorId + '" class="td-err" style="display:none;"></div>' : '') +
            '<div class="td-actions">' +
            '<button type="button" class="td-btn td-btn--soft" ' + (o.cancelAttrs || ('onclick="' + o.closeCall + '"')) + '>Cancel</button>' +
            '<button type="button" class="td-btn td-btn--danger' + (o.confirmClass ? ' ' + o.confirmClass : '') + '" ' + o.confirmAttrs + '>' + esc(o.confirmLabel || 'Delete') + '</button>' +
            '</div></section></div>';
    }

    // Just the shapes inside an icon, for swapping one icon for another in place (lock <-> unlock)
    function iconInner(name) { return PATHS[name] || ''; }

    window.tdUi = { esc: esc, icon: icon, iconInner: iconInner, pill: pill, initials: initials, multiline: multiline, confirmSheet: confirmSheet };
}());
