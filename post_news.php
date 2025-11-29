<?php
session_start();
include("config.php");

// Only allow users with role 'school_blogger'
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'school_blogger') {
    echo "Access denied.";
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = $_POST['title'];
    $content = $_POST['content'];
    $posted_by = $_SESSION['email'];
    
    // Handle image upload if provided
    $imagePath = null;
    if (!empty($_FILES['image']['name'])) {
        $targetDir = "uploads/blog_images/";
        if (!is_dir($targetDir)) mkdir($targetDir, 0777, true);

        $imageName = basename($_FILES["image"]["name"]);
        $imagePath = $targetDir . time() . "_" . $imageName;

        move_uploaded_file($_FILES["image"]["tmp_name"], $imagePath);
    }

    $stmt = $conn->prepare("INSERT INTO school_blog (title, content, image_path, posted_by) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $title, $content, $imagePath, $posted_by);
    $stmt->execute();

    echo "News post created successfully!";
}
?>

<!-- News Post Form -->
<form method="POST" enctype="multipart/form-data">
    <label>Title:</label><br>
    <input type="text" name="title" required><br><br>

    <label>Content:</label><br>
    <textarea name="content" rows="6" required></textarea><br><br>

    <label>Optional Image:</label><br>
    <input type="file" name="image"><br><br>

    <button type="submit">Post News</button>
</form>
