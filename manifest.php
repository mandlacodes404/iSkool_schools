<?php
require_once __DIR__ . '/config.php';

// Fetch school name from DB
$schoolName = 'iSkool'; // fallback
$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $schoolName = trim($row['setting_value']);
}

// Output as JSON with correct content type
header('Content-Type: application/manifest+json');

echo json_encode([
    "name"             => $schoolName,
    "short_name"       => "iSkool",
    "id"               => "/",
    "description"      => "Learning Management system",
    "start_url"        => "/",
    "scope"            => "/",
    "display"          => "standalone",
    "background_color" => "#20201f",
    "theme_color"      => "#20201f",
    "orientation"      => "portrait",
    "icons"            => [
        [
            "src"     => "https://iskool.xyz/icons/icon-192.png",
            "sizes"   => "192x192",
            "type"    => "image/png",
            "purpose" => "any"
        ],
        [
            "src"     => "https://iskool.xyz/icons/icon-512.png",
            "sizes"   => "512x512",
            "type"    => "image/png",
            "purpose" => "any"
        ],
        [
            "src"     => "https://iskool.xyz/icons/maskable-icon-512.png",
            "sizes"   => "512x512",
            "type"    => "image/png",
            "purpose" => "maskable"
        ]
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);