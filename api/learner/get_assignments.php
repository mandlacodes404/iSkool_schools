<?php
header("Content-Type: application/json");

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$studentEmail = $_SESSION['email'];
$currentDateTime = date('Y-m-d H:i:s');

/**
 * Build a display name like "Mr SK.Mahlangu" (name=Sipho, second_name=Kagiso, surname=Mahlangu)
 * or "Mr S.Mahlangu" when there's no second_name.
 * Also returns 2-letter avatar initials: always first-name-initial + surname-initial (e.g. "SM").
 */
function buildTeacherNameParts(?string $title, ?string $name, ?string $secondName, ?string $surname): array {
    $name = trim((string)$name);
    $secondName = trim((string)$secondName);
    $surname = trim((string)$surname);
    $title = trim((string)$title);

    if ($name === '' && $surname === '') {
        return ['display' => 'Teacher', 'initials' => 'T'];
    }

    $firstInitial = $name !== '' ? mb_strtoupper(mb_substr($name, 0, 1)) : '';
    $secondInitial = $secondName !== '' ? mb_strtoupper(mb_substr($secondName, 0, 1)) : '';
    $surnameForDisplay = $surname !== '' ? $surname : 'Teacher';

    $initialsBlock = $firstInitial . $secondInitial;
    $display = trim(($title !== '' ? $title . ' ' : '') . $initialsBlock . '.' . $surnameForDisplay);

    // Avatar initials: always just first-name initial + surname initial
    $surnameInitial = $surname !== '' ? mb_strtoupper(mb_substr($surname, 0, 1)) : '';
    $avatarInitials = ($firstInitial . $surnameInitial) ?: 'T';

    return ['display' => $display, 'initials' => $avatarInitials];
}

// 1. Get Academic Year
$yearStmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$yearStmt->execute();
$yearRes = $yearStmt->get_result();
$current_academic_year_id = (int)($yearRes->fetch_assoc()['id'] ?? 0);
$yearStmt->close();

// 2. Get Assignments with Submission Status
$sql = "
    SELECT DISTINCT
        a.id, a.title, a.description, a.due_date, a.file_url, a.created_at,
        c.name AS class_name,
        u.title       AS t_title,
        u.name        AS t_name,
        u.second_name AS t_second_name,
        u.surname     AS t_surname,
        s.id AS submission_id,
        s.file_url AS submission_url,
        s.text_answer AS submission_text
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    JOIN class_students cs ON a.class_id = cs.class_id AND cs.academic_year_id = ?
    LEFT JOIN users u ON a.created_by = u.email
    LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_email = ?
    WHERE cs.student_email = ? 
      AND a.academic_year_id = ?
    ORDER BY a.due_date ASC
";

$stmt = $conn->prepare($sql);
// We now have 4 parameters: academic_year_id, student_email, student_email, academic_year_id
$stmt->bind_param("issi", $current_academic_year_id, $studentEmail, $studentEmail, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

$grouped = [];
while ($row = $result->fetch_assoc()) {
    $isPastDue = (!empty($row['due_date']) && $row['due_date'] < $currentDateTime);

    $nameParts = buildTeacherNameParts(
        $row['t_title'],
        $row['t_name'],
        $row['t_second_name'],
        $row['t_surname']
    );
    $teacherDisplay = $nameParts['display'];

    $grouped[$teacherDisplay][] = [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'due_date' => $row['due_date'] ? date('M j, Y, g:i A', strtotime($row['due_date'])) : 'No Due Date',
        'created_at' => $row['created_at'],
        'is_past_due' => $isPastDue,
        'teacher_file' => $row['file_url'],
        'has_submission' => !empty($row['submission_id']),
        'submission_file' => $row['submission_url'],
        'submission_text' => $row['submission_text'],
        'class_name' => $row['class_name'],
        'teacher_initials' => $nameParts['initials']
    ];
}
echo json_encode($grouped);
