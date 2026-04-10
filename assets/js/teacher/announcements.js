window.teacherAnnouncementCache = null;

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
        const response = await fetch('api/teacher/get_announcements.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherAnnouncementCache = data;
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

    // ── Store flat list for desktop panel lookup ──
    window._allAnnouncementsFlat = [];
    if (data && data.length > 0) {
        data.forEach(group => {
            group.items.forEach(ann => {
                window._allAnnouncementsFlat.push({ ...ann, class_name: group.class_name });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state" style="padding:16px;font-size:13px;">No announcements sent yet.</p>`;
    } else {
        data.forEach(group => {
            sidebarHtml += `<div class="an-sidebar-class-label">${group.class_name}</div>`;
            group.items.forEach(ann => {
                const flatIndex = window._allAnnouncementsFlat.findIndex(a => a.id === ann.id);
                const preview = ann.message.length > 60
                    ? ann.message.substring(0, 60) + '...'
                    : ann.message;

                sidebarHtml += `
                    <div class="an-sidebar-item" id="an-sidebar-${flatIndex}"
                        onclick="selectDesktopAnnouncement(${flatIndex})">
                        <div class="an-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
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
        });
    }

    // ── Build full HTML ──
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
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            /* Left sidebar */
            .an-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .an-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .an-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .an-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .an-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .an-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .an-sidebar-class-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .an-sidebar-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .an-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .an-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .an-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; margin-top: 2px; }
            .an-sidebar-item-info { flex: 1; min-width: 0; }
            .an-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .an-sidebar-item.active .an-sidebar-item-title { color: #e2e8f0; }
            .an-sidebar-item-meta {
                font-size: 11px;
                color: #555e6a;
                margin-top: 3px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Right panel */
            .an-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .an-main-panel::-webkit-scrollbar { width: 5px; }
            .an-main-panel::-webkit-scrollbar-track { background: transparent; }
            .an-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .an-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .an-panel-empty svg { opacity: 0.3; }
            .an-panel-empty p { font-size: 14px; margin: 0; }

            .an-panel-content { padding: 28px 32px; }

            .an-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .an-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 8px;
            }
            .an-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .an-panel-message {
                font-size: 14px;
                color: #c9d1d9;
                line-height: 1.8;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 20px 22px;
            }
        </style>

        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Announcements</h2>
            <button class="teacher-upload-btn" onclick="openCreateAnnouncementForm()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Announcement
            </button>
        </div>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="an-desktop-layout">
            <!-- Left Sidebar -->
            <div class="an-sidebar">
                <div class="an-sidebar-header">All Announcements</div>
                <div class="an-sidebar-scroll">${sidebarHtml}</div>
            </div>

            <!-- Right Main Panel -->
            <div class="an-main-panel" id="an-main-panel">
                <div class="an-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p>Select an announcement from the left to read it</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="an-mobile-list">`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No announcements sent yet.</p>`;
    } else {
        data.forEach(group => {
            html += `<div class="teacher-resource-section">
                <div class="teacher-resource-class-label">${group.class_name}</div>`;

            group.items.forEach(ann => {
                const preview = ann.message.length > 100
                    ? ann.message.substring(0, 100) + '...'
                    : ann.message;

                html += `
                    <div class="teacher-announcement-flat-card">
                        <div class="teacher-ann-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <div class="teacher-ann-info">
                            <div class="teacher-ann-title">${ann.title}</div>
                            <div class="teacher-ann-preview">${preview}</div>
                            <div class="teacher-ann-date">${ann.display_date}</div>
                        </div>
                    </div>`;
            });

            html += `</div>`;
        });
    }

    html += `</div>`; // close .an-mobile-list

    // Create Announcement Modal
    html += `
        <div id="createAnnouncementModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box">
                <div class="teacher-modal-header">
                    <span>Create Announcement</span>
                    <button onclick="closeCreateAnnouncementModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <label class="teacher-modal-label">Title</label>
                    <input type="text" id="annTitle" class="teacher-modal-input" placeholder="e.g. Test next week">

                    <label class="teacher-modal-label">Message</label>
                    <textarea id="annMessage" class="teacher-modal-input" rows="5" 
                        style="resize:vertical;" placeholder="Type your announcement here..."></textarea>

                    <label class="teacher-modal-label">Select Class</label>
                    <select id="annClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

                    <label class="teacher-modal-label">Send Email Alert To</label>
                    <select id="annSendTo" class="teacher-modal-input">
                        <option value="learners" selected>Learners Only</option>
                        <option value="parents">Parents Only</option>
                    </select>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="annForceEmail">
                        Also send email notification
                    </label>

                    <div id="createAnnError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeCreateAnnouncementModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitCreateAnnouncement()" class="teacher-modal-submit" id="createAnnSubmitBtn">Send</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;

    // Load classes into dropdown
    loadAnnouncementClasses();
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
window.selectDesktopAnnouncement = function(flatIndex) {
    // Update sidebar active state
    document.querySelectorAll('.an-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`an-sidebar-${flatIndex}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const ann = (window._allAnnouncementsFlat || [])[flatIndex];
    if (!ann) return;

    const panel = document.getElementById('an-main-panel');
    if (!panel) return;

    panel.innerHTML = `
        <div class="an-panel-content">
            <div class="an-panel-header">
                <div class="an-panel-title">${ann.title}</div>
                <div class="an-panel-meta">
                    <span>${ann.class_name}</span>
                    <span>&bull;</span>
                    <span>${ann.display_date}</span>
                </div>
            </div>
            <div class="an-panel-message">
                ${ann.message.replace(/\n/g, '<br>')}
            </div>
        </div>`;
};

async function loadAnnouncementClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        const sel  = document.getElementById('annClass');
        if (!sel) return;
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
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
// DESKTOP PANEL FORM
// ─────────────────────────────────────────────
function openCreateAnnouncementPanel(panel) {
    // Clear sidebar active state
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
            <select id="annClass" class="teacher-modal-input">
                <option value="">-- Choose Class --</option>
            </select>

            <label class="teacher-modal-label">Send Email Alert To</label>
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
};

window.closeCreateAnnouncementModal = function() {
    const modal = document.getElementById('createAnnouncementModal');
    if (modal) modal.style.display = 'none';
    document.getElementById('annTitle').value = '';
    document.getElementById('annMessage').value = '';
    document.getElementById('annClass').value = '';
    document.getElementById('annSendTo').value = 'learners';
    document.getElementById('annForceEmail').checked = false;
    document.getElementById('createAnnError').style.display = 'none';
};

window.submitCreateAnnouncement = async function() {
    const title      = document.getElementById('annTitle').value.trim();
    const message    = document.getElementById('annMessage').value.trim();
    const classId    = document.getElementById('annClass').value;
    const sendTo     = document.getElementById('annSendTo').value;
    const forceEmail = document.getElementById('annForceEmail').checked;
    const errorDiv   = document.getElementById('createAnnError');
    const submitBtn  = document.getElementById('createAnnSubmitBtn');
    const loader     = document.getElementById('loaderOverlay');

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
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/create_announcement.php', { method: 'POST', body: fd });
        const data = await res.json();

        if (data.success) {
            // Close modal if open, otherwise just refresh
            const modal = document.getElementById('createAnnouncementModal');
            if (modal && modal.style.display === 'flex') {
                closeCreateAnnouncementModal();
            }
            window.teacherAnnouncementCache = null;
            fetchTeacherAnnouncements();
        } else {
            errorDiv.textContent = data.error || 'Failed to send announcement.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send';
        if (loader) loader.style.display = 'none';
    }
};