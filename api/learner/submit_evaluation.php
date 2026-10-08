<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_SESSION['email']) || ($_SESSION['role'] ?? '') !== 'learner') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}
verify_csrf_token();

$learner_email = $_SESSION['email'];
$eval_id = (int)($_POST['eval_id'] ?? 0);
$comments = trim((string)($_POST['comments'] ?? ''));
$answers = $_POST['answer'] ?? [];
if ($eval_id <= 0 || !is_array($answers)) {
    echo json_encode(['success' => false, 'message' => 'Invalid evaluation response.']);
    exit;
}

try {
    $conn->begin_transaction();
    $yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1 FOR UPDATE");
    $academic_id = (int)(($yearRes ? $yearRes->fetch_assoc() : null)['id'] ?? 0);
    if ($academic_id <= 0) throw new RuntimeException('No active academic year.');

    $evalStmt = $conn->prepare("SELECT class_id FROM teacher_evaluations WHERE id = ? AND academic_year_id = ? AND is_active = 1 LIMIT 1 FOR UPDATE");
    $evalStmt->bind_param("ii", $eval_id, $academic_id);
    $evalStmt->execute();
    $evaluation = $evalStmt->get_result()->fetch_assoc();
    $evalStmt->close();
    if (!$evaluation) throw new RuntimeException('Evaluation is not available.');
    $class_id = (int)$evaluation['class_id'];

    $memberStmt = $conn->prepare("SELECT 1 FROM class_students WHERE student_email = ? AND class_id = ? AND academic_year_id = ? LIMIT 1 FOR UPDATE");
    $memberStmt->bind_param("sii", $learner_email, $class_id, $academic_id);
    $memberStmt->execute();
    $isMember = $memberStmt->get_result()->num_rows === 1;
    $memberStmt->close();
    if (!$isMember) throw new RuntimeException('Evaluation is not available for your class.');

    $statementStmt = $conn->prepare("SELECT id FROM evaluation_statements WHERE evaluation_id = ? ORDER BY id");
    $statementStmt->bind_param("i", $eval_id);
    $statementStmt->execute();
    $statementRows = $statementStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $statementStmt->close();
    $statementIds = array_map(static fn(array $row): int => (int)$row['id'], $statementRows);
    $submittedIds = array_map('intval', array_keys($answers));
    sort($statementIds); sort($submittedIds);
    $allowed = ['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'];
    if (empty($statementIds) || $statementIds !== $submittedIds || array_diff($answers, $allowed)) {
        throw new RuntimeException('Please provide one valid answer for every statement.');
    }

    $hash = hash('sha256', $learner_email . $eval_id . 'salt123');
    $duplicateStmt = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ? LIMIT 1 FOR UPDATE");
    $duplicateStmt->bind_param("is", $eval_id, $hash);
    $duplicateStmt->execute();
    $isDuplicate = $duplicateStmt->get_result()->num_rows > 0;
    $duplicateStmt->close();
    if ($isDuplicate) throw new RuntimeException('Already submitted.');

    $responseStmt = $conn->prepare("INSERT INTO evaluation_responses (evaluation_id, class_id, comments, unique_hash) VALUES (?, ?, ?, ?)");
    $responseStmt->bind_param("iiss", $eval_id, $class_id, $comments, $hash);
    $responseStmt->execute();
    $responseId = $responseStmt->insert_id;
    $responseStmt->close();
    $answerStmt = $conn->prepare("INSERT INTO evaluation_answers (response_id, statement_id, answer) VALUES (?, ?, ?)");
    foreach ($answers as $statementId => $answer) {
        $statementId = (int)$statementId;
        $answerStmt->bind_param("iis", $responseId, $statementId, $answer);
        $answerStmt->execute();
    }
    $answerStmt->close();
    $conn->commit();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    $conn->rollback();
    error_log('Evaluation submission failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
