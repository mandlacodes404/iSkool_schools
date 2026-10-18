<?php
require_once __DIR__ . '/auth/session_guard.php';

function redirect_to(string $path): void
{
    header('Location: ' . $path);
    exit();
}

function load_dashboard(string $path): void
{
    $_SERVER['SCRIPT_NAME'] = '/dashboard.php';
    $_SERVER['PHP_SELF'] = '/dashboard.php';
    require __DIR__ . '/' . $path;
    exit();
}

$role = $_SESSION['role'] ?? null;

if (!$role) {
    redirect_to('index.php');
}

switch ($role) {
    case 'teacher':
        load_dashboard('teacher_dashboard.php');

    case 'learner':
        load_dashboard('learner_dashboard.php');

    case 'admin':
    case 'school_admin':
        if (is_file(__DIR__ . '/school_admin_dashboard.php')) {
            load_dashboard('school_admin_dashboard.php');
        }
        redirect_to('index.php');

    case 'parent':
        // A parent who came in through a learner's invite link: take them back to confirm it.
        require_once __DIR__ . '/auth/parent_invite_functions.php';
        $pending_invite = $_COOKIE['pending_parent_invite'] ?? '';
        if (parent_invite_is_valid_code_format($pending_invite)) {
            redirect_to('parent_link.php?code=' . rawurlencode($pending_invite));
        }
        if (is_file(__DIR__ . '/parent_dashboard.php')) {
            load_dashboard('parent_dashboard.php');
        }
        redirect_to('index.php');

    default:
        redirect_to('index.php');
}
