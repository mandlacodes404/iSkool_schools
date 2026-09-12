function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherResourceCache = null;
window.teacherResourceCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherResources = function () {
    if (window.teacherResourceCache) return;
    if (window.teacherResourceCachePromise) return;
    window.teacherResourceCachePromise = fetch('api/teacher/get_resources.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherResourceCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherResourceCachePromise = null; });
};

window.fetchTeacherResources = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_resources");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_resources");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherResourceCache) {
        renderTeacherResources(window.teacherResourceCache);
        return;
    }

    try {
        if (!window.teacherResourceCachePromise) {
            window.teacherResourceCachePromise = fetch('api/teacher/get_resources.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherResourceCache = data;
                    return data;
                })
                .finally(() => { window.teacherResourceCachePromise = null; });
        }
        const data = await window.teacherResourceCachePromise;
        renderTeacherResources(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p class="rs-error-message">
                Error loading resources.
            </p>`;
    }
};

function renderTeacherResources(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Store flat list for desktop panel lookup ──
    window._allResourcesFlat = [];
    if (data && data.length > 0) {
        data.forEach(group => {
            group.items.forEach(item => {
                window._allResourcesFlat.push({ ...item, class_name: group.class_name });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="teacher-empty-state rs-empty-state-inline">No resources uploaded yet.</p>`;
    } else {
        data.forEach((group, groupIdx) => {
            const classGroupId = `rs-class-group-${groupIdx}`;
            let itemsHtml = '';
            group.items.forEach(item => {
                const isVideo  = item.resource_type === 'video';
                const flatIndex = window._allResourcesFlat.findIndex(r => r.id === item.id);
                itemsHtml += `
                    <div class="rs-sidebar-item" id="rs-sidebar-${flatIndex}"
                        onclick="selectDesktopResource(${flatIndex})">
                        <div class="rs-sidebar-item-icon">${getTeacherFileIcon(item.ext, isVideo)}</div>
                        <div class="rs-sidebar-item-info">
                            <div class="rs-sidebar-item-title">${item.title}</div>
                            <div class="rs-sidebar-item-meta">${isVideo ? 'VIDEO' : item.ext.toUpperCase()} &middot; ${item.uploaded_at}</div>
                        </div>
                    </div>`;
            });
            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                'rs-sidebar-class-label',
                group.class_name,
                itemsHtml
            );
        });
    }

    // ── Build full HTML ──
    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="rs-desktop-layout tchr-flat-layout">
            <div class="rs-sidebar tchr-flat-sidebar">
                <div class="rs-sidebar-header">
                    <span>Resources</span>
                    <button class="teacher-upload-btn teacher-desktop-create rs-new-btn" id="rs-new-btn" onclick="openUploadResourceForm()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="rs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="rs-main-panel tchr-flat-panel" id="rs-main-panel">
                <div class="rs-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select a resource from the left to view it</p>
                </div>
            </div>

            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Resources', `
                <p>Files and YouTube videos are both supported — learners can stream videos directly without leaving the page.</p>
                <p>Resources are grouped by class here, but every resource still belongs to only one class at a time.</p>
            `) : ''}
        </div>

        <!-- ═══ MOBILE LIST: class-grouped collapsible folders ═══ -->
        <div class="rs-mobile-list">`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No resources uploaded yet.</p>`;
    } else {
        data.forEach((group, groupIdx) => {
            // Separate id namespace from desktop's rs-class-group-{groupIdx}
            // so mobile folder collapse-state / DOM ids never collide with
            // the desktop sidebar's groups (same convention as Grades).
            const mobileGroupId = `rs-mobile-class-group-${groupIdx}`;
            let itemsHtml = '';

            group.items.forEach(item => {
                const isVideo = item.resource_type === 'video';
                const icon = getTeacherFileIcon(item.ext, isVideo);
                const clickAction = isVideo
                    ? `openTeacherVideoPanel(${JSON.stringify(item).replace(/"/g, '&quot;')})`
                    : `openTeacherResource('resources/${item.filename}')`;
                itemsHtml += `
                    <div class="teacher-resource-card" onclick="${clickAction}">
                        <div class="teacher-resource-icon">${icon}</div>
                        <div class="teacher-resource-info">
                            <div class="teacher-resource-name">${item.title}</div>
                            <div class="teacher-resource-meta">${isVideo ? '▶ Video' : item.ext.toUpperCase()} &middot; ${item.uploaded_at}</div>
                        </div>
                        <button class="teacher-resource-delete" onclick="event.stopPropagation(); confirmDeleteResource(${item.id})">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6l-1 14H6L5 6"></path>
                                <path d="M10 11v6"></path><path d="M14 11v6"></path>
                                <path d="M9 6V4h6v2"></path>
                            </svg>
                        </button>
                    </div>`;
            });

            html += window.buildCollapsibleClassGroup(
                mobileGroupId,
                'rs-mobile-class-label',
                group.class_name,
                itemsHtml
            );
        });
    }

    html += `</div>`; // close .rs-mobile-list

    // Delete modal (shared desktop+mobile) + Upload modal (mobile only)
    html += `
        <div id="uploadResourceModal" class="teacher-modal-overlay rs-modal-hidden">
            <div class="teacher-modal-box">
                <div class="teacher-modal-header">
                    <span>Upload Resource</span>
                    <button onclick="closeUploadResourceModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <label class="teacher-modal-label">Resource Title</label>
                    <input type="text" id="resourceTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Notes">

                    <label class="teacher-modal-label">Select Class</label>
                    <div id="resourceClassPicker"></div>

                    <label class="teacher-modal-label">Resource Type</label>
                    <div class="rs-form-section-gap">
                        <button id="rsTypeFile" onclick="rsSetType('file')" class="rs-type-toggle-btn active">
                            📎 File
                        </button>
                        <button id="rsTypeVideo" onclick="rsSetType('video')" class="rs-type-toggle-btn">
                            ▶ Video (YouTube)
                        </button>
                    </div>

                    <div id="rsFileSection">
                        <label class="teacher-modal-label">Select File (Max 10MB)</label>
                        <div class="teacher-file-drop" id="teacherFileDropArea">
                            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p>Click or drag file here</p>
                            <p class="rs-drop-hint">PDF, DOC, PPT, JPG, PNG, ZIP</p>
                            <input type="file" id="resourceFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" class="rs-hidden-file-input">
                        </div>
                        <div id="resourceFileName" class="rs-file-name-display"></div>
                    </div>

                    <div id="rsVideoSection" class="rs-video-section">
                        <label class="teacher-modal-label">YouTube URL</label>
                        <input type="text" id="resourceVideoUrl" class="teacher-modal-input"
                            placeholder="e.g. https://www.youtube.com/watch?v=...">
                        <p class="rs-video-warning">
                            ⚠️ Set the video to <strong>Unlisted</strong> on YouTube so only your learners can watch it.
                        </p>
                    </div>

                    <label class="teacher-modal-label rs-email-label">
                        <input type="checkbox" id="resourceForceEmail">
                        Also send email notification
                    </label>

                    <div id="uploadResourceError" class="rs-form-error"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeUploadResourceModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitUploadResource()" class="teacher-modal-submit" id="uploadResourceSubmitBtn">Upload</button>
                </div>
            </div>
        </div>

        <div id="deleteResourceModal" class="teacher-modal-overlay rs-modal-hidden">
            <div class="teacher-modal-box rs-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Resource</span>
                    <button onclick="closeDeleteResourceModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="rs-delete-modal-text">Are you sure you want to delete this resource? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteResourceModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteResource()" class="teacher-modal-submit rs-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();

    // Wire up file drop for mobile modal
    const dropArea = document.getElementById('teacherFileDropArea');
    const fileInput = document.getElementById('resourceFile');
    dropArea?.addEventListener('click', () => fileInput.click());
    dropArea?.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea?.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea?.addEventListener('drop', e => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        fileInput.files = e.dataTransfer.files;
        updateFileName();
    });
    fileInput?.addEventListener('change', updateFileName);

    loadResourceClasses();

    const sidebarScrollEl = apiArea.querySelector('.rs-sidebar-scroll');
    window.wireTeacherSectionScroll('resources-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('resources-sidebar', sidebarScrollEl);

    // Restore whichever resource was selected before navigating away.
    // Re-derive its current flatIndex from the saved stable id rather
    // than storing the index itself, since the index can shift if
    // resources are added/removed/reordered between visits.
    const savedId = window.teacherSectionState.selection.resources;
    if (savedId) {
        const flatIndex = window._allResourcesFlat.findIndex(r => r.id == savedId);
        if (flatIndex !== -1) selectDesktopResource(flatIndex);
    }
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE
// ─────────────────────────────────────────────
window.selectDesktopResource = function(flatIndex) {
    document.querySelectorAll('.rs-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('rs-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`rs-sidebar-${flatIndex}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const item = (window._allResourcesFlat || [])[flatIndex];
    if (!item) return;

    window.teacherSectionState.selection.resources = item.id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('rs-main-panel');
    if (!panel) return;

    const isVideo = item.resource_type === 'video';

    if (isVideo) {
        const icon    = getTeacherFileIcon('', true);
        const bigIcon = icon.replace('width="22"', 'width="52"').replace('height="22"', 'height="52"');
        panel.innerHTML = `
            <div class="rs-panel-content">
                <div class="rs-panel-header">
                    <div>
                        <div class="rs-panel-title">${item.title}</div>
                        <div class="rs-panel-meta">
                            <span>${item.class_name}</span>
                            <span>&bull;</span>
                            <span>YouTube Video</span>
                            <span>&bull;</span>
                            <span>${item.uploaded_at}</span>
                        </div>
                    </div>
                    <div class="rs-panel-actions">
                        <button class="rs-panel-delete-btn" onclick="confirmDeleteResource(${item.id})">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6l-1 14H6L5 6"></path>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
                <div class="rs-video-embed-wrap">
                    <iframe
                        src="${item.video_url}&autoplay=0&color=white&iv_load_policy=3"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                </div>
                <p class="rs-video-embed-note">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="#555e6a" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Learners watch this video directly inside iSkool — no YouTube account needed.
                </p>
            </div>`;
        return;
    }

    // ── File resource ──
    const icon    = getTeacherFileIcon(item.ext);
    const bigIcon = icon.replace('width="22"', 'width="52"').replace('height="22"', 'height="52"');

    panel.innerHTML = `
        <div class="rs-panel-content">
            <div class="rs-panel-header">
                <div>
                    <div class="rs-panel-title">${item.title}</div>
                    <div class="rs-panel-meta">
                        <span>${item.class_name}</span>
                        <span>&bull;</span>
                        <span>${item.ext.toUpperCase()}</span>
                        <span>&bull;</span>
                        <span>${item.uploaded_at}</span>
                    </div>
                </div>
                <div class="rs-panel-actions">
                    <button class="rs-panel-delete-btn" onclick="confirmDeleteResource(${item.id})">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14H6L5 6"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>

            <div class="rs-panel-preview">
                <div class="rs-preview-icon-dim">${bigIcon}</div>
                <div class="rs-panel-preview-label">
                    <strong class="rs-preview-title">${item.title}</strong><br>
                    <span class="rs-preview-subtext">${item.ext.toUpperCase()} &middot; Uploaded ${item.uploaded_at}</span>
                </div>
                <a href="resources/${item.filename}" target="_blank" class="rs-panel-open-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    Open File
                </a>
            </div>
        </div>`;
};

