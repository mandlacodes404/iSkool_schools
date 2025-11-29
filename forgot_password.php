<?php
// forgot_password.php
session_start();
?>

<!DOCTYPE html>
<html>
<head>
    <title>Forgot Password – iSkool</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
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

        input[type="email"] {
            width: 100%;
            padding: 12px 18px;
            margin: 10px 0 20px 0;
            border-radius: 9999px;
            border: 1px solid #ffffff;
            background-color: #0d1117;
            color: white;
            font-size: 14px;
        }

        input[type="email"]:focus {
            outline: none;
            border-color: #00bfff;
            box-shadow: 0 0 8px #00bfff;
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

        .message {
            margin-top: 20px;
            color: #00ff99;
            font-size: 14px;
        }

        .error-message {
            margin-top: 20px;
            color: #ff4d4d;
            font-size: 14px;
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



<div class="container">
    <form method="POST" action="send_reset_link.php">
      <div class="brand">iSkool</div>
        <input type="email" name="email" placeholder="Enter your registered email" required>
        <button type="submit">Send Reset Link</button>
    </form>

    <?php
    if (isset($_SESSION['reset_message'])) {
        echo "<p class='message'>{$_SESSION['reset_message']}</p>";
        unset($_SESSION['reset_message']);
    }

    if (isset($_SESSION['reset_error'])) {
        echo "<p class='error-message'>{$_SESSION['reset_error']}</p>";
        unset($_SESSION['reset_error']);
    }
    ?>

    <a class="back" href="index.php">← Back to Login</a>
</div>

</body>
</html>
