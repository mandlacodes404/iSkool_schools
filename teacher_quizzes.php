<?php
/**
 * iSkool - Teacher Quizzes List
 *
 * Displays all quizzes created by the logged-in teacher, organized by term and class.
 * Features:
 * - Automatic grouping by academic year terms and classes
 * - Real-time status indicators (Open, Scheduled, Closed) with toggle functionality
 * - Publish/unpublish marks controls with confirmation modal
 * - Edit quiz links and student results viewing
 * - Dynamic current year and term badges
 * - Responsive design with collapsible sections and full-screen loader
 *
 * @package     iSkool
 * @subpackage  Teacher
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-15
 * @link        https://iskool.online
 */
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

/* -------------------------------------------------
         GET CURRENT ACADEMIC YEAR 
   ------------------------------------------------- */
$current_academic_year_id = null;
$current_year_name        = 'Unknown';

$result = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
    $current_year_name        = $row['name'];
}

if (!$current_academic_year_id) {
    die("No active academic year found. Please contact your administrator.");
}

/* -------------------------------------------------
          GET CURRENT GLOBAL TERM 
   ------------------------------------------------- */
$current_global_term = 4;
$termResult = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termResult->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}

/* -------------------------------------------------
               FETCH QUIZZES
   ------------------------------------------------- */
$sql = "
    SELECT 
        q.id, q.title, q.duration, q.publish_marks, q.start_time, q.status, q.term_number,
        c.id AS class_id, c.name AS class_name
    FROM quizzes q
    INNER JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ? 
      AND q.academic_year_id = ?
    ORDER BY q.term_number ASC, c.name ASC, q.start_time DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

/* -------------------------------------------------
         GROUP BY TERM → CLASS → QUIZZES
   ------------------------------------------------- */
$terms = [];

