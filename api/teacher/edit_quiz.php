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

function validate_quiz_edit_image_upload(array $files, int $index): array {
    $safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($files['name'][$index]));
    $ext = strtolower(pathinfo($safe_name, PATHINFO_EXTENSION));
    $max_size = 5 * 1024 * 1024;
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $blocked = ['php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'cgi', 'pl', 'asp', 'aspx', 'js', 'html', 'htm', 'svg'];
    $allowedMimeTypes = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp']
    ];

    if ($files['size'][$index] > $max_size) {
        return ['valid' => false, 'message' => 'File too large. Maximum size is 5MB.'];
    }
    if ($safe_name === '' || in_array($ext, $blocked, true) || !in_array($ext, $allowed, true)) {
        return ['valid' => false, 'message' => 'File type not allowed.'];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($files['tmp_name'][$index]);
    if (!isset($allowedMimeTypes[$ext]) || !in_array($mime, $allowedMimeTypes[$ext], true)) {
        return ['valid' => false, 'message' => 'File type not allowed.'];
    }

    return ['valid' => true, 'safe_name' => $safe_name];
}

function normalize_question_payload(): array {
    $question_texts = $_POST['question'] ?? [];
    $question_ids = $_POST['question_id'] ?? [];
    $points_values = $_POST['points'] ?? [];
    $question_types = $_POST['question_type'] ?? [];
    $remove_images = $_POST['remove_image'] ?? [];
    $choices_payload = $_POST['choices'] ?? [];
    $choice_ids_payload = $_POST['choice_id'] ?? [];
    $correct_choices = $_POST['correct_choice'] ?? [];

    $questions = [];
    foreach ($question_texts as $i => $question_text) {
        $choice_values = $choices_payload[$i] ?? [];
        $choice_ids = $choice_ids_payload[$i] ?? [];
        $choices = [];
        foreach ((array)$choice_values as $j => $choice_text) {
            $choices[] = [
                'id' => (int)($choice_ids[$j] ?? 0),
                'text' => trim((string)$choice_text),
                'is_correct' => ((string)($correct_choices[$i] ?? '') === (string)$j) ? 1 : 0
            ];
        }

        $questions[] = [
            'id' => (int)($question_ids[$i] ?? 0),
            'text' => trim((string)$question_text),
            'question_type' => $question_types[$i] ?? 'mcq',
            'points' => (int)($points_values[$i] ?? 0),
            'remove_image' => (int)($remove_images[$i] ?? 0),
            'choices' => $choices
        ];
    }

    return $questions;
}

$quiz_id = (int)($_POST['quiz_id'] ?? 0);
$email = $_SESSION['email'];

if ($quiz_id < 1) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid quiz selected.']);
    exit();
}

