/*
 * Pull to refresh for the phone view: swipe down from the very top of the page and let go to refresh it.
 *
 * The page follows your finger, holds while it loads and then settles back, with a small spinner in the gap above it.
 * This is the same gesture and the same feel as the learner dashboard's (which has its own copy inside
 * learner_dashboard.php); this file is the reusable version, first used by the teacher dashboard. It knows nothing
 * about iSkool pages: the page that uses it says what to refresh and when pulling is allowed.
 *
 *   window.iskoolPullToRefresh.init({
 *       scroller:       '#api-content-area',   // the element that scrolls (element or selector)
 *       refresh:        function () { ... },   // does the refresh, may return a promise
 *       canPull:        function () { ... },   // optional: return false to switch pulling off for now
 *       ignoreSelector: '.modal, input',       // optional: a touch that starts inside one of these never pulls
 *       loader:         '#loaderOverlay',      // optional: a full-screen loader to keep hidden while refreshing,
 *                                              //           so there is only ONE spinner on screen
 *       maxWidth:       768,                   // optional: only on screens this wide or narrower (default 768)
 *       threshold: 72, hold: 52, timeout: 15000  // optional: how far to pull, how far the page hangs, give-up time (ms)
 *   });
 *
 * It only ever listens (passive touch handlers) and never blocks scrolling. A pull is dropped as soon as it turns
 * sideways (so the menu's edge swipe is untouched), goes back up, starts inside a scrolled inner list, or the page
 * itself starts to scroll. While the script is on, the scrolling element carries the class "iskool-ptr-scroller";
 * pull_to_refresh.css uses it to stop the browser's own pull-to-refresh (which reloads the whole app) from also
 * firing on phones. (".iskool-ptr" is the spinner itself, and is used on nothing else.)
 */
