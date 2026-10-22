function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
/**
 * iSkool — assets/js/teacher/announcements.js
 * Updated to handle school-wide announcements (is_school: true) from admin.
 * School-wide group appears at top of sidebar under "From School" label.
 * Everything else is unchanged from existing behaviour.
 */

window.teacherAnnouncementCache = null;
window.teacherAnnouncementCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherAnnouncements = function () {
    if (window.teacherAnnouncementCache) return;
    if (window.teacherAnnouncementCachePromise) return;
    window.teacherAnnouncementCachePromise = fetch('api/teacher/get_announcements.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherAnnouncementCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherAnnouncementCachePromise = null; });
};

window.fetchTeacherAnnouncements = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_announcements");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_announcements");

    // Restore standard chrome (hamburger, brand, bottom nav) any time this
    // list is (re)loaded. This is also the mobile "back" target dispatched
    // from handleTeacherHeaderBack when detailType === 'Announcement', so
    // without this reset the header/bottom nav would stay stuck in
    // whatever 'detail' mode openMobileTeacherAnnouncement last left them
    // in (see the Assignments back-button bug in PROJECT_NOTES.md).
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ title: 'Announcements', mode: 'standard', color: '#d891ae' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAnnouncementCache) {
        renderTeacherAnnouncements(window.teacherAnnouncementCache);
        return;
    }

    try {
        if (!window.teacherAnnouncementCachePromise) {
            window.teacherAnnouncementCachePromise = fetch('api/teacher/get_announcements.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherAnnouncementCache = data;
                    return data;
                })
                .finally(() => { window.teacherAnnouncementCachePromise = null; });
        }
        const data = await window.teacherAnnouncementCachePromise;
        renderTeacherAnnouncements(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p class="an-error-message">
                Error loading announcements.
            </p>`;
    }
};

/** Small inline stroke icon, same 24x24 / 1.75 stroke family as asDpIcon in
 * assignments.js. Only what the empty-state button needs. */
function anDpIcon(name, size) {
    const paths = {
        plus: '<path d="M12 5v14M5 12h14"/>'
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function renderTeacherAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Build flat list for panel lookup ──
    // School-wide items come first in the flat list (they're first in the array)
    window._allAnnouncementsFlat = [];
    if (data && data.length > 0) {
        data.forEach(group => {
            group.items.forEach(ann => {
                window._allAnnouncementsFlat.push({
                    ...ann,
                    class_name: group.class_name,
                    is_school:  group.is_school || false,
                });
            });
        });
    }

    // ── Build sidebar ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state an-empty-state-inline">No announcements yet.</p>`;
    } else {
        data.forEach((group, groupIdx) => {
            const classGroupId = `an-class-group-${groupIdx}`;
            let itemsHtml = '';
            group.items.forEach(ann => {
                const flatIndex = window._allAnnouncementsFlat.findIndex(a => a.id === ann.id);
                itemsHtml += `
                    <div class="an-sidebar-item" id="an-sidebar-${flatIndex}"
                        data-title="${ann.title.replace(/"/g, '&quot;')}"
                        onclick="selectDesktopAnnouncement(${flatIndex})">
                        <span class="an-sidebar-dot" aria-hidden="true"></span>
                        <div class="an-sidebar-item-info">
                            <div class="an-sidebar-item-title">${ann.title}</div>
                            <div class="an-sidebar-item-meta">${ann.display_date}</div>
                        </div>
                    </div>`;
            });

            // Label — plain class name (school broadcasts are just another group)
            const labelInnerHtml = group.is_school ? 'From School' : group.class_name;
            const labelClass = 'an-sidebar-class-label';

            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                labelClass,
                labelInnerHtml,
                itemsHtml
            );
        });
    }

    // ── Empty-state copy for the desktop main panel ──
    const announcementCount = window._allAnnouncementsFlat.length;
    const schoolCount = window._allAnnouncementsFlat.filter(a => a.is_school).length;
    const ownCount = announcementCount - schoolCount;
    const emptyTitle = announcementCount ? 'Pick an announcement' : 'No announcements yet';
    const emptyBody = announcementCount
        ? [
            ownCount
                ? `${ownCount} ${ownCount === 1 ? 'announcement' : 'announcements'} across your classes.`
                : "You haven't posted any yet.",
            schoolCount ? `${schoolCount} from the school.` : ''
          ].filter(Boolean).join(' ')
        : 'Post one to a class and it will show up here, grouped by class.';
    const emptyCta = announcementCount ? 'Create an announcement' : 'Create your first announcement';

    // ── Full HTML (unchanged structure, added school-item styles) ──
    let html = `
        <!-- DESKTOP -->
        <div class="an-desktop-layout tchr-flat-layout">

            <div class="an-sidebar tchr-flat-sidebar">
                <div class="an-sidebar-header">
                    <span>Announcements</span>
                    <button class="teacher-upload-btn teacher-desktop-create an-new-btn" id="an-new-btn" onclick="openCreateAnnouncementForm()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                ${window.buildTeacherSearchBar('an', { placeholder: 'Search announcements...' })}
                <div class="an-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <div class="an-main-panel tchr-flat-panel" id="an-main-panel">
                <div class="an-panel-empty">
                    <h2 class="an-panel-empty-title">${emptyTitle}</h2>
                    <p class="an-panel-empty-body">${emptyBody}</p>
                    <button type="button" class="an-dp-btn an-dp-btn--primary" onclick="openCreateAnnouncementForm()">
                        ${anDpIcon('plus', 14)}${emptyCta}
                    </button>
                </div>
            </div>

            <!-- ═══ RIGHT INFO RAIL ═══
                 Shared across pages via buildInfoRail() in dashboard.js.
                 railId lets selectDesktopAnnouncement() swap this to
                 selection-specific copy via updateInfoRail(). Could later
                 hold an AI/chat assistant once Resources or similar
                 exists to ground it. -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Announcements', `
                <p>Announcements go to everyone in the selected class. Use <strong>Send To</strong> when creating one to reach learners, parents, or both.</p>
                <p>School-wide announcements come from admin and appear at the top of your list — you can't edit or delete those from here.</p>
            `, 'an-rail') : ''}

        </div>

        <div id="deleteAnnouncementModal" class="teacher-modal-overlay an-modal-hidden">
            <div class="teacher-modal-box an-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Announcement</span>
                    <button onclick="closeDeleteAnnouncementModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="an-delete-modal-text">Are you sure you want to delete this announcement? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteAnnouncementModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteAnnouncement()" class="teacher-modal-submit an-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- MOBILE -->
        <div class="an-mobile-list">
            ${window.buildTeacherSearchBar('an', { mobile: true, placeholder: 'Search announcements...' })}`;

    // Mobile list — grouped by class (school-wide group first, since it's
    // first in the source array), same tap-to-detail-page pattern as
    // Assignments, replacing the old static/non-interactive card list.
    // Reuses the existing per-item flatIndex lookup (same one the desktop
    // sidebar already uses) so mobile and desktop share one flat array —
    // no separate mobile flat array needed, consistent with how
    // Assignments' mobile rebuild kept a single _allAssignmentsFlat.
    if (!data || data.length === 0) {
        html += `<p class="an-mobile-empty-state">No announcements yet.</p>`;
    } else {
        data.forEach((group, groupIdx) => {
            const isSchool = group.is_school || false;
            const mobileGroupId = `an-mobile-class-group-${groupIdx}`;

            let itemsHtml = '';
            group.items.forEach(ann => {
                const flatIndex = window._allAnnouncementsFlat.findIndex(a => a.id === ann.id);
                const preview = ann.message.length > 90 ? ann.message.substring(0, 90) + '...' : ann.message;
                const editedTag = ann.is_edited ? `<span class="an-edited-tag an-edited-tag--mobile">Edited</span>` : '';
                // Row icon uses a second, deeper pink shade so it reads
                // as distinct from the dusty-rose signature colour used
                // on the "From School" label and the "Edited" tag below.
                const iconStroke = '#c2618a';

                itemsHtml += `
                    <div class="an-mobile-row" role="button" tabindex="0"
                        data-title="${ann.title.replace(/"/g, '&quot;')}"
                        onclick="openMobileTeacherAnnouncement(${flatIndex})"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherAnnouncement(${flatIndex});}">
                        <div class="an-mobile-row-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="${iconStroke}" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <div class="an-mobile-row-body">
                            <div class="an-mobile-row-title">${ann.title}${editedTag}</div>
                            <div class="an-mobile-row-msg">${preview}</div>
                            <div class="an-mobile-row-date">${ann.display_date}</div>
                        </div>
                        <div class="an-mobile-row-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
            });

            // Matches assignments' .as-mobile-folder-count badge for visual
            // consistency between the two mobile list pages.
            const countBadge = `<span class="an-mobile-folder-count">${group.items.length}</span>`;
            // Class groups get the same folder glyph as Assignments, tinted
            // with this page's row-icon pink (#c2618a) so it reads as this
            // page's own signature colour rather than reusing purple.
            // "From School" keeps its distinct house icon instead of a
            // folder, since it isn't a class folder — it's a school
            // broadcast group.
            const folderIcon = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#c2618a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="an-mobile-folder-icon">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>`;
            const labelInnerHtml = isSchool
                ? `<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="an-school-icon">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="an-mobile-folder-name">From School</span>${countBadge}`
                : `${folderIcon}<span class="an-mobile-folder-name">${group.class_name}</span>${countBadge}`;
            const labelClass = isSchool
                ? 'an-mobile-folder-label an-mobile-folder-label--school'
                : 'an-mobile-folder-label';

            html += window.buildCollapsibleClassGroup(
                mobileGroupId,
                labelClass,
                labelInnerHtml,
                itemsHtml
            );
        });
    }

    html += `
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    if (typeof applyTeacherRailCollapsedState === 'function') applyTeacherRailCollapsedState();
    if (typeof window.wireTeacherSearchBar === 'function') window.wireTeacherSearchBar('an');

    const sidebarScrollEl = apiArea.querySelector('.an-sidebar-scroll');
    window.wireTeacherSectionScroll('announcements-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('announcements-sidebar', sidebarScrollEl);

    // Restore whichever announcement was selected before navigating
    // away/refreshing. Re-derive its current flatIndex from the saved
    // stable id rather than storing the index itself, since the index
    // can shift if announcements are added/removed/reordered.
    const savedId = window.teacherSectionState.selection.announcements;
    if (savedId) {
        const flatIndex = window._allAnnouncementsFlat.findIndex(a => a.id == savedId);
        if (flatIndex !== -1) selectDesktopAnnouncement(flatIndex);
    }
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
window.selectDesktopAnnouncement = function(flatIndex) {
    document.querySelectorAll('.an-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('an-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`an-sidebar-${flatIndex}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const ann = (window._allAnnouncementsFlat || [])[flatIndex];
    if (!ann) return;

    window.teacherSectionState.selection.announcements = ann.id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('an-main-panel');
    if (!panel) return;

    const schoolBadge = ann.is_school
        ? `<span class="an-school-badge">
               <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2.5" fill="none">
                   <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                   <polyline points="9 22 9 12 15 12 15 22"/>
               </svg>
               School
           </span> &bull;`
        : '';

    const panelActions = ann.is_school ? '' : `
        <div class="an-panel-actions">
            <button class="an-panel-edit-btn" onclick="openEditAnnouncementPanel(${ann.id})">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path>
                </svg>
                Edit
            </button>
            <button class="an-panel-delete-btn" onclick="confirmDeleteAnnouncement(${ann.id})">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6"></path>
                    <path d="M14 11v6"></path>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
                Delete
            </button>
        </div>`;

    const editedMeta = ann.is_edited
        ? `<span>&bull;</span><span class="an-panel-edited-meta">Edited ${ann.edited_date}</span>`
        : '';

    panel.innerHTML = `
        <div class="an-panel-content">
            <div class="an-panel-header">
                <div>
                    <div class="an-panel-title">${ann.title}</div>
                    <div class="an-panel-meta">
                        ${schoolBadge}
                        <span>${ann.class_name}</span>
                        <span>&bull;</span>
                        <span>${ann.display_date}</span>
                        ${editedMeta}
                    </div>
                </div>
                ${panelActions}
            </div>
            <div class="an-panel-message">${ann.message.replace(/\n/g, '<br>')}</div>
        </div>`;

    // Swap the info rail to explain the announcement that's now open,
    // instead of leaving it on the generic page-level copy.
    if (typeof updateInfoRail === 'function') {
        if (ann.is_school) {
            updateInfoRail('an-rail', 'School Announcement', `
                <p>This announcement was posted by admin and goes to the whole school.</p>
                <p>School-wide announcements can't be edited or deleted from a teacher account.</p>
            `);
        } else {
            updateInfoRail('an-rail', 'About This Announcement', `
                <p>This was posted to <strong>${ann.class_name}</strong>${ann.is_edited ? `, and edited on ${ann.edited_date}` : ''}.</p>
                <p>Use <strong>Edit</strong> to change the message, or <strong>Delete</strong> to remove it for everyone in the class.</p>
            `);
        }
    }
};

// ─────────────────────────────────────────────
// MOBILE DETAIL VIEW: tap -> detail page
// ─────────────────────────────────────────────
window.openMobileTeacherAnnouncement = function(flatIndex) {
    if (window.innerWidth > 899) return;

    const ann = (window._allAnnouncementsFlat || [])[flatIndex];
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (!ann || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';

    sessionStorage.setItem('lastTeacherPage', 'teacher_announcements');
    window.teacherSectionState.selection.announcements = ann.id;
    window.persistTeacherSectionState();

    window.configureTeacherHeader({
        title: 'Announcement',
        mode: 'detail',
        detailType: 'Announcement',
        backLabel: 'Announcements',
        color: '#d891ae'
    });

    const schoolBadge = ann.is_school
        ? `<span class="an-school-badge">
               <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2.5" fill="none">
                   <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                   <polyline points="9 22 9 12 15 12 15 22"/>
               </svg>
               School
           </span> &bull;`
        : '';

    // School-wide announcements aren't editable/deletable from here, same
    // rule as the desktop panel (selectDesktopAnnouncement). Edit is
    // desktop-only for now (openEditAnnouncementPanel targets #an-main-panel,
    // which doesn't exist in the mobile DOM) — see PROJECT_NOTES.md, flagged
    // as a follow-up rather than wired to a dead button or silently
    // reimplemented as a new mobile form outside this task's scope.
    const detailActions = ann.is_school ? '' : `
        <div class="an-mobile-detail-actions">
            <button class="an-mobile-detail-delete-btn" onclick="confirmDeleteAnnouncement(${ann.id})">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6"></path>
                    <path d="M14 11v6"></path>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
                Delete
            </button>
        </div>`;

    const editedMeta = ann.is_edited
        ? `<span>&bull;</span><span class="an-mobile-detail-edited-meta">Edited ${ann.edited_date}</span>`
        : '';

    apiArea.innerHTML = `
        <article class="an-mobile-detail">
            <h1 class="an-mobile-detail-title">${ann.title}</h1>
            <div class="an-mobile-detail-meta">
                ${schoolBadge}
                <span>${ann.class_name}</span>
                <span>&bull;</span>
                <span>${ann.display_date}</span>
                ${editedMeta}
            </div>
            ${detailActions}
            <div class="an-mobile-detail-message">${ann.message.replace(/\n/g, '<br>')}</div>
        </article>`;

    apiArea.scrollTop = 0;
};

window.openMobileTeacherAnnouncementById = function(announcementId) {
    const targetId = String(announcementId || '');
    const idx = (window._allAnnouncementsFlat || []).findIndex(a => String(a.id) === targetId);
    if (idx >= 0) window.openMobileTeacherAnnouncement(idx);
};

// ─────────────────────────────────────────────
// EDIT ANNOUNCEMENT (desktop panel)
// ─────────────────────────────────────────────
window.openEditAnnouncementPanel = function(id) {
    const ann = (window._allAnnouncementsFlat || []).find(a => a.id === id);
    if (!ann) return;

    const panel = document.getElementById('an-main-panel');
    if (!panel) return;

    // Escape so existing angle-bracket-sensitive characters in the title/message
    // don't break the editable form fields.
    const escapeForAttr = (str) => String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    panel.innerHTML = `
        <div class="an-panel-content">
            <div class="an-panel-form-header">
                <div class="an-panel-form-title">Edit Announcement</div>
                <button onclick="selectDesktopAnnouncement(${window._allAnnouncementsFlat.findIndex(a => a.id === id)})" class="an-panel-form-close-btn">&times;</button>
            </div>

            <label class="teacher-modal-label">Title</label>
            <input type="text" id="editAnnTitle" class="teacher-modal-input" value="${escapeForAttr(ann.title)}">

            <label class="teacher-modal-label">Message</label>
            <textarea id="editAnnMessage" class="teacher-modal-input an-form-textarea" rows="5">${ann.message}</textarea>

            <p class="an-edit-hint">Learners will see this announcement marked as edited, with the changed text highlighted.</p>

            <div id="editAnnError" class="an-form-error"></div>

            <div class="an-panel-form-actions">
                <button onclick="selectDesktopAnnouncement(${window._allAnnouncementsFlat.findIndex(a => a.id === id)})"
                    class="teacher-modal-cancel an-panel-form-cancel-btn">
                    Cancel
                </button>
                <button onclick="submitEditAnnouncement(${ann.id})"
                    class="teacher-modal-submit an-panel-form-submit-btn" id="editAnnSubmitBtn">
                    Save Changes
                </button>
            </div>
        </div>`;
};

window.submitEditAnnouncement = async function(id) {
    const title     = document.getElementById('editAnnTitle').value.trim();
    const message   = document.getElementById('editAnnMessage').value.trim();
    const errorDiv  = document.getElementById('editAnnError');
    const submitBtn = document.getElementById('editAnnSubmitBtn');

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter a title.';   errorDiv.style.display = 'block'; return; }
    if (!message) { errorDiv.textContent = 'Please enter a message.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('id',      id);
    fd.append('title',   title);
    fd.append('message', message);

    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

    try {
        const res  = await fetch('api/teacher/edit_announcement.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherAnnouncementCache = null;
            await fetchTeacherAnnouncements();
        } else {
            errorDiv.textContent  = data.error || 'Failed to save changes.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent  = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

async function loadAnnouncementClasses(panel) {
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(panel, 'Loading...')
        : null;
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('annClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
    } finally {
        if (hideInitialLoader) hideInitialLoader();
    }
}

// ─────────────────────────────────────────────
// ROUTER: panel on desktop, modal on mobile
// ─────────────────────────────────────────────
window.openCreateAnnouncementForm = function() {
    const panel = document.getElementById('an-main-panel');
    if (window.innerWidth >= 900 && panel) {
        openCreateAnnouncementPanel(panel);
    } else {
        openCreateAnnouncementModal();
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL FORM (unchanged)
// ─────────────────────────────────────────────
function openCreateAnnouncementPanel(panel) {
    document.querySelectorAll('.an-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('an-new-btn');
    if (newBtn) newBtn.classList.add('active');

    panel.innerHTML = `
        <div class="an-panel-content tchr-create-form tchr-create-form--announcement">
            <p class="tchr-create-crumb">Announcements</p>
            <div class="an-panel-form-header">
                <div class="an-panel-form-title">New Announcement</div>
                <button onclick="fetchTeacherAnnouncements()" class="an-panel-form-close-btn">&times;</button>
            </div>

            <label class="teacher-modal-label">Title</label>
            <input type="text" id="annTitle" class="teacher-modal-input" placeholder="e.g. Test next week">

            <label class="teacher-modal-label">Message</label>
            <textarea id="annMessage" class="teacher-modal-input an-form-textarea" rows="5"
                placeholder="Type your announcement here..."></textarea>

            <label class="teacher-modal-label">Select Class</label>
            <div id="annClassPicker"></div>

            <label class="teacher-modal-label">Send To</label>
            <select id="annSendTo" class="teacher-modal-input">
                <option value="learners" selected>Learners Only</option>
                <option value="parents">Parents Only</option>
            </select>

            <label class="teacher-modal-label an-email-label">
                <input type="checkbox" id="annForceEmail">
                Also send email notification
            </label>

            <div id="createAnnError" class="an-form-error"></div>

            <div class="an-panel-form-actions">
                <button onclick="fetchTeacherAnnouncements()"
                    class="teacher-modal-cancel an-panel-form-cancel-btn">
                    Cancel
                </button>
                <button onclick="submitCreateAnnouncement()"
                    class="teacher-modal-submit an-panel-form-submit-btn" id="createAnnSubmitBtn">
                    Send Announcement
                </button>
            </div>
        </div>`;

    loadAnnouncementClasses(panel);
}

window.openCreateAnnouncementModal = function() {
    const modal = document.getElementById('createAnnouncementModal');
    if (modal) modal.style.display = 'flex';
    loadAnnouncementClasses();
};

window.closeCreateAnnouncementModal = function() {
    const modal = document.getElementById('createAnnouncementModal');
    if (modal) modal.style.display = 'none';
    const t = document.getElementById('annTitle');       if (t) t.value = '';
    const m = document.getElementById('annMessage');     if (m) m.value = '';
    const s = document.getElementById('annSendTo');      if (s) s.value = 'learners';
    const f = document.getElementById('annForceEmail');  if (f) f.checked = false;
    const er = document.getElementById('createAnnError'); if (er) er.style.display = 'none';
    window.resetClassPicker('annClassPicker');
};

window.submitCreateAnnouncement = async function() {
    const title      = document.getElementById('annTitle').value.trim();
    const message    = document.getElementById('annMessage').value.trim();
    const classId    = window.getClassPickerValue('annClassPicker');
    const sendTo     = (document.getElementById('annSendTo') || {}).value || 'learners';
    // The desktop panel and mobile modal can both exist in the page. Read
    // the visible checkbox so the teacher's selected value is the one sent.
    const forceEmailInput = Array.from(document.querySelectorAll('[id="annForceEmail"]'))
        .find(input => input.getClientRects().length > 0);
    const forceEmail = Boolean(forceEmailInput?.checked);
    const errorDiv   = document.getElementById('createAnnError');
    const submitBtn  = document.getElementById('createAnnSubmitBtn');

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter a title.';   errorDiv.style.display = 'block'; return; }
    if (!message) { errorDiv.textContent = 'Please enter a message.'; errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.';  errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',    title);
    fd.append('message',  message);
    fd.append('class_id', classId);
    fd.append('send_to',  sendTo);
    if (forceEmail) fd.append('force_email', '1');

    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

    try {
        const res  = await fetch('api/teacher/create_announcement.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            const modal = document.getElementById('createAnnouncementModal');
            if (modal && modal.style.display === 'flex') closeCreateAnnouncementModal();
            window.teacherAnnouncementCache = null;
            fetchTeacherAnnouncements();
        } else {
            errorDiv.textContent  = data.error || 'Failed to send announcement.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent  = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

// ─────────────────────────────────────────────
// DELETE ANNOUNCEMENT (desktop)
// ─────────────────────────────────────────────
let announcementToDelete = null;

window.confirmDeleteAnnouncement = function(id) {
    announcementToDelete = id;
    const modal = document.getElementById('deleteAnnouncementModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteAnnouncementModal = function() {
    announcementToDelete = null;
    const modal = document.getElementById('deleteAnnouncementModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteAnnouncement = async function() {
    if (!announcementToDelete) return;
    const idToDelete = announcementToDelete;
    const deleteButton = document.querySelector('#deleteAnnouncementModal .an-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteAnnouncementModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_announcement.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherAnnouncementCache = null;
            fetchTeacherAnnouncements();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};