<?php


// create_super_admin.php
// Run this once on any school subdomain to create the global super admin

require_once 'config.php'; // your normal database connection

// Change these if you want
$email    = 'superadmin@iskool.co.za';
$name     = 'Super Admin';
$title    = 'Mr';
$surname  = 'iSkool';
$role     = 'admin';           // THIS IS THE SUPER-POWER ROLE
$password = '';                // You will type it below

echo "<h2>Create / Update Super Admin Account</h2>";
echo "<pre style='background:#1e1e1e;color:#f0f0f0;padding:20px;border-radius:8px;'>";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';
    
    if (strlen($password) < 4) {
        die("Password too short!");
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Upsert (update if exists, insert if not)
    $stmt = $conn->prepare("
        INSERT INTO users 
            (email, name, title, surname, password, role, profile_pic, is_deleted)
        VALUES 
            (?, ?, ?, ?, ?, ?, 'uploads/default_profile.png', 0)
        ON DUPLICATE KEY UPDATE
            password = VALUES(password),
            name = VALUES(name),
            role = VALUES(role)
    ");
    $stmt->bind_param("ssssss", $email, $name, $title, $surname, $hash, $role);
    
    if ($stmt->execute()) {
        echo "SUCCESS!\n\n";
        echo "Super Admin created/updated successfully.\n";
        echo "Email   : $email\n";
        echo "Password: $password   ← you typed this\n";
        echo "Role    : $role\n\n";
        echo "You can now log in immediately.\n";
        echo "Delete or rename this file after use for security!\n";
    } else {
        echo "Error: " . $stmt->error;
    }
    $stmt->close();
    echo "</pre>";
    echo "<hr><small>You can now close this page and delete this file.</small>";
    exit;
}
?>

<form method="POST">
    <p><strong>Email:</strong> <?= htmlspecialchars($email) ?> (fixed)</p>
    <p><strong>Enter the password you want to use:</strong></p>
    <input type="text" name="password" required autocomplete="off" 
           style="width:400px;padding:12px;font-size:18px;" 
           placeholder="e.g. MySecretPass2025!" autofocus>
    <br><br>
    <button type="submit" style="padding:12px 30px;font-size:18px;background:#58a6ff;color:black;border:none;border-radius:8px;cursor:pointer;">
        Create / Update Super Admin
    </button>
</form>

<hr>
<small>
    This script uses ON DUPLICATE KEY UPDATE so it's safe to run multiple times.<br>
    After it works → delete or rename this file so nobody else can use it.
</small>
</pre>