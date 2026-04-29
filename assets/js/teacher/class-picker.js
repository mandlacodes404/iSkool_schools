/**
 * iSkool — assets/js/teacher/class-picker.js
 *
 * Shared live-search class picker.
 * Works with any class naming convention — no assumptions about format.
 *
 * Usage
 * ─────
 * 1. Drop a container div where the <select> used to be:
 *      <div id="myClassPicker"></div>
 *
 * 2. Call after your classes array is ready:
 *      window.renderClassPicker('myClassPicker', classes, function(classId, className) {
 *          selectedClassId = classId;
 *      });
 *
 * 3. To read the current selection on form submit:
 *      const val = window.getClassPickerValue('myClassPicker'); // returns id (string) or null
 *
 * 4. To reset after submit:
 *      window.resetClassPicker('myClassPicker');
 *
 * The `classes` array must be: [{ id: number|string, name: string }, ...]
 * — exactly what your existing get_classes.php returns.
 */

(function () {

    // ── Inject shared styles once ────────────────────────────────────────────
    if (!document.getElementById('iskool-class-picker-styles')) {
        const style = document.createElement('style');
        style.id = 'iskool-class-picker-styles';
        style.textContent = `
            .icp-wrapper {
                position: relative;
                width: 100%;
                box-sizing: border-box;
            }

            .icp-input-wrap {
                position: relative;
                display: flex;
                align-items: center;
            }

            .icp-search-icon {
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                opacity: 0.4;
                flex-shrink: 0;
            }

            .icp-clear-btn {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #8b949e;
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 4px;
                display: none;
                transition: color 0.15s;
            }
            .icp-clear-btn:hover { color: #e2e8f0; }

            .icp-input {
                width: 100%;
                box-sizing: border-box;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                color: #e2e8f0;
                font-size: 14px;
                padding: 10px 36px 10px 36px;
                outline: none;
                transition: border-color 0.2s, background 0.2s;
                font-family: inherit;
            }
            .icp-input::placeholder { color: #555e6a; }
            .icp-input:focus {
                border-color: rgba(79,209,197,0.5);
                background: rgba(255,255,255,0.07);
            }
            .icp-input.icp-has-selection {
                border-color: rgba(79,209,197,0.6);
                background: rgba(79,209,197,0.06);
                color: #4fd1c5;
                font-weight: 600;
            }

            /* Dropdown */
            .icp-dropdown {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                right: 0;
                background: #161b22;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px;
                box-shadow: 0 12px 32px rgba(0,0,0,0.55);
                z-index: 9999;
                overflow: hidden;
                display: none;
                flex-direction: column;
                max-height: 240px;
            }
            .icp-dropdown.icp-open {
                display: flex;
            }

            .icp-list {
                overflow-y: auto;
                flex: 1;
            }
            .icp-list::-webkit-scrollbar { width: 4px; }
            .icp-list::-webkit-scrollbar-track { background: transparent; }
            .icp-list::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
            }

            .icp-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px;
                cursor: pointer;
                font-size: 14px;
                color: #c9d1d9;
                border-left: 3px solid transparent;
                transition: background 0.1s, border-color 0.1s;
                user-select: none;
            }
            .icp-item:hover { background: rgba(255,255,255,0.05); }
            .icp-item.icp-item-active {
                background: rgba(79,209,197,0.08);
                border-left-color: #4fd1c5;
                color: #e2e8f0;
                font-weight: 600;
            }
            .icp-item.icp-highlighted {
                background: rgba(255,255,255,0.07);
            }
            .icp-item.icp-item-active.icp-highlighted {
                background: rgba(79,209,197,0.12);
            }

            /* Highlight matched chars */
            .icp-item mark {
                background: rgba(79,209,197,0.25);
                color: #4fd1c5;
                border-radius: 2px;
                padding: 0 1px;
                font-weight: 700;
            }

            .icp-item-icon {
                flex-shrink: 0;
                opacity: 0.45;
            }
            .icp-item.icp-item-active .icp-item-icon { opacity: 1; }

            .icp-empty {
                padding: 18px 14px;
                font-size: 13px;
                color: #555e6a;
                text-align: center;
            }

            .icp-footer {
                padding: 5px 14px;
                font-size: 11px;
                color: #555e6a;
                border-top: 1px solid rgba(255,255,255,0.05);
                flex-shrink: 0;
                font-weight: 600;
                letter-spacing: 0.3px;
            }
        `;
        document.head.appendChild(style);
    }

    // ── SVGs ─────────────────────────────────────────────────────────────────
    const SEARCH_ICON = `
        <svg class="icp-search-icon" viewBox="0 0 24 24" width="15" height="15"
             stroke="#8b949e" stroke-width="2.5" fill="none"
             stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>`;

    const CLASS_ICON = `
        <svg class="icp-item-icon" viewBox="0 0 24 24" width="14" height="14"
             stroke="#4fd1c5" stroke-width="2" fill="none"
             stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>`;

    // ── Helpers ───────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function highlight(text, query) {
        if (!query) return escapeHtml(text);
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escapeHtml(text).replace(
            new RegExp(`(${escaped})`, 'gi'),
            '<mark>$1</mark>'
        );
    }

    // ── State store keyed by containerId ─────────────────────────────────────
    const _state = {};

    // ── Main render ───────────────────────────────────────────────────────────
    window.renderClassPicker = function (containerId, classes, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const allClasses = (classes || []).map(c => ({
            id:   String(c.id),
            name: String(c.name)
        }));

        _state[containerId] = {
            all:         allClasses,
            filtered:    allClasses.slice(),
            selected:    null,
            highlighted: 0,
            onSelect:    onSelect || function () {}
        };

        container.innerHTML = `
            <div class="icp-wrapper" id="${containerId}-wrapper">
                <div class="icp-input-wrap">
                    ${SEARCH_ICON}
                    <input
                        class="icp-input"
                        id="${containerId}-input"
                        type="text"
                        placeholder="Search class..."
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <button class="icp-clear-btn" id="${containerId}-clear"
                            type="button" tabindex="-1" title="Clear">&times;</button>
                </div>
                <div class="icp-dropdown" id="${containerId}-dropdown">
                    <div class="icp-list"   id="${containerId}-list"></div>
                    <div class="icp-footer" id="${containerId}-footer"></div>
                </div>
            </div>`;

        const input    = document.getElementById(`${containerId}-input`);
        const dropdown = document.getElementById(`${containerId}-dropdown`);
        const listEl   = document.getElementById(`${containerId}-list`);
        const footer   = document.getElementById(`${containerId}-footer`);
        const clearBtn = document.getElementById(`${containerId}-clear`);

        // ── Render list ──
        function renderList(query) {
            const st = _state[containerId];
            const q  = (query || '').trim().toLowerCase();

            st.filtered = q
                ? allClasses.filter(c => c.name.toLowerCase().includes(q))
                : allClasses.slice();

            st.highlighted = st.filtered.length ? 0 : -1;

            if (!st.filtered.length) {
                listEl.innerHTML   = `<div class="icp-empty">No classes match "${escapeHtml(q)}"</div>`;
                footer.textContent = '';
                return;
            }

            listEl.innerHTML = st.filtered.map((c, i) => {
                const isActive = st.selected && st.selected.id === c.id;
                const isHl     = i === st.highlighted;
                return `
                    <div class="icp-item${isActive ? ' icp-item-active' : ''}${isHl ? ' icp-highlighted' : ''}"
                         data-id="${c.id}" data-idx="${i}">
                        ${CLASS_ICON}
                        <span>${highlight(c.name, q)}</span>
                    </div>`;
            }).join('');

            const total = allClasses.length;
            const shown = st.filtered.length;
            footer.textContent = q
                ? `${shown} of ${total} class${total !== 1 ? 'es' : ''}`
                : `${total} class${total !== 1 ? 'es' : ''}`;

            listEl.querySelectorAll('.icp-item').forEach(el => {
                el.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    const cls = allClasses.find(c => c.id === this.dataset.id);
                    if (cls) selectClass(cls);
                });
            });
        }

        // ── Select ──
        function selectClass(cls) {
            const st   = _state[containerId];
            st.selected = cls;
            input.value = cls.name;
            input.classList.add('icp-has-selection');
            clearBtn.style.display = 'block';
            closeDropdown();
            st.onSelect(cls.id, cls.name);
        }

        // ── Open / close ──
        function openDropdown() {
            renderList(input.value);
            dropdown.classList.add('icp-open');
        }
        function closeDropdown() {
            dropdown.classList.remove('icp-open');
        }

        // ── Keyboard highlight ──
        function updateHighlight(newIdx) {
            const st    = _state[containerId];
            const items = listEl.querySelectorAll('.icp-item');
            items.forEach(el => el.classList.remove('icp-highlighted'));
            st.highlighted = Math.max(0, Math.min(newIdx, st.filtered.length - 1));
            const target = items[st.highlighted];
            if (target) {
                target.classList.add('icp-highlighted');
                target.scrollIntoView({ block: 'nearest' });
            }
        }

        // ── Event listeners ──

        input.addEventListener('focus', function () {
            const st = _state[containerId];
            if (st.selected) {
                // Let them search fresh — restore on blur if they don't pick
                input.value = '';
                input.classList.remove('icp-has-selection');
            }
            openDropdown();
        });

        input.addEventListener('input', function () {
            const st    = _state[containerId];
            st.selected = null;
            input.classList.remove('icp-has-selection');
            clearBtn.style.display = 'none';
            openDropdown();
        });

        input.addEventListener('keydown', function (e) {
            const st = _state[containerId];
            if (!dropdown.classList.contains('icp-open')) {
                if (e.key === 'ArrowDown' || e.key === 'Enter') openDropdown();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateHighlight(st.highlighted + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateHighlight(st.highlighted - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (st.highlighted >= 0 && st.filtered[st.highlighted]) {
                    selectClass(st.filtered[st.highlighted]);
                }
            } else if (e.key === 'Escape') {
                if (st.selected) input.value = st.selected.name;
                closeDropdown();
            }
        });

        input.addEventListener('blur', function () {
            setTimeout(function () {
                const st = _state[containerId];
                if (st.selected) {
                    input.value = st.selected.name;
                    input.classList.add('icp-has-selection');
                } else {
                    input.value = '';
                    input.classList.remove('icp-has-selection');
                    clearBtn.style.display = 'none';
                }
                closeDropdown();
            }, 150);
        });

        clearBtn.addEventListener('mousedown', e => e.preventDefault());
        clearBtn.addEventListener('click', function () {
            const st        = _state[containerId];
            st.selected     = null;
            st.highlighted  = -1;
            input.value     = '';
            input.classList.remove('icp-has-selection');
            clearBtn.style.display = 'none';
            st.onSelect(null, null);
            input.focus();
        });

        // Close on outside click — auto-cleans up if container is removed
        document.addEventListener('click', function handler(e) {
            const wrapper = document.getElementById(`${containerId}-wrapper`);
            if (!wrapper) { document.removeEventListener('click', handler); return; }
            if (!wrapper.contains(e.target)) closeDropdown();
        });
    };

    // ── Read value on submit ──────────────────────────────────────────────────
    // Returns class id as a string, or null.
    window.getClassPickerValue = function (containerId) {
        const st = _state[containerId];
        return (st && st.selected) ? st.selected.id : null;
    };

    // ── Reset after submit ────────────────────────────────────────────────────
    window.resetClassPicker = function (containerId) {
        const st = _state[containerId];
        if (!st) return;
        st.selected    = null;
        st.highlighted = -1;
        const input    = document.getElementById(`${containerId}-input`);
        const clearBtn = document.getElementById(`${containerId}-clear`);
        if (input)    { input.value = ''; input.classList.remove('icp-has-selection'); }
        if (clearBtn) { clearBtn.style.display = 'none'; }
    };

})();