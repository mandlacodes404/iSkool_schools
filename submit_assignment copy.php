<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'user') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

if (!isset($_GET['assignment_id'])) {
    echo "No assignment specified.";
    exit();
}

$assignment_id = intval($_GET['assignment_id']);

// Fetch assignment details
$stmt = $conn->prepare("SELECT * FROM assignments WHERE id = ?");
if (!$stmt) {
    die("Prepare failed: " . $conn->error);
}
$stmt->bind_param("i", $assignment_id);
$stmt->execute();
$assignment = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$assignment) {
    echo "Assignment not found.";
    exit();
}

// Check due date
$now = new DateTime();
$due = new DateTime($assignment['due_date']);
$past_due = $now > $due;

// Check if submission already exists
$subStmt = $conn->prepare("SELECT * FROM submissions WHERE assignment_id = ? AND student_email = ?");
if (!$subStmt) {
    die("Prepare failed: " . $conn->error);
}
$subStmt->bind_param("is", $assignment_id, $email);
$subStmt->execute();
$submission = $subStmt->get_result()->fetch_assoc();
$subStmt->close();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$past_due) {
    // Handle submission form
    $submission_text = $_POST['submission_text'] ?? null;
    $fileUrl = $submission['file_url'] ?? null;

    if (isset($_FILES['submission_file']) && $_FILES['submission_file']['error'] === 0) {
        $uploadDir = "assignment_submissions/";
        if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);
        $filename = time() . "_" . basename($_FILES['submission_file']['name']);
        $fileUrl = $uploadDir . $filename;
        if (!move_uploaded_file($_FILES['submission_file']['tmp_name'], $fileUrl)) {
            die("Failed to upload file.");
        }
    }

    if ($submission) {
        // Update existing submission
        $updateStmt = $conn->prepare("UPDATE submissions SET submission_text = ?, file_url = ?, submitted_at = NOW() WHERE id = ?");
        if (!$updateStmt) {
            die("Prepare failed: " . $conn->error);
        }
        $updateStmt->bind_param("ssi", $submission_text, $fileUrl, $submission['id']);
        if (!$updateStmt->execute()) {
            die("Execute failed: " . $updateStmt->error);
        }
        $updateStmt->close();
    } else {
        // Insert new submission
        $insertStmt = $conn->prepare("INSERT INTO submissions (assignment_id, student_email, text_answer, file_url) VALUES (?, ?, ?, ?)");
        if (!$insertStmt) {
            die("Prepare failed: " . $conn->error);
        }
        $insertStmt->bind_param("isss", $assignment_id, $email, $submission_text, $fileUrl);
        if (!$insertStmt->execute()) {
            die("Execute failed: " . $insertStmt->error);
        }
        $insertStmt->close();
    }

    header("Location: learner_assignments.php?submitted=1");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Submit Assignment</title>
    <style>
        /* Adapt your platform's dark style here */
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: #0d1117;
            color: #c9d1d9;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px 50px;
        }
        h1 {
            color: #58a6ff;
            text-align: center;
            margin-bottom: 30px;
        }
        label {
            display: block;
            margin-top: 18px;
            font-weight: 600;
            color: #8b949e;
            user-select: none;
        }
        input[type="text"], input[type="file"], textarea {
            width: 100%;
            background-color: #161b22;
            border: 1.5px solid #30363d;
            border-radius: 8px;
            padding: 12px 14px;
            margin-top: 8px;
            color: #c9d1d9;
            font-size: 1rem;
            transition: border-color 0.2s ease;
        }
        input[type="text"]:focus, textarea:focus, input[type="file"]:focus {
            border-color: #58a6ff;
            outline: none;
            box-shadow: 0 0 6px #58a6ffaa;
            background-color: #21262d;
        }
        button {
            margin-top: 25px;
            width: 100%;
            padding: 16px 0;
            font-weight: 700;
            font-size: 1.15rem;
            color: #c9d1d9;
            background-color: #238636;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.3s ease;
        }
        button:hover {
            background-color: #2ea043;
        }
        .info {
            margin-bottom: 20px;
            padding: 15px;
            background: #161b22;
            border-radius: 10px;
            box-shadow: 0 0 15px rgba(8, 103, 170, 0.6);
        }
        a {
            color: #58a6ff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .error {
            color: #f85149;
            font-weight: 600;
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

<h1>Submit Assignment</h1>

<div class="info">
    <strong>Title:</strong> <?= htmlspecialchars($assignment['title']) ?><br>
    <strong>Description:</strong> <?= nl2br(htmlspecialchars($assignment['description'])) ?><br>
    <strong>Due Date:</strong> <?= date('F j, Y, g:i A', strtotime($assignment['due_date'])) ?><br>
    <?php if (!empty($assignment['file_url'])): ?>
        <strong>Attachment:</strong> <a href="<?= htmlspecialchars($assignment['file_url']) ?>" target="_blank">Download</a><br>
    <?php endif; ?>
</div>

<?php if ($past_due): ?>
    <p class="error">Sorry, the due date for this assignment has passed. You cannot submit anymore.</p>
<?php else: ?>
    <form method="POST" enctype="multipart/form-data">
        <label for="submission_text">Submission Text (optional):</label>
        <textarea name="submission_text" rows="6"><?= htmlspecialchars($submission['submission_text'] ?? '') ?></textarea>

        <label for="submission_file">Upload File (optional):</label>
        <?php if (!empty($submission['file_url'])): ?>
            <p>Current file: <a href="<?= htmlspecialchars($submission['file_url']) ?>" target="_blank">Download</a></p>
        <?php endif; ?>
        <input type="file" name="submission_file">

        <button type="submit"><?= $submission ? 'Update Submission' : 'Submit Assignment' ?></button>
    </form>
<?php endif; ?>

<p style="text-align:center; margin-top: 40px;">
    <a href="learner_assignments.php">← Back to Assignments</a>
</p>

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
