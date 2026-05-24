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
    $checkStmt = $conn->prepare("SELECT id FROM academic_years WHERE id = ? LIMIT 1");
    $checkStmt->bind_param("i", $newYearId);
    $checkStmt->execute();
    $check = $checkStmt->get_result();
    if ($check && $check->num_rows === 1) {
        $_SESSION['admin_selected_year_id'] = $newYearId;
    }
    $checkStmt->close();
    // Only redirect if not in iframe (prevents breaking the dashboard layout)
    if (!isset($_GET['iframe'])) {
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    }
}

// Final active year (admin choice OR real current year)
$activeYearId = $_SESSION['admin_selected_year_id'] ?? $currentYearId;

if ($activeYearId && $activeYearId != $currentYearId) {
    $yearStmt = $conn->prepare("SELECT name FROM academic_years WHERE id = ?");
    $yearStmt->bind_param("i", $activeYearId);
    $yearStmt->execute();
    $res = $yearStmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $activeYearName = $row['name'];
    } else {
        $activeYearName = $currentYearName;
    }
    $yearStmt->close();
} else {
    $activeYearName = $currentYearName;
}

// Optional: clean up session if invalid year
if ($activeYearId) {
    $activeStmt = $conn->prepare("SELECT id FROM academic_years WHERE id = ?");
    $activeStmt->bind_param("i", $activeYearId);
    $activeStmt->execute();
    $activeResult = $activeStmt->get_result();
}
if ($activeYearId && !$activeResult->fetch_row()) {
    unset($_SESSION['admin_selected_year_id']);
    $activeYearId = $currentYearId;
    $activeYearName = $currentYearName;
}
if (isset($activeStmt)) {
    $activeStmt->close();
}
?>
