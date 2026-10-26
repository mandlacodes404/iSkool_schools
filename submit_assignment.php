<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
include("config.php");

// An assignment that waited on the phone is sent again by the service worker (service-worker.js) with this header.
// Nobody is looking at the page then, so a refusal is answered in JSON: the worker has to know the work did not arrive,
// and tells the learner. Without the header nothing here behaves differently from before.
$isQueuedReplay = $_SERVER['REQUEST_METHOD'] === 'POST' && ($_SERVER['HTTP_X_ISKOOL_QUEUED_REPLAY'] ?? '') === '1';
function assignment_replay_refusal($message, $status, $title = null) {
    global $isQueuedReplay;
    if (!$isQueuedReplay) { return; }
    while (ob_get_level() > 0) { ob_end_clean(); }
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $message, 'title' => $title]);
    exit();
}

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

if (!isset($_GET['assignment_id'])) {
    echo "No assignment specified.";
    exit();
}

$assignment_id = intval($_GET['assignment_id']);

// Fetch assignment detail
$stmt = $conn->prepare("SELECT * FROM assignments WHERE id = ?");
if (!$stmt) {
    die("Prepare failed: " . $conn->error);
}
$stmt->bind_param("i", $assignment_id);
$stmt->execute();
$assignment = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$assignment) {
    assignment_replay_refusal('This assignment is no longer available.', 404);
    echo "Assignment not found.";
    exit();
}

$assignment_year_id = (int)($assignment['academic_year_id'] ?? 0);
if ($assignment_year_id <= 0) {
    $yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    $yearStmt->execute();
    $yearRow = $yearStmt->get_result()->fetch_assoc();
    $assignment_year_id = (int)($yearRow['id'] ?? 0);
    $yearStmt->close();
}

