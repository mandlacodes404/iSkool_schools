<?php
session_start();
require_once 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'parent') {
    header("Location: index.php");
    exit();
}

$parentEmail = $_SESSION['email'];
$parentName  = $_SESSION['name'] ?? 'Parent';
$feedback    = "";

// Clean up old session key
unset($_SESSION['school_id']);

/* ---------- Fetch all teachers from current school (current DB = current school) ---------- */
$teachers = [];
$stmt = $conn->query("SELECT name, email FROM users WHERE role = 'teacher' AND is_deleted = 0 ORDER BY name");
while ($row = $stmt->fetch_assoc()) {
    $teachers[] = $row;
}
$stmt->close();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $teacherEmail = $_POST['teacher_email'] ?? '';
    $message      = trim($_POST['message'] ?? '');

    if (!empty($teacherEmail) && !empty($message)) {
        // Get teacher's name
        $teacherName = 'Teacher';
        foreach ($teachers as $t) {
            if ($t['email'] === $teacherEmail) {
                $teacherName = $t['name'];
                break;
            }
        }

        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'mandlasimphiwe99@gmail.com';
            $mail->Password   = 'qbfn gpyq gmuh fyyx'; // Consider using environment variables later
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;

            $mail->setFrom('mandlasimphiwe99@gmail.com', "iSkool - {$parentName}");
            $mail->addAddress($teacherEmail, $teacherName);
            $mail->isHTML(true);
            $mail->Subject = 'New Message from Parent - iSkool';

            $mail->Body = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>New Message from Parent</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {margin:0;padding:0;background:#121212;font-family:"Inter",sans-serif;color:#e6edf3}
        .wrapper {max-width:600px;margin:30px auto;background:#1e1e1e;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.6)}
        .header {background:linear-gradient(135deg,#4fd1c5,#3898ec);padding:30px;text-align:center;color:#fff}
        .header h1 {margin:0;font-size:28px;font-weight:700}
        .body {padding:30px;color:#c9d1d9}
        .body p {margin:0 0 16px;line-height:1.6;font-size:16px}
        blockquote {margin:20px 0;padding:20px;background:#161b22;border-left:5px solid #4fd1c5;border-radius:8px;font-style:italic}
        .footer {background:#0d1117;padding:20px;text-align:center;font-size:13px;color:#8b949e}
        @media(max-width:480px){
            .wrapper {margin:15px;border-radius:10px}
            .header, .body, .footer {padding:20px}
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <h1>iSkool</h1>
            <p>New Message from Parent</p>
        </div>
        <div class="body">
            <p>Dear <strong>' . htmlspecialchars($teacherName) . '</strong>,</p>
            <p>You have received a new message from a parent:</p>
            <blockquote>' . nl2br(htmlspecialchars($message)) . '</blockquote>
            <p><strong>Sender:</strong> ' . htmlspecialchars($parentName) . '<br>
               <strong>Email:</strong> ' . htmlspecialchars($parentEmail) . '</p>
            <p>Please log in to iSkool to respond.</p>
            <p>Best regards,<br><strong>iSkool System</strong></p>
        </div>
        <div class="footer">
            <p>&copy; ' . date('Y') . ' iSkool • Powered by Excellence</p>
        </div>
    </div>
</body>
</html>';

            $mail->send();

            // Save message to database
            $stmt = $conn->prepare("INSERT INTO messages (parent_email, receiver_name, teacher_email, message) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("ssss", $parentEmail, $teacherName, $teacherEmail, $message);
            $stmt->execute();
            $stmt->close();

            $feedback = "<div style='color:#4fd1c5;font-weight:600;'>Your message was successfully sent to <strong>$teacherName</strong>.</div>";

        } catch (Exception $e) {
            $feedback = "<div style='color:#f87171;'>Failed to send message. Please try again later.</div>";
        }
    } else {
        $feedback = "<div style='color:#fbbf24;'>Please select a teacher and write a message.</div>";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Message a Teacher</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --secondary-accent: #f28c38;
            --border-color: rgba(255, 255, 255, 0.1);
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --card-radius: 12px;
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            max-width: 600px;
            width: 100%;
        }

        .card {
            background: var(--card-bg);
            border-radius: var(--card-radius);
            padding: 24px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            margin-bottom: 20px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        h1 {
            font-size: 28px;
            color: var(--accent-color);
            margin: 0 0 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
            color: var(--text-color);
        }

        select,
        textarea {
            width: 100%;
            padding: 12px;
            border-radius: var(--card-radius);
            border: 1.5px solid var(--border-color);
            background-color: rgba(255, 255, 255, 0.03);
            color: var(--text-color);
            font-family: inherit;
            font-size: 14px;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        select:focus,
        textarea:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 8px var(--shadow-glow);
            outline: none;
        }

        textarea {
            min-height: 140px;
            resize: vertical;
        }

        button {
            background-color: var(--accent-color);
            color: #0d1117;
            border: none;
            padding: 12px 20px;
            border-radius: 999px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            width: 100%;
            transition: background 0.3s ease, transform 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        button:hover {
            background-color: #3ab8ad;
            transform: scale(1.02);
        }

        .feedback {
            padding: 12px 16px;
            border-radius: var(--card-radius);
            font-size: 14px;
            margin-top: 16px;
            text-align: center;
        }

        .feedback.success {
            background: rgba(79, 209, 197, 0.15);
            color: var(--accent-color);
            border: 1px solid rgba(79, 209, 197, 0.3);
        }

        .feedback.error {
            background: rgba(242, 140, 56, 0.15);
            color: var(--secondary-accent);
            border: 1px solid rgba(242, 140, 56, 0.3);
        }

        #loaderOverlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px; height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .container { padding: 0 10px; }
            h1 { font-size: 24px; }
            .card { padding: 20px; }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="card">
        <h1>Send Message</h1>

        <?php if ($feedback): ?>
            <div class="feedback <?= strpos($feedback, 'successfully') !== false ? 'success' : 'error' ?>">
                <?= htmlspecialchars($feedback) ?>
            </div>
        <?php endif; ?>

        <form method="POST" id="messageForm">
            <div class="form-group">
                <label for="teacher_email">Select Teacher</label>
                <select name="teacher_email" id="teacher_email" required>
                    <option value="">-- Choose a Teacher --</option>
                    <?php foreach ($teachers as $teacher): ?>
                        <option value="<?= htmlspecialchars($teacher['email']) ?>">
                            <?= htmlspecialchars($teacher['name']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-group">
                <label for="message">Your Message</label>
                <textarea name="message" id="message" placeholder="Type your message here..." required></textarea>
            </div>

            <button type="submit">
                Send Message
            </button>
        </form>
    </div>
</div>

<div id="loaderOverlay">
    <div class="loader-text">Sending...</div>
    <div class="loader"></div>
</div>

<script>
    const form = document.getElementById('messageForm');
    const loader = document.getElementById('loaderOverlay');

    form.addEventListener('submit', () => {
        loader.style.display = 'flex';
    });
</script>

</body>
</html>