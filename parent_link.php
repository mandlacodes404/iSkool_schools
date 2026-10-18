<?php
/**
 * parent_link.php?code=...
 * The page a parent opens from a learner's invite link. They log in (or create a parent account), see which
 * learner they are about to link to, and confirm. Confirming calls api/parent/redeem_parent_invite.php.
 *
 * Views: login (not signed in) | wrong_role (signed in as someone else) | confirm | invalid.
 */

// The session cookie is SameSite=Strict, so a browser does not send it on a link opened from another website
// (WhatsApp Web, webmail). Without this step the parent would look signed out here, and starting a new session
// would replace their real one. So a cross-site arrival is bounced once to this same page from our own origin,
// before any session is touched. Sec-Fetch-Site is "none" when a link is opened from a native app, which is fine.
$raw_code = (string) ($_GET['code'] ?? '');
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' && !isset($_GET['r'])) {
    $again = 'parent_link.php?code=' . rawurlencode($raw_code) . '&r=1';
    header('Cache-Control: no-store');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex">'
        . '<meta http-equiv="refresh" content="0;url=' . htmlspecialchars($again, ENT_QUOTES, 'UTF-8') . '">'
        . '<title>iSkool</title></head><body style="background:#20201f;color:#8b8b86;font-family:system-ui,sans-serif">'
        . '<script>location.replace(' . json_encode($again) . ');</script>'
        . '<noscript><a href="' . htmlspecialchars($again, ENT_QUOTES, 'UTF-8') . '" style="color:#4fd1c5">Continue</a></noscript>'
        . '</body></html>';
    exit;
}

require_once __DIR__ . '/auth/session_guard.php';
require_once __DIR__ . '/auth/rate_limit_functions.php';
require_once __DIR__ . '/auth/parent_invite_functions.php';
require_once __DIR__ . '/config.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

$code = parent_invite_is_valid_code_format($raw_code) ? $raw_code : '';

$cookie_options = [
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
];

$school_name = 'your school';
$name_res = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($name_res && ($name_row = $name_res->fetch_assoc()) && trim((string) $name_row['setting_value']) !== '') {
    $school_name = trim($name_row['setting_value']);
}

$view         = 'invalid';
$learner_name = '';
$class_names  = [];
$viewer_role  = $_SESSION['role'] ?? '';

if ($code !== '') {
    if (!isset($_SESSION['email'])) {
        // Remember the code through login or registration. A cookie, not the session: registering can take a
        // while (the parent may need the school's access key) and session data is cleaned up sooner than that.
        setcookie('pending_parent_invite', $code, $cookie_options + ['expires' => time() + PARENT_INVITE_TTL_SECONDS]);
        $view = 'login';
    } elseif ($viewer_role !== 'parent') {
        $view = 'wrong_role';
    } else {
        // Signed in as a parent: the code is in the URL now, so the reminder cookie has done its job.
        setcookie('pending_parent_invite', '', $cookie_options + ['expires' => time() - 3600]);

        $parent_email = $_SESSION['email'];
        $client_ip    = auth_rate_limit_client_ip();
        $window       = 15 * 60;
        $blocked = auth_rate_limit_is_blocked($conn, 'parent_invite_redeem', 'account', $parent_email, 10, $window)
                || auth_rate_limit_is_blocked($conn, 'parent_invite_redeem', 'ip', $client_ip, 30, $window);

        if (!$blocked) {
            $stmt = $conn->prepare('SELECT learner_email, expires_at, used_at FROM parent_invites WHERE code_hash = ? LIMIT 1');
            $code_hash = parent_invite_hash($code);
            $stmt->bind_param('s', $code_hash);
            $stmt->execute();
            $invite = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($invite && $invite['used_at'] === null && !parent_invite_is_expired($invite['expires_at'])) {
                $l_stmt = $conn->prepare("SELECT name, surname FROM users WHERE email = ? AND role = 'learner' AND is_deleted = 0 LIMIT 1");
                $l_stmt->bind_param('s', $invite['learner_email']);
                $l_stmt->execute();
                $learner = $l_stmt->get_result()->fetch_assoc();
                $l_stmt->close();

                if ($learner) {
                    $learner_name = parent_invite_display_name($learner['name'], $learner['surname']);

                    $c_stmt = $conn->prepare(
                        'SELECT DISTINCT c.name
                         FROM class_students cs
                         JOIN classes c ON c.id = cs.class_id
                         WHERE cs.student_email = ?
                           AND cs.academic_year_id = (SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1)
                         ORDER BY c.name'
                    );
                    $c_stmt->bind_param('s', $invite['learner_email']);
                    $c_stmt->execute();
                    $c_res = $c_stmt->get_result();
                    while ($c_row = $c_res->fetch_assoc()) {
                        $class_names[] = $c_row['name'];
                    }
                    $c_stmt->close();

                    $view = 'confirm';
                }
            }
        }
    }
}

