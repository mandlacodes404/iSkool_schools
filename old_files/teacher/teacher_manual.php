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
        /* ── Exact same variables as Learner Manual ── */
        --bg-color: #0d1117;
        --card-bg: #1a1919;
        --text-color: #e2e8f0;
        --accent-teal: #4fd1c5;
        --glass-bg: rgba(255, 255, 255, 0.03);
        --border-radius: 18px;
    }

    body {
        background-color: var(--bg-color);
        color: var(--text-color);
        font-family: 'Nunito', sans-serif;
        font-weight: 600;
        margin: 0;
        padding: 25px;
        -webkit-font-smoothing: antialiased;
    }

    /* ── Cards ── */
    .section {
        background-color: var(--card-bg);
        border-radius: var(--border-radius);
        padding: 24px;
        margin-top: 20px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        transition: transform 0.3s ease, border-color 0.3s ease;
    }

    .section:hover {
        border-color: rgba(79, 209, 197, 0.3);   /* teal at 30% opacity */
        /* optional: transform: translateY(-4px); */
    }

    .section h2 {
        color: #ffffff;
        font-size: 20px;
        font-weight: 800;
        margin-top: 0;
        display: flex;
        align-items: center;
        letter-spacing: -0.5px;
    }

   .section h2 svg {
    width: 24px;
    height: 24px;
    margin-right: 12px;
    stroke: var(--accent-teal);     /* ← use stroke instead of fill for line icons */
    flex-shrink: 0;
}



    /* ── Typography ── */
    .section p {
        font-size: 15px;
        line-height: 1.6;
        color: #aaa;
        margin: 12px 0;
    }

    ul {
        padding-left: 20px;
        list-style-type: none;
    }

    ul li {
        margin-bottom: 12px;
        position: relative;
        font-size: 15px;
    }

    /* Teal bullets – replaces your current plain bullets */
    ul li::before {
        content: "•";
        color: var(--accent-teal);
        font-weight: bold;
        display: inline-block;
        width: 1em;
        margin-left: -1em;
    }

    strong {
        color: #fff;
        font-weight: 700;
    }

    /* If you still want to keep a back button – restyle it */
    a.back {
        display: inline-block;
        background: var(--accent-teal);
        color: #0d1117;
        padding: 10px 18px;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 700;
        margin-bottom: 20px;
    }

    a.back:hover {
        background: #3ab8ae;   /* slightly darker teal */
    }

    /* Optional – if you want to hide back button inside dashboard */
    /* a.back { display: none; } */

    /* Footer (if you keep it) */
    footer {
        margin-top: 60px;
        text-align: center;
        color: #aaa;
        font-size: 14px;
        opacity: 0.8;
    }
</style>
</head>
<body>

<div class="section">
    <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        How to Create a Quiz
    </h2>
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
    <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        How to View Quiz Results
    </h2>
    <p>To see how your learners performed:</p>
    <ul>
        <li>Click on <strong>"Learner Grades"</strong> on your dashboard.</li>
        <li>Select a quiz to view detailed marks and attempt history</li>
    </ul>
</div>

<div class="section">
    <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Uploading Study Resources
    </h2>
    <p>Support your class with notes, past papers, or any helpful files:</p>
    <ul>
        <li>Click <strong>"Resources"</strong> from your dashboard.</li>
        <li>Choose <strong>"Upload Resource"</strong> and fill in the title and file.</li>
        <li>Assign the resource to a class.</li>
        <li>You can also click <strong>"View My Uploads"</strong> to manage existing files.</li>
    </ul>
</div>

<div class="section">
   <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        Sending Announcements
    </h2>
    <p>Share updates with learners and/or parents:</p>
    <ul>
        <li>Click on <strong>"Announcements"</strong>.</li>
        <li>Choose <strong>"Make Announcement"</strong>.</li>
        <li>Select the class and whether to send to learners, parents, or both.</li>
        <li>Type your message and submit. Everyone linked to that class will see it.</li>
    </ul>
</div>

<div class="section">
   <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Managing Your Classes
    </h2>
    <p>When you create a quiz or upload a resource, you assign it to a class. You can view all your classes directly on the dashboard, and all learners in those classes will receive what you share with them.</p>
</div>

<div class="section">
   <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        Online Assignments
    </h2>
    <p>When you upload an assignment, you assign it to a class. You can view all your classes directly on the dashboard, and all learners in those classes will receive what you share with them. The learners can also submit the assignments back online for the teacher to view or download them</p>
</div>

<div class="section">
    <h2>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Need Help?
    </h2>
    <p>If you're stuck or unsure about a feature, please contact your school admin or email <strong>support@iskool.online</strong>.</p>
</div>

</body>
</html>