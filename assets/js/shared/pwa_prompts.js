/*
 * iSkool app prompts, shared by the learner and the teacher dashboards.
 *
 *   1. "New version ready" banner. The service worker tells the page when an update has downloaded. The dashboards
 *      used to ask with window.confirm(), a browser pop-up that looks like a website. This shows a banner inside the
 *      app instead. The banner's Update button waits while a quiz is open, so an update can never end a quiz.
 *   2. "Install iSkool" card (phones only). Android Chrome hands the page an install prompt (beforeinstallprompt);
 *      the card keeps it and shows a one-tap Install button. iPhones have no such prompt, so the card shows the
 *      Share > Add to Home Screen steps instead. Never shown once the app is installed or opened from the home
 *      screen, and after "Not now" it stays away for 14 days.
 *
 * Public API (window.iskoolPwa), for the dashboards and any page that wants to take part:
 *   offerUpdate()           show the update banner (the dashboards call this when the service worker says so)
 *   registerBusyCheck(fn)   fn() returns true while the user must not be interrupted; the Update button waits
 *   isStandalone()          true when running from the home screen
 *   canInstall()            true when the browser has offered its install prompt
 *   install()               open the browser's install prompt (needs a tap)
 *
 * Plain script, no dependencies. localStorage use is wrapped in try/catch because it can throw (private windows).
 */
