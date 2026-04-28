<?php
/**
 * iSkool - Login & Registration 
 *
 * Entry point for user authentication and account creation.
 * Features:
 * - Animated splash screen with branded loader
 * - Responsive login and registration forms with role selection
 * - Password visibility toggle
 * - Access key validation for registration
 * - Full-screen processing overlay
 * - PWA support with service worker and push notification subscription
 * - Dynamic school name display from database
 *
 * @package     iSkool
 * @subpackage  Authentication
 * @author      mandlasimphiwe99@gmail.com
 * @copyright   2025 iSkool EdTech. All rights reserved.
 * @license     Proprietary - Unauthorized use prohibited
 * @version     1.0.0
 * @since       2025-12-14
 * @link        https://iskool.online
 */

session_start();

require_once 'config.php'; 
require_once 'check_remember_me.php';     

$errors = [
    'login' => $_SESSION['login_error'] ?? '',
    'register' => $_SESSION['register_error'] ?? ''
];
$activeForm = $_SESSION['active_form'] ?? 'login';
$resetMessage = $_SESSION['reset_message'] ?? '';
$resetError   = $_SESSION['reset_error'] ?? '';

unset($_SESSION['login_error'], $_SESSION['register_error'], $_SESSION['active_form'], $_SESSION['reset_message'], $_SESSION['reset_error']);

function showError($error){
    return !empty($error) ? "<p class='error-message' style='color:red;'>$error</p>" : '';
}

function isActiveForm($formName, $activeForm) {
    return $formName === $activeForm ? 'active' : '';
}

$schoolName = 'My School'; // fallback only (will almost never show)

$result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    $schoolName = trim($row['setting_value']);
    if (empty($schoolName)) {
        $schoolName = 'My School';
    }
}


?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iSkool</title>

<link rel="manifest" href="/manifest.json">

<meta name="theme-color" content="#1a1919">

<link rel="icon" type="image/svg+xml" href="/icon.svg?v=1.2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    
   
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap" rel="stylesheet">
    <style>
    /* --- Animation Styles --- */
    body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #1a1919;
    font-family: 'Inter', 'Nunito', sans-serif;
    color: #E3E3E3;
    overflow-x: hidden;
    min-height: 100vh;
}

body {
    display: flex;
    justify-content: center;
    align-items: center;
}

    /* Glowing Logo Loader */
    #animation-wrapper {
        position: fixed;
        width: 100%;
        height: 100%;
        background: #1a1919; /* CHANGE THIS from #0d1117 */;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.8s ease;
    }

    #loader-logo {
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Update your existing #loader-logo svg style */
#loader-logo svg {
        width: 120px; 
        height: 120px;
        /* Removed logo-spin: only keeping the initial reveal fade */
        animation: reveal 0.8s ease-out forwards;
        transform-origin: center;
    }

@keyframes reveal {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
    }

    /* Branding Styles */
    .branding {
        position: absolute;
        bottom: 60px;
        font-size: 14px;
        color: #888;
        font-family: 'Nunito', sans-serif;
        letter-spacing: 0.5px;
        opacity: 0.7;
        transition: opacity 0.3s ease;
        text-align: center;
        display: flex;
        flex-direction: column;
    }

    .branding:hover {
        opacity: 1;
    }

    .branding span {
        display: block;
    }

    .branding span:nth-child(1) {
        font-size: 14px;
        color: #888;
    }

    .branding span:nth-child(2) {
        font-size: 16px;
        color: #ffffff;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
    }

    /* Mobile adjustments for loader logo and branding */
    @media (max-width: 480px) {
        #loader-logo {
            font-size: 4rem;
        }
        .branding {
            font-size: 13px;
            bottom: 50px;
        }
        .branding span:nth-child(1) {
            font-size: 13px;
        }
        .branding span:nth-child(2) {
            font-size: 15px;
            text-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
        }
    }

    @media (max-width: 360px) {
        #loader-logo {
            font-size: 3rem;
        }
        .branding {
            font-size: 12px;
            bottom: 40px;
        }
        .branding span:nth-child(1) {
            font-size: 12px;
        }
        .branding span:nth-child(2) {
            font-size: 14px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.6);
        }
    }

    

/* ── Desktop two-panel wrapper ── */
.container {
    opacity: 0;
    transition: opacity 1s ease;
    display: flex;
    flex-direction: row;
    width: 100%;
    max-width: 960px;
    min-height: 100vh;
}

.container.show {
    opacity: 1;
    animation: fadeSlideIn 1.2s ease forwards;
}

/* ── Logo + school name above form — desktop only ── */
#form-top-brand {
    display: none;
}

/* ── Left preview panel (desktop only) ── */
.brand-panel {
    display: none; /* hidden on mobile, shown on desktop */
}

/* ── Brand panel intro eyebrow ── */
.bp-intro {
    margin-bottom: 20px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s;
}

.container.show .bp-intro {
    opacity: 1;
    transform: translateY(0);
}

.bp-intro-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: #555;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
}

.bp-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3ecf8e;
    display: inline-block;
    animation: pvPulse 1.8s infinite ease-in-out;
    flex-shrink: 0;
}

/* ── Typewriter intro card ── */
.pv-intro-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
}

.pv-tw-wrap {
    text-align: left;
    width: 100%;
}

.pv-tw-line {
    font-size: 18px;
    font-weight: 600;
    color: #e3e3e3;
    font-family: 'Inter', sans-serif;
    letter-spacing: -0.01em;
    line-height: 1.4;
    min-height: 1.4em;
    white-space: nowrap;
    overflow: hidden;
}

.pv-tw-line2 {
    font-size: 13px;
    font-weight: 400;
    color: #666;
    margin-top: 8px;
    letter-spacing: 0;
}

.pv-tw-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: #3ecf8e;
    margin-left: 2px;
    vertical-align: middle;
    animation: twBlink 0.75s step-end infinite;
}

@keyframes twBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

/* ── Preview animation card styles ── */
.preview-card {
    background: #1e1e1c;
    border-radius: 16px;
    border: 1px solid #2e2e2c;
    padding: 18px 20px;
    opacity: 0;
    transform: translateY(20px) scale(0.98);
    transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 2px 16px rgba(0,0,0,0.3);
    position: absolute;
    width: 100%;
    box-sizing: border-box;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to right, black 65%, transparent 100%);
            mask-image: linear-gradient(to right, black 65%, transparent 100%);
}
.preview-card.pv-visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.preview-card.pv-exit {
    opacity: 0;
    transform: translateY(-14px) scale(0.98);
    transition: opacity 0.4s ease, transform 0.4s ease;
}

/* preview-wrap is the stage for one card at a time */
.preview-wrap {
    position: relative;
    width: 100%;
    min-height: 200px;
}

