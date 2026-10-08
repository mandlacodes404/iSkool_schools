function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.teacherGradesCache        = null;
window.teacherGradesCachePromise = null;
window.currentQuizData           = null;
window._teacherGradeQuizCache    = {}; // per-quiz cache: { [quizId]: { type: 'standard'|'open_ended', data } }

// ─────────────────────────────────────────────
// SILENT BACKGROUND PREFETCH
// ─────────────────────────────────────────────
window.prefetchTeacherGrades = function () {
    if (window.teacherGradesCache) return;
    if (window.teacherGradesCachePromise) return;
    window.teacherGradesCachePromise = fetch('api/teacher/get_grades.php')
        .then(res => { if (!res.ok) throw new Error('prefetch failed'); return res.json(); })
        .then(data => { window.teacherGradesCache = data; })
        .catch(() => {})
        .finally(() => { window.teacherGradesCachePromise = null; });
};

// ─────────────────────────────────────────────
// GRADES LIST
// ─────────────────────────────────────────────
window.fetchTeacherGrades = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_grades");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_grades");

    // Reset header chrome back to standard mode. Needed whether this is
    // the initial load (no-op, already standard) or a return trip from
    // the mobile detail page (back button, hidden bottom nav) via
    // handleTeacherHeaderBack's 'Grade' branch.
    if (typeof window.configureTeacherHeader === 'function') {
        window.configureTeacherHeader({ mode: 'standard', color: '#22c55e' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherGradesCache) {
        renderTeacherGrades(window.teacherGradesCache);
        return;
    }

    try {
        // Keep one request in flight so repeated taps cannot fetch Grades twice.
        if (!window.teacherGradesCachePromise) {
            window.teacherGradesCachePromise = fetch('api/teacher/get_grades.php')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    window.teacherGradesCache = data;
                    return data;
                })
                .finally(() => {
                    window.teacherGradesCachePromise = null;
                });
        }

        const data = await window.teacherGradesCachePromise;
        renderTeacherGrades(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p class="gr-error-message">
                Error loading grades.
            </p>`;
    }
};

// Track active quiz for desktop panel
window._activeDesktopGradeQuizId = null;

function renderTeacherGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Collect all quizzes flat for desktop panel lookup ──
    window._allGradesQuizzesFlat = [];
    if (data && data.length > 0) {
        data.forEach(termData => {
            termData.classes.forEach(cls => {
                cls.quizzes.forEach(quiz => {
                    window._allGradesQuizzesFlat.push({ ...quiz, class_name: cls.class_name, term: termData.term });
                });
            });
        });
    }

    // ── Build left sidebar list ──
    let sidebarHtml = '';
    if (!data || data.length === 0) {
        sidebarHtml = `<p class="gr-empty-state-inline">No assessments found.</p>`;
    } else {
        data.forEach(termData => {
            sidebarHtml += `<div class="gr-sidebar-term-label">TERM ${termData.term}</div>`;
            termData.classes.forEach((cls, clsIdx) => {
                const classGroupId = `gr-class-group-${termData.term}-${clsIdx}`;
                let itemsHtml = '';
                cls.quizzes.forEach(quiz => {
                    itemsHtml += `
                        <div class="gr-sidebar-item" id="gr-sidebar-${quiz.id}"
                            onclick="selectDesktopGradeQuiz(${quiz.id})">
                            <div class="gr-sidebar-item-icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </div>
                            <div class="gr-sidebar-item-info">
                                <div class="gr-sidebar-item-title">${escapeHtml(quiz.title)}</div>
                                <div class="gr-sidebar-item-meta">${escapeHtml(quiz.created_at)}</div>
                            </div>
                        </div>`;
                });
                sidebarHtml += window.buildCollapsibleClassGroup(
                    classGroupId,
                    'gr-sidebar-class-label',
                    escapeHtml(cls.class_name),
                    itemsHtml
                );
            });
        });
    }

    let html = `
        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="gr-desktop-layout tchr-flat-layout">
            <!-- Left Sidebar -->
            <div class="gr-sidebar tchr-flat-sidebar">
                <div class="gr-sidebar-header">
                    <span>Assessments</span>
                    <button class="teacher-upload-btn teacher-desktop-create gr-new-btn" id="gr-new-btn" onclick="openAddQuizModal()">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New
                    </button>
                </div>
                <div class="gr-sidebar-scroll">
                    ${sidebarHtml}
                </div>
            </div>

            <!-- Right Panel -->
            <div class="gr-main-panel tchr-flat-panel" id="gr-main-panel">
                ${grEmptyStateHtml()}
            </div>

            <!-- railId lets renderGradesInPanel()/renderOpenEndedGrades()
                 swap this to selection-specific copy via updateInfoRail(). -->
            ${typeof buildInfoRail === 'function' ? buildInfoRail('About Grades', `
                <p>Marks stay hidden from learners until you toggle <strong>Publish Marks</strong> for that assessment.</p>
                <p>Use <strong>Progress Report</strong> in the sidebar footer to generate a printable term summary for the whole class.</p>
            `, 'gr-rail') : ''}
        </div>

        <!-- ═══ MOBILE LIST ═══ -->
        <div class="gr-mobile-list">
            ${window.buildTeacherSearchBar('gr', { mobile: true, placeholder: 'Search assessments...' })}
            <div class="teacher-grades-info gr-mobile-info-pill">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="#22c55e" stroke-width="2" fill="none" class="gr-info-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Click any assessment to view learner grades.</span>
            </div>`;

    if (!data || data.length === 0) {
        html += `<p class="teacher-empty-state">No assessments found.</p>`;
    } else {
        data.forEach(termData => {
            html += `<div class="teacher-term-divider gr-mobile-term-pill">Term ${termData.term}</div>`;

            termData.classes.forEach((cls, clsIdx) => {
                // Separate id namespace from desktop's gr-class-group-{term}-{idx}
                // so mobile folder collapse-state / DOM ids never collide with the
                // desktop sidebar's groups when both happen to be in the DOM
                // during a resize.
                const mobileGroupId = `gr-mobile-class-group-${termData.term}-${clsIdx}`;
                let itemsHtml = '';

                cls.quizzes.forEach(quiz => {
                    itemsHtml += `
                        <div class="gr-mobile-row" data-quiz-id="${quiz.id}" data-title="${escapeHtml(quiz.title)}" role="button" tabindex="0"
                            onclick="openMobileTeacherGradeQuiz(${quiz.id})"
                            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMobileTeacherGradeQuiz(${quiz.id});}">
                            <div class="gr-mobile-row-icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#22c55e" stroke-width="1.2" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                            </div>
                            <div class="gr-mobile-row-body">
                                <div class="gr-mobile-row-title">${escapeHtml(quiz.title)}</div>
                                <div class="gr-mobile-row-meta">${escapeHtml(quiz.created_at)}</div>
                            </div>
                            <div class="gr-mobile-row-chevron">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </div>
                        </div>`;
                });

                const folderIcon = `
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gr-mobile-folder-icon">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>`;

                html += window.buildCollapsibleClassGroup(
                    mobileGroupId,
                    'gr-mobile-folder-label',
                    `${folderIcon}<span class="gr-mobile-folder-name">${escapeHtml(cls.class_name)}</span><span class="gr-mobile-folder-count">${cls.quizzes.length}</span>`,
                    itemsHtml
                );
            });
        });
    }

    html += `</div>`;

    apiArea.innerHTML = html;
    if (typeof injectSharedTeacherDesktopLayoutStyles === 'function') injectSharedTeacherDesktopLayoutStyles();
    window.wireTeacherSearchBar('gr');

    // Restore whichever quiz was selected before navigating away, and
    // the sidebar's scroll position, so switching back to Grades looks
    // exactly as the teacher left it instead of resetting to empty.
    const sidebarScrollEl = apiArea.querySelector('.gr-sidebar-scroll');
    window.wireTeacherSectionScroll('grades-sidebar', sidebarScrollEl);
    window.restoreTeacherScrollState('grades-sidebar', sidebarScrollEl);

    // An assessment was just added through the form: open it straight away so
    // the teacher can start entering marks (it is matched by title + class,
    // taking the newest if there are several).
    const pending = window._grPendingSelect;
    window._grPendingSelect = null;
    let pendingId = null;
    if (pending) {
        const hits = window._allGradesQuizzesFlat.filter(q => q.title === pending.title && q.class_name === pending.className);
        if (hits.length) pendingId = Math.max(...hits.map(q => Number(q.id)));
    }
    if (pendingId != null) {
        selectDesktopGradeQuiz(pendingId).then(() => grFocusFirstAddMarks());
        return;
    }

    const savedQuizId = window.teacherSectionState.selection.grades;
    if (savedQuizId && window._allGradesQuizzesFlat.some(q => q.id == savedQuizId)) {
        selectDesktopGradeQuiz(savedQuizId);
    }
}

