<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the teacher dashboard's Back button on phones.
 *
 * The engine is assets/js/shared/back_button.js (history guard, hint); assets/js/teacher/teacher_back_button.js lists
 * what Back closes, in order. That list names classes, ids and functions that live in other teacher scripts, so these
 * checks read the real sources and fail when the two drift apart (a renamed close button, a new pop-up with no way
 * out). How it behaves (real history traversal, taps, phone and wide screens) was checked in Chromium, not here.
 */
final class BackButtonTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    private function teacherScripts(): string
    {
        $all = '';
        foreach (glob(__DIR__ . '/../assets/js/teacher/*.js') as $file) {
            if (basename($file) === 'teacher_back_button.js') {
                continue;
            }
            $all .= "\n" . file_get_contents($file);
        }
        return $all . "\n" . $this->source('teacher_dashboard.php');
    }

    // ── the engine ─────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_guard_is_one_entry_with_the_same_address_added_only_after_a_tap_and_only_on_phones(): void
    {
        $js = $this->source('assets/js/shared/back_button.js');
        $this->assertSame(1, substr_count($js, 'history.pushState('), 'one place adds history');
        $this->assertStringContainsString("history.pushState(GUARD, '');", $js);       // no URL argument: the address never changes
        $this->assertSame(0, substr_count($js, 'replaceState'));
        $this->assertStringContainsString("var PHONE = '(max-width: 768px)';", $js);
        $this->assertStringContainsString('navigator.userActivation', $js);            // Chrome ignores entries added before the first tap
        $this->assertStringContainsString("['pointerup', 'click', 'keydown']", $js);
        $this->assertStringContainsString('if (armed || !options || !isPhone() || !hasActivation(event)) return;', $js);
        $this->assertStringContainsString('if (isGuard(history.state)) { armed = true; return; }', $js);   // after a reload: picked up, not stacked
    }

    public function test_back_is_only_caught_when_the_guard_was_ours_and_a_grown_screen_gets_the_normal_back(): void
    {
        $js = $this->source('assets/js/shared/back_button.js');
        $this->assertStringContainsString("window.addEventListener('popstate', onPopState);", $js);
        $this->assertStringContainsString('if (!armed) return;', $js);
        $this->assertStringContainsString('if (!isPhone()) { history.back(); return; }', $js);
        $this->assertSame(1, substr_count($js, 'history.back()'), 'the one place that steps back on its own is the wide-screen case');
        // nothing that could trap or reload the page
        foreach (['beforeunload', 'location.href', 'location.assign', 'location.replace', 'location.reload', 'window.close', 'preventDefault'] as $needle) {
            $this->assertStringNotContainsString($needle, $js);
        }
    }

    public function test_at_home_the_guard_stays_off_for_the_exit_and_comes_back_when_the_person_stays(): void
    {
        $js = $this->source('assets/js/shared/back_button.js');
        $this->assertStringContainsString('var EXIT_WINDOW_MS = 2500;', $js);
        $handle = substr($js, strpos($js, 'function handleBack()'), 1100);
        // order: the layers, then "not at Home: go Home", then the hint (which does NOT re-arm)
        $layers = strpos($handle, 'layers');
        $goHome = strpos($handle, 'options.goHome');
        $hint = strpos($handle, 'showHint();');
        $this->assertLessThan($goHome, $layers);
        $this->assertLessThan($hint, $goHome);
        $this->assertStringNotContainsString('arm()', substr($handle, $hint), 'the guard stays off while the hint shows, so the next Back leaves');
        $this->assertStringContainsString('exitTimer = setTimeout(endExitWindow, EXIT_WINDOW_MS);', $handle);
        $end = substr($js, strpos($js, 'function endExitWindow()'), 300);
        $this->assertStringContainsString('arm();', $end);
        $this->assertStringContainsString('if (exitTimer != null) endExitWindow(); else arm(event);', $js);   // a tap cancels the window
    }

    public function test_the_hint_is_plain_text_and_never_in_the_way(): void
    {
        $js = $this->source('assets/js/shared/back_button.js');
        $this->assertStringNotContainsString('innerHTML', $js);
        $this->assertStringContainsString('hintEl.textContent =', $js);
        $this->assertStringContainsString("hintEl.setAttribute('role', 'status');", $js);
        $this->assertStringContainsString("document.querySelector('.net-status')", $js);       // above the connection strip when it shows
        $css = $this->source('assets/css/shared/back_button.css');
        $this->assertMatchesRegularExpression('/\.iskool-back-hint \{[^}]*z-index:\s*4450;/s', $css);   // under the menu (5000), above the strip (4400)
        $this->assertMatchesRegularExpression('/\.iskool-back-hint \{[^}]*pointer-events:\s*none;/s', $css);
        $this->assertStringContainsString('prefers-reduced-motion', $css);
        $this->assertStringContainsString("var EXIT_WINDOW_MS", $js);
    }

    // ── the teacher's list ─────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_layers_are_tried_in_the_documented_order(): void
    {
        $glue = $this->source('assets/js/teacher/teacher_back_button.js');
        $this->assertStringContainsString('layers: [closeDropdown, closePopup, closeMenu, backFromDetail, backInsideSettings],', $glue);
        $this->assertStringContainsString("exitHint: 'Press Back again to exit'", $glue);
        $this->assertStringContainsString('atHome: atHome,', $glue);
        $this->assertStringContainsString('goHome: goHome,', $glue);
    }

    public function test_the_menu_detail_and_home_steps_use_functions_and_flags_the_dashboard_really_has(): void
    {
        $scripts = $this->teacherScripts();
        $glue = $this->source('assets/js/teacher/teacher_back_button.js');
        // menu
        $this->assertStringContainsString("document.querySelector('.sidebar.active')", $glue);
        $this->assertStringContainsString('window.toggleSidebar = function', $scripts);
        $this->assertStringContainsString("sidebar.classList.add('active')", $scripts);
        // detail page: the header's own back arrow handler and the flag that says a detail page is showing
        $this->assertStringContainsString('window.handleTeacherHeaderBack = function', $scripts);
        $this->assertStringContainsString('window.teacherHeaderDetailType = config.detailType || title || null;', $scripts);
        $this->assertStringContainsString('window.teacherHeaderDetailType = null;', $scripts);
        $this->assertStringContainsString('onclick="window.handleTeacherHeaderBack(event)"', $scripts);
        // Home
        $this->assertStringContainsString('window.loadTeacherManual = async function', $scripts);
        $this->assertStringContainsString('sessionStorage.setItem("lastTeacherPage", "teacher_manual");', $scripts);
        $this->assertStringContainsString("sessionStorage.getItem('lastTeacherPage')", $glue);
        $this->assertStringContainsString("(page || 'teacher_manual') === 'teacher_manual'", $glue);
    }

    public function test_each_popup_the_list_names_exists_in_the_teacher_scripts_with_the_close_control_it_presses(): void
    {
        $scripts = $this->teacherScripts();
        $glue = $this->source('assets/js/teacher/teacher_back_button.js');
        // [selector of the pop-up as the list writes it, selector of its close control as the list writes it]
        $pairs = [
            ['#rsVideoOverlay', '.rs-video-overlay-back-btn'],
            ['.mini-cal-modal', '.mini-cal-modal-close'],
            ['#fullCalModal', '.full-cal-modal-close'],
            ['.teacher-modal-overlay', '.teacher-modal-cancel'],
            ['.teacher-modal-overlay', '.teacher-modal-close'],
            ['#sboDrawer', '.sbo-form-close-btn'],
        ];
        foreach ($pairs as [$root, $closer]) {
            // quoted, so that a renamed "...-closer" cannot pass as "...-close"
            $this->assertStringContainsString("'" . $root . "'", $glue, $root . ' is in the list');
            $this->assertStringContainsString("'" . $closer . "'", $glue, $closer . ' is in the list');
            $this->assertStringContainsString(ltrim($root, '#.'), $scripts, $root . ' no longer exists in the teacher scripts');
            $this->assertMatchesRegularExpression('/[ "\']' . preg_quote(ltrim($closer, '.'), '/') . '[ "\']/', $scripts, $closer . ' no longer exists in the teacher scripts');
        }
        // the syllabus drawer is removed from the page when closed, which is why "is it there" is the test for "is it open"
        $this->assertStringContainsString("document.getElementById('sboDrawer');\n    if (drawer) drawer.remove();", $scripts);
    }

    public function test_every_confirmation_pop_up_has_a_way_out_that_back_can_press(): void
    {
        // A pop-up with neither "Cancel" nor an "x" would leave Back with nothing to press (it would then fall through
        // to the page under it). Each overlay's own markup is read, up to the next overlay or a generous length.
        foreach (glob(__DIR__ . '/../assets/js/teacher/*.js') as $file) {
            $js = file_get_contents($file);
            $offset = 0;
            while (($at = strpos($js, 'class="teacher-modal-overlay', $offset)) !== false) {
                $block = substr($js, $at, 2600);
                $next = strpos($block, 'class="teacher-modal-overlay', 20);
                if ($next !== false) {
                    $block = substr($block, 0, $next);
                }
                $this->assertMatchesRegularExpression('/teacher-modal-(cancel|close)/', $block, basename($file) . ' has a pop-up that Back cannot close (byte ' . $at . ')');
                $offset = $at + 20;
            }
        }
        $this->addToAssertionCount(1);
    }

    public function test_settings_sheets_and_pages_and_the_drop_down_are_found_by_the_classes_they_really_use(): void
    {
        $glue = $this->source('assets/js/teacher/teacher_back_button.js');
        $settings = $this->source('assets/js/teacher/teacher_mobile_settings.js');
        $this->assertStringContainsString("'.ms-sheet-wrap.on .ms-sheet-bg'", $glue);
        $this->assertStringContainsString("w.className = 'ms-sheet-wrap';", $settings);
        $this->assertStringContainsString("w.classList.add('on');", $settings);
        $this->assertStringContainsString('<div class="ms-sheet-bg"></div>', $settings);
        $this->assertStringContainsString("w.querySelector('.ms-sheet-bg').addEventListener('click', function () { closeSheet(); });", $settings);
        $this->assertStringContainsString("'.ms-back[data-back]'", $glue);
        $this->assertStringContainsString('class="ms-back" data-back', $settings);
        $this->assertStringContainsString("if (e.target.closest('[data-back]')) { showHome(); return; }", $settings);
        // the class picker closes itself on any click that is not inside it
        $picker = $this->source('assets/js/teacher/class-picker.js');
        $this->assertStringContainsString("'.icp-dropdown.icp-open'", $glue);
        $this->assertStringContainsString("dropdown.classList.add('icp-open')", $picker);
        $this->assertStringContainsString('if (!wrapper.contains(e.target)) closeDropdown();', $picker);
    }

    public function test_nothing_else_in_the_teacher_dashboard_listens_to_history(): void
    {
        // Two scripts fighting over popstate would double-handle every Back.
        // (the settings screens have a local function called pushState: that one is about push notifications)
        $this->assertSame(0, preg_match('/popstate|history\s*\.\s*(pushState|replaceState|back|go|forward)\b/', $this->teacherScripts()));
    }

    // ── wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_teacher_dashboard_loads_the_engine_before_its_list_and_after_the_page_scripts(): void
    {
        $page = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/back_button.css', $page);
        $dashboard = strpos($page, 'assets/js/teacher/dashboard.js');
        $settings = strpos($page, 'assets/js/teacher/teacher_mobile_settings.js');
        $engine = strpos($page, 'assets/js/shared/back_button.js');
        $glue = strpos($page, 'assets/js/teacher/teacher_back_button.js');
        foreach ([$dashboard, $settings, $engine, $glue] as $position) {
            $this->assertNotFalse($position);
        }
        $this->assertLessThan($engine, $dashboard);
        $this->assertLessThan($engine, $settings);
        $this->assertLessThan($glue, $engine);
    }

    public function test_the_learner_app_and_discussions_are_not_touched(): void
    {
        $this->assertStringNotContainsString('back_button', $this->source('learner_dashboard.php'));
        foreach (['assets/js/shared/back_button.js', 'assets/css/shared/back_button.css', 'assets/js/teacher/teacher_back_button.js'] as $file) {
            $this->assertStringNotContainsStringIgnoringCase('discussion', $this->source($file), $file);
            $this->assertStringNotContainsString('learnerHeader', $this->source($file), $file);     // none of the learner app's names
            $this->assertStringNotContainsString('lastLearnerPage', $this->source($file), $file);
        }
    }
}
