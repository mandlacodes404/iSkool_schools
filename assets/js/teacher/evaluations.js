function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
window.teacherEvaluationCache = null;
window.teacherEvaluationCachePromise = null;

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherEvaluations = function () {
    if (window.teacherEvaluationCache) return;
    if (window.teacherEvaluationCachePromise) return;
    window.teacherEvaluationCachePromise = fetch('api/teacher/get_evaluations.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherEvaluationCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherEvaluationCachePromise = null; });
};

window.fetchTeacherEvaluations = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_evaluations");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_evaluations");

    // Restore standard chrome any time this list is (re)loaded — also the
    // mobile "back" target dispatched from handleTeacherHeaderBack when
    // detailType === 'Evaluation'. Applied up front (see Assignments
    // back-button fix in PROJECT_NOTES.md for why this matters).
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ title: 'Evaluations', mode: 'standard', color: '#1e90ff' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherEvaluationCache) {
        renderTeacherEvaluations(window.teacherEvaluationCache);
        return;
    }

    try {
        if (!window.teacherEvaluationCachePromise) {
            window.teacherEvaluationCachePromise = fetch('api/teacher/get_evaluations.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherEvaluationCache = data;
                    return data;
                })
                .finally(() => { window.teacherEvaluationCachePromise = null; });
        }
        const data = await window.teacherEvaluationCachePromise;
        renderTeacherEvaluations(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p class="ev-error-message">
                Error loading evaluations.
            </p>`;
    }
};

// Track active evaluation for desktop panel
window._activeDesktopEvalKey = null;

function renderTeacherEvaluations(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Build flat list for desktop panel lookup ──
    window._allEvalsFlat = [];
    if (data && data.length > 0) {
        data.forEach((group, gIdx) => {
            group.evaluations.forEach((ev, eIdx) => {
                window._allEvalsFlat.push({ ev, groupIndex: gIdx, evIndex: eIdx, class_name: group.class_name });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="ev-empty-state-inline">No evaluations released yet.</p>`;
    } else {
        data.forEach((group, gIdx) => {
            const classGroupId = `ev-class-group-${gIdx}`;
            let itemsHtml = '';
            group.evaluations.forEach((ev, eIdx) => {
                const key = `${gIdx}-${eIdx}`;
                itemsHtml += `
                    <div class="ev-sidebar-item" id="ev-sidebar-${key}"
                        onclick="selectDesktopEval(${gIdx}, ${eIdx})">
                        <span class="ev-sidebar-dot" aria-hidden="true"></span>
                        <div class="ev-sidebar-item-info">
                            <div class="ev-sidebar-item-title">${ev.title}</div>
                            ${ev.display_date ? `<div class="ev-sidebar-item-meta">${ev.display_date}</div>` : ''}
                        </div>
                    </div>`;
            });
            sidebarHtml += window.buildCollapsibleClassGroup(
                classGroupId,
                'ev-sidebar-class-label',
                group.class_name,
                itemsHtml
            );
        });
    }

    // ── Empty-state copy for the desktop main panel ──
    const evalCount = (data || []).reduce((n, g) => n + g.evaluations.length, 0);
    const noResponseCount = (data || []).reduce(
        (n, g) => n + g.evaluations.filter(e => !e.response_count).length, 0);
    const emptyTitle = evalCount ? 'Pick an evaluation' : 'No evaluations yet';
    const emptyBody = evalCount
        ? `${evalCount} ${evalCount === 1 ? 'evaluation' : 'evaluations'} across your classes. ` +
          (noResponseCount
              ? `${noResponseCount} ${noResponseCount === 1 ? 'has' : 'have'} no responses yet.`
              : 'Each one has responses.')
        : 'Release one to a class and the results will show up here, grouped by class.';
    const emptyCta = evalCount ? 'Release an evaluation' : 'Release your first evaluation';

    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="ev-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="ev-sidebar tchr-flat-sidebar">
                <div class="ev-sidebar-header">
                    <span>Evaluations</span>
                    <button class="teacher-upload-btn teacher-desktop-create ev-new-btn" id="ev-new-btn" onclick="openReleaseEvaluationForm()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="ev-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="ev-main-panel tchr-flat-panel" id="ev-main-panel">
                <div class="ev-panel-empty">
                    <h2 class="ev-panel-empty-title">${emptyTitle}</h2>
                    <p class="ev-panel-empty-body">${emptyBody}</p>
                    <button type="button" class="ev-dp-btn ev-dp-btn--primary" onclick="openReleaseEvaluationForm()">
                        ${evDpIcon('plus', 14)}${emptyCta}
                    </button>
                </div>
            </div>

            <!-- railId lets selectDesktopEval() swap this to
                 selection-specific copy via updateInfoRail(). -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Evaluations', `
                <p>Responses are always anonymous — you'll see the breakdown of answers per statement, but never which learner gave which response.</p>
                <p>Comments are optional for learners, so a low response count doesn't necessarily mean few learners completed the evaluation.</p>
            `, 'ev-rail') : ''}
        </div>

        <div id="deleteEvaluationModal" class="teacher-modal-overlay ev-modal-hidden">
            <div class="teacher-modal-box ev-delete-modal-box">
                <div class="teacher-modal-header">
                    <span>Delete Evaluation</span>
                    <button onclick="closeDeleteEvaluationModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <p class="ev-delete-modal-text">Are you sure you want to delete this evaluation? This cannot be undone.</p>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeDeleteEvaluationModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="executeDeleteEvaluation()" class="teacher-modal-submit ev-delete-confirm-btn">Delete</button>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="ev-mobile-list">
            ${window.buildTeacherSearchBar('ev', { mobile: true, placeholder: 'Search evaluations...' })}`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No evaluations released yet.</p>`;
    } else {
        data.forEach((group, groupIndex) => {
            const mobileGroupId = `ev-mobile-class-group-${groupIndex}`;
            let itemsHtml = '';

            group.evaluations.forEach((ev, evIndex) => {
                itemsHtml += `
                    <div class="ev-mobile-row" data-title="${ev.title}" role="button" tabindex="0"
                        onclick="openMobileTeacherEvaluation(${window._allEvalsFlat.findIndex(e => e.groupIndex === groupIndex && e.evIndex === evIndex)})"
                        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherEvaluation(${window._allEvalsFlat.findIndex(e => e.groupIndex === groupIndex && e.evIndex === evIndex)});}">
                        <div class="ev-mobile-row-icon">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#1e90ff" stroke-width="1.2" fill="none">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                        </div>
                        <div class="ev-mobile-row-body">
                            <div class="ev-mobile-row-title">${ev.title}</div>
                            <div class="ev-mobile-row-meta">
                                ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
                                ${ev.description ? ' &middot; ' + ev.description : ''}
                            </div>
                        </div>
                        <div class="ev-mobile-row-chevron">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>`;
            });

            const folderIcon = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#1e90ff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="ev-mobile-folder-icon">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>`;

            html += window.buildCollapsibleClassGroup(
                mobileGroupId,
                'ev-mobile-folder-label',
                `${folderIcon}<span class="ev-mobile-folder-name">${group.class_name}</span><span class="ev-mobile-folder-count">${group.evaluations.length}</span>`,
                itemsHtml
            );
        });
    }

    html += `</div>`;

    // Release Evaluation modal (mobile). evalResultsModal was removed —
    // mobile now uses openMobileTeacherEvaluation's detail page instead
    // of a results popup (2026-09-12).
    html += `
        <div id="releaseEvalModal" class="teacher-modal-overlay ev-modal-hidden">
            <div class="teacher-modal-box ev-modal-box--release">
                <div class="teacher-modal-header">
                    <span>Release Evaluation</span>
                    <button onclick="closeReleaseEvaluationModal()" class="teacher-modal-close">&times;</button>
                </div>
                <div class="teacher-modal-body">
                    <label class="teacher-modal-label">Title *</label>
                    <input type="text" id="evalTitle" class="teacher-modal-input" placeholder="e.g. Term 1 Feedback">

                    <label class="teacher-modal-label">Description (optional)</label>
                    <textarea id="evalDescription" class="teacher-modal-input ev-form-textarea" rows="3"
                        placeholder="Optional description..."></textarea>

                    <label class="teacher-modal-label">Select Class *</label>
                    <div id="evalClassPicker"></div>

                    <label class="teacher-modal-label ev-checkbox-label">
                        <input type="checkbox" id="evalUseDefault" checked>
                        Use default questions (recommended)
                    </label>

                    <div class="ev-preview-toggle-wrap">
                        <a href="javascript:void(0)" onclick="toggleDefaultPreview()" class="ev-preview-toggle-link">
                            👁 View default questions
                        </a>
                        <div id="defaultStatementsPreview" class="ev-modal-hidden ev-default-preview-box"></div>
                    </div>

                    <div id="customStatements" class="ev-custom-statements-wrap"></div>
                    <button type="button" onclick="addCustomStatement()" class="ev-add-statement-btn">
                        + Add Custom Question
                    </button>

                    <label class="teacher-modal-label ev-checkbox-label">
                        <input type="checkbox" id="evalForceEmail">
                        Also send email notification
                    </label>

                    <div id="releaseEvalError" class="ev-form-error"></div>
                </div>
                <div class="teacher-modal-footer">
                    <button onclick="closeReleaseEvaluationModal()" class="teacher-modal-cancel">Cancel</button>
                    <button onclick="submitReleaseEvaluation()" class="teacher-modal-submit" id="releaseEvalSubmitBtn">Release</button>
                </div>
            </div>
        </div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();

    loadEvalClasses();
    window.wireTeacherSearchBar('ev');

    const sidebarScrollEl = apiArea.querySelector('.ev-sidebar-scroll');
    window.wireTeacherSectionScroll('evaluations-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('evaluations-sidebar', sidebarScrollEl);

    // Restore whichever evaluation was selected before navigating away,
    // if that same group/index still exists in the freshly-loaded data.
    const saved = window.teacherSectionState.selection.evaluations;
    if (saved) {
        const group = (window.teacherEvaluationCache || [])[saved.groupIndex];
        const ev = group && group.evaluations && group.evaluations[saved.evIndex];
        if (ev) selectDesktopEval(saved.groupIndex, saved.evIndex);
    }
}

// ── DESKTOP PANEL HELPERS ───────────────────────────────────────────────────
// (desktop only: the mobile detail page keeps using its own markup + eval-* styles)

/** Learner comments and names are free text: escape everything we put in the page. */
function escapeTeacherEvalHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function evDpIcon(name, size) {
    const paths = {
        plus: '<path d="M12 5v14M5 12h14"/>',
        lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function evDpPlural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** One question: a single stacked bar (segment width = answer count) plus a legend. */
function buildEvalQuestionBlock(s, index) {
    const esc = escapeTeacherEvalHtml;
    const breakdown = s.breakdown || [];
    const sum = breakdown.reduce((n, b) => n + (Number(b.count) || 0), 0);
    const num = `<span class="ev-dp-qn">${index + 1}</span>`;

    if (!sum) {
        return `
            <div class="ev-dp-q">
                <p class="ev-dp-qt">${num}${esc(s.statement)}</p>
                <div class="ev-dp-bar is-empty"><i></i></div>
            </div>`;
    }

    const max  = Math.max(...breakdown.map(b => Number(b.count) || 0));
    const tops = breakdown.filter(b => (Number(b.count) || 0) === max);
    let headline = '';
    if (tops.length === 1) {
        headline = `Most said <b>${esc(tops[0].label)}</b> ${Number(tops[0].percentage) || 0}%`;
    } else if (tops.length === 2) {
        headline = `Split between <b>${esc(tops[0].label)}</b> and <b>${esc(tops[1].label)}</b>`;
    }

    const aria = breakdown.map(b => `${b.label} ${Number(b.percentage) || 0}%`).join(', ');
    const segs = breakdown.map((b, k) => (Number(b.count) || 0) ? `
        <i data-k="${k}" style="--g:${Number(b.count)};--c:${esc(b.color)};"
           title="${esc(b.label)}: ${Number(b.count)} (${Number(b.percentage) || 0}%)"></i>` : '').join('');
    const legend = breakdown.map((b, k) => `
        <li data-k="${k}" class="${(Number(b.count) || 0) ? '' : 'is-zero'}" style="--c:${esc(b.color)};">
            <span class="ev-dp-lgl"><span class="ev-dp-sq"></span>${esc(b.label)}</span>
            <span class="ev-dp-lgc">${Number(b.count) || 0} &middot; ${Number(b.percentage) || 0}%</span>
        </li>`).join('');

    return `
        <div class="ev-dp-q">
            <div class="ev-dp-qh">
                <p class="ev-dp-qt">${num}${esc(s.statement)}</p>
                ${headline ? `<span class="ev-dp-qm">${headline}</span>` : ''}
            </div>
            <div class="ev-dp-bar" role="img" aria-label="${esc(aria)}">${segs}</div>
            <ul class="ev-dp-lg">${legend}</ul>
        </div>`;
}

/** Hovering a bar segment or a legend item lights up that answer in both. */
function wireEvalHover(panel) {
    const clear = () => {
        panel.querySelectorAll('.ev-dp-q.is-hl').forEach(q => {
            q.classList.remove('is-hl');
            q.querySelectorAll('.is-on').forEach(x => x.classList.remove('is-on'));
        });
    };
    panel.onmouseover = function(e) {
        clear();
        const t = e.target.closest ? e.target.closest('.ev-dp-q [data-k]') : null;
        if (!t) return;
        const q = t.closest('.ev-dp-q');
        q.classList.add('is-hl');
        q.querySelectorAll(`[data-k="${t.dataset.k}"]`).forEach(x => x.classList.add('is-on'));
    };
    panel.onmouseleave = clear;
}

/** Comments beyond the first five are rendered but hidden; this just flips a class. */
window.toggleEvalComments = function(btn) {
    const box = document.getElementById('ev-dp-comments');
    if (!box) return;
    const open = box.classList.toggle('is-expanded');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Show fewer' : `Show all ${btn.dataset.total} comments`;
};

// Desktop wrappers around the shared release-form functions (the mobile modal
// keeps calling the originals, so their behaviour there is unchanged).
window.toggleDefaultPreviewDesktop = async function(btn) {
    await window.toggleDefaultPreview();
    const preview = document.getElementById('defaultStatementsPreview');
    if (btn && preview) btn.textContent = preview.style.display === 'block' ? 'Hide' : 'View';
};

window.addCustomStatementDesktop = function() {
    window.addCustomStatement();
    const areas = document.querySelectorAll('#customStatements textarea');
    const last = areas[areas.length - 1];
    if (last) last.focus();
};

// ── DESKTOP PANEL: SELECT EVALUATION ────────────────────────────────────────
window.selectDesktopEval = function(groupIndex, evIndex) {
    const key = `${groupIndex}-${evIndex}`;

    document.querySelectorAll('.ev-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('ev-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const sidebarItem = document.getElementById(`ev-sidebar-${key}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    window._activeDesktopEvalKey = key;
    window.teacherSectionState.selection.evaluations = { groupIndex, evIndex };
    window.persistTeacherSectionState();

    const group = (window.teacherEvaluationCache || [])[groupIndex];
    const ev = group && group.evaluations && group.evaluations[evIndex];
    if (!ev) return;

    const panel = document.getElementById('ev-main-panel');
    if (!panel) return;

    const esc       = escapeTeacherEvalHtml;
    const responses = Number(ev.response_count) || 0;
    const statements = ev.statements || [];
    const comments   = ev.comments || [];
    const desc       = String(ev.description || '').trim();
    const SHOWN_COMMENTS = 5;

    let commentsHtml = '';
    if (responses > 0) {
        commentsHtml = `
            <section class="ev-dp-section">
                <h3 class="ev-dp-h">Comments</h3>
                ${comments.length ? `
                    <p class="ev-dp-note">${evDpPlural(comments.length, 'comment')} from ${evDpPlural(responses, 'response')}. There's no way to tell who wrote what.</p>
                    <div class="ev-dp-rows" id="ev-dp-comments">
                        ${comments.map((c, i) => `<div class="ev-dp-cm${i >= SHOWN_COMMENTS ? ' is-extra' : ''}">${esc(c)}</div>`).join('')}
                    </div>
                    ${comments.length > SHOWN_COMMENTS ? `
                        <button type="button" class="ev-dp-btn ev-dp-more" aria-expanded="false" aria-controls="ev-dp-comments"
                            data-total="${comments.length}" onclick="toggleEvalComments(this)">Show all ${comments.length} comments</button>` : ''}`
                : `<div class="ev-dp-rows"><div class="ev-dp-none">No comments were left.</div></div>`}
            </section>`;
    }

    panel.innerHTML = `
        <div class="ev-dp">
            <p class="ev-dp-crumb">${esc(group.class_name)}</p>
            <h2 class="ev-dp-title">${esc(ev.title)}</h2>
            <div class="ev-dp-meta">
                <span class="ev-dp-pill">${evDpIcon('lock', 12)}Anonymous</span>
                <span>${evDpPlural(responses, 'response')} &middot; ${evDpPlural(comments.length, 'comment')}</span>
            </div>
            ${desc ? `<p class="ev-dp-desc">${esc(desc)}</p>` : ''}

            <section class="ev-dp-section">
                <div class="ev-dp-sh">
                    <h3 class="ev-dp-h">Results</h3>
                    <span class="ev-dp-hint">${evDpPlural(statements.length, 'question')}</span>
                </div>
                ${responses ? '' : `<p class="ev-dp-note">No responses yet. Results fill in as learners complete this evaluation.</p>`}
                <div class="ev-dp-qs">${statements.map((s, i) => buildEvalQuestionBlock(s, i)).join('')}</div>
            </section>

            ${commentsHtml}

            <section class="ev-dp-section">
                <h3 class="ev-dp-h">Delete</h3>
                <div class="ev-dp-rows">
                    <div class="ev-dp-row">
                        <p class="ev-dp-rs">Permanently remove this evaluation, with all of its responses and comments. This can't be undone.</p>
                        <button type="button" class="ev-dp-btn ev-dp-btn--danger" onclick="confirmDeleteEvaluation(${Number(ev.id)})">Delete evaluation</button>
                    </div>
                </div>
            </section>
        </div>`;

    panel.scrollTop = 0;
    wireEvalHover(panel);

    // Swap the info rail to reflect this evaluation's response volume,
    // instead of leaving it on the generic page-level copy.
    if (typeof updateInfoRail === 'function') {
        if (responses === 0) {
            updateInfoRail('ev-rail', 'No Responses Yet', `
                <p><strong>${esc(ev.title)}</strong> hasn't received any responses yet.</p>
                <p>Results here will fill in as learners complete it — responses stay anonymous throughout.</p>
            `);
        } else {
            updateInfoRail('ev-rail', 'About This Evaluation', `
                <p><strong>${responses}</strong> anonymous response${responses !== 1 ? 's' : ''} so far, with ${comments.length} comment${comments.length !== 1 ? 's' : ''} left.</p>
                <p>Individual responses are never linked back to a learner, even here.</p>
            `);
        }
    }
};

