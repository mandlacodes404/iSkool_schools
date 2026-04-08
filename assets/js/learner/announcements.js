window.announcementCache = null;

window.fetchAnnouncements = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "announcement_list.php");
    if (typeof window.setActive === 'function') window.setActive("announcement_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Announcements', mode: 'standard' });
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
    if (window.announcementCache) {
        renderAnnouncements(window.announcementCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_announcements.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.announcementCache = data; 
        renderAnnouncements(data);
    } catch (error) {
        console.error("Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading announcements.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No announcements found.</p>";
        return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerAnnouncementsFlat = [];
    for (const [teacher, items] of Object.entries(data)) {
        items.forEach(ann => {
            window._allLearnerAnnouncementsFlat.push({ ...ann, teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;
    for (const [teacher, items] of Object.entries(data)) {
        sidebarHtml += `<div class="lan-sidebar-teacher-label">${teacher}</div>`;
        items.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            sidebarHtml += `
                <div class="lan-sidebar-item" id="lan-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerAnnouncement(${flatIdx})">
                    <div class="lan-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                    </div>
                    <div class="lan-sidebar-item-info">
                        <div class="lan-sidebar-item-title">${ann.title}</div>
                        <div class="lan-sidebar-item-meta">${ann.display_date}</div>
                    </div>
                    ${isNew ? '<span class="lan-sidebar-new-badge">NEW</span>' : ''}
                </div>`;
            flatIdx++;
        });
    }

    // ── Build full HTML ──
    let html = `
        <style>
            @media (min-width: 900px) {
                .lan-desktop-layout { display: flex !important; }
                .lan-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .lan-desktop-layout { display: none !important; }
                .lan-mobile-list    { display: block !important; }
            }

            .lan-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lan-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lan-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .lan-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lan-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lan-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lan-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lan-sidebar-teacher-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .lan-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lan-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lan-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .lan-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .lan-sidebar-item-info { flex: 1; min-width: 0; }
            .lan-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lan-sidebar-item.active .lan-sidebar-item-title { color: #e2e8f0; }
            .lan-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .lan-sidebar-new-badge {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                border: 1px solid rgba(79,209,197,0.4);
                font-size: 9px;
                font-weight: 800;
                padding: 2px 5px;
                border-radius: 4px;
                flex-shrink: 0;
                letter-spacing: 0.5px;
            }

            .lan-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lan-main-panel::-webkit-scrollbar { width: 5px; }
            .lan-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lan-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lan-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lan-panel-empty svg { opacity: 0.3; }
            .lan-panel-empty p { font-size: 14px; margin: 0; }

            .lan-panel-content { padding: 28px 32px; }

            .lan-panel-header {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }
            .lan-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #4fd1c5;
                margin: 0 0 8px;
            }
            .lan-panel-meta {
                font-size: 13px;
                color: #8b949e;
            }
            .lan-panel-message {
                font-size: 14px;
                color: #e2e8f0;
                line-height: 1.8;
            }

            /* ── MOBILE LIST STYLES ── */
            .lan-mobile-list {
                background: #1a1919;
                border-radius: 12px;
                overflow: hidden;
                margin: 8px 0 16px;
            }
            .lan-mobile-teacher-header {
                padding: 16px 16px 6px;
                font-size: 11px;
                font-weight: 600;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 1px;
                background: #1a1919;
            }
            .lan-mobile-card {
                display: flex;
                align-items: flex-start;
                gap: 14px;
                padding: 14px 16px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .lan-mobile-card:last-child { border-bottom: none; }
            .lan-mobile-card-icon {
                flex-shrink: 0;
                margin-top: 2px;
                opacity: 0.7;
            }
            .lan-mobile-card-body { flex: 1; min-width: 0; }
            .lan-mobile-card-title {
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;
                margin: 0 0 6px;
                line-height: 1.4;
            }
            .lan-mobile-card-message {
                font-size: 13px;
                color: #8b949e;
                line-height: 1.6;
                margin: 0 0 8px;
            }
            .lan-mobile-card-date {
                font-size: 11px;
                color: #555e6a;
            }
            .lan-mobile-new-badge {
                display: inline-block;
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                border: 1px solid rgba(79,209,197,0.35);
                font-size: 9px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                letter-spacing: 0.5px;
                margin-left: 8px;
                vertical-align: middle;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lan-desktop-layout">
            <div class="lan-sidebar">
                <div class="lan-sidebar-header">All Announcements</div>
                <div class="lan-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lan-main-panel" id="lan-main-panel">
                <div class="lan-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <p>Select an announcement from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="lan-mobile-list">`;

    for (const [teacher, items] of Object.entries(data)) {
        html += `<div class="lan-mobile-teacher-header">${teacher}</div>`;

        items.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            html += `
                <div class="lan-mobile-card">
                    <div class="lan-mobile-card-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fd1c5" stroke-width="2" fill="none">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                    </div>
                    <div class="lan-mobile-card-body">
                        <div class="lan-mobile-card-title">
                            ${ann.title}
                            ${isNew ? '<span class="lan-mobile-new-badge">NEW</span>' : ''}
                        </div>
                        <div class="lan-mobile-card-message">${ann.message.replace(/\n/g, '<br>')}</div>
                        <div class="lan-mobile-card-date">${ann.display_date}</div>
                    </div>
                </div>`;
        });
    }

    html += `</div>`; // close .lan-mobile-list

    apiArea.innerHTML = html;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ANNOUNCEMENT
// ─────────────────────────────────────────────
window.selectDesktopLearnerAnnouncement = function(flatIdx) {
    document.querySelectorAll('.lan-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lan-sidebar-${flatIdx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const ann = (window._allLearnerAnnouncementsFlat || [])[flatIdx];
    if (!ann) return;

    const panel = document.getElementById('lan-main-panel');
    if (!panel) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isNew = new Date(ann.created_at) > sevenDaysAgo;

    panel.innerHTML = `
        <div class="lan-panel-content">
            <div class="lan-panel-header">
                <div>
                    <div class="lan-panel-title">
                        <i class="fas fa-bullhorn" style="margin-right:8px;"></i>${ann.title}
                    </div>
                    <div class="lan-panel-meta">${ann.teacher} &bull; ${ann.display_date}</div>
                </div>
                ${isNew ? '<span style="background:rgba(79,209,197,0.1);color:#4fd1c5;border:1px solid #4fd1c5;padding:3px 10px;font-size:11px;font-weight:800;border-radius:6px;letter-spacing:0.5px;">NEW</span>' : ''}
            </div>
            <div class="lan-panel-message">
                ${ann.message.replace(/\n/g, '<br>')}
            </div>
        </div>`;
};