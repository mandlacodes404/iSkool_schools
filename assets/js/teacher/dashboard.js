document.addEventListener('DOMContentLoaded', function () {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('mobileOverlay');
    const loader   = document.getElementById('loaderOverlay');
    const apiArea  = document.getElementById('api-content-area');
    const iframe   = document.getElementById('mainFrame');
    window.loaderTimeout = null;

    // ─────────────────────────────────────────────
    // RESTORE LAST PAGE ON REFRESH
    // ─────────────────────────────────────────────
    const savedPage = sessionStorage.getItem("lastTeacherPage");

    if (savedPage === "teacher_announcements") {
        window.fetchTeacherAnnouncements();
    } else {
        // default home — we'll build this later
        if (apiArea) apiArea.style.display = 'block';
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
    window.toggleSidebar = function(forceClose = false) {
        const isOpen = sidebar.classList.contains('active');
        if (forceClose || isOpen) {
            sidebar.classList.remove('active');
            sidebar.classList.remove('desktop-open');
            if (overlay) overlay.style.display = 'none';
        } else {
            if (window.innerWidth <= 768) {
                sidebar.classList.add('active');
                if (overlay) overlay.style.display = 'block';
            }
        }
    };

    overlay?.addEventListener('click', () => toggleSidebar(true));

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE — DESKTOP
    // ─────────────────────────────────────────────
    window.toggleDesktopSidebar = function() {
        sidebar.classList.toggle('desktop-open');
    };

    document.getElementById('desktopMenuToggle')
        ?.addEventListener('click', toggleDesktopSidebar);

    // ─────────────────────────────────────────────
    // AUTO CLOSE SIDEBAR ON NAV CLICK
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
    // SETTINGS BUTTON
    // ─────────────────────────────────────────────
    document.getElementById('settingsBtn')?.addEventListener('click', function() {
        if (loader) loader.style.display = 'flex';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = 'teacher_settings.php';
        }
        if (apiArea) apiArea.style.display = 'none';
        toggleSidebar(true);
    });

    iframe?.addEventListener('load', () => {
        clearTimeout(window.loaderTimeout);
        if (loader) loader.style.display = 'none';
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
});