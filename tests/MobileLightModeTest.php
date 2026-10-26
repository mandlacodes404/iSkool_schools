<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the learner light mode on phones (assets/css/learner/mobile_light.css and friends).
 * The first version turned the header and bottom bar light on every page, left the page area dark, and
 * overwrote the Settings photo rules. These checks read the source files; the behaviour itself was checked
 * in a phone-sized browser.
 */
final class MobileLightModeTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The marker list inside the gate: ".ms, [class*="las-mobile"]" */
    private function gate_markers(string $css): array
    {
        $this->assertGreaterThan(0, preg_match_all('/:has\(:where\(#api-content-area\) :is\(([^)]*)\)\)/', $css, $m));
        $this->assertCount(1, array_unique($m[1]), 'every gate must list the same pages');
        return array_map('trim', explode(',', $m[1][0]));
    }

    public function test_light_page_gate_only_looks_inside_the_page_area(): void
    {
        $css = $this->source('assets/css/learner/mobile_light.css');

        // The menu drawer is always in the document and its My Class panel also has class="ms", so a gate
        // that looks anywhere else is true on every page.
        $this->assertStringContainsString('class="lmc-m ms"', $this->source('learner_dashboard.php'));
        $this->assertSame(0, preg_match('/:has\((?!:where\(#api-content-area\))/', $css), 'every :has( ) gate must start with :where(#api-content-area)');
        $this->assertStringNotContainsString(':has(.ms', $css);

        $gates = preg_match_all('/:has\(:where\(#api-content-area\) :is\(/', $css);
        $rules = preg_match_all('/^html\[data-learner-mobile-theme="light"\]/m', $css);
        $this->assertGreaterThan(20, $gates);
        $this->assertSame($rules, $gates, 'every rule in mobile_light.css must be behind the gate');
    }

    public function test_light_page_background_beats_the_dark_one_in_quiz_css(): void
    {
        // quiz.css: #api-content-area:not(.disc-thread-active) { background-color: #20201f !important; } on phones
        $this->assertMatchesRegularExpression('/#api-content-area:not\(\.disc-thread-active\)\s*\{[^}]*background-color:\s*#20201f\s*!important/', $this->source('assets/css/learner/quiz.css'));

        $css = $this->source('assets/css/learner/mobile_light.css');
        $this->assertMatchesRegularExpression('/body #api-content-area \{ background: #faf9f5 !important; \}/', $css);
    }

    public function test_settings_profile_photo_rules_are_kept(): void
    {
        $css = $this->source('assets/css/learner/mobile_settings.css');
        $this->assertMatchesRegularExpression('/\.ms-av-face \{ position: relative;/', $css);
        $this->assertMatchesRegularExpression('/\.ms-av-face img \{ position: absolute; inset: 0;/', $css);
    }

    public function test_status_bar_is_only_light_while_a_light_screen_is_showing(): void
    {
        $js = $this->source('assets/js/learner/mobile_theme.js');
        $this->assertStringContainsString('function lightOnScreen()', $js);
        $this->assertStringNotContainsString("get() === 'light' && m.getAttribute", $js);

        // The pages the script treats as light must be the pages the css gate lets through.
        $this->assertSame(1, preg_match("/var PAGE = '([^']+)';/", $js, $m));
        $from_js = array_map('trim', explode(',', $m[1]));
        $this->assertSame($this->gate_markers($this->source('assets/css/learner/mobile_light.css')), $from_js);
    }

    public function test_dashboard_loads_the_theme_script_once_in_the_head(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertSame(1, substr_count($page, 'assets/js/learner/mobile_theme.js'));
        $this->assertLessThan(strpos($page, '</head>'), strpos($page, 'assets/js/learner/mobile_theme.js'));
    }

    public function test_every_marker_in_the_gate_is_markup_a_page_really_draws(): void
    {
        // A typo in a marker would leave that page dark with no error, so each one must exist in its page's script.
        $where = [
            '.ms'                  => 'assets/js/learner/mobile_settings.js',
            'las-mobile'           => 'assets/js/learner/assignments.js',
            'las-error-state'      => 'assets/js/learner/assignments.js',
            'lqz-mobile-list'      => 'assets/js/learner/quiz.js',
            'inst-container'       => 'assets/js/learner/quiz.js',
            'lqz-retry-btn'        => 'assets/js/learner/quiz.js',
            'lrs-mobile-list'      => 'assets/js/learner/resources.js',
            'lrs-error-state'      => 'assets/js/learner/resources.js',
            'lan-mobile-list'      => 'assets/js/learner/announcements.js',
            'lan-mobile-detail'    => 'assets/js/learner/announcements.js',
            'lan-error-state'      => 'assets/js/learner/announcements.js',
            'lev-mobile-list'      => 'assets/js/learner/evaluations.js',
            'lev-mobile-detail'    => 'assets/js/learner/evaluations.js',
            'eval-error-state'     => 'assets/js/learner/evaluations.js',
            'grades-mobile-layout' => 'assets/js/learner/grades.js',
            'grades-error-state'   => 'assets/js/learner/grades.js',
            'lh-mobile-wrapper'    => 'assets/js/learner/manual.js',
            'lh-home-loading'      => 'assets/js/learner/manual.js',
            'lh-home-error'        => 'assets/js/learner/manual.js',
            'syl-mobile-layout'    => 'assets/js/learner/syllabus.js',
            'syl-empty'            => 'assets/js/learner/syllabus.js',
            'syl-retry-btn'        => 'assets/js/learner/syllabus.js',
            'lcal-body'            => 'assets/js/learner/learner_calendar.js',
        ];
        $markers = implode(' ', $this->gate_markers($this->source('assets/css/learner/mobile_light.css')));
        foreach ($where as $needle => $file) {
            $this->assertStringContainsString(ltrim($needle, '.'), $markers, $needle . ' is not in the gate');
            $this->assertStringContainsString(ltrim($needle, '.') === 'ms' ? 'class="ms' : ltrim($needle, '.'), $this->source($file), $needle . ' is not drawn by ' . $file);
        }
    }

    public function test_quiz_resources_and_home_phone_light_blocks_only_apply_to_phones_in_light(): void
    {
        foreach (['assets/css/learner/quiz.css' => ['.lqz-mobile-row-title', '.inst-container .start-btn', '.lqz-retry-btn'],
                  'assets/css/learner/resources.css' => ['.lrs-mobile-row-title', '.lrs-mobile-video-title', '.lrs-error-state'],
                  'assets/css/learner/manual.css' => ['.lh-row-title', '.lh-carousel-card', '.lh-home-error']] as $file => $selectors) {
            $css = $this->source($file);
            // the phone block is the last @media (max-width: 768px) in the file, and every rule inside it is for light
            $start = strrpos($css, '@media (max-width: 768px) {');
            $this->assertNotFalse($start, $file . ' has no phone light block');
            $block = substr($css, $start);
            // the first word of every line that starts a rule (they all start with "html")
            preg_match_all('/^(html\S*)/m', $block, $m);
            $this->assertNotEmpty($m[1]);
            $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($m[1])), $file . ': every rule in the phone block must start with the light attribute');
            foreach ($selectors as $sel) {
                $this->assertStringContainsString('html[data-learner-mobile-theme="light"] ' . $sel, $block, $file . ' misses ' . $sel);
            }
        }
    }

    public function test_syllabus_phone_light_rules_only_apply_to_phones_in_light(): void
    {
        // The Syllabus draws its own <style>, so its phone light rules live in syllabus.js, not in a stylesheet.
        $js = $this->source('assets/js/learner/syllabus.js');
        $this->assertSame(1, preg_match('/Light mode: learner Syllabus \(phones\).*?@media \(max-width: 768px\) \{(.*?)\n\s*<\/style>/s', $js, $m));
        preg_match_all('/^\s*(html\S*)/m', $m[1], $starts);
        $this->assertNotEmpty($starts[1]);
        $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($starts[1])), 'every rule in the Syllabus phone block must start with the light attribute');
        foreach (['.syl-card', '.syl-tab-active', '.syl-assess-weight[style*="#34d399" i]'] as $sel) {
            $this->assertStringContainsString('html[data-learner-mobile-theme="light"] ' . $sel, $m[1], 'the Syllabus phone block misses ' . $sel);
        }
    }

    public function test_calendar_phone_light_rules_only_apply_to_phones_in_light(): void
    {
        // The Calendar draws its own <style>, so its phone light rules live in learner_calendar.js.
        $js = $this->source('assets/js/learner/learner_calendar.js');
        $this->assertSame(1, preg_match('/Light mode: learner Calendar \(phones\).*?@media \(max-width: 768px\) \{(.*?)\n\s*<\/style>/s', $js, $m));
        preg_match_all('/^\s*(html\S*)/m', $m[1], $starts);
        $this->assertNotEmpty($starts[1]);
        $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($starts[1])), 'every rule in the Calendar phone block must start with the light attribute');
        // quiz.css colours every h2 in the page area, so the title rule needs the id to beat it
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] #api-content-area .lcal-page-title', $m[1]);
        foreach (['.lcal-main', '.lcal-cell-today .lcal-day-num', '.lcal-pill-more', '.lcal-upcoming-card'] as $sel) {
            $this->assertStringContainsString('html[data-learner-mobile-theme="light"] ' . $sel, $m[1], 'the Calendar phone block misses ' . $sel);
        }
    }

    public function test_scrolled_header_takes_the_page_colour_in_light_like_the_status_bar_does(): void
    {
        // In dark the scroll handler paints the header and theme-color the page's colour. The light header rule is
        // !important cream, so without the rules below the header stayed cream while the status bar went coloured.
        $css = $this->source('assets/css/learner/mobile_light.css');
        $this->assertStringContainsString(
            '.main-header.header-scrolled[data-page-color]:not([data-bg-before-menu]):not([data-sheet-open]) { background: var(--learner-page-color, #faf9f5) !important;',
            $css,
            'a scrolled header on a coloured page must use the page colour'
        );
        // The open menu (status bar cream) and the Grades sheets (status bar #a9a9a5) keep the cream header: the rule is
        // switched off by data-bg-before-menu / data-sheet-open, which toggleSidebar() and grades.js set.
        $grades = $this->source('assets/js/learner/grades.js');
        $this->assertStringContainsString("mainHeader.setAttribute('data-sheet-open', '')", $grades);
        $this->assertStringContainsString("mainHeader.removeAttribute('data-sheet-open')", $grades);
        $this->assertStringContainsString("const SHEET_OVERLAY_DIMMED_COLOR_LIGHT = '#a9a9a5';", $grades);

        // configureHeader() is what hands the colour to the css, and clears it on a page without one.
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString("mainHeader.style.setProperty('--learner-page-color', color)", $page);
        $this->assertStringContainsString("mainHeader.style.removeProperty('--learner-page-color')", $page);
        // toggleSidebar() marks the header while the menu is open; the css rule above depends on that attribute name.
        $this->assertStringContainsString('mainHeader.dataset.bgBeforeMenu', $page);
    }

    public function test_every_phone_page_has_a_signature_colour_except_home_and_discussions(): void
    {
        $colour = '/configureHeader\(\{[^}]*\bcolor:\s*[^,}]*[\'"]#[0-9a-fA-F]{6}[\'"]/s';
        foreach ([
            'assets/js/learner/assignments.js',
            'assets/js/learner/quiz.js',
            'assets/js/learner/resources.js',
            'assets/js/learner/announcements.js',
            'assets/js/learner/evaluations.js',
            'assets/js/learner/grades.js',
            'assets/js/learner/syllabus.js',
            'assets/js/learner/learner_calendar.js',
            'learner_dashboard.php', // Settings (and My Class)
        ] as $file) {
            $this->assertMatchesRegularExpression($colour, $this->source($file), $file . ' should give configureHeader a colour');
        }
        $this->assertMatchesRegularExpression("/configureHeader\(\{ title: 'Settings', mode: 'standard', color: '#[0-9a-fA-F]{6}' \}\)/", $this->source('learner_dashboard.php'));

        // Home stays colourless on purpose (it is the dark/cream surface the other pages tint away from).
        $this->assertDoesNotMatchRegularExpression("/configureHeader\(\{ title: 'Home'[^}]*color/", $this->source('assets/js/learner/manual.js'));
        // Discussions is left exactly as it is: no colour on any of its header calls.
        $this->assertDoesNotMatchRegularExpression('/configureHeader\(\{[^}]*\bcolor:/s', $this->source('assets/js/learner/discussions.js'));
    }
}
