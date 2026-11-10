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

/** MySQL-style "2026-09-12 14:30:00" is not a valid date string in Safari
 * (all iPhones); swapping the space for a "T" makes it valid everywhere. */
function parseSBODate(raw) {
    if (!raw) return new Date(NaN);
    return new Date(String(raw).trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2'));
}

function formatSBOUpdatedDateTime(updatedAt, dateOnly) {
    if (!updatedAt) return '';

    const date = parseSBODate(updatedAt);
    if (Number.isNaN(date.getTime())) return '';

    const formattedDate = date.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    if (dateOnly) return formattedDate;

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
        // One folder per class (the term no longer groups the list)
        const byClass = {};
        briefs.forEach((brief, idx) => {
            const classKey = brief.class_id;
            if (!byClass[classKey]) byClass[classKey] = { class_name: brief.class_name, items: [] };
            byClass[classKey].items.push({ brief, idx });
        });

        Object.values(byClass)
            .sort((a, b) => a.class_name.localeCompare(b.class_name))
            .forEach((clsGroup, clsIdx) => {
                const classGroupId = `sbo-class-group-${clsIdx}`;
                let itemsHtml = '';
                clsGroup.items.forEach(({ brief, idx }) => {
                    const updatedAt = formatSBOUpdatedDateTime(brief.updated_at, true);
                    itemsHtml += `
                        <div class="sbo-sidebar-item" id="sbo-sidebar-${idx}"
                            data-title="${brief.subject}"
                            onclick="selectDesktopSBO(${idx})">
                            <span class="sbo-sidebar-dot" aria-hidden="true"></span>
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
    }

    // ── Empty-state copy for the desktop main panel ──
    const briefCount = briefs.length;
    const classCount = new Set(briefs.map(b => b.class_id)).size;
    const thinCount  = briefs.filter(b => !(b.topics || []).length && !(b.assessments || []).length).length;
    const emptyTitle = briefCount ? 'Pick a syllabus brief' : 'No syllabus briefs yet';
    const emptyBody  = briefCount
        ? `${briefCount} ${briefCount === 1 ? 'brief' : 'briefs'} across ${classCount} ${classCount === 1 ? 'class' : 'classes'}. ` +
          (thinCount
              ? `${thinCount} ${thinCount === 1 ? 'has' : 'have'} no topics or assessments yet.`
              : 'Each one has topics and assessments.')
        : 'Release one to a class and it will show up here, grouped by class.';
    const emptyCta   = briefCount ? 'Release a syllabus' : 'Release your first syllabus';

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
                    <h2 class="sbo-panel-empty-title">${emptyTitle}</h2>
                    <p class="sbo-panel-empty-body">${emptyBody}</p>
                    <button type="button" class="sbo-dp-btn sbo-dp-btn--primary" onclick="openSBOForm()">
                        ${sboDpIcon('plus', 14)}${emptyCta}
                    </button>
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
    // away. Re-derive its current idx from the saved brief id rather than
    // storing the index itself, since order can shift. (class_id alone is not
    // enough: a class can have several briefs, one per subject and term, and
    // it would always reopen the first.) Saved state from before this change
    // only has class_id, so that remains the fallback when no brief id is saved.
    const savedSel = window.teacherSectionState.selection;
    let savedIdx = -1;
    if (savedSel.sboBriefId != null) {
        savedIdx = window._allSBOBriefs.findIndex(b => String(b.id) === String(savedSel.sboBriefId));
    } else if (savedSel.sbo != null) {
        savedIdx = window._allSBOBriefs.findIndex(b => b.class_id == savedSel.sbo);
    }
    if (savedIdx !== -1) selectDesktopSBO(savedIdx);
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
                ? parseSBODate(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
                : '';

            itemsHtml += `
                <div class="sbo-mobile-row" role="button" tabindex="0"
                    data-title="${brief.subject}"
                    onclick="openMobileTeacherSBO(${flatIndex})"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherSBO(${flatIndex});}">
                    <div class="sbo-mobile-row-icon">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#73746d" stroke-width="1.2" fill="none">
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
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#73746d" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="sbo-mobile-folder-icon">
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

// ── DESKTOP PANEL HELPERS ────────────────────────────────────────────────────
// (desktop only: the mobile detail page and mobile drawer keep their own markup)

function escapeSBOHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sboDpIcon(name, size) {
    const paths = { plus: '<path d="M12 5v14M5 12h14"/>' };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function sboDpPlural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** One colour per assessment, by position: the bar segment, the swatch in the
 * list and the hover link all use the same one. Eight is more than a syllabus
 * needs; past that the colours simply repeat. */
const SBO_ASSESS_COLORS = ['#4fd1c5', '#a78bfa', '#f3a93c', '#60a5fa', '#f4776f', '#86d36b', '#e879a9', '#94a3b8'];
function sboAssessColor(i) {
    return SBO_ASSESS_COLORS[i % SBO_ASSESS_COLORS.length];
}

function formatSBOUpdatedDate(updatedAt) {
    const d = parseSBODate(updatedAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Assessment weighting: one proportional bar (a colour per assessment) + a row each. */
function buildSBOAssessmentBlock(assessments) {
    const esc = escapeSBOHtml;
    if (!assessments.length) {
        return `<div class="sbo-dp-rows"><div class="sbo-dp-none">No assessments listed.</div></div>`;
    }
    const weights = assessments.map(a => Number(a.weight) || 0);
    const total = weights.reduce((n, w) => n + w, 0);

    const segs = assessments.map((a, k) => `
        <i data-k="${k}" style="--g:${weights[k]};--c:${sboAssessColor(k)};"
           title="${esc(a.type)}: ${weights[k]}%"></i>`).join('')
        + (total < 100 ? `<i class="is-rest" style="--g:${100 - total};" title="Not accounted for: ${100 - total}%"></i>` : '');

    const rows = assessments.map((a, k) => `
        <div class="sbo-dp-ar" data-k="${k}" style="--c:${sboAssessColor(k)};">
            <span class="sbo-dp-sq"></span>
            <span class="sbo-dp-ar-t">${esc(a.type)}</span>
            <b>${weights[k]}%</b>
        </div>`).join('');

    const aria = assessments.map((a, k) => `${a.type} ${weights[k]}%`).join(', ');
    const warn = total < 100 ? `<p class="sbo-dp-warn">These add up to ${total}%, so ${100 - total}% isn't accounted for.</p>`
               : total > 100 ? `<p class="sbo-dp-warn">These add up to ${total}%, which is ${total - 100}% over.</p>` : '';

    return `
        <div class="sbo-dp-as">
            <div class="sbo-dp-bar" role="img" aria-label="${esc(aria)}">${segs}</div>
            <div class="sbo-dp-rows sbo-dp-arows">${rows}</div>
            ${warn}
        </div>`;
}

/** Hovering a bar segment or a row lights up that assessment in both. */
function wireSBOHover(panel) {
    const clear = () => {
        panel.querySelectorAll('.sbo-dp-as.is-hl').forEach(q => {
            q.classList.remove('is-hl');
            q.querySelectorAll('.is-on').forEach(x => x.classList.remove('is-on'));
        });
    };
    panel.onmouseover = function(e) {
        clear();
        const t = e.target.closest ? e.target.closest('.sbo-dp-as [data-k]') : null;
        if (!t) return;
        const q = t.closest('.sbo-dp-as');
        q.classList.add('is-hl');
        q.querySelectorAll(`[data-k="${t.dataset.k}"]`).forEach(x => x.classList.add('is-on'));
    };
    panel.onmouseleave = clear;
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

    // class_id is kept for compatibility; sboBriefId is what restore uses.
    window.teacherSectionState.selection.sbo = brief.class_id;
    window.teacherSectionState.selection.sboBriefId = brief.id;
    window.persistTeacherSectionState();

    const panel = document.getElementById('sbo-main-panel');
    if (!panel) return;
    panel.onkeydown = null;   // release-form key handler, if it was set

    const esc         = escapeSBOHtml;
    const topics      = brief.topics || [];
    const assessments = brief.assessments || [];
    const topicCount  = topics.length;
    const totalWeight = assessments.reduce((n, a) => n + (Number(a.weight) || 0), 0);
    const updated     = formatSBOUpdatedDate(brief.updated_at);
    const notes       = String(brief.notes || '').trim();

    const topicsHtml = topicCount
        ? `<div class="sbo-dp-topics">${topics.map((t, i) => `
            <div class="sbo-dp-topic"><span class="sbo-dp-topic-n">${String(i + 1).padStart(2, '0')}</span>${esc(t)}</div>`).join('')}</div>`
        : `<div class="sbo-dp-rows"><div class="sbo-dp-none">No topics listed.</div></div>`;

    panel.innerHTML = `
        <div class="sbo-dp">
            <p class="sbo-dp-crumb">${esc(brief.class_name)}</p>
            <h2 class="sbo-dp-title">${esc(brief.subject)}</h2>
            <div class="sbo-dp-meta">
                <span class="sbo-dp-pill">Term ${esc(brief.term)}</span>
                ${updated ? `<span>Updated ${esc(updated)}</span>` : ''}
            </div>
            ${(!topicCount && !assessments.length) ? `<p class="sbo-dp-callout">No topics or assessment weighting have been added yet.</p>` : ''}

            <section class="sbo-dp-section">
                <div class="sbo-dp-sh">
                    <h3 class="sbo-dp-h">Topics</h3>
                    <span class="sbo-dp-hint">${sboDpPlural(topicCount, 'topic')}</span>
                </div>
                ${topicsHtml}
            </section>

            <section class="sbo-dp-section">
                <div class="sbo-dp-sh">
                    <h3 class="sbo-dp-h">Assessment weighting</h3>
                    ${assessments.length ? `<span class="sbo-dp-hint${totalWeight !== 100 ? ' is-warn' : ''}">Total ${totalWeight}%</span>` : ''}
                </div>
                ${buildSBOAssessmentBlock(assessments)}
            </section>

            ${notes ? `
            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Notes</h3>
                <p class="sbo-dp-notes">${esc(notes)}</p>
            </section>` : ''}

            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Delete</h3>
                <div class="sbo-dp-rows">
                    <div class="sbo-dp-row">
                        <p class="sbo-dp-rs">Permanently remove this syllabus brief. This can't be undone.</p>
                        <button type="button" class="sbo-dp-btn sbo-dp-btn--danger" onclick="confirmDeleteSBO(${Number(brief.id)})">Delete brief</button>
                    </div>
                </div>
            </section>
        </div>`;

    panel.scrollTop = 0;
    wireSBOHover(panel);

    // Swap the info rail to reflect this brief's completeness, instead
    // of leaving it on the generic page-level copy.
    if (typeof updateInfoRail === 'function') {
        const assessCount = assessments.length;
        if (topicCount === 0 && assessCount === 0) {
            updateInfoRail('sbo-rail', 'Brief Needs Detail', `
                <p>This syllabus brief for <strong>${esc(brief.class_name)}</strong> has no topics or assessment weighting listed yet.</p>
                <p>Learners see this brief exactly as written, so it's worth filling in before sharing it widely.</p>
            `);
        } else {
            updateInfoRail('sbo-rail', 'About This Brief', `
                <p><strong>${esc(brief.class_name)}</strong>, Term ${esc(brief.term)} &mdash; ${topicCount} topic${topicCount !== 1 ? 's' : ''} and ${assessCount} assessment${assessCount !== 1 ? 's' : ''} listed.</p>
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
    window.teacherSectionState.selection.sboBriefId = brief.id;
    window.persistTeacherSectionState();

    window.configureTeacherHeader({
        title: 'Syllabus',
        mode: 'detail',
        detailType: 'SBO',
        backLabel: 'Syllabus',
        color: '#a67c52'
    });

    const T = window.tdUi;
    const topics      = brief.topics || [];
    const assessments = brief.assessments || [];
    const updatedDate = brief.updated_at
        ? parseSBODate(brief.updated_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })
        : '';

    const topicsHtml = topics.length
        ? `<div class="td-chips">${topics.map(t => `<span class="td-chip">${T.esc(t)}</span>`).join('')}</div>`
        : `<div class="td-panel"><div class="td-empty">No topics listed.</div></div>`;

    const assessHtml = assessments.length
        ? `<div class="td-panel">${assessments.map(a => {
            const weight = Math.max(0, Math.min(100, Number(a.weight) || 0));
            return `<div class="td-w">
                <div class="td-w-top"><span>${T.esc(a.type)}</span><b>${T.esc(a.weight)}%</b></div>
                <div class="td-track"><i style="width:${weight}%"></i></div>
            </div>`;
        }).join('')}</div>`
        : `<div class="td-panel"><div class="td-empty">No assessments listed.</div></div>`;

    // The look is teacher_detail.css. The delete sheet uses the same id and class names the desktop page's
    // handlers look for (deleteSBOModal, .sbo-delete-confirm-btn), so confirmDeleteSBO / executeDeleteSBO work here.
    apiArea.innerHTML = `
        <article class="sbo-mobile-detail td-detail td-detail--syl">
            <div class="td-top">
                <span class="td-eyebrow">Syllabus</span>
                ${T.pill(`Term ${brief.term}`, '')}
            </div>
            <div class="td-title">${T.esc(brief.subject)}</div>
            <p class="td-sub">${T.esc(brief.class_name)}${updatedDate ? `<span class="td-dot">&bull;</span>Updated ${T.esc(updatedDate)}` : ''}</p>

            <div class="td-gt">Topics &middot; ${topics.length}</div>
            ${topicsHtml}

            <div class="td-gt">Assessment weighting</div>
            ${assessHtml}

            ${brief.notes ? `
            <div class="td-gt">Notes</div>
            <div class="td-panel"><div class="td-note">${T.multiline(brief.notes)}</div></div>` : ''}

            <div class="td-panel td-danger-gap">
                <button type="button" class="td-row td-row--danger" onclick="confirmDeleteSBO(${Number(brief.id)})">
                    ${T.icon('trash')}
                    <div class="td-main"><b>Delete syllabus</b></div>
                </button>
            </div>

            ${T.confirmSheet({
                id: 'deleteSBOModal',
                closeCall: 'closeDeleteSBOModal()',
                title: 'Delete syllabus',
                body: `Delete the <b>${T.esc(brief.subject)}</b> syllabus for ${T.esc(brief.class_name)}? This can't be undone.`,
                confirmClass: 'sbo-delete-confirm-btn',
                confirmAttrs: 'onclick="executeDeleteSBO()"',
                confirmLabel: 'Delete syllabus'
            })}
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
        <div class="sbo-dp sbo-dp-form">
            <p class="sbo-dp-crumb">Syllabus</p>
            <h2 class="sbo-dp-title">Release a syllabus</h2>
            <p class="sbo-dp-lede">Learners in the class are notified as soon as you post. They see everything exactly as you write it here.</p>

            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Details</h3>
                <div class="sbo-dp-two">
                    <div class="sbo-dp-fld">
                        <span class="sbo-dp-lbl" id="sboClassLabel">Class</span>
                        <div id="sboClassPicker" aria-labelledby="sboClassLabel"></div>
                    </div>
                    <div class="sbo-dp-fld">
                        <label class="sbo-dp-lbl" for="sboTerm">Term</label>
                        <select id="sboTerm" class="sbo-dp-in">
                            <option value="">Choose a term</option>
                            <option value="1">Term 1</option>
                            <option value="2">Term 2</option>
                            <option value="3">Term 3</option>
                            <option value="4">Term 4</option>
                        </select>
                    </div>
                </div>
                <div class="sbo-dp-fld">
                    <label class="sbo-dp-lbl" for="sboSubject">Subject</label>
                    <input type="text" id="sboSubject" class="sbo-dp-in" placeholder="e.g. Mathematics" autocomplete="off">
                </div>
            </section>

            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Topics</h3>
                <div id="sboTopicsList" class="sbo-list-stack"></div>
                <button type="button" class="sbo-dp-btn sbo-dp-add" onclick="addSBOTopicDesktop()">${sboDpIcon('plus', 14)}Add a topic</button>
            </section>

            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Assessment weighting</h3>
                <div id="sboAssessmentsList" class="sbo-list-stack"></div>
                <button type="button" class="sbo-dp-btn sbo-dp-add" onclick="addSBOAssessmentDesktop()">${sboDpIcon('plus', 14)}Add an assessment</button>
                <div class="sbo-dp-wt">
                    <div class="sbo-dp-wt-track"><i id="sboWeightBar"></i></div>
                    <div class="sbo-dp-wt-text" aria-live="polite">
                        <span id="sboWeightTotal" class="sbo-weight-total">Total: 0%</span><span id="sboWeightHint" class="sbo-dp-wt-hint"></span>
                    </div>
                </div>
            </section>

            <section class="sbo-dp-section">
                <h3 class="sbo-dp-h">Notes<span class="sbo-dp-opt">Optional</span></h3>
                <textarea id="sboNotes" class="sbo-dp-in" rows="3" aria-label="Notes"
                    placeholder="e.g. No exam this term, so the focus is on continuous assessment"></textarea>
            </section>

            <div class="sbo-dp-actions">
                <div id="sboError" class="sbo-dp-err" role="alert"></div>
                <button type="button" class="sbo-dp-btn" onclick="fetchTeacherSyllabus()">Cancel</button>
                <button type="button" class="sbo-dp-btn sbo-dp-btn--primary" id="sboSaveBtn" onclick="saveSBO()">Post &amp; notify</button>
            </div>
        </div>`;

    // Enter in a topic adds the next one (a blank topic is not stacked).
    panel.onkeydown = function(e) {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sbo-topic-input')) {
            e.preventDefault();
            if (e.target.value.trim()) window.addSBOTopicDesktop();
        }
    };

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
        <input type="text" placeholder="e.g. Linear Equations" aria-label="Topic"
               class="teacher-modal-input sbo-topic-input sbo-dynamic-row-input">
        <button onclick="this.closest('.sbo-topic-row').remove()" aria-label="Remove topic"
                class="sbo-row-remove-btn">&times;</button>`;
    list.appendChild(row);
};

window.addSBOAssessment = function() {
    const list = document.getElementById('sboAssessmentsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'sbo-assessment-row sbo-dynamic-row';
    row.innerHTML = `
        <input type="text" placeholder="e.g. Tests" aria-label="Assessment type"
               class="teacher-modal-input sbo-assess-type sbo-dynamic-row-input">
        <div class="sbo-weight-input-wrap">
            <input type="number" placeholder="30" min="1" max="100" aria-label="Weight in percent"
                   class="teacher-modal-input sbo-assess-weight sbo-weight-input"
                   oninput="updateSBOWeightTotal()">
            <span class="sbo-weight-input-suffix">%</span>
        </div>
        <button onclick="this.closest('.sbo-assessment-row').remove(); updateSBOWeightTotal();" aria-label="Remove assessment"
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

    // Desktop form only (the mobile drawer has no bar): the same total drawn
    // as a bar, with how much is left.
    const bar = document.getElementById('sboWeightBar');
    if (bar) {
        bar.style.width = Math.min(total, 100) + '%';
        const wrap = bar.closest('.sbo-dp-wt');
        if (wrap) {
            wrap.classList.toggle('is-complete', total === 100);
            wrap.classList.toggle('is-over', total > 100);
        }
        const hint = document.getElementById('sboWeightHint');
        if (hint) {
            hint.textContent = total === 100 ? ''
                : total > 100 ? ` · ${total - 100}% over`
                : ` · ${100 - total}% to go`;
        }
    }
};

// Desktop wrappers: same row builders as the mobile drawer, plus focus on the new row.
window.addSBOTopicDesktop = function() {
    window.addSBOTopic();
    const inputs = document.querySelectorAll('#sboTopicsList .sbo-topic-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
};
window.addSBOAssessmentDesktop = function() {
    window.addSBOAssessment();
    const inputs = document.querySelectorAll('#sboAssessmentsList .sbo-assess-type');
    if (inputs.length) inputs[inputs.length - 1].focus();
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
    const btn = document.getElementById('sboSaveBtn')
             || document.querySelector('#sbo-main-panel .teacher-modal-submit')
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