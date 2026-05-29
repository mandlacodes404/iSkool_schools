<?php
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
include("config.php");

require 'vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once 'push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    http_response_code(401);
    echo json_encode(["status" => "error", "success" => false, "message" => "Unauthorized access. Please log in as a teacher."]);
    ob_end_flush();
    exit;
}

$email = $_SESSION['email'];
$teacherDisplayName = 'Teacher';

$userStmt = $conn->prepare("SELECT title, name, surname FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $email);
$userStmt->execute();
$userData = $userStmt->get_result()->fetch_assoc();
$userStmt->close();

if ($userData) {
    $firstInitial       = !empty($userData['name']) ? strtoupper(substr(trim($userData['name']), 0, 1)) . '.' : '';
    $teacherDisplayName = trim($userData['title'] . ' ' . $firstInitial . ' ' . $userData['surname']);
}

function validate_quiz_image_upload(array $files, int $index): array {
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

function normalize_fitb_list($value): array {
    $items = is_array($value) ? $value : [];
    $clean = [];
    foreach ($items as $item) {
        $item = trim((string)$item);
        if ($item !== '' && !in_array($item, $clean, true)) {
            $clean[] = $item;
        }
    }
    return $clean;
}

function count_fitb_blanks(string $text): int {
    preg_match_all('/\{blank\}/i', $text, $matches);
    return count($matches[0]);
}

// ==================== AUTOMATIC ACADEMIC YEAR DETECTION ====================
$current_academic_year_id = null;
$yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearStmt->execute();
$result = $yearStmt->get_result();
if ($result && $row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}
$yearStmt->close();
if (!$current_academic_year_id) {
    die("No active academic year found. Please contact your admin.");
}

// ==================== GET CURRENT GLOBAL TERM ====================
$current_global_term = 4; 
$termStmt = $conn->prepare("SELECT current_global_term FROM platform_settings LIMIT 1");
$termStmt->execute();
$result = $termStmt->get_result();
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}
$termStmt->close();

// Fetch classes 
$stmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$stmt->execute();
$classResult = $stmt->get_result();

// School name
$schoolNameStmt = $conn->prepare("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
$schoolNameStmt->execute();
$schoolNameResult = $schoolNameStmt->get_result();
$schoolName = ($schoolNameResult && $row = $schoolNameResult->fetch_assoc())
    ? $row['setting_value']
    : $_SERVER['HTTP_HOST'];
$schoolNameStmt->close();

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    verify_csrf_token();

    $quiz_title     = trim($_POST['quiz_title'] ?? '');
    $duration_raw   = $_POST['duration'] ?? null;
    $duration_check = filter_var($duration_raw, FILTER_VALIDATE_INT);
    $duration       = $duration_check === false ? -1 : (int)$duration_check;
    $class_id       = intval($_POST['class_id'] ?? 0);
    $publish_marks  = isset($_POST['publish_marks']) ? 1 : 0;
    $start_time     = $_POST['start_time'] ?? '';
    $status = $_POST['status'] ?? 'Scheduled'; 
    $is_summative   = isset($_POST['is_summative']) ? 1 : 0;
    $weight_raw     = $_POST['weight_percent'] ?? null;
    $weight_check   = $is_summative && $weight_raw !== null && $weight_raw !== '' ? filter_var($weight_raw, FILTER_VALIDATE_FLOAT) : null;
    $weight_percent = $weight_check === false ? -1 : $weight_check;
    $attempt_raw    = $_POST['attempt_limit'] ?? 0;
    $attempt_check  = filter_var($attempt_raw, FILTER_VALIDATE_INT);
    $attempt_limit  = $attempt_check === false ? -1 : (int)$attempt_check;
    $layout_mode = $_POST['layout_mode'] ?? 'single_page';
    $shuffle_questions = isset($_POST['shuffle_questions']) ? 1 : 0; 
    $is_linear = isset($_POST['is_linear']) ? 1 : 0;
    $question_types = $_POST['question_type'] ?? [];
    $has_open_ended = 0;

    // Validation
    $errors = [];
    if (empty($quiz_title)) $errors[] = "Quiz title is required.";
    if (strlen($quiz_title) > 255) $errors[] = "Quiz title must be 255 characters or fewer.";
    if (!in_array($status, ['Scheduled', 'Open', 'Closed'], true)) $errors[] = "Invalid quiz status.";
    if (!in_array($layout_mode, ['single_page', 'multi_page'], true)) $errors[] = "Invalid quiz layout.";
    if ($duration < 0 || $duration > 180) $errors[] = "Duration must be between 0 and 180 minutes.";
    if ($attempt_limit < 0) $errors[] = "Attempt limit must be zero or greater.";
    if ($class_id < 1) $errors[] = "Invalid class selected.";
    if (empty($start_time) || !strtotime($start_time)) $errors[] = "Valid start time is required.";
    if ($is_summative && ($weight_raw === null || $weight_raw === '')) $errors[] = "Weight percent must be between 0 and 100.";
    if ($weight_percent !== null && ($weight_percent < 0 || $weight_percent > 100)) $errors[] = "Weight percent must be between 0 and 100.";

    $questions = $_POST['question'] ?? [];
    if (empty($questions) || !is_array($questions)) {
        $errors[] = "At least one question is required.";
    } else {
        foreach ($questions as $i => $qText) {
            $questionText = trim((string)$qText);
            $questionType = $question_types[$i] ?? 'mcq';
            $choiceValues = $_POST['choices'][$i] ?? [];
            $nonEmptyChoices = array_values(array_filter(array_map('trim', (array)$choiceValues), fn($choice) => $choice !== ''));
            $correctCheck = isset($_POST['correct_choice'][$i]) ? filter_var($_POST['correct_choice'][$i], FILTER_VALIDATE_INT) : false;
            $correctIndex = $correctCheck === false ? -1 : (int)$correctCheck;
            $pointsCheck = isset($_POST['points'][$i]) ? filter_var($_POST['points'][$i], FILTER_VALIDATE_INT) : false;
            $points = $pointsCheck === false ? 0 : (int)$pointsCheck;

            if (!in_array($questionType, ['mcq', 'open_ended', 'fill_in_blank'], true)) $errors[] = "Question " . ($i + 1) . " has an invalid question type.";
            if ($questionText === '') $errors[] = "Question " . ($i + 1) . " text is required.";
            if ($questionType === 'open_ended') {
                $has_open_ended = 1;
                if (count($nonEmptyChoices) > 0) $errors[] = "Question " . ($i + 1) . " is open-ended and must not have choices.";
            } elseif ($questionType === 'fill_in_blank') {
                if (count($nonEmptyChoices) > 0) $errors[] = "Question " . ($i + 1) . " is fill in the blank and must not have choices.";
                $blankCount = count_fitb_blanks($questionText);
                if ($blankCount < 1) $errors[] = "Question " . ($i + 1) . " must include at least one {blank} marker.";
                $subType = $_POST['fitb_sub_type'][$i] ?? 'free_type';
                $scoringMode = $_POST['fitb_scoring_mode'][$i] ?? 'partial';
                if (!in_array($subType, ['free_type', 'word_bank'], true)) $errors[] = "Question " . ($i + 1) . " has an invalid fill in the blank sub-type.";
                if (!in_array($scoringMode, ['partial', 'all_or_nothing'], true)) $errors[] = "Question " . ($i + 1) . " has an invalid fill in the blank scoring mode.";
                for ($blankIndex = 1; $blankIndex <= $blankCount; $blankIndex++) {
                    $answers = normalize_fitb_list($_POST['fitb_accepted_answers'][$i][$blankIndex] ?? []);
                    if (count($answers) < 1) $errors[] = "Question " . ($i + 1) . ", blank {$blankIndex} needs at least one accepted answer.";
                }
                if ($subType === 'word_bank') {
                    $distractors = normalize_fitb_list($_POST['fitb_distractors'][$i] ?? []);
                    if (count($distractors) < 2) $errors[] = "Question " . ($i + 1) . " word bank needs at least two distractor words.";
                }
            } else {
                if (count($nonEmptyChoices) < 2) $errors[] = "Question " . ($i + 1) . " must have at least two choices.";
                if ($correctIndex < 0 || !isset($choiceValues[$correctIndex]) || trim((string)$choiceValues[$correctIndex]) === '') {
                    $errors[] = "Question " . ($i + 1) . " must have exactly one valid correct choice.";
                }
            }
            if ($points <= 0) $errors[] = "Question " . ($i + 1) . " points must be greater than zero.";
        }
    }

    $classOwnerStmt = $conn->prepare("SELECT 1 FROM teacher_subjects WHERE teacher_email = ? AND class_id = ? LIMIT 1");
    $classOwnerStmt->bind_param("si", $email, $class_id);
    $classOwnerStmt->execute();
    $ownsClass = $classOwnerStmt->get_result()->num_rows > 0;
    $classOwnerStmt->close();
    if (!$ownsClass) $errors[] = "You are not assigned to this class.";

    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(["status" => "error", "success" => false, "message" => implode(" ", $errors)]);
        ob_end_flush();
        exit;
    }

    if ($has_open_ended === 1) {
        $publish_marks = 0;
    }

    $validatedImages = [];
    foreach ($_FILES['question_images']['name'] ?? [] as $i => $unused) {
        if ($_FILES['question_images']['error'][$i] === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($_FILES['question_images']['error'][$i] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(["status" => "error", "success" => false, "message" => "Image upload failed."]);
            ob_end_flush();
            exit;
        }

        $imageValidation = validate_quiz_image_upload($_FILES['question_images'], $i);
        if (!$imageValidation['valid']) {
            http_response_code(400);
            echo json_encode(["status" => "error", "success" => false, "message" => $imageValidation['message']]);
            ob_end_flush();
            exit;
        }
        $validatedImages[$i] = $imageValidation['safe_name'];
    }
try {
    $conn->begin_transaction();

    $stmt = $conn->prepare("
        INSERT INTO quizzes 
        (title, duration, publish_marks, created_by, class_id, academic_year_id, term_number, attempt_limit, start_time, status, is_summative, weight_percent, layout_mode, shuffle_questions, is_linear, has_open_ended) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("siisiiiissidsiii",
        $quiz_title,
        $duration,
        $publish_marks,
        $email,
        $class_id,
        $current_academic_year_id,
        $current_global_term,
        $attempt_limit,
        $start_time,
        $status,
        $is_summative,
        $weight_percent,
        $layout_mode,
        $shuffle_questions,
        $is_linear,
        $has_open_ended
    );

    if (!$stmt->execute()) {
        throw new RuntimeException("Quiz insert failed: " . $stmt->error);
    }

    $quiz_id = $stmt->insert_id;
    $stmt->close();

    $qStmt = $conn->prepare("INSERT INTO quizquestions (quiz_id, question_text, image_path, points, question_type) VALUES (?, ?, ?, ?, ?)");
    $cStmt = $conn->prepare("INSERT INTO choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)");
    $fitbQuestionStmt = $conn->prepare("INSERT INTO fitb_questions (question_id, sub_type, scoring_mode, distractors_json) VALUES (?, ?, ?, ?)");
    $fitbBlankStmt = $conn->prepare("INSERT INTO fitb_blanks (question_id, blank_index, accepted_answers_json, case_sensitive) VALUES (?, ?, ?, ?)");

    $targetDir = "quiz_images/";
    if (!file_exists($targetDir) && !mkdir($targetDir, 0755, true)) {
        throw new RuntimeException("Failed to create quiz image directory.");
    }

    foreach ($_POST['question'] as $i => $qText) {
        $points = intval($_POST['points'][$i]);
        $questionType = $question_types[$i] ?? 'mcq';
        $choices = array_map('trim', $_POST['choices'][$i] ?? []);
        $correct = intval($_POST['correct_choice'][$i] ?? 0);
        $imagePath = null;

        if (isset($_FILES['question_images']['name'][$i]) && $_FILES['question_images']['error'][$i] === UPLOAD_ERR_OK) {
            $filename = time() . "_" . $i . "_" . $validatedImages[$i];
            $targetFile = $targetDir . $filename;
            if (!move_uploaded_file($_FILES['question_images']['tmp_name'][$i], $targetFile)) {
                throw new RuntimeException("Image move failed for question " . ($i + 1));
            }
            $imagePath = $targetFile;
        }

        $qStmt->bind_param("issis", $quiz_id, $qText, $imagePath, $points, $questionType);
        if (!$qStmt->execute()) {
            throw new RuntimeException("Question insert failed: " . $qStmt->error);
        }
        $question_id = $qStmt->insert_id;

        if ($questionType === 'open_ended') {
            continue;
        }

        if ($questionType === 'fill_in_blank') {
            $subType = $_POST['fitb_sub_type'][$i] ?? 'free_type';
            $scoringMode = $_POST['fitb_scoring_mode'][$i] ?? 'partial';
            $distractors = $subType === 'word_bank' ? normalize_fitb_list($_POST['fitb_distractors'][$i] ?? []) : [];
            $distractorsJson = json_encode($distractors);
            $fitbQuestionStmt->bind_param("isss", $question_id, $subType, $scoringMode, $distractorsJson);
            if (!$fitbQuestionStmt->execute()) {
                throw new RuntimeException("FITB question insert failed: " . $fitbQuestionStmt->error);
            }

            $blankCount = count_fitb_blanks((string)$qText);
            for ($blankIndex = 1; $blankIndex <= $blankCount; $blankIndex++) {
                $answers = normalize_fitb_list($_POST['fitb_accepted_answers'][$i][$blankIndex] ?? []);
                $answersJson = json_encode($answers);
                $caseSensitive = isset($_POST['fitb_case_sensitive'][$i][$blankIndex]) ? 1 : 0;
                $fitbBlankStmt->bind_param("iisi", $question_id, $blankIndex, $answersJson, $caseSensitive);
                if (!$fitbBlankStmt->execute()) {
                    throw new RuntimeException("FITB blank insert failed: " . $fitbBlankStmt->error);
                }
            }
            continue;
        }

        foreach ($choices as $index => $choiceText) {
            if (empty($choiceText)) continue;
            $isCorrect = ($index == $correct) ? 1 : 0;
            $cStmt->bind_param("isi", $question_id, $choiceText, $isCorrect);
            if (!$cStmt->execute()) {
                throw new RuntimeException("Choice insert failed: " . $cStmt->error);
            }
        }
    }
    $qStmt->close();
    $cStmt->close();
    $fitbQuestionStmt->close();
    $fitbBlankStmt->close();
    $conn->commit();
} catch (Throwable $e) {
    $conn->rollback();
    error_log("Quiz creation failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "success" => false, "message" => "An error occurred. Please try again."]);
    exit;
}

    // --- SMART NOTIFICATION LOGIC ---
    $force_email = isset($_POST['force_email']) ? true : false;

$cleanBaseUrl = rtrim(BASE_URL, '/');
$quizLink = $cleanBaseUrl . "/learner_dashboard.php?page=quiz_detail&id=" . $quiz_id;

    $learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, u.name 
    FROM users u 
    JOIN class_students cs ON u.email = cs.student_email 
    WHERE cs.class_id = ? 
    AND cs.academic_year_id = ?
    AND u.role = 'learner'
");
$learnersQuery->bind_param("ii", $class_id, $current_academic_year_id);
    $learnersQuery->execute();
    $result = $learnersQuery->get_result();

    while ($learner = $result->fetch_assoc()) {
        $currentEmail = $learner['email'];
        $isPushSent = false;

        $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
        $checkSub->bind_param("s", $currentEmail);
        $checkSub->execute();
if ($checkSub->get_result()->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "📝 New Quiz: " . $quiz_title, 
        "Status: " . $status,
        $quizLink,
        $schoolName,
        'https://iskool.online/assets/icons/quiz.png'
    );
}
        $checkSub->close();

        if (!$isPushSent || $force_email) {
            try {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host = getenv('SMTP_HOST');
                $mail->SMTPAuth = true;
                $mail->Username = getenv('SMTP_USER');
                $mail->Password = getenv('SMTP_PASSWORD');
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                $mail->Port = getenv('SMTP_PORT');
                $from_email = getenv('SMTP_FROM');
                $mail->setFrom($from_email, $schoolName);
                $mail->addAddress($currentEmail);
                $mail->isHTML(true);
                $mail->Subject = 'New Quiz: ' . $quiz_title;
              $mail->Body = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td style="padding:48px 32px 40px;">
  <p style="margin:0 0 28px;font-size:13px;font-weight:700;color:#cc1f1f;letter-spacing:0.8px;text-transform:uppercase;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($schoolName) . '</p>
  <p style="margin:0 0 20px;font-size:28px;font-weight:700;color:#0d0d0d;line-height:1.25;letter-spacing:-0.5px;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">New quiz: ' . htmlspecialchars($quiz_title) . '</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>
  <p style="margin:0 0 28px;font-size:16px;color:#2d2d2d;line-height:1.8;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Hi <strong>' . htmlspecialchars($learner['name']) . '</strong>, a new quiz has been posted in your class.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#888888;width:120px;vertical-align:top;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Status</td>
      <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:600;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($status) . '</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#888888;vertical-align:top;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Duration</td>
      <td style="padding:8px 0;font-size:14px;color:#0d0d0d;font-weight:600;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">' . htmlspecialchars($duration) . ' minutes</td>
    </tr>
  </table>
  <p style="margin:0 0 40px;font-size:14px;color:#888888;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">Posted by <span style="color:#0d0d0d;font-weight:600;">' . htmlspecialchars($teacherDisplayName) . '</span></p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="border-top:1px solid #e5e5e5;"></td></tr></table>
  <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;">
    ' . htmlspecialchars($schoolName) . ' &nbsp;&middot;&nbsp; Powered by <a href="https://iskool.online" style="color:#aaaaaa;text-decoration:underline;">iSkool</a>
  </p>
</td></tr>
</table>
</body>
</html>';
            $mail->send();
            } catch (Exception $e) {
                error_log("Email failed for $currentEmail: " . $mail->ErrorInfo);
            }
        }
    }
    $learnersQuery->close();
    

    ob_end_clean();
    echo json_encode(["status" => "success", "success" => true, "data" => ["redirect" => "teacher_quizzes.php"], "redirect" => "teacher_quizzes.php"]);
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Create Quiz</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<style>
body {
  font-family: 'Inter', Arial, sans-serif;
  background-color: #0d1117;
  color: #e0e6f0;
  margin: 30px auto;
  max-width: 900px;
  line-height: 1.6;
  padding: 0 20px 50px;
}
h1 {
  font-weight: 700;
  font-size: 2.4rem;
  margin-bottom: 30px;
  color: #e0e6f0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
label {
  display: block;
  margin-top: 18px;
  font-weight: 600;
  color: #8b949e;
  user-select: none;
}
input[type="text"], input[type="number"], select, input[type="file"], input[type="datetime-local"] {
  width: 100%;
  padding: 12px 14px;
  margin-top: 8px;
  background-color: #1a202c;
  border: 1.5px solid #30363d;
  border-radius: 8px;
  font-size: 1rem;
  color: #e0e6f0;
  transition: border-color 0.2s ease;
}
input[type="text"]::placeholder, input[type="number"]::placeholder {
  color: #8b949e;
}
input[type="text"]:focus, input[type="number"]:focus, select:focus, input[type="file"]:focus, input[type="datetime-local"]:focus {
  outline: none;
  border-color: #4fd1c5;
  box-shadow: 0 0 6px rgba(79, 209, 197, 0.5);
  background-color: #21262d;
}
/* FIX 9: Inline validation error highlight */
.validation-error {
  border: 2px solid #f85149 !important;
  box-shadow: 0 0 6px rgba(248, 81, 73, 0.4) !important;
}
.question-block.has-error {
  border: 2px solid #f85149 !important;
  box-shadow: 0 0 12px rgba(248, 81, 73, 0.25) !important;
}
.field-error-msg {
  color: #f85149;
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.question-block {
  background: #1a202c;
  padding: 25px 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  margin-bottom: 28px;
  position: relative;
  border: 2px solid transparent;
  transition: border-color 0.2s ease;
}
.question-block h3 {
  margin: 0;
  font-weight: 700;
  font-size: 1.3rem;
  color: #4fd1c5;
  user-select: none;
  display: inline-block;
}
.question-block .points-display {
  font-weight: 600;
  color: #4fd1c5;
}
.question-block button.delete-btn {
  position: absolute;
  top: 22px;
  right: 25px;
  background-color: #f85149;
  color: #e0e6f0;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}
.question-block button.delete-btn:hover {
  background-color: #da3633;
}
.question-block input[type="text"] {
  margin-top: 10px;
}
.question-block select {
  margin-top: 12px;
  max-width: 180px;
}
.question-block input[type="number"] {
  max-width: 100px;
}
.add-btn, .submit-btn {
  width: 100%;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  padding: 16px 0;
  font-size: 1.15rem;
  cursor: pointer;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  user-select: none;
}
.add-btn {
  background-color: #238636;
  color: #e0e6f0;
  margin-bottom: 20px;
}
.add-btn:hover {
  background-color: #2ea043;
  box-shadow: 0 0 8px rgba(35, 134, 54, 0.5);
}
.submit-btn {
  background-color: #4fd1c5;
  color: #0d1117;
}
.submit-btn:hover {
  background-color: #1ed760;
  box-shadow: 0 0 8px rgba(79, 209, 197, 0.5);
}
.checkbox-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 25px;
  margin-bottom: 30px;
  font-weight: 600;
  color: #8b949e;
  user-select: none;
}
.checkbox-container input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4fd1c5;
}
#loaderOverlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(13, 17, 23, 0.85);
  display: none;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 9999;
}
.loader {
  border: 6px solid #f3f3f3;
  border-top: 6px solid #4fd1c5;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 1s linear infinite;
  margin-top: 12px;
}
.loader-text {
  color: #e0e6f0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.popup {
  display: none;
  position: fixed;
  top: 20px;
  right: 20px;
  background: #1a202c;
  color: #e0e6f0;
  padding: 16px 22px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-left: 5px solid #4fd1c5;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.4s ease-in-out;
  z-index: 9999;
}
.popup.show {
  display: block;
  opacity: 1;
  transform: translateY(0);
}

/* Mode Card Styling */
.layout-options {
    display: flex;
    gap: 15px;
    margin-top: 10px;
}
.mode-card {
    flex: 1;
    background: #1a202c;
    border: 2px solid #30363d;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
}
.mode-card i {
    display: block;
    font-size: 20px;
    margin-bottom: 8px;
    color: #8b949e;
}
input[type="radio"]:checked + .mode-card {
    border-color: #4fd1c5;
    background: rgba(79, 209, 197, 0.1);
}
input[type="radio"]:checked + .mode-card i {
    color: #4fd1c5;
}
.info-trigger {
    color: #4fd1c5;
    cursor: pointer;
    font-size: 0.9rem;
    margin-left: 5px;
}
/* Modal for Information */
#layoutModal {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85);
    z-index: 10000;
    justify-content: center;
    align-items: center;
}
.modal-content {
    background: #1a202c;
    padding: 30px;
    border-radius: 15px;
    max-width: 450px;
    border: 1px solid #4fd1c5;
}
.layout-options label {
    cursor: pointer;
}
input[type="radio"]:checked + .mode-card {
    border-color: #4fd1c5 !important;
    background: rgba(79, 209, 197, 0.1) !important;
    box-shadow: 0 0 10px rgba(79, 209, 197, 0.2);
}
input[type="radio"]:checked + .mode-card i {
    color: #4fd1c5 !important;
}

/* FIX 1 & 2: Question type helper text */
.qtype-helper {
  margin-top: 8px;
  padding: 10px 14px;
  background: rgba(79, 209, 197, 0.07);
  border-left: 3px solid #4fd1c5;
  border-radius: 0 8px 8px 0;
  font-size: 13px;
  color: #a0aec0;
  line-height: 1.5;
  display: none;
}
.qtype-helper.visible {
  display: block;
}
/* FIX 2: FITB callout */
.fitb-callout {
  display: none;
  background: rgba(79, 209, 197, 0.08);
  border: 1px solid rgba(79, 209, 197, 0.35);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #a0aec0;
  line-height: 1.6;
}
.fitb-callout.visible {
  display: block;
}
.fitb-callout code {
  background: rgba(79,209,197,0.15);
  color: #4fd1c5;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
.fitb-insert-btn {
  display: inline-block;
  margin-top: 6px;
  background: rgba(79, 209, 197, 0.15);
  color: #4fd1c5;
  border: 1px solid rgba(79, 209, 197, 0.4);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.fitb-insert-btn:hover {
  background: rgba(79, 209, 197, 0.25);
}
/* FIX 2: Blank counter badge */
.fitb-blank-counter {
  display: none;
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
}
.fitb-blank-counter.visible {
  display: block;
}
.fitb-blank-counter .blank-count {
  color: #4fd1c5;
  font-weight: 700;
}

/* FIX 3: Sticky summary bar */
#quiz-summary-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  font-size: 14px;
  font-weight: 600;
  color: #4fd1c5;
  margin: -30px -20px 20px;
  letter-spacing: 0.3px;
}
#quiz-summary-bar span {
  display: flex;
  align-items: center;
  gap: 6px;
}
#quiz-summary-bar .sep {
  color: #30363d;
  font-weight: 300;
  font-size: 18px;
}

/* FIX 4: Start time field greyed out when status = Open */
#start_time_wrapper.greyed {
  opacity: 0.45;
  pointer-events: none;
}
#start_time_ignored_msg {
  display: none;
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
  font-style: italic;
}
#start_time_ignored_msg.visible {
  display: block;
}
#start_time_helper {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
}

