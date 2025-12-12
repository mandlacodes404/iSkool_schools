<?php
// includes/admin_year_helper.php
// This file is included in every admin page — gives you $activeYearId and $activeYearName

// Get the real current year
$currentYearResult = $conn->query("SELECT id, name FROM academic_years WHERE is_current = 1 LIMIT 1");
$currentYearRow    = $currentYearResult->fetch_assoc();
$currentYearId     = $currentYearRow['id'] ?? null;
$currentYearName   = $currentYearRow['name'] ?? 'Not Set';

// Handle year switch (same logic you already have in dashboard)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['academic_year_id'])) {
    $newYearId = (int)$_POST['academic_year_id'];
    $check = $conn->query("SELECT id FROM academic_years WHERE id = $newYearId LIMIT 1");
    if ($check && $check->num_rows === 1) {
        $_SESSION['admin_selected_year_id'] = $newYearId;
    }
    // Only redirect if not in iframe (prevents breaking the dashboard layout)
    if (!isset($_GET['iframe'])) {
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    }
}

// Final active year (admin choice OR real current year)
$activeYearId = $_SESSION['admin_selected_year_id'] ?? $currentYearId;

if ($activeYearId && $activeYearId != $currentYearId) {
    $res = $conn->query("SELECT name FROM academic_years WHERE id = $activeYearId");
    if ($row = $res->fetch_assoc()) {
        $activeYearName = $row['name'];
    } else {
        $activeYearName = $currentYearName;
    }
} else {
    $activeYearName = $currentYearName;
}

// Optional: clean up session if invalid year
if ($activeYearId && !$conn->query("SELECT id FROM academic_years WHERE id = $activeYearId")->fetch_row()) {
    unset($_SESSION['admin_selected_year_id']);
    $activeYearId = $currentYearId;
    $activeYearName = $currentYearName;
}
?>