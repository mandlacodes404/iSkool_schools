<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the teacher announcements icon. The phone bottom nav draws it as a bell, so everywhere else on the teacher
 * side that stands for Announcements (each row of the phone list, the phone menu's search results, and the desktop
 * sidebar and Ctrl K palette) uses the same bell, not a speaker or a megaphone. The icons were checked by eye in a
 * browser with the real stylesheets and scripts; these read the sources so the bell is not quietly swapped back.
 */
final class TeacherAnnouncementsBellTest extends TestCase
{
    private const BELL_BODY = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9';
    private const BELL_CLAPPER = 'M10.3 21a1.94 1.94 0 0 0 3.4 0';

    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_the_bottom_nav_bell_is_the_one_the_other_places_copy(): void
    {
        $page = $this->source('teacher_dashboard.php');
        $nav = substr($page, strpos($page, '<nav id="mobileBottomNav"'));
        $nav = substr($nav, 0, strpos($nav, '</nav>'));

        $this->assertStringContainsString(self::BELL_BODY, $nav);
        $this->assertStringContainsString(self::BELL_CLAPPER, $nav);
    }

    public function test_the_phone_list_rows_use_the_bell_and_no_speaker(): void
    {
        $js = $this->source('assets/js/teacher/announcements.js');

        $this->assertSame(1, substr_count($js, '<div class="an-mobile-row-icon">'));
        $row = substr($js, strpos($js, '<div class="an-mobile-row-icon">'));
        $row = substr($row, 0, strpos($row, '</div>'));

        $this->assertStringContainsString(self::BELL_BODY, $row);
        $this->assertStringContainsString(self::BELL_CLAPPER, $row);
        $this->assertStringNotContainsString('M11 5L6 9H2v6h4l5 4V5z', $js, 'the old speaker is gone from the list');
        $this->assertStringContainsString('stroke="${iconStroke}"', $row, 'the row icon keeps the list grey');
    }

    public function test_both_teacher_menus_draw_announcements_with_the_bell(): void
    {
        foreach (['assets/css/teacher/teacher_desktop_menu.css', 'assets/css/teacher/teacher_mobile_menu.css'] as $file) {
            $css = $this->source($file);

            $this->assertStringNotContainsString('megaphone', $css, $file . ' still has the megaphone');
            $this->assertSame(1, preg_match('/--dm-i-bell: url\("data:image\/svg\+xml,([^"]*)"\);/', $css, $m));
            $this->assertStringContainsString(self::BELL_BODY, $m[1], $file . ' bell mask is not the bottom-nav bell');
            $this->assertMatchesRegularExpression('/teacher_announcements"\][^}]*--dm-ico: var\(--dm-i-bell\)/', $css, $file . ' announcements row does not use the bell');
        }

        $this->assertMatchesRegularExpression("/\\['teacher_announcements', 'bell',/", $this->source('assets/js/teacher/teacher_desktop_menu.js'));
        $this->assertStringContainsString("teacher_announcements: 'bell'", $this->source('assets/js/teacher/teacher_mobile_menu.js'));
        $this->assertStringNotContainsString('megaphone', $this->source('assets/js/teacher/teacher_desktop_menu.js'));
        $this->assertStringNotContainsString('megaphone', $this->source('assets/js/teacher/teacher_mobile_menu.js'));
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        $php = $this->source('teacher_dashboard.php');

        foreach (['teacher_desktop_menu.css?v=2.6', 'teacher_mobile_menu.css?v=1.9', 'teacher_desktop_menu.js?v=1.1', 'teacher_mobile_menu.js?v=1.1', 'announcements.js?v=6.4'] as $pinned) {
            $this->assertStringContainsString($pinned, $php, $pinned . ' is not what the page links');
        }
    }
}