/* FIX 5: Attempt limit helper */
.field-helper {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
}

/* FIX 7: Force email styles */
.force-email-wrapper {
  background: #1a202c;
  padding: 15px;
  border-radius: 10px;
  border: 1px solid #30363d;
  margin: 20px 0;
}
.force-email-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: #4fd1c5;
  font-weight: 600;
  font-size: 15px;
  margin: 0;
}
.force-email-label input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #4fd1c5;
  flex-shrink: 0;
}
.force-email-helper {
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
  padding-left: 32px;
}

/* Question type select width */
.qtype-select-wrap {
  position: relative;
}
.qtype-select-wrap select {
  max-width: 220px;
}
</style>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>

<!-- FIX 3: Sticky summary bar -->
<div id="quiz-summary-bar">
  <span><i class="fas fa-list-ol"></i> <span id="summary-q-count">1</span> question<span id="summary-q-plural"></span></span>
  <span class="sep">|</span>
  <span><i class="fas fa-star"></i> <span id="summary-marks">1</span> mark<span id="summary-m-plural"></span> total</span>
</div>

  <h1><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg> Create a New Quiz</h1>
  <form id="quizForm" action="create_quiz.php" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <label>Quiz Title:</label>
    <input type="text" name="quiz_title" required aria-label="Quiz title">

    <label>Assign to Class:</label>
    <select name="class_id" required aria-label="Select class">
      <?php while ($class = $classResult->fetch_assoc()): ?>
        <option value="<?= htmlspecialchars($class['id']) ?>">
          <?= htmlspecialchars($class['name']) ?><?= !empty($class['subject']) ? ' (' . htmlspecialchars($class['subject']) . ')' : '' ?>
        </option>
      <?php endwhile; ?>
    </select>

    <label>Quiz Duration (in minutes):</label>
    <input type="number" name="duration" min="1" max="180" required aria-label="Quiz duration in minutes">

    <!-- FIX 8: Start time with default value and helper text -->
    <div id="start_time_wrapper">
      <label>Start Time (when quiz should become available):</label>
      <input type="datetime-local" name="start_time" id="start_time" required aria-label="Quiz start time">
      <span id="start_time_helper">You can change this — learners won't see the quiz until this time.</span>
      <span id="start_time_ignored_msg"><i class="fas fa-info-circle"></i> Start time is ignored when quiz is set to Open.</span>
    </div>

    <!-- FIX 4: Status with clearer labels and conditional UI -->
    <label>Quiz Status:</label>
    <select name="status" id="quizStatus" required>
      <option value="Scheduled">Opens automatically at start time</option>
      <option value="Open">Open (Available immediately)</option>
      <option value="Closed">Closed (Not accessible)</option>
    </select>

    <!-- FIX 5: Attempt limit field with helper text -->
    <label>Attempt Limit:</label>
    <input type="number" name="attempt_limit" id="attempt_limit" min="0" value="0" placeholder="0 = unlimited" style="max-width:160px;" aria-label="Attempt limit">
    <span class="field-helper">How many times can a learner attempt this quiz? Enter <strong style="color:#4fd1c5;">0</strong> for unlimited.</span>

    <div class="checkbox-container">
      <input type="checkbox" name="publish_marks" value="1" id="publishMarksCheckbox" />
      <label for="publishMarksCheckbox">Publish marks immediately <i class="fas fa-poll"></i></label>
    </div>
    <div id="publishMarksOpenMessage" style="display:none;background:rgba(242,140,56,0.08);border:1px solid rgba(242,140,56,0.28);border-radius:10px;color:#f5c38b;font-size:13px;line-height:1.5;padding:12px;margin:20px 0 30px;">
      Marks cannot be auto-released when the quiz contains open-ended questions. You must grade all responses manually before releasing marks.
    </div>

    <div class="checkbox-container" style="margin-top: 20px;">
  <input type="checkbox" name="is_summative" value="1" id="isSummativeCheckbox" />
  <label for="isSummativeCheckbox">Counts toward official term mark (Verified)</label>
