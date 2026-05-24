<?php
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_start();
}

// Session timeout — 1 hour
$timeout = 60 * 60;
if (isset($_SESSION['last_active']) && 
    (time() - $_SESSION['last_active']) > $timeout) {
    session_unset();
    session_destroy();
    header('Location: /index.php?session=expired');
    exit;
}
if (isset($_SESSION['email'])) {
    $_SESSION['last_active'] = time();
}
