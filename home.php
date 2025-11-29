<?php
session_start();
require_once 'config.php';

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'teacher') {
    header("Location: index.php");
    exit();
}

$email = $_SESSION['email'];

// Fetch profile picture if exists
$profileQuery = $conn->prepare("SELECT profile_picture FROM users WHERE email = ?");
$profileQuery->bind_param("s", $email);
$profileQuery->execute();
$profileQuery->bind_result($profilePic);
$profileQuery->fetch();
$profileQuery->close();

$profilePicUrl = $profilePic ? 'uploads/' . $profilePic : 'default-profile.png';
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>iSkool Home</title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-color: #e0e6f0;
            --accent-color: #4fd1c5;
            --button-bg: #4fd1c5;
            --button-hover-bg: #3db9aa;
            --card-radius: 12px;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
        }

        h2 {
            text-align: center;
            margin-bottom: 20px;
            color: var(--accent-color);
        }

        .card {
            background: var(--card-bg);
            border-radius: var(--card-radius);
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: 0 0 10px rgba(255,255,255,0.1);
        }

        .collapsible {
            background: none;
            border: none;
            color: var(--text-color);
            width: 100%;
            text-align: left;
            padding: 10px 0;
            cursor: pointer;
            font-size: 16px;
        }

        .collapsible::after {
            content: '▼';
            float: right;
        }

        .collapsible.active::after {
            content: '▲';
        }

        .content {
            display: none;
            padding: 8px 0;
            font-size: 14px;
            opacity: 0.85;
        }

        /* Map container */
        .map-container {
            width: 100%;
            max-width: 600px;
            margin: 20px auto;
        }

        svg {
            width: 100%;
            height: auto;
        }

        .province-dot {
            fill: #4fd1c5;
            stroke: #fff;
            stroke-width: 1px;
            r: 6;
            opacity: 0.8;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.5); opacity: 0.4; }
            100% { transform: scale(1); opacity: 0.8; }
        }
    </style>
</head>
<body>

<h2>iSkool Operations in South Africa</h2>

<div class="map-container">
    <svg viewBox="0 0 800 600">
        <!-- Simplified SA map outline -->
        <path d="M200,50 L600,50 L700,300 L600,550 L200,550 L100,300 Z" 
              fill="none" stroke="#e0e6f0" stroke-width="2"/>

        <!-- Dots for provinces (example positions) -->
        <circle class="province-dot" cx="250" cy="100"/>
        <circle class="province-dot" cx="500" cy="120"/>
        <circle class="province-dot" cx="600" cy="300"/>
        <circle class="province-dot" cx="450" cy="450"/>
        <circle class="province-dot" cx="200" cy="400"/>
    </svg>
</div>

<div class="card">
    <button class="collapsible">Submit a Feature Idea</button>
    <div class="content">
        Have an idea to improve iSkool? Please contact us at 
        <a href="mailto:support@iskool.online" style="color: var(--accent-color);">support@iskool.online</a>.
    </div>
</div>

<div class="card">
    <button class="collapsible">Report a Problem</button>
    <div class="content">
        If iSkool misbehaves, tell us about it at 
        <a href="mailto:support@iskool.online" style="color: var(--accent-color);">support@iskool.online</a>.
    </div>
</div>

<script>
    // Collapsible sections
    const coll = document.getElementsByClassName("collapsible");
    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            content.style.display = content.style.display === "block" ? "none" : "block";
        });
    }
</script>

</body>
</html>
