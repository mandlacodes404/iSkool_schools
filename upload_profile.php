<?php
require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/csrf_helper.php';
require_once 'config.php';
require_once 'school_upload_helper.php';  // ← NEW

if (!isset($_SESSION['email'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not logged in']);
    exit();
}

verify_csrf_token();

$email       = $_SESSION['email'];
$defaultPic  = 'default.png';
$uploadsBase = __DIR__ . '/uploads/learners';   // absolute, so it never depends on the server's working directory

// The picture this learner has right now (needed to clean up after a change)
function getCurrentPicture(mysqli $conn, string $email): string
{
    $stmt = $conn->prepare("SELECT profile_picture FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->bind_result($pic);
    $stmt->fetch();
    $stmt->close();
    return (string)($pic ?? '');
}

// Delete a learner's previous picture file, but only when that is clearly safe:
//  - it looks like one of our own uploads (learner_<time>[_<hex>].jpg/png/gif), never a shared default or other asset
//  - it really sits inside uploads/learners (no path tricks)
//  - no other learner still points at the same file (older uploads could collide on the same name)
function deleteOldProfilePicture(mysqli $conn, string $email, string $old, string $base): void
{
    $old = trim(str_replace('\\', '/', $old), '/');
    if ($old === '' || $old === 'default.png') return;
    if (!preg_match('/^learner_\d+(?:_[a-f0-9]+)?\.(?:jpe?g|png|gif)$/i', basename($old))) return;

    $stmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE profile_picture = ? AND email <> ?");
    $stmt->bind_param("ss", $old, $email);
    $stmt->execute();
    $stmt->bind_result($others);
    $stmt->fetch();
    $stmt->close();
    if ((int)$others > 0) return;

    $real     = realpath($base . '/' . $old);
    $realBase = realpath($base);
    if ($real === false || $realBase === false || strpos($real, $realBase . DIRECTORY_SEPARATOR) !== 0 || !is_file($real)) return;

    @unlink($real);
}

// ---- Handle remove profile request ----
if (isset($_POST['remove']) && $_POST['remove'] == '1') {
    $oldPicture = getCurrentPicture($conn, $email);
    $stmt = $conn->prepare("UPDATE users SET profile_picture = ? WHERE email = ?");
    $stmt->bind_param("ss", $defaultPic, $email);
    if ($stmt->execute()) {
        deleteOldProfilePicture($conn, $email, $oldPicture, $uploadsBase);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to reset profile']);
    }
    exit();
}

// ---- Handle new profile upload ----
if (isset($_FILES['profile']) && $_FILES['profile']['error'] === 0) {
    $file = $_FILES['profile'];

    // Check the file really is an image (a file name can be faked) and take the extension from its real type
    $info    = @getimagesize($file['tmp_name']);
    $allowed = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif'];

    if ($info === false || !isset($allowed[$info[2]])) {
        echo json_encode(['error' => 'Invalid file type. Please choose a JPG, PNG or GIF image.']);
        exit();
    }
    $ext = $allowed[$info[2]];

    // ── CHANGED: school-scoped upload directory ──────────────────────────────
    $uploadDir  = getSchoolUploadDir($conn, $uploadsBase);
    $schoolSlug = getSchoolSlug($conn);

    // The helper ignores a failed mkdir(), so check the folder is really there and writable
    if (!is_dir($uploadDir) || !is_writable($uploadDir)) {
        error_log('upload_profile.php: upload folder missing or not writable: ' . $uploadDir);
        echo json_encode(['error' => 'Server error: the upload folder is missing or not writable.']);
        exit();
    }
    // ────────────────────────────────────────────────────────────────────────

    $newName     = 'learner_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;   // random part: two learners can never overwrite each other
    $destination = $uploadDir . $newName;

    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // Store slug/filename so the serving code can reconstruct the path
        $storedName = $schoolSlug . '/' . $newName;

        $oldPicture = getCurrentPicture($conn, $email);

        $stmt = $conn->prepare("UPDATE users SET profile_picture = ? WHERE email = ?");
        $stmt->bind_param("ss", $storedName, $email);
        try {
            $saved = $stmt->execute();
        } catch (Throwable $e) {
            error_log('upload_profile.php: could not save profile picture: ' . $e->getMessage());
            $saved = false;
        }
        $stmt->close();

        if (!$saved) {
            @unlink($destination);   // don't leave an orphan file behind, and keep the old picture
            echo json_encode(['error' => 'Failed to save your profile picture. Please try again.']);
            exit();
        }

        deleteOldProfilePicture($conn, $email, $oldPicture, $uploadsBase);

        echo json_encode(['success' => true, 'file' => $storedName]);
        exit();
    } else {
        echo json_encode(['error' => 'Failed to move uploaded file']);
        exit();
    }
}

// ---- Nothing was saved: say why, instead of a blanket "No file uploaded" ----
// PHP reports an oversized or interrupted upload through $_FILES['profile']['error'] (anything other than 0),
// and throws the whole request away when it exceeds post_max_size (then $_FILES and $_POST are both empty).
if (isset($_FILES['profile'])) {
    $code     = (int)$_FILES['profile']['error'];
    $messages = [
        UPLOAD_ERR_INI_SIZE   => 'That photo is too large for the server (limit ' . ini_get('upload_max_filesize') . '). Please choose a smaller one.',
        UPLOAD_ERR_FORM_SIZE  => 'That photo is too large. Please choose a smaller one.',
        UPLOAD_ERR_PARTIAL    => 'The upload was interrupted. Please try again.',
        UPLOAD_ERR_NO_FILE    => 'No file uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Server error: the temporary upload folder is missing.',
        UPLOAD_ERR_CANT_WRITE => 'Server error: the file could not be written to disk.',
        UPLOAD_ERR_EXTENSION  => 'The upload was blocked by a server extension.',
    ];
    echo json_encode(['error' => $messages[$code] ?? ('Upload failed (error code ' . $code . ')')]);
    exit();
}
if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    echo json_encode(['error' => 'That photo is too large for the server (limit ' . ini_get('post_max_size') . '). Please choose a smaller one.']);
    exit();
}

echo json_encode(['error' => 'No file uploaded']);