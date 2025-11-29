<?php
session_start();

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


?>

<!DOCTYPE html>
<html>
<head>
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#161b22">
    <link rel="icon" href="/favicon.ico" type="image/x-icon">
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Login Application - iSkool</title>
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
    /* --- Animation Styles --- */
    body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        background: #0d1117;
        font-family: 'Nunito', sans-serif;
        color: #fff;
        overflow-x: hidden;
        overflow-y: auto;
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
        font-size: 6rem;
        font-weight: 900;
        color: #ffffff;
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

    /* --- Login/Register Styles --- */
    body.show-container {
        background: #161b22;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }

    #iskool-brand {
        display: none;
        text-align: center;
        font-size: 48px;
        font-weight: 900;
        color: #ffffff;
        margin: 20px auto 0 auto;
        max-width: 350px;
    }

    @media (max-width: 480px) {
        #iskool-brand {
            font-size: 32px;
        }
    }

    .container {
        display: none;
        width: 90%;
        max-width: 350px;
        background: #161b22;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
        color: white;
        overflow-y: auto;
        max-height: 90vh;
        margin: 0;
    }

    .container.show {
        display: block;
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
        background: #0d1117;
        color: #fff;
        border: 1.5px solid white;
        padding: 12px 20px;
        border-radius: 9999px;
        box-sizing: border-box;
        font-size: 14px;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }

    input:focus,
    select:focus {
        border-color: #00bfff;
        box-shadow: 0 0 6px #00bfff;
        outline: none;
    }

    button {
        border-radius: 9999px;
    }

    button:hover {
        background: #dddddd;
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
        text-align: center;
        margin-bottom: 20px;
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
        <div id="loader-logo">iSkool</div>
        <div class="branding">
            <span>from</span>
            <span>Plan B</span>
        </div>
    </div>
    <!-- Login/Register container -->
    <div class="container">
        <!-- LOGIN FORM -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <form action="login_register.php" method="post">
                <!-- iSkool brand text -->
                <div id="iskool-brand">iSkool</div>
                <?= showError($errors['login']); ?>
                <input type="email" name="email" placeholder="Email" required><br>
                <div class="password-wrapper">
                    <input type="password" name="password" id="login-password" placeholder="Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('login-password', this)"></i>
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
                <label>Select School:</label>
                <select name="school_id" required>
                    <option value="">-- Select School --</option>
                    <?= $schoolsOptions ?>
                </select><br>
                <label>Select Role:</label>
                <select name="role" required>
                    <option value="">-- Select Role --</option>
                    <option value="user">Learner</option>
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
        const timeout = window.innerWidth <= 480 ? 4000 : 5000;
        setTimeout(() => {
            animationWrapper.style.opacity = '0';
            setTimeout(() => {
                animationWrapper.style.display = 'none';
                iskoolBrand.style.display = 'block';
                container.classList.add('show');
                document.body.classList.add('show-container');
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
    function subscribeToPush() {
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            if ('<?php echo isset($_SESSION['user_id']) ? 'true' : 'false'; ?>' === 'true' && 'PushManager' in window) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.pushManager.getSubscription().then(subscription => {
                        if (!subscription) {
                            const publicVapidKey = "BKPh1RLmANqolINDIuClVLOGrlfeQSG7o2pgZAS25xgD_rIp-LOPTWIzEu--bdOsFTi3QPNzpQ5mmzT__OEWmJc";
                            Notification.requestPermission().then(permission => {
                                if (permission === 'granted') {
                                    registration.pushManager.subscribe({
                                        userVisibleOnly: true,
                                        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                                    }).then(sub => {
                                        console.log('Subscribed:', sub);
                                        fetch('subscribe_push.php', {
                                            method: 'POST',
                                            body: JSON.stringify({ subscription: sub }),
                                            headers: { 'Content-Type': 'application/json' }
                                        }).then(response => response.json())
                                            .then(data => console.log('Server response:', data))
                                            .catch(err => console.error('Fetch error:', err));
                                    }).catch(err => console.error('Subscription error:', err));
                                } else {
                                    console.warn('Notification permission denied');
                                }
                            });
                        }
                    });
                });
            } else {
                console.log('Not logged in or PushManager unavailable');
            }
        } else {
            console.log('Not a PWA installation, skipping push subscription');
        }
    }
    window.addEventListener('load', () => subscribeToPush());
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    </script>
</body>
</html>