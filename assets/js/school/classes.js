// ═══════════════════════════════════════════════════════
// CLASSES SECTION — iSkool School Admin
// Simple control-panel style class management
// ═══════════════════════════════════════════════════════

window._sdClassesCache = null;

(function injectClassStyles() {
    if (document.getElementById('sd-class-styles')) return;
    const s = document.createElement('style');
    s.id = 'sd-class-styles';
    s.textContent = `
        .cls-wrapper {
            padding: 24px;
            max-width: 860px;
        }

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
        }

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
        .cls-confirm-cancel-btn {
            padding: 6px 14px;
            background: transparent;
            border: 1px solid var(--border-hover);
            border-radius: var(--radius);
            color: var(--text-muted);
            font-size: 12px;
            cursor: pointer;
        }
        .cls-confirm-cancel-btn:hover { border-color: var(--text-muted); }
        .cls-confirm-delete-btn {
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
        .cls-confirm-delete-btn:hover { opacity: 0.85; }
    `;
    document.head.appendChild(s);
})();

// ── STATE ──
let _pendingDeleteId = null;

// ═══════════════════════════════════════
// MAIN ENTRY — matches what loadSection('classes') calls
// ═══════════════════════════════════════
window.loadSdClasses = async function () {
    const content = document.getElementById('sd-content');

    content.innerHTML = `
        <div class="cls-wrapper">
            <div class="cls-header">
                <div>
                    <div class="cls-title">Classes</div>
                    <div class="cls-count" id="cls-count-label">Loading…</div>
                </div>
                <button class="cls-add-btn" id="cls-open-form-btn">
                    <i class="fas fa-plus"></i> Add Class
                </button>
            </div>

            <div class="cls-add-form" id="cls-add-form">
                <input type="text" id="cls-name-input" placeholder="e.g. Grade 8A, Room 10, 10B…" maxlength="100" />
                <button class="cls-form-save" id="cls-save-btn">Save</button>
                <button class="cls-form-cancel" id="cls-cancel-btn">Cancel</button>
            </div>

            <div class="cls-table-wrap">
                <table class="cls-table">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>Created By</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="cls-tbody">
                        <tr>
                            <td colspan="3" style="padding:32px;text-align:center;color:var(--text-dim);font-size:12px;">
                                Loading classes…
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div class="cls-empty" id="cls-empty" style="display:none;">
                    <i class="fas fa-layer-group"></i>
                    No classes yet. Add one to get started.
                </div>
            </div>
        </div>

        <div class="cls-confirm-overlay" id="cls-confirm-overlay">
            <div class="cls-confirm-box">
                <h4>Delete Class</h4>
                <p>Are you sure you want to delete this class? This cannot be undone.</p>
                <div class="cls-confirm-actions">
                    <button class="cls-confirm-cancel-btn" id="cls-confirm-cancel">Cancel</button>
                    <button class="cls-confirm-delete-btn" id="cls-confirm-delete">Delete</button>
                </div>
            </div>
        </div>

        <div class="cls-toast" id="cls-toast"></div>
    `;

    _bindEvents();

    if (window._sdClassesCache) {
        _renderTable(window._sdClassesCache);
        return;
    }

    try {
        const res  = await fetch('api/school/get_classes.php');
        const data = await res.json();
        window._sdClassesCache = data.classes || [];
        _renderTable(window._sdClassesCache);
    } catch (e) {
        document.getElementById('cls-tbody').innerHTML = `
            <tr><td colspan="3" style="padding:32px;text-align:center;color:var(--red);font-size:12px;">
                Failed to load classes.
            </td></tr>`;
    }
};

// ── BIND EVENTS ──
function _bindEvents() {
    document.getElementById('cls-open-form-btn').addEventListener('click', () => {
        document.getElementById('cls-add-form').classList.add('visible');
        document.getElementById('cls-name-input').focus();
    });

    document.getElementById('cls-cancel-btn').addEventListener('click', _closeForm);
    document.getElementById('cls-save-btn').addEventListener('click', _saveClass);
    document.getElementById('cls-name-input').addEventListener('keydown', e => {
        if (e.key === 'Enter')  _saveClass();
        if (e.key === 'Escape') _closeForm();
    });

    document.getElementById('cls-confirm-cancel').addEventListener('click', () => {
        document.getElementById('cls-confirm-overlay').classList.remove('show');
        _pendingDeleteId = null;
    });
    document.getElementById('cls-confirm-delete').addEventListener('click', _confirmDelete);
}

function _closeForm() {
    document.getElementById('cls-add-form').classList.remove('visible');
    document.getElementById('cls-name-input').value = '';
}

// ── RENDER TABLE ──
function _renderTable(classes) {
    const tbody = document.getElementById('cls-tbody');
    const empty = document.getElementById('cls-empty');
    const label = document.getElementById('cls-count-label');

    label.textContent = `${classes.length} class${classes.length !== 1 ? 'es' : ''}`;

    if (!classes.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = classes.map(cls => `
        <tr data-id="${cls.id}">
            <td>
                <span class="cls-name-badge">
                    <span class="cls-dot"></span>
                    ${_esc(cls.name)}
                </span>
            </td>
            <td>
                <span class="cls-created-by">${_esc(cls.created_by || '—')}</span>
            </td>
            <td style="text-align:right;">
                <button class="cls-del-btn" data-id="${cls.id}">
                    <i class="fas fa-trash-can"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.cls-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _pendingDeleteId = parseInt(btn.dataset.id);
            document.getElementById('cls-confirm-overlay').classList.add('show');
        });
    });
}

// ── SAVE ──
async function _saveClass() {
    const input = document.getElementById('cls-name-input');
    const name  = input.value.trim();
    if (!name) { input.focus(); return; }

    const saveBtn       = document.getElementById('cls-save-btn');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';

    try {
        const res  = await fetch('api/school/create_class.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name })
        });
        const data = await res.json();

        if (data.success) {
            window._sdClassesCache = window._sdClassesCache || [];
            window._sdClassesCache.push(data.class);
            window._sdClassesCache.sort((a, b) => a.name.localeCompare(b.name));
            _renderTable(window._sdClassesCache);
            _closeForm();
            _toast(`"${name}" added`, 'success');
        } else {
            _toast(data.error || 'Failed to add class', 'error');
        }
    } catch (e) {
        _toast('Network error', 'error');
    } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save';
    }
}

// ── DELETE ──
async function _confirmDelete() {
    if (!_pendingDeleteId) return;

    const deleteBtn         = document.getElementById('cls-confirm-delete');
    deleteBtn.disabled      = true;
    deleteBtn.textContent   = 'Deleting…';

    try {
        const res  = await fetch('api/school/delete_class.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: _pendingDeleteId })
        });
        const data = await res.json();

        if (data.success) {
            window._sdClassesCache = (window._sdClassesCache || []).filter(c => c.id !== _pendingDeleteId);
            _renderTable(window._sdClassesCache);
            _toast('Class deleted', 'success');
        } else {
            _toast(data.error || 'Failed to delete', 'error');
        }
    } catch (e) {
        _toast('Network error', 'error');
    } finally {
        _pendingDeleteId      = null;
        deleteBtn.disabled    = false;
        deleteBtn.textContent = 'Delete';
        document.getElementById('cls-confirm-overlay').classList.remove('show');
    }
}

// ── TOAST ──
function _toast(msg, type = 'success') {
    const t = document.getElementById('cls-toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `cls-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── UTIL ──
function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}