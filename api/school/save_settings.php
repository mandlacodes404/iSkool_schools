<?php
/**
 * iSkool School Dashboard — Save Settings API
 * Handles school name update and logo upload
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../auth/session_guard.php';
require_once '../../config.php';

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

header('Content-Type: application/json');

$action = trim($_POST['action'] ?? '');

// ── UPDATE SCHOOL NAME ──
if ($action === 'update_name') {
    $name = trim($_POST['school_name'] ?? '');
    if (!$name) {
        echo json_encode(['error' => 'School name cannot be empty']);
        exit();
    }
    if (mb_strlen($name) > 100) {
        echo json_encode(['error' => 'School name too long (max 100 characters)']);
        exit();
    }

    $stmt = $conn->prepare("UPDATE school_name SET setting_value = ? WHERE setting_key = 'school_name'");
    $stmt->bind_param("s", $name);
    $stmt->execute();

    if ($conn->affected_rows >= 0) {
        echo json_encode(['success' => true, 'school_name' => $name]);
    } else {
        echo json_encode(['error' => 'Failed to update school name']);
    }
    exit();
}

// ── UPLOAD LOGO ──
if ($action === 'upload_logo') {
    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['logo']['error'] ?? 'no file';
        echo json_encode(['error' => 'Upload failed (code: ' . $errCode . ')']);
        exit();
    }

    $file     = $_FILES['logo'];
    $maxSize  = 2 * 1024 * 1024; // 2MB
    $allowed  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // Size check
    if ($file['size'] > $maxSize) {
        echo json_encode(['error' => 'File too large. Maximum size is 2MB']);
        exit();
    }

    // Type check (use finfo for safety)
    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowed)) {
        echo json_encode(['error' => 'Invalid file type. Please upload a JPG, PNG, GIF or WebP image']);
        exit();
    }

    // Build destination
    $uploadDir = '../../uploads/schools/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'school_logo_' . time() . '.' . strtolower($ext);
    $destPath = $uploadDir . $filename;
    $dbPath   = 'uploads/schools/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        echo json_encode(['error' => 'Failed to save file. Check folder permissions']);
        exit();
    }

    // Update DB
    $stmt = $conn->prepare("UPDATE school_name SET school_logo = ? WHERE setting_key = 'school_name'");
    $stmt->bind_param("s", $dbPath);
    $stmt->execute();

    echo json_encode(['success' => true, 'logo_path' => $dbPath]);
    exit();
}

// ── GET CURRENT SETTINGS ──
if ($action === 'get' || $action === '') {
    $res = $conn->query("SELECT setting_value, school_logo FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
    if ($row = $res->fetch_assoc()) {
        echo json_encode([
            'school_name' => $row['setting_value'],
            'school_logo' => $row['school_logo'],
        ]);
    } else {
        echo json_encode(['school_name' => '', 'school_logo' => '']);
    }
    exit();
}

echo json_encode(['error' => 'Unknown action']);
