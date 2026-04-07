<?php
/**
 * iSkool - School Upload Helper
 *
 * Provides a reusable function to resolve school-scoped upload directories.
 * Call getSchoolSlug($conn) to get the sanitized school folder name,
 * or getSchoolUploadDir($conn, $baseDir) to get a ready-to-use absolute path.
 *
 * Drop this file in the project root (same level as config.php).
 */

/**
 * Fetches the school name from the DB and converts it to a safe folder slug.
 * e.g. "Landulwazi Comprehensive School" → "landulwazi_comprehensive_school"
 *
 * @param  mysqli $conn  Active DB connection
 * @return string        Sanitized slug (falls back to "default_school")
 */
function getSchoolSlug(mysqli $conn): string
{
    $result = $conn->query("SELECT setting_value FROM school_name WHERE setting_key = 'school_name' LIMIT 1");
    $schoolName = ($result && $row = $result->fetch_assoc()) ? $row['setting_value'] : '';

    if (empty(trim($schoolName))) {
        return 'default_school';
    }

    // Lowercase, replace spaces/special chars with underscores, strip anything else
    $slug = strtolower(trim($schoolName));
    $slug = preg_replace('/[\s\-]+/', '_', $slug);       // spaces & hyphens → _
    $slug = preg_replace('/[^a-z0-9_]/', '', $slug);     // strip everything else
    $slug = preg_replace('/_+/', '_', $slug);             // collapse multiple __
    $slug = trim($slug, '_');                              // strip leading/trailing _

    return $slug ?: 'default_school';
}

/**
 * Returns the absolute path to a school-scoped upload directory,
 * creating it (recursively) if it doesn't already exist.
 *
 * @param  mysqli $conn     Active DB connection
 * @param  string $baseDir  Absolute path to the base upload folder
 *                          e.g. "/var/www/html/uploads/learners"
 * @return string           Absolute path with trailing slash
 *                          e.g. "/var/www/html/uploads/learners/landulwazi_comprehensive_school/"
 */
function getSchoolUploadDir(mysqli $conn, string $baseDir): string
{
    $slug = getSchoolSlug($conn);
    $dir  = rtrim($baseDir, '/') . '/' . $slug . '/';

    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    return $dir;
}