// ─────────────────────────────────────────────
// ROUTER: panel on desktop, modal on mobile
// ─────────────────────────────────────────────
window.openUploadResourceForm = function() {
    const panel = document.getElementById('rs-main-panel');
    if (window.innerWidth >= 900 && panel) {
        openUploadResourcePanel(panel);
    } else {
        openUploadResourceModal();
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL FORM
// ─────────────────────────────────────────────
function openUploadResourcePanel(panel) {
    document.querySelectorAll('.rs-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('rs-new-btn');
    if (newBtn) newBtn.classList.add('active');

    panel.innerHTML = `
        <div class="rs-panel-content">
            <div class="rs-panel-form-header">
                <div class="rs-panel-form-title">Upload Resource</div>
                <button onclick="fetchTeacherResources()" class="rs-panel-form-close-btn">&times;</button>
            </div>

            <label class="teacher-modal-label">Resource Title</label>
            <input type="text" id="resourceTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Notes">

            <label class="teacher-modal-label">Select Class</label>
            <div id="resourceClassPicker"></div>

            <label class="teacher-modal-label">Resource Type</label>
            <div class="rs-form-section-gap">
                <button id="rsTypeFile" onclick="rsSetType('file')" class="rs-type-toggle-btn active">
                    📎 File
                </button>
                <button id="rsTypeVideo" onclick="rsSetType('video')" class="rs-type-toggle-btn">
                    ▶ Video (YouTube)
                </button>
            </div>

            <div id="rsFileSection">
                <label class="teacher-modal-label">Select File (Max 10MB)</label>
                <div class="teacher-file-drop" id="teacherFileDropArea">
                    <svg viewBox="0 0 24 24" width="32" height="32" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p>Click or drag file here</p>
                    <p class="rs-drop-hint">PDF, DOC, PPT, JPG, PNG, ZIP</p>
                    <input type="file" id="resourceFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" class="rs-hidden-file-input">
                </div>
                <div id="resourceFileName" class="rs-file-name-display"></div>
            </div>

            <div id="rsVideoSection" class="rs-video-section">
                <label class="teacher-modal-label">YouTube URL</label>
                <input type="text" id="resourceVideoUrl" class="teacher-modal-input"
                    placeholder="e.g. https://www.youtube.com/watch?v=...">
                <p class="rs-video-warning">
                    ⚠️ Set the video to <strong>Unlisted</strong> on YouTube so only learners with the link can watch it.
                </p>
            </div>

            <label class="teacher-modal-label rs-email-label">
                <input type="checkbox" id="resourceForceEmail">
                Also send email notification
            </label>

            <div id="uploadResourceError" class="rs-form-error"></div>

            <div class="rs-panel-form-actions">
                <button onclick="fetchTeacherResources()"
                    class="teacher-modal-cancel rs-panel-form-cancel-btn">
                    Cancel
                </button>
                <button onclick="submitUploadResource()"
                    class="teacher-modal-submit rs-panel-form-submit-btn" id="uploadResourceSubmitBtn">
                    Upload Resource
                </button>
            </div>
        </div>`;

    const dropArea = document.getElementById('teacherFileDropArea');
    const fileInput = document.getElementById('resourceFile');
    dropArea?.addEventListener('click', () => fileInput.click());
    dropArea?.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea?.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea?.addEventListener('drop', e => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        fileInput.files = e.dataTransfer.files;
        updateFileName();
    });
    fileInput?.addEventListener('change', updateFileName);

    loadResourceClasses(panel, true);
}

function updateFileName() {
    const fileInput = document.getElementById('resourceFile');
    const display   = document.getElementById('resourceFileName');
    if (fileInput?.files[0]) {
        display.textContent = '📎 ' + fileInput.files[0].name;
    }
}

async function loadResourceClasses(panel = null, showLoader = false) {
    const hideInitialLoader = showLoader && window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(panel, 'Loading...')
        : null;
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('resourceClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
    } finally {
        if (hideInitialLoader) hideInitialLoader();
    }
}

window.openUploadResourceModal = function() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) modal.style.display = 'flex';
};

