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
    }

    public function test_link_parent_requires_learner_class_membership(): void
    {
        $source = $this->source('link_parent.php');
        $this->assertStringContainsString('class_students', $source);
        $this->assertStringContainsString('student_email = ?', $source);
        $this->assertStringContainsString('Learner not in class', $source);
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
