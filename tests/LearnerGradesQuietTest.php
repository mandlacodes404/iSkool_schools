<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the quiet Grades on the learner phone app (899px and narrower): the same look as the Quizzes, Assignments
 * and Syllabus pages. A title with one line under it, a search box, three plain numbers (term average, subjects, needs
 * attention), outlined term chips, "Latest marks" and "Subjects" as hairline rows with a progress ring; a subject opens
 * as a screen of its own with Results and Term mark tabs; a result opens a sheet with the class comparison. Weights are
 * 400 for text and 600 for titles and numbers. The desktop split layout (900px and up) and the Progress Report are not
 * touched.
 * How it looks was checked by eye in a phone-sized browser with the real script and stylesheet (dark and light, 320, 360,
 * 390 and 800px wide: the list, search with and without a match, every term, a subject on both tabs, a term with no
 * results, the result sheet with and without the class comparison, a result that is not published, no grades at all, the
 * phone Back button closing the sheet and giving the status bar back); these read the sources so the things a later edit
 * could quietly undo stay put.
 */
final class LearnerGradesQuietTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    private function between(string $text, string $start, string $end): string
    {
        $a = strpos($text, $start);
        $this->assertNotFalse($a, "'$start' not found");
        $b = strpos($text, $end, $a);
        $this->assertNotFalse($b, "'$end' not found after '$start'");
        return substr($text, $a, $b - $a);
    }

    /** the phone Grades rules: from the heading comment to the end of the file */
    private function css(): string
    {
        $css = $this->source('assets/css/learner/grades.css');
        $a = strpos($css, '/* ═══ Learner Grades on phones (899px and narrower): the quiet look');
        $this->assertNotFalse($a);
        return substr($css, $a);
    }

    /** the phone Grades script: from its heading comment to the Progress Report */
    private function js(): string
    {
        return $this->between($this->source('assets/js/learner/grades.js'), 'PHONE LAYOUT (899px and narrower): the quiet Grades', '// PROGRESS REPORT');
    }

    // ── the look ─────────────────────────────────────────────────────────────────────────────────

    public function test_nothing_on_the_phone_grades_is_heavier_than_600(): void
    {
        preg_match_all('/font-weight:\s*(\d+)/', $this->css(), $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
        // the bold tags are pinned to 600 as well, or the browser draws them at 700
        $this->assertStringContainsString('.ggq b,', $this->css());
        $this->assertMatchesRegularExpression('/\.ggq-sheet strong \{ font-weight: 600; \}/', $this->css());
    }

    public function test_the_phone_grades_has_no_cards_pills_or_old_accents(): void
    {
        $css = $this->css();
        foreach (['#4fd1c5', '#68d391', '#a78bfa', '#187a72', '#22c55e', '#60a5fa'] as $colour) {
            $this->assertStringNotContainsString($colour, $css, $colour . ' is an old accent');
        }
        $this->assertStringNotContainsString('box-shadow: 0 8px', $css);
        // the only radius on a row is none: rows are hairline rows, not cards
        $row = $this->between($css, '.ggq-row {', '}');
        $this->assertStringNotContainsString('border-radius', $row);
        $this->assertStringNotContainsString('border:', str_replace('border: 0', '', $row));
    }

    public function test_the_colour_tokens_have_dark_and_light_values(): void
    {
        $css = $this->css();
        $dark = $this->between($css, '.ggq,', '.ggq *,');
        foreach (['--g-title: #ecece9', '--g-body: #c2c3b7', '--g-muted: #8b8b87', '--g-faint: #5f605a', '--g-surf: #272726', '--g-soon: #f28c38', '--g-chipon: #ecece9', '--g-sheet: #20201f'] as $token) {
            $this->assertStringContainsString($token, $dark);
        }
        $light = $this->between($css, 'html[data-learner-mobile-theme="light"] .ggq,', '}');
        foreach (['--g-title: #282924', '--g-body: #4a4b44', '--g-muted: #73746d', '--g-faint: #a3a39a', '--g-surf: #f1efe8', '--g-soon: #b85f12', '--g-chipon: #252624', '--g-chipon-text: #faf9f5', '--g-sheet: #faf9f5'] as $token) {
            $this->assertStringContainsString($token, $light);
        }
    }

    public function test_light_follows_the_phone_setting_and_the_769_to_899_setting_and_the_sheet_only_over_the_grades_page(): void
    {
        $css = $this->css();
        // phones: the Appearance setting; 769-899px: the desktop setting; dark phones and desktops are not touched
        $this->assertStringContainsString('@media (min-width: 769px) and (max-width: 899px) {' . "\n" . '    html[data-learner-theme="light"] .ggq {', $css);
        $this->assertStringContainsString("@media (max-width: 768px) {\n    html[data-learner-mobile-theme=\"light\"] .ggq,", $css);
        // the sheet is light only on a phone, in light, with the Grades page under it (the other Grades sheets use the same test)
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"]:has(:where(#api-content-area) .grades-mobile-layout) .ggq-sheet {', $css);
        $this->assertStringNotContainsString('html[data-learner-theme="light"] .ggq-sheet', $css);
    }

    public function test_the_list_has_the_title_edge_to_edge_rows_and_a_centred_column_on_a_small_tablet(): void
    {
        $css = $this->css();
        $this->assertMatchesRegularExpression('/\.ggq-title \{[^}]*font-size: 28px; font-weight: 600;/', $css);
        $this->assertMatchesRegularExpression('/\.ggq-row \{[^}]*padding: 11px 20px;/', $css);
        // a hairline from the text, not from the edge: 24px ring + 14px gap + 20px inset
        $this->assertMatchesRegularExpression('/\.ggq-row \+ \.ggq-row::before \{[^}]*left: 58px;/', $css);
        $this->assertMatchesRegularExpression('/\.ggq-chip \{[^}]*height: 32px;[^}]*border: 1px solid var\(--g-chipline\)/', $css);
        $this->assertStringContainsString("@media (min-width: 769px) and (max-width: 899px) {\n    .ggq { max-width: 640px; margin: 0 auto; }", $css);
        // the 16px search text stops the iPhone zooming in, and the blue native clear button is hidden
        $this->assertMatchesRegularExpression('/\.ggq-search-input \{[^}]*font-size: 16px;/', $css);
        $this->assertStringContainsString('::-webkit-search-cancel-button', $css);
        // the full-bleed margin is the one the page already has on phones (the layout cancels the 18px of the content area)
        $this->assertMatchesRegularExpression('/\.grades-mobile-layout \{\s*margin-left: -18px;\s*margin-right: -18px;/', $this->source('assets/css/learner/grades.css'));
    }

    // ── the list ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_list_is_the_title_search_three_numbers_chips_latest_marks_and_subjects(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('<h1 class="ggq-title">Grades</h1>', $js);
        $this->assertStringContainsString('placeholder="Search subjects or results"', $js);
        $this->assertStringContainsString('id="gradesSearch"', $js);
        foreach (['Term average', "Subject\${all.length === 1 ? '' : 's'}", 'Needs attention'] as $label) {
            $this->assertStringContainsString($label, $js);
        }
        $this->assertStringContainsString("'Latest marks'", $js);
        $this->assertStringContainsString('<span>Subjects</span>', $js);
        $this->assertStringContainsString('Progress report', $js);
        $this->assertStringContainsString("generateGradesReport('\${escAttr(email || '')}')", $js);
        // a ring for each row, dashed when there is no mark yet, orange under 50%
        $this->assertStringContainsString('stroke-dasharray="2 3.4"', $js);
        $this->assertStringContainsString('pct < 50', $js);
        $this->assertStringContainsString('class="ggq-ring-fill"', $js);
    }

    public function test_the_numbers_follow_the_desktop_rules(): void
    {
        $js = $this->js();
        // a subject's mark is its term mark: summative and published results, weighted (the desktop's grCalc)
        $this->assertStringContainsString('pct: grCalc(L).pct', $js);
        $this->assertStringContainsString('const calc = grCalc(L);', $js);
        // the status words use the Progress Report's thresholds
        $this->assertStringContainsString("avg >= 60 ? 'On track' : avg >= 40 ? 'Needs improvement' : 'At risk'", $js);
        // a mark is shown only when the teacher published it
        $this->assertStringContainsString('Number(q.publish_marks) === 1 && Number(q.total) > 0', $js);
        // only the terms that exist are chips, the current one has a dot, and the choice is remembered
        $this->assertStringContainsString('grTerms().map', $js);
        $this->assertStringContainsString('<i class="ggq-cd"></i>', $js);
        $this->assertStringContainsString('saveGradesState({ mobileTerm: Number(t) })', $js);
        $this->assertStringContainsString('getGradesState().mobileTerm', $js);
    }

    public function test_search_finds_a_subject_or_a_result_and_says_when_nothing_matches(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('window.gradesSearch = function (val)', $js);
        $this->assertStringContainsString('Nothing matches', $js);
        $this->assertStringContainsString("'Results' : 'Latest marks'", str_replace("q ? 'Results' : 'Latest marks'", "'Results' : 'Latest marks'", $js));
        $this->assertStringContainsString('No results in Term ${term} yet', $js);
        $this->assertStringContainsString('No grades yet', $js);
        // the typed text goes through escHtml
        $this->assertStringContainsString('${escHtml(window._grqSearchRaw || \'\')}', $js);
        // a page that is rebuilt (back from a subject) puts the search text back
        $grades = $this->source('assets/js/learner/grades.js');
        $restore = $this->between($grades, 'function restoreGradesStateAfterRender() {', 'function wireGradesScrollState() {');
        $this->assertStringContainsString("document.getElementById('gradesSearch')", $restore);
        $this->assertStringContainsString('window.gradesSearch(state.search.mobile)', $restore);
        $this->assertStringNotContainsString('openSubjects', $restore);
        $this->assertStringNotContainsString('switchGradesView', $restore);
    }

    public function test_everything_that_comes_from_the_data_is_escaped(): void
    {
        $js = $this->js();
        foreach (['${escHtml(x.quiz_title || \'Quiz\')}', '${escHtml(s.name)}', "escHtml(g.group || '')", "onclick=\"grqOpenMark('\${escAttr(String(x.result_id))}')\"", "grqReview('\${escAttr(String(q.result_id))}')"] as $safe) {
            $this->assertStringContainsString($safe, $js);
        }
        $this->assertStringNotContainsString('${x.quiz_title}', $js);
        $this->assertStringNotContainsString('${g.group}', $js);
        $this->assertStringNotContainsString('${q.quiz_title}', $js);
    }

    // ── a subject, as a screen of its own ────────────────────────────────────────────────────────

    public function test_a_subject_opens_as_a_detail_screen_with_the_grades_back_button(): void
    {
        $js = $this->js();
        $open = $this->between($js, 'window.openGradesSubject = function (gi) {', '// ── a result, as a sheet');
        $this->assertStringContainsString("mode: 'detail', detailType: 'Grades', backLabel: 'Grades'", $open);
        $this->assertStringContainsString('backAction: () => window.fetchGrades()', $open);
        // the phone detail screens keep the bottom nav
        $this->assertStringContainsString("nav.style.setProperty('display', 'flex', 'important')", $open);
        // the screen sits inside the same page marker, so the light page, header and nav still find it
        $this->assertStringContainsString('<div class="grades-mobile-layout"><div class="ggq ggq-detail" id="ggq">', $open);
        // it never opens on the desktop layout
        $this->assertStringContainsString('if (window.innerWidth > 899) return;', $open);
        // the list's place is kept, and the scroll listener does not save the screen's own scroll over it
        $this->assertStringContainsString('saveGradesState({ scroll: Object.assign({}, getGradesState().scroll, { main: mainContent.scrollTop }) })', $open);
        $scroll = $this->between($this->source('assets/js/learner/grades.js'), 'function wireGradesScrollState() {', 'function recheckMobileNavAfterToggle');
        $this->assertStringContainsString('if (window._grqDetailGi !== null && window._grqDetailGi !== undefined) return;', $scroll);
    }

    public function test_a_subject_has_results_and_term_mark_tabs_and_the_term_chips(): void
    {
        $js = $this->js();
        $this->assertStringContainsString("onclick=\"grqSetTab('results')\">Results</button>", $js);
        $this->assertStringContainsString("onclick=\"grqSetTab('mark')\">Term mark</button>", $js);
        $this->assertStringContainsString('role="tablist"', $js);
        $this->assertStringContainsString('aria-selected=', $js);
        // the term mark: the big number, what share of the term is assessed, the summative results with what each earned
        foreach (['Term mark so far', 'of the term assessed', 'Summative assessments', 'is still to be assessed', 'No term mark for Term'] as $text) {
            $this->assertStringContainsString($text, $js);
        }
        $this->assertStringContainsString('calc.per.get(x.result_id)', $js);
        $this->assertStringContainsString('class="ggq-prog"', $js);
        // a result row inside a subject says whether it counts towards the term mark
        $this->assertStringContainsString("(x.is_summative ? ['Summative'] : ['Quiz'])", $js);
    }

    // ── a result, as a sheet ─────────────────────────────────────────────────────────────────────

    public function test_a_result_opens_the_sheet_every_other_grades_sheet_uses(): void
    {
        $js = $this->js();
        $sheet = $this->between($js, 'window.grqOpenMark = function (resultId) {', '// "Review my answers"');
        $this->assertStringContainsString("getElementById('prReportModal')", $sheet);
        $this->assertStringContainsString("modal.className = 'pr-modal-overlay';", $sheet);
        $this->assertStringContainsString('<div class="pr-modal-handle-row">', $sheet);
        $this->assertStringContainsString('wireSheetDragToClose(modal, () => prBackToGrades());', $sheet);
        $this->assertStringContainsString('ensurePrStylesInjected();', $sheet);
        // so the phone Back button, the backdrop and a drag down close it the way they close the others
        $this->assertStringContainsString("if (modal && window.innerWidth <= 899) {\n        modal.remove();", $this->source('assets/js/learner/grades.js'));
    }

    public function test_the_sheet_compares_the_mark_with_the_class_and_can_open_the_review(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('get_quiz_stats.php?quiz_id=${encodeURIComponent(q.quiz_id)}', $js);
        $this->assertStringContainsString('window.learnerGradeStatsCache', $js);
        foreach (['Your mark', 'Class average', 'Lowest &middot; Highest', 'Time taken', 'Taken on', 'Review my answers', 'Could not load the class comparison.'] as $text) {
            $this->assertStringContainsString($text, $js);
        }
        // a result that is not published shows no mark and no comparison
        $this->assertStringContainsString('ggq-sh-none">Pending', $js);
        $this->assertStringContainsString('published ? `<button type="button" class="ggq-btn"', $js);
        // the answer arrives after the sheet may have been closed
        $this->assertStringContainsString("if (!document.getElementById('ggq-scale')) return;", $js);
        // the class numbers are clamped to 0-100 before they position anything
        $this->assertStringContainsString('Math.max(0, Math.min(100, Number(v) || 0))', $js);
        // the review is a sheet of its own: this one is closed first
        $review = $this->between($js, 'window.grqReview = function (resultId) {', "};\n");
        $this->assertStringContainsString("modal.remove();", $review);
        $this->assertStringContainsString('window.openQuizReview(resultId)', $review);
    }

    public function test_the_status_bar_is_given_back_when_the_phone_back_button_closes_the_sheet(): void
    {
        $grades = $this->source('assets/js/learner/grades.js');
        $wire = $this->between($grades, 'function wireSheetDragToClose(modal, onClose) {', 'window.prSwitchTerm');
        $this->assertStringContainsString('const restoreOnce = () => {', $wire);
        $this->assertStringContainsString('if (barRestored) return;', $wire);
        $this->assertStringContainsString('new MutationObserver(', $wire);
        $this->assertStringContainsString('if (!modal.isConnected) restoreOnce();', $wire);
        $this->assertStringContainsString('restoreBrowserBarAfterSheet(savedBrowserBar);', $wire);
        // the sheets that already existed keep working: the tap on the backdrop and the drag still close through the same wrapper
        $this->assertStringContainsString('modal.onclick = closeAndRestore;', $wire);
        $this->assertStringContainsString('setTimeout(() => closeAndRestore(), 200);', $wire);
    }

    // ── what was removed, and what was not ───────────────────────────────────────────────────────

    public function test_the_old_accordion_is_gone_from_the_script(): void
    {
        $grades = $this->source('assets/js/learner/grades.js');
        foreach (['toggleSubjectCard', 'toggleQuizRow', 'switchGradesView', 'refreshTermTable', 'toggleDistTip', 'renderGradeStatsBox', 'loadGradeStatsInline', 'openGradeStats', 'buildQuizList', 'buildTermTable', 'buildOpenEndedGradingStatus', 'openQuizRowByDetailId', 'saveOpenQuizRows', 'grades-wrap', 'subject-card', 'grades-mobile-search-wrap', 'grades-report-btn'] as $gone) {
            $this->assertStringNotContainsString($gone, $grades, $gone . ' belonged to the old phone accordion');
        }
        // and nothing else in the app still calls them
        foreach (glob(__DIR__ . '/../assets/js/learner/*.js') as $file) {
            $text = file_get_contents($file);
            foreach (['toggleSubjectCard', 'toggleQuizRow', 'switchGradesView', 'refreshTermTable', 'openGradeStats'] as $gone) {
                $this->assertStringNotContainsString($gone, $text, basename($file) . ' still calls ' . $gone);
            }
        }
        $this->assertStringNotContainsString('toggleSubjectCard', $this->source('learner_dashboard.php'));
    }

    public function test_the_desktop_grades_and_the_progress_report_are_still_there(): void
    {
        $grades = $this->source('assets/js/learner/grades.js');
        foreach ([
            'window.selectDesktopGradeSubject = function', 'window.grRenderDesktopList', 'window.gradesSearchDesktop', 'function grCalc(quizzes)',
            'id="gr-desktop-layout"', 'window.generateGradesReport = async function', 'window.openQuizReview = function', 'window.closeQuizReviewModal = function',
            'window.prBackToGrades = function', 'window.fetchGrades = async function', "const apiArea = document.getElementById('api-content-area');",
            'function recheckMobileNavAfterToggle()',
        ] as $kept) {
            $this->assertStringContainsString($kept, $grades, $kept . ' was removed');
        }
        // the page marker the light shell, the header and the nav find the page by
        $this->assertStringContainsString('<div class="grades-mobile-layout">${mobileHtml}</div>', $grades);
        $this->assertStringContainsString('const mobileHtml = grqBuild(groups, currentTerm, targetEmail);', $grades);
        $this->assertStringContainsString('grades-error-state', $grades);
    }

    // ── caching ──────────────────────────────────────────────────────────────────────────────────

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('assets/css/learner/grades.css?v=4.5', $page);
        $this->assertStringContainsString('assets/js/learner/grades.js?v=10.7', $page);
        $this->assertStringNotContainsString('learner/grades.css?v=4.4', $page);
        $this->assertStringNotContainsString('learner/grades.js?v=10.6', $page);
    }
}
