<?php
session_start();
require_once 'config.php';

// Ensure only admins can access
if (!isset($_SESSION['email']) || $_SESSION['role'] !== 'admin') {
    header("Location: index.php");
    exit();
}

$adminEmail = $_SESSION['email'];
$adminSchoolId = $_SESSION['school_id'];
$isSuperAdmin = ($adminSchoolId == 9999);

// Step 1: Determine selected school_id to manage
// For super admin, get from GET param ?school_id=xx, else use their school_id
if ($isSuperAdmin && isset($_GET['school_id']) && is_numeric($_GET['school_id'])) {
    $selectedSchoolId = intval($_GET['school_id']);
} else {
    $selectedSchoolId = $adminSchoolId;
}

// Fetch all schools for super admin to select from
$schools = [];
if ($isSuperAdmin) {
    $result = $conn->query("SELECT id, name FROM schools ORDER BY name ASC");
    while ($row = $result->fetch_assoc()) {
        $schools[] = $row;
    }
}

// Handle deletion of class, only if it belongs to selected school
if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $deleteId = intval($_GET['delete']);
    // Verify class belongs to selected school before deleting
    $checkClass = $conn->prepare("SELECT id FROM classes WHERE id = ? AND school_id = ?");
    $checkClass->bind_param("ii", $deleteId, $selectedSchoolId);
    $checkClass->execute();
    $checkClass->store_result();
    if ($checkClass->num_rows > 0) {
        $stmt = $conn->prepare("DELETE FROM classes WHERE id = ?");
        $stmt->bind_param("i", $deleteId);
        $stmt->execute();
    }
    // Redirect to avoid resubmission & keep school_id in URL if super admin
    $redirectUrl = "admin_classes.php";
    if ($isSuperAdmin) {
        $redirectUrl .= "?school_id=" . $selectedSchoolId;
    }
    header("Location: $redirectUrl");
    exit();
}

// Handle class creation form
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['class_name'])) {
    $className = trim($_POST['class_name']);
    if (!empty($className)) {
        // Define required variables for insert
        $subject = 'General';  // default subject, can be changed or expanded later
        $schoolId = $selectedSchoolId;
        $createdBy = $adminEmail;

        // Check duplicate class name only within the selected school
        $check = $conn->prepare("SELECT * FROM classes WHERE name = ? AND school_id = ?");
        $check->bind_param("si", $className, $selectedSchoolId);
        $check->execute();
        $check->store_result();

        if ($check->num_rows === 0) {
            $stmt = $conn->prepare("INSERT INTO classes (name, subject, school_id, created_by) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("ssis", $className, $subject, $schoolId, $createdBy);
            $stmt->execute();
        }
    }
    // Redirect with school_id for super admin
    $redirectUrl = "admin_classes.php";
    if ($isSuperAdmin) {
        $redirectUrl .= "?school_id=" . $selectedSchoolId;
    }
    header("Location: $redirectUrl");
    exit();
}

// Fetch classes for the selected school only
$stmt = $conn->prepare("SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC");
$stmt->bind_param("i", $selectedSchoolId);
$stmt->execute();
$classes = $stmt->get_result();
?>

<!DOCTYPE html>
<html>
<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Manage Classes</title>
    <style>
        /* Your existing styles here */
        body {
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            padding: 30px;
        }
        h1 {
            color: #2c3e50;
        }
        form {
            margin-bottom: 30px;
        }
        input[type="text"] {
            padding: 8px;
            width: 250px;
            border-radius: 5px;
            border: 1px solid #ccc;
        }
        button {
            padding: 8px 16px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 5px;
            margin-left: 10px;
            cursor: pointer;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th, td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
            text-align: left;
        }
        th {
            background: #2980b9;
            color: white;
        }
        a.delete {
            color: red;
            text-decoration: none;
            font-weight: bold;
        }
        a.delete:hover {
            text-decoration: underline;
        }
        /* Dropdown for school selection */
        #school-select {
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

<h1>Manage Classes</h1>

<?php if ($isSuperAdmin): ?>
    <form method="GET" id="school-select">
        <label for="school_id">Select School:</label>
        <select name="school_id" id="school_id" onchange="this.form.submit()">
            <?php foreach ($schools as $school): ?>
                <option value="<?= $school['id'] ?>" <?= ($school['id'] == $selectedSchoolId) ? 'selected' : '' ?>>
                    <?= htmlspecialchars($school['name']) ?>
                </option>
            <?php endforeach; ?>
        </select>
    </form>
<?php endif; ?>

<form method="POST">
    <input type="text" name="class_name" placeholder="Enter class name (e.g. 11A)" required>
    <button type="submit">Add Class</button>
</form>

<table>
    <thead>
        <tr>
            <th>Class Name</th>
            <th>Created By</th>
            <th>Action</th>
        </tr>
    </thead>
    <tbody>
        <?php while ($row = $classes->fetch_assoc()): ?>
            <tr>
                <td><?= htmlspecialchars($row['name']) ?></td>
                <td><?= htmlspecialchars($row['created_by']) ?></td>
                <td>
                    <a class="delete" href="admin_classes.php?delete=<?= $row['id'] ?><?php if ($isSuperAdmin) echo '&school_id=' . $selectedSchoolId; ?>" onclick="return confirm('Are you sure you want to delete this class?');">Delete</a>
                </td>
            </tr>
        <?php endwhile; ?>
    </tbody>
</table>

</body>
</html>
