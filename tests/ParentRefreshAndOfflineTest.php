<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app's pull to refresh and its "last copy" when there is no connection.
 * These checks read the source files. How they behave was checked in a phone-sized browser (390px wide) with the
 * network switched off and on, and with real touch drags (CDP touch events): a pull at the top refreshes, a pull while
 * scrolled down, on "Add a child" or with the menu open does not.
 *
 * Why the copy lives in the page and not in the service worker: service-worker.js clears its data caches every time
 * dashboard.php or index.php is requested (isAuthenticationRoute), and the parent page is served from dashboard.php,
 * so a copy kept there would be thrown away at every start. The page keeps the last answer for each screen for as
 * long as it stays open, which is what a parent who loses signal in the middle of reading needs.
 */
final class ParentRefreshAndOfflineTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_the_page_loads_the_shared_pull_to_refresh_before_the_parent_script(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/pull_to_refresh.css', $page);
        $shared = strpos($page, '<script src="assets/js/shared/pull_to_refresh.js');
        $app = strpos($page, '<script src="assets/js/parent/parent_app.js');
        $this->assertNotFalse($shared);
        $this->assertNotFalse($app);
        $this->assertLessThan($app, $shared, 'parent_app.js starts the gesture, so the shared script must load first');
    }

    public function test_the_page_has_the_note_that_says_a_copy_is_on_show(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('id="paOffline"', $page);
        // inside the content box, above the child switcher, hidden until the script needs it
        $this->assertMatchesRegularExpression('/id="paOffline"[^>]*role="status"[^>]*hidden/', $page);
        $this->assertLessThan(strpos($page, 'id="paSwitcher"'), strpos($page, 'id="paOffline"'));
    }

    public function test_a_screen_falls_back_to_the_last_answer_only_when_the_server_cannot_be_reached(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString('lastSeen[key] = entry', $js);
        // no connection or a server error: yes. Signed out, child unlinked and "no school year" must never show old data.
        $this->assertStringContainsString("err.code === 'network' || err.code === 'server'", $js);
        $this->assertStringNotContainsString("err.code === 'auth' ||", $js);
    }

    public function test_the_copy_is_labelled_with_when_it_was_saved_and_has_a_try_again(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString('Showing what you last saw', $js);
        $this->assertStringContainsString('savedAtText(viewCopy)', $js);
        $this->assertStringContainsString("'Try again'", $js);
    }

    public function test_the_copies_are_forgotten_when_the_list_of_children_changes(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        // a child linked just now, or one that is no longer linked: an old copy would show the wrong children
        $this->assertSame(2, preg_match_all('/^\s+lastSeen = \{\};/m', $js), 'finishAddChild() and the "child no longer linked" path');
    }

    public function test_coming_back_online_updates_a_screen_that_shows_a_copy_or_an_error(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("window.addEventListener('online', updateIfStale)", $js);
        $this->assertStringContainsString('viewCopy !== null || errorOnScreen', $js);
    }

    public function test_a_refresh_redraws_in_place_and_asks_for_the_children_again(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString('if (!quiet) showLoading();', $js, 'a refresh must not blank the page to "Loading…"');
        $this->assertStringContainsString('return render(false, true);', $js);
        $this->assertStringContainsString("loadChildren().then(function () {\n            renderSwitcher();\n            return render(false, true);", $js);
    }

    public function test_pull_to_refresh_is_off_on_add_a_child_when_scrolled_and_with_a_menu_open(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("route === 'add-child') return false", $js);
        $this->assertStringContainsString('window.pageYOffset', $js);
        $this->assertStringContainsString("root.classList.contains('pa-menu-open')", $js);
        // the account sheet is always in the page (it opens with a class, not "hidden"), so it must be left out of the
        // "a menu is open" check or no pull would ever start
        $this->assertStringContainsString('[data-pa-menu]:not(.pa-sheet):not([hidden])', $js);
        $this->assertStringContainsString("scroller: '.pa-content'", $js);
    }

    public function test_the_browsers_own_pull_to_refresh_is_kept_off_the_phone_page(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        // the parent page scrolls as a whole, so the rule must be on the root element, not on the content box
        $this->assertMatchesRegularExpression('/@media \(max-width: 768px\) \{.*html \{ overscroll-behavior-y: contain; \}/s', $css);
    }

    public function test_the_note_has_light_and_dark_styles_through_the_theme_variables(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        $start = strpos($css, '.pa-offline {');
        $this->assertNotFalse($start);
        $rule = substr($css, $start, strpos($css, '}', $start) - $start);
        $this->assertStringContainsString('var(--pa-card)', $rule);
        $this->assertStringContainsString('var(--pa-line)', $rule);
        $this->assertStringContainsString('.pa-offline[hidden] { display: none; }', $css);
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the page must move with the files
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('parent_app.css?v=1.9', $page);
        $this->assertStringContainsString('parent_app.js?v=1.9', $page);
    }
}
