<!-- ─────────────────────────────────────────────────────────────
     iSkool — Mobile Landscape Lock
     Included from config.php so it applies globally, on every
     page, without touching individual dashboard files.
     ───────────────────────────────────────────────────────────── -->
<style>
#iskool-rotate-lock {
    display: none;
}

@media screen and (max-width: 926px) and (orientation: landscape) {
    #iskool-rotate-lock {
        display: flex;
        position: fixed;
        inset: 0;
        z-index: 999999; /* above every existing overlay (highest in-app z-index is 6000) */
        background: #0d1117;
        color: #ffffff;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 32px;
        font-family: 'Nunito', sans-serif;
    }

    #iskool-rotate-lock i {
        font-size: 48px;
        color: #4fd1c5;
        margin-bottom: 20px;
        animation: iskool-rotate-hint 1.6s ease-in-out infinite;
    }

    #iskool-rotate-lock p {
        font-size: 16px;
        line-height: 1.5;
        max-width: 320px;
        margin: 0;
        color: #c9d1d9;
    }

    #iskool-rotate-lock strong {
        color: #ffffff;
    }

    /* Hide the app underneath while the lock is showing */
    body.iskool-landscape-locked > *:not(#iskool-rotate-lock) {
        visibility: hidden;
    }
}

@keyframes iskool-rotate-hint {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(90deg); }
}
</style>

<div id="iskool-rotate-lock">
    <i class="fa-solid fa-mobile-screen-button"></i>
    <p><strong>Please rotate your device.</strong><br>iSkool works best in portrait mode.</p>
</div>

<script>
(function () {
    function iskoolApplyLandscapeLockClass() {
        var isSmall = window.matchMedia('(max-width: 926px)').matches;
        var isLandscape = window.matchMedia('(orientation: landscape)').matches;
        document.body.classList.toggle('iskool-landscape-locked', isSmall && isLandscape);
    }
    window.addEventListener('resize', iskoolApplyLandscapeLockClass);
    window.addEventListener('orientationchange', iskoolApplyLandscapeLockClass);
    document.addEventListener('DOMContentLoaded', iskoolApplyLandscapeLockClass);
})();
</script>
