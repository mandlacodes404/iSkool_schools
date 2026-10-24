<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "feels like an app" basics shared by the learner and the teacher dashboards:
 *   - the page height uses dvh (the height you can actually see) wherever it used vh,
 *   - the colour behind the page on phones,
 *   - the in-app "new version ready" banner that replaced window.confirm(), and the install card,
 *   - the manifest and the home-screen icon.
 *
 * These read the source files; how the banner and card look and behave was checked in a phone-sized browser.
 */
final class PwaBasicsTest extends TestCase
{
    /** Stylesheets whose page-height rules were moved from vh to dvh. */
    private const HEIGHT_FILES = [
        'assets/css/learner/learner_dashboard.css',
        'assets/css/learner/mobile_menu.css',
        'assets/css/learner/mobile_settings.css',
        'assets/css/teacher/teacher_dashboard.css',
        'assets/css/teacher/teacher_mobile_menu.css',
        'assets/css/teacher/teacher_mobile_settings.css',
    ];

    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** Every height / min-height declaration, in order: [property, value, start offset, end offset]. Comments are blanked out, not removed, so offsets stay put. */
    private function heightDeclarations(string $css): array
    {
        $css = preg_replace_callback('~/\*.*?\*/~s', fn ($m) => str_repeat(' ', strlen($m[0])), $css);
        preg_match_all('/(?<![\w-])((?:min-)?height)\s*:\s*([^;}]+)/', $css, $m, PREG_OFFSET_CAPTURE | PREG_SET_ORDER);
        $out = [];
        foreach ($m as $hit) {
            $out[] = [$hit[1][0], trim($hit[2][0]), $hit[0][1], $hit[0][1] + strlen($hit[0][0]), $css];
        }
        return $out;
    }

    public function test_every_page_height_in_the_dashboard_stylesheets_has_a_dvh_twin_right_after_it(): void
    {
        foreach (self::HEIGHT_FILES as $file) {
            $decls = $this->heightDeclarations($this->source($file));
            $vh = 0;
            $dvh = 0;
            foreach ($decls as $i => [$prop, $value, $start, $end, $css]) {
                if (strpos($value, '100dvh') !== false) {
                    $dvh++;
                    continue;
                }
                if (strpos($value, '100vh') === false) {
                    continue;
                }
                // The learner's desktop-only dim backdrop (min-width: 769px) keeps plain vh on purpose.
                if (strpos(substr($css, max(0, $start - 160), 160), '.desktop-backdrop') !== false) {
                    continue;
                }
                $vh++;
                // The twin is the next declaration of the SAME property in the same rule, with dvh in place of vh.
                // vh comes first: a browser that does not know dvh drops the second line and keeps this one.
                $twin = null;
                for ($j = $i + 1; $j < count($decls); $j++) {
                    $between = substr($css, $end, $decls[$j][2] - $end);
                    if (strpbrk($between, '{}') !== false) {
                        break;                      // left the rule
                    }
                    if ($decls[$j][0] === $prop) {
                        $twin = $decls[$j][1];
                        break;
                    }
                }
                $this->assertSame(str_replace('100vh', '100dvh', $value), $twin, $file . ': ' . $prop . ': ' . $value . ' has no dvh twin right after it');
            }
            $this->assertSame($vh, $dvh, $file . ': a dvh height without its vh fallback (or the other way round)');
            $this->assertGreaterThan(0, $vh, $file . ': no heights found, the check looks broken');
        }
    }

    public function test_the_phone_canvas_matches_the_body_it_sits_behind(): void
    {
        // Learner: dark phone mode only. In light mode each page decides its own colour (mobile_light.css), so <html> must stay unpainted.
        $learner = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('html:not([data-learner-mobile-theme="light"]) { background-color: #20201f; }', $learner);
        $this->assertStringContainsString("body {\n        overflow-x: hidden;\n        background-color: #20201f;", $this->source('assets/css/learner/learner_dashboard.css'));

        // Teacher: the phone view is dark only, and its body colour is --bg-color.
        $teacher = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('html { background-color: #0d1117; }', $teacher);
        $this->assertMatchesRegularExpression('/--bg-color:\s*#0d1117;/', $this->source('assets/css/teacher/teacher_dashboard.css'));
    }

