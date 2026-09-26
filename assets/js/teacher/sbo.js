function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
// ── TEACHER SYLLABUS PAGE ────────────────────────────────────────────────────

window.teacherSBOCache = null;
window.teacherSBOCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherSyllabus = function () {
    if (window.teacherSBOCache) return;
    if (window.teacherSBOCachePromise) return;
    window.teacherSBOCachePromise = fetch('api/teacher/get_sbo.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherSBOCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherSBOCachePromise = null; });
};

window.fetchTeacherSyllabus = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_syllabus");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_syllabus");

    // Restore standard chrome any time this list is (re)loaded — also the
    // mobile "back" target dispatched from handleTeacherHeaderBack when
    // detailType === 'SBO'. Applied up front (see Assignments back-button
    // fix in PROJECT_NOTES.md for why this matters).
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ title: 'Syllabus', mode: 'standard', color: '#a67c52' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherSBOCache) {
        renderTeacherSyllabus(window.teacherSBOCache);
        return;
    }

    try {
        if (!window.teacherSBOCachePromise) {
            window.teacherSBOCachePromise = fetch('api/teacher/get_sbo.php')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch');
                    return res.json();
                })
                .then(data => {
                    window.teacherSBOCache = data;
                    return data;
                })
                .finally(() => { window.teacherSBOCachePromise = null; });
        }
        const data = await window.teacherSBOCachePromise;
        renderTeacherSyllabus(data);
    } catch (e) {
        if (apiArea) apiArea.innerHTML = `
            <p class="sbo-error-message">
                Error loading syllabus.
            </p>`;
    }
};

// Track active brief for desktop panel
window._activeSBOBriefIndex = null;

function formatSBOUpdatedDateTime(updatedAt) {
    if (!updatedAt) return '';

    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return '';

    const formattedDate = date.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `${formattedDate} · ${formattedTime}`;
}

