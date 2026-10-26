function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherAssignmentsCache = null;
window.teacherAssignmentsCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherAssignments = function () {
    if (window.teacherAssignmentsCache) return;
    if (window.teacherAssignmentsCachePromise) return;
    window.teacherAssignmentsCachePromise = fetch('api/teacher/get_assignments.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherAssignmentsCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherAssignmentsCachePromise = null; });
};

// ─────────────────────────────────────────────
// ASSIGNMENTS LIST
// ─────────────────────────────────────────────
window.fetchTeacherAssignments = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_assignments");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_assignments");

    // Restore standard chrome (hamburger, brand, bottom nav) any time this
    // list is (re)loaded. This is also the mobile "back" target dispatched
    // from handleTeacherHeaderBack when detailType === 'Assignment', so
    // without this reset the header/bottom nav stay stuck in whatever
    // 'detail' mode openMobileTeacherAssignment last left them in.
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ title: 'Assignments', mode: 'standard', color: '#a78bfa' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAssignmentsCache) {
        renderTeacherAssignments(window.teacherAssignmentsCache);
        return;
    }

    try {
        if (!window.teacherAssignmentsCachePromise) {
            window.teacherAssignmentsCachePromise = fetch('api/teacher/get_assignments.php')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch');
                    return res.json();
                })
                .then(data => {
                    window.teacherAssignmentsCache = data;
                    return data;
                })
                .finally(() => { window.teacherAssignmentsCachePromise = null; });
        }
        const data = await window.teacherAssignmentsCachePromise;
        renderTeacherAssignments(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p class="as-error-message">
                Error loading assignments.
            </p>`;
    }
};

/**
 * Groups the flat assignments array by class_name, keeping each item's
 * original index into window._allAssignmentsFlat so any code working
 * off that flat array (selectDesktopAssignment, the mobile detail view)
 * keeps working unchanged regardless of how the list is grouped for
 * display. Shared by both the desktop sidebar and the mobile folder
 * list so grouping logic — and the resulting group order — only exists
 * in one place.
 * @param {Array} data - the flat assignments array (window._allAssignmentsFlat)
 * @returns {Map<string, Array<{assignment: object, index: number}>>}
 */
function groupTeacherAssignmentsByClass(data) {
    const groupsByClass = new Map();
    (data || []).forEach((assignment, index) => {
        const key = assignment.class_name || 'Other';
        if (!groupsByClass.has(key)) groupsByClass.set(key, []);
        groupsByClass.get(key).push({ assignment, index });
    });
    return groupsByClass;
}

/** submitted_count/total_learners -> a percent + the traffic-light color
 * used consistently across sidebar dots, mobile rows, and both detail
 * panels. Centralised so the three thresholds only ever live in one place. */
function getTeacherAssignmentProgress(assignment) {
    const total = assignment.total_learners || 0;
    const submitted = assignment.submitted_count || 0;
    const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const color = percent === 100 ? '#22c55e' : percent >= 50 ? '#f39c12' : '#4fd1c5';
    return { percent, color, submitted, total };
}

function renderTeacherAssignments(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Store flat list for desktop panel lookup ──
    window._allAssignmentsFlat = data || [];

    const groupsByClass = groupTeacherAssignmentsByClass(data);

    // ── Build left sidebar list (desktop) ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state as-empty-state-inline">No assignments created yet.</p>`;
    } else {
        let classGroupIdx = 0;
        groupsByClass.forEach((entries, className) => {
            const classGroupId = `as-class-group-${classGroupIdx++}`;
            let itemsHtml = '';
            entries.forEach(({ assignment, index }) => {
                const { submitted, total } = getTeacherAssignmentProgress(assignment);
                const allIn = total > 0 && submitted >= total;
                const dotLabel = allIn ? 'Every learner has submitted' : 'Waiting on submissions';

                itemsHtml += `
                    <div class="as-sidebar-item" id="as-sidebar-${index}"
                        data-title="${escapeTeacherAssignmentHtml(assignment.title)}"
                        onclick="selectDesktopAssignment(${index})">
                        <span class="as-sidebar-dot${allIn ? ' is-done' : ''}" role="img" aria-label="${dotLabel}" title="${dotLabel}"></span>
                        <div class="as-sidebar-item-info">
                            <div class="as-sidebar-item-title">${assignment.title}</div>
                            <div class="as-sidebar-item-meta">Due ${assignment.due_date}</div>
                        </div>
                    </div>`;
            });
            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                'as-sidebar-class-label',
                className,
                itemsHtml
            );
        });
    }

    // ── Empty-state copy for the desktop main panel ──
    const assignmentCount = (data || []).length;
    const waitingCount = (data || []).filter(a => (a.submitted_count || 0) < (a.total_learners || 0)).length;
    const emptyTitle = assignmentCount ? 'Pick an assignment' : 'No assignments yet';
    const emptyBody = assignmentCount
        ? `${assignmentCount} ${assignmentCount === 1 ? 'assignment' : 'assignments'} across your classes. ` +
          (waitingCount
              ? `${waitingCount} ${waitingCount === 1 ? 'is' : 'are'} still waiting on submissions.`
              : 'Every learner has submitted.')
        : 'Create one and it will show up in the list, grouped by class.';
    const emptyCta = assignmentCount ? 'Create an assignment' : 'Create your first assignment';

    // ── Build full HTML ──
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="as-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="as-sidebar tchr-flat-sidebar">
                <div class="as-sidebar-header">
                    <span>Assignments</span>
                    <button class="teacher-upload-btn teacher-desktop-create as-new-btn" id="as-new-btn" onclick="openCreateAssignment()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                ${window.buildTeacherSearchBar('as', { placeholder: 'Search assignments...' })}
                <div class="as-sidebar-scroll">${sidebarHtml}</div>
            </div>

            <!-- Right Main Panel -->
            <div class="as-main-panel tchr-flat-panel" id="as-main-panel">
                <div class="as-panel-empty">
                    <h2 class="as-panel-empty-title">${emptyTitle}</h2>
                    <p class="as-panel-empty-body">${emptyBody}</p>
                    <button type="button" class="as-dp-btn as-dp-btn--primary" onclick="openCreateAssignment()">
                        ${asDpIcon('plus', 14)}${emptyCta}
                    </button>
                </div>
            </div>

            <!-- railId lets selectDesktopAssignment() swap this to
                 selection-specific copy via updateInfoRail(). -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Assignments', `
                <p>The submissions table shows every learner in the class, even those who haven't submitted yet, so you can see who's still missing.</p>
                <p>Use <strong>Download all</strong> to export all files for a single assignment in one go.</p>
            `, 'as-rail') : ''}
        </div>

        <div id="deleteAssignmentModal" class="teacher-modal-overlay as-modal-hidden">
            <div class="teacher-modal-box as-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Assignment</span>
                    <button onclick="closeDeleteAssignmentModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="as-delete-modal-text">Are you sure you want to delete this assignment? Learner submissions for it will also be removed. This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteAssignmentModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteAssignment()" class="teacher-modal-submit as-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══
             Grouped by class (same grouping as the desktop sidebar,
             built once above and reused here) with tap-to-detail-page
             navigation, matching the learner app's pattern instead of
             the old inline expand/collapse drawer. -->
        <div class="as-mobile-list">
            ${window.buildTeacherSearchBar('as', { mobile: true, placeholder: 'Search assignments...' })}`;

    if (!data || data.length === 0) {
        html += `
            <div class="as-mobile-empty">
                <svg viewBox="0 0 24 24" width="46" height="46" stroke="#4fd1c5" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <p class="as-mobile-empty-title">No assignments yet</p>
                <p class="as-mobile-empty-body">Create an assignment to see it listed here by class.</p>
            </div>`;
    } else {
        let mobileGroupIdx = 0;
        groupsByClass.forEach((entries, className) => {
            // Separate id namespace from the desktop groups
            // (as-class-group-N) so the two never collide if both
            // happen to be in the DOM at once (e.g. during a resize),
            // and so collapse state persisted per-id in
            // teacherSectionState.collapsedGroups doesn't get shared
            // between a desktop sidebar group and its mobile folder
            // counterpart for the same class.
            const groupId = `as-mobile-class-group-${mobileGroupIdx++}`;

            let itemsHtml = '';
            entries.forEach(({ assignment, index }) => {
                const { percent: subPercent, submitted: subCount, total: totalCount } =
                    getTeacherAssignmentProgress(assignment);

                itemsHtml += `
                    <div class="as-mobile-row" role="button" tabindex="0"
                        data-title="${escapeTeacherAssignmentHtml(assignment.title)}"
                        onclick="openMobileTeacherAssignment(${index})"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherAssignment(${index});}">
                        <div class="as-mobile-row-icon">
                            <svg viewBox="0 0 24 24" width="23" height="23" stroke="#73746d" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                        </div>
                        <div class="as-mobile-row-body">
                            <div class="as-mobile-row-title">${escapeTeacherAssignmentHtml(assignment.title)}</div>
                            <div class="as-mobile-row-meta">Due ${escapeTeacherAssignmentHtml(assignment.due_date)}</div>
                            <div class="as-mobile-row-progress">
                                <div class="as-mobile-row-progress-bar">
                                    <div class="as-mobile-row-progress-fill"
                                        style="--as-progress-width:${subPercent}%;--as-progress-color:#73746d;"></div>
                                </div>
                                <span class="as-mobile-row-progress-label" style="--as-progress-color:#73746d;">${subCount}/${totalCount}</span>
                            </div>
                        </div>
                        <div class="as-mobile-row-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
            });

            const folderIcon = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#73746d" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="as-mobile-folder-icon">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>`;

            html += window.buildCollapsibleClassGroup(
                groupId,
                'as-mobile-folder-label',
                `${folderIcon}<span class="as-mobile-folder-name">${escapeTeacherAssignmentHtml(className)}</span><span class="as-mobile-folder-count">${entries.length}</span>`,
                itemsHtml
            );
        });
    }

    html += `</div>`; // close .as-mobile-list

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    if (typeof applyTeacherRailCollapsedState === 'function') applyTeacherRailCollapsedState();
    if (typeof window.wireTeacherSearchBar === 'function') window.wireTeacherSearchBar('as');

    const sidebarScrollEl = apiArea.querySelector('.as-sidebar-scroll');
    window.wireTeacherSectionScroll('assignments-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('assignments-sidebar', sidebarScrollEl);

    // Restore whichever assignment was selected before navigating
    // away/refreshing. Re-derive its current array index from the
    // saved stable id rather than storing the index itself, since the
    // index can shift if assignments are added/removed/reordered.
    const savedId = window.teacherSectionState.selection.assignments;
    if (savedId) {
        const index = window._allAssignmentsFlat.findIndex(a => a.id == savedId);
        if (index !== -1) selectDesktopAssignment(index);
    }
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSIGNMENT
// ─────────────────────────────────────────────
/**
 * Escapes text for safe HTML interpolation. The rest of this file
 * predates this rebuild and interpolates most fields unescaped — left
 * as-is here since fixing that everywhere is a separate, larger cleanup
 * outside this task's scope. New mobile markup added as part of this
 * rebuild uses this helper for anything derived from teacher/learner-
 * entered text (titles, class names, due dates as free text).
 */
function escapeTeacherAssignmentHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

/**
 * Builds the <tr> rows of the learner submissions table for one
 * assignment. Shared by the desktop panel (selectDesktopAssignment)
 * and the mobile detail view (openMobileTeacherAssignment) so this
 * table's markup only exists in one place instead of being kept in
 * sync by hand in two.
 * @param {Array} submissions - assignment.submissions
 * @param {string} audioClass - extra class for the <audio> element,
 *   since desktop and the old mobile card used slightly different
 *   sizing (as-sub-audio--panel vs as-sub-audio). Pass '' for the
 *   plain .as-sub-audio sizing.
 * @returns {string}
 */
function buildTeacherSubmissionsTableRows(submissions, audioClass) {
    let tableRows = '';
    (submissions || []).forEach(sub => {
        const statusBadge = sub.submitted
            ? `<span class="teacher-sub-badge submitted">Submitted</span>
               <div class="as-sub-timestamp">${sub.submitted_at}</div>`
            : `<span class="teacher-sub-badge not-submitted">Not Submitted</span>`;

        let subContent = '—';
        if (sub.submitted) {
            if (sub.submission_type === 'file' && sub.file_url) {
                subContent = `<a href="${sub.file_url}" target="_blank" class="teacher-sub-file-link">View File</a>`;
            } else if (sub.submission_type === 'text' && sub.text_answer) {
                subContent = `<div class="teacher-sub-text">${sub.text_answer.replace(/\n/g, '<br>')}</div>`;
            } else if (sub.submission_type === 'audio' && sub.audio_url) {
                subContent = `<audio controls class="as-sub-audio ${audioClass || ''}"><source src="${sub.audio_url}" type="audio/mpeg"></audio>`;
            }
        }

        tableRows += `
            <tr>
                <td>${sub.name}</td>
                <td>${statusBadge}</td>
                <td class="as-sub-type-cell">${sub.submission_type || '—'}</td>
                <td>${subContent}</td>
            </tr>`;
    });
    return tableRows;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL HELPERS
// (desktop only: the mobile detail page keeps using
//  buildTeacherSubmissionsTableRows above)
// ─────────────────────────────────────────────

/** Small inline stroke icon, same 24x24 / 1.75 stroke family as the sidebar. */
function asDpIcon(name, size) {
    const paths = {
        clip:     '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        file:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
        plus:     '<path d="M12 5v14M5 12h14"/>'
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

/** get_assignments.php sends due_date as PHP date('d M Y, g:i A'), e.g.
 * "03 Oct 2026, 4:00 PM". That exact shape is parsed by hand: new Date() on it
 * isn't reliable in every browser (Safari in particular). Returns null for any
 * other shape. */
function parseAssignmentDueDate(raw) {
    const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{1,2}):(\d{2}) ?(AM|PM)$/i.exec(raw);
    if (!m) return null;
    const mon = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        .indexOf(m[2].toLowerCase());
    if (mon < 0) return null;
    let hour = parseInt(m[4], 10) % 12;
    if (m[6].toUpperCase() === 'PM') hour += 12;
    return new Date(parseInt(m[3], 10), mon, parseInt(m[1], 10), hour, parseInt(m[5], 10));
}

/** "Due in 2 days" / "Due today" / "Due 3 days ago". Any other date shape falls
 * back to new Date(), but only when it has a year and isn't a day/month order
 * that could be read two ways. Returns '' otherwise, so a wrong pill is never shown. */
function getAssignmentDueLabel(rawDue) {
    const raw = String(rawDue || '').trim();
    if (!raw) return '';
    let due = parseAssignmentDueDate(raw);
    if (!due) {
        if (!/\b(19|20)\d{2}\b/.test(raw)) return '';
        if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(raw)) return '';
        due = new Date(raw);
    }
    if (isNaN(due.getTime())) return '';
    const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((dayStart(due) - dayStart(new Date())) / 86400000);
    if (days === 0)  return 'Due today';
    if (days === 1)  return 'Due tomorrow';
    if (days === -1) return 'Due yesterday';
    return days > 1 ? `Due in ${days} days` : `Due ${-days} days ago`;
}

function getAssignmentFileName(url) {
    try { return decodeURIComponent(String(url).split('?')[0].split('/').pop()) || ''; }
    catch (e) { return ''; }
}

/** The "Submission" cell for one learner. Everything learner-entered is escaped. */
function buildDesktopSubmissionCell(sub) {
    const esc = escapeTeacherAssignmentHtml;
    if (!sub.submitted) return '<span class="as-dp-none">No submission</span>';

    if (sub.submission_type === 'file' && sub.file_url) {
        return `<a class="as-dp-link" href="${esc(sub.file_url)}" target="_blank" rel="noopener">${asDpIcon('file', 14)}View file</a>`;
    }
    if (sub.submission_type === 'text' && sub.text_answer) {
        return `<button type="button" class="as-dp-tx-btn" aria-expanded="false" onclick="toggleAssignmentTextAnswer(this)">
                    <span class="as-dp-tx">${esc(sub.text_answer)}</span>
                </button>`;
    }
    if (sub.submission_type === 'audio' && sub.audio_url) {
        return `<div class="as-dp-audio-wrap">
                    <audio preload="metadata"><source src="${esc(sub.audio_url)}" type="audio/mpeg"></audio>
                    <button type="button" class="as-dp-audio" aria-pressed="false"
                        aria-label="Play recording from ${esc(sub.name)}" onclick="toggleAssignmentAudio(this)">
                        <span class="as-dp-audio-icon">
                            <svg class="as-dp-ico-play" viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>
                            <svg class="as-dp-ico-pause" viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M7 4h3v16H7zM14 4h3v16h-3z"/></svg>
                        </span>
                        <span class="as-dp-audio-bar"><i></i></span>
                        <span class="as-dp-audio-time">Play</span>
                    </button>
                </div>`;
    }
    return '<span class="as-dp-none">&mdash;</span>';
}

/** <tr> rows for the desktop submissions table. filter: 'all' | 'in' | 'out'. */
function buildDesktopSubmissionRows(submissions, filter) {
    const esc = escapeTeacherAssignmentHtml;
    const list = (submissions || []).filter(s => filter === 'all' || (filter === 'in') === !!s.submitted);

    if (!list.length) {
        const msg = filter === 'in'  ? 'No one has submitted yet.'
                  : filter === 'out' ? 'Everyone has submitted.'
                  : 'No learners to show.';
        return `<tr><td colspan="4" class="as-dp-table-empty">${msg}</td></tr>`;
    }

    return list.map(sub => {
        const done = !!sub.submitted;
        const status = done
            ? `<span class="as-dp-status-main"><span class="as-dp-dot"></span>Submitted</span>${sub.submitted_at ? `<small>${esc(sub.submitted_at)}</small>` : ''}`
            : `<span class="as-dp-status-main"><span class="as-dp-ring"></span>Not submitted</span>`;
        return `
            <tr class="${done ? '' : 'is-missing'}">
                <td class="as-dp-name">${esc(sub.name)}</td>
                <td><div class="as-dp-status">${status}</div></td>
                <td class="as-dp-c-type as-dp-type">${done ? esc(sub.submission_type || '') : ''}</td>
                <td>${buildDesktopSubmissionCell(sub)}</td>
            </tr>`;
    }).join('');
}

/** Long text answers show two lines and open on click; short ones aren't made clickable. */
function markShortAssignmentTexts(scope) {
    scope.querySelectorAll('.as-dp-tx').forEach(span => {
        if (span.scrollHeight <= span.clientHeight + 1) {
            const btn = span.parentElement;
            btn.classList.add('is-short');
            btn.removeAttribute('aria-expanded');
            btn.tabIndex = -1;
        }
    });
}

window.toggleAssignmentTextAnswer = function(btn) {
    if (btn.classList.contains('is-short')) return;
    btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
};

/** Compact play pill backed by a real (hidden) <audio>: one recording plays at a time. */
window.toggleAssignmentAudio = function(btn) {
    const audio = btn.parentElement.querySelector('audio');
    if (!audio) return;
    if (audio.paused) {
        audio.play().catch(() => {
            btn.parentElement.classList.add('is-error');
            const t = btn.querySelector('.as-dp-audio-time');
            if (t) t.textContent = "Can't play";
        });
    } else {
        audio.pause();
    }
};

function wireAssignmentAudio(scope) {
    const fmt = s => isFinite(s)
        ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
        : '';
    scope.querySelectorAll('.as-dp-audio-wrap').forEach(wrap => {
        const audio = wrap.querySelector('audio');
        const btn   = wrap.querySelector('.as-dp-audio');
        const time  = wrap.querySelector('.as-dp-audio-time');
        if (!audio || !btn || !time) return;

        const idle = () => { time.textContent = fmt(audio.duration) || 'Play'; };

        audio.addEventListener('loadedmetadata', () => { if (audio.paused) idle(); });
        audio.addEventListener('play', () => {
            scope.querySelectorAll('.as-dp-audio-wrap audio').forEach(a => { if (a !== audio) a.pause(); });
            btn.setAttribute('aria-pressed', 'true');
        });
        audio.addEventListener('pause', () => btn.setAttribute('aria-pressed', 'false'));
        audio.addEventListener('timeupdate', () => {
            time.textContent = fmt(audio.currentTime);
            const p = isFinite(audio.duration) && audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
            btn.style.setProperty('--as-dp-p', p + '%');
        });
        audio.addEventListener('ended', () => {
            btn.setAttribute('aria-pressed', 'false');
            btn.style.setProperty('--as-dp-p', '0%');
            idle();
        });
        audio.addEventListener('error', () => {
            wrap.classList.add('is-error');
            time.textContent = "Can't play";
        });
    });
}

/** All / Submitted / Missing. Re-renders only the table rows, so scroll position stays put. */
window.setAssignmentSubFilter = function(filter) {
    const assignment = (window._allAssignmentsFlat || [])[window._asSelectedIndex];
    const body = document.getElementById('as-dp-rows');
    if (!assignment || !body) return;

    window._asSubFilter = filter;
    body.innerHTML = buildDesktopSubmissionRows(assignment.submissions, filter);
    document.querySelectorAll('#as-dp-filter button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
    });
    wireAssignmentAudio(body);
    markShortAssignmentTexts(body);
};

window.selectDesktopAssignment = function(index) {
    // Update sidebar active state
    document.querySelectorAll('.as-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('as-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`as-sidebar-${index}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const assignment = (window._allAssignmentsFlat || [])[index];
    if (!assignment) return;

    window.teacherSectionState.selection.assignments = assignment.id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('as-main-panel');
    if (!panel) return;

    window._asSelectedIndex = index;
    window._asSubFilter = 'all';

    const esc = escapeTeacherAssignmentHtml;
    const { percent, color, submitted: subCount, total: totalCount } =
        getTeacherAssignmentProgress(assignment);

    const subs     = assignment.submissions || [];
    const inCount  = subs.filter(s => s.submitted).length;
    const outCount = subs.length - inCount;

    const dueLabel   = getAssignmentDueLabel(assignment.due_date);
    const desc       = String(assignment.description || '').trim();
    const attachName = assignment.file_url ? getAssignmentFileName(assignment.file_url) : '';

    const submissionsHtml = (totalCount === 0 && subs.length === 0)
        ? `<p class="as-dp-note">No learners are in this class yet, so there is nothing to submit.</p>`
        : `
            <div class="as-dp-prog">
                <div class="as-dp-prog-num">${subCount} of ${totalCount}<span>${percent}% submitted</span></div>
                ${outCount > 0
                    ? `<button type="button" class="as-dp-btn" onclick="setAssignmentSubFilter('out')">Show the ${outCount} missing</button>`
                    : `<span class="as-dp-prog-done">Everyone has submitted</span>`}
            </div>
            <div class="as-dp-track"><i style="--as-dp-w:${percent}%;--as-dp-c:${color};"></i></div>

            <div class="as-dp-tools">
                <div class="as-dp-seg" id="as-dp-filter" role="group" aria-label="Filter submissions">
                    <button type="button" data-filter="all" aria-pressed="true"  onclick="setAssignmentSubFilter('all')">All ${subs.length}</button>
                    <button type="button" data-filter="in"  aria-pressed="false" onclick="setAssignmentSubFilter('in')">Submitted ${inCount}</button>
                    <button type="button" data-filter="out" aria-pressed="false" onclick="setAssignmentSubFilter('out')">Missing ${outCount}</button>
                </div>
            </div>

            <table class="as-dp-table" aria-label="Learner submissions">
                <colgroup>
                    <col class="as-dp-c-name"><col class="as-dp-c-status"><col class="as-dp-c-type"><col>
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col">Learner</th>
                        <th scope="col">Status</th>
                        <th scope="col" class="as-dp-c-type">Type</th>
                        <th scope="col">Submission</th>
                    </tr>
                </thead>
                <tbody id="as-dp-rows">${buildDesktopSubmissionRows(subs, 'all')}</tbody>
            </table>`;

    panel.innerHTML = `
        <div class="as-dp">
            <p class="as-dp-crumb">${esc(assignment.class_name)}</p>

            <div class="as-dp-head">
                <div class="as-dp-title-wrap">
                    <h2 class="as-dp-title">${esc(assignment.title)}</h2>
                </div>
                <div class="as-dp-actions">
                    ${assignment.file_url ? `
                        <a class="as-dp-btn" href="${esc(assignment.file_url)}" target="_blank" rel="noopener"${attachName ? ` title="${esc(attachName)}"` : ''}>
                            ${asDpIcon('clip', 14)}Attachment
                        </a>` : ''}
                    <button type="button" class="as-dp-btn as-dp-btn--primary"
                        ${subCount > 0 ? '' : 'disabled title="No submissions yet"'}
                        onclick="downloadSubmissions(${assignment.id})">
                        ${asDpIcon('download', 14)}Download all
                    </button>
                </div>
            </div>

            <div class="as-dp-due">
                ${dueLabel ? `<span class="as-dp-pill">${dueLabel}</span><span>${esc(assignment.due_date)}</span>`
                           : `<span>Due ${esc(assignment.due_date)}</span>`}
            </div>

            <section class="as-dp-section">
                <h3 class="as-dp-h">Instructions</h3>
                <p class="as-dp-desc${desc ? '' : ' is-empty'}">${desc ? esc(desc) : 'No instructions were added.'}</p>
            </section>

            <section class="as-dp-section">
                <h3 class="as-dp-h">Submissions</h3>
                ${submissionsHtml}
            </section>

            <section class="as-dp-section">
                <h3 class="as-dp-h">Delete</h3>
                <div class="as-dp-row">
                    <p>Permanently remove this assignment and every submission. This can't be undone.</p>
                    <button type="button" class="as-dp-btn as-dp-btn--danger" onclick="confirmDeleteAssignment(${assignment.id})">Delete assignment</button>
                </div>
            </section>
        </div>`;

    panel.scrollTop = 0;
    const rowsEl = document.getElementById('as-dp-rows');
    if (rowsEl) {
        wireAssignmentAudio(rowsEl);
        markShortAssignmentTexts(rowsEl);
    }

    // Swap the info rail to reflect this assignment's submission state,
    // instead of leaving it on the generic page-level copy.
    if (typeof updateInfoRail === 'function') {
        const missing = totalCount - subCount;
        if (missing > 0) {
            updateInfoRail('as-rail', 'Submissions Pending', `
                <p><strong>${missing}</strong> of ${totalCount} learners in ${esc(assignment.class_name)} haven't submitted yet — they're still shown in the table below so you can follow up.</p>
                <p>Use <strong>Download all</strong> once you're ready to grade what's in so far.</p>
            `);
        } else {
            updateInfoRail('as-rail', 'All Submissions In', `
                <p>All ${totalCount} learners in ${esc(assignment.class_name)} have submitted this assignment.</p>
                <p>Use <strong>Download all</strong> to export everything in one go.</p>
            `);
        }
    }
};

// ─────────────────────────────────────────────
// MOBILE DETAIL PAGE
// ─────────────────────────────────────────────
// Replaces the old toggleAssignmentSubmissions drawer/chevron
// expand-in-place behaviour. Tapping a row in the mobile list now
// navigates to a real detail page — same pattern as the learner
// app's openMobileLearnerAssignment — instead of expanding an inline
// panel on the list itself.
window.openMobileTeacherAssignment = function(index) {
    if (window.innerWidth > 899) return;

    const assignment = (window._allAssignmentsFlat || [])[index];
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (!assignment || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';

    sessionStorage.setItem('lastTeacherPage', 'teacher_assignments');
    window.teacherSectionState.selection.assignments = assignment.id;
    window.persistTeacherSectionState();

    window.configureTeacherHeader({
        title: 'Assignment',
        mode: 'detail',
        detailType: 'Assignment',
        backLabel: 'Assignments',
        color: '#a78bfa'
    });

    const { percent: subPercent, color: progressColor, submitted: subCount, total: totalCount } =
        getTeacherAssignmentProgress(assignment);

    const tableRows = buildTeacherSubmissionsTableRows(assignment.submissions, '');

    apiArea.innerHTML = `
        <article class="as-mobile-detail">
            <h1 class="as-mobile-detail-title">${escapeTeacherAssignmentHtml(assignment.title)}</h1>
            <div class="as-mobile-detail-meta">
                <span>${escapeTeacherAssignmentHtml(assignment.class_name)}</span>
                <span>&bull;</span>
                <span>Due ${escapeTeacherAssignmentHtml(assignment.due_date)}</span>
            </div>

            <div class="as-mobile-detail-progress-row">
                <div class="as-mobile-detail-progress-bar">
                    <div class="as-mobile-detail-progress-fill"
                        style="--as-progress-width:${subPercent}%;--as-progress-color:${progressColor};"></div>
                </div>
                <span class="as-mobile-detail-progress-label" style="--as-progress-color:${progressColor};">
                    ${subCount}/${totalCount} submitted
                </span>
            </div>

            <div class="as-mobile-detail-actions">
                ${assignment.file_url ? `
                    <a class="as-mobile-detail-link" href="${assignment.file_url}" target="_blank">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                        Attachment
                    </a>` : ''}
                <button class="as-mobile-detail-link" onclick="downloadSubmissions(${assignment.id})">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download All
                </button>
                <button class="as-mobile-detail-delete-btn" onclick="confirmDeleteAssignment(${assignment.id})">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    Delete
                </button>
            </div>

            <div class="as-mobile-detail-desc">
                ${assignment.description ? assignment.description.replace(/\n/g, '<br>') : 'No description provided.'}
            </div>

            <div class="as-mobile-detail-table-wrapper teacher-grades-table-wrapper">
                <table class="teacher-grades-table">
                    <thead>
                        <tr>
                            <th>Learner</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Submission</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </article>`;

    apiArea.scrollTop = 0;
};

window.openMobileTeacherAssignmentById = function(assignmentId) {
    const targetId = String(assignmentId || '');
    const idx = (window._allAssignmentsFlat || []).findIndex(a => String(a.id) === targetId);
    if (idx >= 0) window.openMobileTeacherAssignment(idx);
};

// ─────────────────────────────────────────────
// DOWNLOAD SUBMISSIONS
// ─────────────────────────────────────────────
window.downloadSubmissions = function(assignmentId) {
    window.open(`download_submissions.php?assignment_id=${assignmentId}`, '_blank');
};

// ─────────────────────────────────────────────
// CREATE ASSIGNMENT VIEW
// ─────────────────────────────────────────────
window.openCreateAssignment = async function() {
    const apiArea = document.getElementById('api-content-area');
    const loader  = document.getElementById('loaderOverlay');
    const panel   = document.getElementById('as-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;

    // Target: panel on desktop, full apiArea on mobile
    const target = isDesktop ? panel : apiArea;
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Loading...')
        : null;

    if (!hideInitialLoader && loader) loader.style.display = 'flex';

    try {
        const [classRes, termRes] = await Promise.all([
            fetch('api/teacher/get_classes.php'),
            fetch('api/teacher/get_quizzes.php')
        ]);
        const classes  = await classRes.json();
        const quizData = await termRes.json();
        const currentTerm = quizData.current_term || 1;

        // Clear sidebar active state on desktop
        if (isDesktop) {
            document.querySelectorAll('.as-sidebar-item').forEach(el => el.classList.remove('active'));
            const newBtn = document.getElementById('as-new-btn');
            if (newBtn) newBtn.classList.add('active');
        }

        const backFn = isDesktop ? `selectDesktopAssignment(window._lastSelectedAssignmentIdx)` : `fetchTeacherAssignments()`;

        target.innerHTML = `
            <div class="as-form-wrap ${isDesktop ? 'as-form-wrap--desktop tchr-create-form' : 'as-form-wrap--mobile'}">
                ${isDesktop ? '<p class="tchr-create-crumb">Assignments</p>' : ''}
                <div class="as-form-header ${isDesktop ? 'as-form-header--desktop' : ''}">
                    <h2 class="as-form-title ${isDesktop ? 'as-form-title--desktop' : ''}">
                        Create New Assignment
                    </h2>
                    ${isDesktop ? `
                        <button onclick="fetchTeacherAssignments()" class="as-form-close-btn">&times;</button>
                    ` : ''}
                </div>

                <form id="createAssignmentForm" enctype="multipart/form-data">

                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" name="title" class="teacher-modal-input"
                        placeholder="e.g. Chapter 5 Essay" required>

                    <label class="teacher-modal-label">Description *</label>
                    <textarea name="description" class="teacher-modal-input as-form-textarea" rows="4"
                        placeholder="Describe the assignment..." required></textarea>

                    <label class="teacher-modal-label">Due Date *</label>
                    <input type="datetime-local" name="due_date" class="teacher-modal-input" required>

                    <label class="teacher-modal-label">Assign to Class *</label>
                    <div id="assignmentClassPicker"></div>

                    <div class="as-term-banner">
                        <div class="as-term-banner-title">
                            Posting to: TERM ${currentTerm}
                        </div>
                        <div class="as-term-banner-subtitle">
                            This assignment belongs to the current active term.
                        </div>
                    </div>

                    <label class="teacher-modal-label">Attachment (optional)</label>
                    <input type="file" name="attachment" class="as-file-input">

                    <label class="as-email-checkbox-label">
                        <input type="checkbox" name="force_email" value="1" class="as-email-checkbox">
                        <span>Learners automatically get mobile notifications. Tick this box to also send email notifications.</span>
                    </label>

                    <div id="caError" class="as-form-error"></div>

                    <div class="as-form-actions">
                        <button type="button" onclick="fetchTeacherAssignments()"
                            class="teacher-modal-cancel as-form-cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" class="teacher-modal-submit as-form-submit-btn"
                            id="caSubmitBtn">
                            Create Assignment
                        </button>
                    </div>

                </form>
            </div>`;

        // Init class picker
        window.renderClassPicker('assignmentClassPicker', classes, function() {});

        // Handle submit
        const form = document.getElementById('createAssignmentForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const errorDiv  = document.getElementById('caError');
            const submitBtn = document.getElementById('caSubmitBtn');
            errorDiv.style.display = 'none';

            const fd = new FormData(form);
            const classId = window.getClassPickerValue('assignmentClassPicker');
            if (!classId) {
                errorDiv.textContent = 'Please select a class.';
                errorDiv.style.display = 'block';
                return;
            }
            fd.set('class_id', classId);
            const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);
            try {
                const res  = await fetch('api/teacher/create_assignment.php', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': getCsrfToken() },
                    body: fd
                });
                const data = await res.json();

                if (data.success) {
                    window.teacherAssignmentsCache = null;
                    fetchTeacherAssignments();
                } else {
                    errorDiv.textContent = data.error || 'Failed to create assignment.';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                errorDiv.textContent = 'Something went wrong. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                hideSubmitLoader();
            }
        });

    } catch (e) {
        console.error(e);
        target.innerHTML = `
            <p class="as-error-message">
                Error loading create assignment form.
            </p>`;
    } finally {
        if (hideInitialLoader) hideInitialLoader();
        else if (loader) loader.style.display = 'none';
    }
};

// ─────────────────────────────────────────────
// DELETE ASSIGNMENT (desktop)
// ─────────────────────────────────────────────
let assignmentToDelete = null;

window.confirmDeleteAssignment = function(id) {
    assignmentToDelete = id;
    const modal = document.getElementById('deleteAssignmentModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteAssignmentModal = function() {
    assignmentToDelete = null;
    const modal = document.getElementById('deleteAssignmentModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteAssignment = async function() {
    if (!assignmentToDelete) return;
    const idToDelete = assignmentToDelete;
    const deleteButton = document.querySelector('#deleteAssignmentModal .as-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteAssignmentModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_assignment.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherAssignmentsCache = null;
            fetchTeacherAssignments();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};