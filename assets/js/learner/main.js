/**
 * main.js - Global Platform Logic
 * This handles shared components like the Global Document Viewer.
 */

window.viewDocument = function(url, title) {
    const viewer = document.getElementById('globalViewer');
    const content = document.getElementById('viewerContent');
    const titleArea = document.getElementById('viewerTitle');
    const downloadBtn = document.getElementById('viewerDownloadBtn');

    if (!viewer || !content) {
        console.error("Platform Error: Global Viewer components not found in DOM.");
        return;
    }

    // 1. Prepare UI
    titleArea.innerText = title;
    downloadBtn.href = url;
    downloadBtn.setAttribute('download', title);
    
    // Show loading spinner
    content.innerHTML = '<div style="color:#4fd1c5;"><i class="fas fa-circle-notch fa-spin fa-3x"></i></div>';
    
    // 2. Open Viewer Overlay
    viewer.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // 3. Render Content based on Extension
    const ext = url.split('.').pop().toLowerCase();

    // Use a small timeout so the 'block' display renders before the heavy iframe/image
    setTimeout(() => {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            content.innerHTML = `<img src="${url}" style="max-width:95%; max-height:95%; object-fit:contain; border-radius:8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">`;
        } 
        else if (ext === 'pdf') {
            // World-class PDF delivery
            content.innerHTML = `<iframe src="${url}#toolbar=0" style="width:100%; height:100%; border:none;"></iframe>`;
        } 
        else {
            // Fallback for Word, Excel, etc.
            content.innerHTML = `
                <div style="text-align:center; background:#1c2128; padding:40px; border-radius:15px; border:1px solid #30363d; margin:20px; max-width:400px;">
                    <i class="fas fa-file-download" style="font-size:50px; color:#4fd1c5; margin-bottom:15px;"></i>
                    <h3 style="color:white; margin-bottom:10px;">Preview Not Available</h3>
                    <p style="color:#8b949e; margin-bottom:20px;">The browser cannot preview .${ext.toUpperCase()} files directly.</p>
                    <a href="${url}" download="${title}" class="quiz-start-btn" style="text-decoration:none; display:inline-block; padding: 10px 25px;">Download to View</a>
                </div>`;
        }
    }, 100);
};

window.closeGlobalViewer = function() {
    const viewer = document.getElementById('globalViewer');
    const content = document.getElementById('viewerContent');
    
    if (viewer) viewer.style.display = 'none';
    if (content) content.innerHTML = ''; 
    document.body.style.overflow = 'auto'; // Restore scrolling
};

// Global listener for Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeGlobalViewer();
});