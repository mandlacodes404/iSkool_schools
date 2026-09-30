<?php
require_once __DIR__ . '/session_guard.php';
require_once __DIR__ . '/csrf_helper.php';
/**
 * login_ajax.php
 *
 * AJAX-only login endpoint. Called by fetch() in index.php.
 * Always returns JSON — never redirects or renders HTML.
 *
 * Response shape:
 *   { "success": true,  "redirect": "teacher_dashboard.php" }
 *   { "success": false, "message": "Invalid email or password." }
 */

header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit();
}

verify_csrf_token();

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/remember_me_functions.php';
require_once __DIR__ . '/rate_limit_functions.php';

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please enter your email and password.']);
    exit();
}

$client_ip = auth_rate_limit_client_ip();
$login_window_seconds = 15 * 60;

if (auth_rate_limit_is_blocked($conn, 'login_failed', 'account', $email, 5, $login_window_seconds) ||
    auth_rate_limit_is_blocked($conn, 'login_failed', 'ip', $client_ip, 20, $login_window_seconds)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    exit();
}

$stmt = $conn->prepare("SELECT name, password, profile_pic, role, is_deleted FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 1) {
    $stmt->bind_result($name, $hashed_password, $profile_pic, $role, $is_deleted);
    $stmt->fetch();

    if ($is_deleted == 1) {
        auth_rate_limit_record_attempt($conn, 'login_failed', 'account', $email, $login_window_seconds);
        auth_rate_limit_record_attempt($conn, 'login_failed', 'ip', $client_ip, $login_window_seconds);
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
        exit();
    }

    if (password_verify($password, $hashed_password)) {
        auth_rate_limit_clear($conn, 'login_failed', 'account', $email);
        // Regenerate session ID to prevent session fixation attacks
        session_regenerate_id(true);

        $_SESSION['name']        = $name;
        $_SESSION['email']       = $email;
        $_SESSION['profile_pic'] = $profile_pic ?: 'uploads/default_profile.png';
        $_SESSION['role']        = $role;
        $_SESSION['last_active'] = time(); // 45-min idle timeout enforced by session_guard.php

        // Remember Me
        if (!empty($_POST['remember_me'])) {
            create_remember_me_token($conn, $email);
        }

        // Determine redirect URL based on role
        $redirectMap = [
            'admin'        => 'dashboard',
            'school_admin' => 'dashboard',
            'teacher'      => 'dashboard',
            'learner'      => 'dashboard',
            'parent'       => 'dashboard',
        ];

        if (!isset($redirectMap[$role])) {
            echo json_encode(['success' => false, 'message' => 'Unknown account role. Please contact support.']);
            exit();
        }

        echo json_encode(['success' => true, 'redirect' => $redirectMap[$role]]);
        exit();

    } else {
        auth_rate_limit_record_attempt($conn, 'login_failed', 'account', $email, $login_window_seconds);
        auth_rate_limit_record_attempt($conn, 'login_failed', 'ip', $client_ip, $login_window_seconds);
        // Generic — do not reveal whether email or password was the issue
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
        exit();
    }
} else {
    auth_rate_limit_record_attempt($conn, 'login_failed', 'account', $email, $login_window_seconds);
    auth_rate_limit_record_attempt($conn, 'login_failed', 'ip', $client_ip, $login_window_seconds);
    // Generic — do not confirm account existence
    echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    exit();
}
