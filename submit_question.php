<?php
session_start();
include("config.php");

// Only accept POST from logged-in users
if (!isset($_SESSION['email'])) {
    http_response_code(403);
    exit("Not authorized");
}

$email = $_SESSION['email'];
$content = trim($_POST['content'] ?? '');

if ($content === '') {
    $_SESSION['flash_message'] = "Question content cannot be empty.";
    header("Location: qa_feed.php");
    exit;
}

// Handle file upload if it exists
$imagePath = null;
if (isset($_FILES['post_image']) && $_FILES['post_image']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath = $_FILES['post_image']['tmp_name'];
    $fileName = basename($_FILES['post_image']['name']);
    $fileSize = $_FILES['post_image']['size'];
    $fileType = mime_content_type($fileTmpPath);

    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($fileType, $allowedTypes)) {
        $_SESSION['flash_message'] = "Only JPG, PNG, GIF, and WEBP images are allowed.";
        header("Location: qa_feed.php");
        exit;
    }

    if ($fileSize > 5 * 1024 * 1024) {
        $_SESSION['flash_message'] = "File size must be 5MB or less.";
        header("Location: qa_feed.php");
        exit;
    }

    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $newFileName = uniqid('question_img_') . '.' . $ext;

    $uploadDir = 'question_uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $destPath = $uploadDir . $newFileName;

    if (!move_uploaded_file($fileTmpPath, $destPath)) {
        $_SESSION['flash_message'] = "Failed to move uploaded file.";
        header("Location: qa_feed.php");
        exit;
    }

    $imagePath = $destPath;
}

// Insert into questions table
$stmt = $conn->prepare("INSERT INTO questions (user_email, content, image_path, created_at) VALUES (?, ?, ?, NOW())");
$stmt->bind_param("sss", $email, $content, $imagePath);
if ($stmt->execute()) {
    $_SESSION['flash_message'] = "Your question was posted!";
} else {
    $_SESSION['flash_message'] = "Failed to save question.";
}

header("Location: qa_feed.php");
exit;
