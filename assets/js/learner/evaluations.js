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
    const panel = document.querySelector('.lev-body');
    const selected = (window._allLearnerEvaluationsFlat || [])[window._learnerEvaluationSelectedIdx];
    const state = {
        selectedId:    selected ? String(selected.id) : null,
        selectedIdx:   window._learnerEvaluationSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   panel ? panel.scrollTop : 0,
        mobileSearch: document.getElementById('levMobileSearch')?.value || '',
        openFolders: Array.from(document.querySelectorAll('.lev-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        openDesktopGroups: Array.from(document.querySelectorAll('.lev-desktop-teacher-body:not(.collapsed)')).map(el => el.id),
    };
    if (window.learnerPageState) window.learnerPageState.set('evaluations', state);
    else sessionStorage.setItem('evaluationPageState', JSON.stringify(state));
}

function wireEvaluationScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.lev-sidebar-scroll');
    const panel = document.querySelector('.lev-body');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.levScrollWired === '1') return;
        el.dataset.levScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('evaluations', saveEvaluationPageState), { passive: true });
    });
}

function restoreEvaluationPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('evaluations')
            : JSON.parse(sessionStorage.getItem('evaluationPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            window.levEnsureSelection();
            wireEvaluationScrollState();
            return;
        }
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
                    const header = body.previousElementSibling;
                    if (header) header.classList.toggle('lev-mobile-folder-header--collapsed', !open);
                    const chev = header?.querySelector('.lev-mobile-folder-chevron');
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
            const selectedIdx = state.selectedId
                ? (window._allLearnerEvaluationsFlat || []).findIndex(evaluation => String(evaluation.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerEvaluation(selectedIdx);
            }
            const sidebar = document.querySelector('.lev-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panel = document.querySelector('.lev-body');
            if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
            window.levEnsureSelection();
            wireEvaluationScrollState();
            saveEvaluationPageState();
        });
    } catch (e) { /* ignore bad state */ }
}

