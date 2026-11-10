<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the parent app on phones launching, loading and going back the way the learner app does:
 *   - it opens on the splash that index.php started, and the splash waits for the first screen;
 *   - it is an installed app (icon, status bar colour, install and update prompts);
 *   - screens come from a copy kept on the phone at once, the server is asked again in the background, and the other
 *     screens are fetched quietly so a tab opens without waiting;
 *   - loaders are the learner's (Home placeholder, blue arc, pill spinner on a button);
 *   - the Back button closes what is open, then goes Home, then asks to press again before leaving.
 * These checks read the source files. How it behaves was checked in a phone-sized browser (390px wide, touch) with the
 * parent API answering slowly, then not at all, and with real Back presses.
 */
final class ParentLaunchLikeLearnerTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The text of the first CSS rule that starts with $selector (up to its closing brace). */
    private function rule(string $css, string $selector, int $from = 0): string
    {
        $start = strpos($css, $selector, $from);
        $this->assertNotFalse($start, $selector . ' is missing');
        return substr($css, $start, strpos($css, '}', $start) - $start);
    }

    // ── Launch: the installed app and the splash ────────────────────────────────────────────────────────────

    public function test_the_page_has_the_same_installed_app_tags_as_the_learner_dashboard(): void
    {
        $page = $this->source('parent_dashboard.php');
        $learner = $this->source('learner_dashboard.php');
        foreach ([
            '<link rel="manifest" href="/manifest.php?v=1.2">',
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=1.1">',
            '<meta name="mobile-web-app-capable" content="yes">',
            '<meta name="application-name" content="iSkool">',
            '<meta name="apple-mobile-web-app-capable" content="yes">',
            '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
        ] as $tag) {
            $this->assertStringContainsString($tag, $learner, 'the learner dashboard is the reference');
            $this->assertStringContainsString($tag, $page);
        }
        $this->assertStringContainsString('<meta name="theme-color" content="#20201f">', $page);
    }

    public function test_the_status_bar_follows_the_theme_and_is_dark_while_the_splash_is_up(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString("var DARK = '#20201f', LIGHT = '#faf9f5';", $page);
        $this->assertStringContainsString('window.paSyncBar = function', $page);
        $this->assertStringContainsString('dark || splashOn() ? DARK : LIGHT', $page);
        // switching the theme updates it
        $this->assertStringContainsString('window.paSyncBar()', $this->source('assets/js/parent/parent_menu.js'));
        // the light colour is the page colour
        $this->assertStringContainsString('--pa-page: #faf9f5;', $this->source('assets/css/parent/parent_app.css'));
    }

    public function test_the_splash_is_the_first_thing_in_the_page_and_waits_for_the_first_screen(): void
    {
        $page = $this->source('parent_dashboard.php');
        $splash = strpos($page, '<div id="pa-splash">');
        $this->assertNotFalse($splash);
        $this->assertLessThan(strpos($page, 'id="parentApp"'), $splash, 'the splash covers the app, so it comes first');
        // nothing but a comment between <body> and the splash, so it is painted with the very first frame
        $this->assertMatchesRegularExpression('/<body>\s*<!--.*?-->\s*<div id="pa-splash">/s', $page);

        // the same hand-off as the learner dashboard: the flag index.php leaves, the time still left of its 1300ms, a ceiling
        foreach (["sessionStorage.getItem('splashStartedAt')", 'var MIN_SPLASH_MS = 1300;', 'var MAX_SPLASH_MS = 6000;', "window.addEventListener('iskool:home-ready'"] as $needle) {
            $this->assertStringContainsString($needle, $page);
            $this->assertStringContainsString($needle, $this->source('learner_dashboard.php'), 'the learner dashboard is the reference');
        }
        // opened without the login splash (a plain refresh): it hides at once
        $this->assertMatchesRegularExpression("/if \\(!startedAtRaw\\) \\{\\s+splash\\.style\\.display = 'none';\\s+return;/", $page);
        // and the login page really leaves that flag for every role, the parent included
        $this->assertStringContainsString("sessionStorage.setItem('splashStartedAt'", $this->source('index.php'));

        // parent_app.js says the first screen is up (drawn, or failed), once
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("new CustomEvent('iskool:home-ready')", $js);
        $this->assertStringContainsString('return first.then(announceReady);', $js);
        $this->assertStringContainsString('}).then(announceReady);', $js);
    }

    public function test_the_splash_looks_like_the_learner_splash(): void
    {
        $parent = $this->source('assets/css/parent/parent_splash.css');
        $learner = $this->source('assets/css/learner/learner_dashboard.css');
        $pairs = [
            ['#pa-splash {', '#dash-splash {'],
            ['#pa-splash-logo img {', '#dash-splash-logo img {'],
            ['#pa-splash-wordmark {', '#dash-splash-wordmark {'],
            ['#pa-splash-brand-wordmark {', '#dash-splash-brand-wordmark {'],
        ];
        foreach ($pairs as [$mine, $theirs]) {
            $normalise = fn (string $css) => preg_replace('/\s+/', ' ', trim(substr($css, strpos($css, '{') + 1)));
            $this->assertSame($normalise($this->rule($learner, $theirs)), $normalise($this->rule($parent, $mine)), $mine . ' is the learner splash');
        }
        // phones and narrow windows: the colour the login page uses
        $this->assertMatchesRegularExpression('/@media \(max-width: 899px\) \{\s+#pa-splash \{ background: #20201f; \}/', $parent);
        // it is not the light splash: for a signed-in parent index.php shows the dark one
        $this->assertStringContainsString("in_array(\$loginThemeRole, ['learner', 'teacher'], true)", $this->source('includes/login_theme_head.php'));
    }

    // ── Instant pages ───────────────────────────────────────────────────────────────────────────────────────

    public function test_the_last_answers_are_kept_on_the_phone_for_the_next_visit(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString("var SAVED_PREFIX = 'parentApp.saved.';", $js);
        // per parent, never read for another one
        $this->assertStringContainsString("var SAVED_KEY = state.parent.email ? SAVED_PREFIX + state.parent.email : '';", $js);
        $this->assertStringContainsString('name.indexOf(SAVED_PREFIX) === 0 && name !== SAVED_KEY', $js);
        $this->assertStringContainsString('var SAVED_MAX_AGE = 30 * 24 * 60 * 60 * 1000;', $js);
        // seeded into lastSeen at the start, before anything is drawn
        $this->assertMatchesRegularExpression('/readSaved\(\);\s+dropOtherSaved\(\);\s+markActiveLinks\(currentRoute\(\)\);\s+start\(\);/', $js);
        // written after an answer arrives (not on every keystroke) and bounded
        $this->assertStringContainsString('saveSoon();', $js);
        $this->assertStringContainsString('var SAVED_MAX_SCREENS = 24;', $js);
    }

    public function test_the_saved_copy_goes_when_the_parent_signs_out_or_the_session_ends(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $menu = $this->source('assets/js/parent/parent_menu.js');
        // the session ending (a 401/403, or a login page where JSON was expected) goes through toLogin()
        $this->assertMatchesRegularExpression('/function toLogin\(\) \{\s+forgetSaved\(\);/', $js);
        // the menu's Sign out link, and the quick search action
        $this->assertStringContainsString('logout\\.php', $js);
        $this->assertStringContainsString('window.paData = { forget: forgetSaved };', $js);
        $this->assertMatchesRegularExpression('/function signOut\(\) \{\s+if \(window\.paData\) window\.paData\.forget\(\);/', $menu);
        // nothing is written after it
        $this->assertStringContainsString('if (!SAVED_KEY || savedOff) return;', $js);
    }

    public function test_a_screen_with_a_copy_is_drawn_at_once_and_the_server_is_asked_in_the_background(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString('if (older && !forcing) {', $js);
        $this->assertStringContainsString('revalidate(key, path, params, older, drawing);', $js);
        $this->assertStringContainsString('return Promise.resolve(older.data);', $js);
        // drawn again only when the answer is different, and only if the parent is still on that screen
        $this->assertStringContainsString('if (drawing !== renderId) return;', $js);
        $this->assertStringContainsString('if (!sameData(data, older.data)) render(false, true);', $js);
        // a failed update leaves the copy, labelled as one
        $this->assertStringContainsString('viewCopy = older.at;', $js);
        // a screen with nothing at all waits, and says so
        $this->assertStringContainsString('if (!forcing) waiting = true;', $js);
    }

    public function test_the_list_of_children_and_the_first_screen_are_asked_for_together(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        // with a list from the last visit nothing waits for it
        $this->assertStringContainsString('if (savedChildren) {', $js);
        $this->assertStringContainsString('applyChildren(savedChildren.data);', $js);
        // the very first visit: the screen for the child this phone showed last is asked for while the list is
        $this->assertStringContainsString('warmUp();', $js);
        $this->assertStringContainsString("parseInt(storeGet('parentApp.child'), 10)", $js);
        // two asks for the same thing share one request
        $this->assertStringContainsString('if (inflight[key]) return inflight[key];', $js);
    }

    public function test_the_other_screens_are_fetched_quietly_after_the_first_one_like_the_learner(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        foreach (['home', 'report', 'syllabus', 'news', 'events'] as $screen) {
            $this->assertMatchesRegularExpression('/\n\s+' . $screen . ':\s+\{ path: \'api\/parent\/get_' . $screen . '\.php\'/', $js);
        }
        // the same keys the screens use, so a screen finds what was fetched for it
        $this->assertStringContainsString("if (spec.term && state.reportTerm) params.term = state.reportTerm;", $js);
        $this->assertStringContainsString("return cached('api/parent/get_report.php', params).then(buildReport);", $js);
        // staggered, never on a phone set to save data, never for the screen on show
        $this->assertStringContainsString('navigator.connection.saveData', $js);
        $this->assertStringContainsString('if (!spec || name === currentRoute() || navigator.onLine === false) return;', $js);
        $this->assertStringContainsString("setTimeout(function () { prefetchScreen('news'); prefetchScreen('events'); }, base * 2)", $js);
        // after the first screen, and again for another child
        $this->assertStringContainsString('kickOffPrefetches();', $js);
        $this->assertStringContainsString('kickOffPrefetches(800);', $js);
        // the learner does the same after Home
        $this->assertStringContainsString('window.kickOffLearnerPrefetches = function', $this->source('assets/js/learner/manual.js'));
    }

    public function test_coming_back_to_the_app_after_a_while_updates_the_page_quietly(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $this->assertStringContainsString('var RESUME_MS = 5 * 60 * 1000;', $js);
        $this->assertStringContainsString('if (away > RESUME_MS && navigator.onLine !== false) refreshPage();', $js);
        // a pull or "Try again" asks the server, never the copy
        $this->assertStringContainsString('function renderFresh() {', $js);
        $this->assertStringContainsString("forcing = false;", $js);
    }

    // ── Loaders ─────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_arc_loader_is_the_learner_loader(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('<div class="pa-loader" id="paLoader" aria-hidden="true"><div class="pa-loader-ring"></div></div>', $page);

        $parent = $this->source('assets/css/parent/parent_app.css');
        $learner = $this->source('assets/css/learner/learner_dashboard.css');
        $learnerPhone = substr($learner, strpos($learner, '/* ── MOBILE LOADER OVERRIDE'));
        $overlay = $this->rule($parent, '    .pa-loader {');
        $ring = $this->rule($parent, '    .pa-loader-ring {');
        $learnerOverlay = $this->rule($learnerPhone, '    #loaderOverlay {');
        $learnerRing = $this->rule($learnerPhone, '    .loader {');
        foreach (['background: rgba(0, 0, 0, 0.55);', 'backdrop-filter: blur(3px);', 'z-index: 8000;'] as $line) {
            $this->assertStringContainsString($line, $learnerOverlay);
            $this->assertStringContainsString($line, $overlay);
        }
        foreach (['width: 36px;', 'height: 36px;', 'border: 3.5px solid rgba(255, 255, 255, 0.15);', 'border-top-color: #4c8bf5;', '0.75s linear infinite'] as $part) {
            $this->assertStringContainsString($part, $learnerRing);
            $this->assertStringContainsString($part, $ring);
        }
        // phones only, and it never blocks a tap
        $this->assertMatchesRegularExpression('/@media \(max-width: 768px\) \{\s+\.pa-loader \{/', $parent);
        $this->assertStringContainsString('pointer-events: none;', $overlay);
        $this->assertStringContainsString('.pa-loader.is-on { display: flex; }', $parent);
    }

    public function test_the_loaders_show_only_when_there_is_something_to_wait_for(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        // the arc waits a moment, so an answer that arrives at once never flashes it, and the splash is never covered by it
        $this->assertStringContainsString('var LOADER_DELAY_MS = 150;', $js);
        $this->assertStringContainsString('if (!splashUp()) loaderEl.classList.add(\'is-on\');', $js);
        // Home gets the placeholder (phones), everything else the arc; desktop keeps the plain line
        $this->assertStringContainsString("if (currentRoute() === 'home') view.appendChild(homeSkeleton());", $js);
        $this->assertStringContainsString("view.appendChild(el('p', 'pa-muted pa-loading', 'Loading…'));", $js);
        // every drawn screen, and every new render, puts the arc away
        $this->assertMatchesRegularExpression('/function show\(node\) \{\s+hideLoader\(\);/', $js);
        $this->assertMatchesRegularExpression('/waiting = false;\s+hideLoader\(\);/', $js);
        // the placeholder has CSS in both themes (tokens), and respects reduced motion
        $css = $this->source('assets/css/parent/parent_app.css');
        $this->assertStringContainsString('.pa-sk { background: var(--pa-chip);', $css);
        $this->assertStringContainsString('prefers-reduced-motion: reduce', $css);
    }

    public function test_the_add_a_child_button_has_the_learner_pill_spinner(): void
    {
        $js = $this->source('assets/js/parent/parent_app.js');
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('assets/css/pill-loader.css', $page);
        $this->assertStringContainsString("el('button', 'pa-btn btn-loadable')", $js);
        $this->assertStringContainsString("button.classList.toggle('is-loading', on);", $js);
        $this->assertStringContainsString('for (var dot = 0; dot < 8; dot++)', $js, 'eight pills, like the learner buttons');
        $this->assertStringNotContainsString("button.textContent = 'Linking…'", $js);
        $this->assertStringContainsString('.pa-btn .btn-spinner span { background: var(--pa-on-ink); }', $this->source('assets/css/parent/parent_app.css'));
    }

    // ── Back button and prompts ─────────────────────────────────────────────────────────────────────────────

    public function test_the_shared_back_button_is_loaded_and_told_what_the_parent_app_has(): void
    {
        $page = $this->source('parent_dashboard.php');
        $engine = strpos($page, 'assets/js/shared/back_button.js');
        $mine = strpos($page, 'assets/js/parent/parent_back_button.js');
        $this->assertNotFalse($engine);
        $this->assertNotFalse($mine);
        $this->assertLessThan($mine, $engine, 'the engine must load first');
        $this->assertStringContainsString('assets/css/shared/back_button.css', $page);
        // the hint and the install card sit above the bottom bar by looking for this id
        $this->assertStringContainsString('<nav class="pa-tabs" id="mobileBottomNav"', $page);
        $this->assertStringContainsString("getElementById('mobileBottomNav')", $this->source('assets/js/shared/back_button.js'));

        $js = $this->source('assets/js/parent/parent_back_button.js');
        $this->assertStringContainsString('window.iskoolBack.init({', $js);
        $this->assertStringContainsString('layers: [closeOpenLayer],', $js);
        $this->assertStringContainsString("exitHint: 'Press Back again to exit'", $js);
        $this->assertStringContainsString('window.paMenu.closeTop()', $js);
        // the menu can close its top-most layer: search, account sheet, account card, then the menu
        $menu = $this->source('assets/js/parent/parent_menu.js');
        $this->assertMatchesRegularExpression('/closeTop: function \(\) \{\s+if \(!phone\.matches\) return false;\s+if \(searchIsOpen\(\)\)[^\n]+\n\s+if \(sheetOpen\(\)\)[^\n]+\n\s+if \(cardOpen\(\)\)[^\n]+\n\s+if \(menuOpen\(\)\)/', $menu);
    }

    public function test_on_phones_opening_a_page_rewrites_the_address_so_back_has_no_pages_to_walk_through(): void
    {
        $menu = $this->source('assets/js/parent/parent_menu.js');
        $this->assertStringContainsString("window.history.replaceState(window.history.state, '', target);", $menu);
        $this->assertStringContainsString('announce.paSynthetic = true;', $menu);
        // wider screens keep the browser's history
        $this->assertMatchesRegularExpression('/if \(!phone\.matches\) \{\s+if \(window\.location\.hash !== target\) window\.location\.hash = target;\s+return;/', $menu);
        // going back must not move the page: the older address the guard leaves is stopped before the router sees it,
        // and this file is the first to load, so its listener runs first
        $this->assertStringContainsString('ev.stopImmediatePropagation();', $menu);
        $page = $this->source('parent_dashboard.php');
        $this->assertLessThan(strpos($page, '<script src="assets/js/parent/parent_app.js'), strpos($page, '<script src="assets/js/parent/parent_menu.js'));
        // the router says which page is on show
        $this->assertStringContainsString('window.paRoute = route;', $this->source('assets/js/parent/parent_app.js'));
        // links inside the app go through it on phones, and so do the app's own buttons
        $back = $this->source('assets/js/parent/parent_back_button.js');
        $this->assertStringContainsString("closest('a[href^=\"#/\"]')", $back);
        $this->assertStringNotContainsString('window.location.hash =', substr($this->source('assets/js/parent/parent_app.js'), strpos($this->source('assets/js/parent/parent_app.js'), 'function renderAddChild')), 'the app opens pages through go()');
    }

    public function test_the_update_and_install_prompts_are_the_shared_ones(): void
    {
        $page = $this->source('parent_dashboard.php');
        $this->assertStringContainsString('assets/css/shared/pwa_prompts.css', $page);
        $this->assertLessThan(strpos($page, 'assets/js/shared/pwa_prompts.js'), strpos($page, 'assets/js/parent/parent_pwa.js'), 'the update flag is set before the banner script starts');

        $pwa = $this->source('assets/js/parent/parent_pwa.js');
        $learner = $this->source('learner_dashboard.php');
        foreach (["'iskool-update-available'", 'window.iskoolPwa.offerUpdate()', 'window.__iskoolUpdatePending = true', "addEventListener('controllerchange'"] as $needle) {
            $this->assertStringContainsString($needle, $pwa);
        }
        $this->assertStringContainsString("event.data?.type !== 'iskool-update-available'", $learner, 'the learner dashboard is the reference');
        $this->assertStringContainsString("navigator.serviceWorker.register('/service-worker.js', { scope: '/' })", $pwa);
    }

    public function test_the_changed_and_new_files_have_cache_versions(): void
    {
        // The service worker caches /assets/ by full URL, so the numbers in the page must move with the files
        $page = $this->source('parent_dashboard.php');
        foreach ([
            'parent_app.css?v=1.14', 'parent_splash.css?v=1.1', 'pill-loader.css?v=1.0', 'pwa_prompts.css?v=1.0', 'back_button.css?v=1.0',
            'parent_menu.js?v=1.1', 'parent_app.js?v=1.12', 'parent_pwa.js?v=1.0', 'pwa_prompts.js?v=1.0', 'back_button.js?v=1.0', 'parent_back_button.js?v=1.0',
        ] as $file) {
            $this->assertStringContainsString($file, $page);
        }
        // the shared files are used exactly as the learner and teacher dashboards use them, so their pins did not move
        $this->assertStringContainsString('pwa_prompts.js?v=1.0', $this->source('learner_dashboard.php'));
        $this->assertStringContainsString('back_button.js?v=1.0', $this->source('learner_dashboard.php'));
    }
}