while ($row = $result->fetch_assoc()) {
    $term = $row['term_number'] ?? $current_global_term;
    $class_id = $row['class_id'];
    
    if (!isset($terms[$term])) {
        $terms[$term] = [];
    }
    if (!isset($terms[$term][$class_id])) {
        $terms[$term][$class_id] = [
            'class_name' => $row['class_name'],
            'quizzes' => []
        ];
    }
    $terms[$term][$class_id]['quizzes'][] = $row;
}
$stmt->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Created Quizzes</title>
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"/>
    
    <!-- NUNITO FONT (Google Fonts) -->
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        :root{
            --bg-color:#0d1117;--card-bg:#1a202c;--text-color:#e0e6f0;--accent-color:#4fd1c5;
            --button-bg:#2c3e50;--button-hover-bg:#34495e;--card-radius:12px;--shadow-glow:rgba(79,209,197,.3);
            --border-color:rgba(255,255,255,.1);--published-color:#238636;--hidden-color:#f85149;
            --status-open:#f28c38;--status-scheduled:#1e90ff;--status-closed:#6b7280
        }
        
        /* NUNITO FONT APPLIED GLOBALLY */
        body{
            margin:0;
            font-family:'Nunito', sans-serif !important;
            background:var(--bg-color);
            color:var(--text-color);
            padding:20px;
            min-height:100vh;
            display:flex;
            flex-direction:column;
            align-items:center;
            font-weight:600; /* Slightly bolder for better readability */
        }
        
        /* Make sure all text uses Nunito */
        h2, h3, p, input, select, button, .status-badge, .current-year-badge {
            font-family:'Nunito', sans-serif !important;
        }
        
        .container{max-width:800px;width:100%}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:15px}
        h2{font-size:28px;color:var(--text-color);margin:0;display:flex;align-items:center;gap:10px}
        .current-year-badge{background:#238636;color:white;padding:6px 14px;border-radius:20px;font-size:14px;font-weight:700}
        .search-sort{display:flex;gap:10px;flex-wrap:wrap}
        .search-sort input,.search-sort select{
            padding:10px;border-radius:var(--card-radius);background:var(--card-bg);
            border:1px solid var(--border-color);color:var(--text-color);font-size:14px;width:200px;
            font-weight:600;
        }
        .search-sort input:focus,.search-sort select:focus{
            border-color:var(--accent-color);box-shadow:0 0 8px var(--shadow-glow);outline:none
        }

        .class-group{margin-bottom:25px;border:1px solid var(--border-color);border-radius:var(--card-radius);overflow:hidden;background:var(--card-bg)}
        .class-header{padding:15px;background:rgba(255,255,255,.05);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background .3s}
        .class-header:hover{background:rgba(255,255,255,.08)}
        .class-header h3{margin:0;font-size:18px;color:var(--accent-color);font-weight:700}
        .class-header .count{font-size:14px;color:#8b949e}
        .class-header .toggle-class{background:none;border:none;color:var(--text-color);font-size:18px;cursor:pointer;padding:0 5px}
        .class-header .toggle-class.active i{transform:rotate(180deg)}
        .class-quizzes{display:none;padding:0 15px 15px}
        .class-quizzes.show{display:block}

        .quiz{background:rgba(0,0,0,.2);padding:15px;border-radius:var(--card-radius);margin:10px 0;box-shadow:0 2px 10px rgba(0,0,0,.2);transition:transform .3s,box-shadow .3s}
        .quiz:hover{transform:translateY(-2px);box-shadow:0 4px 15px rgba(0,0,0,.3)}
        .quiz-header{display:flex;align-items:center;gap:10px}
        .quiz-header h3{margin:0;flex:1;font-size:16px;color:var(--accent-color);font-weight:700}
        .quiz-header .status-badge{background:var(--status-open);color:var(--bg-color);padding:4px 8px;border-radius:10px;font-size:12px;font-weight:700}
        .quiz-header .status-badge.Scheduled{background:var(--status-scheduled)}
        .quiz-header .status-badge.Closed{background:var(--status-closed)}
        .quiz-details{display:none;padding:10px 15px;background:rgba(0,0,0,.2);border-radius:0 0 var(--card-radius) var(--card-radius);margin-top:5px}
        .toggle-details{background:none;border:none;color:var(--text-color);font-size:16px;cursor:pointer;transition:color .3s}
        .toggle-details:hover,.toggle-details.active{color:var(--accent-color)}
        .quiz-icon{font-size:20px;color:var(--accent-color)}
        a.results-link,a.edit-link{color:var(--accent-color);text-decoration:none;font-weight:700;transition:color .3s}
        a.results-link:hover,a.edit-link:hover{color:#1ed760}
        .publish-status-published{color:var(--published-color);font-weight:700}
        .publish-status-hidden{color:var(--hidden-color);font-weight:700}
        .toggle-publish-btn,.toggle-status-btn{
            margin-top:10px;padding:8px 14px;background:var(--accent-color);color:var(--bg-color);
            border:none;border-radius:var(--card-radius);font-weight:700;cursor:pointer;
            transition:background .3s,box-shadow .3s
        }
        .toggle-status-btn.closed{background:var(--status-closed)}
        .toggle-publish-btn:hover,.toggle-status-btn:hover{background:#1ed760;box-shadow:0 0 8px var(--shadow-glow)}
        .toggle-status-btn.closed:hover{background:#1ed760}
        p.empty{text-align:center;opacity:.8;font-size:16px;padding:20px;background:var(--card-bg);border-radius:var(--card-radius);box-shadow:0 2px 10px rgba(0,0,0,.2);font-weight:600}
        
        #loaderOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);display:none;flex-direction:column;justify-content:center;align-items:center;z-index:1000}
        .loader{border:6px solid #f3f3f3;border-top:6px solid var(--accent-color);border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin-top:12px}
        .loader-text{color:var(--text-color);font-size:18px;font-weight:700;text-align:center}
        
        #publishModal,#statusModal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:1000;justify-content:center;align-items:center}
        #publishModalContent,#statusModalContent{background:var(--card-bg);padding:20px;border-radius:var(--card-radius);max-width:400px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,.3)}
        #publishModalContent p,#statusModalContent p{font-size:18px;margin:0 0 20px;font-weight:600}
        .modal-actions{display:flex;gap:10px;justify-content:center}
        .modal-btn{background:var(--accent-color);color:var(--bg-color);border:none;padding:10px 20px;border-radius:var(--card-radius);font-size:14px;cursor:pointer;transition:background .3s;font-weight:700}
        .modal-btn.cancel{background:var(--button-bg)}
        .modal-btn:hover{background:#1ed760}
        .modal-btn.cancel:hover{background:var(--button-hover-bg)}
        
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        
        @media(max-width:768px){
            .container{padding:0 10px}
            h2{font-size:24px}
            .search-sort{display:none}
            .class-header h3{font-size:16px}
            .quiz{padding:10px}
            .quiz-header h3{font-size:14px}
            .quiz-details p{font-size:12px}
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h2>Created Quizzes</h2>
        <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;">
            <span class="current-year-badge">
                <?= htmlspecialchars($current_year_name) ?> • Term <?= $current_global_term ?> Active
            </span>
        </div>
    </div>

    <!-- TERM CARDS -->
    <div style="margin-top:40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:28px;">
        <?php for ($t = 1; $t <= 4; $t++): ?>
            <?php 
                $classes = $terms[$t] ?? [];
                $isActive = ($t === $current_global_term);
                $totalQuizzes = 0;
                foreach ($classes as $c) $totalQuizzes += count($c['quizzes']);
            ?>
            <div style="background:#1a202c;border-radius:16px;overflow:hidden;
                        border:3px solid <?= $isActive ? '#22c55e' : 'rgba(255,255,255,.1)' ?>;
                        box-shadow:<?= $isActive ? '0 0 30px rgba(34,197,94,.7)' : '0 6px 20px rgba(0,0,0,.4)' ?>;
                        transition:all .4s;<?= $isActive ? 'transform:translateY(-12px)' : '' ?>">
                
                <div style="padding:24px;background:rgba(255,255,255,.06);text-align:center;position:relative;">
                    <h3 style="margin:0;font-size:30px;color:#4fd1c5;font-weight:700;">TERM <?= $t ?></h3>
                    <?php if ($isActive): ?>
                        <span style="position:absolute;top:16px;right:16px;background:#22c55e;color:white;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:bold;letter-spacing:1px;">
                            ACTIVE
                        </span>
                    <?php endif; ?>
                    <p style="margin:16px 0 0;color:#8b949e;font-size:16px;">
                        <?= $totalQuizzes ?> quiz<?= $totalQuizzes != 1 ? 'zes' : '' ?> 
                        in <?= count($classes) ?> class<?= count($classes) != 1 ? 'es' : '' ?>
                    </p>
                    <?php if ($totalQuizzes > 0): ?>
                        <button class="term-toggle-btn" style="background:none;border:none;color:#e0e6f0;font-size:32px;cursor:pointer;margin-top:12px;">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    <?php endif; ?>
                </div>

                <!-- Removed inline display:none — now controlled cleanly by JS -->
                <div class="term-content" style="padding:20px;display:none;">
                    <?php if (empty($classes)): ?>
                        <p style="text-align:center;color:#8b949e;font-style:italic;padding:60px 0;">No quizzes yet</p>
                    <?php else: ?>
                        <?php foreach ($classes as $class_id => $data): ?>
                            <div style="margin-bottom:28px;">
                                <h4 style="margin:0 0 16px;color:#58a6ff;font-size:21px;
                                           border-bottom:2px solid #30363d;padding-bottom:10px;">
                                    <?= htmlspecialchars($data['class_name']) ?>
                                </h4>
                                <?php foreach ($data['quizzes'] as $quiz): ?>
                                    <?php
                                        $status = strtolower($quiz['status'] ?? 'open');
                                        $startTime = !empty($quiz['start_time']) ? new DateTime($quiz['start_time'], new DateTimeZone('SAST')) : null;
                                    ?>
                                    <div class="quiz" data-quiz-id="<?= $quiz['id'] ?>" data-title="<?= htmlspecialchars($quiz['title']) ?>" data-duration="<?= $quiz['duration'] ?>">
                                        <div class="quiz-header">
                                            <i class="fas fa-poll quiz-icon"></i>
                                            <h3><?= htmlspecialchars($quiz['title']) ?></h3>
                                            <span class="status-badge <?= $status ?>"><?= ucfirst($status) ?></span>
                                            <button class="toggle-details" onclick="toggleDetails(this)">
                                                <i class="fas fa-chevron-down"></i>
                                            </button>
                                        </div>
                                        <div class="quiz-details">
                                            <p><strong>Duration:</strong> <?= intval($quiz['duration']) ?> minutes</p>
                                            <?php if ($startTime): ?>
                                                <p><strong>Start Time:</strong> <?= $startTime->format('F j, Y, g:i A') ?></p>
                                            <?php else: ?>
                                                <p><strong>Start Time:</strong> Not set</p>
                                            <?php endif; ?>
                                            <p><strong>Status:</strong> <span class="status-<?= $status ?>"><?= ucfirst($status) ?></span></p>
                                            <p><strong>Marks:</strong> 
                                                <span class="publish-status-<?= $quiz['publish_marks'] ? 'published' : 'hidden' ?>">
                                                    <?= $quiz['publish_marks'] ? 'Published' : 'Hidden' ?>
                                                </span>
                                            </p>
                                            <p>
                                                <button class="toggle-publish-btn" data-quiz-id="<?= $quiz['id'] ?>">
                                                    <?= $quiz['publish_marks'] ? 'Unpublish Marks' : 'Publish Marks' ?>
                                                </button>
                                            </p>
                                            <p>
                                                <button class="toggle-status-btn <?= $status === 'closed' ? 'closed' : '' ?>" 
                                                        data-quiz-id="<?= $quiz['id'] ?>" data-current-status="<?= $status ?>">
                                                    <?= $status === 'closed' ? 'Reopen Quiz' : 'Close Quiz' ?>
                                                </button>
                                            </p>
                                            <p><a class="results-link" href="teacher_quiz_results.php?quiz_id=<?= $quiz['id'] ?>">View Student Results</a></p>
                                            <p>
    <button class="integrity-report-btn" 
            style="background:#f39c12; color:white; border:none; padding:8px 14px; border-radius:var(--card-radius); font-weight:700; cursor:pointer;"
            data-quiz-id="<?= $quiz['id'] ?>" 
            data-quiz-title="<?= htmlspecialchars($quiz['title']) ?>">
        <i class="fas fa-shield-alt"></i> Integrity Report
    </button>
</p>
                                            <p><a class="edit-link" href="edit_quiz.php?quiz_id=<?= $quiz['id'] ?>">Edit Quiz</a></p>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        <?php endfor; ?>
    </div>

    <?php if (empty($terms)): ?>
        <p class="empty">No quizzes found for the current academic year.</p>
        <p style="text-align:center;margin-top:20px;">
            <a href="create_quiz.php" style="color:#4fd1c5;font-weight:600;text-decoration:underline;">+ Create Your First Quiz</a>
        </p>
    <?php endif; ?>
</div>

<!-- Modals (you probably already have these, but just in case) -->
<div id="loaderOverlay"><div class="loader"></div><div class="loader-text">Processing...</div></div>
<div id="publishModal"><div id="publishModalContent"><p id="publishModalMessage"></p><div class="modal-actions"><button class="modal-btn" id="confirmPublish">Confirm</button><button class="modal-btn cancel" onclick="closePublishModal()">Cancel</button></div></div></div>
<div id="statusModal"><div id="statusModalContent"><p id="statusModalMessage"></p><div class="modal-actions"><button class="modal-btn" id="confirmStatus">Confirm</button><button class="modal-btn cancel" onclick="closeStatusModal()">Cancel</button></div></div></div>

<div id="integrityModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.85); z-index:2000; justify-content:center; align-items:center; padding:20px;">
    <div style="background:var(--card-bg); padding:30px; border-radius:16px; max-width:600px; width:100%; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid var(--accent-color);">
        <div id="integrityWarning">
            <h3 style="color:#f39c12; margin-top:0;"><i class="fas fa-exclamation-triangle"></i> Important Disclaimer</h3>
            <p style="line-height:1.6; color:#cbd5e0;">This report tracks how many times a learner switched tabs or minimized the browser window during the quiz.</p>
            <div style="background:rgba(243,156,18,0.1); border-left:4px solid #f39c12; padding:15px; margin:20px 0;">
                <p style="margin:0; font-size:14px;"><strong>Please Note:</strong> Tab switching can happen accidentally due to system notifications or antivirus popups. Use this data as a guide for further investigation, not as absolute proof of cheating.</p>
            </div>
            <button class="modal-btn" id="showIntegrityData" style="width:100%;">I Understand, Show Data</button>
        </div>

        <div id="integrityDataArea" style="display:none;">
            <h3 id="reportTitle" style="margin-top:0; color:var(--accent-color);"></h3>
            <div style="max-height:400px; overflow-y:auto; margin-top:20px;" id="integrityResultsBody">
                </div>
            <button class="modal-btn cancel" onclick="closeIntegrityModal()" style="width:100%; margin-top:20px;">Close Report</button>
        </div>
    </div>
</div>
<script>
document.addEventListener('DOMContentLoaded', function () {
    // Toggle individual quiz details
    window.toggleDetails = function(btn) {
        const details = btn.parentElement.nextElementSibling;
        const hidden = details.style.display === 'none' || details.style.display === '';
        details.style.display = hidden ? 'block' : 'none';
        btn.querySelector('i').classList.toggle('fa-chevron-down', hidden);
        btn.querySelector('i').classList.toggle('fa-chevron-up', !hidden);
    };

    // Attach event listeners to buttons (even inside hidden terms)
    function bindButtons() {
        document.querySelectorAll('.toggle-publish-btn').forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = 'true';
            btn.onclick = function() {
                const id = this.dataset.quizId;
                const isUnpublish = this.textContent.includes('Unpublish');
                document.getElementById('publishModalMessage').textContent = 
                    isUnpublish ? 'Unpublish marks? Students will no longer see scores.' 
                               : 'Publish marks? Students will see their scores.';
                document.getElementById('confirmPublish').dataset.quizId = id;
                document.getElementById('publishModal').style.display = 'flex';
            };
        });

        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = 'true';
            btn.onclick = function() {
                const id = this.dataset.quizId;
                const current = this.dataset.currentStatus;
                const willOpen = current === 'closed';
                document.getElementById('statusModalMessage').textContent = 
                    willOpen ? 'Reopen quiz? Students will regain access.' 
                             : 'Close quiz? Students will lose access.';
                document.getElementById('confirmStatus').dataset.quizId = id;
                document.getElementById('confirmStatus').dataset.newStatus = willOpen ? 'Open' : 'Closed';
                document.getElementById('statusModal').style.display = 'flex';
            };
        });
    }

    // Term toggle buttons
    document.querySelectorAll('.term-toggle-btn').forEach(btn => {
        btn.onclick = function() {
            const content = this.closest('div').nextElementSibling;
            const wasHidden = content.style.display === 'none' || content.style.display === '';
            content.style.display = wasHidden ? 'block' : 'none';
            this.querySelector('i').classList.toggle('fa-chevron-down', !wasHidden);
            this.querySelector('i').classList.toggle('fa-chevron-up', wasHidden);

            if (wasHidden) {
                setTimeout(bindButtons, 50); // Bind buttons when term opens
            }
        };
    });

    // Confirm Publish Marks
    document.getElementById('confirmPublish')?.addEventListener('click', function() {
        const id = this.dataset.quizId;
        const box = document.querySelector(`.quiz[data-quiz-id="${id}"]`);
        const btn = box.querySelector('.toggle-publish-btn');
        const span = box.querySelector('[class*="publish-status-"]');

        document.getElementById('loaderOverlay').style.display = 'flex';
        document.getElementById('publishModal').style.display = 'none';

        fetch('toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: id })
        })
        .then(r => r.json())
        .then(d => {
            document.getElementById('loaderOverlay').style.display = 'none';
            if (d.success) {
                const published = d.newStatus == 1;
                span.textContent = published ? 'Published' : 'Hidden';
                span.className = published ? 'publish-status-published' : 'publish-status-hidden';
                btn.textContent = published ? 'Unpublish Marks' : 'Publish Marks';
            } else alert('Error: ' + (d.message || 'Unknown'));
        })
        .catch(() => {
            document.getElementById('loaderOverlay').style.display = 'none';
            alert('Connection failed');
        });
    });

    // Confirm Close/Reopen Quiz
    document.getElementById('confirmStatus')?.addEventListener('click', function() {
        const id = this.dataset.quizId;
        const newStatus = this.dataset.newStatus;
        const box = document.querySelector(`.quiz[data-quiz-id="${id}"]`);
        const btn = box.querySelector('.toggle-status-btn');
        const badge = box.querySelector('.status-badge');

        document.getElementById('loaderOverlay').style.display = 'flex';
        document.getElementById('statusModal').style.display = 'none';

        fetch('toggle_quiz_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: id, status: newStatus })
        })
        .then(r => r.json())
        .then(d => {
            document.getElementById('loaderOverlay').style.display = 'none';
            if (d.success) {
                const lower = newStatus.toLowerCase();
                badge.textContent = newStatus;
                badge.className = 'status-badge ' + lower;
                btn.textContent = newStatus === 'Closed' ? 'Reopen Quiz' : 'Close Quiz';
                btn.classList.toggle('closed', newStatus === 'Closed');
                btn.dataset.currentStatus = lower;
            } else alert('Error: ' + (d.message || 'Unknown'));
        })
        .catch(() => {
            document.getElementById('loaderOverlay').style.display = 'none';
            alert('Connection failed');
        });
    });

    // Close modals
    window.closePublishModal = () => document.getElementById('publishModal').style.display = 'none';
    window.closeStatusModal = () => document.getElementById('statusModal').style.display = 'none';
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePublishModal(); closeStatusModal(); } });

    // Initial binding
    bindButtons();
});