// ─────────────────────────────────────────────
// MOBILE DETAIL VIEW: tap -> detail page
// Replaces the old evalResultsModal popup with a real detail page,
// matching Assignments/Announcements/Quizzes. Body-building logic
// (statement bars, comments) mirrors selectDesktopEval's — same
// underlying data shape, just rendered into a page instead of a panel.
// Delete added here (desktop parity, confirmed with the user) — the old
// mobile modal was view-only.
// ─────────────────────────────────────────────
window.openMobileTeacherEvaluation = function(flatIndex) {
    if (window.innerWidth > 899) return;

    const entry = (window._allEvalsFlat || [])[flatIndex];
    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    if (!entry || !apiArea) return;

    const ev = window.teacherEvaluationCache[entry.groupIndex].evaluations[entry.evIndex];
    if (!ev) return;

    if (iframe) iframe.style.display = 'none';
    apiArea.style.display = 'block';

    sessionStorage.setItem('lastTeacherPage', 'teacher_evaluations');
    window.teacherSectionState.selection.evaluations = { groupIndex: entry.groupIndex, evIndex: entry.evIndex };
    window.persistTeacherSectionState();

    window.configureTeacherHeader({
        title: 'Evaluation',
        mode: 'detail',
        detailType: 'Evaluation',
        backLabel: 'Evaluations',
        color: '#1e90ff'
    });

    let body = `
        <article class="ev-mobile-detail">
            <div class="ev-mobile-detail-header">
                <div>
                    <div class="ev-mobile-detail-title">${ev.title}</div>
                    <div class="ev-mobile-detail-meta">
                        ${ev.response_count} response${ev.response_count !== 1 ? 's' : ''}
                        ${ev.description ? ' &mdash; ' + ev.description : ''}
                    </div>
                </div>
                <button class="ev-panel-delete-btn" onclick="confirmDeleteEvaluation(${ev.id})">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    Delete
                </button>
            </div>`;

    ev.statements.forEach(s => {
        body += `<div class="eval-question-block">
            <div class="eval-question-text">${s.statement}</div>
            <div class="eval-bars">`;

        s.breakdown.forEach(b => {
            body += `
                <div class="eval-bar-container">
                    <div class="eval-bar-label">${b.label} (${b.count})</div>
                    <div class="eval-bar-bg">
                        <div class="eval-bar-fill" style="--eval-bar-width:${b.percentage}%;--eval-bar-color:${b.color};">
                            ${b.percentage}%
                        </div>
                    </div>
                </div>`;
        });

        body += `</div></div>`;
    });

    body += `<div class="eval-comments-section">
        <div class="eval-comments-title">
            Anonymous Comments (${ev.response_count} total responses)
        </div>`;

    if (ev.comments.length === 0) {
        body += `<p class="eval-no-comments">No additional comments.</p>`;
    } else {
        ev.comments.forEach(c => {
            body += `<div class="eval-comment">${c.replace(/\n/g, '<br>')}</div>`;
        });
    }

    body += `</div></article>`;

    apiArea.innerHTML = body;
    apiArea.scrollTop = 0;
};

