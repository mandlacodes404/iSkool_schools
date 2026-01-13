<?php
session_start();
require_once 'config.php';
require_once 'push_functions.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php"); exit();
}

 require 'vendor/autoload.php';
        use PHPMailer\PHPMailer\PHPMailer;
        use PHPMailer\PHPMailer\Exception;
$teacher_email = $_SESSION['email'];
$message = "";

// Get current year & term
$current_academic_year_id = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1")->fetch_assoc()['id'];
$current_global_term = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1")->fetch_assoc()['current_global_term'] ?? 4;

// Get all classes
$classes = $conn->query("SELECT id, name FROM classes ORDER BY name ASC")->fetch_all(MYSQLI_ASSOC);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $description = trim($_POST['description'] ?? '');
    $class_id = (int)$_POST['class_id'];
    $use_default = !empty($_POST['use_default']);

    if (empty($title) || $class_id <= 0) {
        $message = "Please fill all required fields.";
    } else {
        // Insert evaluation
        $stmt = $conn->prepare("INSERT INTO teacher_evaluations (title, description, class_id, created_by, academic_year_id, term_number) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssisii", $title, $description, $class_id, $teacher_email, $current_academic_year_id, $current_global_term);
        $stmt->execute();
        $eval_id = $stmt->insert_id;
        $stmt->close();

        if ($use_default) {
            // Copy default statements
            $conn->query("INSERT INTO evaluation_statements (evaluation_id, statement, order_num)
                          SELECT $eval_id, statement, order_num FROM evaluation_statements WHERE evaluation_id = 1");
        }

        // Custom statements
        if (isset($_POST['statements']) && is_array($_POST['statements'])) {
            $stmt = $conn->prepare("INSERT INTO evaluation_statements (evaluation_id, statement, order_num) VALUES (?, ?, ?)");
            foreach ($_POST['statements'] as $order => $stmt_text) {
                if (trim($stmt_text) !== '') {
                    $stmt->bind_param("isi", $eval_id, $stmt_text, $order);
                    $stmt->execute();
                }
            }
            $stmt->close();
        }

        // ────────────────────────────────────────────────────────────────────────
        // EMAIL NOTIFICATIONS: Only Learners in the Class
        // ────────────────────────────────────────────────────────────────────────
       

        // Get school name
        $dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
        $schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName));

        // Teacher name for email
        $teacher_name = $_SESSION['name'] ?? 'Your Teacher';

        // Use BASE_URL from config.php and clean it for the dashboard parameter
$cleanBaseUrl = rtrim(BASE_URL, '/');
$evalLink = $cleanBaseUrl . "/learner_dashboard.php?page=learner_evaluations.php";

        // Email template
        $emailBody = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>New Evaluation Released</title>
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
      <h2>New Teacher Evaluation</h2>
      <p>Hi {{name}},</p>
      <p>A new evaluation has been released by your teacher.</p>
      
      <div class="highlight">
        <strong>' . htmlspecialchars($title) . '</strong><br><br>
        ' . (!empty($description) ? nl2br(htmlspecialchars($description)) . '<br><br>' : '') . '
        <em>Released by: ' . htmlspecialchars($teacher_name) . '</em>
      </div>

      <p style="text-align:center;">
        <a href="' . $evalLink . '" class="cta-button">Complete Evaluation</a>
      </p>

      <p>Your honest feedback helps improve teaching. Thank you!</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool © ' . date("Y") . '</p>
    </div>
  </div>
