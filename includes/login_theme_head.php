<?php
/**
 * Desktop light / dark theme for the login page (index.php): the splash screen, the login / register /
 * forgot-password forms, and the animated panel on the left (which reads the same setting itself).
 *
 * The login page is shown before anyone has signed in, so it cannot know which account's theme to use. Instead
 * both dashboards remember the theme they last showed on this browser (localStorage key
 * "iskoolDesktopThemeLastUsed", value "light" or "dark") and this page reads it.
 *
 * It prints, in this order:
 *   1. a tiny script that sets <html data-login-theme="light"> before the first paint, and keeps it in sync if
 *      another tab changes the saved value while this page is open;
 *   2. the two light stylesheets. Every rule in them sits inside @media (min-width: 769px), so phones and narrow
 *      windows keep the existing dark look whatever the saved value is.
 *
 * Only learner and teacher dashboards have a light mode. When someone is already signed in as another role
 * (parent, school admin) this page is just the first half of the splash on the way to a dark dashboard, so it
 * stays dark too and the splash does not change colour between the two pages.
 *
 * Usage: include it inside <head>, AFTER assets/css/index.css.
 */
$loginThemeRole    = $_SESSION['role'] ?? '';
$loginThemeAllowed = ($loginThemeRole === '' || in_array($loginThemeRole, ['learner', 'teacher'], true));

if ($loginThemeAllowed):
    $loginThemeSplashCss = __DIR__ . '/../assets/css/splash_light.css';
    $loginThemeIndexCss  = __DIR__ . '/../assets/css/index_light.css';
?>
<script>
(function () {
    var root = document.documentElement;
    function apply(theme) {
        if (theme === 'light') root.dataset.loginTheme = 'light';
        else delete root.dataset.loginTheme;
    }
    try { apply(localStorage.getItem('iskoolDesktopThemeLastUsed')); } catch (e) {}
    window.addEventListener('storage', function (e) {
        if (e.key === 'iskoolDesktopThemeLastUsed') apply(e.newValue);
    });
})();
</script>
<link rel="stylesheet" href="assets/css/splash_light.css?v=<?= (int) @filemtime($loginThemeSplashCss) ?>">
<link rel="stylesheet" href="assets/css/index_light.css?v=<?= (int) @filemtime($loginThemeIndexCss) ?>">
<?php endif; ?>
