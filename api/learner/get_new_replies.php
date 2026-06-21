<?php
/**
 * api/get_new_replies.php
 * Returns new replies posted after a given reply ID for live polling.
 */
require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode([]); exit();
}

$user_email  = $_SESSION['email'];
$user_role   = $_SESSION['role'];
$disc_id     = (int)($_GET['discussion_id'] ?? 0);
$after_id    = (int)($_GET['after_id'] ?? 0);

if ($disc_id === 0) { echo json_encode([]); exit(); }

// Verify access
$discStmt = $conn->prepare("SELECT class_id FROM class_discussions WHERE id = ?");
$discStmt->bind_param("i", $disc_id);
$discStmt->execute();
$disc = $discStmt->get_result()->fetch_assoc();
$discStmt->close();
if (!$disc) { echo json_encode([]); exit(); }

$class_id = (int)$disc['class_id'];

$classStmt = $conn->prepare("SELECT 1 FROM class_students WHERE class_id = ? AND student_email = ?");
$classStmt->bind_param("is", $class_id, $user_email);
$classStmt->execute();
$is_in_class = $user_role === 'learner' && $classStmt->get_result()->num_rows > 0;
$classStmt->close();

if (!$is_in_class) { echo json_encode([]); exit(); }

// Fetch only new replies after the last known ID
$stmt = $conn->prepare("
    SELECT r.id, r.message, r.attachment, r.created_at,
           r.parent_reply_id, r.replier_email,
           u.profile_picture,
           TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))) AS replier_display,
           (r.replier_email = ?) AS is_me
    FROM discussion_replies r
    LEFT JOIN users u ON r.replier_email = u.email
    WHERE r.discussion_id = ? AND r.id > ?
    ORDER BY r.created_at ASC
");
$stmt->bind_param("sii", $user_email, $disc_id, $after_id);
$stmt->execute();
$result = $stmt->get_result();
$rows = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// For each reply, resolve the quoted parent text so the front-end can render it
foreach ($rows as &$row) {
    if (empty(trim($row['replier_display']))) {
        $row['replier_display'] = 'Learner';
    }

    $row['quote_author'] = null;
    $row['quote_text']   = null;

    if ($row['parent_reply_id'] !== null) {
        $pid = (int)$row['parent_reply_id'];
        if ($pid === 0) {
            // Quoting the original post
            $opStmt = $conn->prepare("
                SELECT d.initial_message,
                       COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.name,''), ' ', COALESCE(u.surname,''))), ''), d.creator_name, 'Learner') AS creator_display
                FROM class_discussions d
                LEFT JOIN users u ON d.creator_email = u.email
                WHERE d.id = ?
            ");
            $opStmt->bind_param("i", $disc_id);
            $opStmt->execute();
            $op = $opStmt->get_result()->fetch_assoc();
            $opStmt->close();
            if ($op) {
                $row['quote_author'] = $op['creator_display'] ?: 'Learner';
                $row['quote_text']   = substr($op['initial_message'], 0, 100);
            }
        } else {
            // Quoting another reply
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

echo json_encode(array_values($rows));
