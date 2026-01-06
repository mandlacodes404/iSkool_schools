<?php
/**
 * iSkool - Login & Registration Page
 *
 * Entry point for user authentication and account creation.
 * Features:
 * - Animated splash screen with branded loader
 * - Responsive login and registration forms with role selection
 * - Password visibility toggle
 * - Access key validation for registration
 * - Full-screen processing overlay
 * - PWA support with service worker and push notification subscription
 * - Dynamic school name display from database
 *
 * @package     iSkool
 * @subpackage  Authentication
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-14
 * @link        https://iskool.online
 */

session_start();

require_once 'config.php'; 
require_once 'check_remember_me.php';     

$errors = [
    'login' => $_SESSION['login_error'] ?? '',
    'register' => $_SESSION['register_error'] ?? ''
];
$activeForm = $_SESSION['active_form'] ?? 'login';

unset($_SESSION['login_error'], $_SESSION['register_error'], $_SESSION['active_form']);

function showError($error){
    return !empty($error) ? "<p class='error-message' style='color:red;'>$error</p>" : '';
}

function isActiveForm($formName, $activeForm) {
    return $formName === $activeForm ? 'active' : '';
}

$schoolName = 'My School'; // fallback only (will almost never show)

$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $schoolName = trim($row['setting_value']);
    if (empty($schoolName)) {
        $schoolName = 'My School';
    }
}


?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Login Application - iSkool</title>
    <link rel="manifest" href="https://iskool.online/manifest.json">
   
    <meta name="theme-color" content="#1E1C37">
    <link rel="icon" href="/favicon.ico" type="image/x-icon">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    
   
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
    /* --- Animation Styles --- */
    body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0E0E0E; /* Gemini Neutral Black */
    font-family: 'Inter', 'Nunito', sans-serif;
    color: #E3E3E3;
    overflow-x: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;

    
}

    /* Glowing Logo Loader */
    #animation-wrapper {
        position: fixed;
        width: 100%;
        height: 100%;
        background: #0d1117;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.8s ease;
    }

    #loader-logo {
    display: flex;
    align-items: center;
    justify-content: center;
}

#loader-logo svg {
    /* Precise size for the splash screen logo */
    width: 120px; 
    height: 120px;
    /* This makes it appear smoothly when the page first hits */
    animation: reveal 0.6s ease-out;
}

    /* Branding Styles */
    .branding {
        position: absolute;
        bottom: 60px;
        font-size: 14px;
        color: #888;
        font-family: 'Nunito', sans-serif;
        letter-spacing: 0.5px;
        opacity: 0.7;
        transition: opacity 0.3s ease;
        text-align: center;
        display: flex;
        flex-direction: column;
    }

    .branding:hover {
        opacity: 1;
    }

    .branding span {
        display: block;
    }

    .branding span:nth-child(1) {
        font-size: 14px;
        color: #888;
    }

    .branding span:nth-child(2) {
        font-size: 16px;
        color: #ffffff;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
    }

    /* Mobile adjustments for loader logo and branding */
    @media (max-width: 480px) {
        #loader-logo {
            font-size: 4rem;
        }
        .branding {
            font-size: 13px;
            bottom: 50px;
        }
        .branding span:nth-child(1) {
            font-size: 13px;
        }
        .branding span:nth-child(2) {
            font-size: 15px;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
        }
    }

    @media (max-width: 360px) {
        #loader-logo {
            font-size: 3rem;
        }
        .branding {
            font-size: 12px;
            bottom: 40px;
        }
        .branding span:nth-child(1) {
            font-size: 12px;
        }
        .branding span:nth-child(2) {
            font-size: 14px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.6);
        }
    }

    

#iskool-brand {
    display: flex; /* Changed from 'none' to 'flex' to center the SVG */
    justify-content: center;
    align-items: center;
    margin: 0 auto 20px auto;
    padding: 10px;
    /* This ensures it scales nicely on mobile */
    width: 100%;
}

#iskool-brand svg {
    width: 100px; 
    height: 100px;
    /* Optional: very subtle glow to make the white pop against the dark box */
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
}
/* Make sure the container displays properly on mobile */
@media (max-width: 480px) {
    #iskool-brand svg {
        width: 65px;
        height: 65px;
    }
}

@media (max-width: 480px) {
    #iskool-brand {
        font-size: 32px;           /* Smaller on mobile */
        margin-bottom: 25px;
        max-width: 95vw;
    }
}

@media (max-width: 360px) {
    #iskool-brand {
        font-size: 28px;
    }
}

 .container {
    background: transparent;
    box-shadow: none;
    width: 90%;
    max-width: 400px;

    /* ADD THIS — hides it without shifting anything */
    opacity: 0;
    transition: opacity 1s ease;
}

