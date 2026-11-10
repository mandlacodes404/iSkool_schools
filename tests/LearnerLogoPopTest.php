<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the school logo pop-up on the learner phone app: tapping the logo in the top bar lifts it out and grows it
 * into a frame above everything (the top bar included) with the school name under it; a tap, Escape or the phone's Back
 * button closes it and it shrinks back into the bar. Phones only.
 * How it moves and looks was checked by eye in a phone-sized browser with the real script and stylesheet (a picture
 * logo and the initials fallback, dark and light, 320 and 390px wide, a very long school name, landscape, frames part
 * way through opening and closing, a tap while it is still opening, Escape, the Back button through the real back-button
 * engine, a turn of the phone, reduced motion); these read the sources so what a later edit could quietly undo stays put.
 */
final class LearnerLogoPopTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    private function js(): string
    {
        return $this->source('assets/js/learner/logo_pop.js');
    }

    private function css(): string
    {
        return $this->source('assets/css/learner/logo_pop.css');
    }

    // ── what opens it ────────────────────────────────────────────────────────────────────────────

    public function test_a_tap_on_the_header_logo_opens_it_on_phones_only(): void
    {
        $js = $this->js();
        $this->assertStringContainsString("var PHONE = '(max-width: 768px)';", $js);
        $this->assertStringContainsString('if (pop || !isPhone()) return;', $js);
        $this->assertStringContainsString("e.target.closest('#headerLogo')", $js);
        // the logo is a real button for a keyboard or a screen reader
        $this->assertStringContainsString("el.setAttribute('role', 'button');", $js);
        $this->assertStringContainsString("el.setAttribute('tabindex', '0');", $js);
        $this->assertStringContainsString("(e.key === 'Enter' || e.key === ' ')", $js);
        // it works for both the picture and the initials the dashboard prints in the logo's place
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('<img id="headerLogo"', $page);
        $this->assertStringContainsString('<span id="headerLogo" class="school-logo-initials"', $page);
        $this->assertStringContainsString("if (logo.tagName === 'IMG') {", $js);
        $this->assertStringContainsString("frame.classList.add('slp-frame--initials');", $js);
    }

    public function test_the_school_name_comes_from_the_page_and_everything_is_put_in_as_text(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('<div class="logo-container" data-school-name="<?= htmlspecialchars($schoolName) ?>"', $page);
        $js = $this->js();
        $this->assertStringContainsString("holder.getAttribute('data-school-name')", $js);
        $this->assertStringContainsString('nameEl.textContent = name;', $js);
        $this->assertStringContainsString('frame.textContent = (logo.textContent', $js);
        foreach (['innerHTML', 'insertAdjacentHTML', 'document.write', 'eval('] as $unsafe) {
            $this->assertStringNotContainsString($unsafe, $js, $unsafe);
        }
    }

    // ── how it opens and closes ──────────────────────────────────────────────────────────────────

    public function test_the_logo_lifts_out_of_the_bar_and_shrinks_back_into_it(): void
    {
        $js = $this->js();
        // the bar's own logo is hidden while the copy is out, and is always given back
        $this->assertStringContainsString("logo.style.visibility = 'hidden';", $js);
        $this->assertStringContainsString("if (logo) logo.style.visibility = '';", $js);
        // it grows from where the bar's logo is (and shrinks back to where it is now), corners included
        $this->assertStringContainsString('var barRect = logo.getBoundingClientRect();', $js);
        $this->assertStringContainsString('function fromBar(frameRect, barRect)', $js);
        $this->assertStringContainsString("{ transform: 'none', borderRadius: FRAME_RADIUS + 'px' }", $js);
        $this->assertStringContainsString('shrink.onfinish = finish;', $js);
        $this->assertStringContainsString('shrink.oncancel = finish;', $js);
        // a tap while it is still growing starts the shrink from where it is
        $this->assertStringContainsString('running[i].cancel();', $js);
        // reduced motion and old browsers: open and close at once, nothing waits for an animation
        $this->assertStringContainsString("(prefers-reduced-motion: reduce)", $js);
        $this->assertStringContainsString("if (immediate || !canAnimate(frame) || !logo) { finish(); return; }", $js);
        // the same corner radius as the stylesheet
        $this->assertStringContainsString('var FRAME_RADIUS = 28;', $js);
        $this->assertMatchesRegularExpression('/\.slp-frame \{[^}]*border-radius: 28px;/', $this->css());
    }

    public function test_a_tap_escape_the_back_button_and_a_turn_of_the_phone_close_it(): void
    {
        $js = $this->js();
        $this->assertStringContainsString("pop.addEventListener('click', function () { close(false); });", $js);
        $this->assertStringContainsString("if (e.key === 'Escape' && pop) { close(false); return; }", $js);
        $this->assertStringContainsString("window.addEventListener('resize', function () { if (pop) close(true); });", $js);
        $this->assertStringContainsString("window.addEventListener('orientationchange', function () { if (pop) close(true); });", $js);
        // `.on` marks it open and goes as soon as it starts to close, so Back never finds it twice
        $this->assertStringContainsString("pop.classList.add('on');", $js);
        $this->assertStringContainsString("pop.classList.remove('on');", $js);
        // the phone's Back button presses it, the first thing in the pop-up step, so it closes the way a tap closes it
        $glue = $this->source('assets/js/learner/learner_back_button.js');
        $this->assertStringContainsString("var logoPop = document.querySelector('#schoolLogoPop.on');", $glue);
        $this->assertStringContainsString('if (logoPop) { logoPop.click(); return true; }', $glue);
        $this->assertLessThan(strpos($glue, "'#dmmSearch.on .dmm-s-cancel'"), strpos($glue, "'#schoolLogoPop.on'"));
        $this->assertStringContainsString('layers: [closeDropdown, closeViewer, closePopup, closeAssignmentForm, closeMenu, backFromDetail],', $glue);
    }

    public function test_the_status_bar_is_dimmed_with_the_backdrop_and_given_back(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('var SCRIM = 0.55;', $js);
        $this->assertStringContainsString("meta.setAttribute('content', '#' + dimmed);", $js);
        $this->assertStringContainsString("meta.setAttribute('content', savedBar);", $js);
        $this->assertMatchesRegularExpression('/--slp-scrim: rgba\(0, 0, 0, \.55\);/', $this->css());
        // dimmed on open, given back as it starts to close
        $this->assertGreaterThan(strpos($js, 'function open()'), strpos($js, "dimBar();\n        logo.style.visibility"));
        $this->assertStringContainsString("undimBar();\n\n        if (immediate", $js);
    }

    // ── the look ─────────────────────────────────────────────────────────────────────────────────

    public function test_it_sits_above_the_top_bar_the_bottom_nav_and_the_sheets(): void
    {
        $css = $this->css();
        preg_match('/\.slp \{[^}]*z-index: (\d+);/', $css, $m);
        $this->assertNotEmpty($m);
        // top bar 1000, bottom nav 4000, sheets 7000, the page loader 8000 (which only shows while a page loads)
        $this->assertGreaterThan(7000, (int) $m[1]);
        $this->assertLessThan(8000, (int) $m[1]);
        $this->assertMatchesRegularExpression('/\.slp \{[^}]*position: fixed;[^}]*inset: 0;/', $css);
        $dashboard = $this->source('assets/css/learner/learner_dashboard.css');
        $this->assertStringContainsString('z-index: 4000;', $dashboard);
        $this->assertStringContainsString('z-index: 7000;', $dashboard);
        // the page behind cannot be scrolled while it is open
        $this->assertStringContainsString('touch-action: none;', $css);
        $this->assertStringContainsString('overscroll-behavior: contain;', $css);
    }

    public function test_the_frame_follows_the_top_bar_light_or_dark_and_the_backdrop_stays_dark(): void
    {
        $css = $this->css();
        // dark by default; light when the bar on screen is light (a page without its light design keeps a dark bar)
        $this->assertStringContainsString('--slp-frame-bg: #20201f;', $css);
        $this->assertStringContainsString('.slp[data-tone="light"] {', $css);
        $this->assertStringContainsString('--slp-frame-bg: #faf9f5;', $css);
        $this->assertStringContainsString("pop.setAttribute('data-tone', barIsLight() ? 'light' : 'dark');", $this->js());
        $this->assertStringContainsString("window.getComputedStyle(header).backgroundColor", $this->js());
        // the name is light because the backdrop is dark in both
        $this->assertStringContainsString('--slp-name: #f3f2ee;', $css);
        $this->assertStringNotContainsString('data-learner-mobile-theme', $css);
    }

    public function test_the_size_weights_and_colours_follow_the_phone_pages(): void
    {
        $css = $this->css();
        preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
        foreach (['#4fd1c5', '#187a72', '#68d391', '#a78bfa'] as $accent) {
            $this->assertStringNotContainsString($accent, $css);
        }
        // a square frame that always fits: 240px at most, two thirds of the width, under half the height
        $this->assertStringContainsString('--slp-size: min(240px, 66vw, 44vh);', $css);
        $this->assertStringContainsString('object-fit: contain;', $css);
    }

    // ── loading ──────────────────────────────────────────────────────────────────────────────────

    public function test_the_page_loads_the_new_files_and_the_changed_back_button_script_has_a_new_version(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertSame(1, substr_count($page, 'assets/css/learner/logo_pop.css?v=1.0'));
        $this->assertSame(1, substr_count($page, 'assets/js/learner/logo_pop.js?v=1.0'));
        $this->assertStringContainsString('assets/js/learner/learner_back_button.js?v=1.1', $page);
        $this->assertStringNotContainsString('learner_back_button.js?v=1.0', $page);
        // the script finds #headerLogo when it runs, so it comes after the header, with the other end-of-page scripts
        $this->assertGreaterThan(strpos($page, 'id="headerLogo"'), strpos($page, 'assets/js/learner/logo_pop.js'));
        $this->assertGreaterThan(strpos($page, 'assets/js/learner/learner_back_button.js'), strpos($page, 'assets/js/learner/logo_pop.js'));
    }
}