window.closeUploadResourceModal = function() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) modal.style.display = 'none';
    const t  = document.getElementById('resourceTitle');      if (t)  t.value = '';
    window.resetClassPicker('resourceClassPicker');
    const f  = document.getElementById('resourceFile');       if (f)  f.value = '';
    const fn = document.getElementById('resourceFileName');   if (fn) fn.textContent = '';
    const err = document.getElementById('uploadResourceError'); if (err) err.style.display = 'none';
};

window.rsSetType = function(type) {
    const fileSection  = document.getElementById('rsFileSection');
    const videoSection = document.getElementById('rsVideoSection');
    const fileBtn      = document.getElementById('rsTypeFile');
    const videoBtn     = document.getElementById('rsTypeVideo');
    if (type === 'video') {
        if (fileSection)  fileSection.style.display  = 'none';
        if (videoSection) videoSection.style.display = 'block';
        if (fileBtn)  fileBtn.classList.remove('active');
        if (videoBtn) videoBtn.classList.add('active');
    } else {
        if (fileSection)  fileSection.style.display  = 'block';
        if (videoSection) videoSection.style.display = 'none';
        if (fileBtn)  fileBtn.classList.add('active');
        if (videoBtn) videoBtn.classList.remove('active');
    }
    window._rsCurrentType = type;
};

