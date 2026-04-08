<?php
session_start();
require 'config.php';

$token = $_GET['token'] ?? '';
$password_reset_complete = false; // Toggle for the UI

if (!$token) {
    die("<style>body{background:#0E0E0E;color:#888;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;}</style><div>Invalid token.</div>");
}

// 1. Check if token is valid
$stmt = $conn->prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()");
$stmt->bind_param("s", $token);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0 && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    die("<style>body{background:#0E0E0E;color:#888;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;}</style><div>This reset link is invalid or has expired.</div>");
}

// 2. Handle Password Update
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

    $password_reset_complete = true; // Show the success UI instead of the form
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Password – iSkool</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    
    <style>
        body, html {
            margin: 0; padding: 0; height: 100%;
            background: #0E0E0E; font-family: 'Inter', sans-serif;
            color: #E3E3E3; display: flex; justify-content: center; align-items: center;
        }

        .container {
            width: 90%; max-width: 400px; text-align: center;
            animation: fadeSlideIn 0.8s ease forwards;
        }

        #iskool-brand svg {
            width: 100px; height: 100px; margin-bottom: 20px;
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.1));
        }

        h2 { font-weight: 400; font-size: 24px; margin-bottom: 10px; color: #FFFFFF; }
        p.subtitle { color: #888; font-size: 15px; margin-bottom: 25px; line-height: 1.5; }

        /* Form Styling */
        .password-wrapper { position: relative; margin-bottom: 15px; }
        input[type="password"], input[type="text"] {
            width: 100%; padding: 14px 20px; border-radius: 24px;
            border: 1px solid #444; background: transparent; color: white;
            font-size: 15px; box-sizing: border-box;
        }
        input:focus { outline: none; border-color: #00ff99; }

        .toggle-password {
            position: absolute; top: 50%; right: 20px;
            transform: translateY(-50%); cursor: pointer; color: #888;
        }

        /* Buttons */
        .btn-action {
            display: block; width: 100%; padding: 14px;
            background-color: #FFFFFF; color: #131314; border: none;
            border-radius: 24px; font-weight: 700; font-size: 15px;
            text-decoration: none; cursor: pointer; transition: 0.2s;
            margin-top: 10px;
        }
        .btn-action:hover { background-color: #F1F1F1; }

        /* Success Specifics */
        .success-icon { font-size: 3rem; color: #00ff99; margin-bottom: 20px; display: block; }

        @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>

<div class="container">
    <div id="iskool-brand">
        <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="120.000000pt" height="120.000000pt" viewBox="0 0 880.000000 805.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,805.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M4275 7173 c-274 -35 -556 -150 -692 -282 -31 -30 -35 -31 -125 -31
-149 0 -352 -26 -498 -64 -507 -130 -844 -438 -956 -875 -13 -51 -24 -108 -24
-125 0 -30 -3 -33 -77 -60 -185 -68 -397 -186 -563 -315 -353 -274 -571 -613
-662 -1031 -19 -91 -23 -133 -22 -310 0 -175 3 -220 23 -310 144 -668 664
-1198 1361 -1388 168 -46 276 -63 450 -69 460 -17 809 126 994 407 56 85 81
146 102 250 16 78 17 167 11 1157 l-5 1073 41 11 c156 41 276 181 309 358 19
106 -33 272 -113 360 -143 156 -416 188 -598 71 -181 -115 -248 -356 -156
-558 44 -97 160 -197 268 -232 l37 -12 0 -1101 0 -1102 -24 -66 c-26 -74 -86
-167 -143 -221 -178 -169 -506 -248 -848 -204 -295 38 -533 126 -772 286 -149
99 -270 204 -361 312 -84 100 -196 269 -185 278 4 4 225 100 491 214 l484 207
41 -42 c143 -143 399 -159 575 -36 181 126 239 356 141 555 -132 269 -520 327
-734 108 -90 -93 -132 -212 -121 -346 6 -75 5 -79 -17 -86 -22 -7 -543 -230
-802 -343 -76 -34 -142 -61 -145 -61 -12 0 -60 169 -81 285 -18 103 -20 144
-16 290 3 102 12 200 22 245 64 289 202 537 419 756 221 221 486 385 761 470
50 15 93 32 96 37 4 5 9 43 13 86 20 220 106 414 253 571 96 103 164 155 284
219 217 116 459 171 751 171 l179 0 57 53 c115 108 254 181 440 229 106 28
133 31 277 32 173 1 244 -12 300 -56 59 -46 55 86 55 -2077 l0 -1990 -50 -22
c-67 -29 -141 -109 -168 -182 -44 -117 -22 -243 58 -338 l41 -49 -27 -47 c-81
-136 -257 -255 -494 -333 -159 -53 -216 -76 -283 -117 -155 -94 -260 -224
-319 -393 -40 -117 -49 -212 -49 -500 l1 -274 25 -26 c35 -35 123 -36 157 -2
23 22 23 27 29 320 5 255 8 307 25 367 64 224 192 350 434 428 146 48 177 50
302 28 234 -41 371 -54 563 -55 460 -1 786 101 1025 321 l65 60 105 -9 c331
-27 708 55 938 205 200 131 331 300 387 502 25 91 31 291 11 400 -9 50 -18 99
-21 110 -5 16 9 31 64 73 92 70 244 230 305 321 101 152 159 291 196 471 132
646 -253 1267 -977 1578 -50 21 -52 24 -58 70 -65 488 -433 871 -976 1016
-156 41 -285 58 -470 59 l-171 2 -24 -28 c-33 -39 -31 -81 5 -118 l29 -29 150
0 c510 0 949 -224 1142 -582 76 -142 115 -283 119 -435 l1 -52 78 -30 c186
-71 327 -148 457 -248 353 -272 531 -627 512 -1017 -15 -290 -135 -538 -368
-761 -52 -50 -129 -115 -171 -145 -85 -60 -89 -70 -62 -136 23 -55 51 -198 53
-274 4 -143 -50 -304 -142 -426 -117 -154 -333 -272 -607 -330 -87 -18 -380
-27 -396 -12 -4 4 -2 13 4 20 27 34 66 201 76 328 2 19 4 380 5 803 1 738 2
767 19 767 11 0 47 14 81 31 205 102 298 328 222 543 -74 212 -302 333 -533
285 -77 -16 -180 -74 -233 -130 -82 -87 -135 -242 -120 -344 28 -181 140 -323
298 -376 l52 -18 0 -793 c0 -891 1 -871 -74 -1033 -84 -179 -226 -296 -461
-380 -152 -54 -403 -88 -585 -79 -141 7 -375 30 -383 39 -4 4 2 11 13 17 40
21 191 185 225 244 l35 62 57 5 c105 9 214 76 262 161 31 53 49 144 42 204
-15 111 -109 237 -197 264 l-39 11 -2 2026 -3 2026 -29 58 c-68 139 -240 208
-516 205 -69 0 -138 -3 -155 -5z m-675 -1313 c220 -112 177 -430 -65 -480
-151 -31 -300 93 -300 250 0 108 76 213 175 245 56 18 138 12 190 -15z m2656
-1035 c69 -20 125 -65 160 -127 38 -69 41 -170 7 -234 -70 -131 -234 -182
-358 -110 -190 112 -162 395 47 467 65 22 81 23 144 4z m-3767 -518 c123 -62
173 -222 106 -345 -69 -126 -213 -173 -334 -107 -66 36 -107 85 -126 149 -20
67 -19 105 6 170 51 138 213 200 348 133z m2463 -1639 c66 -46 81 -141 33
-203 -76 -101 -209 -79 -250 41 -9 27 -10 47 -2 76 11 45 64 104 99 111 37 8
90 -3 120 -25z"/>
</g>
</svg>
    </div>

    <?php if ($password_reset_complete): ?>
        <i class="fas fa-check-circle success-icon"></i>
        <h2>Password Updated!</h2>
        <p class="subtitle">Your password has been successfully reset. You can now use your new credentials to access iSkool.</p>
        <a href="index.php" class="btn-action">Back to Login</a>

    <?php else: ?>
        <h2>Reset Password</h2>
        <p class="subtitle">Secure your account by choosing a new password below.</p>

        <form method="POST">
            <div class="password-wrapper">
                <input type="password" name="password" id="reset-password" placeholder="New password" required>
                <i class="fas fa-eye toggle-password" onclick="togglePassword(this)"></i>
            </div>
            <button type="submit" class="btn-action">Update Password</button>
        </form>
        <div style="margin-top: 25px;">
            <a href="index.php" style="color: #888; text-decoration: none; font-size: 14px;">Cancel and return</a>
        </div>
    <?php endif; ?>
</div>

<script>
function togglePassword(icon) {
    const input = document.getElementById('reset-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}
</script>

</body>
</html>