<?php
header("Content-Type: application/json");

session_start();
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

// Parent link
$parentLink = null;
$parentsInClass = [];
if (!empty($joinedClassIds)) {
    $classId = $joinedClassIds[0];
    $stmt = $conn->prepare("SELECT parent_email FROM parent_links WHERE learner_email = ? AND class_id = ?");
    $stmt->bind_param("si", $learnerEmail, $classId);
    $stmt->execute();
    if ($row = $stmt->get_result()->fetch_assoc()) {
        $parentLink = $row['parent_email'];
    }
    $stmt->close();

    $stmt = $conn->prepare("SELECT u.email, u.name FROM parent_classes pc JOIN users u ON pc.parent_email = u.email WHERE pc.class_id = ? AND u.role = 'parent'");
    $stmt->bind_param("i", $classId);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $parentsInClass[] = $row;
    }
    $stmt->close();
}

echo json_encode([
    'schoolName' => $schoolName,
    'currentYearName' => $currentYearName,
    'learnerName' => $learnerFullName,
    'learnerEmail' => $learnerEmail,
    'profilePicture' => $learnerProfilePicture,
    'classes' => $classes,
    'joinedClassIds' => $joinedClassIds,
    'parentLink' => $parentLink,
    'parentsInClass' => $parentsInClass
]);
?>