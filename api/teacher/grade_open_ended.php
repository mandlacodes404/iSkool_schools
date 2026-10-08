<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit();
}

verify_csrf_token();

$attempt_id = (int)($_POST['attempt_id'] ?? 0);
$question_id = (int)($_POST['question_id'] ?? 0);
$score_raw = $_POST['score'] ?? null;
$feedback = trim((string)($_POST['feedback'] ?? ''));
$teacher_email = $_SESSION['email'];

if ($attempt_id <= 0 || $question_id <= 0 || $score_raw === null || $score_raw === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing grading details.']);
    exit();
}

$score = filter_var($score_raw, FILTER_VALIDATE_FLOAT);
if ($score === false) {
    echo json_encode(['status' => 'error', 'message' => 'Score must be a valid number.']);
    exit();
}

try {
    $conn->begin_transaction();

    $verifyStmt = $conn->prepare("
        SELECT qa.quiz_id, qa.user_email, qq.points
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        INNER JOIN quizquestions qq ON qq.id = ? AND qq.quiz_id = q.id
        WHERE qa.attempt_id = ?
          AND q.created_by = ?
          AND qq.question_type = 'open_ended'
        LIMIT 1
    ");
    $verifyStmt->bind_param("iis", $question_id, $attempt_id, $teacher_email);
    $verifyStmt->execute();
    $details = $verifyStmt->get_result()->fetch_assoc();
    $verifyStmt->close();

    if (!$details) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'Open-ended answer not found.']);
        exit();
    }

    $max_points = (float)$details['points'];
    if ($score < 0 || $score > $max_points) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'Score must be between 0 and ' . rtrim(rtrim(number_format($max_points, 2, '.', ''), '0'), '.') . '.']);
        exit();
    }

    $quiz_id = (int)$details['quiz_id'];
    $learner_email = $details['user_email'];

    $gradeStmt = $conn->prepare("
        INSERT INTO open_ended_grades (attempt_id, question_id, user_email, quiz_id, score, feedback, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            feedback = VALUES(feedback),
            graded_by = VALUES(graded_by),
            graded_at = NOW()
    ");
    $gradeStmt->bind_param("iisidss", $attempt_id, $question_id, $learner_email, $quiz_id, $score, $feedback, $teacher_email);
    $gradeStmt->execute();
    $gradeStmt->close();

    $mcqStmt = $conn->prepare("
        SELECT COALESCE(SUM(qq.points), 0) AS mcq_score
        FROM user_answers ua
        INNER JOIN quizquestions qq ON qq.id = ua.question_id AND qq.question_type = 'mcq'
        INNER JOIN choices c ON c.id = ua.selected_choice_id
            AND c.question_id = qq.id
            AND c.is_correct = 1
        WHERE ua.attempt_id = ?
    ");
    $mcqStmt->bind_param("i", $attempt_id);
    $mcqStmt->execute();
    $mcq_score = (float)($mcqStmt->get_result()->fetch_assoc()['mcq_score'] ?? 0);
    $mcqStmt->close();

    $openStmt = $conn->prepare("SELECT COALESCE(SUM(score), 0) AS open_score FROM open_ended_grades WHERE attempt_id = ?");
    $openStmt->bind_param("i", $attempt_id);
    $openStmt->execute();
    $open_score = (float)($openStmt->get_result()->fetch_assoc()['open_score'] ?? 0);
    $openStmt->close();

    $fitbStmt = $conn->prepare("
        SELECT qq.id AS question_id, qq.points, fq.scoring_mode, ua.answer_text
        FROM quizquestions qq
        INNER JOIN fitb_questions fq ON fq.question_id = qq.id
        LEFT JOIN user_answers ua ON ua.question_id = qq.id AND ua.attempt_id = ?
        WHERE qq.quiz_id = ? AND qq.question_type = 'fill_in_blank'
    ");
    $fitbStmt->bind_param("ii", $attempt_id, $quiz_id);
    $fitbStmt->execute();
    $fitbRows = $fitbStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $fitbStmt->close();

    $fitb_score = 0.0;
    if (!empty($fitbRows)) {
        $blankStmt = $conn->prepare("
            SELECT blank_index, accepted_answers_json, case_sensitive
            FROM fitb_blanks
            WHERE question_id = ?
            ORDER BY blank_index ASC
        ");

        foreach ($fitbRows as $fitbRow) {
            $fitbQuestionId = (int)$fitbRow['question_id'];
            $submittedAnswers = json_decode((string)($fitbRow['answer_text'] ?? ''), true);
            if (!is_array($submittedAnswers)) {
                $submittedAnswers = [];
            }

            $blankStmt->bind_param("i", $fitbQuestionId);
            $blankStmt->execute();
            $blankRows = $blankStmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $blankCount = count($blankRows);
            if ($blankCount === 0) {
                continue;
            }

            $correctCount = 0;
            foreach ($blankRows as $blankRow) {
                $blankIndex = (int)$blankRow['blank_index'];
                $learnerAnswer = trim((string)($submittedAnswers[(string)$blankIndex] ?? $submittedAnswers[$blankIndex] ?? ''));
                $acceptedAnswers = json_decode($blankRow['accepted_answers_json'] ?? '[]', true);
                if (!is_array($acceptedAnswers)) {
                    $acceptedAnswers = [];
                }
                foreach ($acceptedAnswers as $acceptedAnswer) {
                    $acceptedAnswer = trim((string)$acceptedAnswer);
                    $isCorrect = ((int)$blankRow['case_sensitive'] === 1)
                        ? $learnerAnswer === $acceptedAnswer
                        : mb_strtolower($learnerAnswer) === mb_strtolower($acceptedAnswer);
                    if ($isCorrect) {
                        $correctCount++;
                        break;
                    }
                }
            }

            $fitbPoints = (float)$fitbRow['points'];
            if (($fitbRow['scoring_mode'] ?? 'partial') === 'all_or_nothing') {
                $fitb_score += $correctCount === $blankCount ? $fitbPoints : 0;
            } else {
                $fitb_score += ($fitbPoints / $blankCount) * $correctCount;
            }
        }
        $blankStmt->close();
    }

    $multipleAnswerStmt = $conn->prepare("
        SELECT qq.id AS question_id, qq.points, maq.scoring_mode, ua.answer_text,
               c.id AS choice_id, c.is_correct
        FROM quizquestions qq
        INNER JOIN multiple_answer_questions maq ON maq.question_id = qq.id
        LEFT JOIN user_answers ua ON ua.question_id = qq.id AND ua.attempt_id = ?
        LEFT JOIN choices c ON c.question_id = qq.id
        WHERE qq.quiz_id = ? AND qq.question_type = 'multiple_answer'
        ORDER BY qq.id ASC, c.id ASC
    ");
    $multipleAnswerStmt->bind_param("ii", $attempt_id, $quiz_id);
    $multipleAnswerStmt->execute();
    $multipleAnswerRows = $multipleAnswerStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $multipleAnswerStmt->close();

    $multiple_answer_score = 0.0;
    $multipleAnswerQuestions = [];
    foreach ($multipleAnswerRows as $multipleAnswerRow) {
        $multipleQuestionId = (int)$multipleAnswerRow['question_id'];
        if (!isset($multipleAnswerQuestions[$multipleQuestionId])) {
            $multipleAnswerQuestions[$multipleQuestionId] = [
                'points' => (float)$multipleAnswerRow['points'],
                'scoring_mode' => in_array($multipleAnswerRow['scoring_mode'], ['exact_match', 'partial_penalty'], true)
                    ? $multipleAnswerRow['scoring_mode']
                    : 'exact_match',
                'submitted_choice_ids' => [],
                'correct_choice_ids' => [],
            ];

            $submittedChoices = json_decode((string)($multipleAnswerRow['answer_text'] ?? ''), true);
            if (is_array($submittedChoices)) {
                foreach ($submittedChoices as $choiceId) {
                    $multipleAnswerQuestions[$multipleQuestionId]['submitted_choice_ids'][(int)$choiceId] = true;
                }
            }
        }

        $choiceId = (int)$multipleAnswerRow['choice_id'];
        if ((int)$multipleAnswerRow['is_correct'] === 1) {
            $multipleAnswerQuestions[$multipleQuestionId]['correct_choice_ids'][$choiceId] = true;
        }
    }

    foreach ($multipleAnswerQuestions as $multipleAnswerQuestion) {
        $selectedSet = $multipleAnswerQuestion['submitted_choice_ids'];
        $correctSet = $multipleAnswerQuestion['correct_choice_ids'];

        if ($multipleAnswerQuestion['scoring_mode'] === 'exact_match') {
            if (
                count($selectedSet) === count($correctSet)
                && empty(array_diff_key($selectedSet, $correctSet))
                && empty(array_diff_key($correctSet, $selectedSet))
            ) {
                $multiple_answer_score += $multipleAnswerQuestion['points'];
            }
            continue;
        }

        $correctCount = count($correctSet);
        if ($correctCount === 0) {
            continue;
        }

        $pointsPerChoice = $multipleAnswerQuestion['points'] / $correctCount;
        $questionScore = 0.0;
        foreach ($selectedSet as $choiceId => $_) {
            $questionScore += isset($correctSet[$choiceId]) ? $pointsPerChoice : -$pointsPerChoice;
        }
        $multiple_answer_score += max(0, $questionScore);
    }

    $updated_total = $mcq_score + $multiple_answer_score + $fitb_score + $open_score;
    $resultStmt = $conn->prepare("UPDATE quiz_results SET score = ? WHERE attempt_id = ? AND quiz_id = ?");
    $resultStmt->bind_param("dii", $updated_total, $attempt_id, $quiz_id);
    $resultStmt->execute();
    $resultStmt->close();

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'data' => [
            'updated_total_score' => $updated_total,
            'score' => $score,
            'question_id' => $question_id,
            'attempt_id' => $attempt_id
        ]
    ]);
} catch (Throwable $e) {
    if ($conn->errno === 0) {
        // Keep rollback best-effort without exposing transaction state.
    }
    $conn->rollback();
    error_log('grade_open_ended error: ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Unable to save open-ended grade.']);
}