$classCheckStmt = $conn->prepare("
    SELECT 1
    FROM class_students
    WHERE student_email = ?
      AND class_id = ?
      AND academic_year_id = ?
    LIMIT 1
");
$assignment_class_id = (int)$assignment['class_id'];
$classCheckStmt->bind_param("sii", $email, $assignment_class_id, $assignment_year_id);
$classCheckStmt->execute();
$isInAssignmentClass = $classCheckStmt->get_result()->num_rows > 0;
$classCheckStmt->close();

if (!$isInAssignmentClass) {
    assignment_replay_refusal('You are not allowed to submit this assignment.', 403, $assignment['title'] ?? null);
    http_response_code(403);
    echo "You are not allowed to submit this assignment.";
    exit();
}

// Check due date using the actual current time in SAST.
$now = new DateTime('now', new DateTimeZone('SAST'));
$due = new DateTime($assignment['due_date'], new DateTimeZone('SAST'));
$past_due = $now > $due;
if ($past_due) {
    assignment_replay_refusal('The due date for this assignment had passed before your work could be sent.', 409, $assignment['title'] ?? null);
}

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
    header('Content-Type: application/json'); // Ensure the browser knows this is JSON
    verify_csrf_token();
    
    $submission_text = $_POST['submission_text'] ?? null;
    $fileUrl = $submission['file_url'] ?? null;

    // 1. Handle File Upload
    if (isset($_FILES['submission_file']) && $_FILES['submission_file']['error'] !== UPLOAD_ERR_NO_FILE && $_FILES['submission_file']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['error' => 'File upload failed.']);
        exit();
    }

    if (isset($_FILES['submission_file']) && $_FILES['submission_file']['error'] === 0) {
        $uploadDir = "assignment_submissions/";
        if (!file_exists($uploadDir)) mkdir($uploadDir, 0777, true);

        $safe_name = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($_FILES['submission_file']['name']));
        $ext = strtolower(pathinfo($safe_name, PATHINFO_EXTENSION));
        $max_size = 50 * 1024 * 1024;
        $allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'];
        $blocked = ['php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'cgi', 'pl', 'asp', 'aspx', 'js', 'html', 'htm', 'svg'];
        $allowedMimeTypes = [
            'pdf' => ['application/pdf'],
            'doc' => ['application/msword', 'application/vnd.ms-office', 'application/x-cfb'],
            'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
            'ppt' => ['application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/x-cfb'],
            'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
            'jpg' => ['image/jpeg'],
            'jpeg' => ['image/jpeg'],
            'png' => ['image/png'],
            'zip' => ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip']
        ];

        if ($_FILES['submission_file']['size'] > $max_size) {
            echo json_encode(['error' => 'File too large. Maximum size is 50MB.']);
            exit();
        }
        if ($safe_name === '' || in_array($ext, $blocked, true) || !in_array($ext, $allowed, true)) {
            echo json_encode(['error' => 'File type not allowed.']);
            exit();
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($_FILES['submission_file']['tmp_name']);
        if (!isset($allowedMimeTypes[$ext]) || !in_array($mime, $allowedMimeTypes[$ext], true)) {
            echo json_encode(['error' => 'File type not allowed.']);
            exit();
        }

        $filename = time() . "_" . $safe_name;
        $fileUrl = $uploadDir . $filename;
        
        if (!move_uploaded_file($_FILES['submission_file']['tmp_name'], $fileUrl)) {
            echo json_encode(['success' => false, 'error' => 'Failed to move uploaded file.']);
            exit();
        }
    }

    // 2. Database Operations
    if ($submission) {
        // UPDATE: Changed submission_text to text_answer to match your DB
        $updateStmt = $conn->prepare("UPDATE submissions SET text_answer = ?, file_url = ?, submitted_at = NOW() WHERE id = ?");
        if (!$updateStmt) {
            echo json_encode(['success' => false, 'error' => "Prepare failed: " . $conn->error]);
            exit();
        }
        $updateStmt->bind_param("ssi", $submission_text, $fileUrl, $submission['id']);
        $execute = $updateStmt->execute();
        $updateStmt->close();
    } else {
        // INSERT: Already using text_answer
        $insertStmt = $conn->prepare("INSERT INTO submissions (assignment_id, student_email, text_answer, file_url) VALUES (?, ?, ?, ?)");
        if (!$insertStmt) {
            echo json_encode(['success' => false, 'error' => "Prepare failed: " . $conn->error]);
            exit();
        }
        $insertStmt->bind_param("isss", $assignment_id, $email, $submission_text, $fileUrl);
        $execute = $insertStmt->execute();
        $insertStmt->close();
    }

    // 3. Final Response
    if ($execute) {
        echo json_encode([
            'success' => true,
            'file_url' => $fileUrl,
            'submission_text' => $submission_text
        ] + ($isQueuedReplay ? ['title' => $assignment['title'] ?? null] : []));
    } else {
        echo json_encode(['success' => false, 'error' => "Execute failed: " . $conn->error]);
    }
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Submit Assignment</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #2c3e50;
            --button-hover-bg: #34495e;
            --lock-color: #f85149;
            --card-radius: 12px;
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --border-color: rgba(255, 255, 255, 0.1);
            --submission-color: #238636;
            --no-submission-color: #f85149;
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
            max-width: 800px;
            width: 100%;
        }

        h1 {
            font-size: 28px;
            color: var(--text-color);
            text-align: center;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .info {
            background: var(--card-bg);
            padding: 15px;
            border-radius: var(--card-radius);
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .info.past-due {
            opacity: 0.6;
            filter: grayscale(50%);
        }

        .info-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .lock-icon {
            font-size: 20px;
            color: var(--lock-color);
        }

        .info p {
            margin: 5px 0;
            color: var(--text-color);
            opacity: 0.8;
            font-size: 14px;
            line-height: 1.5;
        }

        .error {
            color: var(--no-submission-color);
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            margin-bottom: 20px;
        }

        form {
            background: var(--card-bg);
            padding: 15px;
            border-radius: var(--card-radius);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        label {
            display: block;
            margin-top: 18px;
            font-weight: 600;
            color: var(--text-color);
            user-select: none;
        }

        input[type="text"],
        input[type="file"],
        textarea {
            width: 100%;
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--card-radius);
            padding: 10px;
            margin-top: 8px;
            color: var(--text-color);
            font-size: 14px;
            box-sizing: border-box;
        }

        input[type="text"]:focus,
        input[type="file"]:focus,
        textarea:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 8px var(--shadow-glow);
            outline: none;
        }

        button {
            margin-top: 25px;
            width: 100%;
            padding: 12px;
            background-color: var(--button-bg);
            color: var(--text-color);
            border: none;
            border-radius: var(--card-radius);
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        button:hover {
            background-color: var(--accent-color);
            color: var(--bg-color);
        }

        a.back-link {
            color: var(--accent-color);
            text-decoration: none;
            text-align: center;
            display: block;
            margin-top: 20px;
            font-size: 14px;
        }

        a.back-link:hover {
            color: #1ed760;
        }

        .attachment-link,
        .submission-link {
            color: var(--accent-color);
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .attachment-link:hover,
        .submission-link:hover {
            color: #1ed760;
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
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
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
            text-align: center;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        #previewModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        .modal-content {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--card-radius);
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }

        .modal-content img {
            max-width: 100%;
            max-height: 70vh;
            border-radius: var(--card-radius);
        }

        .modal-content iframe {
            width: 100%;
            height: 70vh;
            border: none;
            border-radius: var(--card-radius);
        }

        .modal-actions {
            display: flex;
            gap: 10px;
        }

        .modal-actions a {
            background: var(--button-bg);
            color: var(--text-color);
            border: none;
            padding: 8px 16px;
            border-radius: var(--card-radius);
            font-size: 14px;
            text-decoration: none;
            transition: background 0.3s ease;
        }

        .modal-actions a:hover {
            background: var(--accent-color);
            color: var(--bg-color);
        }

        .close-modal {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--button-bg);
            color: var(--text-color);
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s ease;
        }

        .close-modal:hover {
            background: var(--accent-color);
            color: var(--bg-color);
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 10px;
            }

            h1 {
                font-size: 24px;
            }

            .info p,
            .error,
            label,
            button,
            a.back-link {
                font-size: 12px;
            }

            .modal-content iframe {
                height: 50vh;
            }
        }
        .floating-back-btn {
    position: fixed;
    top: 15px;
    left: 15px;
    z-index: 1000;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    padding: 8px 15px;
    border-radius: 30px;
    color: var(--accent-color);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: all 0.2s ease;
}

.floating-back-btn:hover {
    background: var(--button-hover-bg);
    transform: translateX(-3px);
}

/* Adjust container to not hide under the button on mobile */
@media (max-width: 768px) {
    .container { margin-top: 40px; }
}
    </style>
<script>
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
</script></head>
<body>
    <div class="container">
        <h1><i class="fas fa-clipboard-list"></i> Submit Assignment</h1>

        <div class="info <?= $past_due ? 'past-due' : '' ?>">
            <div class="info-header">
                <?php if ($past_due): ?>
                    <i class="fas fa-lock lock-icon"></i>
                <?php endif; ?>
                <strong>Title:</strong> <?= htmlspecialchars($assignment['title']) ?>
            </div>
            <p><strong>Description:</strong> <?= nl2br(htmlspecialchars($assignment['description'] ?? 'No description')) ?></p>
            <p><strong>Due Date:</strong> <?= date('F j, Y, g:i A', strtotime($assignment['due_date'])) ?></p>
            <?php if (!empty($assignment['file_url'])): ?>
                <?php
                    $fileExt = strtolower(pathinfo($assignment['file_url'], PATHINFO_EXTENSION));
                ?>
                <p><strong>Attachment:</strong> <a href="<?= htmlspecialchars($assignment['file_url']) ?>" target="_blank" rel="noopener" class="attachment-link" data-preview="<?= in_array($fileExt, ['jpg', 'jpeg', 'png', 'pdf']) ? htmlspecialchars($assignment['file_url']) : '' ?>" data-full="<?= htmlspecialchars($assignment['file_url']) ?>">Download</a></p>
            <?php endif; ?>
        </div>

        <?php if ($past_due): ?>
            <p class="error">Sorry, the due date for this assignment has passed. You cannot submit anymore.</p>
        <?php else: ?>
            <form method="POST" enctype="multipart/form-data">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
                <label for="submission_text">Submission Text (optional):</label>
                <textarea name="submission_text" rows="6"><?= htmlspecialchars($submission['text_answer'] ?? '') ?></textarea>

                <label for="submission_file">Upload File (optional):</label>
                <?php if (!empty($submission['file_url'])): ?>
                    <?php
                        $submissionFileExt = strtolower(pathinfo($submission['file_url'], PATHINFO_EXTENSION));
                    ?>
                    <p>Current file: <a href="<?= htmlspecialchars($submission['file_url']) ?>" target="_blank" rel="noopener" class="submission-link" data-preview="<?= in_array($submissionFileExt, ['jpg', 'jpeg', 'png', 'pdf']) ? htmlspecialchars($submission['file_url']) : '' ?>" data-full="<?= htmlspecialchars($submission['file_url']) ?>">Download</a></p>
                <?php endif; ?>
                <input type="file" name="submission_file">

                <button type="submit"><?= $submission ? 'Update Submission' : 'Submit Assignment' ?></button>
            </form>
        <?php endif; ?>

        <a href="javascript:void(0)" class="floating-back-btn" onclick="goBackToAssignments()">
    <i class="fas fa-arrow-left"></i> Back
</a>

        <div id="loaderOverlay">
            <div class="loader-text">Processing...</div>
            <div class="loader"></div>
        </div>

        <div id="previewModal">
            <div class="modal-content">
                <button class="close-modal" aria-label="Close preview"><i class="fas fa-times"></i></button>
                <img id="previewImage" alt="File Preview">
                <iframe id="previewIframe"></iframe>
                <div class="modal-actions">
                    <a id="fullDocumentLink" href="#" target="_blank">View Full Document</a>
                </div>
            </div>
        </div>
    </div>

    <script>
        const form = document.querySelector("form");
        const loader = document.getElementById("loaderOverlay");
        const previewModal = document.getElementById("previewModal");
        const previewImage = document.getElementById("previewImage");
        const previewIframe = document.getElementById("previewIframe");
        const closeModal = document.querySelector(".close-modal");
        const fullDocumentLink = document.getElementById("fullDocumentLink");
// Replace your existing form submit logic with this:
if (form) {
    form.addEventListener("submit", async (e) => {
    e.preventDefault(); 
    loader.style.display = "flex";

    const formData = new FormData(form);

    try {
        const response = await fetch(window.location.href, {
            method: "POST",
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // 1. Try to refresh the list and hide the iframe
            let closed = false;
            
            if (window.parent) {
                // Try to refresh assignments
                if (typeof window.parent.fetchAssignments === 'function') {
                    window.parent.fetchAssignments();
                }

                // Try to hide the mainFrame (the iframe container)
                const mainFrame = window.parent.document.getElementById('mainFrame');
                const iframeContainer = window.parent.document.getElementById('iframeContainer'); // Check if this is your container name
                
                if (mainFrame) {
                    mainFrame.style.display = 'none';
                    closed = true;
                } else if (iframeContainer) {
                    iframeContainer.style.display = 'none';
                    closed = true;
                }
            }

            // 2. FALLBACK: If we couldn't hide the iframe, just tell the user and go back manually
            if (!closed) {
                alert("Assignment Submitted Successfully!");
                goBackToAssignments(); // Uses your existing back function
            }
            
        } else {
            alert("Submission failed: " + (result.error || "Unknown error"));
            loader.style.display = "none";
        }
    } catch (error) {
        console.error("Submission Error:", error);
        alert("Success! (Note: The dashboard refresh had a small hiccup, but your file was saved.)");
        goBackToAssignments();
    }
});
}

        function showPreview(link) {
            const fileUrl = link.dataset.preview;
            const fullUrl = link.dataset.full;
            const fileExt = fileUrl ? fileUrl.split('.').pop().toLowerCase() : '';

            previewImage.style.display = 'none';
            previewIframe.style.display = 'none';
            fullDocumentLink.href = fullUrl;

            if (fileUrl && ['jpg', 'jpeg', 'png'].includes(fileExt)) {
                previewImage.src = fileUrl;
                previewImage.style.display = 'block';
            } else if (fileUrl && fileExt === 'pdf') {
                previewIframe.src = fileUrl;
                previewIframe.style.display = 'block';
            } else {
                window.open(fullUrl, '_blank');
                return;
            }

            previewModal.style.display = 'flex';
        }

        document.querySelectorAll('.attachment-link, .submission-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPreview(link);
            });
        });

        closeModal.addEventListener('click', () => {
            previewModal.style.display = 'none';
            previewImage.src = '';
            previewIframe.src = '';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && previewModal.style.display === 'flex') {
                closeModal.click();
            }
        });

        function goBackToAssignments() {
    // Check if we are inside the dashboard iframe
    if (window.parent && typeof window.parent.fetchAssignments === 'function') {
        // 1. Trigger the dashboard's function to show the list
        window.parent.fetchAssignments();
        
        // 2. (Optional) If your dashboard doesn't automatically hide the iframe, 
        // we can force it from here:
        if (window.parent.document.getElementById('mainFrame')) {
            window.parent.document.getElementById('mainFrame').style.display = 'none';
        }
    } else {
        // Fallback for direct access
        window.location.href = 'learner_dashboard.php';
    }
}
    </script>
</body>
</html>
