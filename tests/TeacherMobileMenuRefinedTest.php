<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the refined teacher phone menu (assets/css/teacher/teacher_mobile_menu.css), the same look the learner phone
 * menu has (see LearnerMobileMenuRefinedTest). Same drawer, same markup and same scripts; the CSS changes:
 *   - no colour accent: the current page is a lifted row, counts are a neutral pill, the search match is bold text
 *   - search is a 44px icon button in the school row instead of a full-width field
 *   - the account row ends in "..." (it opens a sheet), not the up/down arrows of the desktop popover
 *   - the first group heading sits closer to the school row
 * Deliberately NOT changed: the teacher app's own dark colours (drawer #06080b, raised #161b22, page #0d1117), the groups and
 * the items in them, the one-line school name that ends in dots, the avatar circle, and the bottom bar (including its
 * "Announcement" label, which is already tight on a 320px phone). The learner and parent menus and the desktop menu are
 * not part of this change.
 * Checked by eye in a phone-sized browser with the real stylesheet, in dark and light mode, with a long school name and a
 * long teacher name; these read the source so the pieces are not quietly undone.
 */
final class TeacherMobileMenuRefinedTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_the_phone_menu_has_no_colour_accent(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        // the old teal (dark) and its darker light-mode twin are gone
        $this->assertStringNotContainsString('#4fd1c5', $css);
        $this->assertStringNotContainsString('#187a72', $css);
        $this->assertStringNotContainsString('#06201d', $css);

        // the name stays defined (focus rings and selects read it) but follows the text colour, in dark and in light
        $this->assertSame(2, substr_count($css, '--dm-accent: var(--dm-text);'));

        // the active row is lifted, with no accent icon
        $this->assertStringContainsString('.dm-item.active { background: var(--dm-active); color: var(--dm-text);', $css);
        $this->assertStringNotContainsString('.dm-item.active::before', $css);
        $this->assertStringContainsString('.dmm-s-row b { color: var(--dm-text); font-weight: 600; }', $css);
    }

    public function test_counts_are_a_neutral_pill_in_both_themes(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        $this->assertMatchesRegularExpression('/\.dmm-badge \{[^}]*background: var\(--dm-badge-bg\); color: var\(--dm-badge-text\);/s', $css);
        $this->assertStringContainsString('--dm-badge-bg: #e6edf3;', $css);
        $this->assertStringContainsString('--dm-badge-text: #0d1117;', $css);
        $this->assertStringContainsString('--dm-badge-bg: #282924; --dm-badge-text: #faf9f5;', $css);
        // the bar's badge keeps its place on the tab icon, with the ring in the page colour
        $this->assertStringContainsString('#mobileBottomNav .dmm-badge { position: absolute; top: 6px;', $css);
        $this->assertStringContainsString('border: 2px solid #0d1117;', $css);
    }

    public function test_the_teacher_apps_own_dark_colours_are_unchanged(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        foreach ([
            '--dm-bg: #06080b;', '--dm-raise: #161b22;', '--dm-hover: rgba(255,255,255,.055);', '--dm-active: rgba(255,255,255,.09);',
            '--dm-line: rgba(255,255,255,.08);', '--dm-text: #e6edf3;', '--dm-soft: #b1bac4;', '--dm-muted: #7d8590;', '--dm-faint: #545d68;',
        ] as $token) {
            $this->assertStringContainsString($token, $css, $token . ' changed');
        }
        // and it did not take the learner's #20201f
        $this->assertStringNotContainsString('#20201f', $css);
        $this->assertStringNotContainsString('#161615', $css);
    }

    public function test_search_is_an_icon_button_and_the_school_row_leaves_room_for_it(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        $search = substr($css, (int) strpos($css, "html body .sidebar.dm-menu .dm-search {"), 700);
        $this->assertStringContainsString('position: absolute;', $search);
        $this->assertStringContainsString('width: 44px !important; height: 44px;', $search);
        $this->assertStringContainsString('.dm-search .dm-label { display: none; }', $css);
        $this->assertStringContainsString('.dm-search::before { width: 22px; height: 22px; }', $css);
        // the school row leaves room for it, and the name still stays on one line and ends in dots
        $this->assertStringContainsString('padding: 10px 66px 14px 18px;', $css);
        $name = substr($css, (int) strpos($css, '.dm-brand-name {'), 300);
        $this->assertStringContainsString('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', $name);
        // no light-mode white field any more (it is a bare icon)
        $this->assertStringNotContainsString('.dm-search { background: #ffffff; }', $css);
    }

    public function test_the_account_row_ends_in_dots_and_keeps_its_layout(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        // it opens a sheet: dots, not the desktop popover's up/down arrows
        $this->assertStringContainsString('-webkit-mask-image: var(--dm-i-more); mask-image: var(--dm-i-more);', $css);
        $this->assertStringNotContainsString('-webkit-mask-image: var(--dm-i-updown)', $css);
        // the row itself is as before (MenuRoleAndYearTest and AvatarAndSelectedIconTest pin the rest)
        $this->assertStringContainsString('"av name chev" "av role chev"; align-content: center;', $css);
        $this->assertStringContainsString('background: rgba(0,0,0,.35); border: 0; color: #f4e4e4;', $css);
    }

    public function test_the_groups_and_items_are_as_before(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        $this->assertStringContainsString(".sidebar-links::before { content: 'Teaching'; order: 15; }", $css);
        $this->assertStringContainsString(".dm-sep--a::before { content: 'Academics'; }", $css);
        // Quizzes, Grades | Syllabus, Evaluations, Calendar | Settings, in that order
        $order = [];
        foreach (['teacher_quizzes' => 'Quizzes', 'teacher_grades' => 'Grades', 'teacher_syllabus' => 'Syllabus', 'teacher_evaluations' => 'Evaluations', 'teacher_calendar' => 'Calendar', 'teacher_settings' => 'Settings'] as $page => $label) {
            $this->assertSame(1, preg_match('/\[data-page="' . $page . '"\] \{ order: (\d+);/', $css, $m), "$label has no order");
            $order[] = (int) $m[1];
        }
        $sorted = $order;
        sort($sorted);
        $this->assertSame($sorted, $order, 'the items keep their order');
        // the first heading sits closer to the school row; the later one keeps the group spacing
        $this->assertStringContainsString('.sidebar-links::before { margin-top: 10px; }', $css);
        $this->assertStringContainsString('margin: 20px 0 6px;', $css);
    }

    public function test_it_stays_on_phones_and_the_page_links_the_new_version(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');

        // every rule sits inside the one max-width: 768px block (the file ends with its closing brace)
        $this->assertSame(1, substr_count($css, '@media (max-width: 768px) {'));
        $this->assertSame(0, substr_count($css, "\n@media (min-width"));

        $page = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('teacher_mobile_menu.css?v=1.9', $page);
        // the bar label is left as it was
        $this->assertStringContainsString('<span>Announcement</span>', $page);
    }
}
