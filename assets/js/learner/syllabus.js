window.syllabusCache = null;

window.fetchSyllabus = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    sessionStorage.setItem('lastLearnerPage', 'syllabus');
    if (typeof window.setActive === 'function') window.setActive('syllabus');
    if (typeof window.configureHeader === 'function') {
        window.configureHeader({ title: 'Syllabus', mode: 'standard' });
    }

    const apiArea        = document.getElementById('api-content-area');
    const iframe         = document.getElementById('mainFrame');
    const loader         = document.getElementById('loaderOverlay');
    const myClassContent = document.getElementById('myClassContent');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';
    if (myClassContent) myClassContent.classList.remove('active');

    // Serve from cache instantly
    if (window.syllabusCache) {
        apiArea.innerHTML = renderSyllabusPage(window.syllabusCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/learner/get_sbo.php');
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        window.syllabusCache = data;
        apiArea.innerHTML = renderSyllabusPage(data);

    } catch (err) {
        console.error('Syllabus fetch error:', err);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center;margin-top:60px;padding:20px;">
                    <p style="color:#ff5555;">Unable to load syllabus.</p>
                    <button onclick="window.syllabusCache=null; fetchSyllabus()"
                            style="background:#4fd1c5;border:none;padding:8px 16px;
                                   border-radius:8px;color:#0d1117;font-weight:700;cursor:pointer;">
                        Try Again
                    </button>
                </div>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

// ─────────────────────────────────────────────
// RENDER FULL PAGE
// ─────────────────────────────────────────────
function renderSyllabusPage(data) {
    const briefs      = data.briefs      || [];
    const currentTerm = data.current_term || 1;

    if (!briefs.length) {
        return `
            <div style="text-align:center;margin-top:80px;padding:20px;">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="#8b949e"
                     stroke-width="1.5" fill="none" style="margin-bottom:16px;">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <p style="color:#8b949e;font-size:15px;">No syllabus briefs have been posted yet.</p>
                <p style="color:#8b949e;font-size:13px;">Your teachers will post them here each term.</p>
            </div>`;
    }

    // Group by term
    const byTerm = {};
    briefs.forEach(b => {
        if (!byTerm[b.term]) byTerm[b.term] = [];
        byTerm[b.term].push(b);
    });

    // Build term tabs
    const terms     = Object.keys(byTerm).map(Number).sort();
    const activeTerm = terms.includes(currentTerm) ? currentTerm : terms[0];

    const tabsHtml = terms.map(t => `
        <button class="syl-tab ${t === activeTerm ? 'syl-tab-active' : ''}"
                onclick="switchSylTab(${t})"
                id="syl-tab-${t}">
            Term ${t} ${t === currentTerm ? '<span class="syl-current-badge">Current</span>' : ''}
        </button>`).join('');

    const panelsHtml = terms.map(t => `
        <div class="syl-panel" id="syl-panel-${t}"
             style="display:${t === activeTerm ? 'block' : 'none'};">
            <div class="syl-cards-grid">
                ${byTerm[t].map(b => renderBriefCard(b)).join('')}
            </div>
        </div>`).join('');

    return `
        <style>
            .syl-wrapper {
                max-width: 900px;
                margin: 0 auto;
                padding: 24px 20px;
            }
            .syl-page-title {
                font-size: 20px;
                font-weight: 900;
                color: #e2e8f0;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            /* Tabs */
            .syl-tabs {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 24px;
            }
            .syl-tab {
                padding: 8px 16px;
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,0.1);
                background: transparent;
                color: #8b949e;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .syl-tab:hover {
                border-color: #4fd1c5;
                color: #4fd1c5;
            }
            .syl-tab-active {
                background: rgba(79,209,197,0.15);
                border-color: #4fd1c5;
                color: #4fd1c5;
            }
            .syl-current-badge {
                background: rgba(79,209,197,0.2);
                color: #4fd1c5;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: 800;
            }
            /* Cards grid */
            .syl-cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 16px;
            }
            /* Brief card */
            .syl-card {
                background: #161b22;
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 16px;
                padding: 20px;
                transition: border-color 0.2s ease;
            }
            .syl-card:hover {
                border-color: rgba(79,209,197,0.3);
            }
            .syl-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 16px;
            }
            .syl-subject {
                font-size: 16px;
                font-weight: 900;
                color: #e2e8f0;
                line-height: 1.3;
            }
            .syl-teacher {
                font-size: 12px;
                color: #8b949e;
                margin-top: 3px;
                font-weight: 600;
            }
            .syl-updated {
                font-size: 11px;
                color: #8b949e;
                white-space: nowrap;
                flex-shrink: 0;
            }
            /* Section titles inside card */
            .syl-section-title {
                font-size: 11px;
                font-weight: 800;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin: 14px 0 8px;
            }
            /* Topics list */
            .syl-topics {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .syl-topics li {
                font-size: 13px;
                color: #c9d1d9;
                padding: 5px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
            }
            .syl-topics li:last-child {
                border-bottom: none;
            }
            .syl-topics li::before {
                content: '';
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: #4fd1c5;
                flex-shrink: 0;
            }
            /* Assessment weighting */
            .syl-assess-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04);
            }
            .syl-assess-row:last-child {
                border-bottom: none;
            }
            .syl-assess-type {
                font-size: 13px;
                color: #c9d1d9;
                font-weight: 600;
            }
            .syl-assess-weight {
                font-size: 13px;
                font-weight: 900;
                color: #4fd1c5;
            }
            .syl-assess-bar-wrap {
                width: 100%;
                height: 3px;
                background: rgba(255,255,255,0.06);
                border-radius: 2px;
                margin-top: 4px;
                overflow: hidden;
            }
            .syl-assess-bar {
                height: 100%;
                border-radius: 2px;
                background: #4fd1c5;
            }
            /* Notes */
            .syl-notes {
                font-size: 12px;
                color: #8b949e;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                padding: 10px 12px;
                margin-top: 14px;
                line-height: 1.5;
                border-left: 3px solid rgba(79,209,197,0.3);
            }
            @media (max-width: 480px) {
                .syl-cards-grid {
                    grid-template-columns: 1fr;
                }
                .syl-wrapper {
                    padding: 16px 14px;
                }
            }
        </style>

        <div class="syl-wrapper">
            <div class="syl-page-title">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="#4fd1c5"
                     stroke-width="2" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <line x1="12" y1="6" x2="16" y2="6"/>
                    <line x1="12" y1="10" x2="16" y2="10"/>
                    <line x1="12" y1="14" x2="16" y2="14"/>
                </svg>
                Subject Briefs & Outlines
            </div>

            <div class="syl-tabs">${tabsHtml}</div>
            ${panelsHtml}
        </div>`;
}

// ─────────────────────────────────────────────
// RENDER SINGLE BRIEF CARD
// ─────────────────────────────────────────────
function renderBriefCard(brief) {
    const updatedDate = new Date(brief.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    });

    // Topics
    const topicsHtml = brief.topics.length
        ? `<div class="syl-section-title">Syllabus Topics</div>
           <ul class="syl-topics">
               ${brief.topics.map(t => `<li>${t}</li>`).join('')}
           </ul>`
        : '';

    // Assessment weighting — bar colours cycle through a palette
    const barColours = ['#4fd1c5', '#a78bfa', '#f28c38', '#f472b6', '#fdd663', '#34d399'];
    const assessHtml = brief.assessments.length
        ? `<div class="syl-section-title">Assessment Weighting</div>
           ${brief.assessments.map((a, i) => {
               const colour = barColours[i % barColours.length];
               return `
                   <div class="syl-assess-row">
                       <span class="syl-assess-type">${a.type}</span>
                       <span class="syl-assess-weight" style="color:${colour};">${a.weight}%</span>
                   </div>
                   <div class="syl-assess-bar-wrap">
                       <div class="syl-assess-bar"
                            style="width:${a.weight}%;background:${colour};"></div>
                   </div>`;
           }).join('')}`
        : '';

    // Notes
    const notesHtml = brief.notes
        ? `<div class="syl-notes">📝 ${brief.notes}</div>`
        : '';

    return `
        <div class="syl-card">
            <div class="syl-card-header">
                <div>
                    <div class="syl-subject">${brief.subject}</div>
                    <div class="syl-teacher">${brief.teacher}</div>
                </div>
                <div class="syl-updated">${updatedDate}</div>
            </div>
            ${topicsHtml}
            ${assessHtml}
            ${notesHtml}
        </div>`;
}

// ─────────────────────────────────────────────
// TAB SWITCHER
// ─────────────────────────────────────────────
window.switchSylTab = function(term) {
    // Hide all panels
    document.querySelectorAll('.syl-panel').forEach(p => p.style.display = 'none');
    // Deactivate all tabs
    document.querySelectorAll('.syl-tab').forEach(t => {
        t.classList.remove('syl-tab-active');
    });
    // Show selected
    const panel = document.getElementById(`syl-panel-${term}`);
    const tab   = document.getElementById(`syl-tab-${term}`);
    if (panel) panel.style.display = 'block';
    if (tab)   tab.classList.add('syl-tab-active');
};