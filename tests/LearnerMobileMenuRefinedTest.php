<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the refined learner phone menu (assets/css/learner/mobile_menu.css). Same drawer, same markup and same
 * scripts as before; the CSS arranges it differently:
 *   - no colour accent: the current page is a lifted row, counts are a neutral pill, the search match is bold text
 *   - the My class (or Join a class) card sits at the top, above the groups
 *   - two groups, School (Announcements, Calendar) and Academics (Gradebook, Syllabus, Evaluations)
 *   - search is a 44px icon button in the school row instead of a full-width field
 *   - the account row ends in "..." (it opens a sheet), not the up/down arrows of the desktop popover
 * The teacher phone menu and the desktop menus are not part of this change.
 * Checked by eye in a phone-sized browser with the real stylesheet, in dark and light mode, with a class, with a long
 * class name and with no class yet; these read the source so the pieces are not quietly undone.
 */
final class LearnerMobileMenuRefinedTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_the_phone_menu_has_no_colour_accent(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        // the old teal (dark) and its darker light-mode twin are gone
        $this->assertStringNotContainsString('#4fd1c5', $css);
        $this->assertStringNotContainsString('#187a72', $css);
        $this->assertStringNotContainsString('#06201d', $css);

        // the name stays defined (the desktop menu rules for focus rings and the join select read it) but follows the text colour
        $this->assertSame(2, substr_count($css, '--dm-accent: var(--dm-text);'), 'dark and light both follow the text colour');

        // the active row is lifted, with no accent icon
        $this->assertStringContainsString('.dm-item.active { background: var(--dm-active); color: var(--dm-text);', $css);
        $this->assertStringNotContainsString('.dm-item.active::before', $css);
    }

    public function test_counts_are_a_neutral_pill_in_both_themes(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        $this->assertMatchesRegularExpression('/\.dmm-badge \{[^}]*background: var\(--dm-badge-bg\); color: var\(--dm-badge-text\);/s', $css);
        $this->assertStringContainsString('--dm-badge-bg: #ecece9;', $css);
        $this->assertStringContainsString('--dm-badge-bg: #282924; --dm-badge-text: #faf9f5;', $css);
        // the bar's badge keeps its place on the tab icon
        $this->assertStringContainsString('#mobileBottomNav .dmm-badge { position: absolute; top: 6px;', $css);
    }

    public function test_my_class_is_a_card_at_the_top(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        // above the first heading (order 15) and the rows; the join form follows it
        $this->assertStringContainsString('#nav-myclass-sidebar { order: 5;', $css);
        $this->assertStringContainsString('#nav-joinclass-sidebar { order: 5;', $css);
        $this->assertStringContainsString('.join-status { order: 6; }', $css);

        $card = substr($css, (int) strpos($css, '/* -- My class card'));
        $this->assertStringContainsString('grid-template-columns: 38px minmax(0, 1fr) 20px;', $card);
        $this->assertStringContainsString('height: 68px;', $card);
        $this->assertStringContainsString('var(--dm-card)', $card);
        // the class name over "My Class" when there is a class name; the name alone ("Join a Class") otherwise
        $this->assertStringContainsString('#nav-myclass-sidebar:has(.dm-meta)', $card);
        $this->assertStringContainsString('grid-area: name; max-width: none;', $card);
        // both themes define the card colours
        $this->assertSame(2, substr_count($css, '--dm-card-line:'));
        $this->assertStringContainsString('--dm-card: #ffffff;', $css);

        // the line between Calendar and My Class has nothing to separate any more
        $this->assertStringContainsString('.dm-sep--b, html body .sidebar.dm-menu .dm-sep--c, html body .sidebar.dm-menu .footer { display: none; }', $css);
    }

    public function test_two_groups_School_and_Academics(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        $this->assertStringContainsString(".sidebar-links::before { content: 'School'; order: 15; }", $css);
        $this->assertStringContainsString(".dm-sep--a::before { content: 'Academics'; }", $css);
        $this->assertStringNotContainsString("'Learning'", $css);

        // School: Announcements, Calendar. Academics: Gradebook, Syllabus, Evaluations.
        $order = [];
        foreach (['announcements' => 'Announcements', 'calendar' => 'Calendar', 'grades' => 'Gradebook', 'syllabus' => 'Syllabus', 'evaluations' => 'Evaluations'] as $id => $label) {
            $this->assertSame(1, preg_match('/#nav-' . $id . '-sidebar \{ order: (\d+);/', $css, $m), "$label has no order");
            $order[$label] = (int) $m[1];
        }
        $this->assertLessThan(58, $order['Announcements']);
        $this->assertLessThan(58, $order['Calendar']);
        $this->assertGreaterThan(58, $order['Gradebook'], 'the Academics heading is order 58');
        $this->assertGreaterThan(58, $order['Syllabus']);
        $this->assertGreaterThan(58, $order['Evaluations']);
        $this->assertLessThan($order['Syllabus'], $order['Gradebook']);
        $this->assertLessThan($order['Evaluations'], $order['Syllabus']);
        $this->assertLessThan($order['Calendar'], $order['Announcements']);
    }

    public function test_search_is_an_icon_button_and_the_account_row_ends_in_dots(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        $search = substr($css, (int) strpos($css, "html body .sidebar.dm-menu .dm-search {"), 700);
        $this->assertStringContainsString('position: absolute;', $search);
        $this->assertStringContainsString('width: 44px !important; height: 44px;', $search);
        $this->assertStringContainsString('.dm-search .dm-label { display: none; }', $css);
        // the school row leaves room for it
        $this->assertStringContainsString('padding: 10px 66px 14px 18px;', $css);
        // no light-mode white field any more (it is a bare icon)
        $this->assertStringNotContainsString('.dm-search { background: #ffffff; }', $css);

        // the account row opens a sheet: dots, not the desktop popover's up/down arrows
        $this->assertStringContainsString('-webkit-mask-image: var(--dm-i-more); mask-image: var(--dm-i-more);', $css);
        $this->assertStringNotContainsString('-webkit-mask-image: var(--dm-i-updown)', $css);
    }

    public function test_it_stays_on_phones_and_the_page_links_the_new_version(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');

        // every rule sits inside one of the two max-width: 768px blocks (the file ends with the light block's closing brace)
        $this->assertSame(2, substr_count($css, '@media (max-width: 768px) {'));
        $this->assertSame(0, substr_count($css, "\n@media (min-width"));

        $this->assertStringContainsString('learner/mobile_menu.css?v=2.3', $this->source('learner_dashboard.php'));
    }
}
