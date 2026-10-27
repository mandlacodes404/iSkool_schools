<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app's phone bottom tabs, which are dynamic like the learner bar: clear near the bottom of the
 * page, glass once the page is scrolled up (see BottomNavTest for the learner and teacher bars). These checks read the
 * source files; the behaviour was checked in a phone-sized browser.
 */
final class ParentBottomNavTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_page_loads_the_bottom_nav_script_after_the_app_script(): void
    {
        $page = $this->source('parent_dashboard.php');

        $this->assertStringContainsString('<nav class="pa-tabs"', $page);
        $this->assertFileExists(__DIR__ . '/../assets/js/parent/parent_bottom_nav.js');
        $this->assertMatchesRegularExpression('#parent_app\.js\?v=[\d.]+"></script>\s*<script src="assets/js/parent/parent_bottom_nav\.js\?v=[\d.]+"></script>#', $page);
    }

    public function test_changed_stylesheets_have_new_cache_versions(): void
    {
        $page = $this->source('parent_dashboard.php');

        $this->assertStringContainsString('parent_app.css?v=1.12', $page);
        $this->assertStringContainsString('parent_menu.css?v=1.2', $page);
    }

    public function test_tabs_are_glass_with_theme_aware_colours(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');

        // Light glass is the cream of the page; dark glass is the same as the learner bar
        $this->assertStringContainsString('--pa-tabs-glass: rgba(250, 249, 245, .62);', $css);
        $this->assertStringContainsString('--pa-tabs-glass: rgba(32, 32, 31, .55);', $css);
        $this->assertMatchesRegularExpression('/\.pa-tabs \{[^}]*background: var\(--pa-tabs-glass\);[^}]*backdrop-filter: blur\(28px\) saturate\(180%\);/s', $css);
        // The bar is still 64px high plus the safe area
        $this->assertStringContainsString('--pa-tabs-h: 64px;', $css);
        $this->assertStringContainsString('height: calc(var(--pa-tabs-h) + env(safe-area-inset-bottom, 0px));', $css);
    }

    public function test_bar_is_clear_at_rest_only_while_the_script_is_running(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');

        $this->assertStringContainsString('DYNAMIC BOTTOM TABS', $css);
        $this->assertMatchesRegularExpression('/html\.pa-dynamic-tabs \.pa-tabs:not\(\.nav-scrolled\) \{[^}]*background: transparent;[^}]*backdrop-filter: none;/s', $css);
        // It lives inside the phone media query, so desktop (where the bar is hidden) is never affected
        $this->assertSame(1, preg_match('/@media \(max-width: 768px\) \{.*html\.pa-dynamic-tabs \.pa-tabs:not\(\.nav-scrolled\)/s', $css));
    }

    public function test_bar_still_slides_with_the_menu_and_fades_between_its_two_looks(): void
    {
        $css = $this->source('assets/css/parent/parent_menu.css');

        $this->assertMatchesRegularExpression('/\.pa-tabs \{\s*transition: transform var\(--pa-dur\) var\(--pa-ease\), background \.28s ease, border-color \.28s ease, box-shadow \.28s ease,/', $css);
        $this->assertStringContainsString('html.pa-menu-open .pa-tabs { transform: translate3d(var(--pa-dw), 0, 0); }', $css);
        $this->assertStringContainsString('html.pa-menu-open .pa-tabs { pointer-events: none; }', $css);
        // A page change snaps (no fade); dragging the menu and reduced motion keep working
        $this->assertStringContainsString('html.pa-tabs-snap .pa-tabs { transition: transform var(--pa-dur) var(--pa-ease); }', $css);
        $this->assertStringContainsString('html.pa-drag .pa-top, html.pa-drag .pa-content, html.pa-drag .pa-tabs { transition: none;', $css);
        $this->assertStringContainsString('.pa-tabs { transition-duration: .01s !important; }', $css);
    }

    public function test_script_keeps_the_bar_judged_like_the_learner_bar(): void
    {
        $js = $this->source('assets/js/parent/parent_bottom_nav.js');

        // Same rule as recalcMobileScrollUI(): within 10px of the bottom is clear, anything else is glass
        $this->assertStringContainsString('var BOTTOM_THRESHOLD = 10;', $js);
        $this->assertStringContainsString('content.scrollHeight - content.scrollTop - content.clientHeight', $js);
        $this->assertStringContainsString("var SCROLLED = 'nav-scrolled';", $js);
        $this->assertStringContainsString("root.classList.add('pa-dynamic-tabs');", $js);

        // Judged again after a scroll, content or height changes, resize and turning the phone, and a page change
        foreach ([
            "content.addEventListener('scroll', recalc",
            'new MutationObserver(onPageChange)',
            'new ResizeObserver(',
            "content.addEventListener('load', scheduleRecheck, true)",
            "window.addEventListener('resize', scheduleRecheck",
            "window.addEventListener('orientationchange', scheduleRecheck",
            "window.addEventListener('hashchange'",
        ] as $hook) {
            $this->assertStringContainsString($hook, $js);
        }

        // Tapping the tab you are on scrolls back to the top; the snap begins and ends; nothing touches navigation
        $this->assertStringContainsString("link.getAttribute('aria-current') !== 'page'", $js);
        $this->assertStringContainsString("root.classList.add('pa-tabs-snap')", $js);
        $this->assertStringContainsString("root.classList.remove('pa-tabs-snap')", $js);
        $this->assertStringNotContainsString('location.hash', $js);
        $this->assertStringNotContainsString('preventDefault', $js);
    }
}
