/* assets/js/teacher/teacher_mobile_theme.js
   Light / dark theme for the teacher app on phones (max-width: 768px). Load it in the <head>, after the
   theme-color <meta> tag, so the page and the status bar are the right colour on first paint (no flash of the
   wrong colours). Desktop has its own switch (teacher_desktop_settings.js, attribute data-teacher-theme) and is
   not touched by this file.

   - Saved in localStorage under the key teacher_dashboard.php sets in window.ISKOOL_TEACHER_MOBILE_THEME_KEY
     (one key per school account, like the desktop one), and set on <html data-teacher-mobile-theme>.
   - Dark is the default. The attribute is always "dark" or "light"; only "light" has CSS written for it.
   - window.iskoolTeacherMobileTheme.get() returns 'light' or 'dark'; .set('light'|'dark') applies and saves it.
   - Changing it fires an 'iskool:teacher-mobile-theme' event on document, for pages that need to repaint something.
   - The status bar colour (the theme-color meta tag) follows what is on screen, not just the saved choice: it is
     light only while the menu is open or a page that already has a light design is showing (see PAGE in this
     file, the same markers as the gate in teacher_mobile_light.css). Every other page keeps the dark bar.
   - The header takes the page's signature colour once a page scrolls: the scroll handler in dashboard.js writes it
     straight onto the header, in light as well as dark, so nothing here needs to repaint it.

   Optional, set before this file loads:
     window.ISKOOL_TEACHER_MOBILE_THEME_KEY = 'someOtherStorageKey'; */
(function () {
  'use strict';
  if (window.iskoolTeacherMobileTheme) return;
  var root = document.documentElement;
  var KEY = window.ISKOOL_TEACHER_MOBILE_THEME_KEY || 'iskoolTeacherMobileTheme';
  var LIGHT_BAR = '#faf9f5';            // browser / PWA status bar colour while light is on
  var DARK_BAR = '#0d1117';             // what teacher_dashboard.php uses for dark
  var watching = false;
  // Markup that marks a page that already has a light design, looked for inside #api-content-area.
  // Keep in step with the :is( ) list in the :has( ) gate in teacher_mobile_light.css.
  var PAGE = '.ms, .thx, .as-mobile-list, .as-mobile-detail, .as-error-message, .qz-mobile-list, .qz-mobile-detail, .qz-error-state, .an-mobile-list, .an-mobile-detail, .an-error-message, .rs-mobile-list, .rs-error-message';

  function saved() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function get() { return root.getAttribute('data-teacher-mobile-theme') === 'light' ? 'light' : 'dark'; }

  // Is the light design on screen right now? Light is chosen, and either the menu is open or a converted page
  // is showing.
  function lightOnScreen() {
    if (get() !== 'light') return false;
    var area = document.getElementById('api-content-area');
    return !!(document.querySelector('.sidebar.active') || (area && area.querySelector(PAGE)));
  }

  // Keep the status bar in step with what is on screen (only if the page already has a theme-color meta tag).
  // Only the two plain bar colours are swapped; a colour the dashboard chose for a scrolled, coloured page, or
  // the menu's own colour while it is open, is left alone.
  function bar() {
    var m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
    var now = (m.getAttribute('content') || '').toLowerCase();
    if (lightOnScreen()) { if (now === DARK_BAR) m.setAttribute('content', LIGHT_BAR); }
    else if (now === LIGHT_BAR) m.setAttribute('content', DARK_BAR);
  }
  function apply(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-teacher-mobile-theme', theme);
    bar();
    return theme;
  }
  function set(theme) {
    theme = apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('iskool:teacher-mobile-theme', { detail: { theme: theme } })); } catch (e) {}
    return theme;
  }

  // dashboard.js and teacher_dashboard.php write #0d1117 into the theme-color meta in many places (page changes,
  // menu open and close, scrolling). Put the right colour back whenever that happens, and whenever the page or the
  // menu changes.
  function watch() {
    if (watching || !window.MutationObserver) return;
    watching = true;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) new MutationObserver(bar).observe(m, { attributes: true, attributeFilter: ['content'] });
    var area = document.getElementById('api-content-area');
    if (area) new MutationObserver(bar).observe(area, { childList: true });
    var menu = document.querySelector('.sidebar');
    if (menu) new MutationObserver(bar).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }

  apply(saved());
  // the <meta> may not exist yet when this runs in the <head>; set the bar again once the page has parsed
  document.addEventListener('DOMContentLoaded', function () { bar(); watch(); });

  window.iskoolTeacherMobileTheme = { get: get, set: set };
})();
