window.announcementCache = null;

window.fetchAnnouncements = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 3. Match your main script's use of sessionStorage
    sessionStorage.setItem("lastLearnerPage", "announcement_list.php");
    if (typeof window.setActive === 'function') window.setActive("announcement_list.php");

    const apiArea = document.getElementById('api-content-area');
    const loader = document.getElementById("loaderOverlay");

    if (iframe) iframe.style.display = 'none';
    if (apiArea) apiArea.style.display = 'block';

    if (window.announcementCache) {
        renderAnnouncements(window.announcementCache);
        if (loader) loader.style.display = 'none'; 
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
       const response = await fetch('api/get_announcements.php');
        const data = await response.json();
        window.announcementCache = data; // Store in global cache
        renderAnnouncements(data);
    } catch (error) {
        apiArea.innerHTML = "<p style='color:red; text-align:center;'>Error loading announcements.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderAnnouncements(data) {
    const apiArea = document.getElementById('api-content-area');
    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<h2>Announcements</h2><p style='text-align:center; color:#888;'>No announcements found.</p>";
        return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let html = '<h2>Class Announcements</h2>';

    for (const [teacher, items] of Object.entries(data)) {
        html += `
            <div class="teacher-section" style="margin-bottom:20px; background: #1b1b1b; border-radius:12px; border:1px solid rgba(255,255,255,0.05); overflow:hidden;">
                <div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); color:#8b949e; font-size:16px;">
                    <i class="fas fa-user-tie" style="margin-right:10px;"></i> ${teacher}
                </div>
                <div style="padding:10px;">`;

        items.forEach(ann => {
            const isNew = new Date(ann.created_at) > sevenDaysAgo;
            html += `
                <div class="announcement-card" style="background: rgba(255,255,255,0.03); margin:10px 0; padding:15px; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0; color:#4fd1c5;"><i class="fas fa-bullhorn"></i> ${ann.title}</h4>
                        ${isNew ? '<span style="background:rgba(79,209,197,0.1); color:#4fd1c5; border:1px solid #4fd1c5; padding:2px 8px; font-size:10px; border-radius:4px; text-transform:uppercase;">New</span>' : ''}
                    </div>
                    <p style="margin:10px 0; font-size:14px; line-height:1.5; color:#e2e8f0;">${ann.message.replace(/\n/g, '<br>')}</p>
                    <small style="color:#8b949e; font-size:12px;">${ann.display_date}</small>
                </div>`;
        });

        html += `</div></div>`;
    }
    apiArea.innerHTML = html;
}