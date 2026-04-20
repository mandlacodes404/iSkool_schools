<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require 'vendor/autoload.php';


$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'mandlasimphiwe99@gmail.com';
    $mail->Password = 'qbfn gpyq gmuh fyyx';
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    $mail->setFrom('mandlasimphiwe99@gmail.com', 'Test');
    $mail->addAddress('mandlasimphiwe99@gmail.com');

    $mail->isHTML(true);
    $mail->Subject = 'Test Email';
    $mail->Body    = 'If you got this, PHPMailer works!';

    $mail->send();
    echo 'Message sent successfully.';
} catch (Exception $e) {
    echo "Mailer Error: {$mail->ErrorInfo}";
}
