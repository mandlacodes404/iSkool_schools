<?php
// ===================================================
// iSkool Multi-Tenant – FINAL CONFIG (2025+)
// One file → Infinite schools → Works on localhost & live
// ===================================================

date_default_timezone_set('Africa/Johannesburg');

// ────── DATABASE CREDENTIALS (change only when you go live) ──────
$host     = "localhost";
$user     = "root";
$password = "";
$db_prefix = "iskool_";               // ← all school databases start with this

// ────── 1. Detect where we are running ──────
$host_name = $_SERVER['HTTP_HOST'] ?? 'localhost';  // e.g. sandtonhigh.iskool.online or localhost

// ────── 2. LOCALHOST TESTING MODE (delete these lines when you go live) ──────
if ($host_name === 'localhost' || $host_name === '127.0.0.1' || strpos($host_name, 'iskool.test') !== false) {
    // CHANGE THIS LINE ONLY when you want to test a different school locally
    $database = "iskool_sandtonhigh";   // ← switch to iskool_landulwazi, iskool_thokothaba, etc.
}
// ────── 3. LIVE MODE – automatic subdomain detection ──────
else {
    // Extract subdomain: sandtonhigh.iskool.online → sandtonhigh
    $subdomain = str_replace('.iskool.online', '', strtolower($host_name));

    // Safety check (main domain or invalid URL)
    if ($subdomain === $host_name || empty($subdomain) || strlen($subdomain) > 50) {
        die("<h2 style='text-align:center; margin-top:10%; font-family:Arial;'>Welcome to iSkool<br><small>Please use your school address (e.g. yourschool.iskool.online)</small></h2>");
    }

    // Build correct database name automatically
    $database = $db_prefix . $subdomain;   // ← THIS IS THE MAGIC LINE
}

// ────── 4. Connect to the correct school's database ──────
$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    // Friendly message on live, detailed on localhost
    if (in_array($host_name, ['localhost', '127.0.0.1'])) {
        die("Database connection failed: " . $conn->connect_error . " → Check if <strong>$database</strong> exists");
    } else {
        die("<h2 style='text-align:center; margin-top:10%; font-family:Arial;'>School temporarily unavailable.<br>Please try again later.</h2>");
    }
}

$conn->set_charset("utf8mb4");

// Optional: store school info in session (useful later)
$_SESSION['current_school_db'] = $database;
?>