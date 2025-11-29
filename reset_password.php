<?php
session_start();
require 'config.php';

$token = $_GET['token'] ?? '';
if (!$token) die("Invalid token.");

$stmt = $conn->prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()");
$stmt->bind_param("s", $token);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    die("This reset link is invalid or has expired.");
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $newPassword = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $row = $result->fetch_assoc();
    $email = $row['email'];

    // Update password
    $update = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
    $update->bind_param("ss", $newPassword, $email);
    $update->execute();

    // Delete token
    $delete = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $delete->bind_param("s", $email);
    $delete->execute();

    $_SESSION['login_error'] = "Password successfully reset. You can now login.";
    header("Location: index.php");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Reset Password – iSkool</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        body {
            background-color: #0d1117;
            font-family: 'Nunito', sans-serif;
            color: #ffffff;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 400px;
            margin: 100px auto;
            padding: 30px;
            background-color: #161b22;
            border-radius: 12px;
            box-shadow: 0 0 20px rgba(0, 255, 150, 0.2);
            text-align: center;
        }

        h2 {
            color: #00ff99;
            margin-bottom: 20px;
        }

        .password-wrapper {
            position: relative;
        }

        input[type="password"] {
            width: 100%;
            padding: 12px 18px;
            padding-right: 40px;
            margin: 10px 0 20px 0;
            border-radius: 9999px;
            border: 1px solid #ffffff;
            background-color: #0d1117;
            color: white;
            font-size: 14px;
        }

        input[type="password"]:focus {
            outline: none;
            border-color: #00bfff;
            box-shadow: 0 0 8px #00bfff;
        }

        .toggle-password {
            position: absolute;
            top: 50%;
            right: 14px;
            transform: translateY(-50%);
            cursor: pointer;
            color: #ccc;
        }

        button {
            width: 100%;
            padding: 12px;
            background-color: white;
            color: #0d1117;
            border: none;
            border-radius: 9999px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
        }

        button:hover {
            background-color: #dddddd;
        }

        .brand {
            text-align: center;
            margin-bottom: 30px;
            font-size: 36px;
            color: #00ff99;
            font-weight: 900;
            text-shadow: 0 0 10px #00ff99;
        }

        a.back {
            display: inline-block;
            margin-top: 20px;
            color: #00bfff;
            font-size: 14px;
            text-decoration: none;
        }

        a.back:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>

<div class="brand">iSkool</div>

<div class="container">
    <form method="POST">
        <h2>Enter New Password</h2>
        <div class="password-wrapper">
            <input type="password" name="password" id="reset-password" placeholder="New Password" required>
            <i class="fas fa-eye toggle-password" onclick="togglePassword(this)"></i>
        </div>
        <button type="submit">Reset Password</button>
    </form>
    <a class="back" href="index.php">← Back to Login</a>
</div>

<script>
function togglePassword(icon) {
    const input = document.getElementById('reset-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}
</script>

</body>
</html>
