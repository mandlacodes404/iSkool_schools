<?php
// ============================================================
//  iSkool — Superadmin School Onboarding Panel
//  File:    superadmin/index.php
//  Access:  iskool.online/superadmin/
//
//  SECURITY: Protect this folder with .htaccess IP restriction.
//  See the included .htaccess file.
// ============================================================

session_start();
date_default_timezone_set('Africa/Johannesburg');

// ============================================================
//  ⚙️  CONFIGURATION — Fill these before uploading
// ============================================================
define('SA_PASSWORD',      'SomeStrongPassword@2026');       // your private panel password
define('CPANEL_USER',      'iskowdbw');
define('CPANEL_API_TOKEN', 'CFMB6QZBHI5MDBQ1I90GW6DGYYEP9G5L');    // from cPanel → API Tokens
define('CPANEL_HOST',      'https://iskool.online:2083');
define('DB_HOST',          'localhost');
define('DB_USER',          'iskowdbw');
define('DB_PASS',          'ogeQkRitRfdy');            // your cPanel DB password
define('DB_PREFIX',        'iskowdbw_');
define('MAIN_DOMAIN',      'iskool.online');
define('TEMPLATE_PATH',    __DIR__ . '/iskool_new_school_template.sql');
define('SMTP_HOST',        'iskool.online');
define('SMTP_USER',        'support@iskool.online');
define('SMTP_PASS',        'ogeQkRitRfdy');         // support@iskool.online password
define('SMTP_PORT',        465);

// ============================================================
//  MASTER DB CONNECTION (tracks all schools)
// ============================================================
function getMasterDB() {
    $m = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_PREFIX . 'master');
    if ($m->connect_error) die('Master DB error: ' . $m->connect_error);
    $m->set_charset('utf8mb4');
    return $m;
}

// ============================================================
//  KEY GENERATOR — unpredictable per role
// ============================================================
function generateKey(string $prefix): string {
    $chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $part1  = '';
    $part2  = '';
    for ($i = 0; $i < 4; $i++) $part1 .= $chars[random_int(0, strlen($chars) - 1)];
    for ($i = 0; $i < 4; $i++) $part2 .= $chars[random_int(0, strlen($chars) - 1)];
    return $prefix . '-' . $part1 . '-' . $part2;
}

// ============================================================
//  CPANEL API HELPER
// ============================================================
function cPanelAPI(string $module, string $func, array $params = []): array {
    $query  = http_build_query($params);
    $url    = CPANEL_HOST . '/execute/' . $module . '/' . $func . '?' . $query;
    $ch     = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'Authorization: cpanel ' . CPANEL_USER . ':' . CPANEL_API_TOKEN
        ],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    return json_decode($resp, true) ?? ['errors' => ['cURL failed']];
}

