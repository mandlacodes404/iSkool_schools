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

    // data shape expected:
    // {
    //   school_wide: [ { id, title, message, created_at, display_date, sender } ],
    //   teacher:     { "Teacher Name": [ { id, title, message, created_at, display_date } ], ... }
    // }

    const schoolWide  = data.school_wide  || [];
    const teacherData = data.teacher      || {};

    const hasSchoolWide  = schoolWide.length > 0;
    const hasTeacher     = Object.keys(teacherData).length > 0;

    if (!hasSchoolWide && !hasTeacher) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No announcements found.</p>";
        return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ── Build flat list (school-wide FIRST, then teacher) ──
    window._allLearnerAnnouncementsFlat = [];

    schoolWide.forEach(ann => {
        window._allLearnerAnnouncementsFlat.push({ ...ann, _type: 'school', teacher: ann.sender || 'School Admin' });
    });

    for (const [teacher, items] of Object.entries(teacherData)) {
        items.forEach(ann => {
            window._allLearnerAnnouncementsFlat.push({ ...ann, _type: 'teacher', teacher });
        });
    }

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    let flatIdx = 0;

    // School-wide section
    if (hasSchoolWide) {
        sidebarHtml += `
            <div class="lan-sidebar-section-label lan-section-school">
                <svg viewBox="0 0 24 24" width="10" height="10" stroke="#d29522" stroke-width="2.5" fill="none" style="flex-shrink:0;">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                School-wide
            </div>`;

        schoolWide.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            sidebarHtml += `
                <div class="lan-sidebar-item lan-sidebar-item--school" id="lan-sidebar-${flatIdx}"
                    onclick="selectDesktopLearnerAnnouncement(${flatIdx})">
                    <div class="lan-sidebar-item-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#d29522" stroke-width="2" fill="none">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
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

    // Teacher section
    if (hasTeacher) {
        sidebarHtml += `
            <div class="lan-sidebar-section-label lan-section-teacher" style="margin-top:${hasSchoolWide ? '8px' : '0'}">
                <svg viewBox="0 0 24 24" width="10" height="10" stroke="#4fd1c5" stroke-width="2.5" fill="none" style="flex-shrink:0;">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                From Teachers
            </div>`;

        for (const [teacher, items] of Object.entries(teacherData)) {
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

            /* Section labels (School-wide / From Teachers) */
            .lan-sidebar-section-label {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px 4px;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .lan-section-school  { color: #d29522; border-top: 1px solid rgba(210,149,34,0.15); margin-top: 4px; }
            .lan-section-school:first-child { border-top: none; margin-top: 0; }
            .lan-section-teacher { color: #4fd1c5; border-top: 1px solid rgba(79,209,197,0.12); margin-top: 4px; }

            /* Teacher sub-label */
            .lan-sidebar-teacher-label {
                padding: 6px 16px 2px 24px;
                font-size: 10px;
                font-weight: 700;
                color: #555e6a;
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
            /* School-wide active gets orange accent */
            .lan-sidebar-item--school.active {
                background: rgba(210,149,34,0.08);
                border-left-color: #d29522;
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
            .lan-panel-title--school { color: #d29522; }
            .lan-panel-meta { font-size: 13px; color: #8b949e; }

            /* School-wide badge in panel */
            .lan-school-wide-badge {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: rgba(210,149,34,0.1);
                color: #d29522;
                border: 1px solid rgba(210,149,34,0.35);
                font-size: 10px;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 5px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-bottom: 10px;
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
                margin: 0 0 16px;
            }
            .lan-mobile-section-header {
                padding: 12px 16px 6px;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lan-mobile-section-header--school {
                color: #d29522;
                background: rgba(210,149,34,0.06);
                border-bottom: 1px solid rgba(210,149,34,0.12);
            }
            .lan-mobile-section-header--teacher {
                color: #4fd1c5;
                background: rgba(79,209,197,0.04);
                border-top: 1px solid rgba(79,209,197,0.1);
                border-bottom: 1px solid rgba(79,209,197,0.1);
            }
            .lan-mobile-teacher-header {
                padding: 8px 16px 4px 20px;
                font-size: 10px;
                font-weight: 600;
                color: #555e6a;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                background: #1a1919;
            }
            .lan-mobile-card {
                display: flex;
                align-items: flex-start;
                gap: 14px;
                padding: 14px 16px;
                background: #1a1919;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                cursor: pointer;
            }
            .lan-mobile-card--school {
                border-left: 3px solid rgba(210,149,34,0.5);
            }
            .lan-mobile-card:last-child { border-bottom: none; }
            .lan-mobile-card-icon { flex-shrink: 0; margin-top: 2px; opacity: 0.7; }
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
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lan-mobile-card-date { font-size: 11px; color: #555e6a; }
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

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="lan-mobile-list">`;

    let mobileFlatIdx = 0;

    // Mobile — School-wide section
    if (hasSchoolWide) {
        html += `
            <div class="lan-mobile-section-header lan-mobile-section-header--school">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="#d29522" stroke-width="2.5" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                School-wide Announcements
            </div>`;

        schoolWide.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            html += `
                <div class="lan-mobile-card lan-mobile-card--school" role="button" tabindex="0"
                    onclick="openMobileLearnerAnnouncement(${mobileFlatIdx})"
                    onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAnnouncement(${mobileFlatIdx}); }">
                    <div class="lan-mobile-card-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#d29522" stroke-width="2" fill="none">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                    </div>
                    <div class="lan-mobile-card-body">
                        <div class="lan-mobile-card-title">
                            ${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}
                            ${isNew ? '<span class="lan-mobile-new-badge">NEW</span>' : ''}
                        </div>
                        <div class="lan-mobile-card-message">${formatLearnerAnnouncementMessage(ann.message)}</div>
                        <div class="lan-mobile-card-date">${escapeLearnerAnnouncementHtml(ann.sender || 'School Admin')} &bull; ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                    </div>
                </div>`;
            mobileFlatIdx++;
        });
    }

    // Mobile — Teacher section
    if (hasTeacher) {
        html += `
            <div class="lan-mobile-section-header lan-mobile-section-header--teacher">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="#4fd1c5" stroke-width="2.5" fill="none">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                From Teachers
            </div>`;

        for (const [teacher, items] of Object.entries(teacherData)) {
            html += `<div class="lan-mobile-teacher-header">${escapeLearnerAnnouncementHtml(teacher)}</div>`;
            items.forEach(ann => {
                const isNew = new Date(ann.created_at) > sevenDaysAgo;
                html += `
                    <div class="lan-mobile-card" role="button" tabindex="0"
                        onclick="openMobileLearnerAnnouncement(${mobileFlatIdx})"
                        onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMobileLearnerAnnouncement(${mobileFlatIdx}); }">
                        <div class="lan-mobile-card-icon">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <div class="lan-mobile-card-body">
                            <div class="lan-mobile-card-title">
                                ${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}
                                ${isNew ? '<span class="lan-mobile-new-badge">NEW</span>' : ''}
                            </div>
                            <div class="lan-mobile-card-message">${formatLearnerAnnouncementMessage(ann.message)}</div>
                            <div class="lan-mobile-card-date">${escapeLearnerAnnouncementHtml(teacher)} &bull; ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
                        </div>
                    </div>`;
                mobileFlatIdx++;
            });
        }
    }

    html += `</div>`; // close .lan-mobile-list

    apiArea.innerHTML = html;
}

function escapeLearnerAnnouncementHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function formatLearnerAnnouncementMessage(message) {
    return escapeLearnerAnnouncementHtml(message).replace(/\n/g, '<br>');
}

window.openMobileLearnerAnnouncement = function(flatIdx) {
    if (window.innerWidth > 899) return;

    const ann = (window._allLearnerAnnouncementsFlat || [])[flatIdx];
    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const myClassContent = document.getElementById('myClassContent');
    const mainContent = document.querySelector('.main-content');

    if (!ann || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';
    if (myClassContent) myClassContent.classList.remove('active');
    if (mainContent) mainContent.scrollTop = 0;

    sessionStorage.setItem("lastLearnerPage", "announcement_list.php");
    if (window.configureHeader) {
        window.configureHeader({ title: ann.title || 'Announcement', mode: 'detail', detailType: 'Announcement' });
    }

    const isSchool = ann._type === 'school';
    const sender = ann.teacher || ann.sender || (isSchool ? 'School Admin' : 'Teacher');
    const detailIcon = isSchool
        ? `<svg viewBox="0 0 24 24" width="11" height="11" stroke="#d29522" stroke-width="2.5" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="11" height="11" stroke="#4fd1c5" stroke-width="2.5" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
           </svg>`;

    apiArea.innerHTML = `
        <style>
            .lan-mobile-detail {
                background: #1a1919;
                min-height: calc(100vh - 74px);
                padding: 18px 16px 96px;
            }
            .lan-mobile-detail-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 9px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                margin-bottom: 12px;
            }
            .lan-mobile-detail-badge--school {
                color: #d29522;
                border: 1px solid rgba(210,149,34,0.35);
                background: rgba(210,149,34,0.1);
            }
            .lan-mobile-detail-badge--teacher {
                color: #4fd1c5;
                border: 1px solid rgba(79,209,197,0.35);
                background: rgba(79,209,197,0.1);
            }
            .lan-mobile-detail-title {
                margin: 0 0 10px;
                color: #e2e8f0;
                font-size: 28px;
                line-height: 1.28;
                font-weight: 800;
                letter-spacing: 0;
            }
            .lan-mobile-detail-meta {
                color: #8b949e;
                font-size: 12px;
                line-height: 1.5;
                padding-bottom: 18px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                margin-bottom: 18px;
            }
            .lan-mobile-detail-message {
                color: #e2e8f0;
                font-size: 15px;
                line-height: 1.75;
                overflow-wrap: anywhere;
                white-space: normal;
            }
            @media (min-width: 900px) {
                .lan-mobile-detail { display: none; }
            }
        </style>
        <article class="lan-mobile-detail">
            <div class="lan-mobile-detail-badge ${isSchool ? 'lan-mobile-detail-badge--school' : 'lan-mobile-detail-badge--teacher'}">
                ${detailIcon}
                ${isSchool ? 'School-wide' : 'Teacher'}
            </div>
            <h1 class="lan-mobile-detail-title learner-mobile-detail-title">${escapeLearnerAnnouncementHtml(ann.title || 'Announcement')}</h1>
            <div class="lan-mobile-detail-meta">${escapeLearnerAnnouncementHtml(sender)} &bull; ${escapeLearnerAnnouncementHtml(ann.display_date || '')}</div>
            <div class="lan-mobile-detail-message">${formatLearnerAnnouncementMessage(ann.message)}</div>
        </article>`;

    if (mainContent) mainContent.scrollTop = 0;
};

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

    const isSchool = ann._type === 'school';

    panel.innerHTML = `
        <div class="lan-panel-content">
            <div class="lan-panel-header">
                <div>
                    ${isSchool ? `
                        <div class="lan-school-wide-badge">
                            <svg viewBox="0 0 24 24" width="10" height="10" stroke="#d29522" stroke-width="2.5" fill="none">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            School-wide
                        </div>` : ''}
                    <div class="lan-panel-title ${isSchool ? 'lan-panel-title--school' : ''}">
                        <i class="${isSchool ? 'fas fa-school' : 'fas fa-bullhorn'}" style="margin-right:8px;"></i>${ann.title}
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
