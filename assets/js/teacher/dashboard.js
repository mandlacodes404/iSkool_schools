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
        if (typeof window.setTeacherActive === 'function') {
            window.setTeacherActive("teacher_manual");
        }
        if (apiArea) apiArea.style.display = 'block';
        if (iframe)  iframe.style.display  = 'none';

        const response = await fetch('partials/teacher_manual.html');
        const html = await response.text();
        if (apiArea) apiArea.innerHTML = html;
    };

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
                if (overlay) overlay.style.display = 'none';
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