</div>

    <!-- FIX 7: Shortened force email label with helper text -->
    <div class="force-email-wrapper">
      <label class="force-email-label">
        <input type="checkbox" name="force_email" value="1">
        Also send email notifications
      </label>
      <p class="force-email-helper">Mobile push notifications are sent automatically. Email is optional and uses more server resources.</p>
    </div>

  <div style="background:#1a202c; padding:18px; border-radius:10px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
       </div>

<div id="weightContainer" style="margin-top: 12px; display: none; background: #1a202c; padding: 16px; border-radius: 8px; border: 1px solid #30363d;">
  <label for="weight_percent">Weight % of term mark (e.g., 40 for 40%)</label>
  <input type="number" name="weight_percent" id="weight_percent" min="0" max="100" step="0.1" placeholder="Optional – leave blank for equal weight" style="max-width: 200px;" />
  <small style="color: #8b949e; display: block; margin-top: 6px;">Only used if "Counts toward term mark" is checked.</small>
</div>

<div style="margin-bottom: 30px;">
    <label style="display: flex; align-items: center;">
        Quiz Layout Mode 
        <i class="fas fa-info-circle info-trigger" onclick="document.getElementById('layoutModal').style.display='flex'"></i>
    </label>
    
    <div class="layout-options">
        <label style="flex: 1;">
            <input type="radio" name="layout_mode" value="single_page" checked style="display:none;">
            <div class="mode-card">
                <i class="fas fa-file-alt"></i>
                <strong>Single Page</strong>
            </div>
        </label>
        
        <label style="flex: 1;">
            <input type="radio" name="layout_mode" value="multi_page" style="display:none;">
            <div class="mode-card">
                <i class="fas fa-layer-group"></i>
                <strong>Multi-Page</strong>
            </div>
        </label>
    </div>
