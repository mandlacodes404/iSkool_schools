<?php
// ===================================================
// iSkool Multi-Tenant – FINAL CONFIG (2025+)
// One file → Infinite schools → Works on localhost & live
// ===================================================

date_default_timezone_set('Africa/Johannesburg');

// ────── DATABASE CREDENTIALS (change only when you go live) ──────
$host     = "localhost";
$user     = "iskowdbw";               // ← your cPanel database username
$password = "ogeQkRitRfdy";                       // ← fill in your real password when going live
$cpanel_prefix = "iskowdbw_";         // ← forced by your hosting (keep this)

// ────── 1. Detect where we are running ──────
$host_name = $_SERVER['HTTP_HOST'] ?? 'localhost';  // e.g. sandtonhigh.iskool.online or localhost

// ────── 2. LOCALHOST TESTING MODE (delete these lines when you go live) ──────
if ($host_name === 'localhost' || $host_name === '127.0.0.1' || strpos($host_name, 'iskool.test') !== false) {
    // For local testing, you can name databases freely — match live style for consistency
    $database = "iskowdbw_sandtonhigh";   // ← change to iskowdbw_landulwazi, etc. when testing other schools
}
// ────── 3. LIVE MODE – automatic subdomain detection ──────
else {
    // Extract subdomain: sandtonhigh.iskool.online → sandtonhigh
    $subdomain = str_replace('.iskool.online', '', strtolower($host_name));

    // Safety check (main domain or invalid URL)
    if ($subdomain === $host_name || empty($subdomain) || strlen($subdomain) > 50) {
        die("<h2 style='text-align:center; margin-top:10%; font-family:Arial;'>Welcome to iSkool<br><small>Please use your school address (e.g. yourschool.iskool.online)</small></h2>");
    }

    // Build database name: cpanel_prefix + subdomain → e.g. iskowdbw_sandtonhigh
    $database = $cpanel_prefix . $subdomain;
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


// ────── 5. LIVE BASE URL DETECTION ──────
// Since you are live, we force HTTPS and use the current host name
$base_url = "https://" . $_SERVER['HTTP_HOST'] . "/";
define('BASE_URL', $base_url);
?>