// ============================================================
//  STEP 1 — CREATE DATABASE VIA CPANEL API
// ============================================================
function createDatabase(string $dbName): array {
    // Strip the prefix — cPanel adds it automatically
    $suffix = str_replace(DB_PREFIX, '', $dbName);

    $res = cPanelAPI('Mysql', 'create_database', ['name' => $suffix]);
    if (!empty($res['errors'])) return ['ok' => false, 'msg' => implode(', ', $res['errors'])];

    cPanelAPI('Mysql', 'set_privileges_on_database', [
        'user'       => DB_USER,
        'database'   => $suffix,
        'privileges' => 'ALL PRIVILEGES',
    ]);
    return ['ok' => true];
}
// ============================================================
//  STEP 2 — RUN SQL TEMPLATE
// ============================================================
function runTemplate(string $dbName, string $schoolName, string $adminEmail,
                     string $adminPassword, string $adminFirstName,
                     string $adminLastName, array $keys): array {
    if (!file_exists(TEMPLATE_PATH)) {
        return ['ok' => false, 'msg' => 'Template SQL file not found at: ' . TEMPLATE_PATH];
    }

    $sql = file_get_contents(TEMPLATE_PATH);

    // Replace placeholders
    $year        = date('Y');
    $yearStart   = $year . '-01-01';
    $yearEnd     = $year . '-12-31';
    $hashedPass  = password_hash($adminPassword, PASSWORD_BCRYPT);

    $sql = str_replace('School Name Here',       $schoolName,    $sql);
    $sql = str_replace('LEARNER-<<SCHOOL_CODE>>', $keys['learner'], $sql);
    $sql = str_replace('TEACHER-<<SCHOOL_CODE>>', $keys['teacher'], $sql);
    $sql = str_replace('PARENT-<<SCHOOL_CODE>>',  $keys['parent'],  $sql);
    $sql = str_replace('ADMIN-<<SCHOOL_CODE>>',   $keys['admin'],   $sql);
    $sql = str_replace("'2026'",                  "'$year'",       $sql);
    $sql = str_replace("'2026-01-01'",            "'$yearStart'",  $sql);
    $sql = str_replace("'2026-12-31'",            "'$yearEnd'",    $sql);
    $sql = str_replace('<<ADMIN_EMAIL>>',         $adminEmail,     $sql);
    $sql = str_replace('<<BCRYPT_HASHED_PASSWORD>>', $hashedPass,  $sql);
    $sql = str_replace("'School'",               "'$adminFirstName'", $sql);
    $sql = str_replace("'Admin'",                "'$adminLastName'",  $sql);

    // Connect to new database and run SQL
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, $dbName);
    if ($conn->connect_error) return ['ok' => false, 'msg' => 'Cannot connect to new DB: ' . $conn->connect_error];
    $conn->set_charset('utf8mb4');

    // Split and execute statement by statement
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($statements as $stmt) {
        if (empty($stmt) || strpos($stmt, '--') === 0) continue;
        if (!$conn->query($stmt)) {
            $conn->close();
            return ['ok' => false, 'msg' => 'SQL error: ' . $conn->error . ' → ' . substr($stmt, 0, 80)];
        }
    }
    $conn->close();
    return ['ok' => true];
}

// ============================================================
//  STEP 3 — CREATE SUBDOMAIN VIA CPANEL API
// ============================================================
function createSubdomain(string $subdomain): array {
    $res = cPanelAPI('SubDomain', 'addsubdomain', [
        'domain'    => $subdomain,
        'rootdomain' => MAIN_DOMAIN,
        'dir'       => '/public_html',
    ]);
    if (!empty($res['errors'])) return ['ok' => false, 'msg' => implode(', ', $res['errors'])];
    return ['ok' => true];
}

// ============================================================
//  STEP 4 — SEND WELCOME EMAIL VIA PHPMAILER
// ============================================================
function sendWelcomeEmail(string $toEmail, string $toName, string $schoolName,
                          string $subdomain, string $adminPassword, array $keys): array {
    // PHPMailer — assumes composer autoload or manual include
    // Place PHPMailer in /superadmin/PHPMailer/
    $mailerPath = __DIR__ . '/PHPMailer/src/';
    if (!file_exists($mailerPath . 'PHPMailer.php')) {
        return ['ok' => false, 'msg' => 'PHPMailer not found. Upload it to /superadmin/PHPMailer/src/'];
    }

    require_once $mailerPath . 'PHPMailer.php';
    require_once $mailerPath . 'SMTP.php';
    require_once $mailerPath . 'Exception.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $schoolUrl = 'https://' . $subdomain . '.' . MAIN_DOMAIN;

    try {
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = SMTP_PORT;

        $mail->setFrom(SMTP_USER, 'iSkool Support');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = 'Welcome to iSkool — Your School Platform is Ready';
        $mail->Body    = buildWelcomeEmailHTML(
            $toName, $schoolName, $schoolUrl,
            $toEmail, $adminPassword, $keys
        );
        $mail->AltBody = buildWelcomeEmailText(
            $toName, $schoolName, $schoolUrl,
            $toEmail, $adminPassword, $keys
        );
        $mail->send();
        return ['ok' => true];
    } catch (Exception $e) {
        return ['ok' => false, 'msg' => $mail->ErrorInfo];
    }
}

