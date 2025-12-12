<?php
session_start();
require_once 'config.php';

// Ensure only school admin can access
if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

// Clean up old session key
unset($_SESSION['school_id']);

$message = "";

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['term'], $_POST['full_name'], $_POST['class'], $_POST['medal'])) {
        $term    = (int)$_POST['term'];
        $names   = $_POST['full_name'];
        $classes = $_POST['class'];
        $medals  = $_POST['medal'];

        $uploadDir = "uploads/achievers/";
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        // Process each achiever
        for ($i = 0; $i < count($names); $i++) {
            $fullName   = trim($names[$i]);
            $class      = trim($classes[$i]);
            $medal      = $medals[$i];
            $profilePic = null;

            // Handle profile picture upload
            if (isset($_FILES['profile_picture']['name'][$i]) && !empty($_FILES['profile_picture']['name'][$i])) {
                $fileName   = time() . "_" . $i . "_" . basename($_FILES['profile_picture']['name'][$i]);
                $targetFile = $uploadDir . $fileName;

                if (move_uploaded_file($_FILES['profile_picture']['tmp_name'][$i], $targetFile)) {
                    $profilePic = $fileName;
                }
            }

            // Insert into DB — NO school_id column
            $stmt = $conn->prepare("
                INSERT INTO top_achievers 
                (full_name, class, term, medal, profile_picture) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->bind_param("ssiss", $fullName, $class, $term, $medal, $profilePic);
            $stmt->execute();
            $stmt->close();
        }

        $message = "Top Achievers updated successfully!";
    } else {
        $message = "Please fill in all required fields.";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Update Top Achievers</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #0d1117;
            color: #e0e6f0;
            padding: 20px;
        }
        h2 {
            color: #58a6ff;
        }
        form {
            background: rgba(22, 27, 34, 0.85);
            padding: 20px;
            border-radius: 12px;
        }
        .achiever-row {
            display: flex;
            gap: 10px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        input, select {
            padding: 8px;
            border-radius: 8px;
            border: none;
            outline: none;
        }
        input[type="text"], select {
            flex: 1;
        }
        input[type="file"] {
            flex: 1;
        }
        .add-btn, .save-btn {
            padding: 10px 14px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }
        .add-btn {
            background: #58a6ff;
            color: white;
        }
        .add-btn:hover {
            background: #1f6feb;
        }
        .save-btn {
            background: #2ecc71;
            color: white;
            margin-top: 15px;
        }
        .save-btn:hover {
            background: #27ae60;
        }
        .message {
            margin: 10px 0;
            color: #2ecc71;
        }
    </style>
</head>
<body>

<h2>Update Top Achievers</h2>

<?php if ($message): ?>
    <p class="message"><?= htmlspecialchars($message) ?></p>
<?php endif; ?>

<form method="POST" enctype="multipart/form-data">
    <label for="term">Select Term:</label>
    <select name="term" required>
        <option value="1">Term 1</option>
        <option value="2">Term 2</option>
        <option value="3">Term 3</option>
        <option value="4">Term 4</option>
    </select>

    <div id="achievers-container">
        <div class="achiever-row">
            <input type="text" name="full_name[]" placeholder="Full Name" required>
            <input type="text" name="class[]" placeholder="Class (e.g., Grade 8C)" required>
            <input type="file" name="profile_picture[]">
            <select name="medal[]" required>
                <option value="Gold">🥇 Gold</option>
                <option value="Silver">🥈 Silver</option>
                <option value="Bronze">🥉 Bronze</option>
            </select>
        </div>
    </div>

    <button type="button" class="add-btn" onclick="addRow()">+ Add More</button>
    <br>
    <button type="submit" class="save-btn">Save Achievers</button>
</form>

<script>
function addRow() {
    const container = document.getElementById("achievers-container");
    const newRow = document.createElement("div");
    newRow.classList.add("achiever-row");
    newRow.innerHTML = `
        <input type="text" name="full_name[]" placeholder="Full Name" required>
        <input type="text" name="class[]" placeholder="Class (e.g., Grade 8C)" required>
        <input type="file" name="profile_picture[]">
        <select name="medal[]" required>
            <option value="Gold">🥇 Gold</option>
            <option value="Silver">🥈 Silver</option>
            <option value="Bronze">🥉 Bronze</option>
        </select>
    `;
    container.appendChild(newRow);
}
</script>

</body>
</html>
