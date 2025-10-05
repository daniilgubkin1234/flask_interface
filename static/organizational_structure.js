/************************************************************
 *  Организационная структура · полностью исправленная версия
 ************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#orgTable tbody');
    const addBtn = document.getElementById('addRow');
    const sendBtn = document.getElementById('submitData');
    
    // Переменные для автосохранения в localStorage
    let autoSaveTimeout = null;
    const AUTO_SAVE_DELAY = 1000;
    const STORAGE_KEY = 'orgStructureDraft';
    
    // Сохраняем шаблон строки
    let rowTemplate = null;
    
    // Управление боковым меню
    document.querySelector('.toggle-sidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        sidebar.classList.toggle('show');
        button.classList.toggle('menu-open');
    });

    // Закрытие меню при клике вне области
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        if (sidebar.classList.contains('show') && 
            !sidebar.contains(e.target) && 
            !button.contains(e.target)) {
            sidebar.classList.remove('show');
            button.classList.remove('menu-open');
        }
    });

    // --- кэш из 3+20 ---
    let tptMap = {};
    let tptNames = [];

    // --- Функции для работы с localStorage ---
    function saveToLocalStorage() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const data = {
                rows: collectRows(),
                _timestamp: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            console.log("Данные автосохранены в localStorage");
        }, AUTO_SAVE_DELAY);
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Проверяем актуальность данных (менее 24 часов)
                const savedTime = new Date(data._timestamp);
                const currentTime = new Date();
                const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    return data;
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error("Ошибка загрузки из localStorage:", error);
        }
        return null;
    }

    function clearLocalStorage() {
        localStorage.removeItem(STORAGE_KEY);
        console.log("Данные очищены из localStorage");
    }

    function restoreFromDraft() {
        const draft = loadFromLocalStorage();
        if (draft && confirm('Обнаружены несохраненные данные. Восстановить их?')) {
            loadRowsIntoTable(draft.rows);
            return true;
        }
        return false;
    }

    // --- helpers ---
    const uuid = crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

    // Безопасная установка HTML
    function safeSetInnerHTML(element, html) {
        element.textContent = '';
        const template = document.createElement('template');
        template.innerHTML = html;
        element.appendChild(template.content);
    }

    // Экранирование HTML
    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[tag]));
    }

    const getPositions = () =>
        [...document.querySelectorAll('.position')]
            .map((inp, i) => inp.value.trim() && `${i + 1}) ${inp.value.trim()}`)
            .filter(Boolean);

    function refreshSimpleSelects() {
        const positions = getPositions();
        const opts = ['<option value="">Выберите</option>']
            .concat(positions.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`))
            .join('');
        
        document.querySelectorAll('.supervisor, .replacement').forEach(sel => {
            const chosen = [...sel.selectedOptions].map(o => o.value);
            safeSetInnerHTML(sel, opts);
            chosen.forEach(v => { 
                const o = [...sel.options].find(x => x.value === v); 
                if (o) o.selected = true; 
            });
        });
    }

    function setMultiboxCaption(cell) {
        const cap = cell.querySelector('.multibox');
        let list = [];
        try {
            list = JSON.parse(cell.querySelector('.subordinates').value || '[]');
        } catch (e) {
            console.error('Ошибка парсинга subordinates:', e);
        }
        cap.textContent = list.length ? list.join(', ') : 'Выберите';
        cap.classList.toggle('placeholder', !list.length);
    }

    function buildMultibox(cell) {
        const menu = cell.querySelector('.multibox-list');
        const hidden = cell.querySelector('.subordinates');
        let chosen = [];
        
        try {
            chosen = JSON.parse(hidden.value || '[]');
        } catch (e) {
            console.error('Ошибка парсинга chosen subordinates:', e);
        }

        const positions = getPositions();
        let menuHTML = '';
        positions.forEach(p => {
            const id = uuid();
            const escapedP = escapeHtml(p);
            const checked = chosen.includes(p) ? 'checked' : '';
            menuHTML += `
                <label for="${id}">
                    <input type="checkbox" id="${id}" value="${escapedP}" ${checked}>
                    ${escapedP}
                </label>
            `;
        });
        
        safeSetInnerHTML(menu, menuHTML);
        setMultiboxCaption(cell);
    }

    function refreshAllMultiboxes() {
        tbody.querySelectorAll('.subs-cell').forEach(buildMultibox);
    }

    function syncTable() {
        // Обновляем номера строк
        tbody.querySelectorAll('tr').forEach((tr, i) => {
            tr.cells[0].textContent = i + 1;
        });
        
        refreshSimpleSelects();
        refreshAllMultiboxes();
        ensurePositionDatalist();
    }

    // ---- datalist с должностями из 3+20 ----
    function ensurePositionDatalist() {
        let dl = document.getElementById('tpt-positions');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'tpt-positions';
            document.body.appendChild(dl);
        }
        document.querySelectorAll('.position').forEach(inp => inp.setAttribute('list', 'tpt-positions'));

        const positions = [...new Set(tptNames)].sort((a, b) => a.localeCompare(b));
        let optionsHTML = '';
        positions.forEach(p => {
            optionsHTML += `<option value="${escapeHtml(p)}"></option>`;
        });
        safeSetInnerHTML(dl, optionsHTML);
    }

    async function loadTptPositions() {
        try {
            const res = await fetch('/tpt_positions');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arr = await res.json();
            
            tptMap = {};
            tptNames = [];
            (arr || []).forEach(item => {
                const name = (item.position || '').trim();
                if (!name) return;
                const key = name.toLowerCase();
                const mf = Array.isArray(item.main_functions) ? item.main_functions.filter(Boolean) : [];
                tptMap[key] = mf;
                tptNames.push(name);
            });
            ensurePositionDatalist();
        } catch (e) {
            console.warn('Не удалось загрузить должности из 3+20:', e);
            tptMap = {};
            tptNames = [];
        }
    }

    function applyFunctionalFromTpt(tr) {
        const pos = tr.querySelector('.position')?.value?.trim().toLowerCase() || '';
        const mf = tptMap[pos] || [];
        if (mf.length) {
            const field = tr.querySelector('.functional');
            if (field && !field.value.trim()) {
                field.value = mf.join(', ');
            }
        }
    }

    // --- Валидация данных ---
    function validateRowData(row) {
        const errors = [];
        
        if (!row.position.trim()) {
            errors.push('Позиция не может быть пустой');
        }
        
        const staffCount = parseInt(row.staffCount, 10);
        if (isNaN(staffCount) || staffCount < 1 || staffCount > 1000) {
            errors.push('Количество staff должно быть числом от 1 до 1000');
        }
        
        return errors;
    }

    function validateAllRows() {
        const rows = collectRows();
        const allErrors = [];
        
        rows.forEach((row, index) => {
            const errors = validateRowData(row);
            if (errors.length > 0) {
                allErrors.push(`Строка ${index + 1}: ${errors.join(', ')}`);
            }
        });
        
        return allErrors;
    }

    // --- Загрузка данных в таблицу ---
    function loadRowsIntoTable(rows) {
        // Очищаем все строки
        while (tbody.rows.length > 0) {
            tbody.deleteRow(0);
        }

        // Если нет строк в данных, создаем одну пустую строку
        if (!rows || rows.length === 0) {
            createNewRow();
            return;
        }

        // Создаем строки из данных
        rows.forEach((row, idx) => {
            const tr = createNewRow();
            if (tr) {
                fillRowData(tr, row);
            }
        });
        
        syncTable();
        
        // Применяем функционал из TPT для всех строк
        setTimeout(() => {
            tbody.querySelectorAll('tr').forEach(tr => {
                if (!tr.querySelector('.functional').value.trim()) {
                    applyFunctionalFromTpt(tr);
                }
            });
        }, 100);
    }

    function fillRowData(tr, row) {
        tr.querySelector('.position').value = row.position || '';
        tr.querySelector('.staff-count').value = row.staffCount || 1;
        tr.querySelector('.functional').value = row.functional || '';
        
        // Восстанавливаем подчиненных
        if (row.subordinates && Array.isArray(row.subordinates)) {
            try {
                const subordinatesField = tr.querySelector('.subordinates');
                if (subordinatesField) {
                    subordinatesField.value = JSON.stringify(row.subordinates);
                }
            } catch (e) {
                console.error('Ошибка восстановления subordinates:', e);
            }
        }
        
        // Восстанавливаем руководителя (если есть)
        if (row.supervisorIndex && tr.querySelector('.supervisor')) {
            setTimeout(() => {
                const supervisorSelect = tr.querySelector('.supervisor');
                if (supervisorSelect) {
                    const options = [...supervisorSelect.options];
                    const needed = options.find(opt => (opt.value || '').startsWith(`${row.supervisorIndex})`));
                    if (needed) supervisorSelect.value = needed.value;
                }
            }, 100);
        }
    }

    // --- Создание новой строки ---
    function createNewRow() {
        // Если нет шаблона строки, сохраняем первую строку как шаблон
        if (!rowTemplate && tbody.rows.length > 0) {
            rowTemplate = tbody.rows[0].cloneNode(true);
        }
        
        // Если все еще нет шаблона, создаем базовую строку
        if (!rowTemplate) {
            console.error('Нет шаблона строки для создания новой строки');
            return null;
        }
        
        const newRow = rowTemplate.cloneNode(true);
        
        // Очищаем значения
        newRow.querySelectorAll('input').forEach(i => {
            if (i.type !== 'hidden') i.value = '';
        });
        
        // Очищаем selects
        newRow.querySelectorAll('select').forEach(s => {
            s.innerHTML = '<option value="">Выберите</option>';
        });
        
        // Сбрасываем subordinates
        const subordinatesField = newRow.querySelector('.subordinates');
        if (subordinatesField) {
            subordinatesField.value = '[]';
        }
        
        // Обновляем multibox
        const multibox = newRow.querySelector('.multibox');
        if (multibox) {
            multibox.textContent = 'Выберите';
            multibox.classList.add('placeholder');
        }
        
        tbody.appendChild(newRow);
        return newRow;
    }

    // --- сбор данных (включая functional и subordinates) ---
    function collectRows() {
        return [...tbody.rows].map((tr, idx) => {
            const rawSup = tr.querySelector('.supervisor')?.value?.trim() || '';
            const supervisorIndex = rawSup ? parseInt(rawSup.split(')')[0], 10) : null;
            
            // Безопасное получение subordinates
            let subordinates = [];
            try {
                const subordinatesField = tr.querySelector('.subordinates');
                if (subordinatesField) {
                    subordinates = JSON.parse(subordinatesField.value || '[]');
                }
            } catch (e) {
                console.error('Ошибка парсинга subordinates в строке', idx + 1, e);
            }
            
            return {
                position: tr.querySelector('.position')?.value?.trim() || '',
                supervisorIndex: supervisorIndex,
                staffCount: Math.max(1, parseInt(tr.querySelector('.staff-count')?.value, 10) || 1),
                functional: tr.querySelector('.functional')?.value?.trim() || '',
                subordinates: subordinates
            };
        });
    }

    // --- Сохранение в БД ---
    async function saveToDatabase() {
        const validationErrors = validateAllRows();
        if (validationErrors.length > 0) {
            alert('Обнаружены ошибки:\n\n' + validationErrors.join('\n'));
            return false;
        }

        const rows = collectRows();
        try {
            const response = await fetch('/save_organizational_structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            clearLocalStorage(); // Очищаем черновик после успешного сохранения
            return true;
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка при сохранении данных');
            return false;
        }
    }

    // --- автозагрузка данных из БД ---
    async function loadFromDatabase() {
        try {
            const response = await fetch('/get_organizational_structure');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const rows = await response.json();
            if (rows && Array.isArray(rows)) {
                loadRowsIntoTable(rows);
                if (rows.length > 0) {
                    drawOrgChart(rows);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    // --- события ---
    document.addEventListener('click', e => {
        if (e.target.classList.contains('multibox')) {
            const cell = e.target.closest('.subs-cell');
            const list = cell.querySelector('.multibox-list');
            const open = list.style.display === 'block';
            document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
            if (!open) { 
                buildMultibox(cell); 
                list.style.display = 'block'; 
            }
            return;
        }
        
        if (e.target.closest('.multibox-list')) {
            const cell = e.target.closest('.subs-cell');
            const hidden = cell.querySelector('.subordinates');
            const checkedBoxes = cell.querySelectorAll('input[type="checkbox"]:checked');
            const vals = Array.from(checkedBoxes).map(input => input.value);
            
            try {
                hidden.value = JSON.stringify(vals);
            } catch (e) {
                console.error('Ошибка сохранения subordinates:', e);
            }
            
            setMultiboxCaption(cell);
            saveToLocalStorage();
            return;
        }
        
        document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
    });

    addBtn.addEventListener('click', () => {
        createNewRow();
        syncTable();
        saveToLocalStorage();
    });

    // Обработчики изменений с debounce
    let changeTimeout;
    function handleTableChange() {
        clearTimeout(changeTimeout);
        changeTimeout = setTimeout(() => {
            syncTable();
            saveToLocalStorage();
        }, 300);
    }

    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) {
            applyFunctionalFromTpt(e.target.closest('tr'));
            handleTableChange();
        } else {
            saveToLocalStorage();
        }
    });

    tbody.addEventListener('change', e => {
        if (e.target.classList.contains('position')) {
            applyFunctionalFromTpt(e.target.closest('tr'));
        }
        saveToLocalStorage();
    });

    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            handleTableChange();
        }
    });

    sendBtn.addEventListener('click', async () => {
        const success = await saveToDatabase();
        if (success) {
            alert('Данные успешно сохранены в БД!');
            const rows = collectRows();
            drawOrgChart(rows);
        }
    });

    // Обработчик перед закрытием страницы
    window.addEventListener('beforeunload', (event) => {
        const draft = loadFromLocalStorage();
        if (draft) {
            event.preventDefault();
            event.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
            return event.returnValue;
        }
    });

    // ---- INIT ----
    (async () => {
        // Сохраняем шаблон строки перед любыми манипуляциями
        if (tbody.rows.length > 0) {
            rowTemplate = tbody.rows[0].cloneNode(true);
        }
        
        await loadTptPositions();
        
        // Сначала загружаем из БД
        await loadFromDatabase();
        
        // Если нет данных из БД, проверяем черновик
        setTimeout(() => {
            if (tbody.rows.length === 0 || !restoreFromDraft()) {
                // Если все еще нет строк, создаем одну
                if (tbody.rows.length === 0) {
                    createNewRow();
                }
                syncTable();
            }
        }, 500);
    })();
});

/* ====== Google OrgChart ====== */
google.charts.load('current', { packages: ['orgchart'] });

