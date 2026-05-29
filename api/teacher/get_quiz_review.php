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
        u.name AS learner_name, u.surname AS learner_surname,
        q.id AS quiz_id, q.title, q.publish_marks,
        qq.id AS q_id, qq.question_text, qq.image_path, qq.points, qq.question_type,
        c.id AS choice_id, c.choice_text, c.is_correct,
        ua.selected_choice_id, ua.answer_text,
        og.score AS open_score, og.feedback AS open_feedback, og.graded_by, og.graded_at
    FROM quiz_results r
    JOIN quizzes q ON r.quiz_id = q.id
    LEFT JOIN users u ON u.email = r.user_email
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

$fitbQuestionIds = [];
foreach ($questions as $qid => $question) {
    if (($question['question_type'] ?? 'mcq') === 'fill_in_blank') {
        $fitbQuestionIds[] = (int)$qid;
    }
}

if (!empty($fitbQuestionIds)) {
    $fitbStmt = $conn->prepare("
        SELECT fq.question_id, fq.sub_type, fq.scoring_mode, fq.distractors_json,
               fb.blank_index, fb.accepted_answers_json, fb.case_sensitive
        FROM fitb_questions fq
        JOIN fitb_blanks fb ON fb.question_id = fq.question_id
        JOIN quizquestions qq ON qq.id = fq.question_id
        JOIN quiz_results r ON r.quiz_id = qq.quiz_id
        WHERE r.id = ?
        ORDER BY fq.question_id ASC, fb.blank_index ASC
    ");
    $fitbStmt->bind_param("i", $result_id);
    $fitbStmt->execute();
    $fitbRows = $fitbStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $fitbStmt->close();

    foreach ($fitbRows as $fitbRow) {
        $qid = (int)$fitbRow['question_id'];
        if (!isset($questions[$qid])) {
            continue;
        }
        if (!isset($questions[$qid]['fitb'])) {
            $answerMap = json_decode($questions[$qid]['answer_text'] ?? '[]', true);
            $questions[$qid]['fitb'] = [
                'sub_type' => $fitbRow['sub_type'],
                'scoring_mode' => $fitbRow['scoring_mode'],
                'learner_answers' => is_array($answerMap) ? $answerMap : [],
                'blanks' => [],
                'points_awarded' => 0
            ];
        }
        $accepted = json_decode($fitbRow['accepted_answers_json'] ?? '[]', true);
        $accepted = is_array($accepted) ? $accepted : [];
        $blankIndex = (int)$fitbRow['blank_index'];
        $learnerAnswer = trim((string)($questions[$qid]['fitb']['learner_answers'][(string)$blankIndex] ?? ''));
        $isCorrect = false;
        foreach ($accepted as $acceptedAnswer) {
            $acceptedAnswer = trim((string)$acceptedAnswer);
            $isCorrect = ((int)$fitbRow['case_sensitive'] === 1)
                ? $learnerAnswer === $acceptedAnswer
                : mb_strtolower($learnerAnswer) === mb_strtolower($acceptedAnswer);
            if ($isCorrect) {
                break;
            }
        }
        $questions[$qid]['fitb']['blanks'][] = [
            'blank_index' => $blankIndex,
            'learner_answer' => $learnerAnswer,
            'accepted_answers' => $accepted,
            'case_sensitive' => (int)$fitbRow['case_sensitive'],
            'is_correct' => $isCorrect
        ];
    }

    foreach ($fitbQuestionIds as $qid) {
        if (empty($questions[$qid]['fitb']['blanks'])) {
            continue;
        }
        $correctCount = count(array_filter($questions[$qid]['fitb']['blanks'], fn($blank) => $blank['is_correct']));
        $blankCount = count($questions[$qid]['fitb']['blanks']);
        if ($questions[$qid]['fitb']['scoring_mode'] === 'all_or_nothing') {
            $questions[$qid]['fitb']['points_awarded'] = $correctCount === $blankCount ? (float)$questions[$qid]['points'] : 0;
        } else {
            $questions[$qid]['fitb']['points_awarded'] = $blankCount > 0 ? ((float)$questions[$qid]['points'] / $blankCount) * $correctCount : 0;
        }
    }
}

$percentage = $quizInfo['total'] > 0
    ? round($quizInfo['score'] / $quizInfo['total'] * 100)
    : 0;
$learnerName = trim(($quizInfo['learner_name'] ?? '') . ' ' . ($quizInfo['learner_surname'] ?? ''));
if ($learnerName === '') {
    $learnerName = $quizInfo['user_email'];
}

echo json_encode([
    'status' => 'success',
    'data' => [
        'quiz_id'     => (int)$quizInfo['quiz_id'],
        'title'       => $quizInfo['title'],
        'user_email'   => $quizInfo['user_email'],
        'learner_name' => $learnerName,
        'score'       => $quizInfo['score'],
        'total'       => $quizInfo['total'],
        'percentage'  => $percentage,
        'submitted_at'=> date('d M Y', strtotime($quizInfo['submitted_at'])),
        'questions'   => array_values($questions)
    ],
    'quiz_id'     => (int)$quizInfo['quiz_id'],
    'title'       => $quizInfo['title'],
    'user_email'   => $quizInfo['user_email'],
    'learner_name' => $learnerName,
    'score'       => $quizInfo['score'],
    'total'       => $quizInfo['total'],
    'percentage'  => $percentage,
    'submitted_at'=> date('d M Y', strtotime($quizInfo['submitted_at'])),
    'questions'   => array_values($questions)
]);
