<?php
require __DIR__ . '/vendor/autoload.php';
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

// 1. YOUR UNIQUE IPHONE DATA FROM THE LOG
$subscription = Subscription::create([
    "endpoint" => "https://web.push.apple.com/QBeB83Rl81FU4pN5oHVqdM6aKfH_81SyvX1eQdyvKo1R_cajP9R3oMrNv7yAxrgg64occTHKSIxLAdPQ2YsiBD_adW8wHEQ91gJnRujoNm6pEoooNL_biAxd6RD4fiH3ySUyIvL7lje3KOQENFA2FthDGOmsP4F1vmPO7VqbzR8",
    "keys" => [
        "p256dh" => "BFuYyUJ5ry_cnAMKEnXtHeIUnqzNIoKdyJwZ775FnLpjfdSrPaF3AMbEvYRfYPFronWozxASiXhHc5xg-jZ5E8k",
        "auth"   => "cFElira7QLJ4oiuB75E_Lg"
    ]
]);

// 2. YOUR VAPID KEYS (Ensure these match your Dashboard)
$auth = [
    'VAPID' => [
        'subject' => 'mailto:mandlasimphiwe99@gmail.com',
        'publicKey' => 'BLl4HnUrajJk2h5w4P9RlQZpiGgBCO7ZKCwVR2D_jcuvbBEDsm9eBMic1CNa-4E_aoTn4FqjhaJmgS7QIyv7C1w',
        'privateKey' => 'hsxomVfHuz9W86G9R6B9AnEVI6EUcRT3QUsQcJAlJ38', // <-- MAKE SURE THIS IS CORRECT
    ],
];

$webPush = new WebPush($auth);

$report = $webPush->sendOneNotification(
    $subscription,
    json_encode([
        "title" => "iSkool Update",
        "body"  => "Success! Your iPhone push notifications are active.",
        "icon"  => "https://iskool.online/uploads/schools/default_school.png"
    ])
);

// Check if it worked
if ($report->isSuccess()) {
    echo "SUCCESS: Notification sent to Apple!";
} else {
    echo "FAILURE: " . $report->getReason();
}
?>