</div>

<div id="multiPageOptions" style="display: none; margin-top: 15px; background: rgba(79, 209, 197, 0.05); padding: 15px; border-radius: 8px; border: 1px dashed #4fd1c5;">
    <h4 style="margin-top:0; color:#4fd1c5; font-size:0.9rem; text-transform:uppercase;">Multi-Page Security Settings</h4>
    
    <div class="checkbox-container" style="margin: 0 0 10px 0;">
        <input type="checkbox" name="shuffle_questions" value="1" id="shuffleCheckbox" />
        <label for="shuffleCheckbox" style="margin-top:0; color: #e0e6f0;">
            Shuffle Questions <i class="fas fa-random" style="margin-left:5px;"></i>
            <br><small style="color: #8b949e; font-weight: normal;">Every student gets questions in a different order.</small>
        </label>
    </div>

    <div class="checkbox-container" style="margin: 0;">
        <input type="checkbox" name="is_linear" value="1" id="linearCheckbox" />
        <label for="linearCheckbox" style="margin-top:0; color: #e0e6f0;">
            Linear Progression (No going back) 
            <i class="fas fa-info-circle" style="color:#4fd1c5; cursor:pointer;" onclick="document.getElementById('linearModal').style.display='flex'"></i>
            <br><small style="color: #8b949e; font-weight: normal;">Learners must answer the current question to move forward and <b>cannot return</b> to previous questions.</small>
        </label>
    </div>
