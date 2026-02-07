/* assets/js/resources.js */
let resourceCache = null;

window.fetchResources = async function() {
    localStorage.setItem("lastLearnerPage", "resource_list.php");
    if (typeof window.setActive === 'function') window.setActive("resource_list.php");

    const apiArea = document.getElementById('api-content-area');
    const loader = document.getElementById("loaderOverlay");

    // UI Toggle
    document.getElementById('mainFrame').style.display = 'none';
    apiArea.style.display = 'block';

    if (resourceCache) {
        renderResourceCards(resourceCache);
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_resources.php');
        const data = await response.json();
        resourceCache = data;
        renderResourceCards(data);
    } catch (error) {
        apiArea.innerHTML = "<p style='color:red; text-align:center;'>Error loading resources.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
    }
};

function renderResourceCards(data) {
    const apiArea = document.getElementById('api-content-area');
    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<h2>Resources</h2><p style='text-align:center; color:#888;'>No resources found.</p>";
        return;
    }

    let html = '<h2>Study Resources</h2>';

    for (const [teacher, files] of Object.entries(data)) {
        html += `<h3>${teacher}</h3>`;
        files.forEach(file => {
            const icon = getFileIcon(file.ext);
            html += `
                <div class="quiz-card resource-item" data-title="${file.title}" data-date="${file.uploaded_at}" data-path="${file.path}">
                    <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                        <i class="${icon}" style="color: #4fd1c5; font-size: 20px;"></i>
                        <div>
                            <h4 style="margin:0; font-size:15px;">${file.title}</h4>
                            <small style="color:#888;">Uploaded: ${file.uploaded_at}</small>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button onclick="openResourceMenu(this)" class="menu-dots" style="background:none; border:none; color:white; cursor:pointer;">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>`;
        });
    }
    apiArea.innerHTML = html;
}

function getFileIcon(ext) {
    if (ext === 'pdf') return 'fas fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fas fa-file-word';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'fas fa-file-image';
    return 'fas fa-file-alt';
}

// Reuse your Menu Logic
window.openResourceMenu = function(btn) {
    const card = btn.closest('.resource-item');
    const path = card.dataset.path;
    const title = card.dataset.title;
    
    // Here you would trigger your #resourcePopup logic from the original file
    // For now, let's keep it simple:
    window.open(path, '_blank'); 
};