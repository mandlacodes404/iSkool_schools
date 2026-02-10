<?php
session_start();
require_once '../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

// 1. Get current active academic year
$currentYearResult = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = ($currentYearResult->num_rows > 0) ? (int)$currentYearResult->fetch_assoc()['id'] : 0;

// 2. Get learner's class ID
$classQuery = $conn->prepare("
    SELECT class_id FROM class_students 
    WHERE student_email = ? AND academic_year_id = ? LIMIT 1
");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

if (!$classId) {
    echo json_encode([]);
    exit();
}

// 3. Fetch resources
$stmt = $conn->prepare("
    SELECT 
        r.id, 
        r.title AS resource_title,
        r.filename, 
        r.uploaded_at,
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display
    FROM resources r
    LEFT JOIN users u ON r.uploaded_by = u.email AND u.role = 'teacher'
    WHERE r.class_id = ? AND r.academic_year_id = ?
    ORDER BY r.uploaded_at DESC
");
$stmt->bind_param("ii", $classId, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

// --- NEW: Helper function to format bytes into readable units ---
function formatSizeUnits($bytes) {
    if ($bytes >= 1073741824) { $bytes = number_format($bytes / 1073741824, 2) . ' GB'; }
    elseif ($bytes >= 1048576) { $bytes = number_format($bytes / 1048576, 2) . ' MB'; }
    elseif ($bytes >= 1024) { $bytes = number_format($bytes / 1024, 2) . ' KB'; }
    elseif ($bytes > 1) { $bytes = $bytes . ' bytes'; }
    elseif ($bytes == 1) { $bytes = $bytes . ' byte'; }
    else { $bytes = '0 bytes'; }
    return $bytes;
}

$groupedResources = [];
while ($row = $result->fetch_assoc()) {
    $teacher = trim($row['teacher_display']) ?: 'Unknown Teacher';
    $filename = $row['filename'];
    $fileExt = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    
    // Determine the physical path to check size
    // Adjust '../resources/' to match your actual server directory
    $filePath = "../resources/" . $filename; 
    $fileSize = (file_exists($filePath)) ? formatSizeUnits(filesize($filePath)) : "Unknown Size";

    $groupedResources[$teacher][] = [
        'id'          => $row['id'],
        'title'       => $row['resource_title'],
        'filename'    => $filename,
        'uploaded_at' => date("F j, Y", strtotime($row['uploaded_at'])),
        'ext'         => $fileExt,
        'size'        => $fileSize, // <--- ADDED THIS
        'path'        => 'resources/' . rawurlencode($filename)
    ];
}

echo json_encode($groupedResources);