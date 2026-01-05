<?php
session_start();
require_once 'config.php';
require_once 'push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php"); exit();
}
  require 'vendor/autoload.php';
       use PHPMailer\PHPMailer\PHPMailer;
       use PHPMailer\PHPMailer\Exception;

$learner_email = $_SESSION['email'];
$current_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1")->fetch_assoc()['id'];

$classStmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
$classStmt->bind_param("si", $learner_email, $current_year_id);
$classStmt->execute();
$class_id = $classStmt->get_result()->fetch_assoc()['class_id'] ?? null;
$classStmt->close();

if (!$class_id) die("Not enrolled in a class.");

$message = "";

// Get teachers who teach this class
$teachers = $conn->query("
    SELECT DISTINCT u.email, CONCAT(COALESCE(u.title,''), ' ', u.surname, ' (', u.name, ')') AS display_name
    FROM users u
    JOIN quizzes q ON u.email = q.created_by
    WHERE q.class_id = $class_id AND u.role = 'teacher'
    ORDER BY u.surname
")->fetch_all(MYSQLI_ASSOC);

if (empty($teachers)) {
    $message = "No teachers found for your class. Contact admin.";
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $message_text = trim($_POST['message']);
    $anonymous = !empty($_POST['anonymous']);
    $tagged_teachers = $_POST['teachers'] ?? [];

    if (empty($title) || empty($message_text) || empty($tagged_teachers)) {
        $message = "Please fill all fields and tag at least one teacher.";
    } else {
        // Get learner's full name from session
        $learner_name = $_SESSION['name'] ?? '';
        $learner_surname = $_SESSION['surname'] ?? '';
        $creator_full_name = $anonymous ? NULL : trim($learner_name . ' ' . $learner_surname);

        // Insert discussion
        $stmt = $conn->prepare("
            INSERT INTO class_discussions 
            (title, initial_message, class_id, creator_email, creator_anonymous, creator_name) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssisis", $title, $message_text, $class_id, $learner_email, $anonymous, $creator_full_name);
        $stmt->execute();
        $disc_id = $stmt->insert_id;
        $stmt->close();

        // Tag teachers
        $stmt = $conn->prepare("INSERT IGNORE INTO discussion_teachers (discussion_id, teacher_email) VALUES (?, ?)");
        foreach ($tagged_teachers as $t) {
            $stmt->bind_param("is", $disc_id, $t);
            $stmt->execute();
        }
        $stmt->close();

        // ────────────────────────────────────────────────────────────────────────
        // EMAIL NOTIFICATIONS: Classmates + Tagged Teachers
        // ────────────────────────────────────────────────────────────────────────
      

        // Get school name from database name
        $dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
        $schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName));

        // Creator display name for email
        $creatorDisplay = $anonymous 
            ? 'Anonymous Learner' 
            : trim($learner_name . ' ' . $learner_surname);

        // Link to discussions page (change later if you have a direct discussion view)
        $viewLink = "https://iskool.online/discussions.php";

        // Reusable email template function
        $emailTemplate = function($recipientName, $recipientRole) use ($title, $message_text, $creatorDisplay, $viewLink, $schoolName) {
            $greeting = $recipientRole === 'teacher' ? 'Dear Teacher' : 'Hi ' . htmlspecialchars($recipientName);
            $introLine = $recipientRole === 'teacher' 
                ? 'A learner in your class has started a new discussion and tagged you:' 
                : 'A new discussion has been started in your class:';

            $extraLine = $recipientRole === 'teacher' 
                ? '<p>Please check and respond when you can.</p>' 
                : '<p>Your teachers have been notified.</p>';

            return '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>New Discussion on iSkool</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; font-family:Verdana, Tahoma, Arial, Helvetica, sans-serif; font-size:16px; line-height:1.6; }
  .wrapper { max-width:600px; margin:30px auto; border-radius:16px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.2); }
  .header { padding:40px; text-align:center; background:#161b22; color:#ffffff; }
  .header h1 { margin:0; font-size:32px; font-weight:bold; color:#4fd1c5; }
  .body { padding:40px; background:#1e1e1e; color:#c9d1d9; }
  .body h2 { color:#4fd1c5; font-size:24px; font-weight:bold; margin-bottom:20px; }
  .body p { margin:0 0 18px; }
  .highlight { background:#2d333b; padding:20px; border-radius:12px; margin:25px 0; border-left:5px solid #4fd1c5; }
  .cta-button {
    display:inline-block; padding:16px 32px; margin:30px 0;
    background:#4fd1c5; color:#000; font-weight:bold; border-radius:30px;
    text-decoration:none; font-size:17px;
  }
  .footer { padding:30px; text-align:center; background:#161b22; font-size:14px; color:#8b949e; }
  @media (prefers-color-scheme: light) {
    .wrapper { background:#ffffff; }
    .header, .body, .footer { background:#ffffff; color:#333333; }
    .body h2 { color:#4fd1c5; }
    .highlight { background:#f0f9ff; border-left-color:#4fd1c5; }
    .footer { color:#666666; border-top:1px solid #eeeeee; }
  }
  @media (max-width: 480px) {
    .header, .body, .footer { padding:30px 20px !important; }
    .header h1 { font-size:28px !important; }
    .body h2 { font-size:22px !important; }
  }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>iSkool</h1></div>
    <div class="body">
      <h2>New Class Discussion</h2>
      <p>' . $greeting . ',</p>
      <p>' . $introLine . '</p>
      
      <div class="highlight">
        <strong>' . htmlspecialchars($title) . '</strong><br><br>
        ' . nl2br(htmlspecialchars($message_text)) . '<br><br>
        <em>— ' . htmlspecialchars($creatorDisplay) . '</em>
      </div>

      <p style="text-align:center;">
        <a href="' . $viewLink . '" class="cta-button">View Discussion</a>
      </p>

      ' . $extraLine . '
    </div>
    <div class="footer">
      <p>Best regards,<br>' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool © ' . date("Y") . '</p>
    </div>
  </div>
</body>
</html>';
        };

        // 1. Notify classmates (exclude creator)
        $classmatesQuery = $conn->prepare("
            SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
            FROM users u
            JOIN class_students cs ON u.email = cs.student_email
            WHERE cs.class_id = ? AND u.role = 'learner' AND u.email != ?
        ");
        $classmatesQuery->bind_param("is", $class_id, $learner_email);
        $classmatesQuery->execute();
        $classmatesResult = $classmatesQuery->get_result();

        while ($teacher = $teachersResult->fetch_assoc()) {
                $currentEmail = $teacher['email'];
                $isPushSent = false;

                // A. Try Push Notification (Teachers definitely want this)
                $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
                $checkSub->bind_param("s", $currentEmail);
                $checkSub->execute();
                $subResult = $checkSub->get_result();
                
                if ($subResult->num_rows > 0) {
                    $isPushSent = sendPushToUser(
                        $conn, 
                        $currentEmail, 
                        "🔔 Tagged in Discussion", 
                        $creatorDisplay . " tagged you in: " . $title
                    );
                }

                // B. Email if Push failed
                if (!$isPushSent) {
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
                        $mail->addAddress($currentEmail);
                        $mail->isHTML(true);
                        $mail->Subject = "You've been tagged: " . $title;
                        $mail->Body = $emailTemplate($teacher['name'], 'teacher');

                        $mail->send();
                    } catch (Exception $e) {
                        error_log("Discussion email failed (teacher $currentEmail): " . $mail->ErrorInfo);
                    }
                }
            }
        $classmatesQuery->close();

        // 2. Notify tagged teachers
        if (!empty($tagged_teachers)) {
            $placeholders = str_repeat('?,', count($tagged_teachers) - 1) . '?';
            $types = str_repeat('s', count($tagged_teachers));

            $teacherQuery = $conn->prepare("
                SELECT email, COALESCE(name, 'Teacher') AS name
                FROM users
                WHERE email IN ($placeholders) AND role = 'teacher'
            ");
            $teacherQuery->bind_param($types, ...$tagged_teachers);
            $teacherQuery->execute();
            $teachersResult = $teacherQuery->get_result();

            while ($teacher = $teachersResult->fetch_assoc()) {
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
                    $mail->addAddress($teacher['email']);
                    $mail->isHTML(true);
                    $mail->Subject = "You've been tagged: " . $title;
                    $mail->Body = $emailTemplate($teacher['name'], 'teacher');

                    $mail->send();
                } catch (Exception $e) {
                    error_log("Discussion email failed (teacher {$teacher['email']}): " . $mail->ErrorInfo);
                }
            }
            $teacherQuery->close();
        }

        // Success message and redirect
        $message = "Discussion created successfully!";
        echo '<script>
            document.addEventListener("DOMContentLoaded", () => {
                const modal = document.getElementById("successModal");
                if (modal) modal.style.display = "flex";
                setTimeout(() => window.location.href = "discussions.php", 2000);
            });
        </script>';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Discussion</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background: #161b22; padding: 30px; border-radius: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
        h1 { text-align: center; color: #4fd1c5; margin-bottom: 30px; }
        label { display: block; margin: 20px 0 8px; font-weight: 600; font-size: 16px; }
        input[type="text"], textarea { width: 100%; padding: 14px; background: #0d1117; border: 1px solid #30363d; border-radius: 10px; color: #e0e6f0; font-size: 15px; }
        textarea { min-height: 120px; resize: vertical; }
        select[multiple] { width: 100%; padding: 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 10px; color: #e0e6f0; height: 150px; }
        .checkbox { margin: 20px 0; font-size: 15px; }
        button { width: 100%; padding: 18px; background: #4fd1c5; color: black; font-weight: 700; font-size: 18px; border: none; border-radius: 12px; margin-top: 30px; cursor: pointer; transition: 0.3s; }
        button:hover { background: #3ab8ac; transform: translateY(-2px); }
        #successModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,17,23,0.85); justify-content: center; align-items: center; z-index: 10000; }
        #successModalContent { background: #161b22; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        #successModalContent i { font-size: 60px; color: #1ed760; margin-bottom: 20px; }
        #successModalContent p { font-size: 22px; font-weight: 600; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-comments"></i> Start a New Discussion</h1>

    <?php if ($message): ?>
        <p style="text-align:center; padding:15px; background:<?= strpos($message, 'successfully') ? '#238636' : '#f85149' ?>; border-radius:12px; margin:20px 0;">
            <?= htmlspecialchars($message) ?>
        </p>
    <?php endif; ?>

    <form method="POST">
        <label>Discussion Title *</label>
        <input type="text" name="title" required placeholder="e.g. Help with Quadratic Equations" value="<?= htmlspecialchars($_POST['title'] ?? '') ?>">

        <label>Your Message / Question *</label>
        <textarea name="message" required placeholder="Explain what you need help with or want to discuss..."><?= htmlspecialchars($_POST['message'] ?? '') ?></textarea>

        <label>Tag Teacher(s) * <em>(select at least one — they will moderate)</em></label>
        <select name="teachers[]" multiple required size="6">
            <?php foreach ($teachers as $t): ?>
                <option value="<?= $t['email'] ?>" <?= in_array($t['email'], $_POST['teachers'] ?? []) ? 'selected' : '' ?>>
                    <?= htmlspecialchars($t['display_name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
        <small style="color:#8b949e; display:block; margin-top:8px;">Hold Ctrl (Windows) or Cmd (Mac) to select multiple</small>

        <div class="checkbox">
            <label>
                <input type="checkbox" name="anonymous" <?= !empty($_POST['anonymous']) || !isset($_POST['anonymous']) ? 'checked' : '' ?>>
                Post anonymously (classmates won't see your name)
            </label>
        </div>

        <button type="submit"><i class="fas fa-paper-plane"></i> Create Discussion</button>
    </form>
</div>

<!-- Success Modal -->
<div id="successModal">
    <div id="successModalContent">
        <i class="fas fa-check-circle"></i>
        <p>Discussion created successfully!</p>
    </div>
</div>
</body>
</html>