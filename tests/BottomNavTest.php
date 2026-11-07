<?php
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Guards for the phone bottom bars of the learner and teacher apps, which follow the parent app's bar: four tabs,
 * thin 22px line icons (the parent bar's glyphs) that take the text colour, 11px labels, a bold active tab.
 * The bars are 88px high plus the safe area (the old bar was 82px, the parent bar is 64px). They keep their own
 * glass colour and stay dynamic (clear near the bottom of the page, glass once the page is scrolled). These checks
 * read the source files; the look was checked in a phone-sized browser.
 */
final class BottomNavTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The <nav id="mobileBottomNav"> element of a dashboard page. */
    private function nav(string $path): string
    {
        $html = $this->source($path);
        $this->assertSame(1, preg_match('#<nav id="mobileBottomNav".*?</nav>#s', $html, $m), "no bottom nav in $path");
        return $m[0];
    }

    /** @return array<string, array{string, string}> */
    public static function dashboards(): array
    {
        return [
            'learner' => ['learner_dashboard.php', 'assets/css/learner/learner_dashboard.css'],
            'teacher' => ['teacher_dashboard.php', 'assets/css/teacher/teacher_dashboard.css'],
        ];
    }

    #[DataProvider('dashboards')]
    public function test_bar_has_four_tabs_with_thin_line_icons_and_labels(string $page, string $css): void
    {
        $nav = $this->nav($page);

        $this->assertSame(4, preg_match_all('#<a [^>]*data-page="#', $nav), 'four tabs');
        $this->assertSame(4, preg_match_all('#<svg [^>]*width="22" height="22"[^>]*stroke="currentColor" stroke-width="1.8"#', $nav), '22px line icons in the text colour');
        $this->assertSame(4, preg_match_all('#<span>[^<]+</span>#', $nav), 'a label under each icon');

        // No coloured icon boxes or inline colours any more
        $this->assertStringNotContainsString('lh-nav-box', $nav);
        $this->assertStringNotContainsString('style="', $nav);
        $this->assertDoesNotMatchRegularExpression('/stroke="#/', $nav);
    }

    public function test_tabs_use_the_parent_bars_clean_icons(): void
    {
        $parent = $this->source('parent_dashboard.php');
        $learner = $this->nav('learner_dashboard.php');
        $teacher = $this->nav('teacher_dashboard.php');

        // The glyphs the parent bar uses for Home, Syllabus (an open book) and News (a bell)
        $home = '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>';
        $book = '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>';
        $bell = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';
        foreach ([$home, $book, $bell] as $glyph) {
            $this->assertStringContainsString($glyph, $parent);
        }

        // Home and Resources on both bars, Announcement (the News bell) on the teacher bar
        foreach ([$learner, $teacher] as $nav) {
            $this->assertStringContainsString($home, $nav);
            $this->assertStringContainsString($book, $nav);
        }
        $this->assertStringContainsString($bell, $teacher);

        // Quiz and Assignments have no parent tab; they are drawn in the same style (no filled shapes, no old pencil)
        $this->assertStringContainsString('<circle cx="12" cy="12" r="9"/>', $learner);
        $this->assertStringNotContainsString('M16.5 3.5a2.12', $learner);
        $this->assertStringNotContainsString('M11 5L6 9H2v6h4l5 4V5z', $teacher);
    }

    public function test_learner_tabs_still_open_the_same_pages(): void
    {
        $nav = $this->nav('learner_dashboard.php');

        foreach ([
            'nav-home' => ['loadManual', 'partials/manual.html', 'Home'],
            'nav-quiz' => ['fetchQuizzes', 'quiz_list.php', 'Quiz'],
            'nav-assignments' => ['fetchAssignments', 'assignment_list.php', 'Assignments'],
            'nav-resources' => ['fetchResources', 'resource_list.php', 'Resources'],
        ] as $id => [$handler, $dataPage, $label]) {
            $this->assertMatchesRegularExpression('#<a [^>]*onclick="return handleLearnerMobileBottomNav\(event, ' . $handler . '\)"[^>]*data-page="' . preg_quote($dataPage, '#') . '" id="' . $id . '">#', $nav);
            $this->assertStringContainsString("<span>$label</span>", $nav);
        }
    }

    public function test_teacher_tabs_still_open_the_same_pages(): void
    {
        $nav = $this->nav('teacher_dashboard.php');

        foreach ([
            'teacher_manual' => ['loadTeacherManual', 'Home'],
            'teacher_assignments' => ['fetchTeacherAssignments', 'Assignments'],
            'teacher_resources' => ['fetchTeacherResources', 'Resources'],
            'teacher_announcements' => ['fetchTeacherAnnouncements', 'Announcement'],
        ] as $dataPage => [$handler, $label]) {
            $this->assertStringContainsString('data-page="' . $dataPage . '" onclick="' . $handler . '()"', $nav);
            $this->assertStringContainsString("<span>$label</span>", $nav);
        }
    }

    #[DataProvider('dashboards')]
    public function test_icons_and_labels_sit_at_the_top_of_the_85px_bar(string $page, string $css): void
    {
        $style = $this->source($css);

        $this->assertMatchesRegularExpression('/:root \{ --mbn-h: 85px; \}/', $style);
        $this->assertStringContainsString('height: calc(var(--mbn-h) + env(safe-area-inset-bottom, 0px));', $style);
        $this->assertStringNotContainsString('calc(82px', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav a \{[^}]*flex-direction: column;[^}]*justify-content: flex-start;[^}]*padding-top: 10px;[^}]*gap: 2px;[^}]*font-size: 11px;[^}]*font-weight: 600;/s', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav a\.active \{[^}]*font-weight: 700;/s', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav a svg[^}]*width: 22px;[^}]*height: 22px;/s', $style);

        // The active tab no longer lifts or takes an accent colour
        $this->assertStringNotContainsString('translateY(-3px)', $style);
    }

    #[DataProvider('dashboards')]
    public function test_bar_keeps_its_glass_background_and_stays_dynamic(string $page, string $css): void
    {
        $style = $this->source($css);

        // Clear at rest, glass once the page is scrolled (the nav-scrolled class is toggled by the dashboard scripts)
        $this->assertMatchesRegularExpression('/DYNAMIC BOTTOM NAV/', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav \{[^}]*background: transparent !important;/s', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav\.nav-scrolled \{[^}]*backdrop-filter: blur\(28px\) saturate\(180%\) !important;/s', $style);
    }

    public function test_each_app_keeps_its_own_glass_colour(): void
    {
        $learner = $this->source('assets/css/learner/learner_dashboard.css');
        $teacher = $this->source('assets/css/teacher/teacher_dashboard.css');

        // The same colours as before, more see-through, with a stronger blur
        $this->assertStringContainsString('background: rgba(32, 32, 31, 0.55) !important;', $learner);
        $this->assertStringContainsString('backdrop-filter: blur(28px) saturate(180%) !important;', $learner);
        $this->assertStringContainsString('background: rgba(66,65,65,0.32) !important;', $teacher);
        $this->assertStringContainsString('backdrop-filter: blur(28px) saturate(180%) !important;', $teacher);

        // Light phone theme on the learner side: the light glass, and the parent bar's light tab colours
        $light = $this->source('assets/css/learner/mobile_light.css');
        $this->assertStringContainsString('background: rgba(250,249,245,.62) !important;', $light);
        $this->assertStringContainsString('#mobileBottomNav a { color: #6a6b64; }', $light);
        $this->assertStringContainsString('#mobileBottomNav a.active { color: #282924; }', $light);
        $this->assertStringNotContainsString('lh-nav-box', $light);
    }

    #[DataProvider('dashboards')]
    public function test_bar_slides_with_the_page_when_the_menu_opens(string $page): void
    {
        $css = $this->source($page === 'learner_dashboard.php' ? 'assets/css/learner/mobile_menu.css' : 'assets/css/teacher/teacher_mobile_menu.css');

        $this->assertStringContainsString('html body .sidebar.active ~ #mobileBottomNav {', $css);
        $this->assertMatchesRegularExpression('/\.sidebar\.active ~ #mobileBottomNav \{\s*transform: translate3d\(var\(--dmm-w\), 0, 0\)/', $css);
        // The badge sits on the icon's top right corner inside the shorter bar
        $this->assertStringContainsString('#mobileBottomNav .dmm-badge { position: absolute; top: 6px;', $css);
    }

    public function test_changed_stylesheets_have_new_cache_versions(): void
    {
        $learner = $this->source('learner_dashboard.php');
        $teacher = $this->source('teacher_dashboard.php');

        $this->assertStringContainsString('learner_dashboard.css?v=14.6', $learner);
        $this->assertStringContainsString('learner/mobile_menu.css?v=2.2', $learner);
        $this->assertStringContainsString('mobile_light.css?v=2.1', $learner);
        $this->assertStringContainsString('learner/quiz.css?v=6.9', $learner);
        $this->assertStringContainsString('teacher_dashboard.css?v=14.3', $teacher);
        $this->assertStringContainsString('teacher_mobile_menu.css?v=1.8', $teacher);
    }
}
