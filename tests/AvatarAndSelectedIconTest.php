<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for two details that make the three apps look like one product:
 *   1. The avatar circle. The learner app is the reference; the teacher and parent apps match it, in light and dark.
 *      (Desktop already matched; on phones the teacher and parent used their own colours.)
 *   2. The icon of a selected menu item. The parent app used teal there; it now uses the dull warm grey the learner
 *      menu already has in place of teal (--dm-ac).
 * These checks read the source files. The result was checked in a phone-sized browser by reading the computed colours
 * of every avatar and selected icon in all three apps.
 */
final class AvatarAndSelectedIconTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** One CSS rule body, from its selector to the closing brace. */
    private function rule(string $css, string $selector): string
    {
        $start = strpos($css, $selector . ' {');
        $this->assertNotFalse($start, "missing rule: $selector");
        return substr($css, $start, strpos($css, '}', $start) - $start);
    }

    // ── The selected icon ────────────────────────────────────────────────────────────────────────────────

    public function test_the_parent_has_the_learners_dull_grey_for_selected_icons_in_light_and_dark(): void
    {
        $learner = $this->source('assets/css/learner/desktop_menu.css');
        $this->assertStringContainsString('--dm-ac: #d4d1c8;', $learner);
        $this->assertStringContainsString('--dm-ac: #5e5d59;', $learner);

        $css = $this->source('assets/css/parent/parent_app.css');
        $light = strpos($css, '--pa-ac: #5e5d59;');
        $dark = strpos($css, '--pa-ac: #d4d1c8;');
        $this->assertNotFalse($light);
        $this->assertNotFalse($dark);
        // the light value sits in the light theme block, the dark value in the dark one
        $darkBlock = strpos($css, 'html[data-theme="dark"] {');
        $this->assertLessThan($darkBlock, $light);
        $this->assertGreaterThan($darkBlock, $dark);
    }

    public function test_a_selected_icon_in_the_parent_menus_is_not_teal(): void
    {
        $menu = $this->source('assets/css/parent/parent_menu.css');
        // the selected link in the phone menu, and the selected row of the search palette
        $this->assertStringContainsString('.pa-drawer .pa-nav-link[aria-current="page"] svg { color: var(--pa-ac); }', $menu);
        $this->assertStringContainsString('#paPaletteList li[aria-selected="true"] .pa-pico { background: var(--pa-ac); }', $menu);

        // and no rule for a selected or current item anywhere takes the teal accent
        foreach (['assets/css/parent/parent_app.css', 'assets/css/parent/parent_menu.css'] as $path) {
            foreach (explode("\n", $this->source($path)) as $n => $line) {
                if (strpos($line, '[aria-current') !== false || strpos($line, '[aria-selected') !== false) {
                    $this->assertStringNotContainsString('--pa-accent', $line, "$path line " . ($n + 1));
                }
            }
        }
    }

    // ── The avatar circle ────────────────────────────────────────────────────────────────────────────────

    public function test_the_learner_phone_avatar_is_the_reference(): void
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $this->assertStringContainsString('background-color: rgba(0, 0, 0, 0.35);', $css);
        $this->assertStringContainsString('color: #f4e4e4;', $css);
        $this->assertStringContainsString('font-weight: 800;', $css);
        // the top bar in light mode
        $this->assertStringContainsString('.top-nav-avatar { background: #e9e8e2; }', $this->source('assets/css/learner/mobile_light.css'));
    }

    public function test_the_teacher_phone_menu_avatar_matches_the_learner_in_light_and_dark(): void
    {
        $css = $this->source('assets/css/teacher/teacher_mobile_menu.css');
        $start = strpos($css, '.dm-account-root .initials-avatar {');
        $this->assertNotFalse($start);
        $rule = substr($css, $start, strpos($css, '}', $start) - $start);

        $this->assertStringContainsString('background: rgba(0,0,0,.35)', $rule);
        $this->assertStringContainsString('color: #f4e4e4', $rule);
        $this->assertStringContainsString('font-weight: 800', $rule);
        $this->assertStringContainsString('border: 0', $rule);
        $this->assertStringNotContainsString('#1c2128', $rule, 'the blue-grey circle with a border is gone');

        // The learner has no light override for this circle, so the teacher must not have one either
        $this->assertStringNotContainsString('.dm-account-root .initials-avatar { background: #e9e8e2', $css);
    }

    public function test_the_teacher_settings_avatar_matches_the_learners(): void
    {
        $pattern = '/\.ms-av-face \{[^}]*?background: (#[0-9a-f]{6});[^}]*?color: (#[0-9a-f]{6});/';
        $this->assertSame(1, preg_match($pattern, $this->source('assets/css/learner/mobile_settings.css'), $learner));
        $this->assertSame(1, preg_match($pattern, $this->source('assets/css/teacher/teacher_mobile_settings.css'), $teacher));
        $this->assertSame([$learner[1], $learner[2]], [$teacher[1], $teacher[2]]);
    }

    public function test_the_parent_phone_avatars_match_the_learner(): void
    {
        $menu = $this->source('assets/css/parent/parent_menu.css');
        // the account row of the phone menu: same in light and dark, like the learner's
        $drawer = $this->rule($menu, '.pa-drawer-account .pa-avatar');
        $this->assertStringContainsString('background: rgba(0, 0, 0, .35)', $drawer);
        $this->assertStringContainsString('color: #f4e4e4', $drawer);
        $this->assertStringContainsString('font-weight: 800', $drawer);
        $this->assertStringContainsString("font-family: 'Nunito'", $drawer, 'the learner draws the initials in Nunito');

        // the top bar: translucent dark in dark mode; light mode keeps the cream circle that the learner has too
        $app = $this->source('assets/css/parent/parent_app.css');
        $top = $this->rule($app, 'html[data-theme="dark"] .pa-avatar-btn .pa-avatar');
        $this->assertStringContainsString('background: rgba(0, 0, 0, .35)', $top);
        $this->assertStringContainsString('color: #f4e4e4', $top);
        $this->assertStringContainsString('--pa-avatar-bg: #e9e8e2;', $app);
        $this->assertStringContainsString('--pa-avatar-fg: #555650;', $app);
    }

    public function test_the_desktop_avatars_still_match_the_learner(): void
    {
        $learner = $this->source('assets/css/learner/desktop_menu.css');
        $teacher = $this->source('assets/css/teacher/teacher_desktop_menu.css');
        $parent = $this->source('assets/css/parent/parent_app.css');
        foreach ([$learner, $teacher] as $css) {
            $this->assertStringContainsString('.initials-avatar { background-color: #2d2d2c; color: #c2c3b7; font-weight: 500; }', $css);
        }
        $this->assertStringContainsString('--pa-avatar-bg: #2d2d2c;', $parent);
        $this->assertStringContainsString('--pa-avatar-fg: #c2c3b7;', $parent);
    }

    // ── Cache versions ───────────────────────────────────────────────────────────────────────────────────

    public function test_the_changed_stylesheets_have_new_cache_versions(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the pages must move with the files
        $parent = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('parent_app.css?v=1.14', $parent);
        $this->assertStringContainsString('parent_menu.css?v=1.3', $parent);

        $teacher = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('teacher_mobile_menu.css?v=1.7', $teacher);
        $this->assertStringContainsString('teacher_mobile_settings.css?v=1.4', $teacher);
    }
}
