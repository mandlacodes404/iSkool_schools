function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
/* assets/js/evaluations.js */
window.evaluationCache          = null;
window.evaluationPrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchEvaluations = function () {
    if (window.evaluationCache) return;
    if (window.evaluationPrefetchPromise) return;
    window.evaluationPrefetchPromise = fetch('api/learner/get_evaluations.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.evaluationCache = data; })
        .catch(() => {})
        .finally(() => { window.evaluationPrefetchPromise = null; });
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveEvaluationPageState() {
    const sidebar = document.querySelector('.lev-sidebar-scroll');
    const mainContent = document.querySelector('.main-content');
    const state = {
        selectedIdx:   window._learnerEvaluationSelectedIdx ?? null,
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        mobileSearch: document.getElementById('levMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lev-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        openDesktopGroups: Array.from(document.querySelectorAll('.lev-desktop-teacher-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('evaluations', state);
    else sessionStorage.setItem('evaluationPageState', JSON.stringify(state));
}

function wireEvaluationScrollState() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent || mainContent.dataset.levScrollWired === '1') return;
    mainContent.dataset.levScrollWired = '1';
    mainContent.addEventListener('scroll', () => {
        saveEvaluationPageState();
    }, { passive: true });
}

function restoreEvaluationPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('evaluations')
            : JSON.parse(sessionStorage.getItem('evaluationPageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('levMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.levMobileSearch(state.mobileSearch);
                }
            }
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.lev-mobile-folder-body').forEach(body => {
                    const open = state.openFolders.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const chev = body.previousElementSibling?.querySelector('.lev-mobile-folder-chevron');
                    if (chev) chev.classList.toggle('open', open);
                });
            }
            if (Array.isArray(state.openDesktopGroups)) {
                document.querySelectorAll('.lev-desktop-teacher-body').forEach(body => {
                    const open = state.openDesktopGroups.includes(body.id);
                    body.classList.toggle('collapsed', !open);
                    const header = body.previousElementSibling;
                    const chevron = header ? header.querySelector('.lev-desktop-teacher-chevron') : null;
                    if (chevron) chevron.classList.toggle('open', open);
                });
            }
            if (state.selectedIdx !== null && state.selectedIdx !== undefined) {
                window.selectDesktopLearnerEvaluation(state.selectedIdx);
                const sidebar = document.querySelector('.lev-sidebar-scroll');
                if (sidebar) sidebar.scrollTop = state.sidebarScroll || 0;
            }
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            wireEvaluationScrollState();
        });
    } catch (e) { /* ignore bad state */ }
}

