<?php
require_once __DIR__ . '/auth/session_guard.php';
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['assignment_id'])) {
    die("No assignment specified.");
}

$assignment_id = intval($_GET['assignment_id']);
$teacher_email = $_SESSION['email'];

$assignmentStmt = $conn->prepare("SELECT id FROM assignments WHERE id = ? AND created_by = ? LIMIT 1");
$assignmentStmt->bind_param("is", $assignment_id, $teacher_email);
$assignmentStmt->execute();
$assignmentExists = $assignmentStmt->get_result()->num_rows === 1;
$assignmentStmt->close();

if (!$assignmentExists) {
    http_response_code(403);
    exit();
}

$base = realpath(__DIR__ . '/assignment_submissions/');
if ($base === false) {
    http_response_code(404);
    exit();
}

// Get all submissions for this assignment
$stmt = $conn->prepare("SELECT student_email, file_url FROM submissions WHERE assignment_id = ? AND submission_type = 'file' AND file_url IS NOT NULL");
$stmt->bind_param("i", $assignment_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    die("No file submissions found for this assignment.");
}

// Create a temp file for zip
$zip = new ZipArchive();
$zipFilename = tempnam(sys_get_temp_dir(), 'submissions_') . '.zip';

if ($zip->open($zipFilename, ZipArchive::CREATE) !== TRUE) {
    die("Could not create ZIP archive.");
}

while ($row = $result->fetch_assoc()) {
    $filePath = realpath($base . '/' . basename($row['file_url']));
    $studentEmail = $row['student_email'];
    
    if ($filePath !== false && strpos($filePath, $base) === 0 && file_exists($filePath)) {
        // Add the file to the zip using email + original filename to avoid collisions
        $fileName = basename($filePath);
        $zip->addFile($filePath, $studentEmail . '_' . $fileName);
    }
}

$zip->close();

// Send the ZIP to the browser
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="assignment_'.$assignment_id.'_submissions.zip"');
header('Content-Length: ' . filesize($zipFilename));
readfile($zipFilename);

// Delete the temp file
unlink($zipFilename);
exit();
?>
