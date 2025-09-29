// business_goal_form.js

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('businessForm');
    const addStageBtn = document.getElementById('addStageBtn');
    const table = document.getElementById('stagesTable').getElementsByTagName('tbody')[0];
    document.querySelector('.toggle-sidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        // Одновременно применяем классы для синхронной анимации
        sidebar.classList.toggle('show');
        button.classList.toggle('menu-open');
    });

    // --- 2. Закрытие меню при клике вне области
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

function ensureActionsCell(row) {
  if (row.querySelector('.remove-stage')) return; // уже добавлена
  const td = document.createElement('td');
  td.className = 'actions';
  td.innerHTML = `<button type="button" class="remove-stage" title="Удалить этап">Удалить</button>`;
  row.appendChild(td);
}

// Делегирование клика по кнопке "Удалить" для всех строк (включая добавленные динамически)
table.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-stage');
  if (!btn) return;
  const tr = btn.closest('tr');
  if (!tr) return;
  if (confirm('Удалить этот этап?')) {
    tr.remove();
    // Удаление — это не "input"-событие, поэтому вручную дергаем автосохранение:
    autoSaveBusinessGoal();
  }
});
    // --- 1. АВТОЗАГРУЗКА бизнес-цели пользователя ---
    fetch('/get_business_goal')
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            document.getElementById('financeRevenue').value = data.financeRevenue || '';
            document.getElementById('financeProfit').value = data.financeProfit || '';
            document.getElementById('personnelCount').value = data.personnelCount || '';
            document.getElementById('averageSalary').value = data.averageSalary || '';
            document.getElementById('clientBase').value = data.clientBase || '';
            document.getElementById('conversionRate').value = data.conversionRate || '';
            document.getElementById('taxes').value = data.taxes || '';
            document.getElementById('treePlanting').value = data.treePlanting || '';
            document.getElementById('startDate').value = data.startDate || '';

            // Очистить все строки кроме первой
            while (table.rows.length > 1) table.deleteRow(1);

            // Восстановить этапы (если есть)
            if (Array.isArray(data.stages) && data.stages.length > 0) {
                data.stages.forEach((stage, idx) => {
                    let row;
                    if (idx === 0) {
                        row = table.rows[0];
                    } else {
                        row = document.createElement('tr');
                        row.innerHTML = `
                            <td><input type="text" name="stageNumber[]" placeholder="Название этапа" required></td>
                            <td><textarea name="stageDescription[]" placeholder="Описание этапа" required></textarea></td>
                            <td><input type="date" name="stageDate[]" required></td>
                        `;
                        table.appendChild(row);
                    }
                    ensureActionsCell(row);
                    row.querySelector("input[name='stageNumber[]']").value = stage.stageNumber || '';
                    row.querySelector("textarea[name='stageDescription[]']").value = stage.stageDescription || '';
                    row.querySelector("input[name='stageDate[]']").value = stage.stageDate || '';
                });
            }
        });

    // --- 2. АВТОСОХРАНЕНИЕ при любом изменении ---
    function autoSaveBusinessGoal() {
        const businessGoalData = {
            financeRevenue: document.getElementById('financeRevenue').value,
            financeProfit: document.getElementById('financeProfit').value,
            personnelCount: document.getElementById('personnelCount').value,
            averageSalary: document.getElementById('averageSalary').value,
            clientBase: document.getElementById('clientBase').value,
            conversionRate: document.getElementById('conversionRate').value,
            taxes: document.getElementById('taxes').value,
            treePlanting: document.getElementById('treePlanting').value,
            startDate: document.getElementById('startDate').value,
            stages: []
        };

        const stageRows = table.querySelectorAll('tr');
        stageRows.forEach(row => {
            businessGoalData.stages.push({
                stageNumber: row.querySelector("input[name='stageNumber[]']").value,
                stageDescription: row.querySelector("textarea[name='stageDescription[]']").value,
                stageDate: row.querySelector("input[name='stageDate[]']").value
            });
        });

        fetch("/add_business_goal", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(businessGoalData)
        });
    }

    // Навесить автосохранение на все поля формы и таблицы
    form.addEventListener('input', autoSaveBusinessGoal);

    // --- 3. КНОПКА "Добавить этап" ---
    addStageBtn.addEventListener('click', function () {
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="text" name="stageNumber[]" placeholder="Название этапа" required></td>
            <td><textarea name="stageDescription[]" placeholder="Описание этапа" required></textarea></td>
            <td><input type="date" name="stageDate[]" required></td>
        `;
        table.appendChild(newRow);
        ensureActionsCell(newRow);
        autoSaveBusinessGoal(); // автосохраняем сразу после добавления этапа
    });
// --- 5. Экспорт .doc по кнопке "Загрузить бизнес-цель" ---
const downloadBGBtn = document.getElementById('downloadBusinessGoal');
if (downloadBGBtn) {
  downloadBGBtn.addEventListener('click', () => {
    const data = collectBusinessGoalData();
    const html = buildBusinessGoalDocHTML(data);
    const datePart = (data.startDate || new Date().toISOString().slice(0,10)).replaceAll('-', '.');
    downloadDoc(html, `Бизнес_цель_${datePart}.doc`);
  });
}

// Собираем данные формы (аналогично autoSaveBusinessGoal, но без запроса на сервер)
function collectBusinessGoalData() {
  const stages = [];
  const rows = document.querySelectorAll('#stagesTable tbody tr');
  rows.forEach(r => {
    stages.push({
      stageNumber: r.querySelector("input[name='stageNumber[]']")?.value?.trim() || '',
      stageDescription: r.querySelector("textarea[name='stageDescription[]']")?.value?.trim() || '',
      stageDate: r.querySelector("input[name='stageDate[]']")?.value || ''
    });
  });

  return {
    financeRevenue: document.getElementById('financeRevenue')?.value?.trim() || '',
    financeProfit:  document.getElementById('financeProfit')?.value?.trim()  || '',
    personnelCount: document.getElementById('personnelCount')?.value?.trim() || '',
    averageSalary:  document.getElementById('averageSalary')?.value?.trim()  || '',
    clientBase:     document.getElementById('clientBase')?.value?.trim()     || '',
    conversionRate: document.getElementById('conversionRate')?.value?.trim() || '',
    taxes:          document.getElementById('taxes')?.value?.trim()          || '',
    treePlanting:   document.getElementById('treePlanting')?.value?.trim()   || '',
    startDate:      document.getElementById('startDate')?.value              || '',
    stages
  };
}

// Генерим HTML для .doc
function buildBusinessGoalDocHTML(d) {
  const esc = (s) => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const formatDateRU = (iso) => {
    if (!iso) return '';
    const [y,m,da] = iso.split('-'); return `${da}.${m}.${y}`;
  };

  const stagesRows = (d.stages?.length ? d.stages : [{stageNumber:'',stageDescription:'',stageDate:''}])
    .map((s,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${esc(s.stageNumber)}</td>
        <td>${esc(s.stageDescription)}</td>
        <td>${esc(formatDateRU(s.stageDate))}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Бизнес-цель</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.35; }
  h1   { text-align:center; font-size:18pt; margin:0 0 12pt; }
  h2   { font-size:14pt; margin:12pt 0 6pt; }
  table { width:100%; border-collapse:collapse; margin:8pt 0; }
  th, td { border:1px solid #000; padding:6pt; vertical-align:top; }
  th { text-align:center; }
  .meta p { margin:0 0 6pt; }
</style>
</head>
<body>
  <h1>Бизнес-цель</h1>

  <div class="meta">
    <p><b>Дата старта:</b> ${esc(formatDateRU(d.startDate))}</p>
  </div>

  <h2>Финансы</h2>
  <p><b>Выручка:</b> ${esc(d.financeRevenue)}</p>
  <p><b>Прибыль:</b> ${esc(d.financeProfit)}</p>

  <h2>Персонал</h2>
  <p><b>Количество человек:</b> ${esc(d.personnelCount)}</p>
  <p><b>Средняя ЗП, руб./мес.:</b> ${esc(d.averageSalary)}</p>

  <h2>Продажи</h2>
  <p><b>Клиентская база, чел.:</b> ${esc(d.clientBase)}</p>
  <p><b>Конверсия, %:</b> ${esc(d.conversionRate)}</p>

  <h2>Социальная ответственность</h2>
  <p><b>Уплата налогов, руб./год:</b> ${esc(d.taxes)}</p>
  <p><b>Другое:</b> ${esc(d.treePlanting)}</p>

  <h2>Этапы реализации</h2>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">№</th>
        <th>Название этапа</th>
        <th>Описание этапа</th>
        <th style="width:18%;">Дата</th>
      </tr>
    </thead>
    <tbody>
      ${stagesRows}
    </tbody>
  </table>
</body>
</html>`;
}

// Скачивание .doc
function downloadDoc(htmlString, filename) {
  const blob = new Blob([htmlString], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
    // --- 4. САБМИТ ФОРМЫ ---
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // Можно оставить только alert, так как автосохранение уже происходит
        alert('Данные бизнес-цели сохранены!');
        // form.reset(); // если нужно сбрасывать форму после отправки
    });
});
