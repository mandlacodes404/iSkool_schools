/*
 * Learner dashboard: what the shared connection strip (assets/js/shared/net_status.js) needs to know about learners.
 *
 * A learner can finish a quiz, hand in an assignment or send an evaluation with no signal. The service worker
 * (service-worker.js) keeps it on the phone and sends it when the phone is back online; the school's server then decides
 * whether it is still accepted (the quiz may have closed, the due date may have passed). This file tells the learner:
 *   - Whose submissions to count: the signed-in learner (window.learnerQueueUser, written by learner_dashboard.php).
 *   - Which submissions to announce: a quiz, an assignment, an evaluation. Nothing else a learner does waits on the phone.
 *   - What to say: "Your quiz “Algebra” was sent." or, when the school did not accept it, that it was not and why.
 *   - What to forget: the lists the page keeps in memory, so the next visit shows the real state (a quiz that is now
 *     done, an assignment that is now handed in, the new marks).
 *
 * The strip is shown only while a submission is waiting (idleStrip: false): a learner who goes offline with nothing
 * waiting sees nothing new.
 *
 * Loaded after the shared script (see the end of learner_dashboard.php).
 */
(function () {
    'use strict';
    if (!window.iskoolNetStatus) return;

    var WHAT = { quiz: 'quiz', assignment: 'assignment', evaluation: 'evaluation' };

    function label(detail) {
        var what = WHAT[detail.kind] || 'submission';
        return 'Your ' + what + (detail.title ? ' “' + detail.title + '”' : '');
    }

    function describe(kind, detail) {
        if (kind === 'synced') return label(detail) + ' was sent.';
        // The reason comes from the school's server ("This quiz closed before your answers could be sent.").
        return detail.message
            ? label(detail) + ' was not accepted. ' + detail.message
            : label(detail) + ' could not be sent. Please check it and send it again.';
    }

    // Once the server has decided, the next visit must read the real state, not what the page remembered while the
    // submission waited.
    document.addEventListener('iskool:queue-settled', function () {
        window.learnerQuizCache = null;
        window.learnerAssignmentCache = null;
        window.evaluationCache = null;
        window.learnerGradesCache = null;
    });

    window.iskoolNetStatus.init({
        role: 'learner',
        urlPrefix: ['/submit_quiz.php', '/submit_assignment.php', '/api/learner/submit_evaluation.php'],
        user: function () { return window.learnerQueueUser || ''; },
        describe: describe,
        nouns: ['submission', 'submissions'],
        idleStrip: false
    });
})();
