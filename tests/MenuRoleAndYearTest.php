<?php
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../auth/parent_app_functions.php';

/**
 * Guards for the menus of the three apps, which now follow one pattern:
 *   - under the school logo and name: the current academic year (as the learner menu always did);
 *   - under the person's name in the account row: their role ("Learner", "Teacher", "Parent").
 * Most checks read the source files. How the three menus look was checked in a phone-sized (390px) and a desktop
 * browser, in light and dark, and with no current year set (the year line is then left out).
 */
final class MenuRoleAndYearTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** A connection whose queries answer from the arrays given, so the real helper can run without a database. */
    private function connection(array $schoolRow, array $yearRow): mysqli
    {
        return new class($schoolRow, $yearRow) extends mysqli {
            private array $schoolRow;
            private array $yearRow;

            public function __construct(array $schoolRow, array $yearRow)
            {
                $this->schoolRow = $schoolRow;
                $this->yearRow = $yearRow;
            }

            #[\ReturnTypeWillChange]
            public function query(string $query, int $result_mode = MYSQLI_STORE_RESULT)
            {
                $rows = [];
                if (stripos($query, 'academic_years') !== false) {
                    $rows = $this->yearRow ? [$this->yearRow] : [];
                } elseif (stripos($query, 'school_name') !== false) {
                    $rows = [$this->schoolRow];
                }
                return new class($rows) {
                    private array $rows;
                    public function __construct(array $rows) { $this->rows = $rows; }
                    public function fetch_assoc() { return array_shift($this->rows); }
                };
            }
        };
    }

    // ── The year under the school name ───────────────────────────────────────────────────────────────────

    public function test_the_parent_school_info_carries_the_current_year(): void
    {
        $school = ['setting_value' => 'Landulwazi High School', 'school_logo' => ''];

        $info = parent_school_info($this->connection($school, ['name' => '2026']), __DIR__);
        $this->assertSame('2026', $info['year']);
        $this->assertSame('Landulwazi High School', $info['name']);

        $info = parent_school_info($this->connection($school, ['name' => '  2026/27 ']), __DIR__);
        $this->assertSame('2026/27', $info['year'], 'spaces around the name are dropped');

        $info = parent_school_info($this->connection($school, []), __DIR__);
        $this->assertSame('', $info['year'], 'no current year: an empty string, so the page leaves the line out');
    }

    public function test_the_parent_sidebar_and_phone_menu_both_show_the_year_under_the_school_name(): void
    {
        $page = $this->source('parent_dashboard.php');
        $line = '<?php if ($school[\'year\'] !== \'\'): ?><span class="pa-brand-sub"><?= pa_e($school[\'year\']) ?></span><?php endif; ?>';
        $this->assertSame(2, substr_count($page, $line), 'one in the sidebar, one in the phone menu');

        // under the name, inside the same text block
        foreach (['<div class="pa-brand">', '<div class="pa-drawer-head">'] as $from) {
            $start = strpos($page, $from);
            $this->assertNotFalse($start);
            $block = substr($page, $start, strpos($page, '<button type="button" class="pa-search"', $start) - $start);
            $this->assertLessThan(strpos($block, 'pa-brand-sub'), strpos($block, 'pa-brand-name'));
        }

        $css = $this->source('assets/css/parent/parent_menu.css');
        $this->assertMatchesRegularExpression('/\.pa-brand-sub \{[^}]*color: var\(--pa-muted\)/', $css);
        $this->assertStringContainsString('.pa-drawer .pa-brand-sub', $css);
    }

    public function test_the_teacher_menu_shows_the_current_year_under_the_school_name(): void
    {
        $page = $this->source('teacher_dashboard.php');
        // the same query as the learner dashboard
        $this->assertStringContainsString('SELECT name FROM academic_years WHERE is_current = 1 LIMIT 1', $page);
        $this->assertStringContainsString('<span class="dm-brand-sub"><?= htmlspecialchars($teacherYearName) ?></span>', $page);
        $this->assertStringContainsString("if (\$teacherYearName !== '')", $page, 'no current year: the line is left out');
        // "Teacher" used to sit here; it moved to the account row
        $this->assertStringNotContainsString('<span class="dm-brand-sub">Teacher</span>', $page);
    }

    public function test_the_learner_menu_keeps_the_year_under_the_school_name(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('<span class="dm-brand-sub"><?= htmlspecialchars($currentYearName) ?></span>', $page);
    }

    // ── The role under the person's name ─────────────────────────────────────────────────────────────────

    public function test_learner_and_teacher_account_rows_show_the_role_under_the_name(): void
    {
        $learner = $this->source('learner_dashboard.php');
        $this->assertMatchesRegularExpression('/<div class="learner-name">.*?<\/div>\s*<div class="learner-role">Learner<\/div>\s*<div class="learner-email">/s', $learner);

        $teacher = $this->source('teacher_dashboard.php');
        $this->assertMatchesRegularExpression('/<div class="teacher-name">.*?<\/div>\s*<div class="teacher-role">Teacher<\/div>\s*<div class="teacher-email">/s', $teacher);

        // the parent menu already did this
        $this->assertStringContainsString('<span class="pa-account-role">Parent</span>', $this->source('parent_dashboard.php'));
    }

    #[DataProvider('accountRowStylesheets')]
    public function test_the_account_row_has_a_second_line_for_the_role(string $path, string $who, string $collapsedRule): void
    {
        $css = $this->source($path);

        // the avatar and the chevron span both lines; without the second area the role would have no place in the grid
        $this->assertStringContainsString('grid-template-areas: "av name chev" "av role chev"; align-content: center;', $css);
        $this->assertMatchesRegularExpression('/\.' . $who . '-role \{\s*grid-area: role;[^}]*color: var\(--dm-muted\)[^}]*text-overflow: ellipsis/s', $css);
        // the email stays hidden, as before
        $this->assertStringContainsString('.' . $who . '-email { display: none; }', $css);
        if ($collapsedRule !== '') {
            $this->assertStringContainsString('html.dm-collapsed body .sidebar.dm-menu .' . $who . '-role', $css, 'the collapsed rail shows the avatar only');
        }
    }

    public static function accountRowStylesheets(): array
    {
        return [
            'learner desktop' => ['assets/css/learner/desktop_menu.css', 'learner', 'collapsed'],
            'learner phone'   => ['assets/css/learner/mobile_menu.css', 'learner', ''],
            'teacher desktop' => ['assets/css/teacher/teacher_desktop_menu.css', 'teacher', 'collapsed'],
            'teacher phone'   => ['assets/css/teacher/teacher_mobile_menu.css', 'teacher', ''],
        ];
    }

    public function test_the_phone_account_row_keeps_its_height_with_two_lines(): void
    {
        // the row is a fixed 56px; align-content: center keeps the two lines together in the middle of it
        foreach (['assets/css/learner/mobile_menu.css', 'assets/css/teacher/teacher_mobile_menu.css'] as $path) {
            $css = $this->source($path);
            $this->assertStringContainsString('height: 56px', $css);
            $this->assertStringContainsString('"av name chev" "av role chev"; align-content: center;', $css);
        }
    }

    // ── Cache versions ───────────────────────────────────────────────────────────────────────────────────

    public function test_the_changed_stylesheets_have_new_cache_versions(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the pages must move with the files
        $learner = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('learner/desktop_menu.css?v=3.2', $learner);
        $this->assertStringContainsString('learner/mobile_menu.css?v=2.1', $learner);

        $teacher = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('teacher_desktop_menu.css?v=2.6', $teacher);
        $this->assertStringContainsString('teacher_mobile_menu.css?v=1.8', $teacher);

        $this->assertStringContainsString('parent_menu.css?v=1.3', $this->source('parent_dashboard.php'));
    }
}
