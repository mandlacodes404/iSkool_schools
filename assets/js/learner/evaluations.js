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
    const panel = document.getElementById('lev-main-panel');
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
    const panel = document.getElementById('lev-main-panel');
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
            const panel = document.getElementById('lev-main-panel');
            if (panel && Number.isFinite(state.panelScroll)) panel.scrollTop = state.panelScroll;
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
        window.configureHeader({ title: 'Evaluations', mode: 'standard', color: '#4fa8fd' });
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
            <div class="lev-desktop-layout lqz-flat-layout">
                <div class="lev-sidebar lqz-flat-sidebar">
                    <div class="lev-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lev-desktop-search" id="levDesktopSearch"
                            placeholder="Search evaluations..." oninput="levDesktopSearch(this.value)">
                    </div>
                    <div class="lev-sidebar-scroll"></div>
                </div>
                <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                    <div class="lev-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fa8fd" stroke-width="1.5" fill="none">
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
            <div class="lev-desktop-layout lqz-flat-layout">
                <div class="lev-sidebar lqz-flat-sidebar">
                    <div class="lev-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="lev-desktop-search" id="levDesktopSearch"
                            placeholder="Search evaluations..." oninput="levDesktopSearch(this.value)">
                    </div>
                    <div class="lev-sidebar-scroll"></div>
                </div>
                <div class="lev-main-panel lqz-flat-panel" id="lev-main-panel">
                    <div class="lev-panel-empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fa8fd" stroke-width="1.5" fill="none">
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
                        <div class="lev-sidebar-item-meta">${escapeLearnerEvaluationHtml(evaluation.display_date || '')}</div>
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
    // (Styles for this markup now live in assets/css/learner/evaluations.css,
    // appended alongside the existing rules — the inline <style> block that
    // used to be injected here was removed as part of the inline-style
    // cleanup. Nothing already in evaluations.css was changed.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lev-desktop-layout lqz-flat-layout">
            <div class="lev-sidebar lqz-flat-sidebar">
                <div class="lev-desktop-search-wrap">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="lev-icon-crisp">
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

    // Desktop doesn't use the dynamic bottom-nav/header behaviour, so
    // recheckMobileNavAfterToggle() will just no-op there — kept for
    // consistency in case that ever changes.
    recheckMobileNavAfterToggle();
};

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

window.toggleLevDesktopGroup = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body) return;
    const isOpen = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', isOpen);
    const chevron = headerEl ? headerEl.querySelector('.lev-desktop-teacher-chevron') : null;
    if (chevron) chevron.classList.toggle('open', !isOpen);
    saveEvaluationPageState();

    // Desktop doesn't have this dynamic bottom-nav/header behaviour, so
    // window.recalcMobileScrollUI won't exist there —
    // recheckMobileNavAfterToggle() already no-ops safely when it's missing.
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

    const panelContent = getLearnerEvaluationFormHtml(evaluation);

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