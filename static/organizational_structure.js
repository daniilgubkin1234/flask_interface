/************************************************************
 *  Организационная структура  ·  v2024-05-complete
 *  – сохраняем только данные таблицы
 *  – OrgChart строится сразу из отправленного массива
 ************************************************************/

/* ====== запуск после загрузки DOM ======================= */
document.addEventListener('DOMContentLoaded', () => {

    /* ───── основные элементы ───── */
    const tbody   = document.querySelector('#orgTable tbody');
    const addBtn  = document.getElementById('addRow');
    const sendBtn = document.getElementById('submitData');

    /* ───── polyfill uuid ───── */
    const uuid = crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => 'id-' + Date.now().toString(36) + '-' +
                Math.random().toString(36).slice(2, 8);

    /* ========= ВСПОМОГАТЕЛЬНЫЕ ==================================== */

    /* 1. все введённые должности */
    const getPositions = () =>
        [...document.querySelectorAll('.position')]
            .map((inp, i) => inp.value.trim() && `${i + 1}) ${inp.value.trim()}`)
            .filter(Boolean);

    /* 2. обновить простые селекты */
    function refreshSimpleSelects() {
        const options = ['<option value="">Выберите</option>',
                         ...getPositions().map(p => `<option value="${p}">${p}</option>`)]
                         .join('');
        document.querySelectorAll('.supervisor, .replacement')
                .forEach(sel => {
                    const chosen = [...sel.selectedOptions].map(o => o.value);
                    sel.innerHTML = options;
                    chosen.forEach(v => {
                        const o = [...sel.options].find(x => x.value === v);
                        if (o) o.selected = true;
                    });
                });
    }

    /* 3. подпись multibox-а */
    function setMultiboxCaption(cell) {
        const cap  = cell.querySelector('.multibox');
        const list = JSON.parse(cell.querySelector('.subordinates').value || '[]');
        cap.textContent = list.length ? list.join(', ') : 'Выберите';
        cap.classList.toggle('placeholder', !list.length);
    }

    /* 4. создать меню чек-боксов в multibox */
    function buildMultibox(cell) {
        const menu   = cell.querySelector('.multibox-list');
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

    /* 5. пересчитать номера строк и обновить списки */
    function syncTable() {
        tbody.querySelectorAll('tr').forEach((tr, i) => tr.cells[0].textContent = i + 1);
        refreshSimpleSelects();
        refreshAllMultiboxes();
    }

    /* ========= События таблицы ==================================== */

    /* multibox: открыть / выбор / закрыть */
    document.addEventListener('click', e => {
        /* открыть меню */
        if (e.target.classList.contains('multibox')) {
            const cell = e.target.closest('.subs-cell');
            const list = cell.querySelector('.multibox-list');
            const open = list.style.display === 'block';

            document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
            if (!open) { buildMultibox(cell); list.style.display = 'block'; }
            return;
        }

        /* клик по чек-боксу */
        if (e.target.closest('.multibox-list')) {
            const cell   = e.target.closest('.subs-cell');
            const hidden = cell.querySelector('.subordinates');
            const vals   = [...cell.querySelectorAll('input:checked')].map(i => i.value);
            hidden.value = JSON.stringify(vals);
            setMultiboxCaption(cell);
            return;
        }

        /* клик вне меню */
        document.querySelectorAll('.multibox-list').forEach(l => l.style.display = 'none');
    });

    /* добавить строку */
    addBtn.addEventListener('click', () => {
        const tpl = tbody.rows[0].cloneNode(true);
        tpl.querySelectorAll('input').forEach(i => i.value = '');
        tpl.querySelectorAll('select').forEach(s => s.innerHTML = '');
        tpl.querySelector('.subordinates').value = '[]';
        tbody.appendChild(tpl);
        syncTable();
    });

    /* ввод должности → пересчитать списки */
    tbody.addEventListener('input', e => {
        if (e.target.classList.contains('position')) syncTable();
    });

    /* удалить строку */
    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            syncTable();
        }
    });

    /* ========= сбор данных ========================================= */
    const collectRows = () =>
        [...tbody.rows].map(tr => ({
            position    : tr.querySelector('.position').value.trim(),
            supervisor  : tr.querySelector('.supervisor').value.trim(),
            subordinates: JSON.parse(tr.querySelector('.subordinates').value || '[]'),
            functional  : tr.querySelector('.functional').value.trim(),
            replacement : tr.querySelector('.replacement').value.trim(),
            taskMethod  : tr.querySelector('.task-method').value.trim(),
            documents   : tr.querySelector('.documents').value.trim()
        }));

    /* ========= отправка ============================================ */
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
            drawOrgChart(rows);                         // строим из того же массива
        })
        .catch(err => console.error('Ошибка сохранения:', err));
    });

    /* первичный расчёт */
    syncTable();
});

/* ====== Google OrgChart ================================== */
google.charts.load('current', { packages: ['orgchart'] });
google.charts.setOnLoadCallback(() => {});      // только загрузка пакета

/* превратить rows[] → указатели для OrgChart */
function buildChart(rows) {
    const list = [];
    rows.forEach((r, idx) => {
        if (!r.position) return;
        const id = `n${idx + 1}`;
        const sup = r.supervisor ? `n${r.supervisor.split(')')[0]}` : null;
        list.push([{ v: id, f: `<div class="node">${r.position}</div>` }, sup]);
    });
    if (!list.some(r => r[1] === null)) list.unshift([{ v: 'root', f: 'ROOT' }, null]);
    list.sort((a, b) => (a[1] === null ? -1 : 1));
    return list;
}

/* отрисовать диаграмму */
function drawOrgChart(rows) {
    const data = buildChart(rows);
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