.pv-header { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.pv-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pv-icon.green  { background: #0e2e22; }
.pv-icon.orange { background: #2e1a0e; }
.pv-icon.purple { background: #1c1830; }
.pv-icon.blue   { background: #0d1e2e; }
.pv-icon.red    { background: #2a0e0e; }

.pv-title { font-size: 13px; font-weight: 600; color: #e3e3e3; }
.pv-sub   { font-size: 11px; color: #666; margin-top: 2px; display: flex; align-items: center; gap: 5px; }

/* Chat bubbles */
.pv-chat { display: flex; flex-direction: column; gap: 8px; }
.pv-bubble {
    padding: 9px 13px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; max-width: 90%;
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.4s ease, transform 0.4s ease;
}
.pv-bubble.pv-vis { opacity: 1; transform: translateY(0); }
.pv-bubble.user { background: #ffffff; color: #131314; align-self: flex-end; border-bottom-right-radius: 3px; }
.pv-bubble.ai   { background: #2a2a28; color: #d0d0d0; align-self: flex-start; border-bottom-left-radius: 3px; }

.pv-typing {
    display: flex; gap: 5px; align-items: center; padding: 9px 13px;
    background: #2a2a28; border-radius: 12px; border-bottom-left-radius: 3px;
    width: fit-content; opacity: 0; transition: opacity 0.3s ease;
}
.pv-typing.pv-vis { opacity: 1; }
.pv-dot { width: 6px; height: 6px; border-radius: 50%; background: #555; animation: pvBounce 1.1s infinite ease-in-out; }
.pv-dot:nth-child(2) { animation-delay: 0.18s; }
.pv-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes pvBounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }

/* Tasks */
.pv-task {
    display: flex; align-items: center; gap: 10px; padding: 5px 0;
    font-size: 12.5px; color: #ccc;
    opacity: 0; transform: translateX(-8px);
    transition: opacity 0.4s ease, transform 0.4s ease;
}
.pv-task.pv-vis { opacity: 1; transform: translateX(0); }
.pv-task.done-txt { color: #555; text-decoration: line-through; }
.pv-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 1.5px solid #444; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, border-color 0.3s;
}
.pv-check.done { background: #3ecf8e; border-color: #3ecf8e; }
.pv-check svg { opacity: 0; transition: opacity 0.2s; }
.pv-check.done svg { opacity: 1; }

/* Stats / Analytics */
.pv-stat-grid { display: flex; gap: 8px; margin-bottom: 12px; }
.pv-stat-box { flex: 1; background: #2a2a28; border-radius: 9px; padding: 9px 10px; text-align: center; }
.pv-stat-num { font-size: 18px; font-weight: 600; color: #e3e3e3; font-variant-numeric: tabular-nums; }
.pv-stat-lbl { font-size: 10px; color: #555; margin-top: 2px; letter-spacing: 0.04em; }

.pv-bar-group { display: flex; flex-direction: column; gap: 8px; }
.pv-bar-lbl-row { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 3px; }
.pv-bar-track { height: 5px; background: #2a2a28; border-radius: 99px; overflow: hidden; }
.pv-bar-fill { height: 100%; border-radius: 99px; width: 0%; transition: width 1.2s cubic-bezier(0.22,1,0.36,1); }

/* Pulse dot */
.pv-pulse { width: 7px; height: 7px; border-radius: 50%; background: #3ecf8e; display: inline-block; animation: pvPulse 1.8s infinite ease-in-out; }
@keyframes pvPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }

/* Quiz styles */
.pv-quiz-q { font-size: 12.5px; color: #ccc; margin-bottom: 10px; line-height: 1.5; opacity: 0; transform: translateY(5px); transition: opacity 0.4s ease, transform 0.4s ease; }
.pv-quiz-q.pv-vis { opacity: 1; transform: translateY(0); }
.pv-quiz-opt {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 8px; border: 1px solid #2e2e2c;
    font-size: 12px; color: #aaa; margin-bottom: 6px; cursor: default;
    opacity: 0; transform: translateX(-6px);
    transition: opacity 0.35s ease, transform 0.35s ease, background 0.3s, border-color 0.3s;
}
.pv-quiz-opt.pv-vis { opacity: 1; transform: translateX(0); }
.pv-quiz-opt.selected { background: #1a2e1a; border-color: #3ecf8e; color: #3ecf8e; }
.pv-quiz-opt.wrong    { background: #2a1414; border-color: #cf5050; color: #cf7070; }
.pv-quiz-circle { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #444; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background 0.3s, border-color 0.3s; }
.pv-quiz-opt.selected .pv-quiz-circle { background: #3ecf8e; border-color: #3ecf8e; }
.pv-quiz-opt.wrong    .pv-quiz-circle { background: #cf5050; border-color: #cf5050; }

/* AI Invigilator styles */
.pv-inv-screen { background: #111; border-radius: 10px; padding: 12px; margin-bottom: 8px; opacity: 0; transition: opacity 0.4s ease; }
.pv-inv-screen.pv-vis { opacity: 1; }
.pv-inv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px; }
.pv-inv-face { background: #1e1e1c; border-radius: 6px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid #2a2a28; transition: border-color 0.3s; }
.pv-inv-face.alert { border-color: #cf5050; background: #1f1010; }
.pv-inv-status { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #555; }
.pv-inv-badge { padding: 3px 9px; border-radius: 99px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; opacity: 0; transition: opacity 0.4s ease; }
.pv-inv-badge.active { background: #0e2e22; color: #3ecf8e; opacity: 1; }
.pv-inv-badge.warn   { background: #2a1a0e; color: #e07b3a; opacity: 1; }
.pv-inv-alert-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px; background: #1f1010; border: 1px solid #3a1a1a; font-size: 11.5px; color: #cf7070; opacity: 0; transform: translateY(4px); transition: opacity 0.4s ease, transform 0.4s ease; }
.pv-inv-alert-row.pv-vis { opacity: 1; transform: translateY(0); }

/* Announcement styles */
.pv-ann-item { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid #222; opacity: 0; transform: translateY(5px); transition: opacity 0.38s ease, transform 0.38s ease; }
.pv-ann-item.pv-vis { opacity: 1; transform: translateY(0); }
.pv-ann-item:last-child { border-bottom: none; }
.pv-ann-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.pv-ann-text { font-size: 12px; color: #ccc; line-height: 1.5; }
.pv-ann-meta { font-size: 10px; color: #444; margin-top: 2px; }
.pv-ann-badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 10px; margin-right: 5px; }
.pv-ann-badge.urgent { background: #2a1010; color: #cf7070; }
.pv-ann-badge.info   { background: #0d1e2e; color: #5ba4e0; }
.pv-ann-badge.event  { background: #1c1830; color: #8b80d1; }

/* Academic Calendar styles */
.pv-cal-month { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; opacity: 0; transition: opacity 0.4s ease; }
.pv-cal-month.pv-vis { opacity: 1; }
.pv-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 10px; }
.pv-cal-day { height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #555; opacity: 0; transform: scale(0.85); transition: opacity 0.25s ease, transform 0.25s ease; }
.pv-cal-day.pv-vis { opacity: 1; transform: scale(1); }
.pv-cal-day.today { background: #3ecf8e; color: #0a1f15; font-weight: 600; }
.pv-cal-day.has-event { background: #1c1830; color: #8b80d1; }
.pv-cal-day.holiday { background: #2a1010; color: #cf7070; }
.pv-event-list { display: flex; flex-direction: column; gap: 6px; }
.pv-event-row { display: flex; align-items: center; gap: 9px; opacity: 0; transform: translateX(-6px); transition: opacity 0.35s ease, transform 0.35s ease; }
.pv-event-row.pv-vis { opacity: 1; transform: translateX(0); }
.pv-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pv-event-label { font-size: 12px; color: #ccc; }
.pv-event-date { font-size: 10px; color: #444; margin-left: auto; }

/* Learner Dashboard styles */
.pv-subj-grid { display: flex; flex-direction: column; gap: 7px; }
.pv-subj-row { display: flex; align-items: center; gap: 10px; opacity: 0; transform: translateY(5px); transition: opacity 0.38s ease, transform 0.38s ease; }
.pv-subj-row.pv-vis { opacity: 1; transform: translateY(0); }
.pv-subj-ico { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; }
.pv-subj-name { font-size: 12px; color: #ccc; flex: 1; }
.pv-subj-track { flex: 2; height: 4px; background: #2a2a28; border-radius: 99px; overflow: hidden; }
.pv-subj-fill { height: 100%; border-radius: 99px; width: 0%; transition: width 1s cubic-bezier(0.22,1,0.36,1); }
.pv-subj-pct { font-size: 11px; color: #888; min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
.pv-grade-badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; min-width: 28px; text-align: center; }
.pv-grade-badge.a { background: #0e2e22; color: #3ecf8e; }
.pv-grade-badge.b { background: #0d1e2e; color: #5ba4e0; }
.pv-grade-badge.c { background: #1c1830; color: #8b80d1; }

/* Admin Dashboard styles */
.pv-admin-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; margin-bottom: 10px; }
.pv-admin-box { background: #2a2a28; border-radius: 10px; padding: 10px 12px; opacity: 0; transform: translateY(6px); transition: opacity 0.38s ease, transform 0.38s ease; }
.pv-admin-box.pv-vis { opacity: 1; transform: translateY(0); }
.pv-admin-num { font-size: 20px; font-weight: 600; color: #e3e3e3; font-variant-numeric: tabular-nums; }
.pv-admin-lbl { font-size: 10px; color: #555; margin-top: 2px; }
.pv-admin-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-top: 1px solid #222; font-size: 11.5px; color: #888; opacity: 0; transition: opacity 0.38s ease; }
.pv-admin-row.pv-vis { opacity: 1; }
.pv-admin-chip { padding: 2px 8px; border-radius: 99px; font-size: 10px; }
.pv-admin-chip.ok  { background: #0e2e22; color: #3ecf8e; }
.pv-admin-chip.off { background: #2a1a0e; color: #e07b3a; }

/* Auto Grading styles */
.pv-grade-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; opacity: 0; transition: opacity 0.4s ease; }
.pv-grade-header.pv-vis { opacity: 1; }
.pv-grade-title { font-size: 12px; color: #ccc; }
.pv-grade-total { font-size: 18px; font-weight: 600; color: #e3e3e3; font-variant-numeric: tabular-nums; }
.pv-grade-total span { font-size: 11px; color: #444; font-weight: 400; }
.pv-q-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #1e1e1c; opacity: 0; transform: translateX(-5px); transition: opacity 0.32s ease, transform 0.32s ease; }
.pv-q-row.pv-vis { opacity: 1; transform: translateX(0); }
.pv-q-row:last-child { border-bottom: none; }
.pv-q-num { font-size: 10px; color: #444; min-width: 18px; }
.pv-q-bar-wrap { flex: 1; height: 4px; background: #222; border-radius: 99px; overflow: hidden; }
.pv-q-bar { height: 100%; border-radius: 99px; width: 0%; transition: width 0.7s cubic-bezier(0.22,1,0.36,1); }
.pv-q-mark { font-size: 11px; min-width: 36px; text-align: right; font-variant-numeric: tabular-nums; }
.pv-q-mark.correct { color: #3ecf8e; }
.pv-q-mark.partial { color: #e07b3a; }
.pv-q-mark.wrong   { color: #cf5050; }


/* ── Card 10: Evaluations ── */
.pv-eval-layout {
    display: flex;
    gap: 10px;
    height: 110px;
}
.pv-eval-sidebar {
    width: 44%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-right: 1px solid #222;
    padding-right: 10px;
}
.pv-eval-item {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 6px;
    border-radius: 6px;
    border-left: 2px solid transparent;
    font-size: 11px;
    color: #666;
    opacity: 0;
    transform: translateX(-6px);
    transition: opacity 0.35s ease, transform 0.35s ease;
}
.pv-eval-item.pv-vis { opacity: 1; transform: translateX(0); }
.pv-eval-item.active { background: rgba(167,139,250,0.08); border-left-color: #a78bfa; color: #ccc; }
.pv-eval-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.pv-eval-dot.pending { background: #e07b3a; }
.pv-eval-dot.done    { background: #3ecf8e; }
.pv-eval-name { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pv-eval-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.pv-eval-q {
    font-size: 11.5px;
    color: #ccc;
    line-height: 1.4;
    opacity: 0;
    transition: opacity 0.4s ease;
}
.pv-eval-q.pv-vis { opacity: 1; }
.pv-eval-options { display: flex; flex-direction: column; gap: 4px; }
.pv-eval-opt {
    font-size: 10.5px;
    color: #666;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #222;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.3s ease, transform 0.3s ease, background 0.3s, border-color 0.3s, color 0.3s;
    cursor: default;
}
.pv-eval-opt.pv-vis { opacity: 1; transform: translateY(0); }
.pv-eval-opt.selected { background: rgba(167,139,250,0.12); border-color: #a78bfa; color: #a78bfa; }

/* ── Card 11: Syllabus ── */
.pv-syl-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
    opacity: 0;
    transition: opacity 0.4s ease;
}
.pv-syl-tabs.pv-vis { opacity: 1; }
.pv-syl-tab {
    font-size: 10.5px;
    color: #555;
    padding: 3px 9px;
    border-radius: 99px;
    border: 1px solid #222;
    cursor: default;
}
.pv-syl-tab.active { background: rgba(79,209,197,0.1); border-color: #4fd1c5; color: #4fd1c5; }
.pv-syl-current {
    font-size: 9px;
    background: #4fd1c5;
    color: #0a1f15;
    border-radius: 99px;
    padding: 0px 5px;
    margin-left: 3px;
    font-weight: 700;
    vertical-align: middle;
}

.pv-syl-card { opacity: 0; transform: translateY(6px); transition: opacity 0.45s ease, transform 0.45s ease; }
.pv-syl-card.pv-vis { opacity: 1; transform: translateY(0); }

.pv-syl-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.pv-syl-subject { font-size: 13px; font-weight: 600; color: #e3e3e3; }
.pv-syl-teacher { font-size: 11px; color: #666; margin-top: 2px; }
.pv-syl-date    { font-size: 10px; color: #444; white-space: nowrap; }

.pv-syl-section-lbl {
    font-size: 10px; font-weight: 700; color: #555;
    text-transform: uppercase; letter-spacing: 0.06em;
    margin: 8px 0 5px;
}
.pv-syl-topics { list-style: none; padding: 0; margin: 0 0 4px; display: flex; flex-direction: column; gap: 3px; }
.pv-syl-topic {
    font-size: 11.5px; color: #ccc;
    display: flex; align-items: center; gap: 7px;
    opacity: 0; transform: translateX(-5px);
    transition: opacity 0.35s ease, transform 0.35s ease;
}
.pv-syl-topic.pv-vis { opacity: 1; transform: translateX(0); }
.pv-syl-topic::before {
    content: ''; width: 5px; height: 5px;
    border-radius: 50%; background: #4fd1c5; flex-shrink: 0;
}

.pv-syl-assess-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11.5px; color: #ccc; margin-top: 4px;
    opacity: 0; transition: opacity 0.35s ease;
}
.pv-syl-assess-row.pv-vis { opacity: 1; }
.pv-syl-atype { color: #aaa; }
.pv-syl-apct  { font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-syl-abar-wrap { height: 3px; background: #222; border-radius: 99px; overflow: hidden; margin-bottom: 2px; }
.pv-syl-abar  { height: 100%; border-radius: 99px; width: 0%; transition: width 1s cubic-bezier(0.22,1,0.36,1); }

/* ── Right form panel ── */
.form-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
    min-height: 100vh;
    box-sizing: border-box;
    max-height: 100vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}

.form-panel::-webkit-scrollbar { width: 4px; }
.form-panel::-webkit-scrollbar-track { background: transparent; }
.form-panel::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

/* inner width cap for the form itself */
.form-panel > .form-box {
    width: 100%;
    max-width: 400px;
}

/* ── Desktop ── */
@media (min-width: 900px) {
    body { padding: 0; }

    .container {
        min-height: 100vh;
        max-width: 100%;
    }

    .brand-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        flex: 0 0 48%;
        padding: 48px 40px;
        background: #111110;
        border-right: none;
        box-sizing: border-box;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow: hidden;
    }

    /* Curved SVG divider on right edge of brand panel */
    .brand-panel::after {
        content: '';
        position: absolute;
        top: 0;
        right: -1px;
        width: 32px;
        height: 100%;
        background: #111110;
        clip-path: polygon(0 0, 60% 0, 100% 6%, 100% 94%, 60% 100%, 0 100%);
        z-index: 2;
        pointer-events: none;
    }

    /* Thin accent line on the curved edge */
    .brand-panel::before {
        content: '';
        position: absolute;
        top: 6%;
        right: 18px;
        width: 1px;
        height: 88%;
        background: linear-gradient(to bottom, transparent, #2a2a2a 15%, #2a2a2a 85%, transparent);
        z-index: 3;
        pointer-events: none;
    }

    .brand-panel-logo,
    .brand-panel-title,
    .brand-panel-tagline,
    .brand-panel-school {
        display: none;
    }

    .brand-panel-footer {
        position: absolute;
        bottom: 28px;
        left: 40px;
        font-size: 12px;
        color: #7e7a7a;
    }

    .preview-wrap {
        position: relative;
        width: 100%;
        min-height: 280px;
    }

    .form-panel {
        flex: 1;
        background: #1a1919;
        padding: 60px 64px;
        justify-content: flex-start;
    }

    /* Keep the shorter login form vertically centred */
    #login-form.active {
        min-height: calc(100vh - 120px);
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    /* Register form gets breathing room at top and bottom */
    #register-form.active {
        padding-top: 20px;
        padding-bottom: 40px;
    }

    .form-panel > .form-box {
        max-width: 380px;
    }

    /* Hide the logo inside the login form on desktop — branding panel handles it */
    #iskool-brand {
        display: none !important;
    }

    /* Logo + school name above the login form on desktop */
    #form-top-brand {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 36px;
        width: 100%;
        max-width: 380px;
    }

    #form-logo-svg svg {
        display: block;
        width: 54px;
        height: 54px;
    }

    #form-school-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
    }

    #form-school-dot {
        width: 8px; height: 8px;
        background: #3ecf8e;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: 0 0 6px #3ecf8e88;
    }

    #form-school-name {
        font-size: 13px;
        color: #aaa;
    }
}

#iskool-brand {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 20px auto;
    padding: 10px;
    width: 100%;
    box-sizing: border-box;
}

#iskool-brand svg {
    width: 90px;
    height: 90px;
}

@media (max-width: 480px) {
    #iskool-brand svg { width: 65px; height: 65px; }
    #iskool-brand { margin-bottom: 25px; max-width: 95vw; }
}

    @keyframes fadeSlideIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-box p {
        text-align: center;
        font-size: 14px;
    }

    /* TO: */
.form-box {
    display: none;
    width: 100%;
}

.form-box.active {
    display: block;
    width: 100%;
}

    .error-message {
        color: #ff5555;
        margin-bottom: 10px;
    }

    input, select, button {
        width: 100%;
        margin: 8px 0;
        padding: 10px;
        border-radius: 6px;
        border: none;
        font-size: 14px;
    }

input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
select {
    background: #1E1F20;
    color: #fff;
    border: 1px solid transparent;
    padding: 12px 20px;
    border-radius: 30px;
    box-sizing: border-box;
    font-size: 16px;
    transition: all 0.3s ease;
    margin-bottom: 12px;
    width: 100%;
    display: block;
}

input:focus, select:focus {
    background: #1E1F20;
    border-color: #444746;
    box-shadow: 0 0 0 1px #444746;
    outline: none;
}

  button {
    background: #ffffff; 
    color: #131314;
    font-weight: 700;
    font-size: 15px;
    padding: 14px;
    border-radius: 24px; /* Matches the pills */
    cursor: pointer;
    border: none;
    margin-top: 10px;
    transition: background 0.2s ease;
}

button:hover {
    background: #F1F1F1;
}

    a {
        color: white;
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    .password-wrapper {
        position: relative;
        width: 100%;
    }

    .password-wrapper input {
        width: 100%;
        padding-right: 40px;
    }

    .toggle-password {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
        color: #ccc;
        cursor: pointer;
    }

    h2 {
    font-weight: 400; /* Gemini uses lighter font weights for headings */
    font-size: 24px;
    color: #E3E3E3;
}

    /* NEW: Title + Name + Surname Row */
    .name-row {
        display: flex;
        gap: 8px;
        margin: 8px 0;
    }

    .name-row select,
    .name-row input {
        flex: 1;
        margin: 0;
    }

    .name-row select {
        flex: 0.6;
    }

    #loaderOverlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
       background: #1a1919; /* CHANGE THIS from #0d1117 */
        backdrop-filter: blur(6px);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        flex-direction: column;
        opacity: 0;
        transition: opacity 0.4s ease;
    }

    #loaderOverlay.show {
        display: flex;
        opacity: 1;
    }

    .loader-container {
        text-align: center;
    }

    .loader-book i {
        font-size: 5rem;
        color: #00ff99;
        text-shadow: 0 0 10px #00ff99;
        animation: rotateBook 4s linear infinite;
    }

    .loader-text {
        font-size: 18px;
        color: #00ff99;
        font-weight: 600;
        text-shadow: 0 0 8px #00ff99;
        font-family: 'Nunito', sans-serif;
        margin-top: 15px;
    }

    @keyframes rotateBook {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @media (max-width: 480px) {
        .form-panel {
            padding: 1.5rem 1.2rem;
            min-height: 100vh;
        }

        .form-box p,
        .form-box label {
            font-size: 13px;
        }

        input, select, button {
            font-size: 13px;
            padding: 10px 14px;
        }

        .toggle-password {
            right: 10px;
        }

        label {
            display: block;
            margin-top: 10px;
        }

        .name-row {
            flex-direction: column;
        }

        .name-row select,
        .name-row input {
            margin: 4px 0;
        }
    }

    @media (max-width: 360px) {
        input, select, button {
            font-size: 12px;
            padding: 8px 12px;
        }

        .form-panel {
            padding: 1rem;
        }
    }
    </style>
</head>
<body>
    <!-- Animation wrapper -->
    <div id="animation-wrapper">
       <div id="loader-logo">
    
    <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="180.000000pt" height="180.000000pt" viewBox="0 0 880.000000 805.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,805.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M4275 7173 c-274 -35 -556 -150 -692 -282 -31 -30 -35 -31 -125 -31
-149 0 -352 -26 -498 -64 -507 -130 -844 -438 -956 -875 -13 -51 -24 -108 -24
-125 0 -30 -3 -33 -77 -60 -185 -68 -397 -186 -563 -315 -353 -274 -571 -613
-662 -1031 -19 -91 -23 -133 -22 -310 0 -175 3 -220 23 -310 144 -668 664
-1198 1361 -1388 168 -46 276 -63 450 -69 460 -17 809 126 994 407 56 85 81
146 102 250 16 78 17 167 11 1157 l-5 1073 41 11 c156 41 276 181 309 358 19
106 -33 272 -113 360 -143 156 -416 188 -598 71 -181 -115 -248 -356 -156
-558 44 -97 160 -197 268 -232 l37 -12 0 -1101 0 -1102 -24 -66 c-26 -74 -86
-167 -143 -221 -178 -169 -506 -248 -848 -204 -295 38 -533 126 -772 286 -149
99 -270 204 -361 312 -84 100 -196 269 -185 278 4 4 225 100 491 214 l484 207
41 -42 c143 -143 399 -159 575 -36 181 126 239 356 141 555 -132 269 -520 327
-734 108 -90 -93 -132 -212 -121 -346 6 -75 5 -79 -17 -86 -22 -7 -543 -230
-802 -343 -76 -34 -142 -61 -145 -61 -12 0 -60 169 -81 285 -18 103 -20 144
-16 290 3 102 12 200 22 245 64 289 202 537 419 756 221 221 486 385 761 470
50 15 93 32 96 37 4 5 9 43 13 86 20 220 106 414 253 571 96 103 164 155 284
219 217 116 459 171 751 171 l179 0 57 53 c115 108 254 181 440 229 106 28
133 31 277 32 173 1 244 -12 300 -56 59 -46 55 86 55 -2077 l0 -1990 -50 -22
c-67 -29 -141 -109 -168 -182 -44 -117 -22 -243 58 -338 l41 -49 -27 -47 c-81
-136 -257 -255 -494 -333 -159 -53 -216 -76 -283 -117 -155 -94 -260 -224
-319 -393 -40 -117 -49 -212 -49 -500 l1 -274 25 -26 c35 -35 123 -36 157 -2
23 22 23 27 29 320 5 255 8 307 25 367 64 224 192 350 434 428 146 48 177 50
302 28 234 -41 371 -54 563 -55 460 -1 786 101 1025 321 l65 60 105 -9 c331
-27 708 55 938 205 200 131 331 300 387 502 25 91 31 291 11 400 -9 50 -18 99
-21 110 -5 16 9 31 64 73 92 70 244 230 305 321 101 152 159 291 196 471 132
646 -253 1267 -977 1578 -50 21 -52 24 -58 70 -65 488 -433 871 -976 1016
-156 41 -285 58 -470 59 l-171 2 -24 -28 c-33 -39 -31 -81 5 -118 l29 -29 150
0 c510 0 949 -224 1142 -582 76 -142 115 -283 119 -435 l1 -52 78 -30 c186
-71 327 -148 457 -248 353 -272 531 -627 512 -1017 -15 -290 -135 -538 -368
-761 -52 -50 -129 -115 -171 -145 -85 -60 -89 -70 -62 -136 23 -55 51 -198 53
-274 4 -143 -50 -304 -142 -426 -117 -154 -333 -272 -607 -330 -87 -18 -380
-27 -396 -12 -4 4 -2 13 4 20 27 34 66 201 76 328 2 19 4 380 5 803 1 738 2
767 19 767 11 0 47 14 81 31 205 102 298 328 222 543 -74 212 -302 333 -533
285 -77 -16 -180 -74 -233 -130 -82 -87 -135 -242 -120 -344 28 -181 140 -323
298 -376 l52 -18 0 -793 c0 -891 1 -871 -74 -1033 -84 -179 -226 -296 -461
-380 -152 -54 -403 -88 -585 -79 -141 7 -375 30 -383 39 -4 4 2 11 13 17 40
21 191 185 225 244 l35 62 57 5 c105 9 214 76 262 161 31 53 49 144 42 204
-15 111 -109 237 -197 264 l-39 11 -2 2026 -3 2026 -29 58 c-68 139 -240 208
-516 205 -69 0 -138 -3 -155 -5z m-675 -1313 c220 -112 177 -430 -65 -480
-151 -31 -300 93 -300 250 0 108 76 213 175 245 56 18 138 12 190 -15z m2656
-1035 c69 -20 125 -65 160 -127 38 -69 41 -170 7 -234 -70 -131 -234 -182
-358 -110 -190 112 -162 395 47 467 65 22 81 23 144 4z m-3767 -518 c123 -62
173 -222 106 -345 -69 -126 -213 -173 -334 -107 -66 36 -107 85 -126 149 -20
67 -19 105 6 170 51 138 213 200 348 133z m2463 -1639 c66 -46 81 -141 33
-203 -76 -101 -209 -79 -250 41 -9 27 -10 47 -2 76 11 45 64 104 99 111 37 8
90 -3 120 -25z"/>
</g>
</svg>
</div>
</div>
</div>
        <div class="branding">
           
        </div>
    </div>
    <!-- Login/Register container -->
    <div class="container">

        <!-- LEFT: Animated Preview Panel (desktop only) -->
        <div class="brand-panel">

            <!-- Eyebrow only above preview -->
            <div class="bp-intro">
                <div class="bp-intro-eyebrow">
                    <span class="bp-live-dot"></span>
                    <span>Live preview</span>
                </div>
            </div>

            <div class="preview-wrap">

                <!-- Card 0: Typewriter Intro -->
                <div class="preview-card pv-intro-card" id="pv0">
                    <div class="pv-tw-wrap">
                        <div class="pv-tw-line" id="pv-tw1"></div>
                        <div class="pv-tw-line pv-tw-line2" id="pv-tw2"></div>
                    </div>
                </div>

                <!-- Card 1: Class Discussion -->
                <div class="preview-card" id="pv1">
                    <div class="pv-header">
                        <div class="pv-icon orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Class discussion</div>
                            <div class="pv-sub"><span class="pv-pulse"></span> Grade 10 · Maths</div>
                        </div>
                    </div>
                    <div class="pv-chat">
                        <div class="pv-bubble user" id="pv-b1">Sir, when is the Maths test?</div>
                        <div class="pv-typing" id="pv-typing"><div class="pv-dot"></div><div class="pv-dot"></div><div class="pv-dot"></div></div>
                        <div class="pv-bubble ai" id="pv-b2">Friday 9am — Chapter 4 &amp; 5. Good luck! 📚</div>
                        <div class="pv-bubble user" id="pv-b3">Will past papers be uploaded?</div>
                        <div class="pv-bubble ai" id="pv-b4">Yes, check Resources by Thursday.</div>
                    </div>
                </div>

                <!-- Card 2: Announcements -->
                <div class="preview-card" id="pv2">
                    <div class="pv-header">
                        <div class="pv-icon blue">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5ba4e0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Announcements</div>
                            <div class="pv-sub">School-wide &amp; class notices</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a1">
                        <div class="pv-ann-dot" style="background:#cf5050;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge urgent">Urgent</span>Term 2 fees due 30 April</div>
                            <div class="pv-ann-meta">Bursar · 2 hrs ago</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a2">
                        <div class="pv-ann-dot" style="background:#5ba4e0;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge info">Notice</span>Library closes at 3pm this week</div>
                            <div class="pv-ann-meta">Admin · Yesterday</div>
                        </div>
                    </div>
                    <div class="pv-ann-item" id="pv-a3">
                        <div class="pv-ann-dot" style="background:#8b80d1;"></div>
                        <div>
                            <div class="pv-ann-text"><span class="pv-ann-badge event">Event</span>Science fair: Friday 2pm, Hall B</div>
                            <div class="pv-ann-meta">Mrs Dlamini · 3 days ago</div>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Auto Quiz -->
                <div class="preview-card" id="pv3">
                    <div class="pv-header">
                        <div class="pv-icon purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b80d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Auto quiz</div>
                            <div class="pv-sub">Life Sciences · Grade 11</div>
                        </div>
                    </div>
                    <div class="pv-quiz-q" id="pv-qq">What is the powerhouse of the cell?</div>
                    <div class="pv-quiz-opt" id="pv-qo1"><div class="pv-quiz-circle"></div>Nucleus</div>
                    <div class="pv-quiz-opt" id="pv-qo2"><div class="pv-quiz-circle"></div>Mitochondria</div>
                    <div class="pv-quiz-opt" id="pv-qo3"><div class="pv-quiz-circle"></div>Ribosome</div>
                </div>

                <!-- Card 4: Teacher Analytics -->
                <div class="preview-card" id="pv4">
                    <div class="pv-header">
                        <div class="pv-icon green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Teacher analytics</div>
                            <div class="pv-sub">This term's overview</div>
                        </div>
                    </div>
                    <div class="pv-stat-grid">
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn1">0</div><div class="pv-stat-lbl">Learners</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn2">0</div><div class="pv-stat-lbl">Teachers</div></div>
                        <div class="pv-stat-box"><div class="pv-stat-num" id="pv-sn3">0%</div><div class="pv-stat-lbl">Attendance</div></div>
                    </div>
                    <div class="pv-bar-group">
                        <div>
                            <div class="pv-bar-lbl-row"><span>Pass rate</span><span id="pv-bl1">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf1" style="background:#3ecf8e;"></div></div>
                        </div>
                        <div>
                            <div class="pv-bar-lbl-row"><span>Submissions</span><span id="pv-bl2">0%</span></div>
                            <div class="pv-bar-track"><div class="pv-bar-fill" id="pv-bf2" style="background:#8b80d1;"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Card 5: AI Invigilator -->
                <div class="preview-card" id="pv5">
                    <div class="pv-header">
                        <div class="pv-icon red">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cf5050" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">AI invigilator</div>
                            <div class="pv-sub" id="pv-inv-sub">Monitoring exam session</div>
                        </div>
                    </div>
                    <div class="pv-inv-screen" id="pv-inv-screen">
                        <div class="pv-inv-grid">
                            <div class="pv-inv-face" id="pv-if1">🧑</div>
                            <div class="pv-inv-face" id="pv-if2">👩</div>
                            <div class="pv-inv-face" id="pv-if3">🧑</div>
                            <div class="pv-inv-face" id="pv-if4">👦</div>
                            <div class="pv-inv-face" id="pv-if5">👩</div>
                            <div class="pv-inv-face" id="pv-if6">🧑</div>
                        </div>
                        <div class="pv-inv-status">
                            <span id="pv-inv-badge" class="pv-inv-badge active">● LIVE</span>
                            <span style="font-size:11px;color:#444;">6 learners · Maths P1</span>
                        </div>
                    </div>
                    <div class="pv-inv-alert-row" id="pv-inv-alert">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cf7070" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Suspicious activity detected — Learner 4
                    </div>
                </div>

                <!-- Card 6: Academic Calendar -->
                <div class="preview-card" id="pv6">
                    <div class="pv-header">
                        <div class="pv-icon green">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Academic calendar</div>
                            <div class="pv-sub">Term 2 · April 2025</div>
                        </div>
                    </div>
                    <div class="pv-cal-month" id="pv-cal-month">April 2025</div>
                    <div class="pv-cal-grid">
                        <div class="pv-cal-day" id="pvc-1">1</div><div class="pv-cal-day" id="pvc-2">2</div>
                        <div class="pv-cal-day has-event" id="pvc-3">3</div><div class="pv-cal-day" id="pvc-4">4</div>
                        <div class="pv-cal-day" id="pvc-5">5</div><div class="pv-cal-day holiday" id="pvc-6">6</div>
                        <div class="pv-cal-day" id="pvc-7">7</div><div class="pv-cal-day" id="pvc-8">8</div>
                        <div class="pv-cal-day" id="pvc-9">9</div><div class="pv-cal-day today" id="pvc-10">10</div>
                        <div class="pv-cal-day" id="pvc-11">11</div><div class="pv-cal-day has-event" id="pvc-12">12</div>
                        <div class="pv-cal-day" id="pvc-13">13</div><div class="pv-cal-day" id="pvc-14">14</div>
                    </div>
                    <div class="pv-event-list">
                        <div class="pv-event-row" id="pv-ev1"><div class="pv-event-dot" style="background:#8b80d1;"></div><span class="pv-event-label">Grade 12 Mock Exams</span><span class="pv-event-date">Apr 3</span></div>
                        <div class="pv-event-row" id="pv-ev2"><div class="pv-event-dot" style="background:#cf5050;"></div><span class="pv-event-label">Public Holiday</span><span class="pv-event-date">Apr 6</span></div>
                        <div class="pv-event-row" id="pv-ev3"><div class="pv-event-dot" style="background:#3ecf8e;"></div><span class="pv-event-label">Parent-Teacher Meeting</span><span class="pv-event-date">Apr 12</span></div>
                    </div>
                </div>

                <!-- Card 7: Learner Dashboard -->
                <div class="preview-card" id="pv7">
                    <div class="pv-header">
                        <div class="pv-icon blue">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5ba4e0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Learner dashboard</div>
                            <div class="pv-sub">Thabo M. · Grade 10</div>
                        </div>
                    </div>
                    <div class="pv-subj-grid">
                        <div class="pv-subj-row" id="pv-sr1"><div class="pv-subj-ico" style="background:#0e2e22;">📐</div><span class="pv-subj-name">Mathematics</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf1" style="background:#3ecf8e;"></div></div><span class="pv-subj-pct" id="pv-sp1">0%</span><span class="pv-grade-badge a">A</span></div>
                        <div class="pv-subj-row" id="pv-sr2"><div class="pv-subj-ico" style="background:#0d1e2e;">🔬</div><span class="pv-subj-name">Life Sciences</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf2" style="background:#5ba4e0;"></div></div><span class="pv-subj-pct" id="pv-sp2">0%</span><span class="pv-grade-badge b">B+</span></div>
                        <div class="pv-subj-row" id="pv-sr3"><div class="pv-subj-ico" style="background:#1c1830;">📖</div><span class="pv-subj-name">English HL</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf3" style="background:#8b80d1;"></div></div><span class="pv-subj-pct" id="pv-sp3">0%</span><span class="pv-grade-badge c">B</span></div>
                        <div class="pv-subj-row" id="pv-sr4"><div class="pv-subj-ico" style="background:#2e1a0e;">🌍</div><span class="pv-subj-name">Geography</span><div class="pv-subj-track"><div class="pv-subj-fill" id="pv-sf4" style="background:#e07b3a;"></div></div><span class="pv-subj-pct" id="pv-sp4">0%</span><span class="pv-grade-badge b">B</span></div>
                    </div>
                </div>

                <!-- Card 8: Admin Dashboard -->
                <div class="preview-card" id="pv8">
                    <div class="pv-header">
                        <div class="pv-icon purple">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b80d1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Admin dashboard</div>
                            <div class="pv-sub">School overview · Live</div>
                        </div>
                    </div>
                    <div class="pv-admin-stats">
                        <div class="pv-admin-box" id="pv-ab1"><div class="pv-admin-num" id="pv-an1">0</div><div class="pv-admin-lbl">Total Learners</div></div>
                        <div class="pv-admin-box" id="pv-ab2"><div class="pv-admin-num" id="pv-an2">0</div><div class="pv-admin-lbl">Teachers</div></div>
                        <div class="pv-admin-box" id="pv-ab3"><div class="pv-admin-num" id="pv-an3">0</div><div class="pv-admin-lbl">Active Classes</div></div>
                        <div class="pv-admin-box" id="pv-ab4"><div class="pv-admin-num" id="pv-an4">0%</div><div class="pv-admin-lbl">Avg Attendance</div></div>
                    </div>
                    <div class="pv-admin-row" id="pv-ar1"><span>System status</span><span class="pv-admin-chip ok">● Online</span></div>
                    <div class="pv-admin-row" id="pv-ar2"><span>Pending registrations</span><span style="color:#e3e3e3;font-weight:600;">12</span></div>
                    <div class="pv-admin-row" id="pv-ar3"><span>Reports generated today</span><span style="color:#e3e3e3;font-weight:600;">7</span></div>
                </div>

                <!-- Card 9: Auto Grading -->
                <div class="preview-card" id="pv9">
                    <div class="pv-header">
                        <div class="pv-icon orange">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e07b3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Auto grading</div>
                            <div class="pv-sub">Maths P1 · 28 submissions</div>
                        </div>
                    </div>
                    <div class="pv-grade-header" id="pv-gh"><span class="pv-grade-title">Lerato S. · Question breakdown</span><div class="pv-grade-total"><span id="pv-gtotal">0</span><span>/50</span></div></div>
                    <div class="pv-q-row" id="pv-qr1"><span class="pv-q-num">Q1</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb1" style="background:#3ecf8e;"></div></div><span class="pv-q-mark correct" id="pv-qm1">0/10</span></div>
                    <div class="pv-q-row" id="pv-qr2"><span class="pv-q-num">Q2</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb2" style="background:#3ecf8e;"></div></div><span class="pv-q-mark correct" id="pv-qm2">0/10</span></div>
                    <div class="pv-q-row" id="pv-qr3"><span class="pv-q-num">Q3</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb3" style="background:#e07b3a;"></div></div><span class="pv-q-mark partial" id="pv-qm3">0/15</span></div>
                    <div class="pv-q-row" id="pv-qr4"><span class="pv-q-num">Q4</span><div class="pv-q-bar-wrap"><div class="pv-q-bar" id="pv-qb4" style="background:#cf5050;"></div></div><span class="pv-q-mark wrong" id="pv-qm4">0/15</span></div>
                </div>

                <!-- Card 10: Teacher Evaluations -->
                <div class="preview-card" id="pv10">
                    <div class="pv-header">
                        <div class="pv-icon" style="background:#1a1030;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Teacher evaluations</div>
                            <div class="pv-sub">Rate your educators &middot; Term 2</div>
                        </div>
                    </div>
                    <div class="pv-eval-layout">
                        <div class="pv-eval-sidebar">
                            <div class="pv-eval-item active" id="pv-ev-i1">
                                <span class="pv-eval-dot pending"></span>
                                <span class="pv-eval-name">Mr Khumalo &middot; Maths</span>
                            </div>
                            <div class="pv-eval-item" id="pv-ev-i2">
                                <span class="pv-eval-dot done"></span>
                                <span class="pv-eval-name">Mrs Dlamini &middot; English</span>
                            </div>
                            <div class="pv-eval-item" id="pv-ev-i3">
                                <span class="pv-eval-dot pending"></span>
                                <span class="pv-eval-name">Mr Sithole &middot; Physics</span>
                            </div>
                        </div>
                        <div class="pv-eval-panel">
                            <div class="pv-eval-q" id="pv-eval-q">The teacher explains concepts clearly.</div>
                            <div class="pv-eval-options">
                                <div class="pv-eval-opt" id="pv-eopt1">Strongly Agree</div>
                                <div class="pv-eval-opt" id="pv-eopt2">Agree</div>
                                <div class="pv-eval-opt" id="pv-eopt3">Neutral</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 11: Subject Brief & Outline -->
                <div class="preview-card" id="pv11">
                    <div class="pv-header">
                        <div class="pv-icon" style="background:#0a1e1a;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fd1c5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="16" y2="6"/><line x1="12" y1="10" x2="16" y2="10"/></svg>
                        </div>
                        <div>
                            <div class="pv-title">Subject brief &amp; outline</div>
                            <div class="pv-sub">Term 2 &middot; Mathematics</div>
                        </div>
                    </div>
                    <div class="pv-syl-tabs">
                        <span class="pv-syl-tab" id="pv-st1">Term 1</span>
                        <span class="pv-syl-tab active" id="pv-st2">Term 2 <span class="pv-syl-current">Current</span></span>
                        <span class="pv-syl-tab" id="pv-st3">Term 3</span>
                    </div>
                    <div class="pv-syl-card" id="pv-syl-card">
                        <div class="pv-syl-card-header">
                            <div>
                                <div class="pv-syl-subject">Mathematics</div>
                                <div class="pv-syl-teacher">Mr Khumalo</div>
                            </div>
                            <div class="pv-syl-date">Updated Apr 2</div>
                        </div>
                        <div class="pv-syl-section-lbl">Syllabus Topics</div>
                        <ul class="pv-syl-topics">
                            <li class="pv-syl-topic" id="pv-sta">Quadratic Equations</li>
                            <li class="pv-syl-topic" id="pv-stb">Functions &amp; Graphs</li>
                            <li class="pv-syl-topic" id="pv-stc">Euclidean Geometry</li>
                        </ul>
                        <div class="pv-syl-section-lbl">Assessment Weighting</div>
                        <div class="pv-syl-assess-row" id="pv-sa1">
                            <span class="pv-syl-atype">Tests</span>
                            <span class="pv-syl-apct" style="color:#4fd1c5;">40%</span>
                        </div>
                        <div class="pv-syl-abar-wrap"><div class="pv-syl-abar" id="pv-sab1" style="background:#4fd1c5;width:0%;"></div></div>
                        <div class="pv-syl-assess-row" id="pv-sa2">
                            <span class="pv-syl-atype">Assignments</span>
                            <span class="pv-syl-apct" style="color:#a78bfa;">30%</span>
                        </div>
                        <div class="pv-syl-abar-wrap"><div class="pv-syl-abar" id="pv-sab2" style="background:#a78bfa;width:0%;"></div></div>
                    </div>
                </div>

            </div>
            <div class="brand-panel-footer">&copy; <?= date('Y') ?> iSkool v.1.0.0</div>
        </div>

        <!-- RIGHT: Form panel -->
        <div class="form-panel">
        <!-- Logo + School Name (desktop: shown here, replaces brand panel header) -->
        <div id="form-top-brand">
            <div id="form-logo-svg">
                <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 880.000000 805.000000" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(0.000000,805.000000) scale(0.100000,-0.100000)" fill="#a09d9dff" stroke="none">
                        <path d="M4275 7173 c-274 -35 -556 -150 -692 -282 -31 -30 -35 -31 -125 -31 -149 0 -352 -26 -498 -64 -507 -130 -844 -438 -956 -875 -13 -51 -24 -108 -24 -125 0 -30 -3 -33 -77 -60 -185 -68 -397 -186 -563 -315 -353 -274 -571 -613 -662 -1031 -19 -91 -23 -133 -22 -310 0 -175 3 -220 23 -310 144 -668 664 -1198 1361 -1388 168 -46 276 -63 450 -69 460 -17 809 126 994 407 56 85 81 146 102 250 16 78 17 167 11 1157 l-5 1073 41 11 c156 41 276 181 309 358 19 106 -33 272 -113 360 -143 156 -416 188 -598 71 -181 -115 -248 -356 -156 -558 44 -97 160 -197 268 -232 l37 -12 0 -1101 0 -1102 -24 -66 c-26 -74 -86 -167 -143 -221 -178 -169 -506 -248 -848 -204 -295 38 -533 126 -772 286 -149 99 -270 204 -361 312 -84 100 -196 269 -185 278 4 4 225 100 491 214 l484 207 41 -42 c143 -143 399 -159 575 -36 181 126 239 356 141 555 -132 269 -520 327 -734 108 -90 -93 -132 -212 -121 -346 6 -75 5 -79 -17 -86 -22 -7 -543 -230 -802 -343 -76 -34 -142 -61 -145 -61 -12 0 -60 169 -81 285 -18 103 -20 144 -16 290 3 102 12 200 22 245 64 289 202 537 419 756 221 221 486 385 761 470 50 15 93 32 96 37 4 5 9 43 13 86 20 220 106 414 253 571 96 103 164 155 284 219 217 116 459 171 751 171 l179 0 57 53 c115 108 254 181 440 229 106 28 133 31 277 32 173 1 244 -12 300 -56 59 -46 55 86 55 -2077 l0 -1990 -50 -22 c-67 -29 -141 -109 -168 -182 -44 -117 -22 -243 58 -338 l41 -49 -27 -47 c-81 -136 -257 -255 -494 -333 -159 -53 -216 -76 -283 -117 -155 -94 -260 -224 -319 -393 -40 -117 -49 -212 -49 -500 l1 -274 25 -26 c35 -35 123 -36 157 -2 23 22 23 27 29 320 5 255 8 307 25 367 64 224 192 350 434 428 146 48 177 50 302 28 234 -41 371 -54 563 -55 460 -1 786 101 1025 321 l65 60 105 -9 c331 -27 708 55 938 205 200 131 331 300 387 502 25 91 31 291 11 400 -9 50 -18 99 -21 110 -5 16 9 31 64 73 92 70 244 230 305 321 101 152 159 291 196 471 132 646 -253 1267 -977 1578 -50 21 -52 24 -58 70 -65 488 -433 871 -976 1016 -156 41 -285 58 -470 59 l-171 2 -24 -28 c-33 -39 -31 -81 5 -118 l29 -29 150 0 c510 0 949 -224 1142 -582 76 -142 115 -283 119 -435 l1 -52 78 -30 c186 -71 327 -148 457 -248 353 -272 531 -627 512 -1017 -15 -290 -135 -538 -368 -761 -52 -50 -129 -115 -171 -145 -85 -60 -89 -70 -62 -136 23 -55 51 -198 53 -274 4 -143 -50 -304 -142 -426 -117 -154 -333 -272 -607 -330 -87 -18 -380 -27 -396 -12 -4 4 -2 13 4 20 27 34 66 201 76 328 2 19 4 380 5 803 1 738 2 767 19 767 11 0 47 14 81 31 205 102 298 328 222 543 -74 212 -302 333 -533 285 -77 -16 -180 -74 -233 -130 -82 -87 -135 -242 -120 -344 28 -181 140 -323 298 -376 l52 -18 0 -793 c0 -891 1 -871 -74 -1033 -84 -179 -226 -296 -461 -380 -152 -54 -403 -88 -585 -79 -141 7 -375 30 -383 39 -4 4 2 11 13 17 40 21 191 185 225 244 l35 62 57 5 c105 9 214 76 262 161 31 53 49 144 42 204 -15 111 -109 237 -197 264 l-39 11 -2 2026 -3 2026 -29 58 c-68 139 -240 208 -516 205 -69 0 -138 -3 -155 -5z m-675 -1313 c220 -112 177 -430 -65 -480 -151 -31 -300 93 -300 250 0 108 76 213 175 245 56 18 138 12 190 -15z m2656 -1035 c69 -20 125 -65 160 -127 38 -69 41 -170 7 -234 -70 -131 -234 -182 -358 -110 -190 112 -162 395 47 467 65 22 81 23 144 4z m-3767 -518 c123 -62 173 -222 106 -345 -69 -126 -213 -173 -334 -107 -66 36 -107 85 -126 149 -20 67 -19 105 6 170 51 138 213 200 348 133z m2463 -1639 c66 -46 81 -141 33 -203 -76 -101 -209 -79 -250 41 -9 27 -10 47 -2 76 11 45 64 104 99 111 37 8 90 -3 120 -25z"/>
                    </g>
                </svg>
            </div>
            <div id="form-school-badge">
                <div id="form-school-dot"></div>
                <span id="form-school-name"><?= htmlspecialchars($schoolName) ?></span>
            </div>
        </div>
        <!-- LOGIN FORM -->
        <div class="form-box <?= isActiveForm('login', $activeForm); ?>" id="login-form">
            <form id="login-form-el" novalidate>
                <!-- iSkool brand text -->
                <div id="iskool-brand">
                   <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="120.000000pt" height="120.000000pt" viewBox="0 0 880.000000 805.000000"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
</metadata>
<g transform="translate(0.000000,805.000000) scale(0.100000,-0.100000)"
fill="#a09d9dff" stroke="none">
<path d="M4275 7173 c-274 -35 -556 -150 -692 -282 -31 -30 -35 -31 -125 -31
-149 0 -352 -26 -498 -64 -507 -130 -844 -438 -956 -875 -13 -51 -24 -108 -24
-125 0 -30 -3 -33 -77 -60 -185 -68 -397 -186 -563 -315 -353 -274 -571 -613
-662 -1031 -19 -91 -23 -133 -22 -310 0 -175 3 -220 23 -310 144 -668 664
-1198 1361 -1388 168 -46 276 -63 450 -69 460 -17 809 126 994 407 56 85 81
146 102 250 16 78 17 167 11 1157 l-5 1073 41 11 c156 41 276 181 309 358 19
106 -33 272 -113 360 -143 156 -416 188 -598 71 -181 -115 -248 -356 -156
-558 44 -97 160 -197 268 -232 l37 -12 0 -1101 0 -1102 -24 -66 c-26 -74 -86
-167 -143 -221 -178 -169 -506 -248 -848 -204 -295 38 -533 126 -772 286 -149
99 -270 204 -361 312 -84 100 -196 269 -185 278 4 4 225 100 491 214 l484 207
41 -42 c143 -143 399 -159 575 -36 181 126 239 356 141 555 -132 269 -520 327
-734 108 -90 -93 -132 -212 -121 -346 6 -75 5 -79 -17 -86 -22 -7 -543 -230
-802 -343 -76 -34 -142 -61 -145 -61 -12 0 -60 169 -81 285 -18 103 -20 144
-16 290 3 102 12 200 22 245 64 289 202 537 419 756 221 221 486 385 761 470
50 15 93 32 96 37 4 5 9 43 13 86 20 220 106 414 253 571 96 103 164 155 284
219 217 116 459 171 751 171 l179 0 57 53 c115 108 254 181 440 229 106 28
133 31 277 32 173 1 244 -12 300 -56 59 -46 55 86 55 -2077 l0 -1990 -50 -22
c-67 -29 -141 -109 -168 -182 -44 -117 -22 -243 58 -338 l41 -49 -27 -47 c-81
-136 -257 -255 -494 -333 -159 -53 -216 -76 -283 -117 -155 -94 -260 -224
-319 -393 -40 -117 -49 -212 -49 -500 l1 -274 25 -26 c35 -35 123 -36 157 -2
23 22 23 27 29 320 5 255 8 307 25 367 64 224 192 350 434 428 146 48 177 50
302 28 234 -41 371 -54 563 -55 460 -1 786 101 1025 321 l65 60 105 -9 c331
-27 708 55 938 205 200 131 331 300 387 502 25 91 31 291 11 400 -9 50 -18 99
-21 110 -5 16 9 31 64 73 92 70 244 230 305 321 101 152 159 291 196 471 132
646 -253 1267 -977 1578 -50 21 -52 24 -58 70 -65 488 -433 871 -976 1016
-156 41 -285 58 -470 59 l-171 2 -24 -28 c-33 -39 -31 -81 5 -118 l29 -29 150
0 c510 0 949 -224 1142 -582 76 -142 115 -283 119 -435 l1 -52 78 -30 c186
-71 327 -148 457 -248 353 -272 531 -627 512 -1017 -15 -290 -135 -538 -368
-761 -52 -50 -129 -115 -171 -145 -85 -60 -89 -70 -62 -136 23 -55 51 -198 53
-274 4 -143 -50 -304 -142 -426 -117 -154 -333 -272 -607 -330 -87 -18 -380
-27 -396 -12 -4 4 -2 13 4 20 27 34 66 201 76 328 2 19 4 380 5 803 1 738 2
767 19 767 11 0 47 14 81 31 205 102 298 328 222 543 -74 212 -302 333 -533
285 -77 -16 -180 -74 -233 -130 -82 -87 -135 -242 -120 -344 28 -181 140 -323
298 -376 l52 -18 0 -793 c0 -891 1 -871 -74 -1033 -84 -179 -226 -296 -461
-380 -152 -54 -403 -88 -585 -79 -141 7 -375 30 -383 39 -4 4 2 11 13 17 40
21 191 185 225 244 l35 62 57 5 c105 9 214 76 262 161 31 53 49 144 42 204
-15 111 -109 237 -197 264 l-39 11 -2 2026 -3 2026 -29 58 c-68 139 -240 208
-516 205 -69 0 -138 -3 -155 -5z m-675 -1313 c220 -112 177 -430 -65 -480
-151 -31 -300 93 -300 250 0 108 76 213 175 245 56 18 138 12 190 -15z m2656
-1035 c69 -20 125 -65 160 -127 38 -69 41 -170 7 -234 -70 -131 -234 -182
-358 -110 -190 112 -162 395 47 467 65 22 81 23 144 4z m-3767 -518 c123 -62
173 -222 106 -345 -69 -126 -213 -173 -334 -107 -66 36 -107 85 -126 149 -20
67 -19 105 6 170 51 138 213 200 348 133z m2463 -1639 c66 -46 81 -141 33
-203 -76 -101 -209 -79 -250 41 -9 27 -10 47 -2 76 11 45 64 104 99 111 37 8
90 -3 120 -25z"/>
</g>
</svg>
                </div>
                <!-- AJAX error message box (hidden until an error occurs) -->
                <div id="login-error-box" style="display:none;background:rgba(255,77,77,0.10);border:1px solid rgba(255,77,77,0.3);color:#ff6b6b;font-size:14px;padding:11px 16px;border-radius:12px;margin-bottom:16px;text-align:center;"></div>
                <input type="email" name="email" placeholder="Email" required><br>
                <div class="password-wrapper">
                    <input type="password" name="password" id="login-password" placeholder="Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('login-password', this)"></i>
                </div>
                 <div style="display: flex; align-items: center; margin: 10px 0 15px 10px; text-align: left;">
                  <input type="checkbox" name="remember_me" id="remember_me" style="width: 16px; height: 16px; margin: 0 10px 0 0; cursor: pointer;">
                  <label for="remember_me" style="font-size: 13px; color: #ccc; cursor: pointer; user-select: none;">Keep me logged in</label>
                </div>
                <button type="submit" id="login-btn">Login</button>
                <p>Don't have an account? 
                   <a href="#" onclick="showForm('register-form'); return false;">Register</a>
                </p>
                <p style="text-align:center; margin-top: 8px;">
                    <a href="#" onclick="showForm('forgot-form'); return false;" style="color:#00bfff;">Forgot your password?</a>
                </p>
            </form><!-- /#login-form-el -->
        </div>
        <!-- REGISTER FORM -->
        <div class="form-box <?= isActiveForm('register', $activeForm); ?>" id="register-form">
            <form id="register-form-el" novalidate>
                <h2>Register</h2>
                <!-- AJAX error message box (hidden until an error occurs) -->
                <div id="register-error-box" style="display:none;background:rgba(255,77,77,0.10);border:1px solid rgba(255,77,77,0.3);color:#ff6b6b;font-size:14px;padding:11px 16px;border-radius:12px;margin-bottom:16px;text-align:center;"></div>

                <!-- NEW: Title + First Name + Surname -->
                <div class="name-row">
                    <select name="title" required>
                        <option value="" disabled selected>Title</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Dr">Dr</option>
                        <option value="Prof">Prof</option>
                        <option value="Rev">Rev</option>
                    </select>
                    <input type="text" name="name" placeholder="First Name" required>
                    <input type="text" name="surname" placeholder="Surname" required>
                </div>

                <input type="email" name="email" placeholder="Email" required>
                <div class="password-wrapper">
                    <input type="password" name="password" id="register-password" placeholder="Password (min. 8 characters)" required minlength="8">
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('register-password', this)"></i>
                </div>
                <div id="password-strength-msg" style="font-size:12px; color:#ff5555; margin: -6px 0 8px 12px; display:none;">Password must be at least 8 characters.</div>
                <div class="password-wrapper">
                    <input type="password" name="confirm_password" id="confirm-password" placeholder="Confirm Password" required>
                    <i class="fas fa-eye toggle-password" onclick="togglePassword('confirm-password', this)"></i>
                </div>
                <div id="password-match-msg" style="font-size:12px; color:#ff5555; margin: -6px 0 8px 12px; display:none;">Passwords do not match.</div>

                <label>Select Role:</label>
                <select name="role" required>
                    <option value="">-- Select Role --</option>
                    <option value="learner">Learner</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                    <option value="school_admin">Principal/School Admin</option>
                </select><br>
                <label for="gender">Gender:</label>
                <select name="gender" id="gender" required>
                    <option value="" disabled selected>Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                </select><br>
                <label for="age">Age:</label>
                <input type="number" name="age" id="age" min="3" max="120" required placeholder="Enter your age"><br>
                <input type="text" name="access_key" placeholder="Enter Access Key" required><br>

                <!-- NEW: Notification Agreement Checkbox -->
                <div style="margin: 15px 0; text-align: left; padding: 0 20px;">
                    <label style="font-size: 13px; color: #ccc; cursor: pointer;">
                        <input type="checkbox" name="agree_notifications" required style="margin-right: 8px;">
                        I agree to receive notifications for important updates, replies, announcements, and grades.
                    </label>
                </div>

                <button type="submit" id="register-btn">Register</button>
                <p>Already have an account? 
                   <a href="#" onclick="showForm('login-form'); return false;">Login</a>
                </p>
            </form><!-- /#register-form-el -->
        </div>
        <!-- FORGOT PASSWORD FORM -->
        <div class="form-box <?= ($activeForm === 'forgot-form') ? 'active' : '' ?>" id="forgot-form">
            <h2>Forgot password?</h2>
            <p style="color:#888; font-size:14px; margin-bottom:20px; text-align:center;">Enter your email and we'll send you a reset link.</p>

            <?php if (!empty($resetMessage)): ?>
                <div style="color:#00ff99; font-size:14px; background:rgba(0,255,153,0.1); padding:10px; border-radius:12px; margin-bottom:16px; text-align:center;">
                    <?= htmlspecialchars($resetMessage) ?>
                </div>
            <?php endif; ?>
            <?php if (!empty($resetError)): ?>
                <div style="color:#ff4d4d; font-size:14px; background:rgba(255,77,77,0.1); padding:10px; border-radius:12px; margin-bottom:16px; text-align:center;">
                    <?= htmlspecialchars($resetError) ?>
                </div>
            <?php endif; ?>

            <form action="send_reset_link.php" method="POST">
                <input type="email" name="email" placeholder="Email address" required>
                <button type="submit">Send Reset Link</button>
            </form>
            <p style="text-align:center; margin-top:20px;">
                <a href="#" onclick="showForm('login-form'); return false;" style="color:#888; font-size:14px;">← Back to login</a>
            </p>
        </div>
        </div><!-- /.form-panel -->
    </div><!-- /.container -->
    <div id="loaderOverlay">
        <div class="loader-container">
            <div class="loader-book">
                <i class="fas fa-book-open"></i>
            </div>
            <div class="loader-text">Processing...</div>
        </div>
    </div>
    <script>
    // ── Form switcher ──────────────────────────────────────────────────────────
    function showForm(id) {
        document.querySelectorAll('.form-box').forEach(f => f.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const panel = document.querySelector('.form-panel');
        if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Show glowing logo loader first, then fade out and show container + brand
    window.onload = function () {
        const animationWrapper = document.getElementById('animation-wrapper');
        const container = document.querySelector('.container');
        const iskoolBrand = document.getElementById('iskool-brand');
        // Set to 2.0 seconds (2500ms)
         const timeout = 2500;
        setTimeout(() => {
    animationWrapper.style.opacity = '0';
    setTimeout(() => {
        animationWrapper.style.display = 'none';

        // ──────── AFTER ANIMATION: CHECK IF LOGGED IN ────────
        <?php if (isset($_SESSION['email']) && isset($_SESSION['role'])): ?>
            // Logged in → go straight to dashboard
            <?php if ($_SESSION['role'] === 'teacher'): ?>
                window.location.href = 'teacher_dashboard.php';
            <?php else: ?>
                window.location.href = 'learner_dashboard.php';
            <?php endif; ?>
        <?php else: ?>
            // Not logged in → show login form
            document.querySelector('.form-panel').style.opacity = '1';
            container.classList.add('show');
           
        <?php endif; ?>
        // ─────────────────────────────────────────────────────

          }, 800);
         }, timeout);
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const activeForm = "<?= $activeForm ?>";
        if (activeForm === 'login') {
            loginForm.classList.add('active');
        } else {
            registerForm.classList.add('active');
        }
    };
    // Toggle password visibility
    function togglePassword(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }

    // Password validation for register form
    const regPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');
    const strengthMsg = document.getElementById('password-strength-msg');
    const matchMsg = document.getElementById('password-match-msg');
    const loader = document.getElementById("loaderOverlay");

    regPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value.length < 8) {
            strengthMsg.style.display = 'block';
        } else {
            strengthMsg.style.display = 'none';
        }
    });

    confirmPassword.addEventListener('input', function() {
        if (this.value.length > 0 && this.value !== regPassword.value) {
            matchMsg.style.display = 'block';
        } else {
            matchMsg.style.display = 'none';
        }
    });

    // Form submit handlers
    document.querySelectorAll("form").forEach(form => {
        form.addEventListener("submit", function(e) {
            // Only validate register form
            if (this.querySelector('#register-password')) {
                const pwd = regPassword.value;
                const confirmPwd = confirmPassword.value;

                if (pwd.length < 8) {
                    e.preventDefault();
                    strengthMsg.style.display = 'block';
                    regPassword.focus();
                    return;
                }
                if (pwd !== confirmPwd) {
                    e.preventDefault();
                    matchMsg.style.display = 'block';
                    confirmPassword.focus();
                    return;
                }
            }
            loader.classList.add("show");
        });
    });
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.error("Service Worker failed", err));
    }

    // ── Preview panel animation (5-card one-at-a-time loop) ──
    const pvDelay = ms => new Promise(r => setTimeout(r, ms));

    function pvCountUp(el, target, suffix, duration) {
        let val = 0;
        const steps = 40, inc = target / steps, iv = duration / steps;
        const t = setInterval(() => {
            val = Math.min(val + inc, target);
            el.textContent = Math.round(val).toLocaleString() + suffix;
            if (val >= target) clearInterval(t);
        }, iv);
    }

    function pvAnimBar(fillEl, lblEl, pct, duration) {
        fillEl.style.width = pct + '%';
        let val = 0;
        const steps = 40, inc = pct / steps, iv = duration / steps;
        const t = setInterval(() => {
            val = Math.min(val + inc, pct);
            lblEl.textContent = Math.round(val) + '%';
            if (val >= pct) clearInterval(t);
        }, iv);
    }

    function pvShow(id) {
        const el = document.getElementById(id);
        el.style.transition = '';
        el.classList.remove('pv-exit');
        el.classList.add('pv-visible');
    }

    async function pvHide(id) {
        const el = document.getElementById(id);
        el.classList.add('pv-exit');
        await pvDelay(450);
        el.classList.remove('pv-visible', 'pv-exit');
    }

    // ── Card 1: Class Discussion ──
    async function pvCard1() {
        pvShow('pv1');
        await pvDelay(500);
        document.getElementById('pv-b1').classList.add('pv-vis');
        await pvDelay(700);
        document.getElementById('pv-typing').classList.add('pv-vis');
        await pvDelay(1400);
        document.getElementById('pv-typing').style.opacity = '0';
        await pvDelay(250);
        document.getElementById('pv-b2').classList.add('pv-vis');
        await pvDelay(700);
        document.getElementById('pv-b3').classList.add('pv-vis');
        await pvDelay(600);
        document.getElementById('pv-b4').classList.add('pv-vis');
        await pvDelay(2200);
        await pvHide('pv1');
        // reset
        ['pv-b1','pv-b2','pv-b3','pv-b4'].forEach(id => document.getElementById(id).classList.remove('pv-vis'));
        document.getElementById('pv-typing').classList.remove('pv-vis');
        document.getElementById('pv-typing').style.opacity = '';
    }

    // ── Card 2: Announcements ──
    async function pvCard2() {
        pvShow('pv2');
        await pvDelay(400);
        for (let i = 1; i <= 3; i++) {
            await pvDelay(260);
            document.getElementById('pv-a' + i).classList.add('pv-vis');
        }
        await pvDelay(2800);
        await pvHide('pv2');
        for (let i = 1; i <= 3; i++) document.getElementById('pv-a' + i).classList.remove('pv-vis');
    }

    // ── Card 3: Auto Quiz ──
    async function pvCard3() {
        pvShow('pv3');
        await pvDelay(450);
        document.getElementById('pv-qq').classList.add('pv-vis');
        await pvDelay(400);
        for (let i = 1; i <= 3; i++) {
            await pvDelay(200);
            document.getElementById('pv-qo' + i).classList.add('pv-vis');
        }
        await pvDelay(900);
        // wrong answer selected first
        document.getElementById('pv-qo1').classList.add('wrong');
        await pvDelay(900);
        document.getElementById('pv-qo1').classList.remove('wrong');
        await pvDelay(300);
        // correct answer
        document.getElementById('pv-qo2').classList.add('selected');
        await pvDelay(2400);
        await pvHide('pv3');
        document.getElementById('pv-qq').classList.remove('pv-vis');
        for (let i = 1; i <= 3; i++) {
            const o = document.getElementById('pv-qo' + i);
            o.classList.remove('pv-vis','selected','wrong');
        }
    }

    // ── Card 4: Teacher Analytics ──
    async function pvCard4() {
        pvShow('pv4');
        await pvDelay(450);
        pvCountUp(document.getElementById('pv-sn1'), 742, '', 900);
        pvCountUp(document.getElementById('pv-sn2'), 58, '', 900);
        pvCountUp(document.getElementById('pv-sn3'), 91, '%', 900);
        await pvDelay(300);
        pvAnimBar(document.getElementById('pv-bf1'), document.getElementById('pv-bl1'), 82, 1100);
        await pvDelay(200);
        pvAnimBar(document.getElementById('pv-bf2'), document.getElementById('pv-bl2'), 67, 1100);
        await pvDelay(3200);
        await pvHide('pv4');
        document.getElementById('pv-sn1').textContent = '0';
        document.getElementById('pv-sn2').textContent = '0';
        document.getElementById('pv-sn3').textContent = '0%';
        document.getElementById('pv-bf1').style.width = '0%'; document.getElementById('pv-bl1').textContent = '0%';
        document.getElementById('pv-bf2').style.width = '0%'; document.getElementById('pv-bl2').textContent = '0%';
    }

    // ── Card 5: AI Invigilator ──
    async function pvCard5() {
        pvShow('pv5');
        await pvDelay(400);
        document.getElementById('pv-inv-screen').classList.add('pv-vis');
        await pvDelay(1800);
        // flash alert on face 4
        document.getElementById('pv-if4').classList.add('alert');
        document.getElementById('pv-inv-badge').className = 'pv-inv-badge warn';
        document.getElementById('pv-inv-badge').textContent = '⚠ ALERT';
        document.getElementById('pv-inv-sub').textContent = 'Suspicious activity flagged';
        await pvDelay(500);
        document.getElementById('pv-inv-alert').classList.add('pv-vis');
        await pvDelay(2800);
        await pvHide('pv5');
        // reset
        document.getElementById('pv-inv-screen').classList.remove('pv-vis');
        document.getElementById('pv-if4').classList.remove('alert');
        document.getElementById('pv-inv-badge').className = 'pv-inv-badge active';
        document.getElementById('pv-inv-badge').textContent = '● LIVE';
        document.getElementById('pv-inv-sub').textContent = 'Monitoring exam session';
        document.getElementById('pv-inv-alert').classList.remove('pv-vis');
    }

    // ── Card 6: Academic Calendar ──
    async function pvCard6() {
        pvShow('pv6');
        await pvDelay(350);
        document.getElementById('pv-cal-month').classList.add('pv-vis');
        await pvDelay(200);
        for (let i = 1; i <= 14; i++) {
            await pvDelay(60);
            document.getElementById('pvc-' + i).classList.add('pv-vis');
        }
        await pvDelay(400);
        for (let i = 1; i <= 3; i++) {
            await pvDelay(250);
            document.getElementById('pv-ev' + i).classList.add('pv-vis');
        }
        await pvDelay(2500);
        await pvHide('pv6');
        document.getElementById('pv-cal-month').classList.remove('pv-vis');
        for (let i = 1; i <= 14; i++) document.getElementById('pvc-' + i).classList.remove('pv-vis');
        for (let i = 1; i <= 3; i++) document.getElementById('pv-ev' + i).classList.remove('pv-vis');
    }

    // ── Card 7: Learner Dashboard ──
    async function pvCard7() {
        const subjects = [
            { id: 1, pct: 88, label: '88%' },
            { id: 2, pct: 74, label: '74%' },
            { id: 3, pct: 71, label: '71%' },
            { id: 4, pct: 68, label: '68%' },
        ];
        pvShow('pv7');
        await pvDelay(400);
        for (const s of subjects) {
            await pvDelay(220);
            document.getElementById('pv-sr' + s.id).classList.add('pv-vis');
            await pvDelay(100);
            document.getElementById('pv-sf' + s.id).style.width = s.pct + '%';
            pvCountUp(document.getElementById('pv-sp' + s.id), s.pct, '%', 900);
        }
        await pvDelay(2600);
        await pvHide('pv7');
        for (let i = 1; i <= 4; i++) {
            document.getElementById('pv-sr' + i).classList.remove('pv-vis');
            document.getElementById('pv-sf' + i).style.width = '0%';
            document.getElementById('pv-sp' + i).textContent = '0%';
        }
    }

    // ── Card 8: Admin Dashboard ──
    async function pvCard8() {
        pvShow('pv8');
        await pvDelay(350);
        for (let i = 1; i <= 4; i++) {
            await pvDelay(150);
            document.getElementById('pv-ab' + i).classList.add('pv-vis');
        }
        await pvDelay(300);
        pvCountUp(document.getElementById('pv-an1'), 742, '', 1000);
        pvCountUp(document.getElementById('pv-an2'), 58, '', 1000);
        pvCountUp(document.getElementById('pv-an3'), 24, '', 1000);
        pvCountUp(document.getElementById('pv-an4'), 91, '%', 1000);
        await pvDelay(600);
        for (let i = 1; i <= 3; i++) {
            await pvDelay(200);
            document.getElementById('pv-ar' + i).classList.add('pv-vis');
        }
        await pvDelay(2600);
        await pvHide('pv8');
        for (let i = 1; i <= 4; i++) document.getElementById('pv-ab' + i).classList.remove('pv-vis');
        ['pv-an1','pv-an2','pv-an3'].forEach(id => document.getElementById(id).textContent = '0');
        document.getElementById('pv-an4').textContent = '0%';
        for (let i = 1; i <= 3; i++) document.getElementById('pv-ar' + i).classList.remove('pv-vis');
    }

    // ── Card 9: Auto Grading ──
    async function pvCard9() {
        const qs = [
            { id: 1, scored: 9,  total: 10, pct: 90,  cls: 'correct', label: '9/10'  },
            { id: 2, scored: 8,  total: 10, pct: 80,  cls: 'correct', label: '8/10'  },
            { id: 3, scored: 10, total: 15, pct: 67,  cls: 'partial', label: '10/15' },
            { id: 4, scored: 5,  total: 15, pct: 33,  cls: 'wrong',   label: '5/15'  },
        ];
        pvShow('pv9');
        await pvDelay(350);
        document.getElementById('pv-gh').classList.add('pv-vis');
        await pvDelay(300);
        let runningTotal = 0;
        for (const q of qs) {
            await pvDelay(280);
            document.getElementById('pv-qr' + q.id).classList.add('pv-vis');
            await pvDelay(120);
            document.getElementById('pv-qb' + q.id).style.width = q.pct + '%';
            document.getElementById('pv-qm' + q.id).textContent = q.label;
            document.getElementById('pv-qm' + q.id).className = 'pv-q-mark ' + q.cls;
            runningTotal += q.scored;
            pvCountUp(document.getElementById('pv-gtotal'), runningTotal, '', 400);
        }
        await pvDelay(2500);
        await pvHide('pv9');
        document.getElementById('pv-gh').classList.remove('pv-vis');
        document.getElementById('pv-gtotal').textContent = '0';
        for (let i = 1; i <= 4; i++) {
            document.getElementById('pv-qr' + i).classList.remove('pv-vis');
            document.getElementById('pv-qb' + i).style.width = '0%';
            document.getElementById('pv-qm' + i).textContent = '0/' + (i <= 2 ? '10' : '15');
        }
    }

    // ── Card 0: Typewriter Intro (plays once at start) ──
    async function pvTypewriter(elId, text, speed) {
        const el = document.getElementById(elId);
        el.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'pv-tw-cursor';
        el.appendChild(cursor);
        for (let i = 0; i < text.length; i++) {
            el.insertBefore(document.createTextNode(text[i]), cursor);
            await pvDelay(speed);
        }
        return cursor;
    }

    async function pvCard0() {
        pvShow('pv0');
        await pvDelay(400);
        // Line 1
        const c1 = await pvTypewriter('pv-tw1', 'Get a glimpse of iSkool', 52);
        await pvDelay(700);
        c1.remove();
        // Line 2 fades in via typewriter
        const c2 = await pvTypewriter('pv-tw2', 'A smarter way to run your school.', 44);
        await pvDelay(1200);
        c2.remove();
        await pvDelay(400);
        await pvHide('pv0');
        // Reset lines
        document.getElementById('pv-tw1').innerHTML = '';
        document.getElementById('pv-tw2').innerHTML = '';
    }


    // ── Card 10: Teacher Evaluations ──
    async function pvCard10() {
        pvShow('pv10');
        await pvDelay(350);
        // Sidebar items slide in
        for (let i = 1; i <= 3; i++) {
            await pvDelay(200);
            document.getElementById('pv-ev-i' + i).classList.add('pv-vis');
        }
        await pvDelay(300);
        // Question fades in
        document.getElementById('pv-eval-q').classList.add('pv-vis');
        await pvDelay(300);
        // Options appear
        for (let i = 1; i <= 3; i++) {
            await pvDelay(180);
            document.getElementById('pv-eopt' + i).classList.add('pv-vis');
        }
        await pvDelay(800);
        // User selects "Agree"
        document.getElementById('pv-eopt2').classList.add('selected');
        await pvDelay(2200);
        await pvHide('pv10');
        // Reset
        for (let i = 1; i <= 3; i++) {
            document.getElementById('pv-ev-i' + i).classList.remove('pv-vis');
            document.getElementById('pv-eopt' + i).classList.remove('pv-vis', 'selected');
        }
        document.getElementById('pv-eval-q').classList.remove('pv-vis');
    }

    // ── Card 11: Subject Brief & Outline ──
    async function pvCard11() {
        pvShow('pv11');
        await pvDelay(350);
        // Tabs fade in
        document.getElementById('pv11').querySelector('.pv-syl-tabs').classList.add('pv-vis');
        await pvDelay(400);
        // Brief card appears
        document.getElementById('pv-syl-card').classList.add('pv-vis');
        await pvDelay(350);
        // Topics slide in
        for (const id of ['pv-sta', 'pv-stb', 'pv-stc']) {
            await pvDelay(220);
            document.getElementById(id).classList.add('pv-vis');
        }
        await pvDelay(300);
        // Assessment rows + bars
        document.getElementById('pv-sa1').classList.add('pv-vis');
        document.getElementById('pv-sab1').style.width = '40%';
        await pvDelay(220);
        document.getElementById('pv-sa2').classList.add('pv-vis');
        document.getElementById('pv-sab2').style.width = '30%';
        await pvDelay(2600);
        await pvHide('pv11');
        // Reset
        document.getElementById('pv11').querySelector('.pv-syl-tabs').classList.remove('pv-vis');
        document.getElementById('pv-syl-card').classList.remove('pv-vis');
        for (const id of ['pv-sta', 'pv-stb', 'pv-stc']) document.getElementById(id).classList.remove('pv-vis');
        document.getElementById('pv-sa1').classList.remove('pv-vis');
        document.getElementById('pv-sa2').classList.remove('pv-vis');
        document.getElementById('pv-sab1').style.width = '0%';
        document.getElementById('pv-sab2').style.width = '0%';
    }

    async function runPreview() {
        await pvDelay(600);
        // Play intro once, then loop cards
        await pvCard0();
        await pvDelay(350);
        while (true) {
            await pvCard1();
            await pvDelay(350);
            await pvCard2();
            await pvDelay(350);
            await pvCard3();
            await pvDelay(350);
            await pvCard4();
            await pvDelay(350);
            await pvCard5();
            await pvDelay(350);
            await pvCard6();
            await pvDelay(350);
            await pvCard7();
            await pvDelay(350);
            await pvCard8();
            await pvDelay(350);
            await pvCard9();
            await pvDelay(350);
            await pvCard10();
            await pvDelay(350);
            await pvCard11();
            await pvDelay(350);
        }
    }

    <script>
    // ── AJAX Login ─────────────────────────────────────────────────────────────
    document.getElementById('login-form-el').addEventListener('submit', async function (e) {
        e.preventDefault();

        const btn      = document.getElementById('login-btn');
        const errorBox = document.getElementById('login-error-box');

        // Clear any previous error
        errorBox.style.display = 'none';
        errorBox.textContent   = '';

        // Show loading state
        btn.disabled    = true;
        btn.textContent = 'Logging in…';

        const formData = new FormData(this);
        // Pass the remember_me checkbox value explicitly
        if (!this.querySelector('[name="remember_me"]').checked) {
            formData.delete('remember_me');
        }

        try {
            const res  = await fetch('login_ajax.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.success) {
                btn.textContent = 'Redirecting…';
                window.location.href = data.redirect;
            } else {
                // Show error inline — no page reload
                errorBox.textContent   = data.message || 'Something went wrong. Please try again.';
                errorBox.style.display = 'block';
                // Scroll error into view on mobile
                errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.disabled    = false;
                btn.textContent = 'Login';
            }
        } catch (err) {
            errorBox.textContent   = 'Network error. Please check your connection and try again.';
            errorBox.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Login';
        }
    });

    // ── AJAX Register ───────────────────────────────────────────────────────────
    document.getElementById('register-form-el').addEventListener('submit', async function (e) {
        e.preventDefault();

        const btn      = document.getElementById('register-btn');
        const errorBox = document.getElementById('register-error-box');

        // Clear previous error
        errorBox.style.display = 'none';
        errorBox.textContent   = '';

        // Client-side password checks before hitting the server
        const pwd     = document.getElementById('register-password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (pwd.length < 8) {
            errorBox.textContent   = 'Password must be at least 8 characters long.';
            errorBox.style.display = 'block';
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        if (pwd !== confirm) {
            errorBox.textContent   = 'Passwords do not match. Please try again.';
            errorBox.style.display = 'block';
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Registering…';

        const formData = new FormData(this);

        try {
            const res  = await fetch('register_ajax.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.success) {
                btn.textContent = 'Success! Redirecting…';
                window.location.href = 'registration_success.php';
            } else {
                errorBox.textContent   = data.message || 'Registration failed. Please try again.';
                errorBox.style.display = 'block';
                errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                btn.disabled    = false;
                btn.textContent = 'Register';
            }
        } catch (err) {
            errorBox.textContent   = 'Network error. Please check your connection and try again.';
            errorBox.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Register';
        }
    });
    </script>
</body>
</html>