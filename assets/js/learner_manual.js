/**
 * Learner Manual API-style Loader
 * Fetches the static manual and injects it into the dashboard
 */

window.fetchManual = async function() {
    // 1. Set State and Update UI Highlighting
    localStorage.setItem("lastLearnerPage", "learner_manual.php");
    if (typeof window.setActive === 'function') {
        window.setActive("learner_manual.php");
    }

    const apiArea = document.getElementById('api-content-area');
    const iframe = document.getElementById('mainFrame');
    const loader = document.getElementById("loaderOverlay");

    // 2. Clear Iframe and show API Area
    if (iframe) iframe.style.display = 'none';
    if (apiArea) {
        apiArea.style.display = 'block';
        apiArea.innerHTML = ""; // Clear previous content
    }
    
    // 3. Show Loader
    if (loader) loader.style.display = 'flex';

    try {
        // 4. Fetch the learner_manual.php file
        const response = await fetch('learner_manual.php');
        if (!response.ok) throw new Error('Manual not found');
        
        const htmlText = await response.text();
        
        // 5. Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // 6. Extract the Content and the Styles
        const bodyContent = doc.body.innerHTML;
        const headStyles = doc.querySelectorAll('style');
        
        // 7. Inject Styles first (to ensure cards look right immediately)
        headStyles.forEach(styleTag => {
            document.head.appendChild(styleTag.cloneNode(true));
        });

        // 8. Inject the HTML Content
        apiArea.innerHTML = bodyContent;

    } catch (error) {
        console.error("Manual Load Error:", error);
        if (apiArea) {
            apiArea.innerHTML = `
                <div style="text-align:center; padding:50px; color:#8b949e;">
                    <i class="fas fa-exclamation-triangle" style="font-size:30px; color:#4fd1c5;"></i>
                    <p style="margin-top:15px;">Unable to load the manual. Please try again later.</p>
                </div>
            `;
        }
    } finally {
        // 9. Hide Loader
        if (loader) loader.style.display = 'none';
    }
};