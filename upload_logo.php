<?php
session_start();
require_once 'config.php';
require_once 'school_upload_helper.php';  // ← NEW

if (!isset($_SESSION['school_admin'])) {
    header("Location: index.php");
    exit();
}

$message = '';

// Handle logo upload
if (isset($_POST['upload']) && isset($_FILES['logo'])) {
    $file      = $_FILES['logo'];
    $fileTmp   = $file['tmp_name'];
    $fileSize  = $file['size'];
    $fileError = $file['error'];
    $fileName  = $file['name'];
    $safeName  = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($fileName));

    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    $allowedMimeTypes = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp']
    ];
    $fileExt = strtolower(pathinfo($safeName, PATHINFO_EXTENSION));
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = $finfo ? finfo_file($finfo, $fileTmp) : false;
    if ($finfo) {
        finfo_close($finfo);
    }

    if ($safeName === '' || !in_array($fileExt, $allowed, true) || !isset($allowedMimeTypes[$fileExt]) || !in_array($mimeType, $allowedMimeTypes[$fileExt], true)) {
        $message = "<p style='color:#f85149;'>Invalid file type. Only images allowed.</p>";
    } elseif ($fileError !== 0) {
        $message = "<p style='color:#f85149;'>Upload error occurred.</p>";
    } elseif ($fileSize > 2 * 1024 * 1024) {
        $message = "<p style='color:#f85149;'>File too large (max 2MB).</p>";
    } else {
        // ── CHANGED: school-scoped upload directory ──────────────────────────
        $uploadDir  = getSchoolUploadDir($conn, 'uploads/schools');
        $schoolSlug = getSchoolSlug($conn);
        // ─────────────────────────────────────────────────────────────────────

        // Clean filename: school_logo.ext (one canonical logo per school)
        $newFileName     = 'school_logo.' . $fileExt;
        $fileDestination = $uploadDir . $newFileName;

        // Remove any old logo files for this school only
        array_map('unlink', glob($uploadDir . 'school_logo.*'));

        if (move_uploaded_file($fileTmp, $fileDestination)) {
            // Store the full relative path so it can be served directly
            $storedPath = 'uploads/schools/' . $schoolSlug . '/' . $newFileName;

            $stmt = $conn->prepare("UPDATE school_name SET setting_value = ? WHERE setting_key = 'school_logo'");
            $stmt->bind_param("s", $storedPath);
            $stmt->execute();

            $message = "<p style='color:#79c0ff;'>Logo updated successfully!</p>";
        } else {
            $message = "<p style='color:#f85149;'>Failed to save file.</p>";
        }
    }
}

// Get current logo path
$currentLogo = '';
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_logo'");
if ($row = $result->fetch_assoc()) {
    $path = trim($row['setting_value']);
    if ($path !== '' && file_exists($path)) {
        $currentLogo = $path;
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Upload School Logo</title>
<style>
  :root {
    --bg: #0d1117;
    --card: #161b22;
    --border: #30363d;
    --text: #c9d1d9;
    --accent: #58a6ff;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    padding: 20px;
  }
  .container {
    background: var(--card);
    padding: 40px 50px;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    text-align: center;
    max-width: 500px;
    width: 100%;
    border: 1px solid var(--border);
  }
  h2 {
    color: var(--accent);
    margin-bottom: 24px;
    font-size: 2rem;
  }
  .message {
    margin: 16px 0;
    font-weight: 500;
  }
  input[type="file"] {
    background: #0d1117;
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 30px;
    width: 100%;
    color: var(--text);
    font-size: 1.1rem;
    cursor: pointer;
  }
  input[type="file"]::file-selector-button {
    background: var(--accent);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    margin-right: 12px;
  }
  button {
    background: white;
    color: #0d1117;
    border: none;
    padding: 14px 34px;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 20px;
    transition: 0.2s;
  }
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.3);
  }
  .current-logo {
    margin-top: 30px;
    padding: 20px;
    background: #0d1117;
    border-radius: 12px;
    border: 1px solid var(--border);
  }
  .current-logo img {
    max-height: 140px;
    max-width: 100%;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  }
  .no-logo {
    color: #8b949e;
    font-style: italic;
    padding: 20px;
  }
</style>
</head>
<body>

<div class="container">
  <h2>School Logo</h2>

  <?php if ($message) echo "<div class='message'>$message</div>"; ?>

  <form method="POST" enctype="multipart/form-data">
    <input type="file" name="logo" accept="image/*" required>
    <br>
    <button type="submit" name="upload">Upload New Logo</button>
  </form>

  <div class="current-logo">
    <?php if ($currentLogo): ?>
      <p><strong>Current Logo:</strong></p>
      <img src="<?= htmlspecialchars($currentLogo) ?>" alt="School Logo">
      <p style="margin-top:10px; font-size:0.9rem; color:#79c0ff;">
        <?= htmlspecialchars(basename($currentLogo)) ?>
      </p>
    <?php else: ?>
      <p class="no-logo">No logo uploaded yet</p>
    <?php endif; ?>
  </div>
</div>

</body>
</html>