// ============================================================
//  WELCOME EMAIL — HTML VERSION
// ============================================================
function buildWelcomeEmailHTML(string $name, string $schoolName, string $schoolUrl,
                                string $email, string $password, array $keys): string {
    $year = date('Y');
    return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0d1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;font-size:32px;font-weight:700;color:#ffffff;letter-spacing:-1px;">
        i<span style="color:#39d5c1;">Skool</span>
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#8b949e;letter-spacing:2px;text-transform:uppercase;">
        Learning Management System
      </p>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:#39d5c1;padding:24px 40px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d1117;">
        🎉 Your school platform is live!
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:40px;">

      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
        Dear <strong>{$name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
        Welcome to iSkool! Your school platform for <strong>{$schoolName}</strong> has been 
        successfully created and is ready to use. Below are your login details and access 
        codes — please keep this email safe.
      </p>

      <!-- LOGIN DETAILS BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e9ecef;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;">
              Your Login Details
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Platform URL</td>
                <td style="padding:6px 0;">
                  <a href="{$schoolUrl}" style="color:#39d5c1;font-weight:700;font-size:14px;">{$schoolUrl}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Email</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#333;">{$email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Password</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#333;font-family:monospace;">{$password}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- ACCESS KEYS BOX -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e9ecef;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#39d5c1;">
              Registration Access Keys
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#888;width:120px;">Learner Key</td>
                <td style="padding:8px 0;">
                  <span style="background:#e8faf8;color:#0d6e62;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">
                    {$keys['learner']}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#888;">Teacher Key</td>
                <td style="padding:8px 0;">
                  <span style="background:#fff3e0;color:#e65100;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">
                    {$keys['teacher']}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#888;">Parent Key</td>
                <td style="padding:8px 0;">
                  <span style="background:#f3e5f5;color:#6a1b9a;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">
                    {$keys['parent']}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#888;">Admin Key</td>
                <td style="padding:8px 0;">
                  <span style="background:#fce4ec;color:#880e4f;font-family:monospace;font-weight:700;font-size:14px;padding:4px 12px;border-radius:4px;">
                    {$keys['admin']}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- SECURITY WARNING -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #ffc107;border-radius:4px;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#f57f17;">
              ⚠️ Important Security Notice
            </p>
            <p style="margin:0;font-size:13px;color:#795548;line-height:1.6;">
              The <strong>Teacher Key</strong> and <strong>Admin Key</strong> must only be shared 
              with authorised staff members. <strong>Do not share these codes with learners or 
              parents.</strong> iSkool is not responsible for unauthorised registrations 
              resulting from leaked access codes. Please distribute codes carefully and securely.
            </p>
          </td>
        </tr>
      </table>

      <!-- NEXT STEPS -->
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#333;">Getting Started:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#555;">
            <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">1</span>
            Log in at <a href="{$schoolUrl}" style="color:#39d5c1;">{$schoolUrl}</a> using your email and password above.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#555;">
            <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">2</span>
            Share the <strong>Teacher Key</strong> with your teachers so they can register.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#555;">
            <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">3</span>
            Create your school's classes from the Admin dashboard.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#555;">
            <span style="display:inline-block;background:#39d5c1;color:#0d1117;font-weight:700;font-size:11px;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;margin-right:10px;">4</span>
            Share the <strong>Learner Key</strong> with your learners to register.
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:14px;color:#555;line-height:1.7;">
        If you need any assistance please contact us at 
        <a href="mailto:support@iskool.online" style="color:#39d5c1;">support@iskool.online</a>.
        We are here to help you get the most out of iSkool.
      </p>
      <p style="margin:0;font-size:14px;color:#555;">
        Welcome aboard! 🎉
      </p>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#8b949e;">
        iSkool LMS · Johannesburg, South Africa
      </p>
      <p style="margin:0;font-size:12px;color:#484f58;">
        <a href="https://iskool.online" style="color:#39d5c1;">www.iskool.online</a> · 
        <a href="mailto:support@iskool.online" style="color:#484f58;">support@iskool.online</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#484f58;">
        © {$year} iSkool LMS. All rights reserved.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

// ============================================================
//  WELCOME EMAIL — PLAIN TEXT FALLBACK
// ============================================================
function buildWelcomeEmailText(string $name, string $schoolName, string $schoolUrl,
                                string $email, string $password, array $keys): string {
    return "Welcome to iSkool, {$name}!\n\n"
         . "Your school platform for {$schoolName} is ready.\n\n"
         . "LOGIN DETAILS\n"
         . "URL:      {$schoolUrl}\n"
         . "Email:    {$email}\n"
         . "Password: {$password}\n\n"
         . "ACCESS KEYS\n"
         . "Learner: {$keys['learner']}\n"
         . "Teacher: {$keys['teacher']}\n"
         . "Parent:  {$keys['parent']}\n"
         . "Admin:   {$keys['admin']}\n\n"
         . "SECURITY: Do NOT share the Teacher or Admin keys with learners.\n\n"
         . "Need help? Email support@iskool.online\n"
         . "© " . date('Y') . " iSkool LMS — www.iskool.online";
}

// ============================================================
//  STEP 5 — LOG SCHOOL IN MASTER DATABASE
// ============================================================
function logSchoolInMaster(string $schoolName, string $subdomain, string $dbName,
                            string $adminName, string $adminEmail, array $keys): array {
    $m    = getMasterDB();
    $stmt = $m->prepare("
        INSERT INTO schools 
        (school_name, subdomain, database_name, admin_name, admin_email,
         key_learner, key_teacher, key_parent, key_admin, status, pilot_start, pilot_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pilot', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH))
    ");
    $stmt->bind_param('sssssssss',
        $schoolName, $subdomain, $dbName,
        $adminName, $adminEmail,
        $keys['learner'], $keys['teacher'],
        $keys['parent'], $keys['admin']
    );
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        $m->close();
        return ['ok' => false, 'msg' => 'Master log error: ' . $err];
    }
    $stmt->close();
    $m->close();
    return ['ok' => true];
}

// ============================================================
//  MAIN ONBOARDING ORCHESTRATOR
// ============================================================
function onboardSchool(array $data): array {
    $log     = [];
    $subdomain = strtolower(preg_replace('/[^a-z0-9]/', '', $data['subdomain']));
    $dbName    = DB_PREFIX . $subdomain;

    $keys = [
        'learner' => generateKey('LRN'),
        'teacher' => generateKey('TCH'),
        'parent'  => generateKey('PAR'),
        'admin'   => generateKey('ADM'),
    ];

    // Step 1 — Create Database
    $log[] = ['step' => 'Database Creation', 'status' => 'running'];
    $r = createDatabase($dbName);
    if (!$r['ok']) return ['ok' => false, 'step' => 'Database Creation', 'msg' => $r['msg'], 'log' => $log];
    $log[count($log)-1]['status'] = 'done';

    // Step 2 — Run SQL Template
    $log[] = ['step' => 'SQL Template', 'status' => 'running'];
    $r = runTemplate(
        $dbName,
        $data['school_name'],
        $data['admin_email'],
        $data['admin_password'],
        $data['admin_first_name'],
        $data['admin_last_name'],
        $keys
    );
    if (!$r['ok']) return ['ok' => false, 'step' => 'SQL Template', 'msg' => $r['msg'], 'log' => $log];
    $log[count($log)-1]['status'] = 'done';

    // Step 3 — Create Subdomain
    $log[] = ['step' => 'Subdomain Creation', 'status' => 'running'];
    $r = createSubdomain($subdomain);
    if (!$r['ok']) return ['ok' => false, 'step' => 'Subdomain Creation', 'msg' => $r['msg'], 'log' => $log];
    $log[count($log)-1]['status'] = 'done';

    // Step 4 — Send Welcome Email
    $log[] = ['step' => 'Welcome Email', 'status' => 'running'];
    $adminFullName = $data['admin_first_name'] . ' ' . $data['admin_last_name'];
    $r = sendWelcomeEmail(
        $data['admin_email'],
        $adminFullName,
        $data['school_name'],
        $subdomain,
        $data['admin_password'],
        $keys
    );
    if (!$r['ok']) return ['ok' => false, 'step' => 'Welcome Email', 'msg' => $r['msg'], 'log' => $log];
    $log[count($log)-1]['status'] = 'done';

    // Step 5 — Log in Master DB
    $log[] = ['step' => 'Master Log', 'status' => 'running'];
    $r = logSchoolInMaster($data['school_name'], $subdomain, $dbName, $adminFullName, $data['admin_email'], $keys);
    if (!$r['ok']) return ['ok' => false, 'step' => 'Master Log', 'msg' => $r['msg'], 'log' => $log];
    $log[count($log)-1]['status'] = 'done';

    return [
        'ok'        => true,
        'log'       => $log,
        'subdomain' => $subdomain,
        'url'       => 'https://' . $subdomain . '.' . MAIN_DOMAIN,
        'keys'      => $keys,
    ];
}

// ============================================================
//  AUTH HANDLERS
// ============================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['sa_login'])) {
    if ($_POST['sa_password'] === SA_PASSWORD) {
        $_SESSION['sa_auth'] = true;
    } else {
        $login_error = 'Incorrect password. Try again.';
    }
}
if (isset($_POST['sa_logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}
$authed = !empty($_SESSION['sa_auth']);

// ============================================================
//  PROCESS FORM SUBMISSION
// ============================================================
$result = null;
if ($authed && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['create_school'])) {
    $required = ['school_name','subdomain','admin_first_name','admin_last_name','admin_email','admin_password'];
    $missing  = array_filter($required, fn($f) => empty(trim($_POST[$f] ?? '')));
    if ($missing) {
        $result = ['ok' => false, 'step' => 'Validation', 'msg' => 'Missing fields: ' . implode(', ', $missing)];
    } else {
        $result = onboardSchool([
            'school_name'      => trim($_POST['school_name']),
            'subdomain'        => trim($_POST['subdomain']),
            'admin_first_name' => trim($_POST['admin_first_name']),
            'admin_last_name'  => trim($_POST['admin_last_name']),
            'admin_email'      => trim($_POST['admin_email']),
            'admin_password'   => trim($_POST['admin_password']),
        ]);
    }
}

// ============================================================
//  FETCH SCHOOLS FOR DASHBOARD
// ============================================================
$schools = [];
if ($authed) {
    try {
        $m = getMasterDB();
        $r = $m->query("SELECT * FROM schools ORDER BY created_at DESC");
        while ($row = $r->fetch_assoc()) $schools[] = $row;
        $m->close();
    } catch (Exception $e) {
        $schools = [];
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iSkool — School Onboarding</title>
<style>
  :root {
    --bg:      #0d1117;
    --surface: #161b22;
    --surface2:#21262d;
    --border:  #30363d;
    --text:    #e6edf3;
    --muted:   #8b949e;
    --teal:    #39d5c1;
    --red:     #f85149;
    --green:   #3fb950;
    --orange:  #d29922;
    --radius:  8px;
    --font:    -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); min-height:100vh; font-size:14px; }

  .topbar {
    background:var(--surface); border-bottom:1px solid var(--border);
    padding:14px 32px; display:flex; align-items:center; justify-content:space-between;
  }
  .topbar-brand { font-size:20px; font-weight:700; }
  .topbar-brand span { color:var(--teal); }
  .topbar-right { display:flex; align-items:center; gap:12px; }
  .badge { background:rgba(57,213,193,0.1); border:1px solid rgba(57,213,193,0.3);
           color:var(--teal); font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; letter-spacing:1px; }

  .btn {
    padding:8px 16px; border-radius:var(--radius); border:1px solid var(--border);
    background:var(--surface2); color:var(--text); font-size:13px; font-weight:600;
    cursor:pointer; transition:all 0.2s; font-family:var(--font);
  }
  .btn:hover { background:var(--border); }
  .btn-teal { background:var(--teal); color:#0d1117; border-color:var(--teal); }
  .btn-teal:hover { opacity:0.9; }
  .btn-danger { background:rgba(248,81,73,0.1); color:var(--red); border-color:rgba(248,81,73,0.3); }

  .wrap { max-width:1100px; margin:0 auto; padding:32px 24px; }

  .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:32px; }
  .stat-card {
    background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px;
  }
  .stat-label { font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
  .stat-value { font-size:28px; font-weight:700; color:var(--teal); }

  .section { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:24px; overflow:hidden; }
  .section-header { padding:16px 24px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
  .section-title { font-size:14px; font-weight:600; }
  .section-dot { width:8px; height:8px; border-radius:50%; background:var(--teal); }
  .section-body { padding:24px; }

  .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .form-group { display:flex; flex-direction:column; gap:6px; }
  .form-group.full { grid-column:1/-1; }
  label { font-size:12px; font-weight:600; color:var(--muted); letter-spacing:0.5px; text-transform:uppercase; }
  input[type=text], input[type=email], input[type=password] {
    background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius);
    color:var(--text); padding:10px 14px; font-size:14px; font-family:var(--font);
    transition:border-color 0.2s; width:100%;
  }
  input:focus { outline:none; border-color:var(--teal); }
  .hint { font-size:11px; color:var(--muted); margin-top:2px; }

  .alert { padding:14px 18px; border-radius:var(--radius); margin-bottom:20px; font-size:13px; line-height:1.6; }
  .alert-success { background:rgba(63,185,80,0.08); border:1px solid rgba(63,185,80,0.3); color:var(--green); }
  .alert-error   { background:rgba(248,81,73,0.08); border:1px solid rgba(248,81,73,0.3); color:var(--red); }

  .step-list { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
  .step-item { display:flex; align-items:center; gap:8px; font-size:13px; }
  .step-icon { font-size:14px; }

  table { width:100%; border-collapse:collapse; }
  th { font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--muted);
       padding:10px 16px; text-align:left; border-bottom:1px solid var(--border); }
  td { padding:12px 16px; border-bottom:1px solid var(--border); font-size:13px; color:var(--text); vertical-align:middle; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:var(--surface2); }

  .tag { display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:600; }
  .tag-pilot  { background:rgba(57,213,193,0.1); color:var(--teal); }
  .tag-active { background:rgba(63,185,80,0.1);  color:var(--green); }
  .tag-suspended { background:rgba(248,81,73,0.1); color:var(--red); }

  .mono { font-family:monospace; font-size:12px; background:var(--surface2); padding:2px 8px; border-radius:4px; }

  /* LOGIN SCREEN */
  .login-wrap { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
  .login-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:40px; width:100%; max-width:380px; }
  .login-logo { text-align:center; margin-bottom:32px; }
  .login-logo h1 { font-size:28px; font-weight:700; }
  .login-logo h1 span { color:var(--teal); }
  .login-logo p { font-size:12px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; margin-top:6px; }
  .login-error { background:rgba(248,81,73,0.08); border:1px solid rgba(248,81,73,0.3); color:var(--red);
                 padding:10px 14px; border-radius:var(--radius); font-size:13px; margin-bottom:16px; }

  .url-preview { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius);
                 padding:10px 14px; font-size:13px; color:var(--muted); margin-top:4px; }
  .url-preview span { color:var(--teal); font-weight:600; }

  @media(max-width:700px) {
    .form-grid { grid-template-columns:1fr; }
    .stats-row { grid-template-columns:1fr 1fr; }
    .wrap { padding:16px; }
  }
</style>
</head>
<body>

<?php if (!$authed): ?>
<!-- ═══════════════════ LOGIN ═══════════════════ -->
<div class="login-wrap">
  <div class="login-card">
    <div class="login-logo">
      <h1>i<span>Skool</span></h1>
      <p>Superadmin Panel</p>
    </div>
    <?php if (!empty($login_error)): ?>
      <div class="login-error"><?= htmlspecialchars($login_error) ?></div>
    <?php endif; ?>
    <form method="POST">
      <div class="form-group" style="margin-bottom:16px;">
        <label>Panel Password</label>
        <input type="password" name="sa_password" placeholder="Enter password" autofocus>
      </div>
      <button type="submit" name="sa_login" class="btn btn-teal" style="width:100%;padding:12px;">
        Sign In
      </button>
    </form>
  </div>
</div>

<?php else: ?>
<!-- ═══════════════════ DASHBOARD ═══════════════════ -->

<div class="topbar">
  <div class="topbar-brand">i<span>Skool</span> <span style="font-size:13px;color:var(--muted);font-weight:400;">/ Superadmin</span></div>
  <div class="topbar-right">
    <span class="badge">PRIVATE PANEL</span>
    <form method="POST" style="margin:0;">
      <button type="submit" name="sa_logout" class="btn btn-danger">Sign Out</button>
    </form>
  </div>
</div>

<div class="wrap">

  <!-- STATS -->
  <?php
    $total    = count($schools);
    $pilots   = count(array_filter($schools, fn($s) => $s['status'] === 'pilot'));
    $active   = count(array_filter($schools, fn($s) => $s['status'] === 'active'));
    $thisMonth = count(array_filter($schools, fn($s) => date('Y-m', strtotime($s['created_at'])) === date('Y-m')));
  ?>
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-label">Total Schools</div>
      <div class="stat-value"><?= $total ?></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active</div>
      <div class="stat-value" style="color:var(--green)"><?= $active ?></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pilot</div>
      <div class="stat-value" style="color:var(--orange)"><?= $pilots ?></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Month</div>
      <div class="stat-value"><?= $thisMonth ?></div>
    </div>
  </div>

  <!-- RESULT MESSAGE -->
  <?php if ($result !== null): ?>
    <?php if ($result['ok']): ?>
      <div class="alert alert-success">
        <strong>✅ School onboarded successfully!</strong><br>
        URL: <a href="<?= $result['url'] ?>" target="_blank" style="color:var(--teal)"><?= $result['url'] ?></a><br>
        Welcome email sent to the school admin. ✉️
        <div class="step-list">
          <?php foreach ($result['log'] as $step): ?>
            <div class="step-item">
              <span class="step-icon">✅</span>
              <?= htmlspecialchars($step['step']) ?>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    <?php else: ?>
      <div class="alert alert-error">
        <strong>❌ Failed at: <?= htmlspecialchars($result['step']) ?></strong><br>
        <?= htmlspecialchars($result['msg']) ?>
      </div>
    <?php endif; ?>
  <?php endif; ?>

  <!-- ONBOARDING FORM -->
  <div class="section">
    <div class="section-header">
      <span class="section-dot"></span>
      <span class="section-title">Onboard New School</span>
    </div>
    <div class="section-body">
      <form method="POST">
        <div class="form-grid">

          <div class="form-group full">
            <label>School Name</label>
            <input type="text" name="school_name" placeholder="e.g. Curro Barlow Park High School"
                   value="<?= htmlspecialchars($_POST['school_name'] ?? '') ?>">
          </div>

          <div class="form-group">
            <label>Subdomain</label>
            <input type="text" name="subdomain" id="subdomain_input"
                   placeholder="e.g. curro"
                   value="<?= htmlspecialchars($_POST['subdomain'] ?? '') ?>"
                   oninput="updatePreview(this.value)">
            <div class="hint">Lowercase letters and numbers only. No spaces.</div>
            <div class="url-preview" id="url_preview">
              <span id="preview_text">yourschool</span>.iskool.online
            </div>
          </div>

          <div class="form-group">
            <label>Admin First Name</label>
            <input type="text" name="admin_first_name" placeholder="e.g. Sarah"
                   value="<?= htmlspecialchars($_POST['admin_first_name'] ?? '') ?>">
          </div>

          <div class="form-group">
            <label>Admin Last Name</label>
            <input type="text" name="admin_last_name" placeholder="e.g. Johnson"
                   value="<?= htmlspecialchars($_POST['admin_last_name'] ?? '') ?>">
          </div>

          <div class="form-group">
            <label>Admin Email</label>
            <input type="email" name="admin_email" placeholder="e.g. admin@school.co.za"
                   value="<?= htmlspecialchars($_POST['admin_email'] ?? '') ?>">
          </div>

          <div class="form-group">
            <label>Temporary Password</label>
            <input type="text" name="admin_password" placeholder="e.g. iSkool@2026"
                   value="<?= htmlspecialchars($_POST['admin_password'] ?? '') ?>">
            <div class="hint">Admin can change this after first login.</div>
          </div>

        </div>

        <div style="margin-top:24px;display:flex;align-items:center;gap:12px;">
          <button type="submit" name="create_school" class="btn btn-teal" style="padding:12px 32px;font-size:14px;">
            🚀 Create School
          </button>
          <span style="font-size:12px;color:var(--muted);">
            This will create the database, subdomain, and send the welcome email automatically.
          </span>
        </div>
      </form>
    </div>
  </div>

  <!-- SCHOOLS TABLE -->
  <div class="section">
    <div class="section-header">
      <span class="section-dot" style="background:var(--green)"></span>
      <span class="section-title">All Schools (<?= $total ?>)</span>
    </div>
    <?php if (empty($schools)): ?>
      <div style="padding:40px;text-align:center;color:var(--muted);">
        No schools onboarded yet. Use the form above to add your first school.
      </div>
    <?php else: ?>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>School</th>
              <th>URL</th>
              <th>Admin</th>
              <th>Status</th>
              <th>Pilot Ends</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($schools as $school): ?>
            <tr>
              <td><strong><?= htmlspecialchars($school['school_name']) ?></strong></td>
              <td>
                <a href="https://<?= $school['subdomain'] ?>.iskool.online" target="_blank"
                   style="color:var(--teal);text-decoration:none;">
                  <?= $school['subdomain'] ?>.iskool.online
                </a>
              </td>
              <td>
                <?= htmlspecialchars($school['admin_name']) ?><br>
                <span style="color:var(--muted);font-size:12px;"><?= htmlspecialchars($school['admin_email']) ?></span>
              </td>
              <td>
                <span class="tag tag-<?= $school['status'] ?>">
                  <?= strtoupper($school['status']) ?>
                </span>
              </td>
              <td><?= $school['pilot_end'] ? date('d M Y', strtotime($school['pilot_end'])) : '—' ?></td>
              <td style="color:var(--muted);"><?= date('d M Y', strtotime($school['created_at'])) ?></td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </div>

</div>

<script>
function updatePreview(val) {
  const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '');
  document.getElementById('preview_text').textContent = clean || 'yourschool';
}
// Init on load
const si = document.getElementById('subdomain_input');
if (si && si.value) updatePreview(si.value);
</script>

<?php endif; ?>
</body>
</html>
