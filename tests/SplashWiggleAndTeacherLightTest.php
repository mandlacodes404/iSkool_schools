<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for two things on the phone splash screens:
 *  - the "wiggle" wordmark at the bottom is 125px (it was 145px), the same on the login splash (index.php) and on the
 *    waiting screens that continue it (learner, teacher and parent dashboards), so it does not change size at the handoff;
 *  - the teacher waiting screen follows the teacher's phone light / dark choice like the learner's, and index.php reads
 *    the same saved choice for a signed-in teacher so the two pages are light together.
 * The pixels, colours and status bar were checked in a phone-sized browser with the real stylesheets and scripts.
 */
final class SplashWiggleAndTeacherLightTest extends TestCase
{
    private function source(string $path): string
    {
        $text = file_get_contents(__DIR__ . '/../' . $path);
        $this->assertNotFalse($text, $path);
        return $text;
    }

    /** The declarations of the rule for $id inside an `@media (max-width: 899px)` block of $css (blocks found by matching braces) */
    private function phoneRule(string $css, string $id): string
    {
        $css = preg_replace('#/\*.*?\*/#s', '', $css);
        $offset = 0;
        $seen = 0;
        while (($at = strpos($css, '@media (max-width: 899px) {', $offset)) !== false) {
            $seen++;
            $start = $at + strlen('@media (max-width: 899px) {');
            $depth = 1;
            for ($i = $start; $i < strlen($css) && $depth > 0; $i++) {
                $depth += $css[$i] === '{' ? 1 : ($css[$i] === '}' ? -1 : 0);
            }
            $body = substr($css, $start, $i - $start - 1);
            if (preg_match('/' . preg_quote($id, '/') . '\s*\{([^}]*)\}/', $body, $m)) {
                return $m[1];
            }
            $offset = $i;
        }
        $this->fail($id . ' has no rule in any of the ' . $seen . ' 899px blocks');
    }

    public function test_the_wiggle_wordmark_is_125px_on_the_login_splash_and_every_waiting_screen(): void
    {
        $rules = [
            'assets/css/index.css' => '#splash-brand-wordmark',
            'assets/css/learner/learner_dashboard.css' => '#dash-splash-brand-wordmark',
            'assets/css/teacher/teacher_dashboard.css' => '#dash-splash-brand-wordmark',
            'assets/css/parent/parent_splash.css' => '#pa-splash-brand-wordmark',
        ];
        foreach ($rules as $file => $id) {
            $rule = $this->phoneRule($this->source($file), $id);
            $this->assertMatchesRegularExpression('/height:\s*125px/', $rule, $file . ' phone wordmark height');
            $this->assertMatchesRegularExpression('/bottom:\s*-12px/', $rule, $file . ' phone wordmark position is unchanged');
        }

        // the base rule on the login splash agrees, so a reordered stylesheet cannot bring the old size back
        $this->assertMatchesRegularExpression('/#splash-brand-wordmark \{\s+position: absolute;\s+bottom: -12px;\s+height: 125px;/', $this->source('assets/css/index.css'));
        $this->assertStringNotContainsString('height: 145px', $this->source('assets/css/index.css'));
    }

    public function test_the_phone_splash_light_block_covers_the_teacher_waiting_screen(): void
    {
        $css = $this->source('assets/css/splash_light.css');
        $this->assertSame(1, preg_match('/@media \(max-width: 768px\) \{(.*)\z/s', $css, $m), 'the phone block is the last block');
        $phone = $m[1];

        $this->assertMatchesRegularExpression('/html\[data-teacher-mobile-theme="light"\] #dash-splash\s*\{\s*background: #faf9f5;/', $phone);
        $this->assertMatchesRegularExpression('/html\[data-teacher-mobile-theme="light"\] #dash-splash-wordmark\s*\{\s*color: #282924;/', $phone);
        // the learner's pair is still there and the same colours
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] #dash-splash', $phone);
        $this->assertStringNotContainsString('learner only', $css);
        $this->assertStringNotContainsString('teacher dashboard has no phone light mode', $css);
    }

    public function test_the_teacher_page_behind_the_splash_and_the_status_bar_follow_the_phone_theme(): void
    {
        $page = $this->source('teacher_dashboard.php');

        $this->assertMatchesRegularExpression('/@media \(max-width: 768px\) \{\s+html\[data-teacher-mobile-theme="light"\] body \{ background-color: #faf9f5 !important; \}/', $page);
        $this->assertStringContainsString("root.getAttribute('data-teacher-mobile-theme') === 'light' ? '#faf9f5' : '#20201f'", $page);

        // the phone theme script leaves the bar alone while the splash is up, then fixes it when the splash is gone
        $js = $this->source('assets/js/teacher/teacher_mobile_theme.js');
        $this->assertMatchesRegularExpression("/function bar\(\) \{[^}]*if \(root\.classList\.contains\('splash-handoff'\)\) return;/s", $js);
        $this->assertLessThan(strpos($page, "themeMeta.setAttribute('content', THEME_AFTER)"), strpos($page, "root.classList.remove('splash-handoff')"), 'the class is removed before the bar is handed back');
    }

    public function test_index_reads_a_signed_in_teachers_phone_theme_with_the_same_key_the_teacher_page_saves_it_under(): void
    {
        $index = $this->source('index.php');
        $teacher = $this->source('teacher_dashboard.php');

        $formula = "'iskoolTeacherMobileTheme:' . hash('sha256', (\$_SESSION['current_school_db'] ?? '') . '|' . ";
        $this->assertStringContainsString($formula . '$teacherEmail)', $teacher);
        $this->assertStringContainsString($formula . "\$_SESSION['email'])", $index, 'index.php builds the teacher key the same way');
        $this->assertStringContainsString("(\$_SESSION['role'] ?? '') === 'teacher'", $index);
        $this->assertStringContainsString("<?= json_encode(\$splashPhoneThemeKey) ?> || window.ISKOOL_LEARNER_MOBILE_THEME_KEY || 'iskoolLearnerMobileTheme'", $index, 'everyone else keeps the learner key');
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        $this->assertStringContainsString('assets/css/index.css?v=9.6', $this->source('index.php'));
        $this->assertStringContainsString('learner/learner_dashboard.css?v=14.7', $this->source('learner_dashboard.php'));
        $this->assertStringContainsString('teacher/teacher_dashboard.css?v=14.3', $this->source('teacher_dashboard.php'));
        $this->assertStringContainsString('teacher_mobile_theme.js?v=1.4', $this->source('teacher_dashboard.php'));
        $this->assertStringContainsString('parent/parent_splash.css?v=1.1', $this->source('parent_dashboard.php'));
        // splash_light.css is linked with its file time, so it never needs a manual bump
        $this->assertStringContainsString("filemtime(__DIR__ . '/assets/css/splash_light.css')", $this->source('teacher_dashboard.php'));
    }
}
