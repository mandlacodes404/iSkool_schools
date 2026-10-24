<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the phone light mode of the quiz pages: take_quiz.php (the quiz, its Submit / Exit / Time's Up cards and the
 * "Quiz Unavailable" / "Time's Up" pages) and submit_quiz.php (the result card).
 *
 * Both pages load a light stylesheet through includes/learner_theme_head.php. That stylesheet used to be desktop only
 * (@media (min-width: 769px), data-learner-theme). It now has a second, phone block (@media (max-width: 768px),
 * data-learner-mobile-theme) and the include sets that attribute and the browser bar colour. These checks read the
 * source files; the look itself was checked in a phone-sized browser.
 */
final class QuizPhoneLightModeTest extends TestCase
{
    private const PHONE_LIGHT = 'html[data-learner-mobile-theme="light"]';
    private const FILES = [
        'assets/css/learner/take_quiz_light.css',
        'assets/css/learner/submit_quiz_light.css',
    ];

    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** [the desktop @media block, the phone @media block]. The comments around them may mention both attributes. */
    private function blocks(string $css): array
    {
        $desktop = strpos($css, '@media (min-width: 769px) {');
        $phoneNote = strrpos($css, '/* ═══ Phones');
        $phone = strrpos($css, '@media (max-width: 768px) {');
        $this->assertNotFalse($desktop, 'the stylesheet has no desktop block');
        $this->assertNotFalse($phoneNote, 'the stylesheet has no phone note');
        $this->assertNotFalse($phone, 'the stylesheet has no phone block');
        $this->assertLessThan($phoneNote, $desktop, 'the desktop block comes first');
        return [substr($css, $desktop, $phoneNote - $desktop), substr($css, $phone)];
    }

    public function test_each_stylesheet_has_a_desktop_block_and_a_phone_block_that_follow_their_own_attribute(): void
    {
        foreach (self::FILES as $file) {
            [$desktop, $phone] = $this->blocks($this->source($file));

            $this->assertStringContainsString('@media (min-width: 769px) {', $desktop, $file);
            $this->assertStringNotContainsString('data-learner-mobile-theme', $desktop, $file . ': the desktop block must not follow the phone choice');

            $this->assertStringNotContainsString('data-learner-theme=', $phone, $file . ': the phone block must not follow the desktop choice');
            // The first word of every line that starts a rule (they all start with "html").
            preg_match_all('/^(html\S*)/m', $phone, $m);
            $this->assertGreaterThan(10, count($m[1]), $file . ': the phone block looks empty');
            $this->assertSame([self::PHONE_LIGHT], array_values(array_unique(array_map(fn ($w) => rtrim($w, ','), $m[1]))), $file . ': every rule in the phone block must start with the phone light attribute');
        }
    }

    public function test_quiz_phone_block_covers_the_quiz_its_cards_and_the_small_pages(): void
    {
        [, $phone] = $this->blocks($this->source('assets/css/learner/take_quiz_light.css'));
        foreach ([
            '.topbar', '.question-card', '.choice-item', '.open-answer-box', '.fitb-input', '#prevBtn',
            '#nextBtn', '.submit-btn', '.step-dot.done',
            '.modal-overlay', '.modal-box', '.modal-icon.warn svg', '.modal-icon.danger svg', '.modal-icon.success svg',
            '.modal-btn.primary', '.modal-btn.secondary', '.modal-btn.danger:hover', '.toast',
            '.state-card', '.state-card a', '.state-card .spinner',
        ] as $sel) {
            $this->assertStringContainsString(self::PHONE_LIGHT . ' ' . $sel, $phone, 'the quiz phone block misses ' . $sel);
        }
        // The page background of the phone dark look is hard-coded, so the light block has to set html and body itself.
        $this->assertStringContainsString(self::PHONE_LIGHT . ",\n" . self::PHONE_LIGHT . ' body { background: #faf9f5;', $phone);
        // The bottom Previous / Next bar reads --surface, which the palette block sets.
        $this->assertMatchesRegularExpression('/--surface:\s*#f4f3ee;/', $phone);
    }

    public function test_result_card_phone_block_covers_the_card_and_its_three_states(): void
    {
        [, $phone] = $this->blocks($this->source('assets/css/learner/submit_quiz_light.css'));
        foreach (['.card', '.card-bar.closed', '.circle-track', '.ring-track', '.state-icon.closed', '.state-icon.pending svg', '.state-icon.closed svg', '.back-btn'] as $sel) {
            $this->assertStringContainsString(self::PHONE_LIGHT . ' ' . $sel, $phone, 'the result phone block misses ' . $sel);
        }
        // The score colour is the darker twin submit_quiz.php prints, as on desktop.
        $this->assertStringContainsString('--score-color: var(--score-color-light, #187a72);', $phone);
        $this->assertStringContainsString('$scoreColorLight', $this->source('submit_quiz.php'));
    }

