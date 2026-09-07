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
                const preview = ann.message.length > 60
                    ? ann.message.substring(0, 60) + '...'
                    : ann.message;

                // School items get a slightly different icon colour (orange = school broadcast)
                const iconStroke = group.is_school ? '#f59e0b' : '#4fd1c5';

                itemsHtml += `
                    <div class="an-sidebar-item${group.is_school ? ' an-school-item' : ''}" id="an-sidebar-${flatIndex}"
                        onclick="selectDesktopAnnouncement(${flatIndex})">
                        <div class="an-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="${iconStroke}" stroke-width="2" fill="none">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <div class="an-sidebar-item-info">
                            <div class="an-sidebar-item-title">${ann.title}</div>
                            <div class="an-sidebar-item-meta">${preview}</div>
                        </div>
                    </div>`;
            });

            // Label — school group gets a distinct teal label, class groups get the muted style
            const labelInnerHtml = group.is_school
                ? `<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="an-school-icon">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    From School`
                : group.class_name;
            const labelClass = group.is_school
                ? 'an-sidebar-class-label an-sidebar-school-label'
                : 'an-sidebar-class-label';

            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                labelClass,
                labelInnerHtml,
                itemsHtml
            );
        });
    }

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
                <div class="an-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <div class="an-main-panel tchr-flat-panel" id="an-main-panel">
                <div class="an-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p>Select an announcement to read it</p>
                </div>
            </div>

            <!-- ═══ RIGHT INFO RAIL ═══
                 Shared across pages via buildInfoRail() in dashboard.js.
                 Could later hold an AI/chat assistant once Resources or
                 similar exists to ground it. -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Announcements', `
                <p>Announcements go to everyone in the selected class. Use <strong>Send To</strong> when creating one to reach learners, parents, or both.</p>
                <p>School-wide announcements come from admin and appear at the top of your list — you can't edit or delete those from here.</p>
            `) : ''}

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
        <div class="an-mobile-list">`;

    // Mobile list — school group first, then class groups
    if (!data || data.length === 0) {
        html += `<p class="an-mobile-empty-state">No announcements yet.</p>`;
    } else {
        data.forEach(group => {
            const isSchool = group.is_school || false;
            html += `<div class="an-mobile-section-label${isSchool ? ' school' : ''}">${group.class_name}</div>`;
            group.items.forEach(ann => {
                const preview = ann.message.length > 90 ? ann.message.substring(0, 90) + '...' : ann.message;
                html += `
                    <div class="an-mobile-card${isSchool ? ' school-card' : ''}">
                        <div class="an-mobile-card-title">${ann.title}</div>
                        <div class="an-mobile-card-msg">${preview}</div>
                        <div class="an-mobile-card-date">${ann.display_date}</div>
                    </div>`;
            });
        });
    }

    html += `
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    if (typeof applyTeacherRailCollapsedState === 'function') applyTeacherRailCollapsedState();

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

    const deleteBtn = ann.is_school ? '' : `
        <div class="an-panel-actions">
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
                    </div>
                </div>
                ${deleteBtn}
            </div>
            <div class="an-panel-message">${ann.message.replace(/\n/g, '<br>')}</div>
        </div>`;
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
        <div class="an-panel-content">
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
