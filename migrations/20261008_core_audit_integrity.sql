-- Core audit integrity constraints.
-- Apply this migration to each school database in a maintenance window. It is
-- deliberately not run by the application or deployment process.
--
-- Preflight: every query must return zero rows before its matching ALTER.
-- SELECT student_email, academic_year_id, COUNT(*) AS duplicate_count
-- FROM class_students GROUP BY student_email, academic_year_id HAVING COUNT(*) > 1;
-- SELECT assignment_id, student_email, COUNT(*) AS duplicate_count
-- FROM submissions GROUP BY assignment_id, student_email HAVING COUNT(*) > 1;
-- SELECT response_id, statement_id, COUNT(*) AS duplicate_count
-- FROM evaluation_answers GROUP BY response_id, statement_id HAVING COUNT(*) > 1;
-- SELECT school_id, COUNT(*) AS current_year_count
-- FROM academic_years WHERE is_current = 1 GROUP BY school_id HAVING COUNT(*) > 1;
-- SELECT quiz_id, user_email, COUNT(*) AS duplicate_count
-- FROM quiz_results WHERE attempt_id IS NULL GROUP BY quiz_id, user_email HAVING COUNT(*) > 1;

ALTER TABLE class_students
    ADD UNIQUE KEY uq_class_students_learner_year
        (student_email, academic_year_id);

ALTER TABLE submissions
    ADD UNIQUE KEY uq_submissions_assignment_learner
        (assignment_id, student_email);

ALTER TABLE evaluation_answers
    ADD UNIQUE KEY uq_evaluation_answers_response_statement
        (response_id, statement_id);

-- Unique indexes permit repeated NULLs. This generated key is non-NULL only
-- for active years, allowing exactly one active year per school.
ALTER TABLE academic_years
    ADD COLUMN current_school_id INT
        GENERATED ALWAYS AS (CASE WHEN is_current = 1 THEN school_id ELSE NULL END) STORED,
    ADD UNIQUE KEY uq_academic_years_one_current (current_school_id);

-- Results without an attempt are manual-assessment results. The generated key
-- allows one per learner and assessment; normal attempt results remain keyed
-- by uq_quiz_results_attempt.
ALTER TABLE quizzes
    ADD COLUMN is_manual TINYINT(1) NOT NULL DEFAULT 0 AFTER publish_marks;

ALTER TABLE quiz_results
    ADD COLUMN manual_result_key VARCHAR(512)
        GENERATED ALWAYS AS (
            CASE WHEN attempt_id IS NULL THEN CONCAT(quiz_id, ':', user_email) ELSE NULL END
        ) STORED,
    ADD UNIQUE KEY uq_quiz_results_manual (manual_result_key);
