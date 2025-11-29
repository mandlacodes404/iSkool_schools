<?php
session_start();
require 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

$email = trim($_POST['email']);

// Check if user exists
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$userResult = $stmt->get_result();

if ($userResult->num_rows === 0) {
    $_SESSION['reset_message'] = "No account found with that email.";
    header("Location: forgot_password.php");
    exit();
}

// Create token & expiry
$token = bin2hex(random_bytes(32));
$expires_at = date("Y-m-d H:i:s", time() + 3600); // 1 hour from now

// Store token
$stmt = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $email, $token, $expires_at);
$stmt->execute();

// Send email
$resetLink = "http://localhost/servicePortal/reset_password.php?token=$token";

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host = 'smtp.gmail.com';
$mail->SMTPAuth = true;
$mail->Username = 'mandlasimphiwe99@gmail.com';
$mail->Password = 'qbfn gpyq gmuh fyyx';
$mail->SMTPSecure = 'tls';
$mail->Port = 587;

$mail->setFrom('mandlasimphiwe99@gmail.com', 'iSkool Password Reset');
$mail->addAddress($email);
$mail->isHTML(true);
$mail->Subject = 'Reset Your iSkool Password';
$mail->Body = "
    <p>Hi there,</p>
    <p>Click the button below to reset your password. This link will expire in 1 hour:</p>
    <a href='$resetLink' style='padding: 10px 15px; background: #00bfff; color: white; text-decoration: none; border-radius: 6px;'>Reset Password</a>
    <p>If you didn't request this, you can ignore this email.</p>
";

$mail->send();

$_SESSION['reset_message'] = "Reset link sent to your email.";
header("Location: forgot_password.php");
exit();
