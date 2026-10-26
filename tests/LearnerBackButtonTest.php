<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the learner dashboard's Back button on phones.
 *
 * The engine is assets/js/shared/back_button.js (history guard, hint, shared with the teacher dashboard);
 * assets/js/learner/learner_back_button.js lists what Back closes, in order. That list names classes, ids and functions
 * that live in other learner scripts, so these checks read the real sources and fail when the two drift apart (a renamed
 * close button, a pop-up with no way out). How it behaves (real history traversal, taps, phone and wide screens, the
 * app's own handleHeaderBack lifted out of learner_dashboard.php) was checked in Chromium, not here.
 */
final class LearnerBackButtonTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    private function learnerScripts(): string
    {
        $all = '';
        foreach (glob(__DIR__ . '/../assets/js/learner/*.js') as $file) {
            if (basename($file) === 'learner_back_button.js') {
                continue;
            }
            $all .= "\n" . file_get_contents($file);
        }
        return $all . "\n" . $this->source('learner_dashboard.php') . "\n" . $this->source('includes/global_viewer.php');
    }

    // ── the list ───────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_layers_are_tried_in_the_documented_order(): void
    {
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        $this->assertStringContainsString('layers: [closeDropdown, closeViewer, closePopup, closeAssignmentForm, closeMenu, backFromDetail],', $glue);
        $this->assertStringContainsString("exitHint: 'Press Back again to exit'", $glue);
        $this->assertStringContainsString('atHome: atHome,', $glue);
        $this->assertStringContainsString('goHome: goHome,', $glue);
        $this->assertStringContainsString('if (!window.iskoolBack) return;', $glue);
    }

    public function test_every_function_the_list_calls_exists_in_the_learner_scripts(): void
    {
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        $scripts = $this->learnerScripts();
        preg_match_all("/call\('([A-Za-z]+)'/", $glue, $m);
        $this->assertNotEmpty($m[1]);
        foreach (array_unique($m[1]) as $name) {
            $this->assertMatchesRegularExpression('/window\.' . $name . '\s*=\s*(async\s+)?function|function\s+' . $name . '\s*\(/', $scripts, $name . ' no longer exists in the learner scripts');
        }
        // the ones named outside call(...)
        foreach (['toggleSidebar', 'returnToLearnerHome'] as $name) {
            $this->assertStringContainsString("window.$name", $glue);
            $this->assertMatchesRegularExpression('/window\.' . $name . '\s*=\s*function/', $scripts, $name . ' no longer exists');
        }
        $this->assertStringContainsString('window.joinSheet = (function', $scripts);
    }

    public function test_the_list_closes_things_only_through_the_apps_own_controls(): void
    {
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        // It presses or calls what the app has; it never removes, hides or rewrites anything itself.
        foreach (['innerHTML', 'removeChild', '.remove()', 'style.display =', 'classList.remove', 'classList.add', 'location.'] as $needle) {
            $this->assertStringNotContainsString($needle, $glue, $needle);
        }
    }

    // ── the menu, the detail pages and Home use what the dashboard really has ─────────────────────────────────────

    public function test_the_menu_detail_and_home_steps_use_functions_and_flags_the_dashboard_really_has(): void
    {
        $scripts = $this->learnerScripts();
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        // menu
        $this->assertStringContainsString("document.querySelector('.sidebar.active')", $glue);
        $this->assertStringContainsString('window.toggleSidebar = function', $scripts);
        $this->assertStringContainsString('sidebar.classList.add("active")', $scripts);
        $this->assertStringContainsString('class="sidebar dm-menu" id="dmSidebar"', $scripts);
        // a detail page: the header's back arrow, which is shown only in detail mode
        $this->assertStringContainsString("document.getElementById('headerBackBtn')", $glue);
        $this->assertStringContainsString('id="headerBackBtn"', $scripts);
        $this->assertStringContainsString('onclick="return window.handleHeaderBack(event)"', $scripts);
        $this->assertStringContainsString("if (backBtn) backBtn.style.display = 'flex';", $scripts);
        $this->assertStringContainsString("if (backBtn) backBtn.style.display = 'none';", $scripts);
        // Home, and "My Class", which is a page of its own that leaves the saved page alone
        $this->assertStringContainsString("sessionStorage.getItem('lastLearnerPage')", $glue);
        $this->assertStringContainsString('sessionStorage.setItem("lastLearnerPage", "partials/manual.html");', $scripts);
        $this->assertStringContainsString("'partials/manual.html'", $glue);
        $this->assertStringContainsString("document.getElementById('myClassContent')", $glue);
        $this->assertStringContainsString('myClassContent.classList.add("active");', $scripts);
        $this->assertStringContainsString('window.returnToLearnerHome = function', $scripts);
    }

    public function test_the_apps_own_checks_still_run_when_back_goes_up_from_a_detail_page(): void
    {
        // Back presses the header arrow, so these are what protect an unfinished quiz and unsaved edits.
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('iframe.contentWindow.confirmExit();', $page);
        $this->assertStringContainsString('window.learnerHeaderBackAction = typeof config.backAction', $page);
        $settings = $this->source('assets/js/learner/mobile_settings.js');
        $this->assertStringContainsString("cfgH.backAction = function () { goBack(); };", $settings);
        $this->assertStringContainsString('if (dirtyGuard && dirtyGuard()) return;', $settings);
    }

    // ── pop-ups ────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_each_popup_the_list_names_exists_in_the_learner_scripts_with_the_close_control_it_uses(): void
    {
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        $menu = $this->source('assets/js/learner/mobile_menu.js');
        $settings = $this->source('assets/js/learner/mobile_settings.js');
        $grades = $this->source('assets/js/learner/grades.js');
        $assignments = $this->source('assets/js/learner/assignments.js');
        $page = $this->source('learner_dashboard.php');
        $viewer = $this->source('includes/global_viewer.php');
        $main = $this->source('assets/js/learner/main.js');
        $manual = $this->source('assets/js/learner/manual.js');

        // the account drop-down
        $this->assertStringContainsString("'learnerAvatarDropdown'", $glue);
        $this->assertStringContainsString('id="learnerAvatarDropdown"', $page);
        $this->assertStringContainsString("classList.toggle('open')", $page);
        $this->assertStringContainsString('window.closeLearnerAvatarDropdown = function', $page);
        // the file viewer
        $this->assertStringContainsString("'globalViewer'", $glue);
        $this->assertStringContainsString('id="globalViewer"', $viewer);
        $this->assertStringContainsString('window.closeGlobalViewer = function', $main);
        // the phone search
        $this->assertStringContainsString("'#dmmSearch.on .dmm-s-cancel'", $glue);
        $this->assertStringContainsString("S.id = 'dmmSearch'", $menu);
        $this->assertStringContainsString("el('button', 'dmm-s-cancel', 'Cancel')", $menu);
        $this->assertStringContainsString("S.classList.add('on');", $menu);
        $this->assertStringContainsString("cancel.addEventListener('click', function () { closeSearch(true); });", $menu);
        // a sheet in Settings or the "Parent link" sheet: its backdrop closes it
        $this->assertStringContainsString("'.ms-sheet-wrap.on .ms-sheet-bg'", $glue);
        $this->assertStringContainsString("w.className = 'ms-sheet-wrap';", $settings);
        $this->assertStringContainsString("w.classList.add('on');", $settings);
        $this->assertStringContainsString('<div class="ms-sheet-bg"></div>', $settings);
        $this->assertStringContainsString("w.querySelector('.ms-sheet-bg').addEventListener('click', function () { closeSheet(); });", $settings);
        // the account sheet
        $this->assertStringContainsString("'#dmmSheetBg.on'", $glue);
        $this->assertStringContainsString("sheetBg.id = 'dmmSheetBg'", $menu);
        $this->assertStringContainsString("sheetBg.classList.add('on');", $menu);
        $this->assertStringContainsString("sheetBg.addEventListener('click', closeSheet);", $menu);
        // "Join a class": the question has its own "Go back", the sheet closes with joinSheet.close()
        $this->assertStringContainsString("'#joinSheet.is-open'", $glue);
        $this->assertStringContainsString("'.jcs-panel.is-confirming .jcs-btn:not(.jcs-btn--go):not([disabled])'", $glue);
        $this->assertStringContainsString("root.id = 'joinSheet'", $page);
        $this->assertStringContainsString("root.classList.add('is-open');", $page);
        $this->assertStringContainsString("panel = mk('div', 'jcs-panel');", $page);
        $this->assertStringContainsString("panel.classList.add('is-confirming');", $page);
        $this->assertStringContainsString("yesBtn = mk('button', 'jcs-btn jcs-btn--go', YES);", $page);
        $this->assertStringContainsString("backBtn = mk('button', 'jcs-btn', 'Go back');", $page);
        $this->assertStringContainsString("backBtn.addEventListener('click', function () { panel.classList.remove('is-confirming'); });", $page);
        // the grade explainers, the progress report and the quiz review
        // quoted, so that a renamed "prInfoModalX" cannot pass as "prInfoModal"
        foreach (["'grInfoModal'", "'prInfoModal'", "'prReportModal'", "'pr-info-modal-visible'"] as $name) {
            $this->assertStringContainsString($name, $glue, $name . ' is in the list');
            $this->assertStringContainsString($name, $grades, $name . ' no longer exists in grades.js');
        }
        $this->assertStringContainsString("'.review-modal-sheet'", $glue);
        $this->assertStringContainsString("modal.classList.add('pr-info-modal-visible');", $grades);
        $this->assertStringContainsString("modal.className = 'pr-modal-overlay';", $grades);
        $this->assertStringContainsString('<div class="pr-modal-sheet review-modal-sheet"', $grades);
        $this->assertStringContainsString("if (modal && window.innerWidth <= 899) {\n        modal.remove();", $grades);   // prBackToGrades closes the sheet on a phone
        // a native dialog (the learner guide)
        $this->assertStringContainsString("'dialog[open]'", $glue);
        $this->assertStringContainsString('?.showModal()', $manual);
        // the assignment form inside an assignment
        $this->assertStringContainsString("'.las-submission-form'", $glue);
        $this->assertStringContainsString('class="las-submission-form"', $assignments);
        $this->assertStringContainsString('window.closeLearnerAssignmentInlineForm = function(formId)', $assignments);
        $this->assertStringContainsString('if (form) form.hidden = true;', $assignments);
    }

    // ── quizzes ────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_a_quiz_is_a_page_of_its_own_so_the_dashboards_back_button_never_runs_inside_it(): void
    {
        // If a quiz is ever shown inside the dashboard again, this fails and the quiz's own exit question needs a look.
        $quiz = $this->source('assets/js/learner/quiz.js');
        $this->assertStringContainsString('href="take_quiz.php?quiz_id=${quiz.id}"', $quiz);
        $this->assertStringContainsString('<form action="take_quiz.php" method="GET"', $quiz);
        $this->assertSame(0, preg_match('/\bsrc\s*=\s*[^;\n]*take_quiz/', $this->learnerScripts()), 'a quiz is loaded into the nested page');
        $quizPage = $this->source('take_quiz.php');
        $this->assertStringNotContainsString('back_button', $quizPage);
        $this->assertStringNotContainsString('popstate', $quizPage);
        $this->assertStringContainsString('function confirmExit()', $quizPage);
    }

    // ── nothing else fights over history ───────────────────────────────────────────────────────────────────────────

    public function test_nothing_else_in_the_learner_dashboard_listens_to_history(): void
    {
        $scripts = $this->learnerScripts();
        $this->assertSame(0, preg_match('/popstate|history\s*\.\s*(pushState|back|go|forward)\b/', $scripts));
        // the one existing replaceState runs at start-up, before anyone has tapped (so before the guard exists)
        $this->assertSame(1, substr_count($scripts, 'history.replaceState('));
        $this->assertStringContainsString('window.history.replaceState({}, document.title, window.location.pathname);', $this->source('learner_dashboard.php'));
    }

    // ── wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_learner_dashboard_loads_the_engine_before_its_list_and_after_the_page_scripts(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/back_button.css', $page);
        $this->assertSame(1, substr_count($page, 'assets/js/shared/back_button.js'));
        $this->assertSame(1, substr_count($page, 'assets/js/learner/learner_back_button.js'));
        $calendar = strpos($page, 'assets/js/learner/learner_calendar.js');
        $menu = strpos($page, 'assets/js/learner/mobile_menu.js');
        $settings = strpos($page, 'assets/js/learner/mobile_settings.js');
        $engine = strpos($page, 'assets/js/shared/back_button.js');
        $glue = strpos($page, 'assets/js/learner/learner_back_button.js');
        foreach ([$calendar, $menu, $settings, $engine, $glue] as $position) {
            $this->assertNotFalse($position);
        }
        $this->assertLessThan($engine, $calendar);
        $this->assertLessThan($engine, $menu);
        $this->assertLessThan($engine, $settings);
        $this->assertLessThan($glue, $engine);
        // the hint is drawn by the page's own stylesheet link, in the head
        $this->assertLessThan(strpos($page, '</head>'), strpos($page, 'assets/css/shared/back_button.css'));
    }

    public function test_the_shared_files_and_the_teacher_list_know_nothing_about_the_learner_app(): void
    {
        foreach (['assets/js/shared/back_button.js', 'assets/css/shared/back_button.css', 'assets/js/teacher/teacher_back_button.js'] as $file) {
            $this->assertStringNotContainsString('learnerHeader', $this->source($file), $file);
            $this->assertStringNotContainsString('lastLearnerPage', $this->source($file), $file);
        }
        $this->assertStringNotContainsString('teacherHeader', $this->source('assets/js/learner/learner_back_button.js'));
        $this->assertStringNotContainsString('lastTeacherPage', $this->source('assets/js/learner/learner_back_button.js'));
    }

    // ── signing in ─────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_signing_in_replaces_the_sign_in_page_in_the_history_instead_of_stacking_the_dashboard_on_it(): void
    {
        // With href the sign-in page stays one step below the dashboard, so Back from Home lands on it, and it (being
        // signed in already) sends the person straight back to the dashboard: Back could never leave the app.
        $index = $this->source('index.php');
        $this->assertStringContainsString('window.location.replace(data.redirect);', $index);
        $this->assertStringContainsString("window.location.replace('dashboard');", $index);
        $this->assertStringNotContainsString('window.location.href = data.redirect', $index);
        $this->assertStringNotContainsString("window.location.href = 'dashboard'", $index);
    }
}
