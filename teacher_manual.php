<?php
session_start();
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Teacher Manual - iSkool</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: rgba(22, 27, 34, 0.7);
            --text-color: #e0e6f0;
            --heading-color: white;
            --accent-color: white;
            --button-bg: white;
            --button-hover-bg: #dddddd;
            --border-radius: 15px;
            --shadow-glow: rgba(255, 255, 255, 0.6);
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Nunito', sans-serif;
            margin: 0;
            padding: 30px;
        }

        h1 {
            color: var(--heading-color);
            font-size: 32px;
            margin-bottom: 10px;
        }

        a.back {
            text-decoration: none;
            background: #e74c3c;
            color: white;
            padding: 8px 14px;
            border-radius: 5px;
            box-shadow: 0 0 10px #e74c3c;
        }

        a.back:hover {
            background-color: #c0392b;
        }

        .section {
            background-color: var(--card-bg);
            border-radius: var(--border-radius);
            padding: 20px;
            margin-top: 25px;
            box-shadow: 0 0 15px var(--shadow-glow);
        }

        .section h2 {
            color: var(--button-bg);
            margin-top: 0;
        }

        .section p {
            font-size: 14px;
            line-height: 1.6;
            opacity: 0.9;
        }

        ul {
            padding-left: 20px;
        }

        ul li {
            margin-bottom: 8px;
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

<div class="section">
    <h2>📤 How to Create a Quiz</h2>
    <p>Follow these steps to create a quiz and assign it to your class:</p>
    <ul>
        <li>Click on <strong>"Create Quiz"</strong> from your dashboard.</li>
        <li>Fill in the quiz title, instructions, duration, and passing marks.</li>
        <li>Select the class you want to assign it to.</li>
        <li> select the time in which you want the quiz to start/avalaible to learners, this gives you an advantage to create the quiz in advance</li>
        <li>when you click notify learners, learners will get the email alert as soon as you submit the quiz</li>
        <li>when you click publish immediately the learners will not get the marks ofter they submit the quiz, they will only get the marks when you publish them on "VIEW QUIZZES"</li>
        <li>Add questions one by one, specifying correct answers and options lastly add the number of points per question</li>
        <li>You can choose how many times you want the learners to take the quiz, but for the high stakes test you might only want to give only 1 attempt, this quiz system is designed to be bulletproof for cheating so you might want to make the learners take mock tests so that they can get familiar with system </li>
        <li>We are aware that some schools cannot test their learners using the quiz system because they do not have computer rooms however we have added the manual system so that the teacher can add marks in the system, in that they can be stored on the cloud and allow the school to still be able to track and analyse data.</li>
        <li>The teacher can manually add marks by adding a quiz on learner grades, and when he/she clicks on the quiz he/she will see all the learners of the class that wrote the quiz and then edit marks manually.</li>
        <li><span class="highlight"> Help  </span>If you have cool ideas for the platform or you are experiencing abnormal behaviour please contact our team at support@iskool.online</li>
    </ul>
</div>

<div class="section">
    <h2>📊 How to View Quiz Results</h2>
    <p>To see how your learners performed:</p>
    <ul>
        <li>Click on <strong>"Learner Grades"</strong> on your dashboard.</li>
        <li>Select a quiz to view detailed marks and attempt history</li>
    </ul>
</div>

<div class="section">
    <h2>📁 Uploading Study Resources</h2>
    <p>Support your class with notes, past papers, or any helpful files:</p>
    <ul>
        <li>Click <strong>"Resources"</strong> from your dashboard.</li>
        <li>Choose <strong>"Upload Resource"</strong> and fill in the title and file.</li>
        <li>Assign the resource to a class.</li>
        <li>You can also click <strong>"View My Uploads"</strong> to manage existing files.</li>
    </ul>
</div>

<div class="section">
    <h2>📢 Sending Announcements</h2>
    <p>Share updates with learners and/or parents:</p>
    <ul>
        <li>Click on <strong>"Announcements"</strong>.</li>
        <li>Choose <strong>"Make Announcement"</strong>.</li>
        <li>Select the class and whether to send to learners, parents, or both.</li>
        <li>Type your message and submit. Everyone linked to that class will see it.</li>
    </ul>
</div>

<div class="section">
    <h2>📚 Managing Your Classes</h2>
    <p>When you create a quiz or upload a resource, you assign it to a class. You can view all your classes directly on the dashboard, and all learners in those classes will receive what you share with them.</p>
</div>

<div class="section">
    <h2>📚 Online assignments</h2>
    <p>When you upload an assignment, you assign it to a class. You can view all your classes directly on the dashboard, and all learners in those classes will receive what you share with them. The learners can also submit the assignments back online for the teacher to view or download them</p>
</div>

<div class="section">
    <h2>❓ Need Help?</h2>
    <p>If you're stuck or unsure about a feature, please contact your school admin or email <strong>support@iskool.online</strong>.</p>
</div>

</body>
</html>