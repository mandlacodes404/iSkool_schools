<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR AUTOMATICALLY (NO SCHOOL_ID NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found.");
}

// HANDLE DELETE REQUEST
if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $deleteId = intval($_GET['delete']);

    // Get filename to delete from server
    $getFile = $conn->prepare("SELECT filename FROM resources WHERE id = ? AND uploaded_by = ?");
    $getFile->bind_param("is", $deleteId, $email);
    $getFile->execute();
    $getFileResult = $getFile->get_result();

    if ($fileRow = $getFileResult->fetch_assoc()) {
        $filename = $fileRow['filename'];
        $filePath = "resources/" . $filename;

        if (file_exists($filePath)) {
            unlink($filePath);
        }

        // Delete from database
        $del = $conn->prepare("DELETE FROM resources WHERE id = ? AND uploaded_by = ?");
        $del->bind_param("is", $deleteId, $email);
        $del->execute();
        $del->close();

        // Success feedback
        echo '<script>
            document.addEventListener("DOMContentLoaded", function() {
                const modal = document.getElementById("successModal");
                if (modal) modal.style.display = "flex";
                setTimeout(() => {
                    if (modal) modal.style.display = "none";
                    window.location.href = "view_resources_teacher.php";
                }, 2000);
            });
        </script>';
    }
    $getFile->close();
    exit();
}

/* -------------------------------------------------
   FETCH ALL RESOURCES UPLOADED BY THIS TEACHER
   ------------------------------------------------- */
$sql = "
    SELECT 
        r.id, 
        r.title, 
        r.filename, 
        r.uploaded_at,
        c.id AS class_id, 
        c.name AS class_name
    FROM resources r
    JOIN classes c ON r.class_id = c.id
    WHERE r.uploaded_by = ?
      AND r.academic_year_id = ?
    ORDER BY c.name ASC, r.uploaded_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

/* -------------------------------------------------
   GROUP BY class_id (clean and beautiful)
   ------------------------------------------------- */
$grouped = [];

while ($row = $result->fetch_assoc()) {
    $cid = $row['class_id'];

    if (!isset($grouped[$cid])) {
        $grouped[$cid] = [
            'info' => [
                'id'   => $cid,
                'name' => $row['class_name']
            ],
            'resources' => []
        ];
    }
    $grouped[$cid]['resources'][] = $row;
}

