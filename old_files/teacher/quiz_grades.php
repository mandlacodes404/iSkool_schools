<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

if (!isset($_GET['quiz_id'])) {
    echo "Quiz ID is missing.";
    exit();
}

$quizId = intval($_GET['quiz_id']);
$search = $_GET['search'] ?? '';

// --- NEW: GET CURRENT ACADEMIC YEAR ---
$current_academic_year_id = null;
$resYear = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($rowYear = $resYear->fetch_assoc()) {
    $current_academic_year_id = $rowYear['id'];
}

if (!$current_academic_year_id) {
    die("Error: No active academic year found. Please set one in the admin panel.");
}

// Step 1: Get the quiz title and class_id
$stmtQuiz = $conn->prepare("SELECT title, class_id FROM quizzes WHERE id = ?");
$stmtQuiz->bind_param("i", $quizId);
$stmtQuiz->execute();
$resultQuiz = $stmtQuiz->get_result();
if ($resultQuiz->num_rows === 0) {
    echo "Quiz not found.";
    exit();
}
$quizData = $resultQuiz->fetch_assoc();
$quizTitle = $quizData['title'];
$classId = $quizData['class_id'];
$stmtQuiz->close();

// Step 2: Improved SQL to use academic_year_id and fetch surname
$sql = "
    SELECT u.name AS user_name, u.surname AS user_surname, u.email AS user_email, qr.score, qr.total
    FROM users u
    JOIN class_students cs ON cs.student_email = u.email
    LEFT JOIN quiz_results qr ON qr.user_email = u.email AND qr.quiz_id = ?
    WHERE cs.class_id = ? 
      AND cs.academic_year_id = ? 
      AND u.role = 'learner'
";

if (!empty($search)) {
    $sql .= " AND (u.name LIKE ? OR u.surname LIKE ?)";
}

$sql .= " ORDER BY u.surname ASC, u.name ASC";

$stmt = $conn->prepare($sql);

if (!empty($search)) {
    $like = '%' . $search . '%';
    // We bind 5 parameters now: quizId, classId, yearId, like(name), like(surname)
    $stmt->bind_param("iiiss", $quizId, $classId, $current_academic_year_id, $like, $like);
} else {
    // We bind 3 parameters: quizId, classId, yearId
    $stmt->bind_param("iii", $quizId, $classId, $current_academic_year_id);
}

$stmt->execute();
$results = $stmt->get_result();

