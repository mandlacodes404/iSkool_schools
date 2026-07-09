<?php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../../auth/session_guard.php';

ob_start();
header('Content-Type: application/json');

require_once dirname(__DIR__, 2) . '/config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    echo json_encode(['error' => 'Unauthorized']);
    ob_end_flush();
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['error' => 'Invalid request']);
    ob_end_flush();
    exit();
}

$teacher_email = $_SESSION['email'];

try {
    $stmt = $conn->prepare("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
    $stmt->execute();
    $year_row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $current_year_id = (int)($year_row['id'] ?? 0);
    if (!$current_year_id) {
        echo json_encode(['error' => 'No active academic year']);
        ob_end_flush();
        exit();
    }

    $term_result = $conn->query("SELECT current_global_term FROM platform_settings LIMIT 1");
    $term_row    = $term_result ? $term_result->fetch_assoc() : null;
    $current_term = $term_row
        ? (int)$term_row['current_global_term']
        : ((int)date('n') <= 3 ? 1 : ((int)date('n') <= 6 ? 2 : ((int)date('n') <= 9 ? 3 : 4)));

    if ($current_term < 1 || $current_term > 4) {
        $current_term = 1;
    }

    $stmt = $conn->prepare("
        SELECT
            q.class_id,
            c.name AS class_name,
            q.term_number,
            COUNT(DISTINCT CASE WHEN u.is_deleted = 0 THEN cs.student_email END) AS student_count
        FROM quizzes q
        JOIN classes c ON q.class_id = c.id
        LEFT JOIN class_students cs
            ON cs.class_id = q.class_id
            AND (cs.academic_year_id = q.academic_year_id OR cs.academic_year_id IS NULL)
        LEFT JOIN users u
            ON cs.student_email = u.email
            AND u.role = 'learner'
        WHERE q.created_by = ?
          AND q.is_summative = 1
          AND q.publish_marks = 1
          AND q.academic_year_id = ?
          AND (u.is_deleted = 0 OR u.is_deleted IS NULL)
        GROUP BY q.class_id, c.name, q.term_number
        ORDER BY q.term_number ASC, c.name ASC
    ");
    $stmt->bind_param("si", $teacher_email, $current_year_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $grouped = [];
    $class_ids = [];

    foreach ($rows as $row) {
        $term = (int)$row['term_number'];
        if ($term < 1 || $term > 4) {
            continue;
        }

        $class_id = (int)$row['class_id'];
        if (!isset($grouped[$term])) {
            $grouped[$term] = ['term' => $term, 'classes' => []];
        }

        if (!isset($grouped[$term]['classes'][$class_id])) {
            $grouped[$term]['classes'][$class_id] = [
                'id'            => $class_id,
                'name'          => $row['class_name'],
                'student_count' => (int)$row['student_count'],
                'subject'       => null,
            ];
            $class_ids[$class_id] = $class_id;
        }
    }

    ksort($grouped);

    if (!empty($class_ids)) {
        $class_ids = array_values($class_ids);
        $placeholders = implode(',', array_fill(0, count($class_ids), '?'));
        $types = 's' . str_repeat('i', count($class_ids));
        $params = array_merge([$teacher_email], $class_ids);

        $stmt = $conn->prepare("
            SELECT class_id, subject_name
            FROM teacher_subjects
            WHERE teacher_email = ?
              AND class_id IN ($placeholders)
        ");

        $refs = [];
        foreach ($params as $key => $value) {
            $refs[$key] = &$params[$key];
        }
        array_unshift($refs, $types);
        call_user_func_array([$stmt, 'bind_param'], $refs);

        $stmt->execute();
        $subject_rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        $subjects = [];
        foreach ($subject_rows as $row) {
            $subjects[(int)$row['class_id']] = $row['subject_name'];
        }

        foreach ($grouped as &$term_data) {
            foreach ($term_data['classes'] as &$class) {
                $class['subject'] = $subjects[$class['id']] ?? null;
            }
            unset($class);
        }
        unset($term_data);
    }

    $output = [];
    foreach ($grouped as $term_data) {
        $output[] = [
            'term'    => $term_data['term'],
            'classes' => array_values($term_data['classes']),
        ];
    }

    echo json_encode([
        'terms'        => $output,
        'current_term' => $current_term,
    ]);
    ob_end_flush();
} catch (Exception $e) {
    error_log("Analytics list error: " . $e->getMessage());
    echo json_encode(['error' => 'Server error']);
    ob_end_flush();
}
