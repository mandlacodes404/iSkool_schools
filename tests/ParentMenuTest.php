<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app's menus, which are built to follow the learner menus: the school logo and name at the
 * top, the avatar row (with "Parent" under the name) at the bottom, the same account card behind the avatar, search,
 * a collapsible sidebar and shortcuts on desktop, and a phone menu that pushes the page aside with rounded edges.
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

        foreach (['<div class="pa-brand">' => '<button type="button" class="pa-search"', '<div class="pa-drawer-head">' => '<button type="button" class="pa-search"'] as $from => $to) {
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
        $js = $this->source('assets/js/parent/parent_menu.js');
        $page = $this->source('parent_dashboard.php');

        // All three containers are filled by the same function
        $this->assertSame(3, substr_count($page, 'data-pa-menu'));
        $this->assertStringContainsString("document.querySelectorAll('[data-pa-menu]')", $js);

        // name and email, actions, divider, Sign out in red, version
        foreach (["'pa-menu-head'", "'pa-menu-name'", "'pa-menu-email'", "'Add a child'", "'Keyboard shortcuts'", "'pa-menu-sep'", "'Sign out'", "'pa-danger'", "'pa-menu-ver'"] as $part) {
            $this->assertStringContainsString($part, $js);
        }

        // The email and version come from the server-rendered page, not from the markup of an API answer
        $this->assertStringContainsString('data-email="<?= pa_e($parent_email) ?>"', $page);
        $this->assertStringContainsString('iskool_app_version_label()', $page);
    }

    public function test_menu_script_puts_text_on_the_page_never_markup(): void
    {
        foreach (['assets/js/parent/parent_menu.js', 'assets/js/parent/parent_app.js'] as $file) {
            $this->assertStringNotContainsString('innerHTML', $this->source($file), $file);
            $this->assertStringNotContainsString('insertAdjacentHTML', $this->source($file), $file);
        }
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

    public function test_menu_stylesheet_only_moves_the_bottom_tabs_it_never_restyles_them(): void
    {
        $css = $this->source('assets/css/parent/parent_menu.css');

        // The tabs may slide with the page and have their motion switched off while dragging, nothing else
        $allowed = ['transform', 'transition', 'transition-duration', 'will-change', 'pointer-events'];
        $this->assertGreaterThan(0, preg_match_all('/([^{}]+)\{([^{}]*)\}/', $css, $rules, PREG_SET_ORDER));
        $touched = 0;
        foreach ($rules as $rule) {
            if (strpos($rule[1], '.pa-tabs') === false) {
                continue;
            }
            $touched++;
            preg_match_all('/([a-z-]+)\s*:/', $rule[2], $props);
            foreach ($props[1] as $prop) {
                $this->assertContains($prop, $allowed, 'parent_menu.css styles .pa-tabs with ' . $prop . ' in: ' . trim($rule[1]));
            }
        }
        $this->assertGreaterThan(0, $touched);
    }

    public function test_sidebar_has_search_a_collapse_button_and_the_group_headings(): void
    {
        $page = $this->source('parent_dashboard.php');

        $side = $this->between($page, '<aside class="pa-side"', '</aside>');
        $this->assertStringContainsString('id="paToggle"', $side);
        $this->assertStringContainsString('id="paSearchBtn"', $side);
        $this->assertStringContainsString('id="paSearchKbd"', $side);
        $this->assertStringContainsString('pa_nav_links($nav, $groups)', $side);

        $drawer = $this->between($page, '<aside class="pa-drawer"', '</aside>');
        $this->assertStringContainsString('id="paDrawerSearch"', $drawer);
        $this->assertStringContainsString('pa_nav_links($nav, $groups)', $drawer);

        // Home stands alone, then two headed groups, as in the learner menu
        $this->assertStringContainsString("\$groups = ['report' => 'Progress', 'news' => 'School'];", $page);

        // pa-label already means the small uppercase heading inside the Syllabus screen
        $this->assertStringNotContainsString('class="pa-label"', $page);
    }

    public function test_the_saved_rail_choice_is_read_under_the_same_key_before_paint_and_by_the_script(): void
    {
        $page = $this->source('parent_dashboard.php');
        $js = $this->source('assets/js/parent/parent_menu.js');

        $this->assertStringContainsString("localStorage.getItem('parentApp.menuCollapsed')", $page);
        $this->assertStringContainsString("var COLLAPSE_KEY = 'parentApp.menuCollapsed';", $js);
        // With no saved choice the rail is used below 1100px, in the page head and in the script
        $this->assertStringContainsString('window.innerWidth < 1100', $page);
        $this->assertStringContainsString('(max-width: 1099px)', $js);
        $this->assertStringContainsString("classList.add('pa-collapsed')", $page);
        $this->assertStringContainsString("root.classList.toggle('pa-collapsed'", $js);
    }

    public function test_go_to_shortcuts_use_a_different_letter_per_page_and_every_icon_exists(): void
    {
        $js = $this->source('assets/js/parent/parent_menu.js');
        $css = $this->source('assets/css/parent/parent_menu.css');
        $page = $this->source('parent_dashboard.php');

        $nav = $this->between($js, 'var NAV = [', '];');
        $this->assertSame(5, preg_match_all("/\\['(\\w+)',\\s+'(\\w+)',\\s+'(\\w)',/", $nav, $rows, PREG_SET_ORDER));
        $letters = array_column($rows, 3);
        $this->assertSame($letters, array_values(array_unique($letters)), 'two pages share a go-to letter');
        foreach ($rows as $row) {
            $this->assertStringContainsString("['{$row[1]}',", $page, "{$row[1]} is not a page of the menu");
            $this->assertStringContainsString("--pa-i-{$row[2]}:", $css, "icon {$row[2]} is missing from parent_menu.css");
        }
        // The icons the actions use
        foreach (['panel', 'keyboard', 'sun', 'moon', 'plus', 'logout', 'search', 'x', 'updown'] as $icon) {
            $this->assertStringContainsString("--pa-i-$icon:", $css, "icon $icon is missing from parent_menu.css");
        }
        // The single-key shortcuts can be switched off in one place
        $this->assertStringContainsString('var SHORTCUTS_ENABLED = true;', $js);
        $this->assertStringContainsString('!SHORTCUTS_ENABLED', $js);
    }

    public function test_phone_menu_pushes_the_page_aside_with_the_learners_curve(): void
    {
        $css = $this->source('assets/css/parent/parent_menu.css');

        $this->assertStringContainsString('--pa-curve: 35px;', $css);
        $this->assertStringContainsString('border-radius: var(--pa-curve) 0 0 var(--pa-curve);', $css);
        // The corner pieces paint the menu colour into the gaps the curve leaves
        $this->assertStringContainsString('.pa-overlay::before', $css);
        $this->assertStringContainsString('.pa-overlay::after', $css);
        $this->assertMatchesRegularExpression('/html\.pa-menu-open \.pa-top, html\.pa-menu-open \.pa-content, html\.pa-menu-open \.pa-tabs \{ transform: translate3d\(var\(--pa-dw\), 0, 0\); \}/', $css);
        // Without this the phone's browser zooms out to fit the pushed page when a field is focused
        $this->assertMatchesRegularExpression('/\.pa \{ overflow-x: clip; \}/', $css);
    }

    public function test_menu_hooks_into_the_page_script(): void
    {
        $page = $this->source('parent_dashboard.php');
        $app = $this->source('assets/js/parent/parent_app.js');
        $menu = $this->source('assets/js/parent/parent_menu.js');

        // The menu loads first, because parent_app.js tells it who the parent is
        $this->assertLessThan(strpos($page, '<script src="assets/js/parent/parent_app.js'), strpos($page, '<script src="assets/js/parent/parent_menu.js'));
        $this->assertStringContainsString('window.paMenu = {', $menu);
        $this->assertStringContainsString('window.paMenu.setParent(state.parent)', $app);

        // Everything that belongs to the menus left the page script
        foreach (['paDrawer', 'paOverlay', 'paMenuSheet', 'buildMenus', 'toggleTheme', 'openDrawer'] as $gone) {
            $this->assertStringNotContainsString($gone, $app, "$gone should live in parent_menu.js");
        }
    }

    public function test_assets_are_cache_busted(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the page must move with the files
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('parent_app.css?v=1.10', $page);
        $this->assertStringContainsString('parent_menu.css?v=1.0', $page);
        $this->assertStringContainsString('parent_menu.js?v=1.0', $page);
        $this->assertStringContainsString('parent_app.js?v=1.10', $page);
    }
}
