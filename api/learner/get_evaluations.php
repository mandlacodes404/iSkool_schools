<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit;
}

$learner_email = $_SESSION['email'];

// 1. Get Current Academic Year
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = $yearRes->fetch_assoc()['id'];

// 2. Get learner's class
$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $current_academic_year_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;

if (!$class_id) {
    echo json_encode(['status' => 'no_class']); exit;
}

// 3. Get Active Evaluations
$stmt = $conn->prepare("
    SELECT te.*, u.name AS teacher_name, CONCAT(COALESCE(u.title,''), ' ', u.surname) AS teacher_full 
    FROM teacher_evaluations te
    JOIN users u ON te.created_by = u.email
    WHERE te.class_id = ? AND te.is_active = 1
    ORDER BY te.created_at DESC
");
$stmt->bind_param("i", $class_id);
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

    $response[] = [
        'id' => $eval['id'],
        'title' => $eval['title'],
        'description' => $eval['description'],
        'teacher' => trim($eval['teacher_full'] ?: $eval['teacher_name']),
        'submitted' => $submitted,
        'statements' => $statements
    ];
}
echo json_encode($response);
