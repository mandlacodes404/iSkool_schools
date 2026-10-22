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
        $from_js = array_map('trim', explode(',', str_replace('#api-content-area ', '', $m[1])));
        $this->assertSame($this->gate_markers($this->source('assets/css/learner/mobile_light.css')), $from_js);
    }

    public function test_dashboard_loads_the_theme_script_once_in_the_head(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertSame(1, substr_count($page, 'assets/js/learner/mobile_theme.js'));
        $this->assertLessThan(strpos($page, '</head>'), strpos($page, 'assets/js/learner/mobile_theme.js'));
    }
}
