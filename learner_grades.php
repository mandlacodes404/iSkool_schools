<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR (NO school_id NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found.");
}

/* -------------------------------------------------
   FETCH QUIZZES + CLASS NAME ONLY
   ------------------------------------------------- */
$sql = "
    SELECT q.id, q.title, q.created_at,
           c.id AS class_id, c.name AS class_name
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    WHERE q.created_by = ?
      AND q.academic_year_id = ?
      AND q.term_number = (
          SELECT current_global_term 
          FROM platform_settings 
          LIMIT 1
      )
    ORDER BY c.name ASC, q.created_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$result = $stmt->get_result();

/* -------------------------------------------------
   GROUP BY class_id
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
            'quizzes' => []
        ];
    }
    $grouped[$cid]['quizzes'][] = $row;
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learner Grades</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #ffffff;
            --accent-color: #00ff99;
            --border-radius: 12px;
            --shadow-glow: rgba(255, 255, 255, 0.6);
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
        }

        h2 {
            color: var(--text-color);
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            font-size: 24px;
        }

        .description {
            max-width: 700px;
            margin: 0 auto 20px;
            font-size: 15px;
            line-height: 1.6;
            color: var(--text-color);
            text-align: center;
        }

        /* ---------- CLASS GROUP ---------- */
        .class-group {
            max-width: 700px;
            margin: 0 auto 25px;
            border: 1px solid rgba(255,255,255,.1);
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
        .class-quizzes { display: none; padding: 0 15px 15px; }
        .class-quizzes.show { display: block; }

        .quiz {
            background: rgba(0,0,0,.2);
            padding: 12px;
            border-radius: var(--border-radius);
            margin: 10px 0;
            box-shadow: 0 0 10px rgba(255,255,255,.1);
            backdrop-filter: blur(10px);
            animation: fadeSlideIn 0.5s ease forwards;
        }

        .quiz h3 {
            margin: 0;
            font-size: 16px;
            color: var(--text-color);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .quiz h3 a {
            color: var(--text-color);
            text-decoration: none;
            font-weight: 600;
        }

        .quiz h3 a:hover {
            text-decoration: underline;
        }

        .quiz h3 .fa-chevron-down {
            color: var(--accent-color);
            text-shadow: 0 0 10px var(--accent-color);
            transition: transform 0.3s ease;
        }

        .quiz h3.active .fa-chevron-down {
            transform: rotate(180deg);
        }

        .quiz-details {
            display: none;
            padding: 10px 12px;
            background: rgba(0,0,0,0.2);
            border-radius: 0 0 var(--border-radius) var(--border-radius);
            margin-top: 2px;
        }

        .quiz-details p {
            margin: 5px 0;
            color: var(--text-color);
            font-size: 14px;
            line-height: 1.5;
        }

        .add-quiz {
            text-align: right;
            max-width: 700px;
            margin: 0 auto 20px;
        }

        .add-quiz a {
            background-color: var(--accent-color);
            color: #0d1117;
            padding: 10px 16px;
            border-radius: var(--border-radius);
            font-weight: bold;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }

        .add-quiz a:hover {
            background-color: #00cc88;
        }

        .back-btn {
            display: block;
            text-align: center;
            max-width: 700px;
            margin: 30px auto 0;
            padding: 10px 16px;
            background-color: var(--accent-color);
            color: #0d1117;
            text-decoration: none;
            border-radius: var(--border-radius);
            font-weight: bold;
            transition: background-color 0.3s ease;
        }

        .back-btn:hover {
            background-color: #00cc88;
        }

        p.empty {
            text-align: center;
            max-width: 700px;
            margin: 20px auto;
            color: var(--text-color);
            font-size: 15px;
        }

        #loaderOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 17, 23, 0.85);
            backdrop-filter: blur(6px);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.4s ease;
        }

        #loaderOverlay.show {
            display: flex;
            opacity: 1;
        }

        .loader-container { text-align: center; }
        .loader-book i {
            font-size: 5rem;
            color: var(--accent-color);
            text-shadow: 0 0 10px var(--accent-color);
            animation: rotateBook 4s linear infinite;
        }
        .loader-text {
            font-size: 18px;
            color: var(--text-color);
            font-weight: 600;
            font-family: 'Nunito', sans-serif;
            margin-top: 15px;
        }

        @keyframes rotateBook { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        @media (max-width: 768px) {
            .class-group { margin-bottom: 20px; }
        }
        @media (max-width: 480px) {
            body { padding: 10px; }
            h2 { font-size: 20px; }
            .description { font-size: 14px; }
            .class-header h3 { font-size: 16px; }
            .quiz h3 { font-size: 14px; }
            .quiz-details p { font-size: 13px; }
            .add-quiz a, .back-btn { padding: 8px 14px; font-size: 14px; }
            .loader-book i { font-size: 4rem; }
            .loader-text { font-size: 16px; }
        }
        @media (max-width: 360px) {
            h2 { font-size: 18px; }
            .description { font-size: 13px; }
            .class-header h3 { font-size: 15px; }
            .quiz h3 { font-size: 13px; }
            .quiz-details p { font-size: 12px; }
            .add-quiz a, .back-btn { padding: 6px 12px; font-size: 13px; }
            .loader-book i { font-size: 3rem; }
            .loader-text { font-size: 14px; }
        }
    </style>
</head>
<body>
    <h2>All Your Quizzes</h2>

    <p class="description">
        All the quizzes you have created on this platform are listed here.<br>
        For schools with limited resources, we have provided a manual button (Add Quiz). This feature allows teachers to manually add quiz results if they are unable to create quizzes online.<br>
        Manually adding quiz marks helps teachers securely save learners' scores in the cloud, even without online quizzes.<br>
        To use this feature, click the Add Quiz button, then select a class. You will see a list of learners in that class, where you can enter their marks and save them here.
    </p>

    <div class="add-quiz">
        <a href="manual_add_quiz.php">+ Add Quiz</a>
    </div>

    <?php if (!empty($grouped)): ?>
        <?php foreach ($grouped as $classId => $class): ?>
            <div class="class-group">
                <div class="class-header">
                    <h3><?= htmlspecialchars($class['info']['name']) ?></h3>
                    <div>
                        <span class="count">(<?= count($class['quizzes']) ?>)</span>
                        <button class="toggle-class" aria-label="Toggle quizzes"><i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>
                <div class="class-quizzes">
                    <?php foreach ($class['quizzes'] as $quiz): ?>
                        <div class="quiz" data-quiz-id="<?= $quiz['id'] ?>">
                            <h3 onclick="toggleDetails(this)">
                                <i class="fas fa-chevron-down"></i>
                                <a href="quiz_grades.php?quiz_id=<?= $quiz['id'] ?>" class="quiz-link"><?= htmlspecialchars($quiz['title']) ?></a>
                            </h3>
                            <div class="quiz-details" id="details-<?= $quiz['id'] ?>">
                                <p><strong>Class:</strong> <?= htmlspecialchars($class['info']['name']) ?></p>
                                <?php if ($quiz['created_at']): ?>
                                    <p><strong>Created:</strong> <?= date('d M Y, H:i', strtotime($quiz['created_at'])) ?></p>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    <?php else: ?>
        <p class="empty">You haven't created any quizzes yet.</p>
    <?php endif; ?>

    <div id="loaderOverlay">
        <div class="loader-container">
            <div class="loader-book"><i class="fas fa-book-open"></i></div>
            <div class="loader-text">Processing...</div>
        </div>
    </div>

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

        // Toggle quiz details
        function toggleDetails(element) {
            const details = element.parentElement.querySelector('.quiz-details');
            const isOpen = details.style.display === 'block';
            details.style.display = isOpen ? 'none' : 'block';
            element.classList.toggle('active', !isOpen);
        }

        // Show loader when clicking quiz link
        document.querySelectorAll('.quiz-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent toggle
                document.getElementById('loaderOverlay').classList.add('show');
            });
        });
    </script>
</body>
</html>