<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';
require_once 'school_upload_helper.php';  // ← NEW

if (!isset($_SESSION['email'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not logged in']);
    exit();
}

verify_csrf_token();

$email      = $_SESSION['email'];
$defaultPic = 'default.png';

// ---- Handle remove profile request ----
if (isset($_POST['remove']) && $_POST['remove'] == '1') {
    $stmt = $conn->prepare("UPDATE users SET profile_picture = ? WHERE email = ?");
    $stmt->bind_param("ss", $defaultPic, $email);
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to reset profile']);
    }
    exit();
}

// ---- Handle new profile upload ----
if (isset($_FILES['profile']) && $_FILES['profile']['error'] === 0) {
    $file    = $_FILES['profile'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif'];

    if (!in_array($ext, $allowed)) {
        echo json_encode(['error' => 'Invalid file type']);
        exit();
    }

    // ── CHANGED: school-scoped upload directory ──────────────────────────────
    $uploadDir  = getSchoolUploadDir($conn, 'uploads/learners');
    $schoolSlug = getSchoolSlug($conn);
    // ────────────────────────────────────────────────────────────────────────

    $newName     = 'learner_' . time() . '.' . $ext;
    $destination = $uploadDir . $newName;

    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // Store slug/filename so the serving code can reconstruct the path
        $storedName = $schoolSlug . '/' . $newName;

        $stmt = $conn->prepare("UPDATE users SET profile_picture = ? WHERE email = ?");
        $stmt->bind_param("ss", $storedName, $email);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'file' => $storedName]);
        exit();
    } else {
        echo json_encode(['error' => 'Failed to move uploaded file']);
        exit();
    }
}

// ---- Nothing was saved: say why, instead of a blanket "No file uploaded" ----
// PHP reports an oversized or interrupted upload through $_FILES['profile']['error'] (anything other than 0),
// and throws the whole request away when it exceeds post_max_size (then $_FILES and $_POST are both empty).
if (isset($_FILES['profile'])) {
    $code     = (int)$_FILES['profile']['error'];
    $messages = [
        UPLOAD_ERR_INI_SIZE   => 'That photo is too large for the server (limit ' . ini_get('upload_max_filesize') . '). Please choose a smaller one.',
        UPLOAD_ERR_FORM_SIZE  => 'That photo is too large. Please choose a smaller one.',
        UPLOAD_ERR_PARTIAL    => 'The upload was interrupted. Please try again.',
        UPLOAD_ERR_NO_FILE    => 'No file uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Server error: the temporary upload folder is missing.',
        UPLOAD_ERR_CANT_WRITE => 'Server error: the file could not be written to disk.',
        UPLOAD_ERR_EXTENSION  => 'The upload was blocked by a server extension.',
    ];
    echo json_encode(['error' => $messages[$code] ?? ('Upload failed (error code ' . $code . ')')]);
    exit();
}
if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    echo json_encode(['error' => 'That photo is too large for the server (limit ' . ini_get('post_max_size') . '). Please choose a smaller one.']);
    exit();
}

echo json_encode(['error' => 'No file uploaded']);