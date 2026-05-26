<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized', 'error' => 'Unauthorized']);
    exit();
}

$result_id = (int)($_GET['result_id'] ?? 0);
if ($result_id <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid result ID', 'error' => 'Invalid result ID']);
    exit();
}

$stmt = $conn->prepare("
    SELECT
        r.id AS result_id, r.score, r.total, r.submitted_at, r.user_email, r.attempt_id,
        q.id AS quiz_id, q.title, q.publish_marks,
        qq.id AS q_id, qq.question_text, qq.image_path, qq.points, qq.question_type,
        c.id AS choice_id, c.choice_text, c.is_correct,
        ua.selected_choice_id, ua.answer_text,
        og.score AS open_score, og.feedback AS open_feedback, og.graded_by, og.graded_at
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN quizquestions qq ON q.id = qq.quiz_id
    LEFT JOIN choices c ON qq.id = c.question_id
    LEFT JOIN user_answers ua
      ON ua.question_id = qq.id
     AND (ua.result_id = r.id OR ua.attempt_id = r.attempt_id)
    LEFT JOIN open_ended_grades og
      ON og.question_id = qq.id
     AND og.attempt_id = r.attempt_id
    WHERE r.id = ? AND q.created_by = ?
    ORDER BY qq.id ASC, c.id ASC
");
$stmt->bind_param("is", $result_id, $_SESSION['email']);
$stmt->execute();
$res  = $stmt->get_result();
$rows = $res->fetch_all(MYSQLI_ASSOC);
$stmt->close();

if (empty($rows)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Review data not found', 'error' => 'Review data not found']);
    exit();
}

$quizInfo  = $rows[0];
$questions = [];

foreach ($rows as $row) {
    $qid = $row['q_id'];
    if (!isset($questions[$qid])) {
        $questions[$qid] = [
            'text'     => $row['question_text'],
            'image'    => $row['image_path'],
            'points'   => $row['points'],
            'question_type' => $row['question_type'] ?? 'mcq',
            'selected' => $row['selected_choice_id'],
            'answer_text' => $row['answer_text'] ?? '',
            'grade' => !empty($row['graded_by']) ? [
                'score' => $row['open_score'],
                'feedback' => $row['open_feedback'],
                'graded_by' => $row['graded_by'],
                'graded_at' => $row['graded_at']
            ] : null,
            'choices'  => []
        ];
    }
    if ($row['choice_id'] !== null) {
        $questions[$qid]['choices'][] = [
            'id'         => $row['choice_id'],
            'text'       => $row['choice_text'],
            'is_correct' => (int)$row['is_correct']
        ];
    }
}

$percentage = $quizInfo['total'] > 0
    ? round($quizInfo['score'] / $quizInfo['total'] * 100)
    : 0;

echo json_encode([
    'status' => 'success',
    'data' => [
        'quiz_id'     => (int)$quizInfo['quiz_id'],
        'title'       => $quizInfo['title'],
        'score'       => $quizInfo['score'],
        'total'       => $quizInfo['total'],
        'percentage'  => $percentage,
        'submitted_at'=> date('d M Y', strtotime($quizInfo['submitted_at'])),
        'questions'   => array_values($questions)
    ],
    'quiz_id'     => (int)$quizInfo['quiz_id'],
    'title'       => $quizInfo['title'],
    'score'       => $quizInfo['score'],
    'total'       => $quizInfo['total'],
    'percentage'  => $percentage,
    'submitted_at'=> date('d M Y', strtotime($quizInfo['submitted_at'])),
    'questions'   => array_values($questions)
]);