.container.show {
    opacity: 1;
    /* Keep your existing animation if you want the slide */
    animation: fadeSlideIn 1.2s ease forwards;
}

    @keyframes fadeSlideIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-box p {
        text-align: center;
        font-size: 14px;
    }

    .form-box {
        display: none;
    }

    .form-box.active {
        display: block;
    }

    .error-message {
        color: #ff5555;
        margin-bottom: 10px;
    }

    input, select, button {
        width: 100%;
        margin: 8px 0;
        padding: 10px;
        border-radius: 6px;
        border: none;
        font-size: 14px;
    }

 input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
select {
    background: #1E1F20;
    color: #fff;
    border: 1px solid transparent;
    padding: 12px 45px;         /* ← KEY CHANGE: less vertical (12px), more horizontal (32px) */
    border-radius: 30px;        /* ← Slightly larger radius for smoother long pill */
    box-sizing: border-box;
    font-size: 16px;
    transition: all 0.3s ease;
    margin-bottom: 12px;
    width: 100%;                /* Ensures they stretch full width nicely */
}

input:focus, select:focus {
    background: #1E1F20;
    border-color: #444746;
    box-shadow: 0 0 0 1px #444746;
    outline: none;
}

  button {
    background: #ffffff; 
    color: #131314;
    font-weight: 700;
    font-size: 15px;
    padding: 14px;
    border-radius: 24px; /* Matches the pills */
    cursor: pointer;
    border: none;
    margin-top: 10px;
    transition: background 0.2s ease;
}

