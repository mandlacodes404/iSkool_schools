<?php
$host = "localhost";
$user = "iskohoks_iskool_user";
$password = "oxJTVc6HXRSc";
$database = "iskohoks_iskool_db";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
} else {
    echo "Database connection successful!";
}
?>
