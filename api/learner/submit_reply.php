<?php
session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$user_email = $_SESSION['email'];
$disc_id    = (int)($_POST['discussion_id'] ?? 0);

if (!$disc_id) { echo json_encode(['error' => 'Missing discussion_id']); exit(); }

// Access check
$disc     = $conn->query("SELECT class_id FROM class_discussions WHERE id = $disc_id")->fetch_assoc();
$class_id = (int)($disc['class_id'] ?? 0);
$in_class = $conn->query("SELECT 1 FROM class_students WHERE class_id = $class_id AND student_email = '$user_email'")->num_rows > 0;

if (!$in_class) { echo json_encode(['error' => 'Access denied']); exit(); }

$message         = trim($_POST['message'] ?? '');
$parent_reply_id = !empty($_POST['reply_to']) ? (int)$_POST['reply_to'] : null;
$attachment      = null;

// File upload
$upload_dir = __DIR__ . '/../../uploads/discussions/';
if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);

if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
    $file    = $_FILES['attachment'];
    $allowed = ['jpg','jpeg','png','gif','pdf','webp','webm','ogg'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (in_array($ext, $allowed) && $file['size'] <= 10 * 1024 * 1024) {
        $filename = uniqid('disc_') . '.' . $ext;
        if (move_uploaded_file($file['tmp_name'], $upload_dir . $filename)) {
            $attachment = $filename;
        } else {
            echo json_encode(['error' => 'Upload failed. Check folder permissions.']); exit();
        }
    } else {
        echo json_encode(['error' => 'Invalid file or too large (max 10MB).']); exit();
    }
}

if (empty($message) && !$attachment) {
    echo json_encode(['error' => 'Message or attachment required']); exit();
}

$name_row      = $conn->query("SELECT name, surname FROM users WHERE email = '$user_email'")->fetch_assoc();
$replier_name  = trim(($name_row['name'] ?? '') . ' ' . ($name_row['surname'] ?? ''));
if ($replier_name === '') $replier_name = 'Learner';
$show_replier_name = 0;

$stmt = $conn->prepare("
    INSERT INTO discussion_replies 
    (discussion_id, parent_reply_id, message, replier_email, replier_anonymous, replier_name, attachment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("iississ", $disc_id, $parent_reply_id, $message, $user_email, $show_replier_name, $replier_name, $attachment);
$stmt->execute();
$new_id = $stmt->insert_id;
$stmt->close();

// Return the new reply so JS can render it instantly
$new_reply = $conn->query("
    SELECT r.id, r.message, r.attachment, r.created_at,
           r.parent_reply_id, r.replier_email,
           u.profile_picture,
           TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))) AS replier_display,
           1 AS is_me
    FROM discussion_replies r
    LEFT JOIN users u ON r.replier_email = u.email
    WHERE r.id = $new_id
")->fetch_assoc();

// Resolve quote if replying to someone
$new_reply['quote_author'] = null;
$new_reply['quote_text']   = null;

if ($parent_reply_id !== null) {
    if ($parent_reply_id === 0) {
        $op = $conn->query("
            SELECT d.initial_message,
                   COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))), ''), d.creator_name, 'Learner') AS creator_display
            FROM class_discussions d
            LEFT JOIN users u ON d.creator_email = u.email
            WHERE d.id = $disc_id
        ")->fetch_assoc();
        if ($op) {
            $new_reply['quote_author'] = $op['creator_display'] ?: 'Learner';
            $new_reply['quote_text']   = substr($op['initial_message'], 0, 100);
        }
    } else {
        $p = $conn->query("
            SELECT r.message,
                   TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))) AS replier_display
            FROM discussion_replies r
            LEFT JOIN users u ON r.replier_email = u.email
            WHERE r.id = $parent_reply_id
        ")->fetch_assoc();
        if ($p) {
            $new_reply['quote_author'] = $p['replier_display'] ?: 'Learner';
            $new_reply['quote_text']   = substr($p['message'] ?? '', 0, 100);
        }
    }
}

echo json_encode(['success' => true, 'reply' => $new_reply]);
