<?php
session_start();
require_once 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$name = $_SESSION['name'] ?? $email;
$schoolId = $_SESSION['school_id'];
$message = "";

// Get school name
$schoolName = "School";
$schoolStmt = $conn->prepare("SELECT name FROM schools WHERE id = ?");
$schoolStmt->bind_param("i", $schoolId);
$schoolStmt->execute();
$schoolResult = $schoolStmt->get_result();
if ($row = $schoolResult->fetch_assoc()) {
    $schoolName = $row['name'];
}

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY
$currentYearStmt = $conn->prepare("SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1");
$currentYearStmt->bind_param("i", $schoolId);
$currentYearStmt->execute();
$currentYearResult = $currentYearStmt->get_result();
$currentYearRow = $currentYearResult->fetch_assoc();
$current_academic_year_id = $currentYearRow['id'] ?? null;
$currentYearStmt->close();

if (!$current_academic_year_id) {
    die("No active academic year found. Please contact your admin.");
}
// ==========================================================================
// GET CURRENT GLOBAL TERM (Your throne — same as quizzes & assignments)
$current_global_term = 4; // safety fallback
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}
// ==========================================================================
// Get all classes in this school
$classStmt = $conn->prepare("SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC");
$classStmt->bind_param("i", $schoolId);
$classStmt->execute();
$classResult = $classStmt->get_result();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $msg = trim($_POST['message']);
    $class_id = intval($_POST['class_id']);
    $send_to = $_POST['send_to'] ?? 'learners';

    if (!empty($title) && !empty($msg) && $class_id > 0) {
        // Insert announcement
               $stmt = $conn->prepare("
            INSERT INTO announcements 
            (class_id, title, message, created_by, school_id, academic_year_id, term_number, send_to) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("isssisii", 
            $class_id, 
            $title, 
            $msg, 
            $email, 
            $schoolId, 
            $current_academic_year_id, 
            $current_global_term,     // ← FORCED CURRENT TERM
            $send_to
        );
        $stmt->execute();
        $message = "Announcement sent successfully!";

       // --- Push Notification Integration ---
$auth = [
    'VAPID' => [
        'subject' => 'mailto:noreply@iskool.online',
        'publicKey' => 'BKPh1RLmANqolINDIuClVLOGrlfeQSG7o2pgZAS25xgD_rIp-LOPTWIzEu--bdOsFTi3QPNzpQ5mmzT__OEWmJc',
        'privateKey' => '6crSLhwDbUQsSB5g63iO-8bh_S8gc88cmkRXpSuDvVw',
    ],
];

$webPush = new WebPush($auth);

// Fetch subscriptions
if ($send_to === 'parents') {
    $subStmt = $conn->prepare("
        SELECT ps.subscription 
        FROM push_subscriptions ps
        JOIN users u ON ps.user_id = u.id
        JOIN parent_classes pc ON u.email = pc.parent_email
        WHERE pc.class_id = ?
    ");
} else {
    $subStmt = $conn->prepare("
        SELECT ps.subscription 
        FROM push_subscriptions ps
        JOIN users u ON ps.user_id = u.id
        JOIN class_students cs ON u.email = cs.student_email
        WHERE cs.class_id = ?
    ");
}

if ($subStmt === false) {
    error_log("Failed to prepare subscription query: " . $conn->error);
    $message = "Error preparing notification query.";
} else {
    $subStmt->bind_param("i", $class_id);
    if (!$subStmt->execute()) {
        error_log("Failed to execute subscription query: " . $subStmt->error);
        $message = "Error executing notification query.";
    } else {
        $subsResult = $subStmt->get_result();
        $notificationsSent = 0;

        while ($row = $subsResult->fetch_assoc()) {
            $subscription = Subscription::create(json_decode($row['subscription'], true));
            $webPush->sendNotification(
                $subscription,
                json_encode([
                    'title' => '📢 ' . $title,
                    'body' => $msg,
                    'url' => '/index.php',
                    'tag' => 'iSkool-notification', // Group notifications like WhatsApp
                    'renotify' => true // Replace previous if same tag
                ])
            );
            $notificationsSent++;
        }

        // Flush notifications with improved error handling
        $reportCount = 0;
        foreach ($webPush->flush() as $report) {
            $reportCount++;
            if (!$report->isSuccess()) {
                error_log("Push failed for subscription {$report->getRequest()->getEndpoint()}: {$report->getReason()}");
            }
        }
        if ($reportCount > 0) {
            $message .= " $notificationsSent notifications attempted (some may have failed). Check logs.";
        } else if ($notificationsSent > 0) {
            $message .= " No push reports received (network issue?).";
        }
    }
    $subStmt->close();
}

        // --- Email Notification ---
        if ($send_to === 'parents') {
            $emailQuery = $conn->prepare("
                SELECT DISTINCT u.email, u.name 
                FROM users u 
                JOIN parent_classes pc ON u.email = pc.parent_email
                WHERE pc.class_id = ? AND u.role = 'parent'
            ");
        } else {
            $emailQuery = $conn->prepare("
                SELECT DISTINCT u.email, u.name 
                FROM users u 
                JOIN class_students cs ON u.email = cs.student_email
                WHERE cs.class_id = ? AND u.role = 'user'
            ");
        }

        $emailQuery->bind_param("i", $class_id);
        $emailQuery->execute();
        $recipients = $emailQuery->get_result();

        while ($recipient = $recipients->fetch_assoc()) {
            try {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host       = 'iskool.online';
                $mail->SMTPAuth   = true;
                $mail->Username   = 'noreply@iskool.online';
                $mail->Password   = 'oxJTVc6HXRSc';
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; 
                $mail->Port       = 465;

                $mail->setFrom('noreply@iskool.online', $schoolName);
                $mail->addAddress($recipient['email']);
                $mail->isHTML(true);
                $mail->Subject = htmlspecialchars($title);

$mail->Body = '
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iSkool Notification</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #121212;
    font-family: "Inter", system-ui, Arial, sans-serif;
    color: #ffffff;
  }
  .email-wrapper {
    max-width: 600px;
    margin: 30px auto;
    background-color: #1e1e1e;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  }
  .email-header {
    background-color: #161b22;
    padding: 30px;
    text-align: center;
  }
  .email-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #1db954; /* accent color */
  }
  .email-header p {
    margin: 6px 0 0;
    font-size: 14px;
    color: #c9d1d9;
  }
  .email-body {
    padding: 30px;
    text-align: left;
  }
  .email-body p {
    margin: 0 0 15px;
    font-size: 16px;
    line-height: 1.6;
    color: #c9d1d9;
  }
  .email-body h2 {
    font-size: 22px;
    font-weight: 600;
    color: #1db954;
    margin: 0 0 20px;
  }
  .cta-button {
    display: inline-block;
    padding: 12px 25px;
    margin-top: 15px;
    background-color: #1db954;
    color: #121212;
    font-weight: 600;
    border-radius: 25px;
    text-decoration: none;
    transition: background-color 0.3s ease;
  }
  .cta-button:hover {
    background-color: #1ed760;
  }
  .email-footer {
    background-color: #161b22;
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: #8b949e;
  }
  @media (max-width: 480px) {
    .email-wrapper {
      margin: 20px 10px;
    }
    .email-header, .email-body, .email-footer {
      padding: 20px;
    }
    .email-header h1 {
      font-size: 24px;
    }
    .email-body h2 {
      font-size: 20px;
    }
    .email-body p {
      font-size: 15px;
    }
  }
</style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <h1>📢 iSkool</h1>
      <p>Your Digital Classroom</p>
    </div>
    <div class="email-body">
      <p>Hello ' . htmlspecialchars($recipient['name']) . ',</p>
      <h2>' . htmlspecialchars($title) . '</h2>
      <p>' . nl2br(htmlspecialchars($msg)) . '</p>
     
    </div>
    <div class="email-footer">
      <p>Author: ' . htmlspecialchars($name) . '</p>
      <p>Best regards, ' . htmlspecialchars($schoolName) . '</p>
      <p>Powered by iSkool &copy; 2025</p>
    </div>
  </div>
</body>
</html>
';


                $mail->send();
            } catch (Exception $e) {
                error_log("Email sending failed for {$recipient['email']}: " . $mail->ErrorInfo);
            }
        }
    } else {
        $message = "Please fill in all fields.";
    }
}
?>


<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Announcement</title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #ffffff;
            --button-bg: #ffffff;
            --button-text: #0d1117;
            --hover-bg: #dddddd;
            --radius: 10px;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 30px;
        }

        h1 {
            color: var(--text-color);
        }

        form {
            background-color: var(--card-bg);
            padding: 20px;
            border-radius: var(--radius);
            max-width: 600px;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
        }

        label {
            display: block;
            margin-top: 15px;
            font-weight: bold;
        }

        input, textarea, select {
            width: 100%;
            padding: 10px;
            margin-top: 5px;
            border-radius: 6px;
            border: 1px solid #444;
            background-color: #0d1117;
            color: var(--text-color);
        }

        button {
            margin-top: 20px;
            width: 100%;
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            border-radius: 6px;
            padding: 12px;
            font-weight: bold;
            cursor: pointer;
        }

        button:hover {
            background-color: var(--hover-bg);
        }

        .message {
            margin-top: 20px;
            color: #00ff99;
            font-weight: bold;
        }

        .view-button {
            display: inline-block;
            padding: 10px 15px;
            margin-bottom: 20px;
            background-color: var(--button-bg);
            color: var(--button-text);
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
        }

        .view-button:hover {
            background-color: var(--hover-bg);
        }

        footer {
            margin-top: 60px;
            text-align: center;
            color: var(--text-color);
            opacity: 0.5;
            font-size: 14px;
        }

        footer a {
            color: var(--text-color);
            text-decoration: none;
        }

#loaderOverlay {
    position: fixed;
    top:0; left:0;
    width:100%;
    height:100%;
    background: rgba(13,17,23,0.85);
    backdrop-filter: blur(6px);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    flex-direction: column;
    opacity: 0;
    transition: opacity 0.4s ease;
}

#loaderOverlay.show {
    display: flex;
    opacity: 1;
}

