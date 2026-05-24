<?php
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['learner', 'teacher'])) {
    echo json_encode(['error' => 'Unauthorized']); exit();
}

$user_email = $_SESSION['email'];
$user_role  = $_SESSION['role'];
$disc_id    = (int)($_GET['discussion_id'] ?? 0);

if (!$disc_id) { echo json_encode(['error' => 'Missing discussion_id']); exit(); }

$disc = $conn->query("
    SELECT d.*, c.name AS class_name
    FROM class_discussions d
    JOIN classes c ON d.class_id = c.id
    WHERE d.id = $disc_id
")->fetch_assoc();

if (!$disc) { echo json_encode(['error' => 'Discussion not found']); exit(); }

$class_id          = (int)$disc['class_id'];
$is_tagged_teacher = $user_role === 'teacher' && $conn->query("SELECT 1 FROM discussion_teachers WHERE discussion_id = $disc_id AND teacher_email = '$user_email'")->num_rows > 0;
$is_in_class       = $user_role === 'learner'  && $conn->query("SELECT 1 FROM class_students WHERE class_id = $class_id AND student_email = '$user_email'")->num_rows > 0;

if (!$is_in_class && !$is_tagged_teacher) { echo json_encode(['error' => 'Access denied']); exit(); }

$creator_row      = $conn->query("SELECT profile_picture, name, surname FROM users WHERE email = '{$disc['creator_email']}'")->fetch_assoc();
$creator_pic      = $creator_row['profile_picture'] ?? 'default.png';
$creator_fullname = trim(($creator_row['name'] ?? '') . ' ' . ($creator_row['surname'] ?? ''));
$creator_display  = $creator_fullname ?: ($disc['creator_name'] ?: 'Learner');

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
        'attachment'      => $disc['attachment'],
        'created_at'      => $disc['created_at'],
        'class_name'      => $disc['class_name'],
        'creator_display' => $creator_display,
        'creator_pic'     => $creator_pic,
        'is_op_me'        => ($disc['creator_email'] === $user_email),
    ],
    'replies'     => $replies,
    'user_role'   => $user_role,
    'is_in_class' => $is_in_class,
]);
