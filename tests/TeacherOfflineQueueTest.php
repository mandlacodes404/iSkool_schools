<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/marks_guard.php';

/**
 * Guards for the teacher's offline marks: a mark saved without signal waits on the phone (service-worker.js), is sent
 * when the phone is back online, and is applied only if the marks have not changed meanwhile (includes/marks_guard.php,
 * api/teacher/save_marks.php). The connection strip is assets/js/shared/net_status.js.
 *
 * The PHP rules are run here as they are. The worker and the page scripts are checked by reading their real sources, so
 * a rename or a removed safeguard fails a test. How they behave together (real service worker, real offline switch,
 * phone-sized Chromium, a stand-in server with the same contract) was checked in a browser, not here.
 */
final class TeacherOfflineQueueTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The text of a top-level function in a script, from its first line to the next top-level line that starts with "}". */
    private function body(string $js, string $needle): string
    {
        $start = strpos($js, $needle);
        $this->assertNotFalse($start, $needle . ' not found');
        $end = strpos($js, "\n}\n", $start);
        $this->assertNotFalse($end, 'end of ' . $needle . ' not found');
        return substr($js, $start, $end - $start);
    }

    // ── the rule that stops an old offline save overwriting newer marks ────────────────────────────────────────────

    public function test_marks_that_agree_to_the_marks_step_are_the_same_and_no_mark_equals_no_mark(): void
    {
        $this->assertTrue(marks_values_match(10.0, 10.004));
        $this->assertTrue(marks_values_match(null, null));
        $this->assertFalse(marks_values_match(10.0, 10.01));
        $this->assertFalse(marks_values_match(null, 0.0), 'a mark of zero is a mark, not "no mark"');
        $this->assertFalse(marks_values_match(0.0, null));
    }

    public function test_a_queued_save_is_a_conflict_only_when_the_stored_marks_are_not_those_the_teacher_saw(): void
    {
        $this->assertFalse(marks_conflict(10.0, 20.0, 10.0, 20.0), 'unchanged marks: apply the save');
        $this->assertFalse(marks_conflict(null, null, null, null), 'still no marks: apply the save');
        $this->assertTrue(marks_conflict(12.0, 20.0, 10.0, 20.0), 'the score changed');
        $this->assertTrue(marks_conflict(10.0, 25.0, 10.0, 20.0), 'the total changed');
        $this->assertTrue(marks_conflict(9.0, 10.0, null, null), 'the learner handed in after the teacher saw an empty row');
        $this->assertTrue(marks_conflict(null, null, 10.0, 20.0), 'the marks were removed');
    }

    public function test_a_save_whose_answer_was_lost_is_recognised_as_already_applied(): void
    {
        $this->assertTrue(marks_already_saved(15.0, 20.0, 15.0, 20.0));
        $this->assertFalse(marks_already_saved(10.0, 20.0, 15.0, 20.0));
        $this->assertFalse(marks_already_saved(null, null, 15.0, 20.0));
    }

    public function test_the_baseline_is_read_from_the_form_and_absent_for_ordinary_saves(): void
    {
        $this->assertNull(marks_parse_expected(['score' => '15', 'total' => '20']), 'an ordinary online save has no baseline');
        $this->assertNull(marks_parse_expected(['expected_known' => '0', 'expected_score' => '1']));
        $this->assertSame(['score' => 10.0, 'total' => 20.0], marks_parse_expected(['expected_known' => '1', 'expected_score' => '10', 'expected_total' => '20.0']));
        $this->assertSame(['score' => null, 'total' => null], marks_parse_expected(['expected_known' => '1', 'expected_score' => '', 'expected_total' => '']));
        $this->assertSame(['score' => null, 'total' => 20.0], marks_parse_expected(['expected_known' => '1', 'expected_score' => 'abc', 'expected_total' => '20']), 'junk counts as no mark, which can only cause a refusal, never an overwrite');
    }

    public function test_only_the_service_workers_replay_is_guarded(): void
    {
        $this->assertTrue(marks_is_queued_replay(['HTTP_X_ISKOOL_QUEUED_REPLAY' => '1']));
        $this->assertFalse(marks_is_queued_replay([]));
        $this->assertFalse(marks_is_queued_replay(['HTTP_X_ISKOOL_QUEUED_REPLAY' => '0']));
    }

    public function test_save_marks_applies_the_guard_only_to_a_replay_and_leaves_the_online_save_as_it_was(): void
    {
        $php = $this->source('api/teacher/save_marks.php');
        $this->assertStringContainsString("includes/marks_guard.php", $php);
        $this->assertStringContainsString('$expected = marks_is_queued_replay($_SERVER) ? marks_parse_expected($_POST) : null;', $php);
        // locked read, only for a guarded save
        $this->assertStringContainsString('($expected !== null ? " FOR UPDATE" : "")', $php);
        // the lock and the transaction are opened only inside "if ($expected !== null)", so an online save never takes them
        $this->assertSame(1, preg_match('/if \(\$expected !== null\) \{\s*\$conn->begin_transaction\(\);\s*\}/', $php));
    }

    public function test_save_marks_refuses_with_409_and_never_leaves_a_transaction_open(): void
    {
        $php = $this->source('api/teacher/save_marks.php');
        $this->assertStringContainsString('http_response_code(409);', $php);
        $this->assertStringContainsString("'conflict'      => true", $php);
        $this->assertSame(1, substr_count($php, '$conn->begin_transaction();'));
        // every way out of the guarded block closes the transaction: conflict and already-saved roll back, the write commits or rolls back
        $this->assertSame(3, substr_count($php, '$conn->rollback();'));
        $this->assertSame(1, substr_count($php, '$conn->commit()'));
        // the two statements an ordinary save runs are still there, in the same wording
        $this->assertStringContainsString('UPDATE quiz_results', $php);
        $this->assertStringContainsString('INSERT INTO quiz_results (quiz_id, user_email, score, total, submitted_at, time_taken)', $php);
        $this->assertStringContainsString("if (!isset(\$_SESSION['email']) || \$_SESSION['role'] !== 'teacher')", $php);
        $this->assertStringContainsString('verify_csrf_token();', $php);
        $this->assertStringContainsString('SELECT id FROM quizzes WHERE id = ? AND created_by = ?', $php);
    }

    // ── who is signed in ───────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_teacher_identity_endpoint_answers_only_a_signed_in_teacher_and_is_never_cached(): void
    {
        $php = $this->source('api/teacher/get_session_identity.php');
        $this->assertStringContainsString("(\$_SESSION['role'] ?? '') !== 'teacher'", $php);
        $this->assertStringContainsString('http_response_code(401);', $php);
        $this->assertStringContainsString("header('Cache-Control: no-store');", $php);
        $this->assertStringContainsString("'email' => \$_SESSION['email']", $php);
        $this->assertStringContainsString("'csrf_token' => \$_SESSION['csrf_token']", $php);
    }

    // ── the service worker ─────────────────────────────────────────────────────────────────────────────────────────

    private function queueable(string $worker): array
    {
        $this->assertSame(1, preg_match('/const QUEUEABLE_WRITE_PATHS = new Set\(\[(.*?)\]\);/s', $worker, $m));
        preg_match_all("/'([^']+)'|(TEACHER_MARKS_PATH)/", $m[1], $all, PREG_SET_ORDER);
        return array_map(static fn($x) => ($x[2] ?? '') === 'TEACHER_MARKS_PATH' ? '/api/teacher/save_marks.php' : $x[1], $all);
    }

    public function test_the_marks_are_the_only_teacher_save_that_can_wait(): void
    {
        $worker = $this->source('service-worker.js');
        $paths = $this->queueable($worker);
        $teacher = array_values(array_filter($paths, static fn($p) => strpos($p, '/api/teacher/') === 0));
        $this->assertSame(['/api/teacher/save_marks.php'], $teacher, 'grading an open-ended answer, creating quizzes, announcements... all need a connection');
        $learner = array_values(array_filter($paths, static fn($p) => strpos($p, '/api/teacher/') !== 0));
        // the learner side: see LearnerOfflineQueueTest (the quiz autosave left the list on purpose)
        $this->assertSame([
            '/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php',
            '/api/learner/create_discussion.php', '/api/learner/submit_reply.php',
        ], $learner);
        $this->assertStringContainsString("const TEACHER_MARKS_PATH = '/api/teacher/save_marks.php';", $worker);
    }

    public function test_the_request_is_copied_before_it_is_sent_so_there_is_something_to_keep_when_the_send_fails(): void
    {
        $worker = $this->source('service-worker.js');
        $this->assertStringContainsString('const COPY_BEFORE_SEND = new Set([TEACHER_MARKS_PATH, ...LEARNER_SUBMISSION_PATHS]);', $worker);
        $handle = $this->body($worker, 'async function handleWrite(');
        $this->assertStringContainsString('const spare = COPY_BEFORE_SEND.has(pathname) ? request.clone() : null;', $handle);
        $this->assertLessThan(strpos($handle, 'await fetch(request)'), strpos($handle, 'request.clone()'), 'copy first, send second');
        $this->assertStringContainsString('await queueRequest(spare || request);', $handle);
    }

    public function test_a_save_that_is_queued_never_looks_failed_because_background_sync_is_off(): void
    {
        $worker = $this->source('service-worker.js');
        $register = $this->body($worker, 'async function registerSync(');
        $this->assertStringContainsString('try {', $register);
        $this->assertStringContainsString('catch (error)', $register);
        $handle = $this->body($worker, 'async function handleWrite(');
        $this->assertStringContainsString('await notifyQueueStatus().catch(() => {});', $handle, 'telling the page the count is a courtesy that cannot fail the save');
    }

    public function test_a_second_offline_save_for_the_same_learner_replaces_the_first_but_keeps_the_oldest_baseline(): void
    {
        $worker = $this->source('service-worker.js');
        $queue = $this->body($worker, 'async function queueRequest(');
        $this->assertStringContainsString("urlPath(request.url) === TEACHER_MARKS_PATH", $queue);
        $this->assertStringContainsString("record.queueUser === queueUser", $queue, 'one teacher\'s saves are never merged into another\'s');
        $this->assertStringContainsString('first.createdAt <= next.createdAt', $queue);
        $this->assertStringContainsString("const MARKS_BASELINE_FIELDS = ['expected_known', 'expected_score', 'expected_total'];", $worker);
        $this->assertStringContainsString('replacedIds.forEach(id => store.delete(id));', $queue);
    }

    public function test_a_teachers_save_is_sent_only_as_the_teacher_who_made_it_with_the_live_token(): void
    {
        $worker = $this->source('service-worker.js');
        $this->assertStringContainsString("const TEACHER_IDENTITY_URL = '/api/teacher/get_session_identity.php';", $worker);
        $this->assertStringContainsString("const LEARNER_IDENTITY_URL = '/api/learner/get_session_identity.php';", $worker);
        $record = $this->body($worker, 'async function replayRecord(');
        $this->assertStringContainsString('teacherRecord ? TEACHER_IDENTITY_URL : LEARNER_IDENTITY_URL', $record);
        $this->assertStringContainsString('identity.email !== record.queueUser', $record);
        $this->assertStringContainsString("headers['X-CSRF-Token'] = liveToken || record.csrfToken || '';", $record);
        $this->assertStringContainsString('const liveToken = identity.csrf_token || \'\';', $record);
        $this->assertStringContainsString("headers['X-iSkool-Queued-Replay'] = '1';", $record);
        // the identity check comes before the save is sent
        $this->assertLessThan(strpos($record, 'await fetch(record.url'), strpos($record, 'identity.email !== record.queueUser'));
        // a different teacher's saved marks are thrown away, and the page is told
        $this->assertStringContainsString("type: 'offline-write-discarded'", $record);
        // the other learner saves still go through the original branch
        $this->assertStringContainsString("type: 'offline-write-synced', url: record.url }", $record);
        $this->assertStringContainsString("type: 'offline-write-failed', url: record.url }", $record);
    }

    public function test_the_outcome_of_a_teachers_replay_decides_whether_the_save_is_kept(): void
    {
        $worker = $this->source('service-worker.js');
        $settle = $this->body($worker, 'async function settleTeacherReplay(');
        // conflict: dropped (never retried forever) and reported; success: dropped and reported
        $this->assertMatchesRegularExpression("/response\.status === 409 && result && result\.conflict\) \{\s*await deleteQueuedWrite\(record\.id\);\s*await notifyClients\(\{ type: 'offline-write-conflict'/", $settle);
        $this->assertMatchesRegularExpression("/response\.ok && result && result\.success === true\) \{\s*await deleteQueuedWrite\(record\.id\);\s*await notifyClients\(\{ type: 'offline-write-synced'/", $settle);
        // a server hiccup or a page that is not JSON (a hotspot sign-in) keeps the save and stops the pass
        $this->assertStringContainsString('response.status >= 500 || (response.ok && !result)', $settle);
        $this->assertMatchesRegularExpression('/response\.status >= 500 \|\| \(response\.ok && !result\)\) \{\s*return true;/', $settle);
        // anything else the server refused is reported, not kept
        $this->assertStringContainsString("type: 'offline-write-failed'", $settle);
    }

    public function test_one_pass_at_a_time_and_a_few_quick_retries_for_a_teachers_save_and_a_learners_submission(): void
    {
        $worker = $this->source('service-worker.js');
        $this->assertStringContainsString('if (replayRunning) { replayAgain = true; return replayRunning; }', $worker);
        $this->assertStringContainsString('const REPLAY_RETRY_DELAYS_MS = [1500, 3000, 6000];', $worker);
        $pass = $this->body($worker, 'async function replayPass(');
        $this->assertStringContainsString('const retries = teacherRecord || isLearnerSubmission(record.url);', $pass);
        $this->assertStringContainsString('retries ? REPLAY_RETRY_DELAYS_MS[attempt++] : undefined', $pass, 'the other learner saves keep the one-try behaviour');
        $this->assertStringContainsString('if (delay === undefined) return;', $pass);
        // a waiting save of one role must not hold up the other role's saves
        $record = $this->body($worker, 'async function replayRecord(');
        $this->assertStringContainsString("if (!identityResponse.ok) return 'next';", $record);
    }

    public function test_the_page_can_ask_for_the_queue_and_for_a_send(): void
    {
        $worker = $this->source('service-worker.js');
        $this->assertStringContainsString("'iskool-queue-status'", $worker);
        $this->assertStringContainsString("'iskool-replay-queued-writes'", $worker);
        $status = $this->body($worker, 'async function notifyQueueStatus(');
        $this->assertStringContainsString('isTeacherUrl(record.url)', $status);
        $this->assertStringContainsString("type: 'offline-queue-status', teacher, learner, total: records.length", $status);
        // the logout wipe of the queue is still there
        $this->assertStringContainsString('clearQueuedWrites()', $worker);
    }

    // ── the connection strip ───────────────────────────────────────────────────────────────────────────────────────

    public function test_the_strip_script_builds_text_safely_and_only_announces_the_saves_of_the_page_that_loaded_it(): void
    {
        $js = $this->source('assets/js/shared/net_status.js');
        $this->assertStringNotContainsString('innerHTML', $js);
        $this->assertStringNotContainsString('insertAdjacentHTML', $js);
        $this->assertStringContainsString('textContent', $js);
        $this->assertStringContainsString('if (!ownsUrl(path)) return;', $js);              // another tab's (the other app's) saves are not announced
        $this->assertStringContainsString('data[role][mine]', $js);                         // only the signed-in user's waiting saves are counted
        $this->assertStringContainsString("var role = (options && options.role) || 'teacher';", $js, 'the teacher page passes no role and counts the teacher\'s saves, as before');
        $this->assertStringContainsString("document.addEventListener('visibilitychange'", $js);
        $this->assertStringContainsString("window.addEventListener('online'", $js);
        $this->assertStringContainsString('RETRY_STEPS_MS = [12000, 20000, 30000]', $js);
        $this->assertStringContainsString("'iskool:queue-settled'", $js);
        $this->assertStringContainsString('window.iskoolNetStatus = {', $js);
        // the sentence is worded before the page hears the event, because the page then forgets the names it looks up
        $this->assertLessThan(strpos($js, "document.dispatchEvent(new CustomEvent('iskool:queue-settled'"), strpos($js, 'var text = sentence(kind, detail);'));
        // a "not applied" or "could not send" note stays until dismissed; "sent" fades
        $this->assertStringContainsString('note(kind, text, true);', $js);
        $this->assertStringContainsString("note('synced',", $js);
    }

    public function test_the_strip_sits_above_the_bottom_bar_under_the_menu_and_lets_taps_through(): void
    {
        $css = $this->source('assets/css/shared/net_status.css');
        $this->assertMatchesRegularExpression('/\.net-status \{[^}]*position:\s*fixed;/s', $css);
        $this->assertMatchesRegularExpression('/\.net-status \{[^}]*z-index:\s*4400;/s', $css);        // under the menu (5000) and its backdrop (4999), under the install card (4500)
        $this->assertMatchesRegularExpression('/\.net-status \{[^}]*pointer-events:\s*none;/s', $css);
        $this->assertStringContainsString('.net-status > * { pointer-events: auto; }', $css);
        $this->assertStringContainsString('prefers-reduced-motion', $css);
        $js = $this->source('assets/js/shared/net_status.js');
        $this->assertStringContainsString("document.getElementById('mobileBottomNav')", $js);
        $this->assertStringContainsString("'.pwa-banner--bottom'", $js);                                // never on top of the install card
    }

    public function test_the_teacher_dashboard_loads_the_strip_after_the_page_scripts(): void
    {
        $page = $this->source('teacher_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/net_status.css', $page);
        $grades = strpos($page, 'assets/js/teacher/grades.js');
        $owner = strpos($page, 'window.ISKOOL_TEACHER = ');
        $shared = strpos($page, 'assets/js/shared/net_status.js');
        $glue = strpos($page, 'assets/js/teacher/teacher_net_status.js');
        foreach ([$grades, $owner, $shared, $glue] as $position) {
            $this->assertNotFalse($position);
        }
        $this->assertLessThan($shared, $grades);
        $this->assertLessThan($shared, $owner, 'the signed-in teacher\'s email must exist before the strip starts counting their saves');
        $this->assertLessThan($glue, $shared);
        $this->assertStringContainsString('assets/js/teacher/grades.js?v=5.5', $page, 'grades.js changed, so its cache-busting version moved');
        $this->assertStringContainsString('assets/js/shared/net_status.js?v=1.1', $page, 'net_status.js changed, so its cache-busting version moved');
    }

    public function test_the_teacher_glue_names_the_learner_and_quiz_and_forgets_stale_grades(): void
    {
        $js = $this->source('assets/js/teacher/teacher_net_status.js');
        $this->assertStringContainsString("urlPrefix: '/api/teacher/'", $js);
        $this->assertStringContainsString('window.ISKOOL_TEACHER.email', $js);
        $this->assertStringContainsString('delete window._teacherGradeQuizCache[detail.quizId]', $js);
        $this->assertStringContainsString('window.teacherGradesCache = null;', $js);
        // the caches it forgets really are the ones grades.js keeps
        $grades = $this->source('assets/js/teacher/grades.js');
        $this->assertStringContainsString('window.teacherGradesCache        = null;', $grades);
        $this->assertStringContainsString('window._teacherGradeQuizCache    = {};', $grades);
        $this->assertStringContainsString('Not applied:', $js);
    }

    // ── the grades screens ─────────────────────────────────────────────────────────────────────────────────────────

    public function test_both_marks_saves_send_who_is_saving_and_the_marks_they_started_from_and_understand_saved_for_later(): void
    {
        $grades = $this->source('assets/js/teacher/grades.js');
        $this->assertSame(2, substr_count($grades, "fetch('api/teacher/save_marks.php', { method: 'POST', headers: grSaveHeaders(), body: fd })"), 'the phone form and the desktop panel');
        $this->assertSame(0, substr_count($grades, "save_marks.php', { method: 'POST', headers: { 'X-CSRF-Token'"), 'no marks save may skip the queue-user header');
        $this->assertSame(2, substr_count($grades, 'grAddBaseline(fd, quizId, email);'));
        $this->assertStringContainsString("headers['X-iSkool-Queue-User'] = me;", $grades);
        $this->assertStringContainsString("fd.append('expected_known', '1');", $grades);
        // phone form: queued is a success state with its own message, and the held marks are shown
        $this->assertStringContainsString('if (data.queued === true) {', $grades);
        $this->assertStringContainsString('grApplyQueuedMarks(window.currentQuizData, quizId, email, score, total);', $grades);
        // desktop panel
        $this->assertStringContainsString('const queued = result.queued === true;', $grades);
        $this->assertStringContainsString('if (!queued && !result.success) {', $grades);
        $this->assertStringContainsString("grToast(queued ? GR_SAVED_ON_PHONE : 'Marks saved');", $grades);
        // an ordinary online save keeps its messages
        $this->assertStringContainsString("successDiv.textContent = 'Marks saved successfully!';", $grades);
    }

    public function test_grading_an_open_ended_answer_is_left_online_only(): void
    {
        $grades = $this->source('assets/js/teacher/grades.js');
        $this->assertStringNotContainsString('queued', substr($grades, (int)strpos($grades, 'grade_open_ended.php') - 400, 800));
        $this->assertStringNotContainsString('grade_open_ended', $this->source('service-worker.js'));
    }

    public function test_nothing_new_mentions_discussions(): void
    {
        foreach ([
            'assets/js/shared/net_status.js', 'assets/css/shared/net_status.css', 'assets/js/teacher/teacher_net_status.js',
            'includes/marks_guard.php', 'api/teacher/get_session_identity.php',
        ] as $file) {
            $this->assertStringNotContainsStringIgnoringCase('discussion', $this->source($file), $file);
        }
    }
}
