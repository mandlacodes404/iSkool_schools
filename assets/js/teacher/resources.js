function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherResourceCache = null;

window.fetchTeacherResources = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_resources");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_resources");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherResourceCache) {
        renderTeacherResources(window.teacherResourceCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_resources.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherResourceCache = data;
        renderTeacherResources(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading resources.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
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
        sidebarHtml = `<p class="teacher-empty-state" style="padding:16px;font-size:13px;">No resources uploaded yet.</p>`;
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
        <style>
            @media (min-width: 900px) {
                .rs-desktop-layout { display: flex !important; }
                .rs-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .rs-desktop-layout { display: none !important; }
                .rs-mobile-list    { display: block !important; }
            }

            .rs-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .rs-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .rs-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .rs-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .rs-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .rs-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .rs-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .rs-sidebar-class-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .rs-sidebar-class-label.tchr-sidebar-class-label--toggle {
                padding-top: 8px;
                padding-bottom: 6px;
            }
            .rs-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .rs-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .rs-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .rs-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .rs-sidebar-item-info { flex: 1; min-width: 0; }
            .rs-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .rs-sidebar-item.active .rs-sidebar-item-title { color: #e2e8f0; }
            .rs-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            .rs-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .rs-main-panel::-webkit-scrollbar { width: 5px; }
            .rs-main-panel::-webkit-scrollbar-track { background: transparent; }
            .rs-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .rs-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .rs-panel-empty svg { opacity: 0.3; }
            .rs-panel-empty p { font-size: 14px; margin: 0; }

            .rs-panel-content { padding: 28px 32px; }

            .rs-panel-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-wrap: wrap;
            }
            .rs-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 6px;
            }
            .rs-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .rs-panel-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

            .rs-panel-preview {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 12px;
                padding: 40px 32px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                min-height: 200px;
            }
            .rs-panel-preview-label {
                font-size: 14px;
                color: #8b949e;
                text-align: center;
                line-height: 1.6;
            }
            .rs-panel-open-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(79,209,197,0.12);
                border: 1px solid rgba(79,209,197,0.3);
                color: #4fd1c5;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s;
                text-decoration: none;
            }
            .rs-panel-open-btn:hover { background: rgba(79,209,197,0.2); }
            .rs-panel-delete-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(248,81,73,0.1);
                border: 1px solid rgba(248,81,73,0.25);
                color: #f85149;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s;
            }
            .rs-panel-delete-btn:hover { background: rgba(248,81,73,0.18); }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="rs-desktop-layout">
            <div class="rs-sidebar">
                <div class="rs-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Resources</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openUploadResourceForm()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="rs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="rs-main-panel" id="rs-main-panel">
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
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="rs-mobile-list">`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No resources uploaded yet.</p>`;
    } else {
        data.forEach(group => {
            html += `<div class="teacher-resource-section">
                <div class="teacher-resource-class-label">${group.class_name}</div>`;

            group.items.forEach(item => {
                const isVideo = item.resource_type === 'video';
                const icon = getTeacherFileIcon(item.ext, isVideo);
                const clickAction = isVideo
                    ? `openTeacherVideoPanel(${JSON.stringify(item).replace(/"/g, '&quot;')})`
                    : `openTeacherResource('resources/${item.filename}')`;
                html += `
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

            html += `</div>`;
        });
    }

    html += `</div>`; // close .rs-mobile-list

    // Delete modal (shared desktop+mobile) + Upload modal (mobile only)
    html += `
        <div id="uploadResourceModal" class="teacher-modal-overlay" style="display:none;">
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
                    <div style="display:flex;gap:8px;margin-bottom:16px;">
                        <button id="rsTypeFile" onclick="rsSetType('file')"
                            style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(79,209,197,0.4);
                                   background:rgba(79,209,197,0.12);color:#4fd1c5;font-weight:700;
                                   font-family:'Nunito',sans-serif;cursor:pointer;font-size:13px;">
                            📎 File
                        </button>
                        <button id="rsTypeVideo" onclick="rsSetType('video')"
                            style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);
                                   background:transparent;color:#8b949e;font-weight:700;
                                   font-family:'Nunito',sans-serif;cursor:pointer;font-size:13px;">
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
                            <p style="font-size:12px;color:#666;">PDF, DOC, PPT, JPG, PNG, ZIP</p>
                            <input type="file" id="resourceFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" style="display:none;">
                        </div>
                        <div id="resourceFileName" style="font-size:13px;color:#4fd1c5;margin-top:8px;"></div>
                    </div>

                    <div id="rsVideoSection" style="display:none;">
                        <label class="teacher-modal-label">YouTube URL</label>
                        <input type="text" id="resourceVideoUrl" class="teacher-modal-input"
                            placeholder="e.g. https://www.youtube.com/watch?v=...">
                        <p style="font-size:12px;color:#8b949e;margin:8px 0 0;line-height:1.6;">
                            ⚠️ Set the video to <strong style="color:#e2e8f0;">Unlisted</strong> on YouTube so only your learners can watch it.
                        </p>
                    </div>

                    <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                        <input type="checkbox" id="resourceForceEmail">
                        Also send email notification
                    </label>

                    <div id="uploadResourceError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeUploadResourceModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitUploadResource()" class="teacher-modal-submit" id="uploadResourceSubmitBtn">Upload</button>
                </div>
            </div>
        </div>

        <div id="deleteResourceModal" class="teacher-modal-overlay" style="display:none;">
            <div class="teacher-modal-box" style="max-width:380px;">
                <div class="teacher-modal-header">
                    <span>Delete Resource</span>
                    <button onclick="closeDeleteResourceModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p style="color:#c9d1d9;font-size:15px;">Are you sure you want to delete this resource? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteResourceModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteResource()" class="teacher-modal-submit" style="background:#e74c3c;">Delete</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;

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
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE
// ─────────────────────────────────────────────
window.selectDesktopResource = function(flatIndex) {
    document.querySelectorAll('.rs-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`rs-sidebar-${flatIndex}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const item = (window._allResourcesFlat || [])[flatIndex];
    if (!item) return;

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
                <div style="position:relative;width:100%;padding-bottom:56.25%;background:#000;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">
                    <iframe
                        src="${item.video_url}&autoplay=0&color=white&iv_load_policy=3"
                        style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                </div>
                <p style="margin:12px 0 0;font-size:12px;color:#555e6a;text-align:center;">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="#555e6a" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
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
                <div style="opacity:0.55;">${bigIcon}</div>
                <div class="rs-panel-preview-label">
                    <strong style="color:#c9d1d9;">${item.title}</strong><br>
                    <span style="font-size:12px;">${item.ext.toUpperCase()} &middot; Uploaded ${item.uploaded_at}</span>
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

    panel.innerHTML = `
        <div class="rs-panel-content">
            <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.07);
                        display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:18px;font-weight:800;color:#e2e8f0;">Upload Resource</div>
                <button onclick="fetchTeacherResources()"
                    style="background:none;border:none;color:#8b949e;font-size:22px;
                           cursor:pointer;line-height:1;padding:0;">&times;</button>
            </div>

            <label class="teacher-modal-label">Resource Title</label>
            <input type="text" id="resourceTitle" class="teacher-modal-input" placeholder="e.g. Chapter 3 Notes">

            <label class="teacher-modal-label">Select Class</label>
            <div id="resourceClassPicker"></div>

            <label class="teacher-modal-label">Resource Type</label>
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button id="rsTypeFile" onclick="rsSetType('file')"
                    style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(79,209,197,0.4);
                           background:rgba(79,209,197,0.12);color:#4fd1c5;font-weight:700;
                           font-family:'Nunito',sans-serif;cursor:pointer;font-size:13px;">
                    📎 File
                </button>
                <button id="rsTypeVideo" onclick="rsSetType('video')"
                    style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);
                           background:transparent;color:#8b949e;font-weight:700;
                           font-family:'Nunito',sans-serif;cursor:pointer;font-size:13px;">
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
                    <p style="font-size:12px;color:#666;">PDF, DOC, PPT, JPG, PNG, ZIP</p>
                    <input type="file" id="resourceFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" style="display:none;">
                </div>
                <div id="resourceFileName" style="font-size:13px;color:#4fd1c5;margin-top:8px;"></div>
            </div>

            <div id="rsVideoSection" style="display:none;">
                <label class="teacher-modal-label">YouTube URL</label>
                <input type="text" id="resourceVideoUrl" class="teacher-modal-input"
                    placeholder="e.g. https://www.youtube.com/watch?v=...">
                <p style="font-size:12px;color:#8b949e;margin:8px 0 0;line-height:1.6;">
                    ⚠️ Set the video to <strong style="color:#e2e8f0;">Unlisted</strong> on YouTube so only learners with the link can watch it.
                </p>
            </div>

            <label class="teacher-modal-label" style="display:flex;align-items:center;gap:8px;margin-top:16px;">
                <input type="checkbox" id="resourceForceEmail">
                Also send email notification
            </label>

            <div id="uploadResourceError" style="color:#ff5555;font-size:13px;margin-top:10px;display:none;"></div>

            <div style="display:flex;gap:12px;margin-top:24px;">
                <button onclick="fetchTeacherResources()"
                    class="teacher-modal-cancel" style="flex:1;padding:13px;">
                    Cancel
                </button>
                <button onclick="submitUploadResource()"
                    class="teacher-modal-submit" id="uploadResourceSubmitBtn"
                    style="flex:2;padding:13px;font-size:14px;">
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

    loadResourceClasses();
}

function updateFileName() {
    const fileInput = document.getElementById('resourceFile');
    const display   = document.getElementById('resourceFileName');
    if (fileInput?.files[0]) {
        display.textContent = '📎 ' + fileInput.files[0].name;
    }
}

async function loadResourceClasses() {
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('resourceClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
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
    const activeStyle  = 'border:1px solid rgba(79,209,197,0.4);background:rgba(79,209,197,0.12);color:#4fd1c5;';
    const inactiveStyle = 'border:1px solid rgba(255,255,255,0.1);background:transparent;color:#8b949e;';
    if (type === 'video') {
        if (fileSection)  fileSection.style.display  = 'none';
        if (videoSection) videoSection.style.display = 'block';
        if (fileBtn)  fileBtn.style.cssText  += inactiveStyle;
        if (videoBtn) videoBtn.style.cssText += activeStyle;
    } else {
        if (fileSection)  fileSection.style.display  = 'block';
        if (videoSection) videoSection.style.display = 'none';
        if (fileBtn)  fileBtn.style.cssText  += activeStyle;
        if (videoBtn) videoBtn.style.cssText += inactiveStyle;
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
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;';
    overlay.innerHTML = `
        <div style="padding:14px 16px;background:rgba(0,0,0,0.6);display:flex;align-items:center;gap:12px;flex-shrink:0;">
            <button onclick="document.getElementById('rsVideoOverlay').remove()"
                style="background:#1b1b1b;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;
                       padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;
                       font-family:'Nunito',sans-serif;display:flex;align-items:center;gap:6px;font-size:13px;">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
            </button>
            <div style="font-size:14px;font-weight:700;color:#e2e8f0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</div>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0;">
            <iframe src="${item.video_url}&autoplay=1&color=white&iv_load_policy=3"
                style="width:100%;height:100%;border:none;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
        </div>`;
    document.body.appendChild(overlay);
};

window.submitUploadResource = async function() {
    const title      = document.getElementById('resourceTitle')?.value.trim();
    const classId    = window.getClassPickerValue('resourceClassPicker');
    const forceEmail = document.getElementById('resourceForceEmail')?.checked;
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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = loadingText; }
    const hideSubmitLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, loadingText)
        : null;
    if (!hideSubmitLoader && loader) loader.style.display = 'flex';

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
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload Resource'; }
        if (hideSubmitLoader) hideSubmitLoader();
        else if (loader) loader.style.display = 'none';
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
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';
    closeDeleteResourceModal();

    try {
        const fd = new FormData();
        fd.append('id', resourceToDelete);
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
        if (loader) loader.style.display = 'none';
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