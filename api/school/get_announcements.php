<?php
/**
 * iSkool — api/school/get_announcements.php
 * Role: school_admin / admin
 * Returns all school-wide announcements (class_id IS NULL) for the admin dashboard.
 */

ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

session_start();
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    ob_end_flush();
    exit;
}

// ── Active academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYearId = ($yearRes && $row = $yearRes->fetch_assoc()) ? (int)$row['id'] : 0;

// ── Fetch school-wide announcements (class_id IS NULL) ──
// Join with users to get the sender's display name
$res = $conn->query("
    SELECT 
        a.id,
        a.title,
        a.message,
        a.created_by,
        a.created_at,
        a.send_to,
        a.target_role,
        a.term_number,
        CONCAT(
            COALESCE(u.title, ''), ' ',
            UPPER(SUBSTR(TRIM(COALESCE(u.name, '')), 1, 1)), '. ',
            COALESCE(u.surname, '')
        ) AS sender_display,
        u.name    AS sender_name,
        u.surname AS sender_surname,
        u.role    AS sender_role
    FROM announcements a
    LEFT JOIN users u ON u.email = a.created_by
    WHERE a.class_id IS NULL
      AND a.academic_year_id = $currentYearId
    ORDER BY a.created_at DESC
    LIMIT 100
");

$announcements = [];

if ($res) {
    while ($row = $res->fetch_assoc()) {
        // Clean up display name
        $displayName = trim($row['sender_display']);
        // Fallback: if name is empty, use email prefix
        if ($displayName === '.' || empty(trim($displayName, '. '))) {
            $displayName = explode('@', $row['created_by'])[0];
        }

        $announcements[] = [
            'id'             => (int)$row['id'],
            'title'          => $row['title'],
            'message'        => $row['message'],
            'created_by'     => $row['created_by'],
            'sender_display' => $displayName,
            'sender_role'    => $row['sender_role'] ?? 'school_admin',
            'target_role'    => $row['target_role'],  // 'all' | 'learners' | 'teachers'
            'send_to'        => $row['send_to'],
            'term_number'    => (int)$row['term_number'],
            'created_at'     => $row['created_at'],
        ];
    }
}

echo json_encode([
    'success'       => true,
    'announcements' => $announcements,
    'count'         => count($announcements),
]);

ob_end_flush();