</div>

<div id="linearModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10001; justify-content:center; align-items:center;" onclick="this.style.display='none'">
    <div class="modal-content" style="background:#1a202c; padding:25px; border-radius:15px; max-width:400px; border:1px solid #4fd1c5;" onclick="event.stopPropagation()">
        <h3 style="color:#4fd1c5; margin-top:0;"><i class="fas fa-shield-alt"></i> Production-Grade Integrity</h3>
        <p style="color:#e0e6f0; line-height:1.6;">Linear progression is used by platforms like <b>Canvas</b> and <b>Moodle</b> to stop cheating.</p>
        <ul style="color:#8b949e; font-size:0.9rem; text-align:left;">
            <li>Prevents students from taking photos of the whole quiz and sharing them.</li>
            <li>Stops students from skipping hard questions to find answers later in the quiz.</li>
            <li>Forces focus on one problem at a time.</li>
        </ul>
        <button type="button" class="submit-btn" onclick="document.getElementById('linearModal').style.display='none'">I'll use this for security</button>
    </div>
</div>

    <div id="questions-container">
      <div class="question-block">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3>Question 1</h3>
          <span class="points-display">1 pt</span>
        </div>

        <!-- FIX 1: Question type with description helper -->
        <label>Question Type:</label>
        <div class="qtype-select-wrap">
          <select name="question_type[]" class="qtype-select" aria-label="Question type for question 1">
            <option value="mcq">Multiple Choice</option>
            <option value="open_ended">Open Ended</option>
            <option value="fill_in_blank">Fill in the Blank</option>
          </select>
        </div>
        <div class="qtype-helper mcq-helper visible">Students choose the correct answer from a list of options you provide.</div>
        <div class="qtype-helper oe-helper">Students write a free-text response. You will grade these manually.</div>
        <div class="qtype-helper fitb-helper">Students type answers into blanks. Write <code style="background:rgba(79,209,197,0.15);color:#4fd1c5;padding:1px 6px;border-radius:4px;font-family:monospace;">{blank}</code> in your question where you want a gap.</div>

        <!-- FIX 2: FITB callout shown when fill_in_blank selected -->
        <div class="fitb-callout">
          <strong style="color:#4fd1c5;"><i class="fas fa-lightbulb"></i> Fill in the Blank instructions</strong><br>
          Type your question and use <code>{blank}</code> where you want a gap.<br>
          <em>Example: The capital of France is {blank}.</em><br>
          <button type="button" class="fitb-insert-btn" onclick="insertBlankTag(this)">+ Insert {blank} at cursor</button>
        </div>

        <input type="text" name="question[]" placeholder="Enter question text" required aria-label="Question 1 text" class="question-text-input">

        <!-- FIX 2: Live blank counter -->
        <div class="fitb-blank-counter"><span class="blank-count">0</span> blank<span class="blank-count-plural">s</span> detected → <span class="blank-count">0</span> answer<span class="blank-count-plural">s</span> required</div>

        <label>Optional Image:</label>
        <input type="file" name="question_images[]" accept="image/*" aria-label="Upload image for question 1">

        <!-- MCQ choices section -->
        <div class="mcq-choices-section">
          <label>Choices:</label>
          <input type="text" name="choices[0][]" placeholder="Choice 1" required aria-label="Choice 1 for question 1" class="choice-input">
          <input type="text" name="choices[0][]" placeholder="Choice 2" required aria-label="Choice 2 for question 1" class="choice-input">
          <input type="text" name="choices[0][]" placeholder="Choice 3" aria-label="Choice 3 for question 1" class="choice-input">
          <input type="text" name="choices[0][]" placeholder="Choice 4" aria-label="Choice 4 for question 1" class="choice-input">
          <!-- FIX 6: Correct choice mirrors typed text -->
          <label>Correct Choice:</label>
          <select name="correct_choice[]" class="correct-choice-select" aria-label="Correct choice for question 1">
            <option value="0">Choice 1</option>
            <option value="1">Choice 2</option>
            <option value="2">Choice 3</option>
            <option value="3">Choice 4</option>
          </select>
        </div>

        <label>Points for this question:</label>
        <input type="number" name="points[]" min="1" value="1" required aria-label="Points for question 1" class="points-input">
      </div>
    </div>

    <button type="button" class="add-btn" onclick="addQuestion()">+ Add Another Question</button>
    <br><br>
    <button type="submit" class="submit-btn">Create Quiz</button>
  </form>

  <div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
  </div>

  <div id="successPopup" class="popup">
    <i class="fas fa-check-circle"></i> Quiz created successfully!
  </div>

