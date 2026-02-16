/* assets/js/manual.js */
window.manualCache = null;

window.loadManual = async function(containerId = 'api-content-area') {
    if (typeof window.loaderTimeout !== 'undefined') clearTimeout(window.loaderTimeout);
    
    // 1. Set State
    sessionStorage.setItem("lastLearnerPage", "partials/manual.html");
    if (typeof window.setActive === 'function') window.setActive("partials/manual.html");

    // 2. Update Header
    if (window.configureHeader) {
        window.configureHeader({ title: 'Home', mode: 'standard' });
    }

    const apiArea = document.getElementById(containerId);
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");
    const myClassContent = document.getElementById("myClassContent");

    // 3. UI Toggle
    if (apiArea) apiArea.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (myClassContent) myClassContent.classList.remove("active");

    // 4. Cache Check (Instant load if already fetched once)
    if (window.manualCache) {
        apiArea.innerHTML = window.manualCache;
        return;
    }

    // 5. Direct Fetch
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch('partials/manual.html?v=1.1');
        const html = await response.text();
        
        // Ensure your manual.css is linked
        if (!document.getElementById('manual-style')) {
            const link = document.createElement('link');
            link.id = 'manual-style';
            link.rel = 'stylesheet';
            link.href = 'assets/css/manual.css';
            document.head.appendChild(link);
        }

        window.manualCache = html; 
        apiArea.innerHTML = html;
    } catch (error) {
        console.error("Manual Load Failed:", error);
        apiArea.innerHTML = "<p style='color:red; text-align:center; margin-top:50px;'>Manual could not be loaded.</p>";
    } finally {
        if (loader) loader.style.display = 'none';
    }
};