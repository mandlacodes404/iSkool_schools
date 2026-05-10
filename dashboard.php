<?php
session_start();

require_once 'config.php';

function redirect_to(string $path): void
{
    header('Location: ' . $path);
    exit();
}

function load_dashboard(string $path): void
{
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

    case 'school_admin':
        if (is_file(__DIR__ . '/school_admin_dashboard.php')) {
            load_dashboard('school_admin_dashboard.php');
        }
        redirect_to('index.php');

    case 'parent':
        if (is_file(__DIR__ . '/parent_dashboard.php')) {
            load_dashboard('parent_dashboard.php');
        }
        redirect_to('index.php');

    default:
        redirect_to('index.php');
}
