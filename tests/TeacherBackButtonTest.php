<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the back button on the teacher phone detail pages (#teacherHeaderBackBtn in teacher_dashboard.php, styled in
 * assets/css/teacher/teacher_dashboard.css, shown by configureTeacherHeader in assets/js/teacher/dashboard.js).
 * It is drawn like the back button of a normal app: a thin chevron and the previous page's name at 17px regular, with a
 * 44px tap target. These checks read the sources; how it looks was checked in a phone-sized browser.
 */
final class TeacherBackButtonTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The phone block that styles the back button */
    private function block(): string
    {
        $css = $this->source('assets/css/teacher/teacher_dashboard.css');
        $start = strpos($css, 'DETAIL-MODE BACK BUTTON');
        $this->assertNotFalse($start, 'the back button block is missing from teacher_dashboard.css');
        $media = strpos($css, '@media (max-width: 768px) {', $start);
        $this->assertNotFalse($media, 'the back button block must be inside a phone media query');
        $end = strpos($css, "\n        }\n", $media);
        return substr($css, $media, $end - $media);
    }

    public function test_the_back_button_is_a_normal_app_back_button(): void
    {
        $block = $this->block();
        // 44px tap target, chevron lined up with the page content, 17px regular label
        $this->assertStringContainsString('min-height: 44px;', $block);
        $this->assertStringContainsString('margin: -4px 0 -4px -14px;', $block);
        $this->assertMatchesRegularExpression('/#teacherHeaderBackBtn svg \{ width: 30px; height: 30px;/', $block);
        $this->assertMatchesRegularExpression('/#teacherHeaderBackLabel \{[^}]*font-size: 17px;[^}]*font-weight: 400;/s', $block);
        // the page's own type, and only the light weights
        $this->assertStringContainsString("font-family: 'Nunito', sans-serif;", $block);
        $this->assertDoesNotMatchRegularExpression('/font-weight:\s*(?!400\b|600\b)\d+/', $block);
    }

    public function test_the_taller_tap_target_does_not_make_the_header_taller(): void
    {
        // The header is 60px high because of the avatar (36px) and its 12px padding. A 44px button with -4px top and
        // bottom margins takes 36px of that row, so the content offset (--teacher-top-nav-height) does not change.
        $block = $this->block();
        $this->assertSame(1, preg_match('/min-height: (\d+)px;\s*margin: (-?\d+)px 0 (-?\d+)px/', $block, $m));
        $this->assertLessThanOrEqual(36, (int) $m[1] + (int) $m[2] + (int) $m[3], 'the button must not be taller than the avatar in the header row');
    }

    public function test_the_block_has_no_teal_and_is_beaten_by_light_mode_not_the_other_way_round(): void
    {
        $block = $this->block();
        foreach (['#4fd1c5', '#14b8a6', 'teal'] as $teal) {
            $this->assertStringNotContainsStringIgnoringCase($teal, $block);
        }
        // light mode sets the button's colour behind its own gate, so it out-ranks the dark colour set here
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        $this->assertSame(1, preg_match('/\.top-nav-wrapper #teacherHeaderBackBtn,\n/', $light));
        $this->assertStringContainsString('.top-nav-wrapper #teacherHeaderBackBtn', $block);
    }

    public function test_the_markup_and_the_script_still_use_the_ids_the_style_targets(): void
    {
        $php = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('<button id="teacherHeaderBackBtn" onclick="window.handleTeacherHeaderBack(event)"', $php);
        $this->assertStringContainsString('<polyline points="15 18 9 12 15 6"></polyline>', $php);
        $this->assertStringContainsString('<span id="teacherHeaderBackLabel"></span>', $php);

        $js = $this->source('assets/js/teacher/dashboard.js');
        $this->assertStringContainsString("if (backBtn) backBtn.style.display = 'flex';", $js, 'the button is shown as a flex row');
        $this->assertStringContainsString('backLabelEl.innerText = backLabel', $js);
    }

    public function test_the_stylesheet_carries_a_new_version(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $this->assertStringContainsString('assets/css/teacher/teacher_dashboard.css?v=14.2', $this->source('teacher_dashboard.php'));
    }
}
