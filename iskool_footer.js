/* ────────────────────────────────────────────────────────────
   iSkool — Shared Site Footer
   Single source of truth for the footer markup used across every
   iSkool page (main site, privacy policy, terms of service,
   POPIA compliance, etc).

   To change the footer (links, social icons, copyright year, etc.)
   edit ONLY this file. Every page that includes it will update.

   Usage on a page:
     1. Put an empty mount point where the footer should appear:
          <div id="iskool-footer"></div>
     2. Load this script before the closing </body> tag:
          <script src="iskool_footer.js"></script>
     3. Also link the matching stylesheet in <head>:
          <link rel="stylesheet" href="iskool_footer.css" />
   ──────────────────────────────────────────────────────────── */

(function () {

  var FOOTER_HTML = '\
<footer class="footer">\
  <div class="footer-top">\
\
    <div>\
      <p class="footer-col-title">Product</p>\
      <ul class="footer-links">\
        <li><a href="features.html">Features</a></li>\
        <li><a href="#" data-footer-demo-link>Demo</a></li>\
        <li><a href="#faq" data-footer-faq-link>FAQ</a></li>\
      </ul>\
    </div>\
\
    <div>\
      <p class="footer-col-title">Company</p>\
      <ul class="footer-links">\
        <li><a href="about.html">About Enthropy</a></li>\
        <li><a href="contact.html">Contact</a></li>\
      </ul>\
    </div>\
\
    <div>\
      <p class="footer-col-title">Legal</p>\
      <ul class="footer-links">\
        <li><a href="privacy-policy.html">Privacy Policy</a></li>\
        <li><a href="terms-of-service.html">Terms of Service</a></li>\
        <li><a href="popia_compliance.html">POPIA Compliance</a></li>\
      </ul>\
    </div>\
\
    <div>\
      <p class="footer-col-title">Articles</p>\
      <ul class="footer-links">\
        <li><a href="story-dropout-crisis.html">Dropout crisis</a></li>\
        <li><a href="story-infrastructure.html">The digital divide</a></li>\
        <li><a href="story-teacher-workload.html">The workload</a></li>\
      </ul>\
    </div>\
\
  </div>\
\
  <div class="footer-bottom">\
    <div class="footer-social">\
      <a href="#" class="footer-social-icon" aria-label="X (Twitter)">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.988l4.259 5.632 4.747-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>\
      </a>\
      <a href="#" class="footer-social-icon" aria-label="YouTube">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>\
      </a>\
      <a href="#" class="footer-social-icon" aria-label="LinkedIn">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>\
      </a>\
      <a href="#" class="footer-social-icon" aria-label="GitHub">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>\
      </a>\
      <a href="#" class="footer-social-icon" aria-label="Instagram">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>\
      </a>\
      <a href="#" class="footer-social-icon" aria-label="TikTok">\
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.06-.1z"/></svg>\
      </a>\
    </div>\
    <div class="footer-bottom-row">\
      <p class="footer-copy">iSkool by <a href="https://iskool.online/ENTHROPY_website.html" target="_blank" rel="noopener noreferrer" class="footer-brand-link">Enthropy</a> &copy; 2025-2026 . All rights reserved.</p>\
    </div>\
  </div>\
</footer>';

  /* ── Demo modal ─────────────────────────────────────────────
     The modal lives here so it works on every page.
     website-clone.html keeps its own copy; injectDemoModal()
     checks first so we never double-inject.
  ──────────────────────────────────────────────────────────── */
  var DEMO_MODAL_CSS = '<style id="iskool-demo-modal-css">\
.demo-modal-overlay{\
  display:none;position:fixed;inset:0;z-index:9000;\
  background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);\
  -webkit-backdrop-filter:blur(4px);\
  align-items:center;justify-content:center;padding:20px;\
}\
.demo-modal-overlay.open{display:flex;animation:dmFadeIn 0.22s ease;}\
@keyframes dmFadeIn{from{opacity:0}to{opacity:1}}\
.demo-modal{\
  background:#fff;border-radius:24px;padding:36px 32px 32px;\
  max-width:560px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.3);\
  position:relative;animation:dmSlideUp 0.28s cubic-bezier(0.34,1.2,0.64,1);\
}\
@keyframes dmSlideUp{\
  from{opacity:0;transform:translateY(28px) scale(0.97)}\
  to{opacity:1;transform:translateY(0) scale(1)}\
}\
.demo-modal-close{\
  position:absolute;top:16px;right:16px;width:32px;height:32px;\
  border-radius:50%;border:none;background:#f0f0f0;color:#555;\
  font-size:18px;cursor:pointer;display:flex;\
  align-items:center;justify-content:center;\
  transition:background 0.18s;line-height:1;\
}\
.demo-modal-close:hover{background:#e0e0e0;}\
.demo-modal-eyebrow{\
  font-size:11px;font-weight:700;letter-spacing:2px;\
  text-transform:uppercase;color:#4fd1c5;margin-bottom:10px;\
}\
.demo-modal-title{\
  font-family:"Syne",sans-serif;\
  font-size:clamp(20px,3vw,26px);font-weight:800;\
  line-height:1.15;letter-spacing:-0.5px;color:#111;margin-bottom:6px;\
}\
.demo-modal-sub{font-size:14.5px;color:#777;margin-bottom:28px;line-height:1.55;}\
.demo-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;}\
.demo-card{\
  border:2px solid #eee;border-radius:16px;padding:20px 18px;\
  text-decoration:none;color:#111;\
  display:flex;flex-direction:column;gap:8px;\
  transition:border-color 0.2s,box-shadow 0.2s,transform 0.2s;\
  position:relative;cursor:pointer;background:#fff;\
}\
.demo-card:hover:not(.demo-card-locked){\
  border-color:#4fd1c5;\
  box-shadow:0 8px 28px rgba(79,209,197,0.18);\
  transform:translateY(-3px);\
}\
.demo-card-locked{opacity:0.62;cursor:not-allowed;background:#fafafa;}\
.demo-card-locked:hover{transform:none;box-shadow:none;border-color:#eee;}\
.demo-card-icon{\
  width:36px;height:36px;line-height:1;\
  display:flex;align-items:center;justify-content:center;\
  border-radius:10px;flex-shrink:0;\
}\
.demo-card-icon svg{width:20px;height:20px;flex-shrink:0;}\
.demo-card--learner .demo-card-icon{background:#e8faf8;}\
.demo-card--learner .demo-card-icon svg{stroke:#4fd1c5;}\
.demo-card--teacher .demo-card-icon{background:#fff3ea;}\
.demo-card--teacher .demo-card-icon svg{stroke:#f97316;}\
.demo-card--admin .demo-card-icon{background:#eaeeff;}\
.demo-card--admin .demo-card-icon svg{stroke:#6366f1;}\
.demo-card--parent .demo-card-icon{background:#f5f5f5;}\
.demo-card--parent .demo-card-icon svg{stroke:#bbb;}\
.demo-card-name{\
  font-family:"Syne",sans-serif;font-size:15px;\
  font-weight:800;color:#111;line-height:1.2;\
}\
.demo-card-desc{font-size:12.5px;color:#888;line-height:1.5;}\
.demo-card-action{\
  display:inline-flex;align-items:center;gap:5px;\
  font-size:12px;font-weight:700;color:#4fd1c5;margin-top:4px;\
}\
.demo-card-locked .demo-card-action{color:#bbb;}\
.demo-lock-badge{\
  position:absolute;top:12px;right:12px;\
  background:#f5f5f5;border:1px solid #e8e8e8;border-radius:999px;\
  padding:3px 10px;font-size:10.5px;font-weight:700;\
  color:#999;letter-spacing:0.3px;\
}\
.demo-card-tooltip{\
  display:none;position:absolute;\
  bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);\
  background:#111;color:#fff;font-size:12px;\
  padding:8px 12px;border-radius:10px;white-space:nowrap;\
  z-index:10;pointer-events:none;\
  box-shadow:0 4px 16px rgba(0,0,0,0.25);\
}\
.demo-card-tooltip::after{\
  content:"";position:absolute;top:100%;left:50%;\
  transform:translateX(-50%);\
  border:6px solid transparent;border-top-color:#111;\
}\
.demo-card-locked:hover .demo-card-tooltip{display:block;}\
@media(max-width:480px){\
  .demo-modal{padding:28px 20px 24px;border-radius:20px;}\
  .demo-cards{grid-template-columns:1fr 1fr;gap:10px;}\
  .demo-card{padding:16px 14px;}\
  .demo-card-icon{width:32px;height:32px;border-radius:8px;}\
  .demo-card-icon svg{width:17px;height:17px;}\
  .demo-card-name{font-size:14px;}\
}\
</style>';

  var DEMO_MODAL_HTML = '\
<div class="demo-modal-overlay" id="demoModalOverlay" onclick="closeDemoModalOutside(event)">\
  <div class="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demoModalTitle">\
    <button class="demo-modal-close" onclick="closeDemoModal()" aria-label="Close">&times;</button>\
    <div class="demo-modal-eyebrow">Live Demo</div>\
    <div class="demo-modal-title" id="demoModalTitle">Which dashboard would you like to explore?</div>\
    <p class="demo-modal-sub">Each role has its own experience. Pick yours and see iSkool in action.</p>\
    <div class="demo-cards">\
      <a href="https://sandbox.iskool.online" class="demo-card demo-card--learner" target="_blank" rel="noopener noreferrer">\
        <div class="demo-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg></div>\
        <div class="demo-card-name">Learner</div>\
        <div class="demo-card-desc">Quizzes, assignments, results &amp; resources</div>\
        <div class="demo-card-action">Explore &rarr;</div>\
      </a>\
      <a href="https://sandbox.iskool.online" class="demo-card demo-card--teacher" target="_blank" rel="noopener noreferrer">\
        <div class="demo-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>\
        <div class="demo-card-name">Teacher</div>\
        <div class="demo-card-desc">Set assessments, track class performance</div>\
        <div class="demo-card-action">Explore &rarr;</div>\
      </a>\
      <a href="https://sandbox.iskool.online" class="demo-card demo-card--admin" target="_blank" rel="noopener noreferrer">\
        <div class="demo-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg></div>\
        <div class="demo-card-name">Admin</div>\
        <div class="demo-card-desc">School-wide oversight &amp; management</div>\
        <div class="demo-card-action">Explore &rarr;</div>\
      </a>\
      <div class="demo-card demo-card-locked demo-card--parent">\
        <div class="demo-lock-badge"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;margin-top:-1px"><rect width="11" height="11" x="6.5" y="11" rx="2"/><path d="M12 11V7a4 4 0 0 0-4-4 4 4 0 0 0-4 4v4"/><line x1="12" x2="12" y1="15" y2="17"/></svg> Coming Soon</div>\
        <div class="demo-card-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>\
        <div class="demo-card-name">Parent</div>\
        <div class="demo-card-desc">Monitor your child\'s progress &amp; stay informed</div>\
        <div class="demo-card-action">Coming Soon</div>\
        <div class="demo-card-tooltip">We\'re putting the finishing touches on this \u2014 check back soon</div>\
      </div>\
    </div>\
  </div>\
</div>';

  function injectDemoModal() {
    /* Skip if already on a page that has the modal built in (website-clone.html) */
    if (document.getElementById('demoModalOverlay')) return;

    /* Inject CSS into <head> */
    if (!document.getElementById('iskool-demo-modal-css')) {
      var styleEl = document.createElement('div');
      styleEl.innerHTML = DEMO_MODAL_CSS;
      document.head.appendChild(styleEl.firstChild);
    }

    /* Inject modal HTML before </body> */
    var modalWrap = document.createElement('div');
    modalWrap.innerHTML = DEMO_MODAL_HTML;
    document.body.appendChild(modalWrap.firstChild);

    /* Expose modal functions globally */
    window.openDemoModal = function () {
      var overlay = document.getElementById('demoModalOverlay');
      if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    };
    window.closeDemoModal = function () {
      var overlay = document.getElementById('demoModalOverlay');
      if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
    };
    window.closeDemoModalOutside = function (e) {
      if (e.target === document.getElementById('demoModalOverlay')) window.closeDemoModal();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.closeDemoModal();
    });
  }

  function injectFooter() {
    var mount = document.getElementById('iskool-footer');
    if (!mount) {
      console.warn('[iskool_footer] No #iskool-footer element found on this page — footer was not injected.');
      return;
    }
    mount.outerHTML = FOOTER_HTML;
    injectDemoModal();
    wireDemoLink();
    wireFaqLink();
  }

  /* The "FAQ" link should jump to #faq if this page has that section
     (currently only website-clone.html). On pages without it, send
     people to the main site's FAQ section instead of scrolling nowhere. */
  function wireFaqLink() {
    var link = document.querySelector('[data-footer-faq-link]');
    if (!link) return;

    link.addEventListener('click', function (e) {
      if (!document.getElementById('faq')) {
        e.preventDefault();
        window.location.href = 'website-clone.html#faq';
      }
      /* else: let the default anchor behavior scroll to #faq on this page */
    });
  }

  /* The "Demo" link should open the demo modal if this page has one
     (currently only website-clone.html). On pages without the modal,
     send people to the main site's demo section instead of calling a
     function that doesn't exist there. */
  function wireDemoLink() {
    var link = document.querySelector('[data-footer-demo-link]');
    if (!link) return;

    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.openDemoModal === 'function') {
        window.openDemoModal();
      } else {
        window.location.href = 'website-clone.html#demo';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }

})();