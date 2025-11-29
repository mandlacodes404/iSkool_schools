<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// Get teacher's school_id
$schoolStmt = $conn->prepare("SELECT school_id FROM users WHERE email = ? AND role = 'teacher'");
$schoolStmt->bind_param("s", $email);
$schoolStmt->execute();
$schoolResult = $schoolStmt->get_result();
$schoolRow = $schoolResult->fetch_assoc();
$school_id = $schoolRow['school_id'] ?? 0;
$schoolStmt->close();

// GET CURRENT ACADEMIC YEAR
$currentYearStmt = $conn->prepare("SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1");
$currentYearStmt->bind_param("i", $school_id);
$currentYearStmt->execute();
$currentYearResult = $currentYearStmt->get_result();
$currentYearRow = $currentYearResult->fetch_assoc();
$current_academic_year_id = $currentYearRow['id'] ?? null;
$currentYearStmt->close();

if (!$current_academic_year_id) {
    die("No active academic year found.");
}
if (!$school_id) {
    die("Error: Your school information is missing.");
}

// GET CURRENT GLOBAL TERM
$current_global_term = 4; // fallback
$termStmt = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
if ($termRow = $termStmt->fetch_assoc()) {
    $current_global_term = (int)$termRow['current_global_term'];
}
$termStmt->close();

// GET CLASSES — FIXED: u.is_deleted moved to WHERE with proper NULL handling
$sql = "
    SELECT DISTINCT 
        q.class_id, 
        c.name AS class_name, 
        c.subject,
        COUNT(DISTINCT CASE WHEN u.is_deleted = 0 THEN cs.student_email END) AS student_count
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    LEFT JOIN class_students cs ON cs.class_id = q.class_id
    LEFT JOIN users u ON cs.student_email = u.email AND u.role = 'user'
    WHERE q.created_by = ?
      AND q.is_summative = 1 
      AND q.publish_marks = 1 
      AND c.school_id = ?
      AND q.academic_year_id = ?
      AND q.term_number = ?
      AND (u.is_deleted = 0 OR u.is_deleted IS NULL)
    GROUP BY q.class_id, c.name, c.subject
    ORDER BY c.name ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("siii", $email, $school_id, $current_academic_year_id, $current_global_term);
$stmt->execute();
$result = $stmt->get_result();

$classes = [];
$class_ids = [];

while ($row = $result->fetch_assoc()) {
    $class_id = $row['class_id'];
    $class_ids[] = $class_id;
    $classes[] = [
        'id' => $class_id,
        'name' => $row['class_name'],
        'subject' => $row['subject'] ?? 'General',
        'student_count' => (int)$row['student_count']
    ];
}
$stmt->close();

