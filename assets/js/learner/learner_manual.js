/**
 * Learner Manual API-style Loader
 * Fetches the static manual and injects it into the dashboard
 */

function saveLearnerManualPageState() {
    const mainContent = document.querySelector('.main-content');
    const state = {
        scrollTop: mainContent ? mainContent.scrollTop : 0,
    };
    if (window.learnerPageState) window.learnerPageState.set('learner_manual', state);
    else sessionStorage.setItem('learnerManualPageState', JSON.stringify(state));
}

function restoreLearnerManualPageState() {
    try {
        const state = window.learnerPageState
            ? window.learnerPageState.get('learner_manual')
            : JSON.parse(sessionStorage.getItem('learnerManualPageState') || '{}');
        if (!state || Object.keys(state).length === 0) return;
        requestAnimationFrame(() => {
            const mainContent = document.querySelector('.main-content');
            if (mainContent && Number.isFinite(state.scrollTop)) mainContent.scrollTop = state.scrollTop;
        });
    } catch (e) { /* ignore bad state */ }
}

function wireLearnerManualScrollState() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent || mainContent.dataset.learnerManualScrollState === '1') return;
    mainContent.dataset.learnerManualScrollState = '1';
    mainContent.addEventListener('scroll', () => {
        saveLearnerManualPageState();
    }, { passive: true });
}

window.fetchManual = async function() {
    // 1. Set State and Update UI Highlighting
    localStorage.setItem("lastLearnerPage", "partials/manual.html");
    if (typeof window.setActive === 'function') {
        window.setActive("partials/manual.html");
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
        // 4. Fetch the current static manual fragment.
        const response = await fetch('partials/manual.html');
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
        restoreLearnerManualPageState();
        wireLearnerManualScrollState();

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
