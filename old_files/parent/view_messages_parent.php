<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'parent') {
    header("Location: index.php");
    exit();
}

$parentEmail = $_SESSION['email'];

// Clean up any old session junk (good practice)
unset($_SESSION['school_id']);

// Fetch sent messages with teacher name (title + surname)
$stmt = $conn->prepare("
    SELECT 
        m.teacher_email,
        m.message, 
        m.created_at,
        COALESCE(u.title, '') AS title,
        COALESCE(u.surname, 'Teacher') AS surname,
        CONCAT(TRIM(COALESCE(u.title, '')), ' ', TRIM(COALESCE(u.surname, 'Teacher'))) AS teacher_name
    FROM messages m
    LEFT JOIN users u ON m.teacher_email = u.email 
                     AND u.role = 'teacher' 
                     AND u.is_deleted = 0
    WHERE m.parent_email = ?
    ORDER BY m.created_at DESC
");
$stmt->bind_param("s", $parentEmail);
$stmt->execute();
$result = $stmt->get_result();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Sent Messages</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #1a202c;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --secondary-accent: #f28c38;
            --border-color: rgba(255, 255, 255, 0.1);
            --shadow-glow: rgba(79, 209, 197, 0.3);
            --card-radius: 12px;
            --table-header-bg: rgba(79, 209, 197, 0.15);
            --table-hover-bg: rgba(79, 209, 197, 0.08);
        }

        body {
            margin: 0;
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            max-width: 900px;
            width: 100%;
        }

        .card {
            background: var(--card-bg);
            border-radius: var(--card-radius);
            padding: 24px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            margin-bottom: 20px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        h1 {
            font-size: 28px;
            color: var(--accent-color);
            margin: 0 0 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border-radius: var(--card-radius);
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        th {
            background: var(--table-header-bg);
            color: var(--accent-color);
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 15px;
            border-bottom: 1px solid var(--border-color);
        }

        td {
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            font-size: 14px;
            line-height: 1.5;
        }

        tr:hover {
            background: var(--table-hover-bg);
            transition: background 0.3s ease;
        }

        tr:last-child td {
            border-bottom: none;
        }

        .empty {
            text-align: center;
            padding: 30px 20px;
            font-size: 16px;
            opacity: 0.8;
            background: var(--card-bg);
            border-radius: var(--card-radius);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        #loaderOverlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .loader {
            border: 6px solid #f3f3f3;
            border-top: 6px solid var(--accent-color);
            border-radius: 50%;
            width: 60px; height: 60px;
            animation: spin 1s linear infinite;
            margin-top: 12px;
        }

        .loader-text {
            color: var(--text-color);
            font-size: 18px;
            font-weight: 600;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .container { padding: 0 10px; }
            h1 { font-size: 24px; }
            .card { padding: 20px; }
            th, td { padding: 10px 8px; font-size: 13px; }
            table { font-size: 13px; }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="card">
        <h1>Sent Messages</h1>

        <?php if ($result->num_rows > 0): ?>
            <table>
                <thead>
                    <tr>
                        <th>Teacher</th>
                        <th>Message</th>
                        <th>Sent At</th>
                    </tr>
                </thead>
                <tbody>
                    <?php while ($row = $result->fetch_assoc()): 
                        $teacherName = 'Unknown Teacher';
                        if (!empty($row['title']) && !empty($row['surname'])) {
                            $teacherName = trim($row['title'] . ' ' . $row['surname']);
                        } elseif (!empty($row['teacher_email'])) {
                            $teacherName = $row['teacher_email'];
                        }
                    ?>
                        <tr>
                            <td><?= htmlspecialchars($teacherName) ?></td>
                            <td><?= nl2br(htmlspecialchars($row['message'])) ?></td>
                            <td><?= date('M j, Y, g:i a', strtotime($row['created_at'])) ?></td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="empty">You haven't sent any messages yet.</p>
        <?php endif; ?>
    </div>
</div>

<div id="loaderOverlay">
    <div class="loader-text">Loading...</div>
    <div class="loader"></div>
</div>

</body>
</html>