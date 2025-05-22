/************************************************************
 *  Организационная структура  ·  v2024-05
 *  − сохраняем только данные таблицы, без загрузки схемы из БД
 ************************************************************/

/* ====== инициализация ==================================== */
document.addEventListener('DOMContentLoaded', () => {

    /* ───── DOM ───── */
    const tbody  = document.querySelector('#orgTable tbody');
    const addBtn = document.getElementById('addRow');
    const sendBtn= document.getElementById('submitData');

    /* ───── polyfill UUID ───── */
    const fallbackId = () =>
        'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const makeUUID   = crypto.randomUUID ? () => crypto.randomUUID() : fallbackId;

    /* ------------------------------------------------------- */
    /*        вспомогательные функции                         */
    /* ------------------------------------------------------- */

    /* собрать все введённые должности для выпадашек */
    const getPositions = () =>
        [...document.querySelectorAll('.position')]
            .map((inp, i) => inp.value.trim() && `${i + 1}) ${inp.value.trim()}`)
            .filter(Boolean);

    /* обновить обычные селекты «Кому подчиняется» / «Кто замещает» */
    function refreshSimpleSelects() {
        const opts = ['<option value="">Выберите</option>',
                      ...getPositions().map(p => `<option value="${p}">${p}</option>`)]
                      .join('');
        document.querySelectorAll('.supervisor, .replacement').forEach(sel => {
            const selected = [...sel.selectedOptions].map(o => o.value);
            sel.innerHTML = opts;
            selected.forEach(v => {
                const o = [...sel.options].find(x => x.value === v);
                if (o) o.selected = true;
            });
        });
    }

    /* подпись multibox-а */
    function refreshMultiboxCaption(cell) {
        const cap  = cell.querySelector('.multibox');
        const list = JSON.parse(cell.querySelector('.subordinates').value || '[]');
        cap.textContent = list.length ? list.join(', ') : 'Выберите';
        cap.classList.toggle('placeholder', !list.length);
    }

    /* построить список чек-боксов внутри multibox-меню */
    function buildMultiboxMenu(cell) {
        const menu   = cell.querySelector('.multibox-list');
        const hidden = cell.querySelector('.subordinates');
        const chosen = JSON.parse(hidden.value || '[]');

        menu.innerHTML = '';
        getPositions().forEach(p => {
            const id = makeUUID();
            menu.insertAdjacentHTML('beforeend', `
                <label for="${id}">
                    <input type="checkbox" id="${id}" value="${p}" ${chosen.includes(p) ? 'checked' : ''}>
                    ${p}
                </label>
            `);
        });
        refreshMultiboxCaption(cell);
    }

    function rebuildAllMultiboxes() {
        tbody.querySelectorAll('.subs-cell').forEach(buildMultiboxMenu);
    }

    /* пересчитать № строк, обновить все списки */
    function renumberAndRefresh() {
        tbody.querySelectorAll('tr').forEach((tr, i) => tr.cells[0].textContent = i + 1);
        refreshSimpleSelects();
        rebuildAllMultiboxes();
    }

    /* ------------------------------------------------------- */
    /*        события                                          */
    /* ------------------------------------------------------- */

    /* multibox: открыть / клик по чек-боксу / клик вне */
    document.addEventListener('click', e => {

        /* клик по самой ячейке-capsule → открыть меню */
        if (e.target.classList.contains('multibox')) {
            const cell = e.target.closest('.subs-cell');
            const list = cell.querySelector('.multibox-list');
            const isOpen = list.style.display === 'block';

            document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
            if (!isOpen) { buildMultiboxMenu(cell); list.style.display = 'block'; }
            return;
        }

        /* клик внутри меню чек-боксов */
        if (e.target.closest('.multibox-list')) {
            const cell   = e.target.closest('.subs-cell');
            const hidden = cell.querySelector('.subordinates');
            const vals   = [...cell.querySelectorAll('input:checked')].map(i => i.value);
            hidden.value = JSON.stringify(vals);
            refreshMultiboxCaption(cell);
            return;
        }

        /* клик вне меню → закрыть все */
        document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
    });

    /* добавление строки */
    addBtn.addEventListener('click', () => {
        const tpl = tbody.rows[0].cloneNode(true);
        tpl.querySelectorAll('input').forEach(i => i.value = '');
        tpl.querySelectorAll('select').forEach(s => s.innerHTML = '');
        tpl.querySelector('.subordinates').value = '[]';
        tbody.appendChild(tpl);
        renumberAndRefresh();
    });

    /* ввод должности → пересчитать списки */
    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) renumberAndRefresh();
    });

    /* удаление строки */
    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            renumberAndRefresh();
        }
    });

    /* ------------------------------------------------------- */
    /*        сбор и отправка                                  */
    /* ------------------------------------------------------- */
    const collectRows = () => [...tbody.rows].map(tr => ({
        position    : tr.querySelector('.position').value.trim(),
        supervisor  : tr.querySelector('.supervisor').value.trim(),
        subordinates: JSON.parse(tr.querySelector('.subordinates').value || '[]'),
        functional  : tr.querySelector('.functional').value.trim(),
        replacement : tr.querySelector('.replacement').value.trim(),
        taskMethod  : tr.querySelector('.task-method').value.trim(),
        documents   : tr.querySelector('.documents').value.trim()
    }));

    sendBtn.addEventListener('click', () => {
        const rows = collectRows();

        fetch('/save_organizational_structure', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(rows)
        })
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .then(() => {
            alert('Данные успешно сохранены!');
            drawOrgChart(rows);                 // строим прямо из отправленных
        })
        .catch(err => console.error('Ошибка сохранения:', err));
    });

    /* первичная инициализация */
    renumberAndRefresh();
});

/* ====== Google OrgChart (только пакет) =================== */
google.charts.load('current', { packages: ['orgchart'] });
google.charts.setOnLoadCallback(() => {});   // без auto-draw

/* превращаем массив строк таблицы в формат OrgChart */
function buildChartData(rows) {
    const list = [];
    rows.forEach((r, i) => {
        if (!r.position) return;
        const id = `n${i + 1}`;
        const sup = (r.supervisor || '').split(')')[0];
        const parent = r.supervisor ? `n${sup}` : null;
        list.push([{ v: id, f: `<div class="node">${r.position}</div>` }, parent]);
    });
    if (!list.some(r => r[1] === null)) list.unshift([{ v: 'root', f: 'ROOT' }, null]);
    list.sort((a, b) => (a[1] === null ? -1 : 1));
    return list;
}

/* построить диаграмму */
function drawOrgChart(rows) {
    const data = buildChartData(rows);
    const target = document.getElementById('orgChart');

    if (!data.length) {
        target.innerHTML = '<em>Нет данных для построения схемы</em>';
        return;
    }

    const dt = new google.visualization.DataTable();
    dt.addColumn('string', 'Name');
    dt.addColumn('string', 'Manager');
    dt.addRows(data);

    new google.visualization.OrgChart(target)
        .draw(dt, { allowHtml: true, nodeClass: 'node' });
}
