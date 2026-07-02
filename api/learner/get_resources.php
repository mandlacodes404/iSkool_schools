<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

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

// 3. Fetch resources — now includes resource_type and video_url
$stmt = $conn->prepare("
    SELECT 
        r.id, 
        r.title AS resource_title,
        r.filename, 
        r.uploaded_at,
        r.resource_type,
        r.video_url,
        CONCAT(COALESCE(u.title,''), ' ', COALESCE(u.surname,'Teacher')) AS teacher_display
    FROM resources r
    LEFT JOIN users u ON r.uploaded_by = u.email AND u.role = 'teacher'
    WHERE r.class_id = ? AND r.academic_year_id = ?
    ORDER BY r.uploaded_at DESC
");
$stmt->bind_param("ii", $classId, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

// Helper: format bytes into readable units
function formatSizeUnits($bytes) {
    if ($bytes >= 1073741824) { return number_format($bytes / 1073741824, 2) . ' GB'; }
    elseif ($bytes >= 1048576) { return number_format($bytes / 1048576, 2) . ' MB'; }
    elseif ($bytes >= 1024)    { return number_format($bytes / 1024, 2) . ' KB'; }
    elseif ($bytes > 1)        { return $bytes . ' bytes'; }
    elseif ($bytes == 1)       { return '1 byte'; }
    else                       { return '0 bytes'; }
}

$groupedResources = [];
while ($row = $result->fetch_assoc()) {
    $teacher      = trim($row['teacher_display']) ?: 'Unknown Teacher';
    $resourceType = $row['resource_type'] ?? 'file';
    $filename     = $row['filename'];
    $fileExt      = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    // For file resources: determine size and path
    $fileSize = null;
    $filePath = null;
    if ($resourceType === 'file') {
        $physicalPath = __DIR__ . "/../../resources/" . $filename;
        $fileSize     = file_exists($physicalPath) ? formatSizeUnits(filesize($physicalPath)) : null;
        $filePath     = 'resources/' . rawurlencode($filename);
    }

    $groupedResources[$teacher][] = [
        'id'            => $row['id'],
        'title'         => $row['resource_title'],
        'filename'      => $filename,
        'raw_uploaded_at' => $row['uploaded_at'],
        'uploaded_at'   => date("F j, Y", strtotime($row['uploaded_at'])),
        'ext'           => $fileExt,
        'resource_type' => $resourceType,
        'video_url'     => $row['video_url'] ?? null,
        'size'          => $fileSize,
        'path'          => $filePath,
    ];
}

echo json_encode($groupedResources);
