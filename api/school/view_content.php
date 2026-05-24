<?php
/**
 * iSkool School Dashboard — View Content Item API
 * Returns full details of a quiz, assignment or resource
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$type = trim($_GET['type'] ?? '');
$id   = (int)($_GET['id']   ?? 0);

if (!$type || !$id) {
    echo json_encode(['error' => 'Missing type or id']);
    exit();
}

// ══════════════════════════════════════════════════════════
// QUIZ
// ══════════════════════════════════════════════════════════
if ($type === 'quiz') {
    // Quiz details
    $qRes = $conn->query("
        SELECT q.id, q.title, q.duration, q.term_number, q.is_summative,
               q.weight_percent, q.status, q.start_time, q.created_at,
               q.created_by, q.publish_marks,
               u.name, u.surname,
               c.name class_name
        FROM quizzes q
        JOIN users u ON u.email = q.created_by
        LEFT JOIN classes c ON c.id = q.class_id
        WHERE q.id = $id LIMIT 1
    ");
    $quiz = $qRes->fetch_assoc();
    if (!$quiz) { echo json_encode(['error' => 'Quiz not found']); exit(); }

    // Questions
    $questionsRes = $conn->query("
        SELECT id, question_text, image_path, points
        FROM quizquestions
        WHERE quiz_id = $id
        ORDER BY id ASC
    ");

    $questions   = [];
    $totalPoints = 0;

    while ($q = $questionsRes->fetch_assoc()) {
        $qid = $q['id'];

        // Choices for this question
        $choicesRes = $conn->query("
            SELECT choice_text, is_correct
            FROM choices
            WHERE question_id = $qid
            ORDER BY id ASC
        ");
        $choices = [];
        while ($c = $choicesRes->fetch_assoc()) {
            $choices[] = [
                'text'       => $c['choice_text'],
                'is_correct' => (bool)$c['is_correct'],
            ];
        }

        $totalPoints += (int)$q['points'];
        $questions[]  = [
            'question_text' => $q['question_text'],
            'image_path'    => $q['image_path'],
            'points'        => (int)$q['points'],
            'choices'       => $choices,
        ];
    }

    $isManual = count($questions) === 0;

    // Submission stats
    $stats = $conn->query("
        SELECT COUNT(DISTINCT user_email) submitted,
               ROUND(AVG(score / total * 100), 1) avg_pct,
               MAX(score / total * 100) highest,
               MIN(score / total * 100) lowest
        FROM quiz_results
        WHERE quiz_id = $id
    ")->fetch_assoc();

    echo json_encode([
        'type'         => 'quiz',
        'id'           => $id,
        'title'        => $quiz['title'],
        'teacher_name' => trim($quiz['name'] . ' ' . $quiz['surname']),
        'class_name'   => $quiz['class_name'],
        'term'         => $quiz['term_number'],
        'is_summative' => (bool)$quiz['is_summative'],
        'weight'       => $quiz['weight_percent'],
        'duration'     => $quiz['duration'],
        'status'       => $quiz['status'],
        'start_time'   => $quiz['start_time'],
        'created_at'   => $quiz['created_at'],
        'publish_marks'=> (bool)$quiz['publish_marks'],
        'is_manual'    => $isManual,
        'question_count'=> count($questions),
        'total_points' => $totalPoints,
        'questions'    => $questions,
        'stats'        => [
            'submitted' => (int)$stats['submitted'],
            'avg_pct'   => $stats['avg_pct'],
            'highest'   => $stats['highest'] ? round($stats['highest'], 1) : null,
            'lowest'    => $stats['lowest']  ? round($stats['lowest'],  1) : null,
        ],
    ]);
    exit();
}

// ══════════════════════════════════════════════════════════
// ASSIGNMENT
// ══════════════════════════════════════════════════════════
if ($type === 'assignment') {
    $aRes = $conn->query("
        SELECT a.id, a.title, a.description, a.file_url,
               a.due_date, a.created_at, a.term_number,
               a.allow_late, a.created_by,
               u.name, u.surname,
               c.name class_name,
               COUNT(s.id) submissions
        FROM assignments a
        JOIN users u ON u.email = a.created_by
        LEFT JOIN classes c ON c.id = a.class_id
        LEFT JOIN submissions s ON s.assignment_id = a.id
        WHERE a.id = $id
        GROUP BY a.id
        LIMIT 1
    ");
    $asgn = $aRes->fetch_assoc();
    if (!$asgn) { echo json_encode(['error' => 'Assignment not found']); exit(); }

    echo json_encode([
        'type'         => 'assignment',
        'id'           => $id,
        'title'        => $asgn['title'],
        'description'  => $asgn['description'],
        'file_url'     => $asgn['file_url'],
        'due_date'     => $asgn['due_date'],
        'created_at'   => $asgn['created_at'],
        'term'         => $asgn['term_number'],
        'allow_late'   => (bool)$asgn['allow_late'],
        'teacher_name' => trim($asgn['name'] . ' ' . $asgn['surname']),
        'class_name'   => $asgn['class_name'],
        'submissions'  => (int)$asgn['submissions'],
    ]);
    exit();
}

// ══════════════════════════════════════════════════════════
// RESOURCE
// ══════════════════════════════════════════════════════════
if ($type === 'resource') {
    $rRes = $conn->query("
        SELECT r.id, r.title, r.filename,
               r.uploaded_at, r.uploaded_by, r.term_number,
               u.name, u.surname,
               c.name class_name
        FROM resources r
        JOIN users u ON u.email = r.uploaded_by
        LEFT JOIN classes c ON c.id = r.class_id
        WHERE r.id = $id LIMIT 1
    ");
    $res = $rRes->fetch_assoc();
    if (!$res) { echo json_encode(['error' => 'Resource not found']); exit(); }

    $ext = strtolower(pathinfo($res['filename'], PATHINFO_EXTENSION));

    echo json_encode([
        'type'         => 'resource',
        'id'           => $id,
        'title'        => $res['title'],
        'filename'     => $res['filename'],
        'file_type'    => $ext ?: 'file',
        'created_at'   => $res['uploaded_at'],
        'term'         => $res['term_number'],
        'teacher_name' => trim($res['name'] . ' ' . $res['surname']),
        'class_name'   => $res['class_name'],
    ]);
    exit();
}

echo json_encode(['error' => 'Unknown type']);