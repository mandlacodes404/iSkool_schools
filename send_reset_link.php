<?php
session_start();
require 'config.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

$email = trim($_POST['email']);

// 1. Check if user exists
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$userResult = $stmt->get_result();

if ($userResult->num_rows === 0) {
    $_SESSION['reset_message'] = "No account found with that email.";
    header("Location: forgot_password.php");
    exit();
}

// 2. Create token & expiry
$token = bin2hex(random_bytes(32));
$expires_at = date("Y-m-d H:i:s", time() + 3600);

// 3. Store token
$stmt = $conn->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $email, $token, $expires_at);
$stmt->execute();

// 4. Generate the dynamic Reset Link (Automatically uses the current school's subdomain)
$resetLink = BASE_URL . "reset_password.php?token=$token";

// 5. Send email via iSkool Server
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'iskool.online'; // Check your hosting for the exact SMTP host
    $mail->SMTPAuth   = true;
    $mail->Username   = 'support@iskool.online';
    $mail->Password   = 'ogeQkRitRfdy'; // The password for support@iskool.online
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // Using SSL
    $mail->Port       = 465;

    $mail->setFrom('support@iskool.online', 'iSkool Support');
    $mail->addAddress($email);

    $mail->isHTML(true);
    $mail->Subject = 'Reset Your iSkool Password';
    
    // Modernized email body to match your new Gemini-style UI
    $mail->Body = "
        <div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>
            <h2>Password Reset Request</h2>
            <p>Hi there,</p>
            <p>We received a request to reset your password for your iSkool account. Click the button below to proceed:</p>
            <div style='margin: 30px 0;'>
                <a href='$resetLink' style='padding: 14px 25px; background: #000; color: #fff; text-decoration: none; border-radius: 25px; font-weight: bold;'>Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <hr style='border: none; border-top: 1px solid #eee; margin-top: 30px;'>
            <p style='font-size: 12px; color: #888;'>Sent from iSkool Support - " . $_SERVER['HTTP_HOST'] . "</p>
        </div>
    ";

    $mail->send();
    $_SESSION['reset_message'] = "Reset link sent to your email.";

} catch (Exception $e) {
    $_SESSION['reset_error'] = "Email could not be sent. Please try again later.";
}

header("Location: forgot_password.php");
exit();