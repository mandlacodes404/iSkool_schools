<?php
session_start();
require_once 'config.php';

// 1. Delete the long-session token from the database
if (isset($_COOKIE['remember_me'])) {
    $parts = explode(':', $_COOKIE['remember_me']);
    if (count($parts) === 2) {
        $selector = $parts[0];
        $stmt = $conn->prepare("DELETE FROM user_tokens WHERE selector = ?");
        $stmt->bind_param("s", $selector);
        $stmt->execute();
        $stmt->close();
    }
    
    // 2. Clear the cookie from the browser
    setcookie('remember_me', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

// 3. Standard session clear
session_unset(); 
session_destroy(); 

// 4. Redirect back to login
header("Location: index.php"); 
exit();
?>
