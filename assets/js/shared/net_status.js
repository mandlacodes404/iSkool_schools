/*
 * iSkool connection status: the "You're offline" strip and the news about saves that waited on the phone.
 *
 * Why it exists. A teacher marking in a classroom often has no signal, and a learner may have none when they finish a
 * quiz. The service worker (service-worker.js) keeps a mark (or a quiz, an assignment, an evaluation) saved without
 * signal on the phone and sends it when the phone is back online. This file is the part the person sees:
 *   - a slim strip above the bottom bar while the phone is offline, and while saves are still waiting to be sent;
 *   - a short note when saved marks have been sent, and a note that stays until it is dismissed when a saved mark
 *     could NOT be applied (the marks changed meanwhile, or the server refused them);
 *   - the nudges that make the queue empty sooner: it asks the service worker to send as soon as the phone comes back
 *     online or the app comes back to the front, and again after 12 s, 20 s and then every 30 s while saves are waiting
 *     (a phone can be "online" on a hotspot that carries nothing, and then there is no online event to wait for).
 *
 * Public API (window.iskoolNetStatus):
 *   init(options)   start; call once. Options:
 *       urlPrefix   only saves to URLs under this path are announced, e.g. '/api/teacher/' (or a list of paths)
 *       role        whose waiting saves the service worker counts: 'teacher' (the default) or 'learner'
 *       user        function returning the signed-in user's email: only that user's waiting saves are counted
 *       describe    optional function(kind, detail) returning the sentence for 'synced' | 'conflict' | 'failed'
 *                   (kind) so a page can name the learner and quiz; a generic sentence is used otherwise
 *       offlineHint what to tell an offline user who has nothing waiting yet
 *       idleStrip   false: no "Offline" strip while nothing is waiting (the strip then shows only for saved work)
 *       nouns       [one, many] for what is counted, default ['change', 'changes']
 *   waiting()       how many saves of the signed-in user are waiting on this phone
 *   replayNow()     ask the service worker to send them now
 *
 * Page scripts can listen for the DOM event "iskool:queue-settled" on document. detail.kind is 'synced', 'conflict' or
 * 'failed', and the rest of the detail is what the service worker reported (quizId, userEmail, ...).
 *
 * Plain script, no dependencies, text is set with textContent only. Styles: assets/css/shared/net_status.css
 */