window.openMobileTeacherEvaluationById = function(evaluationId) {
    const idx = (window._allEvalsFlat || []).findIndex(entry => {
        const ev = window.teacherEvaluationCache?.[entry.groupIndex]?.evaluations?.[entry.evIndex];
        return ev && String(ev.id) === String(evaluationId);
    });
    if (idx >= 0) window.openMobileTeacherEvaluation(idx);
};

// ─────────────────────────────────────────────
// RELEASE MODAL
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// ROUTER: panel on desktop, modal on mobile
// ─────────────────────────────────────────────
window.openReleaseEvaluationForm = function() {
    const panel = document.getElementById('ev-main-panel');
    if (window.innerWidth >= 900 && panel) {
        openReleaseEvaluationPanel(panel);
    } else {
        openReleaseEvaluationModal();
    }
};

// ─────────────────────────────────────────────
// DESKTOP PANEL FORM
// ─────────────────────────────────────────────
function openReleaseEvaluationPanel(panel) {
    document.querySelectorAll('.ev-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('ev-new-btn');
    if (newBtn) newBtn.classList.add('active');

    panel.innerHTML = `
        <div class="ev-dp ev-dp-form">
            <p class="ev-dp-crumb">Evaluations</p>
            <h2 class="ev-dp-title">Release an evaluation</h2>
            <p class="ev-dp-lede">Learners answer anonymously. You'll see the breakdown for each question, but never who said what.</p>

            <section class="ev-dp-section">
                <h3 class="ev-dp-h">Details</h3>
                <div class="ev-dp-fld is-first">
                    <label class="ev-dp-lbl" for="evalTitle">Title</label>
                    <input type="text" id="evalTitle" class="ev-dp-in" placeholder="e.g. Term 4 feedback" autocomplete="off">
                </div>
                <div class="ev-dp-fld">
                    <label class="ev-dp-lbl" for="evalDescription">Description<span class="ev-dp-opt">Optional</span></label>
                    <textarea id="evalDescription" class="ev-dp-in" rows="3" placeholder="Tell learners what this is for"></textarea>
                </div>
                <div class="ev-dp-fld">
                    <span class="ev-dp-lbl" id="evalClassLabel">Class</span>
                    <div id="evalClassPicker" aria-labelledby="evalClassLabel"></div>
                </div>
            </section>

            <section class="ev-dp-section">
                <h3 class="ev-dp-h">Questions</h3>
                <div class="ev-dp-rows">
                    <div class="ev-dp-row">
                        <div>
                            <label class="ev-dp-rt" for="evalUseDefault">Use the default questions</label>
                            <div class="ev-dp-rs">Recommended. You can read them before you release.</div>
                        </div>
                        <div class="ev-dp-rc">
                            <button type="button" class="ev-dp-btn ev-dp-btn--sm ev-dp-btn--ghost" onclick="toggleDefaultPreviewDesktop(this)">View</button>
                            <input type="checkbox" id="evalUseDefault" class="ev-dp-switch" role="switch" checked>
                        </div>
                    </div>
                    <div id="defaultStatementsPreview" class="ev-modal-hidden ev-default-preview-box"></div>
                </div>
                <div id="customStatements" class="ev-custom-statements-wrap"></div>
                <button type="button" class="ev-dp-btn ev-dp-add" onclick="addCustomStatementDesktop()">
                    ${evDpIcon('plus', 14)}Add your own question
                </button>
            </section>

            <section class="ev-dp-section">
                <h3 class="ev-dp-h">Notification</h3>
                <div class="ev-dp-rows">
                    <div class="ev-dp-row">
                        <div>
                            <label class="ev-dp-rt" for="evalForceEmail">Also send email notification</label>
                            <div class="ev-dp-rs">Learners are emailed when it's released.</div>
                        </div>
                        <input type="checkbox" id="evalForceEmail" class="ev-dp-switch" role="switch">
                    </div>
                </div>
            </section>

            <div class="ev-dp-actions">
                <div id="releaseEvalError" class="ev-dp-err" role="alert"></div>
                <button type="button" class="ev-dp-btn" onclick="fetchTeacherEvaluations()">Cancel</button>
                <button type="button" class="ev-dp-btn ev-dp-btn--primary" id="releaseEvalSubmitBtn" onclick="submitReleaseEvaluation()">Release</button>
            </div>
        </div>`;

    loadEvalClasses(panel, true);
}

window.openReleaseEvaluationModal = function() {
    document.getElementById('releaseEvalModal').style.display = 'flex';
};

window.closeReleaseEvaluationModal = function() {
    const modal = document.getElementById('releaseEvalModal');
    if (modal) modal.style.display = 'none';
    // Reset fields wherever they live (panel or modal)
    ['evalTitle','evalDescription'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    window.resetClassPicker('evalClassPicker');
    const useDefault = document.getElementById('evalUseDefault');
    if (useDefault) useDefault.checked = true;
    const forceEmail = document.getElementById('evalForceEmail');
    if (forceEmail) forceEmail.checked = false;
    const customStatements = document.getElementById('customStatements');
    if (customStatements) customStatements.innerHTML = '';
    const preview = document.getElementById('defaultStatementsPreview');
    if (preview) preview.style.display = 'none';
    const errorDiv = document.getElementById('releaseEvalError');
    if (errorDiv) errorDiv.style.display = 'none';
};

async function loadEvalClasses(panel = null, showLoader = false) {
    const hideInitialLoader = showLoader && window.showTeacherScopedLoader
        ? window.showTeacherScopedLoader(panel, 'Loading...')
        : null;
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        window.renderClassPicker('evalClassPicker', data, function() {});
    } catch (e) {
        console.error('Failed to load classes', e);
    } finally {
        if (hideInitialLoader) hideInitialLoader();
    }
}

window.toggleDefaultPreview = async function() {
    const preview = document.getElementById('defaultStatementsPreview');
    if (preview.style.display === 'block') {
        preview.style.display = 'none';
        return;
    }

    if (preview.innerHTML === '') {
        try {
            const res  = await fetch('api/teacher/get_default_statements.php');
            const data = await res.json();
            let html   = '<ol class="ev-default-preview-list">';
            data.forEach(s => { html += `<li>${s}</li>`; });
            html += '</ol>';
            preview.innerHTML = html;
        } catch (e) {
            preview.innerHTML = '<p class="ev-default-preview-error">Failed to load.</p>';
        }
    }

    preview.style.display = 'block';
};

window.addCustomStatement = function() {
    const container = document.getElementById('customStatements');
    const count     = container.querySelectorAll('textarea').length;
    const div       = document.createElement('div');
    div.className   = 'ev-custom-statement-row';
    div.innerHTML = `
        <textarea name="statements[${count}]" class="teacher-modal-input ev-form-textarea" rows="2"
            placeholder="Enter custom question..."></textarea>`;
    container.appendChild(div);
};

window.submitReleaseEvaluation = async function() {
    const title      = document.getElementById('evalTitle').value.trim();
    const desc       = document.getElementById('evalDescription').value.trim();
    const classId    = window.getClassPickerValue('evalClassPicker');
    const useDefault = document.getElementById('evalUseDefault').checked;
    // The desktop panel and mobile modal can both exist in the page. Read
    // the visible checkbox so the teacher's selected value is the one sent.
    const forceEmailInput = Array.from(document.querySelectorAll('[id="evalForceEmail"]'))
        .find(input => input.getClientRects().length > 0);
    const forceEmail = Boolean(forceEmailInput?.checked);
    const errorDiv   = document.getElementById('releaseEvalError');
    const submitBtn  = document.getElementById('releaseEvalSubmitBtn');
    const loader     = document.getElementById('loaderOverlay');
    const panel      = document.getElementById('ev-main-panel');
    const isDesktop  = window.innerWidth >= 900 && panel;

    errorDiv.style.display = 'none';

    if (!title)   { errorDiv.textContent = 'Please enter a title.';  errorDiv.style.display = 'block'; return; }
    if (!classId) { errorDiv.textContent = 'Please select a class.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('title',       title);
    fd.append('description', desc);
    fd.append('class_id',    classId);
    if (useDefault)  fd.append('use_default', '1');
    if (forceEmail)  fd.append('force_email', '1');

    // Custom statements
    document.querySelectorAll('#customStatements textarea').forEach((ta, i) => {
        if (ta.value.trim()) fd.append(`statements[${i}]`, ta.value.trim());
    });

    const hideSubmitLoader = window.showTeacherButtonLoader(submitBtn);

    try {
        const res  = await fetch('api/teacher/create_evaluation.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            closeReleaseEvaluationModal();
            window.teacherEvaluationCache = null;
            fetchTeacherEvaluations();
        } else {
            errorDiv.textContent = data.error || 'Failed to release evaluation.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

// ─────────────────────────────────────────────
// DELETE EVALUATION (desktop)
// ─────────────────────────────────────────────
let evaluationToDelete = null;

window.confirmDeleteEvaluation = function(id) {
    evaluationToDelete = id;
    const modal = document.getElementById('deleteEvaluationModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDeleteEvaluationModal = function() {
    evaluationToDelete = null;
    const modal = document.getElementById('deleteEvaluationModal');
    if (modal) modal.style.display = 'none';
};

window.executeDeleteEvaluation = async function() {
    if (!evaluationToDelete) return;
    const idToDelete = evaluationToDelete;
    const deleteButton = document.querySelector('#deleteEvaluationModal .ev-delete-confirm-btn');
    const hideLoader = window.showTeacherButtonLoader(deleteButton);
    closeDeleteEvaluationModal();

    try {
        const fd = new FormData();
        fd.append('id', idToDelete);
        const res  = await fetch('api/teacher/delete_evaluation.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            window.teacherEvaluationCache = null;
            fetchTeacherEvaluations();
        } else {
            alert(data.error || 'Delete failed.');
        }
    } catch (e) {
        alert('Connection error.');
    } finally {
        hideLoader();
    }
};