/************************************************************
 *  Организационная структура · автозагрузка + автосохранение
 ************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#orgTable tbody');
    const addBtn = document.getElementById('addRow');
    const sendBtn = document.getElementById('submitData');

    // ---- NEW: кэш должностей из 3+20 ----
    let tptMap = {}; // { lowercasedPosition: ["направление 1","направление 2","направление 3"] }

    // --- helpers ---
    const uuid = crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

    const getPositions = () =>
        [...document.querySelectorAll('.position')]
            .map((inp, i) => inp.value.trim() && `${i + 1}) ${inp.value.trim()}`)
            .filter(Boolean);

    function refreshSimpleSelects() {
        const opts = ['<option value="">Выберите</option>',
            ...getPositions().map(p => `<option value="${p}">${p}</option>`)].join('');
        document.querySelectorAll('.supervisor, .replacement').forEach(sel => {
            const chosen = [...sel.selectedOptions].map(o => o.value);
            sel.innerHTML = opts;
            chosen.forEach(v => { const o = [...sel.options].find(x => x.value === v); if (o) o.selected = true; });
        });
    }

    function setMultiboxCaption(cell) {
        const cap = cell.querySelector('.multibox');
        const list = JSON.parse(cell.querySelector('.subordinates').value || '[]');
        cap.textContent = list.length ? list.join(', ') : 'Выберите';
        cap.classList.toggle('placeholder', !list.length);
    }

    function buildMultibox(cell) {
        const menu = cell.querySelector('.multibox-list');
        const hidden = cell.querySelector('.subordinates');
        const chosen = JSON.parse(hidden.value || '[]');

        menu.innerHTML = '';
        getPositions().forEach(p => {
            const id = uuid();
            menu.insertAdjacentHTML('beforeend', `
                <label for="${id}">
                    <input type="checkbox" id="${id}" value="${p}" ${chosen.includes(p) ? 'checked' : ''}>
                    ${p}
                </label>
            `);
        });
        setMultiboxCaption(cell);
    }

    function refreshAllMultiboxes() {
        tbody.querySelectorAll('.subs-cell').forEach(buildMultibox);
    }

    function syncTable() {
        tbody.querySelectorAll('tr').forEach((tr, i) => tr.cells[0].textContent = i + 1);
        refreshSimpleSelects();
        refreshAllMultiboxes();
        ensurePositionDatalist(); // NEW: привязать datalist ко всем .position
    }

    // ---- NEW: загрузить должности из 3+20 и создать datalist ----
    function ensurePositionDatalist() {
        let dl = document.getElementById('tpt-positions');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'tpt-positions';
            document.body.appendChild(dl);
        }
        // привязка ко всем инпутам "Должность"
        document.querySelectorAll('.position').forEach(inp => inp.setAttribute('list', 'tpt-positions'));

        // наполнить опции
        const positions = Object.keys(tptMap).sort();
        dl.innerHTML = positions.map(p => `<option value="${p}"></option>`).join('');
    }

    async function loadTptPositions() {
        try {
            const res = await fetch('/tpt_positions');
            const arr = await res.json();
            tptMap = {};
            (arr || []).forEach(item => {
                const name = (item.position || '').trim();
                if (!name) return;
                const key = name.toLowerCase();
                const mf  = Array.isArray(item.main_functions) ? item.main_functions.filter(Boolean) : [];
                tptMap[key] = mf;
            });
            ensurePositionDatalist();
        } catch (e) {
            console.warn('Не удалось загрузить должности из 3+20:', e);
            tptMap = {};
        }
    }

    function applyFunctionalFromTpt(tr) {
        const pos = tr.querySelector('.position')?.value?.trim().toLowerCase() || '';
        const mf = tptMap[pos] || [];
        if (mf.length) {
            const field = tr.querySelector('.functional');
            if (field && !field.value.trim()) { // не перетираем, если уже есть
                field.value = mf.join(', ');
            }
        }
    }

    // --- автозагрузка данных из БД ---
    fetch('/get_organizational_structure')
        .then(res => res.json())
        .then(rows => {
            if (!rows || !Array.isArray(rows) || !rows.length) return;

            // Очищаем все строки кроме первой
            while (tbody.rows.length > 1) tbody.deleteRow(1);

            // Заполняем строки из базы
            rows.forEach((row, idx) => {
                let tr = idx === 0 ? tbody.rows[0] : tbody.rows[0].cloneNode(true);
                tr.querySelector('.position').value = row.position || '';
                tr.querySelector('.staff-count').value = row.staffCount || 1;

                // supervisorIndex: 1-based (или null)
                syncTable(); // чтобы options появились
                if (row.supervisorIndex && tr.querySelector('.supervisor')) {
                    const options = [...tr.querySelector('.supervisor').options];
                    const needed = options.find(opt => (opt.value || '').startsWith(`${row.supervisorIndex})`));
                    if (needed) tr.querySelector('.supervisor').value = needed.value;
                }

                // NEW: основной функционал — из сохранённого или из 3+20
                tr.querySelector('.functional').value = row.functional || '';
                if (!row.functional) applyFunctionalFromTpt(tr);

                if (idx !== 0) tbody.appendChild(tr);
            });
            syncTable();
            drawOrgChart(rows);
        });

    // --- функция сбора данных (добавили functional!) ---
    function collectRows() {
        return [...tbody.rows].map((tr, idx) => {
            const rawSup = tr.querySelector('.supervisor').value.trim();
            const supervisorIndex = rawSup ? parseInt(rawSup.split(')')[0], 10) : null;
            return {
                position: tr.querySelector('.position').value.trim(),
                supervisorIndex: supervisorIndex,
                staffCount: Math.max(1, parseInt(tr.querySelector('.staff-count').value, 10) || 1),
                functional: tr.querySelector('.functional').value.trim()   // NEW
            };
        });
    }

    // --- автосохранение ---
    function autoSaveOrgStructure() {
        const rows = collectRows();
        fetch('/save_organizational_structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows })
        })
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .catch(err => console.error('Ошибка автосохранения:', err));
    }

    // --- события ---
    document.addEventListener('click', e => {
        if (e.target.classList.contains('multibox')) {
            const cell = e.target.closest('.subs-cell');
            const list = cell.querySelector('.multibox-list');
            const open = list.style.display === 'block';
            document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
            if (!open) { buildMultibox(cell); list.style.display = 'block'; }
            return;
        }
        if (e.target.closest('.multibox-list')) {
            const cell = e.target.closest('.subs-cell');
            const hidden = cell.querySelector('.subordinates');
            const vals = [...cell.querySelectorAll('input:checked')].map(i => i.value);
            hidden.value = JSON.stringify(vals);
            setMultiboxCaption(cell);
            autoSaveOrgStructure();
            return;
        }
        document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
    });

    addBtn.addEventListener('click', () => {
        const tpl = tbody.rows[0].cloneNode(true);
        tpl.querySelectorAll('input').forEach(i => i.value = '');
        tpl.querySelectorAll('select').forEach(s => s.innerHTML = '');
        tpl.querySelector('.subordinates').value = '[]';
        tbody.appendChild(tpl);
        syncTable();
        ensurePositionDatalist();   // NEW
        autoSaveOrgStructure();
    });

    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) {
            applyFunctionalFromTpt(e.target.closest('tr'));  // NEW
            syncTable();
        }
        autoSaveOrgStructure();
    });

    tbody.addEventListener('change', autoSaveOrgStructure);

    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            syncTable();
            autoSaveOrgStructure();
        }
    });

    sendBtn.addEventListener('click', () => {
        const rows = collectRows();
        fetch('/save_organizational_structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows })
        })
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .then(() => {
            alert('Данные успешно сохранены!');
            drawOrgChart(rows);
        })
        .catch(err => console.error('Ошибка сохранения:', err));
    });

    // ---- INIT ----
    (async () => {
        await loadTptPositions();  // NEW: загрузили должности из 3+20
        syncTable();
    })();
});

/* ====== Google OrgChart (без изменений) ====== */
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
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Name');
    dataTable.addColumn('string', 'Manager');
    dataTable.addColumn('string', 'ToolTip');
    buildChartData(rows).forEach(([node, parent]) => {
        dataTable.addRow([node, parent, '']);
    });
    const chart = new google.visualization.OrgChart(document.getElementById('orgChart'));
    chart.draw(dataTable, { allowHtml: true, nodeClass: 'node', collapseEndNodes: false });
}

document.getElementById('downloadChart').addEventListener('click', () => {
    const chartBlock = document.getElementById('orgChart');
    if (!chartBlock || !chartBlock.childElementCount) {
        alert('Сначала нажмите «Отправить», чтобы построить схему.');
        return;
    }
    const originalOverflow = chartBlock.style.overflow;
    const originalWidth = chartBlock.style.width;
    const originalHeight = chartBlock.style.height;

    chartBlock.style.overflow = 'visible';
    chartBlock.style.width = chartBlock.scrollWidth + 'px';
    chartBlock.style.height = chartBlock.scrollHeight + 'px';

    html2canvas(chartBlock, { backgroundColor: null })
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
