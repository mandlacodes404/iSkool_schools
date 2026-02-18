<?php
/**
 * iSkool - Login & Registration 
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

<meta name="theme-color" content="#1a1919">

<link rel="icon" type="image/svg+xml" href="/icon.svg">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
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
    background: #1a1919; /* Gemini Neutral Black */
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
        background: #1a1919; /* CHANGE THIS from #0d1117 */;
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

/* Update your existing #loader-logo svg style */
#loader-logo svg {
    width: 120px; 
    height: 120px;
    /* Apply both the reveal effect and the infinite spin */
    animation: reveal 0.6s ease-out, logo-spin 16s linear infinite;
    /* This ensures it rotates around its own center */
    transform-origin: center;
}

/* Add this new keyframe at the bottom of your animations */
@keyframes logo-spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
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
       background: #1a1919; /* CHANGE THIS from #0d1117 */
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
    
   <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="180" height="180" viewBox="0 0 1024.000000 1024.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M3800 8575 c-272 -43 -515 -234 -616 -483 -47 -117 -58 -179 -58
-317 1 -150 21 -240 78 -353 l36 -71 -76 -108 c-42 -59 -128 -186 -192 -281
-65 -95 -161 -237 -215 -315 -54 -78 -102 -148 -106 -155 -6 -10 -17 -11 -57
-1 -71 17 -265 15 -348 -5 -166 -39 -304 -116 -424 -234 -114 -112 -189 -246
-229 -409 -25 -105 -23 -285 6 -398 78 -303 318 -544 626 -626 62 -17 111 -22
218 -23 l139 -1 67 -115 c37 -63 108 -180 157 -260 49 -80 157 -256 239 -393
83 -136 162 -267 176 -291 l27 -43 -31 -49 c-148 -239 -172 -539 -62 -780 111
-244 310 -409 569 -474 75 -19 109 -21 225 -18 122 3 146 7 231 36 126 43 216
98 311 189 78 75 161 192 191 268 l16 40 428 2 429 3 24 -56 c98 -227 304
-399 556 -465 103 -27 290 -29 391 -4 87 21 235 90 305 142 339 250 435 724
219 1082 l-50 83 19 27 c31 45 430 713 595 996 l46 80 138 1 c268 2 439 72
622 254 132 132 200 257 236 432 22 108 15 313 -14 411 -89 296 -340 532 -630
591 -137 28 -206 29 -394 3 -11 -1 -81 93 -228 308 -117 171 -253 365 -301
433 l-89 123 25 49 c55 109 78 198 83 330 10 258 -57 429 -238 610 -77 77
-112 104 -185 142 -149 77 -216 93 -380 93 -156 -1 -220 -14 -342 -70 -180
-83 -315 -218 -399 -399 l-35 -76 -408 0 -408 0 -18 48 c-34 91 -99 186 -185
272 -132 132 -284 206 -470 229 -103 13 -131 13 -240 -4z m328 -401 c124 -61
215 -166 246 -289 41 -155 -1 -314 -113 -426 -100 -99 -261 -153 -392 -130
-367 66 -508 504 -246 765 90 89 206 129 347 120 71 -4 97 -10 158 -40z m2242
35 c244 -38 409 -263 372 -507 -27 -185 -157 -321 -351 -368 -295 -70 -582
203 -531 505 36 214 205 363 430 380 8 0 44 -4 80 -10z m-859 -615 c4 -22 21
-76 38 -120 125 -325 460 -537 806 -510 96 7 237 45 302 82 25 14 49 24 54 22
7 -3 91 -123 374 -533 38 -55 90 -129 116 -165 l47 -64 -46 -46 c-104 -104
-176 -222 -222 -365 -35 -107 -40 -331 -11 -446 26 -101 76 -210 135 -293 45
-63 163 -186 178 -186 17 0 6 -23 -61 -132 -37 -62 -115 -192 -171 -288 -168
-284 -352 -594 -359 -602 -4 -4 -47 6 -96 23 -191 63 -401 56 -588 -23 -84
-35 -210 -123 -275 -192 -69 -74 -154 -207 -177 -276 -9 -26 -22 -76 -29 -111
l-13 -64 -386 -3 -387 -2 -5 27 c-41 200 -114 334 -253 464 -206 195 -498 267
-781 194 -32 -8 -75 -22 -96 -30 -20 -9 -39 -15 -40 -13 -4 4 -187 305 -245
403 -26 44 -119 199 -207 344 l-160 265 46 36 c140 112 246 277 291 455 23 91
27 272 9 371 -27 147 -114 307 -231 424 l-64 65 251 361 c138 199 257 371 266
384 l15 22 69 -34 c108 -55 190 -72 335 -72 101 0 142 4 210 23 105 30 227 89
304 150 139 109 257 301 282 460 l7 41 381 -2 380 -3 7 -41z m-2968 -1469
c242 -51 414 -275 394 -515 -17 -208 -159 -373 -372 -435 -74 -22 -218 -16
-285 10 -123 50 -220 136 -274 246 -114 230 -41 488 177 630 108 70 230 92
360 64z m5370 0 c384 -81 519 -565 232 -831 -58 -54 -156 -107 -227 -124 -215
-49 -447 62 -547 261 -100 200 -45 459 127 594 129 102 260 133 415 100z
m-3923 -2485 c129 -21 247 -99 320 -212 52 -80 74 -165 68 -272 -4 -73 -10
-95 -42 -161 -66 -133 -175 -220 -315 -251 -270 -60 -521 113 -562 388 -39
262 168 502 446 517 11 0 49 -4 85 -9z m2432 -4 c243 -44 406 -272 370 -517
-35 -238 -251 -405 -497 -385 -88 7 -143 26 -221 77 -145 94 -225 278 -196
450 38 220 217 374 452 387 8 1 50 -5 92 -12z"/>
</g>
</svg>
</div>
</div>
</div>
        <div class="branding">
           
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
 width="120.000000pt" height="120.000000pt" viewBox="0 0 1024.000000 1024.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M1975 8709 c-179 -27 -331 -122 -429 -269 -114 -169 -141 -377 -75
