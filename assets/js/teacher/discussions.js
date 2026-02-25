window.teacherDiscussionsCache = null;

window.fetchTeacherDiscussions = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_discussions");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_discussions");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherDiscussionsCache) {
        renderTeacherDiscussions(window.teacherDiscussionsCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const res  = await fetch('api/teacher/get_discussions.php');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        window.teacherDiscussionsCache = data;
        renderTeacherDiscussions(data);
    } catch (e) {
        console.error('Discussions error:', e);
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555;text-align:center;margin-top:50px;">
                Error loading discussions.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderTeacherDiscussions(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    const discussions = data.discussions || [];
    const reports     = data.reports     || [];

    let html = `
        <div class="teacher-resources-header">
            <h2 class="teacher-resources-title">Discussions</h2>
        </div>`;

    // ── REPORTS SECTION ──
    html += `
        <div class="teacher-disc-section-title">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#f85149" stroke-width="2" fill="none"
                style="margin-right:6px;flex-shrink:0;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Reports
            ${reports.length > 0
                ? `<span class="teacher-disc-report-count">${reports.length}</span>`
                : ''}
        </div>`;

    if (reports.length === 0) {
        html += `
            <div class="teacher-disc-empty" style="margin-bottom:32px;">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="#22c55e" stroke-width="2" fill="none"
                    style="margin-bottom:8px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <p>No reports yet — great job keeping things respectful!</p>
            </div>`;
    } else {
        reports.forEach(rep => {
            html += `
                <div class="teacher-disc-report-card">
                    <div class="teacher-disc-report-reason">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"
                            style="margin-right:5px;flex-shrink:0;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        ${rep.reason}
                    </div>
                    <div class="teacher-disc-report-meta">
                        Reported by <strong>${rep.reporter_name}</strong>
                    </div>
                    <div class="teacher-disc-report-content">
                        ${rep.reply_text
                            ? `<strong>Post:</strong> ${rep.reply_text.replace(/\n/g, '<br>')}`
                            : `<strong>Discussion:</strong> ${rep.title || ''}`}
                    </div>
                    ${rep.comment
                        ? `<div class="teacher-disc-report-comment">
                               <strong>Comment:</strong> ${rep.comment.replace(/\n/g, '<br>')}
                           </div>`
                        : ''}
                </div>`;
        });
    }

    // ── DISCUSSIONS SECTION ──
    html += `
        <div class="teacher-disc-section-title" style="margin-top:32px;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#4fd1c5" stroke-width="2" fill="none"
                style="margin-right:6px;flex-shrink:0;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Tagged Discussions
        </div>`;

    if (discussions.length === 0) {
        html += `
            <div class="teacher-disc-empty">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="#8b949e" stroke-width="2" fill="none"
                    style="margin-bottom:8px;">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>You haven't been tagged in any discussions yet.</p>
            </div>`;
    } else {
        discussions.forEach(d => {
            html += `
                <div class="teacher-disc-card" onclick="window.open('view_discussion.php?id=${d.id}', '_blank')">
                    <div class="teacher-disc-card-title">${d.title}</div>
                    <div class="teacher-disc-card-meta">
                        <span>
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"
                                style="margin-right:3px;vertical-align:middle;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                            </svg>
                            ${d.class_name}
                        </span>
                        <span>•</span>
                        <span>${d.created_at}</span>
                        <span class="teacher-disc-reply-badge">
                            ${d.reply_count} ${d.reply_count === 1 ? 'reply' : 'replies'}
                        </span>
                    </div>
                </div>`;
        });
    }

    apiArea.innerHTML = html;
}