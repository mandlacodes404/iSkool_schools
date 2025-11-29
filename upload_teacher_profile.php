<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || !isset($_SESSION['teacher'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not logged in or not a teacher']);
    exit();
}

$email = $_SESSION['email'];
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
    $file = $_FILES['profile'];
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $allowed = ['jpg','jpeg','png','gif'];

    if (!in_array(strtolower($ext), $allowed)) {
        echo json_encode(['error' => 'Invalid file type']);
        exit();
    }

    $newName = 'teacher_' . time() . '.' . $ext;
    $uploadDir = 'uploads/teachers/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

    $destination = $uploadDir . $newName;
    if (move_uploaded_file($file['tmp_name'], $destination)) {
        $stmt = $conn->prepare("UPDATE users SET profile_picture = ? WHERE email = ?");
        $stmt->bind_param("ss", $newName, $email);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'file' => $newName]);
        exit();
    } else {
        echo json_encode(['error' => 'Failed to move uploaded file']);
        exit();
    }
}

echo json_encode(['error' => 'No file uploaded']);
