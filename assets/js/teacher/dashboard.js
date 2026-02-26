document.addEventListener('DOMContentLoaded', function () {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('mobileOverlay');
    const loader   = document.getElementById('loaderOverlay');
    const apiArea  = document.getElementById('api-content-area');
    const iframe   = document.getElementById('mainFrame');
    window.loaderTimeout = null;

    // ─────────────────────────────────────────────
    // LOAD TEACHER MANUAL (defined once only)
    // ─────────────────────────────────────────────
   window.loadTeacherManual = async function() {
    sessionStorage.setItem("lastTeacherPage", "teacher_manual");
    if (typeof window.setTeacherActive === 'function') window.setTeacherActive("teacher_manual");
    if (apiArea) apiArea.style.display = 'block';
    if (iframe)  iframe.style.display  = 'none';

    try {
        const [manualRes, snapshotRes] = await Promise.all([
            fetch('partials/teacher_manual.html'),
            fetch('api/teacher/get_dashboard_snapshot.php')
        ]);
        const manualHtml = await manualRes.text();
        const snapshot   = await snapshotRes.json();

        // Desktop: two column layout. Mobile: manual only
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            apiArea.innerHTML = manualHtml;
        } else {
            apiArea.innerHTML = `
                <div class="dashboard-home-layout">
                    <div class="dashboard-snapshot-panel">
                        ${renderSnapshotPanel(snapshot)}
                    </div>
                    <div class="dashboard-manual-panel">
                        ${manualHtml}
                    </div>
                </div>`;
        }
    } catch(e) {
        console.error('Home load error:', e);
        const res = await fetch('partials/teacher_manual.html');
        const html = await res.text();
        if (apiArea) apiArea.innerHTML = html;
    }
};

function renderSnapshotPanel(data) {
    const cards = [
        {
            key:     'quiz',
            data:    data.quiz,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#4fd1c5" stroke-width="2" fill="none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            label:   'Latest Quiz',
            color:   '#4fd1c5',
            onclick: 'fetchTeacherQuizzes()',
            empty:   'No quizzes created yet',
            meta:    data.quiz ? `${data.quiz.class_name} &bull; ${data.quiz.start_time}` : '',
            badge:   data.quiz ? `<span class="snap-status-badge" style="background:${data.quiz.status === 'Open' ? 'rgba(242,140,56,0.15)' : 'rgba(107,114,128,0.15)'};color:${data.quiz.status === 'Open' ? '#f28c38' : '#6b7280'}">${data.quiz.status}</span>` : ''
        },
        {
            key:     'assignment',
            data:    data.assignment,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#a78bfa" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
            label:   'Upcoming Assignment',
            color:   '#a78bfa',
            onclick: 'fetchTeacherAssignments()',
            empty:   'No upcoming assignments',
            meta:    data.assignment ? `${data.assignment.class_name} &bull; Due ${data.assignment.due_date}` : '',
            badge:   data.assignment ? `<span class="snap-status-badge" style="background:rgba(167,139,250,0.15);color:#a78bfa;">in ${data.assignment.days_left} day${data.assignment.days_left !== 1 ? 's' : ''}</span>` : ''
        },
        {
            key:     'announcement',
            data:    data.announcement,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#f59e0b" stroke-width="2" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            label:   'Latest Announcement',
            color:   '#f59e0b',
            onclick: 'fetchTeacherAnnouncements()',
            empty:   'No announcements sent yet',
            meta:    data.announcement ? `${data.announcement.class_name} &bull; ${data.announcement.created_at}` : '',
            badge:   ''
        },
        {
            key:     'discussion',
            data:    data.discussion,
            icon:    `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#34d399" stroke-width="2" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
            label:   'Latest Discussion',
            color:   '#34d399',
            onclick: 'fetchTeacherDiscussions()',
            empty:   'No discussions yet',
            meta:    data.discussion ? `${data.discussion.class_name} &bull; ${data.discussion.created_at}` : '',
            badge:   data.discussion ? `<span class="snap-status-badge" style="background:rgba(52,211,153,0.15);color:#34d399;">${data.discussion.reply_count} ${data.discussion.reply_count === 1 ? 'reply' : 'replies'}</span>` : ''
        }
    ];

    let html = `<div class="snap-panel-title">Quick Snapshot</div>`;

    cards.forEach(card => {
        if (!card.data) {
            html += `
                <div class="snap-card snap-card-empty">
                    <div class="snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
                    <div class="snap-empty-text">${card.empty}</div>
                </div>`;
        } else {
            html += `
                <div class="snap-card" onclick="${card.onclick}">
                    <div class="snap-card-label" style="color:${card.color}">${card.icon} ${card.label}</div>
                    <div class="snap-card-title">${card.data.title}</div>
                    <div class="snap-card-meta">
                        ${card.meta}
                        ${card.badge}
                    </div>
                </div>`;
        }
    });

    return html;
}

    // ─────────────────────────────────────────────
    // RESTORE LAST PAGE ON REFRESH
    // ─────────────────────────────────────────────
    const savedPage = sessionStorage.getItem("lastTeacherPage");

    if (savedPage === "teacher_announcements") {
        window.fetchTeacherAnnouncements();
    } else if (savedPage === "teacher_quizzes") {
        window.fetchTeacherQuizzes();
    } else if (savedPage === "teacher_evaluations") {
        window.fetchTeacherEvaluations();
    } else if (savedPage === "teacher_resources") {
        window.fetchTeacherResources();
    } else if (savedPage === "teacher_assignments") {
        window.fetchTeacherAssignments();
    } else if (savedPage === "teacher_analytics") {
        window.fetchTeacherAnalytics();
    } else if (savedPage === "teacher_discussions") {
        window.fetchTeacherDiscussions();
    } else if (savedPage === "teacher_grades") {
        window.fetchTeacherGrades();
    } else {
        window.loadTeacherManual();
    }

    // ─────────────────────────────────────────────
    // ACTIVE STATE
    // ─────────────────────────────────────────────
    window.setTeacherActive = function(page) {
        document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === page);
        });
    };

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — MOBILE
    // ─────────────────────────────────────────────
 window.toggleDesktopSidebar = function() {
    sidebar.classList.toggle('desktop-open');
    const svg = document.querySelector('#toggleIcon svg');
    if (svg) {
        const isOpen = sidebar.classList.contains('desktop-open');
        svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

 overlay?.addEventListener('click', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('desktop-open');
    } else {
        toggleSidebar(true);
    }
});

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — DESKTOP
    // ─────────────────────────────────────────────
    window.toggleDesktopSidebar = function() {
        sidebar.classList.toggle('desktop-open');
        const collapsed = !sidebar.classList.contains('desktop-open');
        const svg = document.querySelector('#toggleIcon svg');
        if (svg) {
            svg.style.transform = collapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    };

    document.getElementById('desktopMenuToggle')
        ?.addEventListener('click', toggleDesktopSidebar);

    // ─────────────────────────────────────────────
    // RESTORE DESKTOP SIDEBAR STATE
    // ─────────────────────────────────────────────
    if (window.innerWidth > 768) {
        const saved = localStorage.getItem('sidebarCollapsed') === 'true';
        if (saved) {
            sidebar.classList.add('desktop-open');
        }
    }

    // ─────────────────────────────────────────────
    // AUTO CLOSE SIDEBAR ON NAV CLICK + LOADER
    // ─────────────────────────────────────────────
    document.querySelectorAll('.sidebar a, #mobileBottomNav a').forEach(link => {
        link.addEventListener('click', () => {

            if (sidebar.classList.contains('active') ||
                sidebar.classList.contains('desktop-open')) {
                sidebar.classList.remove('active');
                sidebar.classList.remove('desktop-open');
                
            }
        });
    });

    // ─────────────────────────────────────────────
    // IFRAME LOAD — HIDE LOADER + SAVE STATE
    // ─────────────────────────────────────────────
    iframe?.addEventListener('load', () => {
        clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';

        try {
            const fullPage = iframe.contentWindow.location.pathname.split("/").pop()
                           + iframe.contentWindow.location.search;
            if (fullPage && !fullPage.startsWith('blank.php') && fullPage !== '') {
                sessionStorage.setItem("lastTeacherPage", fullPage);
            }
        } catch (e) {
            console.log("External or restricted page loaded, cannot save state.");
        }
    });

    // ─────────────────────────────────────────────
    // SETTINGS BUTTON
    // ─────────────────────────────────────────────
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        if (loader) loader.style.display = 'flex';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'teacher_settings.php';
        }
        if (apiArea) apiArea.style.display = 'none';

        document.querySelectorAll('.sidebar a').forEach(link => {
            link.classList.remove('active');
        });

        toggleSidebar(true);
    });

    // ─────────────────────────────────────────────
    // PROFILE UPLOAD
    // ─────────────────────────────────────────────
    const avatarWrapper = document.querySelector('.profile-picture-wrapper');
    const profileInput  = document.getElementById('teacherProfileInput');

    avatarWrapper?.addEventListener('click', () => profileInput.click());

    profileInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        updateTeacherAvatar(previewUrl);

        const fd = new FormData();
        fd.append('profile', file);

        fetch('upload_teacher_profile.php', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    updateTeacherAvatar('uploads/teachers/' + d.file + '?t=' + Date.now());
                } else {
                    alert(d.error || 'Upload failed');
                }
                profileInput.value = '';
            })
            .catch(() => {
                alert('Connection error during upload');
                profileInput.value = '';
            });
    });

    function updateTeacherAvatar(url) {
        let img = avatarWrapper.querySelector('img');
        if (img) {
            img.src = url;
        } else {
            const initials = avatarWrapper.querySelector('.initials-avatar');
            if (initials) initials.remove();
            const newImg = document.createElement('img');
            newImg.className = 'teacher-avatar';
            newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            newImg.src = url;
            avatarWrapper.insertBefore(newImg, profileInput);
        }
    }

    if (loader) loader.style.display = 'none';
    clearTimeout(window.loaderTimeout);
});