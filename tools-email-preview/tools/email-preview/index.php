<?php
/**
 * tools/email-preview/index.php
 *
 * Email Template Test Suite — iSkool Developer Tools
 * Visit this page in the browser to send any template to the test inbox.
 *
 * ⚠️  NEVER deploy this folder to production. Add to .gitignore or restrict via .htaccess.
 */

$templates = [
    [
        'file'        => 'test_welcome.php',
        'label'       => 'Welcome / Registration',
        'description' => 'Sent when a new user registers. Tests all four roles.',
        'roles'       => ['learner', 'teacher', 'parent', 'school_admin'],
    ],
    [
        'file'        => 'test_announcement.php',
        'label'       => 'Announcement',
        'description' => 'Sent by a teacher when a class announcement is posted.',
        'roles'       => [],
    ],
    [
        'file'        => 'test_assignment.php',
        'label'       => 'Assignment',
        'description' => 'Sent to learners when a new assignment is created.',
        'roles'       => [],
    ],
    [
        'file'        => 'test_evaluation.php',
        'label'       => 'Evaluation',
        'description' => 'Sent to learners when a teacher releases an evaluation.',
        'roles'       => [],
    ],
    [
        'file'        => 'test_reset.php',
        'label'       => 'Password Reset',
        'description' => 'Sent when a user requests a password reset link.',
        'roles'       => [],
    ],
];

$sent = $_GET['sent'] ?? null;
$role = $_GET['role'] ?? null;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email Preview — iSkool Dev Tools</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      padding: 40px 24px;
    }

    .container { max-width: 720px; margin: 0 auto; }

    .header { margin-bottom: 40px; }
    .header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .logo {
      width: 32px; height: 32px; border-radius: 8px;
      background: #4fd1c5; display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; color: #0d1117; flex-shrink: 0;
    }
    h1 { font-size: 20px; font-weight: 600; color: #e6edf3; }
    .subtitle { font-size: 14px; color: #7d8590; margin-top: 4px; }

    .badge-dev {
      display: inline-block; font-size: 11px; font-weight: 600;
      background: #3d2300; color: #f59e0b; border: 1px solid #6b3a00;
      border-radius: 4px; padding: 2px 8px; margin-left: 8px;
      letter-spacing: 0.5px; text-transform: uppercase;
    }

    .notice {
      background: #161b22; border: 1px solid #2a3038;
      border-left: 3px solid #f59e0b;
      border-radius: 8px; padding: 12px 16px;
      font-size: 13px; color: #7d8590; margin-bottom: 32px;
      line-height: 1.6;
    }
    .notice strong { color: #e6edf3; }

    .success-banner {
      background: #0d2318; border: 1px solid #1a4731;
      border-radius: 8px; padding: 12px 16px;
      font-size: 14px; color: #3fb950; margin-bottom: 24px;
    }

    .section-label {
      font-size: 11px; font-weight: 600; color: #7d8590;
      letter-spacing: 0.8px; text-transform: uppercase;
      margin-bottom: 12px;
    }

    .card {
      background: #161b22; border: 1px solid #21262d;
      border-radius: 12px; padding: 20px 24px;
      margin-bottom: 12px;
      display: flex; align-items: flex-start; gap: 16px;
    }
    .card-info { flex: 1; }
    .card-label { font-size: 15px; font-weight: 600; color: #e6edf3; margin-bottom: 4px; }
    .card-desc { font-size: 13px; color: #7d8590; line-height: 1.5; }

    .card-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0; }

    .btn {
      display: inline-block; padding: 7px 16px;
      font-size: 13px; font-weight: 500;
      border-radius: 6px; text-decoration: none;
      border: none; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #4fd1c5; color: #0d1117; }
    .btn-ghost {
      background: transparent; color: #7d8590;
      border: 1px solid #21262d;
    }
    .btn-ghost:hover { color: #e6edf3; border-color: #4fd1c5; opacity: 1; }

    .role-btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .btn-role {
      padding: 5px 12px; font-size: 12px;
      background: #21262d; color: #7d8590;
      border: 1px solid #30363d;
    }
    .btn-role:hover { color: #e6edf3; border-color: #4fd1c5; opacity: 1; }

    .test-email-note {
      font-size: 12px; color: #4fd1c5; margin-top: 16px;
      padding-top: 16px; border-top: 1px solid #21262d;
    }
    .test-email-note span { color: #7d8590; }
  </style>
</head>
<body>
<div class="container">

  <div class="header">
    <div class="header-top">
      <div class="logo">iS</div>
      <h1>Email Preview <span class="badge-dev">Dev Only</span></h1>
    </div>
    <p class="subtitle">Send any iSkool email template to the test inbox instantly.</p>
  </div>

  <div class="notice">
    <strong>⚠️ Developer tool.</strong> This folder should never be accessible on production.
    Add <code>tools/</code> to your <code>.htaccess</code> deny rules or delete after use.
  </div>

  <?php if ($sent): ?>
  <div class="success-banner">
    ✅ <strong><?= htmlspecialchars($sent) ?></strong><?= $role ? " ($role)" : "" ?> email sent — check <strong>mandlasimphiwe99@gmail.com</strong>
  </div>
  <?php endif; ?>

  <p class="section-label">Templates</p>

  <?php foreach ($templates as $t): ?>
  <div class="card">
    <div class="card-info">
      <div class="card-label"><?= $t['label'] ?></div>
      <div class="card-desc"><?= $t['description'] ?></div>
    </div>
    <div class="card-actions">
      <?php if (!empty($t['roles'])): ?>
        <div class="role-btns">
          <?php foreach ($t['roles'] as $r): ?>
            <a href="<?= $t['file'] ?>?role=<?= $r ?>" class="btn btn-role"><?= ucfirst(str_replace('_', ' ', $r)) ?></a>
          <?php endforeach; ?>
        </div>
      <?php else: ?>
        <a href="<?= $t['file'] ?>" class="btn btn-primary">Send Test</a>
      <?php endif; ?>
    </div>
  </div>
  <?php endforeach; ?>

  <div class="test-email-note">
    <span>All emails are sent to</span> mandlasimphiwe99@gmail.com
  </div>

</div>
</body>
</html>
