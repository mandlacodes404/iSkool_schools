/* assets/js/assignments.js */
window.learnerAssignmentCache          = null;
window.learnerAssignmentPrefetchPromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchAssignments = function () {
    if (window.learnerAssignmentCache) return;
    if (window.learnerAssignmentPrefetchPromise) return;
    window.learnerAssignmentPrefetchPromise = fetch('api/learner/get_assignments.php')
        .then(r => { if (!r.ok) throw new Error('prefetch failed'); return r.json(); })
        .then(data => { window.learnerAssignmentCache = data; })
        .catch(() => {})
        .finally(() => { window.learnerAssignmentPrefetchPromise = null; });
};

function showLearnerAssignmentMobileBottomNav() {
    if (window.innerWidth > 899) return;

    const mobileBottomNav = document.getElementById('mobileBottomNav');
    if (mobileBottomNav) {
        mobileBottomNav.style.setProperty('display', 'flex', 'important');
    }
}

function learnerAssignmentSpinnerMarkup() {
    return `
        <span class="btn-spinner" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
        </span>`;
}

function hasLearnerAssignmentSubmission(task) {
    return Boolean(task && (task.has_submission || task.submission_file));
}

function learnerAssignmentSubmissionFormMarkup(task, formId) {
    const assignmentId = encodeURIComponent(task.id);
    const currentFile = task.submission_file
        ? `<p class="las-submission-current-file">Current file: <a href="javascript:void(0)" onclick="viewDocument('${escapeLearnerAssignmentJsString(task.submission_file)}', 'My Submission: ${escapeLearnerAssignmentJsString(task.title)}')">View uploaded work</a></p>`
        : '';

    return `
        <form id="${formId}" class="las-submission-form" action="submit_assignment.php?assignment_id=${assignmentId}" enctype="multipart/form-data" onsubmit="submitLearnerAssignmentInline(event, this)" hidden>
            <div class="las-submission-form-heading">${hasLearnerAssignmentSubmission(task) ? 'Update your submission' : 'Submit your work'}</div>
            <p class="las-submission-form-help">Add a written response, a file, or both. Files can be up to 50MB.</p>
            <label class="las-submission-label" for="${formId}-text">Submission text <span>(optional)</span></label>
            <textarea id="${formId}-text" class="las-submission-textarea" name="submission_text" rows="6" placeholder="Write your response here...">${escapeLearnerAssignmentHtml(task.submission_text || '')}</textarea>
            <label class="las-submission-label" for="${formId}-file">Upload file <span>(optional)</span></label>
            ${currentFile}
            <input id="${formId}-file" class="las-submission-file" type="file" name="submission_file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip">
            <p class="las-submission-error" role="alert" hidden></p>
            <div class="las-submission-actions">
                <button type="button" class="las-submission-cancel" onclick="closeLearnerAssignmentInlineForm('${formId}')">Cancel</button>
                <button type="submit" class="las-submission-submit btn-loadable">
                    <span class="btn-label">${hasLearnerAssignmentSubmission(task) ? 'Update Submission' : 'Submit Assignment'}</span>
                    ${learnerAssignmentSpinnerMarkup()}
                </button>
            </div>
        </form>`;
}

window.openLearnerAssignmentInlineForm = function(event, formId) {
    if (event) event.preventDefault();
    const form = document.getElementById(formId);
    if (!form) return false;
    form.hidden = false;
    form.querySelector('.las-submission-textarea')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return false;
};

window.closeLearnerAssignmentInlineForm = function(formId) {
    const form = document.getElementById(formId);
    if (form) form.hidden = true;
};

window.submitLearnerAssignmentInline = async function(event, form) {
    event.preventDefault();

    const submitButton = form.querySelector('[type="submit"]');
    const error = form.querySelector('.las-submission-error');
    if (error) {
        error.hidden = true;
        error.textContent = '';
    }
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('is-loading');
    }

    try {
        const response = await fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRF-Token': typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : '',
                'X-iSkool-Queue-User': window.learnerQueueUser || ''
            },
            body: new FormData(form)
        });
        const result = await response.json();
        if (result.queued) {
            if (error) {
                error.textContent = result.message;
                error.hidden = false;
            }
            return;
        }
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Your submission could not be saved. Please try again.');
        }

        const assignmentId = new URL(form.action, window.location.href).searchParams.get('assignment_id');
        const task = (window._allLearnerAssignmentsFlat || []).find(item => String(item.id) === String(assignmentId));
        if (task) {
            task.has_submission = true;
            task.submission_file = result.file_url || task.submission_file;
            task.submission_text = result.submission_text || '';
        }

        window.learnerAssignmentCache = null;
        window._lasEditingId = null;
        if (typeof window.lasRenderDesktopList === 'function') window.lasRenderDesktopList();
        if (window.innerWidth > 899 && typeof window.selectDesktopLearnerAssignment === 'function') {
            window.selectDesktopLearnerAssignment(window._learnerAssignmentSelectedIdx);
        } else {
            const taskIndex = (window._allLearnerAssignmentsFlat || []).findIndex(item => String(item.id) === String(assignmentId));
            if (taskIndex >= 0 && typeof window.openMobileLearnerAssignment === 'function') {
                window.openMobileLearnerAssignment(taskIndex);
            }
        }
    } catch (submissionError) {
        console.error('Assignment submission error:', submissionError);
        if (error) {
            error.textContent = submissionError.message || 'Your submission could not be saved. Please try again.';
            error.hidden = false;
        }
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.classList.remove('is-loading');
        }
    }
};

