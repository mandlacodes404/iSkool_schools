<?php
require_once 'config.php'; // Your DB connection

// Safety: Prevent re-running accidentally
echo "<pre>";
echo "=== iSkool Dummy Data Seeder ===\n";
echo "This will insert teachers, classes, learners, enrollments, and quizzes.\n";
echo "Run only on development/test database!\n\n";

// Optional: Uncomment to require confirmation
// echo "Type 'SEED NOW' to continue: ";
// $handle = fopen("php://stdin", "r");
// $line = fgets($handle);
// if (trim($line) != 'SEED NOW') {
//     echo "Aborted.\n";
//     exit;
// }

$academic_year_id = 1; // 2025 active year

// --------------------------------------------------
// 1. Insert 5 Teachers
// --------------------------------------------------
$teachers = [
    ['Mr', 'Thabo', 'Nkosi', 'thabo.nkosi@iskool.demo', 'male'],
    ['Mrs', 'Lerato', 'Patel', 'lerato.patel@iskool.demo', 'female'],
    ['Ms', 'Nomsa', 'Khumalo', 'nomsa.khumalo@iskool.demo', 'female'],
    ['Dr', 'Pieter', 'van der Merwe', 'pieter.vandermerwe@iskool.demo', 'male'],
    ['Mr', 'Sibusiso', 'Mokoena', 'sibusiso.mokoena@iskool.demo', 'male'],
];

$teacher_emails = [];
foreach ($teachers as $t) {
    [$title, $name, $surname, $email, $gender] = $t;
    $password = password_hash('Password123', PASSWORD_DEFAULT); // Default password

    $stmt = $conn->prepare("INSERT INTO users (name, title, surname, email, password, role, gender, age) VALUES (?, ?, ?, ?, ?, 'teacher', ?, 35)");
    $stmt->bind_param("ssssss", $name, $title, $surname, $email, $password, $gender);
    if ($stmt->execute()) {
        echo "Teacher created: $title $name $surname ($email)\n";
        $teacher_emails[] = $email;
    }
    $stmt->close();
}

echo "\n";

// --------------------------------------------------
// 2. Insert 2 Classes
// --------------------------------------------------
$classes = [
    ['Grade 10 Mathematics A', 'Mathematics', $teacher_emails[0]], // Mr Nkosi
    ['Grade 11 Physical Sciences B', 'Physical Sciences', $teacher_emails[1]], // Mrs Patel
];

$class_ids = [];
foreach ($classes as $c) {
    [$name, $subject, $created_by] = $c;

    $stmt = $conn->prepare("INSERT INTO classes (name, subject, created_by, school_id) VALUES (?, ?, ?, 0)");
    $stmt->bind_param("sss", $name, $subject, $created_by);
    if ($stmt->execute()) {
        $class_id = $conn->insert_id;
        $class_ids[] = $class_id;
        echo "Class created: $name (ID: $class_id)\n";
    }
    $stmt->close();
}

echo "\n";

// --------------------------------------------------
// 3. Insert 60 Learners (mixed gender) - WITH DUPLICATE PROTECTION
// --------------------------------------------------
$male_names   = ['Athi', 'Lungile', 'Sipho', 'Bongani', 'Thabang', 'Kagiso', 'Tshepo', 'Ofentse', 'Rethabile', 'Katlego', 'Siya', 'Andile', 'Mpho', 'Lwandle', 'Junior', 'Thando', 'Ayanda', 'Lindani', 'Mthunzi', 'Sanele'];
$female_names = ['Zandi', 'Naledi', 'Amahle', 'Lindiwe', 'Zinhle', 'Refilwe', 'Boitumelo', 'Dineo', 'Lerato', 'Palesa', 'Thandi', 'Nomvula', 'Onthatile', 'Kgomotso', 'Tumelo', 'Busisiwe', 'Nokuthula', 'Siphesihle', 'Ntokozo', 'Precious'];
$surnames     = ['Mthembu', 'Dlamini', 'Ngubane', 'Zulu', 'Mokoena', 'Khoza', 'Sibiya', 'Ndlovu', 'Shabalala', 'Buthelezi', 'Gumede', 'Mthethwa', 'Nkosi', 'Khuzwayo', 'Mhlongo', 'Hlongwane', 'Mbatha', 'Sithole', 'Mathenjwa', 'Vilakazi'];

$learner_emails = [];
$used_emails = [];