(function () {
    'use strict';
    if (window.iskoolPullToRefresh) return;

    var NS = 'http://www.w3.org/2000/svg';
    var DEFAULTS = { threshold: 72, hold: 52, timeout: 15000, maxWidth: 768, resistance: 0.5, lockDistance: 6 };

    function buildIndicator() {
        var root = document.createElement('div');
        root.className = 'iskool-ptr';
        root.setAttribute('aria-hidden', 'true');

        // Eight rounded strokes around a centre, all fully visible, so the turning ring stays clear.
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('fill', 'none');
        for (var i = 0; i < 8; i++) {
            var rad = (i * 45 - 90) * Math.PI / 180;
            var line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', (16 + Math.cos(rad) * 6).toFixed(2));
            line.setAttribute('y1', (16 + Math.sin(rad) * 6).toFixed(2));
            line.setAttribute('x2', (16 + Math.cos(rad) * 13).toFixed(2));
            line.setAttribute('y2', (16 + Math.sin(rad) * 13).toFixed(2));
            line.setAttribute('stroke', 'currentColor');
            line.setAttribute('stroke-width', '3.8');
            line.setAttribute('stroke-linecap', 'round');
            svg.appendChild(line);
        }
        root.appendChild(svg);

        var sr = document.createElement('div');
        sr.className = 'iskool-ptr-sr';
        sr.setAttribute('role', 'status');
        sr.setAttribute('aria-live', 'polite');
        return { root: root, sr: sr };
    }

    function pick(target) {
        return typeof target === 'string' ? document.querySelector(target) : (target || null);
    }

    function init(options) {
        var o = {};
        var k;
        for (k in DEFAULTS) o[k] = DEFAULTS[k];
        for (k in (options || {})) o[k] = options[k];

        var scroller = pick(o.scroller);
        if (!scroller || typeof o.refresh !== 'function') return null;
        var loader = pick(o.loader);
        var mq = window.matchMedia ? window.matchMedia('(max-width: ' + o.maxWidth + 'px)') : null;

        var ui = buildIndicator();
        document.body.appendChild(ui.root);
        document.body.appendChild(ui.sr);
        scroller.classList.add('iskool-ptr-scroller');     // the stylesheet stops the browser's own pull-to-refresh on it

        var s = { startX: 0, startY: 0, top: 0, pulling: false, locked: false, triggered: false, offset: 0, refreshing: false };
        var loaderWatch = null;
        var settleTimer = 0;

        function isPhone() { return mq ? mq.matches : window.innerWidth <= o.maxWidth; }

        // ── drawing ──────────────────────────────────────────────────────────────────────────────────────────
        // The spinner belongs in the empty space above the pulled-down page: centre it in that gap.
        function indicatorY(offset) { return Math.max((offset - 42) / 2, -42); }

        function drawIndicator(opacity, offset) {
            ui.root.style.opacity = String(opacity);
            ui.root.style.transform = 'translateY(' + indicatorY(offset) + 'px)';
        }
        function hideIndicator() {
            ui.root.style.opacity = '0';
            ui.root.style.transform = 'translateY(-80px)';
            ui.root.classList.remove('is-spinning');
        }
        function movePage(offset, animate) {
            scroller.style.transition = animate ? 'transform .24s cubic-bezier(.22, 1, .36, 1)' : 'none';
            scroller.style.transform = offset ? 'translate3d(0, ' + offset + 'px, 0)' : '';
            window.clearTimeout(settleTimer);
            if (animate && !offset) {
                // Hand the element back to its own stylesheet once the slide back has finished.
                settleTimer = window.setTimeout(function () {
                    if (!s.refreshing && !s.pulling) scroller.style.transition = '';
                }, 260);
            }
        }
        function settle() {
            hideIndicator();
            movePage(0, true);
        }
        function say(text) { ui.sr.textContent = text; }

        // ── the full-screen loader stays out of the way while refreshing ─────────────────────────────────────
        function holdLoaderDown() {
            if (!loader) return;
            loader.style.display = 'none';
            if (!window.MutationObserver) return;
            loaderWatch = new MutationObserver(function () {
                if (loader.style.display !== 'none') loader.style.display = 'none';
            });
            loaderWatch.observe(loader, { attributes: true, attributeFilter: ['style'] });
        }
        function releaseLoader() {
            if (loaderWatch) { loaderWatch.disconnect(); loaderWatch = null; }
            if (loader) loader.style.display = 'none';
        }

        // ── the refresh itself ───────────────────────────────────────────────────────────────────────────────
        function run() {
            s.refreshing = true;
            s.offset = Math.max(s.offset, o.hold);
            ui.root.classList.add('is-spinning');
            drawIndicator(1, s.offset);
            movePage(s.offset, true);
            say('Refreshing');
            holdLoaderDown();

            var giveUp;
            var timeout = new Promise(function (resolve) {
                giveUp = window.setTimeout(function () { resolve('timed_out'); }, o.timeout);
            });
            var work = new Promise(function (resolve) { resolve(o.refresh()); });

            // A request that hangs on a weak connection must never leave the page stuck: after the time limit it lets go.
            Promise.race([work, timeout]).then(function (result) {
                if (result === 'timed_out' && window.console) console.warn('Pull-to-refresh timed out.');
            }, function (error) {
                if (window.console) console.warn('Pull-to-refresh failed:', error);
            }).then(function () {
                window.clearTimeout(giveUp);
                window.setTimeout(function () {
                    s.refreshing = false;
                    releaseLoader();
                    settle();
                    say('Updated');
                }, 180);
            });
        }

        // ── touch handling ───────────────────────────────────────────────────────────────────────────────────
        // True when the touch began somewhere a pull must not start: inside a modal / input, or inside an inner list
        // that is itself scrolled down (its own scroll comes first).
        function blocked(target) {
            if (!target || target.nodeType !== 1) return false;
            if (o.ignoreSelector && target.closest && target.closest(o.ignoreSelector)) return true;
            for (var n = target; n && n !== scroller; n = n.parentElement) {
                if (n.scrollTop > 0) return true;
            }
            return false;
        }

        function cancelPull() {
            var wasMoved = s.locked;
            s.pulling = false;
            s.locked = false;
            s.triggered = false;
            if (wasMoved && !s.refreshing) settle();
        }

        scroller.addEventListener('touchstart', function (e) {
            if (s.refreshing || e.touches.length !== 1 || !isPhone()) return;
            if (scroller.scrollTop > 0) return;
            if (typeof o.canPull === 'function' && !o.canPull()) return;
            if (blocked(e.target)) return;
            s.startX = e.touches[0].clientX;
            s.startY = e.touches[0].clientY;
            s.top = scroller.getBoundingClientRect().top;
            s.pulling = true;
            s.locked = false;
            s.triggered = false;
            s.offset = 0;
        }, { passive: true });

        scroller.addEventListener('touchmove', function (e) {
            if (!s.pulling) return;
            if (e.touches.length !== 1) { cancelPull(); return; }
            var dx = e.touches[0].clientX - s.startX;
            var dy = e.touches[0].clientY - s.startY;

            if (!s.locked) {
                if (Math.abs(dx) < o.lockDistance && Math.abs(dy) < o.lockDistance) return;
                // Going up or sideways: this is a normal scroll or the menu's swipe, not a pull.
                if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { s.pulling = false; return; }
                s.locked = true;
                ui.root.style.top = s.top + 'px';
            }
            // Turned back up, or the page itself started scrolling: let go without refreshing.
            if (dy <= 0 || scroller.scrollTop > 0) { cancelPull(); return; }

            var capped = Math.min(dy, o.threshold * 1.5);
            var progress = Math.min(capped / o.threshold, 1);
            s.offset = Math.min(capped * o.resistance, o.hold);
            drawIndicator(Math.min(progress * 1.5, 1), s.offset);
            movePage(s.offset, false);

            if (capped >= o.threshold && !s.triggered) {
                s.triggered = true;
                ui.root.classList.add('is-spinning');
            } else if (capped < o.threshold && s.triggered) {
                s.triggered = false;               // pulled back above the line: it will not refresh
                ui.root.classList.remove('is-spinning');
            }
        }, { passive: true });

        function onEnd(e) {
            if (!s.pulling) return;
            s.pulling = false;
            var give = s.locked && s.triggered && e.type === 'touchend';
            s.locked = false;
            if (give) {
                s.triggered = false;
                window.setTimeout(run, 150);       // a beat to let the page settle into its hold position
                s.offset = Math.max(s.offset, o.hold);
                drawIndicator(1, s.offset);
                movePage(s.offset, true);
                s.refreshing = true;               // locked from now, so a second pull cannot start in that beat
            } else {
                s.triggered = false;
                settle();
            }
        }
        scroller.addEventListener('touchend', onEnd, { passive: true });
        scroller.addEventListener('touchcancel', onEnd, { passive: true });

        return {
            isRefreshing: function () { return s.refreshing; }
        };
    }

    window.iskoolPullToRefresh = { init: init };
})();