function buildChartData(rows) {
    const list = [];
    rows.forEach((r, idx) => {
        if (!r.position) return;
        const baseNum = idx + 1;
        const firstId = `n${baseNum}_1`;
        const parentId = r.supervisorIndex ? `n${r.supervisorIndex}_1` : '';
        list.push([{ v: firstId, f: `<div class="node">${r.position}</div>` }, parentId]);
        for (let i = 2; i <= r.staffCount; i++) {
            const prevId = `n${baseNum}_${i - 1}`;
            const currId = `n${baseNum}_${i}`;
            list.push([{ v: currId, f: `<div class="node">${r.position}</div>` }, prevId]);
        }
    });
    return list;
}

function drawOrgChart(rows) {
    if (!rows || rows.length === 0) return;
    
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Name');
    dataTable.addColumn('string', 'Manager');
    dataTable.addColumn('string', 'ToolTip');
    
    const chartData = buildChartData(rows);
    chartData.forEach(([node, parent]) => {
        dataTable.addRow([node, parent, '']);
    });
    
    const chart = new google.visualization.OrgChart(document.getElementById('orgChart'));
    chart.draw(dataTable, { 
        allowHtml: true, 
        nodeClass: 'node', 
        collapseEndNodes: false,
        size: 'large'
    });
}

document.getElementById('downloadChart').addEventListener('click', () => {
    const chartBlock = document.getElementById('orgChart');
    if (!chartBlock || !chartBlock.childElementCount) {
        alert('Сначала нажмите «Сохранить в БД», чтобы построить схему.');
        return;
    }
    
    const originalOverflow = chartBlock.style.overflow;
    const originalWidth = chartBlock.style.width;
    const originalHeight = chartBlock.style.height;

    chartBlock.style.overflow = 'visible';
    chartBlock.style.width = chartBlock.scrollWidth + 'px';
    chartBlock.style.height = chartBlock.scrollHeight + 'px';

    html2canvas(chartBlock, { 
        backgroundColor: null,
        scale: 2,
        useCORS: true
    })
    .then(canvas => {
        chartBlock.style.overflow = originalOverflow;
        chartBlock.style.width = originalWidth;
        chartBlock.style.height = originalHeight;

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'Организационная структура. Cхема подчинения.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
    })
    .catch(err => {
        console.error('Не удалось сохранить схему:', err);
        alert('Ошибка сохранения схемы. Подробности в консоли.');
        chartBlock.style.overflow = originalOverflow;
        chartBlock.style.width = originalWidth;
        chartBlock.style.height = originalHeight;
    });
});