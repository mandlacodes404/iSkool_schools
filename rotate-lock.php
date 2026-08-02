<!-- iSkool mobile portrait guard. Include this as the first element in <body>. -->
<style>
    #iskool-rotate-lock {
        display: none;
    }

    /* The class is added synchronously by the script below. Using the device
       type, rather than viewport width, prevents a phone held sideways from
       being mistaken for a desktop layout. */
    @media screen and (orientation: landscape) {
        html.iskool-mobile-device #iskool-rotate-lock {
            display: flex;
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            box-sizing: border-box;
            background: #0d1117;
            color: #ffffff;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px;
            font-family: 'Nunito', Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            touch-action: none;
        }

        html.iskool-mobile-device #iskool-rotate-lock .iskool-rotate-lock-icon {
            width: 56px;
            height: 56px;
            color: #4fd1c5;
            margin-bottom: 20px;
            animation: iskool-rotate-hint 1.6s ease-in-out infinite;
        }

        html.iskool-mobile-device #iskool-rotate-lock p {
            font-size: 16px;
            line-height: 1.5;
            max-width: 320px;
            margin: 0;
            color: #c9d1d9;
        }

        html.iskool-mobile-device #iskool-rotate-lock strong {
            color: #ffffff;
        }

        /* Keep every dashboard layer, iframe and loader out of view. This is
           CSS-only, so the desktop-width dashboard cannot flash on screen. */
        html.iskool-mobile-device body > *:not(#iskool-rotate-lock) {
            visibility: hidden !important;
        }
    }

    @keyframes iskool-rotate-hint {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(90deg); }
    }
</style>

<div id="iskool-rotate-lock" role="alert" aria-live="assertive" aria-label="Please rotate your device to portrait mode">
    <svg class="iskool-rotate-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="6" y="2.5" width="12" height="19" rx="2"></rect>
        <path d="M10 18.25h4"></path>
    </svg>
    <p><strong>Please rotate your device.</strong><br>iSkool is available in portrait mode.</p>
</div>

<script>
(function () {
    'use strict';

    var userAgent = navigator.userAgent || '';
    var isMobileDevice = (navigator.userAgentData && navigator.userAgentData.mobile === true)
        || /Android.*Mobile|iPhone|iPod|IEMobile|Windows Phone|BlackBerry|Opera Mini/i.test(userAgent);

    /* iPadOS identifies itself as Macintosh. Treat touch-enabled iPads as
       mobile devices too, so an installed iSkool app cannot open sideways. */
    if (!isMobileDevice && /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) {
        isMobileDevice = true;
    }

    var portraitQuery = window.matchMedia('(orientation: portrait)');
    var wasLocked = false;

    function isLocked() {
        return isMobileDevice && !portraitQuery.matches;
    }

    function updateOrientationLock() {
        var locked = isLocked();
        document.documentElement.classList.toggle('iskool-mobile-device', isMobileDevice);
        document.documentElement.classList.toggle('iskool-landscape-locked', locked);

        if (wasLocked && !locked) {
            window.dispatchEvent(new CustomEvent('iskool:portrait-ready'));
        }
        wasLocked = locked;
    }

    window.iSkoolOrientationLock = {
        isMobileDevice: isMobileDevice,
        isLocked: isLocked,
        wasLockedAtLoad: isLocked()
    };

    updateOrientationLock();
    window.addEventListener('orientationchange', updateOrientationLock, { passive: true });
    window.addEventListener('resize', updateOrientationLock, { passive: true });
    if (portraitQuery.addEventListener) {
        portraitQuery.addEventListener('change', updateOrientationLock);
    } else if (portraitQuery.addListener) {
        portraitQuery.addListener(updateOrientationLock);
    }
}());
</script>