window.fetchEvaluations = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    
    sessionStorage.setItem("lastLearnerPage", "evaluation_list.php");

    if (typeof window.setActive === 'function') {
        window.setActive("evaluation_list.php");
    }

    if (window.configureHeader) {
        window.configureHeader({ title: 'Evaluations', mode: 'standard', color: '#4fa8fd' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';

    // Inject CSS
    const evalStyleHref = 'assets/css/learner/evaluations.css?v=2.7';
    const existingEvalStyle = document.getElementById('eval-style');
    if (existingEvalStyle) {
        existingEvalStyle.href = evalStyleHref;
    } else {
        const link = document.createElement('link');
        link.id = 'eval-style'; link.rel = 'stylesheet'; link.href = evalStyleHref;
        document.head.appendChild(link);
    }

    // 4. If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.evaluationPrefetchPromise) {
        await window.evaluationPrefetchPromise;
    }

    // 4. FIXED CACHE CHECK
    if (window.evaluationCache) {
        renderEvaluationsUI(window.evaluationCache); // Call the correct internal function
        restoreEvaluationPageState();
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_evaluations.php');
        const data = await response.json();
        window.evaluationCache = data; 
        renderEvaluationsUI(data); // Call the helper function here too
        restoreEvaluationPageState();
    } catch (e) {
        apiArea.innerHTML = "<p style='text-align:center; color:red;'>Error loading evaluations.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// GROUP FLAT LIST BY TEACHER
// The API returns a flat array (each item carries its own `teacher`
// string), already ordered newest-created-first via the SQL query.
// We group client-side and keep that same first-appearance order for
// the teacher folders, so the most recently active teacher surfaces
// first — same end result as the pre-grouped assignments/announcements
// endpoints, without needing a timestamp field.
// ─────────────────────────────────────────────
function getGroupedLearnerEvaluationEntries(data) {
    const order = [];
    const map = {};
    (data || []).forEach(evaluation => {
        const teacher = evaluation.teacher || 'Teacher';
        if (!map[teacher]) {
            map[teacher] = [];
            order.push(teacher);
        }
        map[teacher].push(evaluation);
    });
    return order.map(teacher => ({ teacher, evaluations: map[teacher] }));
}

// New Helper Function to handle the actual HTML building
function renderEvaluationsUI(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Handle special / empty states ──
    if (data && data.status === 'no_class') {
        apiArea.innerHTML = '<p style="text-align:center;">You are not enrolled in a class yet.</p>';
        return;
    }
    if (!data || data.length === 0) {
        apiArea.innerHTML = '<p style="text-align:center;">No active evaluations at the moment.</p>';
        return;
    }

    // ── Group by teacher, build flat list for desktop/mobile panel lookup ──
    const teacherEntries = getGroupedLearnerEvaluationEntries(data);

    window._allLearnerEvaluationsFlat = [];
    teacherEntries.forEach(({ evaluations }) => {
        evaluations.forEach(evaluation => {
            window._allLearnerEvaluationsFlat.push(evaluation);
        });
    });

    // ── Build sidebar HTML (desktop, grouped by teacher) ──
    let sidebarHtml = '';
    let flatIdx = 0;
    let desktopGroupIdx = 0;
    teacherEntries.forEach(({ teacher, evaluations }) => {
        const groupId = `lev-dg-${desktopGroupIdx++}`;
        sidebarHtml += `
            <div class="lev-desktop-teacher-group">
                <button type="button" class="lev-desktop-teacher-header" onclick="toggleLevDesktopGroup('${groupId}', this)">
                    <svg class="lev-desktop-teacher-chevron" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="lev-desktop-teacher-folder-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="lev-desktop-teacher-name">${escapeLearnerEvaluationHtml(teacher)}</span>
                    <span class="lev-desktop-teacher-count">${evaluations.length}</span>
                </button>
                <div class="lev-desktop-teacher-body collapsed" id="${groupId}">`;
        evaluations.forEach(evaluation => {
            sidebarHtml += `
                <div class="lev-sidebar-item" id="lev-sidebar-${flatIdx}"
                    data-title="${escapeLearnerEvaluationHtml(evaluation.title || '').toLowerCase()}"
                    onclick="selectDesktopLearnerEvaluation(${flatIdx})">
                    <div class="lev-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fa8fd" stroke-width="2" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                    </div>
                    <div class="lev-sidebar-item-info">
                        <div class="lev-sidebar-item-title">${escapeLearnerEvaluationHtml(evaluation.title || 'Evaluation')}</div>
                        <div class="lev-sidebar-item-meta">by ${escapeLearnerEvaluationHtml(evaluation.teacher || 'Teacher')}</div>
                    </div>
                    ${evaluation.submitted
                        ? '<span class="lev-sidebar-done-badge">Done</span>'
                        : '<span class="lev-sidebar-pending-dot"></span>'}
                </div>`;
            flatIdx++;
        });
        sidebarHtml += `</div></div>`;
    });

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lev-desktop-layout { display: flex !important; }
                .lev-mobile-list    { display: none !important; }
                .lev-mobile-search-wrap { display: none !important; }
            }
            @media (max-width: 899px) {
                .lev-desktop-layout { display: none !important; }
                .lev-mobile-list    { display: block !important; }
            }

            .lev-desktop-layout {
                display: flex;
                gap: 0;
                min-height: 500px;
            }

            .lev-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lev-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lev-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lev-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lev-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lev-desktop-teacher-group { border-bottom: 1px solid rgba(255,255,255,0.04); }
            .lev-desktop-teacher-header {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                background: transparent;
                border: 0;
                color: #8b949e;
                cursor: pointer;
                font-family: inherit;
                text-align: left;
            }
            .lev-desktop-teacher-header:hover { background: rgba(255,255,255,0.03); color: #c9d1d9; }
            .lev-desktop-teacher-chevron { flex-shrink: 0; transition: transform 0.2s ease; }
            .lev-desktop-teacher-chevron.open { transform: rotate(90deg); }
            .lev-desktop-teacher-folder-icon { flex-shrink: 0; opacity: 0.85; }
            .lev-desktop-teacher-name {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
            }
            .lev-desktop-teacher-count {
                flex-shrink: 0;
                font-size: 10px;
                font-weight: 800;
                color: #4fa8fd;
                background: rgba(79,168,253,0.1);
                border: 1px solid rgba(79,168,253,0.25);
                border-radius: 999px;
                padding: 1px 7px;
            }
            .lev-desktop-teacher-body.collapsed { display: none; }
            .lev-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lev-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lev-sidebar-item.active {
                background: rgba(79,168,253,0.08);
                border-left-color: #4fa8fd;
            }
            .lev-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .lev-sidebar-item-info { flex: 1; min-width: 0; }
            .lev-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lev-sidebar-item.active .lev-sidebar-item-title { color: #e2e8f0; }
            .lev-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .lev-sidebar-done-badge {
                background: rgba(34,197,94,0.1);
                color: #22c55e;
                border: 1px solid rgba(34,197,94,0.3);
                font-size: 10px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 6px;
                flex-shrink: 0;
            }
            .lev-sidebar-pending-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                background: #e67e22;
                flex-shrink: 0;
            }

            .lev-main-panel {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lev-main-panel::-webkit-scrollbar { width: 5px; }
            .lev-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lev-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lev-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lev-panel-empty svg { opacity: 0.3; }
            .lev-panel-empty p { font-size: 14px; margin: 0; }

            .lev-panel-content { padding: 28px 32px; overflow-y: auto; }

            /* Author row (mirrors mobile detail) */
            .lev-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lev-panel-author-row {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 14px;
            }
            .lev-panel-avatar {
                flex: 0 0 auto;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 1px solid rgba(79,168,253,0.35);
                background: rgba(79,168,253,0.1);
                color: #4fa8fd;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
                font-weight: 800;
                letter-spacing: 0.2px;
            }
            .lev-panel-author-info { min-width: 0; }
            .lev-panel-author-name {
                color: #e2e8f0;
                font-size: 16px;
                font-weight: 700;
                line-height: 1.3;
                overflow-wrap: anywhere;
            }
            .lev-panel-author-role {
                color: #8b949e;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-top: 2px;
            }
            .lev-panel-role-badge { color: #4fa8fd; }
            .lev-panel-role-sep { color: #5a6472; margin: 0 6px; }
            .lev-panel-posted {
                color: #8b949e;
                font-size: 12px;
                margin-top: 4px;
            }
            .lev-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0;
                line-height: 1.28;
            }

            /* ── MOBILE LIST STYLES (flat, no card wrapper) ── */
            .lev-mobile-list {
                background: transparent;
                border-radius: 0;
                overflow: visible;
                margin: 0 0 14px;
            }
            @media (max-width: 899px) {
                .lev-mobile-list {
                    margin-left: -18px;
                    margin-right: -18px;
                }
            }
            .lev-mobile-folder-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 18px;
                background: transparent;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                cursor: pointer;
                user-select: none;
                transition: background 0.2s;
            }
            .lev-mobile-folder-header:active { background: rgba(255,255,255,0.03); }
            .lev-mobile-folder-icon { flex-shrink: 0; }
            .lev-mobile-folder-name {
                flex: 1;
                font-size: 16px;
                font-weight: 800;
                color: #e2e8f0;
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lev-mobile-folder-count {
                font-size: 12px;
                color: #8b949e;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                padding: 2px 8px;
                border-radius: 20px;
                flex-shrink: 0;
            }
            .lev-mobile-folder-chevron {
                flex-shrink: 0;
                color: #555e6a;
                transition: transform 0.3s ease;
            }
            .lev-mobile-folder-chevron.open { transform: rotate(90deg); }
            .lev-mobile-folder-body { display: block; }
            .lev-mobile-folder-body.collapsed { display: none; }
            .lev-mobile-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 13px 18px;
                background: transparent;
                border-bottom: 0;
                border-radius: 0;
                border-left: 0;
                border-right: 0;
                cursor: pointer;
                transition: background 0.15s;
                position: relative;
            }
            .lev-mobile-row::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 18px;
                right: 18px;
                height: 1px;
                background: rgba(255,255,255,0.06);
            }
            .lev-mobile-row:last-child::after { display: none; }
            .lev-mobile-row:active { background: rgba(255,255,255,0.03); }
            .lev-mobile-row-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: #4fa8fd18;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .lev-mobile-row-body { flex: 1; min-width: 0; }
            .lev-mobile-row-title {
                font-size: 15px;
                font-weight: 700;
                color: #e2e8f0;
                margin: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lev-mobile-row-title-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .lev-mobile-row-meta {
                font-size: 11px;
                color: #555e6a;
                margin-top: 2px;
            }
            .lev-mobile-row-chevron {
                flex-shrink: 0;
                color: #555e6a;
            }

            /* ── MOBILE SEARCH BAR ── */
            @media (max-width: 899px) {
                .lev-mobile-search-wrap {
                    display: block;
                    margin-bottom: 10px;
                    position: relative;
                }
                .lev-mobile-search-wrap svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    opacity: 0.4;
                }
                .lev-mobile-search {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 9px 14px 9px 36px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.05);
                    border: none;
                    color: #e2e8f0;
                    font-size: 15px;
                    font-family: 'Nunito', sans-serif;
                    transition: background 0.2s;
                }
                .lev-mobile-search:focus { outline: none; background: rgba(255,255,255,0.08); }
                .lev-mobile-search::placeholder { color: #555e6a; }
            }

            /* ── DESKTOP SEARCH BAR ── */
            .lev-desktop-search-wrap {
                display: none;
                position: relative;
                padding: 10px 10px 8px;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .lev-desktop-search-wrap svg {
                position: absolute;
                left: 22px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                opacity: 0.4;
            }
            .lev-desktop-search {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 12px 8px 32px;
                border-radius: 8px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                color: #e2e8f0;
                font-size: 12.5px;
                font-family: 'Nunito', sans-serif;
                transition: border-color 0.2s;
            }
            .lev-desktop-search:focus { outline: none; border-color: #4fa8fd; }
            .lev-desktop-search::placeholder { color: #555e6a; }
            @media (min-width: 900px) {
                .lev-desktop-search-wrap { display: block; }
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lev-desktop-layout lqz-flat-layout">
            <div class="lev-sidebar lqz-flat-sidebar">
                <div class="lev-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" class="lev-desktop-search" id="levDesktopSearch"
                        placeholder="Search evaluations..." oninput="levDesktopSearch(this.value)">
                </div>
                <div class="lev-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                <div class="lev-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fa8fd" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p>Select an evaluation from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    if (teacherEntries.length > 0) {
        html += `
        <div class="lev-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lev-mobile-search" id="levMobileSearch"
                placeholder="Search evaluations..." oninput="levMobileSearch(this.value)">
        </div>`;
    }

    html += `<div class="lev-mobile-list">`;

    let mobileFlatIdx = 0;
    let mobileGroupIdx = 0;
    teacherEntries.forEach(({ teacher, evaluations }) => {
        const gid = `lev-mg-${mobileGroupIdx}`;
        html += `
            <div class="lev-mobile-folder-header" onclick="toggleLevMobileFolder('${gid}', this)">
                <div class="lev-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fa8fd" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lev-mobile-folder-name">${escapeLearnerEvaluationHtml(teacher)}</span>
                <span class="lev-mobile-folder-count">${evaluations.length} evaluation${evaluations.length !== 1 ? 's' : ''}</span>
                <svg class="lev-mobile-folder-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="shape-rendering:geometricPrecision">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="lev-mobile-folder-body collapsed" id="${gid}">`;
        mobileGroupIdx++;

        evaluations.forEach(evaluation => {
            const statusText = evaluation.submitted ? 'Completed' : 'Pending';
            const statusColor = evaluation.submitted ? '#22c55e' : '#e67e22';
            const metaDate = evaluation.display_date ? `${escapeLearnerEvaluationHtml(evaluation.display_date)} &bull; ` : '';
            html += `
                <div class="lev-mobile-row" role="button" tabindex="0"
                    data-title="${escapeLearnerEvaluationHtml(evaluation.title||'').toLowerCase()}"
                    onclick="openMobileLearnerEvaluation(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerEvaluation(${mobileFlatIdx}); }">
                    <div class="lev-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fa8fd" stroke-width="2" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                    </div>
                    <div class="lev-mobile-row-body">
                        <div class="lev-mobile-row-title">
                            <span class="lev-mobile-row-title-text">${escapeLearnerEvaluationHtml(evaluation.title || 'Evaluation')}</span>
                        </div>
                        <div class="lev-mobile-row-meta">${metaDate}<span style="color:${statusColor};">${statusText}</span></div>
                    </div>
                    <div class="lev-mobile-row-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
            mobileFlatIdx++;
        });
        html += `</div>`; // close .lev-mobile-folder-body
    });

    html += `</div>`; // close .lev-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
}

// ─────────────────────────────────────────────
// SEARCH & FOLDER TOGGLES
// ─────────────────────────────────────────────
window.levDesktopSearch = function(val) {
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lev-desktop-teacher-group').forEach(group => {
        const header = group.querySelector('.lev-desktop-teacher-header');
        const body   = group.querySelector('.lev-desktop-teacher-body');
        const nameEl = group.querySelector('.lev-desktop-teacher-name');
        const groupName = nameEl ? nameEl.textContent.toLowerCase() : '';
        if (!header || !body) return;

        const items = body.querySelectorAll('.lev-sidebar-item');
        let visible = 0;
        items.forEach(item => {
            const title = (item.dataset.title || '');
            const show = !term || title.includes(term) || groupName.includes(term);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        const groupShow = visible > 0 || !term || groupName.includes(term);
        group.style.display = groupShow ? '' : 'none';

        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header.querySelector('.lev-desktop-teacher-chevron');
            if (chev) chev.classList.add('open');
        } else if (!term) {
            body.classList.add('collapsed');
            const chev = header.querySelector('.lev-desktop-teacher-chevron');
            if (chev) chev.classList.remove('open');
        }
    });
};

window.toggleLevMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lev-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveEvaluationPageState();
};

window.toggleLevDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lev-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveEvaluationPageState();
};

window.levMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('evaluations', { mobileSearch: val });
    const term = val.toLowerCase().trim();
    document.querySelectorAll('.lev-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        const folderName = header ? header.querySelector('.lev-mobile-folder-name').textContent.toLowerCase() : '';
        const rows = body.querySelectorAll('.lev-mobile-row');
        let visible = 0;
        rows.forEach(row => {
            const title = (row.dataset.title || '');
            const show = !term || title.includes(term) || folderName.includes(term);
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (header) header.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        body.style.display = (visible || !term || folderName.includes(term)) ? '' : 'none';
        if (term && visible) {
            body.classList.remove('collapsed');
            const chev = header ? header.querySelector('.lev-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT EVALUATION
// ─────────────────────────────────────────────
function escapeLearnerEvaluationHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function getLearnerEvaluationInitials(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getLearnerEvaluationFormHtml(evaluation) {
    if (evaluation.submitted) {
        return `
            <div class="lev-completed-state">
                <svg viewBox="0 0 24 24" width="52" height="52" stroke="#22c55e" stroke-width="1.5" fill="none">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div class="lev-completed-title">Completed</div>
                <div class="lev-completed-copy">You have already submitted this evaluation.</div>
            </div>`;
    }

    return `
        <div class="eval-description">${escapeLearnerEvaluationHtml(evaluation.description || '')}</div>
        <form onsubmit="handleEvalSubmit(event, ${evaluation.id})">
            <input type="hidden" name="eval_id" value="${evaluation.id}">
            ${(evaluation.statements || []).map(s => `
                <div class="question-box">
                    <div class="question-text">${escapeLearnerEvaluationHtml(s.statement || '')}</div>
                    <div class="eval-options">
                        ${['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'].map(val => `
                            <label class="option-label">
                                <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                <span>${val.replace('_', ' ').toUpperCase()}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            <div class="lev-comments-field">
                <label>Additional Comments (Optional)</label>
                <textarea name="comments"></textarea>
            </div>
            <button type="submit" class="eval-submit-btn"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
        </form>`;
}

window.openMobileLearnerEvaluation = function(idx) {
    if (window.innerWidth > 899) return;

    const evaluation = (window._allLearnerEvaluationsFlat || [])[idx];
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');

    if (!evaluation || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');
    if (mainContent) mainContent.scrollTop = 0;

    sessionStorage.setItem("lastLearnerPage", "evaluation_list.php");
    if (window.configureHeader) {
        window.configureHeader({ title: evaluation.title || 'Evaluation', mode: 'detail', detailType: 'Evaluation', color: '#4fa8fd' });
    }

    const teacherName = evaluation.teacher || 'Teacher';
    const initials = evaluation.teacher_initials || getLearnerEvaluationInitials(teacherName);

    apiArea.innerHTML = `
        <article class="lev-mobile-detail">
            <div class="lev-mobile-detail-badge">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4fa8fd" stroke-width="2.5" fill="none">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                Evaluation
            </div>
            <div class="lev-mobile-detail-author-row">
                <div class="lev-mobile-detail-avatar">${escapeLearnerEvaluationHtml(initials)}</div>
                <div class="lev-mobile-detail-author-info">
                    <div class="lev-mobile-detail-author-name">${escapeLearnerEvaluationHtml(teacherName)}</div>
                    <div class="lev-mobile-detail-author-role">
                        <span>Author</span><span class="lev-mobile-detail-role-sep">|</span><span class="lev-mobile-detail-role-badge">Teacher</span>
                    </div>
                    ${evaluation.display_date ? `<div class="lev-mobile-detail-posted">Posted ${escapeLearnerEvaluationHtml(evaluation.display_date)}</div>` : ''}
                </div>
            </div>
            <h1 class="lev-mobile-detail-title learner-mobile-detail-title">${escapeLearnerEvaluationHtml(evaluation.title || 'Evaluation')}</h1>
            ${getLearnerEvaluationFormHtml(evaluation)}
        </article>`;

    if (mainContent) mainContent.scrollTop = 0;
};

window.openMobileLearnerEvaluationById = function(evaluationId) {
    const targetId = String(evaluationId || '');
    const flatIdx = (window._allLearnerEvaluationsFlat || []).findIndex(evaluation => String(evaluation.id) === targetId);

    if (flatIdx < 0) return;

    if (window.innerWidth > 899) {
        window.selectDesktopLearnerEvaluation(flatIdx);
        return;
    }

    window.openMobileLearnerEvaluation(flatIdx);
};

window.selectDesktopLearnerEvaluation = function(idx) {
    window._learnerEvaluationSelectedIdx = idx;
    saveEvaluationPageState();
    document.querySelectorAll('.lev-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lev-sidebar-${idx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const evaluation = (window._allLearnerEvaluationsFlat || [])[idx];
    if (!evaluation) return;

    const panel = document.getElementById('lev-main-panel');
    if (!panel) return;

    let panelContent = '';

    if (evaluation.submitted) {
        panelContent = `
            <div style="text-align:center;padding:60px 20px;">
                <svg viewBox="0 0 24 24" width="52" height="52" stroke="#22c55e" stroke-width="1.5" fill="none" style="margin-bottom:16px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div style="font-size:18px;font-weight:800;color:#22c55e;margin-bottom:8px;">Completed</div>
                <div style="font-size:14px;color:#8b949e;">You have already submitted this evaluation.</div>
            </div>`;
    } else {
        panelContent = `
            <div class="eval-description" style="margin-bottom:20px;">${evaluation.description || ''}</div>
            <form onsubmit="handleEvalSubmit(event, ${evaluation.id})">
                <input type="hidden" name="eval_id" value="${evaluation.id}">
                ${evaluation.statements.map(s => `
                    <div class="question-box">
                        <div class="question-text">${s.statement}</div>
                        <div class="eval-options">
                            ${['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'].map(val => `
                                <label class="option-label">
                                    <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                    <span>${val.replace('_', ' ').toUpperCase()}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                <div style="margin-top:35px;">
                    <label style="font-weight:600; display:block; margin-bottom:10px;">Additional Comments (Optional)</label>
                    <textarea name="comments" style="width:100%; min-height:120px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; color:white; padding:15px;"></textarea>
                </div>
                <button type="submit" class="eval-submit-btn"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
            </form>`;
    }

    const teacherName = evaluation.teacher || 'Teacher';
    const initials = evaluation.teacher_initials || getLearnerEvaluationInitials(teacherName);

    panel.innerHTML = `
        <div class="lev-panel-content">
            <div class="lev-panel-header">
                <div class="lev-panel-author-row">
                    <div class="lev-panel-avatar">${escapeLearnerEvaluationHtml(initials)}</div>
                    <div class="lev-panel-author-info">
                        <div class="lev-panel-author-name">${escapeLearnerEvaluationHtml(teacherName)}</div>
                        <div class="lev-panel-author-role">
                            <span>Author</span><span class="lev-panel-role-sep">|</span><span class="lev-panel-role-badge">Teacher</span>
                        </div>
                        ${evaluation.display_date ? `<div class="lev-panel-posted">Posted ${escapeLearnerEvaluationHtml(evaluation.display_date)}</div>` : ''}
                    </div>
                </div>
                <div class="lev-panel-title">${escapeLearnerEvaluationHtml(evaluation.title || 'Evaluation')}</div>
            </div>
            ${panelContent}
        </div>`;
};

// Keep your handleEvalSubmit function exactly as it was...
window.handleEvalSubmit = async function(e, id) {
    e.preventDefault();
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/submit_evaluation.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: new FormData(e.target)
        });
        const res = await response.json();
        if (res.success) {
            window.evaluationCache = null; // Clear cache so it fetches fresh "Completed" state
            fetchEvaluations(); 
        } else {
            alert(res.message);
        }
    } catch (err) {
        alert("Submission failed.");
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};