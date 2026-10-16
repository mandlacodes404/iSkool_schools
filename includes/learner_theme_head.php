<?php
/**
 * Learner desktop theme (light / dark) for standalone pages that open inside the learner dashboard's
 * #mainFrame iframe: take_quiz.php and submit_quiz.php.
 *
 * Those pages are separate documents, so the <html data-learner-theme> attribute that Settings > Appearance sets on
 * the dashboard never reaches them. This include closes that gap. It prints two things, in this order:
 *   1. a tiny script that reads the same saved choice the dashboard uses (localStorage, falling back to the parent
 *      page's attribute) and sets data-learner-theme on this page's <html> before the first paint, then keeps it in
 *      sync if the choice changes while the page is open;
 *   2. the page's light stylesheet. Every rule in it sits inside @media (min-width: 769px), so phones keep the
 *      existing dark look whatever the saved choice is.
 *
 * Usage: include it inside <head>, AFTER the page's own <style>, and say which stylesheet to load:
 *     <?php $learnerThemeCss = 'take_quiz_light.css'; require __DIR__ . '/includes/learner_theme_head.php'; ?>
 *
 * The stylesheet must be a file directly inside assets/css/learner/. Nothing from the request is used here.
 */
$learnerThemeCss = isset($learnerThemeCss) ? basename((string) $learnerThemeCss) : '';
$learnerThemeCssPath = __DIR__ . '/../assets/css/learner/' . $learnerThemeCss;

if (preg_match('/^[a-z0-9_]+\.css$/', $learnerThemeCss) && is_file($learnerThemeCssPath)):
    $learnerThemeCssVersion = (int) @filemtime($learnerThemeCssPath);
?>
<script>
(function () {
    var root = document.documentElement;
    // Same key desktop_settings.js writes. The dashboard may override it, so ask the parent page first.
    function themeKey() {
        try {
            if (window.parent !== window && window.parent.ISKOOL_LEARNER_THEME_KEY) return window.parent.ISKOOL_LEARNER_THEME_KEY;
        } catch (e) {}
        return window.ISKOOL_LEARNER_THEME_KEY || 'iskoolLearnerDesktopTheme';
    }
    function apply(theme) {
        if (theme === 'light' || theme === 'dark') root.dataset.learnerTheme = theme;
    }
    var saved = '';
    try { saved = localStorage.getItem(themeKey()) || ''; } catch (e) {}
    if (saved !== 'light' && saved !== 'dark') {
        try { saved = window.parent !== window ? (window.parent.document.documentElement.dataset.learnerTheme || '') : ''; } catch (e) { saved = ''; }
    }
    apply(saved);
    // The choice can change in the dashboard (Settings > Appearance) while this page is open.
    window.addEventListener('storage', function (e) {
        if (e.key === themeKey()) apply(e.newValue);
    });
})();
</script>
<link rel="stylesheet" href="assets/css/learner/<?= htmlspecialchars($learnerThemeCss, ENT_QUOTES) ?>?v=<?= $learnerThemeCssVersion ?>">
<?php endif; ?>
