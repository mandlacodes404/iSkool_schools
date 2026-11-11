<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the teacher light mode on phones (assets/css/teacher/teacher_mobile_light.css, teacher_mobile_theme.js
 * and the light block at the end of teacher_mobile_menu.css). It is built the same way as the learner's
 * (MobileLightModeTest): a page only turns light once it has been converted, so a typo in a marker or a rule that
 * escapes the gate would leave a page the wrong colour with no error. These checks read the source files; the look
 * itself was checked in a phone-sized browser.
 */
final class TeacherMobileLightModeTest extends TestCase
{
    private const LIGHT_ATTR = 'html[data-teacher-mobile-theme="light"]';

    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The marker list inside the gate: ":is(.ms, .as-mobile-list, ...)" */
    private function gate_markers(string $css): array
    {
        $this->assertGreaterThan(0, preg_match_all('/:has\(:where\(#api-content-area\) :is\(([^)]*)\)\)/', $css, $m));
        $this->assertCount(1, array_unique($m[1]), 'every gate must list the same pages');
        return array_map('trim', explode(',', $m[1][0]));
    }

    public function test_every_rule_in_the_light_stylesheet_is_behind_the_page_gate(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_light.css');

        // Every :has( ) must start with :where(#api-content-area): the drawer, the header and the bottom bar are all in
        // the document on every page, so a gate that looks anywhere else would be true on every page.
        $this->assertSame(0, preg_match('/:has\((?!:where\(#api-content-area\))/', $css), 'every :has( ) gate must start with :where(#api-content-area)');

        $gates = preg_match_all('/:has\(:where\(#api-content-area\) :is\(/', $css);
        // a rule starts a line with the light attribute; a selector list continues on the lines that follow it
        $starts = preg_match_all('/^html\[data-teacher-mobile-theme="light"\]/m', $css);
        $this->assertGreaterThan(50, $gates);
        $this->assertSame($starts, $gates, 'every selector in teacher_mobile_light.css must carry the light attribute and the gate');

        // phones only: the whole file is one @media block, so nothing in it can reach the desktop light mode
        $this->assertSame(1, preg_match_all('/^@media /m', $css));
        $this->assertStringContainsString('@media (max-width: 768px) {', $css);
    }

    public function test_light_page_background_cannot_be_painted_over_by_the_dark_one(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_light.css');
        $this->assertMatchesRegularExpression('/body #api-content-area \{ background: #faf9f5 !important; \}/', $css);
    }

    public function test_the_script_and_the_gate_list_the_same_pages(): void
    {
        $js = $this->source('assets/js/teacher/teacher_mobile_theme.js');
        $this->assertStringContainsString('function lightOnScreen()', $js);
        $this->assertSame(1, preg_match("/var PAGE = '([^']+)';/", $js, $m));
        $from_js = array_map('trim', explode(',', $m[1]));
        $this->assertSame($this->gate_markers($this->source('assets/css/teacher/teacher_mobile_light.css')), $from_js);
    }

    public function test_every_marker_in_the_gate_is_markup_a_page_really_draws(): void
    {
        // A typo in a marker would leave that page dark with no error, so each one must exist in its page's script.
        $where = [
            'class="ms'         => 'assets/js/teacher/teacher_mobile_settings.js',
            'class="thx'        => 'assets/js/teacher/dashboard.js',
            'as-mobile-list'    => 'assets/js/teacher/assignments.js',
            'as-mobile-detail'  => 'assets/js/teacher/assignments.js',
            'as-error-message'  => 'assets/js/teacher/assignments.js',
            'qz-mobile-list'    => 'assets/js/teacher/quizzes.js',
            'qz-mobile-detail'  => 'assets/js/teacher/quizzes.js',
            'qz-error-state'    => 'assets/js/teacher/quizzes.js',
            'an-mobile-list'    => 'assets/js/teacher/announcements.js',
            'an-mobile-detail'  => 'assets/js/teacher/announcements.js',
            'an-error-message'  => 'assets/js/teacher/announcements.js',
            'rs-mobile-list'    => 'assets/js/teacher/resources.js',
            'rs-error-message'  => 'assets/js/teacher/resources.js',
            'ev-mobile-list'    => 'assets/js/teacher/evaluations.js',
            'ev-mobile-detail'  => 'assets/js/teacher/evaluations.js',
            'ev-error-message'  => 'assets/js/teacher/evaluations.js',
            'sbo-mobile-list'   => 'assets/js/teacher/sbo.js',
            'sbo-mobile-detail' => 'assets/js/teacher/sbo.js',
            'sbo-error-message' => 'assets/js/teacher/sbo.js',
            'full-cal-page-wrapper' => 'assets/js/teacher/teacher_calendar.js',
            'gr-mobile-list'    => 'assets/js/teacher/grades.js',
            'gr-mobile-detail'  => 'assets/js/teacher/grades.js',
            'gr-error-message'  => 'assets/js/teacher/grades.js',
        ];
        $markers = implode(' ', $this->gate_markers($this->source('assets/css/teacher/teacher_mobile_light.css')));
        foreach ($where as $needle => $file) {
            $name = in_array($needle, ['class="ms', 'class="thx'], true) ? '.' . substr($needle, 7) : '.' . $needle;
            $this->assertContains($name, $this->gate_markers($this->source('assets/css/teacher/teacher_mobile_light.css')), $name . ' is not in the gate');
            $this->assertStringContainsString($needle, $this->source($file), $needle . ' is not drawn by ' . $file);
        }
        $this->assertNotSame('', $markers);
        // The Quizzes error text had no class of its own; the light gate needs one.
        $this->assertMatchesRegularExpression('/<p class="qz-error-state"[^>]*>\s*Error loading quizzes\./', $this->source('assets/js/teacher/quizzes.js'));
    }