for ($i = 1; $i <= 60; $i++) {
    $gender = ($i <= 33) ? 'male' : 'female'; // ~55% male
    $name_list = ($gender === 'male') ? $male_names : $female_names;
    
    // Keep trying until we get a unique email
    do {
        $name = $name_list[array_rand($name_list)];
        $surname = $surnames[array_rand($surnames)];
        $email = strtolower($name . '.' . $surname . '@iskool.demo');
        $email = preg_replace('/\s+/', '', $email);
    } while (in_array($email, $used_emails));

    $used_emails[] = $email;
    $age = rand(15, 18);
    $password = password_hash('Password123', PASSWORD_DEFAULT);

    $stmt = $conn->prepare("INSERT INTO users (name, surname, email, password, role, gender, age) VALUES (?, ?, ?, ?, 'learner', ?, ?)");
    $stmt->bind_param("sssssi", $name, $surname, $email, $password, $gender, $age);
    
    if ($stmt->execute()) {
        echo "Learner created: $name $surname ($email)\n";
        $learner_emails[] = $email;
    } else {
        echo "Failed to create learner: $email (possibly still duplicate or DB error)\n";
    }
    $stmt->close();
}

echo "\n";

// --------------------------------------------------
// 4. Enroll Learners (30 per class)
// --------------------------------------------------
foreach ($class_ids as $idx => $class_id) {
    $start = $idx * 30;
    for ($j = $start; $j < $start + 30; $j++) {
        $student_email = $learner_emails[$j];
        $stmt = $conn->prepare("INSERT INTO class_students (class_id, student_email, academic_year_id) VALUES (?, ?, ?)");
        $stmt->bind_param("isi", $class_id, $student_email, $academic_year_id);
        $stmt->execute();
        $stmt->close();
    }
    echo "Enrolled 30 learners into class ID $class_id\n";
}

echo "\n";

// --------------------------------------------------
// 5. Insert Quizzes (16 total, across terms)
// --------------------------------------------------
$quizzes_data = [
    // Term 1
    ['Term 1: Number Patterns', 30, $class_ids[0], $teacher_emails[0], 1, 0, null], // formative
    ['Term 1: Algebra Basics', 40, $class_ids[0], $teacher_emails[0], 1, 0, null],
    ['Term 1: Summative Test 1', 60, $class_ids[0], $teacher_emails[0], 1, 1, 30.00],
    ['Term 1: Mechanics Intro', 45, $class_ids[1], $teacher_emails[1], 1, 0, null],
    ['Term 1: Summative Assessment', 60, $class_ids[1], $teacher_emails[1], 1, 1, 35.00],

    // Term 2
    ['Term 2: Equations & Inequalities', 35, $class_ids[0], $teacher_emails[2], 2, 0, null],
    ['Term 2: Functions Practice', 40, $class_ids[0], $teacher_emails[2], 2, 0, null],
    ['Term 2: Mid-Year Summative', 90, $class_ids[0], $teacher_emails[0], 2, 1, 40.00],
    ['Term 2: Waves & Sound', 50, $class_ids[1], $teacher_emails[3], 2, 0, null],
    ['Term 2: Electricity Basics', 45, $class_ids[1], $teacher_emails[1], 2, 0, null],
    ['Term 2: Summative Test', 70, $class_ids[1], $teacher_emails[1], 2, 1, 40.00],

    // Term 3
    ['Term 3: Euclidean Geometry', 50, $class_ids[0], $teacher_emails[2], 3, 0, null],
    ['Term 3: Analytical Geometry', 40, $class_ids[0], $teacher_emails[0], 3, 0, null],
    ['Term 3: Final Summative', 120, $class_ids[0], $teacher_emails[0], 3, 1, 30.00],
    ['Term 3: Chemical Bonding', 55, $class_ids[1], $teacher_emails[3], 3, 0, null],
    ['Term 3: End-of-Year Summative', 120, $class_ids[1], $teacher_emails[1], 3, 1, 30.00],
];

foreach ($quizzes_data as $q) {
    [$title, $duration, $class_id, $created_by, $term_number, $is_summative, $weight] = $q;

   $day = rand(10, 25);
if ($term_number == 1) {
    $month = "2025-02-$day";
} elseif ($term_number == 2) {
    $month = "2025-05-$day";
} else {
    $month = "2025-08-$day";
}
$start_time = $month . ' 09:00:00';
    $start_time = $month . ' 09:00:00';
    $status = 'Closed'; // All past

    $stmt = $conn->prepare("
        INSERT INTO quizzes 
        (title, duration, created_by, class_id, academic_year_id, term_number, start_time, status, is_summative, weight_percent, publish_marks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ");
    $stmt->bind_param("sisiiissid", $title, $duration, $created_by, $class_id, $academic_year_id, $term_number, $start_time, $status, $is_summative, $weight);
    if ($stmt->execute()) {
        echo "Quiz created: $title (Term $term_number, Summative: $is_summative)\n";
    }
    $stmt->close();
}

echo "\n=== SEEDING COMPLETE! ===\n";
echo "You can now log in as any learner (*.demo) or teacher with password: Password123\n";
echo "Check your quizzes page – you should see real data grouped by teacher across terms!\n";

?>