// --- INTEGRITY REPORT LOGIC ---
const integrityModal = document.getElementById('integrityModal');
let activeQuizId = null;

document.querySelectorAll('.integrity-report-btn').forEach(btn => {
    btn.onclick = function() {
        activeQuizId = this.dataset.quizId;
        document.getElementById('reportTitle').textContent = "Integrity Report: " + this.dataset.quizTitle;
        document.getElementById('integrityWarning').style.display = 'block';
        document.getElementById('integrityDataArea').style.display = 'none';
        integrityModal.style.display = 'flex';
    };
});

document.getElementById('showIntegrityData').onclick = function() {
    const resultsBody = document.getElementById('integrityResultsBody');
    resultsBody.innerHTML = '<p style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Analyzing logs...</p>';
    
    document.getElementById('integrityWarning').style.display = 'none';
    document.getElementById('integrityDataArea').style.display = 'block';

    fetch(`fetch_integrity_report.php?quiz_id=${activeQuizId}`)
        .then(r => r.json())
        .then(data => {
            if (data.length === 0) {
                resultsBody.innerHTML = '<p style="text-align:center; color:#8b949e;">No integrity flags found. All learners stayed on the tab!</p>';
                return;
            }

            // We use an empty string instead of a <table> tag now
            let html = ''; 
            
            data.forEach(row => {
                html += `
                <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px; border-left:5px solid ${row.color}; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:#4fd1c5; font-size:16px;">${row.name}</strong>
                        <span style="background:${row.color}; color:white; padding:3px 12px; border-radius:20px; font-size:11px; font-weight:800; text-transform:uppercase;">
                            ${row.risk}
                        </span>
                    </div>
                    <p style="margin:0; font-size:15px; font-style:italic; line-height:1.5; color:#cbd5e0; font-family:'Georgia', serif;">
                        "${row.narrative}"
                    </p>
                    <div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                         <small style="color:#8b949e;">Total Flags: <strong>${row.switches}</strong></small>
                         <i class="fas fa-robot" style="color:rgba(255,255,255,0.2); font-size:12px;"> AI Analysis</i>
                    </div>
                </div>`;
            });

            resultsBody.innerHTML = html;
        })
        .catch(err => {
            resultsBody.innerHTML = '<p style="color:#f85149;">Error loading report. Please try again.</p>';
        });
};

window.closeIntegrityModal = () => integrityModal.style.display = 'none';
</script>


</body>
</html>