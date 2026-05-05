/* assets/js/evaluations.js */
window.fetchEvaluations = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    
    sessionStorage.setItem("lastLearnerPage", "evaluation_list.php");

    if (typeof window.setActive === 'function') {
        window.setActive("evaluation_list.php");
    }

    if (window.configureHeader) {
        window.configureHeader({ title: 'Evaluations', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';

    // Inject CSS
    if (!document.getElementById('eval-style')) {
        const link = document.createElement('link');
        link.id = 'eval-style'; link.rel = 'stylesheet'; link.href = 'assets/css/learner/evaluations.css?v=2.2';
        document.head.appendChild(link);
    }

    // 4. FIXED CACHE CHECK
    if (window.evaluationCache) {
        renderEvaluationsUI(window.evaluationCache); // Call the correct internal function
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_evaluations.php');
        const data = await response.json();
        window.evaluationCache = data; 
        renderEvaluationsUI(data); // Call the helper function here too
    } catch (e) {
        apiArea.innerHTML = "<p style='text-align:center; color:red;'>Error loading evaluations.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// New Helper Function to handle the actual HTML building
function renderEvaluationsUI(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // ── Handle special / empty states ──
    if (data.status === 'no_class') {
        apiArea.innerHTML = '<p style="text-align:center;">You are not enrolled in a class yet.</p>';
        return;
    }
    if (!data || data.length === 0) {
        apiArea.innerHTML = '<p style="text-align:center;">No active evaluations at the moment.</p>';
        return;
    }

    // ── Build flat list for desktop panel lookup ──
    window._allLearnerEvaluationsFlat = data;

    // ── Build sidebar HTML ──
    let sidebarHtml = '';
    data.forEach((evaluation, idx) => {
        sidebarHtml += `
            <div class="lev-sidebar-item" id="lev-sidebar-${idx}"
                onclick="selectDesktopLearnerEvaluation(${idx})">
                <div class="lev-sidebar-item-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                </div>
                <div class="lev-sidebar-item-info">
                    <div class="lev-sidebar-item-title">${evaluation.title}</div>
                    <div class="lev-sidebar-item-meta">by ${evaluation.teacher}</div>
                </div>
                ${evaluation.submitted
                    ? '<span class="lev-sidebar-done-badge">Done</span>'
                    : '<span class="lev-sidebar-pending-dot"></span>'}
            </div>`;
    });

    // ── Build mobile HTML (original loop, unchanged) ──
    let mobileHtml = '';
    data.forEach(evaluation => {
        mobileHtml += `
            <div class="eval-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div class="eval-title">${evaluation.title}</div>
                        <div class="teacher-name">by ${evaluation.teacher}</div>
                    </div>
                    ${evaluation.submitted ? '<div class="completed-badge"><i class="fas fa-check-circle"></i> Completed</div>' : ''}
                </div>`;

        if (!evaluation.submitted) {
            mobileHtml += `
                <div class="eval-description">${evaluation.description || ''}</div>
                <form onsubmit="handleEvalSubmit(event, ${evaluation.id})">
                    <input type="hidden" name="eval_id" value="${evaluation.id}">
                    ${evaluation.statements.map(s => `
                        <div class="question-box">
                            <div class="question-text">${s.statement}</div>
                            <div class="eval-options">
                                ${['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'].map(val => `
                                    <label class="option-label">
                                        <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                        <span>${val.replace('_', ' ').toUpperCase()}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                    <div style="margin-top:35px;">
                        <label style="font-weight:600; display:block; margin-bottom:10px;">Additional Comments (Optional)</label>
                        <textarea name="comments" style="width:100%; min-height:120px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; color:white; padding:15px;"></textarea>
                    </div>
                    <button type="submit" class="eval-submit-btn"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
                </form>`;
        }

        mobileHtml += `</div>`;
    });

    // ── Assemble full HTML ──
    apiArea.innerHTML = `
        <style>
            @media (min-width: 900px) {
                .lev-desktop-layout { display: flex !important; }
                .lev-mobile-list    { display: none !important; }
            }
            @media (max-width: 899px) {
                .lev-desktop-layout { display: none !important; }
                .lev-mobile-list    { display: block !important; }
            }

            .lev-desktop-layout {
                display: flex;
                gap: 0;
                height: calc(100vh - 140px);
                min-height: 500px;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 14px;
                overflow: hidden;
                margin-top: 12px;
            }

            .lev-sidebar {
                width: 280px;
                min-width: 240px;
                max-width: 300px;
                background: #0d1117;
                border-right: 1px solid rgba(255,255,255,0.07);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .lev-sidebar-header {
                padding: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #4fd1c5;
                text-transform: uppercase;
                flex-shrink: 0;
            }
            .lev-sidebar-scroll {
                flex: 1;
                overflow-y: auto;
                padding: 8px 0;
            }
            .lev-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .lev-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .lev-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lev-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            .lev-sidebar-item:hover { background: rgba(255,255,255,0.04); }
            .lev-sidebar-item.active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
            }
            .lev-sidebar-item-icon { flex-shrink: 0; opacity: 0.7; }
            .lev-sidebar-item-info { flex: 1; min-width: 0; }
            .lev-sidebar-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #c9d1d9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lev-sidebar-item.active .lev-sidebar-item-title { color: #e2e8f0; }
            .lev-sidebar-item-meta { font-size: 11px; color: #555e6a; margin-top: 2px; }
            .lev-sidebar-done-badge {
                background: rgba(34,197,94,0.1);
                color: #22c55e;
                border: 1px solid rgba(34,197,94,0.3);
                font-size: 10px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 6px;
                flex-shrink: 0;
            }
            .lev-sidebar-pending-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                background: #e67e22;
                flex-shrink: 0;
            }

            .lev-main-panel {
                flex: 1;
                background: #0d1117;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .lev-main-panel::-webkit-scrollbar { width: 5px; }
            .lev-main-panel::-webkit-scrollbar-track { background: transparent; }
            .lev-main-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            .lev-panel-empty {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #555e6a;
                gap: 12px;
                padding: 40px;
            }
            .lev-panel-empty svg { opacity: 0.3; }
            .lev-panel-empty p { font-size: 14px; margin: 0; }

            .lev-panel-content { padding: 28px 32px; overflow-y: auto; }
        </style>

        <!-- ═══ DESKTOP SPLIT LAYOUT ═══ -->
        <div class="lev-desktop-layout">
            <div class="lev-sidebar">
                <div class="lev-sidebar-header">All Evaluations</div>
                <div class="lev-sidebar-scroll">${sidebarHtml}</div>
            </div>
            <div class="lev-main-panel" id="lev-main-panel">
                <div class="lev-panel-empty">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="#4fd1c5" stroke-width="1.5" fill="none">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <p>Select an evaluation from the left</p>
                </div>
            </div>
        </div>

        <!-- ═══ MOBILE LIST (unchanged) ═══ -->
        <div class="lev-mobile-list">
            ${mobileHtml}
        </div>`;
}

// ─────────────────────────────────────────────
// DESKTOP PANEL: SELECT EVALUATION
// ─────────────────────────────────────────────
window.selectDesktopLearnerEvaluation = function(idx) {
    document.querySelectorAll('.lev-sidebar-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`lev-sidebar-${idx}`);
    if (sidebarItem) sidebarItem.classList.add('active');

    const evaluation = (window._allLearnerEvaluationsFlat || [])[idx];
    if (!evaluation) return;

    const panel = document.getElementById('lev-main-panel');
    if (!panel) return;

    let panelContent = '';

    if (evaluation.submitted) {
        panelContent = `
            <div style="text-align:center;padding:60px 20px;">
                <svg viewBox="0 0 24 24" width="52" height="52" stroke="#22c55e" stroke-width="1.5" fill="none" style="margin-bottom:16px;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div style="font-size:18px;font-weight:800;color:#22c55e;margin-bottom:8px;">Completed</div>
                <div style="font-size:14px;color:#8b949e;">You have already submitted this evaluation.</div>
            </div>`;
    } else {
        panelContent = `
            <div class="eval-description" style="margin-bottom:20px;">${evaluation.description || ''}</div>
            <form onsubmit="handleEvalSubmit(event, ${evaluation.id})">
                <input type="hidden" name="eval_id" value="${evaluation.id}">
                ${evaluation.statements.map(s => `
                    <div class="question-box">
                        <div class="question-text">${s.statement}</div>
                        <div class="eval-options">
                            ${['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'].map(val => `
                                <label class="option-label">
                                    <input type="radio" name="answer[${s.id}]" value="${val}" required>
                                    <span>${val.replace('_', ' ').toUpperCase()}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                <div style="margin-top:35px;">
                    <label style="font-weight:600; display:block; margin-bottom:10px;">Additional Comments (Optional)</label>
                    <textarea name="comments" style="width:100%; min-height:120px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; color:white; padding:15px;"></textarea>
                </div>
                <button type="submit" class="eval-submit-btn"><i class="fas fa-paper-plane"></i> Submit Feedback</button>
            </form>`;
    }

    panel.innerHTML = `
        <div class="lev-panel-content">
            <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.07);">
                <div style="font-size:20px;font-weight:800;color:#e2e8f0;margin-bottom:6px;">${evaluation.title}</div>
                <div style="font-size:13px;color:#8b949e;">by ${evaluation.teacher}</div>
            </div>
            ${panelContent}
        </div>`;
};

// Keep your handleEvalSubmit function exactly as it was...
window.handleEvalSubmit = async function(e, id) {
    e.preventDefault();
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/submit_evaluation.php', {
            method: 'POST',
            body: new FormData(e.target)
        });
        const res = await response.json();
        if (res.success) {
            window.evaluationCache = null; // Clear cache so it fetches fresh "Completed" state
            fetchEvaluations(); 
        } else {
            alert(res.message);
        }
    } catch (err) {
        alert("Submission failed.");
    } finally {
        if (loader) loader.style.display = 'none';
         if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};