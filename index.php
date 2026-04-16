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

<link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
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
    background: #1a1919;
    font-family: 'Inter', 'Nunito', sans-serif;
    color: #E3E3E3;
    overflow-x: hidden;
    min-height: 100vh;
}

body {
    display: flex;
    justify-content: center;
    align-items: center;
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
        /* Removed logo-spin: only keeping the initial reveal fade */
        animation: reveal 0.8s ease-out forwards;
        transform-origin: center;
    }

@keyframes reveal {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
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

    

/* ── Desktop two-panel wrapper ── */
.container {
    opacity: 0;
    transition: opacity 1s ease;
    display: flex;
    flex-direction: row;
    width: 100%;
    max-width: 960px;
    min-height: 100vh;
}

.container.show {
    opacity: 1;
    animation: fadeSlideIn 1.2s ease forwards;
}

/* ── Logo + school name above form — desktop only ── */
#form-top-brand {
    display: none;
}

/* ── Left preview panel (desktop only) ── */
.brand-panel {
    display: none; /* hidden on mobile, shown on desktop */
}

/* ── Preview animation card styles ── */
.preview-card {
    background: #222221;
    border-radius: 16px;
    border: 1px solid #2e2e2c;
    padding: 18px 20px;
    opacity: 0;
    transform: translateY(22px) scale(0.98);
    transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 2px 16px rgba(0,0,0,0.3);
}
.preview-card.pv-visible { opacity: 1; transform: translateY(0) scale(1); }

