<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$teacher_email = $_SESSION['email'];
$teacher_name  = $_SESSION['name'] ?? 'Your Teacher';

$yearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($yearResult->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year']);
    exit();
}
$current_year_id  = (int)$yearResult->fetch_assoc()['id'];
$termResult       = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$current_term     = $termResult ? (int)$termResult->fetch_assoc()['current_global_term'] : 1;

$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], ['', ' '], $dbName));

$title       = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$class_id    = (int)($_POST['class_id'] ?? 0);
$use_default = !empty($_POST['use_default']);
$forceEmail  = isset($_POST['force_email']);

if (empty($title) || $class_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Please fill in all required fields.']);
    exit();
}

// Insert evaluation
$stmt = $conn->prepare("
    INSERT INTO teacher_evaluations (title, description, class_id, created_by, academic_year_id, term_number)
    VALUES (?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("ssisii", $title, $description, $class_id, $teacher_email, $current_year_id, $current_term);
$stmt->execute();
$eval_id = $stmt->insert_id;
$stmt->close();

// Copy default statements
if ($use_default) {
    $conn->query("
        INSERT INTO evaluation_statements (evaluation_id, statement, order_num)
        SELECT $eval_id, statement, order_num 
        FROM evaluation_statements WHERE evaluation_id = 1
    ");
}

// Custom statements
if (isset($_POST['statements']) && is_array($_POST['statements'])) {
    $stmtQ = $conn->prepare("INSERT INTO evaluation_statements (evaluation_id, statement, order_num) VALUES (?, ?, ?)");
    foreach ($_POST['statements'] as $order => $stmt_text) {
        if (trim($stmt_text) !== '') {
            $stmtQ->bind_param("isi", $eval_id, $stmt_text, $order);
            $stmtQ->execute();
        }
    }
    $stmtQ->close();
}

// Notify learners
$cleanBaseUrl = rtrim(BASE_URL, '/');
$evalLink = $cleanBaseUrl . "/learner_dashboard.php?page=evaluation_list.php";
$learnersQuery = $conn->prepare("
    SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
    FROM users u
    JOIN class_students cs ON u.email = cs.student_email
    WHERE cs.class_id = ? AND cs.academic_year_id = ? AND u.role = 'learner'
");
$learnersQuery->bind_param("ii", $class_id, $current_year_id);
$learnersQuery->execute();
$learnersResult = $learnersQuery->get_result();

while ($learner = $learnersResult->fetch_assoc()) {
    $lEmail     = $learner['email'];
    $lName      = $learner['name'];
    $isPushSent = false;

    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
    $checkSub->bind_param("s", $lEmail);
    $checkSub->execute();
    if ($checkSub->get_result()->num_rows > 0) {
        $isPushSent = sendPushToUser(
            $conn, $lEmail,
            "📊 New Evaluation: " . $title,
            "Your teacher requested your feedback. Please complete the evaluation.",
            $evalLink
        );
    }
    $checkSub->close();

    if (!$isPushSent || $forceEmail) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'iskool.online';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'noreply@iskool.online';
            $mail->Password   = 'ogeQkRitRfdy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->Port       = 465;
            $mail->setFrom('noreply@iskool.online', $schoolName);
            $mail->addAddress($lEmail);
            $mail->isHTML(true);
            $mail->Subject = "New Evaluation: " . $title;
            $mail->Body    = '
            <div style="max-width:600px;margin:30px auto;font-family:Verdana,sans-serif;background:#161b22;border-radius:16px;overflow:hidden;">
                <div style="padding:30px;background:#0d1117;text-align:center;">
                    <h1 style="color:#4fd1c5;margin:0;">iSkool</h1>
                </div>
                <div style="padding:30px;color:#c9d1d9;">
                    <h2 style="color:#4fd1c5;">New Evaluation: ' . htmlspecialchars($title) . '</h2>
                    <p>Hi ' . htmlspecialchars($lName) . ',</p>
                    <p>Your teacher has released a new evaluation. Please complete it.</p>
                    <p style="text-align:center;">
                        <a href="' . $evalLink . '" style="background:#4fd1c5;color:#000;padding:14px 28px;border-radius:25px;text-decoration:none;font-weight:bold;">
                            Complete Evaluation
                        </a>
                    </p>
                </div>
                <div style="padding:20px;text-align:center;color:#8b949e;font-size:13px;">
                    Powered by iSkool &copy; ' . date("Y") . '
                </div>
            </div>';
            $mail->send();
        } catch (Exception $e) {
            error_log("Eval email failed to $lEmail: " . $mail->ErrorInfo);
        }
    }
}
$learnersQuery->close();

echo json_encode(['success' => true]);