    public function test_status_bar_is_only_light_while_a_light_screen_is_showing(): void
    {
        $js = $this->source('assets/js/teacher/teacher_mobile_theme.js');
        $this->assertStringContainsString("var DARK_BAR = '#0d1117';", $js);
        $this->assertStringContainsString("var LIGHT_BAR = '#faf9f5';", $js);
        // light only when the menu is open or a converted page is showing
        $this->assertStringContainsString("document.querySelector('.sidebar.active') || (area && area.querySelector(PAGE))", $js);
        // it must put the colour back when dashboard.js writes #0d1117 into the meta tag
        $this->assertStringContainsString("attributeFilter: ['content']", $js);

        // the dark bar the script swaps must be the colour the page ships with
        $page = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('<meta name="theme-color" content="#0d1117">', $page);
    }

    public function test_dashboard_loads_the_theme_script_the_key_and_the_stylesheet_in_the_right_order(): void
    {
        $page = $this->source('teacher_dashboard.php');
        $head_end = strpos($page, '</head>');

        // script: once, in <head>, after the theme-color meta tag it edits and after the key it reads
        $this->assertSame(1, substr_count($page, 'assets/js/teacher/teacher_mobile_theme.js'));
        $script = strpos($page, 'assets/js/teacher/teacher_mobile_theme.js');
        $this->assertLessThan($head_end, $script);
        $this->assertLessThan($script, strpos($page, '<meta name="theme-color"'));
        $this->assertLessThan($script, strpos($page, 'window.ISKOOL_TEACHER_MOBILE_THEME_KEY'));

        // the key is per account and is not the desktop key
        $this->assertStringContainsString("'iskoolTeacherMobileTheme:' . hash('sha256'", $page);
        $this->assertStringContainsString('json_encode($teacherMobileThemeStorageKey)', $page);

        // the light stylesheet comes after every sheet it has to beat
        $this->assertSame(1, substr_count($page, 'assets/css/teacher/teacher_mobile_light.css'));
        $light = strpos($page, 'assets/css/teacher/teacher_mobile_light.css');
        $this->assertLessThan($head_end, $light);
        foreach (['teacher_dashboard.css', 'teacher_mobile_menu.css', 'teacher_mobile_settings.css', 'assignments.css', 'teacher_desktop_light_mode.css'] as $sheet) {
            $this->assertLessThan($light, strpos($page, 'assets/css/teacher/' . $sheet), $sheet . ' must load before teacher_mobile_light.css');
        }

        // the canvas behind the page must not stay dark under a light page
        $this->assertStringContainsString('html:not([data-teacher-mobile-theme="light"]) { background-color: #0d1117; }', $page);
    }

    public function test_settings_has_an_appearance_switch_wired_to_the_theme_script(): void
    {
        $js = $this->source('assets/js/teacher/teacher_mobile_settings.js');
        $this->assertStringContainsString('showAppearance', $js);
        $this->assertStringContainsString('Appearance', $js);
        $this->assertStringContainsString('window.iskoolTeacherMobileTheme.set(', $js);
        $this->assertStringContainsString('data-theme-choice', $js);

        $theme = $this->source('assets/js/teacher/teacher_mobile_theme.js');
        $this->assertStringContainsString('window.iskoolTeacherMobileTheme = { get: get, set: set };', $theme);
        $this->assertStringContainsString("'iskool:teacher-mobile-theme'", $theme);
        // phones have their own attribute; the desktop one (data-teacher-theme) must not be touched from here
        $this->assertStringNotContainsString("setAttribute('data-teacher-theme'", $theme);
        $this->assertStringNotContainsString('teacherTheme', $theme);
    }

    public function test_menu_light_block_is_phone_only_and_only_sets_menu_tokens(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');
        $pos = strpos($css, 'data-teacher-mobile-theme="light"');
        $this->assertNotFalse($pos, 'teacher_mobile_menu.css has no light block');
        // every use of the attribute is inside the file's phone @media block, so the desktop menu cannot change
        $this->assertSame(1, preg_match('/^@media \(max-width: 768px\) \{/m', $css));
        $this->assertGreaterThan(strpos($css, '@media (max-width: 768px) {'), $pos);
        $this->assertStringContainsString('--dm-bg: #f4f3ee', $css);
        // no colour accent: the name stays defined for the rules that read it, but follows the text colour
        $this->assertStringContainsString('--dm-accent: var(--dm-text)', substr($css, $pos));
        $this->assertStringNotContainsString('#187a72', $css);
        // the menu is light on every page, so its rules are not behind the page gate
        $this->assertStringNotContainsString(':has(:where(#api-content-area)', substr($css, $pos));
    }

