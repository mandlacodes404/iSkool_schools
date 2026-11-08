<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "quiet list" on the learner phone Evaluations page: the same look as the learner Assignments and Quizzes
 * lists (see LearnerListsQuietTest). A title with a counts line, a search box, filter chips, then a label for each teacher
 * with a status ring, a title and one line of detail per row; and the open evaluation (its facts, the statements as quiet
 * answer lists, the comment box and the button) in the same look. Everything uses the weights the phone pages already had
 * (400 for text, 600 for titles and names). Desktop (900px and up) keeps its own split layout.
 * How it looks was checked by eye in a phone-sized browser with the real script and stylesheet (dark and light, 320 and 390px
 * wide, long titles, search, every filter, folding, answering and the completed screen); these read the sources so the things
 * a later edit could quietly undo stay put.
 */
final class LearnerEvaluationsQuietTest extends TestCase
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

    private function phoneCss(): string
    {
        return $this->between($this->source('assets/css/learner/evaluations.css'), '/* ── MOBILE LIST: the quiet list', '/* ── SHARED UTILITIES ── */');
    }

    // ── the look ─────────────────────────────────────────────────────────────────────────────────

    public function test_nothing_in_the_phone_list_or_detail_is_heavier_than_600(): void
    {
        preg_match_all('/font-weight:\s*(\d+)/', $this->phoneCss(), $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
    }

    public function test_the_phone_list_and_detail_use_no_teal_blue_or_purple_accents(): void
    {
        $css = $this->phoneCss();
        foreach (['#4fd1c5', '#187a72', '#4fa8fd', '#1d6fb8', '#a78bfa', '79,168,253', '167,139,250'] as $accent) {
            $this->assertStringNotContainsString($accent, $css, "$accent is not part of the quiet look");
        }
        $js = $this->source('assets/js/learner/evaluations.js');
        $phoneJs = $this->between($js, '// ── Phone list helpers', 'function renderEvaluationsUI(data)');
        $this->assertStringNotContainsString('#4fa8fd', $phoneJs, 'the ring and the empty-state icon draw in currentColor');
    }

    // ── the list ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_list_has_a_title_counts_search_and_three_filters(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $this->assertStringContainsString('<h1 class="lev-mobile-title">Evaluations</h1>', $js);
        $this->assertStringContainsString("'All caught up'", $js);
        $this->assertStringContainsString('${todoCount} to do', $js);
        foreach (["['all', 'All']", "['todo', 'To do']", "['done', 'Done']"] as $chip) {
            $this->assertStringContainsString($chip, $js);
        }
        $this->assertStringContainsString('oninput="levMobileSearch(this.value)"', $js);
        $this->assertStringContainsString("onclick=\"levMobileSetFilter('\${k}')\"", $js);
        // the search box is on every phone state, so it is in the helper the empty states share
        $this->assertStringContainsString('${levMobileEmptyHtml(', $js);
        $this->assertSame(2, substr_count($js, '${levMobileEmptyHtml('), 'both empty states (no class, no evaluations) use the phone helper once each');
    }

    public function test_each_row_carries_its_state_for_the_filters_and_draws_its_ring_in_currentColor(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $this->assertStringContainsString("data-state=\"\${done ? 'done' : 'todo'}\"", $js);
        $this->assertStringContainsString('levMobileRing(done)', $js);
        $this->assertStringContainsString('class="lev-mobile-row-icon lev-mobile-row-icon--', $js);
        $ring = $this->between($js, 'function levMobileRing', '// "7 Nov at 21:41"');
        $this->assertStringContainsString('stroke="currentColor"', $ring);
        // the line under the title says where it stands, how many statements are left and the day it was posted
        $this->assertStringContainsString("'To do' + (n ? ` · \${n} statement\${n === 1 ? '' : 's'}` : '') + tail", $js);
        $this->assertStringContainsString('lev-mobile-st lev-mobile-st--ok">Completed</span>', $js);
    }

    public function test_a_teacher_group_is_open_while_it_has_something_to_do_and_folded_when_all_is_completed(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $this->assertStringContainsString('const open = evaluations.some(evaluation => !evaluation.submitted);', $js);
        // the learner's saved choice wins over that default
        $this->assertStringContainsString('levMobileSetFolder(header, body, state.openFolders.includes(body.id))', $js);
    }

    public function test_search_and_filter_never_change_how_the_groups_are_folded(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $apply = $this->between($js, 'function levMobileApply()', 'window.levMobileSetFilter');
        $this->assertStringContainsString("list.classList.toggle('is-filtering', filtering);", $apply);
        // the list shows every match open through CSS, so no folded state is rewritten (or saved) by searching
        $this->assertStringNotContainsString("classList.remove('collapsed')", $apply);
        $this->assertStringContainsString('.lev-mobile-list.is-filtering .lev-mobile-folder-body.collapsed { display: block; }', $this->phoneCss());
        $toggle = $this->between($js, 'window.toggleLevMobileFolder', 'window._levMobFilter');
        $this->assertStringContainsString("classList.contains('is-filtering')", $toggle);
    }

    public function test_the_filter_is_saved_and_restored_with_the_rest_of_the_page_state(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $this->assertStringContainsString("mobileFilter: window._levMobFilter || 'all',", $js);
        $this->assertStringContainsString('window.levMobileSetFilter(state.mobileFilter)', $js);
        $this->assertStringContainsString("openFolders: Array.from(document.querySelectorAll('.lev-mobile-folder-body:not(.collapsed)'))", $js);
    }

    // ── the open evaluation ──────────────────────────────────────────────────────────────────────

    public function test_the_open_evaluation_keeps_the_submit_flow_and_escapes_everything(): void
    {
        $js = $this->source('assets/js/learner/evaluations.js');
        $form = $this->between($js, 'function levMobileFormHtml', 'window.openMobileLearnerEvaluation = function');
        $this->assertStringContainsString('onsubmit="handleEvalSubmit(event, ${evaluation.id})"', $form);
        $this->assertStringContainsString('<input type="hidden" name="eval_id" value="${evaluation.id}">', $form);
        $this->assertStringContainsString('name="answer[${s.id}]" value="${val}" required', $form);
        $this->assertStringContainsString('name="comments"', $form);
        $this->assertStringContainsString('escapeLearnerEvaluationHtml(s.statement', $form);
        $this->assertStringContainsString('LEV_SCALE.map', $form);
        $detail = $this->between($js, 'window.openMobileLearnerEvaluation = function', 'window.openMobileLearnerEvaluationById');
        foreach (['escapeLearnerEvaluationHtml(evaluation.title', 'escapeLearnerEvaluationHtml(teacherName)', 'escapeLearnerEvaluationHtml(evaluation.description)', 'escapeLearnerEvaluationHtml(evaluation.display_date)'] as $escaped) {
            $this->assertStringContainsString($escaped, $detail);
        }
        // the header still says "detail of an Evaluation", which is what the back button goes by
        $this->assertStringContainsString("detailType: 'Evaluation'", $detail);
        // a submitted evaluation shows the completed state and no form
        $this->assertStringContainsString('lev-mobile-done-title">Completed', $detail);
    }

    public function test_the_hidden_radios_stay_focusable_so_the_browser_can_point_at_a_missing_answer(): void
    {
        $css = $this->phoneCss();
        $rule = $this->between($css, '.lev-mobile-opt input {', '}');
        $this->assertStringNotContainsString('display: none', $rule, 'a required radio that is display:none cannot be focused, so a missing answer blocked the submit silently');
        $this->assertStringContainsString('opacity: 0;', $rule);
        $this->assertStringContainsString('.lev-mobile-opt input:checked + .lev-mobile-opt-dot', $css);
    }

    public function test_the_fields_do_not_zoom_the_page_and_stay_inside_the_padded_detail(): void
    {
        $css = $this->phoneCss();
        $this->assertSame(1, preg_match('/\.lev-mobile-search \{[^}]*font-size:\s*16px;/', $css), 'the search box is 16px so iOS does not zoom');
        $this->assertSame(1, preg_match('/\.lev-mobile-comments textarea \{[^}]*box-sizing:\s*border-box;[^}]*font-size:\s*16px;/s', $css), 'the comments box is border-box and 16px');
        $this->assertSame(1, preg_match('/\.lev-mobile-detail-action \{[^}]*width:\s*100%;[^}]*box-sizing:\s*border-box;/s', $css), 'the button runs the width of the content');
    }

    // ── desktop, light mode and the stylesheet the page loads ────────────────────────────────────

    public function test_from_900px_up_the_phone_pieces_are_hidden_and_the_desktop_page_is_still_there(): void
    {
        $css = $this->source('assets/css/learner/evaluations.css');
        $desktop = $this->between($css, '@media (min-width: 900px) {', '@media (max-width: 899px)');
        foreach (['.lev-mobile-list', '.lev-mobile-search-wrap', '.lev-mobile-head', '.lev-mobile-chips', '.lev-mobile-detail'] as $sel) {
            $this->assertStringContainsString($sel . ' ', $desktop);
        }
        // the desktop split layout is untouched: its renderers, the rows, the detail header and the info rail are all still built
        $js = $this->source('assets/js/learner/evaluations.js');
        foreach (['window.levRenderDesktopList', 'window.levToggleGroup', 'window.levInitSplit', 'window.levUpdateProgress', 'window.selectDesktopLearnerEvaluation', 'lev-sidebar-item', 'class="lev-dh"', 'lev-rail', 'id="lev-desktop-layout"'] as $desktopPiece) {
            $this->assertStringContainsString($desktopPiece, $js);
        }
    }

    public function test_light_mode_is_the_light_set_of_tokens_on_phones_and_in_the_769_to_899_range(): void
    {
        $css = $this->source('assets/css/learner/evaluations.css');
        foreach (['html[data-learner-theme="light"]', 'html[data-learner-mobile-theme="light"]'] as $attr) {
            foreach (['.lev-mobile-head', '.lev-mobile-search-wrap', '.lev-mobile-chips', '.lev-mobile-list', '.lev-mobile-detail'] as $sel) {
                $this->assertSame(1, preg_match('/^' . preg_quote($attr . ' ' . $sel, '/') . '[,\s{]/m', $css), 'misses ' . $attr . ' ' . $sel);
            }
        }
        $this->assertSame(2, substr_count($css, '--qm-title: #282924;'));
        $this->assertSame(2, substr_count($css, '--qm-chipon: #252624;'));
        // the phone light block is still only light rules
        $block = substr($css, strrpos($css, '@media (max-width: 768px) {'));
        preg_match_all('/^(html\S*)/m', $block, $m);
        $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($m[1])));
        // the page shell finds this page by its markup, so the markers stay in the script
        $js = $this->source('assets/js/learner/evaluations.js');
        foreach (['lev-mobile-list', 'lev-mobile-detail', 'eval-error-state'] as $marker) {
            $this->assertStringContainsString($marker, $js);
        }
    }

    public function test_the_changed_files_have_new_cache_versions_and_the_page_asks_for_the_same_stylesheet(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('learner/evaluations.css?v=5.7', $php);
        $this->assertStringContainsString('learner/evaluations.js?v=7.6', $php);
        // evaluations.js adds its own <link> when the page opens. It used to ask for ?v=4.0, a copy the installed app had
        // kept from long ago, and being added last it would have won over the new styles. It must ask for the dashboard's URL.
        $js = $this->source('assets/js/learner/evaluations.js');
        preg_match("#const evalStyleHref = '([^']+)'#", $js, $m);
        $this->assertSame('assets/css/learner/evaluations.css?v=5.7', $m[1] ?? null);
        $this->assertStringContainsString('href="' . $m[1] . '"', $php);
    }
}
