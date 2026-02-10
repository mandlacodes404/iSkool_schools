/* assets/js/resources.js */
window.resourceCache = null;

window.fetchResources = async function() {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);

    // 1. SAVE STATE & UI Highlighting
    sessionStorage.setItem("lastLearnerPage", "resource_list.php");
    if (typeof window.setActive === 'function') window.setActive("resource_list.php");

    // 2. UPDATE DYNAMIC HEADER
    if (window.configureHeader) {
        window.configureHeader({ title: 'Resources', mode: 'standard' });
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Preparation
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4. CACHE CHECK (Instant Load)
    if (window.resourceCache) {
        renderResourceCards(window.resourceCache);
        if (loader) loader.style.display = 'none';
        return;
    }

    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('api/get_resources.php');
        if (!response.ok) throw new Error('Failed to fetch resources');
        const data = await response.json();
        window.resourceCache = data; 
        renderResourceCards(data);
    } catch (error) {
        console.error("Resource Fetch Error:", error);
        if (apiArea) {
            apiArea.innerHTML = "<p style='color:#ff5555; text-align:center; margin-top:50px;'>Error loading resources.</p>";
        }
    } finally {
        if (loader) loader.style.display = 'none';
        if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    }
};

function renderResourceCards(data) {
    const apiArea = document.getElementById('api-content-area');
    if (!apiArea) return;

    if (Object.keys(data).length === 0) {
        apiArea.innerHTML = "<p style='text-align:center; color:#888; margin-top:60px;'>No resources found.</p>";
        return;
    }

    let html = ''; 

    for (const [teacher, files] of Object.entries(data)) {
        html += `<h3 style="margin: 20px 15px 10px;">${teacher}</h3>`;
        files.forEach(file => {
            const icon = getFileIcon(file.ext);
            
            html += `
                <div class="quiz-card resource-item">
                    <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                        <i class="${icon}" style="color: #4fd1c5; font-size: 20px;"></i>
                        <div>
                            <h4 style="margin:0; font-size:15px;">
                                ${file.title} 
                                <span style="font-size: 11px; color: #aaa; font-weight: normal; margin-left: 5px;">
                                    (${file.size || 'N/A'})
                                </span>
                            </h4>
                            <div style="margin-top: 4px;">
                                <small style="color:#888;">
                                    <i class="fas fa-calendar-alt" style="font-size: 10px;"></i> Uploaded: ${file.uploaded_at}
                                </small>
                            </div>
                        </div>
                    </div>

                    <a href="javascript:void(0)" 
   onclick="viewDocument('${file.path}', '${file.title.replace(/'/g, "\\'")}')" 
   style="color: #4fd1c5; text-decoration: none; font-size: 18px; padding: 5px;">
    <i class="fas fa-eye"></i>
</a>

                       
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
    
    
    // Here you would trigger your #resourcePopup logic from the original file
    // For now, let's keep it simple:
    window.open(path, '_blank'); 
};