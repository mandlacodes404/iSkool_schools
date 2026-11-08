<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "quiet list" on the learner phone Syllabus page: a title with a counts line, a search box, term chips,
 * then one plain row per subject (a book, the subject, the teacher and how many topics); tapping a row opens the subject
 * on its own screen in the same look as the assignment detail (term and Current tag, a 26px title, who teaches it, the
 * teacher's note, the numbered topics and the assessment weighting). It replaces the old page of cards, tabs and coloured
 * bars. Everything uses the weights the phone pages already had (400 for text, 600 for titles and names), so nothing in
 * this look is 700 or heavier, and there is no purple. Desktop (900px and up) keeps its own split layout untouched.
 * How it looks was checked by eye in a phone-sized browser with the real script (dark and light, narrow and wide phones,
 * long subject names and notes, search, every term, opening a subject and coming back, and the empty states); these read
 * the sources so the things a later edit could quietly undo stay put.
 */
final class LearnerSyllabusQuietTest extends TestCase
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

    private function js(): string
    {
        return $this->source('assets/js/learner/syllabus.js');
    }

    /** The phone stylesheet: everything inside sylQuietStyle() */
    private function phoneCss(): string
    {
        return $this->between($this->js(), 'function sylQuietStyle() {', "\n}\n");
    }

    /** The phone script: the helpers for the rows, the search, the open subject and the term switch */
    private function phoneScript(): string
    {
        return $this->between($this->js(), 'window._sylMobTerm = \'\';', 'function sylEsc(v) {');
    }

    // ── weights and colours ──────────────────────────────────────────────────────────────────────

    public function test_nothing_in_the_phone_list_or_detail_is_heavier_than_600(): void
    {
        $css = $this->phoneCss();
        preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
        $this->assertStringNotContainsString('#a78bfa', $css, 'no purple on the phone pages');
        $this->assertStringNotContainsString('#34d399', $css, 'no green weighting bars any more');
    }

    public function test_the_old_card_tab_and_coloured_bar_markup_is_gone(): void
    {
        $js = $this->js();
        foreach (['renderBriefCard', 'syl-tab', 'syl-card', 'syl-cards-grid', 'syl-page-title', 'syl-assess-bar', 'syl-wrapper'] as $old) {
            $this->assertStringNotContainsString($old, $js, "$old is still in syllabus.js");
        }
    }

    // ── the list: title, counts, search, chips, rows ─────────────────────────────────────────────

    public function test_the_list_has_a_title_a_counts_line_a_search_box_and_term_chips(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('<h1 class="syl-mobile-title">Syllabus</h1>', $js);
        $this->assertStringContainsString('id="sylMobileSub"', $js);
        $this->assertStringContainsString('id="sylMobileSearch"', $js);
        $this->assertStringContainsString('oninput="sylMobileSearch(this.value)"', $js);
        $this->assertStringContainsString('role="group" aria-label="Choose a term"', $js);
        // the search box is 16px so iOS does not zoom the page when it is focused
        $this->assertMatchesRegularExpression('/\.syl-mobile-search \{[^}]*font-size: 16px;/s', $this->phoneCss());
        // chips are 32px high with 13px text and a 6px gap, the same as the other quiet lists
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.syl-mobile-chips \{[^}]*gap: 6px;/s', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-chip \{[^}]*height: 32px;/s', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-chip \{[^}]*font-size: 13px;/s', $css);
    }

    public function test_the_counts_line_names_the_term_says_when_it_is_current_and_counts_subjects(): void
    {
        $script = $this->phoneScript();
        $summary = $this->between($script, 'function sylMobileSummary(', "\n}\n");
        $this->assertStringContainsString('<b>Term ${active}</b>', $summary);
        $this->assertStringContainsString("active === cur ? 'Current · ' : ''", $summary);
        $this->assertStringContainsString('${shown} of ${total} subject', $summary, 'while searching it reads "x of N subjects"');
    }

    public function test_every_row_carries_its_index_and_term_and_opens_the_subject(): void
    {
        $row = $this->between($this->phoneScript(), 'function sylMobileRowHtml(', "\n}\n");
        $this->assertStringContainsString('data-idx="${idx}"', $row);
        $this->assertStringContainsString('data-term="${sylEsc(b.term)}"', $row);
        $this->assertStringContainsString('onclick="openMobileSyllabusBrief(${idx})"', $row);
        $this->assertStringContainsString('role="button" tabindex="0"', $row, 'a row can be reached and opened from the keyboard');
        $this->assertStringContainsString("event.key === 'Enter'", $row);
        $this->assertStringContainsString('No topics yet', $row);
    }

    public function test_rows_use_the_same_inset_and_hairline_as_the_other_quiet_lists(): void
    {
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.syl-mobile-row \{[^}]*padding: 11px 20px;/s', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-row::before \{[^}]*left: 58px;/s', $css);
        $this->assertStringContainsString('.syl-mobile-row--first::before', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-row:active \{[^}]*var\(--qm-press\)/s', $css);
    }

    // ── search and term switching ────────────────────────────────────────────────────────────────

    public function test_search_looks_at_the_subject_the_teacher_and_the_topics_within_the_chosen_term(): void
    {
        $apply = $this->between($this->phoneScript(), 'function sylMobileApply() {', "\n}\n");
        $this->assertStringContainsString('Number(b.term) === active', $apply, 'only the chosen term is searched');
        $this->assertStringContainsString("b.subject || ''", $apply);
        $this->assertStringContainsString("b.teacher || ''", $apply);
        $this->assertStringContainsString("(Array.isArray(b.topics) ? b.topics : []).join(' ')", $apply);
        $this->assertStringContainsString('hay.includes(term)', $apply);
        // the first visible row loses its top hairline, recomputed after every filter
        $this->assertStringContainsString("row.classList.toggle('syl-mobile-row--first', show && shown === 0)", $apply);
        // the counts line and the "No matches" state follow the filter
        $this->assertStringContainsString("getElementById('sylMobileSub')", $apply);
        $this->assertStringContainsString('No matches for "', $apply);
        // the page height changes without a scroll event, so the header and bottom nav are re-checked
        $this->assertStringContainsString('recalcMobileScrollUI', $apply);
    }

    public function test_the_search_text_is_remembered_with_the_rest_of_the_page_state(): void
    {
        $js = $this->js();
        $search = $this->between($this->phoneScript(), 'window.sylMobileSearch = function', "\n};\n");
        $this->assertStringContainsString("learnerPageState.update('syllabus', { mobileSearch: val })", $search);
        $this->assertStringContainsString("document.getElementById('sylMobileSearch')?.value", $this->between($js, 'function saveSyllabusPageState() {', "\n}\n"));
        $restore = $this->between($js, 'function restoreSyllabusPageState() {', "\n}\n");
        $this->assertStringContainsString('state.mobileSearch', $restore);
        $this->assertStringContainsString('window.sylMobileSearch(state.mobileSearch)', $restore);
        // the saved term chip is found by the same id the markup gives it
        $this->assertStringContainsString('syl-mob-tab-${state.activeTerm}', $restore);
        $this->assertStringContainsString('id="syl-mob-tab-${t}"', $js);
    }

    public function test_choosing_a_term_moves_the_chip_highlight_and_refilters_the_rows(): void
    {
        $switch = $this->between($this->js(), 'window.switchSylTab = function(term) {', "\n};\n");
        $this->assertStringContainsString("document.querySelectorAll('.syl-mobile-chip')", $switch);
        $this->assertStringContainsString("c.classList.toggle('on', on)", $switch);
        $this->assertStringContainsString("c.setAttribute('aria-pressed'", $switch);
        $this->assertStringContainsString('sylMobileApply();', $switch);
        // the desktop list is still re-rendered by the same function
        $this->assertStringContainsString('window.sylRenderDesktopList()', $switch);
    }

    public function test_the_list_is_filtered_as_soon_as_it_is_drawn_from_the_cache_or_from_the_network(): void
    {
        $fetch = $this->between($this->js(), 'window.fetchSyllabus = async function() {', "\n};\n");
        $this->assertSame(2, preg_match_all('/sylInitDesktop\(\);\s*\n\s*sylMobileApply\(\);\s*\n\s*restoreSyllabusPageState\(\);/', $fetch), 'sylMobileApply() runs after both the cached and the fetched render, before the saved state is restored');
    }

    // ── the open subject ─────────────────────────────────────────────────────────────────────────

    public function test_an_open_subject_shows_the_teacher_the_topic_count_and_labelled_sections(): void
    {
        $detail = $this->between($this->phoneScript(), 'function sylMobileDetailHtml(b) {', "\n}\n");
        $this->assertStringContainsString('Term ${sylEsc(b.term)}', $detail);
        $this->assertStringContainsString('syl-mobile-detail-status">Current', $detail);
        $this->assertStringContainsString('<h1 class="syl-mobile-detail-title">', $detail);
        $this->assertStringContainsString('Updated ${sylEsc(updated)}', $detail);
        $this->assertStringContainsString('syl-mobile-detail-fact-label">Teacher', $detail);
        $this->assertStringContainsString('syl-mobile-detail-fact-label">Topics', $detail);
        $this->assertStringContainsString('Note from ${sylEsc(b.teacher)}', $detail);
        $this->assertStringContainsString('Syllabus topics', $detail);
        $this->assertStringContainsString('Assessment weighting', $detail);
        $this->assertStringContainsString('No details have been posted for this subject yet.', $detail);
    }

    public function test_the_weighting_bars_are_one_neutral_colour_and_never_leave_their_track(): void
    {
        $detail = $this->between($this->phoneScript(), 'function sylMobileDetailHtml(b) {', "\n}\n");
        $this->assertStringContainsString('Math.max(0, Math.min(100, Number(a.weight) || 0))', $detail, 'a missing, negative or over-100 weight cannot break the bar');
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.syl-mobile-assess-fill \{[^}]*background: var\(--qm-body\);/s', $css);
        $this->assertStringNotContainsString('hsl(', $detail);
        $this->assertStringNotContainsString('rgb(', $detail);
    }

    public function test_text_from_the_teacher_is_escaped_in_the_rows_and_the_open_subject(): void
    {
        $script = $this->phoneScript();
        $row = $this->between($script, 'function sylMobileRowHtml(', "\n}\n");
        $detail = $this->between($script, 'function sylMobileDetailHtml(b) {', "\n}\n");
        foreach (['b.subject', 'b.teacher'] as $field) {
            $this->assertStringContainsString("sylEsc($field)", $row);
            $this->assertStringContainsString("sylEsc($field)", $detail);
        }
        foreach (['b.notes', 'a.type', 'a.weight', 'b.term'] as $field) {
            $this->assertStringContainsString("sylEsc($field)", $detail);
        }
        $this->assertStringContainsString('sylEsc(t)', $detail, 'each topic is escaped');
        // nothing from the API is dropped into the markup raw
        $this->assertDoesNotMatchRegularExpression('/\$\{(?:b|a)\.(?:subject|teacher|notes|type|weight|term)\}/', $row . $detail);
    }

    public function test_opening_a_subject_keeps_the_bottom_nav_and_goes_back_to_the_list(): void
    {
        $open = $this->between($this->phoneScript(), 'window.openMobileSyllabusBrief = function (idx) {', "\n};\n");
        $this->assertStringContainsString('if (window.innerWidth > 899) return;', $open, 'desktop never opens the phone detail');
        $this->assertStringContainsString("mode: 'detail'", $open);
        $this->assertStringContainsString("detailType: 'Syllabus'", $open);
        $this->assertStringContainsString("backLabel: 'Syllabus'", $open);
        $this->assertStringContainsString('backAction: () => window.fetchSyllabus()', $open);
        // detail mode hides the bottom nav; the phone detail screens put it back
        $this->assertStringContainsString("getElementById('mobileBottomNav')", $open);
        $this->assertStringContainsString("nav.style.setProperty('display', 'flex', 'important')", $open);
        $this->assertStringContainsString('sylMobileDetailHtml(b)', $open);
    }

    public function test_the_list_scroll_is_saved_before_the_detail_opens_and_not_overwritten_by_it(): void
    {
        $js = $this->js();
        $open = $this->between($this->phoneScript(), 'window.openMobileSyllabusBrief = function (idx) {', "\n};\n");
        $this->assertLessThan(strpos($open, 'window._sylMobDetail = true;'), strpos($open, 'saveSyllabusPageState();'), 'the list state is saved first');
        $save = $this->between($js, 'function saveSyllabusPageState() {', "\n}\n");
        $this->assertStringContainsString('if (window._sylMobDetail) return;', $save);
        // drawing the list again clears the flag
        $this->assertStringContainsString('window._sylMobDetail = false;', $this->between($js, 'window._sylSelectedIdx = null;', 'window._sylMobTerm = '));
    }

    public function test_the_detail_embeds_its_own_style_because_it_replaces_the_page(): void
    {
        $detail = $this->between($this->phoneScript(), 'function sylMobileDetailHtml(b) {', "\n}\n");
        $this->assertStringContainsString('${sylQuietStyle()}', $detail);
        $this->assertStringContainsString('<div class="syl-mobile-layout">', $detail, 'the light-mode gate recognises the open subject by this class');
        $this->assertSame(2, substr_count($this->js(), '${sylQuietStyle()}'), 'the list and the detail each embed the style');
    }

    public function test_the_detail_uses_the_same_look_as_the_assignment_detail(): void
    {
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.syl-mobile-detail-title \{[^}]*font-size: 26px;[^}]*font-weight: 600;/s', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-detail \{ padding: 8px 20px 96px; \}/', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-detail-facts \{[^}]*border-radius: 18px;/s', $css);
        $this->assertMatchesRegularExpression('/\.syl-mobile-detail-facts \{[^}]*background: var\(--qm-surf\);/s', $css);
    }

    // ── desktop and light mode ───────────────────────────────────────────────────────────────────

    public function test_the_phone_parts_are_hidden_from_900px_up_and_the_desktop_split_layout_is_kept(): void
    {
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/@media \(min-width: 900px\) \{\s*\.syl-mobile-head, \.syl-mobile-search-wrap, \.syl-mobile-chips, \.syl-mobile-list, \.syl-mobile-detail \{ display: none !important; \}/', $css);
        $js = $this->js();
        $this->assertStringContainsString('.syl-desktop-layout { display: flex !important; }', $js);
        $this->assertStringContainsString('.syl-mobile-layout  { display: none  !important; }', $js);
        foreach (['sylInitDesktop', 'sylRenderDesktopList', 'selectDesktopSyllabusBrief', 'sylSelectFirst'] as $desktop) {
            $this->assertStringContainsString($desktop, $js, "$desktop (desktop) was lost");
        }
    }

    public function test_light_mode_only_changes_the_colour_tokens_in_both_light_blocks(): void
    {
        $css = $this->phoneCss();
        $widerLight = $this->between($css, 'Light mode: learner Syllabus (769px to 899px)', 'Light mode: learner Syllabus (phones)');
        $phoneLight = substr($css, strpos($css, 'Light mode: learner Syllabus (phones)'));
        $this->assertStringContainsString('@media (min-width: 769px)', $widerLight);
        $this->assertStringContainsString('html[data-learner-theme="light"]', $widerLight);
        $this->assertStringContainsString('@media (max-width: 768px)', $phoneLight);
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"]', $phoneLight);
        foreach ([$widerLight, $phoneLight] as $block) {
            foreach (['--qm-title: #282924;', '--qm-body: #4a4b44;', '--qm-muted: #73746d;', '--qm-surf: #f1efe8;', '--qm-chipon: #252624;', '--qm-chipon-text: #faf9f5;'] as $token) {
                $this->assertStringContainsString($token, $block);
            }
            // only custom properties are set, so nothing else about the page changes in light mode
            preg_match_all('/^\s*([a-z-]+)\s*:/m', substr($block, strpos($block, '{', strpos($block, 'html[') + 1)), $props);
            foreach ($props[1] as $prop) {
                $this->assertStringStartsWith('--qm-', $prop, "light mode sets $prop, not just a colour token");
            }
        }
    }

    public function test_the_dark_tokens_match_the_other_quiet_lists(): void
    {
        $css = $this->phoneCss();
        foreach ([
            '--qm-title: #ecece9;', '--qm-body: #c2c3b7;', '--qm-muted: #8b8b87;', '--qm-faint: #5f605a;',
            '--qm-surf: #272726;', '--qm-ring: #73746d;', '--qm-chipon: #ecece9;', '--qm-chipon-text: #20201f;',
        ] as $token) {
            $this->assertStringContainsString($token, $css);
        }
    }

    // ── versions ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_dashboard_loads_the_new_script_with_a_fresh_version_number(): void
    {
        $this->assertStringContainsString('syllabus.js?v=4.7', $this->source('learner_dashboard.php'));
        $this->assertStringNotContainsString('syllabus.js?v=4.6', $this->source('learner_dashboard.php'));
    }
}
