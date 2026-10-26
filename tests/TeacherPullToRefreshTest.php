<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the teacher dashboard's pull to refresh (phones).
 *
 * The gesture is assets/js/shared/pull_to_refresh.js; assets/js/teacher/teacher_pull_to_refresh.js says what to
 * refresh on each teacher page. The table in that file names caches and functions that live in other teacher scripts,
 * so these checks read the real sources and fail when the two drift apart (a renamed cache, a new page). How the
 * gesture feels and behaves was checked in a phone-sized browser with simulated touches.
 */
final class TeacherPullToRefreshTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** Every teacher script, joined: where the page functions and caches live. */
    private function teacherScripts(): string
    {
        $all = '';
        foreach (glob(__DIR__ . '/../assets/js/teacher/*.js') as $file) {
            if (basename($file) === 'teacher_pull_to_refresh.js') {
                continue;                                  // not the file being checked against itself
            }
            $all .= "\n" . file_get_contents($file);
        }
        return $all;
    }

    /** The PAGES table of the glue file, as [pageKey => ['clear' => [...], 'pending' => [...], 'reset' => [...], 'refresh' => 'fn']]. */
    private function pages(): array
    {
        $glue = $this->source('assets/js/teacher/teacher_pull_to_refresh.js');
        $this->assertSame(1, preg_match('/var PAGES = \{(.*?)\n    \};/s', $glue, $block), 'PAGES table not found');
        $pages = [];
        preg_match_all('/^\s*(teacher_[a-z]+):\s*\{(.*)\},?\s*$/m', $block[1], $rows, PREG_SET_ORDER);
        foreach ($rows as $row) {
            $entry = ['clear' => [], 'pending' => [], 'reset' => [], 'refresh' => null];
            foreach (['clear', 'pending', 'reset'] as $field) {
                if (preg_match('/' . $field . ":\s*\[([^\]]*)\]/", $row[2], $m)) {
                    preg_match_all("/'([A-Za-z_]+)'/", $m[1], $names);
                    $entry[$field] = $names[1];
                }
            }
            $this->assertSame(1, preg_match("/refresh:\s*'([A-Za-z]+)'/", $row[2], $m), $row[1] . ' has no refresh function');
            $entry['refresh'] = $m[1];
            $pages[$row[1]] = $entry;
        }
        return $pages;
    }

    public function test_the_table_lists_every_page_that_can_be_refreshed(): void
    {
        $this->assertEqualsCanonicalizing([
            'teacher_manual', 'teacher_quizzes', 'teacher_assignments', 'teacher_announcements', 'teacher_evaluations',
            'teacher_resources', 'teacher_syllabus', 'teacher_grades', 'teacher_analytics', 'teacher_calendar',
        ], array_keys($this->pages()));
    }

    public function test_every_page_key_the_teacher_scripts_save_is_either_refreshable_or_deliberately_not(): void
    {
        // A page added later must be a conscious choice here, not silently left without (or with a wrong) refresh.
        preg_match_all('/setItem\(\s*["\']lastTeacherPage["\']\s*,\s*["\'](teacher_[a-z]+)["\']/', $this->teacherScripts() . $this->source('teacher_dashboard.php'), $m);
        $saved = array_unique($m[1]);
        $notRefreshable = ['teacher_settings'];            // built by the settings screen itself, nothing to re-fetch
        $this->assertEqualsCanonicalizing(
            array_unique(array_merge(array_keys($this->pages()), $notRefreshable)),
            $saved,
            'the teacher scripts save a page key that the pull-to-refresh table does not know (or the other way round)'
        );
    }

    public function test_each_page_refreshes_with_the_function_and_caches_its_own_script_really_uses(): void
    {
        $scripts = $this->teacherScripts();
        foreach ($this->pages() as $key => $page) {
            // the function exists, and is the one that saves this very page key
            $start = strpos($scripts, 'window.' . $page['refresh'] . ' = async function');
            $this->assertNotFalse($start, $key . ': window.' . $page['refresh'] . ' is not defined');
            $body = substr($scripts, $start, 900);                 // the top of the function, where the page key is saved
            $this->assertMatchesRegularExpression('/lastTeacherPage["\'],\s*["\']' . $key . '["\']/', $body, $key . ': ' . $page['refresh'] . ' does not save the page key ' . $key);
            // every cache / in-flight request it names is a variable the scripts really assign
            foreach (array_merge($page['clear'], $page['pending'], $page['reset']) as $name) {
                $this->assertMatchesRegularExpression('/window\.' . $name . '\s*=/', $scripts, $key . ': nothing assigns window.' . $name);
            }
            // a page that fetches through a cache must be told to empty it, otherwise a "refresh" would redraw the old data
            $this->assertNotEmpty(array_merge($page['clear'], $page['reset']), $key . ' would redraw from its cache without emptying it');
        }
    }

    public function test_the_pulled_pages_serve_their_cache_when_it_is_full(): void
    {
        // This is why emptying the cache is what makes the pull fetch again.
        $scripts = $this->teacherScripts();
        foreach (['teacherQuizzesCache', 'teacherAssignmentsCache', 'teacherAnnouncementCache', 'teacherEvaluationCache',
                  'teacherResourceCache', 'teacherSBOCache', 'teacherGradesCache', 'teacherAnalyticsCache'] as $cache) {
            $this->assertMatchesRegularExpression('/if \(window\.' . $cache . '\)\s*\{/', $scripts, $cache . ' is no longer checked before fetching');
        }
    }

    public function test_pulling_is_off_on_detail_pages_while_the_menu_is_open_and_inside_pop_ups_and_inputs(): void
    {
        $glue = $this->source('assets/js/teacher/teacher_pull_to_refresh.js');
        $this->assertStringContainsString('window.teacherHeaderDetailType', $glue);
        $this->assertStringContainsString("document.querySelector('.sidebar.active')", $glue);
        foreach (['[role="dialog"]', '.teacher-modal-overlay', '#fullCalModal', '.sbo-drawer-panel', 'textarea', 'input'] as $needle) {
            $this->assertStringContainsString($needle, $glue);
        }
        // The header really clears this on list pages and sets it on detail pages (dashboard.js, configureTeacherHeader).
        $dash = $this->source('assets/js/teacher/dashboard.js');
        $this->assertStringContainsString('window.teacherHeaderDetailType = config.detailType || title || null;', $dash);
        $this->assertStringContainsString('window.teacherHeaderDetailType = null;', $dash);
        // The overlays named above exist in the teacher stylesheets.
        $this->assertStringContainsString('.teacher-modal-overlay', $this->source('assets/css/teacher/announcements.css'));
        $this->assertStringContainsString('.sbo-drawer-panel', $this->source('assets/css/teacher/sbo.css'));
        $this->assertStringContainsString('#fullCalModal', $this->source('assets/css/teacher/teacher_calendar.css'));
    }

    public function test_the_gesture_only_listens_and_gives_up_cleanly(): void
    {
        $js = $this->source('assets/js/shared/pull_to_refresh.js');
        $this->assertSame(0, substr_count($js, 'preventDefault'), 'the pull must never block scrolling');
        $this->assertSame(4, substr_count($js, '{ passive: true }'), 'touchstart, touchmove, touchend and touchcancel are all passive');
        foreach (["'touchstart'", "'touchmove'", "'touchend'", "'touchcancel'"] as $event) {
            $this->assertStringContainsString($event, $js);
        }
        $this->assertStringContainsString('threshold: 72, hold: 52, timeout: 15000', $js);   // same numbers as the learner's pull
        $this->assertStringContainsString("timed_out", $js);                                  // never stuck on a hanging request
        $this->assertStringContainsString('Math.abs(dx) > Math.abs(dy)', $js);               // sideways = the menu's swipe, not a pull
        $this->assertStringContainsString('scroller.scrollTop > 0', $js);                     // only from the very top
        $this->assertStringNotContainsString('innerHTML', $js);
        $this->assertStringNotContainsStringIgnoringCase('discussion', $js);
        // ".iskool-ptr" is styled as a small fixed, see-through spinner (pull_to_refresh.css). Putting that class on the
        // page itself once made the whole dashboard invisible and untouchable, so only the spinner may carry it.
        preg_match_all("/classList\\.add\\('iskool-ptr'\\)/", $js, $onPage);
        $this->assertSame([], $onPage[0], 'the spinner class must not be added to any page element');
        $this->assertSame(1, substr_count($js, "root.className = 'iskool-ptr';"));
    }

    public function test_stylesheet_stops_the_native_pull_below_the_menu_and_only_on_phones(): void
    {
        $css = $this->source('assets/css/shared/pull_to_refresh.css');
        $this->assertMatchesRegularExpression('/@media \(max-width: 768px\) \{\s*\.iskool-ptr-scroller \{ overscroll-behavior-y: contain; \}\s*\}/', $css);
        $this->assertMatchesRegularExpression('/\.iskool-ptr \{[^}]*z-index:\s*3000;/s', $css);   // under the menu (5000) and its backdrop (4999)
        $this->assertStringContainsString('prefers-reduced-motion', $css);
        $this->assertStringNotContainsStringIgnoringCase('discussion', $css);
        $this->assertStringContainsString("scroller.classList.add('iskool-ptr-scroller')", $this->source('assets/js/shared/pull_to_refresh.js'));
        // The old note in the teacher stylesheet claimed the page has no pull-to-refresh.
        $teacherCss = $this->source('assets/css/teacher/teacher_dashboard.css');
        $this->assertStringNotContainsString('this page has none', $teacherCss);
    }

    public function test_the_teacher_dashboard_loads_the_files_in_the_right_order(): void
    {
        $page = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/pull_to_refresh.css', $page);
        $dashboard = strpos($page, 'assets/js/teacher/dashboard.js');
        $shared = strpos($page, 'assets/js/shared/pull_to_refresh.js');
        $glue = strpos($page, 'assets/js/teacher/teacher_pull_to_refresh.js');
        $this->assertNotFalse($dashboard);
        $this->assertNotFalse($shared);
        $this->assertNotFalse($glue);
        $this->assertLessThan($shared, $dashboard, 'the page functions come first');
        $this->assertLessThan($glue, $shared, 'the gesture comes before the file that uses it');
        $this->assertStringContainsString('id="loaderOverlay"', $page);                        // the loader the pull keeps hidden
        $this->assertStringContainsString('id="api-content-area"', $page);
    }

    public function test_the_learner_dashboard_keeps_its_own_pull_and_does_not_load_this_one(): void
    {
        $learner = $this->source('learner_dashboard.php');
        $this->assertStringNotContainsString('pull_to_refresh', $learner);
        $this->assertStringContainsString('function initPullToRefresh()', $learner);
    }
}