button:hover {
    background: #F1F1F1;
}

    a {
        color: white;
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    .password-wrapper {
        position: relative;
        width: 100%;
    }

    .password-wrapper input {
        width: 100%;
        padding-right: 40px;
    }

    .toggle-password {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
        color: #ccc;
        cursor: pointer;
    }

    h2 {
    font-weight: 400; /* Gemini uses lighter font weights for headings */
    font-size: 24px;
    color: #E3E3E3;
}

    /* NEW: Title + Name + Surname Row */
    .name-row {
        display: flex;
        gap: 8px;
        margin: 8px 0;
    }

    .name-row select,
    .name-row input {
        flex: 1;
        margin: 0;
    }

    .name-row select {
        flex: 0.6;
    }

    #loaderOverlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(13, 17, 23, 0.85);
        backdrop-filter: blur(6px);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        flex-direction: column;
        opacity: 0;
        transition: opacity 0.4s ease;
    }

    #loaderOverlay.show {
        display: flex;
        opacity: 1;
    }

    .loader-container {
        text-align: center;
    }

    .loader-book i {
        font-size: 5rem;
        color: #00ff99;
        text-shadow: 0 0 10px #00ff99;
        animation: rotateBook 4s linear infinite;
    }

    .loader-text {
        font-size: 18px;
        color: #00ff99;
        font-weight: 600;
        text-shadow: 0 0 8px #00ff99;
        font-family: 'Nunito', sans-serif;
        margin-top: 15px;
    }

    @keyframes rotateBook {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @media (max-width: 480px) {
        .container {
            padding: 1rem;
            margin: 1rem auto;
            max-height: 80vh;
        }

        .form-box p,
        .form-box label {
            font-size: 13px;
        }

        input, select, button {
            font-size: 13px;
            padding: 10px 14px;
        }

        .toggle-password {
            right: 10px;
        }

        .book-icon {
            font-size: 4rem;
        }

        .icons {
            gap: 1.5rem;
            margin-top: 1rem;
        }

        .icons i {
            font-size: 1.5rem;
        }

        .typewriter {
            font-size: 1.25rem;
            margin-top: 1.5rem;
            min-height: 1.5rem;
        }

        label {
            display: block;
            margin-top: 10px;
        }

        .name-row {
            flex-direction: column;
        }

        .name-row select,
        .name-row input {
            margin: 4px 0;
        }
    }

    @media (max-width: 360px) {
        input, select, button {
            font-size: 12px;
            padding: 8px 12px;
        }

        .container {
            padding: 0.75rem;
            max-height: 75vh;
        }

        .book-icon {
            font-size: 3rem;
        }

        .icons {
            gap: 1rem;
        }

        .icons i {
            font-size: 1.2rem;
        }

        .typewriter {
            font-size: 1rem;
            margin-top: 1rem;
            border-right: 2px solid #00ff99;
        }
    }
    </style>
</head>
<body>
    <!-- Animation wrapper -->
    <div id="animation-wrapper">
       <div id="loader-logo">
    <div id="loader-logo">
    <div id="loader-logo">
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
</div>
</div>
        <div class="branding">
            <!--<span>from</span> -->
            <span>v1.0.0</span>
        </div>
    </div>
    <!-- Login/Register container -->
    <div class="container">
        <!-- LOGIN FORM -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <form action="login_register.php" method="post">
                <!-- iSkool brand text -->
                <div id="iskool-brand">
                   <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="120" height="120" viewBox="0 0 1024.000000 1024.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
fill="#d3d1d1ff" stroke="none">
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
                <?= showError($errors['login']); ?>
                <input type="email" name="email" placeholder="Email" required><br>
                <div class="password-wrapper">
                    <input type="password" name="password" id="login-password" placeholder="Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('login-password', this)"></i>
                </div>
                 <div style="display: flex; align-items: center; margin: 10px 0 15px 10px; text-align: left;">
                  <input type="checkbox" name="remember_me" id="remember_me" style="width: 16px; height: 16px; margin: 0 10px 0 0; cursor: pointer;">
                  <label for="remember_me" style="font-size: 13px; color: #ccc; cursor: pointer; user-select: none;">Keep me logged in</label>
                </div>
                <button type="submit" name="login">Login</button>
                <p>Don't have an account? 
                   <a href="#" onclick="document.getElementById('login-form').classList.remove('active'); document.getElementById('register-form').classList.add('active'); return false;">Register</a>
                </p>
                <p style="text-align:center; margin-top: 8px;">
                    <a href="forgot_password.php" style="color:#00bfff;">Forgot your password?</a>
                </p>
            </form>
        </div>
        <!-- REGISTER FORM -->
        <div class="form-box <?= isActiveForm('register', $activeForm); ?>" id="register-form">
            <form action="login_register.php" method="post">
                <h2>Register</h2>
                <?= showError($errors['register']); ?>

                <!-- NEW: Title + First Name + Surname -->
                <div class="name-row">
                    <select name="title" required>
                        <option value="" disabled selected>Title</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Dr">Dr</option>
                        <option value="Prof">Prof</option>
                        <option value="Rev">Rev</option>
                    </select>
                    <input type="text" name="name" placeholder="First Name" required>
                    <input type="text" name="surname" placeholder="Surname" required>
                </div>

                <input type="email" name="email" placeholder="Email" required><br>
                <div class="password-wrapper">
                    <input type="password" name="password" id="register-password" placeholder="Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('register-password', this)"></i>
                </div>
                
                <label>Select Role:</label>
                <select name="role" required>
                    <option value="">-- Select Role --</option>
                    <option value="learner">Learner</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                    <option value="school_admin">Principal/School Admin</option>
                </select><br>
                <label for="gender">Gender:</label>
                <select name="gender" id="gender" required>
                    <option value="" disabled selected>Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                </select><br>
                <label for="age">Age:</label>
                <input type="number" name="age" id="age" min="3" max="120" required placeholder="Enter your age"><br>
                <input type="text" name="access_key" placeholder="Enter Access Key" required><br>

                <!-- NEW: Notification Agreement Checkbox -->
                <div style="margin: 15px 0; text-align: left; padding: 0 20px;">
                    <label style="font-size: 13px; color: #ccc; cursor: pointer;">
                        <input type="checkbox" name="agree_notifications" required style="margin-right: 8px;">
                        I agree to receive notifications for important updates, replies, announcements, and grades.
                    </label>
                </div>

                <button type="submit" name="register">Register</button>
                <p>Already have an account? 
                   <a href="#" onclick="document.getElementById('register-form').classList.remove('active'); document.getElementById('login-form').classList.add('active'); return false;">Login</a>
                </p>
            </form>
        </div>
    </div>
    <!-- Full Screen Loader -->
    <div id="loaderOverlay">
        <div class="loader-container">
            <div class="loader-book">
                <i class="fas fa-book-open"></i>
            </div>
            <div class="loader-text">Processing...</div>
        </div>
    </div>
    <script>
    // Show glowing logo loader first, then fade out and show container + brand
    window.onload = function () {
        const animationWrapper = document.getElementById('animation-wrapper');
        const container = document.querySelector('.container');
        const iskoolBrand = document.getElementById('iskool-brand');
        // Set to 2.0 seconds (2000ms)
         const timeout = 2000;
        setTimeout(() => {
    animationWrapper.style.opacity = '0';
    setTimeout(() => {
        animationWrapper.style.display = 'none';

        // ──────── AFTER ANIMATION: CHECK IF LOGGED IN ────────
        <?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
            // Logged in → go straight to dashboard
            <?php if ($_SESSION['role'] === 'teacher'): ?>
                window.location.href = 'teacher_dashboard.php';
            <?php else: ?>
                window.location.href = 'learner_dashboard.php';
            <?php endif; ?>
        <?php else: ?>
            // Not logged in → show login form
            iskoolBrand.style.display = 'flex';
            container.classList.add('show');
           
        <?php endif; ?>
        // ─────────────────────────────────────────────────────

          }, 800);
         }, timeout);
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const activeForm = "<?= $activeForm ?>";
        if (activeForm === 'login') {
            loginForm.classList.add('active');
        } else {
            registerForm.classList.add('active');
        }
    };
    // Toggle password visibility
    function togglePassword(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }
    const form = document.querySelector("form");
    const loader = document.getElementById("loaderOverlay");
    form.addEventListener("submit", () => {
        loader.classList.add("show");
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.error("Service Worker failed", err));
    }
 
    </script>
</body>
</html>