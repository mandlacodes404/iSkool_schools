<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for two phone-only spacing fixes on the teacher side:
 *  - Settings sits at the same 16px side padding as the lists (it used to sit inside a padded container, 34px in).
 *  - The calendar keeps its last block clear of the fixed bottom nav (it used to scroll under it).
 * These read the sources for the lines a later edit could quietly undo. How the pages actually look, and that the last
 * block clears the nav at 360, 390 and 430px wide in dark and light, was checked in a phone-sized browser with the real
 * stylesheets, scripts and bottom nav, not here.
 */
final class TeacherSettingsCalendarPhoneTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The first rule whose selector is exactly $selector, as its declaration text */
    private function rule(string $css, string $selector): string
    {
        $this->assertSame(1, preg_match('/(?:^|\n)\s*' . preg_quote($selector, '/') . '\s*\{([^}]*)\}/', $css, $m), $selector . ' rule not found');
        return $m[1];
    }

    public function test_settings_cancels_the_page_padding_and_puts_back_the_lists_16px(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_settings.css');
        $root = $this->rule($css, '.ms');

        $this->assertStringContainsString('margin: 0 -20px', $root, "#api-content-area's own 20px has to be cancelled, as the lists and detail pages do");
        $this->assertMatchesRegularExpression('/padding:\s*8px 16px calc\(/', $root, 'the side padding is the same 16px as the lists');
        $this->assertStringNotContainsString('max-width: 560px', $root, 'a max-width with auto margins would undo the negative margin');
        $this->assertStringNotContainsString('padding: 8px 14px', $root, 'the old nested 14px padding is gone');
    }

    public function test_settings_keeps_its_last_row_clear_of_the_bottom_nav(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_settings.css');
        $root = $this->rule($css, '.ms');

        $this->assertStringContainsString('var(--mbn-h, 85px)', $root);
        $this->assertStringContainsString('env(safe-area-inset-bottom, 0px)', $root);
        $this->assertStringContainsString('--mbn-h: 85px', $this->source('assets/css/teacher/teacher_dashboard.css'), 'the nav height variable the pages read still exists');
    }

    public function test_the_change_password_page_has_no_nav_so_it_keeps_its_own_bottom_padding_and_full_width_bars(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_settings.css');

        $this->assertStringContainsString('padding-bottom: 28px', $this->rule($css, '.ms.ms-detail'));
        $this->assertStringContainsString('margin: 0 -16px', $this->rule($css, '.ms-nav'), 'the back row runs edge to edge');
        $this->assertStringContainsString('margin: 0 -16px', $this->rule($css, '.ms-bar'), 'the save bar runs edge to edge');
        $this->assertStringContainsString('padding: 12px 16px calc(12px', $this->rule($css, '.ms-bar'));
    }

    public function test_the_calendar_keeps_its_last_block_clear_of_the_bottom_nav_on_phones(): void
    {
        $css = $this->source('assets/css/teacher/teacher_calendar.css');

        $this->assertSame(1, preg_match('/@media \(max-width: 768px\) \{\s*\.full-cal-page-wrapper \{([^}]*)\}/', $css, $m), 'the phone rule is missing (768px is where the bottom nav appears)');
        $this->assertStringContainsString('padding-bottom: calc(var(--mbn-h, 85px) + env(safe-area-inset-bottom, 0px)', $m[1]);
    }

    public function test_the_changed_stylesheets_have_new_cache_versions(): void
    {
        $php = $this->source('teacher_dashboard.php');

        $this->assertStringContainsString('teacher_mobile_settings.css?v=1.5', $php);
        $this->assertStringContainsString('teacher_calendar.css?v=1.4', $php);
    }
}
