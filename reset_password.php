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
 width="180" height="180" viewBox="0 0 1024.000000 1024.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M4860 8273 c-99 -9 -278 -37 -382 -59 -157 -33 -371 -102 -365 -117
108 -273 228 -578 236 -598 l10 -27 114 33 c62 19 185 46 273 61 143 26 182
28 389 28 254 0 362 -12 590 -66 72 -16 139 -31 150 -32 16 -1 38 45 142 299
67 165 121 304 119 310 -3 11 -133 53 -276 90 -118 30 -302 61 -439 75 -94 9
-477 12 -561 3z"/>
<path d="M6434 7923 c-55 -123 -234 -545 -234 -551 0 -4 42 -28 93 -54 354
-180 693 -486 927 -835 30 -45 59 -82 64 -83 10 0 556 278 569 290 12 10 -11
53 -100 188 -284 431 -682 789 -1163 1045 -129 68 -125 68 -156 0z"/>
<path d="M3640 7902 c-199 -108 -300 -174 -470 -306 -133 -103 -360 -328 -473
-471 -112 -140 -318 -450 -305 -459 15 -11 600 -297 602 -294 2 2 27 39 56 83
231 347 515 615 866 817 63 37 121 69 127 71 8 2 -3 39 -31 103 -23 54 -82
194 -130 309 -51 119 -95 211 -103 213 -8 1 -70 -29 -139 -66z"/>
<path d="M4865 7184 c-165 -25 -365 -76 -365 -94 0 -13 111 -304 120 -313 4
-5 63 5 131 23 74 18 178 36 257 43 l132 11 0 173 0 173 -92 -1 c-51 -1 -133
-7 -183 -15z"/>
<path d="M6030 6997 c0 -1 -27 -63 -61 -137 -33 -74 -65 -145 -69 -156 -8 -20
1 -27 83 -74 51 -29 128 -77 172 -109 105 -74 304 -273 389 -388 38 -51 70
-93 71 -93 6 0 291 152 298 160 12 11 -4 39 -83 146 -185 249 -431 464 -691
603 -87 47 -109 56 -109 48z"/>
<path d="M4117 6931 c-200 -112 -408 -284 -555 -458 -81 -96 -211 -271 -212
-285 0 -5 306 -168 316 -168 2 0 31 41 65 90 71 104 211 256 313 339 61 50
157 116 272 187 l32 19 -72 162 -72 162 -87 -48z"/>
<path d="M4365 6339 c-415 -266 -667 -717 -667 -1194 0 -124 17 -283 32 -299
10 -10 236 57 233 70 -1 5 -6 62 -13 127 -25 257 41 515 192 743 102 155 248
291 417 391 11 7 -88 213 -103 213 -6 0 -47 -23 -91 -51z"/>
<path d="M7730 6249 c-157 -77 -288 -140 -291 -141 -4 -2 18 -75 47 -164 62
-186 107 -388 125 -559 22 -217 -1 -598 -47 -781 -5 -21 3 -25 128 -64 73 -23
209 -66 303 -96 93 -29 170 -52 172 -50 7 6 44 165 59 250 33 192 42 306 42
536 0 336 -34 574 -129 879 -31 104 -112 319 -122 326 -1 1 -130 -60 -287
-136z"/>
<path d="M2219 6313 c-75 -173 -153 -464 -192 -713 -31 -198 -30 -605 1 -805
28 -178 80 -395 97 -401 10 -4 271 66 546 147 l66 19 -18 92 c-38 194 -52 363
-46 563 8 277 41 462 128 727 24 70 40 130 38 133 -6 6 -589 285 -595 285 -3
0 -14 -21 -25 -47z"/>
<path d="M7055 5922 c-6 -4 -75 -39 -155 -77 -80 -37 -146 -69 -148 -70 -1 -1
13 -49 32 -106 77 -228 107 -468 86 -677 -6 -64 -15 -136 -19 -159 -9 -49 -34
-36 193 -103 76 -23 140 -40 141 -38 14 16 38 227 42 380 8 273 -22 476 -108
726 -43 124 -49 137 -64 124z"/>
<path d="M3195 5865 c-30 -73 -75 -226 -94 -321 -35 -177 -44 -285 -38 -482 5
-174 11 -234 38 -353 l10 -45 175 50 c129 37 173 54 169 64 -15 38 -36 262
-34 367 2 183 38 397 94 554 8 24 15 45 15 47 0 3 -227 114 -287 140 -33 14
-33 14 -48 -21z"/>
<path d="M5012 5670 c-97 -26 -163 -63 -233 -132 -171 -168 -200 -440 -68
-637 115 -172 332 -262 531 -220 201 43 363 213 398 419 29 171 -26 326 -160
454 -124 119 -295 161 -468 116z"/>
<path d="M6382 5600 c-56 -27 -102 -51 -102 -52 0 -2 9 -30 19 -64 41 -128 54
-238 48 -393 -9 -234 -62 -405 -182 -593 -89 -137 -190 -236 -380 -374 l-29
-21 63 -106 c35 -59 66 -109 70 -111 14 -9 177 110 263 193 227 215 368 483
424 801 25 138 23 384 -4 515 -25 121 -64 247 -78 252 -5 2 -56 -19 -112 -47z"/>
<path d="M3935 4582 c-60 -20 -112 -37 -113 -38 -2 -2 17 -42 42 -91 138 -263
384 -504 635 -620 40 -18 75 -32 76 -31 7 9 115 216 115 221 0 4 -28 21 -62
38 -222 111 -433 313 -534 512 -13 26 -30 47 -37 46 -6 0 -61 -17 -122 -37z"/>
<path d="M6702 4368 c-139 -282 -325 -498 -574 -669 -49 -33 -88 -62 -88 -65
0 -3 39 -72 87 -155 65 -114 90 -149 102 -144 38 15 191 126 289 210 224 192
389 410 522 688 74 155 84 134 -98 196 -86 30 -162 56 -168 58 -6 2 -38 -51
-72 -119z"/>
<path d="M3377 4403 c-195 -63 -184 -39 -102 -208 196 -402 528 -733 940 -937
74 -37 87 -41 99 -28 7 8 35 62 61 120 26 58 56 123 66 144 11 22 19 41 19 42
0 1 -48 28 -107 59 -249 132 -432 285 -594 500 -63 82 -94 132 -158 256 l-56
105 -168 -53z"/>
<path d="M7404 4131 c-118 -253 -261 -458 -458 -659 -141 -144 -262 -244 -432
-358 l-122 -81 77 -134 c42 -74 110 -194 150 -266 41 -73 78 -133 81 -133 12
0 211 123 290 180 325 231 636 565 837 900 112 186 241 469 220 482 -15 8
-283 99 -453 153 l-131 42 -59 -126z"/>
<path d="M2615 4169 c-121 -38 -257 -81 -302 -95 l-82 -25 23 -62 c64 -170
230 -461 368 -645 83 -111 249 -301 335 -383 144 -140 372 -312 556 -422 104
-61 373 -197 392 -197 10 0 270 559 263 565 -2 1 -71 37 -155 79 -256 129
-444 265 -639 460 -193 194 -343 404 -465 654 -39 78 -71 142 -72 141 -1 0
-101 -32 -222 -70z"/>
<path d="M5380 3968 c-62 -14 -130 -20 -248 -21 l-164 -2 -49 -115 c-26 -63
-48 -120 -49 -126 0 -18 42 -24 215 -30 126 -5 183 -3 270 11 102 16 253 50
262 59 8 8 -130 246 -141 245 -6 -1 -49 -10 -96 -21z"/>
<path d="M5680 3469 c-36 -11 -117 -31 -180 -45 -194 -43 -510 -43 -723 -1
-10 2 -146 -296 -147 -320 0 -16 43 -27 205 -54 231 -39 514 -31 777 22 117
23 318 87 318 101 0 18 -165 318 -175 317 -5 0 -39 -9 -75 -20z"/>
<path d="M5948 2850 c-271 -89 -500 -124 -818 -124 -230 0 -345 11 -542 53
l-86 18 -12 -26 c-7 -14 -47 -107 -90 -206 -43 -99 -94 -215 -114 -259 -20
-43 -36 -82 -36 -86 0 -8 218 -63 340 -85 340 -61 771 -61 1110 1 131 23 353
82 472 125 124 44 208 79 208 87 0 17 -295 542 -304 541 -6 -1 -64 -18 -128
-39z"/>
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