</body>
</html>';

        // Get all learners in the class
        $learnersQuery = $conn->prepare("
            SELECT DISTINCT u.email, COALESCE(u.name, u.email) AS name
            FROM users u
            JOIN class_students cs ON u.email = cs.student_email
            WHERE cs.class_id = ? AND u.role = 'learner'
        ");
        $learnersQuery->bind_param("i", $class_id);
        $learnersQuery->execute();
        $learnersResult = $learnersQuery->get_result();

        // --- SMART NOTIFICATION LOGIC ---
        
        $force_email = isset($_POST['force_email']) ? true : false;

        while ($learner = $learnersResult->fetch_assoc()) {
            $currentEmail = $learner['email'];
            $isPushSent = false;

            // A. Try Mobile Push first
            $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
            $checkSub->bind_param("s", $currentEmail);
            $checkSub->execute();
            $subResult = $checkSub->get_result();
            
            if ($subResult->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "📊 New Evaluation: " . $title, 
        "Your teacher requested your feedback. Please complete the evaluation.",
        $evalLink // <--- Add the $evalLink as the 5th parameter here
    );
}

            // B. Email Fallback / Force Email
            if (!$isPushSent || $force_email) {
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
                    $mail->Subject = "New Evaluation: " . $title;

                    // Personalize name
                    $personalizedBody = str_replace('{{name}}', htmlspecialchars($learner['name']), $emailBody);
                    $mail->Body = $personalizedBody;

                    $mail->send();
                } catch (Exception $e) {
                    error_log("Evaluation email failed (learner {$currentEmail}): " . $mail->ErrorInfo);
                }
            }
        }
        $learnersQuery->close();
        // --- END NOTIFICATION LOGIC ---

        // Success message
        $message = "Evaluation released successfully!";
        echo '<script>
            document.addEventListener("DOMContentLoaded", () => {
                const modal = document.getElementById("successModal");
                if (modal) modal.style.display = "flex";
                setTimeout(() => window.location.href = "view_evaluation_results.php", 2000);
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
    <title>Create Teacher Evaluation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nunito', sans-serif; background: #0d1117; color: #e0e6f0; padding: 30px; }
        .container { max-width: 800px; margin: auto; background: #161b22; padding: 30px; border-radius: 12px; }
        h1 { text-align: center; color: #4fd1c5; }
        label { display: block; margin: 15px 0 5px; font-weight: 600; }
        input, textarea, select { width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #e0e6f0; }
        .statement { margin: 15px 0; }
        .add-btn { background: #4fd1c5; color: black; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 10px; }
        button[type="submit"] { width: 100%; padding: 15px; background: #4fd1c5; color: black; font-weight: 700; border: none; border-radius: 10px; margin-top: 20px; cursor: pointer; }
        #successModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,17,23,0.85); justify-content: center; align-items: center; z-index: 10000; }
        #successModalContent { background: #161b22; padding: 30px; border-radius: 12px; text-align: center; }
        #successModalContent i { font-size: 50px; color: #238636; }
        #successModalContent p { font-size: 20px; margin: 15px 0; }
    </style>
</head>
<body>
<div class="container">
    <h1><i class="fas fa-poll"></i> Create Teacher Evaluation</h1>

    <?php if ($message): ?>
        <p style="text-align:center; color:#ffd43b;"><?= htmlspecialchars($message) ?></p>
    <?php endif; ?>

    <form method="POST">
        <label>Title *</label>
        <input type="text" name="title" required value="<?= htmlspecialchars($_POST['title'] ?? '') ?>">

        <label>Description (optional)</label>
        <textarea name="description" rows="3"><?= htmlspecialchars($_POST['description'] ?? '') ?></textarea>

        <label>Class *</label>
        <select name="class_id" required>
            <option value="">-- Select Class --</option>
            <?php foreach ($classes as $class): ?>
                <option value="<?= $class['id'] ?>" <?= ($_POST['class_id'] ?? '') == $class['id'] ? 'selected' : '' ?>>
                    <?= htmlspecialchars($class['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>

        <label><input type="checkbox" name="use_default" checked> Use default questions (recommended)</label>

        <div id="statements">
            <p><strong>Questions:</strong> (Edit or add more below)</p>
            <!-- Dynamic statements will be added via JS if not using default -->
        </div>

        <button type="button" class="add-btn" onclick="addStatement()">+ Add Question</button>
        <div style="background:#1a202c; padding:15px; border-radius:10px; border:1px solid #30363d; margin:20px 0;">
    <label style="display: flex; align-items: center; cursor: pointer; color: #4fd1c5; font-weight: bold; margin:0;">
        <input type="checkbox" name="force_email" value="1" style="width: 20px; height: 20px; margin-right: 12px; cursor: pointer;">
        Urgent: Also send Email Alert to all students
    </label>
</div>
        <button type="submit">Release Evaluation</button>
    </form>
</div>

<!-- Success Modal -->
<div id="successModal">
    <div id="successModalContent">
        <i class="fas fa-check-circle"></i>
        <p>Evaluation released successfully!</p>
    </div>
</div>

<script>
function addStatement() {
    const div = document.getElementById('statements');
    const count = div.querySelectorAll('.statement').length;
    const el = document.createElement('div');
    el.className = 'statement';
    el.innerHTML = `
        <textarea name="statements[${count}]" rows="2" placeholder="Enter question..."></textarea>
    `;
    div.appendChild(el);
}
</script>
</body>
</html>