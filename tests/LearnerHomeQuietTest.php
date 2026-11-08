<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the quiet Home on the learner phone app: the same look as the Quizzes, Assignments, Announcements and
 * Evaluations lists. A greeting with a counts line, one "Up next" block, plain lists with a status ring for each thing to
 * do and an icon (a bell for an announcement) for each thing from a teacher, and a week strip with no card. Weights are
 * 400 for text and 600 for titles and names. Desktop keeps its own Home.
 * How it looks was checked by eye in a phone-sized browser with the real script and stylesheet (dark and light, 320 and
 * 390px wide, every state: things to do, caught up, no class, nothing posted, due today and tomorrow, a long title);
 * these read the sources so the things a later edit could quietly undo stay put.
 */
final class LearnerHomeQuietTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    private function between(string $text, string $start, string $end): string
    {
        $a = strpos($text, $start);
        $this->assertNotFalse($a, "'$start' not found");
        $b = strpos($text, $end, $a);
        $this->assertNotFalse($b, "'$end' not found after '$start'");
        return substr($text, $a, $b - $a);
    }

    /** the phone Home rules: from its heading comment to the end of the file */
    private function homeCss(): string
    {
        $css = $this->source('assets/css/learner/manual.css');
        $a = strpos($css, '/* ═══ Home (phones): the quiet Home');
        $this->assertNotFalse($a);
        return substr($css, $a);
    }

    private function homeJs(): string
    {
        return $this->between($this->source('assets/js/learner/manual.js'), 'window.LHM = {', '// CAROUSEL DOTS');
    }

    // ── the look ─────────────────────────────────────────────────────────────────────────────────

    public function test_nothing_on_the_phone_home_is_heavier_than_600(): void
    {
        preg_match_all('/font-weight:\s*(\d+)/', $this->homeCss(), $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
    }

    public function test_the_phone_home_has_no_cards_pills_big_buttons_or_teal(): void
    {
        $css = $this->homeCss();
        foreach (['#4fd1c5', '#187a72', '#a78bfa', '#ff9b85'] as $colour) {
            $this->assertStringNotContainsString($colour, $css);
        }
        $this->assertStringNotContainsString('border-radius: 99px', $css, 'the coloured pills are gone');
        $this->assertStringNotContainsString('border-radius: 28px', $css, 'the big hero card is gone');
        $this->assertStringNotContainsString('lhx-chip', $css);
        $this->assertStringNotContainsString('lhx-go', $css);
        $this->assertStringNotContainsString('lhx-tile', $css, 'no icon tiles or teacher avatars');
        $this->assertStringNotContainsString('lhx-week-card {' . ' display: block; width: 100%; box-sizing: border-box; padding: 8px; border-radius: 22px', $css);
    }

    public function test_the_phone_home_is_phones_only_and_light_mode_is_the_light_set_of_colours(): void
    {
        $css = $this->homeCss();
        $this->assertStringContainsString('@media (max-width: 768px) {', $css);
        foreach (['--x-title', '--x-body', '--x-muted', '--x-faint', '--x-line', '--x-press', '--x-surf', '--x-ring', '--x-soon', '--x-chipline', '--x-chipon', '--x-chipon-text'] as $token) {
            $this->assertSame(2, substr_count($css, $token . ':'), "$token needs a dark value and a light value");
        }
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .lh-mobile-wrapper.lhx {', $css);
        $this->assertStringContainsString('--x-title: #282924;', $css);
        // the page shell still finds this page by its root class
        $this->assertStringContainsString('<div class="lh-mobile-wrapper lhx">', $this->source('assets/js/learner/manual.js'));
    }

    public function test_rows_run_edge_to_edge_and_every_piece_sits_20px_in(): void
    {
        $css = $this->homeCss();
        $this->assertSame(1, preg_match('/\.lh-mobile-wrapper\.lhx \{[^}]*margin:\s*0 -18px;/s', $css), 'the wrapper cancels the content area padding so hairlines reach the screen edge');
        $this->assertSame(1, preg_match('/\.lhx-row \{[^}]*padding:\s*11px 20px;/s', $css));
        $this->assertSame(1, preg_match('/\.lhx-st \{[^}]*padding:\s*26px 20px 4px;/s', $css));
        $this->assertSame(1, preg_match('/\.lhx-hero \{[^}]*width:\s*calc\(100% - 40px\);[^}]*margin:\s*20px 20px 0;/s', $css));
        $this->assertSame(1, preg_match('/\.lhx-row \+ \.lhx-row::before \{[^}]*left:\s*58px;/s', $css), 'the hairline starts under the title, not under the ring');
    }

    // ── what it says ─────────────────────────────────────────────────────────────────────────────

    public function test_the_greeting_has_a_counts_line_that_names_what_is_due_today_or_tomorrow(): void
    {
        $js = $this->homeJs();
        $this->assertStringContainsString('<h1 class="lhx-name">', $js);
        $this->assertStringContainsString('<p class="lhx-sub">${counts}</p>', $js);
        $this->assertStringContainsString('const parts = [`${todo.length} to do`];', $js);
        $this->assertStringContainsString('<b>${today} due today</b>', $js);
        $this->assertStringContainsString('<b>${tomorrow} due tomorrow</b>', $js);
        // only when there is something to do; a caught-up or empty class says it in the block instead
        $this->assertStringContainsString("if (!todo.length) return '';", $js);
    }

    public function test_up_next_is_one_quiet_block_with_a_plain_button_and_only_ever_shows_something_to_do(): void
    {
        $js = $this->homeJs();
        $this->assertStringContainsString('Up next · ${e(this.heroState(it))}', $js);
        $this->assertStringContainsString('<span class="lhx-cta">${this.heroCta(it)}</span>', $js);
        $this->assertStringContainsString("return 'Continue';", $js);
        $this->assertStringContainsString('hero = M.hero(todo[0]);', $js);
        // announcements and resources only take the block when nothing is left to do
        $this->assertStringContainsString("hero = M.calm('All caught up', r.title", $js);
        $this->assertStringContainsString('lhx-hero--static', $js);
    }

    public function test_things_to_do_are_rows_with_a_status_ring_and_the_due_day_in_words(): void
    {
        $js = $this->homeJs();
        $this->assertStringContainsString('${it.in_progress ? this.ringHalf : this.ring}', $js);
        $this->assertStringContainsString("lhx-ring\${soon ? ' lhx-ring--soon' : ''}", $js);
        $this->assertStringContainsString('dueWords(n) { return n <= 0 ? \'due today\' : n === 1 ? \'due tomorrow\' : `due in ${n} days`; },', $js);
        $this->assertStringContainsString('<span class="lhx-soon">${due}</span>', $js);
        $this->assertStringContainsString('const more = rest.length - 4;', $js);
        // the colour of the ring is a token, so light mode needs no rule of its own
        $this->assertStringContainsString('stroke="currentColor"', $this->between($js, 'ring: ', 'ringHalf:'));
    }

    public function test_from_your_teachers_uses_icons_not_teacher_avatars(): void
    {
        $js = $this->homeJs();
        $feed = $this->between($js, 'feed(items) {', 'function buildMobileHomeV2');
        $this->assertStringContainsString('<span class="lhx-ico">${D.svg(it.type, 24)}</span>', $feed);
        $this->assertStringNotContainsString('initials(', $js, 'no teacher initials any more');
        $this->assertStringNotContainsString('lhx-tile', $js);
        // an announcement is the bell, a resource the book, drawn by the icons the Home already shares
        $icons = $this->between($this->source('assets/js/learner/manual.js'), 'icons: {', 'esc(s) {');
        $this->assertStringContainsString("announcement: '<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/>", $icons);
        $this->assertStringContainsString("resource: '<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/>", $icons);
        // drawn in the muted ring colour, a little finer than the default stroke, so it sits with the rings
        $css = $this->homeCss();
        $this->assertSame(1, preg_match('/\.lhx-ring, #api-content-area \.lhx \.lhx-ico \{[^}]*color:\s*var\(--x-ring\);/s', $css));
        $this->assertStringContainsString('.lhx-ico svg { stroke-width: 1.7; }', $css);
    }

    public function test_the_week_is_a_flat_strip_and_still_opens_the_calendar(): void
    {
        $js = $this->homeJs();
        $css = $this->homeCss();
        $this->assertStringContainsString('onclick="window.fetchLearnerCalendar ? fetchLearnerCalendar() : null"', $js);
        $this->assertSame(1, preg_match('/\.lhx-week-card \{[^}]*padding:\s*0;/s', $css));
        $this->assertStringNotContainsString('border: 1px solid var(--x-line); color: var(--x-text)', $css);
        $this->assertSame(1, preg_match('/\.lhx-day--today \.lhx-day-num \{[^}]*background:\s*var\(--x-chipon\);/s', $css), 'today is a filled circle');
    }

    // ── desktop and cache versions ───────────────────────────────────────────────────────────────

    public function test_desktop_home_and_the_shared_helpers_are_untouched(): void
    {
        $js = $this->source('assets/js/learner/manual.js');
        foreach (['function buildDesktopHome(data, manualHtml)', 'window.LHD = {', 'window.openLearnerHomeDesktop = function', 'function buildDesktopTodoCards', 'function buildDesktopRecentCards', 'function renderLearnerSnapshotPanel'] as $piece) {
            $this->assertStringContainsString($piece, $js);
        }
        $this->assertStringContainsString('if (isMobile) return buildMobileHomeV2(data);', $js);
        $this->assertStringContainsString('return buildDesktopHome(data, manualHtml);', $js);
        // the rules for the phone Home all live in the phone block at the end of the file
        $css = $this->source('assets/css/learner/manual.css');
        $this->assertSame(1, substr_count($css, '/* ═══ Home (phones): the quiet Home'));
        $this->assertStringNotContainsString('Home (phones): "Focus" layout', $css);
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('learner/manual.css?v=8.8', $php);
        $this->assertStringContainsString('learner/manual.js?v=12.2', $php);
    }

    public function test_the_stylesheet_the_home_script_adds_is_the_same_version_as_the_page_link(): void
    {
        // manual.js adds its own <link> to manual.css when Home opens, after every other stylesheet, so it wins ties.
        // It once asked for ?v=8.7 while the page asked for ?v=8.8: the installed app then painted the old Home look
        // (grey card, dark button, boxed rows) over the new markup. The script now reuses the page's own link, and its
        // fallback must be the same URL as that link.
        $js = $this->source('assets/js/learner/manual.js');
        $php = $this->source('learner_dashboard.php');
        $this->assertSame(1, preg_match('#<link rel="stylesheet" href="assets/css/learner/(manual\.css\?v=[0-9.]+)">#', $php, $page));
        $this->assertSame(1, preg_match("#const manualStyleHref = pageManualStyle \? pageManualStyle\.getAttribute\('href'\) : 'assets/css/learner/(manual\.css\?v=[0-9.]+)';#", $js, $script));
        $this->assertSame($page[1], $script[1], 'manual.js and learner_dashboard.php ask for different versions of manual.css');
        $this->assertSame(1, substr_count($js, 'manual.css?v='), 'only one place in manual.js names a version of manual.css');
    }
}