.loader-container {
    text-align: center;
}

.loader-book i {
    font-size: 5rem; /* size of the book */
    color: #00ff99; /* neon green */
    text-shadow: 0 0 10px #00ff99;
    animation: rotateBook 4s linear infinite; /* slow rotation */
}

.loader-text {
    font-size: 18px;
    color: #00ff99;
    font-weight: 600;
    text-shadow: 0 0 8px #00ff99;
    font-family: 'Nunito', sans-serif;
    margin-top: 15px;
}

/* Slow smooth rotation */
@keyframes rotateBook {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

    </style>
</head>
<body>

<h1>📢 Create Announcement</h1>


<?php if ($message): ?>
    <p class="message"><?= htmlspecialchars($message) ?></p>
<?php endif; ?>

<form method="POST">
    <label for="title">Title:</label>
    <input type="text" name="title" required>

    <label for="message">Message:</label>
    <textarea name="message" rows="5" required></textarea>

    <label for="class_id">Send To Class:</label>
    <select name="class_id" required>
        <option value="">-- Select Class --</option>
        <?php $classResult->data_seek(0); while ($row = $classResult->fetch_assoc()): ?>
            <option value="<?= $row['id'] ?>"><?= htmlspecialchars($row['name']) ?><?= $row['subject'] ? " ({$row['subject']})" : '' ?></option>
        <?php endwhile; ?>
    </select>

    <div style="background:#1a202c; padding:18px; border-radius:10px; border-left:5px solid #4fd1c5; margin:25px 0; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.3rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
        <small style="color:#8b949e;">This announcement automatically belongs to the current term.<br>You (Super Admin) control the current term globally.</small>
    </div>

    <label for="send_to">Send Email Alert To:</label>
    <select name="send_to" required>
        <option value="parents">Parents Only</option>
        <option value="learners" selected>Learners Only</option>
    </select>

    <button type="submit">Send Announcement</button>
</form>

<!-- Full Screen Loader -->
<div id="loaderOverlay">
  <div class="loader-container">
    <div class="loader-book">
      <i class="fas fa-book-open"></i>
    </div>
    <div class="loader-text">Processing...</div>
  </div>
</div>

<script>
const form = document.querySelector("form");
const loader = document.getElementById("loaderOverlay");

form.addEventListener("submit", () => {
    loader.classList.add("show");
});
</script>


</body>
</html>
