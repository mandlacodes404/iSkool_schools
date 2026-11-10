<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the space between the iSkool icon and the "iSkool" name: the login page (the brand panel on a computer, the
 * row above the login and register forms on a phone or tablet) and the splash screens (the login page's, and the learner
 * and teacher dashboards' that it hands over to).
 *
 * The icon (icon.svg) has about a tenth of its width empty on each side, so the CSS gap is deliberately tiny: what the
 * eye sees is the CSS gap plus that margin (about 5 to 6px next to the 32px to 36px icon on the login page, about 8 to
 * 14px on the splash). The school's own logo and school name pairs (menus, top bars) are a different thing and are not
 * changed here. These checks read the real stylesheets; the pixels were measured in a browser.
 */
final class LogoNameSpacingTest extends TestCase
{
    private function source(string $path): string
    {
        $text = file_get_contents(__DIR__ . '/../' . $path);
        $this->assertNotFalse($text, $path);
        return $text;
    }

    /**
     * The gap of every rule that starts with exactly this selector, in file order (only the rules that set a gap).
     * @return string[] e.g. ['8px']
     */
    private function gaps(string $source, string $selector): array
    {
        $found = preg_match_all('/(?<![\w#.-])' . preg_quote($selector, '/') . '\s*\{([^}]*)\}/s', $source, $blocks);
        $this->assertGreaterThan(0, $found, $selector . ' not found');
        $gaps = [];
        foreach ($blocks[1] as $block) {
            if (preg_match('/(?<![\w-])gap:\s*([^;}\s]+)/', $block, $m)) {
                $gaps[] = $m[1];
            }
        }
        return $gaps;
    }

    // ── the iSkool icon + "iSkool" ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_login_page_lockups_are_tight_because_the_icon_already_has_empty_space_inside_it(): void
    {
        $css = $this->source('assets/css/index.css');
        $this->assertSame(['2px', '2px'], $this->gaps($css, '.bp-intro-eyebrow'), 'the desktop brand panel (base rule and the 900px+ rule)');
        // the row at the top of the login and register forms on a phone or tablet
        $this->assertSame(['2px'], $this->gaps($css, '.form-panel #iskool-brand, .form-panel #register-iskool-brand'));
        // the older stacked version (480px and 360px rules, kept in step even though the row above wins today)
        $this->assertSame(['1px', '1px'], $this->gaps($css, '#iskool-brand,
    #register-iskool-brand'));
    }

    public function test_the_login_splash_and_the_dashboard_splashes_use_the_same_gaps_so_the_handoff_does_not_jump(): void
    {
        $login = $this->gaps($this->source('assets/css/index.css'), '#loader-logo');
        $this->assertSame(['3px', '2px', '2px'], $login, 'base, 480px, 360px');
        $this->assertSame($login, $this->gaps($this->source('assets/css/learner/learner_dashboard.css'), '#dash-splash-logo'), 'learner splash');
        $this->assertSame($login, $this->gaps($this->source('assets/css/teacher/teacher_dashboard.css'), '#dash-splash-logo'), 'teacher splash');
    }

    // ── the cache versions ─────────────────────────────────────────────────────────────────────────────────────────

    public function test_every_stylesheet_that_changed_has_a_new_cache_version(): void
    {
        $this->assertStringContainsString('learner/learner_dashboard.css?v=14.7', $this->source('learner_dashboard.php'));
        $this->assertStringContainsString('teacher/teacher_dashboard.css?v=14.3', $this->source('teacher_dashboard.php'));
        $this->assertStringContainsString('assets/css/index.css?v=9.6', $this->source('index.php'));
    }
}
