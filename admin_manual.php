<?php
session_start();
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'school_admin') {
    header("Location: index.php");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learner Manual</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #0d1117;
            color: #e0e6f0;
            padding: 30px;
            line-height: 1.7;
        }

        a.back {
            text-decoration: none;
            background-color: #e0e6f0;
            color: #0d1117;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: bold;
            box-shadow: 0 0 12px rgba(224, 230, 240, 0.5);
            transition: background-color 0.3s ease, color 0.3s ease;
            display: inline-block;
            margin-bottom: 25px;
        }

        a.back:hover {
            background-color: #cacfd6;
            color: #0d1117;
        }

        h1 {
            color: #e0e6f0;
            text-shadow: 0 0 6px rgba(224, 230, 240, 0.7);
            margin-bottom: 20px;
        }

        ul {
            margin-top: 20px;
        }

        ul li {
            margin-bottom: 12px;
        }

        .highlight {
            color: #e0e6f0;
            font-weight: bold;
            text-shadow: 0 0 3px rgba(224, 230, 240, 0.5);
        }

        footer {
            margin-top: 60px;
            text-align: center;
            color: #e0e6f0;
            opacity: 0.5;
            font-size: 14px;
        }
    </style>
</head>
<body>


<h1>📘 Admin Manual</h1>
<p>Welcome to iSkool! Here's everything you need to know:</p>

<ul>
    <li><span class="highlight"> Manage Teachers  </span>Add, update, or remove teachers accounts assigned to your school.</li>
    <li><span class="highlight"> Manage Learners  </span>View all the enrolled learners and their class assignmets</li>
    <li><span class="highlight"> Announcement  </span>Send announcements to all the teachers</li>
    <li><span class="highlight"> Reports  </span>Analyze overall school perfomance, learner progress, and test statistics</li>
    <li><span class="highlight"> Teacher Evaluations  </span>Release teacher evaluations to classes so that the teacher can get the feed on how he/she can improve or adapt to what the learners are comfortable with</li>
    <li><span class="highlight"> Upload school logo  </span>School admin can upload and update school logo of the school</li>
    <li><span class="highlight"> Update School Top Achievers </span>School admin can update top achievers each term, top 3 learners per grade</li>
    <li><span class="highlight"> Help  </span>If you have cool ideas for the platform or you are experiencing abnormal behaviour please contact our team at support@iskool.online</li>
    
</ul>



</body>
</html>
