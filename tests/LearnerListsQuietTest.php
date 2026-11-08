<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "quiet list" on the learner phone Assignments and Quizzes pages: a title with a counts line, a search box,
 * filter chips, then a label for each teacher with a status ring, a title and one line of detail per row; and the assignment
 * detail screen in the same look. Everything uses the weights the phone pages already had (400 for text, 600 for titles and
 * names), so nothing in this look is 700 or heavier. Desktop (900px and up) keeps its own layout.
 * How it looks was checked by eye in a phone-sized browser with the real scripts and stylesheets (dark and light, 320 to 430px
 * wide, long titles, search, every filter, folding, and a quiz opening while the list is on screen); these read the sources
 * so the things a later edit could quietly undo stay put.
 */
final class LearnerListsQuietTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The text from $start up to the first $end after it */
    private function between(string $text, string $start, string $end): string
    {
        $a = strpos($text, $start);
        $this->assertNotFalse($a, "'$start' not found");
        $b = strpos($text, $end, $a);
        $this->assertNotFalse($b, "'$end' not found after '$start'");
        return substr($text, $a, $b - $a);
    }

    private function assignmentsPhoneCss(): string
    {
        return $this->between($this->source('assets/css/learner/assignments.css'), '/* ── MOBILE LIST: the quiet list', '/* ── DESKTOP TYPOGRAPHY');
    }

    private function quizPhoneCss(): string
    {
        return $this->between($this->source('assets/js/learner/quiz.js'), '/* ── MOBILE LIST: the quiet list', '</style>');
    }

    // ── weights ──────────────────────────────────────────────────────────────────────────────────

    public function test_nothing_in_the_quiet_look_is_heavier_than_600(): void
    {
        foreach (['assignments' => $this->assignmentsPhoneCss(), 'quiz' => $this->quizPhoneCss()] as $name => $css) {
            preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
            $this->assertNotEmpty($m[1], $name . ' sets no weights');
            foreach ($m[1] as $weight) {
                // the quiz page's summative badge is not part of the phone list and keeps the weight it had
                if ($name === 'quiz' && (int) $weight === 700 && substr_count($css, 'lqz-summative-badge') === 1) {
                    continue;
                }
                $this->assertLessThanOrEqual(600, (int) $weight, $name . ': font-weight ' . $weight . ' is heavier than the phone pages use');
            }
        }
    }

    public function test_the_assignment_detail_and_form_do_not_use_purple_or_heavy_weights(): void
    {
        // (the old desktop-sidebar dot colours sit in the middle of this region and are not part of the phone screens)
        $css = preg_replace('/^\.las-sidebar-status-dot--.*$/m', '', $this->assignmentsPhoneCss());
        $this->assertStringNotContainsString('#a78bfa', $css, 'the purple accents are gone from the phone list, detail and form');
        $this->assertStringNotContainsString('167,139,250', $css);
        $this->assertSame(0, preg_match('/font-weight:\s*(700|800|900)/', $css));
    }

    // ── Assignments ──────────────────────────────────────────────────────────────────────────────

    public function test_the_assignments_list_has_a_title_counts_search_and_four_filters(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        $this->assertStringContainsString('<h1 class="las-mobile-title">Assignments</h1>', $js);
        $this->assertStringContainsString('due soon', $js);
        $this->assertStringContainsString('All caught up', $js);
        foreach (["['all', 'All']", "['todo', 'To do']", "['done', 'Done']", "['closed', 'Closed']"] as $chip) {
            $this->assertStringContainsString($chip, $js);
        }
        $this->assertStringContainsString('oninput="lasMobileSearch(this.value)"', $js);
        $this->assertStringContainsString("onclick=\"lasMobileSetFilter('\${k}')\"", $js);
    }

    public function test_a_missed_assignment_says_closed_because_late_work_cannot_be_submitted(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        // the same word the desktop list and the detail's locked button use
        $this->assertStringContainsString("'Closed' + (dueMs ? ' · was due '", $js);
        $this->assertStringContainsString("'Submission Closed'", $js);
        $this->assertStringNotContainsString('Overdue', $this->between($js, 'function lasMobileMeta', '    return (soon'));
    }

    public function test_each_assignment_row_carries_its_state_for_the_filters(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        $this->assertStringContainsString('data-state="${s.key}"', $js);
        $this->assertStringContainsString('lasMobileRing(s.key)', $js);
        $this->assertStringContainsString('class="las-mobile-row-icon las-mobile-row-icon--', $js);
        // the ring draws in currentColor, so light mode needs no rule of its own for it
        $ring = $this->between($js, 'function lasMobileRing', '// The one line under');
        $this->assertStringContainsString('stroke="currentColor"', $ring);
        $this->assertStringNotContainsString('#a78bfa', $ring);
    }

    public function test_search_and_filter_never_change_how_the_groups_are_folded(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        $apply = $this->between($js, 'function lasMobileApply()', 'window.lasMobileSetFilter');
        $this->assertStringContainsString("list.classList.toggle('is-filtering', filtering);", $apply);
        // the list shows every match open through CSS, so no folded state is rewritten (or saved) by searching
        $this->assertStringNotContainsString("classList.remove('collapsed')", $apply);
        $this->assertStringContainsString('.las-mobile-list.is-filtering .las-mobile-folder-body.collapsed { display: block; }', $this->assignmentsPhoneCss());
        $toggle = $this->between($js, 'window.toggleLasMobileFolder', 'window._lasMobFilter');
        $this->assertStringContainsString("classList.contains('is-filtering')", $toggle);
    }

    public function test_the_filter_is_saved_and_restored_with_the_rest_of_the_page_state(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        $this->assertStringContainsString("mobileFilter: window._lasMobFilter || 'all',", $js);
        $this->assertStringContainsString('window.lasMobileSetFilter(state.mobileFilter)', $js);
        $this->assertStringContainsString('lasMobileSetFolder(header, body, state.openFolders.includes(body.id))', $js);
    }

    public function test_the_assignment_detail_keeps_the_submit_flow_and_the_files(): void
    {
        $js = $this->source('assets/js/learner/assignments.js');
        $detail = $this->between($js, 'window.openMobileLearnerAssignment = function', 'window.openMobileLearnerAssignmentById');
        $this->assertStringContainsString("openLearnerAssignmentInlineForm(event, '\${submissionFormId}')", $detail);
        $this->assertStringContainsString('learnerAssignmentSubmissionFormMarkup(task, submissionFormId)', $detail);
        $this->assertStringContainsString("viewDocument('\${escapeLearnerAssignmentJsString(task.teacher_file)}'", $detail);
        $this->assertStringContainsString("viewDocument('\${escapeLearnerAssignmentJsString(task.submission_file)}'", $detail);
        $this->assertStringContainsString('las-mobile-detail-action--locked', $detail);
        $this->assertStringContainsString('Due</div>', $detail);
        $this->assertStringContainsString('Instructions</div>', $detail);
        // every piece of text from the API goes through the escaper
        $this->assertStringContainsString('escapeLearnerAssignmentHtml(task.title', $detail);
        $this->assertStringContainsString('escapeLearnerAssignmentHtml(sender)', $detail);
        $this->assertStringContainsString('escapeLearnerAssignmentHtml(task.class_name)', $detail);
    }

    // ── Quizzes ──────────────────────────────────────────────────────────────────────────────────

    public function test_the_quizzes_list_has_a_title_counts_search_and_five_filters(): void
    {
        $js = $this->source('assets/js/learner/quiz.js');
        $this->assertStringContainsString('<h1 class="lqz-mobile-title">Quizzes</h1>', $js);
        $this->assertStringContainsString('available now', $js);
        $this->assertStringContainsString('in progress', $js);
        foreach (["['all', 'All']", "['open', 'Open']", "['upcoming', 'Upcoming']", "['done', 'Done']", "['closed', 'Closed']"] as $chip) {
            $this->assertStringContainsString($chip, $js);
        }
        $this->assertStringContainsString('oninput="lqzMobileSearch(this.value)"', $js);
        $this->assertStringContainsString("mobileFilter: window._lqzMobFilter || 'all',", $js);
        $this->assertStringContainsString('window.lqzMobileSetFilter(state.mobileFilter)', $js);
    }

    public function test_only_an_open_quiz_can_be_opened_from_the_phone_list(): void
    {
        $js = $this->source('assets/js/learner/quiz.js');
        $this->assertStringContainsString("const canOpen = s.key === 'open';", $js);
        // the other rows are information: no button role, no pointer, no press
        $this->assertStringContainsString("canOpen ? '' : ' lqz-mobile-row--static'", $js);
        $this->assertStringContainsString('.lqz-mobile-row--static { cursor: default; }', $this->quizPhoneCss());
        // Start and Continue are text on the right of an open row, not a pill
        $this->assertStringContainsString('<span class="lqz-mobile-row-action">Start</span>', $js);
        $this->assertStringContainsString('lqz-mobile-row-action--prog">Continue</span>', $js);
        $this->assertStringNotContainsString('lqz-mobile-row-status"', $js, 'the old status pill that squeezed the titles is gone');
    }

    public function test_a_quiz_that_opens_while_the_list_is_on_screen_turns_into_an_open_row(): void
    {
        $js = $this->source('assets/js/learner/quiz.js');
        $this->assertStringContainsString('class="quiz-countdown lqz-mobile-cd"', $js);
        $this->assertStringContainsString("if (el.classList.contains('lqz-mobile-cd')) { lqzMobileRowOpen(el.closest('.lqz-mobile-row'), quizId); return; }", $js);
        $open = $this->between($js, 'function lqzMobileRowOpen', 'function renderQuizCards');
        foreach (["row.dataset.state = 'open'", "row.classList.remove('lqz-mobile-row--static')", "row.onclick = () => loadQuizInstructions(quizId)", "lqzMobileRing('go')", "'Available now'", "'Start'"] as $needle) {
            $this->assertStringContainsString($needle, $open);
        }
        // the desktop panel's countdown still writes "Starts in ..."
        $this->assertStringContainsString('`Starts in ${h}h ${m}m ${s}s`', $js);
    }

    public function test_search_and_filter_never_change_how_the_quiz_groups_are_folded(): void
    {
        $js = $this->source('assets/js/learner/quiz.js');
        $apply = $this->between($js, 'function lqzMobileApply()', 'window.lqzMobileSetFilter');
        $this->assertStringContainsString("list.classList.toggle('is-filtering', filtering);", $apply);
        $this->assertStringNotContainsString("classList.remove('collapsed')", $apply);
        $this->assertStringContainsString('.lqz-mobile-list.is-filtering .lqz-mobile-folder-body.collapsed { display: block; }', $this->quizPhoneCss());
    }

    // ── Desktop and light mode ───────────────────────────────────────────────────────────────────

    public function test_from_900px_up_the_new_phone_pieces_are_hidden(): void
    {
        $css = $this->source('assets/css/learner/assignments.css');
        $desktop = $this->between($css, '@media (min-width: 900px) {', '@media (max-width: 899px)');
        foreach (['.las-mobile-list', '.las-mobile-search-wrap', '.las-mobile-head', '.las-mobile-chips'] as $sel) {
            $this->assertStringContainsString($sel . ' ', $desktop);
            $this->assertStringContainsString('display: none !important', $desktop);
        }
        $js = $this->source('assets/js/learner/quiz.js');
        $quizDesktop = $this->between($js, '@media (min-width: 900px) {', '@media (max-width: 899px)');
        foreach (['.lqz-mobile-list', '.lqz-mobile-search-wrap', '.lqz-mobile-head', '.lqz-mobile-chips'] as $sel) {
            $this->assertStringContainsString($sel . ' ', $quizDesktop);
        }
    }

    public function test_light_mode_is_the_light_set_of_tokens_on_phones_and_in_the_769_to_899_range(): void
    {
        foreach (['assets/css/learner/assignments.css' => ['.las-mobile-head', '.las-mobile-chips', '.las-mobile-list', '.las-mobile-detail'],
                  'assets/css/learner/quiz.css' => ['.lqz-mobile-head', '.lqz-mobile-chips', '.lqz-mobile-list']] as $file => $selectors) {
            $css = $this->source($file);
            foreach (['html[data-learner-theme="light"]', 'html[data-learner-mobile-theme="light"]'] as $attr) {
                foreach ($selectors as $sel) {
                    $this->assertSame(1, preg_match('/^' . preg_quote($attr . ' ' . $sel, '/') . '[,\s{]/m', $css), $file . ' misses ' . $attr . ' ' . $sel);
                }
            }
            $this->assertStringContainsString('--qm-title: #282924;', $css);
            $this->assertStringContainsString('--qm-chipon: #252624;', $css);
        }
        // the quiz-only colours the quiet list adds
        $quiz = $this->source('assets/css/learner/quiz.css');
        $this->assertStringContainsString('--qm-go: #187a72;', $quiz);
        $this->assertStringContainsString('--qm-amber: #9a6b00;', $quiz);
    }

    public function test_the_phone_light_block_is_still_only_light_rules(): void
    {
        foreach (['assets/css/learner/assignments.css', 'assets/css/learner/quiz.css'] as $file) {
            $css = $this->source($file);
            $block = substr($css, strrpos($css, '@media (max-width: 768px) {'));
            preg_match_all('/^(html\S*)/m', $block, $m);
            $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($m[1])), $file);
        }
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        foreach (['learner/assignments.css?v=4.4', 'learner/quiz.css?v=7.0', 'learner/assignments.js?v=10.5', 'learner/quiz.js?v=12.9'] as $pinned) {
            $this->assertStringContainsString($pinned, $php, "$pinned is not what the page links");
        }
    }
}
