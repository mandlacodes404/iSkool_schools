/* assets/js/resources.js */
window.resourceCache = null;

window.fetchResources = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "resource_list.php");
    if (typeof window.setActive === 'function') window.setActive("resource_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Resources', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Preparation
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4. CACHE CHECK (Instant Load)
    if (window.resourceCache) {
        renderResourceCards(window.resourceCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_resources.php');
        if (!response.ok) throw new Error('Failed to fetch resources');
        const data = await response.json();
        window.resourceCache = data; 
        renderResourceCards(data);
    } catch (error) {
        console.error("Resource Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading resources.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderResourceCards(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No resources found.</p>";
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerResourcesFlat = [];
    for (const [teacher, files] of Object.entries(data)) {
        files.forEach(file => {
            window._allLearnerResourcesFlat.push({ ...file, teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    for (const [teacher, files] of Object.entries(data)) {
        sidebarHtml += `<div class="lrs-sidebar-teacher-label">${teacher}</div>`;
        files.forEach(file => {
            sidebarHtml += `
                <div class="lrs-sidebar-item" id="lrs-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerResource(${flatIdx})">
                    <div class="lrs-sidebar-item-icon">
                        ${getFileIcon(file.ext)}
                    </div>
                    <div class="lrs-sidebar-item-info">
                        <div class="lrs-sidebar-item-title">${file.title}</div>
                        <div class="lrs-sidebar-item-meta">${file.ext ? file.ext.toUpperCase() : 'FILE'} &middot; ${file.size || 'N/A'}</div>
                    </div>
                </div>`;
            flatIdx++;
        });
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lrs-desktop-layout { display: flex !important; }
                .lrs-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .lrs-desktop-layout { display: none !important; }
                .lrs-mobile-list    { display: block !important; }
            }

            .lrs-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lrs-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lrs-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .lrs-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lrs-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lrs-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lrs-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lrs-sidebar-teacher-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .lrs-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lrs-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lrs-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .lrs-sidebar-item-icon { flex-shrink: 0; opacity: 0.8; }
            .lrs-sidebar-item-info { flex: 1; min-width: 0; }
            .lrs-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lrs-sidebar-item.active .lrs-sidebar-item-title { color: #e2e8f0; }
            .lrs-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            .lrs-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lrs-main-panel::-webkit-scrollbar { width: 5px; }
            .lrs-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lrs-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lrs-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lrs-panel-empty svg { opacity: 0.3; }
            .lrs-panel-empty p { font-size: 14px; margin: 0; }

            .lrs-panel-content { padding: 28px 32px; }

            .lrs-panel-header {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: flex-start;
                gap: 18px;
            }
            .lrs-panel-icon { flex-shrink: 0; opacity: 0.9; }
            .lrs-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #4fd1c5;
                margin: 0 0 6px;
                line-height: 1.3;
            }
            .lrs-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .lrs-open-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(79,209,197,0.1);
                border: 1px solid rgba(79,209,197,0.4);
                color: #4fd1c5;
                padding: 12px 28px;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                transition: all 0.2s ease;
                margin-top: 8px;
            }
            .lrs-open-btn:hover {
                background: rgba(79,209,197,0.2);
                border-color: #4fd1c5;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lrs-desktop-layout">
            <div class="lrs-sidebar">
                <div class="lrs-sidebar-header">All Resources</div>
                <div class="lrs-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lrs-main-panel" id="lrs-main-panel">
                <div class="lrs-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <p>Select a resource from the left to open it</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="lrs-mobile-list">`;

    for (const [teacher, files] of Object.entries(data)) {
        html += `<h3 style="margin: 20px 15px 10px;">${teacher}</h3>`;
        files.forEach(file => {
            const icon = getFileIcon(file.ext);

            html += `
    <div class="quiz-card resource-item" style="cursor: pointer; transition: 0.2s;" 
         onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')">
        
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            <div style="flex-shrink: 0;">${icon}</div>
            
            <div style="flex: 1;">
                <h4 style="margin:0; font-size:15px; color: #4fd1c5; text-decoration: none;">
                    ${file.title} 
                    <span style="font-size: 11px; color: #888; font-weight: normal; margin-left: 5px;">
                        (${file.size || 'N/A'})
                    </span>
                </h4>
                
                <div style="margin-top: 4px; display: flex; align-items: center; gap: 5px;">
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="#888" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <small style="color:#888;">Uploaded: ${file.uploaded_at}</small>
                </div>
            </div>
            
            <div style="color: #444;">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </div>
    </div>`;
        });
    }

    html += `</div>`; // close .lrs-mobile-list

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT RESOURCE
// ─────────────────────────────────────────────
window.selectDesktopLearnerResource = function(flatIdx) {
    document.querySelectorAll('.lrs-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lrs-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const file = (window._allLearnerResourcesFlat || [])[flatIdx];
    if (!file) return;

    const panel = document.getElementById('lrs-main-panel');
    if (!panel) return;

    const icon = getFileIcon(file.ext);

    panel.innerHTML = `
        <div class="lrs-panel-content">
            <div class="lrs-panel-header">
                <div class="lrs-panel-icon" style="transform:scale(1.6);transform-origin:top left;margin-right:8px;">
                    ${icon}
                </div>
                <div>
                    <div class="lrs-panel-title">${file.title}</div>
                    <div class="lrs-panel-meta">
                        <span>${file.teacher}</span>
                        <span>&bull;</span>
                        <span>${file.ext ? file.ext.toUpperCase() : 'FILE'}</span>
                        <span>&bull;</span>
                        <span>${file.size || 'N/A'}</span>
                        <span>&bull;</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="#8b949e" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>Uploaded: ${file.uploaded_at}</span>
                    </div>
                </div>
            </div>
            <button class="lrs-open-btn"
                onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Open Resource
            </button>
        </div>`;
};

function getFileIcon(ext) {
    const color = "#4fd1c5";
    // PDF Icon
    if (ext === 'pdf') {
        return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h3a2 2 0 0 1 0 4h-3V15z"></path></svg>`;
    }
    // Image Icon
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
        return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }
    // Word/Doc Icon
    return `<svg viewBox="0 0 24 24" width="20" height="20" stroke="${color}" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
}

// Reuse your Menu Logic
window.openResourceMenu = function(btn) {
    // Here you would trigger your #resourcePopup logic from the original file
    // For now, let's keep it simple:
    window.open(path, '_blank'); 
};