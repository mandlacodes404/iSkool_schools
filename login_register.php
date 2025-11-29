<?php
session_start();
require_once 'config.php';

// --- Registration Logic ---
if (isset($_POST['register'])) {
    $title      = trim($_POST['title'] ?? '');
    $first_name = trim($_POST['name'] ?? '');     // now first name only
    $surname    = trim($_POST['surname'] ?? '');
    $email      = trim($_POST['email']);
    $password   = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $role       = $_POST['role'];
    $school_id  = intval($_POST['school_id']);
    $access_key = trim($_POST['access_key']);
    $defaultPic = 'uploads/default_profile.png';
    $gender     = trim($_POST['gender']);
    $age        = intval($_POST['age']);

    // Prevent admin self-registration
    if ($role === 'admin') {
        $_SESSION['register_error'] = 'Admin accounts can only be created by the system.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    // Validate required fields
    if (empty($title)) {
        $_SESSION['register_error'] = 'Title is required.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
    if (empty($first_name)) {
        $_SESSION['register_error'] = 'First name is required.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }
    if (empty($surname)) {
        $_SESSION['register_error'] = 'Surname is required.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    // Validate access key
    $keyStmt = $conn->prepare("SELECT id FROM access_keys WHERE school_id = ? AND role = ? AND access_key = ?");
    $keyStmt->bind_param("iss", $school_id, $role, $access_key);
    $keyStmt->execute();
    $keyStmt->store_result();

    if ($keyStmt->num_rows === 0) {
        $_SESSION['register_error'] = 'Invalid access key for this role and school.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
    }

    // Check if email exists
    $checkEmail = $conn->prepare("SELECT email FROM users WHERE email = ?");
    $checkEmail->bind_param("s", $email);
    $checkEmail->execute();
    $checkEmail->store_result();

    if ($checkEmail->num_rows > 0) {
        $_SESSION['register_error'] = 'Email is already registered!';
        $_SESSION['active_form'] = 'register';
    } else {
        // Insert user with title, first name, surname
        $stmt = $conn->prepare("
            INSERT INTO users 
            (title, name, surname, email, password, role, school_id, profile_pic, gender, age) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            "ssssssissi",
            $title,
            $first_name,
            $surname,
            $email,
            $password,
            $role,
            $school_id,
            $defaultPic,
            $gender,
            $age
        );

        if ($stmt->execute()) {
            // Optional: send welcome email
            header("Location: registration_success.php");
            exit();
        } else {
        $_SESSION['register_error'] = 'Registration failed. Try again.';
        $_SESSION['active_form'] = 'register';
        header("Location: index.php");
        exit();
        }
    }

    header("Location: index.php");
    exit();
}

// --- Login Logic ---
if (isset($_POST['login'])) {
    $email = trim($_POST['email']);
    $password = $_POST['password'];

    $stmt = $conn->prepare("SELECT name, password, profile_pic, role, school_id, is_deleted FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 1) {
        $stmt->bind_result($name, $hashed_password, $profile_pic, $role, $school_id, $is_deleted);
        $stmt->fetch();

        if ($is_deleted == 1) {
            $_SESSION['login_error'] = "Your account has been deleted by the administrator.";
            $_SESSION['active_form'] = 'login';
            header("Location: index.php");
            exit();
        }

        if (password_verify($password, $hashed_password)) {
            $_SESSION['name'] = $name;
            $_SESSION['email'] = $email;
            $_SESSION['profile_pic'] = $profile_pic ?: 'uploads/default_profile.png';
            $_SESSION['role'] = $role;
            $_SESSION['school_id'] = $school_id;

            // Trigger push subscription after login
            echo '<script>
                if ("serviceWorker" in navigator) {
                    navigator.serviceWorker.ready.then(() => {
                        if (typeof subscribeToPush === "function") {
                            subscribeToPush();
                        } else {
                            console.error("subscribeToPush function not found");
                        }
                    });
                }
            </script>';

            if ($role === 'admin') {
                $_SESSION['admin'] = true;
                if ($school_id == 9999) {
                    $_SESSION['global_access'] = true;
                }
                header("Location: admin_home.php");
            } elseif ($role === 'teacher') {
                $_SESSION['teacher'] = true;
                header("Location: teacher_dashboard.php");
            } elseif ($role === 'user') {
                $_SESSION['learner'] = true;
                header("Location: learner_dashboard.php");
            } elseif ($role === 'parent') {
                $_SESSION['parent'] = true;
                header("Location: parent_dashboard.php");
            } elseif ($role === 'school_admin') {
                $_SESSION['school_admin'] = true;
                header("Location: school_admin_dashboard.php");
            } else {
                $_SESSION['login_error'] = "Unknown user role.";
                $_SESSION['active_form'] = 'login';
                header("Location: index.php");
            }
            exit();
        } else {
            $_SESSION['login_error'] = "Invalid password.";
        }
    } else {
        $_SESSION['login_error'] = "Email not found.";
    }

    $_SESSION['active_form'] = 'login';
    header("Location: index.php");
    exit();
}
?>