// Fetch custom subjects (unchanged)
$custom_subjects = [];
if (!empty($class_ids)) {
    $placeholders = str_repeat('?,', count($class_ids) - 1) . '?';
    $type_string = str_repeat('i', count($class_ids));
    $type_string = 's' . $type_string;

    $sql = "SELECT class_id, subject_name FROM teacher_subjects WHERE teacher_email = ? AND class_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);

    $bind_params = array_merge([$email], $class_ids);
    $refs = [];
    foreach ($bind_params as $key => $value) {
        $refs[$key] = &$bind_params[$key];
    }
    array_unshift($refs, $type_string);

    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $custom_subjects[$row['class_id']] = $row['subject_name'];
    }
    $stmt->close();
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Analytics - iSkool</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #ffffff;
            --accent-color: #00ff99;
            --border-radius: 12px;
            --boy-color: #4e79a7;
            --girl-color: #e15759;
        }
        body { margin: 0; font-family: 'Nunito', sans-serif; background: var(--bg-color); color: var(--text-color); padding: 20px; }
        h2 { text-align: center; font-size: 24px; margin-bottom: 20px; }
        .description { max-width: 700px; margin: 0 auto 20px; font-size: 15px; text-align: center; }
        .class-group { max-width: 700px; margin: 0 auto 25px; border: 1px solid rgba(255,255,255,.1); border-radius: var(--border-radius); overflow: hidden; background: var(--card-bg); }
        .class-header { padding: 15px; background: rgba(255,255,255,.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer; position: relative; }
        .class-header:hover { background: rgba(255,255,255,.08); }
        .class-title { display: flex; align-items: center; gap: 8px; }
        .subject-name { font-weight: 600; color: var(--accent-color); font-size: 18px; }
        .class-name { font-size: 14px; color: #8b949e; }
        .edit-subject { background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; }
        .edit-subject:hover { color: var(--accent-color); }
        .count { font-size: 14px; color: #8b949e; }
        .toggle-class, .toggle-section { background: none; border: none; color: var(--text-color); font-size: 18px; cursor: pointer; }
        .toggle-class.active i, .toggle-section.active i { transform: rotate(180deg); }
        .class-content, .section-body { display: none; padding: 15px; }
        .class-content.show, .section-body.show { display: block; }
        .analytics-section { margin-bottom: 15px; border: 1px solid rgba(255,255,255,.1); border-radius: var(--border-radius); overflow: hidden; background: rgba(255,255,255,.03); }
        .section-header { padding: 12px 15px; background: rgba(255,255,255,.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .section-header h4 { margin: 0; font-size: 16px; color: var(--accent-color); display: flex; align-items: center; gap: 8px; }
        .chart-container { background: rgba(0,0,0,.2); padding: 15px; border-radius: var(--border-radius); min-height: 250px; }
        .top-performers-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .top-list { background: rgba(0,0,0,.2); padding: 12px; border-radius: 8px; }
        .top-list h5 { margin: 0 0 10px; font-size: 15px; color: var(--accent-color); text-align: center; }
        .performer { padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; font-size: 14px; background: rgba(255,255,255,.05); margin-bottom: 5px; }
        .performer .name { font-weight: 600; }
        .performer .avg { color: var(--accent-color); }
        .no-data { text-align: center; color: #aaa; font-style: italic; padding: 20px; }
        .back-btn { display: block; text-align: center; max-width: 700px; margin: 30px auto 0; padding: 10px 16px; background: var(--accent-color); color: #0d1117; text-decoration: none; border-radius: var(--border-radius); font-weight: bold; }
        .back-btn:hover { background: #00cc88; }
        #loaderOverlay, #subjectModal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13,17,23,0.9); backdrop-filter: blur(6px); display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; }
        #subjectModal.show { display: flex; }
        .modal-content { background: var(--card-bg); padding: 25px; border-radius: 16px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .modal-content h3 { margin: 0 0 15px; color: var(--accent-color); }
        .modal-content input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #444; border-radius: 8px; background: #0d1117; color: white; font-size: 16px; }
        .modal-content button { background: var(--accent-color); color: #0d1117; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .modal-content button:hover { background: #00cc88; }
        #loaderOverlay.show { display: flex; opacity: 1; }
        .loader-book i { font-size: 5rem; color: var(--accent-color); animation: rotateBook 4s linear infinite; }
        @keyframes rotateBook { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .top-performers-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h2>My Analytics</h2>
    <p class="description">Click a class to explore performance insights by gender and quiz.</p>

    <?php if (!empty($classes)): ?>
        <?php foreach ($classes as $class): 
            $class_id = $class['id'];
            $custom_subject = $custom_subjects[$class_id] ?? null;
            $display_subject = $custom_subject ?: 'Set Subject';
            $is_set = !empty($custom_subject);
        ?>
            <div class="class-group" data-class-id="<?= $class_id ?>">
                <div class="class-header">
                    <div class="class-title">
                        <span class="subject-name" data-class-id="<?= $class_id ?>">
                            <?= $is_set ? htmlspecialchars($display_subject) : '<i>Set Subject</i>' ?>
                        </span>
                        <span class="class-name"><?= htmlspecialchars($class['name']) ?></span>
                        <button class="edit-subject" onclick="openSubjectModal(<?= $class_id ?>, '<?= $is_set ? addslashes($custom_subject) : '' ?>')">
    <i class="fas fa-pencil-alt"></i>
</button>
                    </div>
                    <div>
                        <span class="count">(<?= $class['student_count'] ?> students)</span>
                        <button class="toggle-class"><i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>
                <div class="class-content">
                    <!-- Quiz Average Overall -->
                    <div class="analytics-section" data-type="quiz_avg">
                        <div class="section-header">
                            <h4>Quiz Average</h4>
                            <button class="toggle-section"><i class="fas fa-chevron-down"></i></button>
                        </div>
                        <div class="section-body">
                            <div class="chart-container">
                                <canvas id="quiz-avg-<?= $class_id ?>"></canvas>
                            </div>
                            <div class="no-data" id="no-quiz-avg-<?= $class_id ?>">No data</div>
                        </div>
                    </div>

                    <!-- Quiz Average by Gender -->
                    <div class="analytics-section" data-type="quiz_gender">
                        <div class="section-header">
                            <h4>Quiz Average (Boys vs Girls)</h4>
                            <button class="toggle-section"><i class="fas fa-chevron-down"></i></button>
                        </div>
                        <div class="section-body">
                            <div class="chart-container">
                                <canvas id="quiz-gender-<?= $class_id ?>"></canvas>
                            </div>
                            <div class="no-data" id="no-quiz-gender-<?= $class_id ?>">No gender data</div>
                        </div>
                    </div>

                    <!-- Top 5 Girls & Boys -->
                    <div class="analytics-section" data-type="top_gender">
                        <div class="section-header">
                            <h4>Top Performers</h4>
                            <button class="toggle-section"><i class="fas fa-chevron-down"></i></button>
                        </div>
                        <div class="section-body">
                            <div class="top-performers-grid">
                                <div class="top-list">
                                    <h5>Top 5 Girls</h5>
                                    <div id="top-girls-<?= $class_id ?>"></div>
                                </div>
                                <div class="top-list">
                                    <h5>Top 5 Boys</h5>
                                    <div id="top-boys-<?= $class_id ?>"></div>
                                </div>
                            </div>
                            <div class="no-data" id="no-top-gender-<?= $class_id ?>">No results</div>
                        </div>
                    </div>

                    <!-- Boys vs Girls Monthly (Line Chart) -->
                    <div class="analytics-section" data-type="monthly_gender">
                        <div class="section-header">
                            <h4>Boys vs Girls (Monthly)</h4>
                            <button class="toggle-section"><i class="fas fa-chevron-down"></i></button>
                        </div>
                        <div class="section-body">
                            <div class="chart-container">
                                <canvas id="monthly-gender-<?= $class_id ?>"></canvas>
                            </div>
                            <div class="no-data" id="no-monthly-gender-<?= $class_id ?>">No monthly data</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Auto-open modal if subject not set -->
            <?php if (!$is_set): ?>
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        openSubjectModal(<?= $class_id ?>, '');
                    });
                </script>
            <?php endif; ?>
        <?php endforeach; ?>
    <?php else: ?>
        <p class="empty">No published summative assessments yet.</p>
    <?php endif; ?>

    <a href="teacher_dashboard.php" class="back-btn">Back to Dashboard</a>

    <!-- Subject Modal -->
    <div id="subjectModal">
        <div class="modal-content">
            <h3>What subject do you teach in <span id="modal-class-name"></span>?</h3>
            <input type="text" id="subject-input" placeholder="e.g. English, Mathematics" autocomplete="off">
            <button onclick="saveSubject()">Save Subject</button>
        </div>
    </div>

    <div id="loaderOverlay">
        <div class="loader-book"><i class="fas fa-brain"></i></div>
        <div class="loader-text">Loading insights...</div>
    </div>

    <script>
    const charts = {};
    const teacherEmail = <?= json_encode($email) ?>;
    let currentClassId = null;

    // Toggle class open/close
    document.querySelectorAll('.toggle-class').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const header = this.closest('.class-header');
            const content = header.nextElementSibling;
            content.classList.toggle('show');
            this.classList.toggle('active');
        });
    });

    // Click anywhere on header (except buttons)
    document.querySelectorAll('.class-header').forEach(header => {
        header.addEventListener('click', e => {
            if (e.target.closest('.toggle-class') || e.target.closest('.edit-subject')) return;
            header.querySelector('.toggle-class').click();
        });
    });

    // Toggle analytics sections + load data
    document.querySelectorAll('.toggle-section').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const header = btn.closest('.section-header');
            const body = header.nextElementSibling;
            const section = header.parentElement;
            const type = section.dataset.type;
            const classId = section.closest('.class-group').dataset.classId;
            body.classList.toggle('show');
            btn.classList.toggle('active');
            if (body.classList.contains('show') && !section.dataset.loaded) {
                loadSectionData(classId, type);
                section.dataset.loaded = 'true';
            }
        });
    });

    // Subject modal (unchanged)
    function openSubjectModal(classId, currentSubject) {
        currentClassId = classId;
        const className = document.querySelector(`[data-class-id="${classId}"] .class-name`).textContent;
        document.getElementById('modal-class-name').textContent = className;
        document.getElementById('subject-input').value = currentSubject;
        document.getElementById('subject-input').focus();
        document.getElementById('subjectModal').classList.add('show');
    }

    function saveSubject() {
        const subject = document.getElementById('subject-input').value.trim();
        if (!subject) return alert('Please enter a subject name');
        const loader = document.getElementById('loaderOverlay');
        loader.classList.add('show');
        fetch('save_subject.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `class_id=${currentClassId}&subject_name=${encodeURIComponent(subject)}`
        })
        .then(r => r.json())
        .then(data => {
            loader.classList.remove('show');
            if (data.success) {
                document.getElementById('subjectModal').classList.remove('show');
                const span = document.querySelector(`[data-class-id="${currentClassId}"] .subject-name`);
                span.innerHTML = data.subject_name;
                span.style.fontStyle = 'normal';
                let pencil = span.parentElement.querySelector('.edit-subject');
                if (!pencil) {
                    pencil = document.createElement('button');
                    pencil.className = 'edit-subject';
                    pencil.innerHTML = '<i class="fas fa-pencil-alt"></i>';
                    pencil.onclick = () => openSubjectModal(currentClassId, data.subject_name);
                    span.parentElement.appendChild(pencil);
                }
            } else {
                alert(data.message || 'Failed to save');
            }
        })
        .catch(() => {
            loader.classList.remove('show');
            alert('Network error');
        });
    }

    document.getElementById('subjectModal').addEventListener('click', e => {
        if (e.target === document.getElementById('subjectModal')) {
            e.target.classList.remove('show');
        }
    });

    // Load analytics data (IMPROVED ERROR HANDLING)
    function loadSectionData(classId, type) {
        const loader = document.getElementById('loaderOverlay');
        loader.classList.add('show');

        fetch('get_analytics_data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `class_id=${classId}&teacher_email=${encodeURIComponent(teacherEmail)}`
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP ${response.status}: ${text.substring(0, 500)}`);
                });
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Expected JSON, got: ${text.substring(0, 500)}`);
                });
            }
            return response.json();
        })
        .then(data => {
            loader.classList.remove('show');
            if (data.error) {
                console.error('Server error:', data.error);
                alert(`Failed to load analytics: ${data.error}`);
                return;
            }
            renderSection(classId, type, data);
        })
        .catch(err => {
            loader.classList.remove('show');
            console.error('Analytics load error:', err.message);
            alert('Failed to load analytics data. Check console for details.');
        });
    }

    function renderSection(classId, type, data) {
        if (type === 'quiz_avg') renderQuizAverage(classId, data.quiz_averages);
        else if (type === 'quiz_gender') renderQuizGender(classId, data.quiz_gender_averages);
        else if (type === 'top_gender') renderTopGender(classId, data.top_girls, data.top_boys);
        else if (type === 'monthly_gender') renderMonthlyGender(classId, data.boys_vs_girls_monthly);
    }

    function renderQuizAverage(classId, averages) {
        const ctx = document.getElementById(`quiz-avg-${classId}`);
        const noData = document.getElementById(`no-quiz-avg-${classId}`);
        if (!averages || averages.length === 0) { ctx.style.display = 'none'; noData.style.display = 'block'; return; }
        ctx.style.display = 'block'; noData.style.display = 'none';
        if (charts[`avg-${classId}`]) charts[`avg-${classId}`].destroy();
        charts[`avg-${classId}`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: averages.map(a => a.title),
                datasets: [{
                    label: 'Class Average %',
                    data: averages.map(a => a.avg),
                    backgroundColor: 'rgba(0, 255, 153, 0.6)',
                    borderColor: '#00ff99',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#ccc', callback: v => v + '%' } }, x: { ticks: { color: '#ccc' } } } }
        });
    }

    function renderQuizGender(classId, genderData) {
        const ctx = document.getElementById(`quiz-gender-${classId}`);
        const noData = document.getElementById(`no-quiz-gender-${classId}`);
        if (!genderData || genderData.length === 0) { ctx.style.display = 'none'; noData.style.display = 'block'; return; }
        ctx.style.display = 'block'; noData.style.display = 'none';
        if (charts[`gender-${classId}`]) charts[`gender-${classId}`].destroy();
        charts[`gender-${classId}`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: genderData.map(d => d.title),
                datasets: [
                    { label: 'Boys %', data: genderData.map(d => d.boys), backgroundColor: 'rgba(78, 121, 167, 0.7)', borderColor: '#4e79a7' },
                    { label: 'Girls %', data: genderData.map(d => d.girls), backgroundColor: 'rgba(225, 87, 89, 0.7)', borderColor: '#e15759' }
                ]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#ccc', callback: v => v + '%' } }, x: { ticks: { color: '#ccc' } } } }
        });
    }

    function renderTopGender(classId, girls, boys) {
        const gContainer = document.getElementById(`top-girls-${classId}`);
        const bContainer = document.getElementById(`top-boys-${classId}`);
        const noData = document.getElementById(`no-top-gender-${classId}`);
        if ((!girls || girls.length === 0) && (!boys || boys.length === 0)) {
            noData.style.display = 'block';
            gContainer.innerHTML = ''; bContainer.innerHTML = '';
            return;
        }
        noData.style.display = 'none';
        gContainer.innerHTML = girls.length ? girls.map((p, i) => `<div class="performer"><span class="name">${i+1}. ${p.name}</span><span class="avg">${p.avg}%</span></div>`).join('') : '<div class="no-data">No girls</div>';
        bContainer.innerHTML = boys.length ? boys.map((p, i) => `<div class="performer"><span class="name">${i+1}. ${p.name}</span><span class="avg">${p.avg}%</span></div>`).join('') : '<div class="no-data">No boys</div>';
    }

    function renderMonthlyGender(classId, data) {
        const ctx = document.getElementById(`monthly-gender-${classId}`);
        const noData = document.getElementById(`no-monthly-gender-${classId}`);
        const hasData = data.boys.some(v => v !== null) || data.girls.some(v => v !== null);
        if (!hasData) { ctx.style.display = 'none'; noData.style.display = 'block'; return; }
        ctx.style.display = 'block'; noData.style.display = 'none';
        if (charts[`monthly-${classId}`]) charts[`monthly-${classId}`].destroy();
        charts[`monthly-${classId}`] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                datasets: [
                    { label: 'Boys', data: data.boys, borderColor: '#4e79a7', backgroundColor: 'rgba(78,121,167,0.1)', tension: 0.3, fill: true },
                    { label: 'Girls', data: data.girls, borderColor: '#e15759', backgroundColor: 'rgba(225,87,89,0.1)', tension: 0.3, fill: true }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#fff' } }, title: { display: true, text: 'Monthly Performance %', color: '#00ff99' } },
                scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#ccc', callback: v => v + '%' } }, x: { ticks: { color: '#ccc' } } }
            }
        });
    }
</script>
</body>
</html>