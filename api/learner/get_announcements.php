<?php
/**
 * iSkool — api/learner/get_announcements.php
 * Role: learner
 * Returns:
 *   {
 *     "school": [ { title, message, created_at, display_date } ],
 *     "teachers": { "Mr A. Smith": [ {...}, ... ], ... }
 *   }
 *
 * "school" = school-wide announcements sent by admin (class_id IS NULL, target_role IN ('all','learners'))
 * "teachers" = class-level announcements grouped by teacher display name
 */

require_once __DIR__ . '/../../auth/session_guard.php';
require_once dirname(__DIR__, 2) . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'learner') {
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

$email = $_SESSION['email'];

/**
 * Build a display name like "Mr SK.Mahlangu" (name=Sipho, second_name=Kagiso, surname=Mahlangu)
 * or "Mr S.Mahlangu" when there's no second_name.
 * Also returns 2-letter avatar initials: always first-name-initial + surname-initial (e.g. "SM").
 */
function buildTeacherNameParts(?string $title, ?string $name, ?string $secondName, ?string $surname): array {
    $name = trim((string)$name);
    $secondName = trim((string)$secondName);
    $surname = trim((string)$surname);
    $title = trim((string)$title);

    if ($name === '' && $surname === '') {
        return ['display' => 'Teacher', 'initials' => 'T'];
    }

    $firstInitial = $name !== '' ? mb_strtoupper(mb_substr($name, 0, 1)) : '';
    $secondInitial = $secondName !== '' ? mb_strtoupper(mb_substr($secondName, 0, 1)) : '';
    $surnameForDisplay = $surname !== '' ? $surname : 'Teacher';

    $initialsBlock = $firstInitial . $secondInitial;
    $display = trim(($title !== '' ? $title . ' ' : '') . $initialsBlock . '.' . $surnameForDisplay);

    // Avatar initials: always just first-name initial + surname initial
    $surnameInitial = $surname !== '' ? mb_strtoupper(mb_substr($surname, 0, 1)) : '';
    $avatarInitials = ($firstInitial . $surnameInitial) ?: 'T';

    return ['display' => $display, 'initials' => $avatarInitials];
}

function getInitials(string $text): string {
    $text = trim($text);
    if ($text === '') return '?';
    $words = preg_split('/\s+/', $text);
    if (count($words) === 1) {
        return mb_strtoupper(mb_substr($words[0], 0, 1));
    }
    return mb_strtoupper(mb_substr($words[0], 0, 1) . mb_substr(end($words), 0, 1));
}

/**
 * Word-level diff for edited announcements: returns $current as safe HTML,
 * with words/punctuation runs that are new relative to $original wrapped
 * in a highlight span (styled orange on the frontend). Deleted text is not
 * shown — learners only ever see the current message, just with the new
 * or changed parts called out.
 *
 * Tokenizes into word-runs vs. everything-else-runs (whitespace, punctuation)
 * so exact spacing is preserved, then finds the longest common subsequence
 * of tokens between the two versions. Anything in $current not part of
 * that common subsequence is "new" and gets wrapped. Consecutive new
 * tokens are merged into a single span rather than one span per word.
 *
 * All output is passed through htmlspecialchars — the returned string is
 * safe to inject directly (no further escaping should be applied to it).
 */
function buildAnnouncementDiffHtml(string $original, string $current): string {
    if ($original === $current) {
        return nl2br(htmlspecialchars($current));
    }

    $tokenize = function (string $text): array {
        preg_match_all("/[\p{L}\p{N}']+|[^\p{L}\p{N}']+/u", $text, $matches);
        return $matches[0];
    };

    $origTokens = $tokenize($original);
    $curTokens  = $tokenize($current);

    $n = count($origTokens);
    $m = count($curTokens);

    // LCS length table over tokens (exact match per token).
    $dp = array_fill(0, $n + 1, array_fill(0, $m + 1, 0));
    for ($i = 1; $i <= $n; $i++) {
        for ($j = 1; $j <= $m; $j++) {
            if ($origTokens[$i - 1] === $curTokens[$j - 1]) {
                $dp[$i][$j] = $dp[$i - 1][$j - 1] + 1;
            } else {
                $dp[$i][$j] = max($dp[$i - 1][$j], $dp[$i][$j - 1]);
            }
        }
    }

    // Walk back marking which $curTokens indices are part of the LCS
    // (i.e. unchanged / carried over from the original).
    $keptInCurrent = array_fill(0, $m, false);
    $i = $n;
    $j = $m;
    while ($i > 0 && $j > 0) {
        if ($origTokens[$i - 1] === $curTokens[$j - 1]) {
            $keptInCurrent[$j - 1] = true;
            $i--;
            $j--;
        } elseif ($dp[$i - 1][$j] >= $dp[$i][$j - 1]) {
            $i--;
        } else {
            $j--;
        }
    }

    // Walk forward through $curTokens, grouping consecutive new/unchanged
    // runs so we emit one span per run rather than one span per word.
    $html = '';
    $buffer = '';
    $bufferIsNew = null;

    $flush = function () use (&$html, &$buffer, &$bufferIsNew) {
        if ($buffer === '') return;
        if ($bufferIsNew) {
            $html .= '<span class="an-edited-highlight">' . htmlspecialchars($buffer) . '</span>';
        } else {
            $html .= htmlspecialchars($buffer);
        }
        $buffer = '';
    };

    foreach ($curTokens as $idx => $token) {
        $isNew = !$keptInCurrent[$idx];
        if ($bufferIsNew === null) {
            $bufferIsNew = $isNew;
        } elseif ($isNew !== $bufferIsNew) {
            $flush();
            $bufferIsNew = $isNew;
        }
        $buffer .= $token;
    }
    $flush();

    return nl2br($html);
}

// ── Active academic year ──
$yearRes = $conn->query("SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1");
$current_academic_year_id = ($yearRes && $yearRes->num_rows > 0)
    ? (int)$yearRes->fetch_assoc()['id']
    : 0;

// ── Learner's class ──
$classQuery = $conn->prepare("
    SELECT class_id FROM class_students
    WHERE student_email = ? AND academic_year_id = ? LIMIT 1
");
$classQuery->bind_param("si", $email, $current_academic_year_id);
$classQuery->execute();
$classQuery->bind_result($classId);
$classQuery->fetch();
$classQuery->close();

// ══════════════════════════════════════
// 1. SCHOOL-WIDE ANNOUNCEMENTS
//    class_id IS NULL, target audience includes learners
// ══════════════════════════════════════
$schoolAnnouncements = [];

// ── Get school name for sender label ──
$schoolName = 'School Admin';
$snRes = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
if ($snRes && $snRow = $snRes->fetch_assoc()) {
    $schoolName = trim($snRow['setting_value']) ?: 'School Admin';
}

$schoolStmt = $conn->prepare("
    SELECT
        a.id,
        a.title,
        a.message,
        a.original_message,
        a.created_at,
        a.edited_at,
        a.target_role
    FROM announcements a
    WHERE a.class_id IS NULL
      AND a.academic_year_id = ?
      AND a.target_role IN ('all', 'learners')
    ORDER BY a.created_at DESC
");
$schoolStmt->bind_param("i", $current_academic_year_id);
$schoolStmt->execute();
$schoolRes = $schoolStmt->get_result();

while ($row = $schoolRes->fetch_assoc()) {
    $message  = $row['message'] ?? '';
    $isEdited = !empty($row['edited_at']);

    $schoolAnnouncements[] = [
        'id'              => (int)$row['id'],
        'title'           => $row['title']   ?? '(No Title)',
        'message'         => $message,
        'message_html'    => $isEdited
            ? buildAnnouncementDiffHtml($row['original_message'] ?? $message, $message)
            : null,
        'created_at'      => $row['created_at'],
        'display_date'    => date('j M \a\t H:i', strtotime($row['created_at'])),
        'is_edited'       => $isEdited,
        'edited_date'     => $isEdited ? date('j M \a\t H:i', strtotime($row['edited_at'])) : null,
        'sender'          => $schoolName,
        'sender_initials' => getInitials($schoolName),
    ];
}
$schoolStmt->close();

// ══════════════════════════════════════
// 2. TEACHER ANNOUNCEMENTS (class-level)
//    grouped by teacher display name
// ══════════════════════════════════════
$teacherGrouped = [];

if ($classId) {
    $teacherStmt = $conn->prepare("
        SELECT
            a.id,
            a.title,
            a.message,
            a.original_message,
            a.created_at,
            a.edited_at,
            u.title       AS t_title,
            u.name        AS t_name,
            u.second_name AS t_second_name,
            u.surname     AS t_surname
        FROM announcements a
        LEFT JOIN users u ON a.created_by = u.email AND u.role = 'teacher'
        WHERE a.class_id = ?
          AND a.academic_year_id = ?
          AND a.send_to = 'learners'
        ORDER BY a.created_at DESC
    ");
    $teacherStmt->bind_param("ii", $classId, $current_academic_year_id);
    $teacherStmt->execute();
    $teacherRes = $teacherStmt->get_result();

    while ($row = $teacherRes->fetch_assoc()) {
        $nameParts = buildTeacherNameParts(
            $row['t_title'],
            $row['t_name'],
            $row['t_second_name'],
            $row['t_surname']
        );
        $teacher = $nameParts['display'];
        $message  = $row['message'] ?? '';
        $isEdited = !empty($row['edited_at']);

        $teacherGrouped[$teacher] = $teacherGrouped[$teacher] ?? [];
        $teacherGrouped[$teacher][] = [
            'id'              => (int)$row['id'],
            'title'           => $row['title']   ?? '(No Title)',
            'message'         => $message,
            'message_html'    => $isEdited
                ? buildAnnouncementDiffHtml($row['original_message'] ?? $message, $message)
                : null,
            'created_at'      => $row['created_at'],
            'display_date'    => date('j M \a\t H:i', strtotime($row['created_at'])),
            'is_edited'       => $isEdited,
            'edited_date'     => $isEdited ? date('j M \a\t H:i', strtotime($row['edited_at'])) : null,
            'teacher_initials'=> $nameParts['initials'],
        ];
    }
    $teacherStmt->close();
}

echo json_encode([
    'school_wide' => $schoolAnnouncements,
    'teacher'     => $teacherGrouped,
]);