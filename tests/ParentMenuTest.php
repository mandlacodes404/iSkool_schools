<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app's menu, which is built to follow the learner menu: the school logo and name at the
 * top, the avatar row (with "Parent" under the name) at the bottom, and the same account card behind the avatar.
 * These checks read the source files; how it looks and behaves was checked in a desktop and a phone-sized browser.
 */
final class ParentMenuTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The markup between two markers in parent_dashboard.php. */
    private function between(string $html, string $from, string $to): string
    {
        $start = strpos($html, $from);
        $this->assertNotFalse($start, "missing: $from");
        $end = strpos($html, $to, $start);
        $this->assertNotFalse($end, "missing: $to");
        return substr($html, $start, $end - $start);
    }

    public function test_sidebar_and_phone_menu_start_with_the_school_logo_and_name(): void
    {
        $page = $this->source('parent_dashboard.php');

        foreach (['<div class="pa-brand">' => '</aside>', '<div class="pa-drawer-head">' => '<nav'] as $from => $to) {
            $block = $this->between($page, $from, $to);
            $this->assertStringContainsString('pa_school_mark($school)', $block);
            $this->assertStringContainsString("pa_e(\$school['name'])", $block);
        }

        // With no uploaded logo the mark falls back to the school's initials, as in the learner menu
        $this->assertStringContainsString('pa-mark--initials', $page);
        $this->assertStringContainsString("\$school['initials']", $page);
    }

    public function test_avatar_row_keeps_the_parent_text_in_both_menus(): void
    {
        $page = $this->source('parent_dashboard.php');

        // One helper draws the row, so the sidebar and the phone menu cannot drift apart
        $this->assertSame(2, substr_count($page, 'pa_account_row($parent_initials, $parent_name)'));
        $this->assertMatchesRegularExpression('/<span class="pa-account-role">Parent<\/span>/', $page);
        $this->assertStringContainsString('pa-account-chev', $page);
    }

    public function test_account_sheet_is_outside_the_drawer(): void
    {
        $page = $this->source('parent_dashboard.php');

        // The drawer slides with a transform, which would pin a fixed-position sheet to the drawer instead of the screen
        $drawer = $this->between($page, '<aside class="pa-drawer"', '</aside>');
        $this->assertStringNotContainsString('id="paMenuSheet"', $drawer);
        $this->assertStringContainsString('id="paMenuSheet"', $page);
        $this->assertGreaterThan(strpos($page, '</aside>', strpos($page, 'class="pa-drawer"')), strpos($page, 'id="paMenuSheet"'));
    }

    public function test_account_card_has_the_learner_structure_in_every_place_it_opens(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $page = $this->source('parent_dashboard.php');

        // All three containers are filled by the same function
        $this->assertSame(3, substr_count($page, 'data-pa-menu'));
        $this->assertStringContainsString("document.querySelectorAll('[data-pa-menu]')", $js);

        // name and email, actions, divider, Sign out in red, version
        foreach (["'pa-menu-head'", "'pa-menu-name'", "'pa-menu-email'", "'Add a child'", "'pa-menu-sep'", "'Sign out'", "'pa-danger'", "'pa-menu-ver'"] as $part) {
            $this->assertStringContainsString($part, $js);
        }

        // The email and version come from the server-rendered page, not from the markup of an API answer
        $this->assertStringContainsString('data-email="<?= pa_e($parent_email) ?>"', $page);
        $this->assertStringContainsString('iskool_app_version_label()', $page);
        $this->assertStringNotContainsString('innerHTML', $js);
    }

    public function test_phone_bottom_tabs_still_use_the_same_five_links(): void
    {
        $page = $this->source('parent_dashboard.php');

        // The bottom tab bar is left as it was: the same loop over the same five pages
        $tabs = $this->between($page, '<nav class="pa-tabs"', '</nav>');
        $this->assertStringContainsString('<a class="pa-tab" href="#/<?= $id ?>" data-route="<?= $id ?>"><?= pa_icon($icon, 22) ?><span><?= pa_e($label) ?></span></a>', $tabs);
        foreach (['home', 'report', 'syllabus', 'news', 'events'] as $route) {
            $this->assertStringContainsString("['$route',", $page);
        }
    }

    public function test_assets_are_cache_busted(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the page must move with the files
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('parent_app.css?v=1.5', $page);
        $this->assertStringContainsString('parent_app.js?v=1.6', $page);
    }
}
