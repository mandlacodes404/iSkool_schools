<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$schoolId = $_SESSION['school_id'];
$message = '';

if (isset($_POST['upload']) && isset($_FILES['logo'])) {
    $file = $_FILES['logo'];
    $fileName = $file['name'];
    $fileTmp = $file['tmp_name'];
    $fileSize = $file['size'];
    $fileError = $file['error'];

    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    if (in_array($fileExt, $allowed)) {
        if ($fileError === 0) {
            if ($fileSize < 2 * 1024 * 1024) { // 2MB limit
                $newFileName = 'school_' . $schoolId . '.' . $fileExt;
                $uploadDir = 'uploads/schools/';
                $fileDestination = $uploadDir . $newFileName;

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }

                move_uploaded_file($fileTmp, $fileDestination);

                $stmt = $conn->prepare("UPDATE schools SET logo = ? WHERE id = ?");
                $stmt->bind_param("si", $fileDestination, $schoolId);
                $stmt->execute();

                $message = "<p style='color:lightgreen;'>✅ Logo uploaded successfully!</p>";
            } else {
                $message = "<p style='color:red;'>File too large (max 2MB).</p>";
            }
        } else {
            $message = "<p style='color:red;'>Error uploading file.</p>";
        }
    } else {
        $message = "<p style='color:red;'>Invalid file type. Allowed: JPG, PNG, GIF, WEBP.</p>";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Upload School Logo</title>
<style>
body {
    background-color: #0d1117;
    color: #e0e6f0;
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}
.container {
    background: rgba(22,27,34,0.7);
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 0 10px rgba(255,255,255,0.1);
    text-align: center;
}
input[type="file"] {
    background: #161b22;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px;
    color: #e0e6f0;
}
button {
    background: white;
    color: #0d1117;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 15px;
}
button:hover {
    background: #dddddd;
}
img {
    margin-top: 15px;
    border-radius: 10px;
    max-height: 100px;
}
</style>
</head>
<body>
<div class="container">
    <h2>Upload School Logo</h2>
    <?= $message ?>
    <form method="POST" enctype="multipart/form-data">
        <input type="file" name="logo" accept="image/*" required><br>
        <button type="submit" name="upload">Upload Logo</button>
    </form>

    <?php
    $result = $conn->query("SELECT logo FROM schools WHERE id = $schoolId");
if ($row = $result->fetch_assoc()) {
    if (!empty($row['logo'])) {
        echo "<img src='" . htmlspecialchars($row['logo']) . "' alt='Current Logo'>";
    }
}

    ?>
</div>
</body>
</html>