function renderTeacherSyllabus(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const briefs  = data.briefs  || [];

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!briefs.length) {
        sidebarHtml = `<p class="sbo-empty-state-inline">No syllabus briefs found.</p>`;
    } else {
        // Group by term, then by class within each term
        const byTerm = {};
        briefs.forEach((brief, idx) => {
            const t = brief.term || 0;
            if (!byTerm[t]) byTerm[t] = {};
            const classKey = brief.class_id;
            if (!byTerm[t][classKey]) byTerm[t][classKey] = { class_name: brief.class_name, items: [] };
            byTerm[t][classKey].items.push({ brief, idx });
        });

        Object.keys(byTerm).sort((a,b) => a - b).forEach(term => {
            sidebarHtml += `<div class="sbo-sidebar-term-label">TERM ${term}</div>`;

            const classesInTerm = Object.values(byTerm[term])
                .sort((a, b) => a.class_name.localeCompare(b.class_name));

            classesInTerm.forEach((clsGroup, clsIdx) => {
                const classGroupId = `sbo-class-group-${term}-${clsIdx}`;
                let itemsHtml = '';
                clsGroup.items.forEach(({ brief, idx }) => {
                    const updatedAt = formatSBOUpdatedDateTime(brief.updated_at);
                    itemsHtml += `
                        <div class="sbo-sidebar-item" id="sbo-sidebar-${idx}"
                            data-title="${brief.subject}"
                            onclick="selectDesktopSBO(${idx})">
                            <div class="sbo-sidebar-item-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                </svg>
                            </div>
                            <div class="sbo-sidebar-item-info">
                                <div class="sbo-sidebar-item-title">${brief.subject}</div>
                                <div class="sbo-sidebar-item-meta">${updatedAt}</div>
                            </div>
                        </div>`;
                });
                sidebarHtml += window.buildCollapsibleClassGroup(
                    classGroupId,
                    'sbo-sidebar-class-label',
                    clsGroup.class_name,
                    itemsHtml
                );
            });
        });
    }

    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="sbo-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="sbo-sidebar tchr-flat-sidebar">
                <div class="sbo-sidebar-header">
                    <span>Syllabus</span>
                    <button class="teacher-upload-btn teacher-desktop-create sbo-new-btn" id="sbo-new-btn" onclick="openSBOForm()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                ${typeof buildTeacherSearchBar === 'function' ? buildTeacherSearchBar('sbo') : ''}
                <div class="sbo-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="sbo-main-panel tchr-flat-panel" id="sbo-main-panel">
                <div class="sbo-panel-empty">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <p>Select a syllabus to view details</p>
                </div>
            </div>

            <!-- railId lets selectDesktopSBO() swap this to
                 selection-specific copy via updateInfoRail(). -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Syllabus', `
                <p>Each syllabus brief is tied to one class and term — release a new one per class if you teach the same subject across grades.</p>
                <p>Learners see topics, assessments, and notes exactly as written here, so keep entries current as the term progresses.</p>
            `, 'sbo-rail') : ''}
        </div>

        <div id="deleteSBOModal" class="teacher-modal-overlay sbo-modal-hidden">
            <div class="teacher-modal-box sbo-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Syllabus Brief</span>
                    <button onclick="closeDeleteSBOModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="sbo-delete-modal-text">Are you sure you want to delete this syllabus brief? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteSBOModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteSBO()" class="teacher-modal-submit sbo-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST — grouped by class only (2026-09-12: replaced
             the class/term filter dropdowns + flat card list with
             class-grouped folders, matching Assignments/Announcements/
             Quizzes/Evaluations). Desktop sidebar/panel above is
             untouched — still term-then-class grouped, per instruction
             that this change is mobile-view only. ═══ -->
        <div class="sbo-mobile-list">
            ${typeof buildTeacherSearchBar === 'function' ? buildTeacherSearchBar('sbo', { mobile: true, placeholder: 'Search syllabus...' }) : ''}
            ${buildMobileSBOFolders(briefs)}
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    if (typeof wireTeacherSearchBar === 'function') wireTeacherSearchBar('sbo');

    // Store briefs globally — shared by the desktop panel (selectDesktopSBO)
    // and the mobile detail page (openMobileTeacherSBO), both index into
    // this same flat, ungrouped array.
    window._allSBOBriefs = briefs;

    const sidebarScrollEl = apiArea.querySelector('.sbo-sidebar-scroll');
    window.wireTeacherSectionScroll('sbo-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('sbo-sidebar', sidebarScrollEl);

    // Restore whichever syllabus brief was selected before navigating
    // away. Re-derive its current idx from the saved stable class_id
    // rather than storing the index itself, since order can shift.
    const savedClassId = window.teacherSectionState.selection.sbo;
    if (savedClassId != null) {
        const idx = window._allSBOBriefs.findIndex(b => b.class_id == savedClassId);
        if (idx !== -1) selectDesktopSBO(idx);
    }
}

function buildMobileSBOFolders(briefs) {
    if (!briefs.length) {
        return `<p class="teacher-empty-state">No syllabus briefs found.</p>`;
    }

    // Group by class only (2026-09-12) — replaces the old flat card list
    // with class/term filter dropdowns. Desktop's own term-then-class
    // sidebar grouping (built separately above, in renderTeacherSyllabus)
    // is untouched — mobile-only change, per instruction.
    const byClass = new Map();
    briefs.forEach(brief => {
        if (!byClass.has(brief.class_id)) byClass.set(brief.class_id, { class_name: brief.class_name, items: [] });
        byClass.get(brief.class_id).items.push(brief);
    });

    let html = '';
    let groupIdx = 0;
    byClass.forEach(group => {
        const mobileGroupId = `sbo-mobile-class-group-${groupIdx}`;
        groupIdx++;

        let itemsHtml = '';
        group.items.forEach(brief => {
            const flatIndex = briefs.findIndex(b => b.id === brief.id);
            const updatedDate = brief.updated_at
                ? new Date(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
                : '';

            itemsHtml += `
                <div class="sbo-mobile-row" role="button" tabindex="0"
                    data-title="${brief.subject}"
                    onclick="openMobileTeacherSBO(${flatIndex})"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherSBO(${flatIndex});}">
                    <div class="sbo-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#a67c52" stroke-width="1.2" fill="none">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            <line x1="12" y1="6"  x2="16" y2="6"/>
                            <line x1="12" y1="10" x2="16" y2="10"/>
                            <line x1="12" y1="14" x2="16" y2="14"/>
                        </svg>
                    </div>
                    <div class="sbo-mobile-row-body">
                        <div class="sbo-mobile-row-title">${brief.subject}</div>
                        <div class="sbo-mobile-row-meta">
                            Term ${brief.term}
                            ${updatedDate ? ' &middot; Updated ' + updatedDate : ''}
                        </div>
                    </div>
                    <div class="sbo-mobile-row-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>`;
        });

        const folderIcon = `
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#a67c52" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="sbo-mobile-folder-icon">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>`;

        html += window.buildCollapsibleClassGroup(
            mobileGroupId,
            'sbo-mobile-folder-label',
            `${folderIcon}<span class="sbo-mobile-folder-name">${group.class_name}</span><span class="sbo-mobile-folder-count">${group.items.length}</span>`,
            itemsHtml
        );
    });

    return html;
}

