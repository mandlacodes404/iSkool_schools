<?php
session_start();
require_once 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Only allow school admin
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'] ?? '';
$name = $_SESSION['name'] ?? 'Admin';
$schoolId = $_SESSION['school_id'] ?? 0;
$message = "";

// Get school name
$schoolName = "School";
$stmtSchool = $conn->prepare("SELECT name FROM schools WHERE id = ?");
$stmtSchool->bind_param("i", $schoolId);
$stmtSchool->execute();
$resSchool = $stmtSchool->get_result();
if ($row = $resSchool->fetch_assoc()) {
    $schoolName = $row['name'];
}
$stmtSchool->close();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title']);
    $msg = trim($_POST['message']);

    if (!empty($title) && !empty($msg)) {
        // Insert announcement (class_id is NULL for school-wide)
        $target_role = 'teacher';
        $stmt = $conn->prepare("INSERT INTO announcements (class_id, title, message, created_by, school_id, target_role) VALUES (NULL, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssis", $title, $msg, $email, $schoolId, $target_role);
        $stmt->execute();
        $stmt->close();

        $message = "Announcement sent successfully!";

        // Get teacher emails in the same school
        $emailQuery = $conn->prepare("SELECT email, name FROM users WHERE role = 'teacher' AND school_id = ?");
        $emailQuery->bind_param("i", $schoolId);
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
                $mail->addAddress($recipient['email'], $recipient['name']);
                $mail->isHTML(true);
                $mail->Subject = 'New School Announcement';
                $mail->Body = "
                    <p>Hi " . htmlspecialchars($recipient['name']) . ",</p>
                    <p>You have a new announcement titled <strong>" . htmlspecialchars($title) . "</strong>.</p>
                    <p>" . nl2br(htmlspecialchars($msg)) . "</p>
                    <p>Sent by: " . htmlspecialchars($name) . "</p>
                    <p>Regards,<br>" . htmlspecialchars($schoolName) . "</p>
                ";
                $mail->send();
            } catch (Exception $e) {
                error_log("Email failed to send to {$recipient['email']}: " . $mail->ErrorInfo);
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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Send Announcement to Teachers</title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.7);
            --text-color: #e0e6f0;
            --button-bg: white;
            --button-hover: #dddddd;
            --shadow-glow: rgba(255, 255, 255, 0.05);
            --radius: 20px;
        }

        body {
            background: var(--bg-color);
            color: var(--text-color);
            font-family: Arial, sans-serif;
            padding: 40px;
            margin: 0;
        }

        h1 {
            color: white;
            margin-bottom: 20px;
        }

        .form-card {
            background: var(--card-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: var(--radius);
            padding: 30px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 0 30px var(--shadow-glow);
        }

        label {
            display: block;
            margin-top: 20px;
            margin-bottom: 6px;
            font-weight: bold;
        }

        input, textarea {
            width: 100%;
            padding: 12px;
            border-radius: 12px;
            border: 1px solid #ccc;
            background: #161b22;
            color: white;
            font-size: 14px;
        }

        textarea {
            resize: vertical;
        }

        button {
            background-color: var(--button-bg);
            color: black;
            border: none;
            padding: 12px 20px;
            border-radius: 30px;
            margin-top: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        button:hover {
            background-color: var(--button-hover);
        }

        .message {
            margin-top: 20px;
            text-align: center;
            color: lightgreen;
            font-weight: bold;
        }

        
    #loaderOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(13,17,23,0.85); /* dark translucent */
    display: none; /* hidden by default */
    justify-content: center;
    align-items: center;
    flex-direction: column;
    z-index: 9999;
}

.loader {
    border: 6px solid #f3f3f3;
    border-top: 6px solid #58a6ff; /* blue spinner */
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin-top: 12px;
}

.loader-text {
    color: #c9d1d9;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
}

/* Spinner animation */
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
    </style>
</head>
<body>

<h1>Send Announcement to All Teachers</h1>

<?php if ($message): ?>
    <p class="message"><?= htmlspecialchars($message) ?></p>
<?php endif; ?>

<div class="form-card">
    <form method="POST">
        <label for="title">Title:</label>
        <input type="text" name="title" required>

        <label for="message">Message:</label>
        <textarea name="message" rows="6" required></textarea>

        <button type="submit">Send Announcement</button>
    </form>
</div>


  <!-- Full Screen Loader -->
<div id="loaderOverlay">
    <div class="loader-text">Processing...</div>
    <div class="loader"></div>
</div>

<script>
const form = document.querySelector("form");
const loader = document.getElementById("loaderOverlay");

form.addEventListener("submit", () => {
    loader.style.display = "flex"; // show overlay
});
</script>

</body>
</html>
