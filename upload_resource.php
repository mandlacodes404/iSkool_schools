<?php
session_start();
require_once 'config.php';
require_once 'push_functions.php';
require 'vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];
$name  = $_SESSION['name'] ?? 'Teacher';
$message = "";
$maxFileSize = 10 * 1024 * 1024; // 10MB

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY (NO SCHOOL_ID NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found. Please contact admin.");
}

// GET CURRENT GLOBAL TERM (Your throne — same as everywhere)
$current_global_term = 4;
$result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $current_global_term = (int)$row['current_global_term'];
}

// Get ALL classes in current school (current DB = current school → no filter)
$stmt = $conn->prepare("SELECT id, name FROM classes ORDER BY name ASC");
$stmt->execute();
$classes = $stmt->get_result();
$stmt->close();

// --- Generate Deep Link for Resources ---
$cleanBaseUrl = rtrim(BASE_URL, '/');
$resourceLink = $cleanBaseUrl . "/learner_dashboard.php?page=view_resources_user.php";

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['resource'])) {
    $title    = trim($_POST['title']);
    $classId  = intval($_POST['class_id']);
    $file     = $_FILES['resource'];

    // Validate inputs
    if (empty($title)) {
        $message = "Please enter a title.";
    } elseif ($classId <= 0) {
        $message = "Please select a class.";
    } elseif ($file['error'] !== UPLOAD_ERR_OK) {
        $message = "File upload failed.";
    } elseif ($file['size'] > $maxFileSize) {
        $message = "File too large. Max 10MB allowed.";
    } else {
        $allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'];
        $fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        
        if (!in_array($fileExt, $allowedTypes)) {
            $message = "Invalid file type. Allowed: " . implode(', ', $allowedTypes);
        } else {
            // Secure filename
            $filename = time() . "_" . preg_replace("/[^A-Za-z0-9._-]/", "", basename($file['name']));
            $targetPath = "resources/" . $filename;

            if (!is_dir("resources/")) {
                mkdir("resources/", 0755, true);
            }

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                // Insert resource — clean, no school_id
                $uploadStmt = $conn->prepare("
                    INSERT INTO resources 
                    (title, filename, class_id, uploaded_by, academic_year_id, term_number, uploaded_at) 
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ");
                $uploadStmt->bind_param("ssisii", 
                    $title, 
                    $filename, 
                    $classId, 
                    $email, 
                    $current_academic_year_id,
                    $current_global_term
                );
                $uploadStmt->execute();
                $uploadStmt->close();

                $message = "Resource uploaded successfully!";

                // Notify learners in that class
                $userQuery = $conn->prepare("
                    SELECT u.email, u.name 
                    FROM users u
                    JOIN class_students cs ON u.email = cs.student_email
                    WHERE cs.class_id = ? AND u.role = 'learner'
                ");
                $userQuery->bind_param("i", $classId);
                $userQuery->execute();
                $learners = $userQuery->get_result();

    // --- SMART NOTIFICATION LOGIC ---
                
                $force_email = isset($_POST['force_email']) ? true : false;

                while ($learner = $learners->fetch_assoc()) {
                    $currentEmail = $learner['email'];
                    $learnerName  = $learner['name'];
                    $isPushSent   = false;

                    // 1. Try Mobile Push first
                    $checkSub = $conn->prepare("SELECT id FROM user_subscriptions WHERE user_email = ? LIMIT 1");
                    $checkSub->bind_param("s", $currentEmail);
                    $checkSub->execute();
                    $subResult = $checkSub->get_result();
                    
                    if ($subResult->num_rows > 0) {
    $isPushSent = sendPushToUser(
        $conn, 
        $currentEmail, 
        "📚 New Resource: " . $title, 
        "A new study material has been uploaded for your class.",
        $resourceLink // <--- Passes the deep link to the mobile device
    );
}
                    $checkSub->close();

                    // 2. Email Fallback (Only if Push failed OR Teacher forced it)
                    if (!$isPushSent || $force_email) {
                        try {
                            $mail = new PHPMailer(true);
                            $mail->isSMTP();
                            $mail->Host       = 'iskool.online';
                            $mail->SMTPAuth   = true;
                            $mail->Username   = 'noreply@iskool.online';
                            $mail->Password   = 'ogeQkRitRfdy';
                            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                            $mail->Port       = 465;

                            $mail->setFrom('noreply@iskool.online', 'iSkool');
                            $mail->addAddress($currentEmail);
                            $mail->isHTML(true);
                            $mail->Subject = "New Resource: $title";
                            $mail->Body = '
                                <!DOCTYPE html>
                                <html lang="en">
                                <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>New Resource Notification</title>
                                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                                <style>
                                  body { margin: 0; padding: 0; background-color: #121212; font-family: "Inter", sans-serif; color: #ffffff; }
                                  .email-wrapper { max-width: 600px; margin: 30px auto; background-color: #1e1e1e; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
                                  .email-header { background-color: #161b22; padding: 30px; text-align: center; }
                                  .email-header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #1db954; }
                                  .email-body { padding: 30px; text-align: left; }
                                  .email-body h2 { font-size: 22px; font-weight: 600; color: #1db954; margin: 0 0 20px; }
                                  .cta-button { display: inline-block; padding: 12px 25px; margin-top: 15px; background-color: #1db954; color: #121212; font-weight: 600; border-radius: 25px; text-decoration: none; }
                                  .email-footer { background-color: #161b22; padding: 20px; text-align: center; font-size: 13px; color: #8b949e; }
                                </style>
                                </head>
                                <body>
                                  <div class="email-wrapper">
                                    <div class="email-header"><h1>iSkool</h1></div>
                                    <div class="email-body">
                                      <p>Hello ' . htmlspecialchars($learnerName) . ',</p>
                                      <h2>New Resource: ' . htmlspecialchars($title) . '</h2>
                                      <p>A new study resource has been uploaded for your class. Check it out to stay ahead!</p>
                                      <a href="http://iskool.online/view_resources_user.php" class="cta-button">View Resources</a>
                                    </div>
                                    <div class="email-footer"><p>Powered by iSkool &copy; 2026</p></div>
                                  </div>
                                </body>
                                </html>';

                            $mail->send();
                        } catch (Exception $e) {
                            error_log("Email failed to " . $currentEmail . ": " . $mail->ErrorInfo);
                        }
                    }
                }
                $userQuery->close();
                // --- END NOTIFICATION LOGIC ---

                // Output JavaScript to trigger the success popup and redirect
                echo '<script>
                    document.addEventListener("DOMContentLoaded", function() {
                        const modal = document.getElementById("successModal");
                        if (modal) modal.style.display = "flex";
                        setTimeout(function() {
                            window.location.href = "view_resources_teacher.php";
                        }, 2000);
                    });
                </script>';
            } else {
                $message = '<i class="fas fa-exclamation-circle"></i> Failed to upload file.';
            }
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Upload Resource</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.85);
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #27ae60;
            --button-hover-bg: #219150;
            --link-bg: #2980b9;
            --link-hover-bg: #1c5980;
            --border-radius: 12px;
            --input-bg: rgba(255, 255, 255, 0.07);
            --input-border: rgba(255, 255, 255, 0.2);
            --error-color: #e74c3c;
            --success-color: #27ae60;
            --shadow-glow: rgba(79, 209, 197, 0.3);
        }

        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        a.back, a.view-resources {
            display: inline-flex;
            align-items: center;
            background: var(--link-bg);
            color: var(--text-color);
            padding: 10px 16px;
            border-radius: var(--border-radius);
            text-decoration: none;
            margin-bottom: 20px;
            font-weight: 600;
            box-shadow: 0 3px 8px rgba(41, 128, 185, 0.3);
            transition: background-color 0.3s ease, transform 0.2s ease;
        }

        a.back i, a.view-resources i {
            margin-right: 8px;
        }

        a.back:hover, a.view-resources:hover {
            background: var(--link-hover-bg);
            transform: translateY(-2px);
        }

        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            max-width: 600px;
            margin-bottom: 20px;
        }

        h2 {
            font-size: 28px;
            margin: 0;
            text-align: center;
            color: var(--accent-color);
            user-select: none;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        form {
            background: var(--card-bg);
            padding: 30px;
            border-radius: var(--border-radius);
            max-width: 600px;
            width: 100%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease;
        }

        form:hover {
            transform: translateY(-2px);
        }

        label {
            display: block;
            margin-top: 15px;
            margin-bottom: 8px;
            color: var(--text-color);
            font-weight: 600;
            font-size: 14px;
            user-select: none;
        }

        input[type="text"],
        select,
        input[type="file"] {
            width: 100%;
            padding: 12px;
            border-radius: var(--border-radius);
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-color);
            font-size: 15px;
            box-sizing: border-box;
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        input[type="text"]:focus,
        select:focus,
        input[type="file"]:focus {
            border-color: var(--accent-color);
            box-shadow: 0 0 8px var(--shadow-glow);
            outline: none;
        }

        input[type="file"] {
            padding: 10px;
            cursor: pointer;
        }

        .file-drop-area {
            border: 2px dashed var(--input-border);
            padding: 20px;
            border-radius: var(--border-radius);
            text-align: center;
            margin-top: 15px;
            background-color: var(--input-bg);
            transition: border-color 0.3s ease;
            cursor: pointer;
        }

        .file-drop-area.dragover {
            border-color: var(--accent-color);
            background-color: rgba(79, 209, 197, 0.1);
        }

        .file-drop-area p {
            margin: 0;
            color: var(--text-color);
            font-size: 14px;
        }

        .file-preview {
            margin-top: 15px;
            text-align: center;
        }

        .file-preview img {
            max-width: 100%;
            max-height: 200px;
            border-radius: var(--border-radius);
            display: none;
        }

        .file-preview p {
            color: var(--text-color);
            font-size: 14px;
            margin: 10px 0 0;
        }

        button {
            width: 100%;
            margin-top: 20px;
            padding: 14px;
            background-color: var(--button-bg);
            color: var(--text-color);
            font-weight: 600;
            font-size: 16px;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
            transition: background-color 0.3s ease, transform 0.2s ease;
        }

        button:hover {
            background-color: var(--button-hover-bg);
            transform: translateY(-2px);
        }

        button:disabled {
            background-color: #555;
            cursor: not-allowed;
            box-shadow: none;
        }

        .msg {
            margin: 20px 0;
            font-weight: 600;
            text-align: center;
            padding: 12px;
            border-radius: var(--border-radius);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .msg.success {
            background: rgba(39, 174, 96, 0.2);
            color: var(--success-color);
        }

        .msg.error {
            background: rgba(231, 76, 60, 0.2);
            color: var(--error-color);
        }

        footer {
            margin-top: auto;
            text-align: center;
            color: var(--text-color);
            opacity: 0.6;
            font-size: 14px;
            padding: 20px 0;
            user-select: none;
        }

        footer a {
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
        }

        footer a:hover {
            text-decoration: underline;
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 9999;
        }

        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
            text-align: center;
        }

        #confirmModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }

        .modal-content {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--border-radius);
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .modal-content h3 {
            color: var(--accent-color);
            margin-bottom: 15px;
        }

        .modal-content p {
            color: var(--text-color);
            margin-bottom: 20px;
        }

        .modal-content button {
            width: auto;
            padding: 10px 20px;
            margin: 0 10px;
        }

        .modal-content .cancel-btn {
            background: var(--error-color);
        }

        .modal-content .cancel-btn:hover {
            background: #c0392b;
        }

        /* Success Modal Styles */
        #successModal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-in-out;
        }

        #successModalContent {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--border-radius);
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            border: 1.5px solid var(--input-border);
        }

        #successModalContent p {
            font-size: 18px;
            color: var(--text-color);
            margin: 0 0 10px;
            font-weight: 600;
        }

        #successModalContent i {
            color: var(--success-color);
            font-size: 40px;
            margin-bottom: 10px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 480px) {
            body {
                padding: 10px;
            }

            h2 {
                font-size: 24px;
            }

            form {
                padding: 20px;
            }

            button {
                font-size: 14px;
                padding: 12px;
            }

            .file-drop-area {
                padding: 15px;
            }

            .header-container {
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="header-container">
        <h2><i class="fas fa-upload"></i> Upload Study Resource</h2>
        <a href="view_resources_teacher.php" class="view-resources"><i class="fas fa-folder-open"></i> View Resources</a>
    </div>

    <?php if ($message): ?>
        <p class="msg <?= strpos($message, '❌') !== false || strpos($message, '❗') !== false ? 'error' : 'success' ?>">
            <?= htmlspecialchars(str_replace(['✅', '❌', '❗'], '', $message)) ?>
        </p>
    <?php endif; ?>

    <form id="uploadForm" method="POST" enctype="multipart/form-data">
        <label for="title">Resource Title:</label>
        <input type="text" id="title" name="title" required aria-describedby="title-error">

        <label for="class_id">Select Class:</label>
        <select id="class_id" name="class_id" required aria-describedby="class-error">
            <option value="">-- Choose Class --</option>
            <?php while ($row = $classes->fetch_assoc()): ?>
                <option value="<?= $row['id'] ?>"><?= htmlspecialchars($row['name']) ?></option>
            <?php endwhile; ?>
        </select>

        <div style="background:#1a202c; padding:18px; border-radius:12px; border-left:5px solid #4fd1c5; margin:28px 0 10px; text-align:center; font-size:1.1rem;">
        <strong style="color:#4fd1c5; font-size:1.35rem;">Posting to: TERM <?= $current_global_term ?></strong><br>
        <small style="color:#8b949e;">This resource will automatically belong to the current term.<br>You (Super Admin) control the current term globally.</small>
    </div>

        <label for="resource">Select File:</label>
        <div class="file-drop-area" id="fileDropArea">
            <p>Drag and drop your file here or click to browse<br>(Max 10MB: PDF, DOC, PPT, JPG, PNG, ZIP)</p>
            <input type="file" id="resource" name="resource" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" required aria-describedby="file-error">
        </div>

        <div class="file-preview" id="filePreview">
            <img id="previewImage" alt="File Preview">
            <p id="fileName"></p>
        </div>
         <label style="display: flex; align-items: center; cursor: pointer; color: #4fd1c5; margin-bottom: 15px;">
    <input type="checkbox" name="force_email" value="1" style="margin-right: 10px; width: 18px; height: 18px;">
    learrners will uatomatically get mobile notifications but you can also send Email Alert to everyone
</label>
        <button type="submit" id="submitBtn">Upload</button>
    </form>

    <div id="loaderOverlay">
        <div class="loader-text">might take a couple of seconds please wait!</div>
        <div class="loader"></div>
    </div>

    <div id="confirmModal">
        <div class="modal-content">
            <h3>Confirm Upload</h3>
            <p>Are you sure you want to upload "<span id="confirmTitle"></span>" for class "<span id="confirmClass"></span>"? This will notify all learners in the class.</p>
            <button id="confirmBtn">Confirm</button>
            <button class="cancel-btn" id="cancelBtn">Cancel</button>
        </div>
    </div>

    <!-- Success Modal -->
    <div id="successModal">
        <div id="successModalContent">
            <i class="fas fa-check-circle"></i>
            <p>Resource uploaded successfully!</p>
        </div>
    </div>

    <script>
        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('resource');
        const fileDropArea = document.getElementById('fileDropArea');
        const previewImage = document.getElementById('previewImage');
        const fileNameDisplay = document.getElementById('fileName');
        const loader = document.getElementById('loaderOverlay');
        const confirmModal = document.getElementById('confirmModal');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmClass = document.getElementById('confirmClass');
        const titleInput = document.getElementById('title');
        const classSelect = document.getElementById('class_id');
        const submitBtn = document.getElementById('submitBtn');
        const maxFileSize = 10 * 1024 * 1024; // 10MB

        // Drag-and-drop functionality
        fileDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropArea.classList.add('dragover');
        });

        fileDropArea.addEventListener('dragleave', () => {
            fileDropArea.classList.remove('dragover');
        });

        fileDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropArea.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            validateAndPreviewFile();
        });

        fileInput.addEventListener('change', validateAndPreviewFile);

        function validateAndPreviewFile() {
            const file = fileInput.files[0];
            if (!file) return;

            fileNameDisplay.textContent = file.name;
            previewImage.style.display = 'none';

            // Validate file size
            if (file.size > maxFileSize) {
                alert('File too large. Maximum size is 10MB.');
                fileInput.value = '';
                fileNameDisplay.textContent = '';
                return;
            }

            // Validate file type
            const allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip'];
            const fileExt = file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(fileExt)) {
                alert('Invalid file type. Allowed: ' + allowedTypes.join(', '));
                fileInput.value = '';
                fileNameDisplay.textContent = '';
                return;
            }

            // Preview image files
            if (['jpg', 'jpeg', 'png'].includes(fileExt)) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewImage.style.display = 'none';
            }
        }

        // Form submission with confirmation modal
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!titleInput.value.trim()) {
                alert('Please enter a resource title.');
                return;
            }
            if (!classSelect.value) {
                alert('Please select a class.');
                return;
            }
            if (!fileInput.files[0]) {
                alert('Please select a file.');
                return;
            }

            confirmTitle.textContent = titleInput.value;
            confirmClass.textContent = classSelect.options[classSelect.selectedIndex].text;
            confirmModal.style.display = 'flex';
        });

        confirmBtn.addEventListener('click', () => {
            submitBtn.disabled = true;
            loader.style.display = 'flex';
            confirmModal.style.display = 'none';
            form.submit();
        });

        cancelBtn.addEventListener('click', () => {
            confirmModal.style.display = 'none';
        });

        // Keyboard accessibility
        fileDropArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fileInput.click();
        });

        confirmBtn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });

        cancelBtn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') cancelBtn.click();
        });
    </script>
</body>
</html>