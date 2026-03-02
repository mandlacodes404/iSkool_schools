/* assets/js/discussions.js */
window.discussionCache = null;

window.fetchDiscussions = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "discussion_list.php");
    if (typeof window.setActive === 'function') window.setActive("discussion_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Discussions', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Preparation
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4. CACHE CHECK
    if (window.discussionCache) {
        renderDiscussions(window.discussionCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/learner/get_discussions.php');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        window.discussionCache = data; 
        renderDiscussions(data);
    } catch (error) {
        console.error("Discussion Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading discussions.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderDiscussions(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    // Start with the Action Header (New Button only, Title is in the Main Header now)
    let html = `
        <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:20px; padding: 0 10px;">
            <button onclick="window.open('create_discussion.php', '_blank')" 
                    style="background:rgba(79, 209, 197, 0.1); color:#4fd1c5; border:1px solid rgba(79,209,197,0.3); padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:bold; transition: 0.3s;">
                <i class="fas fa-plus"></i> Start Discussion
            </button>
        </div>
    `;

    if (data.length === 0) {
        html += "<p style='text-align:center; color:#8b949e; padding:40px;'>No discussions yet. Be the first to start one!</p>";
    } else {
        data.forEach(d => {
            html += `
                <div class="disc-card" style="background:#1b1b1b; border:1px solid rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin-bottom:15px; cursor:pointer;" 
                     onclick="window.open('view_discussion.php?id=${d.id}', '_blank')">
                    <h3 style="margin:0 0 10px 0; color:#e2e8f0; font-size:18px;">${d.title}</h3>
                    <div style="font-size:13px; color:#8b949e; margin-bottom:12px; display:flex; gap:10px; align-items:center;">
                        <span>Started by ${d.creator_display}</span>
                        <span>•</span>
                        <span>${d.display_date}</span>
                        <span style="background:rgba(79,209,197,0.1); color:#4fd1c5; padding:2px 10px; border-radius:12px; font-weight:bold;">
                            ${d.reply_count} ${d.reply_count == 1 ? 'reply' : 'replies'}
                        </span>
                    </div>
                    <p style="margin:0; font-size:14px; color:#abb2bf; line-height:1.4;">${d.preview}</p>
                </div>
            `;
        });
    }
    
    apiArea.innerHTML = html;
}