<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app's phone Home screen.
 * These checks read the source files; how it looks was checked in a phone-sized browser (390px wide) with long
 * South African subject names such as "Afrikaans First Additional Language" and "Computer Applications Technology".
 */
final class ParentPhoneHomeTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** One CSS rule, from its selector to the closing brace. */
    private function rule(string $css, string $selector): string
    {
        $start = strpos($css, $selector . ' {');
        $this->assertNotFalse($start, "missing rule: $selector");
        $end = strpos($css, '}', $start);
        $this->assertNotFalse($end, "unclosed rule: $selector");
        return substr($css, $start, $end - $start);
    }

    public function test_subject_tile_columns_can_shrink_so_a_long_name_never_pushes_a_column_off_screen(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        $grid = $this->rule($css, '.pax-grid');
        // a plain "1fr 1fr" cannot shrink below the longest word in a tile and ran off the right edge of the phone
        $this->assertStringContainsString('repeat(2, minmax(0, 1fr))', $grid);
        $this->assertStringNotContainsString('1fr 1fr', $grid);
    }

    public function test_a_long_subject_name_wraps_to_two_lines_instead_of_being_cut_to_one(): void
    {
        $css = $this->source('assets/css/parent/parent_app.css');
        $name = $this->rule($css, '.pax-tile-name');
        $this->assertStringContainsString('-webkit-line-clamp: 2', $name);
        $this->assertStringNotContainsString('white-space: nowrap', $name);
        // the mark and bar sit at the bottom of the tile so tiles in one row line up
        $this->assertStringContainsString('margin-top: auto', $this->rule($css, '.pax-tile-mark'));
    }

    public function test_the_changed_stylesheet_has_a_new_cache_version(): void
    {
        // The service worker caches /assets/ by full URL, so the number in the page must move with the file
        $this->assertStringContainsString('parent_app.css?v=1.8', $this->source('parent_dashboard.php'));
    }
}
