function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
// ══════════════════════════════════════════════════════════
// SETTINGS SECTION — assets/js/school/settings.js
// ══════════════════════════════════════════════════════════

// ── INJECT STYLES ──
(function injectSettingsStyles() {
    if (document.getElementById('sd-settings-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-settings-styles';
    s.textContent = `
        .sdset-shell {
            padding: 28px;
            max-width: 640px;
        }

        .sdset-title  { font-size: 22px; font-weight: 900; color: #e2e8f0; margin-bottom: 4px; }
        .sdset-sub    { font-size: 13px; color: #8b949e; margin-bottom: 32px; }

        /* Section card */
        .sdset-card {
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 20px;
        }
        .sdset-card-title {
            font-size: 11px; font-weight: 800;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #8b949e; margin-bottom: 20px;
            display: flex; align-items: center; gap: 8px;
        }
        .sdset-card-dot {
            width: 6px; height: 6px;
            border-radius: 50%; background: #4fd1c5;
        }

        /* Logo preview */
        .sdset-logo-row {
            display: flex; align-items: center; gap: 20px;
            margin-bottom: 20px;
        }
        .sdset-logo-preview {
            width: 80px; height: 80px;
            border-radius: 14px;
            border: 2px solid rgba(255,255,255,0.1);
            overflow: hidden;
            background: #0d1117;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .sdset-logo-preview img {
            width: 100%; height: 100%;
            object-fit: cover;
        }
        .sdset-logo-placeholder {
            font-size: 11px; font-weight: 700;
            color: #4a5568; text-align: center;
            line-height: 1.4;
        }
        .sdset-logo-info { flex: 1; }
        .sdset-logo-info-title {
            font-size: 14px; font-weight: 800; color: #e2e8f0;
            margin-bottom: 4px;
        }
        .sdset-logo-info-sub {
            font-size: 12px; color: #4a5568;
            line-height: 1.5;
        }

        /* Drop zone */
        .sdset-dropzone {
            border: 2px dashed rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 28px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
        }
        .sdset-dropzone:hover,
        .sdset-dropzone.drag-over {
            border-color: rgba(79,209,197,0.4);
            background: rgba(79,209,197,0.04);
        }
        .sdset-dropzone input[type="file"] {
            position: absolute; inset: 0;
            opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .sdset-dropzone-icon {
            width: 36px; height: 36px;
            margin: 0 auto 10px;
            background: rgba(79,209,197,0.1);
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
        }
        .sdset-dropzone-icon svg { width: 18px; height: 18px; stroke: #4fd1c5; }
        .sdset-dropzone-label {
            font-size: 13px; font-weight: 700; color: #8b949e;
            margin-bottom: 4px;
        }
        .sdset-dropzone-label span { color: #4fd1c5; }
        .sdset-dropzone-sub { font-size: 11px; color: #4a5568; }

        /* Input */
        .sdset-label {
            font-size: 11px; font-weight: 800;
            letter-spacing: 1px; text-transform: uppercase;
            color: #4a5568; margin-bottom: 8px;
            display: block;
        }
        .sdset-input {
            width: 100%;
            background: #0d1117;
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 8px;
            padding: 11px 14px;
            font-family: 'Nunito', sans-serif;
            font-size: 14px; font-weight: 700;
            color: #e2e8f0;
            outline: none;
            transition: border-color 0.2s;
        }
        .sdset-input:focus { border-color: rgba(79,209,197,0.4); }
        .sdset-input-hint {
            font-size: 11px; color: #4a5568;
            margin-top: 6px;
        }

        /* Save button */
        .sdset-btn {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 22px;
            border-radius: 8px;
            font-family: 'Nunito', sans-serif;
            font-size: 13px; font-weight: 800;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            margin-top: 16px;
        }
        .sdset-btn.primary {
            background: rgba(79,209,197,0.12);
            border: 1px solid rgba(79,209,197,0.3);
            color: #4fd1c5;
        }
        .sdset-btn.primary:hover {
            background: rgba(79,209,197,0.2);
            transform: translateY(-1px);
        }
        .sdset-btn:disabled {
            opacity: 0.5; cursor: not-allowed; transform: none;
        }
        .sdset-btn svg { width: 15px; height: 15px; stroke: currentColor; }

        /* Toast */
        .sdset-toast {
            display: none;
            align-items: center; gap: 10px;
            padding: 10px 16px;
            border-radius: 10px;
            font-size: 13px; font-weight: 700;
            margin-top: 12px;
        }
        .sdset-toast.success {
            background: rgba(34,197,94,0.1);
            border: 1px solid rgba(34,197,94,0.25);
            color: #22c55e;
        }
        .sdset-toast.error {
            background: rgba(248,81,73,0.1);
            border: 1px solid rgba(248,81,73,0.25);
            color: #f85149;
        }
        .sdset-toast svg { width: 15px; height: 15px; stroke: currentColor; flex-shrink: 0; }

        /* Upload progress */
        .sdset-uploading {
            display: none;
            align-items: center; gap: 10px;
            font-size: 13px; color: #8b949e;
            margin-top: 10px;
        }
        .sdset-spinner-sm {
            width: 16px; height: 16px;
            border: 2px solid rgba(255,255,255,0.1);
            border-top-color: #4fd1c5;
            border-radius: 50%;
            animation: sd-spin 0.8s linear infinite;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════════
// LOAD SETTINGS
// ══════════════════════════════════════════════════════════
window.loadSdSettings = async function() {
    const content = document.getElementById('sd-content');

    // Skeleton
    content.innerHTML = `
        <div class="sdset-shell">
            <div class="sd-skeleton" style="height:22px;width:160px;margin-bottom:8px;"></div>
            <div class="sd-skeleton" style="height:13px;width:280px;margin-bottom:32px;"></div>
            <div class="sd-skeleton" style="height:200px;border-radius:14px;margin-bottom:20px;"></div>
            <div class="sd-skeleton" style="height:120px;border-radius:14px;"></div>
        </div>`;

    try {
        const res  = await fetch('api/school/save_settings.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: new URLSearchParams({ action: 'get' })
        });
        const data = await res.json();
        renderSettings(data);
    } catch(e) {
        content.innerHTML = `<p style="color:var(--red);text-align:center;margin-top:60px;">Failed to load settings.</p>`;
    }
};

function renderSettings(data) {
    const content  = document.getElementById('sd-content');
    const logoPath = data.school_logo || '';
    const logoSrc  = logoPath ? logoPath : '';

    content.innerHTML = `
        <div class="sdset-shell">
            <div class="sdset-title">Settings</div>
            <div class="sdset-sub">Manage your school's identity on the platform</div>

            <!-- LOGO CARD -->
            <div class="sdset-card">
                <div class="sdset-card-title">
                    <span class="sdset-card-dot"></span>
                    School Logo
                </div>

                <div class="sdset-logo-row">
                    <div class="sdset-logo-preview" id="sdset-logo-preview">
                        ${logoSrc
                            ? `<img src="${logoSrc}?v=${Date.now()}" id="sdset-logo-img" alt="School Logo">`
                            : `<div class="sdset-logo-placeholder">No logo<br>uploaded</div>`}
                    </div>
                    <div class="sdset-logo-info">
                        <div class="sdset-logo-info-title">School Logo</div>
                        <div class="sdset-logo-info-sub">
                            Appears in the top navigation bar.<br>
                            JPG, PNG or WebP · Max 2MB · Square recommended
                        </div>
                    </div>
                </div>

                <div class="sdset-dropzone" id="sdset-dropzone">
                    <input type="file" id="sdset-logo-file" accept="image/jpeg,image/png,image/gif,image/webp" onchange="sdsetHandleLogoChange(this)">
                    <div class="sdset-dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="16 16 12 12 8 16"/>
                            <line x1="12" y1="12" x2="12" y2="21"/>
                            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                        </svg>
                    </div>
                    <div class="sdset-dropzone-label"><span>Click to upload</span> or drag and drop</div>
                    <div class="sdset-dropzone-sub">JPG, PNG, WebP up to 2MB</div>
                </div>

                <div class="sdset-uploading" id="sdset-uploading">
                    <div class="sdset-spinner-sm"></div>
                    Uploading logo...
                </div>
                <div class="sdset-toast" id="sdset-logo-toast"></div>
            </div>

            <!-- SCHOOL NAME CARD -->
            <div class="sdset-card">
                <div class="sdset-card-title">
                    <span class="sdset-card-dot" style="background:#a78bfa;"></span>
                    School Name
                </div>

                <label class="sdset-label" for="sdset-name-input">School Name</label>
                <input
                    class="sdset-input"
                    id="sdset-name-input"
                    type="text"
                    value="${(data.school_name || '').replace(/"/g, '&quot;')}"
                    placeholder="Enter your school name"
                    maxlength="100"
                >
                <div class="sdset-input-hint">This appears in the browser tab and top navigation bar</div>

                <button class="sdset-btn primary" onclick="sdsetSaveName()">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save Name
                </button>
                <div class="sdset-toast" id="sdset-name-toast"></div>
            </div>
        </div>`;

    // Drag-over visual feedback
    const dz = document.getElementById('sdset-dropzone');
    if (dz) {
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) sdsetUploadLogo(file);
        });
    }
}

// ── LOGO UPLOAD ──
window.sdsetHandleLogoChange = function(input) {
    const file = input.files?.[0];
    if (file) sdsetUploadLogo(file);
};

function sdsetUploadLogo(file) {
    const uploading = document.getElementById('sdset-uploading');
    const toast     = document.getElementById('sdset-logo-toast');
    const dz        = document.getElementById('sdset-dropzone');

    // Client-side validation
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
        sdsetShowToast(toast, 'error', 'Invalid file type. Please upload a JPG, PNG or WebP image.');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        sdsetShowToast(toast, 'error', 'File too large. Maximum size is 2MB.');
        return;
    }

    // Show uploading state
    toast.style.display = 'none';
    uploading.style.display = 'flex';
    if (dz) dz.style.opacity = '0.5';

    const formData = new FormData();
    formData.append('action', 'upload_logo');
    formData.append('logo', file);

    fetch('api/school/save_settings.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: formData })
        .then(r => r.json())
        .then(data => {
            uploading.style.display = 'none';
            if (dz) dz.style.opacity = '1';

            if (data.success) {
                // Update preview
                const preview = document.getElementById('sdset-logo-preview');
                if (preview) {
                    preview.innerHTML = `<img src="${data.logo_path}?v=${Date.now()}" id="sdset-logo-img" alt="School Logo">`;
                }
                // Update top nav logo
                const navLogo = document.querySelector('.sd-topnav-brand img');
                if (navLogo) navLogo.src = data.logo_path + '?v=' + Date.now();

                sdsetShowToast(toast, 'success', 'Logo updated successfully!');
            } else {
                sdsetShowToast(toast, 'error', data.error || 'Upload failed.');
            }
        })
        .catch(() => {
            uploading.style.display = 'none';
            if (dz) dz.style.opacity = '1';
            sdsetShowToast(toast, 'error', 'Network error. Please try again.');
        });
}

// ── SAVE NAME ──
window.sdsetSaveName = function() {
    const input = document.getElementById('sdset-name-input');
    const toast = document.getElementById('sdset-name-toast');
    const btn   = document.querySelector('.sdset-btn.primary');
    const name  = input?.value?.trim();

    if (!name) {
        sdsetShowToast(toast, 'error', 'School name cannot be empty.');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    fetch('api/school/save_settings.php', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: new URLSearchParams({ action: 'update_name', school_name: name })
    })
    .then(r => r.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Name`;
        }

        if (data.success) {
            // Update top nav school name live
            const navName = document.querySelector('.sd-topnav-school');
            if (navName) navName.textContent = data.school_name;

            sdsetShowToast(toast, 'success', 'School name updated successfully!');
        } else {
            sdsetShowToast(toast, 'error', data.error || 'Failed to save.');
        }
    })
    .catch(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Name'; }
        sdsetShowToast(toast, 'error', 'Network error. Please try again.');
    });
};

// ── TOAST HELPER ──
function sdsetShowToast(el, type, message) {
    if (!el) return;
    const icon = type === 'success'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    el.className = `sdset-toast ${type}`;
    el.innerHTML = icon + message;
    el.style.display = 'flex';
    // Auto-hide after 4 seconds
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
