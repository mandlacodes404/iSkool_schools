<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the learner quiz instructions screen (quiz.js loadQuizInstructions + the .inst-* rules in quiz.css).
 * The screen is plain page-coloured panels in the phone app's style: Nunito 400/600 only, no teal, no inline colours.
 * These checks read the source files; the look was checked in a phone-sized browser, dark and light.
 */
final class QuizInstructionsTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The markup written by loadQuizInstructions (from the apiArea.innerHTML assignment to the cache step). */
    private function markup(): string
    {
        $js = $this->source('assets/js/learner/quiz.js');
        $start = strpos($js, 'apiArea.innerHTML = `' . "\n" . '            <div class="inst-container">');
        $end = strpos($js, 'Only cache if NOT a continuing attempt');
        $this->assertNotFalse($start, 'instructions markup not found');
        $this->assertNotFalse($end, 'cache step not found');
        return substr($js, $start, $end - $start);
    }

    /** The base .inst-* rules in quiz.css (before the mobile card overrides). */
    private function baseCss(): string
    {
        $css = $this->source('assets/css/learner/quiz.css');
        $start = strpos($css, '.inst-container {');
        $end = strpos($css, '/* ── MOBILE CARD OVERRIDES ── */');
        $this->assertNotFalse($start);
        $this->assertGreaterThan($start, $end);
        return substr($css, $start, $end - $start);
    }

    public function test_markup_uses_classes_and_keeps_the_light_mode_gate_class(): void
    {
        $markup = $this->markup();

        // mobile_light.css and mobile_theme.js switch the page to light by finding .inst-container
        $this->assertStringContainsString('class="inst-container"', $markup);
        foreach (['inst-top', 'inst-eyebrow', 'inst-pill', 'inst-title', 'inst-facts', 'inst-fact', 'inst-gt', 'inst-rules', 'inst-form', 'start-btn'] as $class) {
            $this->assertStringContainsString($class, $markup, "missing class $class");
        }
        // No inline styles, so nothing in the markup can fight the stylesheet or the light mode
        $this->assertStringNotContainsString('style=', $markup);
        $this->assertStringNotContainsString('<style', $markup);
        $this->assertStringNotContainsString('#4fd1c5', $markup);
        // Not <h2>/<h3>: "#api-content-area h2/h3" would turn them teal and uppercase
        $this->assertStringNotContainsString('<h2', $markup);
        $this->assertStringNotContainsString('<h3', $markup);
    }

    public function test_markup_still_shows_the_real_data_and_posts_to_take_quiz(): void
    {
        $markup = $this->markup();

        $this->assertStringContainsString('${escapeHtml(data.title)}', $markup);
        $this->assertStringContainsString('${escapeHtml(data.duration)}', $markup);
        $this->assertStringContainsString('${escapeHtml(data.attemptLimit)}', $markup);
        $js = $this->source('assets/js/learner/quiz.js');
        $this->assertStringContainsString("data.layout_mode === 'multi_page'", $js);
        $this->assertStringContainsString('!!data.isContinuing', $js);
        $this->assertStringContainsString('<form action="take_quiz.php" method="GET" class="inst-form">', $markup);
        $this->assertStringContainsString('<input type="hidden" name="quiz_id" value="${quizId}">', $markup);
        $this->assertStringContainsString("continuing ? 'Continue quiz' : 'Start quiz'", $markup);
        $this->assertStringContainsString('start-btn--continue', $markup);
    }

    public function test_the_screen_loads_the_nunito_weights_it_uses(): void
    {
        $js = $this->source('assets/js/learner/quiz.js');

        $this->assertMatchesRegularExpression('/window\.loadQuizInstructions = async function\(quizId\) \{\s*const apiArea = document\.getElementById\(\'api-content-area\'\);\s*lqzEnsureFont\(\);/', $js);
    }

    public function test_dark_look_has_no_teal_and_uses_light_font_weights(): void
    {
        $css = $this->baseCss();

        foreach (['#4fd1c5', '79, 209, 197', '#187a72', 'teal'] as $teal) {
            $this->assertStringNotContainsStringIgnoringCase($teal, $css, "teal ($teal) is not part of this page");
        }
        // Only the two weights the phone pages load; the title is the lighter 600
        preg_match_all('/font(?:-weight)?:\s*(\d{3})\b/', $css, $weights);
        $this->assertNotEmpty($weights[1]);
        foreach (array_unique($weights[1]) as $weight) {
            $this->assertContains($weight, ['400', '600'], "font weight $weight is too heavy for this page");
        }
        $this->assertMatchesRegularExpression('/\.inst-title \{[^}]*font-size: 28px; font-weight: 600;/', $css);
        // Dark primary button is the page's ink colour, Continue is the list's orange
        $this->assertStringContainsString('--ic-cta: #ecece9;', $css);
        $this->assertStringContainsString('--ic-cta-warn: #e67e22;', $css);
    }

    public function test_the_button_rests_above_the_bottom_nav_on_phones(): void
    {
        $css = $this->baseCss();

        $this->assertStringContainsString('.inst-form { margin: auto 0 0; padding-top: 24px; }', $css);
        $this->assertStringContainsString('height: 50px;', $css);
        $this->assertStringContainsString('min-height: calc(100dvh - 68px - env(safe-area-inset-top, 0px) - 18px - 96px - env(safe-area-inset-bottom, 0px));', $css);
    }

    public function test_light_modes_swap_the_same_variables_and_old_rules_are_gone(): void
    {
        $css = $this->source('assets/css/learner/quiz.css');

        // 769px and wider, and phones
        $this->assertStringContainsString('html[data-learner-theme="light"] .inst-container {', $css);
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .inst-container {', $css);
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .inst-container .start-btn { background: #252624; color: #ffffff; }', $css);
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .inst-container .start-btn--continue { background: #b85f12; color: #ffffff; }', $css);
        // Rules written for the old inline-styled markup are gone
        foreach (['.quiz-info-box', '.inst-list', '.ai-box', 'h2[style*="#e2e8f0"', '.start-btn[style*='] as $old) {
            $this->assertStringNotContainsString($old, $css, "old instructions rule $old is still in quiz.css");
        }
    }

    public function test_changed_assets_have_new_cache_versions(): void
    {
        $page = $this->source('learner_dashboard.php');

        $this->assertStringContainsString('assets/css/learner/quiz.css?v=6.9', $page);
        $this->assertStringContainsString('assets/js/learner/quiz.js?v=12.9', $page);
    }
}
