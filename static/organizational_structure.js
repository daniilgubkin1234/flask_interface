/************************************************************
 *  Организационная структура · v2024-05-rev2
 *  Отправляем одним документом  { rows:[ … ] }
 ************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#orgTable tbody');
    const addBtn = document.getElementById('addRow');
    const sendBtn = document.getElementById('submitData');

    /* ───────── helpers ───────── */
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
    }

    /* ───────── события ───────── */
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
    });

    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) syncTable();
    });

    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            syncTable();
        }
    });

    /* ───────── сбор данных ───────── */
    // --- 1) Собираем строки из таблицы, включая staffCount и чистый supervisorIndex ---
    function collectRows() {
        return [...tbody.rows].map((tr, idx) => {
            // rawSupervisorValue, например "2) Руководитель"
            const rawSup = tr.querySelector('.supervisor').value.trim();
            // вытащим только число до ")"
            const supervisorIndex = rawSup
                ? parseInt(rawSup.split(')')[0], 10)  // 1-based
                : null;                                 // корень, если пусто

            return {
                position: tr.querySelector('.position').value.trim(),
                supervisorIndex: supervisorIndex,       // число или null
                staffCount: Math.max(1, parseInt(tr.querySelector('.staff-count').value, 10) || 1)
            };
        });
    }

    /* ───────── отправка ───────── */
    sendBtn.addEventListener('click', () => {
        const rows = collectRows();
        const payload = { rows };                   // <— здесь главное изменение

        fetch('/save_organizational_structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(() => {
                alert('Данные успешно сохранены!');
                drawOrgChart(rows);                     // диаграмму строим из локального массива
            })
            .catch(err => console.error('Ошибка сохранения:', err));
    });

    syncTable();
});

/* ====== Google OrgChart ====== */
google.charts.load('current', { packages: ['orgchart'] });

// --- 2) Строим массив для Google OrgChart без лишнего ROOT,
//     причём при staffCount>1 цепляем дополнительными узлами под первым ---
function buildChartData(rows) {
    const list = [];

    rows.forEach((r, idx) => {
        if (!r.position) return;
        const baseNum = idx + 1;            // 1-based ID
        const firstId = `n${baseNum}_1`;    // например "n3_1"

        // чей parent?
        const parentId = r.supervisorIndex
            ? `n${r.supervisorIndex}_1`       // первый узел supervisor-а
            : '';                              // пустая строка — Google считает корнем

        // 1) всегда первый «экземпляр» под parentId
        list.push([
            { v: firstId, f: `<div class="node">${r.position}</div>` },
            parentId
        ]);

        // 2) если их несколько — цепочкой друг под другом
        for (let i = 2; i <= r.staffCount; i++) {
            const prevId = `n${baseNum}_${i - 1}`;
            const currId = `n${baseNum}_${i}`;
            list.push([
                { v: currId, f: `<div class="node">${r.position}</div>` },
                prevId
            ]);
        }
    });

    return list;
}

// --- 3) Основная функция рисования схемы ---
function drawOrgChart(rows) {
    const dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Name');
    dataTable.addColumn('string', 'Manager');
    dataTable.addColumn('string', 'ToolTip');

    buildChartData(rows).forEach(([node, parent]) => {
        dataTable.addRow([node, parent, '']);
    });

    const chart = new google.visualization.OrgChart(
        document.getElementById('orgChart')
    );
    chart.draw(dataTable, {
        allowHtml: true,
        nodeClass: 'node',
        collapseEndNodes: false
    });
}

document.getElementById('downloadChart').addEventListener('click', () => {
    const chartBlock = document.getElementById('orgChart');

    if (!chartBlock || !chartBlock.childElementCount) {
        alert('Сначала нажмите «Отправить», чтобы построить схему.');
        return;
    }

    /* 1. Снимаем ограничения прокрутки, чтобы html2canvas «увидел» весь контент */
    const originalOverflow = chartBlock.style.overflow;
    const originalWidth = chartBlock.style.width;
    const originalHeight = chartBlock.style.height;

    chartBlock.style.overflow = 'visible';
    chartBlock.style.width = chartBlock.scrollWidth + 'px';
    chartBlock.style.height = chartBlock.scrollHeight + 'px';

    /* 2. Делаем скриншот */
    html2canvas(chartBlock, { backgroundColor: null })
        .then(canvas => {
            /* 3. Возвращаем старые размеры */
            chartBlock.style.overflow = originalOverflow;
            chartBlock.style.width = originalWidth;
            chartBlock.style.height = originalHeight;

            /* 4. Скачиваем PNG */
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'Организационная структура. Cхема подчинения.png';
            document.body.appendChild(link);   // для Safari
            link.click();
            link.remove();
        })
        .catch(err => {
            console.error('Не удалось сохранить схему:', err);
            alert('Ошибка сохранения схемы. Подробности в консоли.');
            /* возвращаем размеры даже в случае ошибки */
            chartBlock.style.overflow = originalOverflow;
            chartBlock.style.width = originalWidth;
            chartBlock.style.height = originalHeight;
        });
});