<?php
session_start();
require_once 'config.php';
require_once 'school_upload_helper.php';  // ← NEW

if (!isset($_SESSION['email'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not logged in']);
    exit();
}

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

echo json_encode(['error' => 'No file uploaded']);