/* ────────────────────────────────────────────────────────────
   ENTHROPY — Shared Site Footer
   Single source of truth for the footer markup used across every
   page (index, about, contacts, privacy, terms, POPIA, etc).

   To change the footer (links, social icons, copyright year, etc.)
   edit ONLY this file. Every page that includes it will update.

   Usage on a page:
     1. Put an empty mount point where the footer should appear:
          <div id="site-footer"></div>
     2. Load this script before the closing </body> tag:
          <script src="shared-footer.js"></script>
   ──────────────────────────────────────────────────────────── */

(function () {

  var FOOTER_HTML = '\
<footer class="footer" role="contentinfo" id="contact">\
  <div class="footer-inner">\
\
    <div class="footer-brand">\
      <svg class="footer-logo-mark-only" viewBox="0 0 1254 1254" xmlns="http://www.w3.org/2000/svg" aria-label="ENTHROPY">\
        <g transform="translate(0,1254) scale(0.1,-0.1)" fill="#ffffff">\
          <path d="M3620 10739 c-408 -51 -823 -276 -1108 -599 -267 -303 -441 -710 -459 -1077 l-6 -113 907 0 906 0 0 900 0 900 -87 -1 c-49 -1 -117 -5 -153 -10z"/>\
          <path d="M5090 10735 c-342 -69 -616 -338 -700 -687 -30 -123 -28 -295 5 -423 83 -328 312 -558 660 -662 56 -17 133 -18 1225 -18 l1165 0 78 23 c160 46 274 111 395 226 306 291 369 752 151 1118 -129 219 -342 368 -602 423 -96 21 -2276 20 -2377 0z"/>\
          <path d="M8690 9851 l0 -901 900 0 900 0 0 68 c0 89 -32 282 -69 412 -55 196 -127 352 -238 520 -179 270 -426 482 -733 629 -224 107 -418 159 -632 168 l-128 6 0 -902z"/>\
          <path d="M2783 8546 c-104 -20 -174 -44 -262 -88 -266 -137 -453 -408 -490 -713 -15 -122 -15 -2477 -1 -2594 68 -541 603 -908 1125 -771 275 73 505 273 615 536 67 162 64 80 68 1454 2 846 0 1281 -8 1358 -37 389 -284 689 -656 797 -111 32 -283 42 -391 21z"/>\
          <path d="M9465 8551 c-316 -53 -570 -244 -701 -526 -66 -142 -79 -210 -79 -400 1 -164 2 -173 33 -265 97 -290 340 -512 652 -594 36 -10 117 -20 180 -23 428 -19 800 262 916 693 28 103 26 339 -4 449 -86 313 -343 568 -652 645 -94 24 -265 34 -345 21z"/>\
          <path d="M9421 6395 c-313 -71 -543 -257 -662 -535 -44 -103 -69 -201 -76 -297 l-6 -73 907 0 906 0 0 60 c0 83 -25 200 -63 290 -111 268 -315 453 -593 536 -111 33 -310 42 -413 19z"/>\
          <path d="M9485 5334 c-229 -37 -420 -134 -561 -287 -141 -152 -244 -390 -244 -564 l0 -63 905 0 905 0 0 61 c0 34 -9 103 -21 153 -76 330 -332 593 -657 677 -76 19 -265 33 -327 23z"/>\
          <path d="M5095 4015 c-190 -42 -340 -128 -476 -273 -219 -233 -303 -550 -227 -847 83 -322 321 -565 644 -657 114 -32 343 -32 459 0 438 121 728 545 676 986 -48 400 -329 707 -724 791 -84 18 -271 18 -352 0z"/>\
          <path d="M2045 3991 c-3 -6 -1 -61 5 -123 62 -657 452 -1215 1042 -1493 202 -94 424 -151 631 -162 l127 -6 0 896 0 897 -899 0 c-553 0 -902 -4 -906 -9z"/>\
          <path d="M8682 3103 l3 -898 95 3 c363 13 740 158 1036 397 389 316 638 798 671 1297 l6 98 -907 0 -906 0 2 -897z"/>\
          <path d="M6445 3978 c-3 -7 -4 -404 -3 -883 l3 -870 95 1 c69 0 116 7 170 23 563 172 803 855 477 1359 -123 189 -313 322 -527 367 -89 19 -209 20 -215 3z"/>\
          <path d="M7430 3105 l0 -885 73 0 c215 0 460 123 612 307 69 83 136 212 171 329 25 81 27 104 28 249 0 146 -2 168 -27 248 -82 266 -255 471 -484 572 -85 38 -207 65 -295 65 l-78 0 0 -885z"/>\
        </g>\
      </svg>\
    </div>\
\
    <div class="footer-top">\
      <div class="footer-col">\
        <p class="footer-col-title">Company</p>\
        <ul>\
          <li><a href="about.html">About Us</a></li>\
          <li><a href="index.html#research">Article</a></li>\
          <li><a href="contacts.html">Contact</a></li>\
        </ul>\
      </div>\
\
      <div class="footer-col">\
        <p class="footer-col-title">Product</p>\
        <ul>\
          <li><a href="https://iskool.online" target="_blank" rel="noopener noreferrer">iSkool</a></li>\
          <li><a href="#" data-footer-pilot-link>Request a pilot</a></li>\
        </ul>\
      </div>\
\
      <div class="footer-col">\
        <p class="footer-col-title">Legal</p>\
        <ul>\
          <li><a href="privacy-policies.html">Privacy policy</a></li>\
          <li><a href="terms-of-services.html">Terms of use</a></li>\
          <li><a href="popia_compliances.html">POPIA compliance</a></li>\
        </ul>\
      </div>\
    </div>\
\
    <div class="footer-bottom">\
      <p class="footer-legal">\
        Enthropy (Pty) Ltd &copy; 2025-2026 · All rights reserved.\
      </p>\
      <div class="footer-social" aria-label="Social media links">\
        <a href="#" aria-label="LinkedIn">\
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\
            <rect x="2" y="9" width="4" height="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\
            <circle cx="4" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/>\
          </svg>\
        </a>\
        <a href="#" aria-label="X (Twitter)">\
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">\
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>\
          </svg>\
        </a>\
        <a href="#" aria-label="Instagram">\
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\
          </svg>\
        </a>\
      </div>\
    </div>\
\
  </div>\
</footer>';

  function injectFooter() {
    var mount = document.getElementById('site-footer');
    if (!mount) {
      console.warn('[shared-footer] No #site-footer element found on this page — footer was not injected.');
      return;
    }
    mount.outerHTML = FOOTER_HTML;
    wirePilotLink();
  }

  /* The "Request a pilot" link should open the pilot modal if this
     page has one (currently only index.html / ENTHROPY_website.html).
     On pages without the modal, send people to the homepage's pilot
     form instead of calling a function that doesn't exist there. */
  function wirePilotLink() {
    var link = document.querySelector('[data-footer-pilot-link]');
    if (!link) return;

    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.openPilotForm === 'function') {
        window.openPilotForm();
      } else {
        window.location.href = 'index.html#pilot';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }

})();
