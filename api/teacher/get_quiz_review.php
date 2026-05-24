<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$result_id = (int)($_GET['result_id'] ?? 0);
if ($result_id <= 0) {
    echo json_encode(['error' => 'Invalid result ID']);
    exit();
}

$stmt = $conn->prepare("
    SELECT
        r.score, r.total, r.submitted_at, r.user_email,
        q.id AS quiz_id, q.title, q.publish_marks,
        qq.id AS q_id, qq.question_text, qq.image_path, qq.points,
        c.id AS choice_id, c.choice_text, c.is_correct,
        ua.selected_choice_id
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    JOIN quizquestions qq ON q.id = qq.quiz_id
    JOIN choices c ON qq.id = c.question_id
    LEFT JOIN user_answers ua ON ua.question_id = qq.id AND ua.result_id = r.id
    WHERE r.id = ?
    ORDER BY qq.id ASC, c.id ASC
");
$stmt->bind_param("i", $result_id);
$stmt->execute();
$res  = $stmt->get_result();
$rows = $res->fetch_all(MYSQLI_ASSOC);
$stmt->close();

if (empty($rows)) {
    echo json_encode(['error' => 'Review data not found']);
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
            'selected' => $row['selected_choice_id'],
            'choices'  => []
        ];
    }
    $questions[$qid]['choices'][] = [
        'id'         => $row['choice_id'],
        'text'       => $row['choice_text'],
        'is_correct' => (int)$row['is_correct']
    ];
}

$percentage = $quizInfo['total'] > 0
    ? round($quizInfo['score'] / $quizInfo['total'] * 100)
    : 0;

echo json_encode([
    'title'       => $quizInfo['title'],
    'score'       => $quizInfo['score'],
    'total'       => $quizInfo['total'],
    'percentage'  => $percentage,
    'submitted_at'=> date('d M Y', strtotime($quizInfo['submitted_at'])),
    'questions'   => array_values($questions)
]);