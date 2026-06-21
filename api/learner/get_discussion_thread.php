<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$user_email = $_SESSION['email'];
$user_role  = $_SESSION['role'];
$disc_id    = (int)($_GET['discussion_id'] ?? 0);
$discussion_type_labels = [
    'homework' => 'Homework help',
    'general' => 'General',
    'off_topic' => 'Off-topic',
];

if (!$disc_id) { echo json_encode(['error' => 'Missing discussion_id']); exit(); }

$discStmt = $conn->prepare("
    SELECT d.*, c.name AS class_name
    FROM class_discussions d
    JOIN classes c ON d.class_id = c.id
    WHERE d.id = ?
");
$discStmt->bind_param("i", $disc_id);
$discStmt->execute();
$disc = $discStmt->get_result()->fetch_assoc();
$discStmt->close();

if (!$disc) { echo json_encode(['error' => 'Discussion not found']); exit(); }

$class_id          = (int)$disc['class_id'];
$classStmt = $conn->prepare("SELECT 1 FROM class_students WHERE class_id = ? AND student_email = ?");
$classStmt->bind_param("is", $class_id, $user_email);
$classStmt->execute();
$is_in_class = $user_role === 'learner' && $classStmt->get_result()->num_rows > 0;
$classStmt->close();

if (!$is_in_class) { echo json_encode(['error' => 'Access denied']); exit(); }

$creatorStmt = $conn->prepare("SELECT profile_picture, name, surname FROM users WHERE email = ?");
$creatorStmt->bind_param("s", $disc['creator_email']);
$creatorStmt->execute();
$creator_row = $creatorStmt->get_result()->fetch_assoc();
$creatorStmt->close();
$creator_pic      = $creator_row['profile_picture'] ?? 'default.png';
$creator_fullname = trim(($creator_row['name'] ?? '') . ' ' . ($creator_row['surname'] ?? ''));
$creator_display  = $creator_fullname ?: ($disc['creator_name'] ?: 'Learner');
$discussion_type  = $disc['type'] ?: 'general';

$stmt = $conn->prepare("
    SELECT r.id, r.message, r.attachment, r.created_at,
           r.parent_reply_id, r.replier_email,
           u.profile_picture,
           TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))) AS replier_display,
           (r.replier_email = ?) AS is_me
    FROM discussion_replies r
    LEFT JOIN users u ON r.replier_email = u.email
    WHERE r.discussion_id = ?
    ORDER BY r.created_at ASC
");
$stmt->bind_param("si", $user_email, $disc_id);
$stmt->execute();
$replies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

foreach ($replies as &$row) {
    if (empty(trim($row['replier_display']))) $row['replier_display'] = 'Learner';

    $row['quote_author'] = null;
    $row['quote_text']   = null;

    if ($row['parent_reply_id'] !== null) {
        $pid = (int)$row['parent_reply_id'];
        if ($pid === 0) {
            $row['quote_author'] = $creator_display;
            $row['quote_text']   = substr($disc['initial_message'], 0, 100);
        } else {
            $pstmt = $conn->prepare("
                SELECT r.message,
                       TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))) AS replier_display
                FROM discussion_replies r
                LEFT JOIN users u ON r.replier_email = u.email
                WHERE r.id = ?
            ");
            $pstmt->bind_param("i", $pid);
            $pstmt->execute();
            $parent = $pstmt->get_result()->fetch_assoc();
            $pstmt->close();
            if ($parent) {
                $row['quote_author'] = $parent['replier_display'] ?: 'Learner';
                $row['quote_text']   = substr($parent['message'] ?? '', 0, 100);
            }
        }
    }
}
unset($row);

echo json_encode([
    'discussion' => [
        'id'              => $disc['id'],
        'title'           => $disc['title'],
        'initial_message' => $disc['initial_message'],
        'type'            => $discussion_type,
        'type_label'      => $discussion_type_labels[$discussion_type] ?? $discussion_type_labels['general'],
        'attachment'      => $disc['attachment'],
        'created_at'      => $disc['created_at'],
        'class_name'      => $disc['class_name'],
        'creator_email'   => $disc['creator_email'],
        'creator_display' => $creator_display,
        'creator_pic'     => $creator_pic,
        'is_op_me'        => ($disc['creator_email'] === $user_email),
    ],
    'replies'     => $replies,
    'user_role'   => $user_role,
    'is_in_class' => $is_in_class,
]);
