<?php
session_start();
include("config.php");

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// GET CURRENT ACADEMIC YEAR (AUTOMATIC - NO SCHOOL_ID NEEDED)
$current_academic_year_id = null;
$result = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
if ($row = $result->fetch_assoc()) {
    $current_academic_year_id = $row['id'];
}

if (!$current_academic_year_id) {
    die("No active academic year found. Contact admin.");
}

// FETCH ALL ASSIGNMENTS FOR THIS TEACHER IN CURRENT YEAR (NO SCHOOL_ID FILTER)
$stmt = $conn->prepare("
    SELECT assignments.*, classes.name AS class_name 
    FROM assignments 
    JOIN classes ON assignments.class_id = classes.id 
    WHERE assignments.created_by = ?
      AND assignments.academic_year_id = ?
    ORDER BY due_date ASC
");
$stmt->bind_param("si", $email, $current_academic_year_id);
$stmt->execute();
$assignmentsResult = $stmt->get_result();
$stmt->close();

// GET SCHOOL NAME FROM DATABASE NAME (exactly like learner dashboard)
$dbName     = $conn->query("SELECT DATABASE()")->fetch_row()[0];
$schoolName = ucwords(str_replace(['iskool_', '_'], [' ', ' '], $dbName)); // e.g. iskool_sandtonhigh → Sandton High
?>
<!DOCTYPE html>
<html>
<head>
    <title>My Assignments and Submissions</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
        /* ... keep your existing CSS here ... */
        body {
          font-family: Arial, sans-serif;
          background-color: #0d1117;
          color: #e0e6f0;
          margin: 0;
          padding: 30px;
        }
        h1 {
          color: white;
          margin-bottom: 20px;
        }
        a.logout {
          float: right;
          text-decoration: none;
          background: #e74c3c;
          color: white;
          padding: 8px 14px;
          border-radius: 5px;
          box-shadow: 0 0 10px #e74c3c;
          transition: background-color 0.3s ease;
        }
        a.logout:hover {
          background: #c0392b;
          box-shadow: 0 0 15px #c0392b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: rgba(22, 27, 34, 0.7);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
          margin-bottom: 30px;
        }
        th, td {
          padding: 15px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: #e0e6f0;
        }
        th {
          background-color: rgba(255,255,255,0.1);
        }
        tr:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        a.view-file {
          background-color: white;
          color: black;
          padding: 6px 12px;
          border-radius: 999px;
          font-weight: 600;
          text-decoration: none;
          transition: background-color 0.3s ease;
        }
        a.view-file:hover {
          background-color: #dddddd;
        }
        button.toggle-btn {
          background-color: #238636;
          border: none;
          padding: 8px 16px;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          margin-top: 10px;
          font-weight: 600;
        }
        button.toggle-btn:hover {
          background-color: #2ea043;
        }
        .submissions-table {
          margin-top: 10px;
          width: 95%;
          margin-left: auto;
          margin-right: auto;
          background: rgba(40, 44, 52, 0.8);
          border-radius: 15px;
          box-shadow: 0 0 10px rgba(255,255,255,0.2);
        }
        .submissions-table th, .submissions-table td {
          padding: 10px;
          font-size: 0.9rem;
        }
        .submitted {
          color: #4ade80; /* green */
          font-weight: 700;
        }
        .not-submitted {
          color: #f87171; /* red */
          font-weight: 700;
        }

         .loader {
    border: 6px solid #f3f3f3;
    border-top: 6px solid #58a6ff; /* blue spinner */
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin-top: 12px;
}

.loader-text {
    color: #c9d1d9;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
}

/* Spinner animation */
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
    </style>
    <script>
        function toggleSubmissions(id) {
            const section = document.getElementById('submissions-' + id);
            if (section.style.display === 'none' || section.style.display === '') {
                section.style.display = 'table-row-group';
            } else {
                section.style.display = 'none';
            }
        }
    </script>
</head>
<body>


<h1>Assignments and Submissions</h1>

<?php if ($assignmentsResult->num_rows > 0): ?>
    <table>
        <thead>
            <tr>
                <th>Title</th>
                <th>Class</th>
                <th>Due Date</th>
                <th>Attachment</th>
                <th>Submissions</th>
                <th>Download Submissions</th>
            </tr>
        </thead>
        <tbody>
            <?php while ($assignment = $assignmentsResult->fetch_assoc()): ?>
                <tr>
                    <td><?= htmlspecialchars($assignment['title']) ?></td>
                    <td><?= htmlspecialchars($assignment['class_name']) ?></td>
                    <td><?= date('F j, Y, g:i A', strtotime($assignment['due_date'])) ?></td>
                    
                    <td>
                        <?php if (!empty($assignment['file_url'])): ?>
                            <a class="view-file" href="<?= htmlspecialchars($assignment['file_url']) ?>" target="_blank" rel="noopener">View File</a>
                        <?php else: ?>
                            No attachment
                        <?php endif; ?>
                    </td>

                    <td>
                        <button class="toggle-btn" onclick="toggleSubmissions(<?= $assignment['id'] ?>)">
                            View Submissions
                        </button>
                    </td>
                    <td>
                        <a class="view-file" href="download_submissions.php?assignment_id=<?= $assignment['id'] ?>" target="_blank" rel="noopener">
                            Download All
                        </a>
                    </td>
                </tr>

                <!-- Submissions Section (hidden by default) -->
                <tbody id="submissions-<?= $assignment['id'] ?>" class="submissions-table" style="display:none;">
                    <tr>
                        <th>Learner Name</th>
                        <th>Submitted</th>
                        <th>Submission Type</th>
                        <th>Submission</th>
                    </tr>
                    <?php

                    $classId = $assignment['class_id'];
                    $assignmentId = $assignment['id'];
                  // UPDATED: Added u.surname to the SELECT statement
$learnersStmt = $conn->prepare("
    SELECT DISTINCT u.email, u.name, u.surname 
    FROM class_students cs 
    JOIN users u ON cs.student_email = u.email 
    WHERE cs.class_id = ? 
      AND cs.academic_year_id = ? 
    ORDER BY u.surname ASC, u.name ASC
");
// We order by surname first now, which is standard for class lists
$learnersStmt->bind_param("ii", $classId, $current_academic_year_id);
$learnersStmt->execute();
$learnersResult = $learnersStmt->get_result();

                    while ($learner = $learnersResult->fetch_assoc()):
                        $learnerEmail = $learner['email'];

                        // Check if learner submitted this assignment
                        $submissionStmt = $conn->prepare("SELECT * FROM submissions WHERE assignment_id = ? AND student_email = ?");
                        $submissionStmt->bind_param("is", $assignmentId, $learnerEmail);
                        $submissionStmt->execute();
                        $submissionRes = $submissionStmt->get_result();
                        $submission = $submissionRes->fetch_assoc();
                        $submissionStmt->close();
                    ?>
                    <tr>
                        <td><?= htmlspecialchars($learner['name'] . ' ' . $learner['surname']) ?></td>
                        <td>
                            <?php if ($submission): ?>
                                <span class="submitted">Yes</span><br>
                                <small><?= date('F j, Y, g:i A', strtotime($submission['submitted_at'])) ?></small>
                            <?php else: ?>
                                <span class="not-submitted">No</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?= htmlspecialchars($submission['submission_type'] ?? '-') ?>
                        </td>
                        <td>
                            <?php if ($submission): ?>
                                <?php if ($submission['submission_type'] === 'file' && !empty($submission['file_url'])): ?>
                                    <a href="<?= htmlspecialchars($submission['file_url']) ?>" target="_blank" rel="noopener">View File</a>
                                <?php elseif ($submission['submission_type'] === 'text' && !empty($submission['text_answer'])): ?>
                                    <pre style="white-space: pre-wrap; max-width: 400px; max-height: 150px; overflow: auto; background: #21262d; padding: 10px; border-radius: 8px; color: #c9d1d9;"><?= htmlspecialchars($submission['text_answer']) ?></pre>
                                <?php elseif ($submission['submission_type'] === 'audio' && !empty($submission['audio_url'])): ?>
                                    <audio controls>
                                        <source src="<?= htmlspecialchars($submission['audio_url']) ?>" type="audio/mpeg">
                                        Your browser does not support the audio element.
                                    </audio>
                                <?php else: ?>
                                    -
                                <?php endif; ?>
                            <?php else: ?>
                                -
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endwhile;
                    $learnersStmt->close();
                    ?>
                </tbody>

            <?php endwhile; ?> 
        </tbody>
    </table>
<?php else: ?>
    <p>No assignments created yet.</p>
<?php endif; ?>




</body>
</html>
