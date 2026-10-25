<?php
/**
 * Guard for marks that were saved on a teacher's phone while it had no signal.
 *
 * Such a save waits in the phone and is sent later (service-worker.js). By then the marks may have changed: the
 * teacher edited them on another device, or the learner handed the quiz in. Applying the old save would quietly
 * overwrite the newer marks, so a queued save carries the marks the teacher was looking at when they pressed Save
 * ("expected_known", "expected_score", "expected_total": empty means there were no marks yet) and the server applies
 * it only if the marks are still exactly those. A normal, online save sends none of these fields and is unaffected.
 *
 * Plain functions with no database access, so tests/TeacherOfflineQueueTest.php can run them as they are.
 */

/** Two marks are the same when they agree to well under the 0.01 step the marks inputs allow; no mark equals no mark. */
function marks_values_match(?float $a, ?float $b): bool
{
    if ($a === null || $b === null) {
        return $a === $b;
    }
    return abs($a - $b) < 0.005;
}

/** True when the stored marks are no longer the ones the teacher saw (the saved row's score and total, or null for none). */
function marks_conflict(?float $currentScore, ?float $currentTotal, ?float $expectedScore, ?float $expectedTotal): bool
{
    return !marks_values_match($currentScore, $expectedScore) || !marks_values_match($currentTotal, $expectedTotal);
}

/**
 * True when the stored marks already are the marks being saved. That happens when a save reached the server but its
 * answer was lost on the way back (the phone then kept a copy and sends it again): there is nothing to apply, and it
 * must not be reported as "the marks changed".
 */
function marks_already_saved(?float $currentScore, ?float $currentTotal, float $score, float $total): bool
{
    return marks_values_match($currentScore, $score) && marks_values_match($currentTotal, $total);
}

/**
 * The marks the teacher saw, from the posted form: ['score' => ?float, 'total' => ?float], or null when the request
 * carries no such baseline (every ordinary online save).
 */
function marks_parse_expected(array $post): ?array
{
    if (($post['expected_known'] ?? '') !== '1') {
        return null;
    }
    $number = static function ($value): ?float {
        $value = trim((string)$value);
        return ($value !== '' && is_numeric($value)) ? (float)$value : null;
    };
    return [
        'score' => $number($post['expected_score'] ?? ''),
        'total' => $number($post['expected_total'] ?? ''),
    ];
}

/** True when the request is the service worker re-sending a save that was held on the phone. */
function marks_is_queued_replay(array $server): bool
{
    return ($server['HTTP_X_ISKOOL_QUEUED_REPLAY'] ?? '') === '1';
}
