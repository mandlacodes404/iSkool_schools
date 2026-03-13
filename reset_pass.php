<?php
require_once 'config.php';
$hash = password_hash('admin123', PASSWORD_DEFAULT);
$conn->query("UPDATE users SET password='$hash' WHERE email='admin1@gmail.com'");
echo "Done! Password is now: admin123";
?>