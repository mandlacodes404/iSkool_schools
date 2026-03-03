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

function renderTeacherSyllabus(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const classes = data.classes || [];
    const briefs  = data.briefs  || [];

    // Build class options
    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Syllabus</h2>
            <button class="teacher-upload-btn" onclick="openSBODrawer()">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Release Syllabus
            </button>
        </div>

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
        </div>`;

    apiArea.innerHTML = html;

    // Store briefs on the container for filtering
    document.getElementById('sboResultsContainer').dataset.briefs = JSON.stringify(briefs);
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

// ── CLIENT-SIDE FILTER ──
window.filterSyllabus = function() {
    const classFilter = document.getElementById('sboFilterClass').value;
    const termFilter  = document.getElementById('sboFilterTerm').value;
    const container   = document.getElementById('sboResultsContainer');

    let briefs = JSON.parse(container.dataset.briefs || '[]');

    if (classFilter) briefs = briefs.filter(b => b.class_id == classFilter);
    if (termFilter)  briefs = briefs.filter(b => b.term == termFilter);

    container.innerHTML = buildSBOCards(briefs);
};

// ── SBO DRAWER (CREATE) ──────────────────────────────────────────────────────

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
                <span style="font-weight:900;font-size:16px;color:#e2e8f0;">📚 Release Syllabus</span>
                <button onclick="closeSBODrawer()"
                        style="background:none;border:none;color:#8b949e;font-size:22px;cursor:pointer;">&times;</button>
            </div>

            <!-- Class -->
            <div>
                <label class="teacher-modal-label">Class</label>
                <select id="sboClass" class="teacher-modal-input">
                    <option value="">Loading classes...</option>
                </select>
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
        const sel     = document.getElementById('sboClass');
        sel.innerHTML = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch(e) {
        document.getElementById('sboClass').innerHTML = '<option value="">Failed to load</option>';
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

    const class_id = parseInt(document.getElementById('sboClass').value);
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

    const btn = document.querySelector('#sboDrawer .teacher-modal-submit');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

    try {
        const res  = await fetch('api/teacher/save_sbo.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ class_id, term, subject, topics, assessments, notes })
        });
        const data = await res.json();

        if (data.success) {
            closeSBODrawer();
            // Clear cache and reload page
            window.teacherSBOCache = null;
            fetchTeacherSyllabus();
            if (typeof window.showToast === 'function') {
                window.showToast(`Syllabus posted — ${data.notified} learner${data.notified !== 1 ? 's' : ''} notified`);
            }
        } else {
            err.textContent   = data.error || 'Failed to save.';
            err.style.display = 'block';
            if (btn) { btn.textContent = 'Post & Notify'; btn.disabled = false; }
        }
    } catch(e) {
        err.textContent   = 'Connection error. Please try again.';
        err.style.display = 'block';
        if (btn) { btn.textContent = 'Post & Notify'; btn.disabled = false; }
    }
};