$quizStmt = $conn->prepare("
    SELECT id, title, duration, class_id, attempt_limit, start_time, status, is_summative,
           weight_percent, layout_mode, shuffle_questions, is_linear
    FROM quizzes
    WHERE id = ? AND created_by = ?
    LIMIT 1
");
$quizStmt->bind_param("is", $quiz_id, $email);
$quizStmt->execute();
$existing_quiz = $quizStmt->get_result()->fetch_assoc();
$quizStmt->close();

if (!$existing_quiz) {
    echo json_encode(['status' => 'error', 'message' => 'You do not own this quiz.']);
    exit();
}

$quiz_title = trim($_POST['quiz_title'] ?? '');
$duration_check = filter_var($_POST['duration'] ?? null, FILTER_VALIDATE_INT);
$duration = $duration_check === false ? -1 : (int)$duration_check;
$attempt_check = filter_var($_POST['attempt_limit'] ?? 1, FILTER_VALIDATE_INT);
$attempt_limit = $attempt_check === false ? -1 : (int)$attempt_check;
$start_time = $_POST['start_time'] ?? '';
$status = $_POST['status'] ?? ($existing_quiz['status'] ?? 'Closed');
$publish_marks = isset($_POST['publish_marks']) ? 1 : 0;
$is_summative = isset($_POST['is_summative']) ? 1 : 0;
$weight_raw = $_POST['weight_percent'] ?? null;
$weight_check = $is_summative && $weight_raw !== null && $weight_raw !== '' ? filter_var($weight_raw, FILTER_VALIDATE_FLOAT) : null;
$weight_percent = $weight_check === false ? -1 : $weight_check;
$layout_mode = $_POST['layout_mode'] ?? $existing_quiz['layout_mode'];
$shuffle_questions = isset($_POST['shuffle_questions']) ? 1 : 0;
$is_linear = isset($_POST['is_linear']) ? 1 : 0;
$questions = normalize_question_payload();

$errors = [];
if ($quiz_title === '') $errors[] = 'Quiz title is required.';
if (strlen($quiz_title) > 255) $errors[] = 'Quiz title must be 255 characters or fewer.';
if ($duration < 0 || $duration > 180) $errors[] = 'Duration must be between 0 and 180 minutes.';
if ($attempt_limit < 0) $errors[] = 'Attempt limit must be zero or greater.';
if (empty($start_time) || !strtotime($start_time)) $errors[] = 'Valid start time is required.';
if (!in_array($status, ['Scheduled', 'Open', 'Closed'], true)) $errors[] = 'Invalid quiz status.';
if (!in_array($layout_mode, ['single_page', 'multi_page'], true)) $errors[] = 'Invalid quiz layout.';
if ($is_summative && ($weight_raw === null || $weight_raw === '')) $errors[] = 'Weight percent must be between 0 and 100.';
if ($weight_percent !== null && ($weight_percent < 0 || $weight_percent > 100)) $errors[] = 'Weight percent must be between 0 and 100.';

$current_status = in_array($existing_quiz['status'], ['Scheduled', 'Open', 'Closed'], true) ? $existing_quiz['status'] : 'Closed';
$next_status = $current_status === 'Scheduled' ? 'Open' : ($current_status === 'Open' ? 'Closed' : 'Open');
if ($status !== $current_status && $status !== $next_status) {
    $errors[] = 'Invalid status change. Use the allowed quiz status transition.';
}

$attemptStmt = $conn->prepare("SELECT 1 FROM quiz_attempts WHERE quiz_id = ? LIMIT 1");
$attemptStmt->bind_param("i", $quiz_id);
$attemptStmt->execute();
$has_attempts = $attemptStmt->get_result()->num_rows > 0;
$attemptStmt->close();

if (!$has_attempts) {
    if (empty($questions)) {
        $errors[] = 'At least one question is required.';
    }

    foreach ($questions as $i => $question) {
        $non_empty_choices = array_values(array_filter($question['choices'], function ($choice) {
            return $choice['text'] !== '';
        }));
        $correct_count = 0;
        foreach ($non_empty_choices as $choice) {
            if ($choice['is_correct'] === 1) {
                $correct_count++;
            }
        }

        if (!in_array($question['question_type'], ['mcq', 'open_ended'], true)) $errors[] = 'Question ' . ($i + 1) . ' has an invalid question type.';
        if ($question['text'] === '') $errors[] = 'Question ' . ($i + 1) . ' text is required.';
        if ($question['question_type'] === 'open_ended') {
            if (count($non_empty_choices) > 0) $errors[] = 'Question ' . ($i + 1) . ' is open-ended and must not have choices.';
        } else {
            if (count($non_empty_choices) < 2) $errors[] = 'Question ' . ($i + 1) . ' must have at least two choices.';
            if ($correct_count !== 1) $errors[] = 'Question ' . ($i + 1) . ' must have exactly one valid correct choice.';
        }
        if ($question['points'] <= 0) $errors[] = 'Question ' . ($i + 1) . ' points must be greater than zero.';
    }
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => implode(' ', $errors)]);
    exit();
}

$validated_images = [];
foreach ($_FILES['question_images']['name'] ?? [] as $i => $unused) {
    if ($_FILES['question_images']['error'][$i] === UPLOAD_ERR_NO_FILE) {
        continue;
    }
    if ($_FILES['question_images']['error'][$i] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Image upload failed.']);
        exit();
    }

    $imageValidation = validate_quiz_edit_image_upload($_FILES['question_images'], $i);
    if (!$imageValidation['valid']) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $imageValidation['message']]);
        exit();
    }
    $validated_images[$i] = $imageValidation['safe_name'];
}

$new_image_paths = [];
$old_images_to_delete = [];

