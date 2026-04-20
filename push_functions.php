<?php
require_once __DIR__ . '/config.php';
require __DIR__ . '/vendor/autoload.php';
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

// Added $targetUrl as a 5th parameter and $schoolName as a 6th parameter
function sendPushToUser($conn, $email, $title, $message, $targetUrl = null, $schoolName = 'iSkool') {
    // 1. Get all device subscriptions for this email
    $stmt = $conn->prepare("SELECT endpoint, p256dh, auth FROM user_subscriptions WHERE user_email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) return false;

    // 2. Setup WebPush with your VAPID keys
    $auth = [
        'VAPID' => [
            'subject' => 'mailto:mandlasimphiwe99@gmail.com',
            'publicKey' => 'BLl4HnUrajJk2h5w4P9RlQZpiGgBCO7ZKCwVR2D_jcuvbBEDsm9eBMic1CNa-4E_aoTn4FqjhaJmgS7QIyv7C1w',
            'privateKey' => 'hsxomVfHuz9W86G9R6B9AnEVI6EUcRT3QUsQcJAlJ38', 
        ],
    ];

    $webPush = new WebPush($auth);

    // 3. Queue notifications for every device this user has
    while ($row = $result->fetch_assoc()) {
        $subscription = Subscription::create([
            'endpoint' => $row['endpoint'],
            'keys' => [
                'p256dh' => $row['p256dh'],
                'auth'   => $row['auth']
            ]
        ]);

        $webPush->queueNotification(
            $subscription,
            json_encode([
                'title' => $schoolName,          // short, bold — e.g. "Greenwood High"
                 'body'  => $title . "\n" . $message,  // the actual content, shown in normal weight
                'icon'  => 'https://iskool.online/uploads/schools/default_school.png',
                // --- NEW: This is the payload the Service Worker reads ---
                'data'  => [
                    'url' => $targetUrl 
                ]
            ])
        );
    }

    // 4. Send them all at once
    foreach ($webPush->flush() as $report) {
        // Logging can be added here if needed
    }
    
    return true;
}