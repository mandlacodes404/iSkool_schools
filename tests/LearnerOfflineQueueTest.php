<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for a learner's offline submissions: a quiz finished, an assignment handed in or an evaluation sent without
 * signal waits on the phone (service-worker.js), is sent when the phone is back online, and the school's server decides
 * whether it is still accepted (submit_quiz.php, submit_assignment.php). The learner is told which (net_status.js with
 * learner_net_status.js).
 *
 * The rules in the PHP files are checked by reading their real sources, so a rename or a removed safeguard fails a test.
 * How they behave together was checked outside PHPUnit: the real service worker, a real offline switch, phone-sized
 * Chromium and a stand-in server (the browser side), and the real submit_quiz.php / submit_assignment.php /
 * get_session_identity.php run against an in-memory database (the PHP side).
 */
final class LearnerOfflineQueueTest extends TestCase
{
    private function source(string $path): string
    {
        $text = file_get_contents(__DIR__ . '/../' . $path);
        $this->assertNotFalse($text, $path);
        return $text;
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

    private function quoted(string $list): array
    {
        preg_match_all("/'([^']+)'/", $list, $all);
        return $all[1];
    }

    // ── what can wait on the phone ─────────────────────────────────────────────────────────────────────────────────

    public function test_a_quiz_an_assignment_and_an_evaluation_can_wait_on_the_phone(): void
    {
        $worker = $this->source('service-worker.js');
        $this->assertSame(1, preg_match('/const LEARNER_SUBMISSION_PATHS = new Set\(\[(.*?)\]\);/s', $worker, $m));
        $this->assertSame(['/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php'], $this->quoted($m[1]));

        $this->assertSame(1, preg_match('/const QUEUEABLE_WRITE_PATHS = new Set\(\[(.*?)\]\);/s', $worker, $q));
        $queueable = $this->quoted($q[1]);
        foreach (['/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php'] as $path) {
            $this->assertContains($path, $queueable, $path);
        }
    }

    public function test_the_body_is_copied_before_it_is_sent_so_there_is_something_to_keep_when_the_send_fails(): void
    {
        $worker = $this->source('service-worker.js');
        // This was the learner side's flaw: a request body can be read once, so when the send failed there was nothing
        // left to queue ("Request body is already used") and the answers were lost.
        $this->assertStringContainsString('const COPY_BEFORE_SEND = new Set([TEACHER_MARKS_PATH, ...LEARNER_SUBMISSION_PATHS]);', $worker);
        $handle = $this->body($worker, 'async function handleWrite(');
        $this->assertStringContainsString('const spare = COPY_BEFORE_SEND.has(pathname) ? request.clone() : null;', $handle);
        $this->assertStringContainsString('await queueRequest(spare || request);', $handle);
        $this->assertLessThan(strpos($handle, 'await fetch(request)'), strpos($handle, 'request.clone()'), 'copy first, send second');
    }

    public function test_the_quiz_autosave_does_not_wait_on_the_phone(): void
    {
        $worker = $this->source('service-worker.js');
        // A delayed autosave could be sent after newer answers and overwrite them; the next autosave or the final
        // submission carries the answers anyway. Offline it fails as it always did, and take_quiz.php ignores that.
        $this->assertSame(1, preg_match('/const QUEUEABLE_WRITE_PATHS = new Set\(\[(.*?)\]\);/s', $worker, $q));
        $this->assertNotContains('/save_progress.php', $this->quoted($q[1]));
        $this->assertStringNotContainsString("'/save_progress.php'", substr($worker, (int)strpos($worker, 'const LEARNER_SUBMISSION_PATHS'), 1200));
    }

    public function test_a_navigating_quiz_form_gets_a_page_with_a_way_back_that_works_inside_the_desktop_frame(): void
    {
        $worker = $this->source('service-worker.js');
        $queued = $this->body($worker, 'function queuedResponse(');
        $this->assertStringContainsString('<h1>Submission saved offline</h1>', $queued);
        $this->assertStringContainsString('<a href="/learner_dashboard.php" target="_top"', $queued, 'on a computer the quiz opens inside a frame: the link must leave it');
        // a fetch gets the JSON the screens already understand
        $this->assertStringContainsString("JSON.stringify({ success: false, queued: true, message: 'Saved offline.", $queued);
        $this->assertStringContainsString('status: 202', $queued);
    }

    // ── sending it again ───────────────────────────────────────────────────────────────────────────────────────────

    public function test_a_learners_submission_is_sent_only_as_the_learner_who_made_it_with_the_live_token_in_header_and_body(): void
    {
        $worker = $this->source('service-worker.js');
        $record = $this->body($worker, 'async function replayRecord(');
        $this->assertStringContainsString('const learnerSubmission = isLearnerSubmission(record.url);', $record);
        $this->assertStringContainsString('identity.email !== record.queueUser', $record);
        // the body is built after the person has been identified, and sent after that
        $identity = strpos($record, 'identity.email !== record.queueUser');
        $build = strpos($record, 'const body = new FormData();');
        $send = strpos($record, 'await fetch(record.url');
        $this->assertNotFalse($build);
        $this->assertLessThan($build, $identity);
        $this->assertLessThan($send, $build);
        // the form a quiz is finished on carries its token in the body, and the server reads the body first
        // (auth/csrf_helper.php), so the old token there would be refused: it is replaced as well as the header
        $this->assertStringContainsString("else if (field.name === 'csrf_token' && liveToken) body.append(field.name, liveToken);", $record);
        $this->assertStringContainsString("headers['X-CSRF-Token'] = liveToken || record.csrfToken || '';", $record);
        $this->assertStringContainsString("headers['X-iSkool-Queued-Replay'] = '1';", $record);
        $this->assertStringContainsString('if (teacherRecord || learnerSubmission) {', $record);
        $this->assertStringContainsString('if (learnerSubmission) return (await settleLearnerReplay(record, response)) ? \'stop\' : \'next\';', $record);
        // another learner's saved work is thrown away, and the page says so
        $this->assertStringContainsString("type: 'offline-write-discarded'", $record);
    }

    public function test_the_server_decides_whether_a_learners_submission_is_kept_or_reported(): void
    {
        $worker = $this->source('service-worker.js');
        $settle = $this->body($worker, 'async function settleLearnerReplay(');
        // accepted: dropped and reported
        $this->assertMatchesRegularExpression("/response\.ok && result && result\.success === true\) \{\s*await deleteQueuedWrite\(record\.id\);\s*await notifyClients\(\{ type: 'offline-write-synced', \.\.\.detail \}\);/", $settle);
        // a hiccup, "too many requests", a timeout, or a page that is not JSON (a hotspot sign-in) keeps it for the next try
        $this->assertMatchesRegularExpression('/response\.status >= 500 \|\| response\.status === 408 \|\| response\.status === 429 \|\| \(response\.ok && !result\)\) \{\s*return true;/', $settle);
        // refused (quiz closed, due date passed, not in the class...): dropped and reported WITH the reason
        $this->assertMatchesRegularExpression("/\} else \{[^}]*?if \(!\(await hasOpenWindow\(\)\)\) return true;\s*await deleteQueuedWrite\(record\.id\);\s*await notifyClients\(\{ type: 'offline-write-failed', \.\.\.detail, message: \(result && \(result\.error \|\| result\.message\)\) \|\| '' \}\);/s", $settle);
        // ...but only once there is a page open to say so (Background Sync can send with the app closed): otherwise it stays
        $this->assertStringContainsString('async function hasOpenWindow() {', $worker);
        $this->assertSame(1, preg_match('/async function hasOpenWindow\(\) \{\n(.*?)\n\}/s', $worker, $open));
        $this->assertStringContainsString("self.clients.matchAll({ type: 'window', includeUncontrolled: true });", $open[1]);
        $this->assertStringContainsString('return clientList.length > 0;', $open[1]);
        // what the page needs to word the news
        $this->assertStringContainsString("kind: path === '/submit_quiz.php' ? 'quiz' : (path === '/submit_assignment.php' ? 'assignment' : 'evaluation'),", $settle);
        $this->assertStringContainsString("title: (result && typeof result.title === 'string') ? result.title : ''", $settle);
        $this->assertStringContainsString('await notifyQueueStatus();', $settle);
    }

    public function test_a_learners_submission_is_tried_a_few_times_a_moment_apart_other_learner_saves_keep_one_try(): void
    {
        $worker = $this->source('service-worker.js');
        $pass = $this->body($worker, 'async function replayPass(');
        $this->assertStringContainsString('const retries = teacherRecord || isLearnerSubmission(record.url);', $pass);
        $this->assertStringContainsString('retries ? REPLAY_RETRY_DELAYS_MS[attempt++] : undefined', $pass);
    }

    public function test_the_queue_status_counts_each_learners_submissions_apart_from_the_teachers_marks(): void
    {
        $worker = $this->source('service-worker.js');
        $status = $this->body($worker, 'async function notifyQueueStatus(');
        $this->assertStringContainsString('records.filter(record => isLearnerSubmission(record.url)).forEach(record => { learner[record.queueUser] = (learner[record.queueUser] || 0) + 1; });', $status);
        $this->assertStringContainsString("type: 'offline-queue-status', teacher, learner, total: records.length", $status);
    }

    // ── who is signed in ───────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_learner_identity_endpoint_answers_only_a_signed_in_learner_with_the_live_token_and_is_never_cached(): void
    {
        $php = $this->source('api/learner/get_session_identity.php');
        $this->assertStringContainsString("(\$_SESSION['role'] ?? '') !== 'learner'", $php);
        $this->assertStringContainsString('http_response_code(401);', $php);
        $this->assertStringContainsString("header('Cache-Control: no-store');", $php);
        $this->assertStringContainsString("'email' => \$_SESSION['email']", $php);
        $this->assertStringContainsString("'csrf_token' => \$_SESSION['csrf_token']", $php);
        $this->assertLessThan(strpos($php, "echo json_encode(['email'"), strpos($php, 'http_response_code(401);'), 'the refusal comes before the answer');
    }

    // ── the school's side: a re-sent quiz ──────────────────────────────────────────────────────────────────────────

    public function test_the_quiz_page_answers_in_json_only_when_the_service_worker_sends_it_again(): void
    {
        $php = $this->source('submit_quiz.php');
        $this->assertStringContainsString("\$isQueuedReplay = (\$_SERVER['HTTP_X_ISKOOL_QUEUED_REPLAY'] ?? '') === '1';", $php);
        // the plain messages are exactly what they were for everybody else
        $this->assertStringContainsString('if (!$isQueuedReplay) { die($message); }', $php);
        foreach (['No active academic year set. Contact your admin.', 'You are not authorized to submit this quiz.', 'Invalid quiz attempt.', 'An error occurred while saving your results.'] as $text) {
            $this->assertStringContainsString('quiz_stop("' . $text . '"', $php, $text);
        }
        $this->assertSame(2, substr_count($php, 'header("Location: learner_dashboard.php");'), 'quiz gone and result already stored: the redirects stay');
        // every refusal is a 4xx/5xx JSON with success false and the reason; the title lets the page name the quiz
        $this->assertStringContainsString("queued_replay_reply(false, \$status, ['error' => \$message, 'title' => \$title]);", $php);
        $this->assertStringContainsString("'This quiz closed before your answers could be sent.'", $php);
        $this->assertStringContainsString("quiz_stop(\"You are not authorized to submit this quiz.\", 403, \$quizTitle);", $php);
        $this->assertStringContainsString("quiz_stop(\"Invalid quiz attempt.\", 409, \$quizTitle);", $php);
        // a server-side problem is a 5xx, which the worker keeps and tries again
        $this->assertStringContainsString('quiz_stop("No active academic year set. Contact your admin.", 503);', $php);
        $this->assertStringContainsString('quiz_stop("An error occurred while saving your results.", 500, $quizTitle);', $php);
    }

    public function test_a_quiz_the_school_already_has_is_delivered_not_failed(): void
    {
        $php = $this->source('submit_quiz.php');
        // the phone lost the answer after the school had saved the quiz: sending it again must not be reported as a failure
        $this->assertStringContainsString("if (\$isQueuedReplay && quiz_already_delivered(\$conn, \$userEmail, \$quizId, (int)(\$_POST['start_time'] ?? 0))) {", $php);
        $this->assertStringContainsString("queued_replay_reply(true, 200, ['already' => true, 'title' => \$quizTitle]);", $php);
        $this->assertSame(2, substr_count($php, "queued_replay_reply(true, 200, ['already' => true, 'title' => \$quizTitle]);"), 'no open attempt but a submitted one with this start time, and a result already stored');
        $delivered = $this->body($php, 'function quiz_already_delivered(');
        $this->assertStringContainsString("if (\$startTimestamp <= 0) { return false; }", $delivered, 'an old form with no start time is never guessed to be delivered');
        $this->assertStringContainsString("status = 'submitted'", $delivered);
        $this->assertStringContainsString('abs(strtotime($row[\'start_time\']) - $startTimestamp) <= 5) {', $delivered, 'a few seconds of slack, not more');
    }

    public function test_a_quiz_that_was_closed_is_refused_at_the_page_and_a_good_one_answers_with_its_title(): void
    {
        $php = $this->source('submit_quiz.php');
        $render = $this->body($php, 'function render_page(');
        $this->assertStringContainsString("if (\$type === 'closed') { queued_replay_reply(false, 409,", $render);
        $this->assertStringContainsString("queued_replay_reply(true, 200, ['title' => \$quizTitle, 'result' => \$type]);", $render);
        // the replay branch comes before any HTML is built
        $this->assertLessThan(strpos($render, '$percentage'), strpos($render, 'if ($isQueuedReplay) {'));
        // and nothing is written before the token has been checked
        $this->assertLessThan(strpos($php, 'INSERT INTO quiz_results'), strpos($php, 'verify_csrf_token();'));
    }

    // ── the school's side: a re-sent assignment ────────────────────────────────────────────────────────────────────

    public function test_the_assignment_page_answers_in_json_only_when_the_service_worker_sends_it_again(): void
    {
        $php = $this->source('submit_assignment.php');
        $this->assertStringContainsString("\$isQueuedReplay = \$_SERVER['REQUEST_METHOD'] === 'POST' && (\$_SERVER['HTTP_X_ISKOOL_QUEUED_REPLAY'] ?? '') === '1';", $php);
        $refusal = $this->body($php, 'function assignment_replay_refusal(');
        $this->assertStringContainsString('if (!$isQueuedReplay) { return; }', $refusal, 'without the header it does nothing at all');
        $this->assertStringContainsString("echo json_encode(['success' => false, 'error' => \$message, 'title' => \$title]);", $refusal);
        // the three ways it can be refused, each before anything is stored
        $this->assertStringContainsString("assignment_replay_refusal('This assignment is no longer available.', 404);", $php);
        $this->assertStringContainsString("assignment_replay_refusal('You are not allowed to submit this assignment.', 403,", $php);
        $this->assertStringContainsString("assignment_replay_refusal('The due date for this assignment had passed before your work could be sent.', 409,", $php);
        $this->assertLessThan(strpos($php, 'INSERT INTO submissions'), strpos($php, 'The due date for this assignment had passed'));
        // the plain replies for everybody else are still there
        $this->assertStringContainsString('echo "Assignment not found.";', $php);
        $this->assertStringContainsString('echo "You are not allowed to submit this assignment.";', $php);
        // the title is added to the success answer for a re-sent one only
        $this->assertStringContainsString("] + (\$isQueuedReplay ? ['title' => \$assignment['title'] ?? null] : []));", $php);
    }

    // ── the screens ────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_both_quiz_forms_say_who_is_submitting_and_when_the_attempt_started(): void
    {
        $php = $this->source('take_quiz.php');
        $this->assertSame(2, substr_count($php, '<input type="hidden" name="queue_user" value="<?= htmlspecialchars($userEmail) ?>">'), 'the quiz form and the time\'s-up form');
        $this->assertSame(2, substr_count($php, '<input type="hidden" name="start_time" value="<?= $startTime ?>">'));
        $this->assertSame(2, substr_count($php, 'action="submit_quiz.php" method="POST"'));
    }

    public function test_the_assignment_and_evaluation_screens_already_understand_saved_for_later_and_say_who_is_sending(): void
    {
        $assignments = $this->source('assets/js/learner/assignments.js');
        $this->assertStringContainsString('if (result.queued) {', $assignments);
        $this->assertStringContainsString("'X-iSkool-Queue-User': window.learnerQueueUser || ''", $assignments);
        $evaluations = $this->source('assets/js/learner/evaluations.js');
        $this->assertStringContainsString('if (res.queued) {', $evaluations);
        $this->assertStringContainsString("'X-iSkool-Queue-User': window.learnerQueueUser || ''", $evaluations);
    }

    public function test_the_learner_dashboard_loads_the_strip_after_the_page_has_said_who_is_signed_in(): void
    {
        $page = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('<link rel="stylesheet" href="assets/css/shared/net_status.css?v=1.0">', $page);
        $owner = strpos($page, 'window.learnerQueueUser = ');
        $calendar = strpos($page, 'assets/js/learner/learner_calendar.js');
        $shared = strpos($page, 'assets/js/shared/net_status.js?v=1.1');
        $glue = strpos($page, 'assets/js/learner/learner_net_status.js');
        foreach ([$owner, $calendar, $shared, $glue] as $position) {
            $this->assertNotFalse($position);
        }
        $this->assertLessThan($shared, $owner, 'the signed-in learner\'s email must exist before the strip starts counting their submissions');
        $this->assertLessThan($shared, $calendar);
        $this->assertLessThan($glue, $shared);
    }

    public function test_the_learner_glue_counts_only_submissions_names_them_and_forgets_what_it_remembered(): void
    {
        $js = $this->source('assets/js/learner/learner_net_status.js');
        $this->assertStringNotContainsString('innerHTML', $js);
        $this->assertStringContainsString("role: 'learner',", $js);
        $this->assertStringContainsString("urlPrefix: ['/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php'],", $js);
        $this->assertStringContainsString('user: function () { return window.learnerQueueUser || \'\'; },', $js);
        $this->assertStringContainsString("nouns: ['submission', 'submissions'],", $js);
        $this->assertMatchesRegularExpression("/nouns: \\['submission', 'submissions'\\],\\s*idleStrip: false\\s*\\}\\);/", $js, 'a learner who goes offline with nothing waiting sees nothing new');
        // the words
        $this->assertStringContainsString("return label(detail) + ' was sent.';", $js);
        $this->assertStringContainsString("? label(detail) + ' was not accepted. ' + detail.message", $js);
        $this->assertStringContainsString("return 'Your ' + what + (detail.title ? ' “' + detail.title + '”' : '');", $js);
        // after the school has decided, the lists the page keeps in memory are the real ones again
        foreach (['learnerQuizCache', 'learnerAssignmentCache', 'evaluationCache', 'learnerGradesCache'] as $cache) {
            $this->assertStringContainsString('window.' . $cache . ' = null;', $js, $cache);
        }
        // the caches it forgets really are the ones the screens keep
        $this->assertStringContainsString('learnerGradesCache', $this->source('assets/js/learner/grades.js'));
        $this->assertStringContainsString('learnerQuizCache', $this->source('assets/js/learner/quiz.js'));
        $this->assertStringContainsString('learnerAssignmentCache', $this->source('assets/js/learner/assignments.js'));
        $this->assertStringContainsString('evaluationCache', $this->source('assets/js/learner/evaluations.js'));
    }

    public function test_the_shared_strip_can_stay_quiet_until_something_is_waiting_and_names_what_it_counts(): void
    {
        $js = $this->source('assets/js/shared/net_status.js');
        $this->assertStringContainsString('if (isOffline() && waitingCount === 0 && options && options.idleStrip === false) {', $js);
        $this->assertStringContainsString("'Offline · ' + plural(waitingCount, noun()[0], noun()[1]) + ' saved on this phone'", $js);
        $this->assertStringContainsString("'Sending ' + plural(waitingCount, 'saved ' + noun()[0], 'saved ' + noun()[1]) + '…'", $js);
        $this->assertStringContainsString("return pair && pair.length === 2 ? pair : ['change', 'changes'];", $js);
        $this->assertStringContainsString('waitingCount = (mine && data[role] && data[role][mine]) || 0;', $js);
    }

    public function test_nothing_new_mentions_discussions(): void
    {
        foreach ([
            'assets/js/learner/learner_net_status.js', 'api/learner/get_session_identity.php', 'assets/js/shared/net_status.js',
            'submit_quiz.php', 'submit_assignment.php', 'take_quiz.php',
        ] as $file) {
            $this->assertStringNotContainsStringIgnoringCase('discussion', $this->source($file), $file);
        }
    }
}
