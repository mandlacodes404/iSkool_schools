<?php
//error_reporting(E_ALL);
//ini_set('display_errors', 1);

// Set default time zone to South Africa
date_default_timezone_set('Africa/Johannesburg');

$host = "localhost";
$user = "root";     // DB user
$password = "";         // DB password
$database = "iskool_sandtonhigh";   // DB name


// Create connection
$conn = new mysqli($host, $user, $password, $database);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Optional: Set charset to UTF-8 for proper encoding support
$conn->set_charset("utf8mb4");
?>
