<?php
use PHPUnit\Framework\TestCase;

final class SentinelSecurityTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    public function test_edit_marks_scopes_quiz_to_authenticated_teacher_and_learner_to_quiz_class(): void
    {
        $source = $this->source('edit_marks.php');
        $this->assertStringContainsString('created_by = ?', $source);
        $this->assertStringContainsString('class_students', $source);
        $this->assertStringContainsString('student_email = ?', $source);
    }

    public function test_quiz_review_rejects_non_learners_before_result_fetch(): void
    {
        $source = $this->source('get_quiz_review.php');
        $this->assertStringContainsString('$userRole = $_SESSION[\'role\'] ?? \'\';', $source);
        $this->assertStringContainsString('$userRole !== \'learner\'', $source);
        $this->assertStringContainsString('http_response_code(403)', $source);
        $this->assertStringContainsString("quizInfo['user_email'] !== $loggedInEmail", $source);
        $this->assertStringContainsString('You can only view your own results.', $source);
    }

    public function test_old_link_parent_endpoint_is_gone(): void
    {
        // Replaced by invite links. The old endpoint let a learner pick any parent who had joined the class.
        $this->assertFileDoesNotExist(__DIR__ . '/../link_parent.php');
    }

    public function test_create_parent_invite_is_learner_only_csrf_protected_and_stores_only_a_hash(): void
    {
        $source = $this->source('api/learner/create_parent_invite.php');
        $this->assertStringContainsString("!== 'learner'", $source);
        $this->assertStringContainsString('verify_csrf_token()', $source);
        $this->assertStringContainsString('auth_rate_limit_is_blocked', $source);
        $this->assertStringContainsString('INSERT INTO parent_invites (learner_email, code_hash', $source);
        $this->assertStringContainsString('parent_invite_hash($code)', $source);
    }

    public function test_redeem_parent_invite_is_parent_only_rate_limited_and_claims_atomically(): void
    {
        $source = $this->source('api/parent/redeem_parent_invite.php');
        $this->assertStringContainsString("!== 'parent'", $source);
        $this->assertStringContainsString('verify_csrf_token()', $source);
        $this->assertStringContainsString('auth_rate_limit_is_blocked', $source);
        $this->assertStringContainsString('begin_transaction', $source);
        $this->assertStringContainsString('WHERE id = ? AND used_at IS NULL', $source);
        $this->assertStringContainsString('parent_invite_is_expired', $source);
    }

    public function test_remove_parent_link_only_deletes_the_learners_own_link(): void
    {
        $source = $this->source('api/learner/remove_parent_link.php');
        $this->assertStringContainsString("!== 'learner'", $source);
        $this->assertStringContainsString('verify_csrf_token()', $source);
        $this->assertStringContainsString('WHERE id = ? AND learner_email = ?', $source);
    }

    public function test_parent_link_page_bounces_cross_site_arrivals_before_starting_a_session(): void
    {
        $source = $this->source('parent_link.php');
        $bounce  = strpos($source, 'HTTP_SEC_FETCH_SITE');
        $session = strpos($source, "require_once __DIR__ . '/auth/session_guard.php'");
        $this->assertNotFalse($bounce);
        $this->assertNotFalse($session);
        $this->assertLessThan($session, $bounce);
    }

    public function test_parent_app_endpoints_are_parent_only_and_only_read_a_linked_child(): void
    {
        foreach (['get_home', 'get_report', 'get_syllabus'] as $name) {
            $source = $this->source("api/parent/{$name}.php");
            $this->assertStringContainsString("!== 'parent'", $source, $name);
            $this->assertStringContainsString('parent_find_child($conn, $parent_email, $child_id)', $source, $name);
            // The child check comes before any data is read
            $check = strpos($source, 'parent_find_child(');
            $read  = strpos($source, 'parent_fetch_');
            $this->assertNotFalse($check, $name);
            $this->assertNotFalse($read, $name);
            $this->assertLessThan($read, $check, $name);
            $this->assertStringContainsString('http_response_code(404)', $source, $name);
        }

        $children = $this->source('api/parent/get_children.php');
        $this->assertStringContainsString("!== 'parent'", $children);
        $this->assertStringNotContainsString("'email'    => \$row", $children);
    }

    public function test_parent_app_only_shows_published_marks_and_never_sends_learner_emails(): void
    {
        $functions = $this->source('auth/parent_app_functions.php');
        $this->assertStringContainsString('q.publish_marks = 1', $functions);
        $this->assertStringContainsString('open_ended_grades', $functions);

        // parent_find_child joins parent_links on the signed-in parent's email
        $this->assertMatchesRegularExpression('/function parent_find_child.*?pl\.parent_email = \?/s', $functions);

        // The children list that goes to the browser carries ids and names, not learner emails
        $this->assertDoesNotMatchRegularExpression('/function parent_list_children.*?\'email\'\s*=>/s', $functions);
    }

    public function test_parent_app_page_is_parent_only_and_does_not_put_data_into_html_unescaped(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString("!== 'parent'", $page);
        $this->assertStringNotContainsString('$_GET', $page);
        $this->assertStringNotContainsString('$_POST', $page);

        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringNotContainsString('innerHTML', $js);
        $this->assertStringNotContainsString('insertAdjacentHTML', $js);
        $this->assertStringNotContainsString('document.write', $js);
    }

    public function test_old_parent_pages_are_gone(): void
    {
        $this->assertFileDoesNotExist(__DIR__ . '/../parent_grades.php');
    }

    public function test_parent_app_says_so_when_the_school_has_no_current_year(): void
    {
        // Linked children are still listed, so the page does not claim a parent has none
        $children = $this->source('api/parent/get_children.php');
        $this->assertStringNotContainsString('$year_id > 0 ?', $children);
        $this->assertStringContainsString('parent_list_children($conn, $parent_email, $year_id)', $children);

        // Home, Report and Syllabus give a code the page recognises, instead of a message that looks like a network error,
        // and only after the child has been checked (so nobody can probe other children through it)
        foreach (['get_home', 'get_report', 'get_syllabus'] as $name) {
            $source = $this->source("api/parent/{$name}.php");
            $this->assertStringContainsString("'code' => 'no_year'", $source, $name);
            $check = strpos($source, 'parent_find_child(');
            $noYear = strpos($source, "'code' => 'no_year'");
            $this->assertNotFalse($check, $name);
            $this->assertLessThan($noYear, $check, $name);
        }

        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("r.json.code === 'no_year'", $js);
        // The page draws that message when a screen fails with it (the call, not just the function)
        $this->assertStringContainsString("err.code === 'noyear' ? renderNoYear()", $js);
    }

    public function test_parent_app_only_says_no_children_after_the_list_has_loaded(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("childrenStatus: 'loading'", $js);
        // A failed load shows the error card, and "Try again" loads the list again
        $this->assertStringContainsString("needsChildren && state.childrenStatus === 'failed'", $js);
        $this->assertStringContainsString("if (state.childrenStatus !== 'ready') start();", $js);
        // The status really moves: loading while the list is requested, ready once it arrived, failed when it did not.
        // Without these the page would sit on "Loading" for ever.
        $this->assertStringContainsString("state.childrenStatus = 'loading'", $js);
        $this->assertStringContainsString("state.childrenStatus = 'ready'", $js);
        $this->assertStringContainsString("state.childrenStatus = 'failed'", $js);
        // "No children linked yet" comes after the loading and failed cases
        $loading = strpos($js, "needsChildren && state.childrenStatus === 'loading'");
        $failed  = strpos($js, "needsChildren && state.childrenStatus === 'failed'");
        $none    = strpos($js, 'needsChildren && !state.children.length');
        $this->assertNotFalse($loading);
        $this->assertNotFalse($failed);
        $this->assertNotFalse($none);
        $this->assertLessThan($failed, $loading);
        $this->assertLessThan($none, $failed);
        // Every screen that shows a child's data waits for the list, including Syllabus
        $this->assertStringContainsString('var needsChildren = !!NEEDS_CHILD[route];', $js);
        $this->assertMatchesRegularExpression('/NEEDS_CHILD = \{[^}]*syllabus: true/', $js);
    }

    public function test_superadmin_has_csrf_rate_limit_and_session_regeneration(): void
    {
        $source = $this->source('superadmin/index.php');
        $this->assertStringContainsString('verify_sa_csrf_token()', $source);
        $this->assertStringContainsString('superadmin_login_allowed()', $source);
        $this->assertStringContainsString('session_regenerate_id(true)', $source);
        $this->assertStringContainsString('hash_equals((string)SA_PASSWORD', $source);
        $this->assertStringContainsString('sa_csrf_token', $source);
    }
}
