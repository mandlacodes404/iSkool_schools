<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit;
}

function getInitials(string $text): string {
    $text = trim($text);
    if ($text === '') return '?';
    $words = preg_split('/\s+/', $text);
    if (count($words) === 1) {
        return mb_strtoupper(mb_substr($words[0], 0, 1));
    }
    return mb_strtoupper(mb_substr($words[0], 0, 1) . mb_substr(end($words), 0, 1));
}

$learner_email = $_SESSION['email'];

// 1. Get Current Academic Year
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearRow = $yearRes ? $yearRes->fetch_assoc() : null;
$current_academic_year_id = (int)($yearRow['id'] ?? 0);

if (!$current_academic_year_id) {
    echo json_encode(['status' => 'no_class']); exit;
}

// 2. Get active current-year evaluations for every class the learner attends.
$stmt = $conn->prepare("
    SELECT DISTINCT te.*, u.name AS teacher_name, CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher_full
    FROM teacher_evaluations te
    JOIN users u ON te.created_by = u.email
    JOIN class_students cs ON cs.class_id = te.class_id
    WHERE cs.student_email = ?
      AND cs.academic_year_id = ?
      AND te.academic_year_id = ?
      AND te.is_active = 1
    ORDER BY te.created_at DESC
");
$stmt->bind_param("sii", $learner_email, $current_academic_year_id, $current_academic_year_id);
$stmt->execute();
$evals = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$response = [];
foreach ($evals as $eval) {
    $eval_id = $eval['id'];
    $hash = hash('sha256', $learner_email . $eval_id . 'salt123');
    $check = $conn->prepare("SELECT 1 FROM evaluation_responses WHERE evaluation_id = ? AND unique_hash = ?");
    $check->bind_param("is", $eval_id, $hash);
    $check->execute();
    $submitted = $check->get_result()->num_rows > 0;
    $check->close();

    $statements = [];
    if (!$submitted) {
        $stStmt = $conn->prepare("SELECT id, statement FROM evaluation_statements WHERE evaluation_id = ? ORDER BY order_num");
        $stStmt->bind_param("i", $eval_id);
        $stStmt->execute();
        $statements = $stStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }

    $teacher = trim($eval['teacher_full'] ?: $eval['teacher_name']);

    $response[] = [
        'id' => $eval['id'],
        'title' => $eval['title'],
        'description' => $eval['description'],
        'teacher' => $teacher,
        'teacher_initials' => getInitials($teacher),
        'created_at' => $eval['created_at'],
        'display_date' => date('j M \a\t H:i', strtotime($eval['created_at'])),
        'submitted' => $submitted,
        'statements' => $statements
    ];
}
echo json_encode($response);
