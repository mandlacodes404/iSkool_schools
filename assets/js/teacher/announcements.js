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

window.fetchTeacherAnnouncements = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_announcements");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_announcements");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAnnouncementCache) {
        renderTeacherAnnouncements(window.teacherAnnouncementCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

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
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading announcements.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
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
        sidebarHtml = `<p class="teacher-empty-state" style="padding:16px;font-size:13px;">No announcements yet.</p>`;
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
                ? `<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
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
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .an-desktop-layout { display: flex !important; }
                .an-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .an-desktop-layout { display: none !important; }
                .an-mobile-list    { display: block !important; }
            }

            .an-desktop-layout {
                display: flex; gap: 0;
                min-height: 500px;
            }

            /* Left sidebar */
            .an-sidebar {
                width: 280px; min-width: 240px; max-width: 300px;
                display: flex; flex-direction: column; overflow: hidden;
            }
            .an-sidebar-header {
                padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
                color: #4fd1c5; text-transform: uppercase; flex-shrink: 0;
            }
            .an-sidebar-scroll { flex: 1; overflow-y: auto; padding: 8px 0; }
            .an-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .an-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .an-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .an-sidebar-class-label {
                padding: 8px 16px 4px;
                font-size: 10px; font-weight: 700;
                color: #8b949e; text-transform: uppercase; letter-spacing: 0.8px;
            }
            .an-sidebar-class-label.tchr-sidebar-class-label--toggle {
                padding-top: 8px;
                padding-bottom: 6px;
            }

            /* School label — distinct from class labels */
            .an-sidebar-school-label {
                display: flex; align-items: center; gap: 5px;
                color: #f59e0b;
                border-top: 1px solid rgba(255,255,255,0.05);
                margin-top: 4px; padding-top: 12px;
            }
            .an-sidebar-scroll > .an-sidebar-school-label:first-child {
                border-top: none; margin-top: 0;
            }
            /* Keep the orange tint on hover instead of the shared muted-gray hover */
            .an-sidebar-school-label.tchr-sidebar-class-label--toggle:hover {
                color: #fbbf24;
            }

            .an-sidebar-item {
                display: flex; align-items: flex-start; gap: 10px;
                padding: 10px 16px; cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .an-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .an-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            /* School items active state uses orange accent */
            .an-sidebar-item.an-school-item.active {
                background: rgba(245,158,11,0.08);
                border-left-color: #f59e0b;
            }
            .an-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; margin-top: 2px; }
            .an-sidebar-item-info { flex: 1; min-width: 0; }
            .an-sidebar-item-title {
                font-size: 13px; font-weight: 600; color: #c9d1d9;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .an-sidebar-item.active .an-sidebar-item-title { color: #e2e8f0; }
            .an-sidebar-item-meta {
                font-size: 11px; color: #555e6a; margin-top: 3px;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }

            /* Right panel */
            .an-main-panel {
                flex: 1; overflow-y: auto;
                display: flex; flex-direction: column;
            }
            .an-main-panel::-webkit-scrollbar { width: 5px; }
            .an-main-panel::-webkit-scrollbar-track { background: transparent; }
            .an-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .an-panel-empty {
                flex: 1; display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                color: #555e6a; gap: 8px; padding: 40px;
            }
            .an-panel-empty svg { opacity: 0.25; }
            .an-panel-empty p { font-size: 13px; text-align: center; max-width: 240px; line-height: 1.5; }

            .an-panel-content { padding: 24px 28px; max-width: 720px; }
            .an-panel-header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
            .an-panel-title { font-size: 20px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px; line-height: 1.3; }
            .an-panel-meta  { font-size: 12px; color: #8b949e; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
            .an-panel-message { font-size: 14px; color: #c9d1d9; line-height: 1.75; white-space: pre-wrap; }

            /* School badge in panel */
            .an-school-badge {
                display: inline-flex; align-items: center; gap: 4px;
                font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
                text-transform: uppercase;
                padding: 2px 8px; border-radius: 20px;
                background: rgba(245,158,11,0.1);
                border: 1px solid rgba(245,158,11,0.25);
                color: #f59e0b;
            }

            /* Mobile list */
            .an-mobile-list { padding: 12px; }
            .an-mobile-section-label {
                font-size: 10px; font-weight: 700; letter-spacing: 1px;
                text-transform: uppercase; color: #8b949e;
                margin: 16px 4px 8px; padding-bottom: 6px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .an-mobile-section-label.school { color: #f59e0b; }
            .an-mobile-card {
                background: #161b22; border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px; padding: 14px 16px; margin-bottom: 8px;
                cursor: pointer; transition: border-color 0.15s;
            }
            .an-mobile-card:hover { border-color: rgba(255,255,255,0.15); }
            .an-mobile-card.school-card { border-left: 3px solid #f59e0b; }
            .an-mobile-card-title { font-size: 14px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
            .an-mobile-card-msg   { font-size: 12px; color: #8b949e; line-height: 1.5; margin-bottom: 6px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .an-mobile-card-date  { font-size: 11px; color: #484f58; }
        </style>

        <!-- DESKTOP -->
        <div class="an-desktop-layout tchr-flat-layout">

            <div class="an-sidebar tchr-flat-sidebar">
                <div class="an-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Announcements</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openCreateAnnouncementForm()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
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

        </div>

        <!-- MOBILE -->
        <div class="an-mobile-list">`;

    // Mobile list — school group first, then class groups
    if (!data || data.length === 0) {
        html += `<p style="color:#8b949e;font-size:13px;text-align:center;padding:40px 0;">No announcements yet.</p>`;
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
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
window.selectDesktopAnnouncement = function(flatIndex) {
    document.querySelectorAll('.an-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`an-sidebar-${flatIndex}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const ann = (window._allAnnouncementsFlat || [])[flatIndex];
    if (!ann) return;

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

    panel.innerHTML = `
        <div class="an-panel-content">
            <div class="an-panel-header">
                <div class="an-panel-title">${ann.title}</div>
                <div class="an-panel-meta">
                    ${schoolBadge}
                    <span>${ann.class_name}</span>
                    <span>&bull;</span>
                    <span>${ann.display_date}</span>
                </div>
            </div>
            <div class="an-panel-message">${ann.message.replace(/\n/g, '<br>')}</div>
        </div>`;
};

async function loadAnnouncementClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('annClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
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

    panel.innerHTML = `
        <div class="an-panel-content">
            <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.07);
                        display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:18px;font-weight:800;color:#e2e8f0;">New Announcement</div>
                <button onclick="fetchTeacherAnnouncements()"
                    style="background:none;border:none;color:#8b949e;font-size:22px;
                           cursor:pointer;line-height:1;padding:0;">&times;</button>
            </div>

            <label class="teacher-modal-label">Title</label>
            <input type="text" id="annTitle" class="teacher-modal-input" placeholder="e.g. Test next week">

            <label class="teacher-modal-label">Message</label>
            <textarea id="annMessage" class="teacher-modal-input" rows="5"
                style="resize:vertical;" placeholder="Type your announcement here..."></textarea>

            <label class="teacher-modal-label">Select Class</label>
            <div id="annClassPicker"></div>

            <label class="teacher-modal-label">Send To</label>
            <select id="annSendTo" class="teacher-modal-input">
                <option value="learners" selected>Learners Only</option>
                <option value="parents">Parents Only</option>
            </select>

            <label class="teacher-modal-label"
                style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                <input type="checkbox" id="annForceEmail">
                Also send email notification
            </label>

            <div id="createAnnError"
                style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>

            <div style="display:flex;gap:12px;margin-top:24px;">
                <button onclick="fetchTeacherAnnouncements()"
                    class="teacher-modal-cancel" style="flex:1;padding:13px;">
                    Cancel
                </button>
                <button onclick="submitCreateAnnouncement()"
                    class="teacher-modal-submit" id="createAnnSubmitBtn"
                    style="flex:2;padding:13px;font-size:14px;">
                    Send Announcement
                </button>
            </div>
        </div>`;

    loadAnnouncementClasses();
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
    const forceEmail = document.getElementById('annForceEmail').checked;
    const errorDiv   = document.getElementById('createAnnError');
    const submitBtn  = document.getElementById('createAnnSubmitBtn');

    // On desktop, scope the loader to the right panel only
    const isDesktop = window.innerWidth >= 900;
    const panel     = document.getElementById('an-main-panel');

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

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending...';

    // Show panel-scoped loader on desktop, global overlay on mobile
    let panelLoader = null;
    if (isDesktop && panel) {
        panelLoader = document.createElement('div');
        panelLoader.id = 'an-panel-loader';
        panelLoader.style.cssText = `
            position:absolute;inset:0;
            background:rgba(13,17,23,0.7);
            backdrop-filter:blur(2px);
            display:flex;align-items:center;justify-content:center;
            border-radius:14px;z-index:10;
        `;
        panelLoader.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
                <div style="width:32px;height:32px;border:3px solid rgba(79,209,197,0.2);
                            border-top-color:#4fd1c5;border-radius:50%;
                            animation:an-spin 0.7s linear infinite;"></div>
                <span style="font-size:13px;color:#8b949e;">Sending...</span>
            </div>`;
        // Inject keyframes once
        if (!document.getElementById('an-spin-style')) {
            const s = document.createElement('style');
            s.id = 'an-spin-style';
            s.textContent = '@keyframes an-spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(s);
        }
        // Panel must be position:relative for the absolute overlay to work
        panel.style.position = 'relative';
        panel.appendChild(panelLoader);
    } else {
        const globalLoader = document.getElementById('loaderOverlay');
        if (globalLoader) globalLoader.style.display = 'flex';
    }

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
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send';
        if (panelLoader) {
            panelLoader.remove();
        } else {
            const globalLoader = document.getElementById('loaderOverlay');
            if (globalLoader) globalLoader.style.display = 'none';
        }
    }
};
