// ═══════════════════════════════════════════════════════
// CLASSES SECTION — iSkool School Admin
// Simple control-panel style class management
// ═══════════════════════════════════════════════════════

(function injectClassStyles() {
    if (document.getElementById('sd-class-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-class-styles';
    s.textContent = `
        /* ── CLASSES WRAPPER ── */
        .cls-wrapper {
            padding: 24px;
            max-width: 860px;
        }

        /* ── HEADER ROW ── */
        .cls-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .cls-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        .cls-count {
            font-size: 11px;
            color: var(--text-dim);
            margin-top: 2px;
        }

        /* ── ADD BUTTON ── */
        .cls-add-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: var(--teal);
            color: #0d1117;
            border: none;
            border-radius: var(--radius);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .cls-add-btn:hover { opacity: 0.85; }

        /* ── INLINE ADD FORM ── */
        .cls-add-form {
            display: none;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            background: var(--surface);
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            padding: 10px 14px;
        }
        .cls-add-form.visible { display: flex; }

        .cls-add-form input {
            flex: 1;
            background: var(--surface2);
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            color: var(--text);
            font-size: 13px;
            font-weight: 400;
            padding: 6px 10px;
            outline: none;
            transition: border-color 0.15s;
        }
        .cls-add-form input::placeholder { color: var(--text-dim); }
        .cls-add-form input:focus { border-color: var(--teal); }

        .cls-form-save {
            padding: 6px 14px;
            background: var(--teal);
            color: #0d1117;
            border: none;
            border-radius: var(--radius);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .cls-form-save:hover { opacity: 0.85; }

        .cls-form-cancel {
            padding: 6px 10px;
            background: transparent;
            color: var(--text-muted);
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            font-size: 12px;
            font-weight: 400;
            cursor: pointer;
            transition: border-color 0.15s, color 0.15s;
        }
        .cls-form-cancel:hover { border-color: var(--red); color: var(--red); }

        /* ── TABLE ── */
        .cls-table-wrap {
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
        }

        .cls-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .cls-table thead tr {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
        }

        .cls-table thead th {
            padding: 9px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 500;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        .cls-table tbody tr {
            border-bottom: 1px solid var(--border);
            transition: background 0.12s;
        }
        .cls-table tbody tr:last-child { border-bottom: none; }
        .cls-table tbody tr:hover { background: var(--surface2); }

        .cls-table td {
            padding: 10px 16px;
            color: var(--text);
            font-weight: 400;
            vertical-align: middle;
        }

        /* class name badge */
        .cls-name-badge {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 13px;
            font-weight: 500;
            color: var(--text);
        }
        .cls-name-badge .cls-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--teal);
            flex-shrink: 0;
        }

        .cls-created-by {
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 400;
        }

        /* delete button */
        .cls-del-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            background: transparent;
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 400;
            cursor: pointer;
            transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .cls-del-btn:hover {
            border-color: var(--red);
            color: var(--red);
            background: var(--red-dim);
        }

        /* ── EMPTY STATE ── */
        .cls-empty {
            padding: 48px 24px;
            text-align: center;
            color: var(--text-dim);
            font-size: 13px;
            font-weight: 400;
        }
        .cls-empty i {
            font-size: 24px;
            margin-bottom: 10px;
            display: block;
            color: var(--text-dim);
        }

        /* ── TOAST ── */
        .cls-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 10px 16px;
            border-radius: var(--radius);
            font-size: 12px;
            font-weight: 500;
            color: #0d1117;
            z-index: 9999;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 0.2s, transform 0.2s;
            pointer-events: none;
        }
        .cls-toast.show { opacity: 1; transform: translateY(0); }
        .cls-toast.success { background: var(--teal); }
        .cls-toast.error   { background: var(--red); color: #fff; }

        /* ── CONFIRM OVERLAY ── */
        .cls-confirm-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.55);
            z-index: 9000;
            align-items: center;
            justify-content: center;
        }
        .cls-confirm-overlay.show { display: flex; }

        .cls-confirm-box {
            background: var(--surface);
            border: 1px solid var(--border-hover);
            border-radius: var(--radius-lg);
            padding: 24px;
            width: 320px;
        }
        .cls-confirm-box h4 {
            font-size: 14px;
            font-weight: 500;
            color: var(--text);
            margin-bottom: 8px;
        }
        .cls-confirm-box p {
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 400;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .cls-confirm-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .cls-confirm-cancel {
            padding: 6px 14px;
            background: transparent;
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            color: var(--text-muted);
            font-size: 12px;
            cursor: pointer;
        }
        .cls-confirm-cancel:hover { border-color: var(--text-muted); }
        .cls-confirm-delete {
            padding: 6px 14px;
            background: var(--red);
            border: none;
            border-radius: var(--radius);
            color: #fff;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .cls-confirm-delete:hover { opacity: 0.85; }
    `;
    document.head.appendChild(s);
})();

// ── STATE ──
let _classesCache = [];
let _pendingDeleteId = null;

// ── RENDER ──
function renderClasses(container) {
    container.innerHTML = `
        <div class="cls-wrapper">
            <div class="cls-header">
                <div>
                    <div class="cls-title">Classes</div>
                    <div class="cls-count" id="cls-count-label"></div>
                </div>
                <button class="cls-add-btn" id="cls-open-form-btn">
                    <i class="fas fa-plus"></i> Add Class
                </button>
            </div>

            <!-- inline add form -->
            <div class="cls-add-form" id="cls-add-form">
                <input type="text" id="cls-name-input" placeholder="e.g. Grade 8A, Room 10, 10B..." maxlength="100" />
                <button class="cls-form-save" id="cls-save-btn">Save</button>
                <button class="cls-form-cancel" id="cls-cancel-btn">Cancel</button>
            </div>

            <!-- table -->
            <div class="cls-table-wrap">
                <table class="cls-table">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>Created By</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="cls-tbody"></tbody>
                </table>
                <div class="cls-empty" id="cls-empty" style="display:none;">
                    <i class="fas fa-layer-group"></i>
                    No classes yet. Add one to get started.
                </div>
            </div>
        </div>

        <!-- confirm dialog -->
        <div class="cls-confirm-overlay" id="cls-confirm-overlay">
            <div class="cls-confirm-box">
                <h4>Delete Class</h4>
                <p>Are you sure you want to delete this class? This cannot be undone.</p>
                <div class="cls-confirm-actions">
                    <button class="cls-confirm-cancel" id="cls-confirm-cancel">Cancel</button>
                    <button class="cls-confirm-delete" id="cls-confirm-delete">Delete</button>
                </div>
            </div>
        </div>

        <!-- toast -->
        <div class="cls-toast" id="cls-toast"></div>
    `;

    bindEvents();
    loadClasses();
}

// ── BIND EVENTS ──
function bindEvents() {
    // open/close form
    document.getElementById('cls-open-form-btn').addEventListener('click', () => {
        document.getElementById('cls-add-form').classList.add('visible');
        document.getElementById('cls-name-input').focus();
    });

    document.getElementById('cls-cancel-btn').addEventListener('click', closeForm);

    // save on button click or Enter
    document.getElementById('cls-save-btn').addEventListener('click', saveClass);
    document.getElementById('cls-name-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveClass();
        if (e.key === 'Escape') closeForm();
    });

    // confirm dialog
    document.getElementById('cls-confirm-cancel').addEventListener('click', () => {
        document.getElementById('cls-confirm-overlay').classList.remove('show');
        _pendingDeleteId = null;
    });
    document.getElementById('cls-confirm-delete').addEventListener('click', confirmDelete);
}

function closeForm() {
    document.getElementById('cls-add-form').classList.remove('visible');
    document.getElementById('cls-name-input').value = '';
}

// ── LOAD ──
async function loadClasses() {
    try {
        const res  = await fetch('api/school/get_classes.php');
        const data = await res.json();
        _classesCache = data.classes || [];
        renderTable();
    } catch (err) {
        showToast('Failed to load classes', 'error');
    }
}

// ── RENDER TABLE ──
function renderTable() {
    const tbody = document.getElementById('cls-tbody');
    const empty = document.getElementById('cls-empty');
    const label = document.getElementById('cls-count-label');

    label.textContent = `${_classesCache.length} class${_classesCache.length !== 1 ? 'es' : ''}`;

    if (_classesCache.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = _classesCache.map(cls => `
        <tr data-id="${cls.id}">
            <td>
                <span class="cls-name-badge">
                    <span class="cls-dot"></span>
                    ${escHtml(cls.name)}
                </span>
            </td>
            <td>
                <span class="cls-created-by">${escHtml(cls.created_by || '—')}</span>
            </td>
            <td style="text-align:right;">
                <button class="cls-del-btn" data-id="${cls.id}" data-name="${escHtml(cls.name)}">
                    <i class="fas fa-trash-can"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');

    // bind delete buttons
    tbody.querySelectorAll('.cls-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _pendingDeleteId = parseInt(btn.dataset.id);
            document.getElementById('cls-confirm-overlay').classList.add('show');
        });
    });
}

// ── SAVE ──
async function saveClass() {
    const input = document.getElementById('cls-name-input');
    const name  = input.value.trim();

    if (!name) {
        input.focus();
        return;
    }

    const saveBtn = document.getElementById('cls-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const res  = await fetch('api/school/create_class.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name })
        });
        const data = await res.json();

        if (data.success) {
            _classesCache.push(data.class);
            _classesCache.sort((a, b) => a.name.localeCompare(b.name));
            renderTable();
            closeForm();
            showToast(`"${name}" added`, 'success');
        } else {
            showToast(data.error || 'Failed to add class', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// ── DELETE ──
async function confirmDelete() {
    if (!_pendingDeleteId) return;

    const overlay   = document.getElementById('cls-confirm-overlay');
    const deleteBtn = document.getElementById('cls-confirm-delete');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
        const res  = await fetch('api/school/delete_class.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: _pendingDeleteId })
        });
        const data = await res.json();

        if (data.success) {
            _classesCache = _classesCache.filter(c => c.id !== _pendingDeleteId);
            renderTable();
            overlay.classList.remove('show');
            showToast('Class deleted', 'success');
        } else {
            showToast(data.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    } finally {
        _pendingDeleteId = null;
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
        overlay.classList.remove('show');
    }
}

// ── TOAST ──
function showToast(msg, type = 'success') {
    const t = document.getElementById('cls-toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `cls-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── UTIL ──
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── EXPORT (matches how school_admin_dashboard.php calls sections) ──
window.loadClassesSection = function(container) {
    renderClasses(container);
};