// Mobile: open a video fullscreen overlay
window.openTeacherVideoPanel = function(item) {
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch(e) { return; } }
    const existing = document.getElementById('rsVideoOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'rsVideoOverlay';
    overlay.className = 'rs-video-overlay';
    overlay.innerHTML = `
        <div class="rs-video-overlay-header">
            <button onclick="document.getElementById('rsVideoOverlay').remove()" class="rs-video-overlay-back-btn">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
            </button>
            <div class="rs-video-overlay-title">${item.title}</div>
        </div>
        <div class="rs-video-overlay-body">
            <iframe src="${item.video_url}&autoplay=1&color=white&iv_load_policy=3"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
        </div>`;
    document.body.appendChild(overlay);
};

window.submitUploadResource = async function() {
    const title      = document.getElementById('resourceTitle')?.value.trim();
    const classId    = window.getClassPickerValue('resourceClassPicker');
    // The desktop panel and mobile modal can both exist in the page. Read
    // the visible checkbox so the teacher's selected value is the one sent.
    const forceEmailInput = Array.from(document.querySelectorAll('[id="resourceForceEmail"]'))
        .find(input => input.getClientRects().length > 0);
    const forceEmail = Boolean(forceEmailInput?.checked);
    const errorDiv   = document.getElementById('uploadResourceError');
    const submitBtn  = document.getElementById('uploadResourceSubmitBtn');
    const loader     = document.getElementById('loaderOverlay');
    const type       = window._rsCurrentType || 'file';
    const panel      = document.getElementById('rs-main-panel');
    const isDesktop  = window.innerWidth >= 900 && panel;

    if (errorDiv) errorDiv.style.display = 'none';

    if (!title)   { if (errorDiv) { errorDiv.textContent = 'Please enter a title.';  errorDiv.style.display = 'block'; } return; }
    if (!classId) { if (errorDiv) { errorDiv.textContent = 'Please select a class.'; errorDiv.style.display = 'block'; } return; }

    const fd = new FormData();
    fd.append('title', title);
    fd.append('class_id', classId);
    fd.append('resource_type', type);
    if (forceEmail) fd.append('force_email', '1');

    if (type === 'video') {
        const videoUrl = document.getElementById('resourceVideoUrl')?.value.trim();
        if (!videoUrl) { if (errorDiv) { errorDiv.textContent = 'Please enter a YouTube URL.'; errorDiv.style.display = 'block'; } return; }
        fd.append('video_url', videoUrl);
    } else {
        const file = document.getElementById('resourceFile')?.files[0];
        if (!file)    { if (errorDiv) { errorDiv.textContent = 'Please select a file.';   errorDiv.style.display = 'block'; } return; }
        if (file.size > 10 * 1024 * 1024) { if (errorDiv) { errorDiv.textContent = 'File too large. Max 10MB.'; errorDiv.style.display = 'block'; } return; }
        fd.append('resource', file);
    }

    const loadingText = type === 'video' ? 'Saving...' : 'Uploading...';
    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

    try {
        const res  = await fetch('api/teacher/upload_resource.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            const modal = document.getElementById('uploadResourceModal');
            if (modal && modal.style.display === 'flex') closeUploadResourceModal();
            window.teacherResourceCache = null;
            window._rsCurrentType = 'file';
            fetchTeacherResources();
        } else {
            if (errorDiv) { errorDiv.textContent = data.error || 'Upload failed.'; errorDiv.style.display = 'block'; }
        }
    } catch (e) {
        if (errorDiv) { errorDiv.textContent = 'Connection error. Please try again.'; errorDiv.style.display = 'block'; }
    } finally {
        hideSubmitLoader();
    }
};

let resourceToDelete = null;

window.confirmDeleteResource = function(id) {
    resourceToDelete = id;
    const modal = document.getElementById('deleteResourceModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteResourceModal = function() {
    resourceToDelete = null;
    const modal = document.getElementById('deleteResourceModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteResource = async function() {
    if (!resourceToDelete) return;
    const idToDelete = resourceToDelete;
    const deleteButton = document.querySelector('#deleteResourceModal .rs-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteResourceModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_resource.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherResourceCache = null;
            fetchTeacherResources();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};

window.openTeacherResource = function(path) {
    window.open(path, '_blank');
};

function getTeacherFileIcon(ext, isVideo = false) {
    const color = "#4fd1c5";
    if (isVideo) return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect></svg>`;
    if (ext === 'pdf') return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h3a2 2 0 0 1 0 4h-3V15z"></path></svg>`;
    if (['jpg','jpeg','png'].includes(ext)) return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
}