// ── DESKTOP PANEL: SELECT QUIZ ───────────────────────────────────────────────
// ─────────────────────────────────────────────
// DESKTOP PANEL HELPERS
// (desktop only: the mobile views keep their own markup and styles)
// ─────────────────────────────────────────────
function grDpIcon(name, size) {
    const paths = {
        plus:  '<path d="M12 5v14M5 12h14"/>',
        check: '<path d="M20 6 9 17l-5-5"/>'
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function grPlural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function grToast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
}

// Same bands as getGradeBadgeClass: 75+ / 50-74 / below 50.
function grBand(p) { return p >= 75 ? 'hi' : p >= 50 ? 'mid' : 'lo'; }
function grBandColor(band) {
    return band === 'hi' ? '#1ed760' : band === 'mid' ? '#4fd1c5' : band === 'lo' ? '#e74c3c' : 'rgba(255,255,255,0.095)';
}

/** Whole-number percentage for a learner, or null if no mark is recorded.
 * Prefers the server's own figure, since that is what learners see. */
function grPercent(l) {
    if (l.score === null || l.score === undefined || l.score === '') return null;
    const server = parseFloat(l.percentage);
    if (Number.isFinite(server)) return Math.round(server);
    const s = parseFloat(l.score), t = parseFloat(l.total);
    return Number.isFinite(s) && t > 0 ? Math.round((s / t) * 100) : null;
}

function grQuizMeta(quizId) {
    return (window._allGradesQuizzesFlat || []).find(q => String(q.id) === String(quizId)) || {};
}

function grEmptyStateHtml() {
    const count = (window._allGradesQuizzesFlat || []).length;
    const title = count ? 'Pick an assessment' : 'No assessments yet';
    const body  = count
        ? `${grPlural(count, 'assessment')} across your classes. Choose one to enter marks or grade responses.`
        : 'Add one to record marks for a paper test, an oral, or anything captured outside iSkool.';
    return `
        <div class="gr-dp-empty">
            <h2 class="gr-dp-empty-title">${title}</h2>
            <p class="gr-dp-empty-body">${body}</p>
            <button type="button" class="gr-dp-btn gr-dp-btn--primary" onclick="openAddQuizModal()">
                ${grDpIcon('plus', 14)}Add an assessment
            </button>
        </div>`;
}

function grFocusFirstAddMarks() {
    const btn = document.querySelector('#gr-main-panel [data-gr="edit"]');
    if (btn) btn.focus();
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT ASSESSMENT
// ─────────────────────────────────────────────
window.selectDesktopGradeQuiz = async function(quizId) {
    document.querySelectorAll('.gr-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`gr-sidebar-${quizId}`);
    if (sidebarItem) sidebarItem.classList.add('active');
    const newBtn = document.getElementById('gr-new-btn');
    if (newBtn) newBtn.classList.remove('active');

    // A different assessment starts with fresh view state.
    if (String(window._activeDesktopGradeQuizId) !== String(quizId)) {
        window._grFilter = 'all';
        window._grOeFilter = 'all';
        window._grEdit = null;
        window._grOpenLearners = new Set();
    }
    window._grPrevQuizId = null;
    window._activeDesktopGradeQuizId = quizId;
    window.teacherSectionState.selection.grades = quizId;
    window.persistTeacherSectionState();

    const panel = document.getElementById('gr-main-panel');
    if (!panel) return;
    panel.onclick = panel.oninput = panel.onkeydown = panel.onmouseover = panel.onmouseleave = null;

    // Already fetched this assessment this session: render instantly.
    const cached = window._teacherGradeQuizCache[quizId];
    if (cached) {
        if (cached.type === 'open_ended') {
            window.currentOpenEndedQuizData = cached.data;
            renderOpenEndedGrades(cached.data, panel, true);
        } else {
            window.currentQuizData = cached.data;
            renderGradesInPanel(cached.data, panel);
        }
        return;
    }

    panel.innerHTML = `
        <div class="gr-dp-empty" role="status">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="#4fd1c5" stroke-width="2" fill="none"
                class="gr-panel-loading-spinner" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p class="gr-dp-empty-body">Loading grades&hellip;</p>
        </div>`;

    try {
        // Both requests are independent, so they run together.
        const [data, resultPayload] = await Promise.all([
            fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`).then(r => r.json()),
            fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
                headers: { 'X-CSRF-Token': getCsrfToken() }
            }).then(r => r.json())
        ]);
        if (data.error) throw new Error(data.error);
        // The teacher moved on while this was loading: do not overwrite what they are looking at.
        if (String(window._activeDesktopGradeQuizId) !== String(quizId)) return;

        const resultData = normalizeQuizResultsPayload(resultPayload);
        if (resultData && resultData.has_open_ended == 1) {
            window.currentOpenEndedQuizData = resultData;
            window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: resultData };
            renderOpenEndedGrades(resultData, panel, true);
        } else {
            window.currentQuizData = data;
            window._teacherGradeQuizCache[quizId] = { type: 'standard', data: data };
            renderGradesInPanel(data, panel);
        }
    } catch (e) {
        if (String(window._activeDesktopGradeQuizId) !== String(quizId)) return;
        panel.innerHTML = `
            <div class="gr-dp-empty">
                <h2 class="gr-dp-empty-title">Couldn't load grades</h2>
                <p class="gr-dp-empty-body">Check your connection and try again.</p>
                <button type="button" class="gr-dp-btn" onclick="selectDesktopGradeQuiz(${Number(quizId)})">Try again</button>
            </div>`;
    }
};

// ─────────────────────────────────────────────
// STANDARD ASSESSMENT PANEL (marks entry, inline editing)
// ─────────────────────────────────────────────
function grDefaultTotal(learners) {
    // Most teachers mark everyone out of the same total, so a learner with no mark
    // yet is offered the total already used for this assessment (else 100).
    const tally = {};
    learners.forEach(l => {
        if (l.score === null || l.score === undefined || l.score === '') return;
        const t = parseFloat(l.total);
        if (Number.isFinite(t) && t > 0) tally[t] = (tally[t] || 0) + 1;
    });
    const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    return best !== undefined ? parseFloat(best) : 100;
}

function grStatsHtml(learners) {
    const pcts = learners.map(grPercent).filter(p => p !== null);
    if (!pcts.length) {
        return `<p class="gr-dp-nomarks">No marks recorded yet. Choose <b>Add marks</b> beside a learner to start.</p>`;
    }
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const counts = { hi: 0, mid: 0, lo: 0, none: 0 };
    learners.forEach(l => { const p = grPercent(l); counts[p === null ? 'none' : grBand(p)]++; });
    const items = [
        ['hi',   '75% and above', grBandColor('hi')],
        ['mid',  '50 to 74%',     grBandColor('mid')],
        ['lo',   'Below 50%',     grBandColor('lo')],
        ['none', 'Not recorded',  grBandColor('none')]
    ];
    const segs = items.map(([k, label, col], i) => counts[k]
        ? `<i data-k="${i}" style="--g:${counts[k]};--c:${col};" title="${label}: ${counts[k]}"></i>` : '').join('');
    const legend = items.map(([k, label, col], i) => `
        <li data-k="${i}" class="${counts[k] ? '' : 'is-zero'}" style="--c:${col};">
            <span class="gr-dp-sq"></span>${label}<span class="gr-dp-ct">${counts[k]}</span>
        </li>`).join('');
    const aria = items.map(([k, label]) => `${label} ${counts[k]}`).join(', ');
    return `
        <div class="gr-dp-stats">
            <div><b>${avg}%</b><span>Class average</span></div>
            <div><b>${Math.max(...pcts)}%</b><span>Highest</span></div>
            <div><b>${Math.min(...pcts)}%</b><span>Lowest</span></div>
        </div>
        <div class="gr-dp-dist">
            <div class="gr-dp-dbar" role="img" aria-label="${escapeHtml(aria)}">${segs}</div>
            <ul class="gr-dp-dlg">${legend}</ul>
        </div>`;
}

function grStdRowsHtml(data) {
    const learners = data.learners || [];
    const filter = window._grFilter || 'all';
    const list = learners.filter(l => filter === 'all' || l.score === null || l.score === undefined);
    if (!list.length) {
        return `<tr><td colspan="4" class="gr-dp-table-empty">${filter === 'out' ? 'Every learner has a mark.' : 'No learners found in this class.'}</td></tr>`;
    }
    const defaultTotal = grDefaultTotal(learners);
    return list.map(l => {
        const p = grPercent(l);
        const email = escapeHtml(l.email);
        const name = escapeHtml(l.name);
        const pcHtml = p === null
            ? '<span class="gr-dp-mut">&mdash;</span>'
            : `<span class="gr-dp-pc"><i class="gr-dp-dot" style="--c:${grBandColor(grBand(p))};"></i>${p}%</span>`;

        if (window._grEdit !== null && String(window._grEdit) === String(l.email)) {
            const total = formatOpenEndedScore(l.total !== null && l.total !== undefined && l.total !== '' ? l.total : defaultTotal);
            return `
                <tr data-email="${email}">
                    <td class="gr-dp-nm">${name}</td>
                    <td><span class="gr-dp-ed">
                        <input class="gr-dp-in gr-dp-in--s gr-dp-ed-in" id="gr-e-score" type="number" min="0" step="0.01"
                            value="${escapeHtml(formatOpenEndedScore(l.score))}" placeholder="0" aria-label="Score for ${name}">
                        /
                        <input class="gr-dp-in gr-dp-in--s gr-dp-ed-in" id="gr-e-total" type="number" min="0" step="0.01"
                            value="${escapeHtml(total)}" aria-label="Total marks">
                    </span></td>
                    <td><span class="gr-dp-pc" id="gr-e-pc">${pcHtml}</span></td>
                    <td>
                        <button type="button" class="gr-dp-btn gr-dp-btn--sm gr-dp-btn--ghost" data-gr="cancel">Cancel</button>
                        <button type="button" class="gr-dp-btn gr-dp-btn--sm gr-dp-btn--primary" data-gr="save" data-email="${email}">Save</button>
                    </td>
                </tr>
                <tr class="gr-dp-er" id="gr-e-er" hidden><td colspan="4"></td></tr>`;
        }

        const recorded = l.score !== null && l.score !== undefined && l.score !== '';
        const flash = window._grFlash && String(window._grFlash) === String(l.email) ? ' is-flash' : '';
        return `
            <tr class="${flash.trim()}" data-email="${email}">
                <td class="gr-dp-nm">${name}</td>
                <td>${recorded
                    ? `${escapeHtml(formatOpenEndedScore(l.score))} / ${escapeHtml(formatOpenEndedScore(l.total))}`
                    : '<span class="gr-dp-mut">Not recorded</span>'}</td>
                <td>${pcHtml}</td>
                <td><button type="button" class="gr-dp-btn gr-dp-btn--sm gr-dp-btn--ghost" data-gr="edit" data-email="${email}">${recorded ? 'Edit' : 'Add marks'}</button></td>
            </tr>`;
    }).join('');
}

function grUpdateStandardRail(data) {
    if (typeof updateInfoRail !== 'function') return;
    const learners = data.learners || [];
    const ungraded = learners.filter(l => l.score === null || l.score === undefined).length;
    if (ungraded > 0) {
        updateInfoRail('gr-rail', 'Grading In Progress', `
            <p><strong>${ungraded}</strong> of ${learners.length} learners still have no score recorded for ${escapeHtml(data.quiz_title)}.</p>
            <p>Marks stay hidden from learners until you toggle <strong>Publish Marks</strong> for this assessment.</p>
        `);
    } else {
        updateInfoRail('gr-rail', 'Fully Graded', `
            <p>Every learner in this class has a recorded score for ${escapeHtml(data.quiz_title)}.</p>
            <p>Toggle <strong>Publish Marks</strong> when you're ready for learners to see their results.</p>
        `);
    }
}

function renderGradesInPanel(data, panel) {
    const learners = data.learners || [];
    const quizId = data.quiz_id != null ? data.quiz_id : window._activeDesktopGradeQuizId;
    const same = String(panel.dataset.grQuiz) === String(quizId);
    const keepTop = same ? panel.scrollTop : 0;
    panel.dataset.grQuiz = quizId;
    window.currentQuizData = data;

    const meta = grQuizMeta(quizId);
    const recorded = learners.filter(l => l.score !== null && l.score !== undefined).length;
    const filter = window._grFilter || 'all';

    panel.innerHTML = `
        <div class="gr-dp${same ? ' gr-dp--still' : ''}">
            <p class="gr-dp-crumb">${escapeHtml(meta.class_name || '')}${meta.term ? ` &middot; Term ${escapeHtml(meta.term)}` : ''}</p>
            <h2 class="gr-dp-title">${escapeHtml(data.quiz_title)}</h2>
            <div class="gr-dp-meta">
                <span class="gr-dp-pill" id="gr-std-pill">${recorded} of ${learners.length} recorded</span>
                ${meta.created_at ? `<span>Created ${escapeHtml(meta.created_at)}</span>` : ''}
            </div>
            ${learners.length ? `
            <div id="gr-std-top">${grStatsHtml(learners)}</div>
            <section class="gr-dp-section">
                <h3 class="gr-dp-h">Learners</h3>
                <div class="gr-dp-tools">
                    <div class="gr-dp-seg" id="gr-std-filter" role="group" aria-label="Filter learners">
                        <button type="button" data-gr="filter" data-filter="all" aria-pressed="${filter === 'all'}">All ${learners.length}</button>
                        <button type="button" data-gr="filter" data-filter="out" aria-pressed="${filter === 'out'}">Not recorded ${learners.length - recorded}</button>
                    </div>
                </div>
                <table class="gr-dp-table" aria-label="Learner marks">
                    <colgroup><col class="gr-dp-c-name"><col class="gr-dp-c-score"><col class="gr-dp-c-pct"><col></colgroup>
                    <thead><tr><th scope="col">Learner</th><th scope="col">Score</th><th scope="col">Percentage</th><th scope="col"><span class="gr-dp-sr">Action</span></th></tr></thead>
                    <tbody id="gr-std-rows">${grStdRowsHtml(data)}</tbody>
                </table>
            </section>` : `<p class="gr-dp-nomarks">No learners found in this class.</p>`}
        </div>`;

    panel.scrollTop = keepTop;
    grWireStandard(panel);
    grUpdateStandardRail(data);
}

/** Redraws only the parts that change, so the scroll position and the page never jump. */
function grRefreshStandard() {
    const data = window.currentQuizData;
    if (!data) return;
    const learners = data.learners || [];
    const top = document.getElementById('gr-std-top');
    const rows = document.getElementById('gr-std-rows');
    if (!top || !rows) return;
    const recorded = learners.filter(l => l.score !== null && l.score !== undefined).length;
    top.innerHTML = grStatsHtml(learners);
    rows.innerHTML = grStdRowsHtml(data);
    const pill = document.getElementById('gr-std-pill');
    if (pill) pill.textContent = `${recorded} of ${learners.length} recorded`;
    const filter = window._grFilter || 'all';
    document.querySelectorAll('#gr-std-filter button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
    });
    const outBtn = document.querySelector('#gr-std-filter [data-filter="out"]');
    if (outBtn) outBtn.textContent = `Not recorded ${learners.length - recorded}`;
    grUpdateStandardRail(data);
}

function grWireStandard(panel) {
    panel.onclick = function(e) {
        const b = e.target.closest('[data-gr]');
        if (!b || !panel.contains(b)) return;
        const act = b.dataset.gr;
        if (act === 'filter') {
            window._grFilter = b.dataset.filter;
            window._grEdit = null;
            grRefreshStandard();
        } else if (act === 'edit') {
            window._grEdit = b.dataset.email;
            grRefreshStandard();
            const sc = document.getElementById('gr-e-score');
            if (sc) { sc.focus(); sc.select(); }
        } else if (act === 'cancel') {
            const email = window._grEdit;
            window._grEdit = null;
            grRefreshStandard();
            const back = Array.from(document.querySelectorAll('#gr-std-rows [data-gr="edit"]')).find(x => x.dataset.email === email);
            if (back) back.focus();
        } else if (act === 'save') {
            grSaveRow(b.dataset.email);
        }
    };
    // live percentage while typing
    panel.oninput = function(e) {
        if (!e.target.classList || !e.target.classList.contains('gr-dp-ed-in')) return;
        const sc = document.getElementById('gr-e-score'), tt = document.getElementById('gr-e-total');
        const pc = document.getElementById('gr-e-pc'), er = document.getElementById('gr-e-er');
        const s = parseFloat(sc.value), t = parseFloat(tt.value);
        const p = Number.isFinite(s) && t > 0 ? Math.round((s / t) * 100) : null;
        if (pc) pc.innerHTML = p === null ? '<span class="gr-dp-mut">&mdash;</span>'
            : `<span class="gr-dp-pc"><i class="gr-dp-dot" style="--c:${grBandColor(grBand(p))};"></i>${p}%</span>`;
        if (er) er.hidden = true;
    };
    panel.onkeydown = function(e) {
        if (!e.target.classList || !e.target.classList.contains('gr-dp-ed-in')) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            const save = document.querySelector('#gr-std-rows [data-gr="save"]');
            if (save) grSaveRow(save.dataset.email);
        } else if (e.key === 'Escape') {
            const cancel = document.querySelector('#gr-std-rows [data-gr="cancel"]');
            if (cancel) cancel.click();
        }
    };
    // hover a bar segment or a legend item: that band lights up in both
    const clear = () => panel.querySelectorAll('.gr-dp-dist.is-hl').forEach(q => {
        q.classList.remove('is-hl');
        q.querySelectorAll('.is-on').forEach(x => x.classList.remove('is-on'));
    });
    panel.onmouseover = function(e) {
        clear();
        const t = e.target.closest ? e.target.closest('.gr-dp-dist [data-k]') : null;
        if (!t) return;
        const q = t.closest('.gr-dp-dist');
        q.classList.add('is-hl');
        q.querySelectorAll(`[data-k="${t.dataset.k}"]`).forEach(x => x.classList.add('is-on'));
    };
    panel.onmouseleave = clear;
}

async function grSaveRow(email) {
    const data = window.currentQuizData;
    if (!data) return;
    const quizId = data.quiz_id != null ? data.quiz_id : window._activeDesktopGradeQuizId;
    const scoreEl = document.getElementById('gr-e-score');
    const totalEl = document.getElementById('gr-e-total');
    const er = document.getElementById('gr-e-er');
    if (!scoreEl || !totalEl) return;

    const fail = msg => { if (er) { er.hidden = false; er.firstElementChild.textContent = msg; } };
    const score = scoreEl.value.trim(), total = totalEl.value.trim();
    if (score === '') return fail('Please enter a score.');
    if (parseFloat(score) < 0) return fail("The score can't be negative.");
    if (!total || !(parseFloat(total) > 0)) return fail('Please enter the total.');

    const fd = new FormData();
    fd.append('quiz_id',    quizId);
    fd.append('user_email', email);
    fd.append('score',      score);
    fd.append('total',      total);
    const learner = (data.learners || []).find(l => String(l.email) === String(email));
    if (learner && learner.result_id) fd.append('result_id', learner.result_id);

    const saveBtn = document.querySelector('#gr-std-rows [data-gr="save"]');
    const hideLoader = window.showTeacherButtonLoader(saveBtn);
    try {
        const res = await fetch('api/teacher/save_marks.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const result = await res.json();
        if (!result.success) { fail(result.error || 'Failed to save marks.'); return; }

        // Re-read the grades so the percentage matches what learners will see.
        let fresh = null;
        try {
            const r2 = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
            const f = await r2.json();
            if (f && !f.error && Array.isArray(f.learners)) fresh = f;
        } catch (_) { /* fall back to the local update below */ }

        const idx = (data.learners || []).findIndex(l => String(l.email) === String(email));
        if (fresh) {
            window._teacherGradeQuizCache[quizId] = { type: 'standard', data: fresh };
            window.currentQuizData = fresh;
        } else if (idx !== -1) {
            data.learners[idx].score = parseFloat(score);
            data.learners[idx].total = parseFloat(total);
            data.learners[idx].percentage = null;
            delete window._teacherGradeQuizCache[quizId];   // so the next visit re-reads it
        }

        window._grEdit = null;
        window._grFlash = email;
        grRefreshStandard();
        setTimeout(() => { window._grFlash = null; }, 1500);
        grToast('Marks saved');

        // Fast data entry: land on the next learner who still has no mark.
        const learners = (window.currentQuizData.learners || []);
        const here = learners.findIndex(l => String(l.email) === String(email));
        const next = learners.find((l, i) => i > here && (l.score === null || l.score === undefined));
        if (next && (window._grFilter || 'all') === 'all') {
            const btn = Array.from(document.querySelectorAll('#gr-std-rows [data-gr="edit"]')).find(x => x.dataset.email === String(next.email));
            if (btn) btn.focus();
        }
    } catch (e) {
        fail('Connection error. Please try again.');
    } finally {
        hideLoader();
    }
}

// Edit marks inline within the desktop panel
window.openEditMarksInPanel = function(email, name, quizId, quizTitle, currentScore, currentTotal) {
    const panel = document.getElementById('gr-main-panel');
    if (!panel) return;

    const scoreVal = currentScore !== null ? currentScore : '';
    const totalVal = currentTotal !== null ? currentTotal : 100;

    panel.innerHTML = `
        <div class="gr-panel-content">
            <div class="gr-panel-header gr-panel-header--with-back">
                <button onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))"
                    class="gr-back-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Back
                </button>
                <div>
                    <div class="gr-panel-title">Edit Marks</div>
                    <div class="gr-panel-meta">${escapeHtml(name)} &bull; ${escapeHtml(quizTitle)}</div>
                </div>
            </div>

            <div class="teacher-edit-marks-box">
                <label class="teacher-modal-label">Score Received</label>
                <input type="number" step="0.01" id="editScore" class="teacher-modal-input"
                    value="${escapeHtml(scoreVal)}" placeholder="e.g. 15">

                <label class="teacher-modal-label gr-form-label-spaced">Maximum Possible Score</label>
                <input type="number" step="0.01" id="editTotal" class="teacher-modal-input"
                    value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

                <div id="editMarksError" class="gr-form-error"></div>
                <div id="editMarksSuccess" class="gr-form-success"></div>

                <div class="gr-form-actions">
                    <button class="teacher-modal-cancel gr-form-cancel-btn"
                        onclick="renderGradesInPanel(window.currentQuizData, document.getElementById('gr-main-panel'))">Cancel</button>
                    <button class="teacher-modal-submit gr-form-submit-btn"
                        id="saveMarksBtn"
                        data-email="${escapeHtml(email)}" data-quiz-id="${quizId}"
                        onclick="saveMarksFromElement(this)">
                        Save Marks
                    </button>
                </div>
            </div>
        </div>`;
};

// ─────────────────────────────────────────────
// QUIZ GRADES VIEW (mobile detail page — view only)
// ─────────────────────────────────────────────
// Mobile grading/editing was deliberately removed: teachers view marks
// on mobile but grade and edit only on desktop. This mirrors
// Assignments' detail-page navigation (configureTeacherHeader +
// handleTeacherHeaderBack) but renders read-only content — no Edit
// buttons, no open-ended grading form, no publish/unpublish toggle.
window.openMobileTeacherGradeQuiz = async function(quizId) {
    if (window.innerWidth > 899) return; // mobile-only guard, same convention as Assignments
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    window.teacherSectionState.selection.grades = quizId;
    window.persistTeacherSectionState();

    apiArea.innerHTML = `
        <div class="gr-panel-empty">
            <svg viewBox="0 0 24 24" width="30" height="30" stroke="#4fd1c5" stroke-width="2" fill="none"
                class="gr-panel-loading-spinner">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
            </svg>
            <p>Loading grades...</p>
        </div>`;

    try {
        // Reuse the same cache desktop already fills — no separate mobile
        // cache, same as Assignments unifying its flat array.
        const cached = window._teacherGradeQuizCache[quizId];
        if (cached) {
            renderMobileGradeDetail(cached.type, cached.data, apiArea);
            return;
        }

        const res  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const resultRes = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
            headers: { 'X-CSRF-Token': getCsrfToken() }
        });
        const resultPayload = await resultRes.json();
        const resultData = normalizeQuizResultsPayload(resultPayload);

        if (resultData && resultData.has_open_ended == 1) {
            window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: resultData };
            renderMobileGradeDetail('open_ended', resultData, apiArea);
        } else {
            window._teacherGradeQuizCache[quizId] = { type: 'standard', data: data };
            renderMobileGradeDetail('standard', data, apiArea);
        }
    } catch (e) {
        apiArea.innerHTML = `<div class="gr-panel-empty"><p class="gr-panel-error-text">Error loading grades.</p></div>`;
    }
};

function renderMobileGradeDetail(type, data, apiArea) {
    window.configureTeacherHeader({
        title: data.quiz_title || 'Assessment',
        mode: 'detail',
        detailType: 'Grade',
        backLabel: 'Grades',
        color: '#22c55e'
    });

    if (type === 'open_ended') {
        renderMobileOpenEndedGrades(data, apiArea);
    } else {
        renderMobileStandardGrades(data, apiArea);
    }
}

// Read-only table: same columns as the desktop/legacy table minus the
// Edit column entirely (not just visually hidden, since mobile never
// calls openEditMarksFromElement at all).
function renderMobileStandardGrades(data, apiArea) {
    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div class="gr-panel-title">${escapeHtml(data.quiz_title)}</div>
                <div class="gr-panel-meta">${data.learners.length} learner${data.learners.length !== 1 ? 's' : ''}</div>
            </div>`;

    if (data.learners.length === 0) {
        html += `<p class="teacher-empty-state">No learners found in this class.</p>`;
    } else {
        html += `<div class="teacher-grades-table-wrapper">
            <table class="teacher-grades-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>`;

        data.learners.forEach(learner => {
            const score = learner.score !== null
                ? `${escapeHtml(learner.score)} / ${escapeHtml(learner.total)}`
                : '<span class="gr-cell-muted">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span class="gr-cell-muted">—</span>';

            html += `
                <tr>
                    <td>${escapeHtml(learner.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    apiArea.innerHTML = html;
}

// Read-only open-ended summary: score/status per learner only. No
// per-learner accordion (that only ever housed the grading form), no
// Release/Unpublish toggle.
function renderMobileOpenEndedGrades(data, apiArea) {
    const results = data.results || [];
    const fullyGraded = data.quiz_fully_graded === true || data.quiz_fully_graded === 1;

    let html = `
        <div class="gr-panel-content">
            <div class="gr-panel-header">
                <div>
                    <div class="gr-panel-title">${escapeHtml(data.quiz_title || 'Assessment Results')}</div>
                    <div class="gr-panel-meta">${results.length} submitted learner${results.length !== 1 ? 's' : ''}</div>
                </div>
            </div>`;

    if (results.length === 0) {
        html += `<p class="teacher-empty-state">No submitted attempts found for this assessment.</p>`;
    } else {
        results.forEach(learner => {
            const openQuestions = learner.open_ended || [];
            const pendingCount = openQuestions.filter(question => !question.grade).length;
            const scoreDisplay = data.has_open_ended == 1 && !fullyGraded
                ? '***'
                : escapeHtml(learner.score ?? '0');
            const badge = learner.is_fully_graded
                ? `<span class="gr-oe-badge gr-oe-badge--graded">Fully Graded</span>`
                : `<span class="gr-oe-badge gr-oe-badge--pending">Pending ${pendingCount} question${pendingCount !== 1 ? 's' : ''}</span>`;

            html += `
                <div class="gr-oe-learner-card">
                    <div class="gr-oe-learner-card-top">
                        <div>
                            <div class="gr-oe-learner-name">${escapeHtml(learner.name || learner.user_email || 'Learner')}</div>
                            <div class="gr-oe-learner-score">Score: ${scoreDisplay} / ${escapeHtml(learner.total ?? '0')}</div>
                        </div>
                        <div class="gr-oe-learner-actions">
                            ${badge}
                        </div>
                    </div>
                </div>`;
        });
    }

    html += `</div>`;
    apiArea.innerHTML = html;
}

function renderQuizGrades(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    let html = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn" onclick="fetchTeacherGrades()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Grades
            </button>
        </div>

        <h3 class="teacher-quiz-grades-title">${escapeHtml(data.quiz_title)}</h3>
        <p class="teacher-quiz-grades-meta">${data.learners.length} learner${data.learners.length !== 1 ? 's' : ''}</p>`;

    if (data.learners.length === 0) {
        html += `<p class="teacher-empty-state">No learners found in this class.</p>`;
    } else {
        html += `<div class="teacher-grades-table-wrapper">
            <table class="teacher-grades-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Edit</th>
                    </tr>
                </thead>
                <tbody>`;

        data.learners.forEach(learner => {
            const score = learner.score !== null
                ? `${escapeHtml(learner.score)} / ${escapeHtml(learner.total)}`
                : '<span class="gr-cell-muted">Not recorded</span>';
            const perc  = learner.percentage
                ? `<span class="teacher-grade-badge ${getGradeBadgeClass(learner.percentage)}">${escapeHtml(learner.percentage)}</span>`
                : '<span class="gr-cell-muted">—</span>';

            html += `
                <tr>
                    <td>${escapeHtml(learner.name)}</td>
                    <td>${score}</td>
                    <td>${perc}</td>
                    <td>
                        <button class="teacher-edit-marks-btn" 
                            data-email="${escapeHtml(learner.email)}" data-name="${escapeHtml(learner.name)}" data-quiz-id="${data.quiz_id}" data-quiz-title="${escapeHtml(data.quiz_title)}" data-score="${escapeHtml(learner.score ?? '')}" data-total="${escapeHtml(learner.total ?? 100)}"
                            onclick="openEditMarksFromElement(this)">
                            Edit
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
    }

    apiArea.innerHTML = html;
}

function normalizeQuizResultsPayload(payload) {
    if (!payload) return null;
    if (payload.status === 'error' || payload.error) return null;
    return payload.data || payload;
}

function formatOpenEndedScore(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toString() : '';
}

// ─────────────────────────────────────────────
// OPEN-ENDED GRADING PANEL
// ─────────────────────────────────────────────
function renderOpenEndedGrades(data, target, isPanel) {
    if (!target) return;
    // Anything outside the desktop panel keeps the original renderer.
    if (!isPanel) return renderOpenEndedGradesClassic(data, target, false);
    renderOpenEndedPanel(data, target);
}

function grOeRowsHtml(data) {
    const results = data.results || [];
    const filter = window._grOeFilter || 'all';
    const open = window._grOpenLearners || new Set();
    const list = results.filter(r => filter === 'all' || !r.is_fully_graded);
    if (!results.length) return `<div class="gr-dp-lr"><div class="gr-dp-lrt gr-dp-lrt--note">No submitted attempts found for this assessment.</div></div>`;
    if (!list.length) return `<div class="gr-dp-lr"><div class="gr-dp-lrt gr-dp-lrt--note">Everyone is fully graded.</div></div>`;

    return list.map(learner => {
        const attemptId = escapeHtml(learner.attempt_id);
        const questions = learner.open_ended || [];
        const pending = questions.filter(q => !q.grade).length;
        const full = !!learner.is_fully_graded;
        const isOpen = open.has(String(learner.attempt_id));

        const qHtml = questions.map(q => {
            const saved = q.grade ? formatOpenEndedScore(q.grade.score) : '';
            const fb = q.grade && q.grade.feedback ? q.grade.feedback : '';
            const pts = formatOpenEndedScore(q.points);
            const qid = escapeHtml(q.question_id);
            return `
                <div class="gr-dp-qb">
                    <div class="gr-dp-qh"><p class="gr-dp-qt">${escapeHtml(q.question_text || '')}</p><span class="gr-dp-qpt">${grPlural(Number(pts) || 0, 'point')}</span></div>
                    <blockquote class="gr-dp-ans${q.answer_text ? '' : ' is-none'}">${escapeHtml(q.answer_text || 'No answer submitted.')}</blockquote>
                    <div class="gr-dp-gg">
                        <label class="gr-dp-gl">Score
                            <span class="gr-dp-scw"><input type="number" min="0" max="${escapeHtml(q.points)}" step="0.01"
                                class="gr-dp-in gr-dp-score" id="oe-score-${attemptId}-${qid}" value="${escapeHtml(saved)}"><span>/ ${escapeHtml(pts)}</span></span>
                        </label>
                        <label class="gr-dp-gl">Feedback
                            <textarea class="gr-dp-in gr-dp-fb" id="oe-feedback-${attemptId}-${qid}" rows="2">${escapeHtml(fb)}</textarea>
                        </label>
                        <button type="button" class="gr-dp-btn gr-dp-btn--sm" data-action="save-open-ended-grade"
                            data-attempt-id="${attemptId}" data-question-id="${qid}" data-points="${escapeHtml(q.points)}">Save</button>
                    </div>
                    <div class="gr-dp-qmsg" id="oe-msg-${attemptId}-${qid}">${q.grade
                        ? `<p class="gr-dp-sv">${grDpIcon('check', 14)}Saved: ${escapeHtml(saved || '0')} / ${escapeHtml(pts)}</p>`
                        : `<p class="gr-dp-nd"><i class="gr-dp-dot" style="--c:#f3a93c;"></i>Needs grading</p>`}</div>
                </div>`;
        }).join('');

        return `
            <div class="gr-dp-lr" data-attempt="${attemptId}">
                <div class="gr-dp-lrt">
                    <div class="gr-dp-who"><b>${escapeHtml(learner.name || learner.user_email || 'Learner')}</b>
                        <small>${full ? `Score ${escapeHtml(formatOpenEndedScore(learner.score) || '0')} / ${escapeHtml(formatOpenEndedScore(learner.total) || '0')}` : 'Score pending'}</small></div>
                    <span class="gr-dp-st"><i class="gr-dp-dot" style="--c:${full ? '#22c55e' : '#f3a93c'};"></i>${full ? 'Fully graded' : `${grPlural(pending, 'question')} to grade`}</span>
                    <button type="button" class="gr-dp-btn gr-dp-btn--sm" data-gr="toggle" data-attempt="${attemptId}" aria-expanded="${isOpen}">${isOpen ? 'Hide responses' : full ? 'Review responses' : 'Grade responses'}</button>
                </div>
                <div class="gr-dp-lq" ${isOpen ? '' : 'hidden'}>${qHtml}</div>
            </div>`;
    }).join('');
}

function renderOpenEndedPanel(data, panel) {
    const quizId = data.quiz_id;
    const same = String(panel.dataset.grQuiz) === String(quizId);
    const keepTop = same ? panel.scrollTop : 0;
    panel.dataset.grQuiz = quizId;
    window.currentOpenEndedQuizData = data;

    const results = data.results || [];
    const fullyGraded = data.quiz_fully_graded === true || data.quiz_fully_graded === 1;
    const gradedCount = results.filter(r => r.is_fully_graded).length;
    const pendingLearners = results.length - gradedCount;
    const releaseDisabled = data.has_open_ended == 1 && !fullyGraded;
    const marksPublished = data.publish_marks == 1;
    const pct = results.length ? Math.round((gradedCount / results.length) * 100) : 0;
    const meta = grQuizMeta(quizId);
    const filter = window._grOeFilter || 'all';
    const reason = 'Grade all open-ended responses before releasing marks.';

    panel.innerHTML = `
        <div class="gr-dp${same ? ' gr-dp--still' : ''}">
            <p class="gr-dp-crumb">${escapeHtml(meta.class_name || '')}${meta.term ? ` &middot; Term ${escapeHtml(meta.term)}` : ''}</p>
            <div class="gr-dp-head">
                <div class="gr-dp-head-main">
                    <h2 class="gr-dp-title">${escapeHtml(data.quiz_title || 'Assessment Results')}</h2>
                    <div class="gr-dp-meta">
                        <span class="gr-dp-pill"><i class="gr-dp-dot" style="--c:${marksPublished ? '#22c55e' : '#5f656e'};"></i>${marksPublished ? 'Marks released' : 'Marks hidden from learners'}</span>
                        <span>${grPlural(results.length, 'submitted learner')}</span>
                    </div>
                </div>
                <div class="gr-dp-actions">
                    <button type="button" class="gr-dp-btn${marksPublished ? '' : ' gr-dp-btn--primary'}" data-action="toggle-open-ended-publish"
                        data-quiz-id="${escapeHtml(quizId)}" ${releaseDisabled ? `disabled title="${reason}"` : ''}>${marksPublished ? 'Unpublish marks' : 'Release marks'}</button>
                </div>
            </div>
            <div id="oeReleaseMessage" class="gr-dp-relmsg" role="status"></div>

            <div class="gr-dp-progwrap">
                <div class="gr-dp-prog"><div class="gr-dp-big">${gradedCount} of ${results.length}<span>learners fully graded</span></div></div>
                <div class="gr-dp-track"><i style="width:${pct}%;--c:${pendingLearners ? '#4fd1c5' : '#22c55e'};"></i></div>
                ${releaseDisabled ? `<p class="gr-dp-note gr-dp-note--warn">Grade every open-ended response before releasing marks.</p>` : ''}
            </div>

            <section class="gr-dp-section">
                <h3 class="gr-dp-h">Learners</h3>
                <div class="gr-dp-tools">
                    <div class="gr-dp-seg" id="gr-oe-filter" role="group" aria-label="Filter learners">
                        <button type="button" data-gr="filter" data-filter="all" aria-pressed="${filter === 'all'}">All ${results.length}</button>
                        <button type="button" data-gr="filter" data-filter="out" aria-pressed="${filter === 'out'}">Needs grading ${pendingLearners}</button>
                    </div>
                </div>
                <div class="gr-dp-lrs" id="gr-oe-rows">${grOeRowsHtml(data)}</div>
            </section>
        </div>`;

    panel.scrollTop = keepTop;
    grWireOpenEnded(panel);

    // Swap the info rail to reflect this assessment's grading/publish state.
    if (typeof updateInfoRail === 'function') {
        if (pendingLearners > 0) {
            updateInfoRail('gr-rail', 'Manual Grading Needed', `
                <p><strong>${pendingLearners}</strong> learner${pendingLearners !== 1 ? 's' : ''} still ${pendingLearners !== 1 ? 'have' : 'has'} open-ended responses waiting to be graded for ${escapeHtml(data.quiz_title || 'this assessment')}.</p>
                <p>Marks can't be released until every learner is fully graded.</p>
            `);
        } else if (marksPublished) {
            updateInfoRail('gr-rail', 'Marks Released', `
                <p>All responses are graded and learners can currently see their results for ${escapeHtml(data.quiz_title || 'this assessment')}.</p>
                <p>Use <strong>Unpublish marks</strong> if you need to hide them again, e.g. to fix a grading issue.</p>
            `);
        } else {
            updateInfoRail('gr-rail', 'Ready to Release', `
                <p>Every learner is fully graded for ${escapeHtml(data.quiz_title || 'this assessment')}, but marks aren't released yet.</p>
                <p>Use <strong>Release marks</strong> when you're ready for learners to see their results.</p>
            `);
        }
    }
}

function grWireOpenEnded(panel) {
    panel.onclick = function(e) {
        const b = e.target.closest('[data-gr]');
        if (!b || !panel.contains(b)) return;
        if (b.dataset.gr === 'filter') {
            window._grOeFilter = b.dataset.filter;
            const data = window.currentOpenEndedQuizData;
            if (!data) return;
            document.getElementById('gr-oe-rows').innerHTML = grOeRowsHtml(data);
            document.querySelectorAll('#gr-oe-filter button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.filter === window._grOeFilter)));
        } else if (b.dataset.gr === 'toggle') {
            const row = b.closest('.gr-dp-lr');
            const box = row && row.querySelector('.gr-dp-lq');
            if (!box) return;
            const opening = box.hidden;
            box.hidden = !opening;
            const id = String(b.dataset.attempt);
            if (opening) window._grOpenLearners.add(id); else window._grOpenLearners.delete(id);
            b.setAttribute('aria-expanded', String(opening));
            const learner = ((window.currentOpenEndedQuizData || {}).results || []).find(r => String(r.attempt_id) === id);
            b.textContent = opening ? 'Hide responses' : (learner && learner.is_fully_graded ? 'Review responses' : 'Grade responses');
        }
    };
    // Enter in a score box (or Ctrl/Cmd+Enter in feedback) saves that question.
    panel.onkeydown = function(e) {
        if (e.key !== 'Enter') return;
        const t = e.target;
        const isScore = t.classList && t.classList.contains('gr-dp-score');
        const isFb = t.classList && t.classList.contains('gr-dp-fb') && (e.ctrlKey || e.metaKey);
        if (!isScore && !isFb) return;
        e.preventDefault();
        const block = t.closest('.gr-dp-qb');
        const save = block && block.querySelector('[data-action="save-open-ended-grade"]');
        if (save) save.click();
    };
}

/** After a grade is saved, move to the next question still needing a grade in the same learner. */
function grFocusNextQuestion(attemptId, questionId) {
    const row = Array.from(document.querySelectorAll('#gr-oe-rows .gr-dp-lr')).find(r => r.dataset.attempt === String(attemptId));
    if (!row) return;
    const blocks = Array.from(row.querySelectorAll('.gr-dp-qb'));
    const here = blocks.findIndex(b => b.querySelector('[data-action="save-open-ended-grade"]').dataset.questionId === String(questionId));
    const todo = blocks.find((b, i) => i > here && b.querySelector('.gr-dp-nd'));
    const target = todo ? todo.querySelector('.gr-dp-score') : (blocks[here] && blocks[here].querySelector('[data-action="save-open-ended-grade"]'));
    if (target) target.focus();
}

async function saveOpenEndedGradePanel(button) {
    const attemptId = button.dataset.attemptId;
    const questionId = button.dataset.questionId;
    const max = parseFloat(button.dataset.points);
    const scoreEl = document.getElementById(`oe-score-${attemptId}-${questionId}`);
    const fbEl = document.getElementById(`oe-feedback-${attemptId}-${questionId}`);
    const msg = document.getElementById(`oe-msg-${attemptId}-${questionId}`);
    const showErr = text => { if (msg) msg.innerHTML = `<p class="gr-dp-qerr">${escapeHtml(text)}</p>`; };

    const score = scoreEl ? scoreEl.value.trim() : '';
    if (score === '') return showErr('Please enter a score.');
    const n = parseFloat(score);
    if (!Number.isFinite(n) || n < 0 || (Number.isFinite(max) && n > max)) {
        return showErr(`The score must be between 0 and ${formatOpenEndedScore(max)}.`);
    }

    const quizId = window.currentOpenEndedQuizData?.quiz_id;
    const fd = new FormData();
    fd.append('attempt_id', attemptId);
    fd.append('question_id', questionId);
    fd.append('score', score);
    fd.append('feedback', fbEl ? fbEl.value : '');

    const hideLoader = window.showTeacherButtonLoader(button);
    try {
        const res = await fetch('api/teacher/grade_open_ended.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Unable to save grade.');
        // The panel is redrawn from fresh data; open learners and scroll position are kept.
        await refreshOpenEndedGrades(quizId, 'panel');
        grToast('Grade saved');
        grFocusNextQuestion(attemptId, questionId);
    } catch (e) {
        showErr(e.message || 'Unable to save grade.');
    } finally {
        hideLoader();
    }
}

async function toggleOpenEndedPublishPanel(button) {
    const quizId = parseInt(button.dataset.quizId, 10);
    const message = document.getElementById('oeReleaseMessage');
    const hideLoader = window.showTeacherButtonLoader(button);
    if (message) { message.textContent = ''; message.classList.remove('is-error'); }
    try {
        const res = await fetch('api/teacher/toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ quiz_id: quizId })
        });
        const data = await res.json();
        if (data.status !== 'success' && !data.success) throw new Error(data.message || 'Unable to release marks.');
        const released = data.newStatus == 1 || (data.data && data.data.newStatus == 1);
        await refreshOpenEndedGrades(quizId, 'panel').catch(() => {});
        grToast(released ? 'Marks released' : 'Marks unpublished');
    } catch (e) {
        if (message) { message.textContent = e.message || 'Unable to release marks.'; message.classList.add('is-error'); }
        else alert(e.message || 'Unable to release marks.');
    } finally {
        hideLoader();
    }
}

function renderOpenEndedGradesClassic(data, target, isPanel) {
    if (!target) return;
    const results = data.results || [];
    const fullyGraded = data.quiz_fully_graded === true || data.quiz_fully_graded === 1;
    const pendingLearners = results.filter(row => !row.is_fully_graded).length;
    const releaseDisabled = data.has_open_ended == 1 && !fullyGraded;
    const marksPublished = data.publish_marks == 1;
    const backButton = isPanel
        ? ''
        : `<button class="teacher-back-btn" data-action="open-ended-back">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to Grades
            </button>`;

    let html = `
        <div class="${isPanel ? 'gr-panel-content' : ''}">
            ${!isPanel ? `<div class="teacher-resources-header">${backButton}</div>` : ''}
            <div class="gr-panel-header">
                <div>
                    <div class="gr-panel-title">${escapeHtml(data.quiz_title || 'Assessment Results')}</div>
                    <div class="gr-panel-meta">${results.length} submitted learner${results.length !== 1 ? 's' : ''}</div>
                </div>
                <div class="gr-oe-header-actions">
                    <button type="button" class="teacher-modal-submit gr-oe-release-btn" data-action="toggle-open-ended-publish" data-quiz-id="${escapeHtml(data.quiz_id)}" ${releaseDisabled ? 'disabled' : ''}
                        title="${releaseDisabled ? 'Grade all open-ended responses before releasing marks.' : ''}">
                        ${marksPublished ? 'Unpublish Marks' : 'Release Marks'}
                    </button>
                    ${releaseDisabled ? `<div class="gr-oe-warning-text">Grade all open-ended responses before releasing marks.</div>` : ''}
                    <div id="oeReleaseMessage" class="gr-oe-release-message"></div>
                </div>
            </div>`;

    if (results.length === 0) {
        html += `<p class="teacher-empty-state">No submitted attempts found for this assessment.</p>`;
    } else {
        results.forEach(learner => {
            const openQuestions = learner.open_ended || [];
            const pendingCount = openQuestions.filter(question => !question.grade).length;
            const scoreDisplay = data.has_open_ended == 1 && !fullyGraded
                ? '***'
                : escapeHtml(learner.score ?? '0');
            const badge = learner.is_fully_graded
                ? `<span class="gr-oe-badge gr-oe-badge--graded">Fully Graded</span>`
                : `<span class="gr-oe-badge gr-oe-badge--pending">Pending ${pendingCount} question${pendingCount !== 1 ? 's' : ''}</span>`;

            html += `
                <div class="gr-oe-learner-card">
                    <div class="gr-oe-learner-card-top">
                        <div>
                            <div class="gr-oe-learner-name">${escapeHtml(learner.name || learner.user_email || 'Learner')}</div>
                            <div class="gr-oe-learner-score">Score: ${scoreDisplay} / ${escapeHtml(learner.total ?? '0')}</div>
                        </div>
                        <div class="gr-oe-learner-actions">
                            ${badge}
                            <button type="button" class="teacher-edit-marks-btn gr-desktop-only-btn" data-action="toggle-open-ended-learner"
                                data-target-id="oe-learner-${escapeHtml(learner.attempt_id)}">
                                Grade Responses
                            </button>
                        </div>
                    </div>
                    <div id="oe-learner-${escapeHtml(learner.attempt_id)}" class="gr-oe-learner-questions">`;

            openQuestions.forEach(question => {
                const savedScore = question.grade ? formatOpenEndedScore(question.grade.score) : '';
                const feedback = question.grade && question.grade.feedback ? question.grade.feedback : '';
                html += `
                    <div class="gr-oe-question-block">
                        <div class="gr-oe-question-text">${escapeHtml(question.question_text || '')}</div>
                        <div class="gr-oe-question-points">Max points: ${escapeHtml(question.points)}</div>
                        <div class="gr-oe-answer-text">${escapeHtml(question.answer_text || 'No answer submitted.')}</div>
                        <div class="gr-oe-grade-grid">
                            <label class="gr-oe-grade-field-label">Score
                                <input type="number" min="0" max="${escapeHtml(question.points)}" step="0.01" class="teacher-modal-input gr-oe-grade-input"
                                    id="oe-score-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    value="${escapeHtml(savedScore)}">
                            </label>
                            <label class="gr-oe-grade-field-label">Feedback
                                <textarea class="teacher-modal-input gr-oe-grade-textarea" id="oe-feedback-${escapeHtml(learner.attempt_id)}-${escapeHtml(question.question_id)}"
                                    rows="2">${escapeHtml(feedback)}</textarea>
                            </label>
                            <button type="button" class="teacher-edit-marks-btn" data-action="save-open-ended-grade"
                                data-attempt-id="${escapeHtml(learner.attempt_id)}"
                                data-question-id="${escapeHtml(question.question_id)}">
                                Save
                            </button>
                        </div>
                        ${question.grade ? `<div class="gr-oe-saved-note">&#10003; Saved: ${escapeHtml(savedScore || '0')} / ${escapeHtml(question.points)}</div>` : ''}
                    </div>`;
            });

            html += `</div></div>`;
        });
    }

    if (pendingLearners > 0) {
        html += `<div class="gr-oe-pending-footer">${pendingLearners} learner${pendingLearners !== 1 ? 's' : ''} still need manual grading.</div>`;
    }

    html += `</div>`;
    target.innerHTML = html;

    // Swap the info rail to reflect this quiz's grading/publish state.
    // Only applies on desktop (isPanel) — the non-panel call site has no
    // rail. Runs on every render (fresh fetch, cache hit, or after a
    // grade save via refreshOpenEndedGrades) since they all call this.
    if (isPanel && typeof updateInfoRail === 'function') {
        if (pendingLearners > 0) {
            updateInfoRail('gr-rail', 'Manual Grading Needed', `
                <p><strong>${pendingLearners}</strong> learner${pendingLearners !== 1 ? 's' : ''} still ${pendingLearners !== 1 ? 'have' : 'has'} open-ended responses waiting to be graded for ${escapeHtml(data.quiz_title || 'this assessment')}.</p>
                <p>Marks can't be released until every learner is fully graded.</p>
            `);
        } else if (marksPublished) {
            updateInfoRail('gr-rail', 'Marks Released', `
                <p>All responses are graded and learners can currently see their results for ${escapeHtml(data.quiz_title || 'this assessment')}.</p>
                <p>Use <strong>Unpublish Marks</strong> if you need to hide them again, e.g. to fix a grading issue.</p>
            `);
        } else {
            updateInfoRail('gr-rail', 'Ready to Release', `
                <p>Every learner is fully graded for ${escapeHtml(data.quiz_title || 'this assessment')}, but marks aren't released yet.</p>
                <p>Use <strong>Release Marks</strong> when you're ready for learners to see their results.</p>
            `);
        }
    }
}

async function refreshOpenEndedGrades(quizId, targetMode) {
    const res = await fetch(`api/teacher/get_quiz_results.php?quiz_id=${quizId}`, {
        headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    const payload = await res.json();
    const data = normalizeQuizResultsPayload(payload);
    if (!data) throw new Error(payload.message || payload.error || 'Unable to reload open-ended results.');
    window.currentOpenEndedQuizData = data;
    window._teacherGradeQuizCache[quizId] = { type: 'open_ended', data: data };
    const panel = document.getElementById('gr-main-panel');
    const apiArea = document.getElementById('api-content-area');
    renderOpenEndedGrades(data, targetMode === 'panel' && panel ? panel : apiArea, targetMode === 'panel');
}

async function saveOpenEndedGrade(button) {
    if (button.closest('.gr-dp')) return saveOpenEndedGradePanel(button);
    const attemptId = button.dataset.attemptId;
    const questionId = button.dataset.questionId;
    const score = document.getElementById(`oe-score-${attemptId}-${questionId}`)?.value ?? '';
    const feedback = document.getElementById(`oe-feedback-${attemptId}-${questionId}`)?.value ?? '';
    const quizId = window.currentOpenEndedQuizData?.quiz_id;
    const panel = document.getElementById('gr-main-panel');
    const targetMode = panel && panel.contains(button) ? 'panel' : 'mobile';

    const fd = new FormData();
    fd.append('attempt_id', attemptId);
    fd.append('question_id', questionId);
    fd.append('score', score);
    fd.append('feedback', feedback);

    const hideButtonLoader = window.showTeacherButtonLoader(button);
    try {
        const res = await fetch('api/teacher/grade_open_ended.php', {
            method: 'POST',
            headers: { 'X-CSRF-Token': getCsrfToken() },
            body: fd
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Unable to save grade.');
        await refreshOpenEndedGrades(quizId, targetMode);
    } catch (e) {
        alert(e.message || 'Unable to save grade.');
    } finally {
        hideButtonLoader();
    }
}

async function toggleOpenEndedPublish(button) {
    if (button.disabled) return;
    if (button.closest('.gr-dp')) return toggleOpenEndedPublishPanel(button);
    const quizId = parseInt(button.dataset.quizId, 10);
    const message = document.getElementById('oeReleaseMessage');
    const hideButtonLoader = window.showTeacherButtonLoader(button);
    if (message) { message.style.display = 'none'; message.classList.remove('is-success', 'is-error'); }
    try {
        const res = await fetch('api/teacher/toggle_publish_marks.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
            body: JSON.stringify({ quiz_id: quizId })
        });
        const data = await res.json();
        if (data.status !== 'success' && !data.success) throw new Error(data.message || 'Unable to release marks.');
        if (message) {
            message.textContent = data.newStatus == 1 || data.data?.newStatus == 1 ? 'Marks released.' : 'Marks unpublished.';
            message.classList.add('is-success');
            message.style.display = 'block';
        }
    } catch (e) {
        if (message) {
            message.textContent = e.message || 'Unable to release marks.';
            message.classList.add('is-error');
            message.style.display = 'block';
        } else {
            alert(e.message || 'Unable to release marks.');
        }
    } finally {
        await refreshOpenEndedGrades(quizId, document.getElementById('gr-main-panel') && document.getElementById('gr-main-panel').contains(button) ? 'panel' : 'mobile').catch(() => {});
        hideButtonLoader();
    }
}

document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'save-open-ended-grade') {
        saveOpenEndedGrade(actionEl);
    } else if (actionEl.dataset.action === 'toggle-open-ended-publish') {
        toggleOpenEndedPublish(actionEl);
    } else if (actionEl.dataset.action === 'toggle-open-ended-learner') {
        const target = document.getElementById(actionEl.dataset.targetId || '');
        if (target) {
            const isHidden = target.style.display === 'none';
            target.style.display = isHidden ? 'block' : 'none';
            actionEl.textContent = isHidden ? 'Hide Responses' : 'Grade Responses';
        }
    } else if (actionEl.dataset.action === 'open-ended-back') {
        fetchTeacherGrades();
    }
});

function getGradeBadgeClass(percentage) {
    const val = parseFloat(percentage);
    if (val >= 75) return 'grade-high';
    if (val >= 50) return 'grade-mid';
    return 'grade-low';
}

// ─────────────────────────────────────────────
// EDIT MARKS VIEW (mobile — replaces full apiArea)
// ─────────────────────────────────────────────
window.openEditMarks = function(email, name, quizId, quizTitle, currentScore, currentTotal) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const scoreVal = currentScore !== null ? currentScore : '';
    const totalVal = currentTotal !== null ? currentTotal : 100;

    apiArea.innerHTML = `
        <div class="teacher-resources-header">
            <button class="teacher-back-btn" onclick="renderQuizGrades(window.currentQuizData)">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back to ${escapeHtml(quizTitle)}
            </button>
        </div>

        <div class="teacher-edit-marks-box">
            <h3 class="teacher-edit-marks-title">Edit Marks</h3>
            <p class="teacher-edit-marks-meta">
                <strong>${escapeHtml(name)}</strong><br>
                <span class="gr-edit-marks-meta-sub">${escapeHtml(quizTitle)}</span>
            </p>

            <label class="teacher-modal-label">Score Received</label>
            <input type="number" step="0.01" id="editScore" class="teacher-modal-input" 
                value="${escapeHtml(scoreVal)}" placeholder="e.g. 15">

            <label class="teacher-modal-label gr-form-label-spaced">Maximum Possible Score</label>
            <input type="number" step="0.01" id="editTotal" class="teacher-modal-input" 
                value="${escapeHtml(totalVal)}" placeholder="e.g. 20">

            <div id="editMarksError" class="gr-form-error"></div>
            <div id="editMarksSuccess" class="gr-form-success"></div>

            <div class="gr-form-actions">
                <button class="teacher-modal-cancel gr-form-cancel-btn" 
                    onclick="renderQuizGrades(window.currentQuizData)">Cancel</button>
                <button class="teacher-modal-submit gr-form-submit-btn" 
                    id="saveMarksBtn"
                    data-email="${escapeHtml(email)}" data-quiz-id="${quizId}"
                    onclick="saveMarksFromElement(this)">
                    Save Marks
                </button>
            </div>
        </div>`;
};

window.openEditMarksFromElement = function(el) {
    openEditMarks(
        el.dataset.email || '',
        el.dataset.name || '',
        parseInt(el.dataset.quizId, 10),
        el.dataset.quizTitle || '',
        el.dataset.score === '' ? null : parseFloat(el.dataset.score),
        parseFloat(el.dataset.total || '100')
    );
};

window.saveMarks = async function(email, quizId) {
    const score     = document.getElementById('editScore').value;
    const total     = document.getElementById('editTotal').value;
    const errorDiv  = document.getElementById('editMarksError');
    const successDiv = document.getElementById('editMarksSuccess');
    const saveBtn   = document.getElementById('saveMarksBtn');
    const loader    = document.getElementById('loaderOverlay');
    const panel     = document.getElementById('gr-main-panel');
    const isDesktop = window.innerWidth >= 900 && panel;

    errorDiv.style.display   = 'none';
    successDiv.style.display = 'none';

    if (score === '') { errorDiv.textContent = 'Please enter a score.'; errorDiv.style.display = 'block'; return; }
    if (!total)       { errorDiv.textContent = 'Please enter the total.'; errorDiv.style.display = 'block'; return; }

    const fd = new FormData();
    fd.append('quiz_id',    quizId);
    fd.append('user_email', email);
    fd.append('score',      score);
    fd.append('total',      total);

    const hideSubmitLoader = window.showTeacherButtonLoader(saveBtn);

    try {
        const res  = await fetch('api/teacher/save_marks.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            successDiv.textContent = 'Marks saved successfully!';
            successDiv.style.display = 'block';

            // Update the cached quiz data so when we go back the table is fresh
            window.currentQuizData = null;
            delete window._teacherGradeQuizCache[quizId];
            setTimeout(async () => {
                const res2  = await fetch(`api/teacher/get_quiz_grades.php?quiz_id=${quizId}`);
                const fresh = await res2.json();
                window.currentQuizData = fresh;
                window._teacherGradeQuizCache[quizId] = { type: 'standard', data: fresh };

                // Refresh whichever view is active
                const panel = document.getElementById('gr-main-panel');
                if (panel) {
                    renderGradesInPanel(fresh, panel);
                } else {
                    renderQuizGrades(fresh);
                }
            }, 800);
        } else {
            errorDiv.textContent = data.error || 'Failed to save marks.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    } finally {
        hideSubmitLoader();
    }
};

window.saveMarksFromElement = function(el) {
    saveMarks(el.dataset.email || '', parseInt(el.dataset.quizId, 10));
};

// ─────────────────────────────────────────────
// ADD ASSESSMENT (form opens in the desktop panel)
// ─────────────────────────────────────────────
async function loadGradesClasses(preferredClassName) {
    const sel = document.getElementById('quizClass');
    try {
        const res  = await fetch('api/teacher/get_classes.php');
        const data = await res.json();
        const el   = document.getElementById('quizClass');
        if (!el) return;
        el.innerHTML = '<option value="">Choose a class</option>';
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            el.appendChild(opt);
        });
        // Adding several assessments to one class is the common case, so the
        // class of the assessment you were just looking at is preselected.
        const match = preferredClassName && data.find(c => c.name === preferredClassName);
        if (match) el.value = String(match.id);
        else if (data.length === 1) el.value = String(data[0].id);
    } catch (e) {
        console.error('Failed to load classes', e);
        if (sel) sel.innerHTML = '<option value="">Couldn\'t load classes</option>';
        const err = document.getElementById('addQuizError');
        if (err) { err.textContent = "Couldn't load your classes. Close this form and try again."; err.style.display = 'block'; }
    }
}

window.toggleWeightField = function() {
    const cb = document.getElementById('quizSummative');
    const container = document.getElementById('weightContainer');
    if (!cb || !container) return;
    container.hidden = !cb.checked;
    if (cb.checked) { const w = document.getElementById('quizWeight'); if (w) w.focus(); }
};

window.openAddQuizModal = function() {
    const panel = document.getElementById('gr-main-panel');
    if (!panel) return;

    // Remember what was open so Cancel can go back to it.
    if (!panel.querySelector('.gr-dp-form') && window._activeDesktopGradeQuizId != null) {
        window._grPrevQuizId = window._activeDesktopGradeQuizId;
    }
    window._activeDesktopGradeQuizId = null;   // ignore any load still in flight
    document.querySelectorAll('.gr-sidebar-item').forEach(el => el.classList.remove('active'));
    const newBtn = document.getElementById('gr-new-btn');
    if (newBtn) newBtn.classList.add('active');

    const prev = grQuizMeta(window._grPrevQuizId);
    delete panel.dataset.grQuiz;
    panel.onclick = panel.oninput = panel.onmouseover = panel.onmouseleave = null;

    panel.innerHTML = `
        <div class="gr-dp gr-dp-form">
            <p class="gr-dp-crumb">Grades</p>
            <h2 class="gr-dp-title">Add an assessment</h2>
            <p class="gr-dp-lede">For marks captured outside iSkool, like a paper test or an oral. You'll enter each learner's mark next.</p>

            <section class="gr-dp-section">
                <h3 class="gr-dp-h">Details</h3>
                <div class="gr-dp-fld gr-dp-fld--first">
                    <label class="gr-dp-lbl" for="quizTitle">Title</label>
                    <input type="text" id="quizTitle" class="gr-dp-in" placeholder="e.g. Chapter 3 Test" autocomplete="off">
                </div>
                <div class="gr-dp-fld">
                    <label class="gr-dp-lbl" for="quizClass">Class</label>
                    <select id="quizClass" class="gr-dp-in"><option value="">Loading classes&hellip;</option></select>
                </div>
            </section>

            <section class="gr-dp-section">
                <h3 class="gr-dp-h">Term mark</h3>
                <div class="gr-dp-rows">
                    <div class="gr-dp-row">
                        <div>
                            <label class="gr-dp-rt" for="quizSummative">Counts toward the term mark</label>
                            <p class="gr-dp-rs">Include this assessment when the term mark is calculated.</p>
                        </div>
                        <input type="checkbox" id="quizSummative" class="gr-dp-switch" role="switch" onchange="toggleWeightField()">
                    </div>
                    <div id="weightContainer" class="gr-dp-wrow" hidden>
                        <label class="gr-dp-lbl" for="quizWeight">Weight<span class="gr-dp-opt">Optional</span></label>
                        <div class="gr-dp-wi"><input type="number" id="quizWeight" class="gr-dp-in" min="0" max="100" step="0.1" placeholder="30" inputmode="decimal"><span>%</span></div>
                        <p class="gr-dp-hint">Its share of the term mark, up to 100%.</p>
                    </div>
                </div>
            </section>

            <div class="gr-dp-formactions">
                <div id="addQuizError" class="gr-dp-err" role="alert"></div>
                <button type="button" class="gr-dp-btn" onclick="closeAddQuizModal()">Cancel</button>
                <button type="button" class="gr-dp-btn gr-dp-btn--primary" id="addQuizSubmitBtn" onclick="submitAddQuiz()">Add assessment</button>
            </div>
        </div>`;

    // Enter in the title or weight box submits.
    panel.onkeydown = function(e) {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('#quizTitle, #quizWeight')) {
            e.preventDefault();
            window.submitAddQuiz();
        }
    };

    panel.scrollTop = 0;
    const title = document.getElementById('quizTitle');
    if (title) title.focus();
    loadGradesClasses(prev.class_name);
};

// Back out of the form: return to the assessment that was open, or the empty state.
window.closeAddQuizModal = function() {
    const newBtn = document.getElementById('gr-new-btn');
    if (newBtn) newBtn.classList.remove('active');
    const panel = document.getElementById('gr-main-panel');
    const prevId = window._grPrevQuizId;
    window._grPrevQuizId = null;
    if (prevId != null && (window._allGradesQuizzesFlat || []).some(q => String(q.id) === String(prevId))) {
        selectDesktopGradeQuiz(prevId);
    } else if (panel) {
        panel.onkeydown = null;
        delete panel.dataset.grQuiz;
        panel.innerHTML = grEmptyStateHtml();
    }
};

window.submitAddQuiz = async function() {
    const titleEl  = document.getElementById('quizTitle');
    const classEl  = document.getElementById('quizClass');
    const sumEl    = document.getElementById('quizSummative');
    const weightEl = document.getElementById('quizWeight');
    const err      = document.getElementById('addQuizError');
    const btn      = document.getElementById('addQuizSubmitBtn');
    if (!titleEl || !classEl || !err || !btn) return;

    const title       = titleEl.value.trim();
    const classId     = classEl.value;
    const isSummative = !!(sumEl && sumEl.checked);
    const weight      = weightEl ? weightEl.value.trim() : '';

    const fail = (text, el) => { err.textContent = text; err.style.display = 'block'; if (el) el.focus(); };
    err.style.display = 'none';

    if (!title)   return fail('Please enter an assessment title.', titleEl);
    if (!classId) return fail('Please select a class.', classEl);
    if (isSummative && weight !== '') {
        const w = parseFloat(weight);
        if (!(w > 0 && w <= 100)) return fail('The weight must be more than 0 and no more than 100.', weightEl);
    }

    const fd = new FormData();
    fd.append('title',    title);
    fd.append('class_id', classId);
    if (isSummative) {
        fd.append('is_summative', '1');
        if (weight) fd.append('weight_percent', weight);
    }

    const className = classEl.options[classEl.selectedIndex] ? classEl.options[classEl.selectedIndex].textContent : '';
    const hideLoader = window.showTeacherButtonLoader(btn);
    try {
        const res  = await fetch('api/teacher/add_manual_quiz.php', { method: 'POST', headers: { 'X-CSRF-Token': getCsrfToken() }, body: fd });
        const data = await res.json();

        if (data.success) {
            // Reload the list; renderTeacherGrades then opens the new assessment
            // so the teacher can start entering marks straight away.
            window._grPendingSelect = { title, className };
            window._grPrevQuizId = null;
            window.teacherGradesCache = null;
            await fetchTeacherGrades();
            grToast('Assessment added. Enter the marks below.');
        } else {
            fail(data.error || 'Failed to add assessment.');
        }
    } catch (e) {
        fail('Connection error. Please try again.');
    } finally {
        hideLoader();
    }
};
