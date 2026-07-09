<?php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../auth/session_guard.php';
require_once __DIR__ . '/../../auth/csrf_helper.php';

ob_start();
header('Content-Type: application/json');

require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    ob_end_flush();
    exit();
}

verify_csrf_token();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['class_id'])) {
    echo json_encode(['error' => 'Invalid request']);
    ob_end_flush();
    exit();
}

$teacher_email = $_SESSION['email'];
$class_id      = (int)$_POST['class_id'];
$term          = isset($_POST['term']) ? (int)$_POST['term'] : null;

if ($term < 1 || $term > 4) {
    $result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
    $term   = ($row = $result->fetch_assoc()) ? (int)$row['current_global_term'] : 4;
}

try {
    $stmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    $stmt->execute();
    $current_year_id = (int)$stmt->get_result()->fetch_assoc()['id'];
    $stmt->close();

    if (!$current_year_id) {
        echo json_encode(['error' => 'No active academic year']);
        ob_end_flush();
        exit();
    }

    // 1. Quiz Averages
    $stmt = $conn->prepare("
        SELECT q.title, AVG((r.score / r.total) * 100) AS avg_percent
        FROM quizzes q
        JOIN quiz_results r ON q.id = r.quiz_id
        JOIN class_students cs ON r.user_email = cs.student_email AND cs.class_id = q.class_id
        JOIN users u ON cs.student_email = u.email AND u.is_deleted = 0
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.term_number = ? AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY q.id, q.title ORDER BY q.start_time
    ");
    $stmt->bind_param("siii", $teacher_email, $class_id, $current_year_id, $term);
    $stmt->execute();
    $quiz_averages = [];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $quiz_averages[] = ['title' => $row['title'] ?: 'Quiz', 'avg' => round($row['avg_percent'], 1)];
    }
    $stmt->close();

    // 2. Quiz Averages by Gender
    $stmt = $conn->prepare("
        SELECT q.title, u.gender, AVG((r.score / r.total) * 100) AS avg_percent
        FROM quizzes q
        JOIN quiz_results r ON q.id = r.quiz_id
        JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender IN ('male','female')
        JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.term_number = ? AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY q.id, u.gender ORDER BY q.start_time
    ");
    $stmt->bind_param("siii", $teacher_email, $class_id, $current_year_id, $term);
    $stmt->execute();

    $map = [];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $t = $row['title'] ?: 'Quiz';
        if (!isset($map[$t])) $map[$t] = ['boys' => null, 'girls' => null];
        $map[$t][$row['gender'] === 'male' ? 'boys' : 'girls'] = round($row['avg_percent'], 1);
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

    // 3. Top 5 Girls and Boys
    $top_sql = "
        SELECT CONCAT(COALESCE(u.title,''),' ',COALESCE(u.name,''),' ',COALESCE(u.surname,'')) AS name,
               AVG((r.score / r.total) * 100) AS avg_percent
        FROM quiz_results r
        JOIN quizzes q ON r.quiz_id = q.id
        JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender = ?
        JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.term_number = ? AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY u.email ORDER BY avg_percent DESC LIMIT 5
    ";

    $top_girls = [];
    $gender    = 'female';
    $stmt      = $conn->prepare($top_sql);
    $stmt->bind_param("ssiii", $gender, $teacher_email, $class_id, $current_year_id, $term);
    $stmt->execute();
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $top_girls[] = ['name' => trim($row['name']) ?: 'Student', 'avg' => round($row['avg_percent'], 1)];
    }
    $stmt->close();

    $top_boys = [];
    $gender   = 'male';
    $stmt     = $conn->prepare($top_sql);
    $stmt->bind_param("ssiii", $gender, $teacher_email, $class_id, $current_year_id, $term);
    $stmt->execute();
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $top_boys[] = ['name' => trim($row['name']) ?: 'Student', 'avg' => round($row['avg_percent'], 1)];
    }
    $stmt->close();

    // 4. Boys vs Girls by Term
    $stmt = $conn->prepare("
        SELECT q.term_number, u.gender, AVG((r.score / r.total) * 100) AS avg_percent
        FROM quizzes q
        JOIN quiz_results r ON q.id = r.quiz_id
        JOIN users u ON r.user_email = u.email AND u.is_deleted = 0 AND u.gender IN ('male','female')
        JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY q.term_number, u.gender ORDER BY q.term_number
    ");
    $stmt->bind_param("sii", $teacher_email, $class_id, $current_year_id);
    $stmt->execute();

    $boys_by_term  = [null, null, null, null];
    $girls_by_term = [null, null, null, null];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $t = (int)$row['term_number'];
        if ($t >= 1 && $t <= 4) {
            $avg = round($row['avg_percent'], 1);
            if ($row['gender'] === 'male')   $boys_by_term[$t - 1]  = $avg;
            else                             $girls_by_term[$t - 1] = $avg;
        }
    }
    $stmt->close();

    // 5. Overall Class Performance by Term
    $stmt = $conn->prepare("
        SELECT q.term_number, AVG((r.score / r.total) * 100) AS avg_percent
        FROM quizzes q
        JOIN quiz_results r ON q.id = r.quiz_id
        JOIN class_students cs ON r.user_email = cs.student_email AND cs.class_id = q.class_id
        JOIN users u ON cs.student_email = u.email AND u.is_deleted = 0
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY q.term_number ORDER BY q.term_number
    ");
    $stmt->bind_param("sii", $teacher_email, $class_id, $current_year_id);
    $stmt->execute();

    $class_by_term = [null, null, null, null];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $t = (int)$row['term_number'];
        if ($t >= 1 && $t <= 4) $class_by_term[$t - 1] = round($row['avg_percent'], 1);
    }
    $stmt->close();

    // 6. Median Score (this term) — every student's own average, then take the middle value.
    // Same roster/result filters as the quiz averages and top-5 queries above, just no LIMIT
    // and no gender split, since every student needs to be in the pool for a median to mean anything.
    $stmt = $conn->prepare("
        SELECT u.email, AVG((r.score / r.total) * 100) AS avg_percent
        FROM quiz_results r
        JOIN quizzes q ON r.quiz_id = q.id
        JOIN users u ON r.user_email = u.email AND u.is_deleted = 0
        JOIN class_students cs ON u.email = cs.student_email AND cs.class_id = q.class_id
        WHERE q.created_by = ? AND q.class_id = ? AND q.academic_year_id = ?
          AND q.term_number = ? AND q.is_summative = 1 AND q.publish_marks = 1 AND r.total > 0
        GROUP BY u.email
    ");
    $stmt->bind_param("siii", $teacher_email, $class_id, $current_year_id, $term);
    $stmt->execute();

    $student_averages = array_map(
        fn($row) => (float)$row['avg_percent'],
        $stmt->get_result()->fetch_all(MYSQLI_ASSOC)
    );
    $stmt->close();

    $median_score = null;
    $n = count($student_averages);
    if ($n > 0) {
        sort($student_averages);
        $mid = (int)floor(($n - 1) / 2);
        $median_score = ($n % 2 === 0)
            ? round(($student_averages[$mid] + $student_averages[$mid + 1]) / 2, 1)
            : round($student_averages[$mid], 1);
    }

    echo json_encode([
        'quiz_averages'             => $quiz_averages,
        'quiz_gender_averages'      => $quiz_gender_averages,
        'top_girls'                 => $top_girls,
        'top_boys'                  => $top_boys,
        'boys_vs_girls_by_term'     => ['boys' => $boys_by_term, 'girls' => $girls_by_term],
        'class_performance_by_term' => $class_by_term,
        'median_score'              => $median_score
    ]);

    ob_end_flush();

} catch (Exception $e) {
    error_log("Analytics error: " . $e->getMessage());
    echo json_encode(['error' => 'Server error']);
    ob_end_flush();
}