// ── DESKTOP PANEL: SELECT BRIEF ──────────────────────────────────────────────
window.selectDesktopSBO = function(idx) {
    document.querySelectorAll('.sbo-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('sbo-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`sbo-sidebar-${idx}`);
    if (sidebarItem) sidebarItem.classList.add('active');


    window._activeSBOBriefIndex = idx;

    const brief = (window._allSBOBriefs || [])[idx];
    if (!brief) return;

    window.teacherSectionState.selection.sbo = brief.class_id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('sbo-main-panel');
    if (!panel) return;

    const topicCount  = brief.topics?.length || 0;
    const updatedDate = brief.updated_at
        ? new Date(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
        : '';

    const topicsHtml = topicCount
        ? brief.topics.map(t => `<span class="sbo-topic-chip">${t}</span>`).join('')
        : '<span class="sbo-topics-empty-text">No topics listed.</span>';

    const assessHtml = brief.assessments?.length
        ? brief.assessments.map(a => `
            <div class="sbo-assess-row">
                <span class="sbo-assess-row-type">${a.type}</span>
                <span class="sbo-assess-row-weight">${a.weight}%</span>
            </div>`).join('')
        : '<p class="sbo-assess-empty-text">No assessments listed.</p>';

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
                <div class="sbo-panel-actions">
                    <span class="sbo-term-badge">Term ${brief.term}</span>
                    <button class="sbo-panel-delete-btn" onclick="confirmDeleteSBO(${brief.id})">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>

            <div class="sbo-topics-section">
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

    // Swap the info rail to reflect this brief's completeness, instead
    // of leaving it on the generic page-level copy.
    if (typeof updateInfoRail === 'function') {
        const assessCount = brief.assessments?.length || 0;
        if (topicCount === 0 && assessCount === 0) {
            updateInfoRail('sbo-rail', 'Brief Needs Detail', `
                <p>This syllabus brief for <strong>${brief.class_name}</strong> has no topics or assessment weighting listed yet.</p>
                <p>Learners see this brief exactly as written, so it's worth filling in before sharing it widely.</p>
            `);
        } else {
            updateInfoRail('sbo-rail', 'About This Brief', `
                <p><strong>${brief.class_name}</strong>, Term ${brief.term} &mdash; ${topicCount} topic${topicCount !== 1 ? 's' : ''} and ${assessCount} assessment${assessCount !== 1 ? 's' : ''} listed.</p>
                <p>Learners see this exactly as written, so keep it current as the term progresses.</p>
            `);
        }
    }
};

// ─────────────────────────────────────────────
// MOBILE DETAIL VIEW: tap -> detail page
// Body-building logic mirrors selectDesktopSBO's exactly (topics,
// assessments, notes, Delete) — same underlying data, rendered into a
// page instead of the desktop panel.
// ─────────────────────────────────────────────
window.openMobileTeacherSBO = function(flatIndex) {
    if (window.innerWidth > 899) return;

    const brief = (window._allSBOBriefs || [])[flatIndex];
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (!brief || !apiArea) return;

    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';

    sessionStorage.setItem('lastTeacherPage', 'teacher_syllabus');
    window.teacherSectionState.selection.sbo = brief.class_id;
    window.persistTeacherSectionState();

    window.configureTeacherHeader({
        title: 'Syllabus',
        mode: 'detail',
        detailType: 'SBO',
        backLabel: 'Syllabus',
        color: '#a67c52'
    });

    const topicCount  = brief.topics?.length || 0;
    const updatedDate = brief.updated_at
        ? new Date(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
        : '';

    const topicsHtml = topicCount
        ? brief.topics.map(t => `<span class="sbo-topic-chip">${t}</span>`).join('')
        : '<span class="sbo-topics-empty-text">No topics listed.</span>';

    const assessHtml = brief.assessments?.length
        ? brief.assessments.map(a => `
            <div class="sbo-assess-row">
                <span class="sbo-assess-row-type">${a.type}</span>
                <span class="sbo-assess-row-weight">${a.weight}%</span>
            </div>`).join('')
        : '<p class="sbo-assess-empty-text">No assessments listed.</p>';

    apiArea.innerHTML = `
        <article class="sbo-mobile-detail">
            <div class="sbo-panel-header">
                <div>
                    <div class="sbo-panel-title">${brief.subject}</div>
                    <div class="sbo-panel-meta">
                        <span>${brief.class_name}</span>
                        ${updatedDate ? `<span>&bull;</span><span>Updated ${updatedDate}</span>` : ''}
                    </div>
                </div>
                <div class="sbo-panel-actions">
                    <span class="sbo-term-badge">Term ${brief.term}</span>
                    <button class="sbo-panel-delete-btn" onclick="confirmDeleteSBO(${brief.id})">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6"></path>
                            <path d="M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>

            <div class="sbo-topics-section">
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
        </article>`;

    apiArea.scrollTop = 0;
};

window.openMobileTeacherSBOById = function(briefId) {
    const idx = (window._allSBOBriefs || []).findIndex(b => String(b.id) === String(briefId));
    if (idx >= 0) window.openMobileTeacherSBO(idx);
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
    const newBtn = document.getElementById('sbo-new-btn');
    if (newBtn) newBtn.classList.add('active');

    panel.innerHTML = `
        <div class="sbo-panel-content">
            <div class="sbo-form-header sbo-form-header--panel">
                <div class="sbo-form-title"> Release Syllabus</div>
                <button onclick="fetchTeacherSyllabus()" class="sbo-form-close-btn">&times;</button>
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
            <div id="sboTopicsList" class="sbo-list-stack"></div>
            <button onclick="addSBOTopic()" class="sbo-add-topic-btn">
                + Add Topic
            </button>

            <label class="teacher-modal-label sbo-form-label-spaced">Assessment Weighting</label>
            <div id="sboAssessmentsList" class="sbo-list-stack"></div>
            <button onclick="addSBOAssessment()" class="sbo-add-assessment-btn">
                + Add Assessment
            </button>
            <div id="sboWeightTotal" class="sbo-weight-total">
                Total: 0%
            </div>

            <label class="teacher-modal-label sbo-form-label-spaced">
                Additional Notes <span class="sbo-form-label-hint">(optional)</span>
            </label>
            <textarea id="sboNotes" class="teacher-modal-input sbo-notes-textarea sbo-notes-textarea--drawer"
                placeholder="e.g. No exam this term — focus on continuous assessment"></textarea>

            <div id="sboError" class="sbo-form-error sbo-form-error--spaced"></div>

            <div class="sbo-form-actions sbo-form-actions--spaced">
                <button onclick="fetchTeacherSyllabus()"
                    class="teacher-modal-cancel">Cancel</button>
                <button onclick="saveSBO()"
                    class="teacher-modal-submit">Post & Notify</button>
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
        <div id="sboBackdrop" onclick="closeSBODrawer()" class="sbo-drawer-backdrop"></div>

        <div class="sbo-drawer-panel">

            <!-- Header -->
            <div class="sbo-form-header">
                <span class="sbo-form-title sbo-form-title--drawer">Release Syllabus</span>
                <button onclick="closeSBODrawer()" class="sbo-form-close-btn">&times;</button>
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
                <div id="sboTopicsList" class="sbo-list-stack"></div>
                <button onclick="addSBOTopic()" class="sbo-add-topic-btn">
                    + Add Topic
                </button>
            </div>

            <!-- Assessments -->
            <div>
                <label class="teacher-modal-label">Assessment Weighting</label>
                <div id="sboAssessmentsList" class="sbo-list-stack"></div>
                <button onclick="addSBOAssessment()" class="sbo-add-assessment-btn">
                    + Add Assessment
                </button>
                <div id="sboWeightTotal" class="sbo-weight-total">
                    Total: 0%
                </div>
            </div>

            <!-- Notes -->
            <div>
                <label class="teacher-modal-label">Additional Notes <span class="sbo-form-label-hint">(optional)</span></label>
                <textarea id="sboNotes" class="teacher-modal-input sbo-notes-textarea"
                          placeholder="e.g. No exam this term — focus on continuous assessment"></textarea>
            </div>

            <!-- Error -->
            <div id="sboError" class="sbo-form-error"></div>

            <!-- Actions -->
            <div class="sbo-form-actions">
                <button onclick="closeSBODrawer()" class="teacher-modal-cancel">Cancel</button>
                <button onclick="saveSBO()" class="teacher-modal-submit">Post & Notify</button>
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
    row.className = 'sbo-topic-row sbo-dynamic-row';
    row.innerHTML = `
        <input type="text" placeholder="e.g. Linear Equations"
               class="teacher-modal-input sbo-topic-input sbo-dynamic-row-input">
        <button onclick="this.closest('.sbo-topic-row').remove()"
                class="sbo-row-remove-btn">&times;</button>`;
    list.appendChild(row);
};

window.addSBOAssessment = function() {
    const list = document.getElementById('sboAssessmentsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'sbo-assessment-row sbo-dynamic-row';
    row.innerHTML = `
        <input type="text" placeholder="e.g. Tests"
               class="teacher-modal-input sbo-assess-type sbo-dynamic-row-input">
        <div class="sbo-weight-input-wrap">
            <input type="number" placeholder="30" min="1" max="100"
                   class="teacher-modal-input sbo-assess-weight sbo-weight-input"
                   oninput="updateSBOWeightTotal()">
            <span class="sbo-weight-input-suffix">%</span>
        </div>
        <button onclick="this.closest('.sbo-assessment-row').remove(); updateSBOWeightTotal();"
                class="sbo-row-remove-btn">&times;</button>`;
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
    el.classList.remove('is-complete', 'is-over');
    if (total === 100) el.classList.add('is-complete');
    else if (total > 100) el.classList.add('is-over');
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
    const hideSubmitLoader = window.showTeacherButtonLoader(btn);

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
        }
    } catch(e) {
        err.textContent   = 'Connection error. Please try again.';
        err.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

// ─────────────────────────────────────────────
// DELETE SYLLABUS BRIEF (desktop)
// ─────────────────────────────────────────────
let sboToDelete = null;

window.confirmDeleteSBO = function(id) {
    sboToDelete = id;
    const modal = document.getElementById('deleteSBOModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteSBOModal = function() {
    sboToDelete = null;
    const modal = document.getElementById('deleteSBOModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteSBO = async function() {
    if (!sboToDelete) return;
    const idToDelete = sboToDelete;
    const deleteButton = document.querySelector('#deleteSBOModal .sbo-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteSBOModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_sbo.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherSBOCache = null;
            fetchTeacherSyllabus();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};