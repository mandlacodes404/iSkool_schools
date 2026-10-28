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
        // a child linked just now, or one that is no longer linked: an old copy would show the wrong children.
        // One place throws the copies away (and stops answers that were already on their way from putting an old one back)...
        $this->assertSame(1, preg_match_all('/^\s+lastSeen = \{\};/m', $js), 'only forgetCopies() empties lastSeen');
        $this->assertStringContainsString('function forgetCopies() {', $js);
        $this->assertStringContainsString('if (mine === generation) {', $js);
        // ...and it is used by finishAddChild() and by the "child no longer linked" path
        $this->assertSame(2, preg_match_all('/^\s+forgetCopies\(\);/m', $js), 'finishAddChild() and childGone()');
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
        // only a screen with nothing to draw yet shows a loader: a refresh, and a screen with a copy, never blank to "Loading…"
        $this->assertStringContainsString('if (!quiet && waiting) showLoading();', $js, 'a refresh must not blank the page to "Loading…"');
        $this->assertStringContainsString('return render(false, true);', $js);
        $this->assertStringContainsString("loadChildren().then(function () {\n            renderSwitcher();\n            return renderFresh();", $js);
        // a refresh asks the server instead of drawing the copy first
        $this->assertStringContainsString('forcing = true;', $js);
        $this->assertStringContainsString('if (older && !forcing) {', $js);
    }

    public function test_pull_to_refresh_is_off_on_add_a_child_when_scrolled_and_with_a_menu_open(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("route === 'add-child') return false", $js);
        $this->assertStringContainsString('content.scrollTop > 0', $js, 'pull only from the very top of the scrolling area');
        $this->assertStringContainsString("root.classList.contains('pa-menu-open')", $js);
        // the account sheet is always in the page (it opens with a class, not "hidden"), so it must be left out of the
        // "a menu is open" check or no pull would ever start
        $this->assertStringContainsString('[data-pa-menu]:not(.pa-sheet):not([hidden])', $js);
        $this->assertStringContainsString("scroller: '.pa-content'", $js);
    }

    public function test_on_phones_only_the_content_area_scrolls_so_the_header_and_tabs_never_move(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        // the page is exactly one screen high; the area under the header scrolls inside it (like #api-content-area in
        // the learner and teacher phone apps), so a pull moves only that area
        $this->assertStringContainsString('.pa-body { height: 100vh; height: 100dvh; min-height: 0; }', $css);
        $this->assertStringNotContainsString('position: sticky', $css, 'a sticky header scrolls with the page and follows a pull');
        $start = strpos($css, '.pa-content {', strpos($css, '.pa-body { height: 100vh; height: 100dvh;'));
        $this->assertNotFalse($start);
        $rule = substr($css, $start, strpos($css, '}', $start) - $start);
        $this->assertStringContainsString('flex: 1 1 auto', $rule);
        $this->assertStringContainsString('min-height: 0', $rule);
        $this->assertStringContainsString('overflow-y: auto', $rule);
        // the browser's own pull to refresh, which reloads the whole app, must not also fire at the top
        $this->assertStringContainsString('overscroll-behavior-y: contain', $rule);
        // room for the last row above the fixed bottom tabs
        $this->assertStringContainsString('var(--pa-tabs-h)', $rule);
    }

    public function test_on_phones_the_page_itself_is_locked_to_one_screen_like_the_learner_app(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        $phone = substr($css, strpos($css, '/* ── Phones'));

        // learner_dashboard.css locks body the same way: the document must not be draggable at all
        $this->assertStringContainsString('body { height: 100vh; height: 100dvh; overflow: hidden; overscroll-behavior: none; }', $phone);
        $this->assertStringContainsString('html { overscroll-behavior: none; touch-action: manipulation; }', $phone);
        // .pa has "min-height: 100vh" for desktop. 100vh is taller than what a phone shows while its address bar is up,
        // so left alone the document was a little taller than the screen and a drag on the header moved the whole page.
        $this->assertStringContainsString('.pa { display: block; min-height: 0; height: 100vh; height: 100dvh; }', $phone);
        // and nothing else on the phone layout may size the page with the taller unit on its own
        $this->assertSame(0, preg_match('/min-height:\s*(calc\()?100vh/', $phone), 'a 100vh minimum on a phone makes the page taller than the screen');
        // desktop keeps scrolling as a page
        $this->assertStringContainsString('.pa { min-height: 100vh; display: flex; }', substr($css, 0, strpos($css, '/* ── Phones')));
    }

    public function test_going_to_another_screen_scrolls_the_content_area_back_to_the_top(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("var content = document.querySelector('.pa-content');", $js);
        $this->assertStringContainsString('if (content) content.scrollTop = 0;', $js);
        // desktop still scrolls the page
        $this->assertStringContainsString('window.scrollTo(0, 0);', $js);
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
        $this->assertStringContainsString('parent_app.css?v=1.14', $page);
        $this->assertStringContainsString('parent_app.js?v=1.12', $page);
    }
}
