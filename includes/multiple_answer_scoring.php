<?php

/**
 * Keep only submitted multiple-answer choice IDs that belong to the question.
 *
 * @param array $submitted_choice_ids Submitted choice IDs keyed by ID or as a list.
 * @param array $valid_choice_ids Valid choice IDs keyed by ID.
 * @return array Valid submitted choice IDs keyed by ID.
 */
function filter_valid_multiple_answer_choices(array $submitted_choice_ids, array $valid_choice_ids): array
{
    $selected_set = [];

    foreach ($submitted_choice_ids as $choice_id => $_) {
        $choice_id = (int)$choice_id;
        if (isset($valid_choice_ids[$choice_id])) {
            $selected_set[$choice_id] = true;
        }
    }

    return $selected_set;
}
