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
        window.configureHeader({ title: 'Syllabus', mode: 'standard' });
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
        restoreSyllabusPageState();

    } catch (err) {
        if (!isCurrentNavigation()) return;
        console.error('Syllabus fetch error:', err);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center;margin-top:60px;padding:20px;">
                    <p style="color:#ff5555;">Unable to load syllabus.</p>
                    <button onclick="window.syllabusCache=null; fetchSyllabus()"
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
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.syl-sidebar-scroll');
    const panel = document.querySelector('.syl-body');
    const state = {
        activeTerm:  window._syllabusActiveTerm ?? null,
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
            <div style="text-align:center;margin-top:80px;padding:20px;">
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

    // ── Mobile: term tabs ──
    const mobileTabsHtml = terms.map(t => `
        <button class="syl-tab ${t === activeTerm ? 'syl-tab-active' : ''}"
                onclick="switchSylTab(${t})"
                id="syl-mob-tab-${t}">
            Term ${t} ${t === currentTerm ? '<span class="syl-current-badge">Current</span>' : ''}
        </button>`).join('');

    return `
        <style>
            /* ══════════════════════════════════════════
               DESKTOP SPLIT LAYOUT  (≥ 900px)
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
                /* Type weights for the whole desktop page. Tune here. */
                --syl-w-strong: 700;  /* title, status chip, group labels, primary button */
                --syl-w-medium: 600;  /* list rows, filter chips, values, small actions */
                display: flex;
                gap: 0;
                min-height: 500px;
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
                background: #12161c;
                border-right: 1px solid rgba(255,255,255,0.07);
            }
            .syl-lh {
                padding: 12px 12px 10px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-shrink: 0;
            }
            .syl-desktop-search-wrap { position: relative; }
            .syl-desktop-search-wrap svg {
                position: absolute;
                left: 11px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: #7d8794;
            }
            .syl-desktop-search {
                width: 100%;
                box-sizing: border-box;
                height: 34px;
                padding: 0 10px 0 33px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.07);
                color: #e6edf3;
                font-size: 13px;
                font-family: 'Nunito', sans-serif;
                transition: border-color 0.2s;
            }
            .syl-desktop-search:focus { outline: none; border-color: #4fd1c5; }
            .syl-desktop-search::placeholder { color: #7d8794; }
            .syl-chips { display: flex; gap: 6px; margin-top: 10px; overflow: hidden; }
            .syl-chip {
                height: 26px;
                padding: 0 10px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.07);
                background: none;
                color: #9aa4b2;
                font-family: inherit;
                font-size: 12px;
                font-weight: var(--syl-w-medium, 600);
                white-space: nowrap;
                cursor: pointer;
            }
            .syl-chip:hover { color: #e6edf3; }
            .syl-chip.on {
                background: rgba(79,209,197,0.1);
                border-color: rgba(79,209,197,0.4);
                color: #4fd1c5;
            }
            .syl-sidebar-scroll {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                position: relative;
                outline: none;
            }
            .syl-sidebar-scroll:focus-visible { outline: 2px solid #4fd1c5; outline-offset: -2px; }
            .syl-sidebar-scroll::-webkit-scrollbar { width: 8px; }
            .syl-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .syl-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; transition: background 0.15s ease; }
            .syl-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            .syl-gh {
                position: sticky;
                top: 0;
                z-index: 1;
                background: #12161c;
                font-size: 11px;
                font-weight: var(--syl-w-strong, 700);
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: #7d8794;
                padding: 12px 14px 6px;
            }
            .syl-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                height: 52px;
                padding: 0 14px;
                cursor: pointer;
                border-left: 3px solid transparent;
            }
            .syl-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .syl-sidebar-item.active {
                background: rgba(79,209,197,0.1);
                border-left-color: #4fd1c5;
            }
            .syl-sidebar-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .syl-sidebar-item-info { flex: 1; min-width: 0; }
            .syl-sidebar-item-title {
                font-size: 13px;
                font-weight: var(--syl-w-medium, 600);
                color: #e6edf3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .syl-sidebar-item-meta {
                font-size: 12px;
                color: #7d8794;
                margin-top: 1px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .syl-row-badge { font-size: 12px; font-weight: var(--syl-w-medium, 600); flex-shrink: 0; }
            /* the selected row keeps one step more weight so it still reads as current */
            .syl-sidebar-item.active .syl-sidebar-item-title { font-weight: var(--syl-w-strong, 700); }
            .syl-list-empty { padding: 40px 20px; text-align: center; color: #7d8794; font-size: 13px; }

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
                color: #555e6a;
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
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-shrink: 0;
            }

            .syl-dh, .syl-dh *, .syl-dh *::before, .syl-dh *::after { box-sizing: border-box; }
            /* id prefix so a host-level #api-content-area h2 rule cannot recolour the title */
            #syl-main-panel .syl-dh-title {
                margin: 0;
                min-width: 0;
                font-family: inherit;
                font-size: 18px;
                font-weight: var(--syl-w-strong, 700);
                line-height: 1.25;
                color: #e6edf3;
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
                border: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: var(--syl-w-strong, 700);
                line-height: 1;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                white-space: nowrap;
                color: #9aa4b2;
            }
            .syl-panel-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .syl-dsp { flex: 1; }
            .syl-act-text { font-weight: var(--syl-w-medium, 600); font-size: 13px; flex-shrink: 0; }
            .syl-pri {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                height: 34px;
                padding: 0 18px;
                border-radius: 8px;
                background: #4fd1c5;
                color: #0d1117;
                font-weight: var(--syl-w-strong, 700);
                font-size: 13px;
                text-decoration: none;
                flex-shrink: 0;
                cursor: pointer;
            }
            .syl-pri:hover { background: #38b2ac; }
            .syl-pri--warn { background: #e67e22; }
            .syl-pri--warn:hover { background: #d06f1c; }
            .syl-dbody { flex: 1; min-height: 0; display: flex; }
            .syl-body { flex: 1; min-width: 0; overflow-y: auto; padding: 28px; }
            .syl-body::-webkit-scrollbar { width: 8px; }
            .syl-body::-webkit-scrollbar-track { background: transparent; }
            .syl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            .syl-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            .syl-read { max-width: 760px; }
            .syl-lead { color: #c9d1d9; line-height: 1.7; margin: 0 0 20px; font-size: 14px; }

            /* ── Context rail (hides when the detail pane is under 900px wide) ── */
            .syl-rail {
                width: 280px;
                flex-shrink: 0;
                border-left: 1px solid rgba(255,255,255,0.07);
                padding: 24px 20px;
                overflow-y: auto;
            }
            .syl-rail h4 {
                margin: 0 0 14px;
                font-size: 12px;
                font-weight: var(--syl-w-strong, 700);
                letter-spacing: 0.6px;
                text-transform: uppercase;
                color: #7d8794;
            }
            .syl-kv {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 13px;
            }
            .syl-kv span { color: #9aa4b2; }
            .syl-kv b { font-weight: var(--syl-w-medium, 600); text-align: right; color: #e6edf3; }
            @container (max-width: 899px) { .syl-rail { display: none; } }

            /* ── Syllabus: rows, topics, assessment bar, rail ── */
            .syl-chips { flex-wrap: wrap; row-gap: 6px; overflow: visible; }
            .syl-chip .syl-cd { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4fd1c5; margin-right: 6px; vertical-align: 1px; }
            .syl-gh { display: flex; justify-content: space-between; }
            .syl-gh i { font-style: normal; font-weight: var(--syl-w-medium, 600); color: #7d8794; }
            .syl-ft {
                width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center;
                font-size: 11px; font-weight: var(--syl-w-strong, 700); background: rgba(79,209,197,0.1); color: #4fd1c5;
            }
            .syl-tm { font-size: 12px; color: #7d8794; flex-shrink: 0; }
            .syl-muted { color: #7d8794; font-size: 13px; flex-shrink: 0; }
            .syl-panel-status--cur { background: rgba(79,209,197,0.1); border-color: rgba(79,209,197,0.35); color: #4fd1c5; }
            .syl-note2 {
                border-left: 3px solid rgba(79,209,197,0.4); background: rgba(255,255,255,0.03); border-radius: 8px;
                padding: 12px 14px; color: #c9d1d9; line-height: 1.65; font-size: 14px; margin-bottom: 8px; white-space: pre-line;
            }
            .syl-note2 small { display: block; font-size: 11px; font-weight: var(--syl-w-strong, 700); letter-spacing: 0.6px; text-transform: uppercase; color: #7d8794; margin-bottom: 4px; }
            .syl-h3 { font-size: 12px; font-weight: var(--syl-w-strong, 700); letter-spacing: 0.6px; text-transform: uppercase; color: #7d8794; margin: 26px 0 10px; }
            .syl-tl { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0 28px; }
            .syl-tl li { display: flex; gap: 14px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 14px; color: #c9d1d9; }
            .syl-tl li span { color: #7d8794; font-weight: var(--syl-w-strong, 700); font-size: 12px; width: 18px; flex-shrink: 0; padding-top: 2px; }
            .syl-stack { display: flex; height: 10px; border-radius: 5px; overflow: hidden; gap: 2px; margin: 4px 0 14px; }
            .syl-wrow { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 14px; color: #c9d1d9; }
            .syl-wrow i { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
            .syl-wrow b { margin-left: auto; font-weight: var(--syl-w-strong, 700); }
            .syl-more {
                display: block; width: 100%; text-align: left; padding: 9px 0; cursor: pointer;
                background: none; border: 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: inherit;
            }
            .syl-more b { display: block; font-size: 13px; font-weight: var(--syl-w-medium, 600); color: #e6edf3; }
            .syl-more small { color: #7d8794; font-size: 12px; }
            .syl-more:hover b { color: #4fd1c5; }
            .syl-rail h4.syl-rail-sub { margin: 28px 0 4px; }


            /* ══════════════════════════════════════════
               SHARED STYLES
               ══════════════════════════════════════════ */

            /* Mobile wrapper */
            .syl-wrapper {
                max-width: 900px;
                margin: 0 auto;
                padding: 0 0 24px 0;
            }
            .syl-page-title {
                font-size: 20px;
                font-weight: 900;
                color: #e2e8f0;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            /* Mobile tabs */
            .syl-tabs {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 24px;
            }
            .syl-tab {
                padding: 8px 16px;
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,0.1);
                background: transparent;
                color: #8b949e;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .syl-tab:hover { border-color: #4fd1c5; color: #4fd1c5; }
            .syl-tab-active {
                background: rgba(79,209,197,0.15);
                border-color: #4fd1c5;
                color: #4fd1c5;
            }
            .syl-current-badge {
                background: rgba(79,209,197,0.2);
                color: #4fd1c5;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: 800;
            }

            /* Cards grid — used by both layouts */
            .syl-cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 16px;
            }

            /* Brief card */
            .syl-card {
                background: #1a1919;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 16px;
                padding: 20px;
                transition: border-color 0.2s ease;
            }
            .syl-card:hover { border-color: rgba(79,209,197,0.3); }

            /* Mobile: match the home page box treatment — flat colour, no border */
            @media (max-width: 899px) {
                .syl-card {
                    background: #272726;
                    border: none;
                }
                .syl-card:hover {
                    border-color: transparent;
                }
            }
            .syl-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 16px;
            }
            .syl-subject {
                font-size: 16px;
                font-weight: 900;
                color: #e2e8f0;
                line-height: 1.3;
            }
            .syl-teacher {
                font-size: 12px;
                color: #8b949e;
                margin-top: 3px;
                font-weight: 600;
            }
            .syl-updated {
                font-size: 11px;
                color: #8b949e;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .syl-section-title {
                font-size: 11px;
                font-weight: 800;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin: 14px 0 8px;
            }
            .syl-topics {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .syl-topics li {
                font-size: 13px;
                color: #c9d1d9;
                padding: 5px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
            }
            .syl-topics li:last-child { border-bottom: none; }
            .syl-topics li::before {
                content: '';
                width: 5px; height: 5px;
                border-radius: 50%;
                background: #4fd1c5;
                flex-shrink: 0;
            }
            .syl-assess-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .syl-assess-row:last-child { border-bottom: none; }
            .syl-assess-type { font-size: 13px; color: #c9d1d9; font-weight: 600; }
            .syl-assess-weight { font-size: 13px; font-weight: 900; color: #4fd1c5; }
            .syl-assess-bar-wrap {
                width: 100%; height: 3px;
                background: rgba(255,255,255,0.06);
                border-radius: 2px;
                margin-top: 4px;
                overflow: hidden;
            }
            .syl-assess-bar { height: 100%; border-radius: 2px; background: #4fd1c5; }
            .syl-notes {
                font-size: 12px;
                color: #8b949e;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                padding: 10px 12px;
                margin-top: 14px;
                line-height: 1.5;
                border-left: 3px solid rgba(79,209,197,0.3);
            }

            @media (max-width: 480px) {
                .syl-cards-grid { grid-template-columns: 1fr; }
                .syl-wrapper { padding: 16px 14px; }
            }
        </style>

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

        <!-- ═══ MOBILE LAYOUT (unchanged) ═══ -->
        <div class="syl-mobile-layout">
            <div class="syl-wrapper">
                <div class="syl-page-title">
                    <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5"
                         stroke-width="2" fill="none">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        <line x1="12" y1="6" x2="16" y2="6"/>
                        <line x1="12" y1="10" x2="16" y2="10"/>
                        <line x1="12" y1="14" x2="16" y2="14"/>
                    </svg>
                    Subject Briefs & Outlines
                </div>

                <div class="syl-tabs">${mobileTabsHtml}</div>

                ${terms.map(t => `
                    <div class="syl-mob-panel" id="syl-mob-panel-${t}"
                         style="display:${t === activeTerm ? 'block' : 'none'};">
                        <div class="syl-cards-grid">
                            ${byTerm[t].map(b => renderBriefCard(b)).join('')}
                        </div>
                    </div>`).join('')}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// RENDER SINGLE BRIEF CARD
// ─────────────────────────────────────────────
function renderBriefCard(brief) {
    const updatedDate = new Date(brief.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    });

    const topicsHtml = brief.topics.length
        ? `<div class="syl-section-title">Syllabus Topics</div>
           <ul class="syl-topics">
               ${brief.topics.map(t => `<li>${t}</li>`).join('')}
           </ul>`
        : '';

    const barColours = ['#4fd1c5', '#a78bfa', '#f28c38', '#f472b6', '#fdd663', '#34d399'];
    const assessHtml = brief.assessments.length
        ? `<div class="syl-section-title">Assessment Weighting</div>
           ${brief.assessments.map((a, i) => {
               const colour = barColours[i % barColours.length];
               return `
                   <div class="syl-assess-row">
                       <span class="syl-assess-type">${a.type}</span>
                       <span class="syl-assess-weight" style="color:${colour};">${a.weight}%</span>
                   </div>
                   <div class="syl-assess-bar-wrap">
                       <div class="syl-assess-bar" style="width:${a.weight}%;background:${colour};"></div>
                   </div>`;
           }).join('')}`
        : '';

    const notesHtml = brief.notes
        ? `<div class="syl-notes">📝 ${brief.notes}</div>`
        : '';

    return `
        <div class="syl-card">
            <div class="syl-card-header">
                <div>
                    <div class="syl-subject">${brief.subject}</div>
                    <div class="syl-teacher">${brief.teacher}</div>
                </div>
                <div class="syl-updated">${updatedDate}</div>
            </div>
            ${topicsHtml}
            ${assessHtml}
            ${notesHtml}
        </div>`;
}

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

    // ── Mobile panels ──
    document.querySelectorAll('.syl-mob-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.syl-tab').forEach(t => t.classList.remove('syl-tab-active'));
    const mobPanel = document.getElementById(`syl-mob-panel-${term}`);
    const mobTab   = document.getElementById(`syl-mob-tab-${term}`);
    if (mobPanel) mobPanel.style.display = 'block';
    if (mobTab)   mobTab.classList.add('syl-tab-active');
};


// ─────────────────────────────────────────────
// DESKTOP: list (term chips + search), detail, resize
// ─────────────────────────────────────────────
function sylEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function sylKey(b) { return `${b.term}|${b.subject}|${b.teacher}`; }
function sylAbbr(subject) {
    const w = String(subject || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function sylShortDate(v) {
    const d = new Date(v);
    return isNaN(d) ? '' : d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' });
}
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
        const n = (b.topics || []).length;
        html += `
            <div class="syl-sidebar-item${showActive && idx === window._sylSelectedIdx ? ' active' : ''}" id="syl-sidebar-${idx}" onclick="selectDesktopSyllabusBrief(${idx})">
                <span class="syl-ft">${sylEsc(sylAbbr(b.subject))}</span>
                <div class="syl-sidebar-item-info">
                    <div class="syl-sidebar-item-title">${sylEsc(b.subject)}</div>
                    <div class="syl-sidebar-item-meta">${sylEsc(b.teacher)} &middot; ${n} topic${n === 1 ? '' : 's'}</div>
                </div>
                <span class="syl-tm">${sylEsc(sylShortDate(b.updated_at))}</span>
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
    const COL = ['#4fd1c5', '#a78bfa', '#f28c38', '#f472b6', '#fdd663', '#34d399'];

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

// Nunito 400/600/700 for the desktop syllabus page. 600 is the medium weight, so load it
// explicitly instead of letting the browser quietly fall back to 700 (or 400).
function sylEnsureFont() {
    if (document.getElementById('syl-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'syl-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}