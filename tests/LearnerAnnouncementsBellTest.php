<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the learner announcements icon on phones. The teacher app draws Announcements as a bell (see
 * TeacherAnnouncementsBellTest), so the learner phone app does too: the menu row and its search result, each row of the
 * announcements list (school-wide and teacher), and the empty list. They were a megaphone and a speaker. The desktop
 * learner menu and desktop panel are not part of this change.
 * The icons were checked by eye in a phone-sized browser with the real stylesheets and the real icon markup, in dark and
 * light mode; these read the sources so the bell is not quietly swapped back. (The rows of the quiet list draw the bell
 * in currentColor, so the colour comes from the row's classes; see LearnerAnnouncementsQuietTest.)
 */
final class LearnerAnnouncementsBellTest extends TestCase
{
    private const BELL_BODY = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9';
    private const BELL_CLAPPER = 'M10.3 21a1.94 1.94 0 0 0 3.4 0';
    private const OLD_SPEAKER = 'M11 5L6 9H2v6h4l5 4V5z';
    private const OLD_MEGAPHONE = 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z';

    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The text from $start up to the first $end after it */
    private function between(string $text, string $start, string $end, int $from = 0): string
    {
        $a = strpos($text, $start, $from);
        $this->assertNotFalse($a, "'$start' not found");
        $b = strpos($text, $end, $a);
        $this->assertNotFalse($b, "'$end' not found after '$start'");
        return substr($text, $a, $b - $a);
    }

    public function test_it_is_the_same_bell_as_the_teachers(): void
    {
        $teacher = $this->source('assets/js/teacher/announcements.js');
        $this->assertStringContainsString(self::BELL_BODY, $teacher);
        $this->assertStringContainsString(self::BELL_CLAPPER, $teacher);
        $this->assertStringContainsString(self::BELL_BODY, $this->source('assets/css/teacher/teacher_mobile_menu.css'));
    }

    public function test_the_phone_menu_draws_announcements_with_the_bell(): void
    {
        $css = $this->source('assets/css/learner/mobile_menu.css');
        $this->assertStringNotContainsString('megaphone', $css, 'the phone menu still has the megaphone');
        $this->assertSame(1, preg_match('/--dm-i-bell: url\("data:image\/svg\+xml,([^"]*)"\);/', $css, $m));
        $this->assertStringContainsString(self::BELL_BODY, $m[1]);
        $this->assertStringContainsString(self::BELL_CLAPPER, $m[1]);
        // the same stroke as the other menu masks, so the bell is as heavy as the rows around it
        $this->assertStringContainsString("stroke-width='1.75'", $m[1]);
        $this->assertStringContainsString('#nav-announcements-sidebar { order: 50; --dm-ico: var(--dm-i-bell); }', $css);

        // the menu's search results pick their icon from this list, and read the mask by name
        $js = $this->source('assets/js/learner/mobile_menu.js');
        $this->assertStringContainsString("'nav-announcements-sidebar': 'bell'", $js);
        $this->assertStringNotContainsString('megaphone', $js);
        $this->assertStringContainsString("'var(--dm-i-' + x.r.ico + ')'", $js);
    }

    public function test_each_row_of_the_phone_list_uses_the_bell_in_the_row_colour(): void
    {
        $js = $this->source('assets/js/learner/announcements.js');
        // one bell, drawn by one helper that every row (school-wide and teacher) goes through
        $bell = $this->between($js, 'function lanMobileBell() {', '}');
        $this->assertStringContainsString(self::BELL_BODY, $bell);
        $this->assertStringContainsString(self::BELL_CLAPPER, $bell);
        $this->assertStringContainsString('stroke="currentColor"', $bell, 'the row classes colour the bell: muted when read, orange when unread');
        $this->assertStringContainsString('width="20" height="20"', $bell, 'the bell is 20px inside the 40px tile; the markup says the same');
        $this->assertStringNotContainsString(self::OLD_MEGAPHONE, $bell);

        $row = $this->between($js, 'function lanMobileRowHtml(', '</svg>');
        $this->assertStringContainsString('<div class="lan-mobile-row-icon', $row);
        $this->assertStringContainsString('${lanMobileBell()}', $row, 'the row draws the bell through the helper');
        $this->assertStringNotContainsString(self::OLD_MEGAPHONE, $js, 'the old megaphone is gone from the learner list');
    }

    public function test_the_empty_phone_list_uses_the_bell(): void
    {
        $js = $this->source('assets/js/learner/announcements.js');
        $empty = $this->between($js, '<div class="lan-mobile-empty">', '</svg>');
        $this->assertStringContainsString(self::BELL_BODY, $empty);
        $this->assertStringContainsString(self::BELL_CLAPPER, $empty);
        $this->assertStringNotContainsString(self::OLD_SPEAKER, $empty);
        // drawn in the page's own muted colour (at half strength), so light mode needs no rule of its own for it
        $this->assertStringContainsString('stroke="currentColor"', $empty);
    }

    public function test_the_home_page_and_the_menu_link_already_used_a_bell(): void
    {
        // so the phone app now shows one icon for Announcements everywhere
        $this->assertStringContainsString('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>', $this->source('assets/js/learner/manual.js'));
        $this->assertStringContainsString('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>', $this->source('learner_dashboard.php'));
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        foreach (['learner/mobile_menu.css?v=2.2', 'learner/mobile_menu.js?v=1.5', 'learner/announcements.js?v=9.8'] as $pinned) {
            $this->assertStringContainsString($pinned, $php, "$pinned is not what the page links");
        }
    }
}
