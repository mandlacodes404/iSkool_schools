/* assets/js/learner/mobile_theme.js
   Light / dark theme for phones (max-width: 768px). Load it in the <head>, BEFORE the stylesheets, so there is
   no flash of the wrong colours on load. Desktop has its own switch (desktop_settings.js, key
   iskoolLearnerDesktopTheme, attribute data-learner-theme) and is not touched by this file.

   - Saved in localStorage under iskoolLearnerMobileTheme and set on <html data-learner-mobile-theme>.
   - Dark is the default. The attribute is always "dark" or "light"; only "light" has CSS written for it.
   - window.iskoolMobileTheme.get() returns 'light' or 'dark'; .set('light'|'dark') applies and saves it.
   - Changing it fires a 'iskool:mobile-theme' event on document, for pages that need to repaint something.
   - The status bar colour (the theme-color meta tag) follows what is on screen, not just the saved choice: it is
     light only while the menu is open or a page that already has a light design is showing (see PAGE in this
     file, the same markers as the gate in mobile_light.css). Every other page keeps the dark bar.

   Optional, set before this file loads:
     window.ISKOOL_LEARNER_MOBILE_THEME_KEY = 'someOtherStorageKey'; */
(function () {
  'use strict';
  if (window.iskoolMobileTheme) return;
  var root = document.documentElement;
  var KEY = window.ISKOOL_LEARNER_MOBILE_THEME_KEY || 'iskoolLearnerMobileTheme';
  var LIGHT_BAR = '#faf9f5';            // browser / PWA status bar colour while light is on
  var DARK_BAR = '#20201f';             // what learner_dashboard.php uses for dark
  var watching = false;
  // Pages that already have a light design. Keep in step with the :has( ) gate in mobile_light.css.
  var PAGE = '#api-content-area .ms, #api-content-area [class*="las-mobile"]';

  function saved() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function get() { return root.getAttribute('data-learner-mobile-theme') === 'light' ? 'light' : 'dark'; }

  // Is the light design on screen right now? Light is chosen, and either the menu is open or a converted page is showing.
  function lightOnScreen() {
    return get() === 'light' && !!(document.querySelector('.sidebar.active') || document.querySelector(PAGE));
  }

  // Keep the status bar in step with what is on screen (only if the page already has a theme-color meta tag).
  // Only the two plain bar colours are swapped; a colour the dashboard chose for a scrolled, coloured page is left alone.
  function bar() {
    var m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
    var now = m.getAttribute('content');
    if (lightOnScreen()) { if (now === DARK_BAR) m.setAttribute('content', LIGHT_BAR); }
    else if (now === LIGHT_BAR) m.setAttribute('content', DARK_BAR);
  }
  function apply(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-learner-mobile-theme', theme);
    bar();
    return theme;
  }
  function set(theme) {
    theme = apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('iskool:mobile-theme', { detail: { theme: theme } })); } catch (e) {}
    return theme;
  }

  // learner_dashboard.php writes #20201f into the theme-color meta in many places (page changes, menu open and close,
  // scrolling). Put the right colour back whenever that happens, and whenever the page or the menu changes.
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

  window.iskoolMobileTheme = { get: get, set: set };
})();
