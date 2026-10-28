/*
 * Parent app: the installed-app plumbing the learner dashboard has inline at the end of learner_dashboard.php.
 *
 *   - Makes sure the service worker is registered (index.php registers it when the login page opens; this covers an
 *     app opened straight on this page).
 *   - When the service worker has downloaded a new version it says so; the "New version ready" banner
 *     (assets/js/shared/pwa_prompts.js) offers the update, and when the new worker takes over the page reloads once.
 *     If the banner script has not started yet, it picks up the flag set here when it does.
 *
 * Load it before pwa_prompts.js.
 */
(function () {
    'use strict';
    if (!('serviceWorker' in navigator)) return;

    var hadController = Boolean(navigator.serviceWorker.controller);
    var reloading = false;

    navigator.serviceWorker.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'iskool-update-available') return;
        if (window.iskoolPwa) window.iskoolPwa.offerUpdate();
        else window.__iskoolUpdatePending = true;
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
    });

    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(function () { /* the app works without it */ });
})();
