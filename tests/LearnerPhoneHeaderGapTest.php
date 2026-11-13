<?php
use PHPUnit\Framework\TestCase;

/**
 * The page area (#api-content-area) of the learner phone app starts exactly where the top bar ends.
 *
 * It used to start at a fixed 68px while the bar was as tall as its tallest part: 64px on a normal screen (the 47px menu
 * button) and 61px on a detail screen (the back button takes its place), so 4px (7px on a detail screen) of empty space
 * showed between them. The bar now has one height, --lh-header-h, and everything that works out where the page area starts
 * or how tall it is uses --lh-header-bottom, which is that height plus the safe area.
 * How it looks was measured in a phone-sized browser with the real stylesheets (390, 360 and 320px wide, dark and light,
 * a normal and a detail screen, with and without a simulated 47px notch): the gap is 0px in every case. These tests read the
 * sources so the pieces that have to stay in step cannot drift apart quietly.
 */
final class LearnerPhoneHeaderGapTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** the phone block that holds the page area's offset (the "MOBILE SCROLL FIX" rules) */
    private function scrollFixBlock(): string
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $a = strpos($css, '/* ── MOBILE SCROLL FIX');
        $this->assertNotFalse($a);
        $b = strpos($css, "\n}\n", strpos($css, '@media (max-width: 767px) {', $a));
        $this->assertNotFalse($b);
        return substr($css, $a, $b - $a);
    }

    public function test_one_variable_says_where_the_top_bar_ends(): void
    {
        $block = $this->scrollFixBlock();
        $this->assertStringContainsString('--lh-header-h: 64px;', $block);
        $this->assertStringContainsString('--lh-header-bottom: calc(var(--lh-header-h) + 2 * env(safe-area-inset-top, 0px));', $block);
        // the bar sits one safe area from the top and has the same amount again in its own padding, hence twice
        $this->assertStringContainsString('top: env(safe-area-inset-top, 0);', $this->source('assets/css/learner/learner_dashboard.css'));
    }

    public function test_the_page_area_starts_at_the_bottom_of_the_bar_and_is_as_tall_as_what_is_left(): void
    {
        $block = $this->scrollFixBlock();
        $this->assertStringContainsString('padding-top: var(--lh-header-bottom);', $block);
        $this->assertStringContainsString('height: calc(100vh - var(--lh-header-bottom));', $block);
        $this->assertStringContainsString('height: calc(100dvh - var(--lh-header-bottom));', $block);
        $this->assertSame(0, preg_match('/(?<![0-9])68px/', $block), 'no number of its own: it follows the bar');
    }

    public function test_the_top_bar_is_that_tall_on_every_phone_screen_and_only_on_phones(): void
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $this->assertSame(1, preg_match('/@media \(max-width: 767px\) \{\s*\.main-header \{\s*height: calc\(var\(--lh-header-h\) \+ env\(safe-area-inset-top, 0px\)\);\s*\}\s*\}/', $css), 'the bar has the height the page area is built around');
        // the 767px breakpoint is the one the page area's offset has always used, so the two cannot disagree
        $this->assertSame(0, preg_match('/@media \(min-width[^{]*\{[^}]*--lh-header/s', $css), 'nothing on desktop');
        // the bar's own spacing rules (which the back button tests pin) are not touched
        $this->assertStringContainsString('min-height: calc(56px + env(safe-area-inset-top, 0));', $css);
        // it is declared after the rules that set the bar's position and padding, so it is the last word on its height
        $this->assertGreaterThan(strpos($css, 'COLLAPSING HEADER'), strpos($css, 'PHONE TOP BAR HEIGHT'));
    }

    public function test_the_quiz_stylesheet_follows_the_same_edge(): void
    {
        $css = $this->source('assets/css/learner/quiz.css');
        $edge = 'var(--lh-header-bottom, calc(64px + 2 * env(safe-area-inset-top, 0px)))';
        // max-height is what stops the page area growing past the screen (the end of it would be cut off if it were
        // still worked out from 68px, now that the area is 4px taller)
        $this->assertStringContainsString("max-height: calc(100vh - $edge) !important;", $css);
        $this->assertStringContainsString("min-height: calc(100vh - $edge - 18px - 96px", $css);
        $this->assertStringContainsString("min-height: calc(100dvh - $edge - 18px - 96px", $css);
        $this->assertSame(0, preg_match('/(?<![0-9])68px/', $css), 'nothing in quiz.css still works from the old 68px');
    }

    public function test_the_changed_stylesheets_have_new_cache_versions(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('learner/learner_dashboard.css?v=14.9', $php);
        $this->assertStringContainsString('learner/quiz.css?v=7.0', $php);
    }
}
