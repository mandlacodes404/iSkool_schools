function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
// ── TEACHER SYLLABUS PAGE ────────────────────────────────────────────────────

window.teacherSBOCache = null;

window.fetchTeacherSyllabus = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_syllabus");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_syllabus");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherSBOCache) {
        renderTeacherSyllabus(window.teacherSBOCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_sbo.php');
        const data = await res.json();
        window.teacherSBOCache = data;
        renderTeacherSyllabus(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading syllabus.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

// Track active brief for desktop panel
window._activeSBOBriefIndex = null;

function renderTeacherSyllabus(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const classes = data.classes || [];
    const briefs  = data.briefs  || [];

    // Build class options
    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!briefs.length) {
        sidebarHtml = `<p style="padding:16px;font-size:13px;color:#555e6a;">No syllabus briefs found.</p>`;
    } else {
        // Group by term
        const byTerm = {};
        briefs.forEach((brief, idx) => {
            const t = brief.term || 0;
            if (!byTerm[t]) byTerm[t] = [];
            byTerm[t].push({ brief, idx });
        });

        Object.keys(byTerm).sort((a,b) => a - b).forEach(term => {
            sidebarHtml += `<div class="sbo-sidebar-term-label">TERM ${term}</div>`;
            byTerm[term].forEach(({ brief, idx }) => {
                sidebarHtml += `
                    <div class="sbo-sidebar-item" id="sbo-sidebar-${idx}"
                        onclick="selectDesktopSBO(${idx})">
                        <div class="sbo-sidebar-item-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                        </div>
                        <div class="sbo-sidebar-item-info">
                            <div class="sbo-sidebar-item-title">${brief.subject}</div>
                            <div class="sbo-sidebar-item-meta">${brief.class_name}</div>
                        </div>
                    </div>`;
            });
        });
    }

    let html = `
        <style>
            /* ── Desktop split layout ── */
            @media (min-width: 900px) {
                .sbo-desktop-layout { display: flex !important; }
                .sbo-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .sbo-desktop-layout { display: none !important; }
                .sbo-mobile-list    { display: block !important; }
            }

            .sbo-desktop-layout {
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
            .sbo-sidebar {
                width: 260px;
                min-width: 220px;
                max-width: 280px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .sbo-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .sbo-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .sbo-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .sbo-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .sbo-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .sbo-sidebar-term-label {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #555e6a;
                text-transform: uppercase;
            }
            .sbo-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .sbo-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .sbo-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .sbo-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .sbo-sidebar-item-info { flex: 1; min-width: 0; }
            .sbo-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .sbo-sidebar-item.active .sbo-sidebar-item-title { color: #e2e8f0; }
            .sbo-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }

            /* Right panel */
            .sbo-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .sbo-main-panel::-webkit-scrollbar { width: 5px; }
            .sbo-main-panel::-webkit-scrollbar-track { background: transparent; }
            .sbo-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .sbo-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .sbo-panel-empty svg { opacity: 0.3; }
            .sbo-panel-empty p { font-size: 14px; margin: 0; }

            .sbo-panel-content { padding: 28px 32px; }

            .sbo-panel-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
            }
            .sbo-panel-title {
                font-size: 20px;
                font-weight: 800;
                color: #e2e8f0;
                margin: 0 0 6px;
            }
            .sbo-panel-meta {
                font-size: 13px;
                color: #8b949e;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .sbo-term-badge {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
            }
            .sbo-section-label {
                font-size: 11px;
                font-weight: 800;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 8px;
            }
            .sbo-topics-wrap {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                align-items: center;
                margin-bottom: 20px;
            }
            .sbo-topic-chip {
                background: rgba(79,209,197,0.1);
                color: #4fd1c5;
                padding: 3px 8px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
            }
            .sbo-assess-row {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 10px;
                padding: 14px 18px;
                margin-bottom: 12px;
                font-size: 13px;
                color: #c9d1d9;
            }
            .sbo-notes-block {
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid rgba(255,255,255,0.05);
                font-size: 13px;
                color: #8b949e;
                line-height: 1.6;
            }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="sbo-desktop-layout">
            <!-- Left Sidebar -->
            <div class="sbo-sidebar">
                <div class="sbo-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span>Syllabus</span>
                    <button class="teacher-upload-btn teacher-desktop-create" onclick="openSBOForm()"
                        style="text-transform:none;letter-spacing:normal;font-size:12px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="sbo-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="sbo-main-panel" id="sbo-main-panel">
                <div class="sbo-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <p>Select a syllabus to view details</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="sbo-mobile-list">
            <!-- FILTERS -->
            <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
                <select id="sboFilterClass" onchange="filterSyllabus()"
                        style="background:#21262d;border:1px solid #30363d;color:#e2e8f0;
                               padding:8px 14px;border-radius:8px;font-size:13px;
                               font-family:'Nunito',sans-serif;font-weight:700;cursor:pointer;
                               min-width:160px;">
                    <option value="">All Classes</option>
                    ${classOptions}
                </select>

                <select id="sboFilterTerm" onchange="filterSyllabus()"
                        style="background:#21262d;border:1px solid #30363d;color:#e2e8f0;
                               padding:8px 14px;border-radius:8px;font-size:13px;
                               font-family:'Nunito',sans-serif;font-weight:700;cursor:pointer;
                               min-width:140px;">
                    <option value="">All Terms</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                    <option value="4">Term 4</option>
                </select>
            </div>

            <!-- RESULTS -->
            <div id="sboResultsContainer">
                ${buildSBOCards(briefs)}
            </div>
        </div>`;

    apiArea.innerHTML = html;

    // Store briefs globally for desktop panel and mobile filter
    window._allSBOBriefs = briefs;

    // Also keep dataset on results container for mobile filter
    const rc = document.getElementById('sboResultsContainer');
    if (rc) rc.dataset.briefs = JSON.stringify(briefs);
}

function buildSBOCards(briefs) {
    if (!briefs.length) {
        return `<p class="teacher-empty-state">No syllabus briefs found.</p>`;
    }

    return briefs.map(brief => {
        const topicCount      = brief.topics?.length || 0;
        const assessmentCount = brief.assessments?.length || 0;
        const updatedDate     = brief.updated_at
            ? new Date(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
            : '';

        // Build assessments summary
        const assessSummary = brief.assessments?.length
            ? brief.assessments.map(a => `${a.type} ${a.weight}%`).join(' &middot; ')
            : 'No assessments';

        // Topics preview — first 3
        const topicsPreview = brief.topics?.slice(0, 3).map(t =>
            `<span style="background:rgba(79,209,197,0.1);color:#4fd1c5;
                          padding:3px 8px;border-radius:20px;font-size:11px;
                          font-weight:700;">${t}</span>`
        ).join('') || '';

        const moreTopics = topicCount > 3
            ? `<span style="font-size:11px;color:#8b949e;margin-left:4px;">+${topicCount - 3} more</span>`
            : '';

        return `
            <div class="teacher-resource-card" style="flex-direction:column;align-items:flex-start;gap:12px;padding:18px;">
                
                <!-- TOP ROW -->
                <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="teacher-resource-icon">
                            <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5" stroke-width="2" fill="none">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                <line x1="12" y1="6"  x2="16" y2="6"/>
                                <line x1="12" y1="10" x2="16" y2="10"/>
                                <line x1="12" y1="14" x2="16" y2="14"/>
                            </svg>
                        </div>
                        <div>
                            <div class="teacher-resource-name">${brief.subject}</div>
                            <div class="teacher-resource-meta">
                                ${brief.class_name} &middot; Term ${brief.term}
                                ${updatedDate ? ' &middot; Updated ' + updatedDate : ''}
                            </div>
                        </div>
                    </div>
                    <span style="background:rgba(79,209,197,0.1);color:#4fd1c5;
                                 padding:4px 10px;border-radius:20px;font-size:11px;
                                 font-weight:800;white-space:nowrap;">
                        Term ${brief.term}
                    </span>
                </div>

                <!-- TOPICS -->
                ${topicCount ? `
                <div>
                    <div style="font-size:11px;font-weight:800;color:#8b949e;
                                text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">
                        Topics (${topicCount})
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                        ${topicsPreview}${moreTopics}
                    </div>
                </div>` : ''}

                <!-- ASSESSMENTS -->
                <div style="width:100%;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">
                    <div style="font-size:11px;font-weight:800;color:#8b949e;
                                text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">
                        Assessment Weighting
                    </div>
                    <div style="font-size:13px;color:#c9d1d9;">${assessSummary}</div>
                </div>

                <!-- NOTES -->
                ${brief.notes ? `
                <div style="width:100%;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">
                    <div style="font-size:11px;font-weight:800;color:#8b949e;
                                text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">
                        Notes
                    </div>
                    <div style="font-size:13px;color:#8b949e;line-height:1.5;">${brief.notes}</div>
                </div>` : ''}

            </div>`;
    }).join('');
}

// ── DESKTOP PANEL: SELECT BRIEF ──────────────────────────────────────────────
window.selectDesktopSBO = function(idx) {
    document.querySelectorAll('.sbo-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`sbo-sidebar-${idx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeSBOBriefIndex = idx;

    const brief = (window._allSBOBriefs || [])[idx];
    if (!brief) return;

    const panel = document.getElementById('sbo-main-panel');
    if (!panel) return;

    const topicCount  = brief.topics?.length || 0;
    const updatedDate = brief.updated_at
        ? new Date(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
        : '';

    const topicsHtml = topicCount
        ? brief.topics.map(t => `<span class="sbo-topic-chip">${t}</span>`).join('')
        : '<span style="font-size:13px;color:#555e6a;">No topics listed.</span>';

    const assessHtml = brief.assessments?.length
        ? brief.assessments.map(a => `
            <div class="sbo-assess-row">
                <span style="font-weight:700;color:#e2e8f0;">${a.type}</span>
                <span style="float:right;color:#4fd1c5;font-weight:800;">${a.weight}%</span>
            </div>`).join('')
        : '<p style="font-size:13px;color:#555e6a;margin:0;">No assessments listed.</p>';

    panel.innerHTML = `
        <div class="sbo-panel-content">
            <div class="sbo-panel-header">
                <div>
                    <div class="sbo-panel-title">${brief.subject}</div>
                    <div class="sbo-panel-meta">
                        <span>${brief.class_name}</span>
                        ${updatedDate ? `<span>&bull;</span><span>Updated ${updatedDate}</span>` : ''}
                    </div>
                </div>
                <span class="sbo-term-badge">Term ${brief.term}</span>
            </div>

            <div style="margin-bottom:20px;">
                <div class="sbo-section-label">Topics (${topicCount})</div>
                <div class="sbo-topics-wrap">${topicsHtml}</div>
            </div>

            <div>
                <div class="sbo-section-label">Assessment Weighting</div>
                ${assessHtml}
            </div>

            ${brief.notes ? `
            <div class="sbo-notes-block">
                <div class="sbo-section-label">Notes</div>
                ${brief.notes}
            </div>` : ''}
        </div>`;
};

// ── CLIENT-SIDE FILTER (mobile only) ────────────────────────────────────────
window.filterSyllabus = function() {
    const classFilter = document.getElementById('sboFilterClass').value;
    const termFilter  = document.getElementById('sboFilterTerm').value;
    const container   = document.getElementById('sboResultsContainer');

    let briefs = JSON.parse(container.dataset.briefs || '[]');

    if (classFilter) briefs = briefs.filter(b => b.class_id == classFilter);
    if (termFilter)  briefs = briefs.filter(b => b.term == termFilter);

    container.innerHTML = buildSBOCards(briefs);
};

// ── ROUTER ───────────────────────────────────────────────────────────────────
window.openSBOForm = function() {
    const panel = document.getElementById('sbo-main-panel');
    if (window.innerWidth >= 900 && panel) {
        openSBOPanel(panel);
    } else {
        openSBODrawer();
    }
};

// ── DESKTOP PANEL FORM ───────────────────────────────────────────────────────
async function openSBOPanel(panel) {
    document.querySelectorAll('.sbo-sidebar-item').forEach(el => el.classList.remove('active'));

    panel.innerHTML = `
        <div class="sbo-panel-content">
            <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.07);
                        display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:18px;font-weight:800;color:#e2e8f0;"> Release Syllabus</div>
                <button onclick="fetchTeacherSyllabus()"
                    style="background:none;border:none;color:#8b949e;font-size:22px;
                           cursor:pointer;line-height:1;padding:0;">&times;</button>
            </div>

            <label class="teacher-modal-label">Class</label>
            <div id="sboClassPicker"></div>

            <label class="teacher-modal-label">Term</label>
            <select id="sboTerm" class="teacher-modal-input">
                <option value="">-- Select Term --</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
                <option value="4">Term 4</option>
            </select>

            <label class="teacher-modal-label">Subject Name</label>
            <input type="text" id="sboSubject" class="teacher-modal-input"
                placeholder="e.g. Mathematics">

            <label class="teacher-modal-label">Syllabus Topics</label>
            <div id="sboTopicsList" style="display:flex;flex-direction:column;gap:8px;"></div>
            <button onclick="addSBOTopic()"
                style="margin-top:8px;background:rgba(79,209,197,0.1);border:1px dashed rgba(79,209,197,0.4);
                       color:#4fd1c5;border-radius:8px;padding:8px;width:100%;cursor:pointer;
                       font-size:13px;font-weight:700;">
                + Add Topic
            </button>

            <label class="teacher-modal-label" style="margin-top:16px;">Assessment Weighting</label>
            <div id="sboAssessmentsList" style="display:flex;flex-direction:column;gap:8px;"></div>
            <button onclick="addSBOAssessment()"
                style="margin-top:8px;background:rgba(167,139,250,0.1);border:1px dashed rgba(167,139,250,0.4);
                       color:#a78bfa;border-radius:8px;padding:8px;width:100%;cursor:pointer;
                       font-size:13px;font-weight:700;">
                + Add Assessment
            </button>
            <div id="sboWeightTotal"
                style="margin-top:8px;font-size:12px;font-weight:700;color:#8b949e;text-align:right;">
                Total: 0%
            </div>

            <label class="teacher-modal-label" style="margin-top:16px;">
                Additional Notes <span style="color:#8b949e;font-weight:400;">(optional)</span>
            </label>
            <textarea id="sboNotes" class="teacher-modal-input"
                placeholder="e.g. No exam this term — focus on continuous assessment"
                style="height:70px;resize:vertical;"></textarea>

            <div id="sboError" style="color:#ff5555;font-size:13px;display:none;margin-top:8px;"></div>

            <div style="display:flex;gap:10px;margin-top:16px;">
                <button onclick="fetchTeacherSyllabus()"
                    class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                <button onclick="saveSBO()"
                    class="teacher-modal-submit" style="flex:1;">Post & Notify</button>
            </div>
        </div>`;

    // Load classes
    const hideInitialLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(panel, 'Loading...')
        : null;
    try {
        const res     = await fetch('api/teacher/get_classes.php');
        const classes = await res.json();
        window.renderClassPicker('sboClassPicker', classes, function() {});
    } catch(e) {
        console.error('Failed to load classes for SBO panel', e);
    } finally {
        if (hideInitialLoader) hideInitialLoader();
    }

    addSBOTopic();
    addSBOAssessment();
}

// ── SBO DRAWER (mobile only) ─────────────────────────────────────────────────

window.openSBODrawer = async function() {
    const existing = document.getElementById('sboDrawer');
    if (existing) existing.remove();

    const drawer = document.createElement('div');
    drawer.id = 'sboDrawer';
    drawer.innerHTML = `
        <div id="sboBackdrop" onclick="closeSBODrawer()"
             style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9997;"></div>

        <div style="position:fixed;top:0;right:0;height:100%;width:420px;max-width:95vw;
                    background:#1a1919;border-left:1px solid rgba(255,255,255,0.07);
                    z-index:9998;overflow-y:auto;padding:28px 24px;box-sizing:border-box;
                    display:flex;flex-direction:column;gap:16px;">

            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:900;font-size:16px;color:#e2e8f0;">Release Syllabus</span>
                <button onclick="closeSBODrawer()"
                        style="background:none;border:none;color:#8b949e;font-size:22px;cursor:pointer;">&times;</button>
            </div>

            <!-- Class -->
            <div>
                <label class="teacher-modal-label">Class</label>
                <div id="sboClassPicker"></div>
            </div>

            <!-- Term -->
            <div>
                <label class="teacher-modal-label">Term</label>
                <select id="sboTerm" class="teacher-modal-input">
                    <option value="">-- Select Term --</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                    <option value="4">Term 4</option>
                </select>
            </div>

            <!-- Subject -->
            <div>
                <label class="teacher-modal-label">Subject Name</label>
                <input type="text" id="sboSubject" class="teacher-modal-input" placeholder="e.g. Mathematics">
            </div>

            <!-- Topics -->
            <div>
                <label class="teacher-modal-label">Syllabus Topics</label>
                <div id="sboTopicsList" style="display:flex;flex-direction:column;gap:8px;"></div>
                <button onclick="addSBOTopic()"
                        style="margin-top:8px;background:rgba(79,209,197,0.1);border:1px dashed rgba(79,209,197,0.4);
                               color:#4fd1c5;border-radius:8px;padding:8px;width:100%;cursor:pointer;
                               font-size:13px;font-weight:700;">
                    + Add Topic
                </button>
            </div>

            <!-- Assessments -->
            <div>
                <label class="teacher-modal-label">Assessment Weighting</label>
                <div id="sboAssessmentsList" style="display:flex;flex-direction:column;gap:8px;"></div>
                <button onclick="addSBOAssessment()"
                        style="margin-top:8px;background:rgba(167,139,250,0.1);border:1px dashed rgba(167,139,250,0.4);
                               color:#a78bfa;border-radius:8px;padding:8px;width:100%;cursor:pointer;
                               font-size:13px;font-weight:700;">
                    + Add Assessment
                </button>
                <div id="sboWeightTotal"
                     style="margin-top:8px;font-size:12px;font-weight:700;color:#8b949e;text-align:right;">
                    Total: 0%
                </div>
            </div>

            <!-- Notes -->
            <div>
                <label class="teacher-modal-label">Additional Notes <span style="color:#8b949e;font-weight:400;">(optional)</span></label>
                <textarea id="sboNotes" class="teacher-modal-input"
                          placeholder="e.g. No exam this term — focus on continuous assessment"
                          style="height:80px;resize:vertical;"></textarea>
            </div>

            <!-- Error -->
            <div id="sboError" style="color:#ff5555;font-size:13px;display:none;"></div>

            <!-- Actions -->
            <div style="display:flex;gap:10px;margin-top:4px;">
                <button onclick="closeSBODrawer()" class="teacher-modal-cancel" style="flex:1;">Cancel</button>
                <button onclick="saveSBO()" class="teacher-modal-submit" style="flex:1;">Post & Notify</button>
            </div>
        </div>`;

    document.body.appendChild(drawer);

    // Load classes
    try {
        const res     = await fetch('api/teacher/get_classes.php');
        const classes = await res.json();
        window.renderClassPicker('sboClassPicker', classes, function() {});
    } catch(e) {
        console.error('Failed to load classes for SBO drawer', e);
    }

    addSBOTopic();
    addSBOAssessment();
};

window.closeSBODrawer = function() {
    const drawer = document.getElementById('sboDrawer');
    if (drawer) drawer.remove();
};

window.addSBOTopic = function() {
    const list = document.getElementById('sboTopicsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'sbo-topic-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    row.innerHTML = `
        <input type="text" placeholder="e.g. Linear Equations"
               class="teacher-modal-input sbo-topic-input"
               style="flex:1;margin:0;">
        <button onclick="this.closest('.sbo-topic-row').remove()"
                style="background:none;border:none;color:#ff5555;font-size:18px;cursor:pointer;
                       padding:0 4px;flex-shrink:0;">&times;</button>`;
    list.appendChild(row);
};

window.addSBOAssessment = function() {
    const list = document.getElementById('sboAssessmentsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'sbo-assessment-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    row.innerHTML = `
        <input type="text" placeholder="e.g. Tests"
               class="teacher-modal-input sbo-assess-type"
               style="flex:1;margin:0;">
        <div style="position:relative;flex-shrink:0;width:72px;">
            <input type="number" placeholder="30" min="1" max="100"
                   class="teacher-modal-input sbo-assess-weight"
                   oninput="updateSBOWeightTotal()"
                   style="width:100%;margin:0;padding-right:20px;box-sizing:border-box;">
            <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                         color:#8b949e;font-size:12px;pointer-events:none;">%</span>
        </div>
        <button onclick="this.closest('.sbo-assessment-row').remove(); updateSBOWeightTotal();"
                style="background:none;border:none;color:#ff5555;font-size:18px;cursor:pointer;
                       padding:0 4px;flex-shrink:0;">&times;</button>`;
    list.appendChild(row);
    updateSBOWeightTotal();
};

window.updateSBOWeightTotal = function() {
    const inputs = document.querySelectorAll('.sbo-assess-weight');
    let total = 0;
    inputs.forEach(i => { total += parseInt(i.value) || 0; });
    const el = document.getElementById('sboWeightTotal');
    if (!el) return;
    el.textContent = `Total: ${total}%`;
    el.style.color = total === 100 ? '#4fd1c5' : total > 100 ? '#ff5555' : '#8b949e';
};

window.saveSBO = async function() {
    const err = document.getElementById('sboError');
    err.style.display = 'none';

    const class_id = parseInt(window.getClassPickerValue('sboClassPicker'));
    const term     = parseInt(document.getElementById('sboTerm').value);
    const subject  = document.getElementById('sboSubject').value.trim();
    const notes    = document.getElementById('sboNotes').value.trim();

    const topics = [];
    document.querySelectorAll('.sbo-topic-input').forEach(i => {
        const v = i.value.trim();
        if (v) topics.push(v);
    });

    const assessments = [];
    document.querySelectorAll('.sbo-assessment-row').forEach(row => {
        const type   = row.querySelector('.sbo-assess-type').value.trim();
        const weight = parseInt(row.querySelector('.sbo-assess-weight').value) || 0;
        if (type && weight > 0) assessments.push({ type, weight });
    });

    if (!class_id) { err.textContent = 'Please select a class.'; err.style.display = 'block'; return; }
    if (!term)     { err.textContent = 'Please select a term.';  err.style.display = 'block'; return; }
    if (!subject)  { err.textContent = 'Please enter a subject name.'; err.style.display = 'block'; return; }

    // Find submit btn in either panel or drawer
    const btn = document.querySelector('#sbo-main-panel .teacher-modal-submit')
             || document.querySelector('#sboDrawer .teacher-modal-submit');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
    const panel = document.getElementById('sbo-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel && document.querySelector('#sbo-main-panel .teacher-modal-submit');
    const hideSubmitLoader = window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(isDesktop ? panel : null, 'Saving...')
        : null;

    try {
        const res  = await fetch('api/teacher/save_sbo.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' , 'X-CSRF-Token': getCsrfToken() },
            body:    JSON.stringify({ class_id, term, subject, topics, assessments, notes })
        });
        const data = await res.json();

        if (data.success) {
            // Close drawer if open (mobile), panel handles via fetchTeacherSyllabus
            closeSBODrawer();
            window.teacherSBOCache = null;
            fetchTeacherSyllabus();
            if (typeof window.showToast === 'function') {
                window.showToast(`Syllabus posted — ${data.notified} learner${data.notified !== 1 ? 's' : ''} notified`);
            }
        } else {
            err.textContent   = data.error || 'Failed to save.';
            err.style.display = 'block';
            if (btn) { btn.textContent = 'Post & Notify'; btn.disabled = false; }
            if (hideSubmitLoader) hideSubmitLoader();
        }
    } catch(e) {
        err.textContent   = 'Connection error. Please try again.';
        err.style.display = 'block';
        if (btn) { btn.textContent = 'Post & Notify'; btn.disabled = false; }
        if (hideSubmitLoader) hideSubmitLoader();
    }
};