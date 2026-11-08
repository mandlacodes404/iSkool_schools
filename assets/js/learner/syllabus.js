window.syllabusCache          = null;
window.syllabusPrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchSyllabus = function () {
    if (window.syllabusCache) return;
    if (window.syllabusPrefetchPromise) return;
    window.syllabusPrefetchPromise = fetch('api/learner/get_sbo.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { if (!data.error) window.syllabusCache = data; })
        .catch(() => {})
        .finally(() => { window.syllabusPrefetchPromise = null; });
};

window.fetchSyllabus = async function() {
    const navigation = window.beginLearnerViewNavigation?.('syllabus');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    sessionStorage.setItem('lastLearnerPage', 'syllabus');
    if (typeof window.setActive === 'function') window.setActive('syllabus');
    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Syllabus', mode: 'standard', color: '#4fd1c5' });
    }

    const apiArea        = document.getElementById('api-content-area');
    const iframe         = document.getElementById('mainFrame');
    const loader         = document.getElementById('loaderOverlay');
    const myClassContent = document.getElementById('myClassContent');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    // If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.syllabusPrefetchPromise) {
        await window.syllabusPrefetchPromise;
    }
    if (!isCurrentNavigation()) return;

    // Serve from cache instantly
    if (window.syllabusCache) {
        apiArea.innerHTML = renderSyllabusPage(window.syllabusCache);
        if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
        sylEnsureFont();
        if (typeof window.sylInitDesktop === 'function') window.sylInitDesktop();
        sylMobileApply();
        restoreSyllabusPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/learner/get_sbo.php');
        const data = await res.json();
        if (!isCurrentNavigation()) return;

        if (data.error) throw new Error(data.error);

        window.syllabusCache = data;
        apiArea.innerHTML = renderSyllabusPage(data);
        if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
        sylEnsureFont();
        if (typeof window.sylInitDesktop === 'function') window.sylInitDesktop();
        sylMobileApply();
        restoreSyllabusPageState();

    } catch (err) {
        if (!isCurrentNavigation()) return;
        console.error('Syllabus fetch error:', err);
        if (apiArea) {
            apiArea.innerHTML = `
                <style>
                    @media (min-width: 900px) {
                        .syl-retry-btn { background: #c2c3b7 !important; }
                        .syl-retry-btn:hover { background: #adaea2 !important; }
                    }
                    /* Light mode: this error markup is built without the page's main stylesheet, so its light rules live here.
                       Same recipe as the Quiz page's Try Again: the dark rule above is !important, so these are too. */
                    @media (min-width: 769px) {
                        html[data-learner-theme="light"] .syl-retry-btn { background: #252624 !important; color: #ffffff !important; }
                        html[data-learner-theme="light"] .syl-retry-btn:hover { background: #3a3b37 !important; }
                        html[data-learner-theme="light"] p:has(+ .syl-retry-btn) { color: #bd4a43 !important; }
                    }
                    /* Light mode on phones (Settings > Appearance, set by mobile_theme.js): the same recipe, behind the phone attribute. */
                    @media (max-width: 768px) {
                        html[data-learner-mobile-theme="light"] .syl-retry-btn { background: #252624 !important; color: #ffffff !important; }
                        html[data-learner-mobile-theme="light"] .syl-retry-btn:hover { background: #3a3b37 !important; }
                        html[data-learner-mobile-theme="light"] p:has(+ .syl-retry-btn) { color: #bd4a43 !important; }
                    }
                </style>
                <div style="text-align:center;margin-top:60px;padding:20px;">
                    <p style="color:#ff5555;">Unable to load syllabus.</p>
                    <button class="syl-retry-btn" onclick="window.syllabusCache=null; fetchSyllabus()"
                            style="background:#4fd1c5;border:none;padding:8px 16px;
                                   border-radius:8px;color:#0d1117;font-weight:700;cursor:pointer;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveSyllabusPageState() {
    // while a phone detail is open the page is not the list, so its scroll must not overwrite the list's
    if (window._sylMobDetail) return;
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.syl-sidebar-scroll');
    const panel = document.querySelector('.syl-body');
    const state = {
        activeTerm:  window._syllabusActiveTerm ?? null,
        mobileSearch: document.getElementById('sylMobileSearch')?.value || '',
        selectedKey: (typeof sylKey === 'function' && window._sylBriefs && window._sylSelectedIdx !== null && window._sylBriefs[window._sylSelectedIdx]) ? sylKey(window._sylBriefs[window._sylSelectedIdx]) : null,
        scrollTop:   mainContent ? mainContent.scrollTop : 0,
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        panelScroll: panel ? panel.scrollTop : 0,
    };
    if (window.learnerPageState) window.learnerPageState.set('syllabus', state);
    else sessionStorage.setItem('syllabusPageState', JSON.stringify(state));
}

function restoreSyllabusPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('syllabus')
            : JSON.parse(sessionStorage.getItem('syllabusPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            wireSyllabusScrollState();
            return;
        }
        if (state.activeTerm !== null && state.activeTerm !== undefined) {
            requestAnimationFrame(() => {
                const tab = document.getElementById(`syl-mob-tab-${state.activeTerm}`)
                    || document.getElementById(`syl-chip-${state.activeTerm}`);
                if (tab) tab.click();
                if (state.mobileSearch) {
                    const input = document.getElementById('sylMobileSearch');
                    if (input) { input.value = state.mobileSearch; window.sylMobileSearch(state.mobileSearch); }
                }
                if (state.selectedKey && document.getElementById('syl-list')) {
                    const i = (window._sylBriefs || []).findIndex(b => sylKey(b) === state.selectedKey);
                    if (i >= 0 && Number(window._sylBriefs[i].term) === Number(window._syllabusActiveTerm)) window.selectDesktopSyllabusBrief(i);
                }
                const mainContent = document.querySelector('.main-content');
                const sidebar = document.querySelector('.syl-sidebar-scroll');
                const panel = document.querySelector('.syl-body');
                if (mainContent && Number.isFinite(state.scrollTop)) mainContent.scrollTop = state.scrollTop;
                if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
                if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
                wireSyllabusScrollState();
                saveSyllabusPageState();
            });
        } else {
            wireSyllabusScrollState();
        }
    } catch (e) { /* ignore bad state */ }
}

function wireSyllabusScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.syl-sidebar-scroll');
    const panel = document.querySelector('.syl-body');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.sylScrollWired === '1') return;
        el.dataset.sylScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('syllabus', saveSyllabusPageState), { passive: true });
    });
}

// ─────────────────────────────────────────────
// RENDER FULL PAGE
// ─────────────────────────────────────────────
function renderSyllabusPage(data) {
    const briefs      = data.briefs      || [];
    const currentTerm = data.current_term || 1;

    if (!briefs.length) {
        return `
            <style>
                /* Light mode: this message is built without the page's main stylesheet. Its greys are inline, hence !important on the text. */
                @media (min-width: 769px) {
                    html[data-learner-theme="light"] .syl-empty p[style*="#8b949e" i] { color: #73746d !important; }
                    html[data-learner-theme="light"] .syl-empty svg[stroke="#8b949e" i] { stroke: #8b8b83; }
                }
                /* Light mode on phones (Settings > Appearance, set by mobile_theme.js): the same message, behind the phone attribute. */
                @media (max-width: 768px) {
                    html[data-learner-mobile-theme="light"] .syl-empty p[style*="#8b949e" i] { color: #6b6c65 !important; }
                    html[data-learner-mobile-theme="light"] .syl-empty svg[stroke="#8b949e" i] { stroke: #8b8b83; }
                }
            </style>
            <div class="syl-empty" style="text-align:center;margin-top:80px;padding:20px;">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="#8b949e"
                     stroke-width="1.5" fill="none" style="margin-bottom:16px;">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <p style="color:#8b949e;font-size:15px;">No syllabus briefs have been posted yet.</p>
                <p style="color:#8b949e;font-size:13px;">Your teachers will post them here each term.</p>
            </div>`;
    }

    // Group by term
    const byTerm = {};
    briefs.forEach(b => {
        if (!byTerm[b.term]) byTerm[b.term] = [];
        byTerm[b.term].push(b);
    });

    const terms      = Object.keys(byTerm).map(Number).sort();
    const activeTerm = terms.includes(currentTerm) ? currentTerm : terms[0];

    // Desktop state (list + detail are rendered client-side by sylRenderDesktopList / selectDesktopSyllabusBrief)
    window._sylBriefs = briefs;
    window._sylCurrentTerm = currentTerm;
    window._syllabusActiveTerm = activeTerm;
    window._sylTerm = '';
    window._sylSelectedIdx = null;
    window._sylMobDetail = false;

    // ── Phone: term chips (the same ids the page-state restore clicks) ──
    window._sylMobTerm = '';
    const mobileTabsHtml = terms.map(t => `
        <button type="button" class="syl-mobile-chip${t === activeTerm ? ' on' : ''}" data-term="${t}" aria-pressed="${t === activeTerm}"
                onclick="switchSylTab(${t})" id="syl-mob-tab-${t}">${t === currentTerm ? '<span class="syl-mobile-cd"></span>' : ''}Term ${t}</button>`).join('');

    return `
        <style>
            /* ══════════════════════════════════════════
               DESKTOP SPLIT LAYOUT  (≥ 900px)
               Follows the learner assignments page: Geist, 400/500 weights, the teacher
               text ladder, rings in the list, neutral chips and cards. Colour tokens are
               literal values from teacher_desktop_menu.css so nothing here depends on
               which --dm-* variables the learner shell defines.
               ══════════════════════════════════════════ */
            @media (min-width: 900px) {
                .syl-desktop-layout { display: flex !important; }
                .syl-mobile-layout  { display: none  !important; }
            }
            @media (max-width: 899px) {
                .syl-desktop-layout { display: none  !important; }
                .syl-mobile-layout  { display: block !important; }
            }

            .syl-desktop-layout {
                --syl-listw: 320px;
                /* Teacher palette */
                --syl-text:   #f0efec;
                --syl-soft:   #c2c3b7;
                --syl-muted:  #9b9c92;
                --syl-faint:  #7a7b73;
                --syl-accent: #4fd1c5;
                --syl-line:        rgba(255,255,255,0.07);
                --syl-line-strong: rgba(255,255,255,0.14);
                --syl-hover:  rgba(255,255,255,0.055);
                --syl-active: rgba(255,255,255,0.095);
                /* Type weights for the whole desktop page (Geist). Tune here. */
                --syl-w-strong: 500;  /* title, status chip, group label, selected row */
                --syl-w-medium: 400;  /* values, small actions */
                display: flex;
                gap: 0;
                min-height: 500px;
                font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
                font-weight: 400;
                font-variant-numeric: tabular-nums; /* dates and counts line up */
                -webkit-font-smoothing: antialiased; /* keeps light weights from looking heavy on dark */
                -moz-osx-font-smoothing: grayscale;
            }

            /* ── List pane ── */
            .syl-sidebar {
                width: var(--syl-listw);
                min-width: 260px;
                max-width: 420px;
                flex-shrink: 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: transparent;   /* same as the detail pane, which is transparent too */
                border-right: 1px solid var(--syl-line);
            }
            .syl-lh {
                padding: 12px 12px 10px;
                border-bottom: 1px solid var(--syl-line);
                flex-shrink: 0;
            }
            .syl-desktop-search-wrap { position: relative; }
            .syl-desktop-search-wrap svg {
                position: absolute;
                left: 11px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--syl-faint);
            }
            .syl-desktop-search {
                width: 100%;
                box-sizing: border-box;
                height: 34px;
                padding: 0 10px 0 33px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid var(--syl-line);
                color: var(--syl-text);
                font-size: 13px;
                font-weight: 400;
                font-family: inherit;
                transition: border-color 0.2s;
            }
            .syl-desktop-search:focus { outline: none; border-color: var(--syl-accent); }
            .syl-desktop-search::placeholder { color: var(--syl-faint); }

            /* Term pills stay under the search bar; the active pill is neutral, like the teacher chips */
            .syl-chips { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; row-gap: 6px; }
            .syl-chip {
                height: 26px;
                padding: 0 10px;
                border-radius: 999px;
                border: 1px solid var(--syl-line);
                background: none;
                color: var(--syl-muted);
                font-family: inherit;
                font-size: 12px;
                font-weight: 400;
                white-space: nowrap;
                cursor: pointer;
            }
            .syl-chip:hover { color: var(--syl-text); background: var(--syl-hover); }
            .syl-chip.on {
                background: var(--syl-active);
                border-color: var(--syl-line-strong);
                color: var(--syl-text);
                font-weight: var(--syl-w-strong, 500);
            }
            .syl-chip:focus-visible { outline: 2px solid var(--syl-accent); outline-offset: 1px; }
            .syl-chip .syl-cd { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--syl-soft); margin-right: 6px; vertical-align: 1px; }

            .syl-sidebar-scroll {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                position: relative;
                outline: none;
                padding-bottom: 8px;
            }
            .syl-sidebar-scroll:focus-visible { outline: 2px solid var(--syl-accent); outline-offset: -2px; }
            .syl-sidebar-scroll::-webkit-scrollbar { width: 8px; }
            .syl-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .syl-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; transition: background 0.15s ease; }
            .syl-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

            /* Group label: same small uppercase label as the assignments list, with the subject count */
            .syl-gh {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                padding: 12px 14px 6px;
                color: var(--syl-muted);
                font-size: 10px;
                font-weight: var(--syl-w-strong, 500);
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .syl-gh i { font-style: normal; font-weight: 400; color: var(--syl-faint); }

            /* Row: plain ring, subject, updated date */
            .syl-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 48px;
                padding: 6px 14px;
                cursor: pointer;
            }
            .syl-sidebar-item:hover { background: var(--syl-hover); }
            .syl-sidebar-item.active { background: var(--syl-active); }
            .syl-sidebar-dot {
                width: 7px;
                height: 7px;
                box-sizing: border-box;
                border-radius: 50%;
                border: 1.5px solid var(--syl-faint);
                background: transparent;
                flex-shrink: 0;
            }
            .syl-sidebar-item-info { flex: 1; min-width: 0; }
            .syl-sidebar-item-title {
                font-size: 14px;
                font-weight: 400;
                color: var(--syl-soft);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .syl-sidebar-item-meta {
                font-size: 11px;
                font-weight: 400;
                color: var(--syl-faint);
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            /* the selected row reads as current through brighter text and one step more weight */
            .syl-sidebar-item.active .syl-sidebar-item-title { color: var(--syl-text); font-weight: var(--syl-w-strong, 500); }
            .syl-list-empty { padding: 40px 20px; text-align: center; color: var(--syl-faint); font-size: 13px; }

            /* ── Resize handle ── */
            .syl-split {
                width: 6px;
                margin-left: -3px;
                flex-shrink: 0;
                cursor: col-resize;
                position: relative;
                z-index: 2;
                outline: none;
            }
            .syl-split:hover, .syl-split.drag, .syl-split:focus-visible {
                background: linear-gradient(90deg, transparent 2px, #4fd1c5 2px, #4fd1c5 4px, transparent 4px);
            }

            /* ── Detail pane ── */
            .syl-main-panel {
                flex: 1;
                min-width: 0;
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                container-type: inline-size;
            }
            .syl-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--syl-faint);
                gap: 12px;
                padding: 40px;
            }
            .syl-panel-empty svg { opacity: 0.3; }
            .syl-panel-empty p { font-size: 14px; margin: 0; }

            .syl-dh {
                height: 64px;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 28px;
                border-bottom: 1px solid var(--syl-line);
                flex-shrink: 0;
            }

            .syl-dh, .syl-dh *, .syl-dh *::before, .syl-dh *::after { box-sizing: border-box; }
            /* id prefix so a host-level #api-content-area h2 rule cannot recolour the title */
            #syl-main-panel .syl-dh-title {
                margin: 0;
                min-width: 0;
                font-family: inherit;
                font-size: 18px;
                font-weight: var(--syl-w-strong, 500);
                line-height: 1.25;
                color: var(--syl-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            /* Fixed height + line-height:1 so the chip is the same 23px tall whatever
               line-height the host page sets, and sits centred on the title. */
            .syl-panel-status {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
                height: 23px;
                padding: 0 8px;
                border-radius: 6px;
                border: 1px solid var(--syl-line);
                font-size: 11px;
                font-weight: var(--syl-w-strong, 500);
                line-height: 1;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                white-space: nowrap;
                color: var(--syl-muted);
            }
            .syl-panel-status--cur { background: var(--syl-active); border-color: var(--syl-line-strong); color: var(--syl-text); }
            .syl-dsp { flex: 1; }
            .syl-muted { color: var(--syl-muted); font-size: 13px; flex-shrink: 0; }
            .syl-dbody { flex: 1; min-height: 0; display: flex; }
            .syl-body { flex: 1; min-width: 0; overflow-y: auto; padding: 28px; }
            .syl-body::-webkit-scrollbar { width: 8px; }
            .syl-body::-webkit-scrollbar-track { background: transparent; }
            .syl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            .syl-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            .syl-read { max-width: 760px; }
            .syl-lead { color: var(--syl-soft); line-height: 1.7; margin: 0 0 20px; font-size: 14px; }

            /* ── Context rail (hides when the detail pane is under 900px wide) ── */
            .syl-rail {
                width: 280px;
                flex-shrink: 0;
                border-left: 1px solid var(--syl-line);
                padding: 24px 20px;
                overflow-y: auto;
            }
            .syl-rail h4 {
                margin: 0 0 14px;
                font-size: 12px;
                font-weight: var(--syl-w-strong, 500);
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: var(--syl-muted);
            }
            .syl-kv {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid var(--syl-line);
                font-size: 13px;
            }
            .syl-kv span { color: var(--syl-muted); }
            .syl-kv b { font-weight: var(--syl-w-medium, 400); text-align: right; color: var(--syl-text); }
            @container (max-width: 899px) { .syl-rail { display: none; } }

            /* ── Syllabus: note, topics, assessment bar, rail links ── */
            .syl-note2 {
                border: 1px solid var(--syl-line); border-left: 3px solid var(--syl-line-strong); background: transparent; border-radius: 8px;
                padding: 12px 14px; color: var(--syl-soft); line-height: 1.65; font-size: 14px; margin-bottom: 8px; white-space: pre-line;
            }
            .syl-note2 small { display: block; font-size: 11px; font-weight: var(--syl-w-strong, 500); letter-spacing: 0.6px; text-transform: uppercase; color: var(--syl-muted); margin-bottom: 4px; }
            .syl-h3 { font-size: 12px; font-weight: var(--syl-w-strong, 500); letter-spacing: 0.6px; text-transform: uppercase; color: var(--syl-muted); margin: 26px 0 10px; }
            .syl-tl { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0 28px; }
            .syl-tl li { display: flex; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--syl-line); font-size: 14px; color: var(--syl-soft); }
            .syl-tl li span { color: var(--syl-faint); font-weight: var(--syl-w-medium, 400); font-size: 12px; width: 18px; flex-shrink: 0; padding-top: 2px; }
            .syl-stack { display: flex; height: 10px; border-radius: 5px; overflow: hidden; gap: 2px; margin: 4px 0 14px; }
            .syl-wrow { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--syl-line); font-size: 14px; color: var(--syl-soft); }
            .syl-wrow i { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
            .syl-wrow b { margin-left: auto; font-weight: var(--syl-w-medium, 400); color: var(--syl-text); }
            .syl-more {
                display: block; width: 100%; text-align: left; padding: 9px 0; cursor: pointer;
                background: none; border: 0; border-bottom: 1px solid var(--syl-line); font-family: inherit;
            }
            .syl-more b { display: block; font-size: 13px; font-weight: var(--syl-w-medium, 400); color: var(--syl-text); }
            .syl-more small { color: var(--syl-faint); font-size: 12px; }
            .syl-more:hover b { color: var(--syl-accent); }
            .syl-rail h4.syl-rail-sub { margin: 28px 0 4px; }


            /* ═══ Light mode: learner Syllabus (desktop) ═══════════════════════════════════════════════════════════════
               The desktop Syllabus page is driven by the --syl-* variables above, so most of light mode is the variable
               block below, the same way the Home page does it with --lhd-*, the Quiz page with --lqz-*, the Assignments page
               with --las-* and the Announcements page with --lan-*. The rest fixes the colours that are hard-coded: the search
               box, scrollbars, resize handle, the icon in the empty detail pane, and the assessment bar and its legend
               (colours set inline by selectDesktopSyllabusBrief). The phone list and detail (shown on phones and from 769px to
               899px) are drawn from the --qm-* tokens in sylQuietStyle(), which has their own light values. Same palette as
               the Home page, the sidebar and the Quiz, Assignments and Announcements pages.
               Applies only when <html data-learner-theme="light"> on 769px and wider. Dark mode and phones are untouched.
               To remove it, delete this block. */
            @media (min-width: 769px) {

                /* palette: titles near-black, body text grey, lines the same warm greys as the sidebar and Home */
                html[data-learner-theme="light"] .syl-desktop-layout {
                    --syl-text:   #282924;   /* titles, the selected row and the values in the Details rail */
                    --syl-soft:   #53544e;   /* body text */
                    --syl-muted:  #73746d;
                    --syl-faint:  #7d7e76;
                    --syl-accent: #187a72;   /* focus rings, the "Other subjects" hover and the search focus border */
                    --syl-line:        #dfded8;
                    --syl-line-strong: #d0cfc8;
                    --syl-hover:  rgba(38,39,35,.055);
                    --syl-active: rgba(38,39,35,.075);
                    /* the layout sets no text colour of its own, so anything unstyled would inherit the dark page's white */
                    color: var(--syl-text);
                    color-scheme: light;
            }

            /* filter box: white, like the sidebar's search button */
            html[data-learner-theme="light"] .syl-desktop-search { background: #ffffff; }

            /* scrollbars (the dark ones are white at 10% and vanish on a light page) */
            html[data-learner-theme="light"] .syl-sidebar-scroll::-webkit-scrollbar-thumb,
            html[data-learner-theme="light"] .syl-body::-webkit-scrollbar-thumb { background: rgba(38,39,35,.16); }
            html[data-learner-theme="light"] .syl-sidebar-scroll::-webkit-scrollbar-thumb:hover,
            html[data-learner-theme="light"] .syl-body::-webkit-scrollbar-thumb:hover { background: rgba(38,39,35,.30); }

            /* resize handle between the list and the detail pane */
            html[data-learner-theme="light"] .syl-split:hover,
            html[data-learner-theme="light"] .syl-split.drag,
            html[data-learner-theme="light"] .syl-split:focus-visible {
                background: linear-gradient(90deg, transparent 2px, #187a72 2px, #187a72 4px, transparent 4px);
            }

            /* book icon in the empty detail pane: its stroke is set in the markup, and the dark-mode teal at 30% all but vanishes on white */
            html[data-learner-theme="light"] .syl-panel-empty svg[stroke="#4fd1c5" i] { stroke: #187a72; }

            /* assessment colours the JS writes inline (COL in selectDesktopSyllabusBrief), each matched by its value and swapped
               for a darker one that holds up on white: the weighting bar and legend squares on desktop. */
            html[data-learner-theme="light"] .syl-stack > [style*="#c2c3b7" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#c2c3b7" i] { background: #8b8b83 !important; }
            html[data-learner-theme="light"] .syl-stack > [style*="#a78bfa" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#a78bfa" i] { background: #6b4fc7 !important; }
            html[data-learner-theme="light"] .syl-stack > [style*="#f28c38" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#f28c38" i] { background: #d97706 !important; }
            html[data-learner-theme="light"] .syl-stack > [style*="#f472b6" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#f472b6" i] { background: #db2777 !important; }
            html[data-learner-theme="light"] .syl-stack > [style*="#fdd663" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#fdd663" i] { background: #c99a00 !important; }
            html[data-learner-theme="light"] .syl-stack > [style*="#34d399" i],
            html[data-learner-theme="light"] .syl-wrow > i[style*="#34d399" i] { background: #16a34a !important; }

            }
        </style>

        ${sylQuietStyle()}

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="syl-desktop-layout lqz-flat-layout" id="syl-desktop-layout">
            <div class="syl-sidebar">
                <div class="syl-lh">
                    <div class="syl-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="syl-desktop-search" id="sylDesktopSearch"
                            placeholder="Filter subjects or topics" oninput="sylDesktopSearch(this.value)">
                    </div>
                    <div class="syl-chips" id="syl-chips"></div>
                </div>
                <div class="syl-sidebar-scroll" id="syl-list" tabindex="0" onkeydown="sylListKeydown(event)"></div>
            </div>
            <div class="syl-split" id="syl-split" role="separator" aria-orientation="vertical" aria-label="Resize subject list" tabindex="0"></div>
            <div class="syl-main-panel lqz-flat-panel" id="syl-main-panel">
                <div class="syl-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <p>Select a subject from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LAYOUT: the quiet list ═══ -->
        <div class="syl-mobile-layout">
            <div class="syl-mobile-head">
                <h1 class="syl-mobile-title">Syllabus</h1>
                <p class="syl-mobile-sub" id="sylMobileSub">${sylMobileSummary(activeTerm, currentTerm, byTerm[activeTerm].length, byTerm[activeTerm].length, '')}</p>
            </div>
            <div class="syl-mobile-search-wrap">
                <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision" aria-hidden="true">
                    <circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"/>
                </svg>
                <input type="text" class="syl-mobile-search" id="sylMobileSearch"
                    placeholder="Search subjects or topics" aria-label="Search subjects or topics" oninput="sylMobileSearch(this.value)">
            </div>
            <div class="syl-mobile-chips" role="group" aria-label="Choose a term">${mobileTabsHtml}</div>
            <div class="syl-mobile-list" id="sylMobileList">
                ${briefs.map((b, idx) => sylMobileRowHtml(b, idx)).join('')}
                <div class="syl-mobile-empty" id="sylMobileSearchEmpty" style="display:none;">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <p class="syl-mobile-empty-title" id="sylMobileSearchEmptyText">No matches</p>
                    <p class="syl-mobile-empty-body">Try a different subject, teacher or topic.</p>
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// PHONE STYLES: the quiet list and detail
// Same calm look as the learner Assignments, Quizzes and Announcements pages: a title with a counts line, a search box,
// term chips, then one plain row per subject; an open subject uses the same detail look as an open assignment. Weights
// stay at 400 (text) and 600 (titles and names). Every colour is a --qm-* token, so light mode is only the token values
// at the end. The list and the detail are separate screens that each replace the page, so both embed this style.
// ─────────────────────────────────────────────
function sylQuietStyle() {
    return `<style>
            @media (min-width: 900px) {
                .syl-mobile-head, .syl-mobile-search-wrap, .syl-mobile-chips, .syl-mobile-list, .syl-mobile-detail { display: none !important; }
            }

            .syl-mobile-head,
            .syl-mobile-search-wrap,
            .syl-mobile-chips,
            .syl-mobile-list,
            .syl-mobile-detail {
                --qm-title: #ecece9;
                --qm-body: #c2c3b7;
                --qm-muted: #8b8b87;
                --qm-faint: #5f605a;
                --qm-line: rgba(255,255,255,0.07);
                --qm-press: rgba(255,255,255,0.04);
                --qm-surf: #272726;
                --qm-ring: #73746d;
                --qm-chipline: rgba(255,255,255,0.12);
                --qm-chipon: #ecece9;
                --qm-chipon-text: #20201f;
            }

            .syl-mobile-head { padding: 4px 2px 0; }
            .syl-mobile-title {
                margin: 0;
                font-family: inherit;
                font-size: 28px;
                font-weight: 600;
                line-height: 1.15;
                letter-spacing: -0.2px;
                color: var(--qm-title);
            }
            .syl-mobile-sub { margin: 5px 0 0; font-size: 14px; line-height: 1.4; font-weight: 400; color: var(--qm-muted); }
            .syl-mobile-sub b { font-weight: 600; color: var(--qm-title); }

            .syl-mobile-list { background: transparent; border-radius: 0; overflow: visible; margin: 8px 0 14px; }
            @media (max-width: 899px) {
                .syl-mobile-list { margin-left: -18px; margin-right: -18px; }
            }

            /* search */
            .syl-mobile-search-wrap { display: block; position: relative; margin: 14px 0 0; }
            .syl-mobile-search-wrap svg {
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: var(--qm-muted);
            }
            .syl-mobile-search {
                width: 100%;
                box-sizing: border-box;
                height: 42px;
                padding: 0 14px 0 42px;
                border: 0;
                border-radius: 12px;
                background: var(--qm-surf);
                color: var(--qm-title);
                font: inherit;
                font-size: 16px; /* 16px stops iOS zooming the page when the box is focused */
                font-weight: 400;
                -webkit-appearance: none;
                appearance: none;
            }
            .syl-mobile-search:focus { outline: none; box-shadow: inset 0 0 0 1px var(--qm-chipline); }
            .syl-mobile-search::placeholder { color: var(--qm-muted); opacity: 1; }

            /* term chips */
            .syl-mobile-chips { display: flex; gap: 6px; margin: 12px 0 0; overflow-x: auto; scrollbar-width: none; }
            .syl-mobile-chips::-webkit-scrollbar { display: none; }
            .syl-mobile-chip {
                flex: none;
                height: 32px;
                padding: 0 10px;
                border-radius: 16px;
                border: 1px solid var(--qm-chipline);
                background: transparent;
                color: var(--qm-muted);
                font: inherit;
                font-size: 13px;
                font-weight: 400;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            .syl-mobile-chip.on { background: var(--qm-chipon); border-color: var(--qm-chipon); color: var(--qm-chipon-text); }
            /* the dot that marks the current term */
            .syl-mobile-cd { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: currentColor; vertical-align: 1px; }

            /* a row: book, subject, one line of detail, arrow. The hairline starts under the title, not under the book. */
            .syl-mobile-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 11px 20px;
                background: transparent;
                cursor: pointer;
                transition: background 0.15s;
                position: relative;
                -webkit-tap-highlight-color: transparent;
            }
            .syl-mobile-row::before {
                content: '';
                position: absolute;
                top: 0;
                left: 58px;
                right: 0;
                height: 1px;
                background: var(--qm-line);
            }
            .syl-mobile-row--first::before { display: none; }
            .syl-mobile-row:active { background: var(--qm-press); }
            .syl-mobile-row:focus-visible { outline: 2px solid var(--qm-chipline); outline-offset: -2px; }
            .syl-mobile-row-icon { flex: none; width: 24px; height: 24px; display: inline-flex; color: var(--qm-ring); }
            .syl-mobile-row-icon svg { width: 24px; height: 24px; }
            .syl-mobile-row-body { flex: 1; min-width: 0; }
            .syl-mobile-row-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.25;
                color: var(--qm-title);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .syl-mobile-row-meta {
                margin-top: 3px;
                font-size: 13px;
                font-weight: 400;
                line-height: 1.3;
                color: var(--qm-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .syl-mobile-row-chevron { flex: none; color: var(--qm-faint); }

            /* no search matches */
            .syl-mobile-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 24px;
                color: var(--qm-muted);
                min-height: 40vh;
            }
            .syl-mobile-empty svg { opacity: 0.5; margin-bottom: 14px; }
            .syl-mobile-empty-title { color: var(--qm-title); font-size: 16px; font-weight: 600; margin: 0 0 6px; }
            .syl-mobile-empty-body { color: var(--qm-muted); font-size: 14px; font-weight: 400; margin: 0; line-height: 1.5; }

            /* ── an open subject: same look as the assignment detail ── */
            .syl-mobile-detail { padding: 8px 20px 96px; }
            @media (max-width: 899px) {
                .syl-mobile-detail { margin-left: -18px; margin-right: -18px; }
            }
            .syl-mobile-detail-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .syl-mobile-detail-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.9px; text-transform: uppercase; color: var(--qm-muted); }
            .syl-mobile-detail-status {
                display: inline-flex;
                align-items: center;
                padding: 4px 10px;
                border-radius: 8px;
                font-size: 12.5px;
                font-weight: 600;
                color: var(--qm-body);
                border: 1px solid var(--qm-chipline);
            }
            .syl-mobile-detail-title {
                margin: 12px 0 0;
                color: var(--qm-title);
                font-family: inherit;
                font-size: 26px;
                line-height: 1.2;
                font-weight: 600;
                letter-spacing: -0.2px;
                overflow-wrap: anywhere;
            }
            .syl-mobile-detail-posted { margin-top: 6px; font-size: 13px; font-weight: 400; color: var(--qm-muted); }
            .syl-mobile-detail-facts { display: grid; grid-template-columns: 1.2fr 1fr; margin-top: 18px; background: var(--qm-surf); border-radius: 18px; }
            .syl-mobile-detail-fact { padding: 14px 16px 15px; min-width: 0; }
            .syl-mobile-detail-fact + .syl-mobile-detail-fact { border-left: 1px solid var(--qm-line); }
            .syl-mobile-detail-fact-label { font-size: 13px; font-weight: 400; color: var(--qm-muted); }
            .syl-mobile-detail-fact-value { margin: 8px 0 3px; font-size: 16px; font-weight: 600; line-height: 1.25; color: var(--qm-title); overflow-wrap: anywhere; }
            .syl-mobile-detail-fact-value--num { margin-top: 6px; font-size: 20px; line-height: 1.15; }
            .syl-mobile-detail-fact-note { font-size: 13px; font-weight: 400; color: var(--qm-muted); }
            .syl-mobile-detail-label { margin: 24px 0 8px 2px; font-size: 13.5px; font-weight: 600; color: var(--qm-muted); }
            .syl-mobile-detail-text { margin: 0; color: var(--qm-body); font-size: 16px; font-weight: 400; line-height: 1.6; overflow-wrap: anywhere; white-space: pre-line; }
            .syl-mobile-detail-text--quiet { color: var(--qm-muted); margin-top: 24px; }

            /* topics: numbered rows with a hairline between them */
            .syl-mobile-topics { list-style: none; margin: 0; padding: 0; }
            .syl-mobile-topics li {
                display: flex;
                gap: 14px;
                padding: 11px 0;
                border-top: 1px solid var(--qm-line);
                font-size: 16px;
                font-weight: 400;
                line-height: 1.4;
                color: var(--qm-body);
                overflow-wrap: anywhere;
            }
            .syl-mobile-topics li:first-child { border-top: 0; padding-top: 2px; }
            .syl-mobile-topics li span { flex: none; width: 22px; padding-top: 2px; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--qm-faint); }

            /* assessment weighting: the type, the percentage, and one thin bar */
            .syl-mobile-assess { padding: 8px 0 10px; border-top: 1px solid var(--qm-line); }
            .syl-mobile-assess:first-child { border-top: 0; padding-top: 2px; }
            .syl-mobile-assess-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
            .syl-mobile-assess-type { min-width: 0; font-size: 16px; font-weight: 400; line-height: 1.4; color: var(--qm-body); overflow-wrap: anywhere; }
            .syl-mobile-assess-weight { flex: none; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--qm-title); }
            .syl-mobile-assess-track { height: 4px; margin-top: 8px; border-radius: 2px; background: var(--qm-chipline); overflow: hidden; }
            .syl-mobile-assess-fill { height: 100%; border-radius: 2px; background: var(--qm-body); }

            /* ═══ Light mode: learner Syllabus (769px to 899px) ═══════════════════════════════════════════════════════
               The split layout starts at 900px, so until then the phone-style list and detail are what show. They are
               drawn from the --qm-* tokens above, so light mode is just the token values below. */
            @media (min-width: 769px) {
                html[data-learner-theme="light"] .syl-mobile-head,
                html[data-learner-theme="light"] .syl-mobile-search-wrap,
                html[data-learner-theme="light"] .syl-mobile-chips,
                html[data-learner-theme="light"] .syl-mobile-list,
                html[data-learner-theme="light"] .syl-mobile-detail {
                    --qm-title: #282924;
                    --qm-body: #4a4b44;
                    --qm-muted: #73746d;
                    --qm-faint: #a3a39a;
                    --qm-line: rgba(40,41,36,.09);
                    --qm-press: rgba(38,39,35,.04);
                    --qm-surf: #f1efe8;
                    --qm-ring: #a3a39a;
                    --qm-chipline: rgba(40,41,36,.16);
                    --qm-chipon: #252624;
                    --qm-chipon-text: #faf9f5;
                }
            }

            /* ═══ Light mode: learner Syllabus (phones) ════════════════════════════════════════════════════════════════
               Phones only (max-width: 768px), switched on by <html data-learner-mobile-theme="light"> (Settings > Appearance,
               set by mobile_theme.js). The page background, header and bottom nav come from the gate in mobile_light.css,
               which lists .syl-mobile-layout (the list and the open subject), .syl-empty (no briefs yet) and .syl-retry-btn
               (the error state) for this page. The list and the detail are drawn from the --qm-* tokens, so this block only
               gives them their light values, the same as the Assignments, Quiz and Announcements pages.
               Dark mode and the desktop layouts are untouched. To remove it, delete this block. */
            @media (max-width: 768px) {

                html[data-learner-mobile-theme="light"] .syl-mobile-head,
                html[data-learner-mobile-theme="light"] .syl-mobile-search-wrap,
                html[data-learner-mobile-theme="light"] .syl-mobile-chips,
                html[data-learner-mobile-theme="light"] .syl-mobile-list,
                html[data-learner-mobile-theme="light"] .syl-mobile-detail {
                    --qm-title: #282924;
                    --qm-body: #4a4b44;
                    --qm-muted: #73746d;
                    --qm-faint: #a3a39a;
                    --qm-line: rgba(40,41,36,.09);
                    --qm-press: rgba(38,39,35,.04);
                    --qm-surf: #f1efe8;
                    --qm-ring: #a3a39a;
                    --qm-chipline: rgba(40,41,36,.16);
                    --qm-chipon: #252624;
                    --qm-chipon-text: #faf9f5;
                }

            }
        </style>`;
}

// ─────────────────────────────────────────────
// PHONE LIST: rows, search, term, and the open subject
// ─────────────────────────────────────────────
window._sylMobTerm = '';
window._sylMobDetail = false;

// The line under the title: which term, whether it is the current one, and how many subjects are showing.
function sylMobileSummary(active, cur, shown, total, term) {
    const count = term ? `${shown} of ${total} subject${total === 1 ? '' : 's'}` : `${total} subject${total === 1 ? '' : 's'}`;
    return `<b>Term ${active}</b> · ${active === cur ? 'Current · ' : ''}${count}`;
}

// One subject: a book, the subject, then the teacher and how many topics. Tapping opens it.
function sylMobileRowHtml(b, idx) {
    const topics = Array.isArray(b.topics) ? b.topics : [];
    const meta = [b.teacher ? sylEsc(b.teacher) : '', topics.length ? `${topics.length} topic${topics.length === 1 ? '' : 's'}` : 'No topics yet']
        .filter(Boolean).join(' · ');
    return `
                <div class="syl-mobile-row" role="button" tabindex="0" data-idx="${idx}" data-term="${sylEsc(b.term)}"
                    onclick="openMobileSyllabusBrief(${idx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileSyllabusBrief(${idx}); }">
                    <div class="syl-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision" aria-hidden="true">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                    </div>
                    <div class="syl-mobile-row-body">
                        <div class="syl-mobile-row-title">${sylEsc(b.subject)}</div>
                        <div class="syl-mobile-row-meta">${meta}</div>
                    </div>
                    <svg class="syl-mobile-row-chevron" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </div>`;
}

// Shows the subjects of the chosen term that match the search box, and keeps the counts line and the empty state in step.
function sylMobileApply() {
    const list = document.getElementById('sylMobileList');
    if (!list) return;
    const briefs = window._sylBriefs || [];
    const active = Number(window._syllabusActiveTerm);
    const cur = Number(window._sylCurrentTerm);
    const term = window._sylMobTerm || '';
    let inTerm = 0, shown = 0;
    list.querySelectorAll('.syl-mobile-row').forEach(row => {
        const b = briefs[Number(row.dataset.idx)];
        if (!b) return;
        const here = Number(b.term) === active;
        if (here) inTerm++;
        const hay = `${b.subject || ''} ${b.teacher || ''} ${(Array.isArray(b.topics) ? b.topics : []).join(' ')}`.toLowerCase();
        const show = here && (!term || hay.includes(term));
        row.style.display = show ? '' : 'none';
        row.classList.toggle('syl-mobile-row--first', show && shown === 0);
        if (show) shown++;
    });
    const sub = document.getElementById('sylMobileSub');
    if (sub) sub.innerHTML = sylMobileSummary(active, cur, shown, inTerm, term);
    const empty = document.getElementById('sylMobileSearchEmpty');
    if (empty) {
        const none = !!term && shown === 0;
        empty.style.display = none ? 'flex' : 'none';
        const label = document.getElementById('sylMobileSearchEmptyText');
        if (label && none) label.textContent = `No matches for "${(document.getElementById('sylMobileSearch')?.value || '').trim()}"`;
    }
    // Rows coming and going change the page's scrollable height without a real scroll event, so the
    // bottom nav and header are re-checked (the same fix the other phone lists use).
    if (typeof window.recalcMobileScrollUI === 'function') [0, 100, 200, 300, 400].forEach(delay => setTimeout(() => window.recalcMobileScrollUI(), delay));
}

window.sylMobileSearch = function (val) {
    if (window.learnerPageState) window.learnerPageState.update('syllabus', { mobileSearch: val });
    window._sylMobTerm = String(val || '').toLowerCase().trim();
    sylMobileApply();
};

// One open subject: the term, the title, when it was updated, who teaches it and how much is in it,
// then the teacher's note, the topics and the assessment weighting.
function sylMobileDetailHtml(b) {
    const topics = Array.isArray(b.topics) ? b.topics : [];
    const assess = Array.isArray(b.assessments) ? b.assessments : [];
    const isCur = Number(b.term) === Number(window._sylCurrentTerm);
    const updated = sylFullDate(b.updated_at);

    const noteHtml = b.notes
        ? `<div class="syl-mobile-detail-label">Note from ${sylEsc(b.teacher)}</div><p class="syl-mobile-detail-text">${sylEsc(b.notes)}</p>` : '';
    const topicsHtml = topics.length
        ? `<div class="syl-mobile-detail-label">Syllabus topics</div><ol class="syl-mobile-topics">${topics.map((t, i) => `<li><span>${i < 9 ? '0' : ''}${i + 1}</span>${sylEsc(t)}</li>`).join('')}</ol>` : '';
    const assessHtml = assess.length
        ? `<div class="syl-mobile-detail-label">Assessment weighting</div><div>${assess.map(a => `
                <div class="syl-mobile-assess">
                    <div class="syl-mobile-assess-row"><span class="syl-mobile-assess-type">${sylEsc(a.type)}</span><span class="syl-mobile-assess-weight">${sylEsc(a.weight)}%</span></div>
                    <div class="syl-mobile-assess-track"><div class="syl-mobile-assess-fill" style="width:${Math.max(0, Math.min(100, Number(a.weight) || 0))}%;"></div></div>
                </div>`).join('')}</div>` : '';
    const emptyHtml = (!noteHtml && !topicsHtml && !assessHtml)
        ? `<p class="syl-mobile-detail-text syl-mobile-detail-text--quiet">No details have been posted for this subject yet.</p>` : '';

    return `${sylQuietStyle()}
        <div class="syl-mobile-layout">
            <article class="syl-mobile-detail">
                <div class="syl-mobile-detail-top">
                    <span class="syl-mobile-detail-eyebrow">Term ${sylEsc(b.term)}</span>
                    ${isCur ? '<span class="syl-mobile-detail-status">Current</span>' : ''}
                </div>
                <h1 class="syl-mobile-detail-title">${sylEsc(b.subject)}</h1>
                ${updated ? `<div class="syl-mobile-detail-posted">Updated ${sylEsc(updated)}</div>` : ''}
                <div class="syl-mobile-detail-facts">
                    <div class="syl-mobile-detail-fact">
                        <div class="syl-mobile-detail-fact-label">Teacher</div>
                        <div class="syl-mobile-detail-fact-value">${sylEsc(b.teacher)}</div>
                    </div>
                    <div class="syl-mobile-detail-fact">
                        <div class="syl-mobile-detail-fact-label">Topics</div>
                        <div class="syl-mobile-detail-fact-value syl-mobile-detail-fact-value--num">${topics.length}</div>
                        <div class="syl-mobile-detail-fact-note">${assess.length} assessment${assess.length === 1 ? '' : 's'}</div>
                    </div>
                </div>
                ${noteHtml}${topicsHtml}${assessHtml}${emptyHtml}
            </article>
        </div>`;
}

window.openMobileSyllabusBrief = function (idx) {
    if (window.innerWidth > 899) return;
    const b = (window._sylBriefs || [])[idx];
    const apiArea = document.getElementById('api-content-area');
    if (!b || !apiArea) return;

    // Keep where the list was scrolled, then stop the scroll listener from saving the detail's scroll over it.
    saveSyllabusPageState();
    window._sylMobDetail = true;

    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');
    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');
    if (mainContent) mainContent.scrollTop = 0;

    sessionStorage.setItem('lastLearnerPage', 'syllabus');
    if (window.configureHeader) {
        window.configureHeader({
            title: b.subject || 'Syllabus', mode: 'detail', detailType: 'Syllabus', backLabel: 'Syllabus',
            backAction: () => window.fetchSyllabus(),
        });
    }
    // detail mode hides the bottom nav; the phone detail screens keep it
    const nav = document.getElementById('mobileBottomNav');
    if (nav) nav.style.setProperty('display', 'flex', 'important');

    apiArea.innerHTML = sylMobileDetailHtml(b);
    if (mainContent) mainContent.scrollTop = 0;
};

// ─────────────────────────────────────────────
// TAB SWITCHER — works for both desktop & mobile
// ─────────────────────────────────────────────
window.switchSylTab = function(term) {
    window._syllabusActiveTerm = term;
    saveSyllabusPageState();
    // ── Desktop list + detail ──
    if (document.getElementById('syl-list')) {
        window._sylTerm = '';
        const searchEl = document.getElementById('sylDesktopSearch');
        if (searchEl) searchEl.value = '';
        window.sylRenderDesktopList();
        window.sylSelectFirst();
    }

    // ── Phone chips and list ──
    document.querySelectorAll('.syl-mobile-chip').forEach(c => {
        const on = Number(c.dataset.term) === Number(term);
        c.classList.toggle('on', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    sylMobileApply();
};


// ─────────────────────────────────────────────
// DESKTOP: list (term chips + search), detail, resize
// ─────────────────────────────────────────────
function sylEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function sylKey(b) { return `${b.term}|${b.subject}|${b.teacher}`; }
function sylFullDate(v) {
    const d = new Date(v);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

window.sylRenderDesktopList = function () {
    const list = document.getElementById('syl-list');
    if (!list) return;
    const keepScroll = list.scrollTop;
    const briefs = window._sylBriefs || [];
    const active = Number(window._syllabusActiveTerm);
    const cur = Number(window._sylCurrentTerm);
    const term = window._sylTerm || '';
    const showActive = !!document.querySelector('#syl-main-panel .syl-dh');

    const terms = [...new Set(briefs.map(b => Number(b.term)))].sort((a, b) => a - b);
    const chipsEl = document.getElementById('syl-chips');
    if (chipsEl) {
        chipsEl.innerHTML = terms.map(t =>
            `<button type="button" class="syl-chip${t === active ? ' on' : ''}" id="syl-chip-${t}" onclick="switchSylTab(${t})">${t === cur ? '<span class="syl-cd"></span>' : ''}Term ${t}</button>`
        ).join('');
    }

    const visible = briefs.map((b, idx) => ({ b, idx })).filter(({ b }) =>
        Number(b.term) === active &&
        (!term || `${b.subject || ''} ${b.teacher || ''} ${(b.topics || []).join(' ')}`.toLowerCase().includes(term))
    );

    let html = `<div class="syl-gh"><span>Term ${active}${active === cur ? ' &middot; Current' : ''}</span><i>${visible.length}</i></div>`;
    visible.forEach(({ b, idx }) => {
        html += `
            <div class="syl-sidebar-item${showActive && idx === window._sylSelectedIdx ? ' active' : ''}" id="syl-sidebar-${idx}" onclick="selectDesktopSyllabusBrief(${idx})">
                <span class="syl-sidebar-dot" aria-hidden="true"></span>
                <div class="syl-sidebar-item-info">
                    <div class="syl-sidebar-item-title">${sylEsc(b.subject)}</div>
                    <div class="syl-sidebar-item-meta">${sylEsc(sylFullDate(b.updated_at))}</div>
                </div>
            </div>`;
    });
    list.innerHTML = visible.length ? html : `<div class="syl-list-empty">No subjects match.</div>`;
    list.scrollTop = keepScroll;
};

window.sylDesktopSearch = function (val) {
    window._sylTerm = String(val || '').toLowerCase().trim();
    window.sylRenderDesktopList();
};

window.sylSelectFirst = function () {
    const first = document.querySelector('#syl-list .syl-sidebar-item');
    if (first) window.selectDesktopSyllabusBrief(parseInt(first.id.replace('syl-sidebar-', ''), 10));
};

window.sylListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const ids = Array.from(document.querySelectorAll('#syl-list .syl-sidebar-item'))
        .map(el => parseInt(el.id.replace('syl-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._sylSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopSyllabusBrief(ids[next]);
    const el = document.getElementById(`syl-sidebar-${ids[next]}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
};

window.sylInitSplit = function () {
    const layout = document.getElementById('syl-desktop-layout');
    const split = document.getElementById('syl-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--syl-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--syl-listw'), 10) || 320;
    const persist = () => { try { localStorage.setItem('lqz.listWidth', String(current())); } catch (e) {} };
    try {
        const saved = parseInt(localStorage.getItem('lqz.listWidth'), 10);
        if (saved) apply(saved);
    } catch (e) {}

    split.addEventListener('mousedown', e => {
        e.preventDefault();
        split.classList.add('drag');
        document.body.style.userSelect = 'none';
        const left = layout.getBoundingClientRect().left;
        const move = ev => apply(ev.clientX - left);
        const up = () => {
            split.classList.remove('drag');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            persist();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
    split.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        apply(current() + (e.key === 'ArrowRight' ? 16 : -16));
        persist();
    });
};

window.sylInitDesktop = function () {
    if (!document.getElementById('syl-list')) return;
    window._sylTerm = '';
    window.sylRenderDesktopList();
    window.sylInitSplit();
    window.sylSelectFirst();
};

window.selectDesktopSyllabusBrief = function (idx) {
    const b = (window._sylBriefs || [])[idx];
    const panel = document.getElementById('syl-main-panel');
    if (!b || !panel) return;
    window._sylSelectedIdx = idx;
    saveSyllabusPageState();
    document.querySelectorAll('.syl-sidebar-item').forEach(el => el.classList.remove('active'));
    const row = document.getElementById(`syl-sidebar-${idx}`);
    if (row) row.classList.add('active');

    const isCur = Number(b.term) === Number(window._sylCurrentTerm);
    const topics = b.topics || [];
    const assess = b.assessments || [];
    const COL = ['#c2c3b7', '#a78bfa', '#f28c38', '#f472b6', '#fdd663', '#34d399'];

    const noteHtml = b.notes
        ? `<div class="syl-note2"><small>Note from ${sylEsc(b.teacher)}</small>${sylEsc(b.notes)}</div>` : '';
    const topicsHtml = topics.length
        ? `<div class="syl-h3">Syllabus topics</div><ul class="syl-tl">${topics.map((t, i) => `<li><span>${i < 9 ? '0' : ''}${i + 1}</span>${sylEsc(t)}</li>`).join('')}</ul>` : '';
    const assessHtml = assess.length
        ? `<div class="syl-h3">Assessment weighting</div>
           <div class="syl-stack">${assess.map((a, i) => `<div style="flex:${Number(a.weight) || 0};background:${COL[i % COL.length]};"></div>`).join('')}</div>
           ${assess.map((a, i) => `<div class="syl-wrow"><i style="background:${COL[i % COL.length]};"></i>${sylEsc(a.type)}<b>${sylEsc(a.weight)}%</b></div>`).join('')}` : '';
    const empty = (!noteHtml && !topicsHtml && !assessHtml) ? `<p class="syl-lead">No details have been posted for this subject yet.</p>` : '';

    const others = (window._sylBriefs || [])
        .map((x, i) => ({ x, i }))
        .filter(({ x, i }) => i !== idx && Number(x.term) === Number(b.term))
        .slice(0, 4)
        .map(({ x, i }) => `<button type="button" class="syl-more" onclick="selectDesktopSyllabusBrief(${i})"><b>${sylEsc(x.subject)}</b><small>${sylEsc(x.teacher)}</small></button>`)
        .join('');

    panel.innerHTML = `
        <div class="syl-dh">
            <h2 class="syl-dh-title">${sylEsc(b.subject)}</h2>
            <span class="syl-panel-status">Term ${sylEsc(b.term)}</span>
            ${isCur ? '<span class="syl-panel-status syl-panel-status--cur">Current</span>' : ''}
            <span class="syl-dsp"></span>
            <span class="syl-muted">Updated ${sylEsc(sylFullDate(b.updated_at))}</span>
        </div>
        <div class="syl-dbody">
            <div class="syl-body"><div class="syl-read">${noteHtml}${topicsHtml}${assessHtml}${empty}</div></div>
            <aside class="syl-rail">
                <h4>Details</h4>
                <div class="syl-kv"><span>Teacher</span><b>${sylEsc(b.teacher)}</b></div>
                <div class="syl-kv"><span>Term</span><b>Term ${sylEsc(b.term)}${isCur ? ' (current)' : ''}</b></div>
                <div class="syl-kv"><span>Topics</span><b>${topics.length}</b></div>
                <div class="syl-kv"><span>Assessments</span><b>${assess.length}</b></div>
                <div class="syl-kv"><span>Updated</span><b>${sylEsc(sylFullDate(b.updated_at))}</b></div>
                ${others ? `<h4 class="syl-rail-sub">Other subjects in Term ${sylEsc(b.term)}</h4>${others}` : ''}
            </aside>
        </div>`;

    const listBox = document.getElementById('syl-list');
    if (listBox && row) {
        const top = row.offsetTop, bottom = top + row.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }
    if (window.learnerPageState) wireSyllabusScrollState();
};

// Desktop type is Geist 300/400/500 (see the desktop block of the inline CSS above). Nunito stays loaded for the mobile views.
function sylEnsureFont() {
    if (!document.getElementById('syl-geist-font')) {
        const g = document.createElement('link');
        g.id = 'syl-geist-font';
        g.rel = 'stylesheet';
        g.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap';
        document.head.appendChild(g);
    }
    if (document.getElementById('syl-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'syl-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}