<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/multiple_answer_scoring.php';

class MultipleAnswerScoringTest extends TestCase
{
    public function test_invalid_submitted_choice_ids_are_ignored(): void
    {
        $submitted = [
            10 => true,
            20 => true,
            999 => true,
        ];
        $valid = [
            10 => true,
            20 => true,
            30 => true,
        ];

        $this->assertSame(
            [10 => true, 20 => true],
            filter_valid_multiple_answer_choices($submitted, $valid)
        );
    }

    public function test_valid_submitted_choice_ids_are_preserved(): void
    {
        $submitted = [
            10 => true,
            30 => true,
        ];
        $valid = [
            10 => true,
            20 => true,
            30 => true,
        ];

        $this->assertSame(
            [10 => true, 30 => true],
            filter_valid_multiple_answer_choices($submitted, $valid)
        );
    }
}
