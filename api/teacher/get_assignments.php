<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

$yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearStmt->execute();
$yearResult = $yearStmt->get_result();
$current_year_id = (int)($yearResult->fetch_assoc()['id'] ?? 0);
$yearStmt->close();

// Fetch all assignments for this teacher
$stmt = $conn->prepare("
    SELECT a.id, a.title, a.description, a.due_date, a.file_url,
           a.class_id, c.name AS class_name
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    WHERE a.created_by = ?
      AND a.academic_year_id = ?
    ORDER BY a.due_date ASC
");
$stmt->bind_param("si", $email, $current_year_id);
$stmt->execute();
$assignments = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$output = [];

foreach ($assignments as $assignment) {
    $assignmentId = $assignment['id'];
    $classId      = $assignment['class_id'];

    // Get all learners in this class
    $learnersStmt = $conn->prepare("
        SELECT DISTINCT u.email, u.name, u.surname
        FROM class_students cs
        JOIN users u ON cs.student_email = u.email
        WHERE cs.class_id = ?
          AND cs.academic_year_id = ?
        ORDER BY u.surname ASC, u.name ASC
    ");
    $learnersStmt->bind_param("ii", $classId, $current_year_id);
    $learnersStmt->execute();
    $learners = $learnersStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $learnersStmt->close();

    $submissions   = [];
    $submittedCount = 0;

    foreach ($learners as $learner) {
        $subStmt = $conn->prepare("
            SELECT submission_type, file_url, text_answer, audio_url, submitted_at
            FROM submissions
            WHERE assignment_id = ? AND student_email = ?
        ");
        $subStmt->bind_param("is", $assignmentId, $learner['email']);
        $subStmt->execute();
        $sub = $subStmt->get_result()->fetch_assoc();
        $subStmt->close();

        if ($sub) $submittedCount++;

        $submissions[] = [
            'name'            => $learner['name'] . ' ' . $learner['surname'],
            'submitted'       => $sub ? true : false,
            'submitted_at'    => $sub ? date('d M Y, g:i A', strtotime($sub['submitted_at'])) : null,
            'submission_type' => $sub['submission_type'] ?? null,
            'file_url'        => $sub['file_url'] ?? null,
            'text_answer'     => $sub['text_answer'] ?? null,
            'audio_url'       => $sub['audio_url'] ?? null,
        ];
    }

    $output[] = [
        'id'              => $assignmentId,
        'title'           => $assignment['title'],
        'description'     => $assignment['description'],
        'due_date'        => date('d M Y, g:i A', strtotime($assignment['due_date'])),
        'class_name'      => $assignment['class_name'],
        'file_url'        => $assignment['file_url'],
        'submitted_count' => $submittedCount,
        'total_learners'  => count($learners),
        'submissions'     => $submissions
    ];
}

echo json_encode($output);
