<?php
require_once 'remember_me_functions.php';

// Only run this if the user is NOT already logged in via session
if (!isset($_SESSION['email']) && isset($_COOKIE['remember_me'])) {
    
    // 1. Split the cookie into selector and validator
    $parts = explode(':', $_COOKIE['remember_me']);
    if (count($parts) === 2) {
        $selector = $parts[0];
        $validator = $parts[1];

        // 2. Look for the selector in the database
        $stmt = $conn->prepare("SELECT hashed_validator, user_email, expiry FROM user_tokens WHERE selector = ? LIMIT 1");
        $stmt->bind_param("s", $selector);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($token = $result->fetch_assoc()) {
            // 3. Check if token is expired
            if (strtotime($token['expiry']) >= time()) {
                
                // 4. Verify the validator hash
                if (hash_equals($token['hashed_validator'], hash('sha256', $validator))) {
                    
                    // 5. Fetch user details to restore the session
                    $userEmail = $token['user_email'];
                    $userStmt = $conn->prepare("SELECT name, role, profile_pic FROM users WHERE email = ? AND is_deleted = 0");
                    $userStmt->bind_param("s", $userEmail);
                    $userStmt->execute();
                    $userResult = $userStmt->get_result();

                    if ($user = $userResult->fetch_assoc()) {
                        // RE-ESTABLISH SESSION
                        $_SESSION['email'] = $userEmail;
                        $_SESSION['name'] = $user['name'];
                        $_SESSION['role'] = $user['role'];
                        $_SESSION['profile_pic'] = $user['profile_pic'] ?: 'uploads/default_profile.png';
                        
                        // Set the role-specific session flag
                        $_SESSION[$user['role']] = true;
                    }
                    $userStmt->close();
                }
            }
        }
        $stmt->close();
    }
}
?>