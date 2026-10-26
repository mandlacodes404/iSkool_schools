/*
 * Teacher dashboard: what the phone's Back button does, step by step (the engine is assets/js/shared/back_button.js).
 *
 * Each step is the app's OWN way of going back, run the way a tap would run it, so nothing is closed differently from
 * how the teacher would close it by hand. In this order, the first that applies wins:
 *   1. a drop-down that is open (the class picker)
 *   2. a pop-up that is open: the video player, the calendar and class pop-ups, delete / upload / release confirmations,
 *      the syllabus form, a settings sheet
 *   3. the menu, if it is open
 *   4. a detail page (a quiz, an assignment, ...): the header's back arrow, handleTeacherHeaderBack
 *   5. a page inside Settings: its "Settings" back button
 *   6. any page other than Home: Home
 *   7. Home: "Press Back again to exit"
 *
 * Phones only (the engine checks); the desktop layout is not touched.
 */
(function () {
    'use strict';
    if (!window.iskoolBack) return;

    function visible(el) {
        if (!el || !el.getClientRects().length) return false;
        var style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function firstVisible(selector, root) {
        var all = (root || document).querySelectorAll(selector);
        for (var i = all.length - 1; i >= 0; i--) {       // the last one in the page is the one on top
            if (visible(all[i])) return all[i];
        }
        return null;
    }

    /* 1. ── a drop-down ───────────────────────────────────────────────────────────────────────────────────────── */
    function closeDropdown() {
        if (!document.querySelector('.icp-dropdown.icp-open')) return false;
        // The class picker closes itself on any click outside it.
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    }

    /* 2. ── pop-ups: [root that is showing, the controls inside it that close it, best first] ─────────────────── */
    // "Cancel" comes before the corner "x": in a confirmation (delete, release) it is the choice that never does the
    // thing the pop-up asks about.
    var POPUPS = [
        ['#rsVideoOverlay',        ['.rs-video-overlay-back-btn']],
        ['.mini-cal-modal',        ['.mini-cal-modal-close']],
        ['#fullCalModal',          ['.full-cal-modal-close']],
        ['.teacher-modal-overlay', ['.teacher-modal-cancel', '.teacher-modal-close']],
        ['#sboDrawer',             ['.sbo-form-close-btn']]    // the drawer is removed from the page when closed
    ];
    function closePopup() {
        for (var i = 0; i < POPUPS.length; i++) {
            var root = firstVisible(POPUPS[i][0]);
            if (!root) continue;
            var closer = null;
            for (var j = 0; j < POPUPS[i][1].length && !closer; j++) closer = firstVisible(POPUPS[i][1][j], root);
            if (!closer) continue;                              // nothing to press: leave it to the next step
            closer.click();
            return true;
        }
        // A sheet in the phone's Settings: a tap on its dimmed backdrop closes it.
        var sheet = document.querySelector('.ms-sheet-wrap.on .ms-sheet-bg');
        if (sheet) { sheet.click(); return true; }
        return false;
    }

    /* 3. ── the menu ──────────────────────────────────────────────────────────────────────────────────────────── */
    function closeMenu() {
        if (!document.querySelector('.sidebar.active') || typeof window.toggleSidebar !== 'function') return false;
        window.toggleSidebar(true);
        return true;
    }

    /* 4. ── a detail page: exactly what the header's back arrow does ──────────────────────────────────────────── */
    function backFromDetail() {
        if (!window.teacherHeaderDetailType || typeof window.handleTeacherHeaderBack !== 'function') return false;
        window.handleTeacherHeaderBack();
        return true;
    }

    /* 5. ── a page inside Settings ────────────────────────────────────────────────────────────────────────────── */
    function backInsideSettings() {
        var area = document.getElementById('api-content-area');
        var back = area && firstVisible('.ms-back[data-back]', area);
        if (!back) return false;
        back.click();
        return true;
    }

    /* 6. and 7. ── Home ──────────────────────────────────────────────────────────────────────────────────────── */
    function atHome() {
        var page = null;
        try { page = sessionStorage.getItem('lastTeacherPage'); } catch (e) { /* storage blocked */ }
        return (page || 'teacher_manual') === 'teacher_manual';
    }
    function goHome() {
        if (typeof window.loadTeacherManual === 'function') window.loadTeacherManual();
    }

    window.iskoolBack.init({
        layers: [closeDropdown, closePopup, closeMenu, backFromDetail, backInsideSettings],
        atHome: atHome,
        goHome: goHome,
        exitHint: 'Press Back again to exit'
    });
})();
