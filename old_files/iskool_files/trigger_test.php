<?php
// 1. Error Reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 2. MANUALLY SET DB (Bypassing the subdomain detection for this test)
$host     = "localhost";
$user     = "iskowdbw"; // Update if your live user is different
$password = "ogeQkRitRfdy";     // Update if your live pass is different
$database = "iskowdbw_sandtonhigh"; // REPLACE with your actual test database name

$conn = new mysqli($host, $user, $password, $database);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

// 3. Load the push function
require_once 'push_functions.php';

// 4. Set the email to YOUR email
$testEmail = "mandlasimphiwe99@gmail.com"; 

echo "<h1>Push System Test</h1>";
echo "Attempting to send to: $testEmail in database: $database...<br>";

try {
    $success = sendPushToUser($conn, $testEmail, "Database Test", "If you see this, your DB connection is 100% working!");
    
    if ($success) {
        echo "<p style='color:green;'><strong>SUCCESS:</strong> The request was sent to Apple for $testEmail.</p>";
        echo "<p>Check your iPhone now!</p>";
    } else {
        echo "<p style='color:red;'><strong>FAILED:</strong> No device found in table 'user_subscriptions' for $testEmail.</p>";
    }
} catch (Exception $e) {
    echo "<p style='color:orange;'><strong>ERROR:</strong> " . $e->getMessage() . "</p>";
}
?>