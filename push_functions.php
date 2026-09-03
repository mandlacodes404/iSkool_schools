<?php
require_once __DIR__ . '/config.php';
require __DIR__ . '/vendor/autoload.php';

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

function sendPushToUser($conn, $email, $title, $message, $targetUrl = null, $schoolName = 'iSkool', $icon = 'https://iskool.xyz/uploads/schools/default_school.png') {
    $stmt = $conn->prepare("SELECT endpoint, p256dh, auth FROM user_subscriptions WHERE user_email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        return false;
    }

    $vapid_public  = getenv('VAPID_PUBLIC_KEY');
    $vapid_private = getenv('VAPID_PRIVATE_KEY');
    if (!$vapid_public || !$vapid_private) {
        error_log('Push delivery skipped: VAPID keys are not configured.');
        $stmt->close();
        return false;
    }

    $auth = [
        'VAPID' => [
            'subject' => 'mailto:mandlasimphiwe99@gmail.com',
            'publicKey' => $vapid_public,
            'privateKey' => $vapid_private,
        ],
    ];

    $pushOptions = [
        'TTL' => 2419200, // Keep delivery available for offline devices for up to 4 weeks.
        'urgency' => 'high',
    ];

    $webPush = new WebPush($auth, $pushOptions);
    $queued = 0;
    $sent = false;
    $tag = 'iskool-' . substr(hash('sha256', $email . '|' . $title . '|' . ($targetUrl ?? '') . '|' . microtime(true)), 0, 16);

    $payload = json_encode([
        'title' => $schoolName,
        'body' => $title . "\n" . $message,
        'icon' => $icon,
        'tag' => $tag,
        'data' => [
            'url' => $targetUrl,
            'tag' => $tag,
            'icon' => $icon,
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    while ($row = $result->fetch_assoc()) {
        try {
            $subscription = Subscription::create([
                'endpoint' => $row['endpoint'],
                'keys' => [
                    'p256dh' => $row['p256dh'],
                    'auth' => $row['auth'],
                ],
            ]);

            $webPush->queueNotification($subscription, $payload, $pushOptions);
            $queued++;
        } catch (Throwable $e) {
            error_log("Push subscription could not be queued for {$email}: " . $e->getMessage());
        }
    }

    $stmt->close();

    if ($queued === 0) {
        return false;
    }

    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            $sent = true;
            continue;
        }

        $endpoint = $report->getEndpoint();

        if ($report->isSubscriptionExpired()) {
            $deleteStmt = $conn->prepare("DELETE FROM user_subscriptions WHERE endpoint = ?");
            if ($deleteStmt) {
                $deleteStmt->bind_param("s", $endpoint);
                $deleteStmt->execute();
                $deleteStmt->close();
            }
        }

        error_log("Push failed for {$email} at {$endpoint}: " . $report->getReason());
    }

    return $sent;
}
