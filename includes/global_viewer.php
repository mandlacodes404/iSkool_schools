<style>
    #globalViewer {
        display: none; 
        position: fixed; 
        inset: 0; 
        z-index: 99999; 
        background: rgba(13, 17, 23, 0.95); 
        backdrop-filter: blur(12px); 
        -webkit-backdrop-filter: blur(12px);
        animation: fadeInViewer 0.3s ease-out;
    }

    @keyframes fadeInViewer {
        from { opacity: 0; transform: scale(1.02); }
        to { opacity: 1; transform: scale(1); }
    }

    .viewer-header {
        height: 70px; 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        padding: 0 25px; 
        border-bottom: 1px solid rgba(255,255,255,0.1); 
        background: rgba(22, 27, 34, 0.5);
    }

    .back-btn {
        background: none; 
        border: none; 
        color: #4fd1c5; 
        font-size: 14px; 
        cursor: pointer; 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        font-family: 'Nunito', sans-serif; 
        font-weight: 700;
        letter-spacing: 1px;
        transition: transform 0.2s;
    }

    .back-btn:hover { transform: translateX(-5px); }
</style>

<div id="globalViewer">
    <div class="viewer-header">
        <button onclick="closeGlobalViewer()" class="back-btn">
            <i class="fas fa-chevron-left"></i> BACK
        </button>

        <div id="viewerTitle" style="color:white; font-size:15px; font-weight:600; text-align:center; max-width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            Preview
        </div>

        <div style="width: 80px; text-align: right;">
            <a id="viewerDownloadBtn" href="#" download style="color:#4fd1c5; font-size:18px; text-decoration:none;">
                <i class="fas fa-download"></i>
            </a>
        </div>
    </div>

    <div id="viewerContent" style="height: calc(100% - 70px); width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
        </div>
</div>