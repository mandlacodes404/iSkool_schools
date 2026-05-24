<?php
function verify_csrf_token() {
    $token = null;

    // Check POST body first
    if (isset($_POST['csrf_token'])) {
        $token = $_POST['csrf_token'];
    }

    // Check JSON body
    if ($token === null) {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['csrf_token'])) {
            $token = $input['csrf_token'];
        }
    }

    // Check request header (for fetch() calls)
    if ($token === null && isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    }

    if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token ?? '')) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit;
    }
}
