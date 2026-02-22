window.teacherAnnouncementCache = null;

window.fetchTeacherAnnouncements = async function() {
    clearTimeout(window.loaderTimeout);
    sessionStorage.setItem("lastTeacherPage", "teacher_announcements");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_announcements");

    const apiArea = document.getElementById('api-content-area');
    const iframe  = document.getElementById('mainFrame');
    const loader  = document.getElementById('loaderOverlay');

    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    if (window.teacherAnnouncementCache) {
        renderTeacherAnnouncements(window.teacherAnnouncementCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/teacher/get_announcements.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.teacherAnnouncementCache = data;
        renderTeacherAnnouncements(data);
    } catch (error) {
        if (apiArea) apiArea.innerHTML = `
            <p style="color:#ff5555; text-align:center; margin-top:50px;">
                Error loading announcements.
            </p>`;
    } finally {
        if (loader) loader.style.display = 'none';
          if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderTeacherAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (!data || data.length === 0) {
        apiArea.innerHTML = `
            <p class="teacher-empty-state">No announcements sent yet.</p>`;
        return;
    }

    let html = '';

    data.forEach((group, groupIndex) => {
        html += `
            <div class="teacher-class-group">
                <div class="teacher-class-header" onclick="toggleAnnouncementGroup(${groupIndex})">
                    <span class="teacher-class-name">${group.class_name}</span>
                    <span class="teacher-class-count">${group.items.length} announcement${group.items.length !== 1 ? 's' : ''}</span>
                    <svg class="teacher-chevron" id="chevron-${groupIndex}" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="teacher-class-items" id="group-${groupIndex}">`;

        group.items.forEach((ann, i) => {
            html += `
                <div class="teacher-announcement-card">
                    <div class="teacher-announcement-header" onclick="toggleAnnouncementDetail('ann-${groupIndex}-${i}', this)">
                        <span class="teacher-announcement-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:8px; vertical-align:middle;">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                            ${ann.title}
                        </span>
                        <svg class="teacher-chevron-sm" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="teacher-announcement-detail" id="ann-${groupIndex}-${i}">
                        <p class="teacher-announcement-message">${ann.message.replace(/\n/g, '<br>')}</p>
                        <small class="teacher-announcement-date">${ann.display_date}</small>
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    });

    apiArea.innerHTML = html;
}

window.toggleAnnouncementGroup = function(index) {
    const group   = document.getElementById(`group-${index}`);
    const chevron = document.getElementById(`chevron-${index}`);
    const isOpen  = group.classList.toggle('open');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.toggleAnnouncementDetail = function(id, headerEl) {
    const detail  = document.getElementById(id);
    const chevron = headerEl.querySelector('.teacher-chevron-sm');
    const isOpen  = detail.classList.toggle('open');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
};