$csrf = $_SESSION['csrf_token'] ?? '';
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="csrf-token" content="<?= $e($csrf) ?>">
    <title>Link to your child · iSkool</title>
    <style>
        :root {
            --bg: #20201f; --surface: #272726; --line: #343433;
            --text: #ecece9; --muted: #8b8b86; --accent: #4fd1c5; --on-accent: #0f2a27;
            --bad: #f6877a;
        }
        @media (prefers-color-scheme: light) {
            :root {
                --bg: #f5f4ef; --surface: #ffffff; --line: #e3e1d9;
                --text: #1f1f1d; --muted: #6d6c66; --accent: #0f9488; --on-accent: #ffffff;
                --bad: #c0392b;
            }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        body {
            background: var(--bg); color: var(--text);
            font: 16px/1.5 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
            display: flex; align-items: center; justify-content: center; padding: 24px 16px;
            min-height: 100vh; min-height: 100dvh;
        }
        .card {
            width: 100%; max-width: 420px; background: var(--surface);
            border: 1px solid var(--line); border-radius: 16px; padding: 28px 24px;
        }
        .school { font-size: 13px; color: var(--muted); margin: 0 0 14px; }
        h1 { font-size: 22px; line-height: 1.25; margin: 0 0 10px; font-weight: 600; }
        p { margin: 0 0 16px; color: var(--muted); }
        .child { margin: 4px 0 18px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; }
        .child b { display: block; font-size: 17px; font-weight: 600; color: var(--text); }
        .child span { display: block; margin-top: 2px; font-size: 14px; color: var(--muted); }
        .btn {
            display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px;
            padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); background: transparent;
            color: var(--text); font: inherit; font-weight: 600; text-decoration: none; cursor: pointer;
        }
        .btn + .btn { margin-top: 10px; }
        .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .btn:disabled { opacity: .6; cursor: default; }
        .note { font-size: 13px; color: var(--muted); margin: 14px 0 0; }
        .err { color: var(--bad); font-size: 14px; margin: 12px 0 0; min-height: 1px; }
        [hidden] { display: none !important; }
    </style>
</head>
<body>
<main class="card">
    <p class="school"><?= $e($school_name) ?></p>

<?php if ($view === 'login'): ?>
    <h1>You've been invited</h1>
    <p>A learner at <?= $e($school_name) ?> has invited you to follow their progress on iSkool. Log in with your parent account, or create one, to continue.</p>
    <a class="btn primary" href="index.php">Log in or create an account</a>
    <p class="note">After you log in you'll come straight back here to confirm. Creating a parent account needs the parent access key from the school.</p>

<?php elseif ($view === 'wrong_role'): ?>
    <h1>This invite is for a parent account</h1>
    <p>You're signed in with a <?= $e(str_replace('_', ' ', $viewer_role)) ?> account. Log out, then open the link again and sign in with your parent account.</p>
    <a class="btn primary" href="logout.php">Log out</a>
    <a class="btn" href="dashboard.php">Back to my dashboard</a>

<?php elseif ($view === 'confirm'): ?>
    <div id="confirmView">
        <h1>Link to this learner?</h1>
        <p>You'll be able to follow their progress at <?= $e($school_name) ?>.</p>
        <div class="child">
            <b><?= $e($learner_name) ?></b>
            <?php if ($class_names): ?><span><?= $e(implode(', ', $class_names)) ?></span><?php endif; ?>
        </div>
        <button type="button" class="btn primary" id="confirmBtn">Yes, link me</button>
        <a class="btn" href="dashboard.php">Not now</a>
        <p class="err" id="errMsg" role="alert"></p>
    </div>
    <div id="doneView" hidden>
        <h1>You're linked</h1>
        <p id="doneText"></p>
        <a class="btn primary" href="dashboard.php">Continue</a>
    </div>
    <script>
    (function () {
        var code = <?= json_encode($code) ?>;
        var btn = document.getElementById('confirmBtn');
        var err = document.getElementById('errMsg');
        var token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
        btn.addEventListener('click', function () {
            btn.disabled = true; btn.textContent = 'Linking…'; err.textContent = '';
            fetch('api/parent/redeem_parent_invite.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': token },
                body: new URLSearchParams({ code: code, csrf_token: token })
            })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.success) {
                    document.getElementById('doneText').textContent = d.already_linked
                        ? 'You were already linked to ' + d.learner_name + '.'
                        : 'You can now follow ' + d.learner_name + '’s progress.';
                    document.getElementById('confirmView').hidden = true;
                    document.getElementById('doneView').hidden = false;
                } else {
                    btn.disabled = false; btn.textContent = 'Yes, link me';
                    err.textContent = (d && (d.error || d.message)) || 'Could not link your account. Please try again.';
                }
            })
            .catch(function () {
                btn.disabled = false; btn.textContent = 'Yes, link me';
                err.textContent = 'Connection problem. Check your internet and try again.';
            });
        });
    })();
    </script>

<?php else: ?>
    <h1>This link isn't valid anymore</h1>
    <p>It may have expired or already been used. Ask your child to create a new invite from <b>My Class</b> in iSkool.</p>
    <a class="btn" href="index.php">Go to iSkool</a>
<?php endif; ?>
</main>
</body>
</html>
