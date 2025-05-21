/*******************************************************
 *  Организационная структура – скрипт страницы
 *  (без Choices.js, multibox-dropdown для подчинённых)
 *******************************************************/
document.addEventListener('DOMContentLoaded', () => {

    /* ────────── DOM ────────── */
    const tbody   = document.querySelector('#orgTable tbody');
    const addRow  = document.getElementById('addRow');
    const submit  = document.getElementById('submitData');

    /* ────────── ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ────────── */
    const genId = () =>
    'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  
  const uuid = (crypto.randomUUID ? () => crypto.randomUUID() : genId);  // единая функция
    /** «1) Директор», «2) Менеджер» … */
    const getPositions = () =>
        Array.from(document.querySelectorAll('.position'))
             .map((inp, i) => inp.value.trim() && `${i + 1}) ${inp.value.trim()}`)
             .filter(Boolean);

    /** Обновить простые <select> supervisor / replacement */
    function rebuildSimpleSelects() {
        const options = ['<option value="">Выберите</option>',
                         ...getPositions().map(p => `<option value="${p}">${p}</option>`)]
                         .join('');
        document.querySelectorAll('.supervisor, .replacement').forEach(sel => {
            const selected = Array.from(sel.selectedOptions).map(o => o.value);
            sel.innerHTML = options;
            selected.forEach(v => {
                const opt = [...sel.options].find(o => o.value === v);
                if (opt) opt.selected = true;
            });
        });
    }

    /** Сформировать чек-боксы для multibox-меню в одной ячейке */
    function buildMultiboxMenu(cell) {
        const menu   = cell.querySelector('.multibox-list');
        const hidden = cell.querySelector('.subordinates');
        const chosen = JSON.parse(hidden.value || '[]');      // массив строк
        menu.innerHTML = '';

        getPositions().forEach(p => {
            const id = uuid();
            menu.insertAdjacentHTML('beforeend', `
                <label for="${id}">
                    <input type="checkbox" id="${id}" value="${p}"
                           ${chosen.includes(p) ? 'checked' : ''}>
                    ${p}
                </label>
            `);
        });
        updateMultiboxCaption(cell);
    }

    /** Обновить текст в multibox-контейнере */
    function updateMultiboxCaption(cell) {
        const box  = cell.querySelector('.multibox');
        const data = JSON.parse(cell.querySelector('.subordinates').value || '[]');
        if (!data.length) {
            box.textContent = 'Выберите';
            box.classList.add('placeholder');
        } else {
            box.textContent = data.join(', ');
            box.classList.remove('placeholder');
        }
    }

    /** Полностью пересобрать multibox-колонку во всех строках */
    function rebuildMultiboxes() {
        tbody.querySelectorAll('.subs-cell').forEach(buildMultiboxMenu);
    }

    /** Пересчитать № строк + обновить селекты и multibox */
    function renumberAndRefresh() {
        tbody.querySelectorAll('tr').forEach((tr, i) => tr.cells[0].textContent = i + 1);
        rebuildSimpleSelects();
        rebuildMultiboxes();
    }

    /* ────────── ИНИЦИАЛИЗАЦИЯ MULTIBOX ПОВЕДЕНИЯ ────────── */
    document.addEventListener('click', e => {

        /* клик по самому контейнеру ⇒ открыть/закрыть список */
        if (e.target.classList.contains('multibox')) {
            const cell   = e.target.closest('.subs-cell');
            const list   = cell.querySelector('.multibox-list');
            const opened = list.style.display === 'block';

            document.querySelectorAll('.multibox-list')
                    .forEach(l => l.style.display = 'none');

            if (!opened) {
                buildMultiboxMenu(cell);       // всегда актуальный список
                list.style.display = 'block';
            }
            return;
        }

        /* клики ВНУТРИ выпадающего меню (чек-боксы) */
        if (e.target.closest('.multibox-list')) {
            const cell   = e.target.closest('.subs-cell');
            const menu   = cell.querySelector('.multibox-list');
            const hidden = cell.querySelector('.subordinates');
            const values = [...menu.querySelectorAll('input:checked')].map(i => i.value);

            hidden.value = JSON.stringify(values);
            updateMultiboxCaption(cell);
            return;
        }

        /* клик НАДЕ — закрываем все выпадашки */
        document.querySelectorAll('.multibox-list')
                .forEach(l => l.style.display = 'none');
    });

    /* ────────── СОБЫТИЯ ТАБЛИЦЫ ────────── */

    /* добавить строку */
    addRow.addEventListener('click', () => {
        const n   = tbody.rows.length + 1;
        const tpl = tbody.rows[0].cloneNode(true);

        /* очистка значений в клоне */
        tpl.querySelectorAll('input').forEach(inp => { inp.value = ''; });
        tpl.querySelectorAll('select').forEach(sel => { sel.innerHTML = ''; });
        tpl.cells[0].textContent = n;

        tbody.appendChild(tpl);
        renumberAndRefresh();
    });

    /* ввод названия должности → обновить списки */
    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) renumberAndRefresh();
    });

    /* удалить строку */
    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            renumberAndRefresh();
        }
    });

    /* ────────── ОТПРАВКА ДАННЫХ ────────── */
    submit.addEventListener('click', () => {
        const dataset = Array.from(tbody.rows).map(tr => ({
            position    : tr.querySelector('.position').value.trim(),
            supervisor  : tr.querySelector('.supervisor').value,
            subordinates: JSON.parse(tr.querySelector('.subordinates').value || '[]'),
            functional  : tr.querySelector('.functional').value.trim(),
            replacement : tr.querySelector('.replacement').value,
            taskMethod  : tr.querySelector('.task-method').value.trim(),
            documents   : tr.querySelector('.documents').value.trim()
        }));

        fetch('/save_organizational_structure', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(dataset)
        })
        .then(r => r.json())
        .then(() => { alert('Данные сохранены!'); drawOrgChart('table'); })
        .catch(console.error);
    });

    /* стартовый рендер */
    renumberAndRefresh();
});

