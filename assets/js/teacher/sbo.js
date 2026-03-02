// ── SBO DRAWER ──────────────────────────────────────────────────────────────

window.openSBODrawer = async function() {
    // Remove existing drawer if any
    const existing = document.getElementById('sboDrawer');
    if (existing) existing.remove();

    // Build drawer HTML
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
                <span style="font-weight:900;font-size:16px;color:#e2e8f0;">📚 Post Subject Brief</span>
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
                <!-- Weight total indicator -->
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

    // Add first topic and assessment row by default
    addSBOTopic();
    addSBOAssessment();
};

window.closeSBODrawer = function() {
    const drawer = document.getElementById('sboDrawer');
    if (drawer) drawer.remove();
};

// ── Topic rows ──
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

// ── Assessment rows ──
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

// ── Weight total ──
window.updateSBOWeightTotal = function() {
    const inputs = document.querySelectorAll('.sbo-assess-weight');
    let total = 0;
    inputs.forEach(i => { total += parseInt(i.value) || 0; });
    const el = document.getElementById('sboWeightTotal');
    if (!el) return;
    el.textContent = `Total: ${total}%`;
    el.style.color = total === 100 ? '#4fd1c5' : total > 100 ? '#ff5555' : '#8b949e';
};

// ── Save ──
window.saveSBO = async function() {
    const err = document.getElementById('sboError');
    err.style.display = 'none';

    const class_id = parseInt(document.getElementById('sboClass').value);
    const term     = parseInt(document.getElementById('sboTerm').value);
    const subject  = document.getElementById('sboSubject').value.trim();
    const notes    = document.getElementById('sboNotes').value.trim();

    // Collect topics
    const topics = [];
    document.querySelectorAll('.sbo-topic-input').forEach(i => {
        const v = i.value.trim();
        if (v) topics.push(v);
    });

    // Collect assessments
    const assessments = [];
    document.querySelectorAll('.sbo-assessment-row').forEach(row => {
        const type   = row.querySelector('.sbo-assess-type').value.trim();
        const weight = parseInt(row.querySelector('.sbo-assess-weight').value) || 0;
        if (type && weight > 0) assessments.push({ type, weight });
    });

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
            // Optional: show a quick toast if you have one
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