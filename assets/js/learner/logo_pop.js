/*
 * Learner dashboard, phones: tap the school logo in the top bar and it pops up bigger, in a frame above everything
 * (the top bar included), with the school name under it. The logo lifts out of the bar and grows to the frame; a tap
 * anywhere, Escape, or the phone's Back button closes it and the logo shrinks back into its place in the bar.
 *
 * The bar itself does not move: only a copy of the logo (a picture, or the school's initials when no logo was uploaded)
 * is drawn on a layer of its own. The bar's own logo is hidden while the copy is out and shown again when it is back.
 *
 * Phones only (768px and narrower), like the rest of the phone top bar; the desktop layout is not touched.
 * The layer is `#schoolLogoPop`, built here; `.on` is on it while it is open. The Back button closes it by pressing it
 * (see learner_back_button.js), so it closes the way a tap closes it. The look is in assets/css/learner/logo_pop.css.
 *
 * Plain script, no dependencies. Text goes in with textContent. The school name is read from `data-school-name`
 * on `.logo-container` (printed by learner_dashboard.php).
 */
(function () {
    'use strict';

    var PHONE = '(max-width: 768px)';
    var OPEN_MS = 360;
    var CLOSE_MS = 240;
    var FRAME_RADIUS = 28;      // px, as in logo_pop.css
    var BAR_RADIUS = 8;         // px, the logo's corners in the top bar
    var SCRIM = 0.55;           // how dark the backdrop is (black at this opacity), as in logo_pop.css

    var logo = null;            // the logo in the top bar
    var pop = null;             // #schoolLogoPop while it is open or closing
    var scrim = null;
    var frame = null;
    var nameEl = null;
    var closing = false;
    var savedBar = null;

    function isPhone() { return !!(window.matchMedia && window.matchMedia(PHONE).matches); }
    function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function canAnimate(el) { return !!(el && typeof el.animate === 'function') && !reduced(); }

    function themeMeta() { return document.querySelector('meta[name="theme-color"]'); }

    function hexRgb(hex) {
        var m = /^#([0-9a-f]{6})$/i.exec((hex || '').trim());
        if (!m) return null;
        var n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function cssRgb(text) {
        var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(text || '');
        return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
    }

    /* Is the top bar light on screen right now? (Light is chosen AND the page showing has its light design: that is
       only true of some pages, so ask what is really painted instead of the saved choice.) */
    function barIsLight() {
        var header = document.querySelector('.main-header');
        var c = header ? cssRgb(window.getComputedStyle(header).backgroundColor) : null;
        if (!c || c[3] < 0.5) {
            var meta = themeMeta();
            c = meta ? hexRgb(meta.getAttribute('content')) : null;
        }
        return !!c && (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) > 160;
    }

    /* The phone's status bar sits outside the page, so the backdrop cannot dim it: give it the bar's colour as it
       would look under the backdrop (what the other sheets do), and give the old colour back on close. */
    function dimBar() {
        var meta = themeMeta();
        savedBar = meta ? meta.getAttribute('content') : null;
        var rgb = hexRgb(savedBar);
        if (!meta || !rgb) return;
        var dimmed = rgb.map(function (v) {
            var d = Math.round(v * (1 - SCRIM));
            return (d < 16 ? '0' : '') + d.toString(16);
        }).join('');
        meta.setAttribute('content', '#' + dimmed);
    }

    function undimBar() {
        var meta = themeMeta();
        if (meta && savedBar !== null) meta.setAttribute('content', savedBar);
        savedBar = null;
    }

    /* where the frame sits when it is "in the bar": a translate and scale from its own place */
    function fromBar(frameRect, barRect) {
        var scale = barRect.width / frameRect.width;
        return {
            scale: scale,
            move: 'translate(' + (barRect.left - frameRect.left) + 'px, ' + (barRect.top - frameRect.top) + 'px) scale(' + scale + ')'
        };
    }

    function open() {
        if (pop || !isPhone()) return;
        logo = document.getElementById('headerLogo');
        if (!logo || !logo.getClientRects().length) return;

        var holder = logo.closest ? logo.closest('.logo-container') : null;
        var name = (holder && holder.getAttribute('data-school-name')) || '';
        var barRect = logo.getBoundingClientRect();

        pop = document.createElement('div');
        pop.id = 'schoolLogoPop';
        pop.className = 'slp';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        pop.setAttribute('aria-label', name ? name + ' logo' : 'School logo');
        pop.setAttribute('data-tone', barIsLight() ? 'light' : 'dark');

        scrim = document.createElement('div');
        scrim.className = 'slp-scrim';

        var body = document.createElement('div');
        body.className = 'slp-body';

        frame = document.createElement('div');
        frame.className = 'slp-frame';
        if (logo.tagName === 'IMG') {
            var img = document.createElement('img');
            img.className = 'slp-img';
            img.alt = '';
            img.src = logo.currentSrc || logo.src;
            frame.appendChild(img);
        } else {
            frame.classList.add('slp-frame--initials');
            frame.textContent = (logo.textContent || '').trim();
        }
        body.appendChild(frame);

        nameEl = null;
        if (name) {
            nameEl = document.createElement('div');
            nameEl.className = 'slp-name';
            nameEl.textContent = name;
            body.appendChild(nameEl);
        }

        pop.appendChild(scrim);
        pop.appendChild(body);
        pop.addEventListener('click', function () { close(false); });
        document.body.appendChild(pop);

        dimBar();
        logo.style.visibility = 'hidden';
        pop.classList.add('on');
        closing = false;

        if (canAnimate(frame)) {
            var from = fromBar(frame.getBoundingClientRect(), barRect);
            frame.animate(
                [
                    { transform: from.move, borderRadius: (BAR_RADIUS / from.scale) + 'px' },
                    { transform: 'none', borderRadius: FRAME_RADIUS + 'px' }
                ],
                { duration: OPEN_MS, easing: 'cubic-bezier(.2, .8, .2, 1)' }
            );
            scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.7, easing: 'ease-out' });
            if (nameEl) {
                nameEl.animate(
                    [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                    { duration: OPEN_MS * 0.8, delay: OPEN_MS * 0.25, easing: 'ease-out', fill: 'backwards' }
                );
            }
        }
    }

    function finish() {
        if (logo) logo.style.visibility = '';
        if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
        pop = scrim = frame = nameEl = null;
        closing = false;
    }

    function close(immediate) {
        if (!pop || closing) return;
        closing = true;
        pop.classList.remove('on');     // so the Back button does not find it again while it shrinks
        undimBar();

        if (immediate || !canAnimate(frame) || !logo) { finish(); return; }

        // start from where the frame is right now, if it was still growing
        var running = frame.getAnimations ? frame.getAnimations() : [];
        for (var i = 0; i < running.length; i++) running[i].cancel();

        var barRect = logo.getBoundingClientRect();
        var to = fromBar(frame.getBoundingClientRect(), barRect);
        var shrink = frame.animate(
            [
                { transform: 'none', borderRadius: FRAME_RADIUS + 'px' },
                { transform: to.move, borderRadius: (BAR_RADIUS / to.scale) + 'px' }
            ],
            { duration: CLOSE_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }
        );
        scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: 'ease-in', fill: 'forwards' });
        if (nameEl) {
            nameEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS * 0.6, easing: 'ease-in', fill: 'forwards' });
        }
        shrink.onfinish = finish;
        shrink.oncancel = finish;
    }

    function init() {
        var el = document.getElementById('headerLogo');
        if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.setAttribute('aria-haspopup', 'dialog');
            el.setAttribute('aria-label', 'School logo: show larger');
        }

        document.addEventListener('click', function (e) {
            var hit = e.target && e.target.closest ? e.target.closest('#headerLogo') : null;
            if (hit) open();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && pop) { close(false); return; }
            if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.id === 'headerLogo') {
                e.preventDefault();
                open();
            }
        });

        // A turn of the phone or a resize would leave the frame where it was: put the logo back at once.
        window.addEventListener('resize', function () { if (pop) close(true); });
        window.addEventListener('orientationchange', function () { if (pop) close(true); });
    }

    init();
})();
