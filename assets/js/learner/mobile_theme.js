/* assets/js/learner/mobile_theme.js
   Light / dark theme for phones (max-width: 768px). Load it in the <head>, BEFORE the stylesheets, so there is
   no flash of the wrong colours on load. Desktop has its own switch (desktop_settings.js, key
   iskoolLearnerDesktopTheme, attribute data-learner-theme) and is not touched by this file.

   - Saved in localStorage under iskoolLearnerMobileTheme and set on <html data-learner-mobile-theme>.
   - Dark is the default. The attribute is always "dark" or "light"; only "light" has CSS written for it.
   - window.iskoolMobileTheme.get() returns 'light' or 'dark'; .set('light'|'dark') applies and saves it.
   - Changing it fires a 'iskool:mobile-theme' event on document, for pages that need to repaint something.

   Optional, set before this file loads:
     window.ISKOOL_LEARNER_MOBILE_THEME_KEY = 'someOtherStorageKey'; */
(function () {
  'use strict';
  if (window.iskoolMobileTheme) return;
  var root = document.documentElement;
  var KEY = window.ISKOOL_LEARNER_MOBILE_THEME_KEY || 'iskoolLearnerMobileTheme';
  var LIGHT_BAR = '#faf9f5';            // browser / PWA status bar colour while light is on
  var DARK_BAR = '#20201f';             // what learner_dashboard.php uses for dark
  var darkBar = null, watching = false;

  function saved() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function get() { return root.getAttribute('data-learner-mobile-theme') === 'light' ? 'light' : 'dark'; }

  // keep the status bar in step with the page (only if the page already has a theme-color meta tag)
  function bar(theme) {
    var m = document.querySelector('meta[name="theme-color"]'); if (!m) return;
    if (darkBar === null) darkBar = (m.getAttribute('content') !== LIGHT_BAR && m.getAttribute('content')) || DARK_BAR;
    if (theme === 'light') m.setAttribute('content', LIGHT_BAR);
    else if (darkBar) m.setAttribute('content', darkBar);
  }
  function apply(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-learner-mobile-theme', theme);
    bar(theme);
    return theme;
  }
  function set(theme) {
    theme = apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('iskool:mobile-theme', { detail: { theme: theme } })); } catch (e) {}
    return theme;
  }

  // learner_dashboard.php writes #20201f into the theme-color meta in many places (page changes, menu open and close,
  // scrolling). While light is on, turn that back into the light colour. The menu's own colour is left alone.
  function watch() {
    var m = document.querySelector('meta[name="theme-color"]'); if (!m || watching || !window.MutationObserver) return;
    watching = true;
    new MutationObserver(function () {
      if (get() === 'light' && m.getAttribute('content') === DARK_BAR) m.setAttribute('content', LIGHT_BAR);
    }).observe(m, { attributes: true, attributeFilter: ['content'] });
  }

  apply(saved());
  // the <meta> may not exist yet when this runs in the <head>; set the bar again once the page has parsed
  document.addEventListener('DOMContentLoaded', function () { bar(get()); watch(); });

  window.iskoolMobileTheme = { get: get, set: set };
})();
