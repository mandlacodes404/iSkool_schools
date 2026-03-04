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

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Resources</h2>
            <button class="teacher-upload-btn" onclick="openUploadResourceModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Upload Resource
            </button>
        </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No resources uploaded yet.</p>`;
        apiArea.innerHTML = html;
        
    }

    data.forEach(group => {
        html += `<div class="teacher-resource-section">
            <div class="teacher-resource-class-label">${group.class_name}</div>`;

        group.items.forEach(item => {
            const icon = getTeacherFileIcon(item.ext);
            html += `
                <div class="teacher-resource-card" onclick="openTeacherResource('resources/${item.filename}')">
                    <div class="teacher-resource-icon">${icon}</div>
                    <div class="teacher-resource-info">
                        <div class="teacher-resource-name">${item.title}</div>
                        <div class="teacher-resource-meta">${item.ext.toUpperCase()} &middot; ${item.uploaded_at}</div>
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

    // Upload Modal
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
                    <select id="resourceClass" class="teacher-modal-input">
                        <option value="">-- Choose Class --</option>
                    </select>

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

    // Setup file drop area
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

    // Load classes into dropdown
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
        const sel  = document.getElementById('resourceClass');
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

window.openUploadResourceModal = function() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) modal.style.display = 'flex';
};

window.closeUploadResourceModal = function() {
    const modal = document.getElementById('uploadResourceModal');
    if (modal) modal.style.display = 'none';
    document.getElementById('resourceTitle').value = '';
    document.getElementById('resourceClass').value = '';
    document.getElementById('resourceFile').value = '';
    document.getElementById('resourceFileName').textContent = '';
    document.getElementById('uploadResourceError').style.display = 'none';
};

window.submitUploadResource = async function() {
    const title    = document.getElementById('resourceTitle').value.trim();
    const classId  = document.getElementById('resourceClass').value;
    const file     = document.getElementById('resourceFile').files[0];
    const forceEmail = document.getElementById('resourceForceEmail').checked;
    const errorDiv = document.getElementById('uploadResourceError');
    const submitBtn = document.getElementById('uploadResourceSubmitBtn');
    const loader   = document.getElementById('loaderOverlay');

    errorDiv.style.display = 'none';

    if (!title) { errorDiv.textContent = 'Please enter a title.'; errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.'; errorDiv.style.display = 'block'; return; }
    if (!file) { errorDiv.textContent = 'Please select a file.'; errorDiv.style.display = 'block'; return; }
    if (file.size > 10 * 1024 * 1024) { errorDiv.textContent = 'File too large. Max 10MB.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title', title);
    fd.append('class_id', classId);
    fd.append('resource', file);
    if (forceEmail) fd.append('force_email', '1');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/upload_resource.php', { method: 'POST', body: fd });
        const data = await res.json();

        if (data.success) {
            closeUploadResourceModal();
            window.teacherResourceCache = null;
            fetchTeacherResources();
        } else {
            errorDiv.textContent = data.error || 'Upload failed.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload';
        if (loader) loader.style.display = 'none';
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
        const res  = await fetch('api/teacher/delete_resource.php', { method: 'POST', body: fd });
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

function getTeacherFileIcon(ext) {
    const color = "#4fd1c5";
    if (ext === 'pdf') return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h3a2 2 0 0 1 0 4h-3V15z"></path></svg>`;
    if (['jpg','jpeg','png'].includes(ext)) return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    return `<svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
}