    public function test_the_desktop_light_mode_still_ignores_phones(): void
    {
        // The two light modes must not overlap: the desktop sheet is 769px and up only.
        $desktop = $this->source('assets/css/teacher/teacher_desktop_light_mode.css');
        $this->assertStringContainsString('@media (min-width: 769px)', $desktop);
        $this->assertStringNotContainsString('data-teacher-mobile-theme', $desktop);
    }

    public function test_there_is_no_line_under_the_phone_header(): void
    {
        $css = $this->source('assets/css/teacher/teacher_dashboard.css');
        // the last rule of the phone header block removes every border-bottom the header can get: at rest, scrolled,
        // with and without a page colour
        $this->assertMatchesRegularExpression('/\.top-nav-wrapper,\s*\.top-nav-wrapper\.header-scrolled,\s*\.top-nav-wrapper\.header-scrolled:not\(\[data-page-color\]\)\s*\{\s*border-bottom:\s*none !important;/', $css);
        // configureTeacherHeader used to write a 2px page-colour border inline; nothing should write one again
        $js = $this->source('assets/js/teacher/dashboard.js');
        $this->assertStringNotContainsString('style.borderBottom', $js);
        // and the light stylesheet must not bring a border back
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        $this->assertDoesNotMatchRegularExpression('/\.top-nav-wrapper[^{]*\{[^}]*border-bottom/', $light);
    }

    public function test_home_light_mode_only_re_points_its_colour_variables(): void
    {
        // Home paints from --x-* variables (dashboard.css), so light mode sets new values on .thx instead of
        // repeating every rule. Every variable the page uses must be given a light value.
        $dark = $this->source('assets/css/teacher/dashboard.css');
        preg_match_all('/var\(--(x-[a-z-]+)\)/', $dark, $used);
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        $this->assertSame(1, preg_match('/ \.thx \{(.*?)\}/s', $light, $m));
        foreach (array_unique($used[1]) as $var) {
            $this->assertStringContainsString('--' . $var . ':', $m[1], 'Home uses --' . $var . ' but light mode does not set it');
        }
    }

    public function test_dialogs_and_forms_stay_dark_except_the_two_that_open_from_home_and_calendar(): void
    {
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        // only the dialog that opens from Home is restyled, and only by its own id: the .teacher-modal-* and
        // .mini-cal-modal classes are shared with pages that have not been converted
        $this->assertStringContainsString('#teacherSubjectModal', $light);
        $this->assertStringContainsString('#fullCalModal', $light);
        $this->assertSame(0, preg_match('/\) \.teacher-modal-(?:box|overlay|input|submit|cancel)/', $light));
        $this->assertSame(0, preg_match('/\) \.mini-cal-modal/', $light));
        // not styled here on purpose (the Grades marks forms are the desktop panel, .gr-dp-, and the edit-marks box)
        foreach (['.gr-dp', '.teacher-edit-marks', '#rsVideoOverlay', '.an-delete-modal', '.rs-delete-modal', '#uploadResourceModal', '.an-form-', '#releaseEvalModal', '.ev-delete-modal', '#deleteSBOModal', '.sbo-delete-modal', '.sbo-drawer'] as $left_dark) {
            $this->assertStringNotContainsString($left_dark, $light, $left_dark . ' is meant to stay dark for now');
        }
    }

    public function test_every_grades_screen_on_a_phone_keeps_the_light_page_lit(): void
    {
        // Opening an assessment swaps the whole page for a loading screen, then for the marks (or an error). If any of
        // the three had no marker the page would flash dark between the list and the marks.
        $js = $this->source('assets/js/teacher/grades.js');
        $this->assertSame(2, substr_count($js, '<div class="gr-panel-empty gr-mobile-detail">'), 'the loading and the error screen must carry the marker');
        $this->assertSame(2, substr_count($js, '<div class="gr-mobile-detail td-detail td-detail--grade">'), 'both phone detail views must carry the marker');
        $this->assertStringContainsString('class="gr-mobile-list"', $js);
        $this->assertStringContainsString('class="gr-error-message"', $js);

        // the desktop panel and the legacy table are not phone screens and must not carry it
        $this->assertStringNotContainsString('gr-dp gr-mobile-detail', $js);
        $this->assertSame(0, preg_match('/gr-main-panel[^>]*gr-mobile-detail/', $js));

        // Analytics is left dark: its script draws none of the Grades markers
        $this->assertStringNotContainsString('gr-mobile-', $this->source('assets/js/teacher/analytics.js'));
    }
}