<script>
let questionIndex = 1;

// ─── FIX 1 & 2: Question type descriptions + FITB callout ───
const qtypeDescriptions = {
  mcq: { selector: '.mcq-helper', showChoices: true },
  open_ended: { selector: '.oe-helper', showChoices: false },
  fill_in_blank: { selector: '.fitb-helper', showChoices: false }
};

function handleQtypeChange(block, value) {
  // Hide all helpers
  block.querySelectorAll('.qtype-helper').forEach(el => el.classList.remove('visible'));
  // Show relevant helper
  const helperClass = value === 'mcq' ? '.mcq-helper' : value === 'open_ended' ? '.oe-helper' : '.fitb-helper';
  const helper = block.querySelector(helperClass);
  if (helper) helper.classList.add('visible');

  // FITB callout
  const fitbCallout = block.querySelector('.fitb-callout');
  const fitbCounter = block.querySelector('.fitb-blank-counter');
  if (fitbCallout) fitbCallout.classList.toggle('visible', value === 'fill_in_blank');
  if (fitbCounter) fitbCounter.classList.toggle('visible', value === 'fill_in_blank');

  // MCQ choices visibility
  const choicesSection = block.querySelector('.mcq-choices-section');
  if (choicesSection) choicesSection.style.display = (value === 'mcq') ? 'block' : 'none';
}

function insertBlankTag(btn) {
  const block = btn.closest('.question-block');
  const input = block.querySelector('.question-text-input');
  if (!input) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const val = input.value;
  input.value = val.substring(0, start) + '{blank}' + val.substring(end);
  input.selectionStart = input.selectionEnd = start + 7;
  input.focus();
  updateBlankCounter(input);
}

function updateBlankCounter(input) {
  const block = input.closest('.question-block');
  if (!block) return;
  const counter = block.querySelector('.fitb-blank-counter');
  if (!counter) return;
  const matches = (input.value.match(/\{blank\}/gi) || []).length;
  const countEls = counter.querySelectorAll('.blank-count');
  countEls.forEach(el => el.textContent = matches);
  const plurals = counter.querySelectorAll('.blank-count-plural');
  plurals.forEach(el => el.textContent = matches === 1 ? '' : 's');
}

