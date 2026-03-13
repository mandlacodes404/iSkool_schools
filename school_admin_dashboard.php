<?php
/**
 * iSkool — School Dashboard (school_dashboard.php)
 * Role: school_admin
 * The principal's war room — live school data, no iframes.
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');
session_start();
require_once 'config.php';

// ── Gate: school_admin or admin only ──
if (!isset($_SESSION['email']) || !in_array($_SESSION['role'], ['school_admin', 'admin'])) {
    header("Location: index.php");
    exit();
}

$adminEmail = $_SESSION['email'];

// ── Admin profile ──
$adminName     = $_SESSION['name'] ?? 'Admin';
$adminSurname  = '';
$adminProfile  = '';
$adminInitials = 'SA';

$stmt = $conn->prepare("SELECT name, surname, profile_picture, title FROM users WHERE email = ?");
$stmt->bind_param("s", $adminEmail);
$stmt->execute();
if ($row = $stmt->get_result()->fetch_assoc()) {
    $adminName    = $row['name'] ?: $adminName;
    $adminSurname = $row['surname'] ?: '';
    $adminProfile = $row['profile_picture'] ?: '';
    $fI = !empty($adminName)    ? strtoupper(substr(trim($adminName), 0, 1))    : '';
    $lI = !empty($adminSurname) ? strtoupper(substr(trim($adminSurname), 0, 1)) : '';
    $adminInitials = ($fI . $lI) ?: 'SA';
}
$stmt->close();
$adminFullName = trim($adminName . ' ' . $adminSurname);

// ── School info ──
$schoolName = 'My School';
$res = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($row = $res->fetch_assoc()) $schoolName = $row['setting_value'];
$schoolLogo = 'uploads/schools/default_school.png';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>School Dashboard — <?= htmlspecialchars($schoolName) ?></title>
    <link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        /* ══════════════════════════════════════
           ROOT & RESET
        ══════════════════════════════════════ */
        :root {
            --bg:          #0d1117;
            --surface:     #161b22;
            --surface2:    #1c2128;
            --border:      rgba(255,255,255,0.07);
            --border-hover:rgba(255,255,255,0.13);
            --text:        #e2e8f0;
            --text-muted:  #8b949e;
            --text-dim:    #4a5568;
            --teal:        #4fd1c5;
            --teal-dim:    rgba(79,209,197,0.1);
            --teal-border: rgba(79,209,197,0.3);
            --green:       #22c55e;
            --orange:      #f59e0b;
            --red:         #f85149;
            --blue:        #4e79a7;
            --pink:        #e15759;
            --purple:      #a78bfa;
            --sidebar-w:   240px;
            --topnav-h:    56px;
            --radius:      12px;
            --radius-lg:   16px;
            --transition:  0.25s ease;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Nunito', sans-serif;
            font-weight: 600;
            background: var(--bg);
            color: var(--text);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        /* ══════════════════════════════════════
           SIDEBAR
        ══════════════════════════════════════ */
        .sd-sidebar {
            width: var(--sidebar-w);
            background: #111318;
            border-right: 1px solid var(--border);
            border-top-right-radius: 20px;
            border-bottom-right-radius: 20px;
            display: flex;
            flex-direction: column;
            padding: 20px 14px;
            position: fixed;
            top: 0; left: -100%;
            height: 100vh;
            z-index: 5000;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: none;
            transition: left var(--transition);
            box-shadow: 4px 0 24px rgba(0,0,0,0.4);
        }
        .sd-sidebar::-webkit-scrollbar { display: none; }
        .sd-sidebar.open { left: 0; }

        .sd-sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .sd-avatar-wrap {
            width: 42px; height: 42px;
            border-radius: 50%;
            border: 2px solid #555;
            overflow: hidden;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            background: #1b1b1b;
            flex-shrink: 0;
        }
        .sd-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .sd-avatar-initials {
            font-size: 14px; font-weight: 800;
            color: #8b949e; text-transform: uppercase;
        }

        .sd-close-btn {
            width: 36px; height: 36px;
            border-radius: 50%;
            background: #000;
            border: 2px solid #333;
            color: #e2e8f0;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        .sd-close-btn:hover { background: #111; }

        .sd-admin-name  { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 2px; }
        .sd-admin-role  { font-size: 11px; color: var(--teal); letter-spacing: 1px; text-transform: uppercase; font-weight: 700; margin-bottom: 20px; }

        /* Role badge */
        .sd-role-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            background: var(--teal-dim);
            border: 1px solid var(--teal-border);
            font-size: 10px;
            font-weight: 800;
            color: var(--teal);
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 22px;
        }
        .sd-role-badge svg { width: 10px; height: 10px; stroke: var(--teal); }

        /* Nav links */
        .sd-nav-label {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--text-dim);
            padding: 0 10px;
            margin-bottom: 6px;
            margin-top: 16px;
        }

        .sd-nav-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 12px;
            border-radius: 10px;
            color: #9ca3af;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.18s ease;
            margin-bottom: 2px;
            background: none;
            width: 100%;
            text-align: left;
            font-family: 'Nunito', sans-serif;
        }
        .sd-nav-link:hover {
            background: rgba(255,255,255,0.04);
            color: #e2e8f0;
            transform: translateX(2px);
        }
        .sd-nav-link.active {
            background: var(--teal-dim);
            border-color: var(--teal-border);
            color: var(--teal);
        }
        .sd-nav-link svg { width: 16px; height: 16px; stroke: currentColor; flex-shrink: 0; }

        .sd-sidebar-footer {
            margin-top: auto;
            padding-top: 20px;
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--text-dim);
            text-align: center;
            letter-spacing: 1px;
        }

        /* ══════════════════════════════════════
           OVERLAY
        ══════════════════════════════════════ */
        #sdOverlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(4px);
            z-index: 4999;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--transition);
        }
        #sdOverlay.show { opacity: 1; pointer-events: all; }

        /* ══════════════════════════════════════
           MAIN CONTENT
        ══════════════════════════════════════ */
        .sd-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            margin-left: 0;
        }

        /* ══════════════════════════════════════
           TOP NAV
        ══════════════════════════════════════ */
        .sd-topnav {
            height: var(--topnav-h);
            background: #111318;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 20px;
            gap: 12px;
            flex-shrink: 0;
        }

        .sd-hamburger {
            width: 36px; height: 36px;
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 8px;
            color: var(--text);
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .sd-hamburger:hover { background: #30363d; }
        .sd-hamburger svg { width: 18px; height: 18px; stroke: currentColor; }

        .sd-topnav-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            justify-content: center;
        }
        .sd-topnav-brand img {
            width: 32px; height: 32px;
            border-radius: 8px;
            object-fit: cover;
            border: 2px solid #30363d;
        }
        .sd-topnav-school {
            font-size: 15px;
            font-weight: 800;
            color: var(--text);
        }

        /* Live clock */
        .sd-topnav-right {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }

        .sd-clock {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.5px;
            display: none;
        }

        /* Top nav avatar */
        .sd-topnav-avatar {
            width: 32px; height: 32px;
            border-radius: 50%;
            border: 2px solid #30363d;
            overflow: hidden;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            background: #21262d;
            transition: border-color 0.2s;
            position: relative;
        }
        .sd-topnav-avatar:hover { border-color: var(--teal); }
        .sd-topnav-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sd-topnav-avatar .sd-av-init { font-size: 11px; font-weight: 800; color: #8b949e; }

        /* Avatar dropdown */
        .sd-av-dropdown {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: var(--surface);
            border: 1px solid #30363d;
            border-radius: 10px;
            min-width: 200px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 6000;
            overflow: hidden;
            display: none;
        }
        .sd-av-dropdown.open { display: block; }
        .sd-av-dropdown-header { padding: 12px 16px; border-bottom: 1px solid #21262d; }
        .sd-av-dropdown-name  { font-size: 13px; font-weight: 800; color: var(--text); }
        .sd-av-dropdown-role  { font-size: 11px; color: var(--teal); margin-top: 2px; }
        .sd-av-item {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 16px;
            font-size: 13px; font-weight: 600;
            color: #c9d1d9; cursor: pointer;
            transition: background 0.15s;
            border: none; background: none; width: 100%; text-align: left;
            font-family: 'Nunito', sans-serif;
        }
        .sd-av-item:hover { background: #21262d; color: var(--text); }
        .sd-av-item.danger { color: var(--red); }
        .sd-av-item.danger:hover { background: rgba(248,81,73,0.08); }
        .sd-av-item svg { width: 15px; height: 15px; stroke: currentColor; }

        /* ══════════════════════════════════════
           CONTENT AREA
        ══════════════════════════════════════ */
        #sd-content {
            flex: 1;
            overflow-y: auto;
            background: var(--bg);
        }
        #sd-content::-webkit-scrollbar { width: 4px; }
        #sd-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* ══════════════════════════════════════
           OVERVIEW — WAR ROOM
        ══════════════════════════════════════ */
        .sd-overview {
            padding: 28px 28px 60px;
            max-width: 1400px;
        }

        /* Page header */
        .sd-page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 24px;
        }
        .sd-page-title {
            font-size: 22px;
            font-weight: 900;
            color: var(--text);
            margin-bottom: 4px;
        }
        .sd-page-sub {
            font-size: 13px;
            color: var(--text-muted);
        }
        .sd-year-badge {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
            padding: 5px 14px;
            border-radius: 20px;
            background: var(--teal-dim);
            border: 1px solid var(--teal-border);
            color: var(--teal);
        }

        /* ── KPI ROW ── */
        .sd-kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 20px;
        }

        .sd-kpi-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 18px 20px;
            position: relative;
            overflow: hidden;
            transition: border-color 0.2s, transform 0.2s;
            cursor: default;
        }
        .sd-kpi-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-2px);
        }
        .sd-kpi-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
        }
        .sd-kpi-card.c-teal::before   { background: var(--teal); }
        .sd-kpi-card.c-green::before  { background: var(--green); }
        .sd-kpi-card.c-blue::before   { background: var(--blue); }
        .sd-kpi-card.c-orange::before { background: var(--orange); }
        .sd-kpi-card.c-purple::before { background: var(--purple); }

        /* Subtle glow bg on hover */
        .sd-kpi-card.c-teal:hover   { box-shadow: 0 4px 20px rgba(79,209,197,0.06); }
        .sd-kpi-card.c-green:hover  { box-shadow: 0 4px 20px rgba(34,197,94,0.06); }
        .sd-kpi-card.c-blue:hover   { box-shadow: 0 4px 20px rgba(78,121,167,0.06); }
        .sd-kpi-card.c-orange:hover { box-shadow: 0 4px 20px rgba(245,158,11,0.06); }

        .sd-kpi-icon {
            width: 34px; height: 34px;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 12px;
        }
        .sd-kpi-icon svg { width: 18px; height: 18px; }
        .c-teal  .sd-kpi-icon { background: rgba(79,209,197,0.1);  }
        .c-green .sd-kpi-icon { background: rgba(34,197,94,0.1);   }
        .c-blue  .sd-kpi-icon { background: rgba(78,121,167,0.1);  }
        .c-orange .sd-kpi-icon { background: rgba(245,158,11,0.1); }
        .c-purple .sd-kpi-icon { background: rgba(167,139,250,0.1);}
        .c-teal  .sd-kpi-icon svg { stroke: var(--teal);   }
        .c-green .sd-kpi-icon svg { stroke: var(--green);  }
        .c-blue  .sd-kpi-icon svg { stroke: var(--blue);   }
        .c-orange .sd-kpi-icon svg { stroke: var(--orange);}
        .c-purple .sd-kpi-icon svg { stroke: var(--purple);}

        .sd-kpi-label {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 8px;
        }
        .sd-kpi-value {
            font-size: 30px;
            font-weight: 900;
            line-height: 1;
            margin-bottom: 6px;
        }
        .c-teal  .sd-kpi-value { color: var(--teal);   }
        .c-green .sd-kpi-value { color: var(--green);  }
        .c-blue  .sd-kpi-value { color: var(--blue);   }
        .c-orange .sd-kpi-value { color: var(--orange);}
        .c-purple .sd-kpi-value { color: var(--purple);}

        .sd-kpi-sub {
            font-size: 11px;
            color: var(--text-muted);
        }

        /* ── ACTIVITY PULSE ROW ── */
        .sd-pulse-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 20px;
        }

        .sd-pulse-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px 18px;
            display: flex;
            align-items: center;
            gap: 14px;
            transition: border-color 0.2s;
        }
        .sd-pulse-card:hover { border-color: var(--border-hover); }

        .sd-pulse-icon {
            width: 38px; height: 38px;
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .sd-pulse-icon svg { width: 18px; height: 18px; }

        .sd-pulse-num {
            font-size: 22px;
            font-weight: 900;
            line-height: 1;
        }
        .sd-pulse-label {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        /* ── TWO COLUMN LAYOUT ── */
        .sd-row {
            display: grid;
            gap: 16px;
            margin-bottom: 16px;
        }
        .sd-row.col-2   { grid-template-columns: 1fr 1fr; }
        .sd-row.col-3-1 { grid-template-columns: 3fr 2fr; }
        .sd-row.col-1   { grid-template-columns: 1fr; }

        /* ── CHART CARDS ── */
        .sd-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            transition: border-color 0.2s;
        }
        .sd-card:hover { border-color: var(--border-hover); }

        .sd-card-title {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sd-card-title-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--teal);
        }

        .sd-chart-wrap {
            position: relative;
            height: 220px;
        }
        .sd-chart-wrap.tall { height: 260px; }

        .sd-no-data {
            display: flex; align-items: center; justify-content: center;
            height: 100%;
            color: var(--text-dim);
            font-size: 13px;
            font-style: italic;
        }

        /* ── CLASS PERFORMANCE LIST ── */
        .sd-class-perf-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 6px;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.04);
            transition: background 0.15s;
        }
        .sd-class-perf-item:hover { background: rgba(255,255,255,0.05); }

        .sd-class-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .sd-class-dot.green  { background: var(--green); }
        .sd-class-dot.orange { background: var(--orange); }
        .sd-class-dot.red    { background: var(--red); }
        .sd-class-dot.gray   { background: var(--text-dim); }

        .sd-class-name {
            flex: 1;
            font-size: 13px;
            font-weight: 700;
            color: var(--text);
        }
        .sd-class-learners {
            font-size: 11px;
            color: var(--text-muted);
        }

        .sd-class-avg {
            font-size: 13px;
            font-weight: 800;
            padding: 3px 10px;
            border-radius: 20px;
        }
        .sd-class-avg.green  { background: rgba(34,197,94,0.1);  color: var(--green);  }
        .sd-class-avg.orange { background: rgba(245,158,11,0.1); color: var(--orange); }
        .sd-class-avg.red    { background: rgba(248,81,73,0.1);  color: var(--red);    }
        .sd-class-avg.gray   { background: rgba(255,255,255,0.06); color: var(--text-muted); }

        /* ── TEACHER ACTIVITY ── */
        .sd-teacher-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 6px;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.04);
            transition: background 0.15s;
        }
        .sd-teacher-item:hover { background: rgba(255,255,255,0.05); }

        .sd-teacher-avatar-sm {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: #1b1b1b;
            border: 2px solid #333;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 800;
            color: var(--text-muted);
            flex-shrink: 0;
            text-transform: uppercase;
        }
        .sd-teacher-name { font-size: 13px; font-weight: 700; color: var(--text); }
        .sd-teacher-meta { font-size: 11px; color: var(--text-muted); }

        .sd-teacher-score {
            font-size: 13px;
            font-weight: 800;
            color: var(--teal);
            flex-shrink: 0;
        }

        /* ── ACTIVITY FEED ── */
        .sd-feed-item {
            display: flex;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
        }
        .sd-feed-item:last-child { border-bottom: none; }

        .sd-feed-icon {
            width: 30px; height: 30px;
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .sd-feed-icon svg { width: 14px; height: 14px; }
        .sd-feed-icon.quiz         { background: rgba(79,209,197,0.1);  }
        .sd-feed-icon.quiz svg     { stroke: var(--teal);   }
        .sd-feed-icon.announcement { background: rgba(245,158,11,0.1); }
        .sd-feed-icon.announcement svg { stroke: var(--orange); }
        .sd-feed-icon.assignment   { background: rgba(78,121,167,0.1); }
        .sd-feed-icon.assignment svg { stroke: var(--blue);  }

        .sd-feed-text {
            flex: 1;
            font-size: 12px;
            font-weight: 600;
            color: #c9d1d9;
            line-height: 1.5;
        }
        .sd-feed-time {
            font-size: 11px;
            color: var(--text-dim);
            flex-shrink: 0;
            margin-top: 2px;
        }
        .sd-feed-class {
            font-size: 10px;
            font-weight: 800;
            color: var(--text-muted);
            margin-top: 2px;
            letter-spacing: 0.5px;
        }

        /* ── ATTENTION ALERT ── */
        .sd-alert {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 10px;
            background: rgba(248,81,73,0.06);
            border: 1px solid rgba(248,81,73,0.2);
            margin-bottom: 8px;
        }
        .sd-alert svg { width: 16px; height: 16px; stroke: var(--red); flex-shrink: 0; }
        .sd-alert-text { font-size: 13px; color: #e2e8f0; }
        .sd-alert-avg  { font-size: 13px; font-weight: 800; color: var(--red); flex-shrink: 0; }

        /* ── SKELETON ── */
        .sd-skeleton {
            background: linear-gradient(90deg, #161b22 25%, #1c2330 50%, #161b22 75%);
            background-size: 200% 100%;
            animation: sd-shimmer 1.4s infinite;
            border-radius: 8px;
        }
        @keyframes sd-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        /* ── LOADER ── */
        #sdLoader {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.65);
            backdrop-filter: blur(5px);
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: var(--text);
            font-size: 15px;
            gap: 16px;
        }
        .sd-spinner {
            width: 48px; height: 48px;
            border: 4px solid rgba(255,255,255,0.1);
            border-top-color: var(--teal);
            border-radius: 50%;
            animation: sd-spin 0.9s linear infinite;
        }
        @keyframes sd-spin { to { transform: rotate(360deg); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
            .sd-kpi-row   { grid-template-columns: repeat(2, 1fr); }
            .sd-pulse-row { grid-template-columns: repeat(2, 1fr); }
            .sd-row.col-2, .sd-row.col-3-1 { grid-template-columns: 1fr; }
            .sd-clock { display: none !important; }
        }
        @media (max-width: 600px) {
            .sd-kpi-row   { grid-template-columns: repeat(2, 1fr); }
            .sd-pulse-row { grid-template-columns: repeat(2, 1fr); }
            .sd-overview  { padding: 16px 14px 80px; }
            .sd-topnav-school { display: none; }
        }

        /* ── EMPTY / PLACEHOLDER SECTIONS ── */
        .sd-coming-soon {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 20px;
            text-align: center;
            color: var(--text-dim);
            gap: 12px;
        }
        .sd-coming-soon svg { opacity: 0.3; }
        .sd-coming-soon h3  { font-size: 16px; color: var(--text-muted); }
        .sd-coming-soon p   { font-size: 13px; max-width: 300px; }
    </style>
</head>
<body>

<!-- ═══════════════════════════════════
     OVERLAY
═══════════════════════════════════ -->
<div id="sdOverlay" onclick="closeSidebar()"></div>

<!-- ═══════════════════════════════════
     SIDEBAR
═══════════════════════════════════ -->
<aside class="sd-sidebar" id="sdSidebar">

    <div class="sd-sidebar-header">
        <div class="sd-avatar-wrap">
            <?php if (!empty($adminProfile) && $adminProfile !== 'default.png'): ?>
                <img src="uploads/teachers/<?= htmlspecialchars($adminProfile) ?>" alt="Admin">
            <?php else: ?>
                <span class="sd-avatar-initials"><?= htmlspecialchars($adminInitials) ?></span>
            <?php endif; ?>
        </div>
        <button class="sd-close-btn" onclick="closeSidebar()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="7" y1="3" x2="7" y2="21"/>
            </svg>
        </button>
    </div>

    <div class="sd-admin-name"><?= htmlspecialchars($adminFullName) ?></div>
    <div class="sd-role-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        School Admin
    </div>

    <div class="sd-nav-label">Main</div>

    <button class="sd-nav-link active" id="nav-overview" onclick="loadSection('overview')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        Overview
    </button>

    <button class="sd-nav-link" id="nav-learners" onclick="loadSection('learners')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Learners
    </button>

    <button class="sd-nav-link" id="nav-teachers" onclick="loadSection('teachers')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        Teachers
    </button>

    <button class="sd-nav-link" id="nav-classes" onclick="loadSection('classes')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Classes
    </button>

    <div class="sd-nav-label">Content</div>

    <button class="sd-nav-link" id="nav-content" onclick="loadSection('content')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
        </svg>
        Content
    </button>

    <button class="sd-nav-link" id="nav-analytics" onclick="loadSection('analytics')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
            <path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
        Analytics
    </button>

    <div class="sd-nav-label">System</div>

    <button class="sd-nav-link" id="nav-announcements" onclick="loadSection('announcements')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        Announcements
    </button>

    <button class="sd-nav-link" id="nav-settings" onclick="loadSection('settings')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Settings
    </button>

    <div class="sd-sidebar-footer">iSkool v1.0.0</div>
</aside>

<!-- ═══════════════════════════════════
     MAIN
═══════════════════════════════════ -->
<div class="sd-main">

    <!-- TOP NAV -->
    <header class="sd-topnav">
        <button class="sd-hamburger" onclick="openSidebar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
        </button>

        <div class="sd-topnav-brand">
            <img src="<?= htmlspecialchars($schoolLogo) ?>" alt="Logo">
            <span class="sd-topnav-school"><?= htmlspecialchars($schoolName) ?></span>
        </div>

        <div class="sd-topnav-right">
            <span class="sd-clock" id="sdClock"></span>

            <div style="position:relative;">
                <div class="sd-topnav-avatar" onclick="toggleAvatarDrop()" id="sdTopAvatar">
                    <?php if (!empty($adminProfile) && $adminProfile !== 'default.png'): ?>
                        <img src="uploads/teachers/<?= htmlspecialchars($adminProfile) ?>" alt="Admin">
                    <?php else: ?>
                        <span class="sd-av-init"><?= htmlspecialchars($adminInitials) ?></span>
                    <?php endif; ?>
                </div>
                <div class="sd-av-dropdown" id="sdAvatarDrop">
                    <div class="sd-av-dropdown-header">
                        <div class="sd-av-dropdown-name"><?= htmlspecialchars($adminFullName) ?></div>
                        <div class="sd-av-dropdown-role">School Admin</div>
                    </div>
                    <button class="sd-av-item" onclick="loadSection('settings'); closeAvatarDrop();">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Settings
                    </button>
                    <button class="sd-av-item danger" onclick="window.location.href='logout.php'">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- CONTENT -->
    <div id="sd-content"></div>
</div>

<!-- LOADER -->
<div id="sdLoader">
    <div class="sd-spinner"></div>
    <span>Loading...</span>
</div>

<script>
// ═══════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════
function openSidebar() {
    document.getElementById('sdSidebar').classList.add('open');
    document.getElementById('sdOverlay').classList.add('show');
}
function closeSidebar() {
    document.getElementById('sdSidebar').classList.remove('open');
    document.getElementById('sdOverlay').classList.remove('show');
}

// ═══════════════════════════════════
// AVATAR DROPDOWN
// ═══════════════════════════════════
function toggleAvatarDrop() {
    document.getElementById('sdAvatarDrop').classList.toggle('open');
}
function closeAvatarDrop() {
    document.getElementById('sdAvatarDrop').classList.remove('open');
}
document.addEventListener('click', e => {
    const wrap = document.getElementById('sdTopAvatar')?.closest('[style*="position"]') ||
                 document.getElementById('sdTopAvatar')?.parentElement;
    if (wrap && !wrap.contains(e.target)) closeAvatarDrop();
});

// ═══════════════════════════════════
// LIVE CLOCK
// ═══════════════════════════════════
(function clock() {
    const el = document.getElementById('sdClock');
    if (!el) return;
    el.style.display = 'block';
    function tick() {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
})();

// ═══════════════════════════════════
// NAV ACTIVE STATE
// ═══════════════════════════════════
function setNavActive(section) {
    document.querySelectorAll('.sd-nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('nav-' + section);
    if (el) el.classList.add('active');
}

// ═══════════════════════════════════
// SECTION ROUTER
// ═══════════════════════════════════
window._sdCache = {};

async function loadSection(section) {
    setNavActive(section);
    closeSidebar();

    if (section === 'overview') {
        await loadOverview();
    } else if (section === 'classes') {
        await loadSdClasses();
    } else if (section === 'learners') {
        await loadSdLearners();
    } else {
        renderComingSoon(section);
    }
}

function renderComingSoon(section) {
    document.getElementById('sd-content').innerHTML = `
        <div class="sd-coming-soon">
            <svg viewBox="0 0 24 24" width="56" height="56" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3>${section.charAt(0).toUpperCase() + section.slice(1)}</h3>
            <p>This section is coming soon. The overview war room is live above.</p>
        </div>`;
}

// ═══════════════════════════════════
// OVERVIEW — WAR ROOM
// ═══════════════════════════════════
async function loadOverview() {
    const content = document.getElementById('sd-content');

    if (window._sdCache.overview) {
        renderOverview(window._sdCache.overview);
        return;
    }

    // Skeleton while loading
    content.innerHTML = `
        <div class="sd-overview">
            <div class="sd-page-header">
                <div>
                    <div class="sd-skeleton" style="height:22px;width:180px;margin-bottom:8px;"></div>
                    <div class="sd-skeleton" style="height:13px;width:240px;"></div>
                </div>
                <div class="sd-skeleton" style="height:28px;width:80px;border-radius:20px;"></div>
            </div>
            <div class="sd-kpi-row">
                ${[1,2,3,4].map(() => `
                    <div class="sd-kpi-card" style="background:var(--surface);">
                        <div class="sd-skeleton" style="height:34px;width:34px;border-radius:8px;margin-bottom:12px;"></div>
                        <div class="sd-skeleton" style="height:10px;width:60%;margin-bottom:10px;"></div>
                        <div class="sd-skeleton" style="height:30px;width:50%;margin-bottom:6px;"></div>
                        <div class="sd-skeleton" style="height:10px;width:80%;"></div>
                    </div>`).join('')}
            </div>
            <div class="sd-pulse-row">
                ${[1,2,3,4].map(() => `
                    <div class="sd-pulse-card">
                        <div class="sd-skeleton" style="height:38px;width:38px;border-radius:10px;flex-shrink:0;"></div>
                        <div style="flex:1;">
                            <div class="sd-skeleton" style="height:22px;width:40px;margin-bottom:6px;"></div>
                            <div class="sd-skeleton" style="height:11px;width:80%;"></div>
                        </div>
                    </div>`).join('')}
            </div>
        </div>`;

    try {
        const res  = await fetch('api/school/get_overview.php');
        const data = await res.json();
        window._sdCache.overview = data;
        renderOverview(data);
    } catch (e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load overview data.</p>`;
    }
}

function renderOverview(d) {
    const content = document.getElementById('sd-content');

    function avgColorClass(v) {
        if (v === null || v === undefined) return 'gray';
        if (v >= 60) return 'green';
        if (v >= 40) return 'orange';
        return 'red';
    }

    function timeAgo(dateStr) {
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
        if (diff < 60)   return diff + 's ago';
        if (diff < 3600) return Math.floor(diff/60) + 'm ago';
        if (diff < 86400)return Math.floor(diff/3600) + 'h ago';
        return Math.floor(diff/86400) + 'd ago';
    }

    // ── Feed icons ──
    const feedIcons = {
        quiz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
        announcement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
        assignment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    };

    content.innerHTML = `
    <div class="sd-overview">

        <!-- PAGE HEADER -->
        <div class="sd-page-header">
            <div>
                <div class="sd-page-title">School Overview</div>
                <div class="sd-page-sub">Live snapshot of ${d.year_name || 'Current Year'} — ${new Date().toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long' })}</div>
            </div>
            <div class="sd-year-badge">${d.year_name || 'CURRENT YEAR'}</div>
        </div>

        <!-- KPI CARDS -->
        <div class="sd-kpi-row">
            <div class="sd-kpi-card c-teal">
                <div class="sd-kpi-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div class="sd-kpi-label">Total Learners</div>
                <div class="sd-kpi-value">${d.total_learners}</div>
                <div class="sd-kpi-sub">Enrolled on platform</div>
            </div>
            <div class="sd-kpi-card c-blue">
                <div class="sd-kpi-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="sd-kpi-label">Teachers</div>
                <div class="sd-kpi-value">${d.total_teachers}</div>
                <div class="sd-kpi-sub">Active educators</div>
            </div>
            <div class="sd-kpi-card c-orange">
                <div class="sd-kpi-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div class="sd-kpi-label">Classes</div>
                <div class="sd-kpi-value">${d.total_classes}</div>
                <div class="sd-kpi-sub">Active classrooms</div>
            </div>
            <div class="sd-kpi-card c-green">
                <div class="sd-kpi-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                </div>
                <div class="sd-kpi-label">School Average</div>
                <div class="sd-kpi-value">${d.school_avg !== null ? d.school_avg + '%' : '—'}</div>
                <div class="sd-kpi-sub">Summative assessments</div>
            </div>
        </div>

        <!-- THIS WEEK PULSE -->
        <div class="sd-pulse-row">
            <div class="sd-pulse-card">
                <div class="sd-pulse-icon" style="background:rgba(79,209,197,0.1);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div>
                    <div class="sd-pulse-num" style="color:var(--teal);">${d.this_week.quizzes}</div>
                    <div class="sd-pulse-label">Quizzes this week</div>
                </div>
            </div>
            <div class="sd-pulse-card">
                <div class="sd-pulse-icon" style="background:rgba(78,121,167,0.1);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                    <div class="sd-pulse-num" style="color:var(--blue);">${d.this_week.assignments}</div>
                    <div class="sd-pulse-label">Assignments this week</div>
                </div>
            </div>
            <div class="sd-pulse-card">
                <div class="sd-pulse-icon" style="background:rgba(245,158,11,0.1);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div>
                    <div class="sd-pulse-num" style="color:var(--orange);">${d.this_week.announcements}</div>
                    <div class="sd-pulse-label">Announcements this week</div>
                </div>
            </div>
            <div class="sd-pulse-card">
                <div class="sd-pulse-icon" style="background:rgba(167,139,250,0.1);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div>
                    <div class="sd-pulse-num" style="color:var(--purple);">${d.this_week.resources}</div>
                    <div class="sd-pulse-label">Resources this week</div>
                </div>
            </div>
        </div>

        <!-- ROW: CLASS PERFORMANCE CHART + ACTIVITY FEED -->
        <div class="sd-row col-3-1">
            <div class="sd-card">
                <div class="sd-card-title">
                    <span class="sd-card-title-dot"></span>
                    Class Performance
                </div>
                <div class="sd-chart-wrap">
                    ${d.class_performance.length
                        ? `<canvas id="sd-chart-classes"></canvas>`
                        : `<div class="sd-no-data">No summative assessment data yet</div>`}
                </div>
            </div>
            <div class="sd-card">
                <div class="sd-card-title">
                    <span class="sd-card-title-dot" style="background:var(--orange);"></span>
                    Recent Activity
                </div>
                ${d.recent_activity.length
                    ? d.recent_activity.map(item => `
                        <div class="sd-feed-item">
                            <div class="sd-feed-icon ${item.type}">${feedIcons[item.type] || feedIcons.quiz}</div>
                            <div style="flex:1;">
                                <div class="sd-feed-text">${item.text}</div>
                                <div class="sd-feed-class">${item.class}</div>
                            </div>
                            <div class="sd-feed-time">${timeAgo(item.time)}</div>
                        </div>`).join('')
                    : `<div class="sd-no-data" style="height:180px;">No recent activity</div>`}
            </div>
        </div>

        <!-- ROW: CLASS LIST + ACTIVE TEACHERS -->
        <div class="sd-row col-2">
            <div class="sd-card">
                <div class="sd-card-title">
                    <span class="sd-card-title-dot" style="background:var(--green);"></span>
                    Classes by Average
                </div>
                ${d.class_performance.map(cls => {
                    const col = avgColorClass(cls.avg_pct);
                    return `
                        <div class="sd-class-perf-item">
                            <span class="sd-class-dot ${col}"></span>
                            <span class="sd-class-name">${cls.class_name}</span>
                            <span class="sd-class-learners">${cls.learner_count} learners</span>
                            <span class="sd-class-avg ${col}">${cls.avg_pct !== null ? cls.avg_pct + '%' : '—'}</span>
                        </div>`;
                }).join('') || `<div class="sd-no-data" style="height:120px;">No classes yet</div>`}
            </div>

            <div class="sd-card">
                <div class="sd-card-title">
                    <span class="sd-card-title-dot" style="background:var(--blue);"></span>
                    Most Active Teachers
                </div>
                ${d.active_teachers.map((t, i) => {
                    const initials = (t.name?.[0] || '') + (t.surname?.[0] || '');
                    return `
                        <div class="sd-teacher-item">
                            <div class="sd-teacher-avatar-sm">${initials.toUpperCase()}</div>
                            <div style="flex:1;">
                                <div class="sd-teacher-name">${t.name} ${t.surname}</div>
                                <div class="sd-teacher-meta">${t.quizzes}Q · ${t.assignments}A · ${t.resources}R · ${t.announcements}An</div>
                            </div>
                            <div class="sd-teacher-score">${t.total}</div>
                        </div>`;
                }).join('') || `<div class="sd-no-data" style="height:120px;">No teacher activity yet</div>`}
            </div>
        </div>

        <!-- ROW: CLASSES NEEDING ATTENTION -->
        ${d.classes_need_attention.length ? `
        <div class="sd-row col-1">
            <div class="sd-card">
                <div class="sd-card-title">
                    <span class="sd-card-title-dot" style="background:var(--red);"></span>
                    Classes Needing Attention (Below 50%)
                </div>
                ${d.classes_need_attention.map(cls => `
                    <div class="sd-alert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div class="sd-alert-text" style="flex:1;">${cls.class_name} · ${cls.learner_count} learners</div>
                        <div class="sd-alert-avg">${cls.avg_pct}%</div>
                    </div>`).join('')}
            </div>
        </div>` : ''}

    </div>`;

    // ── Render class performance chart ──
    if (d.class_performance.length) {
        const ctx = document.getElementById('sd-chart-classes')?.getContext('2d');
        if (ctx) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: d.class_performance.map(c => c.class_name),
                    datasets: [{
                        label: 'Average %',
                        data: d.class_performance.map(c => c.avg_pct),
                        backgroundColor: d.class_performance.map(c =>
                            c.avg_pct >= 60 ? 'rgba(34,197,94,0.65)' :
                            c.avg_pct >= 40 ? 'rgba(245,158,11,0.65)' :
                            c.avg_pct !== null ? 'rgba(248,81,73,0.65)' : 'rgba(255,255,255,0.1)'
                        ),
                        borderColor: d.class_performance.map(c =>
                            c.avg_pct >= 60 ? '#22c55e' :
                            c.avg_pct >= 40 ? '#f59e0b' :
                            c.avg_pct !== null ? '#f85149' : 'rgba(255,255,255,0.2)'
                        ),
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: { label: ctx => ` ${ctx.parsed.y !== null ? ctx.parsed.y + '%' : 'No data'}` }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true, max: 100,
                            ticks: { color: '#8b949e', callback: v => v + '%', stepSize: 20 },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        x: {
                            ticks: { color: '#8b949e' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        }
    }
}

// ═══════════════════════════════════
// BOOT
// ═══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadSection('overview');
});
</script>
<script>
// ── INLINE CLASSES SECTION ──
</script>
<script src="assets/js/school/classes.js?v=1.0"></script>
<script src="assets/js/school/learners.js?v=1.0"></script>
</body>
</html>