try {
    $conn->begin_transaction();

    $updateQuiz = $conn->prepare("
        UPDATE quizzes
        SET title = ?, duration = ?, attempt_limit = ?, start_time = ?, status = ?,
            publish_marks = ?, is_summative = ?, weight_percent = ?
        WHERE id = ? AND created_by = ?
    ");
    $updateQuiz->bind_param(
        "siissiidis",
        $quiz_title,
        $duration,
        $attempt_limit,
        $start_time,
        $status,
        $publish_marks,
        $is_summative,
        $weight_percent,
        $quiz_id,
        $email
    );
    if (!$updateQuiz->execute()) {
        throw new RuntimeException("Quiz metadata update failed: " . $updateQuiz->error);
    }
    $updateQuiz->close();

    if ($has_attempts) {
        $conn->commit();
        echo json_encode([
            'status' => 'success',
            'data' => [
                'updated' => true,
                'locked' => true,
                'message' => 'Quiz metadata was updated. This quiz already has learner attempts, so questions, question types, choices, points, layout mode, shuffle questions, and linear progression were not changed.'
            ]
        ]);
        exit();
    }

    $updateLocked = $conn->prepare("
        UPDATE quizzes
        SET layout_mode = ?, shuffle_questions = ?, is_linear = ?
        WHERE id = ? AND created_by = ?
    ");
    $updateLocked->bind_param("siiis", $layout_mode, $shuffle_questions, $is_linear, $quiz_id, $email);
    if (!$updateLocked->execute()) {
        throw new RuntimeException("Quiz layout update failed: " . $updateLocked->error);
    }
    $updateLocked->close();

    $existingQuestionsStmt = $conn->prepare("SELECT id, image_path, question_type FROM quizquestions WHERE quiz_id = ?");
    $existingQuestionsStmt->bind_param("i", $quiz_id);
    $existingQuestionsStmt->execute();
    $existingQuestionRows = $existingQuestionsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $existingQuestionsStmt->close();

    $existing_question_map = [];
    foreach ($existingQuestionRows as $row) {
        $existing_question_map[(int)$row['id']] = [
            'image_path' => $row['image_path'],
            'question_type' => $row['question_type'] ?? 'mcq'
        ];
    }

    $submitted_question_ids = array_values(array_filter(array_map(function ($question) {
        return (int)$question['id'];
    }, $questions)));

    foreach ($submitted_question_ids as $submitted_question_id) {
        if (!array_key_exists($submitted_question_id, $existing_question_map)) {
            throw new RuntimeException("Question ownership validation failed.");
        }
    }

    $questions_to_delete = array_diff(array_keys($existing_question_map), $submitted_question_ids);
    foreach ($questions_to_delete as $question_id_to_delete) {
        if (!empty($existing_question_map[$question_id_to_delete]['image_path'])) {
            $old_images_to_delete[] = $existing_question_map[$question_id_to_delete]['image_path'];
        }
        $deleteChoices = $conn->prepare("DELETE FROM choices WHERE question_id = ?");
        $deleteChoices->bind_param("i", $question_id_to_delete);
        if (!$deleteChoices->execute()) {
            throw new RuntimeException("Deleted question choices failed: " . $deleteChoices->error);
        }
        $deleteChoices->close();

        $deleteQuestion = $conn->prepare("DELETE FROM quizquestions WHERE id = ? AND quiz_id = ?");
        $deleteQuestion->bind_param("ii", $question_id_to_delete, $quiz_id);
        if (!$deleteQuestion->execute()) {
            throw new RuntimeException("Question delete failed: " . $deleteQuestion->error);
        }
        $deleteQuestion->close();
    }

    $targetDir = dirname(__DIR__, 2) . '/quiz_images/';
    if (!file_exists($targetDir) && !mkdir($targetDir, 0755, true)) {
        throw new RuntimeException("Failed to create quiz image directory.");
    }

    foreach ($questions as $i => $question) {
        $question_id = (int)$question['id'];
        $image_path = $question_id > 0 ? ($existing_question_map[$question_id]['image_path'] ?? null) : null;
        $old_image_path = $image_path;

        if (isset($_FILES['question_images']['name'][$i]) && $_FILES['question_images']['error'][$i] === UPLOAD_ERR_OK) {
            $filename = time() . "_" . $i . "_" . $validated_images[$i];
            $absoluteTarget = $targetDir . $filename;
            if (!move_uploaded_file($_FILES['question_images']['tmp_name'][$i], $absoluteTarget)) {
                throw new RuntimeException("Image move failed for question " . ($i + 1));
            }
            $image_path = 'quiz_images/' . $filename;
            $new_image_paths[] = $image_path;
            if (!empty($old_image_path)) {
                $old_images_to_delete[] = $old_image_path;
            }
        } elseif ($question['remove_image'] === 1 && !empty($old_image_path)) {
            $image_path = null;
            $old_images_to_delete[] = $old_image_path;
        }

        if ($question_id > 0) {
            $updateQuestion = $conn->prepare("UPDATE quizquestions SET question_text = ?, image_path = ?, points = ?, question_type = ? WHERE id = ? AND quiz_id = ?");
            $updateQuestion->bind_param("ssisii", $question['text'], $image_path, $question['points'], $question['question_type'], $question_id, $quiz_id);
            if (!$updateQuestion->execute()) {
                throw new RuntimeException("Question update failed: " . $updateQuestion->error);
            }
            $updateQuestion->close();
        } else {
            $insertQuestion = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, image_path, points, question_type) VALUES (?, ?, ?, ?, ?)");
            $insertQuestion->bind_param("issis", $quiz_id, $question['text'], $image_path, $question['points'], $question['question_type']);
            if (!$insertQuestion->execute()) {
                throw new RuntimeException("Question insert failed: " . $insertQuestion->error);
            }
            $question_id = $insertQuestion->insert_id;
            $insertQuestion->close();
        }

        if ($question['question_type'] === 'open_ended') {
            $deleteOpenChoices = $conn->prepare("DELETE FROM choices WHERE question_id = ?");
            $deleteOpenChoices->bind_param("i", $question_id);
            if (!$deleteOpenChoices->execute()) {
                throw new RuntimeException("Open-ended choice cleanup failed: " . $deleteOpenChoices->error);
            }
            $deleteOpenChoices->close();
            continue;
        }

        $existingChoicesStmt = $conn->prepare("SELECT id FROM choices WHERE question_id = ?");
        $existingChoicesStmt->bind_param("i", $question_id);
        $existingChoicesStmt->execute();
        $existingChoiceRows = $existingChoicesStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $existingChoicesStmt->close();
        $existing_choice_ids = array_map(function ($row) {
            return (int)$row['id'];
        }, $existingChoiceRows);

        $submitted_choice_ids = [];
        foreach ($question['choices'] as $choice) {
            if ($choice['text'] === '') {
                continue;
            }
            if ($choice['id'] > 0) {
                if (!in_array($choice['id'], $existing_choice_ids, true)) {
                    throw new RuntimeException("Choice ownership validation failed.");
                }
                $submitted_choice_ids[] = $choice['id'];
                $updateChoice = $conn->prepare("UPDATE choices SET choice_text = ?, is_correct = ? WHERE id = ? AND question_id = ?");
                $updateChoice->bind_param("siii", $choice['text'], $choice['is_correct'], $choice['id'], $question_id);
                if (!$updateChoice->execute()) {
                    throw new RuntimeException("Choice update failed: " . $updateChoice->error);
                }
                $updateChoice->close();
            } else {
                $insertChoice = $conn->prepare("INSERT INTO choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)");
                $insertChoice->bind_param("isi", $question_id, $choice['text'], $choice['is_correct']);
                if (!$insertChoice->execute()) {
                    throw new RuntimeException("Choice insert failed: " . $insertChoice->error);
                }
                $submitted_choice_ids[] = $insertChoice->insert_id;
                $insertChoice->close();
            }
        }

        $choices_to_delete = array_diff($existing_choice_ids, $submitted_choice_ids);
        foreach ($choices_to_delete as $choice_id_to_delete) {
            $deleteChoice = $conn->prepare("DELETE FROM choices WHERE id = ? AND question_id = ?");
            $deleteChoice->bind_param("ii", $choice_id_to_delete, $question_id);
            if (!$deleteChoice->execute()) {
                throw new RuntimeException("Choice delete failed: " . $deleteChoice->error);
            }
            $deleteChoice->close();
        }

        $correctCheck = $conn->prepare("SELECT COUNT(*) AS correct_count FROM choices WHERE question_id = ? AND is_correct = 1");
        $correctCheck->bind_param("i", $question_id);
        $correctCheck->execute();
        $correct_count = (int)$correctCheck->get_result()->fetch_assoc()['correct_count'];
        $correctCheck->close();
        if ($correct_count !== 1) {
            throw new RuntimeException("Question correct choice validation failed.");
        }
    }

    $hasOpenEndedStmt = $conn->prepare("SELECT 1 FROM quizquestions WHERE quiz_id = ? AND question_type = 'open_ended' LIMIT 1");
    $hasOpenEndedStmt->bind_param("i", $quiz_id);
    $hasOpenEndedStmt->execute();
    $has_open_ended = $hasOpenEndedStmt->get_result()->num_rows > 0 ? 1 : 0;
    $hasOpenEndedStmt->close();

    $forced_publish_marks = $has_open_ended === 1 ? 0 : $publish_marks;
    $updateOpenFlag = $conn->prepare("UPDATE quizzes SET has_open_ended = ?, publish_marks = ? WHERE id = ? AND created_by = ?");
    $updateOpenFlag->bind_param("iiis", $has_open_ended, $forced_publish_marks, $quiz_id, $email);
    if (!$updateOpenFlag->execute()) {
        throw new RuntimeException("Open-ended flag update failed: " . $updateOpenFlag->error);
    }
    $updateOpenFlag->close();

    $conn->commit();
} catch (Throwable $e) {
    $conn->rollback();
    foreach ($new_image_paths as $new_image_path) {
        $full_path = dirname(__DIR__, 2) . '/' . ltrim($new_image_path, '/\\');
        if (is_file($full_path)) {
            @unlink($full_path);
        }
    }
    error_log("Quiz edit failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'An error occurred. Please try again.']);
    exit();
}

foreach ($old_images_to_delete as $old_image_path) {
    $full_path = dirname(__DIR__, 2) . '/' . ltrim($old_image_path, '/\\');
    $root = realpath(dirname(__DIR__, 2));
    $real = realpath($full_path);
    if ($real && $root && strpos($real, $root) === 0 && is_file($real)) {
        @unlink($real);
    }
}

echo json_encode(['status' => 'success', 'data' => ['updated' => true]]);