$stmt->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Uploaded Resources</title>
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

        .header-container {
            display: flex;
            justify-content: center;
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

        /* ---------- CLASS GROUP ---------- */
        .class-group {
            max-width: 600px;
            width: 100%;
            margin-bottom: 25px;
            border: 1px solid var(--input-border);
            border-radius: var(--border-radius);
            overflow: hidden;
            background: var(--card-bg);
        }
        .class-header {
            padding: 15px;
            background: rgba(255,255,255,.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: background .3s;
        }
        .class-header:hover { background: rgba(255,255,255,.08); }
        .class-header h3 {
            margin: 0;
            font-size: 18px;
            color: var(--accent-color);
            font-weight: 600;
        }
        .class-header .count {
            font-size: 14px;
            color: #8b949e;
        }
        .class-header .toggle-class {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 18px;
            cursor: pointer;
            padding: 0 5px;
        }
        .class-header .toggle-class.active i { transform: rotate(180deg); }
        .class-resources { display: none; padding: 0 15px 15px; }
        .class-resources.show { display: block; }

        .resource {
            background: rgba(0,0,0,.2);
            padding: 20px;
            border-radius: var(--border-radius);
            margin: 10px 0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease;
            cursor: pointer;
        }

        .resource:hover {
            transform: translateY(-2px);
        }

        .resource-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .resource-header h3 {
            margin: 0;
            color: var(--accent-color);
            font-size: 18px;
            font-weight: 600;
            user-select: text;
        }

        .resource-header i {
            color: var(--text-color);
            font-size: 16px;
            transition: transform 0.3s ease;
        }

        .resource-header i.expanded {
            transform: rotate(180deg);
        }

        .resource-details {
            display: none;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid var(--input-border);
        }

        .resource-details.show {
            display: block;
        }

        .resource-details p {
            margin: 4px 0;
            color: var(--text-color);
            opacity: 0.8;
            font-size: 14px;
            user-select: text;
        }

        .resource-details a.download, .resource-details a.delete {
            display: inline-flex;
            align-items: center;
            margin-right: 15px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            user-select: none;
            transition: color 0.3s ease, transform 0.2s ease;
        }

        .resource-details a.download {
            color: var(--link-bg);
        }

        .resource-details a.download:hover {
            color: var(--link-hover-bg);
            transform: translateY(-1px);
        }

        .resource-details a.delete {
            color: var(--error-color);
        }

        .resource-details a.delete:hover {
            color: #c0392b;
            transform: translateY(-1px);
        }

        .resource-details a i {
            margin-right: 6px;
        }

        .no-resources {
            text-align: center;
            font-size: 16px;
            color: var(--text-color);
            opacity: 0.7;
            margin: 20px 0;
        }

        .back-link {
            display: inline-flex;
            align-items: center;
            background: var(--link-bg);
            color: var(--text-color);
            padding: 10px 16px;
            border-radius: var(--border-radius);
            text-decoration: none;
            font-weight: 600;
            box-shadow: 0 3px 8px rgba(41, 128, 185, 0.3);
            transition: background-color 0.3s ease, transform 0.2s ease;
            user-select: none;
        }

        .back-link:hover {
            background: var(--link-hover-bg);
            transform: translateY(-2px);
        }

        .back-link i {
            margin-right: 8px;
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

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        #successModal, #downloadModal, #fullscreenPreviewModal {
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

        #fullscreenPreviewModal.show {
            display: flex;
        }

        .modal-content {
            background: var(--card-bg);
            padding: 20px;
            border-radius: var(--border-radius);
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            border: 1.5px solid var(--input-border);
        }

        .modal-content h3 {
            color: var(--accent-color);
            margin-bottom: 15px;
            font-size: 20px;
        }

        .modal-content p {
            font-size: 16px;
            color: var(--text-color);
            margin: 0 0 20px;
            font-weight: 500;
        }

        .modal-content button {
            padding: 10px 20px;
            border: none;
            border-radius: var(--border-radius);
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.3s ease, transform 0.2s ease;
        }

        .modal-content .confirm-btn {
            background: var(--button-bg);
            color: var(--text-color);
            margin-right: 10px;
        }

        .modal-content .confirm-btn:hover {
            background: var(--button-hover-bg);
            transform: translateY(-2px);
        }

        .modal-content .cancel-btn {
            background: var(--error-color);
            color: var(--text-color);
        }

        .modal-content .cancel-btn:hover {
            background: #c0392b;
            transform: translateY(-2px);
        }

        /* Expand Button */
        .expand-btn {
            background: var(--accent-color);
            color: var(--bg-color);
            border: none;
            padding: 8px 12px;
            border-radius: var(--border-radius);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 8px;
            transition: background 0.3s;
        }

        .expand-btn:hover {
            background: #1ed760;
        }

        .modal-actions {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 15px;
        }

        .preview-area {
            margin: 15px 0;
            text-align: center;
        }

        .preview-area img {
            max-width: 100%;
            max-height: 200px;
            border-radius: var(--border-radius);
            display: none;
        }

        .preview-area iframe {
            width: 100%;
            height: 200px;
            border: none;
            border-radius: var(--border-radius);
            display: none;
        }

        .preview-area p {
            font-size: 14px;
            color: var(--text-color);
            opacity: 0.7;
            margin: 10px 0 0;
        }

        /* ---------- FULLSCREEN PREVIEW ---------- */
        .fullscreen-content {
            position: relative;
            width: 100%;
            max-width: 90vw;
            max-height: 90vh;
            background: var(--card-bg);
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        #fullscreenImage {
            max-width: 100%;
            max-height: 85vh;
            display: none;
            border-radius: var(--border-radius);
        }

        #fullscreenIframe {
            width: 100%;
            height: 85vh;
            border: none;
            display: none;
        }

        .close-fullscreen {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s;
        }

        .close-fullscreen:hover {
            background: rgba(231, 76, 60, 0.8);
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
            body { padding: 10px; }
            h2 { font-size: 24px; }
            .class-header h3 { font-size: 16px; }
            .resource { padding: 15px; }
            .back-link { padding: 8px 14px; font-size: 14px; }
            .modal-content { padding: 15px; }
            .modal-content h3 { font-size: 18px; }
            .modal-content p { font-size: 14px; }
            .preview-area iframe { height: 150px; }
        }
    </style>
</head>
<body>
    <div class="header-container">
        <h2>My Uploaded Resources</h2>
    </div>

    <div class="resource-container">
        <?php if (!empty($grouped)): ?>
            <?php foreach ($grouped as $classId => $class): ?>
                <div class="class-group">
                    <div class="class-header">
                        <h3><?= htmlspecialchars($class['info']['name']) ?></h3>
                        <div>
                            <span class="count">(<?= count($class['resources']) ?>)</span>
                            <button class="toggle-class" aria-label="Toggle resources"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <div class="class-resources">
                        <?php foreach ($class['resources'] as $r): ?>
                            <div class="resource" data-resource-id="<?= $r['id'] ?>">
                                <div class="resource-header">
                                    <h3><?= htmlspecialchars($r['title']) ?></h3>
                                    <i class="fas fa-chevron-down"></i>
                                </div>
                                <div class="resource-details">
                                    <p><strong>Class:</strong> <?= htmlspecialchars($class['info']['name']) ?></p>
                                    <p><strong>Date:</strong> <?= date("F j, Y, g:i a", strtotime($r['uploaded_at'])) ?></p>
                                    <a class="download" href="#" data-filename="<?= urlencode($r['filename']) ?>" data-title="<?= htmlspecialchars($r['title']) ?>"><i class="fas fa-download"></i> Download</a>
                                    <a class="delete" href="?delete=<?= $r['id'] ?>" onclick="return confirm('Delete this resource?')"><i class="fas fa-trash"></i> Delete</a>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php else: ?>
            <p class="no-resources">You haven’t uploaded any resources yet.</p>
        <?php endif; ?>
    </div>

    <a href="upload_resource.php" class="back-link"><i class="fas fa-arrow-left"></i> Back to Upload Resource</a>

    <!-- Full Screen Loader -->
    <div id="loaderOverlay">
        <div class="loader-text">Processing...</div>
        <div class="loader"></div>
    </div>

    <!-- Success Modal -->
    <div id="successModal">
        <div id="successModalContent">
            <i class="fas fa-check-circle"></i>
            <p>Resource deleted successfully!</p>
        </div>
    </div>

    <!-- Download Preview Modal -->
    <div id="downloadModal">
        <div class="modal-content">
            <h3>Download Resource</h3>
            <p>Preview of "<span id="downloadTitle"></span>":</p>
            <div class="preview-area">
                <img id="previewImage" alt="File Preview">
                <iframe id="previewIframe"></iframe>
                <p id="previewMessage"></p>
            </div>
            <div class="modal-actions">
                <button class="confirm-btn" id="downloadConfirmBtn">Confirm Download</button>
                <button class="cancel-btn" id="downloadCancelBtn">Cancel</button>
                <button class="expand-btn" id="expandPreviewBtn" title="View in fullscreen">
                    <i class="fas fa-expand-alt"></i> Expand
                </button>
            </div>
        </div>
    </div>

    <!-- FULLSCREEN PREVIEW MODAL -->
    <div id="fullscreenPreviewModal">
        <div class="fullscreen-content">
            <button class="close-fullscreen" id="closeFullscreenBtn" aria-label="Close fullscreen">
                <i class="fas fa-times"></i>
            </button>
            <img id="fullscreenImage" alt="Fullscreen preview">
            <iframe id="fullscreenIframe"></iframe>
        </div>
    </div>

    <footer>
        Powered by iSkool &copy; 2025
    </footer>

    <script>
        // Toggle class group
        document.querySelectorAll('.toggle-class').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const header = this.closest('.class-header');
                const content = header.nextElementSibling;
                content.classList.toggle('show');
                this.classList.toggle('active');
            });
        });
        document.querySelectorAll('.class-header').forEach(header => {
            header.addEventListener('click', function(e) {
                if (e.target.closest('.toggle-class')) return;
                this.querySelector('.toggle-class').click();
            });
        });

        // Expandable resource card
        document.querySelectorAll('.resource').forEach(resource => {
            const header = resource.querySelector('.resource-header');
            const details = resource.querySelector('.resource-details');
            const chevron = header.querySelector('i');

            header.addEventListener('click', () => {
                details.classList.toggle('show');
                chevron.classList.toggle('expanded');
            });
        });

        // Download preview modal
        const downloadModal = document.getElementById('downloadModal');
        const downloadTitle = document.getElementById('downloadTitle');
        const downloadConfirmBtn = document.getElementById('downloadConfirmBtn');
        const downloadCancelBtn = document.getElementById('downloadCancelBtn');
        const previewImage = document.getElementById('previewImage');
        const previewIframe = document.getElementById('previewIframe');
        const previewMessage = document.getElementById('previewMessage');
        const loader = document.getElementById('loaderOverlay');

        let currentDownloadLink = '';

        document.querySelectorAll('.download').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                currentDownloadLink = `resources/${link.dataset.filename}`;
                downloadTitle.textContent = link.dataset.title;

                // Reset preview
                previewImage.style.display = 'none';
                previewIframe.style.display = 'none';
                previewMessage.style.display = 'none';
                previewMessage.textContent = '';

                const fileExt = link.dataset.filename.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png'].includes(fileExt)) {
                    previewImage.src = currentDownloadLink;
                    previewImage.style.display = 'block';
                } else if (fileExt === 'pdf') {
                    previewIframe.src = currentDownloadLink;
                    previewIframe.style.display = 'block';
                } else {
                    previewMessage.textContent = 'Preview not available for this file type.';
                    previewMessage.style.display = 'block';
                }

                downloadModal.style.display = 'flex';
            });
        });

        downloadConfirmBtn.addEventListener('click', () => {
            loader.style.display = 'flex';
            downloadModal.style.display = 'none';
            window.open(currentDownloadLink, '_blank');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 1000);
        });

        downloadCancelBtn.addEventListener('click', () => {
            downloadModal.style.display = 'none';
        });

        // Keyboard accessibility
        downloadConfirmBtn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') downloadConfirmBtn.click();
        });
        downloadCancelBtn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') downloadCancelBtn.click();
        });

        // Fullscreen preview
        const fullscreenModal = document.getElementById('fullscreenPreviewModal');
        const fullscreenImage = document.getElementById('fullscreenImage');
        const fullscreenIframe = document.getElementById('fullscreenIframe');
        const expandBtn = document.getElementById('expandPreviewBtn');
        const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');

        expandBtn.addEventListener('click', () => {
            const fileExt = currentDownloadLink.split('.').pop().toLowerCase();
            fullscreenImage.style.display = 'none';
            fullscreenIframe.style.display = 'none';

            if (['jpg', 'jpeg', 'png'].includes(fileExt)) {
                fullscreenImage.src = currentDownloadLink;
                fullscreenImage.style.display = 'block';
            } else if (fileExt === 'pdf') {
                fullscreenIframe.src = currentDownloadLink;
                fullscreenIframe.style.display = 'block';
            }

            fullscreenModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });

        closeFullscreenBtn.addEventListener('click', () => {
            fullscreenModal.classList.remove('show');
            document.body.style.overflow = '';
            fullscreenImage.src = '';
            fullscreenIframe.src = '';
        });

        // Close with Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fullscreenModal.classList.contains('show')) {
                closeFullscreenBtn.click();
            }
        });
    </script>
</body>
</html>