/* ────────── Google OrgChart (без изменений) ────────── */
google.charts.load('current', { packages : ['orgchart'] });
google.charts.setOnLoadCallback(() => drawOrgChart());

function buildChart(rows) {
    const arr = [];
    rows.forEach((r, i) => {
        if (!r.position) return;
        const id   = `n${i + 1}`;
        const sup  = r.supervisor;
        const par  = sup ? `n${sup.split(')')[0]}` : null;
        arr.push([{ v:id, f:`<div class="node">${r.position}</div>` }, par]);
    });
    if (!arr.some(a => a[1] === null))
        arr.unshift([{ v:'root', f:'<div>ROOT</div>' }, null]);
    arr.sort((a, b) => (a[1] === null ? -1 : 1));
    return arr;
}

function collectRows() {
    return Array.from(document.querySelectorAll('#orgTable tbody tr')).map(tr => ({
        position  : tr.querySelector('.position').value.trim(),
        supervisor: tr.querySelector('.supervisor').value.trim()
    }));
}

function drawOrgChart(src = 'api') {
    (src === 'table'
        ? Promise.resolve(collectRows())
        : fetch('/get_organizational_structure').then(r => r.json())
    ).then(rows => {
       const data = buildChart(rows);
        if (!data.length) {
            document.getElementById('orgChart').innerHTML = '<em>Нет данных</em>';
            return;
        }
        const dt = new google.visualization.DataTable();
        dt.addColumn('string', 'Name');
        dt.addColumn('string', 'Manager');
        dt.addRows(data);

        new google.visualization.OrgChart(document.getElementById('orgChart'))
            .draw(dt, { allowHtml : true, nodeClass : 'node' });
    }).catch(console.error);
}
document.getElementById('downloadChart').addEventListener('click', () => {
    const wrapper = document.getElementById('orgChart');
    const chartEl = wrapper.querySelector('.google-visualization-orgchart-table');

    if (!chartEl) {
        alert('Схема ещё не построена.');
        return;
    }

    /* реальные габариты диаграммы */
    const w = chartEl.scrollWidth;
    const h = chartEl.scrollHeight;

    html2canvas(chartEl, {
        scrollX: 0,
        scrollY: 0,
        scale  : 2,          // для чёткости
        width  : w,
        height : h
    }).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'org_chart.png';
        link.click();
    });
});