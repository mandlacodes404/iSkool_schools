/*
 * Learner dashboard: what the phone's Back button does, step by step (the engine is assets/js/shared/back_button.js).
 *
 * Each step is the app's OWN way of going back, run the way a tap would run it, so nothing is closed differently from
 * how the learner would close it by hand. In this order, the first that applies wins:
 *   1. the account drop-down in the header, if it is open
 *   2. the file viewer (a PDF, a picture) that covers the page
 *   3. a pop-up or sheet that is open: the enlarged school logo, the search, a Settings or "Parent link" sheet, the "Join a class" sheet, the
 *      account sheet, the grade explainers, the progress report and the quiz review, a native dialog
 *   4. the assignment form that is open inside an assignment
 *   5. the menu, if it is open
 *   6. a detail page (an assignment, an announcement, a page inside Settings, ...): the header's back arrow, which is
 *      handleHeaderBack, so the app's own checks (unsaved changes, quiz exit) run exactly as they do for a tap
 *   7. any page other than Home: Home
 *   8. Home: "Press Back again to exit"
 *
 * Quizzes are not part of this page: a quiz opens as a page of its own (take_quiz.php) with its own exit question, and
 * its Back is the phone's normal one.
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

    function call(name) {
        var fn = window[name];
        if (typeof fn !== 'function') return false;
        fn.apply(window, Array.prototype.slice.call(arguments, 1));
        return true;
    }

    /* 1. ── the account drop-down ─────────────────────────────────────────────────────────────────────────────── */
    function closeDropdown() {
        var drop = document.getElementById('learnerAvatarDropdown');
        if (!drop || !drop.classList.contains('open')) return false;
        return call('closeLearnerAvatarDropdown');
    }

    /* 2. ── the file viewer ───────────────────────────────────────────────────────────────────────────────────── */
    function closeViewer() {
        if (!visible(document.getElementById('globalViewer'))) return false;
        return call('closeGlobalViewer');
    }

    /* 3. ── pop-ups and sheets, the one on top first ──────────────────────────────────────────────────────────── */
    function closePopup() {
        // The school logo, enlarged from the top bar: a tap on it closes it.
        var logoPop = document.querySelector('#schoolLogoPop.on');
        if (logoPop) { logoPop.click(); return true; }

        // The phone search.
        var search = document.querySelector('#dmmSearch.on .dmm-s-cancel');
        if (search) { search.click(); return true; }

        // A sheet in Settings or the "Parent link" sheet: a tap on its dimmed backdrop closes it.
        var sheet = document.querySelector('.ms-sheet-wrap.on .ms-sheet-bg');
        if (sheet) { sheet.click(); return true; }

        // "Join a class": on the question "Join this class?", Back is its own "Go back"; otherwise it closes the sheet.
        var join = document.querySelector('#joinSheet.is-open');
        if (join) {
            var goBack = join.querySelector('.jcs-panel.is-confirming .jcs-btn:not(.jcs-btn--go):not([disabled])');
            if (goBack) { goBack.click(); return true; }
            if (window.joinSheet && typeof window.joinSheet.close === 'function') { window.joinSheet.close(); return true; }
        }

        // The account sheet from the menu.
        var account = document.querySelector('#dmmSheetBg.on');
        if (account) { account.click(); return true; }

        // The grade explainers, then the progress report / quiz review sheet underneath them.
        if (document.getElementById('grInfoModal') && call('grCloseInfo')) return true;
        var info = document.getElementById('prInfoModal');
        if (info && info.classList.contains('pr-info-modal-visible') && call('prCloseInfoModal')) return true;
        var report = document.getElementById('prReportModal');
        if (report && report.querySelector('.review-modal-sheet')) return call('closeQuizReviewModal');
        if (report) return call('prBackToGrades');

        // A native dialog (the learner guide).
        var dialog = document.querySelector('dialog[open]');
        if (dialog && typeof dialog.close === 'function') { dialog.close(); return true; }
        return false;
    }

    /* 4. ── the assignment form inside an assignment ──────────────────────────────────────────────────────────── */
    function closeAssignmentForm() {
        var form = firstVisible('.las-submission-form');
        if (!form || !form.id) return false;
        return call('closeLearnerAssignmentInlineForm', form.id);
    }

    /* 5. ── the menu ──────────────────────────────────────────────────────────────────────────────────────────── */
    function closeMenu() {
        if (!document.querySelector('.sidebar.active') || typeof window.toggleSidebar !== 'function') return false;
        window.toggleSidebar(true);
        return true;
    }

    /* 6. ── a detail page: exactly what the header's back arrow does ──────────────────────────────────────────── */
    function backFromDetail() {
        var arrow = document.getElementById('headerBackBtn');
        if (!visible(arrow)) return false;
        arrow.click();                                       // handleHeaderBack: its own checks run as for a tap
        return true;
    }

    /* 7. and 8. ── Home ──────────────────────────────────────────────────────────────────────────────────────── */
    function atHome() {
        var page = null;
        try { page = sessionStorage.getItem('lastLearnerPage'); } catch (e) { /* storage blocked */ }
        page = page || 'partials/manual.html';
        if (page !== 'partials/manual.html' && page !== 'learner_manual.php') return false;
        // "My Class" is a page of its own that does not change the saved page.
        var myClass = document.getElementById('myClassContent');
        return !(myClass && myClass.classList.contains('active'));
    }
    function goHome() {
        if (typeof window.returnToLearnerHome === 'function') window.returnToLearnerHome();
    }

    window.iskoolBack.init({
        layers: [closeDropdown, closeViewer, closePopup, closeAssignmentForm, closeMenu, backFromDetail],
        atHome: atHome,
        goHome: goHome,
        exitHint: 'Press Back again to exit'
    });
})();
