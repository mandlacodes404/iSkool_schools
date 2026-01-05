<?php
session_start();
require_once 'config.php';
require_once 'remember_me_functions.php'; // --- ADDED THIS ---

// --- Registration Logic ---
if (isset($_POST['register'])) {
    $title      = trim($_POST['title'] ?? '');
    $first_name = trim($_POST['name'] ?? '');
    $surname    = trim($_POST['surname'] ?? '');
    $email      = trim($_POST['email']);
    $password   = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $role       = $_POST['role'];
    $access_key = trim($_POST['access_key']);
    $gender     = $_POST['gender'];
    $age        = (int)$_POST['age'];
    $defaultPic = 'uploads/default_profile.png';

    if ($role === 'admin') {
        $_SESSION['register_error'] = 'Admin accounts can only be created by the system.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    if (empty($title) || empty($first_name) || empty($surname) || empty($email) || empty($role) || empty($access_key)) {
        $_SESSION['register_error'] = 'All fields are required.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    $keyStmt = $conn->prepare("SELECT id FROM access_keys WHERE role = ? AND access_key = ?");
    $keyStmt->bind_param("ss", $role, $access_key);
    $keyStmt->execute();
    $keyStmt->store_result();

    if ($keyStmt->num_rows === 0) {
        $_SESSION['register_error'] = 'Invalid or already used access key.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
    $keyStmt->close();

    $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $check->store_result();

    if ($check->num_rows > 0) {
        $_SESSION['register_error'] = 'This email is already registered.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    $stmt = $conn->prepare("
        INSERT INTO users 
        (title, name, surname, email, password, role, profile_pic, gender, age)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("ssssssssi", $title, $first_name, $surname, $email, $password, $role, $defaultPic, $gender, $age);

    if ($stmt->execute()) {
        header("Location: registration_success.php");
        exit();
    } else {
        $_SESSION['register_error'] = 'Registration failed. Please try again.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
}

// ────────────────────── Login Logic ──────────────────────
if (isset($_POST['login'])) {
    $email    = trim($_POST['email']);
    $password = $_POST['password'];

    $stmt = $conn->prepare("SELECT name, password, profile_pic, role, is_deleted FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 1) {
        $stmt->bind_result($name, $hashed_password, $profile_pic, $role, $is_deleted);
        $stmt->fetch();

        if ($is_deleted == 1) {
            $_SESSION['login_error'] = "Your account has been deleted.";
            $_SESSION['active_form'] = 'login';
            header("Location: index.php");
            exit();
        }

        if (password_verify($password, $hashed_password)) {
            $_SESSION['name']        = $name;
            $_SESSION['email']       = $email;
            $_SESSION['profile_pic'] = $profile_pic ?: 'uploads/default_profile.png';
            $_SESSION['role']        = $role;

            // --- REMEMBER ME LOGIC ---
            if (isset($_POST['remember_me'])) {
                create_remember_me_token($conn, $email);
            }
            // -------------------------

            switch ($role) {
                case 'admin':
                    $_SESSION['admin'] = true;
                    header("Location: admin_home.php");
                    break;
                case 'school_admin':
                    $_SESSION['school_admin'] = true;
                    header("Location: school_admin_dashboard.php");
                    break;
                case 'teacher':
                    $_SESSION['teacher'] = true;
                    header("Location: teacher_dashboard.php");
                    break;
                case 'learner':
                    $_SESSION['learner'] = true;
                    header("Location: learner_dashboard.php");
                    break;
                case 'parent':
                    $_SESSION['parent'] = true;
                    header("Location: parent_dashboard.php");
                    break;
                default:
                    $_SESSION['login_error'] = 'Unknown role.';
                    header("Location: index.php");
                    exit();
            }
            exit();
        } else {
            $_SESSION['login_error'] = 'Incorrect password.';
        }
    } else {
        $_SESSION['login_error'] = 'Email not found.';
    }

    $_SESSION['active_form'] = 'login';
    header("Location: index.php");
    exit();
}
?>