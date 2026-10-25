/*
 * Teacher dashboard: what the shared connection strip (assets/js/shared/net_status.js) needs to know about teachers.
 *
 *   - Whose saves to count: the signed-in teacher (window.ISKOOL_TEACHER.email, written by teacher_dashboard.php).
 *   - Which saves to announce: the ones under /api/teacher/. Only the quiz marks can wait on the phone
 *     (service-worker.js); anything else a teacher does needs a connection.
 *   - How to word the news, naming the learner and the quiz, which the shared script cannot know about.
 *   - What to forget when a saved mark has been sent, or refused: the grades the page keeps in memory. While the mark
 *     waited, the page showed the teacher's own value; once the server has decided, the next visit must read the
 *     real marks again (after a "not applied" in particular, the real marks are NOT the ones the page showed).
 *
 * Loaded after grades.js and the shared script (see the end of teacher_dashboard.php).
 */
(function () {
    'use strict';
    if (!window.iskoolNetStatus) return;

    function teacherEmail() {
        return (window.ISKOOL_TEACHER && window.ISKOOL_TEACHER.email) || '';
    }

    /** The cached grades of one quiz, if the page has them: { quiz_title, learners: [{ name, email, ... }] }. */
    function quizGrades(quizId) {
        var cached = window._teacherGradeQuizCache && window._teacherGradeQuizCache[quizId];
        var data = (cached && cached.data) || window.currentQuizData || null;
        return data && String(data.quiz_id) === String(quizId) ? data : (cached && cached.data) || null;
    }

    function learnerName(detail) {
        var data = quizGrades(detail.quizId);
        var learners = (data && data.learners) || [];
        for (var i = 0; i < learners.length; i++) {
            if (String(learners[i].email) === String(detail.userEmail)) return learners[i].name || detail.userEmail;
        }
        return detail.userEmail || 'a learner';
    }

    function quizTitle(detail) {
        var data = quizGrades(detail.quizId);
        return (data && data.quiz_title) || 'the quiz';
    }

    function number(value) {
        var n = parseFloat(value);
        return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
    }

    function describe(kind, detail) {
        if (kind === 'synced') {
            return 'Marks sent for ' + learnerName(detail) + '.';
        }
        if (kind === 'conflict') {
            var now = number(detail.currentScore) !== '' && number(detail.currentTotal) !== ''
                ? ' They now show ' + number(detail.currentScore) + '/' + number(detail.currentTotal) + '.'
                : ' They now show no marks.';
            return 'Not applied: ' + learnerName(detail) + '’s marks for ' + quizTitle(detail) +
                ' changed after you saved them on your phone.' + now + ' Open the quiz to check, then enter them again if needed.';
        }
        return 'Could not send ' + learnerName(detail) + '’s marks for ' + quizTitle(detail) + '. Please enter them again.';
    }

    // The shared script words its note before it raises this event, so forgetting the cached names here is safe.
    document.addEventListener('iskool:queue-settled', function (event) {
        var detail = event.detail || {};
        if (detail.quizId && window._teacherGradeQuizCache) delete window._teacherGradeQuizCache[detail.quizId];
        window.teacherGradesCache = null;
    });

    window.iskoolNetStatus.init({
        urlPrefix: '/api/teacher/',
        user: teacherEmail,
        describe: describe,
        offlineHint: 'marks you save stay on this phone'
    });
})();
