<?php
/**
 * iSkool — api/school/create_announcement.php
 * Role: school_admin / admin
 * Creates a school-wide announcement and pushes to selected audience.
 * Push only — no email (school-wide volume).
 */

ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';
require_once dirname(__DIR__, 2) . '/push_functions.php';

header('Content-Type: application/json');

// ── Auth gate ──
if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    ob_end_flush();
    exit;
}

$adminEmail = $_SESSION['email'];

// ── School name (used as push sender label) ──
$schoolName = 'iSkool';
$snRes = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($snRes && $row = $snRes->fetch_assoc()) {
    $schoolName = $row['setting_value'];
}

// ── Academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if (!$yearRes || $yearRes->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'No active academic year found.']);
    ob_end_flush();
    exit;
}
$currentYearId = (int)$yearRes->fetch_assoc()['id'];

// ── Current term ──
$termRes    = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
$currentTerm = ($termRes && $row = $termRes->fetch_assoc()) ? (int)$row['current_global_term'] : 1;

// ── Input ──
$title    = trim($_POST['title']    ?? '');
$message  = trim($_POST['message']  ?? '');
$sendTo   = trim($_POST['send_to']  ?? 'both'); // 'learners' | 'teachers' | 'both'

if (empty($title) || empty($message)) {
    echo json_encode(['success' => false, 'error' => 'Title and message are required.']);
    ob_end_flush();
    exit;
}

if (!in_array($sendTo, ['learners', 'teachers', 'both'])) {
    $sendTo = 'both';
}

// ── Map send_to → target_role for DB ──
// target_role: 'learners' | 'teachers' | 'all'
$targetRole = match($sendTo) {
    'learners' => 'learners',
    'teachers' => 'teachers',
    default    => 'all',
};

// ── Insert announcement (class_id NULL = school-wide) ──
$stmt = $conn->prepare("
    INSERT INTO announcements 
        (class_id, title, message, created_by, academic_year_id, term_number, send_to, target_role)
    VALUES 
        (NULL, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param(
    "sssiiss",      // ← 7 type chars (removed one 's')
    $title,
    $message,
    $adminEmail,
    $currentYearId,
    $currentTerm,
    $sendTo,
    $targetRole
);

if (!$stmt->execute()) {
    error_log('Admin announcement insert failed: ' . $stmt->error);
    echo json_encode(['success' => false, 'error' => 'Failed to save announcement.']);
    $stmt->close();
    ob_end_flush();
    exit;
}
$stmt->close();

// ── Push notification link ──
// Learners go to their announcement list; teachers go to theirs
$cleanBase      = rtrim(BASE_URL, '/');
$learnerLink    = $cleanBase . '/learner_dashboard.php?page=announcement_list.php';
$teacherLink    = $cleanBase . '/teacher_dashboard.php?page=announcements.php';

$pushTitle = $schoolName . ': ' . $title;
$sent      = 0;
$failed    = 0;

// ══════════════════════════════════════
// PUSH TO LEARNERS
// ══════════════════════════════════════
if (in_array($sendTo, ['learners', 'both'])) {

    $lRes = $conn->query("
        SELECT email 
        FROM users 
        WHERE role = 'learner'
    ");

    if ($lRes) {
        while ($row = $lRes->fetch_assoc()) {
            $rEmail = $row['email'];

            // Only push if they have a subscription
            $chk = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
            $chk->bind_param("s", $rEmail);
            $chk->execute();
            $hasSub = $chk->get_result()->num_rows > 0;
            $chk->close();

            if ($hasSub) {
                $ok = sendPushToUser($conn, $rEmail, $pushTitle, $message, $learnerLink);
                $ok ? $sent++ : $failed++;
            }
        }
    }
}

// ══════════════════════════════════════
// PUSH TO TEACHERS
// ══════════════════════════════════════
if (in_array($sendTo, ['teachers', 'both'])) {

    $tRes = $conn->query("
        SELECT email 
        FROM users 
        WHERE role = 'teacher'
    ");

    if ($tRes) {
        while ($row = $tRes->fetch_assoc()) {
            $rEmail = $row['email'];

            $chk = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
            $chk->bind_param("s", $rEmail);
            $chk->execute();
            $hasSub = $chk->get_result()->num_rows > 0;
            $chk->close();

            if ($hasSub) {
                $ok = sendPushToUser($conn, $rEmail, $pushTitle, $message, $teacherLink);
                $ok ? $sent++ : $failed++;
            }
        }
    }
}

echo json_encode([
    'success'     => true,
    'sent'        => $sent,
    'failed'      => $failed,
    'target_role' => $targetRole,
    'message'     => 'Announcement sent to ' . $targetRole . '.'
]);

ob_end_flush();