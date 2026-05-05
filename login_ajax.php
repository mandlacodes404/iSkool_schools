<?php
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

// ── Only accept POST requests ──
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit();
}

// ── Secure session cookie settings (must match login_register.php) ──
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

require_once 'config.php';
require_once 'remember_me_functions.php';

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please enter your email and password.']);
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
        echo json_encode(['success' => false, 'message' => 'Your account has been deleted.']);
        exit();
    }

    if (password_verify($password, $hashed_password)) {
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
            'admin'        => 'school_admin_dashboard.php',
            'school_admin' => 'school_admin_dashboard.php',
            'teacher'      => 'teacher_dashboard.php',
            'learner'      => 'learner_dashboard.php',
            'parent'       => 'parent_dashboard.php',
        ];

        if (!isset($redirectMap[$role])) {
            echo json_encode(['success' => false, 'message' => 'Unknown account role. Please contact support.']);
            exit();
        }

        echo json_encode(['success' => true, 'redirect' => $redirectMap[$role]]);
        exit();

    } else {
        // Generic — do not reveal whether email or password was the issue
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
        exit();
    }
} else {
    // Generic — do not confirm account existence
    echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    exit();
}