// ─── FIX 6: Mirror choice text into correct-choice select ───
function bindChoiceMirror(block) {
  const choiceInputs = block.querySelectorAll('.choice-input');
  const correctSelect = block.querySelector('.correct-choice-select');
  if (!correctSelect) return;
  choiceInputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      const opt = correctSelect.options[idx];
      if (opt) {
        opt.textContent = input.value.trim() || ('Choice ' + (idx + 1));
      }
    });
  });
}

// ─── FIX 3: Summary bar update ───
function updateSummaryBar() {
  const blocks = document.querySelectorAll('.question-block');
  const qCount = blocks.length;
  let totalMarks = 0;
  blocks.forEach(block => {
    const pts = parseInt(block.querySelector('.points-input')?.value) || 0;
    totalMarks += pts;
  });
  document.getElementById('summary-q-count').textContent = qCount;
  document.getElementById('summary-q-plural').textContent = qCount === 1 ? '' : 's';
  document.getElementById('summary-marks').textContent = totalMarks;
  document.getElementById('summary-m-plural').textContent = totalMarks === 1 ? '' : 's';
}

function addQuestion() {
  const container = document.getElementById("questions-container");
  const block = document.createElement("div");
  block.className = "question-block";
  block.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3>Question ${questionIndex + 1}</h3>
      <span class="points-display">1 pt</span>
    </div>
    <button type="button" class="delete-btn" onclick="this.closest('.question-block').remove(); updateSummaryBar(); updatePublishMarksForOpenEnded();">Delete <i class="fas fa-trash"></i></button>

    <label>Question Type:</label>
    <div class="qtype-select-wrap">
      <select name="question_type[]" class="qtype-select" aria-label="Question type for question ${questionIndex + 1}">
        <option value="mcq">Multiple Choice</option>
        <option value="open_ended">Open Ended</option>
        <option value="fill_in_blank">Fill in the Blank</option>
      </select>
    </div>
    <div class="qtype-helper mcq-helper visible">Students choose the correct answer from a list of options you provide.</div>
    <div class="qtype-helper oe-helper">Students write a free-text response. You will grade these manually.</div>
    <div class="qtype-helper fitb-helper">Students type answers into blanks. Write <code style="background:rgba(79,209,197,0.15);color:#4fd1c5;padding:1px 6px;border-radius:4px;font-family:monospace;">{blank}</code> in your question where you want a gap.</div>

    <div class="fitb-callout">
      <strong style="color:#4fd1c5;"><i class="fas fa-lightbulb"></i> Fill in the Blank instructions</strong><br>
      Type your question and use <code>{blank}</code> where you want a gap.<br>
      <em>Example: The capital of France is {blank}.</em><br>
      <button type="button" class="fitb-insert-btn" onclick="insertBlankTag(this)">+ Insert {blank} at cursor</button>
    </div>

    <input type="text" name="question[]" placeholder="Enter question text" required aria-label="Question ${questionIndex + 1} text" class="question-text-input">
    <div class="fitb-blank-counter"><span class="blank-count">0</span> blank<span class="blank-count-plural">s</span> detected → <span class="blank-count">0</span> answer<span class="blank-count-plural">s</span> required</div>

    <label>Optional Image:</label>
    <input type="file" name="question_images[]" accept="image/*" aria-label="Upload image for question ${questionIndex + 1}">

    <div class="mcq-choices-section">
      <label>Choices:</label>
      <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 1" required aria-label="Choice 1 for question ${questionIndex + 1}" class="choice-input">
      <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 2" required aria-label="Choice 2 for question ${questionIndex + 1}" class="choice-input">
      <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 3" aria-label="Choice 3 for question ${questionIndex + 1}" class="choice-input">
      <input type="text" name="choices[${questionIndex}][]" placeholder="Choice 4" aria-label="Choice 4 for question ${questionIndex + 1}" class="choice-input">
      <label>Correct Choice:</label>
      <select name="correct_choice[]" class="correct-choice-select" aria-label="Correct choice for question ${questionIndex + 1}">
        <option value="0">Choice 1</option>
        <option value="1">Choice 2</option>
        <option value="2">Choice 3</option>
        <option value="3">Choice 4</option>
      </select>
    </div>

    <label>Points for this question:</label>
    <input type="number" name="points[]" min="1" value="1" required aria-label="Points for question ${questionIndex + 1}" class="points-input">
  `;
  container.appendChild(block);

  const pointsInput = block.querySelector('.points-input');
  const pointsDisplay = block.querySelector('.points-display');
  pointsInput.addEventListener('input', () => {
    pointsDisplay.textContent = `${pointsInput.value} pt${parseInt(pointsInput.value) > 1 ? 's' : ''}`;
    updateSummaryBar();
  });

  // FIX 1 & 2: Bind qtype change
  const qtypeSelect = block.querySelector('.qtype-select');
  qtypeSelect.addEventListener('change', function() {
    handleQtypeChange(block, this.value);
    updatePublishMarksForOpenEnded();
  });

  // FIX 2: Bind blank counter
  const questionInput = block.querySelector('.question-text-input');
  questionInput.addEventListener('input', () => updateBlankCounter(questionInput));

  // FIX 6: Bind choice mirror
  bindChoiceMirror(block);

  questionIndex++;
  updateSummaryBar();
  updatePublishMarksForOpenEnded();
}

function updatePublishMarksForOpenEnded() {
  const hasOpenEnded = Array.from(document.querySelectorAll('.qtype-select'))
    .some(select => select.value === 'open_ended');
  const checkbox = document.getElementById('publishMarksCheckbox');
  const wrapper = checkbox ? checkbox.closest('.checkbox-container') : null;
  const message = document.getElementById('publishMarksOpenMessage');
  if (wrapper) wrapper.style.display = hasOpenEnded ? 'none' : 'flex';
  if (message) message.style.display = hasOpenEnded ? 'block' : 'none';
  if (hasOpenEnded && checkbox) checkbox.checked = false;
}

document.querySelectorAll('.points-input').forEach(input => {
  const pointsDisplay = input.closest('.question-block').querySelector('.points-display');
  input.addEventListener('input', () => {
    pointsDisplay.textContent = `${input.value} pt${parseInt(input.value) > 1 ? 's' : ''}`;
    updateSummaryBar();
  });
});

// ─── FIX 4: Status/start time coupling ───
function handleStatusChange(val) {
  const wrapper = document.getElementById('start_time_wrapper');
  const ignoredMsg = document.getElementById('start_time_ignored_msg');
  const helper = document.getElementById('start_time_helper');
  if (val === 'Open') {
    wrapper.classList.add('greyed');
    ignoredMsg.classList.add('visible');
    helper.style.display = 'none';
  } else {
    wrapper.classList.remove('greyed');
    ignoredMsg.classList.remove('visible');
    helper.style.display = 'block';
  }
}

// ─── FIX 9: Client-side inline validation ───
function clearValidationErrors() {
  document.querySelectorAll('.question-block.has-error').forEach(b => b.classList.remove('has-error'));
  document.querySelectorAll('.validation-error').forEach(el => el.classList.remove('validation-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

function addFieldError(field, msg) {
  field.classList.add('validation-error');
  const errDiv = document.createElement('div');
  errDiv.className = 'field-error-msg';
  errDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  field.parentNode.insertBefore(errDiv, field.nextSibling);
}

function validateBeforeSubmit() {
  clearValidationErrors();
  let firstError = null;

  const blocks = document.querySelectorAll('.question-block');
  blocks.forEach((block, idx) => {
    const qInput = block.querySelector('.question-text-input');
    const qtype = block.querySelector('.qtype-select')?.value || 'mcq';
    const ptsInput = block.querySelector('.points-input');
    let blockHasError = false;

    // Question text
    if (!qInput || qInput.value.trim() === '') {
      addFieldError(qInput, 'Question text is required.');
      blockHasError = true;
    }

    // FITB: must have at least one {blank}
    if (qtype === 'fill_in_blank' && qInput) {
      const blanks = (qInput.value.match(/\{blank\}/gi) || []).length;
      if (blanks < 1) {
        addFieldError(qInput, 'Fill in the Blank questions must contain at least one {blank}.');
        blockHasError = true;
      }
    }

    // MCQ: at least 2 choices filled, correct choice selected
    if (qtype === 'mcq') {
      const choiceInputs = block.querySelectorAll('.choice-input');
      const filled = Array.from(choiceInputs).filter(c => c.value.trim() !== '');
      if (filled.length < 2) {
        const firstChoice = choiceInputs[0];
        addFieldError(firstChoice, 'At least 2 choices are required.');
        blockHasError = true;
      }
      const correctSelect = block.querySelector('.correct-choice-select');
      if (correctSelect) {
        const selectedIdx = parseInt(correctSelect.value);
        const choiceArr = Array.from(choiceInputs);
        if (!choiceArr[selectedIdx] || choiceArr[selectedIdx].value.trim() === '') {
          addFieldError(correctSelect, 'The selected correct choice must not be empty.');
          blockHasError = true;
        }
      }
    }

    // Points > 0
    if (!ptsInput || parseInt(ptsInput.value) < 1) {
      addFieldError(ptsInput, 'Points must be at least 1.');
      blockHasError = true;
    }

    if (blockHasError) {
      block.classList.add('has-error');
      if (!firstError) firstError = block;
    }
  });

  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("#quizForm");
  const loader = document.getElementById("loaderOverlay");
  const popup = document.getElementById("successPopup");

  // FIX 8: Set start time default to now + 1 hour, rounded to nearest 15 min
  const startTimeInput = document.getElementById('start_time');
  if (startTimeInput && !startTimeInput.value) {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const mins = now.getMinutes();
    const roundedMins = Math.round(mins / 15) * 15;
    now.setMinutes(roundedMins === 60 ? 0 : roundedMins);
    if (roundedMins === 60) now.setHours(now.getHours() + 1);
    now.setSeconds(0);
    // Format as datetime-local value (YYYY-MM-DDThh:mm)
    const pad = n => String(n).padStart(2, '0');
    const formatted = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    startTimeInput.value = formatted;
  }

  // FIX 4: Status change listener
  const statusSelect = document.getElementById('quizStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', function() { handleStatusChange(this.value); });
    handleStatusChange(statusSelect.value);
  }

  // FIX 1 & 2: Bind initial question block
  const firstBlock = document.querySelector('.question-block');
  if (firstBlock) {
    const qtypeSelect = firstBlock.querySelector('.qtype-select');
    qtypeSelect.addEventListener('change', function() {
      handleQtypeChange(firstBlock, this.value);
      updatePublishMarksForOpenEnded();
    });
    const questionInput = firstBlock.querySelector('.question-text-input');
    questionInput.addEventListener('input', () => updateBlankCounter(questionInput));
    // FIX 6: Bind choice mirror on first block
    bindChoiceMirror(firstBlock);
  }

  // Init summary bar
  updateSummaryBar();

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // FIX 9: Run client-side validation first
      if (!validateBeforeSubmit()) return;

      loader.style.display = "flex";
      const formData = new FormData(form);
      if (Array.from(form.querySelectorAll('.qtype-select')).some(select => select.value === 'open_ended')) {
        formData.delete('publish_marks');
      }

      fetch("create_quiz.php", {
        method: "POST",
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: formData,
        redirect: 'manual'
      })
      .then(res => {
        if (res.type === 'opaqueredirect') {
          loader.style.display = "none";
          alert("Session expired. Please log in again.");
          window.location.href = "index.php";
          return Promise.reject(new Error('Redirect detected'));
        }
        return res.text().then(text => {
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('Non-JSON response:', text);
            throw new Error('Invalid server response');
          }
        });
      })
      .then(data => {
        loader.style.display = "none";
        if (data.success) {
          popup.classList.add("show");
          setTimeout(() => {
            popup.classList.remove("show");
            window.location.href = data.redirect || "teacher_quizzes.php";
          }, 2000);
          form.reset();
        } else {
          alert("❌ Error: " + (data.message || "Failed to create quiz."));
        }
      })
      .catch(err => {
        loader.style.display = "none";
        console.error('Fetch error:', err);
        alert("❌ Something went wrong, please try again!");
      });
    });
  }
});

// Layout radio buttons
document.querySelectorAll('input[name="layout_mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const multiPageDiv = document.getElementById('multiPageOptions');
        if (this.value === 'multi_page') {
            multiPageDiv.style.display = 'block';
        } else {
            multiPageDiv.style.display = 'none';
            document.getElementById('shuffleCheckbox').checked = false;
            document.getElementById('linearCheckbox').checked = false;
        }
    });
});
</script>

<script>
document.getElementById('isSummativeCheckbox').addEventListener('change', function() {
    const weightContainer = document.getElementById('weightContainer');
    weightContainer.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        document.getElementById('weight_percent').value = '';
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const checkbox = document.getElementById('isSummativeCheckbox');
    if (checkbox) {
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    }
    const selectedLayout = document.querySelector('input[name="layout_mode"]:checked');
    if (selectedLayout && selectedLayout.value === 'multi_page') {
        document.getElementById('multiPageOptions').style.display = 'block';
    }
});
</script>
</body>
</html>