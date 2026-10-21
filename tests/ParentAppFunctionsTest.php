<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../auth/parent_app_functions.php';

final class ParentAppFunctionsTest extends TestCase
{
    private function quiz(float $score, float $total, int $weight, int $term = 3, bool $summative = true): array
    {
        return [
            'score'          => $score,
            'total'          => $total,
            'weight_percent' => $weight,
            'term_number'    => $term,
            'is_summative'   => $summative ? 1 : 0,
        ];
    }

    public function test_level_follows_the_caps_bands(): void
    {
        $this->assertSame(7, parent_mark_level(100));
        $this->assertSame(7, parent_mark_level(80));
        $this->assertSame(6, parent_mark_level(79));
        $this->assertSame(6, parent_mark_level(70));
        $this->assertSame(5, parent_mark_level(60));
        $this->assertSame(4, parent_mark_level(50));
        $this->assertSame(3, parent_mark_level(40));
        $this->assertSame(2, parent_mark_level(30));
        $this->assertSame(1, parent_mark_level(29));
        $this->assertSame(1, parent_mark_level(0));
        $this->assertNull(parent_mark_level(null));
        $this->assertNull(parent_mark_level(''));
    }

    public function test_term_mark_is_null_when_the_term_has_no_summative_work(): void
    {
        $this->assertNull(parent_term_mark([], 3)['pct']);
        $this->assertNull(parent_term_mark([$this->quiz(9, 10, 20, 3, false)], 3)['pct']);
        $this->assertNull(parent_term_mark([$this->quiz(9, 10, 20, 2)], 3)['pct']);
    }

    public function test_term_mark_weights_summative_work_and_reports_how_much_is_marked(): void
    {
        // 80% of a 20% test and 60% of a 20% task: 16 + 12 = 28 of the 40 marked, which is 70%
        $result = parent_term_mark([$this->quiz(8, 10, 20), $this->quiz(30, 50, 20)], 3);
        $this->assertSame(70, $result['pct']);
        $this->assertSame(40.0, $result['assessed']);
        $this->assertSame(60.0, $result['remaining']);
        $this->assertSame(2, $result['count']);
    }

    public function test_term_mark_ignores_practice_quizzes_and_other_terms(): void
    {
        $result = parent_term_mark([
            $this->quiz(5, 10, 50),
            $this->quiz(10, 10, 100, 3, false),
            $this->quiz(10, 10, 100, 2),
        ], 3);
        $this->assertSame(50, $result['pct']);
        $this->assertSame(1, $result['count']);
    }

    public function test_term_mark_shares_the_weight_equally_when_none_was_set(): void
    {
        $result = parent_term_mark([$this->quiz(10, 10, 0), $this->quiz(0, 10, 0)], 3);
        $this->assertSame(50, $result['pct']);
        $this->assertSame(100.0, $result['assessed']);
    }

    public function test_term_mark_scales_weights_down_when_they_add_up_to_more_than_100(): void
    {
        // 60 + 60 = 120, scaled to 50 + 50: a perfect test and a failed one is 50%
        $result = parent_term_mark([$this->quiz(10, 10, 60), $this->quiz(0, 10, 60)], 3);
        $this->assertSame(50, $result['pct']);
        $this->assertSame(100.0, $result['assessed']);
    }

    public function test_average_skips_missing_marks(): void
    {
        $this->assertSame(70, parent_average([60, null, 80]));
        $this->assertSame(0, parent_average([0]));
        $this->assertNull(parent_average([null, null]));
        $this->assertNull(parent_average([]));
    }

    public function test_names_and_initials(): void
    {
        $this->assertSame('Thandi Mokoena', parent_full_name(' Thandi ', 'Mokoena'));
        $this->assertSame('Thandi', parent_full_name('Thandi', null));
        $this->assertSame('Mr Dlamini', parent_teacher_display('Mr', 'Dlamini'));
        $this->assertSame('Teacher', parent_teacher_display(null, ''));
        // A person: first letter of the name and of the surname, like the learner avatar
        $this->assertSame('TM', parent_person_initials('Thandi', 'Mokoena'));
        $this->assertSame('TM', parent_person_initials('Thandi Nomvula', 'Mokoena'));
        $this->assertSame('TV', parent_person_initials(' thandi', 'van der Merwe'));
        $this->assertSame('T', parent_person_initials('Thandi', null));
        $this->assertSame('?', parent_person_initials('', ''));
        // A school: first two words, like the learner school logo
        $this->assertSame('LH', parent_initials('Landulwazi High School'));
        $this->assertSame('TT', parent_initials('Thoko Thaba Highschool'));
        $this->assertSame('L', parent_initials('Landulwazi'));
        $this->assertSame('?', parent_initials('   '));
    }