-573 33 -98 76 -166 163 -253 130 -130 291 -198 471 -198 120 0 192 17 302 70
133 64 224 154 287 287 l47 97 683 0 683 0 27 -69 c15 -38 45 -95 67 -126 l39
-56 -118 -122 c-184 -190 -479 -500 -812 -852 -454 -479 -812 -855 -815 -855
-1 0 -41 20 -89 44 -346 177 -759 48 -919 -285 -53 -111 -67 -169 -67 -287 0
-111 18 -183 75 -299 118 -240 380 -387 659 -370 343 21 608 271 633 595 7
100 -16 219 -64 324 l-36 79 70 72 c38 40 150 158 248 262 99 105 227 240 285
300 129 133 404 424 720 760 129 138 282 299 340 358 l106 108 79 -27 c104
-35 274 -44 379 -20 l68 16 37 -31 c48 -42 429 -407 664 -637 l188 -183 -43
-47 c-129 -142 -692 -722 -699 -722 -5 0 -35 13 -67 28 -103 52 -174 67 -312
66 -110 0 -134 -3 -205 -28 -109 -38 -187 -87 -270 -171 -225 -229 -248 -595
-54 -853 l41 -54 -59 -62 c-124 -127 -1278 -1330 -1467 -1528 l-197 -208 -32
24 c-53 41 -178 95 -255 111 -288 60 -574 -57 -730 -297 -149 -229 -132 -540
43 -760 148 -187 420 -295 652 -259 169 26 287 86 409 206 137 136 191 279
182 484 -4 83 -11 121 -32 176 -15 39 -30 77 -32 86 -4 10 61 84 192 220 109
112 306 316 438 454 133 137 311 322 396 410 85 88 287 298 448 466 l294 306
66 -19 c236 -67 496 -5 673 160 132 124 200 276 201 453 1 119 -21 212 -72
312 l-37 73 256 270 c141 148 308 323 372 389 l116 119 328 -314 c180 -173
364 -350 410 -393 l83 -77 -29 -58 c-44 -87 -63 -173 -63 -292 0 -117 17 -196
64 -295 74 -155 238 -294 408 -347 41 -13 42 -14 43 -58 6 -305 8 -1194 3
-1291 l-6 -126 -72 -21 c-190 -56 -364 -222 -434 -412 l-28 -75 -670 -3 -671
-2 -27 69 c-68 173 -210 320 -376 388 -152 62 -341 70 -497 19 -218 -71 -401
-272 -448 -492 -67 -316 108 -634 415 -757 97 -38 153 -49 270 -49 126 0 201
17 319 74 156 75 297 243 340 406 l12 42 668 0 668 0 26 -71 c86 -233 295
-396 562 -439 286 -46 592 110 727 371 183 354 -19 803 -419 934 l-53 17 0
728 0 729 58 16 c206 60 374 215 447 415 36 99 45 252 21 355 -53 225 -230
419 -455 499 -79 28 -96 30 -221 31 -148 0 -213 -15 -332 -77 l-57 -30 -50 43
c-95 84 -769 734 -768 741 4 17 862 908 875 908 3 0 34 -11 71 -24 374 -135
791 69 886 434 23 85 23 235 1 320 -52 206 -217 389 -417 464 -185 70 -416 50
-581 -51 -132 -79 -248 -222 -290 -356 -19 -59 -23 -95 -23 -197 0 -148 20
-225 85 -333 l42 -69 -74 -76 c-40 -43 -217 -228 -394 -412 -176 -184 -336
-353 -356 -375 l-36 -39 -203 194 c-112 107 -302 289 -421 403 l-217 208 50
62 c94 117 139 245 139 399 0 103 -12 166 -50 259 -75 180 -229 324 -418 387
-68 23 -92 26 -212 26 -119 -1 -143 -4 -207 -27 -194 -69 -350 -226 -408 -410
-14 -43 -25 -87 -25 -98 0 -19 -11 -19 -677 -17 l-677 3 -12 50 c-30 117 -129
271 -225 354 -139 118 -352 178 -534 150z m216 -285 c114 -34 210 -126 251
-241 27 -77 22 -197 -11 -265 -33 -69 -92 -130 -163 -169 -60 -32 -68 -34
-163 -34 -87 0 -107 3 -157 27 -79 37 -142 98 -181 177 -29 60 -32 74 -32 161
0 106 16 156 76 229 86 108 243 155 380 115z m5442 -22 c77 -38 137 -101 176
-182 22 -47 26 -69 26 -145 0 -82 -3 -97 -32 -156 -39 -79 -102 -140 -181
-177 -50 -24 -69 -27 -157 -27 -92 0 -105 3 -160 32 -255 132 -282 469 -51
628 75 52 125 65 227 62 74 -3 96 -8 152 -35z m-2731 -4 c292 -134 292 -550 0
-686 -48 -23 -71 -27 -147 -27 -77 0 -99 4 -147 27 -242 113 -302 423 -117
608 47 47 113 86 173 101 61 16 177 4 238 -23z m-2640 -2801 c240 -118 297
-423 112 -602 -172 -168 -453 -140 -586 57 -95 139 -88 316 17 444 44 53 82
81 154 111 48 20 69 23 151 21 80 -3 105 -8 152 -31z m2671 -15 c193 -95 275
-315 185 -501 -29 -60 -120 -151 -181 -179 -143 -67 -328 -34 -436 77 -93 96
-132 233 -101 360 27 114 131 224 248 262 89 30 201 22 285 -19z m2675 20
c107 -34 196 -113 244 -217 18 -41 22 -68 23 -145 0 -84 -3 -102 -28 -151 -58
-120 -159 -197 -288 -219 -129 -22 -250 20 -342 120 -73 78 -100 147 -100 255
0 101 27 175 90 245 104 116 253 158 401 112z m-5416 -2753 c125 -26 246 -125
289 -237 16 -42 22 -78 22 -138 0 -70 -4 -91 -30 -145 -45 -94 -92 -142 -181
-186 -73 -36 -80 -38 -177 -38 -93 0 -105 2 -167 33 -154 76 -244 240 -218
399 36 218 243 358 462 312z m5463 -38 c195 -91 274 -324 174 -512 -40 -75
-102 -132 -187 -172 -61 -29 -76 -32 -162 -32 -86 0 -101 3 -162 32 -84 39
-160 114 -196 191 -24 50 -27 69 -27 157 0 89 3 106 28 156 15 32 51 79 82
108 126 119 293 146 450 72z m-2750 8 c124 -46 210 -134 246 -252 56 -180 -24
-358 -199 -444 -72 -36 -81 -38 -172 -38 -88 0 -101 3 -162 33 -136 67 -219
194 -221 337 0 85 12 133 55 205 89 148 292 219 453 159z"/>
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
        // Set to 2.0 seconds (2500ms)
         const timeout = 2500;
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