.pv-header { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.pv-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pv-icon.green  { background: #0e2e22; }
.pv-icon.orange { background: #2e1a0e; }
.pv-icon.purple { background: #1c1830; }

.pv-title { font-size: 13px; font-weight: 600; color: #e3e3e3; }
.pv-sub   { font-size: 11px; color: #666; margin-top: 2px; display: flex; align-items: center; gap: 5px; }

/* Chat bubbles */
.pv-chat { display: flex; flex-direction: column; gap: 8px; }
.pv-bubble {
    padding: 9px 13px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; max-width: 90%;
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.4s ease, transform 0.4s ease;
}
.pv-bubble.pv-vis { opacity: 1; transform: translateY(0); }
.pv-bubble.user { background: #ffffff; color: #131314; align-self: flex-end; border-bottom-right-radius: 3px; }
.pv-bubble.ai   { background: #2a2a28; color: #d0d0d0; align-self: flex-start; border-bottom-left-radius: 3px; }

.pv-typing {
    display: flex; gap: 5px; align-items: center; padding: 9px 13px;
    background: #2a2a28; border-radius: 12px; border-bottom-left-radius: 3px;
    width: fit-content; opacity: 0; transition: opacity 0.3s ease;
}
.pv-typing.pv-vis { opacity: 1; }
.pv-dot { width: 6px; height: 6px; border-radius: 50%; background: #555; animation: pvBounce 1.1s infinite ease-in-out; }
.pv-dot:nth-child(2) { animation-delay: 0.18s; }
.pv-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes pvBounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }

/* Tasks */
.pv-task {
    display: flex; align-items: center; gap: 10px; padding: 5px 0;
    font-size: 12.5px; color: #ccc;
    opacity: 0; transform: translateX(-8px);
    transition: opacity 0.4s ease, transform 0.4s ease;
}
.pv-task.pv-vis { opacity: 1; transform: translateX(0); }
.pv-task.done-txt { color: #555; text-decoration: line-through; }
.pv-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 1.5px solid #444; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, border-color 0.3s;
}
.pv-check.done { background: #3ecf8e; border-color: #3ecf8e; }
.pv-check svg { opacity: 0; transition: opacity 0.2s; }
.pv-check.done svg { opacity: 1; }

/* Stats */
.pv-stat-grid { display: flex; gap: 8px; margin-bottom: 12px; }
.pv-stat-box { flex: 1; background: #2a2a28; border-radius: 9px; padding: 9px 10px; text-align: center; }
.pv-stat-num { font-size: 18px; font-weight: 600; color: #e3e3e3; font-variant-numeric: tabular-nums; }
.pv-stat-lbl { font-size: 10px; color: #555; margin-top: 2px; letter-spacing: 0.04em; }

.pv-bar-group { display: flex; flex-direction: column; gap: 8px; }
.pv-bar-lbl-row { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 3px; }
.pv-bar-track { height: 5px; background: #2a2a28; border-radius: 99px; overflow: hidden; }
.pv-bar-fill { height: 100%; border-radius: 99px; width: 0%; transition: width 1.2s cubic-bezier(0.22,1,0.36,1); }

/* Pulse dot */
.pv-pulse { width: 7px; height: 7px; border-radius: 50%; background: #3ecf8e; display: inline-block; animation: pvPulse 1.8s infinite ease-in-out; }
@keyframes pvPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }

/* ── Right form panel ── */
.form-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
    min-height: 100vh;
    box-sizing: border-box;
    max-height: 100vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}

.form-panel::-webkit-scrollbar { width: 4px; }
.form-panel::-webkit-scrollbar-track { background: transparent; }
.form-panel::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

/* inner width cap for the form itself */
.form-panel > .form-box {
    width: 100%;
    max-width: 400px;
}

/* ── Desktop ── */
@media (min-width: 900px) {
    body { padding: 0; }

    .container {
        min-height: 100vh;
        max-width: 100%;
    }

    .brand-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        flex: 0 0 48%;
        padding: 48px 40px;
        background: #111110;
        border-right: 1px solid #2a2a2a;
        box-sizing: border-box;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: hidden;
    }

    .brand-panel-logo,
    .brand-panel-title,
    .brand-panel-tagline,
    .brand-panel-school {
        display: none;
    }

    .brand-panel-footer {
        position: absolute;
        bottom: 28px;
        left: 40px;
        font-size: 12px;
        color: #333;
    }

    .preview-wrap {
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
    }

    .form-panel {
        flex: 1;
        background: #1a1919;
        padding: 60px 64px;
        justify-content: center;
    }

    .form-panel > .form-box {
        max-width: 380px;
    }

    /* Hide the logo inside the login form on desktop — branding panel handles it */
    #iskool-brand {
        display: none !important;
    }

    /* Logo + school name above the login form on desktop */
    #form-top-brand {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 36px;
        width: 100%;
        max-width: 380px;
    }

    #form-logo-svg svg {
        display: block;
        width: 54px;
        height: 54px;
    }

    #form-school-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
    }

    #form-school-dot {
        width: 8px; height: 8px;
        background: #3ecf8e;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: 0 0 6px #3ecf8e88;
    }

    #form-school-name {
        font-size: 13px;
        color: #aaa;
    }
}

#iskool-brand {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 20px auto;
    padding: 10px;
    width: 100%;
    box-sizing: border-box;
}

#iskool-brand svg {
    width: 90px;
    height: 90px;
}

@media (max-width: 480px) {
    #iskool-brand svg { width: 65px; height: 65px; }
    #iskool-brand { margin-bottom: 25px; max-width: 95vw; }
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

    /* TO: */
.form-box {
    display: none;
    width: 100%;
}

.form-box.active {
    display: block;
    width: 100%;
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
    padding: 12px 20px;
    border-radius: 30px;
    box-sizing: border-box;
    font-size: 16px;
    transition: all 0.3s ease;
    margin-bottom: 12px;
    width: 100%;
    display: block;
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
        .form-panel {
            padding: 1.5rem 1.2rem;
            min-height: 100vh;
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

        .form-panel {
            padding: 1rem;
        }
    }
    </style>
</head>
<body>
    <!-- Animation wrapper -->
    <div id="animation-wrapper">
       <div id="loader-logo">
    
    <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="180.000000pt" height="180.000000pt" viewBox="0 0 880.000000 805.000000"
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
</div>
</div>
        <div class="branding">
           
        </div>
    </div>
    <!-- Login/Register container -->
    <div class="container">

        <!-- LEFT: Animated Preview Panel (desktop only) -->
        <div class="brand-panel">
            <div class="preview-wrap">

                <!-- Card 1: Announcements / Chat -->
                <div class="preview-card" id="pv1">
                    <div class="pv-header">
                        <div class="pv-icon orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Class announcements</div>
                            <div class="pv-sub">Live updates from teachers</div>
                        </div>
                    </div>
                    <div class="pv-chat">
                        <div class="pv-bubble user" id="pv-b1">Sir, when is the Maths test?</div>
                        <div class="pv-typing" id="pv-typing"><div class="pv-dot"></div><div class="pv-dot"></div><div class="pv-dot"></div></div>
                        <div class="pv-bubble ai" id="pv-b2">Friday 9am, Grade 10. Chapter 4 &amp; 5. Good luck!</div>
                    </div>
                </div>

                <!-- Card 2: Tasks -->
                <div class="preview-card" id="pv2">
                    <div class="pv-header">
                        <div class="pv-icon green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Today's tasks</div>
                            <div class="pv-sub"><span class="pv-pulse"></span> 3 pending</div>
                        </div>
                    </div>
                    <div class="pv-task" id="pv-t1"><div class="pv-check" id="pv-c1"><svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#131314" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>Submit Science assignment</div>
                    <div class="pv-task" id="pv-t2"><div class="pv-check" id="pv-c2"><svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#131314" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>Mark Grade 8 tests</div>
                    <div class="pv-task" id="pv-t3"><div class="pv-check" id="pv-c3"><svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#131314" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>Upload timetable</div>
                    <div class="pv-task" id="pv-t4"><div class="pv-check" id="pv-c4"><svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#131314" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>Review parent messages</div>
                </div>

                <!-- Card 3: Stats -->
                <div class="preview-card" id="pv3">
                    <div class="pv-header">
                        <div class="pv-icon purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b80d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">School stats</div>
                            <div class="pv-sub">This term</div>
                        </div>
                    </div>
                    <div class="pv-stat-grid">
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn1">0</div><div class="pv-stat-lbl">Learners</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn2">0</div><div class="pv-stat-lbl">Teachers</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn3">0%</div><div class="pv-stat-lbl">Attendance</div></div>
                    </div>
                    <div class="pv-bar-group">
                        <div>
                            <div class="pv-bar-lbl-row"><span>Pass rate</span><span id="pv-bl1">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf1" style="background:#8b80d1;"></div></div>
                        </div>
                        <div>
                            <div class="pv-bar-lbl-row"><span>Submissions</span><span id="pv-bl2">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf2" style="background:#3ecf8e;"></div></div>
                        </div>
                    </div>
                </div>

            </div>
            <div class="brand-panel-footer">&copy; <?= date('Y') ?> iSkool v.1.0.0</div>
        </div>

        <!-- RIGHT: Form panel -->
        <div class="form-panel">
        <!-- Logo + School Name (desktop: shown here, replaces brand panel header) -->
        <div id="form-top-brand">
            <div id="form-logo-svg">
                <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 880.000000 805.000000" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(0.000000,805.000000) scale(0.100000,-0.100000)" fill="#a09d9dff" stroke="none">
                        <path d="M4275 7173 c-274 -35 -556 -150 -692 -282 -31 -30 -35 -31 -125 -31 -149 0 -352 -26 -498 -64 -507 -130 -844 -438 -956 -875 -13 -51 -24 -108 -24 -125 0 -30 -3 -33 -77 -60 -185 -68 -397 -186 -563 -315 -353 -274 -571 -613 -662 -1031 -19 -91 -23 -133 -22 -310 0 -175 3 -220 23 -310 144 -668 664 -1198 1361 -1388 168 -46 276 -63 450 -69 460 -17 809 126 994 407 56 85 81 146 102 250 16 78 17 167 11 1157 l-5 1073 41 11 c156 41 276 181 309 358 19 106 -33 272 -113 360 -143 156 -416 188 -598 71 -181 -115 -248 -356 -156 -558 44 -97 160 -197 268 -232 l37 -12 0 -1101 0 -1102 -24 -66 c-26 -74 -86 -167 -143 -221 -178 -169 -506 -248 -848 -204 -295 38 -533 126 -772 286 -149 99 -270 204 -361 312 -84 100 -196 269 -185 278 4 4 225 100 491 214 l484 207 41 -42 c143 -143 399 -159 575 -36 181 126 239 356 141 555 -132 269 -520 327 -734 108 -90 -93 -132 -212 -121 -346 6 -75 5 -79 -17 -86 -22 -7 -543 -230 -802 -343 -76 -34 -142 -61 -145 -61 -12 0 -60 169 -81 285 -18 103 -20 144 -16 290 3 102 12 200 22 245 64 289 202 537 419 756 221 221 486 385 761 470 50 15 93 32 96 37 4 5 9 43 13 86 20 220 106 414 253 571 96 103 164 155 284 219 217 116 459 171 751 171 l179 0 57 53 c115 108 254 181 440 229 106 28 133 31 277 32 173 1 244 -12 300 -56 59 -46 55 86 55 -2077 l0 -1990 -50 -22 c-67 -29 -141 -109 -168 -182 -44 -117 -22 -243 58 -338 l41 -49 -27 -47 c-81 -136 -257 -255 -494 -333 -159 -53 -216 -76 -283 -117 -155 -94 -260 -224 -319 -393 -40 -117 -49 -212 -49 -500 l1 -274 25 -26 c35 -35 123 -36 157 -2 23 22 23 27 29 320 5 255 8 307 25 367 64 224 192 350 434 428 146 48 177 50 302 28 234 -41 371 -54 563 -55 460 -1 786 101 1025 321 l65 60 105 -9 c331 -27 708 55 938 205 200 131 331 300 387 502 25 91 31 291 11 400 -9 50 -18 99 -21 110 -5 16 9 31 64 73 92 70 244 230 305 321 101 152 159 291 196 471 132 646 -253 1267 -977 1578 -50 21 -52 24 -58 70 -65 488 -433 871 -976 1016 -156 41 -285 58 -470 59 l-171 2 -24 -28 c-33 -39 -31 -81 5 -118 l29 -29 150 0 c510 0 949 -224 1142 -582 76 -142 115 -283 119 -435 l1 -52 78 -30 c186 -71 327 -148 457 -248 353 -272 531 -627 512 -1017 -15 -290 -135 -538 -368 -761 -52 -50 -129 -115 -171 -145 -85 -60 -89 -70 -62 -136 23 -55 51 -198 53 -274 4 -143 -50 -304 -142 -426 -117 -154 -333 -272 -607 -330 -87 -18 -380 -27 -396 -12 -4 4 -2 13 4 20 27 34 66 201 76 328 2 19 4 380 5 803 1 738 2 767 19 767 11 0 47 14 81 31 205 102 298 328 222 543 -74 212 -302 333 -533 285 -77 -16 -180 -74 -233 -130 -82 -87 -135 -242 -120 -344 28 -181 140 -323 298 -376 l52 -18 0 -793 c0 -891 1 -871 -74 -1033 -84 -179 -226 -296 -461 -380 -152 -54 -403 -88 -585 -79 -141 7 -375 30 -383 39 -4 4 2 11 13 17 40 21 191 185 225 244 l35 62 57 5 c105 9 214 76 262 161 31 53 49 144 42 204 -15 111 -109 237 -197 264 l-39 11 -2 2026 -3 2026 -29 58 c-68 139 -240 208 -516 205 -69 0 -138 -3 -155 -5z m-675 -1313 c220 -112 177 -430 -65 -480 -151 -31 -300 93 -300 250 0 108 76 213 175 245 56 18 138 12 190 -15z m2656 -1035 c69 -20 125 -65 160 -127 38 -69 41 -170 7 -234 -70 -131 -234 -182 -358 -110 -190 112 -162 395 47 467 65 22 81 23 144 4z m-3767 -518 c123 -62 173 -222 106 -345 -69 -126 -213 -173 -334 -107 -66 36 -107 85 -126 149 -20 67 -19 105 6 170 51 138 213 200 348 133z m2463 -1639 c66 -46 81 -141 33 -203 -76 -101 -209 -79 -250 41 -9 27 -10 47 -2 76 11 45 64 104 99 111 37 8 90 -3 120 -25z"/>
                    </g>
                </svg>
            </div>
            <div id="form-school-badge">
                <div id="form-school-dot"></div>
                <span id="form-school-name"><?= htmlspecialchars($schoolName) ?></span>
            </div>
        </div>
        <!-- LOGIN FORM -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <form action="login_register.php" method="post">
                <!-- iSkool brand text -->
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

                <input type="email" name="email" placeholder="Email" required>
                <div class="password-wrapper">
                    <input type="password" name="password" id="register-password" placeholder="Password (min. 8 characters)" required minlength="8">
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('register-password', this)"></i>
                </div>
                <div id="password-strength-msg" style="font-size:12px; color:#ff5555; margin: -6px 0 8px 12px; display:none;">Password must be at least 8 characters.</div>
                <div class="password-wrapper">
                    <input type="password" name="confirm_password" id="confirm-password" placeholder="Confirm Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('confirm-password', this)"></i>
                </div>
                <div id="password-match-msg" style="font-size:12px; color:#ff5555; margin: -6px 0 8px 12px; display:none;">Passwords do not match.</div>

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
        </div><!-- /.form-panel -->
    </div><!-- /.container -->
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
            document.querySelector('.form-panel').style.opacity = '1';
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

    // Password validation for register form
    const regPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');
    const strengthMsg = document.getElementById('password-strength-msg');
    const matchMsg = document.getElementById('password-match-msg');
    const loader = document.getElementById("loaderOverlay");

    regPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value.length < 8) {
            strengthMsg.style.display = 'block';
        } else {
            strengthMsg.style.display = 'none';
        }
    });

    confirmPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value !== regPassword.value) {
            matchMsg.style.display = 'block';
        } else {
            matchMsg.style.display = 'none';
        }
    });

    // Form submit handlers
    document.querySelectorAll("form").forEach(form => {
        form.addEventListener("submit", function(e) {
            // Only validate register form
            if (this.querySelector('#register-password')) {
                const pwd = regPassword.value;
                const confirmPwd = confirmPassword.value;

                if (pwd.length < 8) {
                    e.preventDefault();
                    strengthMsg.style.display = 'block';
                    regPassword.focus();
                    return;
                }
                if (pwd !== confirmPwd) {
                    e.preventDefault();
                    matchMsg.style.display = 'block';
                    confirmPassword.focus();
                    return;
                }
            }
            loader.classList.add("show");
        });
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.error("Service Worker failed", err));
    }

    // ── Preview panel animation ──
    const pvDelay = ms => new Promise(r => setTimeout(r, ms));

    function pvCountUp(el, target, suffix, duration) {
        let val = 0;
        const steps = 40, inc = target / steps, iv = duration / steps;
        const t = setInterval(() => {
            val = Math.min(val + inc, target);
            el.textContent = Math.round(val).toLocaleString() + suffix;
            if (val >= target) clearInterval(t);
        }, iv);
    }

    function pvAnimBar(fillEl, lblEl, pct, duration) {
        fillEl.style.width = pct + '%';
        let val = 0;
        const steps = 40, inc = pct / steps, iv = duration / steps;
        const t = setInterval(() => {
            val = Math.min(val + inc, pct);
            lblEl.textContent = Math.round(val) + '%';
            if (val >= pct) clearInterval(t);
        }, iv);
    }

    async function runPreview() {
        await pvDelay(600);

        // Card 1
        document.getElementById('pv1').classList.add('pv-visible');
        await pvDelay(600);
        document.getElementById('pv-b1').classList.add('pv-vis');
        await pvDelay(800);
        document.getElementById('pv-typing').classList.add('pv-vis');
        await pvDelay(1500);
        document.getElementById('pv-typing').style.opacity = '0';
        await pvDelay(300);
        document.getElementById('pv-b2').classList.add('pv-vis');

        await pvDelay(700);

        // Card 2
        document.getElementById('pv2').classList.add('pv-visible');
        await pvDelay(350);
        for (let i = 1; i <= 4; i++) {
            await pvDelay(150);
            document.getElementById('pv-t' + i).classList.add('pv-vis');
        }
        await pvDelay(500);
        document.getElementById('pv-c1').classList.add('done');
        document.getElementById('pv-t1').classList.add('done-txt');
        await pvDelay(300);
        document.getElementById('pv-c2').classList.add('done');
        document.getElementById('pv-t2').classList.add('done-txt');

        await pvDelay(700);

        // Card 3
        document.getElementById('pv3').classList.add('pv-visible');
        await pvDelay(450);
        pvCountUp(document.getElementById('pv-sn1'), 742, '', 900);
        pvCountUp(document.getElementById('pv-sn2'), 58, '', 900);
        pvCountUp(document.getElementById('pv-sn3'), 91, '%', 900);
        await pvDelay(250);
        pvAnimBar(document.getElementById('pv-bf1'), document.getElementById('pv-bl1'), 82, 1100);
        await pvDelay(200);
        pvAnimBar(document.getElementById('pv-bf2'), document.getElementById('pv-bl2'), 67, 1100);

        await pvDelay(4200);
        resetPreview();
    }

    async function resetPreview() {
        ['pv1','pv2','pv3'].forEach(id => {
            const el = document.getElementById(id);
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(22px) scale(0.98)';
        });
        await pvDelay(600);
        ['pv1','pv2','pv3'].forEach(id => document.getElementById(id).classList.remove('pv-visible'));
        ['pv-b1','pv-b2'].forEach(id => document.getElementById(id).classList.remove('pv-vis'));
        document.getElementById('pv-typing').style.opacity = '0';
        document.getElementById('pv-typing').classList.remove('pv-vis');
        for (let i = 1; i <= 4; i++) {
            document.getElementById('pv-t' + i).classList.remove('pv-vis','done-txt');
            document.getElementById('pv-c' + i).classList.remove('done');
        }
        ['pv-sn1','pv-sn2'].forEach(id => document.getElementById(id).textContent = '0');
        document.getElementById('pv-sn3').textContent = '0%';
        document.getElementById('pv-bf1').style.width = '0%';
        document.getElementById('pv-bf2').style.width = '0%';
        document.getElementById('pv-bl1').textContent = '0%';
        document.getElementById('pv-bl2').textContent = '0%';
        await pvDelay(100);
        ['pv1','pv2','pv3'].forEach(id => { document.getElementById(id).style.transition = ''; });
        await pvDelay(300);
        runPreview();
    }

    runPreview();</script>
</body>
</html>