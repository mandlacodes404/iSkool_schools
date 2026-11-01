<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the teacher's phone detail pages: an open quiz and its integrity report, a graded assessment, a syllabus
 * brief, an evaluation and an assignment (assets/css/teacher/teacher_detail.css, assets/js/teacher/teacher_detail.js and the four
 * page scripts). They share one look (.td-detail) and sit at the same side padding as the lists, so these checks read
 * the sources for the things a later edit could quietly undo: the padding, the light-mode marker classes, the handler
 * ids the page scripts look for, and the colour and weight rules. How the pages look and behave was checked in a
 * phone-sized browser with the real stylesheets and scripts, not here.
 */
final class TeacherDetailPagesTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** Page script => the class that stays on its detail root (the light-mode gate and the page's own CSS key off it) */
    private const PAGES = [
        'assets/js/teacher/quizzes.js'     => 'qz-mobile-detail td-detail td-detail--quiz',
        'assets/js/teacher/sbo.js'         => 'sbo-mobile-detail td-detail td-detail--syl',
        'assets/js/teacher/evaluations.js' => 'ev-mobile-detail td-detail td-detail--eval',
        'assets/js/teacher/grades.js'      => 'gr-mobile-detail td-detail td-detail--grade',
        'assets/js/teacher/assignments.js' => 'as-mobile-detail td-detail td-detail--assign',
    ];

    public function test_the_page_loads_the_shared_detail_files_before_the_scripts_and_light_mode_that_use_them(): void
    {
        $php = $this->source('teacher_dashboard.php');

        $css = strpos($php, 'assets/css/teacher/teacher_detail.css?v=');
        $light = strpos($php, 'assets/css/teacher/teacher_mobile_light.css?v=');
        $this->assertNotFalse($css, 'teacher_detail.css is not linked');
        $this->assertLessThan($light, $css, 'teacher_detail.css must come before teacher_mobile_light.css so light mode can swap its variables');

        $js = strpos($php, 'assets/js/teacher/teacher_detail.js?v=');
        $this->assertNotFalse($js, 'teacher_detail.js is not loaded');
        foreach (['quizzes', 'grades', 'sbo', 'evaluations', 'assignments'] as $page) {
            $this->assertLessThan(strpos($php, 'assets/js/teacher/' . $page . '.js?v='), $js, 'teacher_detail.js must load before ' . $page . '.js (they call window.tdUi)');
        }
    }

    public function test_changed_assets_carry_new_versions_so_the_service_worker_does_not_serve_the_old_ones(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('teacher_dashboard.php');
        foreach ([
            'announcements.css?v=7.4', 'sbo.css?v=2.4', 'evaluations.css?v=3.2', 'assignments.css?v=3.5', 'teacher_detail.css?v=1.1', 'teacher_mobile_light.css?v=1.7',
            'quizzes.js?v=8.7', 'evaluations.js?v=5.4', 'grades.js?v=5.5', 'sbo.js?v=5.2', 'assignments.js?v=5.6', 'teacher_detail.js?v=1.1',
        ] as $versioned) {
            $this->assertStringContainsString($versioned, $php);
        }
    }

    public function test_the_detail_pages_sit_at_the_same_side_padding_as_the_lists(): void
    {
        $css = $this->source('assets/css/teacher/teacher_detail.css');

        // #api-content-area carries 20px of padding on a phone. The lists cancel it with -20px margins and inset their
        // rows by 16px; the detail root must do the same instead of adding a padded container of its own.
        $this->assertSame(1, preg_match('/\.td-detail \{[^}]*padding:\s*14px 16px calc\(28px \+ env\(safe-area-inset-bottom, 0px\)\)/s', $css), 'the root pads 16px at the sides');
        $this->assertSame(1, preg_match('/@media \(max-width: 899px\) \{\s*\.td-detail \{\s*margin-left: -20px;\s*margin-right: -20px;/s', $css), 'the root cancels the 20px of #api-content-area, like .gr-mobile-list');

        // the old padded containers are gone
        foreach (['assets/css/teacher/evaluations.css' => '.ev-mobile-detail', 'assets/css/teacher/sbo.css' => '.sbo-mobile-detail', 'assets/css/teacher/announcements.css' => '.qz-mobile-detail', 'assets/css/teacher/assignments.css' => '.as-mobile-detail'] as $file => $selector) {
            $this->assertSame(0, preg_match('/^' . preg_quote($selector, '/') . '[^{]*\{[^}]*padding/m', $this->source($file)), $file . ' still pads ' . $selector);
        }
    }

    public function test_every_detail_root_keeps_its_light_mode_marker_and_the_shared_class(): void
    {
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        foreach (self::PAGES as $file => $classes) {
            $js = $this->source($file);
            $this->assertStringContainsString('class="' . $classes . '"', $js, $file . ' lost its detail root');
            // the marker is in the light gate, so the page turns light
            $marker = '.' . explode(' ', $classes)[0];
            $this->assertStringContainsString($marker, $light, $marker . ' is not in the light-mode gate');
        }
    }

    public function test_light_mode_swaps_the_detail_variables_instead_of_restyling_each_element(): void
    {
        $light = $this->source('assets/css/teacher/teacher_mobile_light.css');
        $dark = $this->source('assets/css/teacher/teacher_detail.css');
        $light_rules = preg_replace('~/\*.*?\*/~s', '', $light);

        // every variable the dark stylesheet defines on .td-detail is given a light value
        $this->assertSame(1, preg_match('/\.td-detail \{([^}]*)\}/', $dark, $d));
        preg_match_all('/(--td-[a-z-]+):/', $d[1], $vars);
        $this->assertGreaterThan(20, count($vars[1]));
        $this->assertSame(1, preg_match('/\) \.td-detail \{([^}]*)\}/', $light, $l), 'light mode sets the detail variables');
        foreach (array_unique($vars[1]) as $var) {
            if (in_array($var, ['--td-acc', '--td-pill-bg', '--td-pill-line'], true)) {
                continue; // set per page / per pill
            }
            $this->assertStringContainsString($var . ':', $l[1], 'light mode does not set ' . $var);
        }

        // the old per-element rules for these pages are gone from the light stylesheet
        foreach (['.qz-mobile-detail-', '.ev-mobile-detail-', '.sbo-mobile-detail ', '.as-mobile-detail-', '.as-mobile-detail .teacher-grades-table', '.gr-mobile-detail .gr-panel-header', '.gr-mobile-detail .gr-panel-title', '.gr-mobile-detail .gr-panel-meta', '.gr-mobile-detail .teacher-grades-table'] as $old) {
            $this->assertStringNotContainsString($old, $light_rules, $old . ' rules should have been replaced by the variables');
        }
    }

    public function test_the_detail_stylesheet_has_no_teal_and_only_the_two_light_weights(): void
    {
        foreach (['assets/css/teacher/teacher_detail.css', 'assets/js/teacher/teacher_detail.js'] as $file) {
            $src = $this->source($file);
            foreach (['#4fd1c5', '#14b8a6', '#2dd4bf', '#0d9488', '#20b2aa', 'teal'] as $teal) {
                $this->assertStringNotContainsStringIgnoringCase($teal, preg_replace('~/\*.*?\*/~s', '', $src), $file . ' uses ' . $teal);
            }
        }
        $css = preg_replace('~/\*.*?\*/~s', '', $this->source('assets/css/teacher/teacher_detail.css'));
        preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
        $this->assertNotEmpty($m[1]);
        $this->assertSame([], array_values(array_diff(array_unique($m[1]), ['400', '600'])), 'only weights 400 and 600');

        // the evaluation bars take their colours from the page's own variables, not the API's (which has teal on "Agree")
        $ev = $this->source('assets/js/teacher/evaluations.js');
        $this->assertStringContainsString('--td-fill:var(--td-b-${key})', $ev);
        // and the phone grades screens (the loading spinner, the marks lists) no longer paint teal
        $gr = $this->source('assets/js/teacher/grades.js');
        $phone = substr($gr, strpos($gr, 'window.openMobileTeacherGradeQuiz'), strpos($gr, 'function renderQuizGrades') - strpos($gr, 'window.openMobileTeacherGradeQuiz'));
        $this->assertStringNotContainsString('#4fd1c5', $phone);
    }

    public function test_buttons_cannot_lose_their_colour_to_the_page_wide_button_reset(): void
    {
        $css = $this->source('assets/css/teacher/teacher_detail.css');
        // ".td-detail button { color: inherit }" is one element deeper than a bare class, so the button classes are
        // written as ".td-detail .td-btn" (a bare ".td-btn" would lose and the label would turn the page's text colour)
        $this->assertSame(1, preg_match('/^\.td-detail button \{/m', $css));
        foreach (['.td-btn', '.td-btn--soft', '.td-btn--danger', '.td-x'] as $selector) {
            $this->assertSame(0, preg_match('/^' . preg_quote($selector, '/') . ' ?\{/m', $css), $selector . ' must be written as .td-detail ' . $selector);
            $this->assertSame(1, preg_match('/^\.td-detail ' . preg_quote($selector, '/') . ' ?\{/m', $css), '.td-detail ' . $selector . ' is missing');
        }
    }

    public function test_the_quiz_page_keeps_every_id_its_handlers_look_for(): void
    {
        $js = $this->source('assets/js/teacher/quizzes.js');
        foreach (['qz-badge-', 'publish-label-', 'publish-copy-', 'publish-btn-', 'status-title-', 'status-copy-', 'status-btn-'] as $id) {
            $this->assertStringContainsString('id="' . $id . '${id}"', $js, $id . ' is missing from the phone quiz page');
            $this->assertStringContainsString('`' . $id . '${quizId}`', $js, 'qzMobileSync no longer patches ' . $id);
        }
        foreach (['togglePublishMarks(${id})', 'toggleQuizStatusFromElement(this)', 'openIntegrityModalFromElement(this)', 'data-action="delete-quiz"',
                  'id="integrityModal"', 'id="integrityModalTitle"', 'id="integrityWarning"', 'id="decodeBtn"', 'id="integrityResults"', 'id="integrityFooter"',
                  "id: 'deleteQuizModal'", 'id="deleteQuizTitle"', "errorId: 'deleteQuizError'", 'data-action="close-delete-quiz"', 'data-action="confirm-delete-quiz"'] as $needle) {
            $this->assertStringContainsString($needle, $js, $needle . ' is missing from the phone quiz page');
        }
        // both toggles update the page in place instead of redrawing it
        $this->assertSame(2, substr_count($js, 'window.qzMobileSync(quizId'));
        // the phone sheet draws its own results; the desktop modal's markup is the other branch
        $this->assertStringContainsString("classList.contains('td-overlay')", $js);
        $this->assertStringContainsString('tdIntegrityList(data)', $js);
    }

    public function test_the_syllabus_and_evaluation_pages_carry_the_delete_sheet_their_handlers_open(): void
    {
        // the list that used to carry these modals is not on the page while a detail is open
        $sbo = $this->source('assets/js/teacher/sbo.js');
        foreach (["id: 'deleteSBOModal'", "confirmClass: 'sbo-delete-confirm-btn'", 'onclick="executeDeleteSBO()"', 'confirmDeleteSBO(${Number(brief.id)})'] as $needle) {
            $this->assertStringContainsString($needle, $sbo);
        }
        $ev = $this->source('assets/js/teacher/evaluations.js');
        foreach (["id: 'deleteEvaluationModal'", "confirmClass: 'ev-delete-confirm-btn'", 'onclick="executeDeleteEvaluation()"', 'confirmDeleteEvaluation(${Number(ev.id)})'] as $needle) {
            $this->assertStringContainsString($needle, $ev);
        }
    }

    public function test_the_assignment_page_carries_the_delete_sheet_and_keeps_its_handlers(): void
    {
        $js = $this->source('assets/js/teacher/assignments.js');
        $start = strpos($js, 'window.openMobileTeacherAssignment = function');
        $page = substr($js, $start, strpos($js, 'window.openMobileTeacherAssignmentById') - $start);

        // the list draws #deleteAssignmentModal, and the list is not on the page while a detail is open
        foreach (["id: 'deleteAssignmentModal'", "confirmClass: 'as-delete-confirm-btn'", 'onclick="executeDeleteAssignment()"', 'confirmDeleteAssignment(${Number(assignment.id)})', 'downloadSubmissions(${Number(assignment.id)})', "closeCall: 'closeDeleteAssignmentModal()'"] as $needle) {
            $this->assertStringContainsString($needle, $page, $needle . ' is missing from the phone assignment page');
        }
        // what learners type (names, text answers) and what the teacher typed (title, instructions) is escaped
        foreach (['T.esc(assignment.title)', 'T.multiline(assignment.description)', 'T.multiline(sub.text_answer)', 'T.esc(sub.name)', 'T.esc(sub.file_url)', 'T.esc(assignment.file_url)'] as $needle) {
            $this->assertStringContainsString($needle, $page, $needle);
        }
        $this->assertStringNotContainsString('.replace(/\n/g', $page, 'line breaks go through T.multiline, which escapes first');
        // the page's colours are the page's own: the helper's low-progress colour is teal and is not used here
        $this->assertStringNotContainsString('progressColor', $page);
        $this->assertStringNotContainsString('#4fd1c5', $page);
        // the old table builder is gone with its only caller
        $this->assertStringNotContainsString('buildTeacherSubmissionsTableRows', $js);
    }

    public function test_the_shared_helpers_escape_what_teachers_and_learners_type(): void
    {
        $js = $this->source('assets/js/teacher/teacher_detail.js');
        foreach (["replace(/&/g, '&amp;')", "replace(/</g, '&lt;')", "replace(/\"/g, '&quot;')"] as $needle) {
            $this->assertStringContainsString($needle, $js);
        }
        $this->assertStringContainsString('window.tdUi = {', $js);
        // the confirm sheet escapes its title and button label; the body is the caller's HTML and the pages escape inside it
        $this->assertStringContainsString("esc(o.title)", $js);
        foreach (['assets/js/teacher/sbo.js', 'assets/js/teacher/evaluations.js'] as $file) {
            $this->assertMatchesRegularExpression('/body: `[^`]*\$\{T\.esc\(/', $this->source($file), $file . ' must escape the name in the delete sheet');
        }
    }
}
