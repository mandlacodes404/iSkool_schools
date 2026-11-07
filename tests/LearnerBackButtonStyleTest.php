<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the back button on the learner phone detail pages (#headerBackBtn in learner_dashboard.php, styled in the
 * phone block of assets/css/learner/learner_dashboard.css, shown by configureHeader in learner_dashboard.php).
 * It is the same button the teacher app has (see TeacherBackButtonTest): a thin 30px chevron and the previous page's name
 * at 17px regular, with a 44px tap target. These checks read the sources; how it looks was checked in a phone-sized
 * browser, next to the teacher's. (What the Back button does when pressed is in LearnerBackButtonTest.)
 */
final class LearnerBackButtonStyleTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The phone media block that holds the back button's rules, from its first rule to the end of the block */
    private function block(): string
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $start = strpos($css, 'Back button: the same one the teacher app shows');
        $this->assertNotFalse($start, 'the back button rules are missing from the phone block of learner_dashboard.css');
        $media = strrpos(substr($css, 0, $start), '@media (max-width: 768px) {');
        $this->assertNotFalse($media, 'the back button rules must be inside a phone media query');
        $end = strpos($css, "\n}\n", $start);
        $this->assertNotFalse($end);
        return substr($css, $media, $end - $media);
    }

    /** One rule of the phone block: the text between "<selector> {" and its closing brace. $last picks the last rule that
     *  ends in this selector, for the ones that are also the end of a shared selector list earlier on. */
    private function rule(string $selector, bool $last = false): string
    {
        $block = $this->block();
        $needle = "\n    " . $selector . " {";
        $start = $last ? strrpos($block, $needle) : strpos($block, $needle);
        $this->assertNotFalse($start, "the rule '$selector' is missing from the phone block");
        $end = strpos($block, "\n    }", $start);
        return substr($block, $start, $end - $start);
    }

    public function test_the_back_button_is_the_teachers_back_button(): void
    {
        $btn = $this->rule('#headerBackBtn');
        // 44px tap target, no gap between the chevron and the label, room on the right for the finger
        $this->assertStringContainsString('min-height: 44px;', $btn);
        $this->assertStringContainsString('gap: 0;', $btn);
        $this->assertStringContainsString('padding: 0 14px 0 0;', $btn);

        // the thin 30px chevron, sized here because `.main-header button svg` (20px) beats the markup's attributes
        $chevron = $this->rule('#headerBackBtn .hb-chevron');
        $this->assertStringContainsString('width: 30px;', $chevron);
        $this->assertStringContainsString('height: 30px;', $chevron);
        $this->assertStringContainsString('stroke-width: 2.1;', $chevron);

        // 17px regular label, the same figures as the teacher's
        $this->assertStringContainsString("font: 400 17px/1 'iSkool Back Label'", $this->block());
        $this->assertStringContainsString('letter-spacing: .1px;', $this->block());
        $this->assertStringContainsString('margin-left: -2px;', $this->rule('#headerBackLabel'));
        $this->assertStringContainsString('opacity: 0.55;', $this->rule('#headerBackBtn:active'));
        $this->assertStringContainsString('color: #f3f2ee !important;', $this->rule('.main-header.mobile-detail-mode #headerBackBtn'));
    }

    public function test_the_markup_draws_the_teachers_chevron_and_keeps_the_desktop_arrow(): void
    {
        $php = $this->source('learner_dashboard.php');
        $this->assertMatchesRegularExpression(
            '/<svg class="hb-chevron"[^>]*width="30" height="30" viewBox="0 0 24 24"[^>]*stroke-width="2\.1"[^>]*>\s*<polyline points="15 18 9 12 15 6"><\/polyline>/',
            $php
        );
        // desktop keeps the arrow, and only the arrow
        $this->assertStringContainsString('<svg class="hb-arrow"', $php);
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $this->assertStringContainsString("#headerBackBtn .hb-chevron { display: none; }", $css);
        $this->assertStringContainsString("#headerBackBtn .hb-arrow {\n        display: none;", $this->block());
        $this->assertStringContainsString('<span id="headerBackLabel"></span>', $php);
    }

    public function test_the_phone_rules_do_not_leak_onto_the_desktop_header(): void
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        $phone = strpos($css, 'Back button: the same one the teacher app shows');
        // nothing that sizes the button or its label comes before the phone block
        foreach (['min-height: 44px;', "font: 400 17px/1 'iSkool Back Label'", 'margin-left: -8px;', 'margin-left: -2px;', '--hb-label-max'] as $phoneOnly) {
            $first = strpos($css, $phoneOnly);
            $this->assertNotFalse($first, "$phoneOnly is missing");
            $this->assertGreaterThan($phone - 1, $first, "$phoneOnly must only be in the phone block");
        }
        // the desktop button keeps the 5px padding the markup used to carry inline
        $this->assertStringContainsString('#headerBackBtn { padding: 5px; }', $css);
        preg_match('/<button id="headerBackBtn"[^>]*>/', $this->source('learner_dashboard.php'), $tag);
        $this->assertStringNotContainsString('padding', $tag[0] ?? 'padding', 'the padding moved to the stylesheet');
    }

    public function test_the_title_stays_centred_and_the_header_keeps_its_height(): void
    {
        $block = $this->block();
        // the invisible copy of the label on the right is as wide as the button on the left, so the title is centred and
        // can never run under the button: 30 - 2 + 14 = 42, less the button's -8px margin, is the 20px + 14px of padding
        $spacer = $this->rule('.main-header.mobile-detail-mode #headerRight::before', true);
        $this->assertStringContainsString('content: attr(data-back-label);', $spacer);
        $this->assertStringContainsString('padding: 0 14px 0 20px;', $spacer);
        $this->assertStringContainsString('visibility: hidden;', $spacer);
        $this->assertStringContainsString('max-width: var(--hb-label-max);', $spacer);
        $this->assertStringContainsString('max-width: var(--hb-label-max);', $this->rule('#headerBackLabel'));
        $this->assertStringContainsString('max-width: calc(42px + var(--hb-label-max));', $this->rule('#headerBackBtn'));
        // the label never gets so wide that the two halves of the header no longer fit on a small phone
        $this->assertStringContainsString('--hb-label-max: min(140px, calc(50vw - 50px));', $block);

        // 44px button + 5px above and below = 54px, inside the header's 56px minimum, so the bar is no taller than before
        $this->assertStringContainsString('min-height: calc(56px + env(safe-area-inset-top, 0));', $block);
        $detail = $this->rule('.main-header.mobile-detail-mode');
        $this->assertStringContainsString('padding-top: calc(5px + env(safe-area-inset-top, 0));', $detail);
        $this->assertStringContainsString('padding-bottom: 5px;', $detail);
        $this->assertStringContainsString('align-items: center;', $detail);
    }

    public function test_a_title_with_no_room_left_is_left_out_and_that_rule_wins(): void
    {
        $block = $this->block();
        $this->assertStringContainsString("min-width: 0;\n        container-type: inline-size;", $block);
        $query = strpos($block, '@container (max-width: 71px) {');
        $this->assertNotFalse($query);
        $this->assertStringContainsString('display: none !important;', substr($block, $query, 200));
        // the title is `display: block !important` further up with the same weight, so the rule that hides it must be later
        $shown = strpos($block, "#headerTitle {\n        display: block !important;");
        $this->assertNotFalse($shown);
        $this->assertGreaterThan($shown, $query);
    }

    public function test_the_label_font_is_a_scoped_self_hosted_copy_and_the_pages_nunito_is_untouched(): void
    {
        $css = $this->source('assets/css/learner/learner_dashboard.css');
        // a family name of its own: a second @font-face called 'Nunito' would add a regular weight to every Nunito text
        $this->assertSame(1, preg_match_all('/@font-face\s*\{/', $css), 'one @font-face, for the back button label');
        $this->assertStringContainsString("font-family: 'iSkool Back Label';", $css);
        $this->assertStringContainsString("src: url('../../fonts/nunito-latin-400.woff2') format('woff2');", $css);
        $this->assertStringNotContainsString("@font-face {\n    font-family: 'Nunito'", $css);

        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('family=Nunito:wght@600&', $php, 'the page still loads only Nunito 600 from Google');
        $this->assertStringContainsString('<link rel="preload" href="assets/fonts/nunito-latin-400.woff2" as="font" type="font/woff2" crossorigin media="(max-width: 768px)">', $php);

        $this->assertFileExists(__DIR__ . '/../assets/fonts/nunito-latin-400.woff2');
        $this->assertSame('wOF2', substr($this->source('assets/fonts/nunito-latin-400.woff2'), 0, 4), 'the file is a woff2 font');
        $this->assertStringContainsString('SIL Open Font License', $this->source('assets/fonts/NUNITO-LICENSE-OFL.txt'));
    }

    public function test_light_mode_still_paints_its_own_colour_over_the_dark_one(): void
    {
        $light = $this->source('assets/css/learner/mobile_light.css');
        $this->assertStringContainsString('.main-header.mobile-detail-mode #headerBackBtn { color: #282924 !important; }', $light);
    }

    public function test_the_script_still_sets_the_label_and_its_mirror(): void
    {
        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('if (backLabelEl) backLabelEl.innerText = backLabel;', $php);
        $this->assertStringContainsString("rightSide.setAttribute('data-back-label', backLabel);", $php);
        $this->assertStringContainsString("rightSide.removeAttribute('data-back-label');", $php);
    }

    public function test_the_stylesheet_carries_a_new_version(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $this->assertStringContainsString('assets/css/learner/learner_dashboard.css?v=14.6', $this->source('learner_dashboard.php'));
    }
}
