<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$learnerEmail = $_SESSION['email'];

// School name
$schoolName = 'My School';
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $schoolName = $row['setting_value'];
}

// Current year
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYearName = "Current Year";
$currentYearId = 0;
if ($row = $currentYearResult->fetch_assoc()) {
    $currentYearId = (int)$row['id'];
    $currentYearName = $row['name'];
}

// Learner info
$learnerName = $learnerSurname = $learnerFullName = '';
$learnerProfilePicture = 'default.png';
$stmt = $conn->prepare("SELECT name, surname, profile_picture FROM users WHERE email = ?");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
if ($row = $stmt->get_result()->fetch_assoc()) {
    $learnerName = $row['name'] ?? '';
    $learnerSurname = $row['surname'] ?? '';
    $learnerProfilePicture = $row['profile_picture'] ?: 'default.png';
    $learnerFullName = trim($learnerName . ' ' . $learnerSurname);
}
$stmt->close();

// Classes
$classes = [];
$classesStmt = $conn->query("SELECT id, name FROM classes ORDER BY name ASC");
while ($row = $classesStmt->fetch_assoc()) {
    $classes[] = $row;
}

// Joined classes
$joinedClassIds = [];
if ($currentYearId > 0) {
    $stmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ? AND academic_year_id = ?");
    $stmt->bind_param("si", $learnerEmail, $currentYearId);
} else {
    $stmt = $conn->prepare("SELECT class_id FROM class_students WHERE student_email = ?");
    $stmt->bind_param("s", $learnerEmail);
}
$stmt->execute();
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    $joinedClassIds[] = (int)$row['class_id'];
}
$stmt->close();

// Parents linked to this learner (by invite link, see create_parent_invite.php)
$parentLinks = [];
$stmt = $conn->prepare("
    SELECT pl.id, u.name, u.surname
    FROM parent_links pl
    JOIN users u ON u.email = pl.parent_email AND u.role = 'parent' AND u.is_deleted = 0
    WHERE pl.learner_email = ?
    ORDER BY u.name, u.surname
");
$stmt->bind_param("s", $learnerEmail);
$stmt->execute();
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    $parentLinks[] = ['id' => (int)$row['id'], 'name' => trim($row['name'] . ' ' . $row['surname'])];
}
$stmt->close();

echo json_encode([
    'schoolName' => $schoolName,
    'currentYearName' => $currentYearName,
    'learnerName' => $learnerFullName,
    'learnerEmail' => $learnerEmail,
    'profilePicture' => $learnerProfilePicture,
    'classes' => $classes,
    'joinedClassIds' => $joinedClassIds,
    'parentLinks' => $parentLinks
]);
?>