    public function test_both_dashboards_use_the_in_app_banner_instead_of_the_browser_popup(): void
    {
        foreach (['learner_dashboard.php', 'teacher_dashboard.php'] as $file) {
            $src = $this->source($file);
            $this->assertStringNotContainsString('An iSkool update is available', $src, $file . ' still asks with window.confirm');
            $this->assertStringContainsString("event.data?.type !== 'iskool-update-available'", $src, $file);
            $this->assertStringContainsString('window.iskoolPwa.offerUpdate()', $src, $file);
            $this->assertStringContainsString('window.__iskoolUpdatePending = true', $src, $file);
            // The page still reloads when the new worker takes over.
            $this->assertStringContainsString("addEventListener('controllerchange'", $src, $file);
            $this->assertStringContainsString('assets/js/shared/pwa_prompts.js', $src, $file);
            $this->assertStringContainsString('assets/css/shared/pwa_prompts.css', $src, $file);
            $this->assertStringContainsString('rel="apple-touch-icon" href="/apple-touch-icon.png', $src, $file);
        }
        $this->assertFileExists(__DIR__ . '/../apple-touch-icon.png');
        // The contract with the service worker has not changed.
        $worker = $this->source('service-worker.js');
        $this->assertStringContainsString("'iskool-update-available'", $worker);
        $this->assertStringContainsString("'iskool-skip-waiting'", $worker);
        $this->assertStringContainsString("'iskool-skip-waiting'", $this->source('assets/js/shared/pwa_prompts.js'));
    }

    public function test_the_service_worker_precaches_the_manifest_version_the_pages_link(): void
    {
        $worker = $this->source('service-worker.js');

        // Bumping the worker's cache names makes installed apps drop their old caches and fetch everything again.
        foreach (['static', 'content', 'network'] as $kind) {
            $this->assertStringContainsString("'iskool-$kind-v6'", $worker);
            $this->assertStringNotContainsString("'iskool-$kind-v5'", $worker);
        }
        foreach (['index.php', 'learner_dashboard.php', 'teacher_dashboard.php'] as $file) {
            $this->assertStringContainsString('rel="manifest" href="/manifest.php?v=1.2"', $this->source($file), $file);
        }
        $this->assertStringContainsString("'/manifest.php?v=1.2'", $worker);
        $this->assertStringNotContainsString('manifest.php?v=1.1', $worker);
    }

    public function test_the_prompts_script_covers_update_and_install(): void
    {
        $js = $this->source('assets/js/shared/pwa_prompts.js');
        foreach (['beforeinstallprompt', 'appinstalled', '(display-mode: standalone)', 'navigator.standalone', 'userChoice',
                  'registerBusyCheck', 'offerUpdate', 'take_quiz\\.php', 'DISMISS_DAYS = 14', "'(max-width: 768px)'"] as $needle) {
            $this->assertStringContainsString($needle, $js, 'pwa_prompts.js is missing ' . $needle);
        }
        // Text is built with textContent / createElement, never innerHTML.
        $this->assertStringNotContainsString('innerHTML', $js);
        // localStorage can throw (private windows): every use is inside a try/catch.
        $uses = 0;
        foreach (explode("\n", $js) as $line) {
            if (strpos($line, 'window.localStorage') !== false) {
                $uses++;
                $this->assertStringContainsString('try {', $line);
                $this->assertStringContainsString('catch', $line);
            }
        }
        $this->assertSame(2, $uses);
        // Not part of Discussions, and does not reach into it.
        $this->assertStringNotContainsStringIgnoringCase('discussion', $js);
        $this->assertStringNotContainsStringIgnoringCase('discussion', $this->source('assets/css/shared/pwa_prompts.css'));
    }

    public function test_the_banner_sits_above_the_menu_and_the_install_card_below_it(): void
    {
        $css = $this->source('assets/css/shared/pwa_prompts.css');
        // The menu is z-index 5000, its backdrop 4999 (learner_dashboard.css, teacher_dashboard.css).
        $this->assertMatchesRegularExpression('/\.pwa-banner \{[^}]*z-index:\s*6000;/s', $css);
        $this->assertMatchesRegularExpression('/\.pwa-banner--bottom \{[^}]*z-index:\s*4500;/s', $css);
        foreach (['assets/css/learner/learner_dashboard.css', 'assets/css/teacher/teacher_dashboard.css'] as $file) {
            $this->assertMatchesRegularExpression('/z-index:\s*5000;/', $this->source($file), $file);
        }
        // Light looks follow the learner's own attributes, phones and desktop each in their own media block.
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .pwa-banner', $css);
        $this->assertStringContainsString('html[data-learner-theme="light"] .pwa-banner', $css);
        $this->assertStringContainsString('prefers-reduced-motion', $css);
    }

    public function test_the_manifest_has_its_basics_and_the_unused_leftover_is_gone(): void
    {
        $manifest = $this->source('manifest.php');
        foreach (['"lang"             => "en-ZA"', '"categories"       => ["education"]', '"display"          => "standalone"', '"start_url"        => "/"'] as $needle) {
            $this->assertStringContainsString($needle, $manifest);
        }
        // site.webmanifest was a never-linked default ("MyWebSite"); the pages all link manifest.php.
        $this->assertFileDoesNotExist(__DIR__ . '/../site.webmanifest');
        foreach (['learner_dashboard.php', 'teacher_dashboard.php'] as $file) {
            $this->assertStringContainsString('rel="manifest" href="/manifest.php', $this->source($file), $file);
            $this->assertStringNotContainsString('site.webmanifest', $this->source($file), $file);
        }
    }
}
