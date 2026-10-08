<?php

/**
 * Teacher/class access is established by teacher_subjects. Teachers can link
 * themselves to a class through the existing subject flow; all class-scoped
 * content writers must then use that same relationship.
 */
function teacher_has_class_access(mysqli $conn, string $teacher_email, int $class_id): bool
{
    if ($class_id <= 0) {
        return false;
    }

    $stmt = $conn->prepare(
        'SELECT 1 FROM teacher_subjects WHERE teacher_email = ? AND class_id = ? LIMIT 1'
    );
    $stmt->bind_param('si', $teacher_email, $class_id);
    $stmt->execute();
    $has_access = $stmt->get_result()->num_rows === 1;
    $stmt->close();

    return $has_access;
}
