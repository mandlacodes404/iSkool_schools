<?php
function create_remember_me_token($conn, $user_email) {
    // Generate secure random strings
    $selector = bin2hex(random_bytes(6)); // 12 characters
    $validator = bin2hex(random_bytes(20)); // 40 characters
    $expiry = date('Y-m-d H:i:s', time() + (86400 * 30)); // Valid for 30 days

    $hashed_validator = hash('sha256', $validator);

    // Save to database
    $stmt = $conn->prepare("INSERT INTO user_tokens (selector, hashed_validator, user_email, expiry) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $selector, $hashed_validator, $user_email, $expiry);
    $stmt->execute();
    $stmt->close();

    // Set cookie: selector:validator
    setcookie('remember_me', $selector . ':' . $validator, [
        'expires'  => time() + (86400 * 30),
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
?>
