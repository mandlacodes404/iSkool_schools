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
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderTeacherAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Announcements</h2>
            <button class="teacher-upload-btn" onclick="openCreateAnnouncementModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Announcement
            </button>
        </div>`;

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
            closeCreateAnnouncementModal();
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