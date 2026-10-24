<?php
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Guards for the phone bottom bars of the learner and teacher apps, which follow the parent app's bar: four tabs,
 * 64px high plus the safe area, thin 22px line icons that take the text colour, 11px labels, a bold active tab.
 * The bars keep their own glass background and stay dynamic (clear near the bottom of the page, glass once the
 * page is scrolled). These checks read the source files; the look was checked in a phone-sized browser.
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
    public function test_bar_is_64px_high_plus_the_safe_area_with_the_parent_bar_tab_layout(string $page, string $css): void
    {
        $style = $this->source($css);

        $this->assertStringContainsString('height: calc(64px + env(safe-area-inset-bottom, 0px));', $style);
        $this->assertStringNotContainsString('calc(82px', $style);
        $this->assertMatchesRegularExpression('/#mobileBottomNav a \{[^}]*flex-direction: column;[^}]*justify-content: center;[^}]*gap: 2px;[^}]*font-size: 11px;[^}]*font-weight: 600;/s', $style);
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
        $this->assertMatchesRegularExpression('/#mobileBottomNav\.nav-scrolled \{[^}]*backdrop-filter: blur\(20px\) !important;/s', $style);
    }

    public function test_each_app_keeps_its_own_glass_colour(): void
    {
        $learner = $this->source('assets/css/learner/learner_dashboard.css');
        $teacher = $this->source('assets/css/teacher/teacher_dashboard.css');

        $this->assertStringContainsString('background: rgba(32, 32, 31, 0.85) !important;', $learner);
        $this->assertStringContainsString('background: rgba(66,65,65,0.35) !important;', $teacher);

        // Light phone theme on the learner side: the light glass, and the parent bar's light tab colours
        $light = $this->source('assets/css/learner/mobile_light.css');
        $this->assertStringContainsString('background: rgba(250,249,245,.88) !important;', $light);
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

        $this->assertStringContainsString('learner_dashboard.css?v=14.0', $learner);
        $this->assertStringContainsString('learner/mobile_menu.css?v=1.9', $learner);
        $this->assertStringContainsString('mobile_light.css?v=2.0', $learner);
        $this->assertStringContainsString('teacher_dashboard.css?v=13.6', $teacher);
        $this->assertStringContainsString('teacher_mobile_menu.css?v=1.2', $teacher);
    }
}
