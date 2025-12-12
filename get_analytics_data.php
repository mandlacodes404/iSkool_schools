<?php
// Debug mode (safe, no HTML output)
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/debug.log');
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

ob_start();
header('Content-Type: application/json');

include("config.php");

// SECURITY
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    ob_end_flush();
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['class_id'])) {
    echo json_encode(['error' => 'Invalid request']);
    ob_end_flush();
    exit();
}

$teacher_email = $_SESSION['email'];
$class_id = (int)$_POST['class_id'];

// === NEW: Get the term from frontend (sent via JS), fallback to current global term ===
$term = isset($_POST['term']) ? (int)$_POST['term'] : null;
if ($term < 1 || $term > 4) {
    // Fallback: get current global term from DB
    $result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
    $term = ($row = $result->fetch_assoc()) ? (int)$row['current_global_term'] : 4;
}

try {
    // === Current academic year ===
    $stmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    $stmt->execute();
    $current_academic_year_id = $stmt->get_result()->fetch_assoc()['id'] ?? null;
    $stmt->close();

    if (!$current_academic_year_id) {
        echo json_encode(['error' => 'No active academic year']);
        ob_end_flush();
        exit();
    }

    // === 1. Quiz Averages (Overall) ===
    $sql = "SELECT q.title, AVG((r.score / r.total) * 100) AS avg_percent
            FROM quizzes q
            JOIN quiz_results r ON q.id = r.quiz_id
            JOIN class_students cs ON r.user_email = cs.student_email AND cs.class_id = q.class_id
            JOIN users u ON cs.student_email = u.email AND u.is_deleted = 0
            WHERE q.created_by = ? 
              AND q.class_id = ? 
              AND q.academic_year_id = ? 
              AND q.term_number = ?
              AND q.is_summative = 1 
              AND q.publish_marks = 1 
              AND r.total > 0
            GROUP BY q.id, q.title 
            ORDER BY q.start_time";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("siii", $teacher_email, $class_id, $current_academic_year_id, $term);
    $stmt->execute();
    $result = $stmt->get_result();
    $quiz_averages = [];
    while ($row = $result->fetch_assoc()) {
        $quiz_averages[] = [
            'title' => $row['title'] ?: 'Quiz',
            'avg'   => round($row['avg_percent'], 1)
        ];
    }
    $stmt->close();

    // === 2. Quiz Averages by Gender ===
    $sql = "SELECT q.title, u.gender, AVG((r.score / r.total) * 100) AS avg_percent
            FROM quizzes q
            JOIN quiz_results r ON q.id = r.quiz_id
            JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender IN ('male','female')
            JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
            WHERE q.created_by = ? 
              AND q.class_id = ? 
              AND q.academic_year_id = ? 
              AND q.term_number = ?
              AND q.is_summative = 1 
              AND q.publish_marks = 1 
              AND r.total > 0
            GROUP BY q.id, u.gender 
            ORDER BY q.start_time";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("siii", $teacher_email, $class_id, $current_academic_year_id, $term);
    $stmt->execute();
    $result = $stmt->get_result();

    $map = [];
    while ($row = $result->fetch_assoc()) {
        $title = $row['title'] ?: 'Quiz';
        if (!isset($map[$title])) $map[$title] = ['boys' => null, 'girls' => null];
        $map[$title][$row['gender'] === 'male' ? 'boys' : 'girls'] = round($row['avg_percent'], 1);
    }
    $stmt->close();

    $quiz_gender_averages = [];
    foreach ($quiz_averages as $q) {
        $t = $q['title'];
        $quiz_gender_averages[] = [
            'title' => $t,
            'boys'  => $map[$t]['boys'] ?? null,
            'girls' => $map[$t]['girls'] ?? null
        ];
    }

    // === 3. TOP 5 GIRLS & BOYS ===
    $top_sql = "SELECT CONCAT(COALESCE(u.title,''),' ',COALESCE(u.name,''),' ',COALESCE(u.surname,'')) AS name,
                       AVG((r.score / r.total) * 100) AS avg_percent
                FROM quiz_results r
                JOIN quizzes q ON r.quiz_id = q.id
                JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender = ?
                JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
                WHERE q.created_by = ? 
                  AND q.class_id = ? 
                  AND q.academic_year_id = ? 
                  AND q.term_number = ?
                  AND q.is_summative = 1 
                  AND q.publish_marks = 1 
                  AND r.total > 0
                GROUP BY u.email 
                ORDER BY avg_percent DESC 
                LIMIT 5";

    // Top 5 Girls
    $gender = 'female';
    $stmt = $conn->prepare($top_sql);
    $stmt->bind_param("ssiii", $gender, $teacher_email, $class_id, $current_academic_year_id, $term);
    $stmt->execute();
    $result = $stmt->get_result();
    $top_girls = [];
    while ($row = $result->fetch_assoc()) {
        $top_girls[] = ['name' => trim($row['name']) ?: 'Student', 'avg' => round($row['avg_percent'], 1)];
    }
    $stmt->close();

    // Top 5 Boys
    $gender = 'male';
    $stmt = $conn->prepare($top_sql);
    $stmt->bind_param("ssiii", $gender, $teacher_email, $class_id, $current_academic_year_id, $term);
    $stmt->execute();
    $result = $stmt->get_result();
    $top_boys = [];
    while ($row = $result->fetch_assoc()) {
        $top_boys[] = ['name' => trim($row['name']) ?: 'Student', 'avg' => round($row['avg_percent'], 1)];
    }
    $stmt->close();

        // === 4. Boys vs Girls Performance by Term (Term 1–4) ===
    $sql = "SELECT 
                q.term_number,
                u.gender,
                AVG((r.score / r.total) * 100) AS avg_percent
            FROM quizzes q
            JOIN quiz_results r ON q.id = r.quiz_id
            JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender IN ('male','female')
            JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
            WHERE q.created_by = ? 
              AND q.class_id = ? 
              AND q.academic_year_id = ?
              AND q.is_summative = 1 
              AND q.publish_marks = 1 
              AND r.total > 0
            GROUP BY q.term_number, u.gender
            ORDER BY q.term_number";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sii", $teacher_email, $class_id, $current_academic_year_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $boys_by_term  = [null, null, null, null];  // Index 0 unused → Term 1 at index 1
    $girls_by_term = [null, null, null, null];

    while ($row = $result->fetch_assoc()) {
        $t = (int)$row['term_number'];
        $avg = round($row['avg_percent'], 1);
        if ($row['gender'] === 'male') {
            $boys_by_term[$t] = $avg;
        } else {
            $girls_by_term[$t] = $avg;
        }
    }
    $stmt->close();


        // === 5. Overall Class Performance by Term (Term 1–4) ===
    $sql = "SELECT 
                q.term_number,
                AVG((r.score / r.total) * 100) AS avg_percent
            FROM quizzes q
            JOIN quiz_results r ON q.id = r.quiz_id
            JOIN class_students cs ON r.user_email = cs.student_email AND cs.class_id = q.class_id
            JOIN users u ON cs.student_email = u.email AND u.is_deleted = 0
            WHERE q.created_by = ? 
              AND q.class_id = ? 
              AND q.academic_year_id = ?
              AND q.is_summative = 1 
              AND q.publish_marks = 1 
              AND r.total > 0
            GROUP BY q.term_number
            ORDER BY q.term_number";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sii", $teacher_email, $class_id, $current_academic_year_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $class_by_term = [null, null, null, null];  // Index 0 unused → Term 1 at index 1

    while ($row = $result->fetch_assoc()) {
        $t = (int)$row['term_number'];
        $avg = round($row['avg_percent'], 1);
        $class_by_term[$t] = $avg;
    }
    $stmt->close();

        $output = [
        'quiz_averages'         => $quiz_averages,
        'quiz_gender_averages'  => $quiz_gender_averages,
        'top_girls'             => $top_girls,
        'top_boys'              => $top_boys,
        'boys_vs_girls_by_term' => [
            'boys'  => array_slice($boys_by_term, 1, 4),
            'girls' => array_slice($girls_by_term, 1, 4)
        ],
        'class_performance_by_term' => array_slice($class_by_term, 1, 4)  // New: overall class average per term
    ];

    echo json_encode($output);
    ob_end_flush();

} catch (Exception $e) {
    error_log("ERROR in get_analytics_data.php: " . $e->getMessage());
    echo json_encode(['error' => 'Server error']);
    ob_end_flush();
}
?>