(function () {
    'use strict';
    if (window.iskoolNetStatus) return;

    var RETRY_STEPS_MS = [12000, 20000, 30000];   // gaps between our own nudges while saves wait; the last one repeats
    var BACK_ONLINE_MS = 2500;
    var SYNCED_NOTE_MS = 4000;
    var SYNCED_GATHER_MS = 1200;      // a queue that empties sends several saves at once: say it once

    var options = null;
    var started = false;
    var waitingCount = 0;
    var wasShowing = false;
    var wrap = null;
    var strip = null;
    var backOnlineTimer = null;
    var retryTimer = null;
    var retryAttempt = 0;
    var syncedBatch = [];
    var syncedTimer = null;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function isOffline() { return navigator.onLine === false; }

    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

    function noun() {
        var pair = options && options.nouns;
        return pair && pair.length === 2 ? pair : ['change', 'changes'];
    }

    // Is this URL one whose saves this page announces?
    function ownsUrl(path) {
        var prefix = options && options.urlPrefix;
        if (!prefix) return true;
        var list = Array.isArray(prefix) ? prefix : [prefix];
        for (var i = 0; i < list.length; i++) if (path.indexOf(list[i]) === 0) return true;
        return false;
    }

    function currentUser() {
        try { return options && options.user ? String(options.user() || '') : ''; } catch (e) { return ''; }
    }

    /* ── talking to the service worker ───────────────────────────────────────────────────────────────────────── */

    function postToWorker(message) {
        if (!('serviceWorker' in navigator)) return;
        if (navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage(message); return; }
        navigator.serviceWorker.ready.then(function (registration) {
            if (registration.active) registration.active.postMessage(message);
        }).catch(function () {});
    }

    function replayNow() {
        postToWorker({ type: 'iskool-replay-queued-writes' });
    }

    function askStatus() {
        postToWorker({ type: 'iskool-queue-status' });
    }

    /* ── where the strip sits ────────────────────────────────────────────────────────────────────────────────── */

    function place() {
        if (!wrap) return;
        // Just above the bottom bar when there is one (its height already includes the home-bar gap) and above the
        // "install the app" card when that is showing, so the two never sit on top of each other.
        var nav = document.getElementById('mobileBottomNav');
        var navHeight = nav && nav.offsetHeight ? nav.offsetHeight : 0;
        var offset = navHeight ? navHeight + 12 : 0;
        var install = document.querySelector('.pwa-banner--bottom');
        if (install && install.offsetHeight) offset = Math.max(offset, (parseInt(install.style.bottom, 10) || 12) + install.offsetHeight + 8);
        wrap.style.bottom = offset ? offset + 'px' : 'calc(12px + env(safe-area-inset-bottom, 0px))';
    }

    function ensureWrap() {
        if (wrap) return wrap;
        wrap = el('div', 'net-status');
        wrap.setAttribute('aria-label', 'Connection status');
        document.body.appendChild(wrap);
        place();
        return wrap;
    }

    /* ── the strip: offline / sending / back online ──────────────────────────────────────────────────────────── */

    function removeStrip() {
        if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
        strip = null;
    }

    function setStrip(tone, text, withSendButton) {
        ensureWrap();
        if (!strip) {
            strip = el('div', 'net-status__strip');
            strip.setAttribute('role', 'status');
            wrap.appendChild(strip);
        }
        strip.className = 'net-status__strip net-status__strip--' + tone;
        while (strip.firstChild) strip.removeChild(strip.firstChild);
        strip.appendChild(el('span', 'net-status__dot'));
        strip.appendChild(el('span', 'net-status__text', text));
        if (withSendButton) {
            var button = el('button', 'net-status__btn', 'Send now');
            button.type = 'button';
            button.addEventListener('click', replayNow);
            strip.appendChild(button);
        }
        place();
    }

    function render() {
        clearTimeout(backOnlineTimer);
        if (isOffline() && waitingCount === 0 && options && options.idleStrip === false) {
            removeStrip();                                  // offline with nothing saved: this page has nothing to say
        } else if (isOffline()) {
            wasShowing = true;
            setStrip('offline', waitingCount > 0
                ? 'Offline · ' + plural(waitingCount, noun()[0], noun()[1]) + ' saved on this phone'
                : 'Offline · ' + ((options && options.offlineHint) || 'what you save stays on this phone'), false);
        } else if (waitingCount > 0) {
            wasShowing = true;
            setStrip('sending', 'Sending ' + plural(waitingCount, 'saved ' + noun()[0], 'saved ' + noun()[1]) + '…', true);
        } else if (wasShowing) {
            wasShowing = false;
            setStrip('online', 'Back online', false);
            backOnlineTimer = setTimeout(removeStrip, BACK_ONLINE_MS);
        } else {
            removeStrip();
        }
        // While saves wait and the phone says it is online, keep nudging; once there are none, stop.
        if (waitingCount > 0 && !isOffline()) { if (!retryTimer) scheduleRetry(); }
        else { clearTimeout(retryTimer); retryTimer = null; retryAttempt = 0; }
    }

    // Right after a reconnect the first try often fails (the connection is not really ready), so the gaps start short
    // and grow: 12 s, 20 s, then every 30 s. The service worker also retries a few times inside each try.
    function scheduleRetry() {
        var gap = RETRY_STEPS_MS[Math.min(retryAttempt, RETRY_STEPS_MS.length - 1)];
        retryTimer = setTimeout(function () {
            retryTimer = null;
            if (waitingCount === 0 || isOffline()) return;
            retryAttempt++;
            replayNow();
            scheduleRetry();
        }, gap);
    }

    /* ── notes: sent / not applied / failed ──────────────────────────────────────────────────────────────────── */

    function note(tone, text, stays) {
        ensureWrap();
        var item = el('div', 'net-status__note net-status__note--' + tone);
        item.setAttribute('role', tone === 'synced' ? 'status' : 'alert');
        item.appendChild(el('span', 'net-status__text', text));
        var remove = function () { if (item.parentNode) item.parentNode.removeChild(item); };
        if (stays) {
            var ok = el('button', 'net-status__btn', 'OK');
            ok.type = 'button';
            ok.addEventListener('click', remove);
            item.appendChild(ok);
        } else {
            setTimeout(remove, SYNCED_NOTE_MS);
        }
        // Notes sit above the strip.
        wrap.insertBefore(item, strip || null);
        place();
    }

    function sentence(kind, detail) {
        if (options && typeof options.describe === 'function') {
            try {
                var custom = options.describe(kind, detail);
                if (custom) return custom;
            } catch (e) { /* fall through to the plain sentence */ }
        }
        if (kind === 'synced') return 'Your saved change was sent.';
        if (kind === 'conflict') return 'A change you saved offline was not applied because the information changed meanwhile.';
        return 'A change you saved offline could not be sent. Please make it again.';
    }

    function flushSynced() {
        syncedTimer = null;
        var batch = syncedBatch;
        syncedBatch = [];
        if (!batch.length) return;
        note('synced', batch.length === 1 ? batch[0] : plural(batch.length, 'saved ' + noun()[0], 'saved ' + noun()[1]) + ' sent.', false);
    }

    function settled(kind, detail) {
        // The sentence is worded first, because page scripts that hear the event below may forget the very data
        // (a learner's name, a quiz title) that the wording looks up.
        var text = sentence(kind, detail);
        try {
            document.dispatchEvent(new CustomEvent('iskool:queue-settled', { detail: Object.assign({ kind: kind }, detail) }));
        } catch (e) { /* an old browser without CustomEvent: the note below still shows */ }
        if (kind === 'synced') {
            syncedBatch.push(text);
            if (!syncedTimer) syncedTimer = setTimeout(flushSynced, SYNCED_GATHER_MS);
        } else {
            note(kind, text, true);
        }
    }

    /* ── messages from the service worker ────────────────────────────────────────────────────────────────────── */

    function onWorkerMessage(event) {
        var data = event.data;
        if (!data || typeof data.type !== 'string') return;
        if (data.type === 'offline-queue-status') {
            var mine = currentUser();
            var role = (options && options.role) || 'teacher';
            waitingCount = (mine && data[role] && data[role][mine]) || 0;
            render();
            return;
        }
        var path = '';
        try { path = new URL(data.url, location.href).pathname; } catch (e) { path = ''; }
        if (!ownsUrl(path)) return;     // somebody else's save (the other app, in another tab)
        if (data.type === 'offline-write-synced') settled('synced', data);
        else if (data.type === 'offline-write-conflict') settled('conflict', data);
        else if (data.type === 'offline-write-failed') settled('failed', data);
        else if (data.type === 'offline-write-discarded') note('failed', 'Saved changes from another account were not sent.', true);
    }

    /* ── start ───────────────────────────────────────────────────────────────────────────────────────────────── */

    function init(opts) {
        if (started) return;
        started = true;
        options = opts || {};
        if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onWorkerMessage);
        window.addEventListener('online', function () { retryAttempt = 0; render(); replayNow(); askStatus(); });
        window.addEventListener('offline', render);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && waitingCount > 0 && !isOffline()) replayNow();
        });
        window.addEventListener('resize', place);
        // The install card can arrive after the strip: move over when it does.
        if (window.MutationObserver) new MutationObserver(place).observe(document.body, { childList: true });
        render();
        askStatus();
        if (!isOffline()) replayNow();                   // anything left from last time goes out now
    }

    window.iskoolNetStatus = {
        init: init,
        waiting: function () { return waitingCount; },
        replayNow: replayNow
    };
})();