    public function test_date_parts_and_event_labels(): void
    {
        $parts = parent_date_parts('2026-10-20 08:30:00');
        $this->assertSame('Tue', $parts['dow']);
        $this->assertSame('20', $parts['day']);
        $this->assertSame('Tue 20 Oct', $parts['label']);
        $this->assertSame('', parent_date_parts('not a date')['label']);

        $this->assertSame('Test', parent_event_kind('test'));
        $this->assertSame('Holiday', parent_event_kind('holiday'));
        $this->assertSame('School event', parent_event_kind('event'));
        $this->assertSame('Event', parent_event_kind('something else'));
    }

    public function test_upcoming_items_are_sorted_by_date_and_limited(): void
    {
        $items = [
            ['date' => '2026-10-25', 'title' => 'c'],
            ['date' => '2026-10-20 14:00:00', 'title' => 'b'],
            ['date' => '2026-10-20 08:00:00', 'title' => 'a'],
            ['date' => '2026-11-01', 'title' => 'd'],
        ];
        $top = parent_merge_upcoming($items, 3);
        $this->assertSame(['a', 'b', 'c'], array_column($top, 'title'));
        $this->assertSame([], parent_merge_upcoming($items, 0));
    }

    public function test_topics_become_a_clean_list_of_strings(): void
    {
        $this->assertSame(['Algebra', 'Trigonometry'], parent_parse_topics('["Algebra", "  Trigonometry  ", "", "   "]'));
        // Numbers are kept as text; nulls, booleans and nested values are dropped
        $this->assertSame(['1', '2.5'], parent_parse_topics('[1, 2.5, null, true, [3], {"a": 1}]'));
        $this->assertSame([], parent_parse_topics(''));
        $this->assertSame([], parent_parse_topics(null));
        $this->assertSame([], parent_parse_topics('not json'));
        $this->assertSame([], parent_parse_topics('"just a string"'));
        $this->assertSame([], parent_parse_topics('{"a": "b"}'));
        // Markup is kept as plain text for the page to show literally
        $this->assertSame(['<b>Bold</b>'], parent_parse_topics('["<b>Bold</b>"]'));
    }

    public function test_assessments_keep_only_named_rows_with_a_positive_weight(): void
    {
        $json = '[{"type":"Tests","weight":40},{"type":" Exam ","weight":"50"},{"type":"Task","weight":7.5},'
              . '{"type":"","weight":10},{"type":"Zero","weight":0},{"type":"Negative","weight":-5},{"type":"NoWeight"},'
              . '{"weight":20},{"type":["x"],"weight":10},"junk",null]';
        $this->assertSame(
            [
                ['type' => 'Tests', 'weight' => 40],
                ['type' => 'Exam', 'weight' => 50],
                ['type' => 'Task', 'weight' => 7.5],
            ],
            parent_parse_assessments($json)
        );
        $this->assertSame([], parent_parse_assessments(''));
        $this->assertSame([], parent_parse_assessments(null));
        $this->assertSame([], parent_parse_assessments('nonsense'));
        $this->assertSame([], parent_parse_assessments('{"type":"Tests","weight":100}'));
    }

    public function test_summary_without_marks_says_so_and_does_not_guess(): void
    {
        $s = parent_build_summary('Thandi', null, null, []);
        $this->assertSame('Thandi has no published marks yet.', $s['headline']);
        $this->assertStringContainsString('published', $s['note']);
    }

    public function test_summary_describes_the_trend_not_the_mark(): void
    {
        $subjects = [
            ['name' => 'Mathematics', 'mark' => 58, 'delta' => 5],
            ['name' => 'Physical Sciences', 'mark' => 41, 'delta' => -4],
            ['name' => 'English', 'mark' => 72, 'delta' => 0],
        ];

        $this->assertSame('Thandi is improving this term.', parent_build_summary('Thandi', 66, 63, $subjects)['headline']);
        $this->assertSame("Thandi's marks are a little lower than last term.", parent_build_summary('Thandi', 60, 63, $subjects)['headline']);
        $this->assertSame('Thandi is steady this term.', parent_build_summary('Thandi', 64, 63, $subjects)['headline']);
        $this->assertSame("Thandi's average so far is 66%.", parent_build_summary('Thandi', 66, null, $subjects)['headline']);

        $note = parent_build_summary('Thandi', 64, 63, $subjects)['note'];
        $this->assertStringContainsString('Mathematics improved the most, up 5 points.', $note);
        $this->assertStringContainsString('Physical Sciences dipped by 4 points and is the lowest mark at 41%.', $note);
    }

    public function test_summary_uses_a_neutral_name_when_the_first_name_is_missing(): void
    {
        $this->assertStringStartsWith('Your child', parent_build_summary('', 50, 50, [])['headline']);
    }
}