window.fetchAssignments = async function() {
    const navigation = window.beginLearnerViewNavigation?.('assignment_list.php');
    const isCurrentNavigation = () => !navigation || window.isCurrentLearnerViewNavigation?.(navigation);
    // 1. Clear any existing timers
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 2. Set the UI State
    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (typeof window.setActive === 'function') window.setActive("assignment_list.php");

    // 3. Elements
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 4. Update Header (Safely)
    if (window.configureHeader) {
        window.configureHeader({ title: 'Assignments', mode: 'standard', color: '#a78bfa' });
    }

    // 5. Immediate UI Swap
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 6a. If prefetch is still in-flight, wait for it (no duplicate request).
    // No loader here — this is normally a few ms and caching makes it invisible.
    if (window.learnerAssignmentPrefetchPromise) {
        await window.learnerAssignmentPrefetchPromise;
    }
    if (!isCurrentNavigation()) return;

    // 6b. CACHE LOGIC
    if (window.learnerAssignmentCache) {
        renderAssignmentCards(window.learnerAssignmentCache);
        restoreAssignmentPageState();
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
        return;
    }

    // 7. FETCH LOGIC
    if (!window.suppressInitialLoader && !window._ptrRefreshing && loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_assignments.php');
        if (!response.ok) throw new Error('Failed to fetch assignments');
        
        const groupedData = await response.json();
        if (!isCurrentNavigation()) return;
        window.learnerAssignmentCache = groupedData;
        renderAssignmentCards(groupedData);
        restoreAssignmentPageState();
    } catch (error) {
        if (!isCurrentNavigation()) return;
        console.error("Assignment Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div class="las-error-state">
                    <p>Unable to load assignments.</p>
                    <button onclick="window.learnerAssignmentCache=null; window.fetchAssignments()" 
                            class="quiz-start-btn">Try Again</button>
                </div>`;
        }
    } finally {
        // 8. ALWAYS hide the loader, even if it fails
        if (loader && isCurrentNavigation()) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// STATE PERSISTENCE (sessionStorage)
// ─────────────────────────────────────────────
function saveAssignmentPageState() {
    const sidebar = document.querySelector('.las-sidebar-scroll');
    const mainContent = document.querySelector('.main-content');
    const panel = document.getElementById('las-main-panel');
    const selected = (window._allLearnerAssignmentsFlat || [])[window._learnerAssignmentSelectedIdx];
    const state = {
        // Keep the id, rather than only the rendered position. New work can
        // appear at the top of the list between visits, changing every index.
        selectedId:    selected ? String(selected.id) : null,
        selectedIdx:   window._learnerAssignmentSelectedIdx ?? null, // legacy fallback
        sidebarScroll: sidebar ? sidebar.scrollTop : 0,
        mainScroll:    mainContent ? mainContent.scrollTop : 0,
        panelScroll:   (document.querySelector('.las-body') || {}).scrollTop || 0,
        mobileSearch: document.getElementById('lasMobileSearch')?.value || '',
        mobileFilter: window._lasMobFilter || 'all',
        openFolders: Array.from(document.querySelectorAll('.las-mobile-folder-body:not(.collapsed)')).map(el => el.id),
        // Desktop teacher groups the learner has folded away (open is the default)
        collapsedTeachers: Array.from(window._lasCollapsed || []),
    };
    if (window.learnerPageState) window.learnerPageState.set('assignments', state);
    else sessionStorage.setItem('assignmentPageState', JSON.stringify(state));
}

function wireAssignmentScrollState() {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.las-sidebar-scroll');
    const panel = document.querySelector('.las-body');
    [mainContent, sidebar, panel].forEach(el => {
        if (!el || el.dataset.lasScrollWired === '1') return;
        el.dataset.lasScrollWired = '1';
        el.addEventListener('scroll', () => window.learnerPageState.queueSave('assignments', saveAssignmentPageState), { passive: true });
    });
}

function restoreAssignmentPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('assignments')
            : JSON.parse(sessionStorage.getItem('assignmentPageState') || '{}');
        if (!state || Object.keys(state).length === 0) {
            window.lasEnsureSelection();
            wireAssignmentScrollState();
            return;
        }
        requestAnimationFrame(() => {
            if (state.mobileSearch) {
                const input = document.getElementById('lasMobileSearch');
                if (input) {
                    input.value = state.mobileSearch;
                    window.lasMobileSearch(state.mobileSearch);
                }
            }
            if (state.mobileFilter && state.mobileFilter !== 'all') window.lasMobileSetFilter(state.mobileFilter);
            if (Array.isArray(state.openFolders)) {
                document.querySelectorAll('.las-mobile-folder-body').forEach(body => {
                    const header = body.previousElementSibling;
                    if (header) lasMobileSetFolder(header, body, state.openFolders.includes(body.id));
                });
            }
            if (Array.isArray(state.collapsedTeachers)) {
                window._lasCollapsed = new Set(state.collapsedTeachers);
                if (typeof window.lasRenderDesktopList === 'function') window.lasRenderDesktopList();
            }
            const selectedIdx = state.selectedId
                ? (window._allLearnerAssignmentsFlat || []).findIndex(task => String(task.id) === String(state.selectedId))
                : state.selectedIdx;
            if (selectedIdx !== null && selectedIdx !== undefined && selectedIdx >= 0) {
                window.selectDesktopLearnerAssignment(selectedIdx);
            }
            const sidebar = document.querySelector('.las-sidebar-scroll');
            if (sidebar && Number.isFinite(state.sidebarScroll)) sidebar.scrollTop = state.sidebarScroll;
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.mainScroll)) {
                mainContent.scrollTop = state.mainScroll;
            }
            const panelBody = document.querySelector('.las-body');
            if (panelBody && Number.isFinite(state.panelScroll)) panelBody.scrollTop = state.panelScroll;
            window.lasEnsureSelection();
            wireAssignmentScrollState();
            saveAssignmentPageState();
        });
    } catch (e) { /* ignore bad state */ }
}

function formatAssignmentDueDate(dueDateStr) {
    if (!dueDateStr || dueDateStr === 'No Due Date') return 'No Due Date';
    const date = new Date(dueDateStr.replace(/-/g, '/'));
    if (isNaN(date)) return dueDateStr;
    const day = date.getDate();
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `Due ${day} ${month}, ${hours}:${mins}`;
}

function parseLearnerAssignmentTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getLearnerAssignmentTime(task) {
    return parseLearnerAssignmentTime(task.created_at || task.raw_created_at || task.due_date);
}

function getSortedLearnerAssignmentEntries(groupedData) {
    return Object.entries(groupedData || {})
        .map(([teacher, tasks], index) => {
            const sortedTasks = Array.isArray(tasks)
                ? [...tasks].sort((a, b) => getLearnerAssignmentTime(b) - getLearnerAssignmentTime(a))
                : [];
            const latestTime = sortedTasks.reduce((latest, task) => Math.max(latest, getLearnerAssignmentTime(task)), 0);
            return { teacher, tasks: sortedTasks, latestTime, index };
        })
        .sort((a, b) => (b.latestTime - a.latestTime) || (a.index - b.index));
}

// ── Phone list helpers ──────────────────────────────────────────────────────────────────────────────────────
// The small status ring at the start of each row. It draws in currentColor, so the colour comes from the
// .las-mobile-row-icon--{todo|soon|done|closed} classes (and so follows light and dark mode with no extra rules).
function lasMobileRing(key) {
    const ring = '<circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.7"/>';
    let inner = ring;
    if (key === 'done') inner = '<circle cx="12" cy="12" r="9.6" fill="currentColor" stroke="none"/><path d="m7.8 12.4 2.8 2.8 5.6-6" stroke="#fff" stroke-width="2"/>';
    else if (key === 'closed') inner = ring + '<path d="M8.6 12h6.8" stroke="currentColor" stroke-width="1.8"/>';
    return `<svg class="las-icon-crisp" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// The one line under a row's title: the state word where there is one, then the date.
function lasMobileMeta(task, s, soon) {
    if (s.key === 'done') {
        const at = parseLearnerAssignmentTime(task.submitted_at);
        return `<span class="las-mobile-st las-mobile-st--ok">Submitted</span>${at ? ' · ' + lasFmtDay(at).replace(/^\w+ /, '') : ''}`;
    }
    const dueMs = lasDueMs(task);
    if (s.key === 'closed') return 'Closed' + (dueMs ? ' · was due ' + lasFmtDay(dueMs) : '');
    if (!dueMs) return 'No due date';
    const rel = s.days === 0 ? 'today' : s.days === 1 ? 'tomorrow' : s.days > 1 ? `in ${s.days} days` : '';
    const due = `Due ${lasFmtDue(task)}`;
    return (soon ? `<span class="las-mobile-st las-mobile-st--soon">${due}</span>` : due) + (rel ? ' · ' + rel : '');
}

function renderAssignmentCards(groupedData) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const hasAnyAssignments = groupedData && Object.keys(groupedData).length > 0;

    // ── Build flat list for desktop panel lookup ──
    const teacherEntries = getSortedLearnerAssignmentEntries(groupedData);

    window._allLearnerAssignmentsFlat = [];
    for (const { teacher, tasks } of teacherEntries) {
        tasks.forEach(task => {
            window._allLearnerAssignmentsFlat.push({ ...task, teacher, initials: task.teacher_initials || null });
        });
    }

    // ── Build full HTML ──
    // (Styles for this markup now live in assets/css/learner/assignments.css
    // — the inline <style> block that used to be injected here was removed
    // as part of the inline-style cleanup.)
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="las-desktop-layout lqz-flat-layout" id="las-desktop-layout">
            <div class="las-sidebar">
                <div class="las-lh">
                    <div class="las-desktop-search-wrap">
                        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="las-desktop-search" id="lasDesktopSearch"
                            placeholder="Filter assignments" oninput="lasDesktopSearch(this.value)">
                    </div>
                    <div class="las-chips" id="las-chips"></div>
                </div>
                <div class="las-sidebar-scroll" id="las-list" tabindex="0" onkeydown="lasListKeydown(event)"></div>
            </div>
            <div class="las-split" id="las-split" role="separator" aria-orientation="vertical" aria-label="Resize assignment list" tabindex="0"></div>
            <div class="las-main-panel lqz-flat-panel" id="las-main-panel">
                <div class="las-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>${hasAnyAssignments ? 'Select an assignment from the left' : "Your teachers haven't posted any assignments yet."}</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->`;

    // ── Phone: title and counts, search, filter chips, then the teacher groups ──
    // (the desktop layout above is a separate tree; the phone tree below is hidden from 900px up)
    let todoCount = 0, soonCount = 0;
    window._allLearnerAssignmentsFlat.forEach(task => {
        const s = lasTaskState(task);
        if (s.key !== 'todo') return;
        todoCount++;
        if (s.days !== null && s.days <= 3) soonCount++;
    });
    const mobileSummary = !hasAnyAssignments ? ''
        : todoCount === 0 ? 'All caught up'
        : `${todoCount} to do${soonCount ? ` · <b>${soonCount} due soon</b>` : ''}`;

    html += `
        <div class="las-mobile-head">
            <h1 class="las-mobile-title">Assignments</h1>
            ${mobileSummary ? `<p class="las-mobile-sub">${mobileSummary}</p>` : ''}
        </div>`;

    // Mobile search bar — always rendered and tappable, even when there are
    // zero assignments or a filter currently matches nothing.
    html += `
        <div class="las-mobile-search-wrap">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"/>
            </svg>
            <input type="text" class="las-mobile-search" id="lasMobileSearch"
                placeholder="Search assignments" aria-label="Search assignments" oninput="lasMobileSearch(this.value)">
        </div>`;

    if (hasAnyAssignments) {
        html += `<div class="las-mobile-chips" role="group" aria-label="Filter assignments">${
            [['all', 'All'], ['todo', 'To do'], ['done', 'Done'], ['closed', 'Closed']]
                .map(([k, label]) => `<button type="button" class="las-mobile-chip${k === 'all' ? ' on' : ''}" data-filter="${k}" aria-pressed="${k === 'all'}" onclick="lasMobileSetFilter('${k}')">${label}</button>`)
                .join('')
        }</div>`;
    }

    window._lasMobFilter = 'all';
    window._lasMobTerm = '';

    html += `<div class="las-mobile-list">`;

    // True empty state — no assignments posted at all yet.
    if (!hasAnyAssignments) {
        html += `
            <div class="las-mobile-empty">
                <svg viewBox="0 0 24 24" width="44" height="44" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <p class="las-mobile-empty-title">No assignments yet</p>
                <p class="las-mobile-empty-body">Your teachers haven't posted any assignments. Check back soon.</p>
            </div>`;
    }

    // Zero-results state — hidden by default, shown by lasMobileApply() when a
    // search or filter matches nothing. Kept in the DOM so it can just be toggled.
    html += `
        <div class="las-mobile-empty las-mobile-search-empty" id="lasMobileSearchEmpty" style="display:none;">
            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" class="las-icon-crisp" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p class="las-mobile-empty-title" id="lasMobileSearchEmptyText">No matches</p>
            <p class="las-mobile-empty-body" id="lasMobileSearchEmptyBody">Try a different title or teacher name.</p>
        </div>`;

    let mobileFlatIdx = 0;

    let mobileGroupIdx = 0;
    for (const { teacher, tasks } of teacherEntries) {
        const gid = `las-mg-${mobileGroupIdx}`;
        // A teacher's group starts open while it still holds work to do; a group that is all done or closed starts folded.
        // A learner's own choice (saved page state) wins over this, see restoreAssignmentPageState().
        const open = tasks.some(task => lasTaskState(task).key === 'todo');
        const classNames = [...new Set(tasks.map(task => String(task.class_name || '').trim()).filter(Boolean))];
        const classSub = classNames.length === 1 ? classNames[0] : classNames.length > 1 ? `${classNames.length} classes` : '';
        html += `
            <div class="las-mobile-folder-header${open ? '' : ' las-mobile-folder-header--collapsed'}" role="button" tabindex="0"
                aria-expanded="${open}" aria-controls="${gid}"
                data-search="${escapeLearnerAssignmentHtml(`${teacher} ${classNames.join(' ')}`.toLowerCase())}"
                onclick="toggleLasMobileFolder('${gid}', this)"
                onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleLasMobileFolder('${gid}', this); }">
                <span class="las-mobile-folder-name">${escapeLearnerAssignmentHtml(teacher)}</span>
                <span class="las-mobile-folder-sub">${escapeLearnerAssignmentHtml(classSub)}</span>
                <span class="las-mobile-folder-count">${tasks.length}</span>
                <svg class="las-mobile-folder-chevron las-icon-crisp" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </div>
            <div class="las-mobile-folder-body${open ? '' : ' collapsed'}" id="${gid}">`;
        mobileGroupIdx++;

        tasks.forEach((task, taskIdx) => {
            const s = lasTaskState(task);
            const soon = s.key === 'todo' && s.days !== null && s.days <= 3;

            html += `
                <div class="las-mobile-row${taskIdx === 0 ? ' las-mobile-row--first' : ''}" role="button" tabindex="0"
                    data-title="${escapeLearnerAssignmentHtml(task.title||''). toLowerCase()}" data-state="${s.key}"
                    onclick="openMobileLearnerAssignment(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAssignment(${mobileFlatIdx}); }">
                    <div class="las-mobile-row-icon las-mobile-row-icon--${s.key === 'todo' ? (soon ? 'soon' : 'todo') : s.key}">${lasMobileRing(s.key)}</div>
                    <div class="las-mobile-row-body">
                        <div class="las-mobile-row-title">
                            <span class="las-mobile-row-title-text">${escapeLearnerAssignmentHtml(task.title || 'Assignment')}</span>
                        </div>
                        <div class="las-mobile-row-meta">${lasMobileMeta(task, s, soon)}</div>
                    </div>
                    <svg class="las-mobile-row-chevron las-icon-crisp" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </div>`;
            mobileFlatIdx++;
        });
        html += `</div>`; // close .las-mobile-folder-body
    }

    html += `</div>`; // close .las-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedDesktopLayoutStyles === 'function') injectSharedDesktopLayoutStyles();
    lasEnsureFont();
    window.lasInitDesktop();
}

// Re-checks the bottom nav/header scroll-state repeatedly for a short
// window after a folder is expanded/collapsed. A single delayed check
// would need to know the exact CSS transition duration used for the
// collapse/expand animation (unknown from here, and could change) — 
// polling a few times over ~400ms means it settles on the right answer
// regardless of how long that transition actually takes, without
// needing to hook into a specific transitionend event per folder.
function recheckMobileNavAfterToggle() {
    if (typeof window.recalcMobileScrollUI !== 'function') return;
    const checkTimes = [0, 100, 200, 300, 400];
    checkTimes.forEach(delay => {
        setTimeout(() => window.recalcMobileScrollUI(), delay);
    });
}

// Open or fold one teacher group, keeping the header, the body and the screen-reader state in step.
function lasMobileSetFolder(header, body, open) {
    body.classList.toggle('collapsed', !open);
    header.classList.toggle('las-mobile-folder-header--collapsed', !open);
    header.setAttribute('aria-expanded', open ? 'true' : 'false');
}

window.toggleLasMobileFolder = function(id, headerEl) {
    const body = document.getElementById(id);
    if (!body || !headerEl) return;
    // While a search or filter is on, every group with a match is shown open; folding one would change nothing.
    if (body.closest('.las-mobile-list')?.classList.contains('is-filtering')) return;
    lasMobileSetFolder(headerEl, body, body.classList.contains('collapsed'));
    saveAssignmentPageState();

    // Opening/closing a folder changes the page's actual scrollable
    // height without firing a real 'scroll' event, so the bottom nav's
    // background (and header) never got re-checked against the new
    // height — it could stay stuck showing whatever state it was in
    // before the folder toggled.
    recheckMobileNavAfterToggle();
};

window._lasMobFilter = 'all';
window._lasMobTerm = '';

// Shows the rows that match both the filter chip and the search box, and only the groups that still have a row.
// Folding is left alone (the list just shows every match while filtering), so clearing the search puts it back as it was.
function lasMobileApply() {
    const list = document.querySelector('.las-mobile-list');
    if (!list) return;
    const term = window._lasMobTerm || '';
    const filter = window._lasMobFilter || 'all';
    const filtering = !!term || filter !== 'all';
    list.classList.toggle('is-filtering', filtering);

    let totalVisible = 0;
    list.querySelectorAll('.las-mobile-folder-body').forEach(body => {
        const header = body.previousElementSibling;
        // a search that names the teacher or the class shows all of that group's rows
        const groupHit = !!term && (header?.dataset.search || '').includes(term);
        let visible = 0;
        body.querySelectorAll('.las-mobile-row').forEach(row => {
            const show = (filter === 'all' || row.dataset.state === filter)
                && (!term || groupHit || (row.dataset.title || '').includes(term));
            row.style.display = show ? '' : 'none';
            row.classList.toggle('las-mobile-row--first', show && visible === 0);
            if (show) visible++;
        });
        if (header) {
            header.style.display = visible ? '' : 'none';
            const count = header.querySelector('.las-mobile-folder-count');
            if (count) count.textContent = String(visible);
        }
        body.style.display = visible ? '' : 'none';
        totalVisible += visible;
    });

    // Zero-results empty state — only when a search or filter is on and nothing matched.
    const searchEmpty = document.getElementById('lasMobileSearchEmpty');
    if (searchEmpty) {
        const showEmpty = filtering && totalVisible === 0;
        searchEmpty.style.display = showEmpty ? 'flex' : 'none';
        if (showEmpty) {
            const label = document.getElementById('lasMobileSearchEmptyText');
            const body = document.getElementById('lasMobileSearchEmptyBody');
            const raw = (document.getElementById('lasMobileSearch')?.value || '').trim();
            const none = { todo: 'Nothing to do right now', done: 'Nothing submitted yet', closed: 'No closed assignments' };
            if (label) label.textContent = raw ? `No matches for "${raw}"` : (none[filter] || 'No matches');
            if (body) body.textContent = raw ? 'Try a different title or teacher name.' : 'Pick another filter to see more.';
        }
    }

    // Filtering rows/folders in/out of view changes the page's scrollable
    // height just like expanding/collapsing a folder does, but without a
    // real scroll event — same recalculation fix as the folder toggle.
    recheckMobileNavAfterToggle();
}

window.lasMobileSetFilter = function(key) {
    window._lasMobFilter = key || 'all';
    document.querySelectorAll('.las-mobile-chip').forEach(chip => {
        const on = chip.dataset.filter === window._lasMobFilter;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    lasMobileApply();
    saveAssignmentPageState();
};

window.lasMobileSearch = function(val) {
    if (window.learnerPageState) window.learnerPageState.update('assignments', { mobileSearch: val });
    window._lasMobTerm = String(val || '').toLowerCase().trim();
    lasMobileApply();
};

function escapeLearnerAssignmentHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function escapeLearnerAssignmentJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function formatLearnerAssignmentPostedDate(rawDate) {
    const d = new Date(String(rawDate).replace(/-/g, '/'));
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} at ${hours}:${mins}`;
}

window.openMobileLearnerAssignment = function(flatIdx) {
    if (window.innerWidth > 899) return;

    const task = (window._allLearnerAssignmentsFlat || [])[flatIdx];
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');

    if (!task || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');

    sessionStorage.setItem("lastLearnerPage", "assignment_list.php");
    if (window.configureHeader) {
        window.configureHeader({ title: 'Submission', mode: 'detail' });
    }
    showLearnerAssignmentMobileBottomNav();

    const s = lasTaskState(task);
    const soon = s.key === 'todo' && s.days !== null && s.days <= 3;
    const pill = s.key === 'done' ? { cls: 'ok', text: 'Submitted' }
        : s.key === 'closed' ? { cls: 'closed', text: 'Closed' }
        : { cls: soon ? 'soon' : 'todo', text: 'Not submitted' };
    const actionLabel = task.is_past_due ? 'Submission Closed' : (s.key === 'done' ? 'Update Submission' : 'Submit Assignment');
    const submissionFormId = `las-mobile-submission-${task.id}`;

    const sender = task.teacher || 'Teacher';

    // Due: the day in large type, the time and how long is left beneath it
    const dueMs = lasDueMs(task);
    let dueDay = 'No due date', dueSmall = '';
    if (dueMs) {
        const due = new Date(dueMs);
        dueDay = lasFmtDay(dueMs);
        dueSmall = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (s.key === 'todo') {
            dueSmall += s.days === 0 ? ' · today' : s.days === 1 ? ' · tomorrow' : s.days > 1 ? ` · in ${s.days} days` : '';
        } else if (s.key === 'closed') {
            dueSmall += ' · closed';
        }
    }
    const fileRow = (label, note, onclick) => `
                    <a class="las-mobile-detail-link" href="javascript:void(0)" onclick="${onclick}">
                        <svg class="las-mobile-detail-link-icon las-icon-crisp" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path></svg>
                        <span class="las-mobile-detail-link-text"><span class="las-mobile-detail-link-name">${label}</span><span class="las-mobile-detail-link-note">${note}</span></span>
                        <svg class="las-mobile-detail-link-chev las-icon-crisp" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
                    </a>`;

    apiArea.innerHTML = `
        <article class="las-mobile-detail">
            <div class="las-mobile-detail-top">
                <span class="las-mobile-detail-eyebrow">Assignment</span>
                <span class="las-mobile-detail-status las-mobile-detail-status--${pill.cls}">${pill.text}</span>
            </div>
            <h1 class="las-mobile-detail-title">${escapeLearnerAssignmentHtml(task.title || 'Assignment')}</h1>
            ${task.created_at ? `<div class="las-mobile-detail-posted">Posted ${escapeLearnerAssignmentHtml(formatLearnerAssignmentPostedDate(task.created_at))}</div>` : ''}
            <div class="las-mobile-detail-facts">
                <div class="las-mobile-detail-fact">
                    <div class="las-mobile-detail-fact-label">Due</div>
                    <div class="las-mobile-detail-fact-value">${escapeLearnerAssignmentHtml(dueDay)}</div>
                    ${dueSmall ? `<div class="las-mobile-detail-fact-note${soon ? ' las-mobile-detail-fact-note--soon' : ''}">${escapeLearnerAssignmentHtml(dueSmall)}</div>` : ''}
                </div>
                <div class="las-mobile-detail-fact">
                    <div class="las-mobile-detail-fact-label">Teacher</div>
                    <div class="las-mobile-detail-fact-value las-mobile-detail-fact-value--name">${escapeLearnerAssignmentHtml(sender)}</div>
                    ${task.class_name ? `<div class="las-mobile-detail-fact-note">${escapeLearnerAssignmentHtml(task.class_name)}</div>` : ''}
                </div>
            </div>
            <div class="las-mobile-detail-label">Instructions</div>
            <div class="las-mobile-detail-desc">
                ${task.description ? escapeLearnerAssignmentHtml(task.description).replace(/\n/g, '<br>') : 'No description provided.'}
            </div>
            <div class="las-mobile-detail-links">
                ${task.teacher_file ? fileRow('Teacher attachment', 'From your teacher',
                    `viewDocument('${escapeLearnerAssignmentJsString(task.teacher_file)}', 'Teacher Attachment: ${escapeLearnerAssignmentJsString(task.title)}')`) : ''}
                ${task.submission_file ? fileRow('My submission', 'Tap to view your work',
                    `viewDocument('${escapeLearnerAssignmentJsString(task.submission_file)}', 'My Submission: ${escapeLearnerAssignmentJsString(task.title)}')`) : ''}
            </div>
            ${task.is_past_due
                ? `<span class="las-mobile-detail-action las-mobile-detail-action--locked">${actionLabel}</span>`
                : `<button type="button" class="las-mobile-detail-action" onclick="openLearnerAssignmentInlineForm(event, '${submissionFormId}')">${actionLabel}</button>
                   ${learnerAssignmentSubmissionFormMarkup(task, submissionFormId)}`}
        </article>`;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
};

window.openMobileLearnerAssignmentById = function(assignmentId) {
    const targetId = String(assignmentId || '');
    const flatIdx = (window._allLearnerAssignmentsFlat || []).findIndex(task => String(task.id) === targetId);
    if (flatIdx >= 0) {
        window.openMobileLearnerAssignment(flatIdx);
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DESKTOP LIST: urgency groups, filter chips, search
// ─────────────────────────────────────────────
window._lasFilter = 'all';
window._lasTerm = '';
window._lasEditingId = null;

function lasDueMs(task) { return parseLearnerAssignmentTime(task.due_date) || 0; }

function lasDaysLeft(task) {
    const due = lasDueMs(task);
    if (!due) return null;
    const a = new Date(); a.setHours(0, 0, 0, 0);
    const b = new Date(due); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
}

function lasFmtDay(ms) {
    const d = new Date(ms);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleString('en-GB', { month: 'short' });
}

function lasFmtDue(task) {
    const ms = lasDueMs(task);
    if (!ms) return 'No due date';
    const d = new Date(ms);
    return lasFmtDay(ms) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function lasTaskState(task) {
    const done = hasLearnerAssignmentSubmission(task);
    const days = lasDaysLeft(task);
    if (done) return { key: 'done', group: 'Submitted', color: '#22c55e', badge: 'Done', days };
    if (task.is_past_due) return { key: 'closed', group: 'Closed', color: '#7a7b73', badge: 'Closed', days };
    let badge = 'No due date';
    if (days !== null) {
        badge = days < 0 ? 'Overdue' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : lasFmtDay(lasDueMs(task)).replace(/^\w+ /, '');
    }
    return {
        key: 'todo',
        group: days !== null && days <= 7 ? 'Due soon' : 'Later',
        color: days !== null && days <= 3 ? '#f4776f' : '#c2c3b7',
        badge, days
    };
}

function lasRelText(s) {
    if (s.key === 'done') return 'Submitted';
    if (s.key === 'closed') return 'Closed';
    if (s.days === null) return 'No due date';
    if (s.days < 0) return 'Overdue';
    if (s.days === 0) return 'Due today';
    if (s.days === 1) return 'Due tomorrow';
    return 'Due in ' + s.days + ' days';
}

window.lasRenderDesktopList = function () {
    const list = document.getElementById('las-list');
    if (!list) return;
    const keepScroll = list.scrollTop;
    const term = window._lasTerm;
    const items = (window._allLearnerAssignmentsFlat || []).map((task, idx) => ({ task, idx, s: lasTaskState(task) }));
    const showActive = !!document.querySelector('#las-main-panel .las-dh');

    const counts = { all: items.length, todo: 0, done: 0, closed: 0 };
    items.forEach(i => { counts[i.s.key]++; });
    const chipsEl = document.getElementById('las-chips');
    if (chipsEl) {
        chipsEl.innerHTML = [['all', 'All'], ['todo', 'To do'], ['done', 'Submitted'], ['closed', 'Closed']]
            .map(([k, label]) => `<button type="button" class="las-chip${window._lasFilter === k ? ' on' : ''}" onclick="lasSetFilter('${k}')">${label} ${counts[k]}</button>`)
            .join('');
    }

    const visible = items.filter(i =>
        (window._lasFilter === 'all' || i.s.key === window._lasFilter) &&
        (!term || `${i.task.title || ''} ${i.task.class_name || ''} ${i.task.teacher || ''}`.toLowerCase().includes(term))
    );

    // Group by teacher, in the order the page already sorts them (most recent work first),
    // the same way the teacher pages group by class. Rows keep the flat order inside a group.
    const groups = [];
    const byTeacher = new Map();
    visible.forEach(item => {
        const teacher = item.task.teacher || 'Teacher';
        let g = byTeacher.get(teacher);
        if (!g) { g = { teacher, rows: [] }; byTeacher.set(teacher, g); groups.push(g); }
        g.rows.push(item);
    });

    if (!window._lasCollapsed) window._lasCollapsed = new Set();
    const STATE_TEXT = { done: 'Submitted', closed: 'Closed', todo: 'Not submitted' };
    const CHEV = '<svg class="las-gl-chev" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    let html = '';
    groups.forEach(({ teacher, rows }) => {
        // a search always shows every match, whatever was folded away
        const collapsed = !term && window._lasCollapsed.has(teacher);
        html += `
            <div class="las-group">
                <div class="las-gl" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}"
                     data-teacher="${escapeLearnerAssignmentHtml(teacher)}"
                     onclick="lasToggleGroup(this)" onkeydown="lasGroupKeydown(event, this)">
                    ${CHEV}<span class="las-gl-name">${escapeLearnerAssignmentHtml(teacher)}</span>
                </div>
                <div class="las-gb${collapsed ? ' collapsed' : ''}">`;
        rows.forEach(({ task, idx, s }) => {
            const active = showActive && idx === window._learnerAssignmentSelectedIdx ? ' active' : '';
            const stateText = STATE_TEXT[s.key] || '';
            html += `
                    <div class="las-sidebar-item${active}" id="las-sidebar-${idx}" onclick="selectDesktopLearnerAssignment(${idx})">
                        <span class="las-sidebar-dot${s.key === 'done' ? ' is-done' : ''}" role="img" aria-label="${stateText}" title="${stateText}"></span>
                        <div class="las-sidebar-item-info">
                            <div class="las-sidebar-item-title">${task.title}</div>
                            <div class="las-sidebar-item-meta">${escapeLearnerAssignmentHtml(formatAssignmentDueDate(task.due_date))}</div>
                        </div>
                    </div>`;
        });
        html += `
                </div>
            </div>`;
    });
    list.innerHTML = html || `<div class="las-list-empty">${items.length ? 'No assignments match.' : "Your teachers haven't posted any assignments yet."}</div>`;
    list.scrollTop = keepScroll;
};

// Fold / unfold one teacher group. The DOM is updated in place so the list does not jump.
window.lasToggleGroup = function (headerEl) {
    if (!headerEl) return;
    const body = headerEl.nextElementSibling;
    if (!body) return;
    const teacher = headerEl.dataset.teacher || '';
    if (!window._lasCollapsed) window._lasCollapsed = new Set();
    const nowCollapsed = !body.classList.contains('collapsed');
    body.classList.toggle('collapsed', nowCollapsed);
    headerEl.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    if (nowCollapsed) window._lasCollapsed.add(teacher);
    else window._lasCollapsed.delete(teacher);
    saveAssignmentPageState();
};

window.lasGroupKeydown = function (e, headerEl) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    window.lasToggleGroup(headerEl);
};

window.lasSetFilter = function (key) {
    window._lasFilter = key;
    window.lasRenderDesktopList();
};

window.lasDesktopSearch = function (val) {
    window._lasTerm = String(val || '').toLowerCase().trim();
    window.lasRenderDesktopList();
};

// ↑ / ↓ move through the list
window.lasListKeydown = function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // rows inside a folded group are hidden, so ↑ / ↓ step over them
    const ids = Array.from(document.querySelectorAll('#las-list .las-sidebar-item'))
        .filter(el => el.offsetParent !== null)
        .map(el => parseInt(el.id.replace('las-sidebar-', ''), 10));
    if (!ids.length) return;
    e.preventDefault();
    const cur = ids.indexOf(window._learnerAssignmentSelectedIdx);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, cur + 1) : Math.max(0, cur < 0 ? 0 : cur - 1);
    window.selectDesktopLearnerAssignment(ids[next]);
    const el = document.getElementById(`las-sidebar-${ids[next]}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
};

// Desktop never shows an empty detail pane when there's something to show
window.lasEnsureSelection = function () {
    if (window.innerWidth < 900) return;
    if (document.querySelector('#las-list .las-sidebar-item.active')) return;
    const first = Array.from(document.querySelectorAll('#las-list .las-sidebar-item')).find(el => el.offsetParent !== null);
    if (first) window.selectDesktopLearnerAssignment(parseInt(first.id.replace('las-sidebar-', ''), 10));
};

// Drag (or ← / →) to resize the list; width is remembered and shared with Quiz
window.lasInitSplit = function () {
    const layout = document.getElementById('las-desktop-layout');
    const split = document.getElementById('las-split');
    if (!layout || !split) return;
    const clamp = w => Math.max(260, Math.min(420, w));
    const apply = w => layout.style.setProperty('--las-listw', clamp(w) + 'px');
    const current = () => parseInt(getComputedStyle(layout).getPropertyValue('--las-listw'), 10) || 320;
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

window.lasInitDesktop = function () {
    window._lasFilter = 'all';
    window._lasTerm = '';
    window._lasEditingId = null;
    // keep which teacher groups are folded if the page is rebuilt (restore may overwrite it)
    if (!window._lasCollapsed) window._lasCollapsed = new Set();
    window.lasRenderDesktopList();
    window.lasInitSplit();
};

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
function lasAttr(v) { return escapeLearnerAssignmentJsString(v).replace(/"/g, '&quot;'); }

function lasFileName(path) {
    try { return decodeURIComponent(String(path).split('?')[0].split('/').pop()) || 'File'; }
    catch (e) { return 'File'; }
}

const LAS_ICON_FILE = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
const LAS_ICON_OK = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

function lasFileCard(path, caption, docTitle, btnLabel) {
    return `
        <div class="las-file">
            <span class="las-fi">${LAS_ICON_FILE}</span>
            <span class="las-fx"><b>${escapeLearnerAssignmentHtml(lasFileName(path))}</b><small>${escapeLearnerAssignmentHtml(caption)}</small></span>
            <button type="button" class="las-btn2" onclick="viewDocument('${lasAttr(path)}', '${lasAttr(docTitle)}')">${btnLabel}</button>
        </div>`;
}

function lasComposerMarkup(task, formId, editing) {
    const hasSub = hasLearnerAssignmentSubmission(task);
    const currentFile = task.submission_file
        ? `<p class="las-comp-hint">Current file: <a href="javascript:void(0)" onclick="viewDocument('${lasAttr(task.submission_file)}', 'My Submission: ${lasAttr(task.title)}')">${escapeLearnerAssignmentHtml(lasFileName(task.submission_file))}</a>. Choose a new file to replace it.</p>`
        : '';
    return `
        <form id="${formId}" class="las-comp" action="submit_assignment.php?assignment_id=${encodeURIComponent(task.id)}" enctype="multipart/form-data" onsubmit="submitLearnerAssignmentInline(event, this)">
            <label class="las-lbl las-lbl--first" for="${formId}-text">Written response <em>(optional)</em></label>
            <textarea id="${formId}-text" class="las-comp-textarea" name="submission_text" placeholder="Write your response here...">${escapeLearnerAssignmentHtml(task.submission_text || '')}</textarea>
            <label class="las-lbl" for="${formId}-file">File <em>(optional)</em></label>
            <input id="${formId}-file" class="las-comp-file" type="file" name="submission_file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip">
            <p class="las-comp-hint">PDF, Word, PowerPoint, images or ZIP. Up to 50 MB.</p>
            ${currentFile}
            <p class="las-submission-error" role="alert" hidden></p>
            <div class="las-comp-actions">
                ${editing ? '<button type="button" class="las-comp-cancel" onclick="lasCancelEdit()">Cancel</button>' : ''}
                <button type="submit" class="las-comp-submit btn-loadable">
                    <span class="btn-label">${hasSub ? 'Update submission' : 'Submit assignment'}</span>
                    ${learnerAssignmentSpinnerMarkup()}
                </button>
            </div>
        </form>`;
}

window.lasFocusComposer = function (formId) {
    const ta = document.querySelector(`#${formId} .las-comp-textarea`);
    if (!ta) return;
    ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ta.focus({ preventScroll: true });
};

window.lasStartEdit = function (taskId) {
    const idx = (window._allLearnerAssignmentsFlat || []).findIndex(t => String(t.id) === String(taskId));
    if (idx < 0) return;
    window._lasEditingId = taskId;
    window.selectDesktopLearnerAssignment(idx);
    window.lasFocusComposer(`las-desktop-submission-${taskId}`);
};

window.lasCancelEdit = function () {
    window._lasEditingId = null;
    window.selectDesktopLearnerAssignment(window._learnerAssignmentSelectedIdx);
};

window.selectDesktopLearnerAssignment = function(flatIdx) {
    const task = (window._allLearnerAssignmentsFlat || [])[flatIdx];
    if (!task) return;
    if (window._learnerAssignmentSelectedIdx !== flatIdx && String(window._lasEditingId) !== String(task.id)) {
        window._lasEditingId = null;
    }
    window._learnerAssignmentSelectedIdx = flatIdx;
    saveAssignmentPageState();
    document.querySelectorAll('.las-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`las-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const panel = document.getElementById('las-main-panel');
    if (!panel) return;

    const s = lasTaskState(task);
    const isDone = hasLearnerAssignmentSubmission(task);
    const isClosed = !!task.is_past_due;
    const editing = String(window._lasEditingId) === String(task.id) && !isClosed;
    const formId = `las-desktop-submission-${task.id}`;
    const sender = task.teacher || 'Teacher';

    // ── Status chip ──
    let statusLabel = 'Not submitted', statusDot = '#9b9c92', statusCls = '';
    if (isDone) { statusLabel = 'Submitted'; statusDot = '#22c55e'; statusCls = ' las-panel-status--ok'; }
    else if (isClosed) { statusLabel = 'Closed'; statusDot = '#7a7b73'; }

    // ── Primary action (sticky header, right-aligned) ──
    let actionHtml;
    if (isClosed) actionHtml = '<span class="las-act-text">Submission closed</span>';
    else if (isDone) actionHtml = `<button type="button" class="las-pri" onclick="lasStartEdit('${lasAttr(task.id)}')">Update submission</button>`;
    else actionHtml = `<button type="button" class="las-pri" onclick="lasFocusComposer('${formId}')">Add your work</button>`;

    // ── Body ──
    const desc = task.description ? task.description.replace(/\n/g, '<br>') : 'No description provided.';
    let body = `<p class="las-lead">${desc}</p>`;

    if (task.teacher_file) {
        body += `<div class="las-h3">Attachment</div>` +
            lasFileCard(task.teacher_file, 'From ' + sender, 'Teacher Attachment: ' + task.title, 'Open');
    }

    body += `<div class="las-h3">Your work</div>`;
    if (isDone && !editing) {
        const when = task.submitted_at ? ' ' + escapeLearnerAssignmentHtml(formatLearnerAssignmentPostedDate(task.submitted_at)) : '';
        body += `
            <div class="las-comp">
                <div class="las-okrow">${LAS_ICON_OK}<span>Submitted${when}</span></div>
                ${task.submission_file ? lasFileCard(task.submission_file, 'Your upload', 'My Submission: ' + task.title, 'View') : ''}
                ${task.submission_text ? `<p class="las-subtxt">${escapeLearnerAssignmentHtml(task.submission_text)}</p>` : ''}
            </div>`;
    } else if (isClosed) {
        body += `<p class="las-muted">The deadline has passed and no work was submitted. Speak to ${escapeLearnerAssignmentHtml(sender)} if you think this is a mistake.</p>`;
    } else {
        body += lasComposerMarkup(task, formId, editing);
    }

    // ── Context rail ──
    const posted = task.created_at ? formatLearnerAssignmentPostedDate(task.created_at) : '';
    const rail = `
        <aside class="las-rail">
            <h4>Details</h4>
            <div class="las-kv"><span>Class</span><b>${task.class_name || ''}</b></div>
            <div class="las-kv"><span>Teacher</span><b>${escapeLearnerAssignmentHtml(sender)}</b></div>
            <div class="las-kv"><span>Due</span><b>${escapeLearnerAssignmentHtml(lasFmtDue(task))}</b></div>
            <div class="las-kv"><span>Time left</span><b style="color:${s.color};">${escapeLearnerAssignmentHtml(lasRelText(s))}</b></div>
            ${posted ? `<div class="las-kv"><span>Posted</span><b>${escapeLearnerAssignmentHtml(posted)}</b></div>` : ''}
            ${task.submitted_at ? `<div class="las-kv"><span>Submitted</span><b>${escapeLearnerAssignmentHtml(formatLearnerAssignmentPostedDate(task.submitted_at))}</b></div>` : ''}
        </aside>`;

    panel.innerHTML = `
        <div class="las-dh">
            <h2 class="las-dh-title">${task.title}</h2>
            <span class="las-panel-status${statusCls}"><span class="las-panel-status-dot" style="background:${statusDot};"></span>${statusLabel}</span>
            <span class="las-dsp"></span>
            ${actionHtml}
        </div>
        <div class="las-dbody">
            <div class="las-body"><div class="las-read">${body}</div></div>
            ${rail}
        </div>`;

    // Keep the selected row visible inside the list (scrolls the list only)
    const listBox = document.getElementById('las-list');
    // (a row inside a folded group has no box, so there is nothing to scroll to)
    if (listBox && sidebarItem && sidebarItem.offsetParent !== null) {
        const top = sidebarItem.offsetTop, bottom = top + sidebarItem.offsetHeight;
        if (top < listBox.scrollTop + 34) listBox.scrollTop = Math.max(0, top - 34);
        else if (bottom > listBox.scrollTop + listBox.clientHeight) listBox.scrollTop = bottom - listBox.clientHeight;
    }
    if (window.learnerPageState) wireAssignmentScrollState();
};

// Desktop type is Geist 300/400/500 (see assignments.css). Nunito stays loaded for the mobile views.
function lasEnsureFont() {
    if (!document.getElementById('las-geist-font')) {
        const g = document.createElement('link');
        g.id = 'las-geist-font';
        g.rel = 'stylesheet';
        g.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap';
        document.head.appendChild(g);
    }
    if (document.getElementById('las-nunito-font')) return;
    const link = document.createElement('link');
    link.id = 'las-nunito-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
}