<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['assignment_id'])) {
    die("No assignment specified.");
}

$assignment_id = intval($_GET['assignment_id']);

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
    $filePath = $row['file_url'];
    $studentEmail = $row['student_email'];
    
    if (file_exists($filePath)) {
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
