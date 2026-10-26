<?php
/**
 * Learner theme (light / dark) for standalone pages that open from the learner dashboard: take_quiz.php and
 * submit_quiz.php. On desktop they open inside the dashboard's #mainFrame iframe; on phones the quiz links navigate to
 * them directly, so there they are the top-level page and their own <meta name="theme-color"> is the browser bar.
 *
 * Those pages are separate documents, so the attributes that the dashboard sets on its own <html> never reach them.
 * This include closes that gap. It prints two things, in this order:
 *   1. a tiny script that, before the first paint,
 *        - reads the desktop choice the dashboard uses (localStorage iskoolLearnerDesktopTheme, falling back to the
 *          parent page's attribute) and sets data-learner-theme on this page's <html>;
 *        - reads the phone choice (localStorage iskoolLearnerMobileTheme, the key mobile_theme.js writes) and sets
 *          data-learner-mobile-theme ("light" or "dark", dark by default) on <html>;
 *        - on a phone (max-width: 768px) in light, moves <meta name="theme-color"> from the dark #20201f to the light
 *          #faf9f5, and to a dimmed cream while a modal card or the image lightbox is open (the backdrop dims the page
 *          but cannot reach the browser bar, so the bar has to be told);
 *        and keeps all of it in sync if the choice changes while the page is open;
 *   2. the page's light stylesheet. It has two blocks: the first is inside @media (min-width: 769px) and follows
 *      data-learner-theme, the second is inside @media (max-width: 768px) and follows data-learner-mobile-theme. Dark
 *      is the existing look on both, whatever the saved choice is.
 *
 * Usage: include it inside <head>, AFTER the page's own <style> and its <meta name="theme-color">, and say which
 * stylesheet to load:
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

    // ── Desktop (data-learner-theme) ───────────────────────────────────────────────────────────────────────────
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

    // ── Phones (data-learner-mobile-theme + the browser bar) ───────────────────────────────────────────────────
    var PHONE = '(max-width: 768px)';
    var DARK_BAR = '#20201f';        // what the page's own <meta name="theme-color"> says
    var LIGHT_BAR = '#faf9f5';       // the light page / top bar
    var MODAL_BAR = '#babab6';       // LIGHT_BAR seen through the modal backdrop, rgba(38,39,35,.30)
    var LIGHTBOX_BAR = '#141414';    // LIGHT_BAR seen through the image lightbox, rgba(0,0,0,.92)

    // Same key mobile_theme.js writes on the dashboard.
    function mobileKey() {
        try {
            if (window.parent !== window && window.parent.ISKOOL_LEARNER_MOBILE_THEME_KEY) return window.parent.ISKOOL_LEARNER_MOBILE_THEME_KEY;
        } catch (e) {}
        return window.ISKOOL_LEARNER_MOBILE_THEME_KEY || 'iskoolLearnerMobileTheme';
    }
    function isPhone() { return !!(window.matchMedia && window.matchMedia(PHONE).matches); }
    function isLight() { return root.getAttribute('data-learner-mobile-theme') === 'light'; }

    // The browser bar follows what is on screen: light page, dimmed cream under a card, nearly black under the lightbox.
    function bar() {
        var m = document.querySelector('meta[name="theme-color"]');
        if (!m) return;
        var colour = DARK_BAR;
        if (isLight() && isPhone()) {
            colour = LIGHT_BAR;
            if (document.querySelector('.lightbox.show')) colour = LIGHTBOX_BAR;
            else if (document.querySelector('.modal-overlay.show')) colour = MODAL_BAR;
        }
        if (m.getAttribute('content') !== colour) m.setAttribute('content', colour);
    }
    function applyMobile(theme) {
        root.setAttribute('data-learner-mobile-theme', theme === 'light' ? 'light' : 'dark');
        bar();
    }
    var savedMobile = '';
    try { savedMobile = localStorage.getItem(mobileKey()) || ''; } catch (e) {}
    applyMobile(savedMobile);

    // ── Keep in sync ───────────────────────────────────────────────────────────────────────────────────────────
    // The choice can change in the dashboard (Settings > Appearance) while this page is open.
    window.addEventListener('storage', function (e) {
        if (e.key === themeKey()) apply(e.newValue);
        if (e.key === mobileKey()) applyMobile(e.newValue);
    });
    // Turning the phone sideways crosses 768px.
    try {
        var mq = window.matchMedia(PHONE);
        if (mq.addEventListener) mq.addEventListener('change', bar); else if (mq.addListener) mq.addListener(bar);
    } catch (e) {}
    // The quiz page shows its cards (Submit / Exit / Time's Up) and the lightbox by adding .show; follow that.
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.MutationObserver) return;
        var watch = new MutationObserver(bar);
        document.querySelectorAll('.modal-overlay, .lightbox').forEach(function (el) {
            watch.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        bar();
    });
})();
</script>
<link rel="stylesheet" href="assets/css/learner/<?= htmlspecialchars($learnerThemeCss, ENT_QUOTES) ?>?v=<?= $learnerThemeCssVersion ?>">
<?php endif; ?>
