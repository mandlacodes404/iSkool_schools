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