(function () {
    'use strict';
    if (window.iskoolPwa) return;

    var PHONE = '(max-width: 768px)';
    var DISMISS_KEY = 'iskoolInstallDismissedAt';
    var INSTALLED_KEY = 'iskoolInstalled';
    var DISMISS_DAYS = 14;
    var INSTALL_DELAY_MS = 20000;     // let the splash, the first page and the first taps happen first
    var BUSY_RECHECK_MS = 4000;
    var UPDATE_RELOAD_FALLBACK_MS = 4000;

    var deferredPrompt = null;
    var updateEl = null;
    var installEl = null;
    var busyTimer = 0;
    var installReady = false;         // the delay above has passed
    var busyChecks = [];

    // ── small helpers ────────────────────────────────────────────────────────────────────────────────────────
    function getItem(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
    function setItem(key, value) { try { window.localStorage.setItem(key, value); } catch (e) {} }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }
    function button(label, className, onClick) {
        var b = el('button', 'pwa-btn ' + className, label);
        b.type = 'button';
        b.addEventListener('click', onClick);
        return b;
    }
    function isPhone() { return !!(window.matchMedia && window.matchMedia(PHONE).matches); }

    function isStandalone() {
        try {
            if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        } catch (e) {}
        return window.navigator.standalone === true;   // iPhone home-screen apps
    }
    function isIOS() {
        var ua = window.navigator.userAgent || '';
        // iPadOS reports itself as a Mac, with a touch screen.
        return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    }
    function isRealIOSBrowser() {
        // Facebook, Instagram, LINE and similar in-app browsers cannot add to the home screen.
        var ua = window.navigator.userAgent || '';
        return /Safari\//.test(ua) && !/FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/i.test(ua);
    }

    // ── "busy" = do not interrupt ────────────────────────────────────────────────────────────────────────────
    function registerBusyCheck(fn) { if (typeof fn === 'function') busyChecks.push(fn); }
    function isBusy() {
        for (var i = 0; i < busyChecks.length; i++) {
            try { if (busyChecks[i]()) return true; } catch (e) {}
        }
        return false;
    }
    // A quiz that is open inside the dashboard (desktop shows pages in an iframe) must never be reloaded.
    registerBusyCheck(function () {
        var frames = document.getElementsByTagName('iframe');
        for (var i = 0; i < frames.length; i++) {
            var path = '';
            try { path = frames[i].contentWindow.location.pathname; } catch (e) { path = frames[i].getAttribute('src') || ''; }
            if (/take_quiz\.php/i.test(path)) return true;
        }
        return false;
    });

    // ── 1. update banner ─────────────────────────────────────────────────────────────────────────────────────
    function applyUpdate() {
        if (isBusy()) { refreshUpdateState(); return; }
        if (!('serviceWorker' in navigator)) { window.location.reload(); return; }
        navigator.serviceWorker.getRegistration('/').then(function (registration) {
            if (registration && registration.waiting) {
                // The dashboards reload the page when the new service worker takes over (controllerchange).
                registration.waiting.postMessage({ type: 'iskool-skip-waiting' });
                // If that never happens (for example no controller to change), do not leave the button doing nothing.
                window.setTimeout(function () { window.location.reload(); }, UPDATE_RELOAD_FALLBACK_MS);
            } else {
                window.location.reload();
            }
        }).catch(function () { window.location.reload(); });
    }

    function hideUpdate() {
        window.clearInterval(busyTimer);
        busyTimer = 0;
        if (updateEl && updateEl.parentNode) updateEl.parentNode.removeChild(updateEl);
        updateEl = null;
        if (installReady) window.setTimeout(maybeShowInstall, 3000);
    }

    function refreshUpdateState() {
        if (!updateEl) return;
        var busy = isBusy();
        updateEl.querySelector('[data-act="update"]').disabled = busy;
        updateEl.querySelector('.pwa-banner__sub').textContent = busy
            ? 'Finish your quiz first. You can update after.'
            : 'Update now to get the latest fixes.';
    }

    function offerUpdate() {
        if (updateEl) return;
        if (installEl) hideInstall(false);
        updateEl = el('div', 'pwa-banner pwa-banner--top');
        updateEl.setAttribute('role', 'status');
        updateEl.setAttribute('aria-live', 'polite');

        var text = el('div', 'pwa-banner__text');
        text.appendChild(el('span', 'pwa-banner__title', 'New version ready'));
        text.appendChild(el('span', 'pwa-banner__sub', ''));

        var actions = el('div', 'pwa-banner__actions');
        var update = button('Update', 'pwa-btn--primary', applyUpdate);
        update.setAttribute('data-act', 'update');
        actions.appendChild(update);
        actions.appendChild(button('Later', 'pwa-btn--ghost', hideUpdate));

        updateEl.appendChild(text);
        updateEl.appendChild(actions);
        document.body.appendChild(updateEl);
        refreshUpdateState();
        busyTimer = window.setInterval(refreshUpdateState, BUSY_RECHECK_MS);
    }

    // ── 2. install card ──────────────────────────────────────────────────────────────────────────────────────
    function hideInstall(remember) {
        if (installEl && installEl.parentNode) installEl.parentNode.removeChild(installEl);
        installEl = null;
        if (remember) setItem(DISMISS_KEY, String(Date.now()));
    }

    function shareIcon() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1');
        svg.appendChild(path);
        return svg;
    }

    function install() {
        var prompt = deferredPrompt;
        if (!prompt) return;
        deferredPrompt = null;            // the browser allows one use per event
        prompt.prompt();
        Promise.resolve(prompt.userChoice).then(function (choice) {
            if (choice && choice.outcome === 'accepted') setItem(INSTALLED_KEY, '1');
            hideInstall(!(choice && choice.outcome === 'accepted'));
        }).catch(function () { hideInstall(true); });
    }

    function placeInstallCard() {
        // Sit just above the bottom navigation bar when there is one (its height already includes the home-bar gap).
        var nav = document.getElementById('mobileBottomNav');
        var h = nav && nav.offsetHeight ? nav.offsetHeight : 0;
        installEl.style.bottom = h ? (h + 12) + 'px' : 'calc(12px + env(safe-area-inset-bottom, 0px))';
    }

    function showInstallCard(kind) {
        installEl = el('div', 'pwa-banner pwa-banner--bottom');
        installEl.setAttribute('role', 'region');
        installEl.setAttribute('aria-label', 'Install iSkool');

        var text = el('div', 'pwa-banner__text');
        text.appendChild(el('span', 'pwa-banner__title', 'Install iSkool'));
        var sub = el('span', 'pwa-banner__sub');
        if (kind === 'ios') {
            sub.appendChild(document.createTextNode('Tap Share '));
            sub.appendChild(shareIcon());
            sub.appendChild(document.createTextNode(', then “Add to Home Screen”.'));
        } else {
            sub.textContent = 'Open it from your home screen, full screen like any other app.';
        }
        text.appendChild(sub);

        var actions = el('div', 'pwa-banner__actions');
        if (kind === 'ios') {
            actions.appendChild(button('Got it', 'pwa-btn--primary', function () { hideInstall(true); }));
        } else {
            actions.appendChild(button('Install', 'pwa-btn--primary', install));
            actions.appendChild(button('Not now', 'pwa-btn--ghost', function () { hideInstall(true); }));
        }

        installEl.appendChild(text);
        installEl.appendChild(actions);
        document.body.appendChild(installEl);
        placeInstallCard();
    }

    function maybeShowInstall() {
        if (installEl || updateEl || !installReady) return;
        if (!isPhone() || isStandalone() || isBusy()) return;
        if (getItem(INSTALLED_KEY) === '1') return;
        var dismissedAt = Number(getItem(DISMISS_KEY) || 0);
        if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;
        if (document.visibilityState !== 'visible') return;

        if (deferredPrompt) showInstallCard('android');
        else if (isIOS() && isRealIOSBrowser()) showInstallCard('ios');
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();           // keep it for our own button
        deferredPrompt = event;
        maybeShowInstall();
    });
    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        setItem(INSTALLED_KEY, '1');
        hideInstall(false);
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') maybeShowInstall(); });
    window.setTimeout(function () { installReady = true; maybeShowInstall(); }, INSTALL_DELAY_MS);

    // ── start-up ─────────────────────────────────────────────────────────────────────────────────────────────
    window.iskoolPwa = {
        offerUpdate: offerUpdate,
        registerBusyCheck: registerBusyCheck,
        isStandalone: isStandalone,
        canInstall: function () { return !!deferredPrompt; },
        install: install
    };

    function start() {
        // The service worker may have said "update available" before this script ran, or a downloaded update may
        // still be waiting from an earlier visit (the user pressed Later): offer it again, a little after loading.
        if (window.__iskoolUpdatePending) offerUpdate();
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration('/').then(function (registration) {
                if (registration && registration.waiting && navigator.serviceWorker.controller) {
                    window.setTimeout(offerUpdate, 4000);
                }
            }).catch(function () {});
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