// Store results for CSV download
$learners = [];
while ($row = $results->fetch_assoc()) {
    $learners[] = $row;
}
$results->data_seek(0); // Reset result pointer for table rendering
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Grades for <?= htmlspecialchars($quizTitle) ?></title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.7);
            --text-color: #e0e6f0;
            --accent-color: white;
            --hover-glow: rgba(255, 255, 255, 0.3);
            --border-radius: 16px;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 40px;
            margin: 0;
        }

        h2 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 24px;
            color: var(--accent-color);
        }

        input[type="text"] {
            padding: 10px;
            width: 280px;
            margin: 0 auto 20px auto;
            display: block;
            border-radius: var(--border-radius);
            background-color: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: var(--text-color);
        }

        #suggestions {
            text-align: center;
            margin-bottom: 20px;
            list-style: none;
            padding: 0;
        }

        #suggestions li {
            color: var(--accent-color);
            padding: 6px;
            cursor: pointer;
        }

        #suggestions li:hover {
            background-color: rgba(255,255,255,0.1);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.05);
        }

        th, td {
            padding: 16px;
            border: 1px solid rgba(255,255,255,0.1);
            text-align: center;
            font-size: 15px;
        }

        th {
            background-color: #161b22;
            color: var(--accent-color);
        }

        tr:nth-child(even) {
            background-color: rgba(255,255,255,0.02);
        }

        tr:hover {
            background-color: rgba(255,255,255,0.05);
        }

        a.edit-link, .download-btn {
            color: var(--accent-color);
            font-weight: bold;
            text-decoration: none;
        }

        a.edit-link:hover, .download-btn:hover {
            text-decoration: underline;
        }

        .download-btn {
            display: block;
            text-align: center;
            margin: 20px auto;
            padding: 10px 20px;
            border-radius: var(--border-radius);
            background-color: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            cursor: pointer;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }

        .download-btn:hover {
            background-color: rgba(255,255,255,0.1);
            box-shadow: 0 0 10px var(--hover-glow);
        }

        .back-link {
            display: block;
            text-align: center;
            margin-top: 30px;
            color: var(--accent-color);
            text-decoration: none;
            font-weight: bold;
        }

        .back-link:hover {
            text-decoration: underline;
        }

        footer {
            margin-top: 60px;
            text-align: center;
            color: var(--text-color);
            opacity: 0.6;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h2><?= htmlspecialchars($quizTitle) ?></h2>
    

    <?php if ($results->num_rows > 0): ?>
        <table>
            <thead>
                <tr>
                    <th>Student Name</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Edit Marks</th>
                </tr>
            </thead>
            <tbody>
                <?php while ($row = $results->fetch_assoc()): ?>
                    <tr>
                        <td><?= htmlspecialchars($row['user_name'] . ' ' . $row['user_surname']) ?></td>
                        <td><?= isset($row['score']) && isset($row['total']) ? (htmlspecialchars($row['score']) . ' / ' . htmlspecialchars($row['total'])) : 'Not Attempted' ?></td>
                        <td><?= isset($row['score']) && isset($row['total']) && $row['total'] > 0 ? number_format($row['score'] / $row['total'] * 100, 2) . '%' : 'Not Attempted' ?></td>
                        <td>
                            <a class="edit-link" 
                               href="edit_marks.php?quiz_id=<?= $quizId ?>&user_email=<?= urlencode($row['user_email']) ?>">
                               Edit
                            </a>
                        </td>
                    </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
    <?php else: ?>
        <p style="text-align:center;">No learners found for this class<?= $search ? " matching \"$search\"" : "" ?>.</p>
    <?php endif; ?>
    <a class="back-link" href="learner_grades.php">Back to Learner Grades</a>
    

    <script>
        // Store learner data for CSV download
        const learnersData = <?php
            $csvData = [];
            foreach ($learners as $learner) {
                $percentage = isset($learner['score']) && isset($learner['total']) && $learner['total'] > 0 
                    ? number_format($learner['score'] / $learner['total'] * 100, 2) . '%'
                    : 'Not Attempted';
                $csvData[] = [
                    'name' => $learner['user_name'] . ' ' . $learner['user_surname'],
                    'score' => isset($learner['score']) && isset($learner['total']) 
                        ? $learner['score'] . '/' . $learner['total']
                        : 'Not Attempted',
                    'percentage' => $percentage
                ];
            }
            echo json_encode($csvData);
        ?>;

        function downloadMarks() {
            // Create CSV content
            let csvContent = 'Student Name,Score,Percentage\n';
            learnersData.forEach(learner => {
                const name = `"${learner.name.replace(/"/g, '""')}"`; // Escape quotes
                csvContent += `${name},${learner.score},${learner.percentage}\n`;
            });

            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `quiz_${<?= $quizId ?>}_grades.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        }

        document.getElementById("searchBox").addEventListener("input", function () {
            const term = this.value;
            const quizId = <?= $quizId ?>;
            const suggestionsBox = document.getElementById("suggestions");

            if (term.length < 2) {
                suggestionsBox.innerHTML = "";
                // Show all rows if search is cleared
                const rows = document.querySelectorAll("tbody tr");
                rows.forEach(row => row.style.display = "");
                return;
            }

            fetch(`search_learners.php?term=${encodeURIComponent(term)}&quiz_id=${quizId}`)
                .then(response => response.json())
                .then(data => {
                    suggestionsBox.innerHTML = "";
                    data.forEach(name => {
                        const li = document.createElement("li");
                        li.textContent = name;
                        li.style.cursor = "pointer";
                        li.style.padding = "5px";
                        li.onclick = () => {
                            document.getElementById("searchBox").value = name;
                            suggestionsBox.innerHTML = "";

                            // Filter table rows
                            const rows = document.querySelectorAll("tbody tr");
                            rows.forEach(row => {
                                row.style.display = row.cells[0].textContent === name ? "" : "none";
                            });
                        };
                        suggestionsBox.appendChild(li);
                    });
                });
        });
    </script>
</body>
</html>