    public function test_the_dark_phone_look_that_the_light_block_overrides_is_still_there(): void
    {
        // If these change, the light overrides above may no longer be needed (or may no longer win).
        $quiz = $this->source('take_quiz.php');
        $this->assertStringContainsString('html, body { background: #20201f; }', $quiz);
        $this->assertStringContainsString('.modal-box { background: #20201f; }', $quiz);
        $this->assertStringContainsString('.topbar { padding: 0 14px; background: #20201f; }', $quiz);
        $this->assertStringContainsString('.question-card { padding: 20px 18px; background: #20201f; }', $quiz);
        $result = $this->source('submit_quiz.php');
        $this->assertStringContainsString("body { background: #20201f; }\n            .card { background: #20201f; }", $result);
    }

    public function test_the_include_sets_the_phone_attribute_and_the_browser_bar(): void
    {
        $inc = $this->source('includes/learner_theme_head.php');
        $this->assertStringContainsString("'iskoolLearnerMobileTheme'", $inc);              // the key mobile_theme.js writes
        $this->assertStringContainsString("setAttribute('data-learner-mobile-theme'", $inc);
        $this->assertStringContainsString("var PHONE = '(max-width: 768px)';", $inc);      // same breakpoint as the css
        $this->assertStringContainsString("var DARK_BAR = '#20201f';", $inc);              // what the pages' own meta says
        $this->assertStringContainsString("var LIGHT_BAR = '#faf9f5';", $inc);
        $this->assertStringContainsString("e.key === mobileKey()", $inc);                  // follows Settings while the page is open
        $this->assertSame(1, substr_count($this->source('assets/js/learner/mobile_theme.js'), "'iskoolLearnerMobileTheme'"));
        // The desktop choice is still read the same way.
        $this->assertStringContainsString("'iskoolLearnerDesktopTheme'", $inc);
        $this->assertStringContainsString('root.dataset.learnerTheme = theme', $inc);
    }

    public function test_the_bar_colours_are_the_colours_the_css_draws(): void
    {
        $inc = $this->source('includes/learner_theme_head.php');
        [, $quiz] = $this->blocks($this->source('assets/css/learner/take_quiz_light.css'));

        // light bar = the light top bar / page
        $this->assertStringContainsString(self::PHONE_LIGHT . ' .topbar { background: #faf9f5; }', $quiz);

        // dimmed bar under a card = LIGHT_BAR seen through the card backdrop
        $this->assertSame(1, preg_match('/\.modal-overlay \{ background: rgba\((\d+),(\d+),(\d+),\.(\d+)\); \}/', $quiz, $m));
        $this->assertSame('#' . $this->composite([250, 249, 245], [(int) $m[1], (int) $m[2], (int) $m[3]], (float) ('0.' . $m[4])), $this->constant($inc, 'MODAL_BAR'));

        // nearly black under the image lightbox (it is rgba(0,0,0,.92) in the page, and stays dark in light mode)
        $this->assertSame(1, preg_match('/\.lightbox \{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0?\.(\d+)\)/s', $this->source('take_quiz.php'), $l));
        $this->assertSame('#' . $this->composite([250, 249, 245], [0, 0, 0], (float) ('0.' . $l[1])), $this->constant($inc, 'LIGHTBOX_BAR'));
    }

    public function test_every_head_that_loads_the_include_has_its_theme_color_meta_before_it(): void
    {
        // The include's script looks the <meta name="theme-color"> up while the head is still being parsed.
        foreach (['take_quiz.php' => 3, 'submit_quiz.php' => 1] as $file => $heads) {
            $src = $this->source($file);
            $this->assertSame($heads, substr_count($src, 'learner_theme_head.php'), $file . ' loads the include in an unexpected number of places');
            $offset = 0;
            for ($i = 0; $i < $heads; $i++) {
                $inc = strpos($src, "require __DIR__ . '/includes/learner_theme_head.php'", $offset);
                $this->assertNotFalse($inc);
                $meta = strrpos(substr($src, 0, $inc), '<meta name="theme-color" content="#20201f">');
                $this->assertNotFalse($meta, $file . ': no theme-color meta before include #' . ($i + 1));
                $this->assertGreaterThan($offset, $meta, $file . ': the theme-color meta for head #' . ($i + 1) . ' must sit between the previous include and this one');
                $offset = $inc + 1;
            }
        }
    }

    private function constant(string $js, string $name): string
    {
        $this->assertSame(1, preg_match('/var ' . $name . " = '(#[0-9a-f]{6})';/", $js, $m), $name . ' is not defined in the include');
        return $m[1];
    }

    /** base seen through an overlay of the given colour and alpha, as a lowercase hex string without the # */
    private function composite(array $base, array $overlay, float $alpha): string
    {
        $out = '';
        foreach ([0, 1, 2] as $i) {
            $out .= sprintf('%02x', (int) round($base[$i] * (1 - $alpha) + $overlay[$i] * $alpha));
        }
        return $out;
    }
}