window.fetchEvaluations = async function() {
    const navigation = window.beginLearnerViewNavigation?.('evaluation_list.php');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    
    sessionStorage.setItem("lastLearnerPage", "evaluation_list.php");

    if (typeof window.setActive === 'function') {
        window.setActive("evaluation_list.php");
    }

    if (window.configureHeader) {
        window.configureHeader({ title: 'Evaluations', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';

    // Inject CSS
    const evalStyleHref = 'assets/css/learner/evaluations.css?v=4.0';
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
    if (!isCurrentNavigation()) return;

    // 4. FIXED CACHE CHECK
    if (window.evaluationCache) {
        renderEvaluationsUI(window.evaluationCache); // Call the correct internal function
        restoreEvaluationPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_evaluations.php');
        const data = await response.json();
        if (!isCurrentNavigation()) return;
        window.evaluationCache = data; 
        renderEvaluationsUI(data); // Call the helper function here too
        restoreEvaluationPageState();
    } catch (e) {
        if (!isCurrentNavigation()) return;
        apiArea.innerHTML = "<p class='eval-error-state'>Error loading evaluations.</p>";
    } finally {
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
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
        apiArea.innerHTML = `
            <!-- ═══ DESKTOP EMPTY ═══ -->
            <div class="lev-desktop-layout lqz-flat-layout" id="lev-desktop-layout">
                <div class="lev-sidebar">
                    <div class="lev-lh">
                        <div class="lev-desktop-search-wrap">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input type="text" class="lev-desktop-search" id="levDesktopSearch" placeholder="Filter evaluations" disabled>
                        </div>
                    </div>
                    <div class="lev-sidebar-scroll" id="lev-list"></div>
                </div>
                <div class="lev-split" aria-hidden="true"></div>
                <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                    <div class="lev-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                        <p>You haven't joined a class yet.</p>
                    </div>
                </div>
            </div>

            <!-- ═══ MOBILE EMPTY ═══ -->
            <div class="lev-mobile-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="lev-mobile-search" id="levMobileSearch"
                    placeholder="Search evaluations..." oninput="levMobileSearch(this.value)">
            </div>
            <div class="lev-mobile-list">
                <div class="lev-mobile-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fa8fd" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p class="lev-mobile-empty-title">Not enrolled yet</p>
                    <p class="lev-mobile-empty-body">You're not enrolled in a class yet. Check back soon.</p>
                </div>
            </div>`;
        return;
    }
    if (!data || data.length === 0) {
        apiArea.innerHTML = `
            <!-- ═══ DESKTOP EMPTY ═══ -->
            <div class="lev-desktop-layout lqz-flat-layout" id="lev-desktop-layout">
                <div class="lev-sidebar">
                    <div class="lev-lh">
                        <div class="lev-desktop-search-wrap">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input type="text" class="lev-desktop-search" id="levDesktopSearch" placeholder="Filter evaluations" disabled>
                        </div>
                    </div>
                    <div class="lev-sidebar-scroll" id="lev-list"></div>
                </div>
                <div class="lev-split" aria-hidden="true"></div>
                <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                    <div class="lev-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                        <p>Your teachers haven't posted any evaluations yet.</p>
                    </div>
                </div>
            </div>

            <!-- ═══ MOBILE EMPTY ═══ -->
            <div class="lev-mobile-search-wrap">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="lev-mobile-search" id="levMobileSearch"
                    placeholder="Search evaluations..." oninput="levMobileSearch(this.value)">
            </div>
            <div class="lev-mobile-list">
                <div class="lev-mobile-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fa8fd" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p class="lev-mobile-empty-title">No evaluations yet</p>
                    <p class="lev-mobile-empty-body">Your teachers haven't posted any evaluations. Check back soon.</p>
                </div>
            </div>`;
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

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/evaluations.css,
    // appended alongside the existing rules — the inline <style> block that
    // used to be injected here was removed as part of the inline-style
    // cleanup. Nothing already in evaluations.css was changed.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lev-desktop-layout lqz-flat-layout" id="lev-desktop-layout">
            <div class="lev-sidebar">
                <div class="lev-lh">
                    <div class="lev-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lev-desktop-search" id="levDesktopSearch"
                            placeholder="Filter evaluations" oninput="levDesktopSearch(this.value)">
                    </div>
                    <div class="lev-chips" id="lev-chips"></div>
                </div>
                <div class="lev-sidebar-scroll" id="lev-list" tabindex="0" onkeydown="levListKeydown(event)"></div>
            </div>
            <div class="lev-split" id="lev-split" role="separator" aria-orientation="vertical" aria-label="Resize evaluation list" tabindex="0"></div>
            <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                <div class="lev-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p>Select an evaluation from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    html += `
        <div class="lev-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="lev-mobile-search" id="levMobileSearch"
                placeholder="Search evaluations..." oninput="levMobileSearch(this.value)">
        </div>`;

    html += `<div class="lev-mobile-list">`;

    let mobileFlatIdx = 0;
    let mobileGroupIdx = 0;
    teacherEntries.forEach(({ teacher, evaluations }) => {
        const gid = `lev-mg-${mobileGroupIdx}`;
        html += `
            <div class="lev-mobile-folder-header lev-mobile-folder-header--collapsed" onclick="toggleLevMobileFolder('${gid}', this)">
                <div class="lev-mobile-folder-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fa8fd" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="lev-mobile-folder-name">${escapeLearnerEvaluationHtml(teacher)}</span>
                <span class="lev-mobile-folder-count">${evaluations.length} evaluation${evaluations.length !== 1 ? 's' : ''}</span>
                <svg class="lev-mobile-folder-chevron lev-icon-crisp" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
            <div class="lev-mobile-folder-body collapsed" id="${gid}">`;
        mobileGroupIdx++;

        evaluations.forEach(evaluation => {
            const statusText = evaluation.submitted ? 'Completed' : 'Pending';
            const metaDate = evaluation.display_date ? `${escapeLearnerEvaluationHtml(evaluation.display_date)} &bull; ` : '';
            html += `
                <div class="lev-mobile-row" role="button" tabindex="0"
                    data-title="${escapeLearnerEvaluationHtml(evaluation.title||'').toLowerCase()}"
                    onclick="openMobileLearnerEvaluation(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerEvaluation(${mobileFlatIdx}); }">
                    <div class="lev-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fa8fd" stroke-width="1.3" fill="none">
                            <path d="M9 11l3 3L22 4"></path>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                    </div>
                    <div class="lev-mobile-row-body">
                        <div class="lev-mobile-row-title">
                            <span class="lev-mobile-row-title-text">${escapeLearnerEvaluationHtml(evaluation.title || 'Evaluation')}</span>
                        </div>
                        <div class="lev-mobile-row-meta"><span>${metaDate}${statusText}</span></div>
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
    window.levInitDesktop();
}

// ─────────────────────────────────────────────
// SEARCH & FOLDER TOGGLES
// ─────────────────────────────────────────────

// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a folder is expanded/collapsed or a search filters rows
// in/out of view — both change the page's actual scrollable height
// without firing a real 'scroll' event, so the bottom nav's background
// (and header) never got re-checked against the new height on its own.
// A single delayed check would need to know the exact CSS transition
// duration (unknown from here, and could change) — polling a few times
// over ~400ms means it settles on the right answer regardless.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

window.toggleLevMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const chevron = headerEl.querySelector('.lev-mobile-folder-chevron');
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    headerEl.classList.toggle('lev-mobile-folder-header--collapsed', isOpen);
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveEvaluationPageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
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
            if (header) header.classList.remove('lev-mobile-folder-header--collapsed');
            const chev = header ? header.querySelector('.lev-mobile-folder-chevron') : null;
            if (chev) chev.classList.add('open');
        }
    });

    // Filtering rows/folders in/out of view changes the page's scrollable
    // height just like expanding/collapsing a folder does, but without a
    // real scroll event — same recalculation fix as the folder toggle.
    recheckMobileNavAfterToggle();
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

// ─────────────────────────────────────────────
// DESKTOP LIST: To do / Completed groups, chips, search
// ─────────────────────────────────────────────
window._levFilter = 'all';
window._levTerm = '';

window.levRenderDesktopList = function () {
    const list = document.getElementById('lev-list');
    if (!list) return;
    const keep = list.scrollTop;
    const term = window._levTerm;
    const items = (window._allLearnerEvaluationsFlat || []).map((ev, idx) => ({ ev, idx }));
    const showActive = !!document.querySelector('#lev-main-panel .lev-dh');

    const counts = { all: items.length, todo: 0, done: 0 };
    items.forEach(({ ev }) => { if (ev.submitted) counts.done++; else counts.todo++; });
    const chipsEl = document.getElementById('lev-chips');
    if (chipsEl) {
        chipsEl.innerHTML = [['all', 'All'], ['todo', 'To do'], ['done', 'Completed']]
            .map(([k, label]) => `<button type="button" class="lev-chip${window._levFilter === k ? ' on' : ''}" onclick="levSetFilter('${k}')">${label} ${counts[k]}</button>`)
            .join('');
    }

    const visible = items.filter(({ ev }) => {
        const f = window._levFilter;
        const ok = f === 'all' || (f === 'todo' && !ev.submitted) || (f === 'done' && ev.submitted);
        return ok && (!term || `${ev.title || ''} ${ev.teacher || ''}`.toLowerCase().includes(term));
    });

    let html = '';
    [['To do', false], ['Completed', true]].forEach(([label, done]) => {
        const rows = visible.filter(({ ev }) => !!ev.submitted === done);
        if (!rows.length) return;
        html += `<div class="lev-gh"><span>${label}</span><i>${rows.length}</i></div>`;
        rows.forEach(({ ev, idx }) => {
            const teacher = ev.teacher || 'Teacher';
            const initials = ev.teacher_initials || getLearnerEvaluationInitials(teacher);
            const n = (ev.statements || []).length;
            const active = showActive && idx === window._learnerEvaluationSelectedIdx ? ' active' : '';
            html += `
                <div class="lev-sidebar-item lev-row${active}" id="lev-sidebar-${idx}" onclick="selectDesktopLearnerEvaluation(${idx})">
                    <span class="lev-ava">${escapeLearnerEvaluationHtml(initials)}</span>
                    <div class="lev-sidebar-item-info">
                        <div class="lev-sidebar-item-title${done ? '' : ' lev-unread'}">${escapeLearnerEvaluationHtml(ev.title || 'Evaluation')}</div>
                        <div class="lev-sidebar-item-meta">${escapeLearnerEvaluationHtml(teacher)} &middot; ${n} statement${n === 1 ? '' : 's'}</div>
                    </div>
                    <span class="lev-rr">${done ? '<span class="lev-tm">Done</span>' : '<span class="lev-udot"></span>'}</span>
                </div>`;
        });
    });
    list.innerHTML = html || `<div class="lev-list-empty">${items.length ? 'No evaluations match.' : "Your teachers haven't posted any evaluations yet."}</div>`;
    list.scrollTop = keep;
};

window.levSetFilter = function (key) { window._levFilter = key; window.levRenderDesktopList(); };
window.levDesktopSearch = function (val) {
    window._levTerm = String(val || '').toLowerCase().trim();
    window.levRenderDesktopList();
};

window.levListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const ids = Array.from(document.querySelectorAll('#lev-list .lev-sidebar-item'))
        .map(el => parseInt(el.id.replace('lev-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._learnerEvaluationSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopLearnerEvaluation(ids[next]);
    const el = document.getElementById(`lev-sidebar-${ids[next]}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
};

// Desktop never shows an empty detail pane when there's something to show
window.levEnsureSelection = function () {
    if (window.innerWidth < 900) return;
    if (document.querySelector('#lev-list .lev-sidebar-item.active')) return;
    const first = document.querySelector('#lev-list .lev-sidebar-item');
    if (first) window.selectDesktopLearnerEvaluation(parseInt(first.id.replace('lev-sidebar-', ''), 10));
};

window.levInitSplit = function () {
    const layout = document.getElementById('lev-desktop-layout');
    const split = document.getElementById('lev-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--lev-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--lev-listw'), 10) || 320;
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

window.levInitDesktop = function () {
    if (!document.getElementById('lev-list')) return;
    window._levFilter = 'all';
    window._levTerm = '';
    window.levRenderDesktopList();
    window.levInitSplit();
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: form with live progress
// ─────────────────────────────────────────────
const LEV_SCALE = [
    ['strongly_agree', 'Strongly agree'],
    ['agree', 'Agree'],
    ['neutral', 'Neutral'],
    ['disagree', 'Disagree'],
    ['strongly_disagree', 'Strongly disagree']
];

window.levUpdateProgress = function () {
    const form = document.querySelector('.lev-form');
    if (!form) return;
    const total = parseInt(form.dataset.total, 10) || 0;
    const names = new Set();
    form.querySelectorAll('input[type="radio"]:checked').forEach(r => names.add(r.name));
    const answered = names.size;
    const text = document.getElementById('levPgText');
    const bar = document.getElementById('levPgBar');
    const btn = document.getElementById('levSubmitBtn');
    if (text) text.textContent = `${answered} of ${total} answered`;
    if (bar) bar.style.width = (total ? (answered / total) * 100 : 100) + '%';
    if (btn) {
        btn.disabled = answered < total;
        btn.title = answered < total ? 'Answer every statement to submit' : '';
    }
    form.querySelectorAll('.lev-qb').forEach(qb => {
        const done = !!qb.querySelector('input[type="radio"]:checked');
        const badge = qb.querySelector('.lev-qn');
        if (!badge) return;
        badge.classList.toggle('done', done);
        badge.textContent = done ? '\u2713' : badge.dataset.n;
    });
};

window.selectDesktopLearnerEvaluation = function (idx) {
    const flat = window._allLearnerEvaluationsFlat || [];
    const ev = flat[idx];
    if (!ev) return;
    window._learnerEvaluationSelectedIdx = idx;
    saveEvaluationPageState();
    document.querySelectorAll('.lev-sidebar-item').forEach(el => el.classList.remove('active'));
    const row = document.getElementById(`lev-sidebar-${idx}`);
    if (row) row.classList.add('active');

    const panel = document.getElementById('lev-main-panel');
    if (!panel) return;

    const teacher = ev.teacher || 'Teacher';
    const statements = ev.statements || [];
    const formId = `lev-form-${ev.id}`;
    const done = !!ev.submitted;

    const statusChip = done
        ? '<span class="lev-panel-status"><span class="lev-panel-status-dot" style="background:#22c55e;"></span>Completed</span>'
        : '<span class="lev-panel-status"><span class="lev-panel-status-dot" style="background:#e67e22;"></span>To do</span>';
    const headRight = done
        ? '<span class="lev-muted">Submitted</span>'
        : `<span class="lev-prog"><span id="levPgText"></span><span class="lev-pbar"><i id="levPgBar"></i></span></span>
           <button type="submit" form="${formId}" class="lev-pri" id="levSubmitBtn" disabled>Submit feedback</button>`;

    let body;
    if (done) {
        body = `
            <div class="lev-fin">
                <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <b>Completed</b>You have already submitted this evaluation.
            </div>`;
    } else {
        body = `
            ${ev.description ? `<p class="lev-desc">${escapeLearnerEvaluationHtml(ev.description)}</p>` : ''}
            <form id="${formId}" class="lev-form" data-total="${statements.length}" onsubmit="handleEvalSubmit(event, ${ev.id})" onchange="levUpdateProgress()">
                <input type="hidden" name="eval_id" value="${ev.id}">
                ${statements.map((s, i) => `
                    <div class="lev-qb">
                        <div class="lev-qh">
                            <span class="lev-qn" data-n="${i + 1}">${i + 1}</span>
                            <span class="lev-qt">${escapeLearnerEvaluationHtml(s.statement || '')}</span>
                        </div>
                        <div class="lev-lk">
                            ${LEV_SCALE.map(([val, label]) => `
                                <label class="lev-lo">
                                    <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                    <span>${label}</span>
                                </label>`).join('')}
                        </div>
                    </div>`).join('')}
                <div class="lev-cmt">
                    <label for="${formId}-comments">Additional comments <em>(optional)</em></label>
                    <textarea id="${formId}-comments" name="comments"></textarea>
                </div>
            </form>`;
    }

    const more = flat.map((e, i) => ({ e, i }))
        .filter(({ e, i }) => i !== idx && (e.teacher || 'Teacher') === teacher)
        .slice(0, 3)
        .map(({ e, i }) => `
            <button type="button" class="lev-more" onclick="selectDesktopLearnerEvaluation(${i})">
                <b>${escapeLearnerEvaluationHtml(e.title || 'Evaluation')}</b>
                <small>${e.submitted ? 'Completed' : 'To do'}${e.display_date ? ' &middot; ' + escapeLearnerEvaluationHtml(e.display_date) : ''}</small>
            </button>`).join('');

    panel.innerHTML = `
        <div class="lev-dh">
            <h2 class="lev-dh-title">${escapeLearnerEvaluationHtml(ev.title || 'Evaluation')}</h2>
            ${statusChip}
            <span class="lev-dsp"></span>
            ${headRight}
        </div>
        <div class="lev-dbody">
            <div class="lev-body"><div class="lev-read">${body}</div></div>
            <aside class="lev-rail">
                <h4>Details</h4>
                <div class="lev-kv"><span>From</span><b>${escapeLearnerEvaluationHtml(teacher)}</b></div>
                <div class="lev-kv"><span>Role</span><b>Teacher</b></div>
                ${ev.display_date ? `<div class="lev-kv"><span>Posted</span><b>${escapeLearnerEvaluationHtml(ev.display_date)}</b></div>` : ''}
                <div class="lev-kv"><span>Statements</span><b>${statements.length}</b></div>
                <div class="lev-kv"><span>Status</span><b>${done ? 'Completed' : 'To do'}</b></div>
                ${done ? '' : '<p class="lev-help">Rate each statement, add an optional comment, then submit. Once submitted, it is marked Completed.</p>'}
                ${more ? `<h4 class="lev-rail-sub">More from ${escapeLearnerEvaluationHtml(teacher)}</h4>${more}` : ''}
            </aside>
        </div>`;

    if (!done) window.levUpdateProgress();

    const box = document.getElementById('lev-list');
    if (box && row) {
        const top = row.offsetTop, bottom = top + row.offsetHeight;
        if (top < box.scrollTop + 34) box.scrollTop = Math.max(0, top - 34);
        else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
    }
    wireEvaluationScrollState();
};

// Keep your handleEvalSubmit function exactly as it was...
window.handleEvalSubmit = async function(e, id) {
    e.preventDefault();
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/submit_evaluation.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken(), 'X-iSkool-Queue-User': window.learnerQueueUser || '' },
            body: new FormData(e.target)
        });
        const res = await response.json();
        if (res.queued) {
            alert(res.message);
        } else if (res.success) {
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